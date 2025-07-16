Title: WebGPU 頂点バッファ
Description: シェーダーへの頂点データの受け渡し
TOC: 頂点バッファ

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

[前の記事](webgpu-storage-buffers.html)では、頂点データをストレージバッファに入れ、組み込みの`vertex_index`を使用してインデックス付けしました。その手法は人気が高まっていますが、頂点シェーダーに頂点データを提供するための従来の方法は、頂点バッファと属性を使用することです。

頂点バッファは、他のWebGPUバッファと同様に、データを保持します。違いは、頂点シェーダーから直接アクセスしないことです。代わりに、WebGPUにバッファ内のデータの種類と編成方法を伝え、データをバッファから取り出して提供してもらいます。

[前の記事](webgpu-storage-buffers.html)の最後の例を取り上げ、ストレージバッファの使用から頂点バッファの使用に変更しましょう。

最初に行うことは、シェーダーを変更して、頂点データを頂点バッファから取得するようにすることです。

```wgsl
struct OurStruct {
  color: vec4f,
  offset: vec2f,
};

struct OtherStruct {
  scale: vec2f,
};

struct Vertex {
-  position: vec2f,
+  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
-@group(0) @binding(2) var<storage, read> pos: array<Vertex>;

@vertex fn vs(
-  @builtin(vertex_index) vertexIndex : u32,
+  vert: Vertex,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let otherStruct = otherStructs[instanceIndex];
  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
  vsOut.position = vec4f(
-      pos[vertexIndex].position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
+      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
  vsOut.color = ourStruct.color;
  return vsOut;
}

...
```

ご覧のとおり、これは小さな変更です。重要な部分は、`@location(0)`で位置フィールドを宣言することです。

次に、`@location(0)`のデータを供給する方法をWebGPUに伝える必要があります。そのためには、レンダーパイプラインを使用します。

```js
  const pipeline = device.createRenderPipeline({
    label: 'vertex buffer pipeline',
    layout: 'auto',
    vertex: {
      module,
+      buffers: [
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          attributes: [
+            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+          ],
+        },
+      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

[`pipeline`記述子](GPURenderPipelineDescriptor)の[`vertex`](GPUVertexState)エントリに、1つ以上の頂点バッファからデータを取得する方法を記述するために使用される`buffers`配列を追加しました。最初の、そして唯一のバッファについて、バイト単位で`arrayStride`を設定しました。この場合の*ストライド*は、バッファ内の1つの頂点のデータから、バッファ内の次の頂点のデータに進むために取得するバイト数です。

<div class="webgpu_center"><img src="resources/vertex-buffer-one.svg" style="width: 1024px;"></div>

データは`vec2f`であり、2つのfloat32数値なので、`arrayStride`を8に設定しました。

次に、属性の配列を定義します。1つしかありません。`shaderLocation: 0`は、`Vertex`構造体の`location(0)`に対応します。`offset: 0`は、この属性のデータが頂点バッファのバイト0から始まることを示します。最後に、`format: 'float32x2'`は、WebGPUにバッファからデータを2つの32ビット浮動小数点数として取得するように指示します。（注：`attributes`プロパティは、最初の記事の[単純化された描画図](webgpu-fundamentals.html#a-draw-diagram)に示されています）。

頂点データを保持するバッファの使用法を`STORAGE`から`VERTEX`に変更し、バインドグループから削除する必要があります。

```js
-  const vertexStorageBuffer = device.createBuffer({
-    label: 'storage buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
-  });
+  const vertexBuffer = device.createBuffer({
+    label: 'vertex buffer vertices',
+    size: vertexData.byteLength,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const bindGroup = device.createBindGroup({
    label: 'bind group for objects',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: staticStorageBuffer }},
      { binding: 1, resource: { buffer: changingStorageBuffer }},
-      { binding: 2, resource: { buffer: vertexStorageBuffer }},
    ],
  });
```

次に、描画時に、使用する頂点バッファをWebGPUに伝える必要があります。

```js
    pass.setPipeline(pipeline);
+    pass.setVertexBuffer(0, vertexBuffer);
```

ここでの`0`は、上記で指定したレンダーパイプライン`buffers`配列の最初の要素に対応します。

これで、頂点にストレージバッファを使用する代わりに、頂点バッファを使用するように切り替えました。

{{{example url="../webgpu-vertex-buffers.html"}}}

描画コマンドが実行されるときの状態は、次のようになります。

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram-vertex-buffer.svg" style="width: 960px;"></div>

属性`format`フィールドは、次のいずれかの型になります。

<div class="webgpu_center data-table">
  <style>
    .vertex-type {
      text-align: center;
    }
  </style>
  <div>
  <table class="vertex-type">
    <thead>
     <tr>
      <th>頂点形式</th>
      <th>データ型</th>
      <th>コンポーネント</th>
      <th>バイトサイズ</th>
      <th>WGSL型の例</th>
     </tr>
    </thead>
    <tbody>
      <tr><td><code>"uint8x2"</code></td><td>符号なし整数</td><td>2</td><td>2</td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint8x4"</code></td><td>符号なし整数</td><td>4</td><td>4</td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint8x2"</code></td><td>符号付き整数</td><td>2</td><td>2</td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint8x4"</code></td><td>符号付き整数</td><td>4</td><td>4</td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm8x2"</code></td><td>符号なし正規化</td><td>2</td><td>2</td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm8x4"</code></td><td>符号なし正規化</td><td>4</td><td>4</td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm8x2"</code></td><td>符号付き正規化</td><td>2</td><td>2</td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm8x4"</code></td><td>符号付き正規化</td><td>4</td><td>4</td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint16x2"</code></td><td>符号なし整数</td><td>2</td><td>4</td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint16x4"</code></td><td>符号なし整数</td><td>4</td><td>8</td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint16x2"</code></td><td>符号付き整数</td><td>2</td><td>4</td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint16x4"</code></td><td>符号付き整数</td><td>4</td><td>8</td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm16x2"</code></td><td>符号なし正規化</td><td>2</td><td>4</td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm16x4"</code></td><td>符号なし正規化</td><td>4</td><td>8</td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm16x2"</code></td><td>符号付き正規化</td><td>2</td><td>4</td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm16x4"</code></td><td>符号付き正規化</td><td>4</td><td>8</td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"float16x2"</code></td><td>浮動小数点数</td><td>2</td><td>4</td><td><code>vec2&lt;f16&gt;</code>, <code>vec2h</code></td></tr>
      <tr><td><code>"float16x4"</code></td><td>浮動小数点数</td><td>4</td><td>8</td><td><code>vec4&lt;f16&gt;</code>, <code>vec4h</code></td></tr>
      <tr><td><code>"float32"</code></td><td>浮動小数点数</td><td>1</td><td>4</td><td><code>f32</code></td></tr>
      <tr><td><code>"float32x2"</code></td><td>浮動小数点数</td><td>2</td><td>8</td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"float32x3"</code></td><td>浮動小数点数</td><td>3</td><td>12</td><td><code>vec3&lt;f32&gt;</code>, <code>vec3f</code></td></tr>
      <tr><td><code>"float32x4"</code></td><td>浮動小数点数</td><td>4</td><td>16</td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint32"</code></td><td>符号なし整数</td><td>1</td><td>4</td><td><code>u32</code></td></tr>
      <tr><td><code>"uint32x2"</code></td><td>符号なし整数</td><td>2</td><td>8</td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint32x3"</code></td><td>符号なし整数</td><td>3</td><td>12</td><td><code>vec3&lt;u32&gt;</code>, <code>vec3u</code></td></tr>
      <tr><td><code>"uint32x4"</code></td><td>符号なし整数</td><td>4</td><td>16</td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint32"</code></td><td>符号付き整数</td><td>1</td><td>4</td><td><code>i32</code></td></tr>
      <tr><td><code>"sint32x2"</code></td><td>符号付き整数</td><td>2</td><td>8</td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint32x3"</code></td><td>符号付き整数</td><td>3</td><td>12</td><td><code>vec3&lt;i32&gt;</code>, <code>vec3i</code></td></tr>
      <tr><td><code>"sint32x4"</code></td><td>符号付き整数</td><td>4</td><td>16</td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

## <a id="a-instancing"></a>頂点バッファを使用したインスタンス化

属性は、頂点ごとまたはインスタンスごとに進めることができます。インスタンスごとに進めることは、`instanceIndex`が`@builtin(instance_index)`から値を取得する`otherStructs[instanceIndex]`と`ourStructs[instanceIndex]`をインデックス付けするときに行っていることと事実上同じです。

ストレージバッファを削除し、頂点バッファを使用して同じことを実現しましょう。まず、シェーダーを変更して、ストレージバッファの代わりに頂点属性を使用するようにします。

```wgsl
-struct OurStruct {
-  color: vec4f,
-  offset: vec2f,
-};
-
-struct OtherStruct {
-  scale: vec2f,
-};

struct Vertex {
  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

-@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
-@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

@vertex fn vs(
  vert: Vertex,
-  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
-  let otherStruct = otherStructs[instanceIndex];
-  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
-  vsOut.color = ourStruct.color;
+  vsOut.position = vec4f(
+      vert.position * vert.scale + vert.offset, 0.0, 1.0);
+  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

次に、レンダーパイプラインを更新して、それらの属性にデータを供給する方法を伝える必要があります。変更を最小限に抑えるために、ストレージバッファ用に作成したデータをほぼそのまま使用します。2つのバッファを使用します。1つのバッファはインスタンスごとの`color`と`offset`を保持し、もう1つは`scale`を保持します。

```js
  const pipeline = device.createRenderPipeline({
    label: 'flat colors',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
          ],
        },
+        {
+          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
+            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+          ],
+        },
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+          ],
+        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

上記では、パイプライン記述の`buffers`配列に2つのエントリを追加したので、これで3つのバッファエントリになり、3つのバッファでデータを供給することをWebGPUに伝えています。

2つの新しいエントリについて、`stepMode`を`instance`に設定しました。これは、この属性がインスタンスごとに1回だけ次の値に進むことを意味します。デフォルトは`stepMode: 'vertex'`で、頂点ごとに1回進みます（そして、各インスタンスで最初からやり直します）。

2つのバッファがあります。`scale`のみを保持するものは単純です。`position`を保持する最初のバッファと同様に、頂点ごとに2つの32ビット浮動小数点数です。

もう1つのバッファは`color`と`offset`を保持し、次のようにデータにインターリーブされます。

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x4-f32x2.svg" style="width: 1024px;"></div>

したがって、上記では、あるデータセットから次のデータセットに進むための`arrayStride`を`6 * 4`、つまり6つの32ビット浮動小数点数（それぞれ4バイト、合計24バイト）に設定しました。`color`はオフセット0から始まりますが、`offset`は16バイトから始まります。

次に、バッファを設定するコードを変更できます。

```js
  // 2つの頂点バッファを作成します
  const staticUnitSize =
-    4 * 4 + // colorは4つの32ビット浮動小数点数（各4バイト）です
-    2 * 4 + // offsetは2つの32ビット浮動小数点数（各4バイト）です
-    2 * 4;  // パディング
+    4;     // colorは4バイトです
  const changingUnitSize =
-    2 * 4;  // scaleは2つの32ビット浮動小数点数（各4バイト）です
+    2 * 4 + // offsetは2つの32ビット浮動小数点数（各4バイト）です
+    2 * 4;  // scaleは2つの32ビット浮動小数点数（各4バイト）です
*  const staticVertexBufferSize = staticUnitSize * kNumObjects;
*  const changingVertexBufferSize = changingUnitSize * kNumObjects;

*  const staticVertexBuffer = device.createBuffer({
*    label: 'static vertex for objects',
*    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

*  const changingVertexBuffer = device.createBuffer({
*    label: 'changing vertex for objects',
*    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

```

頂点属性には、ストレージバッファの構造体と同じパディング制限がないため、パディングはもう必要ありません。それ以外は、使用法を`STORAGE`から`VERTEX`に変更しただけです（そして、すべての変数を「ストレージ」から「頂点」に名前変更しました）。

ストレージバッファを使用しなくなったため、バインドグループはもう必要ありません。

```js
-  const bindGroup = device.createBindGroup({
-    label: 'bind group for objects',
-    layout: pipeline.getBindGroupLayout(0),
-    entries: [
-      { binding: 0, resource: { buffer: staticStorageBuffer }},
-      { binding: 1, resource: { buffer: changingStorageBuffer }},
-    ],
-  });
```

最後に、バインドグループを設定する必要はありませんが、頂点バッファを設定する必要があります。

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setVertexBuffer(1, staticVertexBuffer);
+    pass.setVertexBuffer(2, changingVertexBuffer);

    ...
-    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices, kNumObjects);

    pass.end();
```

ここでの`setVertexBuffer`の最初のパラメータは、上記で作成したパイプラインの`buffers`配列の要素に対応します。

これで、以前と同じものができましたが、すべての頂点バッファを使用し、ストレージバッファは使用していません。

{{{example url="../webgpu-vertex-buffers-instanced-colors"}}}

楽しみのために、頂点ごとに色を付ける属性を追加しましょう。まず、シェーダーを変更しましょう。

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color;
+  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

次に、データを供給する方法を記述するためにパイプラインを更新する必要があります。`perVertexColor`データを`position`と次のようにインターリーブします。

<div class="webgpu_center"><img src="resources/vertex-buffer-mixed.svg" style="width: 1024px;"></div>

したがって、`arrayStride`を新しいデータをカバーするように変更し、新しい属性を追加する必要があります。2つの32ビット浮動小数点数の後に始まるため、バッファへの`offset`は8バイトです。

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          arrayStride: 5 * 4, // 5 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
          ],
        },
        {
          arrayStride: 6 * 4, // 6 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

円の頂点生成コードを更新して、円の外側の端にある頂点に暗い色を、内側の頂点に明るい色を提供します。

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 1つのサブディビジョンあたり2つの三角形、1つの三角形あたり3つの頂点、それぞれ5つの値（xyrgb）。
+  // 1つのサブディビジョンあたり2つの三角形、1つの三角形あたり3つの頂点
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * (2 + 3));
+  // 位置（xy）に2つの32ビット値、色（rgb）に1つの32ビット値
+  // 32ビットの色値は、4つの8ビット値として書き込み/読み取りされます
+  const vertexData = new Float32Array(numVertices * (2 + 1));
+  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
+  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
-    vertexData[offset++] = r;
-    vertexData[offset++] = g;
-    vertexData[offset++] = b;
+    offset += 1;  // 色をスキップします
+    colorData[colorOffset++] = r * 255;
+    colorData[colorOffset++] = g * 255;
+    colorData[colorOffset++] = b * 255;
+    colorOffset += 9;  // 余分なバイトと位置をスキップします
  };

+  const innerColor = [1, 1, 1];
+  const outerColor = [0.1, 0.1, 0.1];

  // 1つのサブディビジョンあたり2つの三角形
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; ++i) {
    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

    const c1 = Math.cos(angle1);
    const s1 = Math.sin(angle1);
    const c2 = Math.cos(angle2);
    const s2 = Math.sin(angle2);

    // 最初の三角形
-    addVertex(c1 * radius, s1 * radius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c1 * innerRadius, s1 * innerRadius);
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

    // 2番目の三角形
-    addVertex(c1 * innerRadius, s1 * innerRadius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c2 * innerRadius, s2 * innerRadius);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
  }

  return {
    vertexData,
    numVertices,
  };
}
```

そして、シェーディングされた円が得られます。

{{{example url="../webgpu-vertex-buffers-per-vertex-colors.html"}}}

## <a id="a-default-values"></a>WGSLの属性はJavaScriptの属性と一致する必要はありません

上記では、WGSLで`perVertexColor`属性を次のように`vec3f`として宣言しました。

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
*  @location(4) perVertexColor: vec3f,
};
```

そして、次のように使用しました。

```wgsl
@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
*  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}
```

`vec4f`として宣言し、次のように使用することもできます。

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
-  @location(4) perVertexColor: vec3f,
+  @location(4) perVertexColor: vec4f,
};

...

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.color = vert.color * vert.perVertexColor;
  return vsOut;
}
```

そして、他に何も変更しません。JavaScriptでは、まだ頂点ごとに3つの浮動小数点数としてデータを提供しています。

```js
    {
      arrayStride: 5 * 4, // 5 floats, 4 bytes each
      attributes: [
        {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
*        {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
      ],
    },
```

これは、属性がシェーダーで常に4つの値を利用できるため機能します。デフォルトは`0, 0, 0, 1`なので、提供しない値はこれらのデフォルトになります。

{{{example url="../webgpu-vertex-buffers-per-vertex-colors-3-in-4-out.html"}}}

## <a id="a-normalized-attributes"></a>正規化された値を使用してスペースを節約する

色のために32ビット浮動小数点値を使用しています。各`perVertexColor`には3つの値があり、頂点ごとの色ごとに合計12バイトになります。各`color`には4つの値があり、インスタンスごとの色ごとに合計16バイトになります。

8ビット値を使用し、WebGPUに0↔255から0.0↔1.0に正規化するように指示することで、これを最適化できます。

有効な属性形式のリストを見ると、3値の8ビット形式はありませんが、`'unorm8x4'`があるので、それを使用しましょう。

まず、頂点を生成するコードを変更して、正規化される8ビット値として色を格納するようにします。

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 1つのサブディビジョンあたり2つの三角形、1つの三角形あたり3つの頂点、それぞれ5つの値（xyrgb）。
+  // 1つのサブディビジョンあたり2つの三角形、1つの三角形あたり3つの頂点
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * (2 + 3));
+  // 位置（xy）に2つの32ビット値、色（rgb_）に1つの32ビット値
+  // 32ビットの色値は、4つの8ビット値として書き込み/読み取りされます
+  const vertexData = new Float32Array(numVertices * (2 + 1));
+  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
+  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
-    vertexData[offset++] = r;
-    vertexData[offset++] = g;
-    vertexData[offset++] = b;
+    offset += 1;  // 色をスキップします
+    colorData[colorOffset++] = r * 255;
+    colorData[colorOffset++] = g * 255;
+    colorData[colorOffset++] = b * 255;
+    colorOffset += 9;  // 余分なバイトと位置をスキップします
  };
```

上記では、`vertexData`と同じデータの`Uint8Array`ビューである`colorData`を作成します。これが不明な場合は、[データメモリレイアウトに関する記事](webgpu-memory-layout.html#multiple-views-of-the-same-arraybuffer)を確認してください。

次に、`colorData`を使用して色を挿入し、0↔1から0↔255に展開します。

この（頂点ごとの）データのメモリレイアウトは次のようになります。

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x2-u8x4.svg" style="width: 1024px;"></div>

また、インスタンスごとのデータを更新する必要があります。

```js
  const kNumObjects = 100;
  const objectInfos = [];

  // 2つの頂点バッファを作成します
  const staticUnitSize =
-    4 * 4 + // colorは4つの32ビット浮動小数点数（各4バイト）です
+    4 +     // colorは4バイトです
    2 * 4;  // offsetは2つの32ビット浮動小数点数（各4バイト）です
  const changingUnitSize =
    2 * 4;  // scaleは2つの32ビット浮動小数点数（各4バイト）です
*  const staticVertexBufferSize = staticUnitSize * kNumObjects;
*  const changingVertexBufferSize = changingUnitSize * kNumObjects;

*  const staticVertexBuffer = device.createBuffer({
*    label: 'static vertex for objects',
*    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

*  const changingVertexBuffer = device.createBuffer({
*    label: 'changing vertex for objects',
*    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
-  const kOffsetOffset = 4;
+  const kOffsetOffset = 1;

  const kScaleOffset = 0;

  {
-    const staticVertexValues = new Float32Array(staticVertexBufferSize / 4);
+    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
+    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
-      const staticOffset = i * (staticUnitSize / 4);
+      const staticOffsetU8 = i * staticUnitSize;
+      const staticOffsetF32 = staticOffsetU8 / 4;

      // これらは一度だけ設定されるので、今すぐ設定します
-      staticVertexValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset);        // 色を設定します
-      staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset);      // オフセットを設定します
+      staticVertexValuesU8.set(        // 色を設定します
+          [rand() * 255, rand() * 255, rand() * 255, 255],
+          staticOffsetU8 + kColorOffset);
+
+      staticVertexValuesF32.set(      // オフセットを設定します
+          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
+          staticOffsetF32 + kOffsetOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
-    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValues);
+    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
  }
```

インスタンスごとのデータのレイアウトは次のようになります。

<div class="webgpu_center"><img src="resources/vertex-buffer-u8x4-f32x2.svg" style="width: 1024px;"></div>

次に、パイプラインを変更して、データを8ビット符号なし値として取得し、それらを0↔1に正規化し、オフセットを更新し、ストライドを新しいサイズに更新する必要があります。

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 5 * 4, // 5 floats, 4 bytes each
+          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
-            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
+            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
-          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
-            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
-            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
+            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

そして、それで少しスペースを節約しました。頂点ごとに20バイトを使用していましたが、現在は頂点ごとに12バイトを使用しており、40％の節約になります。そして、インスタンスごとに24バイトを使用していましたが、現在は12バイトを使用しており、50％の節約になります。

{{{example url="../webgpu-vertex-buffers-8bit-colors.html"}}}

構造体を使用する必要はないことに注意してください。これも同様に機能します。

```WGSL
@vertex fn vs(
-  vert: Vertex,
+  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.position = vec4f(
+      position * scale + offset, 0.0, 1.0);
+  vsOut.color = color * vec4f(perVertexColor, 1);
  return vsOut;
}
```

繰り返しになりますが、WebGPUが気にするのは、シェーダーで`locations`を定義し、APIを介してそれらの場所にデータを提供することだけです。

## <a id="a-index-buffers"></a>インデックスバッファ

ここで説明する最後のことは、インデックスバッファです。インデックスバッファは、頂点を処理して使用する順序を記述します。

`draw`は、頂点を順番に処理すると考えることができます。

```
0, 1, 2, 3, 4, 5, .....
```

インデックスバッファを使用すると、その順序を変更できます。

円のサブディビジョンごとに6つの頂点を作成していましたが、そのうち2つは同一でした。

<div class="webgpu_center"><img src="resources/vertices-non-indexed.svg" style="width: 400px"></div>  

代わりに、4つだけ作成し、インデックスを使用して、WebGPUに次の順序でインデックスを描画するように指示することで、それらの4つの頂点を6回使用します。

```
0, 1, 2, 2, 1, 3, ...
```

<div class="webgpu_center"><img src="resources/vertices-indexed.svg" style="width: 400px"></div>

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 1つのサブディビジョンあたり2つの三角形、1つの三角形あたり3つの頂点
-  const numVertices = numSubdivisions * 3 * 2;
+  // 各サブディビジョンに2つの頂点、+円を一周するための1つ。
+  const numVertices = (numSubdivisions + 1) * 2;
  // 位置（xy）に2つの32ビット値、色（rgb）に1つの32ビット値
  // 32ビットの色値は、4つの8ビット値として書き込み/読み取りされます
  const vertexData = new Float32Array(numVertices * (2 + 1));
  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
+  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
+    offset += 1;  // 色をスキップします
+    colorData[colorOffset++] = r * 255;
+    colorData[colorOffset++] = g * 255;
+    colorData[colorOffset++] = b * 255;
+    colorOffset += 9;  // 余分なバイトと位置をスキップします
  };
+  const innerColor = [1, 1, 1];
+  const outerColor = [0.1, 0.1, 0.1];

-  // 1つのサブディビジョンあたり2つの三角形
-  //
-  // 0--1 4
-  // | / /|
-  // |/ / |
-  // 2 3--5
-  for (let i = 0; i < numSubdivisions; ++i) {
-    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
-    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;
-
-    const c1 = Math.cos(angle1);
-    const s1 = Math.sin(angle1);
-    const c2 = Math.cos(angle2);
-    const s2 = Math.sin(angle2);
-
-    // 最初の三角形
-    addVertex(c1 * radius, s1 * radius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c1 * innerRadius, s1 * innerRadius);
-
-    // 2番目の三角形
-    addVertex(c1 * innerRadius, s1 * innerRadius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c2 * innerRadius, s2 * innerRadius);
-  }
+  // 1つのサブディビジョンあたり2つの三角形
+  //
+  // 0  2  4  6  8 ...
+  //
+  // 1  3  5  7  9 ...
+  for (let i = 0; i <= numSubdivisions; ++i) {
+    const angle = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
+
+    const c1 = Math.cos(angle);
+    const s1 = Math.sin(angle);
+
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+  }

+  const indexData = new Uint32Array(numSubdivisions * 6);
+  let ndx = 0;
+
+  // 1番目の三角形  2番目の三角形  3番目の三角形  4番目の三角形
+  // 0 1 2    2 1 3    2 3 4    4 3 5
+  //
+  // 0--2        2     2--4        4  .....
+  // | /        /|     | /        /|
+  // |/        / |     |/        / |
+  // 1        1--3     3        3--5  .....
+  for (let i = 0; i < numSubdivisions; ++i) {
+    const ndxOffset = i * 2;
+
+    // 最初の三角形
+    indexData[ndx++] = ndxOffset;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 2;
+
+    // 2番目の三角形
+    indexData[ndx++] = ndxOffset + 2;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 3;
+  }

  return {
    vertexData,
+    indexData,
-    numVertices,
+    numVertices: indexData.length,
  };
}
```

次に、インデックスバッファを作成する必要があります。

```js
-  const { vertexData, numVertices } = createCircleVertices({
+  const { vertexData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+  const indexBuffer = device.createBuffer({
+    label: 'index buffer',
+    size: indexData.byteLength,
+    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(indexBuffer, 0, indexData);
```

使用法を`INDEX`に設定したことに注意してください。

最後に、描画時にインデックスバッファを指定する必要があります。

```js
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, staticVertexBuffer);
    pass.setVertexBuffer(2, changingVertexBuffer);
+    pass.setIndexBuffer(indexBuffer, 'uint32');
```

バッファには32ビット符号なし整数インデックスが含まれているため、ここで`'uint32'`を渡す必要があります。16ビット符号なしインデックスを使用することもでき、その場合は`'uint16'`を渡します。

そして、`draw`の代わりに`drawIndexed`を呼び出す必要があります。

```js
-    pass.draw(numVertices, kNumObjects);
+    pass.drawIndexed(numVertices, kNumObjects);
```

これで、スペースを少し節約し（33％）、頂点シェーダーで頂点を計算するときの処理も同様に節約できる可能性があります。GPUがすでに計算した頂点を再利用できる可能性があるためです。

{{{example url="../webgpu-vertex-buffers-index-buffer.html"}}}

[前の記事](webgpu-storage-buffers.html)のストレージバッファの例で、インデックスバッファを使用することもできたことに注意してください。その場合、渡される`@builtin(vertex_index)`の値は、インデックスバッファのインデックスと一致します。

次は[テクスチャ](webgpu-textures.html)について説明します。