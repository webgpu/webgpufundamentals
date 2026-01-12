Title: WebGPU 平移
Description: 移动一个物体
TOC: 平移(Translation)


<!-- 基于2024年5月27日 -->
<!-- e4e2249b12b65aa20891d64bdedeeac60070d0fe -->

本文假设你已经阅读了[基础概念](webgpu-fundamentals.html)，[统一变量(Uniforms)](webgpu-uniforms.html)以及[顶点缓冲区](webgpu-vertex-buffers.html)的相关文章。若尚未阅读，建议你先阅读这些内容后再返回继续。

本文是系列文章中的第一篇，旨在帮助你学习 3D 数学知识。每篇文章都建立在前文基础之上，因此按顺序阅读可能更易于理解。

1. [平移](webgpu-translation.html) ⬅ 你在此处
2. [旋转](webgpu-rotation.html)
3. [缩放](webgpu-scale.html)
4. [矩阵运算](webgpu-matrix-math.html)
5. [正交投影](webgpu-orthographic-projection.html)
6. [透视投影](webgpu-perspective-projection.html)
7. [相机](webgpu-cameras.html)
8. [矩阵堆栈](webgpu-matrix-stacks.html)
9. [场景图](webgpu-scene-graphs.html)

我们将从类似于[顶点缓冲区文章](webgpu-vertex-buffers.html)中的示例代码开始，但不再绘制多个圆形，而是改为绘制单个字母 F，并通过[索引缓冲区](webgpu-vertex-buffers.html#a-index-buffers)来减少数据量。

让我们在像素空间而非裁剪空间中进行操作，就像[Canvas 2D API](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D)那样。我们将构建一个由 6 个三角形组成的字母 F，具体结构如下所示

<div class="webgpu_center"><img src="resources/f-polygons.svg" style="width: 600px;"></div>

以下是字母 F 的构造数据：

```js
function createFVertices() {
  const vertexData = new Float32Array([
    // left column
    0, 0,
    30, 0,
    0, 150,
    30, 150,

    // top rung
    30, 0,
    100, 0,
    30, 30,
    100, 30,

    // middle rung
    30, 60,
    70, 60,
    30, 90,
    70, 90,
  ]);

  const indexData = new Uint32Array([
    0,  1,  2,    2,  1,  3,  // left column
    4,  5,  6,    6,  5,  7,  // top run
    8,  9, 10,   10,  9, 11,  // middle run
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

上述顶点数据处于像素空间，因此我们需要将其转换到裁剪空间。这可以通过将分辨率传入着色器并进行数学运算来实现。以下是逐步详细说明。


```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  
  let position = vert.position;

  // convert the position from pixels to a 0.0 to 1.0 value
  let zeroToOne = position / uni.resolution;

  // convert from 0 <-> 1 to 0 <-> 2
  let zeroToTwo = zeroToOne * 2.0;

  // covert from 0 <-> 2 to -1 <-> +1 (clip space)
  let flippedClipSpace = zeroToTwo - 1.0;

  // flip Y
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

可以看到，我们获取顶点位置并将其除以分辨率。这样就能在画布上得到 0 到 1 范围内的值。接着乘以 2，使数值范围变为 0 到 2。再减去 1 后，数值就进入了裁剪空间，但此时是翻转的——因为裁剪空间是 Y 轴向上为正，而 Canvas 2D 是 Y 轴向下为正。因此我们将 Y 乘以-1 进行翻转。现在得到了所需的裁剪空间值，即可从着色器输出。

我们仅有一个属性，因此管线配置如下所示：

```js
  const pipeline = device.createRenderPipeline({
    label: 'just 2d position',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
*          arrayStride: (2) * 4, // (2) floats, 4 bytes each
*          attributes: [
*            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
*          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

我们需要为统一变量(Uniforms)设置一个缓冲区：

```js
  // color, resolution, padding
*  const uniformBufferSize = (4 + 2) * 4 + 8;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
*  const kColorOffset = 0;
*  const kResolutionOffset = 4;
*
*  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
*  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
*
*  // The color will not change so let's set it once at init time
*  colorValue.set([Math.random(), Math.random(), Math.random(), 1]);
```

在渲染时我们需要设置分辨率：

```js
  function render() {
    ...

    // Set the uniform values in our JavaScript side Float32Array
    resolutionValue.set([canvas.width, canvas.height]);

    // upload the uniform values to the uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

在运行之前，让我们将画布背景设置为网格纸样式。我们将调整其缩放比例，使网格纸的每个单元格为 10x10 像素，并每隔 100x100 像素绘制一条加粗的线条。

```css
:root {
  --bg-color: #fff;
  --line-color-1: #AAA;
  --line-color-2: #DDD;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #000;
    --line-color-1: #666;
    --line-color-2: #333;
  }
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
  background-color: var(--bg-color);
  background-image: linear-gradient(var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(90deg, var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(var(--line-color-2) 1px, transparent 1px),
      linear-gradient(90deg, var(--line-color-2) 1px, transparent 1px);
  background-position: -1.5px -1.5px, -1.5px -1.5px, -1px -1px, -1px -1px;
  background-size: 100px 100px, 100px 100px, 10px 10px, 10px 10px;  
}
```

上述 CSS 代码应能同时处理浅色和深色模式的情况。

截至目前，我们所有的示例都使用了不透明的画布。若需实现透明效果以显示刚设置的背景，我们需要进行几项调整。

首先，在配置画布时我们需要将`alphaMode`设置为`'premultiplied'`，其默认值为`'opaque'`。

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });
```

接着我们需要在[`GPURenderPassDescriptor`](https://www.w3.org/TR/webgpu/#dictdef-gpurenderpassdescriptor)中将画布清除为 0, 0, 0, 0。由于默认的`clearValue`已经是 0, 0, 0, 0，只需删除之前设置其他值的代码行即可。

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
-        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
```

至此，我们的字母 F 绘制完成：

{{{example url="../webgpu-translation-prep.html"}}}

请注意字母 F 相对于背后网格的尺寸比例。F 的顶点数据构建出的图形宽 100 像素、高 150 像素，这与实际显示效果一致。F 从坐标原点(0,0)开始，向右延伸至(100,0)，向下延伸至(0,150)。

现在基础设置已完成，让我们开始添加 _`平移(translation)`_ 功能。

平移本质上就是移动物体的过程，我们只需将平移量添加到统一变量(Uniforms)中，再将其与位置坐标相加即可实现。

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
+  translation: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  
+  // Add in the translation
-  let position = vert.position;
+  let position = vert.position + uni.translation;

  // convert the position from pixels to a 0.0 to 1.0 value
  let zeroToOne = position / uni.resolution;

  // convert from 0 <-> 1 to 0 <-> 2
  let zeroToTwo = zeroToOne * 2.0;

  // covert from 0 <-> 2 to -1 <-> +1 (clip space)
  let flippedClipSpace = zeroToTwo - 1.0;

  // flip Y
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

我们需要为统一缓冲区增加空间：

```js
-  // color, resolution, padding
-  const uniformBufferSize = (4 + 2) * 4 + 8;
+  // color, resolution, translation
+  const uniformBufferSize = (4 + 2 + 2) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
  const kColorOffset = 0;
  const kResolutionOffset = 4;
+  const kTranslationOffset = 6;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
+  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
```

接着我们需要在渲染时设置平移量：

```js
+  const settings = {
+    translation: [0, 0],
+  };

  function render() {
    ...

    // Set the uniform values in our JavaScript side Float32Array
    resolutionValue.set([canvas.width, canvas.height]);
+    translationValue.set(settings.translation);

    // upload the uniform values to the uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

最后让我们添加一个用户界面，以便调整平移参数：

```js
+import GUI from '../3rdparty/muigui-0.x.module.js';

...
  const settings = {
    translation: [0, 0],
  };

+  const gui = new GUI();
+  gui.onChange(render);
+  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
+  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
```

现在我们已经成功添加了平移功能：

{{{example url="../webgpu-translation.html"}}}

请注意它与我们的像素网格完全对应。若将平移量设置为(200,300)，字母 F 的左上角顶点(0,0)就会被绘制在(200,300)的位置。

这篇文章可能看起来过于简单。实际上我们在之前的多个示例中已经使用了 _`平移(translation)`_ 功能（尽管当时命名为“偏移量(offset)”）。本文是系列教程的一部分，虽然内容基础，但随着系列内容的推进，其核心概念将在上下文中逐渐显现意义。

接下来我们将探讨[旋转](webgpu-rotation.html)。
