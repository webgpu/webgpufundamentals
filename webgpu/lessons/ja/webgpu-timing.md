Title: WebGPU タイミングパフォーマンス
Description: WebGPUでのタイミング操作
TOC: タイミングパフォーマンス

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

パフォーマンスのために時間を計りたいと思うかもしれないさまざまなことについて説明します。3つのことを計時します。

* 1秒あたりのフレーム数（fps）でのフレームレート
* フレームごとにJavaScriptで費やされた時間
* フレームごとにGPUで費やされた時間

まず、[頂点バッファに関する記事](webgpu-vertex-buffers.html)から円の例を取り上げ、物事にかかる時間の変化を簡単に見ることができるようにアニメーション化しましょう。

その例では、3つの頂点バッファがありました。1つは円の頂点の位置と明るさ用でした。1つはインスタンスごとですが静的なもので、円のオフセットと色が含まれていました。そして、最後の1つは、レンダリングするたびに変化するもので、この場合は、ユーザーがウィンドウのサイズを変更したときに円が楕円ではなく円のままであるように、円のアスペクト比を正しく保つためのスケールでした。

それらを動かしてアニメーション化したいので、オフセットをスケールと同じバッファに移動しましょう。まず、レンダーパイプラインを変更して、オフセットをスケールと同じバッファに移動します。

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
-          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
+          arrayStride: 4, // 4 bytes
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
-            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
          ],
        },
        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+            {shaderLocation: 2, offset: 0, format: 'float32x2'},  // offset
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+            {shaderLocation: 3, offset: 8, format: 'float32x2'},   // scale
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

次に、頂点バッファを設定する部分を変更して、オフセットをスケールと一緒に移動します。

```js
  // 2つの頂点バッファを作成します
  const staticUnitSize =
-    4 +     // colorは4バイトです
-    2 * 4;  // offsetは2つの32ビット浮動小数点数（各4バイト）です
+    4;     // colorは4バイトです
  const changingUnitSize =
-    2 * 4;  // scaleは2つの32ビット浮動小数点数（各4バイト）です
+    2 * 4 + // offsetは2つの32ビット浮動小数点数（各4バイト）です
+    2 * 4;  // scaleは2つの32ビット浮動小数点数（各4バイト）です
  const staticVertexBufferSize = staticUnitSize * kNumObjects;
  const changingVertexBufferSize = changingUnitSize * kNumObjects;

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const changingVertexBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
-  const kOffsetOffset = 1;
+
-  const kScaleOffset = 0;
+  const kOffsetOffset = 0;
+  const kScaleOffset = 2;

  {
    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
-    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffsetU8 = i * staticUnitSize;
-      const staticOffsetF32 = staticOffsetU8 / 4;

      // これらは一度だけ設定されるので、今すぐ設定します
      staticVertexValuesU8.set(        // 色を設定します
          [rand() * 255, rand() * 255, rand() * 255, 255],
          staticOffsetU8 + kColorOffset);

-      staticVertexValuesF32.set(      // オフセットを設定します
-          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
-          staticOffsetF32 + kOffsetOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
+        offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
+        velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
      });
    }
-    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
+    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesU8);
  }
```

レンダリング時に、円のオフセットを速度に基づいて更新し、それらをGPUにアップロードできます。

```js
+  const euclideanModulo = (x, a) => x - a * Math.floor(x / a);

+  let then = 0;
-  function render() {
  function render(now) {
+    now *= 0.001;  // 秒に変換します
+    const deltaTime = now - then;
+    then = now;

...
      // 各オブジェクトのスケールとオフセットを設定します
-    objectInfos.forEach(({scale}, ndx) => {
-      const offset = ndx * (changingUnitSize / 4);
-      vertexValues.set([scale / aspect, scale], offset + kScaleOffset); // スケールを設定します
+    objectInfos.forEach(({scale, offset, veloctiy}, ndx) => {
+      // -1.5から1.5
+      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
+      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

+      const off = ndx * (changingUnitSize / 4);
+      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
-    });
+    }

...

+    requestAnimationFrame(render);
  }
+  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      // 再レンダリング
-      render();
    }
  });
  observer.observe(canvas);
```

rAFループにも切り替えました[^rAF]。

[^rAF]: `rAF`は`requestAnimationFrame`の略です。

<a id="a-euclidianModulo"></a>上記のコードは、オフセットを更新するために`euclideanModulo`を使用します。`euclideanModulo`は、除算の余りを返します。余りは常に正で、同じ方向になります。たとえば、

<div class="webgpu_center">
  <div class="center">
    <div class="data-table center" data-table='{
  "cols": ["value", "% operator", "euclideanModulo"],
  "classNames": ["a", "b", "c"],
  "rows": [
    [ "0.3", "0.3", "0.3" ],
    [ "2.3", "0.3", "0.3" ],
    [ "4.3", "0.3", "0.3" ],
    [ "-1.7", "-1.7", "0.3" ],
    [ "-3.7", "-1.7", "0.3" ]
  ]
}'>
     </div>
  </div>
  <div>%とeuclideanModuloの2の剰余</div>
</div>

別の言い方をすれば、`%`演算子と`euclideanModulo`のグラフは次のとおりです。

<div class="webgpu_center">
  <img style="width: 700px" src="resources/euclidean-modulo.svg">
  <div>euclideanModule(v, 2)</div>
</div>
<div class="webgpu_center">
  <img  style="width: 700px" src="resources/modulo.svg">
  <div>v % 2</div>
</div>

したがって、上記のコードは、クリップ空間にあるオフセットを取得し、1.5を加算します。次に、3でユークリッド剰余を取り、0.0から3.0の間にラップされた数値を取得し、1.5を減算します。これにより、-1.5から+1.5の間の数値を維持し、反対側にラップさせることができます。円が画面外に出るまでラップしないように、-1.5から+1.5を使用します。[^offscreen]

[^offscreen]: これは、円の半径が0.5未満の場合にのみ機能しますが、サイズの複雑なチェックでコードを肥大化させないのが最善だと思われました。

調整するものを提供するために、描画する円の数を設定できるようにしましょう。

```js
-  const kNumObjects = 100;
+  const kNumObjects = 10000;


...

  const settings = {
    numObjects: 100,
  };

  const gui = new GUI();
  gui.add(settings, 'numObjects', 0, kNumObjects, 1);

  ...

    // 各オブジェクトのスケールとオフセットを設定します
-    objectInfos.forEach(({scale, offset, veloctiy}, ndx) => {
+    for (let ndx = 0; ndx < settings.numObjects; ++ndx) {
+      const {scale, offset, velocity} = objectInfos[ndx];

      // -1.5から1.5
      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

      const off = ndx * (changingUnitSize / 4);
      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
-    });
+    }

    // すべてのオフセットとスケールを一度にアップロードします
-    device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues);
+    device.queue.writeBuffer(
        changingVertexBuffer, 0,
        vertexValues, 0, settings.numObjects * changingUnitSize / 4);

-    pass.draw(numVertices, kNumObjects);
+    pass.draw(numVertices, settings.numObjects);
```

これで、アニメーション化され、円の数を設定して作業量を調整できるものができました。

{{{example url="../webgpu-timing-animated.html"}}}

それに、1秒あたりのフレーム数（fps）とJavaScriptで費やされた時間を追加しましょう。

まず、この情報を表示する方法が必要です。キャンバスの上に配置された`<pre>`要素を追加しましょう。

```html
  <body>
    <canvas></canvas>
+    <pre id="info"></pre>
  </body>
```

```css
html, body {
  margin: 0;       /* デフォルトのマージンを削除 */
  height: 100%;    /* html,bodyがページを埋めるようにする */
}
canvas {
  display: block;  /* canvasをブロックのように動作させる */
  width: 100%;     /* canvasがコンテナを埋めるようにする */
  height: 100%;
}
+#info {
+  position: absolute;
+  top: 0;
+  left: 0;
+  margin: 0;
+  padding: 0.5em;
+  background-color: rgba(0, 0, 0, 0.8);
+  color: white;
+}
```

1秒あたりのフレーム数を表示するために必要なデータはすでにあります。上記で計算した`deltaTime`です。

JavaScriptの時間については、`requestAnimationFrame`が開始された時間と終了した時間を記録できます。

```js
  let then = 0;
  function render(now) {
    now *= 0.001;  // 秒に変換します
    const deltaTime = now - then;
    then = now;

+    const startTime = performance.now();

    ...

+    const jsTime = performance.now() - startTime;

+    infoElem.textContent = `\
+fps: ${(1 / deltaTime).toFixed(1)}
+js: ${jsTime.toFixed(1)}ms
+`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

そして、最初の2つのタイミング測定値が得られます。

{{{example url="../webgpu-timing-with-fps-js-time.html"}}}

## <a id="a-timestamp-query"></a>GPUのタイミング

WebGPUは、GPUでの操作にかかる時間を確認するための**オプション**の`'timestamp-query'`機能を提供します。オプション機能なので、[制限と機能に関する記事](webgpu-limits-and-features.html)で説明したように、それが存在するかどうかを確認して要求する必要があります。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const canTimestamp = adapter.features.has('timestamp-query');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: [
+      ...(canTimestamp ? ['timestamp-query'] : []),
+     ],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

上記では、アダプターが`'timestamp-query'`機能をサポートしているかどうかに基づいて`canTimestamp`をtrueまたはfalseに設定します。サポートしている場合は、デバイスを作成するときにその機能を要求します。

この機能を有効にすると、レンダーパスまたはコンピュートパスの*タイムスタンプ*をWebGPUに要求できます。これを行うには、`GPUQuerySet`を作成し、コンピュートまたはレンダーパスに追加します。`GPUQuerySet`は、事実上、クエリ結果の配列です。パスが開始された時間を記録する配列内の要素と、パスが終了したときに記録する配列内の要素をWebGPUに伝えます。次に、それらのタイムスタンプをバッファにコピーし、バッファをマップして結果を読み取ることができます。[^mapping-not-necessary]

[^mapping-not-necessary]: クエリ結果をマップ可能なバッファにコピーするのは、JavaScriptから値を読み取る目的でのみです。ユースケースが結果をGPU上に保持することのみを必要とする場合、たとえば、他の何かの入力として、結果をマップ可能なバッファにコピーする必要はありません。

したがって、まずクエリセットを作成します。

```js
  const querySet = device.createQuerySet({
     type: 'timestamp',
     count: 2,
  });
```

開始と終了の両方のタイムスタンプを書き込むことができるように、カウントは少なくとも2である必要があります。

クエリセット情報をアクセス可能なデータに変換するためのバッファが必要です。

```js
  const resolveBuffer = device.createBuffer({
    size: querySet.count * 8,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
```

クエリセットの各要素は8バイトかかります。`QUERY_RESOLVE`の使用法を指定する必要があり、JavaScriptで結果を読み取ることができるようにしたい場合は、結果をマップ可能なバッファにコピーできるように`COPY_SRC`の使用法が必要です。

最後に、結果を読み取るためのマップ可能なバッファを作成します。

```js
  const resultBuffer = device.createBuffer({
    size: resolveBuffer.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
```

このコードを、機能が存在する場合にのみこれらのものを作成するようにラップする必要があります。そうしないと、`'timestamp'`クエリセットを作成しようとするとエラーが発生します。

```js
+  const { querySet, resolveBuffer, resultBuffer } = (() => {
+    if (!canTimestamp) {
+      return {};
+    }

    const querySet = device.createQuerySet({
       type: 'timestamp',
       count: 2,
    });
    const resolveBuffer = device.createBuffer({
      size: querySet.count * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const resultBuffer = device.createBuffer({
      size: resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
+    return {querySet, resolveBuffer, resultBuffer };
+  })();
```

レンダーパス記述子で、使用するクエリセットと、開始と終了のタイムスタンプを書き込むクエリセット内の要素のインデックスを指定します。

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass with timing',
    colorAttachments: [
      {
        // view: <- レンダリング時に設定されます
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    ...(canTimestamp && {
      timestampWrites: {
        querySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      },
    }),
  };
```

上記では、機能が存在する場合、レンダーパス記述子に`timestampWrites`セクションを追加し、クエリセットを渡し、開始をセットの要素0に、終了を要素1に書き込むように指示します。

パスを終了した後、`resolveQuerySet`を呼び出す必要があります。これにより、クエリの結果が取得され、バッファに入れられます。クエリセット、解決を開始するクエリセットの最初のインデックス、解決するエントリの数、解決先のバッファ、および結果を格納するバッファ内のオフセットを渡します。

```js
    pass.end();

+    if (canTimestamp) {
+      encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
+    }
```

また、`resolveBuffer`を`resultsBuffer`にコピーして、マップしてJavaScriptで結果を確認できるようにしたいです。ただし、問題があります。マップされている間は`resultsBuffer`にコピーできません。幸いなことに、バッファには確認できる`mapState`プロパティがあります。`unmapped`（開始時の値）に設定されている場合は、コピーしても安全です。他の値は`'pending'`（`mapAsync`を呼び出した瞬間の値）と`'mapped'`（`mapAsync`が解決されたときの値）です。`unmap`すると、`'unmapped'`に戻ります。

```js
    if (canTimestamp) {
      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
+      if (resultBuffer.mapState === 'unmapped') {
+        encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
+      }
    }
```

コマンドバッファを送信した後、`resultBuffer`をマップできます。上記と同様に、`'unmapped'`の場合にのみマップしたいです。

```js
+  let gpuTime = 0;

   ...

   function render(now) {

    ...

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
+      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
+        const times = new BigInt64Array(resultBuffer.getMappedRange());
+        gpuTime = Number(times[1] - times[0]);
+        resultBuffer.unmap();
+      });
+    }
```

クエリセットの結果はナノ秒単位であり、64ビット整数で格納されます。JavaScriptでそれらを読み取るには、`BigInt64Array`型付き配列ビューを使用できます。`BigInt64Array`を使用するには、特別な注意が必要です。`BitInt64Array`から要素を読み取ると、型は`number`ではなく`bigint`になるため、多くの数学関数では使用できません。また、数値に変換すると、`number`は53ビットのサイズの整数しか保持できないため、精度が失われる可能性があります。したがって、まず2つの`bigint`を減算します。これは`bigint`のままです。次に、結果を数値に変換して、通常どおり使用できるようにします。

上記のコードでは、マップされていない場合にのみ、結果を`resultBuffer`にコピーしています。つまり、一部のフレームでのみ時間を読み取ることになります。おそらく他のすべてのフレームですが、`mapAsync`が解決されるまでにかかる時間については厳密な保証はありません。そのため、いつでも最後に記録された時間を取得するために使用できる`gpuTime`を更新します。

```js
    infoElem.textContent = `\
fps: ${(1 / deltaTime).toFixed(1)}
js: ${jsTime.toFixed(1)}ms
+gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
`;
```

そして、WebGPUからGPU時間を取得します。

{{{example url="../webgpu-timing-with-timestamp.html"}}}

私の場合、数値が頻繁に変化するため、有用なものは何も見えません。これを修正する1つの方法は、移動平均を計算することです。移動平均を計算するのに役立つクラスを次に示します。

```js
// 注：これはタイムスタンプクエリに使用されるため、負の値は許可しません。
// クエリが終了時間より大きい開始時間を返す可能性があるためです。参照：https://gpuweb.github.io/gpuweb/#timestamp
class NonNegativeRollingAverage {
  #total = 0;
  #samples = [];
  #cursor = 0;
  #numSamples;
  constructor(numSamples = 30) {
    this.#numSamples = numSamples;
  }
  addSample(v) {
    if (!Number.isNaN(v) && Number.isFinite(v) && v >= 0) {
      this.#total += v - (this.#samples[this.#cursor] || 0);
      this.#samples[this.#cursor] = v;
      this.#cursor = (this.#cursor + 1) % this.#numSamples;
    }
  }
  get() {
    return this.#total / this.#samples.length;
  }
}
```

値の配列と合計を保持します。新しい値が追加されると、新しい値が追加されるときに、最も古い値が合計から減算されます。

次のように使用できます。

```js
+const fpsAverage = new NonNegativeRollingAverage();
+const jsAverage = new NonNegativeRollingAverage();
+const gpuAverage = new NonNegativeRollingAverage();

function render(now) {
  ...

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const times = new BigInt64Array(resultBuffer.getMappedRange());
        gpuTime = Number(times[1] - times[0]);
+        gpuAverage.addSample(gpuTime / 1000);
        resultBuffer.unmap();
      });
    }

    const jsTime = performance.now() - startTime;

+    fpsAverage.addSample(1 / deltaTime);
+    jsAverage.addSample(jsTime);

    infoElem.textContent = `\
-fps: ${(1 / deltaTime).toFixed(1)}
-js: ${jsTime.toFixed(1)}ms
-gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
+fps: ${fpsAverage.get().toFixed(1)}
+js: ${jsAverage.get().toFixed(1)}ms
+gpu: ${canTimestamp ? `${gpuAverage.get().toFixed(1)}µs` : 'N/A'}
`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
```

そして、今では数値が少し安定しています。

{{{example url="../webgpu-timing-with-timestamp-w-average.html"}}}

## <a id="a-timing-helper"></a>ヘルパーの使用

私にとって、これはすべて少し面倒で、何かを間違えやすいと思います。クエリセットと2つのバッファの3つを作成する必要がありました。レンダーパス記述子を変更する必要がありました。結果を解決し、マップ可能なバッファにコピーする必要がありました。

これをあまり面倒でなくする1つの方法は、タイミングを行うのに役立つクラスを作成することです。これらの問題のいくつかに役立つ可能性のあるヘルパーの1つの例を次に示します。

```js
function assert(cond, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}

// コマンドバッファを追跡して、コマンドバッファが実行される前に
// 結果を読み取ろうとするとエラーを生成できるようにします。
const s_unsubmittedCommandBuffer = new Set();

/* global GPUQueue */
GPUQueue.prototype.submit = (function(origFn) {
  return function(commandBuffers) {
    origFn.call(this, commandBuffers);
    commandBuffers.forEach(cb => s_unsubmittedCommandBuffer.delete(cb));
  };
})(GPUQueue.prototype.submit);

// https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html を参照してください
export default class TimingHelper {
  #canTimestamp;
  #device;
  #querySet;
  #resolveBuffer;
  #resultBuffer;
  #commandBuffer;
  #resultBuffers = [];
  // stateは'free'、'need resolve'、'wait for result'のいずれかになります
  #state = 'free';

  constructor(device) {
    this.#device = device;
    this.#canTimestamp = device.features.has('timestamp-query');
    if (this.#canTimestamp) {
      this.#querySet = device.createQuerySet({
         type: 'timestamp',
         count: 2,
      });
      this.#resolveBuffer = device.createBuffer({
        size: this.#querySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
    }
  }

  #beginTimestampPass(encoder, fnName, descriptor) {
    if (this.#canTimestamp) {
      assert(this.#state === 'free', 'state not free');
      this.#state = 'need resolve';

      const pass = encoder[fnName]({
        ...descriptor,
        ...{
          timestampWrites: {
            querySet: this.#querySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        },
      });

      const resolve = () => this.#resolveTiming(encoder);
      const trackCommandBuffer = (cb) => this.#trackCommandBuffer(cb);
      pass.end = (function(origFn) {
        return function() {
          origFn.call(this);
          resolve();
        };
      })(pass.end);

      encoder.finish = (function(origFn) {
        return function() {
          const cb = origFn.call(this);
          trackCommandBuffer(cb);
          return cb;
        };
      })(encoder.finish);

      return pass;
    } else {
      return encoder[fnName](descriptor);
    }
  }

  beginRenderPass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginRenderPass', descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginComputePass', descriptor);
  }

  #trackCommandBuffer(cb) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(this.#state === 'need finish', 'you must call encoder.finish');
    this.#commandBuffer = cb;
    s_unsubmittedCommandBuffer.add(cb);
    this.#state = 'wait for result';
  }

  #resolveTiming(encoder) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(
      this.#state === 'need resolve',
      'you must use timerHelper.beginComputePass or timerHelper.beginRenderPass',
    );
    this.#state = 'need finish';

    this.#resultBuffer = this.#resultBuffers.pop() || this.#device.createBuffer({
      size: this.#resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.resolveQuerySet(this.#querySet, 0, this.#querySet.count, this.#resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.#resolveBuffer, 0, this.#resultBuffer, 0, this.#resultBuffer.size);
  }

  async getResult() {
    if (!this.#canTimestamp) {
      return 0;
    }
    assert(
      this.#state === 'wait for result',
      'you must call encoder.finish and submit the command buffer before you can read the result',
    );
    assert(!!this.#commandBuffer); // internal check
    assert(
      !s_unsubmittedCommandBuffer.has(this.#commandBuffer),
      'you must submit the command buffer before you can read the result',
    );
    this.#commandBuffer = undefined;
    this.#state = 'free';

    const resultBuffer = this.#resultBuffer;
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigInt64Array(resultBuffer.getMappedRange());
    const duration = Number(times[1] - times[0]);
    resultBuffer.unmap();
    this.#resultBuffers.push(resultBuffer);
    return duration;
  }
}
```

アサートは、このクラスを間違って使用しないようにするためのものです。たとえば、パスを終了しても解決しない場合や、解決して結果を読み取ろうとしても送信していない場合などです。

このクラスを使用すると、以前にあったコードの多くを削除できます。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const canTimestamp = adapter.features.has('timestamp-query');
  const device = await adapter?.requestDevice({
    requiredFeatures: [
      ...(canTimestamp ? ['timestamp-query'] : []),
     ],
  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

+  const timingHelper = new TimingHelper(device);

  ...

-  const { querySet, resolveBuffer, resultBuffer } = (() => {
-    if (!canTimestamp) {
-      return {};
-    }
-
-    const querySet = device.createQuerySet({
-       type: 'timestamp',
-       count: 2,
-    });
-    const resolveBuffer = device.createBuffer({
-      size: querySet.count * 8,
-      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
-    });
-    const resultBuffer = device.createBuffer({
-      size: resolveBuffer.size,
-      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
-    });
-    return {querySet, resolveBuffer, resultBuffer };
-  })();

  ...

  function render(now) {

    ...

-    const pass = encoder.beginRenderPass(renderPassEncoder);
+    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);

    ...

    pass.end();

    -if (canTimestamp) {
    -  encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
    -  if (resultBuffer.mapState === 'unmapped') {
    -    encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
    -  }
    -}

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    timingHelper.getResult().then(gpuTime => {
+        gpuAverage.addSample(gpuTime / 1000);
+    });

    ...
```

{{{example url="../webgpu-timing-with-timing-helper.html"}}}

`TimingHelper`クラスに関するいくつかの点：

* デバイスを作成するときに、`'timestamp-query'`機能をまだ手動で要求する必要がありますが、クラスはデバイスに存在するかどうかを処理します。

* `timerHelper.beginRenderPass`または`timerHelper.beginComputePass`を呼び出すと、パス記述子に適切なプロパティが自動的に追加されます。また、`end`関数がクエリを自動的に解決するパスエンコーダーも返します。

* 間違って使用すると文句を言うように設計されています。

* 1つのパスしか処理しません。

  ここには多くのトレードオフがあり、さらに調査しないと、何が最善かは明らかではありません。

  複数のパスを処理するクラスは便利かもしれませんが、理想的には、パスごとに1つの`GPUQuerySet`ではなく、すべてのパスに十分なスペースを持つ単一の`GPUQuerySet`を使用します。

  しかし、そのためには、ユーザーに使用するパスの最大数を事前に伝えるか、コードをより複雑にして、小さな`GPUQuerySet`で開始し、さらに使用する場合はそれを削除して新しい大きなものを作成する必要があります。しかし、少なくとも1フレームについては、複数の`GPUQuerySet`を持つことを処理する必要があります。

  これらすべてはやり過ぎに思えたので、今のところは1つのパスを処理するようにし、変更する必要があると判断するまで、その上に構築できます。

`NoTimingHelper`を作成することもできます。

```js
class NoTimingHelper {
  constructor() { }
  beginRenderPass(encoder, descriptor = {}) {
    return encoder.beginTimestampPass(descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return encoder.beginComputePass(descriptor);
  }
  async getResult() { return 0; }
}
```

タイミングを追加して、あまり多くのコードを変更せずにオフにできるようにする1つの可能な方法として。

いずれにせよ、`TimingHelper`クラスを使用して、[画像ヒストグラムを計算するためのコンピュートシェーダーの使用に関する記事](webgpu-compute-shaders-histogram.html)のさまざまな例を計時しました。それらのリストは次のとおりです。ビデオの例のみが継続的に実行されるため、おそらく最良の例です。

* <a target="_blank" href="../webgpu-compute-shaders-histogram-video-w-timing.html">4チャネルビデオヒストグラム</a>

残りは一度だけ実行され、結果をJavaScriptコンソールに出力します。

* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-optimized-more-w-timing.html">リデュース付きのチャンクヒストグラムごとの4チャネルワークグループ</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-race-fixed-w-timing.html">ピクセルヒストグラムごとの4チャネルワークグループ</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-javascript-w-timing.html">4チャネルJavaScriptヒストグラム</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-more-w-timing.html">リデュース付きのチャンクヒストグラムごとの1チャネルワークグループ</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-w-timing.html">合計付きのチャンクヒストグラムごとの1チャネルワークグループ</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-race-fixed-w-timing.html">ピクセルヒストグラムごとの1チャネルワークグループ</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-slow-w-timing.html">1チャネルシングルコアヒストグラム</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-javascript-w-timing.html">1チャネルJavaScriptヒストグラム</a>

# <a id="a-implementation-defined"></a>重要：`timestamp-query`の結果は実装定義です

これは、デバッグや手法の比較に使用できますが、すべてのユーザーに対して同様の結果を返すことを信頼できないことを意味します。相対的な結果さえも想定できません。異なるGPUは異なる方法で動作し、パス全体でレンダリングと計算を最適化できます。つまり、あるマシンでは、最初のパスで100個のものを描画するのに200µsかかり、2番目のパスで200個のものを描画するのに200µsかかる場合がありますが、別のGPUでは、最初の100個のものを描画するのに100µs、2番目の100個のものを描画するのに200µsかかる場合があります。したがって、最初のGPUの相対的な差は0µsでしたが、2番目のGPUの相対的な差は100µsでした。両方のGPUに同じものを描画するように依頼したにもかかわらずです。

<div class="webgpu_bottombar">デフォルトでは、<code>'timestamp-query'</code>の時間値は100µ秒に量子化されます。Chromeでは、<a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">about:flags</a>で<a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">「enable-webgpu-developer-features」</a>を有効にすると、時間値が量子化されない場合があります。これにより、理論的にはより正確なタイミングが得られます。とはいえ、通常、100µ秒の量子化された値は、パフォーマンスのためにシェーダー手法を比較するのに十分なはずです。
</div>

