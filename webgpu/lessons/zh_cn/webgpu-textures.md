Title: WebGPU Textures
Description: 如何使用纹理
TOC: 纹理

本文是着色器数据传递各种方法系列文章中的一篇。
每一篇都构建于前面的课程基础之上，因此按顺序阅读将有助于您更好地理解。

{{{toc-steps list="passing-data.hanson"}}}

本文将介绍纹理的基本原理。在之前的文章中，我们介绍了向着色器传递数据的其他主要方法。它们是[inter-stage 变量](webgpu-inter-stage-variables.html)、[uniforms](webgpu-uniforms.html)、[存储缓冲区](webgpu-storage-buffers.html)和[顶点缓冲区](webgpu-vertex-buffers)。最后一种向着色器传递数据的主要方式是纹理。

纹理通常代表 2d 图像。二维图像只是一个由颜色值组成的二维数组，因此你可能会问，为什么我们需要二维数组的纹理呢？我们可以直接使用存储缓冲区作为二维数组。纹理的特殊之处在于，它们可以被称为 *采样器(sampler)* 的特殊硬件访问。采样器可以读取纹理中最多 16 个不同的值，并将它们混合在一起，这对许多常见的使用情况都很有用。

举个例子，假设我想绘制一张比原始尺寸更大的 2D 图像。

<div class="center">
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 128px; height: 128px; image-rendering: pixelated; image-rendering: crisp-edges;"></div>
    <div style="text-align: center;">original</div>
  </div>
</div>

如果我们只是简单地从原始图像中提取一个像素来制作大图中的每一个像素，就会出现下面的第一个例子。相反，如果我们对大图中的某一像素点考虑原始图像中的多个像素点，就会得到类似下面第二幅图的结果，希望这样显示出来的马赛克会更少。

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

虽然有一些 WGSL 函数可以从纹理中获取单个像素，而且也有相应的用例，但这些函数并不那么有趣，因为我们可以用存储缓冲区来做同样的事情。对于纹理来说，有趣的 WGSL 函数是过滤和混合多个像素的函数。

这些 WGSL 函数需要一个表示数据的纹理、一个表示我们希望如何从纹理中提取数据的采样器，以及一个指定我们希望从纹理中获取值的纹理坐标。

采样纹理的纹理坐标横向和纵向都是从 0.0 到 1.0，与纹理的实际大小无关。[^up-or-down]

[^up-or-down]: 纹理坐标是向上（0 = 底部，1 = 顶部）还是向下（0 = 顶部，1 = 底部）是一个视角问题。重要的是纹理坐标 0,0 是纹理中的第一个数据。︎

<div class="webgpu_center"><img src="resources/texture-coordinates-diagram.svg" style="width: 500px;"></div>

让我们从[inter-stage 变量的文章](webgpu-inter-stage-variables.html)中选取一个示例，对其进行修改，以绘制带有纹理的四边形（2 个三角形）。

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) texcoord: vec2f,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
-  let pos = array(
-    vec2f( 0.0,  0.5),  // top center
-    vec2f(-0.5, -0.5),  // bottom left
-    vec2f( 0.5, -0.5)   // bottom right
-  );
-  var color = array<vec4f, 3>(
-    vec4f(1, 0, 0, 1), // red
-    vec4f(0, 1, 0, 1), // green
-    vec4f(0, 0, 1, 1), // blue
-  );
+  let pos = array(
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

上面我们将绘制居中三角形的 3 个顶点改为绘制画布右上角四边形的 6 个顶点。

我们将 `OutVertexShaderOutput` 改为传递 `texcoord`（一个 `vec2f`），以便将纹理坐标传递给片段着色器。我们更改了顶点着色器，将 `vsOutput.texcoord` 设置为与我们从硬编码 position 数组中提取的裁剪空间位置相同的值。`vsOutput.texcoord`的值在传递给片段着色器时将会在三角形的三个顶点中进行插值。

然后，我们声明了采样器和纹理，并在片段着色器中引用了它们。函数 `textureSample` 对纹理进行采样。第一个参数是要采样的纹理。第二个参数是采样器，用于指定如何对纹理进行采样。第三个参数是纹理坐标，用于指定采样位置。

> 注：将位置值作为纹理坐标传递的做法并不常见，但在这种单位四边形（宽和高各为一个单位的四边形）的特殊情况下，我们需要的纹理坐标恰好与位置值相匹配。这样做可以使示例更小更简单。通过[顶点缓冲区](webgpu-vertex-buffers.html)提供纹理坐标要常见得多。

现在我们需要创建纹理数据。我们将创建一个 5x7 的像素化 F。[^texel]

[^texel]: texel 是 "纹理元素 "的简称，而 pixel 则是 "图片元素 "的简称。对我来说，texel 和 pixel 基本上是同义词，但有些人在讨论纹理时喜欢使用 *texel* 这个词。

```js
const kTextureWidth = 5;
const kTextureHeight = 7;
const _ = [255, 0, 0, 255]; // red
const y = [255, 255, 0, 255]; // yellow
const b = [0, 0, 255, 255]; // blue
//prettier-ignore
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

希望你能看到 `F` 以及左上角的蓝色像素（第一个值）。

我们将创建一个 `rgba8unorm` 纹理。`rgba8unorm` 表示纹理将有有红、绿、蓝和 alpha 值。每个值都是 8 位无符号值，并且在纹理中使用时将进行归一化处理。`unorm` 表示 `unsigned normalized`。意思是 "无符号归一化"，它将 0~255 的值转换为 0.0~1.0 之间的浮点数值。

换句话说，如果我们在纹理中输入的值是`[64, 128, 192, 255]`，那么着色器中的值最终将是`[64 / 255, 128 / 255, 192 / 255, 255 / 255]`。或者换一种说法，在 shader 中最终的值是`[0.25, 0.50, 0.75, 1.00]`。

现在我们有了数据，我们来制作一下纹理

```js
const texture = device.createTexture({
    size: [kTextureWidth, kTextureHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
});
```

对于 `device.createTexture`，`size` 参数应该非常明显。如上所述，纹理格式为 `rgba8unorm`。对于 `usage`，`GPUTextureUsage.TEXTURE_BINDING` 表示我们希望能将此纹理绑定到一个绑定组[^texture-binding]，而 `COPY_DST` 则表示我们希望能将数据复制到此纹理。

[^texture-binding]: 纹理的另一个常见用法是 `GPUTextureUsage.RENDER_ATTACHMENT`，用于我们要渲染的纹理。例如，从 `context.getCurrentTexture()` 获取的画布纹理默认设置为 `GPUTextureUsage.RENDER_ATTACHMENT`。

接下来，我们需要做的就是将数据复制到纹理上面。

```js
device.queue.writeTexture(
    { texture },
    textureData,
    { bytesPerRow: kTextureWidth * 4 },
    { width: kTextureWidth, height: kTextureHeight }
);
```

对于 `device.queue.writeTexture`，第一个参数是我们要更新的纹理。第二个参数是我们要复制到其中的数据。第三个参数定义将数据复制到纹理时的读取方式。`bytesPerRow` 指定从源数据的一行到下一行的字节数。最后一个参数指定拷贝的大小。

我们也同样需要一个采样器

```js
const sampler = device.createSampler();
```

我们需要将纹理和采样器添加到绑定组中，绑定组中的绑定与着色器中的 `@binding(?)` 匹配。

```js
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture },
    ],
});
```

要更新渲染，我们需要指定绑定组并渲染 6 个顶点，以渲染由 2 个三角形组成的四边形。

```js
const pass = encoder.beginRenderPass(renderPassDescriptor);
pass.setPipeline(pipeline);
+pass.setBindGroup(0, bindGroup);
-pass.draw(3); // call our vertex shader 3 times
+pass.draw(6); // call our vertex shader 6 times
pass.end();
```

运行代码得到以下结果：

{{{example url="../webgpu-simple-textured-quad.html"}}}

**为什么 F 是颠倒的?**

如果回过头来再次参考纹理坐标图，就会发现纹理坐标 0,0 指向纹理的第一个像素。我们的四边形在画布中心的位置是 0,0，我们使用该值作为纹理坐标，因此它就如图所示，0,0 纹理坐标指的是第一个蓝色像素。

该问题有 2 个常见的解决方案。

1. 翻转纹理坐标

    在此示例中，我们可以在顶点着色器中改变纹理坐标

    ```wgsl
    -  vsOutput.texcoord = xy;
    +  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
    ```

    或者在片段着色器中翻转坐标

    ```wgsl
    -  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
    +  let texcoord = vec2f(fsInput.texcoord.x, 1.0 - fsInput.texcoord.y);
    +  return textureSample(ourTexture, ourSampler, texcoord);
    ```

    当然，如果我们是通过[顶点缓冲区](webgpu-vertex-buffers.html)或[存储缓冲区](webgpu-storage-buffers.html)提供纹理坐标，那么理想的做法是在源文件中翻转它们。

2. 翻转纹理数据

    ```js
    //prettier-ignore
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

    一旦我们翻转了数据，原来位于顶部的数据现在就会位于底部，而原始图像的左下角像素就是纹理中的第一个数据，也就是纹理坐标 0,0 所指的位置。这就是为什么纹理坐标通常被认为是从底部的 0 到顶部的 1。

     <div class="webgpu_center"><img src="resources/texture-coordinates-y-flipped.svg" style="width: 500px;"></div>

    翻转数据非常常见，甚至在从图片、视频和画布中加载纹理时都有选项来为你翻转数据。

## <a id="a-mag-filter"></a>放大过滤器(magFilter)

在上面的示例中，我们使用了默认设置的采样器。由于我们绘制的 5x7 纹理比原始的 5x7 纹理要大，因此采样器使用了所谓的 `magFilter` 或者说是放大纹理时使用的过滤器。如果我们将其从 `nearest` 改为 `linear`，那么它将在 4 个像素之间进行线性插值。

<a id="a-linear-interpolation"></a>

<div class="webgpu_center center diagram"><div data-diagram="linear-interpolation" style="display: inline-block; width: 600px;"></div></div>

纹理坐标通常称为 "UVs"（读作 you-vees），因此在上图中，`uv` 就是纹理坐标。`t1` 是所选像素的左上方中心点与其右边中心点之间的水平距离，0 表示水平位于像素的左边中心点，1 表示水平位于像素的右边中心点。`t2` 与其类似，只不过是在竖直方向。

`t1` 用于在顶部 2 个像素之间进行 _"混合"_，以生成中间色。 混合在 2 个值之间进行线性插值，因此当 `t1` 为 0 时，我们只能得到第一种颜色。当 `t1` = 1 时，我们只能得到第二种颜色。介于 0 和 1 之间的值会产生比例混合。例如，0.3 表示第一种颜色占 70%，第二种颜色占 30%。同样，底部 2 个像素也会计算出第二种中间色。最后，使用 `t2` 将两种中间颜色混合为最终颜色。

另外需要注意的是，在图的底部还有两个采样器设置，即 `addressModeU` 和 `addressModeV`。我们可以将其设置为 `repeat` 或 `clamp-to-edge`[^mirror-repeat]。当设置为 `repeat` 时，当我们的纹理坐标位于纹理边缘半个图元以内时，我们就会环绕纹理并与纹理另一侧的像素混合。当设置为 `clamp-to-edge` 时，为了计算要返回的颜色，纹理坐标会被夹住，使其不能进入每条边缘的最后半格距。这样做的效果是，在该范围之外的任何纹理坐标都会显示边缘颜色。

[^mirror-repeat]: 还有一种 address mode，即 "mirror-repeat"。如果我们的纹理是"🟥🟩🟦"，那么 repeat 会表现成 "🟥🟩🟦🟥🟩🟦🟥🟩🟦🟥🟩🟦"，而 mirror- repeat 会表现成 "🟥🟩🟦🟦🟩🟥🟥🟩🟦🟦🟩🟥"。

让我们更新一下示例，这样就可以使用所有这些选项绘制四边形了。

首先，让我们为每种设置组合创建一个采样器。我们还将创建一个使用该采样器的绑定组。

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
        { binding: 1, resource: texture },
      ],
    });
+    bindGroups.push(bindGroup);
+  }
```

我们将进行下面的设置

```js
const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
};
```

在渲染的时候我们将根据设置来决定使用哪一个绑定组。

```js
  function render() {
+    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
+                (settings.addressModeV === 'repeat' ? 2 : 0) +
+                (settings.magFilter === 'linear' ? 4 : 0);
+    const bindGroup = bindGroups[ndx];
   ...
```

现在我们需要做的就是提供一些用户界面，让我们可以更改设置，当设置更改时，我们需要重新渲染。我正在使用一个名为 "muigui "的库，它目前有一个类似于 [dat.GUI](https://github.com/dataarts/dat.gui)
的 API

```js
import GUI from '../3rdparty/muigui-0.x.module.js';

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

上面的代码声明了 `settings`，然后创建了一个用户界面来设置它们，并在它们发生变化时调用 `render`。

{{{example url="../webgpu-simple-textured-quad-linear.html"}}}

由于片段着色器接收的是插值纹理坐标，因此当我们的着色器使用这些坐标调用 `textureSample` 时，会得到不同的混合颜色，因为它需要为渲染的每个像素提供一种颜色。请注意，当 address mode 设置为 "repeat" 时，我们可以看到 WebGPU 正在从纹理的另一边 "采样"。

## <a id="a-min-filter"></a>缩小过滤器(minFilter)

还有一个设置，即 `minFilter`，当绘制的纹理小于其尺寸时，它也会进行与 `magFilter` 类似的运算。当设置为 "linear" 时，它也会选择 4 个像素，并按照与上述类似的计算方法进行混合。

问题是，如果从较大的纹理中选择 4 个混合像素来渲染 1 个像素，颜色就会发生变化，我们就会看到闪烁。

让我们来做一下，以便了解问题所在

首先，让我们将画布设置为低分辨率。为此，我们需要更新我们的 css，但是此时浏览器不会在画布上产生类似的的 `magFilter: 'linear'` 效果。我们可以通过如下设置 css 来实现这一点

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  image-rendering: pixelated;
+  image-rendering: crisp-edges;
}
```

接下来，让我们在 `ResizeObserver` 回调中降低画布的分辨率

```js
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
-      const width = entry.contentBoxSize[0].inlineSize;
-      const height = entry.contentBoxSize[0].blockSize;
+      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
+      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // re-render
      render();
    }
  });
  observer.observe(canvas);
```

我们要移动和缩放四边形，因此我们要添加一个 uniform 缓冲区，就像在[uniform 文章](webgpu-uniforms.html)的第一个示例中所做的那样。

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
  let pos = array(
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

既然有了 uniform，我们就需要创建一个 uniform 缓冲区，并将其添加到绑定组中。

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
        { binding: 1, resource: texture },
+        { binding: 2, resource: uniformBuffer },
      ],
    });
    bindGroups.push(bindGroup);
  }
```

我们需要代码来设置第一个 uniform 的值并将其上传到 GPU。我们将对此进行动画处理，因此我们还将修改代码，使用 `requestAnimationFrame` 进行连续渲染。

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
+    uniformValues.set([Math.sin(time * 0.25) * 0.8, -0.8], kOffsetOffset); // set the offset
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
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      // re-render
-      render();
    }
  });
  observer.observe(canvas);
}
```

上面的代码设置了缩放比例，因此我们将在画布上绘制 2x2 像素大小的四边形。它还使用 `Math.sin` 将偏移量设置为 -0.8 到 +0.8，这样四边形就会在画布上缓慢地来回移动。

最后，让我们将 `minFilter` 添加到设置和组合中

```js
  const bindGroups = [];
-  for (let i = 0; i < 8; ++i) {
+  for (let i = 0; i < 16; ++i) {
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

由于我们使用 requestAnimationFrame（通常称为 "rAF"，这种样式的渲染循环通常称为 "rAF 循环"）持续呈现，因此我们不再需要在设置更改时调用 `render`。

{{{example url="../webgpu-simple-textured-quad-minfilter.html"}}}

你可以看到四边形在闪烁并变换颜色。如果将 `minFilter` 设置为 `nearest`，那么对于四边形的每个 2x2 像素，它都会从我们的纹理中选取一个像素。如果将其设置为 `linear`，那么它就会执行我们上面提到的双线性滤波，但仍然会闪烁。

其中一个原因是，四边形是用实数定位的，而像素是整数。纹理坐标是从实数中插值出来的，或者说是从实数中计算出来的。

<a id="a-pixel-to-texcoords"></a>

<div class="webgpu_center center diagram">
  <div class="fit-container">
    <div class="text-align: center">drag to move</div>
    <div class="fit-container" data-diagram="pixel-to-texcoords" style="display: inline-block; width: 600px;"></div>
  </div>
</div>

在上图中，<span style="color: red;">红色</span>矩形代表我们要求 GPU 根据顶点着色器返回的值绘制的四边形。当 GPU 绘制时，它会计算哪些像素的中心在我们的四边形（我们的 2 个三角形）内。然后，它会根据要绘制的像素中心相对于原始点的位置，计算出要传递给片段着色器的插值阶段间变量值。然后，在片段着色器中，我们将纹理坐标传递给 WGSL `textureSample` 函数，并返回上图所示的采样颜色。希望你能明白为什么颜色会闪烁。你可以看到它们混合成不同的颜色，这取决于为绘制的像素计算的 UV 坐标。

纹理为这一问题提供了解决方案。它被称为 mip-mapping。我认为（但也可能是错的），"mipmap "是 "multi-image-pyramid-map "的缩写。

我们使用纹理并创建一个较小的纹理，该纹理的每个维度的大小均为其一半，然后四舍五入。然后，我们用第一个原始纹理的混合颜色填充这个较小的纹理。如此反复，直到得到一个 1x1 的纹理。在我们的示例中，我们有一个 5x7 平方英寸的纹理。将每个维度除以 2 并向下舍入，就得到了一个 2x3 色素的纹理。我们取这一数值并重复，最终得到 1x1 色度的纹理。

<div class="webgpu_center center diagram"><div data-diagram="mips" style="display: inline-block;"></div></div>

有了 mipmap，当我们绘制比原始纹理尺寸更小的纹理时，就可以要求 GPU 选择更小的 mip 级别。这样看起来会更好，因为它已经过 "预混合"，能更好地表现纹理缩小后的颜色。

将像素从一个 mip 混合到下一个 mip 的最佳算法既是一个研究课题，也是一个见仁见智的问题。作为第一个想法，这里有一些代码，可以通过双线性滤波（如上所示）从上一个 mip 生成每一个 mip。

```js
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const bilinearFilter = (tl, tr, bl, br, t1, t2) => {
    const t = mix(tl, tr, t1);
    const b = mix(bl, br, t1);
    return mix(t, b, t2);
};

const createNextMipLevelRgba8Unorm = ({
    data: src,
    width: srcWidth,
    height: srcHeight,
}) => {
    // compute the size of the next mip
    const dstWidth = Math.max(1, (srcWidth / 2) | 0);
    const dstHeight = Math.max(1, (srcHeight / 2) | 0);
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
            const au = u * srcWidth - 0.5;
            const av = v * srcHeight - 0.5;

            // compute the src top left texel coord (not texcoord)
            const tx = au | 0;
            const ty = av | 0;

            // compute the mix amounts between pixels
            const t1 = au % 1;
            const t2 = av % 1;

            // get the 4 pixels
            const tl = getSrcPixel(tx, ty);
            const tr = getSrcPixel(tx + 1, ty);
            const bl = getSrcPixel(tx, ty + 1);
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
    let mip = { data: src, width: srcWidth, height: srcHeight };
    const mips = [mip];

    while (mip.width > 1 || mip.height > 1) {
        mip = createNextMipLevelRgba8Unorm(mip);
        mips.push(mip);
    }
    return mips;
};
```

我们将在[另一篇文章](webgpu-importing-textures.html)中介绍如何在 GPU 上实现这一功能。现在，我们可以使用上面的代码生成 mipmap。

我们将纹理数据传递给上面的函数，它会返回一个 mip 级数据数组。然后我们就可以创建一个包含所有 mip 级别的纹理了

```js
  const mips = generateMips(textureData, kTextureWidth);

  const texture = device.createTexture({
    label: 'yellow F on red',
+    size: [mips[0].width, mips[0].height],
+    mipLevelCount: mips.length,
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  mips.forEach(({data, width, height}, mipLevel) => {
    device.queue.writeTexture(
-      { texture },
-      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
-      { width: kTextureWidth, height: kTextureHeight },
+      { texture, mipLevel },
+      data,
+      { bytesPerRow: width * 4 },
+      { width, height },
    );
  });
```

请注意，我们在 `mipLevelCount` 中传递的是 mip 级别的数量。然后，WebGPU 将在每一级创建正确大小的 mip 级。然后，我们通过指定 `mipLevel` 将数据复制到每个级别。

我们还可以添加缩放设置，这样就可以看到以不同尺寸绘制的四边形。

```js
  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
    minFilter: 'linear',
+    scale: 1,
  };

  ...

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  gui.add(settings, 'addressModeU', addressOptions);
  gui.add(settings, 'addressModeV', addressOptions);
  gui.add(settings, 'magFilter', filterOptions);
  gui.add(settings, 'minFilter', filterOptions);
+  gui.add(settings, 'scale', 0.5, 6);

  function render(time) {

    ...

-    const scaleX = 4 / canvas.width;
-    const scaleY = 4 / canvas.height;
+    const scaleX = 4 / canvas.width * settings.scale;
+    const scaleY = 4 / canvas.height * settings.scale;

```

这样 GPU 就会选择最小的 mip 进行绘制，闪烁现象也就消失了。

{{{example url="../webgpu-simple-textured-quad-mipmap.html"}}}

调整缩放比例，你会发现随着尺寸的增大，使用的 mip 级别也会发生变化。在缩放比例 2.4 和缩放比例 2.5 之间，GPU 会在 mip 级别 0（最大 mip 级别）和 mip 级别 1（中等大小）之间切换，这是一个非常严酷的过渡。这该怎么办？

## <a id="a-mipmap-filter"></a>mipmap 过滤器

就像我们可以设置 `magFilter` 和 `minFilter` 为 `nearest` 或 `linear` 一样，`mipmapFilter` 也可以被设置为 `nearest` 或 `linear`。

如果我们在 mip 级别之间进行混合，就会选择这种方式。在 `mipmapFilter: 'linear'` 中，颜色从 2 个 mip 层采样，根据之前的设置进行 nearest 或 linear 过滤，然后再以类似的方式混合这 2 种颜色。

在绘制三维图时，这种情况出现得最多。如何绘制 3D 图像在[其他文章](webgpu-perspective.html)中已有介绍，这里就不多说了，但我们将改变之前的示例，显示一些 3D 图像，以便更好地了解 `mipmapFilter` 的工作原理。

首先，让我们制作一些纹理。我们将制作一个 16x16 的纹理，我认为这样可以更好地展示 `mipmapFilter` 的效果。

```js
//prettier-ignore
const createBlendedMipmap = () => {
    const w = [255, 255, 255, 255];
    const r = [255,   0,   0, 255];
    const b = [  0,  28, 116, 255];
    const y = [255, 231,   0, 255];
    const g = [ 58, 181,  75, 255];
    const a = [ 38, 123, 167, 255];
    const data = new Uint8Array([
      w, r, r, r, r, r, r, a, a, r, r, r, r, r, r, w,
      w, w, r, r, r, r, r, a, a, r, r, r, r, r, w, w,
      w, w, w, r, r, r, r, a, a, r, r, r, r, w, w, w,
      w, w, w, w, r, r, r, a, a, r, r, r, w, w, w, w,
      w, w, w, w, w, r, r, a, a, r, r, w, w, w, w, w,
      w, w, w, w, w, w, r, a, a, r, w, w, w, w, w, w,
      w, w, w, w, w, w, w, a, a, w, w, w, w, w, w, w,
      b, b, b, b, b, b, b, b, a, y, y, y, y, y, y, y,
      b, b, b, b, b, b, b, g, y, y, y, y, y, y, y, y,
      w, w, w, w, w, w, w, g, g, w, w, w, w, w, w, w,
      w, w, w, w, w, w, r, g, g, r, w, w, w, w, w, w,
      w, w, w, w, w, r, r, g, g, r, r, w, w, w, w, w,
      w, w, w, w, r, r, r, g, g, r, r, r, w, w, w, w,
      w, w, w, r, r, r, r, g, g, r, r, r, r, w, w, w,
      w, w, r, r, r, r, r, g, g, r, r, r, r, r, w, w,
      w, r, r, r, r, r, r, g, g, r, r, r, r, r, r, w,
    ].flat());
    return generateMips(data, 16);
  };
```

这将生成这些 mip 级别

<div class="webgpu_center center diagram"><div data-diagram="blended-mips" style="display: inline-block;"></div></div>

我们可以在每个 mip 层中自由放置任何数据，因此另一个查看发生了什么的好方法就是让每个 mip 层呈现不同的颜色。让我们使用 canvas 2d api 来制作 mip 层。

```js
const createCheckedMipmap = () => {
    const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true });
    const levels = [
        { size: 64, color: 'rgb(128,0,255)' },
        { size: 32, color: 'rgb(0,255,0)' },
        { size: 16, color: 'rgb(255,0,0)' },
        { size: 8, color: 'rgb(255,255,0)' },
        { size: 4, color: 'rgb(0,0,255)' },
        { size: 2, color: 'rgb(0,255,255)' },
        { size: 1, color: 'rgb(255,0,255)' },
    ];
    return levels.map(({ size, color }, i) => {
        ctx.canvas.width = size;
        ctx.canvas.height = size;
        ctx.fillStyle = i & 1 ? '#000' : '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size / 2, size / 2);
        ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
        return ctx.getImageData(0, 0, size, size);
    });
};
```

该代码将生成这些 mip 级别。

<div class="webgpu_center center diagram"><div data-diagram="checkered-mips" style="display: inline-block;"></div></div>

现在我们已经创建了数据，让我们创建纹理吧

```js
+  const createTextureWithMips = (mips, label) => {
    const texture = device.createTexture({
-      label: 'yellow F on red',
+      label,
      size: [mips[0].width, mips[0].height],
      mipLevelCount: mips.length,
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });
    mips.forEach(({data, width, height}, mipLevel) => {
      device.queue.writeTexture(
          { texture, mipLevel },
          data,
          { bytesPerRow: width * 4 },
          { width, height },
      );
    });
    return texture;
+  };

+  const textures = [
+    createTextureWithMips(createBlendedMipmap(), 'blended'),
+    createTextureWithMips(createCheckedMipmap(), 'checker'),
+  ];
```

我们将在 8 个位置绘制一个向远处延伸的四边形。我们将使用[有关 3D 的系列文章](webgpu-cameras.html)中涉及的矩阵数学。

```wsgl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
-  scale: vec2f,
-  offset: vec2f,
+  matrix: mat4x4f,
};

@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(

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
-  vsOutput.position = vec4f(xy * uni.scale + uni.offset, 0.0, 1.0);
+  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy * vec2f(1, 50);
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

8 个平面将分别使用不同的 `minFilter`、`magFilter` 和 `mipmapFilter` 组合。这意味着每个平面都需要一个不同的绑定组，其中包含一个具有特定滤镜组合的采样器。此外，我们还有 2 个纹理。纹理也是绑定组的一部分，因此每个对象需要 2 个绑定组，每个纹理一个。然后，我们可以在渲染时选择使用哪一个。要在 8 个位置绘制平面，我们还需要在每个位置使用一个 uniform buffer，就像我们在[uniform 一文](webgpu-uniforms.html)中所介绍的那样。

```js
// offsets to the various uniform values in float32 indices
const kMatrixOffset = 0;

const objectInfos = [];
for (let i = 0; i < 8; ++i) {
    const sampler = device.createSampler({
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: i & 1 ? 'linear' : 'nearest',
        minFilter: i & 2 ? 'linear' : 'nearest',
        mipmapFilter: i & 4 ? 'linear' : 'nearest',
    });

    // create a buffer for the uniform values
    const uniformBufferSize = 16 * 4; // matrix is 16 32bit floats (4bytes each)
    const uniformBuffer = device.createBuffer({
        label: 'uniforms for quad',
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // create a typedarray to hold the values for the uniforms in JavaScript
    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const matrix = uniformValues.subarray(kMatrixOffset, 16);

    const bindGroups = textures.map(texture =>
        device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture },
                { binding: 2, resource: uniformBuffer  },
            ],
        })
    );

    // Save the data we need to render this object.
    objectInfos.push({
        bindGroups,
        matrix,
        uniformValues,
        uniformBuffer,
    });
}
```

在渲染时，我们会[计算视图投影矩阵](webgpu-cameras.html)。

```js
  function render() {
    const fov = 60 * Math.PI / 180;  // 60 degrees in radians
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const zNear  = 1;
    const zFar   = 2000;
    const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar);

    const cameraPosition = [0, 0, 2];
    const up = [0, 1, 0];
    const target = [0, 0, 0];
    const cameraMatrix = mat4.lookAt(cameraPosition, target, up);
    const viewMatrix = mat4.inverse(cameraMatrix);
    const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);

    ...
```

然后，对于每个平面，我们根据想要显示的纹理选择一个绑定组，并计算一个唯一矩阵来定位该平面。

```js
  let texNdx = 0;

  function render() {
    ...

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    objectInfos.forEach(({bindGroups, matrix, uniformBuffer, uniformValues}, i) => {
      const bindGroup = bindGroups[texNdx];

      const xSpacing = 1.2;
      const ySpacing = 0.7;
      const zDepth = 50;

      const x = i % 4 - 1.5;
      const y = i < 4 ? 1 : -1;

      mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix);
      mat4.rotateX(matrix, 0.5 * Math.PI, matrix);
      mat4.scale(matrix, [1, zDepth * 2, 1], matrix);
      mat4.translate(matrix, [-0.5, -0.5, 0], matrix);

      // copy the values from JavaScript to the GPU
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(6);  // call our vertex shader 6 times
    });

    pass.end();
```

我删除了现有的用户界面代码，从 rAF 循环转回在 `ResizeObserver` 回调中进行渲染，并停止降低分辨率。

```js
-  function render(time) {
-    time *= 0.001;
+  function render() {

    ...

-    requestAnimationFrame(render);
  }
-  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
-      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
-      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
+      const width = entry.contentBoxSize[0].inlineSize;
+      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
+      render();
    }
  });
  observer.observe(canvas);
```

既然不再是低分辨率，我们就可以去掉阻止浏览器过滤画布本身的 CSS。

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
-  image-rendering: pixelated;
-  image-rendering: crisp-edges;
}
```

我们还可以让它在您点击画布时切换要使用的纹理，并重新渲染

```js
canvas.addEventListener('click', () => {
    texNdx = (texNdx + 1) % textures.length;
    render();
});
```

{{{example url="../webgpu-simple-textured-quad-mipmapfilter.html"}}}

希望您能看到从左上角所有过滤设置为最近到右下角所有过滤设置为线性的过程。特别要指出的是，由于我们在本例中添加了 `mipmapFilter`，如果点击图片来显示经过检查的纹理，其中每个 mip 层都是不同的颜色，你应该可以看到顶部的每个平面都将 mipmapFilter 设置为 `nearest`，因此从一个 mip 层切换到下一个 mip 层时是突变的。在底部，每个平面的 `mipmapFilter` 都设置为 `linear`，因此在 mip 级别之间会发生混合。

你可能会问，为什么不将所有过滤都设置为 `linear` 呢？显而易见的原因就是风格。如果你想制作一幅像素化的图像，那么当然不需要滤波。另一个原因是速度。当所有过滤都设置为 `nearest` 时，从纹理中读取 1 个像素的速度要快于当所有过滤都设置为 `linear` 时，从纹理中读取 8 个像素的速度。

待定：重复模式

待定：各向异性过滤模式

## 纹理类型与纹理视图

在此之前，我们只使用过 2D 纹理。一共有三种类型的纹理

-   "1d"
-   "2d"
-   "3d"

在某种程度上，您可以将 "2d" 纹理视为深度为 1 的 "3d" 纹理，而 "1d" 纹理只是高度为 1 的 "2d" 纹理。每种类型的纹理 "1d"、"2d" 和 "3d" 都有不同的限制。在设置画布大小时，我们使用的是 "2d "限制。

```js
canvas.width = Math.max(
    1,
    Math.min(width, device.limits.maxTextureDimension2D)
);
canvas.height = Math.max(
    1,
    Math.min(height, device.limits.maxTextureDimension2D)
);
```

另一个问题是速度，至少对于 3d 纹理与 2d 纹理的对比而言，在所有采样器滤波器都设置为 `linear` 的情况下，3d 纹理采样需要查看 16 个像素并将它们混合在一起。而 2d 纹理采样只需要 8 个像素。1d 纹理可能只需要 4 个，但我不知道 GPU 是否真的针对 1d 纹理进行了优化。

### 纹理视图

一共有 6 种纹理视图，如下

-   "1d"
-   "2d"
-   "2d-array"
-   "3d"
-   "cube"
-   "cube-array"

"1d" 纹理只能有 "1d" 视图。"3d" 纹理只能有 "3d" 视图。"2d" 纹理可以有 "2d-array" 视图。如果一个 "2d" 纹理有 6 层，它可以有一个 "cube" 视图。如果是 6 层的倍数，则可以使用 "cube-array" 视图。您可以在调用 `someTexture.createView` 时选择如何查看纹理。纹理视图默认与其尺寸相同，但您也可以向 `someTexture.createView` 传递不同的尺寸。

我们将在[色调映射/3dLUT 的文章](webgpu-3dluts.html)中介绍 "3d" 纹理。

"cube" 纹理是表示立方体 6 个面的纹理。Cube 纹理通常用于绘制天空框、反射和环境贴图。我们将在[有关立方体贴图的文章](webgpu-cube-maps.html)中介绍这一点。

"2d-array" 是一个二维纹理数组。您可以选择在着色器中访问数组中的哪种纹理。除其他外，它们通常用于地形渲染。

"cube-array" 是一个 cube 纹理数组。

每种类型的纹理在 WGSL 中都有自己对应的类型。

<div class="webgpu_center data-table" style="max-width: 500px;">
  <style>
    .texture-type {
      text-align: left;
      font-size: large;
      line-height: 1.5em;
    }
    .texture-type td:nth-child(1) {
      white-space: nowrap;
    }
  </style>
  <table class="texture-type">
   <thead>
    <tr>
     <th>type</th>
     <th>WGSL types</th>
    </tr>
   </thead>
   <tbody>
    <tr><td>"1d"</td><td><code>texture_1d</code> or <code>texture_storage_1d</code></td></tr>
    <tr><td>"2d"</td><td><code>texture_2d</code> or <code>texture_storage_2d</code> or <code>texture_multisampled_2d</code> as well as a special case for in certain situations <code>texture_depth_2d</code> and <code>texture_depth_multisampled_2d</code></td></tr>
    <tr><td>"2d-array"</td><td><code>texture_2d_array</code> or <code>texture_storage_2d_array</code> and sometimes <code>texture_depth_2d_array</code></td></tr>
    <tr><td>"3d"</td><td><code>texture_3d</code> or <code>texture_storage_3d</code></td></tr>
    <tr><td>"cube"</td><td><code>texture_cube</code> and sometimes <code>texture_depth_cube</code></td></tr>
    <tr><td>"cube-array"</td><td><code>texture_cube_array</code> and sometimes <code>texture_depth_cube_array</code></td></tr>
   </tbody>
  </table>
</div>

我们将在实际使用中介绍其中的一些内容，但在创建纹理（调用 `device.createTexture`）时，只有 "1d"、"2d" 或 "3d" 可供选择，而默认值为 "2d"，这可能会让人有些困惑，因此我们还不需要指定尺寸。

## 纹理格式

目前，这只是纹理的基础知识。纹理是一个庞大的话题，还有很多内容需要涉及。

我们在本文中使用的是 `rgba8unorm` 纹理，但其实有很多不同的纹理格式。

这里介绍的是 "颜色" 格式，当然你不一定要在其中存储颜色。

<div class="webgpu_center data-table"><div data-diagram="color-texture-formats"></div></div>

要读取格式，如 "rg16float"，第一个字母表示纹理支持的通道，因此 "rg16float" 支持 "rg" 或红色和绿色（2 个通道）。数字 16 表示每个通道都是 16 位。末尾的单词表示通道中的数据类型。"float" 表示浮点数据。

"unorm" 是无符号归一化数据（0 到 1），表示纹理中的数据从 0 到 N，其中 N 是该位数的最大整数值。该整数范围被解释为（0 至 1）的浮点范围。换句话说，对于 8unorm 纹理来说，就是 8 个比特（因此数值从 0 到 255）被解释为数值从（0 到 1）。

"snorm" 是带符号的归一化数据（-1 至 +1），因此数据范围是从位数所代表的最负整数到最正整数。作为有符号整数，最低位数为 -128，最高位数为 +127。这个范围被转换为（-1 至 +1）。

"sint" 是有符号整数。"uint" 是无符号整数。如果有多个字母数字组合，则指定每个通道的位数。例如，"rg11b10ufloat" 表示 "rg11"，即红色和绿色各 11 位。"b10" 是 10 位蓝色，它们都是无符号浮点数。

-   **renderable**

    True 表示可以对其进行渲染（将其用途设置为 `GPUTextureUsage.RENDER_ATTACHMENT`）

-   **multisample**

    能够被[多重采样](webgpu-multisampling.html)

-   **storage**

    纹理可写作为[storage texture](webgpu-storage-textures.html)

-   **sampler type**

    这关系到在 WGSL 中需要声明哪种类型的纹理，以及如何将采样器绑定到绑定组。上面我们使用了 `texture_2d<f32>`，但例如，在 WGSL 中，`sint` 需要 `texture_2d<i32>`，`uint` 需要 `texture_2d<u32>`。

    在采样器类型一栏中，`unfilterable-float`（不可过滤浮点型）意味着采样器只能使用 `nearest` 的格式，这意味着你可能需要手动创建一个绑定组布局，而这是我们之前一直使用 `'auto'` 布局时没有做过的。这主要是因为桌面 GPU 通常可以过滤 32 位浮点纹理，但至少到 2023 年，大多数移动设备还不能。如果您的适配器支持 `float32-filterable` 功能，并且您在请求设备时启用了该功能，那么 `r32float`、`rg32float` 和 `rgba32float` 格式就会从不可过滤浮点格式转换为浮点格式，这些纹理格式无需其他更改即可正常工作。

<a id="a-depth-stencil-formats"></a>以下是深度和模板格式

<div class="webgpu_center data-table"><div data-diagram="depth-stencil-texture-formats"></div></div>

-   **feature**
    表示使用此格式需要此[可选功能](webgpu-limits-and-features.html)。

-   **copy src**

    是否允许指定 `GPUTextureUsage.COPY_SRC`

-   **copy dst**

    是否允许指定 `GPUTextureUsage.COPY_DST`

我们将在 [3d 系列的一篇文章](webgpu-orthographic-projection.html)中使用深度纹理，以及在有关[阴影贴图的文章](webgpu-shadow-maps.html)中使用深度纹理。

还有许多压缩纹理格式，我们将留待下一篇文章介绍。

接下来我们来介绍[外部纹理的导入](webgpu-importing-textures.html)。

<!-- keep this at the bottom of the article -->
<script type="module" src="/3rdparty/pixel-perfect.js"></script>
<script type="module" src="webgpu-textures.js"></script>
