Title: WebGPU 平行移動
Description: オブジェクトの移動
TOC: 平行移動

この記事は、[基礎に関する記事](webgpu-fundamentals.html)、[ユニフォームに関する記事](webgpu-uniforms.html)、[頂点バッファに関する記事](webgpu-vertex-buffers.html)を読んでいることを前提としています。まだ読んでいない場合は、最初に読んでから戻ってくることをお勧めします。

この記事は、3D数学について学ぶことを目的とした一連の記事の最初の記事です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)  ⬅ ここです
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

[頂点バッファに関する記事](webgpu-vertex-buffers.html)の例と同様のコードから始めますが、多数の円の代わりに単一のFを描画し、データを小さく保つために[インデックスバッファ](webgpu-vertex-buffers.html#a-index-buffers)を使用します。

[Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)と同様に、クリップ空間ではなくピクセル空間で作業しましょう。Fを作成し、次のような6つの三角形から構築します。

<div class="webgpu_center"><img src="resources/f-polygons.svg" style="width: 600px;"></div>

Fのデータは次のとおりです。

```js
function createFVertices() {
  const vertexData = new Float32Array([
    // 左列
    0, 0,
    30, 0,
    0, 150,
    30, 150,

    // 上の横木
    30, 0,
    100, 0,
    30, 30,
    100, 30,

    // 中間の横木
    30, 60,
    70, 60,
    30, 90,
    70, 90,
  ]);

  const indexData = new Uint32Array([
    0,  1,  2,    2,  1,  3,  // 左列
    4,  5,  6,    6,  5,  7,  // 上の横木
    8,  9, 10,   10,  9, 11,  // 中間の横木
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

上記の頂点データはピクセル空間にあるため、それをクリップ空間に変換する必要があります。シェーダーに解像度を渡し、いくつかの計算を行うことで、これを行うことができます。一度に1ステップずつ説明します。

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

  // 位置をピクセルから0.0から1.0の値に変換します
  let zeroToOne = position / uni.resolution;

  // 0 <-> 1から0 <-> 2に変換します
  let zeroToTwo = zeroToOne * 2.0;

  // 0 <-> 2から-1 <-> +1（クリップ空間）に変換します
  let flippedClipSpace = zeroToTwo - 1.0;

  // Yを反転させます
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

頂点位置を取得し、それを解像度で除算することがわかります。これにより、キャンバス全体で0から1までの値が得られます。次に、2を乗算して、キャンバス全体で0から2までの値を取得します。1を減算します。これで、値はクリップ空間にありますが、クリップ空間は正のYが上であるのに対し、キャンバス2Dは正のYが下であるため、反転しています。したがって、Yを-1で乗算して反転させます。これで、シェーダーから出力できる必要なクリップ空間の値が得られました。

属性は1つしかないので、パイプラインは次のようになります。

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

ユニフォーム用のバッファを設定する必要があります。

```js
  // 色、解像度、パディング
*  const uniformBufferSize = (4 + 2) * 4 + 8;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
*  const kColorOffset = 0;
*  const kResolutionOffset = 4;
*
*  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
*  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
*
*  // 色は変更されないので、初期化時に一度設定しましょう
*  colorValue.set([Math.random(), Math.random(), Math.random(), 1]);
```

レンダリング時に解像度を設定する必要があります。

```js
  function render() {
    ...

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

実行する前に、キャンバスの背景を方眼紙のように見せましょう。方眼紙の各グリッドセルが10x10ピクセルになるようにスケールを設定し、100x100ピクセルごとに太い線を描画します。

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
  display: block;  /* canvasをブロックのように動作させる */
  width: 100%;     /* canvasがコンテナを埋めるようにする */
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

上記のCSSは、明暗両方のケースを処理する必要があります。

これまでのすべての例では、不透明なキャンバスを使用してきました。透明にして、設定した背景が見えるようにするには、いくつかの変更を加える必要があります。

まず、キャンバスを構成するときに`alphaMode`を`'premultiplied'`に設定する必要があります。デフォルトは`'opaque'`です。

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });
```

次に、`GPURenderPassDescriptor`でキャンバスを0、0、0、0にクリアする必要があります。デフォルトの`clearValue`は0、0、0、0なので、他の値に設定していた行を削除するだけです。

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- レンダリング時に設定されます
-        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
```

そして、これでFができました。

{{{example url="../webgpu-translation-prep.html"}}}

Fのサイズが背後にあるグリッドに対して相対的であることに注意してください。Fデータの頂点位置は、幅100ピクセル、高さ150ピクセルのFを作成し、表示されるものと一致します。Fは0,0から始まり、右に100,0、下に0,150まで伸びます。

基本ができたので、*平行移動*を追加しましょう。

平行移動は、単に物を動かすプロセスなので、ユニフォームに平行移動を追加し、それを位置に追加するだけです。

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
  
+  // 平行移動を追加します
-  let position = vert.position;
+  let position = vert.position + uni.translation;

  // 位置をピクセルから0.0から1.0の値に変換します
  let zeroToOne = position / uni.resolution;

  // 0 <-> 1から0 <-> 2に変換します
  let zeroToTwo = zeroToOne * 2.0;

  // 0 <-> 2から-1 <-> +1（クリップ空間）に変換します
  let flippedClipSpace = zeroToTwo - 1.0;

  // Yを反転させます
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

ユニフォームバッファにスペースを追加する必要があります。

```js
-  // 色、解像度、パディング
-  const uniformBufferSize = (4 + 2) * 4 + 8;
+  // 色、解像度、平行移動
+  const uniformBufferSize = (4 + 2 + 2) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
  const kResolutionOffset = 4;
+  const kTranslationOffset = 6;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
+  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
```

そして、レンダリング時に平行移動を設定する必要があります。

```js
+  const settings = {
+    translation: [0, 0],
+  };

  function render() {
    ...

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
+    translationValue.set(settings.translation);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

最後に、平行移動を調整できるUIを追加しましょう。

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

そして、平行移動を追加しました。

{{{example url="../webgpu-translation.html"}}}

ピクセルグリッドと一致することに注意してください。平行移動を200、300に設定すると、Fは0,0の左上の頂点が200,300にあるように描画されます。

この記事は非常に単純に見えたかもしれません。すでにいくつかの例で*平行移動*を使用していましたが、「オフセット」と名付けていました。この記事はシリーズの一部です。単純でしたが、シリーズを続けるにつれて、そのポイントが文脈の中で意味をなすことを願っています。

次は[回転](webgpu-rotation.html)です。