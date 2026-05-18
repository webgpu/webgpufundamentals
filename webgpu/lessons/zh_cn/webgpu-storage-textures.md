Title: WebGPU 存储纹理(Storage Texture)
Description: 如何使用存储纹理
TOC: 存储纹理

本文是着色器数据传递各种方法系列文章中的一篇。
每一篇都构建于前面的课程基础之上，因此按顺序阅读将有助于您更好地理解。

{{{toc-steps list="passing-data.hanson"}}}

存储纹理本质上就是[纹理](webgpu-textures.html)，只不过你可以直接向其写入或"存储"数据。通常我们在顶点着色器中指定三角形，由 GPU 间接更新纹理，而使用存储纹理则可以直接向纹理的任意位置写入数据。

存储纹理并不是一种特殊的纹理类型，它就是你使用 `createTexture` 创建的普通纹理。只要添加 `STORAGE_BINDING` 用法标志，就可以将纹理作为存储纹理使用，同时保留其他所需的所有用法标志。

从某种意义上说，存储纹理就像一个用作二维数组的存储缓冲区。例如，我们可以创建一个存储缓冲区，并在代码中这样引用它：

```wgsl
@group(0) @binding(0)
  var<storage> buf: array<f32>;

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

而存储纹理则是这样：

```
@group(0) @binding(0)
  var tex: texture_storage_2d<r32float, read_write>;

...

   let pos = vec2u(2, 3);
   let mipLevel = 0;
   var v = textureLoad(tex, pos, mipLevel);
   textureStore(tex, pos, mipLevel, v * 2);

```

既然两者看起来等价，那么手动使用存储缓冲区和存储纹理有什么区别呢？

* 存储纹理仍然是纹理。

  你可以在一个着色器中将其用作存储纹理，而在另一个着色器中将其用作常规纹理（使用采样器和 mipmap 等）。

* 存储纹理具有格式解析能力，而存储缓冲区没有。

  示例：

  ```wsgl
  @group(0) @binding(0) var tex: texture_storage_2d<rgba8unorm, read>;
  @group(0) @binding(1) var buf: array<f32>;

     ...
      let t = textureLoad(tex, pos, 0);
      let b = buffer[pos.y * bufferWidth + pos.x];
  ```

  在上面的代码中，`textureLoad` 加载的是一个 `rgba8unorm` 纹理，这意味着会加载 4 个字节，自动转换为 4 个 0 到 1 之间的浮点数值，并作为 `vec4f` 返回。

  对于缓冲区的情况，4 个字节被加载为单个 `f32` 值。我们可以将缓冲区改为 `array<u32>`，然后加载一个值，并手动将其拆分为 4 个字节值，再转换为浮点数。但是，如果这就是我们想要的，存储纹理可以免费提供这个功能。

* 存储纹理具有维度属性。

  对于缓冲区，唯一的维度是其长度，或者更准确地说，是其绑定的长度[^binding]。上面，当我们将缓冲区用作2维数组时，我们需要宽度从2维坐标转换为1维缓冲区索引。我们要么硬编码 `width` 的值，要么以某种方式传递它[^how-to-pass-data]。而对于纹理，我们可以调用 `textureDimensions` 来获取纹理的尺寸。

  [^binding]: 当你创建绑定组并指定缓冲区时，可以选择指定偏移量和长度。在着色器中，数组的长度是根据绑定的长度计算的，而不是根据缓冲区的长度。如果你没有指定偏移量，默认为 0，长度默认为整个缓冲区的大小。

  [^how-to-pass-data]: 你可以通过[uniform](webgpu-uniforms.html)、另一个[存储缓冲区](webgpu-storage-buffers.html)或甚至作为同一缓冲区中的第一个值来传入缓冲区的宽度。

不过，存储纹理也有一定的限制。

* 只有特定格式可以设置为 `read_write`。

  这些格式是 `r32float`、`r32sint` 和 `r32uint`。

  其他支持的格式在单个着色器内只能设置 `read` 或 `write`。

* 只有特定格式可以用作存储纹理。

  纹理格式有很多种，但只有一部分可以用作存储纹理。

  * `rgba8(unorm/snorm/sint/uint)`
  * `rgba16(float/sint/uint)`
  * `rg32(float/sint/uint)`
  * `rgba32(float/sint/uint)`

  需要注意缺少的一个格式是 `bgra8unorm`，我们将在下文介绍。

* 存储纹理不能使用采样器。

  如果我们将纹理用作普通的 `TEXTURE_BINDING`，则可以调用 `textureSample` 等函数，这些函数会跨 mip 级别加载最多 16 个像素并进行混合。而当我们将纹理用作 `STORAGE_BINDING` 时，只能调用 `textureLoad` 和/或 `textureStore`，每次只能加载和存储单个像素。

## <a id="canvas-as-storage-texture"></a> 将 Canvas 作为存储纹理使用

你可以将 canvas 纹理用作存储纹理。为此，你需要配置上下文以获取可以用作存储纹理的纹理。

```js
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format: presentationFormat,
+    usage: GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.STORAGE_BINDING,
  });
```

需要 `TEXTURE_BINDING` 是为了让浏览器本身能将纹理渲染到页面。`STORAGE_BINDING` 则允许我们将 canvas 的纹理用作存储纹理。如果我们仍然想通过渲染通道将纹理渲染到纹理上（就像本网站上大多数示例一样），还需要添加 `RENDER_ATTACHMENT` 用法。

不过，这里有一个复杂的问题。正如[第一篇文章](webgpu-fundamentals.html)中所介绍的，通常我们会调用 `navigator.gpu.getPreferredCanvasFormat` 来获取首选的 canvas 格式。`getPreferredCanvasFormat` 会根据用户的系统性能返回 `rgba8unorm` 或 `bgra8unorm` 之一。

但是，如上所述，默认情况下，我们不能将 `bgra8unorm` 纹理用作存储纹理。

幸运的是，有一个名为 `'bgra8unorm-storage'` 的[特性](webgpu-limits-and-features.html)。启用该特性后，就可以将 `bgra8unorm` 纹理用作存储纹理。一般来说，在任何报告 `bgra8unorm` 为首选 canvas 格式的平台上，*应该*都能使用该特性，但也有可能不可用。因此，我们需要检查 `'bgra8unorm-storage'` *特性*是否存在。如果存在，我们将要求设备启用该特性，并使用首选 canvas 格式。如果不存在，我们就选择 `rgba8unorm` 作为 canvas 格式。

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

现在我们可以将 canvas 纹理用作存储纹理了。让我们编写一个简单的计算着色器，在纹理中绘制同心圆。

```js
  const module = device.createShaderModule({
    label: 'circles in storage texture',
    code: /* wgsl */ `
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

注意我们将存储纹理标记为 `write`，并且必须在着色器中指定具体的纹理格式。与 `TEXTURE_BINDING` 不同，`STORAGE_BINDING` 需要知道纹理的确切格式。

设置方式与[第一篇文章中编写的计算着色器](webgpu-fundamentals.html#a-run-computations-on-the-gpu)类似。创建着色器模块后，我们设置一个计算管线来使用它。

```js
  const pipeline = device.createComputePipeline({
    label: 'circles in storage texture',
    layout: 'auto',
    compute: {
      module,
    },
  });
```

要渲染，我们获取 canvas 的当前纹理，创建一个绑定组以便将纹理传递给着色器，然后执行设置管线、绑定绑定组和分发工作组这些常规操作。

```js
  function render() {
    const texture = context.getCurrentTexture();

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture },
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

效果如下：

{{{example url="../webgpu-storage-texture-canvas.html"}}}

使用常规纹理不会改变任何东西，除非我们调用 `createTexture` 而不是 `getCurrentTexture` 来制作纹理，并将其与我们需要的任何其他使用标志一起传递给 `STORAGE_BINDING`。

## 速度和竞态条件

上面我们对每个像素分发了一个工作组。这是非常浪费的，GPU 可以运行得更快。将着色器优化为最佳工作量会使得示例变得复杂。重点是演示如何使用存储纹理，而不是展示最快的着色器。你可以在[计算图像直方图的文章](webgpu-compute-shaders-histogram.html)中阅读一些优化计算着色器的方法。

同样，由于你可以在存储纹理中的任意位置写入，你需要意识到[其他关于计算着色器的文章](webgpu-compute-shaders.html)中提到的竞态条件。调用运行的顺序是无法保证的。需要由你来避免竞态条件和/或插入 `textureBarriers` 或其他机制来确保两个或多个调用不会互相干扰。

## 示例

[compute.toys](https://compute.toys) 是一个包含大量直接写入存储纹理的示例的网站。**警告**：虽然[compute.toys](https://compute.toys) 上的示例有很多值得学习的地方，但它们不一定是最优实践。Compute toys 的目的是仅用计算着色器制作有趣的东西。用仅计算着色器来发挥创意是一件有趣的难题，但请注意，其他方法*可能*快 10 倍、100 倍甚至 1000 倍。
