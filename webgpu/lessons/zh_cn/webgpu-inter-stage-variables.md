Title: WebGPU Inter-stage 变量
Description: 从顶点着色器传递数据到片段着色器
TOC: Inter-stage 变量

在[上一篇文章](webgpu-fundamentals.html)中，我们介绍了有关 WebGPU 的一些基础知识。在本文中，我们将介绍 Inter-stage 变量的基础知识。

Inter-stage 变量在顶点着色器和片段着色器之间发挥作用。

当顶点着色器输出 3 个位置时，一个三角形就会被光栅化。顶点着色器可以在每个位置输出额外的值，默认情况下，这些值将在 3 个点之间进行插值。

让我们举一个小例子。我们从上一篇文章中的三角形着色器开始。我们要做的就是更改着色器。

```js
  const module = device.createShaderModule({
-    label: 'our hardcoded red triangle shaders',
+    label: 'our hardcoded rgb triangle shaders',
    code: `
+      struct OurVertexShaderOutput {
+        @builtin(position) position: vec4f,
+        @location(0) color: vec4f,
+      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
+        var color = array<vec4f, 3>(
+          vec4f(1, 0, 0, 1), // red
+          vec4f(0, 1, 0, 1), // green
+          vec4f(0, 0, 1, 1), // blue
+        );

-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
      }

-      @fragment fn fs() -> @location(0) vec4f {
-        return vec4f(1, 0, 0, 1);
+      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+        return fsInput.color;
      }
    `,
  });
```

首先，我们声明一个结构体`struct`。这是在顶点着色器和片段着色器之间增加 Inter-stage 变量的一种简便方法。

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

然后，我们声明顶点着色器将返回该类型的结构体

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

我们创建一个有 3 种颜色的数组。

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // red
          vec4f(0, 1, 0, 1), // green
          vec4f(0, 0, 1, 1), // blue
        );
```

然后，我们不再只返回一个表示位置的 `vec4f`，而是声明一个结构体的实例，填充并返回它。

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

在片段着色器中，我们声明将其中一个结构体作为函数的参数

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

并且返回结构体中的颜色

如果我们运行它，就会发现每次 GPU 调用片段着色器时，都会传入一个在所有 3 个点之间插值的颜色。

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

Inter-stage 变量最常用于在三角形内进行纹理坐标插值，我们将在[有关纹理的文章](webgpu-textures.html)中介绍这一点。另一个常用的方法是在三角形内对法线进行插值，这将在[第一篇关于光照的文章](webgpu-lighting-directional.html)中介绍。

## Inter-stage 变量通过 `location` 连接

重要的一点是，与 WebGPU 中的几乎所有功能一样，顶点着色器和片段着色器之间是通过索引连接的。对于 Inter-stage 变量，它们也是通过 location 索引进行连接。

为了理解我的意思，让我们只更改片段着色器，在 `location(0)` 处获取 `vec4f` 参数，而不是通过 struct 获取参数。

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

运行后，我们发现它仍然起作用。

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## `@builtin(position)`

这有助于指出另一个怪异之处。我们最初的着色器在顶点着色器和片段着色器中使用了相同的结构体，其中有一个名为 `position` 的字段，但它并没有 location。相反，它被声明为 `@builtin(position)`。

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

该字段**不是** Inter-stage 变量。相反，它是一个内置变量(`builtin`)。@builtin(position) 在顶点着色器和片段着色器中的意义是不同的。

在顶点着色器中，`@builtin(position)` 是 GPU 绘制三角形/线/点所需的输出。

在片段着色器中，`@builtin(position)` 是一个输入。它是片段着色器当前被要求计算颜色的像素坐标。

像素坐标由像素边缘指定。而提供给片段着色器的值则是像素的中心坐标。

如果我们要绘制的纹理大小为 3x2 像素，下图中的黑点表示的则是片段着色器中的坐标。

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

我们可以更改着色器来使用这个位置。例如，让我们画一个棋盘格。

```js
const module = device.createShaderModule({
    label: 'our hardcoded checkerboard triangle shaders',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
-        @location(0) color: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
-        var color = array<vec4f, 3>(
-          vec4f(1, 0, 0, 1), // red
-          vec4f(0, 1, 0, 1), // green
-          vec4f(0, 0, 1, 1), // blue
-        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-        return fsInput.color;
+        let red = vec4f(1, 0, 0, 1);
+        let cyan = vec4f(0, 1, 1, 1);
+
+        let grid = vec2u(fsInput.position.xy) / 8;
+        let checker = (grid.x + grid.y) % 2 == 1;
+
+        return select(red, cyan, checker);
      }
    `,
});
```

上面的代码使用了声明为 `@builtin(position)`的变量 `fsInput.position` ，并将其 `xy` 坐标转换为 `vec2u`类型，即 2 维无符号整数。然后将其除以 8，得出每 8 个像素增加一个计数。然后将 x 和 y 网格坐标相加，计算除以 2 的余数，并将结果与 1 比较。最后，它使用 WGSL 函数 `select`，在给定 2 个值的情况下，根据布尔条件选择其中一个。在 JavaScript 中，`select` 的写法如下

```js
// If condition is false return `a`, otherwise return `b`
select = (a, b, condition) => (condition ? b : a);
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

即使在片段着色器中不使用 `@builtin(position)`，它在此处也同样很方便，因为这意味着我们可以在顶点着色器和片段着色器中使用相同的结构。重要的是，顶点着色器中的 `position` 字段与片段着色器中的 `position` 字段完全无关。它们是完全不同的变量。

但如上所述，对于 Inter-stage 变量来说，重要的是 `@location(?)`。因此，为顶点着色器的输出和片段着色器的输入声明不同的结构并不罕见。

为了能让大家更清楚地了解这一点，在我们的示例中为了方便起见，顶点着色器和片段着色器在同一个字符串中。我们也可以将它们分成不同的模块

```js
-  const module = device.createShaderModule({
-    label: 'hardcoded checkerboard triangle shaders',
+  const vsModule = device.createShaderModule({
+    label: 'hardcoded triangle',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        return vsOutput;
      }
+    `,
+  });
+
+  const fsModule = device.createShaderModule({
+    label: 'checkerboard',
+    code: `
-      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+      @fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);

-        let grid = vec2u(fsInput.position.xy) / 8;
+        let grid = vec2u(pixelPosition.xy) / 8;
        let checker = (grid.x + grid.y) % 2 == 1;

        return select(red, cyan, checker);
      }
    `,
  });
```

同样的，我们必须使用下面的代码更新我们创建管道时的配置

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
      entryPoint: 'vs',
    },
    fragment: {
-      module,
+      module: fsModule,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });

```

修改代码后，这同样能够运行

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

关键在于，在大多数 WebGPU 示例中，两个着色器都在同一个字符串中只是为了方便。实际上，WebGPU 首先会解析 WGSL，确保其语法正确。然后，WebGPU 会查看您指定的 `entryPoint`。然后，WebGPU 会查看该入口点所引用的部分，而不会查看该入口点的其他部分。这很有用，因为如果两个或多个着色器共享绑定、结构、常量或函数，就不必重复键入结构、绑定和分组位置等内容。但是，从 WebGPU 的角度来看，这就好像你一次性为每个入口点都复制了一次所有的内容。

注：使用 `@builtin(position)` 生成棋盘格并不常见。[使用纹理](webgpu-textures.html).生成棋盘格或其他图案更为常见。事实上，如果您调整窗口大小，就会发现一个问题。因为棋盘格是基于画布的像素坐标生成的，它是相对于画布的，而不是相对于三角形的。

## <a id="a-interpolate"></a>插值设置

我们在上文看到，Inter-stage 变量从顶点着色器的输出在传递给片段着色器时会进行插值。对于如何进行插值，有两组设置可以更改。将它们设置为默认值以外的值并不常见，但在其他文章中会介绍一些用例。

插值类型:

-   `perspective`: 以正确的透视方式插值 (**默认**)
-   `linear`: 以线性、非透视正确的方式内插数值。
-   `flat`: 不对数值进行插值。使用 flat 插值时不使用插值采样。

插值采样:

-   `center`: 插值在像素中心进行 (**默认**)
-   `centroid`: 插值是在当前基元中片段所覆盖的所有样本内的某一点上进行的。该值对基元中的所有样本都是相同的。
-   `sample`: 每次采样时执行插值。应用此属性时，每次采样都会调用一次片段着色器.

您可以将其指定为属性。例如：

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

请注意，如果 Inter-stage 变量是整数类型，则必须将其插值设置为`flat`。

如果将插值类型设置为`flat`，那么传递给片段着色器的值就是该三角形中第一个顶点的 Inter-stage 变量值。

[在下一篇文章中，我们将介绍 uniforms](webgpu-uniforms.html)，它是一种向着色器传递数据的另一种方法。
