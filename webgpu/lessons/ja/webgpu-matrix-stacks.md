Title: WebGPU 行列スタック
Description: 行列スタック
TOC: 行列スタック

この記事は、3D数学について学ぶことを目的とした一連の記事の8番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html) ⬅ ここです
9. [シーングラフ](webgpu-scene-graphs.html)

行列スタックは、その名の通り、行列の[スタック](https://en.wikipedia.org/wiki/Stack_(abstract_data_type))です。互いに相対的に物事を配置したり方向付けしたりするのに役立ちます。デモンストレーションとして、ファイルキャビネットのセットを作成しましょう。行列スタックを使用すると、これが簡単になります。

簡単にするために、[前の記事の最後の例](webgpu-cameras#a-aim-fs)から始めて、キューブから作成します。

最初に行うことは、描画していたFを単位キューブに交換することです。

```js
-function createFVertices() {
+function createCubeVertices() {
*    // 左
*    0, 0,  0,
*    0, 0, -1,
*    0, 1,  0,
*    0, 1, -1,
*
*    // 右
*    1, 0,  0,
*    1, 0, -1,
*    1, 1,  0,
*    1, 1, -1,
*  ];
*
*  const indices = [
*     0,  2,  1,    2,  3,  1,   // 左
*     4,  5,  6,    6,  5,  7,   // 右
*     0,  4,  2,    2,  4,  6,   // 前
*     1,  3,  5,    5,  3,  7,   // 後
*     0,  1,  4,    4,  1,  5,   // 下
*     2,  6,  3,    3,  6,  7,   // 上
*  ];
*
*  const quadColors = [
*      200,  70, 120,  // 左列前面
*       80,  70, 200,  // 左列背面
*       70, 200, 210,  // 上
*      160, 160, 220,  // 上の横木右
*       90, 130, 110,  // 上の横木下
*      200, 200,  70,  // 上と中間の横木の間
*  ];

  ...
```

上記のデータは、次のようなキューブを作成します。

<div class="webgpu_center"><img src="resources/unit-cube.png" class="nobg"></div>

古いコードは、26個の「objectInfos」を事前に作成していました。各「objectInfo」は、描画したいものごとに1つずつ、ユニフォームバッファとバインドグループのセットでした。代わりに、これらをオンデマンドで作成するようにコードを変更しましょう。そうすれば、好きなだけ多くのものを描画できます。

```js
-  const numFs = 5 * 5 + 1;
  const objectInfos = [];
-  for (let i = 0; i < numFs; ++i) {
  function createObjectInfo() {
    // 行列
    const uniformBufferSize = (16) * 4;
    const uniformBuffer = device.createBuffer({
    
    ...

-    objectInfos.push({
+    return {
      uniformBuffer,
      uniformValues,
      matrixValue,
      bindGroup,
-    });
+    };
  }
```

物事を単純に保つために、すべてに同じ単位キューブを使用しますが、キューブを区別できるように、色を少し変更する方法が必要です。そこで、フラグメントを更新して、ユニフォームバッファを介して色を受け取り、頂点の色をこのユニフォームの色で乗算するようにしましょう。これにより、各キューブの頂点の色をわずかに変更できます。

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  color: vec4f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  return vsOut.color * uni.color;
}
```

新しい色のためのスペースを追加するために、ユニフォームバッファの作成を更新する必要があります。

```js
  function createObjectInfo() {
-    // 行列
-    const uniformBufferSize = (16) * 4;
+    // 行列と色
+    const uniformBufferSize = (16 + 4) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32インデックスでのさまざまなユニフォーム値へのオフセット
    const kMatrixOffset = 0;
+    const kColorOffset = 16;

    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer }},
      ],
    });

    return {
      uniformBuffer,
      uniformValues,
+      colorValue,
      matrixValue,
      bindGroup,
    };
  }
```

次に、オブジェクトを「描画」するコードを関数に抽出する必要があります。

```js
  let depthTexture;
+  let objectNdx = 0;

+  function drawObject(ctx, matrix, color) {
+    const { pass, viewProjectionMatrix } = ctx;
+    if (objectNdx === objectInfos.length) {
+      objectInfos.push(createObjectInfo());
+    }
+    const {
+      matrixValue,
+      colorValue,
+      uniformBuffer,
+      uniformValues,
+      bindGroup,
+    } = objectInfos[objectNdx++];
+
+    mat4.multiply(viewProjectionMatrix, matrix, matrixValue);
+    colorValue.set(color);
+
+    // ユニフォーム値をユニフォームバッファにアップロードします
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
+
+    pass.setBindGroup(0, bindGroup);
+    pass.draw(numVertices);
+  }

  function render() {
    ...

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);

-    // 角度に基づいてターゲットのX、Zを更新します
-    settings.target[0] = Math.cos(settings.targetAngle) * radius;
-    settings.target[2] = Math.sin(settings.targetAngle) * radius;

    ...

+    objectNdx = 0;
-    objectInfos.forEach(({
-      matrixValue,
-      uniformBuffer,
-      uniformValues,
-      bindGroup,
-    }, i) => {
-      const deep = 5;
-      const across = 5;
-      if (i < 25) {
-        // グリッド位置を計算します
-        const gridX = i % across;
-        const gridZ = i / across | 0;
-
-        // 0から1の位置を計算します
-        const u = gridX / (across - 1);
-        const v = gridZ / (deep - 1);
-
-        // 中央に配置して広げます
-        const x = (u - 0.5) * across * 150;
-        const z = (v - 0.5) * deep * 150;
-
-        // このFをその位置からターゲットFに向ける
-        const aimMatrix = mat4.aim([x, 0, z], settings.target, up);
-        mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue);
-      } else {
-        mat4.translate(viewProjectionMatrix, settings.target, matrixValue);
-      }
-
-      // ユニフォーム値をユニフォームバッファにアップロードします
-      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
-
-      pass.setBindGroup(0, bindGroup);
-      pass.draw(numVertices);
-    });

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

新しい「objectInfo」（ユニフォームバッファと型付き配列ビュー）が必要な場合は、`drawObject`関数を追加しました。`drawObject`は、レンダーパスエンコーダーと現在の`viewProjectionMatrix`を持つ`ctx`というコンテキストを受け取ります。また、行列と色も受け取ります。渡された行列を`viewProjectionMatrix`で乗算してこのオブジェクトのユニフォームバッファを埋め、その特定のユニフォームバッファを使用するようにバインドグループを設定し、`draw`を呼び出します。

次に、それを使用してキューブを描画するコードを追加しましょう。

```js
  function render() {

    ...

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);

    ...

    objectNdx = 0;
+    const ctx = { pass, viewProjectionMatrix };
+    drawObject(ctx, mat4.rotationY(settings.baseRotation), [1, 1, 1, 1]);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}
```

上記では、y軸を中心に回転する行列と白の色を渡しています。つまり、キューブは頂点の色を変更せずに描画されます。

GUIとカメラには、もう少し調整が必要です。

```js
-  const radius = 200;
  const settings = {
-    target: [0, 200, 300],
-    targetAngle: 0,
+    baseRotation: 0,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings.target, '1', -100, 300).name('target height');
-  gui.add(settings, 'targetAngle', radToDegOptions).name('target angle');
+  gui.add(settings, 'baseRotation', radToDegOptions);

  ...

  function render() {
    ...

-    const eye = [-500, 300, -500];
-    const target = [0, -100, 0];
+    const eye = [0, 2, 3];
+    const target = [0, 1, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

```

キューブがあります。

{{{example url="../webgpu-matrix-stack-cube.html" }}}

キューブをレンダリングできるようになったので、行列スタックを使用してファイルキャビネットのセットを作成しましょう。

まず、行列スタッククラスを作成しましょう。

```js
class MatrixStack {
  #matrix;
  #stack;

  constructor() {
    this.reset();
  }
  reset() {
    this.#matrix = mat4.identity();
    this.#stack = [];
    return this;
  }
  save() {
    this.#stack.push(this.#matrix);
    this.#matrix = mat4.copy(this.#matrix);
    return this;
  }
  restore() {
    this.#matrix = this.#stack.pop();
    return this;
  }
  get() {
    return this.#matrix;
  }
  set(matrix) {
    return this.#matrix.set(matrix);
  }
  translate(translation) {
    mat4.translate(this.#matrix, translation, this.#matrix);
    return this;
  }
  rotateX(angle) {
    mat4.rotateX(this.#matrix, angle, this.#matrix);
    return this;
  }
  rotateY(angle) {
    mat4.rotateY(this.#matrix, angle, this.#matrix);
    return this;
  }
  rotateZ(angle) {
    mat4.rotateZ(this.#matrix, angle, this.#matrix);
    return this;
  }
  scale(scale) {
    mat4.scale(this.#matrix, scale, this.#matrix);
    return this;
  }
}
```

上記のクラスは非常に単純です。行列の配列である`#stack`を保持します。そして、スタックの最上位の行列である`#matrix`を効果的に保持します。

[以前に記述した](webgpu-orthograph-projection.html) `mat4`関数を使用して、スタックの最上位の行列を操作する多数のメソッドを追加します。

注：これはスタックですが、より伝統的な`push`と`pop`の代わりに`save`と`restore`という名前を選択しました。なぜなら、`save`と`restore`は、独自の行列スタックを操作するために使用されるCanvas 2D APIの[save](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save)と[restore](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/restore)の関数と一致するためです。

上記で参照したもので、まだ存在しなかったものの1つは、`mat4.copy`関数なので、それを指定しましょう。

```js
const mat4 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(16);
+    dst.set(src);
+    return dst;
+  },

  ...
```

これで、ハンドル付きのファイリングキャビネットの引き出しを1つ描画しましょう。引き出しは大きなキューブになります。ハンドルは小さなキューブになります。

```js
+  const kHandleColor = [0.5, 0.5, 0.5, 1];
+  const kDrawerColor = [1, 1, 1, 1];
+
+  const kDrawerSize = [40, 30, 50];
+  const kHandleSize = [10, 2, 2];
+
+  const [kWidth, kHeight, kDepth] = [0, 1, 2];
+
+  const kHandlePosition = [
+    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
+    kDrawerSize[kHeight] * 2 / 3,
+    kHandleSize[kDepth],
+  ];
+
+  function drawDrawer(ctx) {
+    const { stack } = ctx;
+    stack.save();
+      stack.scale(kDrawerSize);
+      drawObject(ctx, stack.get(), kDrawerColor);
+    stack.restore();
+
+    stack.save();
+      stack.translate(kHandlePosition);
+      stack.scale(kHandleSize);
+      drawObject(ctx, stack.get(), kHandleColor);
+    stack.restore();
+  }
+
+  const stack = new MatrixStack();

  ...

  function render() {
    ...

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    stack.save();
+    stack.rotateY(settings.baseRotation);
+    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
    objectNdx = 0;
-    const ctx = { pass, stack, viewProjectionMatrix };
-    drawObject(ctx, mat4.rotationY(settings.baseRotation), [1, 1, 1, 1]);
+    const ctx = { stack, viewProjectionMatrix };
+    drawDrawer(ctx);
+    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

上記のコードは、`MatrixStack`を作成し、それを`drawDrawer`に渡されるコンテキスト（ctx）に追加します。これを使用して、行列の計算を支援します。回転行列を直接作成する代わりに、スタック上でそれを行い、次に引き出しの幅の半分を平行移動して中央に配置します。

スタックを`drawDrawer`に渡します。これは2つのキューブを描画します。1つは`kDrawerSize`のサイズにスケーリングします。もう1つは`kHandlePosition`に配置し、`kHandleSize`のサイズにスケーリングします。行列スタックを使用しているため、両方ともスタックにすでにある回転と平行移動に対して相対的になります。

引き出しキューブは色`kDrawerColor`（白）で描画されるため、頂点の色は変更されません。ハンドルは色`kHandleColor`（50％灰色）で描画されるため、キューブは暗く描画されます。

カメラの位置のマイナーな調整：

```js
-    const eye = [0, 20, 100];
-    const target = [0, 20, 0];
+    const eye = [0, 20, 100];
+    const target = [0, 20, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);
```

ファイリングキャビネットの引き出しができました。

{{{example url="../webgpu-matrix-stack-filing-drawer.html"}}}

なぜ行列スタックのこのような面倒なことをするのか、と尋ねているかもしれません。4つの引き出しを持つファイリングキャビネットを描画して、その理由を見てみましょう。

```js
  const kHandleColor = [0.5, 0.5, 0.5, 1];
  const kDrawerColor = [1, 1, 1, 1];
  const kCabinetColor = [0.75, 0.75, 0.75, 0.75];
  const kNumDrawersPerCabinet = 4;

  const kDrawerSize = [40, 30, 50];
  const kHandleSize = [10, 2, 2];

  const [kWidth, kHeight, kDepth] = [0, 1, 2];

  const kHandlePosition = [
    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
    kDrawerSize[kHeight] * 2 / 3,
    kHandleSize[kDepth],
  ];

  const kDrawerSpacing = kDrawerSize[kHeight] + 3;

  function drawDrawer(ctx) {
    const { stack } = ctx;
    stack.save();
      stack.scale(kDrawerSize);
      drawObject(ctx, stack.get(), kDrawerColor);
    stack.restore();

    stack.save();
      stack.translate(kHandlePosition);
      stack.scale(kHandleSize);
      drawObject(ctx, stack.get(), kHandleColor);
    stack.restore();
  }

+  function drawCabinet(ctx, numDrawersPerCabinet) {
+    const { stack } = ctx;
+
+    const kCabinetSize = [
+      kDrawerSize[kWidth] + 6,
+      kDrawerSpacing * numDrawersPerCabinet + 6,
+      kDrawerSize[kDepth] + 4,
+    ];
+
+    stack.save();
+      stack.scale(kCabinetSize);
+      drawObject(ctx, stack.get(), kCabinetColor);
+    stack.restore();
+
+    for (let i = 0; i < numDrawersPerCabinet; ++i) {
+      stack.save();
+        stack.translate([3, i * kDrawerSpacing + 5, 1]);
+        drawDrawer(ctx);
+      stack.restore();
+    }
+  }

  function render() {
    ...
-    const eye = [0, 20, 100];
-    const target = [0, 20, 0];
+    const eye = [0, 80, 200];
+    const target = [0, 80, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawDrawer(ctx);
+    drawCabinet(ctx, kNumDrawersPerCabinet);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

上記では、`drawCabinet`は、描画するように依頼したキャビネットの数よりもわずかに高い`kCabinetSize`のサイズのキューブを描画します。

次に、行列スタックを使用して、各引き出しを正しい位置に、キャビネットキューブのわずかに前に表示するように平行移動します。

{{{example url="../webgpu-matrix-stack-filing-cabinet.html"}}}

`drawDrawer`をまったく変更する必要はありませんでした。行列スタックのおかげで、そのまま使用できました。

続けましょう。複数のキャビネットを描画しましょう。

```js
  const kHandleColor = [0.5, 0.5, 0.5, 1];
  const kDrawerColor = [1, 1, 1, 1];
  const kCabinetColor = [0.75, 0.75, 0.75, 0.75];
  const kNumDrawersPerCabinet = 4;
+  const kNumCabinets = 5;

  const kDrawerSize = [40, 30, 50];
  const kHandleSize = [10, 2, 2];

  const [kWidth, kHeight, kDepth] = [0, 1, 2];

  const kHandlePosition = [
    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
    kDrawerSize[kHeight] * 2 / 3,
    kHandleSize[kDepth],
  ];

  const kDrawerSpacing = kDrawerSize[kHeight] + 3;
+  const kCabinetSpacing = kDrawerSize[kWidth] + 10;

  ...

  function drawCabinet(ctx, numDrawersPerCabinet) {
    const { stack } = ctx;

    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * numDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];

    stack.save();
      stack.scale(kCabinetSize);
      drawObject(ctx, stack.get(), kCabinetColor);
    stack.restore();

    for (let i = 0; i < numDrawersPerCabinet; ++i) {
      stack.save();
        stack.translate([3, i * kDrawerSpacing + 5, 1]);
        drawDrawer(ctx);
      stack.restore();
    }
  }

+  function drawCabinets(ctx, numCabinets) {
+    const { stack } = ctx;
+    for (let i = 0; i < numCabinets; ++i) {
+      stack.save();
+        stack.translate([i * kCabinetSpacing, 0, 0]);
+        drawCabinet(ctx, kNumDrawersPerCabinet);
+      stack.restore();
+    }
+  }

  function render() {
    ...
    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
-    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
+    stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawCabinet(ctx, kNumDrawersPerCabinet);
+    drawCabinets(ctx, kNumCabinets);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

これで、`drawCabinet`を使用して、指定した数のキャビネットを描画する`drawCabinets`ができました。

`render`に戻り、キャビネットの幅の半分を平行移動して中央に配置します。

{{{example url="../webgpu-matrix-stack-filing-cabinets.html"}}}

これが、行列スタックの有用性についてある程度のアイデアを与えてくれることを願っています。これにより、物事を簡単に再利用したり、配置、方向付け、スケーリングしたりできます。

## <a id="a-recursive-tree"></a>再帰的な木

もう1つの例を作成しましょう。キューブから再帰的な木を作成しましょう。これを行うには、木の「枝」を追加する関数が必要です。再帰的にし、`treeDepth`を渡します。深さが0より大きい場合は、再帰的にさらに2つの枝を追加し、1つ低い深さを渡します。

```js
  const degToRad = d => d * Math.PI / 180;

  const settings = {
    baseRotation: 0,
+    scale: 0.9,
+    rotationX: degToRad(20),
+    rotationY: degToRad(10),
  };

  const radToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };
+  const treeRadToDegOptions = { min: 0, max: 90, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
+  gui.add(settings, 'scale', 0.1, 1.2);
+  gui.add(settings, 'rotationX', treeRadToDegOptions);
+  gui.add(settings, 'rotationY', treeRadToDegOptions);
  gui.add(settings, 'baseRotation', radToDegOptions);

+  const kTreeDepth = 6;
+  const [/*kWidth*/, kHeight, /*kDepth*/] = [0, 1, 2];
+  // 1単位のキューブを移動して、原点の上に中心が来るようにします。これにより、スケーリングすると、
+  // xとzで外側に、yで上（原点から）に拡大します。
+  const kBranchPosition = [-0.5, 0, 0.5];
+  const kBranchSize = [20, 150, 20];
+
+  const kWhite = [1, 1, 1, 1];
+
+  function drawBranch(ctx) {
+    const { stack } = ctx;
+    stack
+      .save()
+      .scale(kBranchSize)
+      .translate(kBranchPosition);
+    drawObject(ctx, stack.get(), kWhite);
+    stack.restore();
+  }
+
+  function drawTreeLevel(ctx, offset, treeDepth) {
+    const { stack } = ctx;
+    const s = offset ? settings.scale : 1;
+    const y = offset ? kBranchSize[kHeight] : 0;
+    stack
+      .save()
+      .translate([0, y, 0])
+      .rotateZ(offset * settings.rotationX)
+      .rotateY(Math.abs(offset) * settings.rotationY)
+      .scale([s, s, s]);
+
+    drawBranch(ctx);
+
+    if (treeDepth > 0) {
+      drawTreeLevel(ctx, -1, treeDepth - 1);
+      drawTreeLevel(ctx, +1, treeDepth - 1);
+    }
+
+    stack.restore();
+  }

  function render() {
    ...

-    const eye = [0, 80, 200];
-    const target = [0, 80, 0];
+    const eye = [0, 450, 1000];
+    const target = [0, 450, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
-    stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawCabinets(ctx, kNumCabinets);
+    drawTreeLevel(ctx, 0, kTreeDepth);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

`drawTreeLevel`は行列スタックを使用します。まず、`save`を呼び出して現在の行列を保存します。次に、`translate`して枝を現在の枝の端に移動します。`offset`が`0`の場合はルートなので、平行移動は必要ありません。

次に、`offset`を使用して現在の枝を時計回りまたは反時計回りに`rotateZ`します。行列スタックのため、親の枝に対して相対的に回転します。

次に、`offset`を再度使用して枝を`rotateY`します。今回は`offset`の絶対値を使用します。違いを確認するために、`Math.abs`を自由に削除してください。

最後に、枝を`scale`して、ルート（`offset`が`0`の枝）を除いて、各枝を親よりも小さく（または大きく）します。

次に、`drawBranch`を呼び出します。`drawBranch`は、`kBranchSize`の大きさのキューブを描画します。また、元の単位キューブを平行移動して、キューブが原点の上で中央に配置されるようにします。そうすれば、スケーリングすると、上（+Y軸に沿って）に成長します。

次に、深さが0より大きい場合は、再帰的に`drawTreeLevel`を呼び出して、さらに2つの枝を追加します。1つはオフセットが`-1`、もう1つは`+1`です。各枝はスタック上の行列で始まるため、親に対して相対的に配置および方向付けされます。

最後に、スタックを`restore`します。

{{{example url="../webgpu-matrix-stack-tree.html"}}}

「rotationX」を調整すると、枝が扇状に広がるか、まとまるかがわかります。「rotationY」を調整すると、枝がx平面から広がるのがわかります。何が起こっているかを確認するには、「baseRotation」を調整する必要がある場合があります。「scale」を調整すると、各枝が親よりも小さくなったり大きくなったりするのがわかります。

これが、アルゴリズム的な木ジェネレーターを作成するためのインスピレーションになるかもしれません。[^tree-gen]

[^tree-gen]: 個々のキューブや円柱から木を生成するのは通常ではありません。再帰と行列スタックの手法は使用されますが、キューブを描画する代わりに、行列を使用して頂点を生成し、木全体の単一のメッシュを構築します。

各枝に飾りを追加しましょう。キューブの代わりに、飾りに円錐を使用しましょう。円錐の頂点を生成するコードは次のとおりです。

```js
// 先端は原点にあり、底面は下にあります
function createConeVertices({radius = 1, height = 1, subdivisions = 6} = {}) {
  const positions = [];
  const colors = [];

  function addVertex(angle, radius, height, color) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(c * radius, height, s * radius);
    colors.push(...color);
  }

  for (let i = 0; i < subdivisions; ++i) {
    const angle0 = (i + 0) / subdivisions * Math.PI * 2;
    const angle1 = (i + 1) / subdivisions * Math.PI * 2;

    const u = (i + 1) / subdivisions;
    const color = [u * 128 + 127, 0, 0];

    // 側面を追加します
    addVertex(angle0, 0, 0, color);
    addVertex(angle1, radius, -height, color);
    addVertex(angle0, radius, -height, color);

    // 上面を追加します
    addVertex(angle0, radius, -height, color);
    addVertex(angle1, radius, -height, color);
    addVertex(angle0, 0, -height, color);
  }

  const numVertices = positions.length / 3;
  const vertexData = new Float32Array(numVertices * 4); // xyz + color
  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < numVertices; ++i) {
    const position = positions.slice(i * 3, i * 3 + 3);
    vertexData.set(position, i * 4);

    const color = colors.slice(i * 3, i * 3 + 3);
    colorData.set(color, i * 16 + 12);
    colorData[i * 16 + 15] = 255;
  }

  return {
    vertexData,
    numVertices,
  };
}
```

上記のコードは、円の周りを歩き、各側面に三角形と、上面に対応する三角形を追加します。各面を赤の色合いに設定します。キューブ関数と同様に、`vertexData`と`numVertices`を返します。[別の記事](webgpu-primitives.html)でさまざまな幾何学的プリミティブの作成について説明します。

頂点バッファを作成するコードを関数でラップして、キューブと円錐で2回呼び出せるようにしましょう。

```js
-  const { vertexData, numVertices } = createCubeVertices();

+  function createVertices({vertexData, numVertices}, name) {
*    const vertexBuffer = device.createBuffer({
-      label: `vertex buffer vertices`,
+      label: `${name}: vertex buffer vertices`,
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+    return {
+      vertexBuffer,
+      numVertices,
+    };
*  }

+  const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const ornamentVertices = createVertices(createConeVertices({
+    radius: 20,
+    height: 60,
+  }), 'ornament');
```

次に、`drawObject`関数を更新して、頂点パラメータを受け取るようにしましょう。

```js
-  function drawObject(ctx, matrix, color) {
+  function drawObject(ctx, vertices, matrix, color) {
    const { pass, viewProjectionMatrix } = ctx;
+    const { vertexBuffer, numVertices } = vertices;
    if (objectNdx === objectInfos.length) {
      objectInfos.push(createObjectInfo());
    }
    const {
      matrixValue,
      colorValue,
      uniformBuffer,
      uniformValues,
      bindGroup,
    } = objectInfos[objectNdx++];

    mat4.multiply(viewProjectionMatrix, matrix, matrixValue);
    colorValue.set(color);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

+    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices);
  }
```

そして、枝を描画するコードを更新して、キューブの頂点を渡すようにします。

```js
  function drawBranch(ctx) {
    const { stack } = ctx;
    stack
      .save()
      .scale(kBranchSize)
      .translate(kBranchPosition);
-    drawObject(ctx, stack.get(), kWhite);
+    drawObject(ctx, cubeVertices, stack.get(), kWhite);
    stack.restore();
  }
```

そして、頂点バッファを早期に設定する必要はもうありません。

```js
  function render() {

    ...
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
-    pass.setVertexBuffer(0, vertexBuffer);

    ...
```

そして、`drawTreeLevel`にコードを追加して、深さがゼロのときに飾りを描画するようにしましょう。

```js
  function drawTreeLevel(ctx, offset, treeDepth) {
    const { stack } = ctx;
    const s = offset ? settings.scale : 1;
    const y = offset ? kBranchSize[kHeight] : 0;
    stack
      .save()
      .translate([0, y, 0])
      .rotateZ(offset * settings.rotationX)
      .rotateY(Math.abs(offset) * settings.rotationY)
      .scale([s, s, s]);

    drawBranch(ctx);

    if (treeDepth > 0) {
      drawTreeLevel(ctx, -1, treeDepth - 1);
      drawTreeLevel(ctx, +1, treeDepth - 1);
    }

+    if (treeDepth === 0 && offset > 0) {
+      const position = vec3.getTranslation(stack.get());
+      drawObject(ctx, ornamentVertices, mat4.translation(position), kWhite);
+    }

    stack.restore();
  }
```

`vec3.getTranslation`という関数を使用していますが、これを提供する必要があります。

```js
const vec3 = {
  ...
  getTranslation(m, dst) {
    dst = dst || new Float32Array(3);

    dst[0] = m[12];
    dst[1] = m[13];
    dst[2] = m[14];

    return dst;
  },
};
```

`getTranslation`は、[3D数学に関する記事](webgpu-orthographic-projection.html)で説明したように、行列から現在の平行移動を取得します。

上記では、飾りを描画するために追加したコードは、`getTranslation`を呼び出して行列スタックの現在の平行移動を取得します。これは、最後の枝の基部になります。枝で方向付けおよびスケーリングされるため、行列スタックから直接飾りを描画することはできません。代わりに、スタックから現在の平行移動を取得し、その平行移動を持つ行列を渡します。平行移動は枝の基部にあるため、1つだけ描画すればよく、そのため、`offset > 0`の場合にのみ描画します。それ以外の場合は、まったく同じ場所に2つの飾りを描画します。

{{{example url="../webgpu-matrix-stack-tree-with-ornaments.html"}}}

次は、[シーングラフ](webgpu-scene-graphs.html)です。