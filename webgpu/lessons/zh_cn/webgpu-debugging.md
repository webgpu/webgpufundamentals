Title: WebGPU 调试与错误
Description: WebGPU 调试技巧
TOC: 调试与错误

一些 WebGPU 调试和处理错误的技巧。

## 保持打开 JavaScript 控制台以查看 WebGPU 错误

大多数浏览器都有 JavaScript 控制台。保持它打开。WebGPU 通常会在那里打印错误。

## 考虑记录未捕获的错误

你可以设置一个事件来捕获未捕获的 WebGPU 错误，然后自己记录它们。例如：

```js
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', event => alert(event.error.message));
```

就个人而言，我通常不使用 `alert`，但你可以记录消息、将其放入元素中，或以某种方式使其可见。我发现这很有用，因为我经常忘记上面的建议，即打开 JavaScript 控制台，然后我就看不到错误了。😅

WebGPU 自身发出的错误会进入 JavaScript 控制台，但你捕获的错误会去你告诉它们去的地方。

## 帮助 WebGPU 报告错误

WebGPU 中的错误是异步报告的。这是为了保持 WebGPU 的快速和高效。但是，这意味着有时你可能不会在预期的时间或根本不会得到错误，除非你帮助 WebGPU。

下面是一些使用上面建议的代码，添加了一个事件来显示未捕获的错误。然后它编译了一个应该得到错误的着色器模块。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
    log(event.error.message);
  });

  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });

  log('--done--');
}
```

在下面的实况示例中，至少在 Chrome 129 中，你可能不会得到错误。

{{{example url="../webgpu-debugging-help-webgpu-report-errors.html"}}}

原因是在这种情况下，Chrome 在 WebGPU 中不会处理某些错误，直到你调用某些函数为止。其中一个这样的函数是 `submit`

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
    log(event.error.message);
  });

  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });

+  // pump WebGPU
+  device.queue.submit([]);

  log('--done--');
}
```

现在它应该显示错误。

{{{example url="../webgpu-debugging-help-webgpu-report-errors-fixed.html"}}}

这个问题很少出现，因为如果你从不调用 `submit`，那么你实际上还没有在使用 WebGPU。但是，它可能会在特殊情况下出现，比如当你试图制作一个最小完整可验证示例以获取技术支持问题或错误报告时。或者当你在代码中单步执行时，你经过了一行你知道应该会导致错误的代码，但还没有出现错误。

注意：如果你不希望错误也进入 JavaScript 控制台，你可以调用 `event.preventDefault()`

## 手动捕获错误。

上面我们展示了"未捕获错误"的消息，这意味着有"捕获错误"这样的东西。要捕获错误，有一对函数。`device.pushErrorScope` 和 `device.popErrorScope`。

你推送一个错误范围。提交命令，然后弹出错误范围，查看在推送和弹出之间是否有任何错误。

示例：

```js
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
*    log('uncaptured error:', event.error.message);
  });

+  device.pushErrorScope('validation');
  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });
+  const error = await device.popErrorScope();
+  if (error) {
+    log('captured error:', error.message);
+  }

+  device.createShaderModule({
+    code: /* wgsl */ `
+      also, this shader won't compile
+    `,
+  });

  device.queue.submit([]);

  log('--done--');
```

`device.pushErrorScope` 接受以下三个过滤器之一。

* `'validation'`

  与不正确使用 API 相关的错误

* `'out-of-memory'`

  与尝试分配过多内存相关的错误。

* `'internal'`

  你没有做错什么但驱动程序报错的错误。
  例如，如果你的着色器太复杂，可能会发生这种情况。

{{{example url="../webgpu-debugging-push-pop-error-scope.html"}}}

`popErrorScope` 返回一个带有错误或 null 的 promise（如果没有错误）。上面我们使用 `await` 来等待 promise，但这会停止我们的程序。更常见的是使用 `then`，如下所示：

```js
  device.pushErrorScope('validation');
  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });
+  device.popErrorScope().then(error => {
+    if (error) {
+      log('captured error:', error.message);
+    }
+  });
```

这样我们的程序就不会暂停并等待 GPU 告诉我们是否有错误。

## 不同种类的错误

WebGPU 中的一些错误在你调用函数时被检查。其他的则稍后被检查。WebGPU 指定了时间线。其中两个是"内容时间线"和"设备时间线"。"内容时间线"与 JavaScript 本身是同一个时间线。设备时间线是分开的，通常运行在单独的进程中。还有一些错误是由 JavaScript 本身的规则检查的。

* JavaScript 错误的例子：传递错误的类型

  ```js
  device.queue.writeBuffer(someTexture, ...);
  ```

  上面的代码会立即出错，因为 `writeBuffer` 的第一个参数必须是 `GPUBuffer`，这是由 JavaScript 本身强制执行的。

* "内容时间线"错误的例子

  ```js
  device.createTexture({
    size: [],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  ```

  上面提供的 `size` 是一个错误，它必须至少有 1 个元素。

* 设备错误的例子

  页面开头的示例是设备错误。设备错误由 `pushErrorScope`、`popErrorScope` 和未捕获错误事件处理。

错误发生的位置在[规范](https://www.w3.org/TR/webgpu/)中有详细说明，但重要的是要知道 JavaScript 错误和内容时间线错误会立即发生并抛出异常，而设备时间线错误是异步的。

## WGSL 错误

如果你在编译着色器模块时遇到错误，你可以通过调用 `getCompilationInfo` 来请求更详细的信息。

示例：

```js
  device.pushErrorScope('validation');
  const code = `
      // This function
      // calls a function
      // that does not
      // exist.

      fn foo() -> vec3f {
        return someFunction(1, 2);
      }
    `;
  const module = device.createShaderModule({ code });
  device.popErrorScope().then(async error => {
    if (error) {
      const info = await module.getCompilationInfo();

      // Split the code into lines
      const lines = code.split('\n');

      // Sort the messages by line numbers in reverse order
      // so that as we insert the messages they won't affect
      // the line numbers.
      const msgs = [...info.messages].sort((a, b) => b.lineNum - a.lineNum);

      // Insert the error messages between lines
      for (const msg of msgs) {
        lines.splice(msg.lineNum, 0,
          `${''.padEnd(msg.linePos - 1)}${''.padEnd(msg.length, '^')}`,
          msg.message,
        );
      }

      log(lines.join('\n'));
    }
  });
```

上面的代码有效地将任何错误消息交错插入到完整的着色器代码中。

{{{example url="../webgpu-debugging-get-compilation-info.html"}}}

`getCompilationInfo` 返回一个包含 `GPUCompilationMessage` 数组的对象，每个对象具有以下字段

* `message`: 字符串错误消息
* `type`: `'error'` 或 `'warning'` 或 `'info'`
* `lineNum`: 错误所在的行号，从 1 开始
* `linePos`: 错误在行中的位置，从 1 开始
* `offset`: 错误在字符串中的位置，从 0 开始。
  （这与 linePos、lineNum 本质上是相同的信息）
* `length`: 要高亮的长度

## WebGPU-Dev-Extension

[WebGPU-Dev-Extension](https://github.com/greggman/webgpu-dev-extension) 提供了帮助调试的功能。

它的一些功能

* 显示错误发生的位置堆栈跟踪。

  如上所述，WebGPU 中的错误是异步发生的。在第一个示例中，我们使用 `uncapturederror` 事件来查看我们得到了一个 WebGPU 错误，但没有关于错误发生在 JavaScript 中哪里的信息。

  webgpu-dev-extension 通过尝试在所有生成错误的 WebGPU 函数周围添加 `pushErrorScope` 和 `popErrorScope` 调用来提供此信息。在其中，它创建一个 `Error` 对象，该对象保存堆栈跟踪。如果它收到错误，它可以打印该 `Error` 对象，你将看到原始错误生成位置的错误堆栈。

* 显示命令编码器的错误

  在 WebGPU 中，命令编码器，如 `GPUCommandEncoder`、`GPURenderPassEncoder`、
  `GPUComputePassEncoder` 和 `GPURenderBundleEncoder` 不
  生成设备时间线错误。相反，错误
  被保存直到你调用 `encoder.finish`

  例如：

  ```js
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass(renderPassDesc);
  pass.setPipeline(somePipeline);
  pass.setBindGroup(0, someBindGroupIncompatibleWithSomePipeline); // 哎呀！
  pass.setVertexBuffer(0, positionBuffer);
  pass.setVertexBuffer(1, normalBuffer);
  pass.setIndexBuffer(indexBuffer, 'uint16');
  pass.drawIndexed(4);
  pass.end();
  const cb = encoder.finish();  // 上面的错误在这里生成
  ```

  这里的问题是，充其量你会得到一条错误消息，指出绑定到组 0 的绑定组与管道不兼容，但你不知道错误发生在哪一行。在一个小例子中，这应该相当明显，但在一个大型应用程序中，可能很难追踪导致错误的具体行。

  webgpu-dev-extension 可以尝试在导致错误的那一行抛出错误。

* 显示与完整着色器源代码交错的 WGSL 错误

  与上面的示例一样，webgpu-dev-extension 有一个选项可以显示与源 WGSL 交错的错误，而不仅仅是一个简洁的错误消息。（默认情况下）

## WebGPU-Inspector

[WebGPU-Inspector](https://github.com/brendan-duncan/webgpu_inspector)
将尝试捕获你所有的 WebGPU 命令，并可以让你检查缓冲区、纹理、调用，并通常尝试查看你的 WebGPU 代码中发生了什么。

<div class="webgpu_center"><img src="resources/images/frame_capture_commands.jpg"style="width: 1200px;"></div>

## 调试着色器的技巧

### 简化：

通过尽可能多地削减内容来使你的着色器达到工作状态。一旦它工作了，一点一点地添加回来。

### 显示纯色

对于渲染通道，我经常做的第一件事是显示纯色。

这是来自[聚光灯文章](webgpu-lighitng-spot.html)的最后一个着色器。

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // 因为 vsOut.normal 是一个阶段间变量
  // 它被插值，因此它不会是一个单位向量。
  // 归一化它会使它再次成为一个单位向量
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);

  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
  let inLight = smoothstep(uni.outerLimit, uni.innerLimit, dotFromDirection);

  // 通过将法线与光线方向的点积来计算光照
  let light = inLight * dot(normal, surfaceToLightDirection);

  var specular = dot(normal, halfVector);
  specular = inLight * select(
      0.0,                           // 条件为假时的值
      pow(specular, uni.shininess),  // 条件为真时的值
      specular > 0.0);               // 条件

  // 仅将颜色部分（而非 alpha）乘以光照
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

这个示例应该用一个绿色的小 F 来渲染，其中一小部分被聚光灯照亮。这是一个有 bug 的版本。让我们来调试它。

{{{example url="../webgpu-debugging-spot-light-01.html"}}}

我们运行了它，屏幕上什么也没有出现，也没有 WebGPU 错误。我可能做的第一件事是将其更改为返回纯红色

```wgsl
  let color = uni.color.rgb * light + specular;
-  return vec4f(color, uni.color.a);
+  //return vec4f(color, uni.color.a);
+  return vec4f(1, 0, 0, 1);  // 纯红色
```

如果我看到一个红色的 F，那么我就知道应该开始查看片段着色器，因为显然顶点着色器足够正确，能够绘制构成 F 的三角形。如果我没有看到红色的 F，那么我应该开始查看顶点着色器。

尝试一下：

{{{example url="../webgpu-debugging-spot-light-02.html"}}}

我们看到一个红色的 F。好的，让我们尝试可视化法线。为此，将片段着色器的末尾更改为：

```wgsl
  let color = uni.color.rgb * light + specular;
  //return vec4f(color, uni.color.a);
-   return vec4f(1, 0, 0, 1);  // 纯红色
+   //return vec4f(1, 0, 0, 1);  // 纯红色
+   return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 法线
```

法线从 -1.0 到 +1.0，但颜色从 0.0 到 1.0，因此将法线乘以 0.5 并加上 0.5 可以将法线转换为可以用颜色可视化的东西。

试试这个：

{{{example url="../webgpu-debugging-spot-light-03.html"}}}

嗯，这不对。这看起来可疑地像所有法线都是 0,0,0。片段着色器中的法线显然有问题。这些法线来自顶点着色器，经过 `normalMatrix` 乘法。让我们尝试将法线直接传递，而不乘以 `normalMatrix`。如果 F 出现，我们就知道 bug 在 `normalMatrix` 中。如果 F 没有出现，那么 bug 在于提供给顶点着色器的数据。

```wgsl
  // Orient the normals and pass to the fragment shader
-  vsOut.normal = uni.normalMatrix * vert.normal;
+  //vsOut.normal = uni.normalMatrix * vert.normal;
+  vsOut.normal = vert.normal;
```

运行它：

{{{example url="../webgpu-debugging-spot-light-04.html"}}}

这看起来更像样了。所以显然 `normalMatrix` 有问题

检查代码，它被注释掉了，这使矩阵全为零。
一定是有人检查了什么并忘记取消注释它了。😅

```js
    // Inverse and transpose it into the worldInverseTranspose value
-    //mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

让我们取消注释它。然后让我们把顶点着色器恢复原样

```wgsl
  // Orient the normals and pass to the fragment shader
-  //vsOut.normal = uni.normalMatrix * vert.normal;
-  vsOut.normal = vert.normal;
+  vsOut.normal = uni.normalMatrix * vert.normal;
```

这给了我们：

{{{example url="../webgpu-debugging-spot-light-05.html"}}}

如果你旋转 F，你会看到颜色发生变化，表明法线正在被 `normalMatrix` 重新定向。与上面的例子相比，当我们旋转时颜色不会改变。

有了这些，我们终于可以恢复片段着色器了。

```wgsl
  let color = uni.color.rgb * light + specular;
-  //return vec4f(color, uni.color.a);
-  //return vec4f(1, 0, 0, 1);  // 纯红色
-  return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 法线
+  return vec4f(color, uni.color.a);
```

它现在正常工作了。

{{{example url="../webgpu-debugging-spot-light-06.html"}}}

找到可视化数据的方法是一个检查数据的好方法。例如，要检查[纹理坐标](webpgu-textures.html)，你可能这样做

```wgsl
   return vec4f(fract(textureCoord), 0, 1);
```

纹理坐标通常从 0.0 到 1.0，但如果你正在重复纹理，它们可能会更高，所以 `fract` 可以覆盖这种情况。

为了让你对纹理坐标的样子有个概念，这里有一些对象，它们的纹理坐标被可视化了。

<div class="webgpu_center">
   <div data-diagram="texcoords" style="width: 1024px; height: 400px;"></div>
   <div class="caption">可视化的纹理坐标</div>
</div>

纹理坐标通常在一些表面上平滑。

以下是相同的纹理坐标，但带有 bug。

<div class="webgpu_center">
   <div data-diagram="texcoords-bad"  style="width: 1024px; height: 400px;"></div>
   <div class="caption">错误的纹理坐标</div>
</div>

它们不再平滑，所以可能有问题。

按照上面的相同步骤，我们会得出结论，进入顶点着色器的数据一定是坏的。确实，这个示例将顶点数据上传为 `float32x3` 值，但错误地在渲染管线描述符中将它们指定为 `float16x2`。

<!-- keep this at the bottom of the article -->
<link href="webgpu-debugging.css" rel="stylesheet">
<script type="module" src="webgpu-debugging.js"></script>
