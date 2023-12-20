Title: WebGPU Storage Textures
Description: How to use Storage Textures
TOC: Storage Textures

Storage textures are just textures that you can write (or store to) directly to.
Normally we specify triangles in a vertex shader and the GPU updates the texture
for us indirectly but with a storage texture we can write directly to the
texture wherever we want.

Storage textures are not a special type of texture, rather, they are just a
texture like any other texture that you create with `createTexture`. You add the
`STORAGE_BINDING` usage flag and now you can use the texture as a storage
texture on top of whatever other usage flags you need and then you can also use
the texture as a storage texture.

In sense, a storage texture is buffer that we use as a 2d array. For example we
could make a buffer and reference it in code like this

```wgsl
var @group(0) @binding(0) var<storage> buf: buffer<f32>;

...
fn loadValueFromBuffer(pos: vec2u) -> f32 {
  return buffer[pos.y * width + pos.x];
}

fn storeValueToBuffer(pos: vec2u, v: f32) {
  buffer[pos.y * width + pos.x] = v;
}

...
  let pos = vec2u(2, 3);
  var v = loadValueFromBuffer(pos);
  storeValueToBuffer(pos, v * 2.0);

```

vs a storage texture

```
var @group(0) @binding(0) var tex: texture_storage_2d<r32float, read_write>;

...

   let pos = vec2u(2, 3);
   let mipLevel = 0;
   var v = textureLoad(tex, pos, mipLevel);
   textureStore(tex, pos, mipLevel, v * 2);

```

So given that those seem equivalent, what are the differences between manually
using a buffer and a storage texture?

* A storage texture is still a texture.

  You can use it with one shader as a storage texture and as regular texture (with samplers, and mip-mapping, etc) in another shader.

* A storage texture has format interpretation, a buffer does not.

  Example:

  ```wsgl
  var @group(0) @binding(0) var tex: texture_storage_2d<rgba8unorm, read>;
  var @group(0) @binding(1) var buf: array<f32>;

     ...
      t = textureLoad(tex, pos, 0);
      b = buffer[pos.y * bufferWidth + pos.x];
  ```

  Above, when we call `textureLoad`, the texture is an `rgba8unorm` texture
  which means 4 bytes are loaded and automatically converted to 4 floating
  point values between 0 and 1.

  In the buffer case, 4 bytes are loaded as a single float32 value. We could
  change buffer to `array<u32>` and then load a value, and manually split it into
  4 byte values, and convert those to floats ourselves but, if that's what we
  wanted we get it for free with a storage texture.

* A storage texture has dimensions

  For a buffer the only dimension is its length, or rather, the length of
  its binding [^binding]. Above, when we used a buffer as a 2D array, we
  needed `width`. We'd have to either hard code that value or pass it in
  some how[^how-to-pass-data]. With a texture we can call `textureDimensions` to get its size.

  [^binding]: When you create a bind group and you specify a buffer you can
  optional bind and offset and length. In the shader, the length of the
  array is calculated from the length of the binding, not the length of
  the buffer. If you don't specify and offset it defaults to 0 and the
  length defaults to the size of the buffer.

  [^how-to-pass-data]: You could pass in the buffer width via a [uniform](webgpu-uniforms.html),
  another [storage buffer](webgpu-storage-buffers.html) or even as
  the first value in the same buffer.

That said, there are limits on storage buffers

* Only certain formats can be `read_write`.

  Those are `r32float`, `r32sint`, and `r32uint`.

  Other supported formats can only be `read` or `write` within a single
  shader.

* Only certain formats can be used as storage textures.

  There are a large number of texture formats but only certain ones
  can be usage as storage textures.

  * `rgba8(unorm/snorm/sint/uint)`
  * `rgba16(float/sint/uint)`
  * `rg32(float/sint/uint)`
  * `rgba32(float/sint/uint)`

  One to notice missing is `bgra8unorm` which we'll cover below. 

* Storage textures can not use samplers

  If we use a texture as normal `TEXTURE_BINDING` then we can call
  functions like `textureSample` which load up to 16 texels and
  blend them together. When we use a texture as a `STORAGE_BINDING`
  we can only call `textureLoad` and/or `textureStore` which load
  and store a single texel at a time.

## Canvas as a Storage Texture

You can use a canvas texture a storage texture. To do so you configure
the context to give you a texture that can be used as a storage texture.

```js
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format: presentationFormat,
+    usage: GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.STORAGE_BINDING,
  });
```

`TEXTURE_BINDING` is needed so the browser itself can render the texture
to the page. `STORAGE_BINDING` lets us use the canvas's textures as
storage textures. If we still wanted to render to the texture via a
render pass, like most examples on this site, we'd also add the 
`RENDER_BINDING` usage.

There's a complication here though. Above we call `navigator.gpu.getPreferredCanvasFormat`. As we covered in [the first article](webgpu-fundamentals.html), `getPreferredCanvasFormat` will return
either `rgba8unorm` or `bgra8unorm` depending on whichever format
is more performant for the user's system.

But, as mentioned above, by default, we can not use a `bgra8unorm`
texture as a storage texture.

Fortunately there is a [feature](webgpu-limits-and-features.html),
`'bgra8unorm-storage'`, that
will enable using a `bgra8unorm` texture as a storage texture.
In general it *should* be available on any platform that reports
`bgra8unorm` as its preferred canvas format but there is some possibility
it's not available. So, we need to check if the `'bgra8unorm-storage'` *feature* exists. If so we'll require it for our device. If the feature exists, we'll use
the preferred canvas format. If not, we'll choose `rgba8unorm`.

```js
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const hasBGRA8unormStorage = adapter.features.has('bgra8unorm-storage');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: hasBGRA8unormStorage
+      ? ['bgra8unorm-storage']
+      : [],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
-  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
+  const presentationFormat = hasBGRA8unormStorage
+     ? navigator.gpu.getPreferredCanvasFormat()
+     : 'rgba8unorm';
  context.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.STORAGE_BINDING,
  });
```

Now we can use the canvas texture as a storage texture. Let's make a simple
compute shader to draw concentric circles in the texture.

```js
  const module = device.createShaderModule({
    label: 'circles in storage texture',
    code: `
      @group(0) @binding(0)
      var tex: texture_storage_2d<${presentationFormat}, write>;

      @compute @workgroup_size(1) fn cs(
        @builtin(global_invocation_id) id : vec3u
      )  {
        let size = textureDimensions(tex);
        let center = vec2f(size) / 2.0;

        // the pixel we're going to write to
        let pos = id.xy;

        // The distance from the center of the texture
        let dist = distance(vec2f(pos), center);

        // Compute stripes based on the distance
        let stripe = dist / 32.0 % 2.0;
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);
        let color = select(red, cyan, stripe < 1.0);

        // Write the color to the texture
        textureStore(tex, pos, color);
      }
    `,
  });
```

Notice we marked the storage texture as `write` and that we had to specify
the specific texture format in the shader itself. Unlike `TEXTURE_BINDING`s,
`STORAGE_BINDING`s need to know the exact format of the texture.

Setting it up is similar to [the compute shader we wrote in the first article](webgpu-fundamentals.html#a-run-computations-on-the-gpu).
After making a shader module we setup a compute pipeline to use it.

```js
  const pipeline = device.createComputePipeline({
    label: 'circles in storage texture',
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'cs',
    },
  });
```

To render we get the canvas's current texture, make a bind group so
we can pass the texture to the shader, and then do the normal things of setting
a pipeline, binding bind groups, and dispatching workgroups.

```js
  function render() {
    const texture = context.getCurrentTexture();

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
      ],
    });

    const encoder = device.createCommandEncoder({ label: 'our encoder' });
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(texture.width, texture.height);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

And here it is

{{{example url="../webgpu-storage-texture-canvas.html"}}}

Using a regular texture would change nothing except we'd call
`createTexture` instead of `getCurrentTexture` to make our texture
and pass in `STORAGE_BINDING` along with whatever other usage flags
we need.

## Speed and data races.

Above, we dispatched 1 workgroup per pixel. This is wasteful, and the
GPU can run much faster. Optimizing the shader for the optimal amount
of work would have complicated the example. The point was to demonstrate
using a storage texture, not the fastest possible shader.
You can read up on some methods of optimizing
compute shaders in [the article on computing an image histogram](webgpu-compute-shaders-histogram.html).

Similarly, because you can write anywhere in the storage texture, you
need to be aware of race conditions like we covered in the other articles
on compute shaders. The order the invocations run is not guaranteed. It's
up to you to avoid races and/or insert `textureBarriers` or other things
to make sure 2 or more invocations do not step on each other's toes.
