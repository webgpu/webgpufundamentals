Title: WebGPU Inter-stage Variables
Description: Passing Data from a Vertex Shader to a Fragment Shader
TOC: Inter-stage Variables

In the [previous article](webgpu-fundamentals.html) we covered a few super
basics about WebGPU. In this article we're going to go over *the basics* of
inter-stage variables. 

Inter-stage variables come into play between a vertex shader and a fragment
shader.

When a vertex shader outputs 3 positions a triangle gets rasterized. The vertex
shader can output extra values at each of those positions and by default, those
values will be interpolated between the 3 points.

Lets make a small example. We'll start with the triangle shaders from the
previous article. All we're going to do is change the shaders.

```js
  const module = device.createShaderModule({
-    label: 'our hardcoded red triangle shaders',
+    label: 'our hardcoded rgb triangle shaders',
    code: `
+      struct OurVertexShaderOutput {
+        @builtin(position) position: vec4f,
+        @location(0) color: vec4f,
+      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
        var pos = array<vec2f, 3>(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
+        var color = array<vec4f, 3>(
+          vec4f(1, 0, 0, 1), // red
+          vec4f(0, 1, 0, 1), // green
+          vec4f(0, 0, 1, 1), // blue
+        );

-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
      }

-      @fragment fn fs() -> @location(0) vec4f {
-        return vec4f(1, 0, 0, 1);
+      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+        return fsInput.color;
      }
    `,
  });
```

First off we declare a `struct`. This is one easy way to coordinate the
inter-stage variables between a vertex shader and a fragment shader.

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

We then declare our vertex shader to return a structure of this type

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

We create an array of 3 colors. 

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // red
          vec4f(0, 1, 0, 1), // green
          vec4f(0, 0, 1, 1), // blue
        );
```

And then instead of returning just a `vec4f` for position we declare an instance
of the structure, fill it out, and return it

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

In the fragment shader we declare it to take one of these structs as argument to
the function

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

And just return the color

If we run that we'll see, every time the GPU called our fragment shader it
passed in a color that interpolated between all 3 points.

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

Inter-stage variables are most often used to interpolate texture coordinates
across a triangle which we'll cover in [the article on textures](webgpu-textures.html).
Another common use is interpolating normals cross a triangle which will cover
in [the first article on lighting](webgpu-lighting-directional.html).

## Inter-stage variables connect by `location`

An important point, like nearly everything in WebGPU, the connection between the
vertex shader and the fragment shader is by index. For inter-stage variables
they connect by location index.

To see what I mean, let's change only the fragment shader to take `vec4f` parameter
at `location(0)` instead of the struct

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

Running that we see it still works.

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## `@builtin(position)`

That helps point out another quirk. Our original shader that used the same
struct in both the vertex and fragment shaders had a field called `position` but
it didn't have a location. Instead it was declared as `@builtin(position)`.

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

That field is **NOT** an inter-stage variable. Instead, it's a `builtin`. It
happens that `@builtin(position)` has a different meaning in a vertex shader vs
a fragment shader.

In a vertex shader `@builtin(position)` is the output that the GPU needs to draw
triangles/lines/points

In a fragment shader `@builtin(position)` is an input. It's the pixel coordinate
of the pixel the fragment shader is currently being asked to compute a color
for.

Pixel coordinates are specified by the edges of pixels. The values provided to
the fragment shader are the coordinates of the center of the pixel

If the texture we were drawing to was 3x2 pixels in size these we be the
coordinate.

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

We can change our shader to use this position. For example let's draw a
checkerboard.

```js
  const module = device.createShaderModule({
    label: 'our hardcoded checkerboard triangle shaders',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
-        @location(0) color: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        var pos = array<vec2f, 3>(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
-        var color = array<vec4f, 3>(
-          vec4f(1, 0, 0, 1), // red
-          vec4f(0, 1, 0, 1), // green
-          vec4f(0, 0, 1, 1), // blue
-        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-        return fsInput.color;
+        let red = vec4f(1, 0, 0, 1);
+        let cyan = vec4f(0, 1, 1, 1);
+
+        let grid = vec2u(fsInput.position.xy) / 8;
+        let checker = (grid.x + grid.y) % 2 == 1;
+
+        return select(red, cyan, checker);
      }
    `,
  });
```

The code above takes `fsInput.position`, which was declared as
`@builtin(position)`, and converts its `xy` coordinates to a `vec2u` which is 2
unsigned integers. It then divides them by 8 giving us a count that increases
every 8 pixels. It then adds the `x` and `y` grid coordinates together, computes
module 2, and compares the result to 1. This will give us a boolean that is true
or false every other pixel. Finally it uses the WGSL function `select` which
given 2 values, selects one or the other based on a boolean condition. In
JavaScript `select` would be written like this

```js
// If condition is false return `a`, otherwise return `b`
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

Even if you don't use `@builtin(position)` in a fragment shader, it's convenient
that it's there because it means we can use the same struct for both a vertex
shader and a fragment shader. What was important to takeaway is that the `position` struct
field in the vertex shader vs the fragment shader is entire unrelated. They're
entirely different variables.

As pointed out above though, for inter-stage variables, all that matters is the
`@location(?)`. So, it's not uncommon to declare different structs for a vertex
shader's output vs a fragment shaders input.

Note: It is not that common to generate a checkerboard using the
`@builtin(position)`. Checkerboards or other patterns are far more commonly
implemented [using textures](webgpu-textures.html). In fact you'll see an issue
if you size the window. Because the checkerboard is based on the pixel coordinates
of the canvas it's relative to the canvas, not relative to the triangle.

## Interpolation Settings

We saw above that inter-stage variables, the outputs from a vertex shader are
interpolated when passed to the fragment shader. There are 2 sets of settings
that can be changed for the interpolation happens. Setting them to anything
other than the defaults is not extremely common but there are use cases which
will be covered in other articles.

Interpolation type:

* `perspective`: Values are interpolated in a perspective correct manner (**default**)
* `linear`: Values are interpolated in a linear, non-perspective correct manner.
* `flat`:Values are not interpolated. Interpolation sampling is not used with flat interpolated

Interpolation sampling:

* `center`: Interpolation is performed at the center of the pixel (**default**)
* `centroid`: Interpolation is performed at a point that lies within all the samples covered by the fragment within the current primitive. This value is the same for all samples in the primitive.
* `sample`:  Interpolation is performed per sample. The fragment shader is invoked once per sample when this attribute is applied.

You specify these as attributes. For example

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

Note that if the inter-stage variable is an integer type then you must set its
interpolation to `flat`. 

If you set the interpolation type to `flat`, the value passed to the fragment shader
is the value of the inter-stage variable for the first vertex in that triangle.

In the [next article we'll cover uniforms](webgpu-uniforms.html) as another way to
pass data into shaders.