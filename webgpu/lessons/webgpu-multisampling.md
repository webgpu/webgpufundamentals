Title: WebGPU Multisampling
Description: Multisampling / MSAA
TOC: Multisampling / MSAA

Multisampling is generally a form of anti-aliasing. Anti-aliasing
means, trying to prevent the problem of aliasing where aliasing
is the problem we get when we try to draw a vector shape as
discrete pixels.

We showed how WebGPU draws things in [the article on fundamentals](webgpu-fundamentals.html).
It takes the clip space vertices we return for the `@builtin(position)` value in the vertex shader
and for every 3 it computes a triangle and then calls the fragment shader for each pixel's center
that is inside that triangle to ask what color to make the pixel.

<div class="webgpu_center side-by-side flex-gap" style="max-width: 850px">
  <div class="multisample-example">
    <div data-diagram="clip-space-to-texels"></div>
    <div>drag the vertices</div>
  </div>
  <div class="multisample-example">
    <div data-diagram="clip-space-to-texels-result"></div>
    <div>result</div>
  </div>
</div>

The triangle above is very blocky. We can increase the resolution but the highest resolution we can
display is the resolution of the display which might not be enough to not look blocky.

One solution is to render at a higher resolution. For example, say 4x (2x in both width and height)
and then "bilinear filter" the result into the canvas. We covered "bilinear filtering" in
[the article on textures](webgpu-textures.html).

<div class="webgpu_center side-by-side flex-gap" style="max-width: 850px">
  <div class="multisample-example">
    <div data-diagram="clip-space-to-texels-4x"></div>
    <div>4x resolution</div>
  </div>
  <div class="multisample-example">
    <div data-diagram="clip-space-to-texels-4x-result"></div>
    <div>bilinear filtered result</div>
  </div>
</div>

This solution works but it's wasteful. Every 2x2 pixels in the image on the left gets converted
into 1 pixel in the image on the right but often, all 4 of those pixels are inside the triangle
so there is no need for anti-aliasing. All 4 pixels are red.

<div class="webgpu_center side-by-side flex-gap">
  <div class="multisample-example">
    <div data-diagram="clip-space-to-texels-4x-waste"></div>
    <div>3 of every 4 <span style="color: cyan;">cyan</span> pixels are wasted</div>
  </div>
</div>

Drawing 4 red pixels as a waste of time.
The GPU called our fragment shader 4 times. Fragment shaders can be fairly large and do a lots
of work so we'd like to call them as few times as possible.

This is where multisampling comes in. When we draw a triangle to a multisampled texture, if
all 4 pixels are inside the triangle then the GPU just calls our fragment shader once and stores the result
in all 4 pixels. If only some of those 4 pixels are inside the triangle the GPU still only calls
our fragment shader once but it only writes the result to the pixels that are inside the triangle.

## <a id="a-multisampling"></a> How to use multisampling.

So how do we use a multisampling? We do it via 3 basic steps

1. Set our pipeline to render to a multisample texture
2. Create a multisample texture the same size as the final texture.
3. Set our render pass to render to the multisample texture and *resolve* to the final texture (our canvas)

To keep it simple, lets take our responsive triangle example at the end of [the article on fundamentals](webgpu-fundamentals.html#a-resizing) and add multisampling.

### Set our pipeline to render to a multisample texture

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
+    multisample: {
+      count: 4,
+    },
  });
```

Adding the `multisample` setting above make this pipeline able to render to a multisample
texture.

### Create a multisample texture the same size as our final texture

Our final texture is the canvas's texture. Since the canvas might change size, like when the user resizes the window, we'll create this texture when we render.

```js
+  let multisampleTexture;

  function render() {
+    // Get the current texture from the canvas context
+    const canvasTexture = context.getCurrentTexture();
+
+    if (!multisampleTexture ||
+        multisampleTexture.width !== canvasTexture.width ||
+        multisampleTexture.height !== canvasTexture.height) {
+
+      // If we have an existing multisample texture destroy it.
+      if (multisampleTexture) {
+        multisampleTexture.destroy();
+      }
+
+      // Create a new multisample texture that matches our
+      // canvas's size
+      multisampleTexture = device.createTexture({
+        format: canvasTexture.format,
+        usage: GPUTextureUsage.RENDER_ATTACHMENT,
+        size: [canvasTexture.width, canvasTexture.height],
*        sampleCount: 4,
+      });
+    }

  ...
```

The code above creates a multisample texture if (a) we don't have one
or (b) the one we have does not match the size of the canvas.
We create a texture the same size as the canvas but we add `sampleCount: 4`
to make it a multisample texture.

### Set our render pass to render to the multisample texture and *resolve* to the final texture (our canvas)

```js
-    // Get the current texture from the canvas context and
-    // set it as the texture to render to.
-    renderPassDescriptor.colorAttachments[0].view =
-        context.getCurrentTexture().createView();

+    // Set the multisample texture as the texture to render to
+    renderPassDescriptor.colorAttachments[0].view =
+        multisampleTexture.createView();
+    // Set the canvas texture as the texture to "resolve"
+    // the multisample texture to.
+    renderPassDescriptor.colorAttachments[0].resolveTarget =
+        canvasTexture.createView();
```

*Resolving* is the process of taking the multisample texture and converting it to a
the size of the texture we really wanted. In this case, our canvas. You'd think we
could just render it ourselves with bilinear filtering or whatever but the GPU may have
special hardware to do this step so it's faster to let it do.

And here is

{{{example url="../webgpu-multisample-simple.html"}}}

There isn't much to see but if we were to compare them side by side at low-resolution,
the original on the left without multisampling and the one on the right with we can
see the one on the right has been antialiased

<div class="webgpu_center side-by-side flex-gap" style="max-width: 850px">
  <div class="multisample-example">
    <div data-diagram="simple-triangle"></div>
    <div>original</div>
  </div>
  <div class="multisample-example">
    <div data-diagram="simple-triangle-multisample"></div>
    <div>with multisampling</div>
  </div>
</div>

Some things to note:

* `count` must be `4`

  In WebGPU version 1, you can only set `multisample: { count }` on a render pipeline
  to 4 or 1. Similarly you can only set the `sampleCount` on a texture to 4 or 1.
  1 = not multisampled.

* Multisampling does not use a grid

  Above we mentioned manually rendering to a 4x resolution texture and using bilinear filtering
  to are desired size but that is not exactly what multisampling does.

  Multisampling actually uses offsets like this for the 4 points it tests for inside/outside
  of the triangle

  <img src="resources/multisample-4x.svg" width="256" >

  This is even more interesting for other count settings.

  count: 2

  <img src="resources/multisample-2x.svg" width="256">

  count: 8

  <img src="resources/multisample-8x.svg" width="256">

  count: 16

  <img src="resources/multisample-16x.svg" width="256">

  WebGPU currently only supports a count of 4 but the point is, multisampling is not a grid.

* You can optionally run the fragment shader on each multisampled pixel

  Above we said that the fragment shader only runs once for every 2x2 pixels in the multisampled
  texture. It runs it once and then it stores the result in pixels that were actually inside
  the triangle. This is why it's faster than rendering at 4x the resolution.

  In [the article on inter-stage variables](webgpu-inter-stage-variables.html#a-interpolate)
  we brought up that you can mark how to interpolate inter-stage variables. One option
  is `sample` in which case the fragment shader will be run once for each sample.

* You do not have to set a resolve target on every render pass

  Setting `colorAttachment[0].resolveTarget` says to WebGPU, "when all the drawing has finished,
  downscale the multisample texture into the texture set on `resolveTarget`. If you have multiple
  render passes you probably don't want to resolve until the last pass. We'll it's fastest to
  resolve in the last pass it's also perfectly acceptable
  to make an empty last render pass to do nothing but resolve. 
  Just make sure you set the `loadOp` to `'load'`
  and not `'clear'` in all the passes except the first pass otherwise it will be cleared.

## What about inside a triangle?

Multisampling only handles the edges of triangles so what about when we're drawing with a texture, there
may be contrasty colors next to each other inside the triangle. Don't we want anti-aliasing there too?
Inside the triangle we use mipmaps and filtering to pick the appropriate color so anti-aliasing may be less
important there. On the other hand, this can also be a problem which is why their are other solutions to
anti-aliasing.

## Multisampling is not the only solution for anti-aliasing.

We mentioned 2 solutions on this page.
(1) Drawing to a higher resolution texture and then drawing that texture at a lower resolution.
(2) Using multisampling. There are many others though.
[Here's an article that covers a few of them](https://vr.arvilab.com/blog/anti-aliasing).

Some other resources:

* [A Quick overview of MSAA](https://therealmjp.github.io/posts/msaa-overview/)
* [Multisampling primer](https://www.rastergrid.com/blog/gpu-tech/2021/10/multisampling-primer/)

<!-- keep this at the bottom of the article -->
<link href="webgpu-multisampling.css" rel="stylesheet">
<script type="module" src="webgpu-multisampling.js"></script>
