Title: WebGPU Textures
Description: How to use Textures
TOC: Textures

In this article we'll cover the fundamentals of textures. In previous articles
we covered the other major ways to pass data into a shader. They were
[inter-stage variables](webgpu-inter-stage-variables.html),
[uniforms](webgpu-uniforms.html), [storage-buffers](webgpu-storage-buffers.html),
and [vertex-buffers](webgpu-vertex-buffers). The last major way to pass data
into a shader is textures.

Textures most often represent a 2d image. A 2d image is just a 2d array of
color values so you might wonder, why do we need textures for 2d arrays?
We could just use storage buffers as 2d arrays. What makes textures special
is that they can be accessed by special hardware called a *sampler*. A
sampler can read up to 16 different values in a texture and blend them together
in a way that is useful for many common use cases.

As one example, lets say I want to draw a 2d image larger than its original size.

<div class="center">
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 128px; height: 128px; image-rendering: pixelated; image-rendering: crisp-edges;"></div>
    <div style="text-align: center;">original</div>
  </div>
</div>

If we just simply take a single pixel from the original image to make each pixel in the larger image
we'll end up with the first example below. If instead, for a given pixel in the larger image we consider
multiple pixels from the original image we can get results like the 2nd image below.

<div class="webgpu_center compare">
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 512px; height: 512px; image-rendering: pixelated; image-rendering: crisp-edges;"></div>
    <div>un-filtered</div>
  </div>
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 512px; height: 512px;"></div>
    <div>filtered</div>
  </div>
</div>

While there are WGSL functions that will get an individual pixel from a texture and there are use cases
for that, those functions are not all that interesting because we could do the same with storage buffers.
The interesting WGSL functions for textures are ones that filter and can read multiple pixels.

These WGSL functions take a texture which represents that data, a sampler which represents how
we want to pull data out of the texture, and a texture coordinate which specifies where we want to
get a value from the texture.

Texture coordinates for 2D textures go from 0.0 to 1.0 across and down a texture regardless
of the actual size of the texture. [^up-or-down]

[^up-or-down]: Whether texture coordinates go up (0 = bottom, 1 = top) or down (0 = top, 1 = bottom) is
a matter of perspective. What's important is that texture coordinate 0,0 references the first data in
the texture.

<div class="webgpu_center"><img src="resources/texture-coordinates-diagram.svg" style="width: 500px;"></div>

Let's take one of our samples from [the article on inter-stage variables](webgpu-inter-stage-variables.html)
and modify it to draw with a texture.

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) texcoord: vec2f,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
-  var pos = array<vec2f, 3>(
-    vec2f( 0.0,  0.5),  // top center
-    vec2f(-0.5, -0.5),  // bottom left
-    vec2f( 0.5, -0.5)   // bottom right
-  );
-  var color = array<vec4f, 3>(
-    vec4f(1, 0, 0, 1), // red
-    vec4f(0, 1, 0, 1), // green
-    vec4f(0, 0, 1, 1), // blue
-  );
+  var pos = array<vec2f, 6>(
+    // 1st triangle
+    vec2f( 0.0,  0.0),  // center
+    vec2f( 1.0,  0.0),  // right, center
+    vec2f( 0.0,  1.0),  // center, top
+
+    // 2st triangle
+    vec2f( 0.0,  1.0),  // center, top
+    vec2f( 1.0,  0.0),  // right, center
+    vec2f( 1.0,  1.0),  // right, top
+  );

  var vsOutput: OurVertexShaderOutput;
-  vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-  vsOutput.color = color[vertexIndex];
+  let xy = pos[vertexIndex];
+  vsOutput.position = vec4f(xy, 0.0, 1.0);
+  vsOutput.texcoord = xy;
  return vsOutput;
}

+@group(0) @binding(0) var ourSampler: sampler;
+@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-  return fsInput.color;
+  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

Above we changed from 3 vertices that draw a centered triangle to 6 vertices
that draw a quad in the top right corner of the canvas.

We changed `OutVertexShaderOutput` to pass `texcoord`, a `vec2f` so we can
pass texture coordinates to the fragment shader. We changed the vertex shader
to set `vsOutput.texcoord` to the same as the clip space position we pulled
out of our hard coded array of positions. `vsOutput.texcoord` will be
interpolated between the 3 vertices of each triangle when passed to the
fragment shader.

We then declared a sampler and texture and referenced those in our fragment
shader. The function `textureSample` *samples* a texture. The first parameter
is the texture to sample. The 2nd parameter is the sampler to specify how
to sample the texture. The 3rd is the texture coordinate to sample.

Now we need to create a texture data. We'll make a 5x7 texel `F` [^texel]

[^texel]: A texel is a "texture element" vs a pixel which is a "picture element".
For me texel and pixel are basically synonymous but some people prefer to use
the world *texel* when discussing textures.

```js
  const kTextureWidth = 5;
  const kTextureHeight = 7;
  const _ = [255,   0,   0, 255];  // red
  const y = [255, 255,   0, 255];  // yellow
  const b = [  0,   0, 255, 255];  // blue
  const textureData = new Uint8Array([
    b, _, _, _, _,
    _, y, y, y, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, _, _, _, _,
  ].flat());
```

Hopefully you can see the `F` in there as well as a blue texel in the top
left corner (the first value).

We're going to create a `rgba8unorm` texture. `rgba8unorm` means the texture will
have red, green, blue, and alpha values. Each value will be 8 bits unsigned, and
will be normalized when used in the texture. `unorm` means `unsigned normalize`
which is fancy way of saying the value will be converted from (0 to 255) to (0 to 1).

In other words if the value we put in the texture is `[64, 128, 192, 255]` the value
in the shader will end up being `[64 / 255, 128 / 255, 192 / 255, 255 / 255]` or to
put it another way `[0.25, 0.50, 0.75, 1.00]`

Now that we have the data we need to make a texture

```js
  const tex = device.createTexture({
    size: [kTextureWidth, kTextureHeight, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
```

For `device.createTexture`, the `size` parameter should be pretty obvious. The
format is `rgba8unorm` as mentioned above. For the `usage`, `TEXTURE_BINDING`
says we want to be able to bind this texture into a bind group and `COPY_DST`
means we want to be able to copy data to it.

Next we need to do just that and copy our data to it.

```js
  device.queue.writeTexture(
      { texture: tex },
      textureData,
      { bytesPerRow: kTextureWidth * 4 },
      { width: kTextureWidth, height: kTextureHeight },
  );
```

For `device.queue.writeTexture` the first parameter is the texture we want to update.
The second is the data we want to copy do it. The 3rd defines how to read that data
when copying it to the texture. `bytesPerRow` specifies how many bytes to get from
one row of the source data to the next row. Finally, the least parameter specifies
the size of the copy.

We also need to make a sampler

```js
  const sampler = device.createSampler();
```

We need to add both the texture and the sampler to a bind group with bindings
that match the `@binding(?)`s we put in the shader.

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: tex.createView() },
    ],
  });
```

To update our rendering we need to specify the bind group and render 6 vertices
to render our quad consisting of 2 triangles.

```js
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
+    pass.setBindGroup(0, bindGroup);
-    pass.draw(3);  // call our vertex shader 3 times
+    pass.draw(6);  // call our vertex shader 6 times
    pass.end();
```

and running it we get this

{{{example url="../webgpu-simple-textured-quad.html"}}}

**Why is the F upside down?**

If you go back and reference the texture coordinate diagram again you can see
that texture coordinate 0,0 references the first texel of the texture. The
position in the center of the canvas of our quad is 0,0 and we use that value as
a texture coordinate so it's doing what the diagram shows, a 0,0 texture
coordinate is referencing the first blue texel.

To fix this there are 2 common solutions.

1. Flip the texture coordinates

   In this example we could change the texture coordinate in either
   the vertex shader
   
   ```wgsl
   -  vsOutput.texcoord = xy;
   +  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
   ```
   
   or fragment shader

   ```wgsl
   -  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
   +  let texcoord = vec2f(fsInput.texcoord.x, 1.0 - fsInput.texcoord.y);
   +  return textureSample(ourTexture, ourSampler, texcoord);
   ```

   Of course if we were supplying texture coordinates via [vertex buffers](webgpu-vertex-buffers.html)
   or [storage buffers](webgpu-storage-buffers.html) then ideally we'd flip them
   at the source.

2. Flip the texture data

   ```js
    const textureData = new Uint8Array([
   -   b, _, _, _, _,
   -   _, y, y, y, _,
   -   _, y, _, _, _,
   -   _, y, y, _, _,
   -   _, y, _, _, _,
   -   _, y, _, _, _,
   -   _, _, _, _, _,
   +   _, _, _, _, _,
   +   _, y, _, _, _,
   +   _, y, _, _, _,
   +   _, y, y, _, _,
   +   _, y, _, _, _,
   +   _, y, y, y, _,
   +   b, _, _, _, _,
    ].flat());
   ```

   Once we've flipped the data what used to be at the top is now at the bottom
   and now the bottom of the left pixel of the original image is the first data
   in the texture and now at what texture coordinate 0,0 refers to. This is why
   often texture coordinates are considered to go from 0 at the bottom to 1 at
   the top.

   <div class="webgpu_center"><img src="resources/texture-coordinates-y-flipped.svg" style="width: 500px;"></div>

   Flipping the data is common enough that there are even options when loading
   textures from images, videos, and canvases to flip the data for you.

## magFilter

In the example above we use a sampler with its default settings. Since we are
drawing the 5x7 texture larger than it's original 5x7 texels the sampler uses
what's called the `magFilter` or, the filter used when magnifying the texture.
If we change it from `nearest` to to `linear` then it will linearly interpolate
between 4 pixels.

<div class="webgpu-center center diagram"><div data-diagram="linear-interpolation" style="display: inline-block; width: 600px;"></div></div>

Texture coordinates are often called "UVs" (pronounced you-vees) so, in the
diagram above, `uv` is the texture coordinate. For a given uv, the closest 4
pixels are chosen. `t1` is the horizontal distance between the top left chosen
pixel's center and the pixel to its right's center where 0 means we are
horizontally at the left pixel's center and 1 means we are horizontally at the
right chosen pixel's center. `t2` is similar but vertically.

`t1` is the used to *"mix"* between the top 2 pixels to produce an intermediate
color. *mix* linear interpolates between 2 values so when `t1` is 0 we get only
the first color. When `t1` = 1 we get only the second color. Values between 0
and 1 produce proportional mix. For example 0.3 would be would be 70% of the
first color and 30% of second color. Similarly, a second intermediate color is
computed for the bottom 2 pixels. Finally, `t2` is used to mix the two
intermediate colors into a final color.

Another thing to notice, at the bottom of the diagram are 2 settings more
sampler settings, `addressModeU` and `addressModeV`. We can set these to
`repeat` or `clamp-to-edge`. When set to 'repeat', when our texture coordinate
is within half a texel of the edge of the texture we wrap around and blend with
pixels on the opposite side of the texture. When set to 'clamp-to-edge', for the
purposes of calculating which color to return, the texture coordinate is clamped
so that it can't go into the last half texel on each edge. This has the effect
of showing the edge colors for any texture coordinate that outside that range.

Let's update the sample so we can draw the quad with all of these options.

First let's create a sampler for each combination of settings.
We'll also create a bind group that uses that sampler.

```js
+  const bindGroups = [];
+  for (let i = 0; i < 8; ++i) {
-   const sampler = device.createSampler();
+   const sampler = device.createSampler({
+      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
+      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
+      magFilter: (i & 4) ? 'linear' : 'nearest',
+    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: tex.createView() },
      ],
    });
+    bindGroups.push(bindGroup);
+  }
```

We'll make some settings

```js
  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
  };
```

and at render time we'll look at the settings to decide which
bind group to use.

```js
  function render() {
+    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
+                (settings.addressModeV === 'repeat' ? 2 : 0) +
+                (settings.magFilter === 'linear' ? 4 : 0);
+    const bindGroup = bindGroups[ndx];
   ...
```

Now all we need to do is provide some UI to let us change the settings
and when the setting change we need to re-render. I'm using a library
called "muigui" which at the moment has a API similar to [dat.GUI](https://github.com/dataarts/dat.gui)

```js
import GUI from '/3rdparty/muigui-0.x.module.js';

...

  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
  };

  const addressOptions = ['repeat', 'clamp-to-edge'];
  const filterOptions = ['nearest', 'linear'];

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  gui.add(settings, 'addressModeU', addressOptions).onChange(render);
  gui.add(settings, 'addressModeV', addressOptions).onChange(render);
  gui.add(settings, 'magFilter', filterOptions).onChange(render);
```

The code above declares `settings` and then creates a ui to set them
and calls `render` when they change.

{{{example url="../webgpu-simple-textured-quad-linear.html"}}}

Since our fragment shader is receiving interpolated texture coordinates, as our shader
calls `textureSample` with those coordinates, it gets different blended colors as it's
asked to provide a color for each pixel being rendered.
Notice how with the address modes set to 'repeat' we can see WebGPU is "sampling"
from the texels on the opposite side of the texture.

## minFilter

There is also a setting for `minFilter` which does similar math to `magFilter`
for when the texture is drawn smaller than it's size. When set to 'linear'
it also chooses 4 pixels and blends them following similar math to that above.

The problem is, choosing 4 blended pixels from larger
texture to render say 1 pixel, the color will change an we'll get flickering.

Let's do it so we can see the issue

First let's make our canvas low-res. To do this we need to update our
css so the browser doesn't do the same `magFilter: 'linear'` effect on
our canvas. We can do this by setting the css as follows

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  image-rendering: pixelated;
+  image-rendering: crisp-edges;
}
```

Next let's lower the resolution of the canvas in our `ResizeObserver` callback

```js
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
-      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
-      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
+      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
+      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
      canvas.width = Math.min(width, device.limits.maxTextureDimension2D);
      canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
      // re-render
      render();
    }
  });
  observer.observe(canvas);
```

We're going to move and scale the quad so we'll add in a uniform buffer just
like we did in the first example in [the article on uniforms](webgpu-uniforms.html).

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

+struct Uniforms {
+  scale: vec2f,
+  offset: vec2f,
+};
+
+@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  var pos = array<vec2f, 6>(
    // 1st triangle
    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top

    // 2st triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
-  vsOutput.position = vec4f(xy, 0.0, 1.0);
+  vsOutput.position = vec4f(xy * uni.scale + uni.offset, 0.0, 1.0);
  vsOutput.texcoord = xy;
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

So now we need to create a uniform buffer

```js
+  // create a buffer for the uniform values
+  const uniformBufferSize =
+    2 * 4 + // scale is 2 32bit floats (4bytes each)
+    2 * 4;  // offset is 2 32bit floats (4bytes each)
+  const uniformBuffer = device.createBuffer({
+    label: 'uniforms for quad',
+    size: uniformBufferSize,
+    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
+  });
+
+  // create a typedarray to hold the values for the uniforms in JavaScript
+  const uniformValues = new Float32Array(uniformBufferSize / 4);
+
+  // offsets to the various uniform values in float32 indices
+  const kScaleOffset = 0;
+  const kOffsetOffset = 2;

  const bindGroups = [];
  for (let i = 0; i < 8; ++i) {
    const sampler = device.createSampler({
      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
      magFilter: (i & 4) ? 'linear' : 'nearest',
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: tex.createView() },
+        { binding: 2, resource: { buffer: uniformBuffer }},
      ],
    });
    bindGroups.push(bindGroup);
  }
```

And we need code to set the uniform's values and upload them to the GPU.
We're going to animate this so we'll also change the render to use
`requestAnimationFrame`.

```js
  function render(time) {
    time *= 0.001;
    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
                (settings.addressModeV === 'repeat' ? 2 : 0) +
                (settings.magFilter === 'linear' ? 4 : 0);
    const bindGroup = bindGroups[ndx];

+    // compute a scale that will draw our 0 to 1 clip space quad
+    // 2x2 pixels in the canvas.
+    const scaleX = 4 / canvas.width;
+    const scaleY = 4 / canvas.height;
+
+    uniformValues.set([scaleX, scaleY], kScaleOffset); // set the scale
+    uniformValues.set([Math.sin(time * 0.25) * 0.9, 0.5], kOffsetOffset); // set the scale
+
+    // copy the values from JavaScript to the GPU
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    ...

+    requestAnimationFrame(render);
  }
+  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
      canvas.width = Math.min(width, device.limits.maxTextureDimension2D);
      canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
-      // re-render
-      render();
    }
  });
  observer.observe(canvas);
}
```

The code above sets the scale so that we'll draw the quad 2x2 pixels in the canvas.
It also sets the offset from -0.9 to +0.9 using `Math.sin` so that the quad will
slowly go back and forth across the canvas.

Finally let's add `minFilter` to our settings and combinations

```js
  const bindGroups = [];
  for (let i = 0; i < 16; ++i) {
    const sampler = device.createSampler({
      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
      magFilter: (i & 4) ? 'linear' : 'nearest',
+      minFilter: (i & 8) ? 'linear' : 'nearest',
    });

...

  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
+    minFilter: 'linear',
  };

  const addressOptions = ['repeat', 'clamp-to-edge'];
  const filterOptions = ['nearest', 'linear'];

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  -gui.add(settings, 'addressModeU', addressOptions).onChange(render);
  -gui.add(settings, 'addressModeV', addressOptions).onChange(render);
  -gui.add(settings, 'magFilter', filterOptions).onChange(render);
+  gui.add(settings, 'addressModeU', addressOptions);
+  gui.add(settings, 'addressModeV', addressOptions);
+  gui.add(settings, 'magFilter', filterOptions);
+  gui.add(settings, 'minFilter', filterOptions);

  function render(time) {
    time *= 0.001;
    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
                (settings.addressModeV === 'repeat' ? 2 : 0) +
-                (settings.magFilter === 'linear' ? 4 : 0);
+                (settings.magFilter === 'linear' ? 4 : 0) +
+                (settings.minFilter === 'linear' ? 8 : 0);
```

We no longer need to call `render` when a setting changes since we're
rendering constantly using `requestAnimationFrame` (often called "rAF"
and this loop is often called a "rAF loop")

{{{example url="../webgpu-simple-textured-quad-minfilter.html"}}}

You can see the quad is flickering and changing colors. If the `minFilter`
is set to `nearest` then for each of the 2x2 pixels of the quad it's picking 
one pixel from our texture. If you set it to `linear` then it does the
bilinear filtering we mentioned above but it still flickers.

One reason is, the quad is draw with real numbers but pixels are integers.
The texture coordinates are interpolated from the real numbers, or rather, they
are computed from the real numbers.

<div class="webgpu-center center diagram"><div data-diagram="pixel-to-texcoords" style="display: inline-block; width: 600px;"></div></div>

In the diagram above, the <span style="color: red;">red</span> rectangle above
represents the quad we are asked the GPU to draw, based on the values we return
from our vertex shader. When the GPU draws, it computes which pixels' centers
are inside our quad (well, our 2 triangles). Then, it computes what interpolated
inter-stage variable value to pass to the fragment shader, based on where the
center of the pixel to be drawn is, relative to the where the original points
are. In our fragment shader we then pass that texture coordinate to the WGSL
`textureSample` function and get back a sampled color as the previous diagram
showed. Hopefully you can see why the colors are flickering. You can see them
blend to different colors depending on which UV coordinates are computed for the
pixel being drawn.

Textures offer a solution to this problem. It's called mip-mapping. I think (but could be wrong)
that "mipmap" stands for "multi-image-pyramid-map".

What we take our texture and create a smaller texture that is half the size in each dimension,
rounding down. We then fill the smaller texture with blended colors from the first original texture.
We keep doing this until we get to a 1x1 texture. In our example we have a 5x7 texel texture.
Dividing by 2 in each dimension and rounding down gives us a 2x3 texel texture. We take that one
and repeat so we end up with 1x1 texel texture.

<div class="webgpu-center center diagram"><div data-diagram="mips" style="display: inline-block;"></div></div>

Given a mipmap, we can then ask the GPU to choose a smaller mip level when smaller than the original size.

The best algorithm for blending the pixels from one mip to the next is
a topic of research as well as a matter of opinion. As a first idea, here's some code that
generates each mip from the previous mip by bilinear filtering (like we did above).

```js
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const bilinearFilter = (tl, tr, bl, br, t1, t2) => {
  const t = mix(tl, tr, t1);
  const b = mix(bl, br, t1);
  return mix(t, b, t2);
};

const createNextMipLevelRgba8Unorm = ({data: src, width: srcWidth, height: srcHeight}) => {
  // compute the size of the next mip
  const dstWidth = Math.max(1, srcWidth / 2 | 0);
  const dstHeight = Math.max(1, srcHeight / 2 | 0);
  const dst = new Uint8Array(dstWidth * dstHeight * 4);

  const getSrcPixel = (x, y) => {
    const offset = (y * srcWidth + x) * 4;
    return src.subarray(offset, offset + 4);
  };

  for (let y = 0; y < dstHeight; ++y) {
    for (let x = 0; x < dstWidth; ++x) {
      // compute texcoord of the center of the destination texel
      const u = (x + 0.5) / dstWidth;
      const v = (y + 0.5) / dstHeight;

      // compute the same texcoord in the source - 0.5 a pixel
      const au = (u * srcWidth - 0.5);
      const av = (v * srcHeight - 0.5);

      // compute the src top left texel coord (not texcoord)
      const tx = au | 0;
      const ty = av | 0;

      // compute the mix amounts between pixels
      const t1 = au % 1;
      const t2 = av % 1;

      // get the 4 pixels
      const tl = getSrcPixel(tx, ty);
      const tr = getSrcPixel(tx + 1, ty);
      const bl = getSrcPixel(tx, ty);
      const br = getSrcPixel(tx + 1, ty + 1);

      // copy the "sampled" result into the dest.
      const dstOffset = (y * dstWidth + x) * 4;
      dst.set(bilinearFilter(tl, tr, bl, br, t1, t2), dstOffset);
    }
  }
  return { data: dst, width: dstWidth, height: dstHeight };
};

const generateMips = (src, srcWidth) => {
  const srcHeight = src.length / 4 / srcWidth;

  // populate with first mip level (base level)
  let mip = { data: src, width: srcWidth, height: srcHeight, };
  const mips = [mip];

  while (mip.width > 1 || mip.height > 1) {
    mip = createNextMipLevelRgba8Unorm(mip);
    mips.push(mip);
  }
  return mips;
};
```

We'll go over how to do this on the GPU in [another article](webgpu-generate-mips.html).
For now, we can use the code above to generate a mipmap

We pass our texture data to the function above, and it returns an array of mip level data.
We can then create a texture with all the mip levels

```js
  const mips = generateMips(textureData, kTextureWidth);

  const tex = device.createTexture({
    label: 'yellow F on red',
+    size: [mips[0].width, mips[0].height, 1],
+    mipLevelCount: mips.length,
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  mips.forEach(({data, width, height}, mipLevel) => {
    device.queue.writeTexture(
-      { texture: tex },
-      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
-      { width: kTextureWidth, height: kTextureHeight },
+      { texture: tex, mipLevel },
+      data,
+      { bytesPerRow: width * 4 },
+      { width, height },
    );
  });
```

Notice we pass in `mipLevelCount` to the number of mip levels. WebGPU will then create
the correct sized mip level at each level. We then copy the data to each level by specifying
the `mipLevel`

And with that the GPU is choose the smallest mip to draw and are flickering is gone.

{{{example url="../webgpu-simple-textured-quad-mipmap.html"}}}

But wait, there's MORE

Just like we have a `magFilter` and a `minFilter` both of which which can be `nearest` or `linear`,
there is also a `mipmapFilter` setting which can also be `nearest` or `linear`.

This chooses if we blend between mip levels. In `mipmapFilter: 'linear'`, colors are sampled
from 2 mip levels, either with nearest or linear filtering based on the previous settings,
then, those 2 colors are again `mix`ed in a similar way.

This comes up most when drawing things in 3D. How to draw in 3D is covered in [other articles](webgpu-perspective.html). For now, we'll just hard code a quad with data that happens to
represent a plane that goes off into the distance.

<div class="webgpu-center center diagram"><div data-diagram="blended-mips" style="display: inline-block;"></div></div>

<div class="webgpu-center center diagram"><div data-diagram="checkered-mips" style="display: inline-block;"></div></div>

{{{example url="../webgpu-simple-textured-quad-mipmapfilter.html"}}}


TODO: loading 
TODO: texture formats
TODO: 3D, 2D Array, Cube maps


<!-- keep this at the bottom of the article -->
<script type="module" src="/3rdparty/pixel-perfect.js"></script>
<script type="module" src="webgpu-textures.js"></script>
