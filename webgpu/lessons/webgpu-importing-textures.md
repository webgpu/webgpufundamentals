Title: WebGPU Importing Images into Textures
Description: How to load an Image into a texture
TOC: Importing Images

We covered some basics about using textures [in the previous article](webgpu-textures.html).
In this article we'll cover importing a texture from an image.

In the previous article we'd created a texture by calling `device.createTexture` and then
put data in the texture by calling `device.queue.writeTexture`. There's another function
on `device.queue` called `device.queue.copyExternalImageToTexture` that let's us copy
an image into a texture.

It can take an `ImageBitmap` so let's take [the magFilter example from the previous article](webgpu-textures.html#magFilter) and change it to import a few images.

First we need some code to get an `ImageBitmap` from an image

```js
  async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }
```

The code above calls `fetch` with the url of an image. This returns a `Response`. We then
use that to load a `Blob` which opaquely represents the data of the image file. We then pass
that to `createImageBitmap` which is a standard browser function to create an `ImageBitmap`. 
We pass `{ colorSpaceConversion: 'none' }` to tell the browser not to apply any color space. It's up to you if
you want the browser to apply a color space or not. Often in WebGPU we might load
an image that is a normal map or a height map or something that is not color data.
In those cases we definitely don't want the browser to muck with the data in the image.

Now that we have code to create an `ImageBitmap` let's load one and create a texture of the same size.

We'll load this image

<div class="webgpu_center"><img src="../resources/images/f-texture.png"></div>

I was taught once that a texture with an `F` in it is a good example texture because we can instantly
see its orientation.

<div class="webgpu_center"><img src="resources/images/f-orientation.svg"></div>


```js
-  const texture = device.createTexture({
-    label: 'yellow F on red',
-    size: [kTextureWidth, kTextureHeight],
-    format: 'rgba8unorm',
-    usage:
-      GPUTextureUsage.TEXTURE_BINDING |
-      GPUTextureUsage.COPY_DST,
-  });
+  const url = 'resources/images/f-texture.png';
+  const source = await loadImageBitmap(url);
+  const texture = device.createTexture({
+    label: url,
+    format: 'rgba8unorm',
+    size: [source.width, source.height],
+    usage: GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.COPY_DST |
+           GPUTextureUsage.RENDER_ATTACHMENT,
+  });
```

Note that `copyExternalImageToTexture` requires that we include to
`GPUTextureUsage.COPY_DST` and `GPUTextureUsage.RENDER_ATTACHMENT`
usage flags.

So then we can copy the `ImageBitmap` to the texture

```js
-  device.queue.writeTexture(
-      { texture },
-      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
-      { width: kTextureWidth, height: kTextureHeight },
-  );
+  device.queue.copyExternalImageToTexture(
+    { source, flipY: true },
+    { texture },
+    { width: source.width, height: source.height },
+  );
```

The parameters to `copyExternalImageToTexture` are
The source, the destination, the size. For the source
we can specify `flipY: true` if we want the texture flipped on load.

And that works!

{{{example url="../webgpu-simple-textured-quad-import-no-mips.html"}}}

## Generating mips on the GPU

In [the previous article we also generated a mipmap](webgpu-textures.html#mipmapFilter)
but in that case we had easy access to the image data. When importing an image, we
could draw that image into a 2D canvas, the call `getImageData` to get the data, and
finally generate mips and upload. That would be pretty slow. It would also potentially
be lossy since how canvas 2D renders is intentionally implementation dependant.

When we generated mip levels we did a bilinear interpolation which is exactly what
the GPU does with `minFilter: linear`. We can use that feature to generate mip levels
on the GPU

Let's modify the [minmapFilter example from the previous article](webgpu-textures.html#mipmapFilter)
to load images and generate mips using the GPU

First, let's change the code that creates the texture to create mip levels. We need to know how many
to create which we can calculate like this

```js
  const numMipLevels = (...sizes) => {
    const maxSize = Math.max(...sizes);
    return 1 + Math.log2(maxSize) | 0;
  };
```

We can call that with 1 or more numbers and it will return the number of mips needed, so for example
`numMipLevels(123, 456)` returns `9`.

> * level 0: 123, 456
> * level 1: 61, 228
> * level 2: 30, 114
> * level 3: 15, 57
> * level 4: 7, 28
> * level 5: 3, 14
> * level 6: 1, 7
> * level 7: 1, 3
> * level 8: 1, 1
> 
> 9 mip levels

`Math.log2` tells us the power of 2 we need to make our number.
In other words, `Math.log2(8) = 3` because 2<sup>3</sup> = 8. Another way to say the same thing is, `Math.log2` tells us how
many times can we divide this number by 2. 

> ```
> Math.log2(8)
>           8 / 2 = 4
>                   4 / 2 = 2
>                           2 / 2 = 1`
> ```

So we can divide 8 by 2 three times. That's exactly what we need to compute how many mip levels to make.
It's `Math.log2(largestSize) + 1`. 1 for the original size mip level 0

So, we can now create the right number of mip levels

```js
  const texture = device.createTexture({
    label: url,
    format: 'rgba8unorm',
    mipLevelCount: numMipLevels(source.width, source.height),
    size: [source.width, source.height],
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source, flipY: true, },
    { texture },
    { width: source.width, height: source.height },
  );
```

To generate the next mip level, we'll draw a textured quad, just like we've been doing, from the
existing mip level, to the next level, with `minFilter: linear`. 

Here's the code

```js
  const generateMips = (() => {
    let pipeline;
    let sampler;

    return function generateMips(device, texture) {
      if (!pipeline) {
        const module = device.createShaderModule({
          label: 'textured quad shaders for mip level generation',
          code: `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
              var pos = array<vec2f, 6>(

                vec2f( 0.0,  0.0),  // center
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 0.0,  1.0),  // center, top

                // 2st triangle
                vec2f( 0.0,  1.0),  // center, top
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 1.0,  1.0),  // right, top
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
        });
        pipeline = device.createRenderPipeline({
          label: 'mip level generator pipeline',
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'vs',
          },
          fragment: {
            module,
            entryPoint: 'fs',
            targets: [{ format: texture.format }],
          },
        });

        sampler = device.createSampler({
          minFilter: 'linear',
        });
      }

      const encoder = device.createCommandEncoder({
        label: 'mip gen encoder',
      });

      let width = texture.width;
      let height = texture.height;
      let baseMipLevel = 0;
      while (width > 1 || height > 1) {
        width = Math.max(1, width / 2 | 0);
        height = Math.max(1, height / 2 | 0);

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView({baseMipLevel, mipLevelCount: 1}) },
          ],
        });

        ++baseMipLevel;

        const renderPassDescriptor = {
          label: 'our basic canvas renderPass',
          colorAttachments: [
            {
              view: texture.createView({baseMipLevel, mipLevelCount: 1}),
              clearValue: [0.3, 0.3, 0.3, 1],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);  // call our vertex shader 6 times
        pass.end();
      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    };
  })();
```

The code above looks long but it's almost the exact same code we've been using in our examples with textures so far.
What's changed

* We make a closure to hold on to 3 variables. `module`, `sampler`, `pipelineByFormat`.
  For `module` and `sampler` we check if they have not be set and if not, we create a `GPUSShaderModule`
  and `GPUSampler` which we can hold on to and use in the future.

* We have a pair of shaders that are almost exactly the same as all the examples. The only difference
  is this part

  ```wgsl
  -  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  -  vsOutput.texcoord = xy * vec2f(1, 50);
  +  vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
  +  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
  ```

  The hard coded quad position data we have in shader goes from 0.0 to 1.0 and so, as is, would only
  cover the top right quarter texture we're drawing to, just as it does in the examples. We need it to cover the entire
  area so by multiplying by 2 and subtracting 1 we get a quad that goes from -1,-1 to +1,1.

  We also flip the Y texture coordinate. This is because when drawing to the texture +1, +1 is at the top right
  but we want the top right of the texture we are sampling to be there. The top right of the sampled texture is +1, 0

* We have an object, `pipelineByFormat` which we use as a map of pipelines to texture formats.
  This is because a pipeline needs to know the format to use.

* We check if we already have a pipeline for a particular format and if not create one
  
  ```js
      if (!pipelineByFormat[texture.format]) {
        pipelineByFormat[texture.format] = device.createRenderPipeline({
          label: 'mip level generator pipeline',
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'vs',
          },
          fragment: {
            module,
            entryPoint: 'fs',
  +          targets: [{ format: texture.format }],
          },
        });
      }
      const pipeline = pipelineByFormat[texture.format];
  ```

  The only major difference here is `targets` is set from the texture's format,
  not from the `presentationFormat` we use when rendering to the canvas

* We finally use some parameters to `texture.createView`

  We loop over each mip level. We create a bind group for the last mip with data in it
  and we set the renderPassDescriptor to draw to the next mip level. Then we encode
  a renderPass for that specific mip level. When we're done. All the mips will have
  been filled out.

  ```js
      let width = texture.width;
      let height = texture.height;
      let baseMipLevel = 0;
      while (width > 1 || height > 1) {
        width = Math.max(1, width / 2 | 0);
        height = Math.max(1, height / 2 | 0);

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
  +          { binding: 1, resource: texture.createView({baseMipLevel, mipLevelCount: 1}) },
          ],
        });

  +      ++baseMipLevel;

        const renderPassDescriptor = {
          label: 'our basic canvas renderPass',
          colorAttachments: [
            {
  +            view: texture.createView({baseMipLevel, mipLevelCount: 1}),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);  // call our vertex shader 6 times
        pass.end();
      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
  ```

Let's create some support functions make it simple load an image
into a texture and generate mips

Here's a function that updates the first mip level and optionally flips the image.
If the image has mip levels then we generate them.

```js
  function copySourceToTexture(device, texture, source, {flipY} = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
      { texture },
      { width: source.width, height: source.height },
    );

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }
```

Here's a function that given a source (in this case an `ImageBitmap`) will
create a texture of the matching size and then call the previous function
to fill it in with the data

```js
  function createTextureFromSource(device, source, options = {}) {
    const texture = device.createTexture({
      format: 'rgba8unorm',
*      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
      size: [source.width, source.height],
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
    copySourceToTexture(device, texture, source, options);
    return texture;
  }
```

and here's a function that given a url will load the url as an `ImageBitmap` call
call the previous function to create a texture and fill it with the contents of the image.

```js
  async function createTextureFromImage(device, url, options) {
    const imgBitmap = await loadImageBitmap(url);
    return createTextureFromSource(device, imgBitmap, options);
  }
```

With those setup, the only major change to the [mipmapFilter sample](webgpu-textures.html#mipmapFilter)
is this

```js
-  const textures = [
-    createTextureWithMips(createBlendedMipmap(), 'blended'),
-    createTextureWithMips(createCheckedMipmap(), 'checker'),
-  ];
+  const textures = await Promise.all([
+    await createTextureFromImage(device, 'resources/images/f-texture.png', {mips: true, flipY: false}),
+    await createTextureFromImage(device, 'resources/images/coins.jpg', {mips: true}),
+    await createTextureFromImage(device, 'resources/images/Granite_paving_tileable_512x512.jpeg', {mips: true}),
+  ]);
```

The code above loads the F texture from above as well as these 2 textures

<div class="webgpu_center"><img src="../resources/images/coins.jpg"> <img src="../resources/images/Granite_paving_tileable_512x512.jpeg"></div>

And here it is

{{{example url="../webgpu-simple-textured-quad-import.html"}}}

TBD: Atlas

TBD: Canvas

TBD: Video
