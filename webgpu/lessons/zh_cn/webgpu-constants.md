Title: WebGPU着色器常量
Description: WebGPU的基础
TOC: 常量

我不确定这个主题是否值得被视为着色器的一种输入。但从某种角度来看，它确实算是，所以我们还是来探讨一下。

常量，或者更正式地称为*管线可覆盖常量 (pipeline-overridable constants)*，是一种你在着色器中声明，但在使用该着色器创建管线时可以更改其值的常量。

一个简单的例子如下：

```wgsl
override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

将此片元着色器（fragment shader）与[基础文章](webgpu-fundamentals.html)中的顶点着色器（vertex shader）结合使用。

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // 顶部中心
    vec2f(-0.5, -0.5),  // 左下
    vec2f( 0.5, -0.5)   // 右下
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
```

如果我们直接使用这个着色器，会得到一个黑色的三角形。

{{{example url="../webgpu-constants.html"}}}

但是，我们可以在指定管线（pipeline）时更改这些常量，或者说“覆盖（override）”它们。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
+      constants: {
+        red: 1,
+        green: 0.5,
+        blue: 1,
+      },
    },
  });
```

现在我们得到了一个有点粉的颜色。

{{{example url="../webgpu-constants-override.html"}}}

管线可覆盖常量只能是标量值，即布尔值（true/false）、整数、浮点数。它们不能是向量或矩阵。

如果你没有在着色器中指定常量的值，那么你**必须**在管线中提供一个。你还可以为它们分配一个数字 ID，然后通过 ID 来引用它们。

例如:

```wgsl
override red: f32;             // 必须在管线中指定
@id(123) override green = 0.0; // 可以通过 'green' 或 123 来指定
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

你可能会问，这样做有什么意义？我在创建 WGSL 时也能轻而易举地做到这一点。例如：

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
const red = ${red};
const green = ${green};
const blue = ${blue};

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
`;
```

或者更直接一点：

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(${red}, ${green}, ${blue}, 1.0);
}
`;
```

区别在于，管线可覆盖常量可以在着色器模块创建**之后**再应用，从技术上讲，这比重新创建一个新的着色器模块要快。不过，创建管线本身并不是一个快速的操作，所以目前还不清楚在创建管线的整个过程中，这种方式到底能节省多少时间。但有一种可能性是，WebGPU 的实现可以利用你第一次使用特定常量创建管线时产生的信息，以便下次你使用不同常量创建管线时，能够大幅减少所需工作量。

无论如何，这是向着色器传入少量数据的一种方法。

## 入口点是独立评估的


同样重要的一点是，请记住入口点是孤立评估的，正如在关于[阶段间变量](webgpu-inter-stage-variables.html#a-builtin-position)的文章中部分讨论过的那样。

这就好比传递给 `createShaderModule` 的代码中，所有与当前入口点无关的内容都被剔除了。管线覆盖常量会被先应用，然后才会创建该入口点的着色器。

让我们扩展一下上面的示例。我们将修改着色器，使顶点阶段（vertex stage）和片元阶段（fragment stage）都使用这些常量。我们将把顶点阶段的值传递给片元阶段，然后每隔 50 像素宽的垂直条纹交替使用不同的值进行绘制。

```wgsl
+struct VOut {
+  @builtin(position) pos: vec4f,
+  @location(0) color: vec4f,
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
-) -> @builtin(position) vec4f {
+) -> VOut {
  let pos = array(
    vec2f( 0.0,  0.5),  // 顶部中心
    vec2f(-0.5, -0.5),  // 左下
    vec2f( 0.5, -0.5)   // 右下
  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return VOut(
+    vec4f(pos[vertexIndex], 0.0, 1.0),
+    vec4f(red, green, blue, 1),
+  );
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;

-@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(red, green, blue, 1.0);
+@fragment fn fs(v: VOut) -> @location(0) vec4f {
+  let colorFromVertexShader = v.color;
+  let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
+  // 每隔 50 个像素在两种颜色之间切换
+  return select(
+    colorFromVertexShader,
+    colorFromFragmentShader,
+    v.pos.x % 100.0 > 50.0);
}
```

现在我们将向每个入口点传入不同的常量。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
+      constants: {
+        red: 1,
+        green: 1,
+        blue: 0,
+      },
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

结果显示，每个阶段中的常量值是不同的。

{{{example url="../webgpu-constants-override-set-entry-points.html"}}}

同样，从功能上讲，我们为了方便，只使用了一个包含一段 WGSL `code`的着色器模块。上面的代码在功能上等同于：

```js
  const vertexModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VOut {
        let pos = array(
          vec2f( 0.0,  0.5),  // 顶部中心
          vec2f(-0.5, -0.5),  // 左下
          vec2f( 0.5, -0.5)   // 右下
        );

        return VOut(
          vec4f(pos[vertexIndex], 0.0, 1.0),
          vec4f(red, green, blue, 1),
        );
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;
    `,
  });

  const fragmentModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;

      @fragment fn fs(v: VOut) -> @location(0) vec4f {
        let colorFromVertexShader = v.color;
        let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
        // 每隔 50 个像素在两种颜色之间切换
        return select(
          colorFromVertexShader,
          colorFromFragmentShader,
          v.pos.x % 100.0 > 50.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
*      module: vertexModule,
      constants: {
        red: 1,
        green: 1,
        blue: 0,
      },
    },
    fragment: {
*      module: fragmentModule,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

{{{example url="../webgpu-constants-override-separate-modules.html"}}}

注意：使用管线可覆盖常量来传递颜色并**不**常见。我们之所以使用颜色，是因为它易于理解且方便展示结果。