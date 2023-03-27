Title: WebGPU How It Works
Description: How WebGPU works
TOC: how-it-works

Let's try to explain this by implementing something similar to what the GPU does
with vertex shaders and fragment shaders but in JavaScript. Hopefully this will give
you an intuitive feeling about what's really going on. If you already know how GPUs
and shaders work, or if you find this section confusing, feel
free to skip to [the actual WebGPU code](#WebGPU).

If you're familiar with
[Array.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map),
if you squint real hard you can get some idea of how these 2 different kinds of
shader functions work. With `Array.map` you provide a function to transform a value.

Example:

```js
const shader = v => v * 2;  // double the input
const input = [1, 2, 3, 4];
const output = input.map(shader);   // result [2, 4, 6, 8]
```

Above our "shader" for array.map is just a function that given a number, returns
its double. That's probably the closest analogy in JavaScript to what "shader"
means. It's a function that returns or generates values. You don't call it
directly. Instead, you specify it and then the system calls it for you.

For a GPU vertex shader you don't map over an input array. Instead, you just
specify a count of how many times you want the function to be called.

```js
function draw(count, vertexShaderFn) {
  const internalBuffer = [];
  for (let i = 0; i < count; ++i) {
    internalBuffer[i] = vertexShaderFn(i);
  }
  console.log(JSON.stringify(internalBuffer));
}
```

One consequence is that unlike `Array.map`, we no longer need a source array to do something.

```js
const shader = v => v * 2;
const count = 4;
draw(count, shader);
// outputs [0, 2, 4, 6]
```

The thing that makes GPU work complicated is that these functions run on a separate
system in your computer, the GPU. This means all the data you create and reference
has to somehow be sent to the GPU and you then need to communicate to the shader
where you put that data and how to access it.

Vertex And Fragment shaders can take data in 6 ways. Uniforms, Attributes, Buffers, Textures, Varyings, Constants.

1. Uniforms

   Uniforms are values that are the same for each iteration of the shader. Think
   of them as constant global variables. You can set them before a shader is run
   but, while the shader is being used, they remain constant, or to put it
   another way, they remain *uniform*.

   Let's change `draw` to pass uniforms to a shader. To do this we'll
   make an array called `bindings` and use it to pass in the uniforms.

   ```js
   *function draw(count, vertexShaderFn, bindings) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
   *    internalBuffer[i] = vertexShaderFn(i, bindings);
     }
     console.log(JSON.stringify(internalBuffer));
   }
   ```

   And then let's change our shader to use the uniforms

   ```js
   const vertexShader = (v, bindings) => {
     const uniforms = bindings[0];
     return v * uniforms.multiplier;
   };
   const count = 4;
   const uniforms1 = {multiplier: 3};
   const uniforms2 = {multiplier: 5};
   const bindings1 = [uniforms1];
   const bindings2 = [uniforms2];
   draw(count, vertexShader, bindings1);
   // outputs [0, 3, 6, 9]
   draw(count, vertexShader, bindings2);
   // outputs [0, 5, 10, 15]
   ```

   So, the concept of uniforms hopefully seems pretty straight forward. The
   indirection through `bindings` is there because this "similar" to how things
   are done in WebGPU. Like was mentioned above, we access the things, in this case
   the uniforms, by location/index. Here they are found in `bindings[0]`.

2. Attributes (vertex shaders only)

   Attributes provide per shader iteration data. In `Array.map` above,
   the value `v` was pulled from `input` and automatically provided
   to the function. This is very similar to an attribute in a shader.

   The difference is, we are not mapping over the input, instead,
   because we are just counting, we need to tell WebGPU
   about these inputs and how to get data out of them.

   Imagine we updated `draw` like this

   ```js
   *function draw(count, vertexShaderFn, bindings, attribsSpec) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
   *    const attribs = getAttribs(attribsSpec, i);
   *    internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
     console.log(JSON.stringify(internalBuffer));
   }

   +function getAttribs(attribs, ndx) {
   +  return attribs.map(({source, offset, stride}) => source[ndx * stride + offset]);
   +}
   ```

   Then we could call it like this

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [
     { source: buffer1, offset: 0, stride: 2, },
     { source: buffer1, offset: 1, stride: 2, },
     { source: buffer2, offset: 0, stride: 1, },
   ];
   const vertexShader = (v, bindings, attribs) => (attribs[0] + attribs[1]) * attribs[2];
   const bindings = [];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // outputs [11, 110, 297, 572]
   ```

   As you can see above, `getAttribs` uses `offset`, and `stride` to
   compute indices into the corresponding `source` buffer and pulls out values.
   The pulled out values are then sent to the shader. On each iteration
   `attribs` will be different

   ```
    iteration |  attribs
    ----------+-------------
        0     | [0, 1, 11]
        1     | [2, 3, 22]
        2     | [4, 5, 33]
        3     | [6, 7, 44]
   ```

3. Raw Buffers

   Buffers are effectively arrays, again for our analogy let's make version
   of `draw` that uses buffers. We'll pass these buffers via `bindings`
   like we did with uniforms.

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [];
   const bindings = [
     buffer1,
     buffer2,
   ];
   const vertexShader = (ndx, bindings, attribs) => 
       (bindings[0][ndx * 2] + bindings[0][ndx * 2 + 1]) * bindings[1][ndx];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // outputs [11, 110, 297, 572]
   ```

   Here we got the same result as we did with attributes except this time,
   instead of the system pulling the values out of the buffers for us, we
   calculated our own indices into the bound buffers. This is more flexible than
   attributes since we basically have random access to the arrays. But, it's
   potentially slower for that same reason. Given the way attributes worked the
   GPU knows the values will be accessed in order which it can use to optimize.
   For example, in order access is usually cache friendly. When we calculate our
   own indices the GPU has no idea which part of a buffer we're going to access
   until we actually try to access it.

4. Textures

   Textures are 1d, 2d, or 3d arrays of data. Of course, we could implement
   our own 2d or 3d arrays using buffers. What's special about textures
   is they can be sampled. Sampling means that we can ask the GPU to compute
   a value between the values we supply. We'll cover that this means in
   [the article on textures](webgpu-textures.html). For now, let's make
   a JavaScript analogy again.

   First we'll create a function `textureSample` that *samples* an array
   between values

   ```js
   function textureSample(texture, ndx) {
     const startNdx = ndx | 0;  // round down to an int
     const fraction = ndx % 1;  // get the fractional part between indices
     const start = texture[startNdx];
     const end = texture[startNdx + 1];
     return start + (end - start) * fraction;  // compute value between start and end
   }
   ```

   A function something like that already exists on the GPU.

   Now let's use that in a shader.

   ```js
   const texture = [10, 20, 30, 40, 50, 60, 70, 80];
   const attribsSpec = [];
   const bindings = [
     texture,
   ];
   const vertexShader = (ndx, bindings, attribs) =>
       textureSample(bindings[0], ndx * 1.75);
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // outputs [10, 27.5, 45, 62.5]
   ```

   When `ndx` is `3` we'll pass in `3 * 1.75` or `5.25` into `textureSample`.
   That will compute a `startNdx` of `5`. So we'll pull out indices `5` and `6`
   which are `60` and `70`. `fraction` becomes `0.25`, so we'll get
   `60 + (70 - 60) * 0.25` which is `62.5`.

   Looking at the code above we could write `textureSample` ourselves in our shader
   function. We could manually pull out the 2 values and interpolate between them.
   The reason the GPU has this special functionality is it can do it much faster
   and, depending on the settings, it may read as many as sixteen 4-float values
   to produce one 4-float value for us. That would be a lot of work to do manually.

5. Varyings (fragment shaders only)

   Varyings are outputs from a vertex shader to a fragment shader. As was mentioned
   above, a vertex shader outputs positions that are used to draw/rasterize points,
   lines, and triangles. 
   
   Let's imagine we're drawing a line. Let's say our vertex shader was run
   twice, the first time it output the equivalent of `5,0` and the second time
   the equivalent of `25,4`. Given those 2 points the GPU will draw a line from
   `5,0` to `25,4` exclusive. To do this it will call our fragment shader 20
   times, once for each of the pixels on that line. Each time it calls our
   fragment shader it's up to us to decide what color to return.

   Let's assume we have pair of functions that help us draw a line between
   2 points. The first function computes how many pixel's we need to draw and some
   values to help draw them. The second takes that info plus a pixel number
   and gives us a pixel position. Example:

   ```js
   const line = calcLine([10, 10], [13, 13]);
   for (let i = 0; i < line.numPixels; ++i) {
     const p = calcLinePoint(line, i);
     console.log(p);
   }
   // prints
   // 10,10
   // 11,11
   // 12,12
   ```

   So, let's change our vertex shader so it outputs 2 values per iteration. We could do that in
   many ways. Here's one.

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;
   draw(count, vertexShader, bindings, attribsSpec);
   // outputs [[5, 0], [25, 4]]
   ```

   Now let's write some code that loops over points 2 at a time and 
   calls `mapLine` to rasterize a line.

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for (let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
       const p0 = inputs[ndx    ];
       const p1 = inputs[ndx + 1];
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
         const offset = p[1] * destWidth + p[0];  // y * width + x
         dest[offset] = fragShaderFn(bindings);
       }
     }
   }
   ```

   We can update draw to use that code like this

   ```js
   -function draw(count, vertexShaderFn, bindings, attribsSpec) {
   +function draw(dest, destWidth,
   +              count, vertexShaderFn, fragmentShaderFn,
   +              bindings, attribsSpec,
   +) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
       const attribs = getAttribs(attribsSpec, i);
       internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
   -  console.log(JSON.stringify(internalBuffer));
   +  rasterizeLines(dest, destWidth, internalBuffer,
   +                 fragmentShaderFn, bindings);
   }
   ```

   Now we're actually using `internalBuffer` 😃!
   
   Let's update the code that calls `draw`.

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;
   -draw(count, vertexShader, bindings, attribsSpec);

   +const width = 30;
   +const height = 5;
   +const pixels = new Array(width * height).fill(0);
   +const fragShader = (bindings) => 6;

   *draw(
   *   pixels, width,
   *   count, vertexShader, fragShader,
   *   bindings, attribsSpec);
   ```

   If we print `pixels` as a rectangle where `0` becomes `.` we'd get this

   ```
   .....666......................
   ........66666.................
   .............66666............
   ..................66666.......
   .......................66.....
   ```

   Unfortunately, our fragment shader gets no input that changes each iteration so
   there is no way to output anything different for each pixel. This is where
   varyings come in. Let's change our first shader to output an extra value.

   ```js
   const buffer1 = [5, 0, 25, 4];
   +const buffer2 = [9, 3];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   +  {source: buffer2, offset: 0, stride: 1},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => 
   -    [attribs[0], attribs[1]];
   +    [[attribs[0], attribs[1]], [attribs[2]]];

   ...
   ```

   If we changed nothing else, after the loop inside `draw`, `internalBuffer` would have
   these values

   ```js
    [ 
      [[ 5, 0], [9]],
      [[25, 4], [3]],
    ]
   ```

   We can easily compute a value from 0.0 to 1.0 that represents how far along
   the line we are. We can use this to interpolate the extra value we just
   added.

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for(let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
   -    const p0 = inputs[ndx    ];
   -    const p1 = inputs[ndx + 1];
   +    const p0 = inputs[ndx    ][0];
   +    const p1 = inputs[ndx + 1][0];
   +    const v0 = inputs[ndx    ].slice(1);  // everything but the first value
   +    const v1 = inputs[ndx + 1].slice(1);
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
   +      const t = i / line.numPixels;
   +      const varyings = interpolateArrays(v0, v1, t);
         const offset = p[1] * destWidth + p[0];  // y * width + x
   -      dest[offset] = fragShaderFn(bindings);
   +      dest[offset] = fragShaderFn(bindings, varyings);
       }
     }
   }

   +// interpolateArrays([[1,2]], [[3,4]], 0.25) => [[1.5, 2.5]]
   +function interpolateArrays(v0, v1, t) {
   +  return v0.map((array0, ndx) => {
   +    const array1 = v1[ndx];
   +    return interpolateValues(array0, array1, t);
   +  });
   +}

   +// interpolateValues([1,2], [3,4], 0.25) => [1.5, 2.5]
   +function interpolateValues(array0, array1, t) {
   +  return array0.map((a, ndx) => {
   +    const b = array1[ndx];
   +    return a + (b - a) * t;
   +  });
   +}
   ```

   Now we can use those varyings in our fragment shader

   ```js
   -const fragShader = (bindings) => 6;
   +const fragShader = (bindings, varyings) => varyings[0] | 0; // convert to int
   ```

   If we ran it now we'd see results like this

   ```
   .....988......................
   ........87776.................
   .............66655............
   ..................54443.......
   .......................33.....
   ```

   The first iteration of the vertex shader output `[[5,0], [9]` and
   the 2nd iteration output `[25,4], [3]` and you can see, 
   as the fragment shader was called, the 2nd value of each of those
   varied (was interpolated) between the 2 values.

   We could make another function `mapTriangle` that given 3 points
   rasterized a triangle calling the fragment shader function for each
   point inside the triangle. It would interpolate the varyings
   from 3 points instead of 2.

Here are all the examples above running live in case you find it
useful to play around with them to understand them.

{{{example url="../webgpu-javascript-analogies.html"}}}

What happens in the JavaScript above is an analogy. The details
of how varyings are actually interpolated, how lines are drawn, how
buffers are accessed, how textures are sampled, uniforms, attributes specified,
etc... are different in WebGPU, but the concepts are very similar so
I hope this JavaScript analogy provided some help in getting a mental
model of what's happening.

Why is it this way? Well, if you look at `draw` and `rasterizeLines`
you might notice that each iteration is entirely independent of
the other iterations. Another way to say this, you could process
each iteration in any order. Instead of 0, 1, 2, 3, 4 you could
process them 3, 1, 4, 0, 2 and you'd get the exact same result.
The fact that they are independent means each iteration can be
run in parallel by a different processor. Modern 2021 top end
GPUs have ~10000 processors. That means up to 10000 things can be
run in parallel. That is where the power of using the GPU comes from.
By following these patterns the system can massively parallelize
the work.

The biggest limitations are:

1. A shader function can only reference
   its inputs (attributes, buffers, textures, uniforms, varyings).

2. A shader can not allocate memory.

3. A shader can not reference its destination, the thing it's
   generating values for.

   When you think about it this makes sense. Imagine `fragShader`
   above tried to reference `dest` directly. That would mean when
   trying to parallelize things it would be impossible to coordinate.
   Which iteration would go first? If the 3rd iteration referenced `dest[0]`
   then the 0th iteration would need to run first but if the 0th iteration
   referenced `dest[3]` then the 3rd iteration would need to run first.
   That's a situation which is impossible to resolve. 
   Given we can compute our own indices in the shader there is no way
   for the GPU to know what the shader is going to access and so no way
   to do any coordination. So, the limit is, a shader cannot reference
   the thing it's generating values for. 

   Figuring out ways to solve problems within those limits is a big
   part of what GPU programming is about.
