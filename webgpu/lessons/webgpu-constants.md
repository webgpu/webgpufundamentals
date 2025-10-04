Title: WebGPU Shader Constants
Description: The fundamentals of WebGPU
TOC: Constants

I'm not sure this topic deserves to be considered an input to the shader.
But, from one point of view it is, so lets cover it.

Constants, or more formally, *pipeline-overridable constants* are a type
of constant you declare in your shader but you can change when you use
that shader to create a pipeline.

A simple example would be something like this

```wgsl
override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

Using this fragment shader with the vertex shader from [the article on fundamentals](webgpu-fundamentals.html)

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.5, -0.5),  // bottom left
    vec2f( 0.5, -0.5)   // bottom right
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
```

Now if we use this shader as is we'll get a black triangle

{{{example url="../webgpu-constants.html"}}}

But, we can change those constants, or "override" them when we specify the pipeline.

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
+      constants: {
+        red: 1,
+        green: 0.5,
+        blue: 1,
+      },
    },
  });
```

And now we get a pinkish color.

{{{example url="../webgpu-constants-override.html"}}}

Pipeline overridable constants can only be scalar values so boolean (true/false),
integers, floating point numbers. They can not be vectors or matrices.

If you don't specify a value in the shader then you **must** supply one in
the pipeline. You can also give them a numeric id and then refer to them
by their id.

Example:

```wgsl
override red: f32;             // Must be specified in the pipeline
@id(123) override green = 0.0; // May be specified by 'green' or by 123
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

You might ask, what is the point? I can just as easily do this when I
create the WGSL. For example

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
const red = ${red};
const green = ${green};
const blue = ${blue};

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
`;
```

Or even more directly

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(${red}, ${green}, ${blue}, 1.0);
}
`;
```

The difference is, pipeline overridable constants can be applied AFTER
the shader module has been created which makes them technically faster
to apply then creating a new shader module. Creating a pipeline is
not a fast operation though so it's not clear how much time this saves
on the overall process of creating a pipeline. It's possible though,
that the WebGPU implementation can use information from the first time
you created a pipeline with certain constants so that the next time
you create it with different constants, much less work is done.

In any case, it is one way to get some small amount of data into a shader.

## entry points are independently evaluated

It's also important to remember that entry points are evaluated in
isolation as was partially covered in
[the article on inter-stage variables](webgpu-inter-stage-variables.html#a-builtin-position).

It's as though the code passed to `createShaderModule` was striped
of everything not relevant to the current entry point. Pipeline
override constants are applied, then, the shader for that entry point is
created.

Let's expand our example above. We'll change the shader so both the vertex
and fragment stages use the constants. We'll pass the vertex stage's value
to the fragment stage. We'll then draw every other vertical strip of 50
pixels with one value or the other. 

```wgsl
+struct VOut {
+  @builtin(position) pos: vec4f,
+  @location(0) color: vec4f,
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
-) -> @builtin(position) vec4f {
+) -> VOut {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.5, -0.5),  // bottom left
    vec2f( 0.5, -0.5)   // bottom right
  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return VOut(
+    vec4f(pos[vertexIndex], 0.0, 1.0),
+    vec4f(red, green, blue, 1),
+  );
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;

-@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(red, green, blue, 1.0);
+@fragment fn fs(v: VOut) -> @location(0) vec4f {
+  let colorFromVertexShader = v.color;
+  let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
+  // select one color or the other every 50 pixels
+  return select(
+    colorFromVertexShader,
+    colorFromFragmentShader,
+    v.pos.x % 100.0 > 50.0);
}
```

Now we'll pass different constants into the each entry point

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
+      constants: {
+        red: 1,
+        green: 1,
+        blue: 0,
+      },
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

The result shows the constants were different in each stage

{{{example url="../webgpu-constants-override-set-entry-points.html"}}}

Again, functionally, the fact that we used one shader module with one WGSL `code`
is just a convenience. The code above is functionally equivalent to

```js
  const vertexModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VOut {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return VOut(
          vec4f(pos[vertexIndex], 0.0, 1.0),
          vec4f(red, green, blue, 1),
        );
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;
    `,
  });

  const fragmentModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;

      @fragment fn fs(v: VOut) -> @location(0) vec4f {
        let colorFromVertexShader = v.color;
        let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
        // select one color or the other every 50 pixels
        return select(
          colorFromVertexShader,
          colorFromFragmentShader,
          v.pos.x % 100.0 > 50.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
*      module: vertexModule,
      constants: {
        red: 1,
        green: 1,
        blue: 0,
      },
    },
    fragment: {
*      module: fragmentModule,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

{{{example url="../webgpu-constants-override-separate-modules.html"}}}

Note: It is **not** common to use pipeline overridable constants to pass in a color.
We used a color because it's easy to understand and to show the results.