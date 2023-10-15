Title: WebGPU Loading Images into Textures
Description: How to load an Image/Canvas/Video into a texture
TOC: Loading Images

We covered some basics about using textures [in the previous article](webgpu-textures.html).
In this article we'll cover loading an image into a texture
as well as generating mipmaps on the GPU.

In the previous article we'd created a texture by calling `device.createTexture` and then
put data in the texture by calling `device.queue.writeTexture`. There's another function
on `device.queue` called `device.queue.copyExternalImageToTexture` that let's us copy
an image into a texture.

It can take an `ImageBitmap` so let's take [the magFilter example from the previous article](webgpu-textures.html#a-mag-filter) and change it to load a few images.

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

<div class="webgpu_center"><img src="resources/f-orientation.svg"></div>


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

## <a id="a-generating-mips-on-the-gpu"></a>Generating mips on the GPU

In [the previous article we also generated a mipmap](webgpu-textures.html#a-mipmap-filter)
but in that case we had easy access to the image data. When loading an image, we
could draw that image into a 2D canvas, the call `getImageData` to get the data, and
finally generate mips and upload. That would be pretty slow. It would also potentially
be lossy since how canvas 2D renders is intentionally implementation dependant.

When we generated mip levels we did a bilinear interpolation which is exactly what
the GPU does with `minFilter: linear`. We can use that feature to generate mip levels
on the GPU

Let's modify the [mipmapFilter example from the previous article](webgpu-textures.html#a-mipmap-filter)
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
              let pos = array(

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

<a id="a-create-texture-from-source"></a>Here's a function that given a source (in this case an `ImageBitmap`) will
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

With those setup, the only major change to the [mipmapFilter sample](webgpu-textures.html#a-mipmap-filter)
is this

```js
-  const textures = [
-    createTextureWithMips(createBlendedMipmap(), 'blended'),
-    createTextureWithMips(createCheckedMipmap(), 'checker'),
-  ];
+  const textures = await Promise.all([
+    await createTextureFromImage(device,
+        'resources/images/f-texture.png', {mips: true, flipY: false}),
+    await createTextureFromImage(device,
+        'resources/images/coins.jpg', {mips: true}),
+    await createTextureFromImage(device,
+        'resources/images/Granite_paving_tileable_512x512.jpeg', {mips: true}),
+  ]);
```

The code above loads the F texture from above as well as these 2 tiling textures

<div class="webgpu_center side-by-side">
  <div class="separate">
    <img src="../resources/images/coins.jpg">
    <div class="copyright">
      <a href="https://renderman.pixar.com/pixar-one-thirty">CC-BY: Pixar</a>
    </div>
  </div>
  <div class="separate">
    <img src="../resources/images/Granite_paving_tileable_512x512.jpeg">
    <div class="copyright">
       <a href="https://commons.wikimedia.org/wiki/File:Granite_paving_tileable_2048x2048.jpg">CC-BY-SA: Coyau</a>
    </div>
  </div>
</div>

And here it is

{{{example url="../webgpu-simple-textured-quad-import.html"}}}

## Loading Canvas

`copyExternalImageToTexture` takes other *sources*. Another is an `HTMLCanvasElement`.
We can use this to draw things in a 2d canvas, and then get the result in a texture in WebGPU.
Of course you can use WebGPU to draw to a texture and use that texture you just drew too
in something else you render. In fact we just did that, rendering to a mip level and then
using that mip level a texture attachment to render to the next mip level.

But, sometimes using 2d canvas can make certain things easy. The 2d canvas has relatively
high level API.

So, first let's make some kind of canvas animation.

```js
const size = 256;
const half = size / 2;

const ctx = document.createElement('canvas').getContext('2d');
ctx.canvas.width = size;
ctx.canvas.height = size;

const hsl = (h, s, l) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

function update2DCanvas(time) {
  time *= 0.0001;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(half, half);
  const num = 20;
  for (let i = 0; i < num; ++i) {
    ctx.fillStyle = hsl(i / num * 0.2 + time * 0.1, 1, i % 2 * 0.5);
    ctx.fillRect(-half, -half, size, size);
    ctx.rotate(time * 0.5);
    ctx.scale(0.85, 0.85);
    ctx.translate(size / 16, 0);
  }
  ctx.restore();
}

function render(time) {
  update2DCanvas(time);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

{{{example url="../canvas-2d-animation.html"}}}

To load that canvas into WebGPU only a few changes are needed to our previous example.

We need to create a texture of the right size. The easiest way it just to use the same
code we wrote above

```js
+  const texture = createTextureFromSource(device, ctx.canvas, {mips: true});

  const textures = await Promise.all([
-    await createTextureFromImage(device,
-        'resources/images/f-texture.png', {mips: true, flipY: false}),
-    await createTextureFromImage(device,
-        'resources/images/coins.jpg', {mips: true}),
-    await createTextureFromImage(device,
-        'resources/images/Granite_paving_tileable_512x512.jpeg', {mips: true}),
+    texture,
  ]);
```

Then we need to switch to a `requestAnimationFrame` loop, update the 2D canvas, and
then upload it to WebGPU

```js
-  function render() {
+  function render(time) {
+    update2DCanvas(time);
+    copySourceToTexture(device, texture, ctx.canvas);

     ...


    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      render();
    }
  });
  observer.observe(canvas);

  canvas.addEventListener('click', () => {
    texNdx = (texNdx + 1) % textures.length;
-    render();
  });
```

With that we're able to upload a canvas AND generate mips levels for it

{{{example url="../webgpu-simple-textured-quad-import-canvas.html"}}}

## Loading Video

Loading video this way is no different. We can create a `<video>` element and pass
it to the same functions we passed the canvas to in the previous example and it should
just work with minor adjustments

Here's a video

<div class="webgpu_center">
  <div>
     <video muted controls src="../resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm" style="width: 720px";></video>
     <div class="copyright"><a href="https://commons.wikimedia.org/wiki/File:Golden_retriever_swimming_the_doggy_paddle.webm">CC-BY: Golden Woofs</a></div>
  </div>
</div>

`ImageBitmap` and `HTMLCanvasElement` have their width and height as `width` and `height` properties but `HTMLVideoElement` has its width and height
on `videoWidth` and `videoHeight`. So, let's update the code to handle that difference

```js
+  function getSourceSize(source) {
+    return [
+      source.videoWidth || source.width,
+      source.videoHeight || source.height,
+    ];
+  }

  function copySourceToTexture(device, texture, source, {flipY} = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
      { texture },
-      { width: source.width, height: source.height },
+      getSourceSize(source),
    );

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }

  function createTextureFromSource(device, source, options = {}) {
+    const size = getSourceSize(source);
    const texture = device.createTexture({
      format: 'rgba8unorm',
-      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
-      size: [source.width, source.height],
+      mipLevelCount: options.mips ? numMipLevels(...size) : 1,
+      size,
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
    copySourceToTexture(device, texture, source, options);
    return texture;
  }
```

So then, lets setup a video element

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';

  const texture = createTextureFromSource(device, video, {mips: true});
```

and update it at render time

```js
-  function render(time) {
-    update2DCanvas(time);
-    copySourceToTexture(device, texture, ctx.canvas);
+  function render() {
+    copySourceToTexture(device, texture, video);
```

One complication of videos is we need to wait for them to have started
playing before we pass them to WebGPU. In modern browsers we can do
this by calling `video.requestVideoFrameCallback`. It calls us each time
a new frame is available so we can use it to find out when at least
one frame is available.

For a fallback, we can wait for the time to advance and pray 🙏 because
sadly, old browsers made it hard to know when it's safe to use a video 😅

```js
+  function startPlayingAndWaitForVideo(video) {
+    return new Promise((resolve, reject) => {
+      video.addEventListener('error', reject);
+      if ('requestVideoFrameCallback' in video) {
+        video.requestVideoFrameCallback(resolve);
+      } else {
+        const timeWatcher = () => {
+          if (video.currentTime > 0) {
+            resolve();
+          } else {
+            requestAnimationFrame(timeWatcher);
+          }
+        };
+        timeWatcher();
+      }
+      video.play().catch(reject);
+    });
+  }

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
+  await startPlayingAndWaitForVideo(video);

  const texture = createTextureFromSource(device, video, {mips: true});
```

Another complication is we need to wait for the user to interact with the
page before we can start the video [^autoplay]. Let's add some HTML with
a play button.

[^autoplay]: There are various ways to get a video, usually without audio,
to autoplay without having to wait for the user to interact with the page.
They seem to change over time so we won't go into solutions here.

```html
  <body>
    <canvas></canvas>
+    <div id="start">
+      <div>▶️</div>
+    </div>
  </body>
```

And some CSS to center it

```css
#start {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
#start>div {
  font-size: 200px;
  cursor: pointer;
}
```

Then let's write a function to wait for it to be clicked and hide it.

```js
+  function waitForClick() {
+    return new Promise(resolve => {
+      window.addEventListener(
+        'click',
+        () => {
+          document.querySelector('#start').style.display = 'none';
+          resolve();
+        },
+        { once: true });
+    });
+  }

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
+  await waitForClick();
  await startPlayingAndWaitForVideo(video);

  const texture = createTextureFromSource(device, video, {mips: true});
```

Let's also add a wait to pause the video

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/pexels-anna-bondarenko-5534310 (540p).mp4'; /* webgpufundamentals: url */
  await waitForClick();
  await startPlayingAndWaitForVideo(video);

+  canvas.addEventListener('click', () => {
+    if (video.paused) {
+      video.play();
+    } else {
+      video.pause();
+    }
+  });
```

And with that we should get video in a texture

{{{example url="../webgpu-simple-textured-quad-import-video.html"}}}

One optimization we could make. We could only update the texture when 
the video has changed.

For example

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
  await waitForClick();
  await startPlayingAndWaitForVideo(video);

+  let alwaysUpdateVideo = !('requestVideoFrameCallback' in video);
+  let haveNewVideoFrame = false;
+  if (!alwaysUpdateVideo) {
+    function recordHaveNewFrame() {
+      haveNewVideoFrame = true;
+      video.requestVideoFrameCallback(recordHaveNewFrame);
+    }
+    video.requestVideoFrameCallback(recordHaveNewFrame);
+  }

  ...

  function render() {
+    if (alwaysUpdateVideo || haveNewVideoFrame) {
+      haveNewVideoFrame = false;
      copySourceToTexture(device, texture, video);
+    }

    ...
```

With this change we'd only update the video for each new frame. So, for example, on a device
with a display rate of 120 frames per second we'd draw at 120 frames per second so animations,
camera movements, etc would be smooth. But, the texture would only update at its own frame
rate (for example 30fps).

**BUT! WebGPU has special support for using video efficiently**

We'll cover that in [another article](webgpu-textures-external-video.html).
The way above, using `device.query.copyExternalImageToTexture` is actually
making **a copy**. Making a copy takes time. For example a 4k video's resolution
is generally 3840 × 2160 which for `rgba8unorm` is 31meg of data that needs to be
copied, **per frame**. [External textures](webgpu-textures-external-video.html)
let you use the video's data directly (no copy) but require different methods
and have some restrictions.

TBD: Atlas

