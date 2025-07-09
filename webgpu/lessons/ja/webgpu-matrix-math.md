Title: WebGPU 行列演算
Description: 行列演算ですべてが単純化される
TOC: 行列演算

この記事は、3D数学について学ぶことを目的とした一連の記事の4番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html) ⬅ ここです
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

過去3回の投稿では、頂点位置を[平行移動](webgpu-translation.html)、[回転](webgpu-rotation.html)、[スケーリング](webgpu-scale.html)する方法について説明しました。平行移動、回転、スケーリングは、それぞれ*変換*の一種と見なされます。これらの各変換にはシェーダーの変更が必要であり、3つの変換のそれぞれは順序に依存していました。

[前の例](webgpu-scale.html)では、スケーリング、回転、平行移動の順に適用しました。それらを異なる順序で適用すると、異なる結果が得られます。

たとえば、これは2、1のスケール、30度の回転、100、0の平行移動です。

<img src="resources/f-scale-rotation-translation.svg" class="webgpu_center" width="400" />

そして、これは100,0の平行移動、30度の回転、2,1のスケールです。

<img src="resources/f-translation-rotation-scale.svg" class="webgpu_center" width="400" />

結果はまったく異なります。さらに悪いことに、2番目の例が必要な場合は、平行移動、回転、スケーリングを新しい目的の順序で適用する別のシェーダーを作成する必要があります。

さて、賢い人たちが、行列演算ですべて同じことができる方法を見つけ出しました。2Dの場合、3x3行列を使用します。3x3行列は、9つのボックスを持つグリッドのようなものです。

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">4</td>
      <td class="m13">7</td>
    </tr>
    <tr>
      <td class="m21">2</td>
      <td class="m22">5</td>
      <td class="m23">8</td>
    </tr>
    <tr>
      <td class="m31">3</td>
      <td class="m32">6</td>
      <td class="m33">9</td>
    </tr>
  </table>
</div>

計算を行うには、行列の行全体に位置を乗算し、結果を合計します。

<div class="webgpu_center"><img src="resources/matrix-vector-math.svg" class="noinvertdark" style="width: 1000px;"></div>

私たちの位置にはxとyの2つの値しかありませんが、この計算を行うには3つの値が必要なので、3番目の値には1を使用します。

この場合、結果は次のようになります。

<div class="glocal-center">
  <p>newX = x * <span class="m11">1</span> + y * <span class="m12">4</span> + 1 * <span class="m13">7</span></p>
  <p>newY = x * <span class="m21">2</span> + y * <span class="m22">5</span> + 1 * <span class="m23">8</span></p>
  <p>newZ = x * <span class="m31">3</span> + y * <span class="m32">6</span> + 1 * <span class="m33">9</span></p>
</div>

あなたはおそらくそれを見て、「何の意味があるの？」と思っているでしょう。さて、平行移動があると仮定しましょう。平行移動したい量をtxとtyと呼びます。次のような行列を作成しましょう。

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">0</td>
      <td class="m13">tx</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">1</td>
      <td class="m23">ty</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

そして、今すぐ確認してください。

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">1</span> + y * <span class="m12">0</span> + 1 * <span class="m13">tx</span></div>
    <div>newY = x * <span class="m21">0</span> + y * <span class="m22">1</span> + 1 * <span class="m23">ty</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

代数を覚えているなら、ゼロで乗算する場所はすべて削除できます。1で乗算しても実質的に何も起こらないので、何が起こっているのかを単純化して見てみましょう。

<div class="glocal-center">
  <div class="eq">
    <div>newX = x <div class="blk">* <span class="m11">1</span></div> + <div class="blk">y * <span class="m12">0</span> + 1 * </div><span class="m13">tx</span></div>
    <div>newY = <div class="blk">x * <span class="m21">0</span> +</div> y <div class="blk">* <span class="m22">1</span></div> + <div class="blk">1 * </div><span class="m23">ty</span></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

または、より簡潔に

<div class="webgpu_center"><pre class="webgpu_math">
newX = x + tx;
newY = y + ty;
</pre></div>

そして、newZはあまり気にしません。

これは、[平行移動の例の平行移動コード](webgpu-translation.html)と驚くほど似ています。

同様に、回転を行いましょう。回転の投稿で指摘したように、回転させたい角度のサインとコサインが必要なだけなので、

<div class="webgpu_center"><pre class="webgpu_math">
s = Math.sin(angleToRotateInRadians);
c = Math.cos(angleToRotateInRadians);
</pre></div>

そして、次のような行列を作成します。

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">c</td>
      <td class="m12">-s</td>
      <td class="m13">0</td>
    </tr>
    <tr>
      <td class="m21">s</td>
      <td class="m22">c</td>
      <td class="m23">0</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

行列を適用すると、次のようになります。

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">c</span> + y * <span class="m12">-s</span> + 1 * <span class="m13">0</span></div>
    <div>newY = x * <span class="m21">s</span> + y * <span class="m22">c</span> + 1 * <span class="m23">0</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

0と1で乗算するものをすべて黒く塗りつぶすと、次のようになります。

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">c</span> + y * <span class="m12">-s</span><div class="blk"> + 1 * <span class="m13">0</span></div></div>
    <div>newY = x * <span class="m21">s</span> + y * <span class="m22">c</span><div class="blk"> + 1 * <span class="m23">0</span></div></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

そして、単純化すると、次のようになります。

<div class="webgpu_center">
<pre class="webgpu_math">
newX = x * c - y * s;
newY = x * s + y * c;
</pre>
</div>

これは、[回転の例](webgpu-rotation.html)にあったものとまったく同じです。

そして最後に、スケールです。2つのスケール係数をsxとsyと呼びます。

そして、次のような行列を作成します。

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">sx</td>
      <td class="m12">0</td>
      <td class="m13">0</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">sy</td>
      <td class="m23">0</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

行列を適用すると、次のようになります。

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">sx</span> + y * <span class="m12">0</span> + 1 * <span class="m13">0</span></div>
    <div>newY = x * <span class="m21">0</span> + y * <span class="m22">sy</span> + 1 * <span class="m23">0</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

これは実際には

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">sx</span><div class="blk"> + y * <span class="m12">0</span> + 1 * <span class="m13">0</span></div></div>
    <div>newY = <div class="blk">x * <span class="m21">0</span> +</div> y * <span class="m22">sy</span><div class="blk"> + 1 * <span class="m23">0</span></div></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

単純化すると、次のようになります。

<div class="webgpu_center">
<pre class="webgpu_math">
newX = x * sx;
newY = y * sy;
</pre>
</div>

これは、[スケーリングの例](webgpu-scale.html)と同じです。

さて、あなたはまだ「それで何？何の意味があるの？」と思っているかもしれません。それは、すでにやっていたのと同じことをするために多くの作業のように思えます。

ここで魔法が登場します。行列を乗算して、すべての変換を一度に適用できることがわかります。2つの行列を受け取り、それらを乗算して結果を返す関数`m3.multiply`があると仮定しましょう。

```js
const mat3 = {
  multiply: function(a, b) {
    const a00 = a[0 * 3 + 0];
    const a01 = a[0 * 3 + 1];
    const a02 = a[0 * 3 + 2];
    const a10 = a[1 * 3 + 0];
    const a11 = a[1 * 3 + 1];
    const a12 = a[1 * 3 + 2];
    const a20 = a[2 * 3 + 0];
    const a21 = a[2 * 3 + 1];
    const a22 = a[2 * 3 + 2];
    const b00 = b[0 * 3 + 0];
    const b01 = b[0 * 3 + 1];
    const b02 = b[0 * 3 + 2];
    const b10 = b[1 * 3 + 0];
    const b11 = b[1 * 3 + 1];
    const b12 = b[1 * 3 + 2];
    const b20 = b[2 * 3 + 0];
    const b21 = b[2 * 3 + 1];
    const b22 = b[2 * 3 + 2];

    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ];
  }
}
```

物事を明確にするために、平行移動、回転、スケーリングの行列を作成する関数を作成しましょう。

```js
const mat3 = {
  multiply(a, b) {
    ...
  },
  translation([tx, ty]) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },

  rotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, s, 0,
      -s, c, 0,
      0, 0, 1,
    ];
  },

  scaling([sx, sy]) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ];
  },
};
```

次に、シェーダーを行列を使用するように変更しましょう。

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
-  translation: vec2f,
-  rotation: vec2f,
-  scale: vec2f,
+  matrix: mat3x3f,
};

...

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

-  // 位置をスケーリングします
-  let scaledPosition = vert.position * uni.scale;
-
-  // 位置を回転させます
-  let rotatedPosition = vec2f(
-    scaledPosition.x * uni.rotation.x - scaledPosition.y * uni.rotation.y,
-    scaledPosition.x * uni.rotation.y + scaledPosition.y * uni.rotation.x
-  );
-
-  // 平行移動を追加します
-  let position = rotatedPosition + uni.translation;
+  // 行列で乗算します
+  let position = (uni.matrix * vec3f(vert.position, 1)).xy;

  ...
```

上記のように、zに1を渡し、位置を行列で乗算し、結果からxとyだけを保持しました。

繰り返しになりますが、ユニフォームバッファのサイズとオフセットを更新する必要があります。

```js
-  // 色、解像度、平行移動、回転、スケール
-  const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
+  // 色、解像度、パディング、行列
+  const uniformBufferSize = (4 + 2 + 2 + 12) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
  const kResolutionOffset = 4;
  const kMatrixOffset = 8;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
-  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
-  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
-  const scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);
+  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);
```

そして最後に、レンダリング時にいくつかの*行列演算*を行う必要があります。

```js
  function render() {
    ...
+    const translationMatrix = mat3.translation(settings.translation);
+    const rotationMatrix = mat3.rotation(settings.rotation);
+    const scaleMatrix = mat3.scaling(settings.scale);
+
+    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, scaleMatrix);

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
-    translationValue.set(settings.translation);
-    rotationValue.set([
-        Math.cos(settings.rotation),
-        Math.sin(settings.rotation),
-    ]);
-    scaleValue.set(settings.scale);
+    matrixValue.set([
+      ...matrix.slice(0, 3), 0,
+      ...matrix.slice(3, 6), 0,
+      ...matrix.slice(6, 9), 0,
+    ]);
```

これが、新しいコードを使用したものです。スライダーは同じで、平行移動、回転、スケールです。しかし、シェーダーでの使用方法ははるかに単純です。

{{{example url="../webgpu-matrix-math-transform-trs-3x3.html"}}}

## <a id="a-columns-are-rows"></a>列は行です

行列の仕組みの説明では、列で乗算することについて話しました。一例として、この行列を平行移動行列の例として示しました。

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">0</td>
      <td class="m13">tx</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">1</td>
      <td class="m23">ty</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

しかし、実際にコードで行列を作成したときは、次のようにしました。

```js
  translation([tx, ty]) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },
```

`tx, ty, 1`の部分は、最後の列ではなく、最下行にあります。

```js
  translation([tx, ty]) {
    return [
      1, 0, 0,   // <-- 1番目の列
      0, 1, 0,   // <-- 2番目の列
      tx, ty, 1, // <-- 3番目の列
    ];
  },
```


一部のグラフィックスの達人は、これらを列と呼ぶことでこれを解決します。残念ながら、これは慣れるしかないことです。ネット上の数学の本や数学の記事では、`tx, ty, 1`が最後の列にある上の図のような行列が表示されますが、コードに入れるときは、少なくともWebGPUでは、上記のように指定します。

## 行列演算は柔軟です

それでも、あなたは「それで何？それは大した利点ではないように思える」と尋ねているかもしれません。利点は、今、操作の順序を変更したい場合、新しいシェーダーを作成する必要がないことです。JavaScriptで数学を変更するだけです。

```js
-    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
-    matrix = mat3.multiply(matrix, scaleMatrix);
+    let matrix = mat3.multiply(scaleMatrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, translationMatrix);
```

上記では、平行移動→回転→スケールの適用からスケール→回転→平行移動の適用に切り替えました。

{{{example url="../webgpu-matrix-math-transform-srt-3x3.html"}}}

スライダーを操作すると、行列を異なる順序で構成しているため、反応が異なることがわかります。たとえば、平行移動は回転の後に行われます。

<div class="webgpu_center compare" style="justify-content: space-evenly;">
  <div style="flex: 0 0 auto;">
    <div>平行移動→回転→スケール</div>
    <div><div data-diagram="trs"></div></div>
  </div>
  <div style="flex: 0 0 auto;">
    <div>スケール→回転→平行移動</div>
    <div><div data-diagram="srt"></div></div>
  </div>
</div>

左側のものは、スケーリングおよび回転されたFとして説明でき、左右に平行移動されます。一方、右側のものは、平行移動自体が回転およびスケーリングされたものとしてよりよく説明できます。動きは左右ではなく、対角線です。さらに、右側のFは、平行移動自体がスケーリングされているため、それほど遠くまで移動していません。

この柔軟性が、行列演算がほとんどすべてのコンピューターグラフィックスのコアコンポーネントである理由です。

このように行列を適用できることは、体のアームや脚、太陽の周りの惑星の周りの月、木の枝などの階層的なアニメーションに特に重要です。階層的な行列適用の簡単な例として、「F」を5回描画しますが、毎回前の「F」の行列から始めましょう。

これを行うには、5つのユニフォームバッファ、5つのユニフォーム値、5つのバインドグループが必要です。

```js
+  const numObjects = 5;
+  const objectInfos = [];
+  for (let i = 0; i < numObjects; ++i) {
    // 色、解像度、パディング、行列
    const uniformBufferSize = (4 + 2 + 2 + 12) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32インデックスでのさまざまなユニフォーム値へのオフセット
    const kColorOffset = 0;
    const kResolutionOffset = 4;
    const kMatrixOffset = 8;

    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
    const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);

    // 色は変更されないので、初期化時に一度設定しましょう
    colorValue.set([Math.random(), Math.random(), Math.random(), 1]);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer }},
      ],
    });

+    objectInfos.push({
+      uniformBuffer,
+      uniformValues,
+      resolutionValue,
+      matrixValue,
+      bindGroup,
+    });
+  }
```

レンダリング時に、それらをループし、前の行列に平行移動、回転、スケーリング行列を乗算します。

```js
function render() {
  ...

  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(translationMatrix, rotationMatrix);
-  matrix = mat3.multiply(matrix, scaleMatrix);

+  // 開始行列
+  let matrix = mat3.identity();
+
+  for (const {
+    uniformBuffer,
+    uniformValues,
+    resolutionValue,
+    matrixValue,
+    bindGroup,
+  } of objectInfos) {
+    matrix = mat3.multiply(matrix, translationMatrix)
+    matrix = mat3.multiply(matrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, scaleMatrix);

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
    matrixValue.set([
      ...matrix.slice(0, 3), 0,
      ...matrix.slice(3, 6), 0,
      ...matrix.slice(6, 9), 0,
    ]);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(numVertices);
+  }

  pass.end();
```

これを機能させるために、単位行列を作成する関数`mat3.identity`を導入しました。単位行列は、事実上1.0を表す行列であり、単位行列で乗算しても何も起こりません。ちょうど

<div class="webgpu_center"><div class="webgpu_math">X * 1 = X</div></div>

のように

<div class="webgpu_center"><div class="webgpu_math">matrixX * identity = matrixX</div></div>

単位行列を作成するコードは次のとおりです。

```js
const mat3 = {
  ...
  identity() {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
  },

  ...
```

5つのFは次のとおりです。

{{{example url="../webgpu-matrix-math-transform-five-fs-3x3.html"}}}

スライダーをドラッグして、後続の各「F」が前の「F」のサイズと向きに対してどのように描画されるかを確認してください。これは、CG人間の腕が機能する方法であり、腕の回転が前腕に影響を与え、前腕の回転が手よりも影響を与え、手の回転が指に影響を与えるなどです。

## 回転またはスケーリングの中心の変更

もう1つの例を見てみましょう。これまでのすべての例では、「F」は左上隅を中心に回転していました（ただし、上記の順序を逆にした例を除く）。これは、使用している数学が常に原点を中心に回転し、「F」の左上隅が原点（0、0）にあるためです。

しかし、今では、行列演算を行うことができ、変換が適用される順序を選択できるため、原点を移動できます。

```js
    const translationMatrix = mat3.translation(settings.translation);
    const rotationMatrix = mat3.rotation(settings.rotation);
    const scaleMatrix = mat3.scaling(settings.scale);
+    // 「F」の原点をその中心に移動する行列を作成します。
+    const moveOriginMatrix = mat3.translation([-50, -75]);

    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
    matrix = mat3.multiply(matrix, scaleMatrix);
+    matrix = mat3.multiply(matrix, moveOriginMatrix);
```

上記では、Fを-50、-75に移動するための平行移動がありました。これにより、すべての点が移動し、0,0がFの中心になります。スライダーをドラッグして、Fがその中心を中心に回転およびスケーリングすることに注意してください。

{{{example url="../webgpu-matrix-math-transform-move-origin-3x3.html" }}}

その手法を使用すると、任意の点から回転またはスケーリングできます。これで、お気に入りの画像編集プログラムが回転点を移動させる方法がわかりました。

## 射影の追加

さらにクレイジーになりましょう。シェーダーに、ピクセルからクリップ空間に変換する次のようなコードがあったことを覚えているかもしれません。

```wgsl
// 位置をピクセルから0.0から1.0の値に変換します
let zeroToOne = position / uni.resolution;

// 0 <-> 1から0 <-> 2に変換します
let zeroToTwo = zeroToOne * 2.0;

// 0 <-> 2から-1 <-> +1（クリップ空間）に変換します
let flippedClipSpace = zeroToTwo - 1.0;

// Yを反転させます
let clipSpace = flippedClipSpace * vec2f(1, -1);

vsOut.position = vec4f(clipSpace, 0.0, 1.0);
```

これらの各ステップを順番に見ると、

最初のステップ、「位置をピクセルから0.0から1.0の値に変換する」は、実際にはスケール操作です。`zeroToOne = position / uni.resolution`は`zeroToOne = position * (1 / uni.resolution)`と同じであり、これはスケーリングです。

2番目のステップ、`let zeroToTwo = zeroToOne * 2.0;`もスケール操作です。2でスケーリングしています。

3番目のステップ、`flippedClipSpace = zeroToTwo - 1.0;`は平行移動です。

4番目のステップ、`clipSpace = flippedClipSpace * vec2f(1, -1);`はスケールです。

したがって、これを数学に追加できます。

```js
+  const scaleBy1OverResolutionMatrix = mat3.scaling([1 / canvas.width, 1 / canvas.height]);
+  const scaleBy2Matrix = mat3.scaling([2, 2]);
+  const translateByMinus1 = mat3.translation([-1, -1]);
+  const scaleBy1Minus1 = mat3.scaling([1, -1]);

  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(translationMatrix, rotationMatrix);
+  let matrix = mat3.multiply(scaleBy1Minus1, translateByMinus1);
+  matrix = mat3.multiply(matrix, scaleBy2Matrix);
+  matrix = mat3.multiply(matrix, scaleBy1OverResolutionMatrix);
+  matrix = mat3.multiply(matrix, translationMatrix);
+  matrix = mat3.multiply(matrix, rotationMatrix);
  matrix = mat3.multiply(matrix, scaleMatrix);
```

次に、シェーダーを次のように変更できます。

```wgsl
struct Uniforms {
  color: vec4f,
-  resolution: vec2f,
  matrix: mat3x3f,
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

-  let position = (uni.matrix * vec3f(vert.position, 1)).xy;
-
-  // 位置をピクセルから0.0から1.0の値に変換します
-  let zeroToOne = position / uni.resolution;
-
-  // 0 <-> 1から0 <-> 2に変換します
-  let zeroToTwo = zeroToOne * 2.0;
-
-  // 0 <-> 2から-1 <-> +1（クリップ空間）に変換します
-  let flippedClipSpace = zeroToTwo - 1.0;
-
-  // Yを反転させます
-  let clipSpace = flippedClipSpace * vec2f(1, -1);
-
-  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
+  let clipSpace = (uni.matrix * vec3f(vert.position, 1)).xy;
+
+  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

シェーダーは今では非常に単純になり、機能は失われていません。実際、より柔軟になりました！ピクセルを表すことにハードコーディングされなくなりました。シェーダーの外部から異なる単位を選択できます。すべては行列演算のおかげです。

ただし、それらの4つの余分な行列を作成する代わりに、同じ結果を生成する関数を作成するだけです。

```js
const mat3 = {
  projection(width, height) {
    // 注：この行列はY軸を反転させるため、0が上になります。
    return [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1,
    ];
  },

  ...
```

そして、JavaScriptは次のようになります。

```js
-  const scaleBy1OverResolutionMatrix = mat3.scaling([1 / canvas.width, 1 / canvas.height]);
-  const scaleBy2Matrix = mat3.scaling([2, 2]);
-  const translateByMinus1 = mat3.translation([-1, -1]);
-  const scaleBy1Minus1 = mat3.scaling([1, -1]);
  const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(scaleBy1Minus1, translateByMinus1);
-  matrix = mat3.multiply(matrix, scaleBy2Matrix);
-  matrix = mat3.multiply(matrix, scaleBy1OverResolutionMatrix);
-  matrix = mat3.multiply(matrix, translationMatrix);
  let matrix = mat3.multiply(projectionMatrix, translationMatrix);
  matrix = mat3.multiply(matrix, rotationMatrix);
  matrix = mat3.multiply(matrix, scaleMatrix);
  matrix = mat3.multiply(matrix, moveOriginMatrix);
```

また、ユニフォームバッファの解像度用のスペースを作成するコードと、それを設定するコードも削除しました。

この最後のステップで、6〜7ステップのかなり複雑なシェーダーから、より柔軟な1ステップの非常に単純なシェーダーになりました。すべては行列演算の魔法のおかげです。

{{{example url="../webgpu-matrix-math-transform-just-matrix-3x3.html" }}}

## 進行中の行列乗算

次に進む前に、少し単純化しましょう。さまざまな行列を生成し、それらを個別に乗算することは一般的ですが、進行中にそれらを乗算することも一般的です。事実上、次のような関数を作成できます。

```js
const mat3 = {

  ...

  translate: function(m, translation) {
    return m3.multiply(m, m3.translation(translation));
  },

  rotate: function(m, angleInRadians) {
    return m3.multiply(m, m3.rotation(angleInRadians));
  },

  scale: function(m, scale) {
    return m3.multiply(m, m3.scaling(scale));
  },

  ...

};
```

これにより、上記の7行の行列コードを次のように4行に変更できます。

```js
const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
-const translationMatrix = mat3.translation(settings.translation);
-const rotationMatrix = mat3.rotation(settings.rotation);
-const scaleMatrix = mat3.scaling(settings.scale);
-
-let matrix = mat3.multiply(projectionMatrix, translationMatrix);
-matrix = mat3.multiply(matrix, rotationMatrix);
-matrix = mat3.multiply(matrix, scaleMatrix);
+let matrix = mat3.translate(projectionMatrix, settings.translation);
+matrix = mat3.rotate(matrix, settings.rotation);
+matrix = mat3.scale(matrix, settings.scale);
```

## mat3x3は3つのパディングされたvec3fです

[メモリレイアウトに関する記事](webgpu-memory-layout.md)で指摘したように、`vec3f`はしばしば3つではなく4つの浮動小数点数のスペースを占有します。

これは、メモリ内の`mat3x3f`の様子です。

<div class="webgpu_center" data-diagram="mat3x3f"></div>

これが、ユニフォーム値にコピーするためにこのコードが必要だった理由です。

```js
    matrixValue.set([
      ...matrix.slice(0, 3), 0,
      ...matrix.slice(3, 6), 0,
      ...matrix.slice(6, 9), 0,
    ]);
```

パディングを期待/処理するように行列関数を変更することで、これを修正できます。

```js
const mat3 = {
  projection(width, height) {
    // 注：この行列はY軸を反転させるため、0が上になります。
    return [
-      2 / width, 0, 0,
-      0, -2 / height, 0,
-      -1, 1, 1,
+      2 / width, 0, 0, 0,
+      0, -2 / height, 0, 0,
+      -1, 1, 1, 0,
    ];
  },
  identity() {
    return [
-      1, 0, 0,
-      0, 1, 0,
-      0, 0, 1,
+      1, 0, 0, 0,
+      0, 1, 0, 0,
+      0, 0, 1, 0,
    ];
  },
  multiply(a, b) {
-    const a00 = a[0 * 3 + 0];
-    const a01 = a[0 * 3 + 1];
-    const a02 = a[0 * 3 + 2];
-    const a10 = a[1 * 3 + 0];
-    const a11 = a[1 * 3 + 1];
-    const a12 = a[1 * 3 + 2];
-    const a20 = a[2 * 3 + 0];
-    const a21 = a[2 * 3 + 1];
-    const a22 = a[2 * 3 + 2];
-    const b00 = b[0 * 3 + 0];
-    const b01 = b[0 * 3 + 1];
-    const b02 = b[0 * 3 + 2];
-    const b10 = b[1 * 3 + 0];
-    const b11 = b[1 * 3 + 1];
-    const b12 = b[1 * 3 + 2];
-    const b20 = b[2 * 3 + 0];
-    const b21 = b[2 * 3 + 1];
-    const b22 = b[2 * 3 + 2];
+    const a00 = a[0 * 4 + 0];
+    const a01 = a[0 * 4 + 1];
+    const a02 = a[0 * 4 + 2];
+    const a10 = a[1 * 4 + 0];
+    const a11 = a[1 * 4 + 1];
+    const a12 = a[1 * 4 + 2];
+    const a20 = a[2 * 4 + 0];
+    const a21 = a[2 * 4 + 1];
+    const a22 = a[2 * 4 + 2];
+    const b00 = b[0 * 4 + 0];
+    const b01 = b[0 * 4 + 1];
+    const b02 = b[0 * 4 + 2];
+    const b10 = b[1 * 4 + 0];
+    const b11 = b[1 * 4 + 1];
+    const b12 = b[1 * 4 + 2];
+    const b20 = b[2 * 4 + 0];
+    const b21 = b[2 * 4 + 1];
+    const b22 = b[2 * 4 + 2];

    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
+      0,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
+      0,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
+      0,
    ];
  },
  translation([tx, ty]) {
    return [
-      1, 0, 0,
-      0, 1, 0,
-      tx, ty, 1,
+      1, 0, 0, 0,
+      0, 1, 0, 0, 
+      tx, ty, 1, 0,
    ];
  },

  rotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
-      c, s, 0,
-      -s, c, 0,
-      0, 0, 1,
+      c, s, 0, 0,
+      -s, c, 0, 0,
+      0, 0, 1, 0,
    ];
  },

  scaling([sx, sy]) {
    return [
-      sx, 0, 0,
-      0, sy, 0,
-      0, 0, 1,
+      sx, 0, 0, 0, 
+      0, sy, 0, 0,
+      0, 0, 1, 0,
    ];
  },
};
```

これで、行列を設定する部分を変更できます。

```js
-    matrixValue.set([
-      ...matrix.slice(0, 3), 0,
-      ...matrix.slice(3, 6), 0,
-      ...matrix.slice(6, 9), 0,
-    ]);
+    matrixValue.set(matrix);
```

## 行列をその場で更新する

もう1つできることは、行列関数に行列を渡すことを許可することです。これにより、行列をコピーする代わりに、その場で更新できます。両方のオプションがあると便利なので、宛先行列が渡されない場合は新しい行列を作成し、それ以外の場合は渡されたものを使用するようにします。

3つの例を挙げます。

```
const mat3 = {
-  multiply(a, b) {
+  multiply(a, b, dst) {
+    dst = dst || new Float32Array(12);
    const a00 = a[0 * 4 + 0];
    const a01 = a[0 * 4 + 1];
    const a02 = a[0 * 4 + 2];
    const a10 = a[1 * 4 + 0];
    const a11 = a[1 * 4 + 1];
    const a12 = a[1 * 4 + 2];
    const a20 = a[2 * 4 + 0];
    const a21 = a[2 * 4 + 1];
    const a22 = a[2 * 4 + 2];
    const b00 = b[0 * 4 + 0];
    const b01 = b[0 * 4 + 1];
    const b02 = b[0 * 4 + 2];
    const b10 = b[1 * 4 + 0];
    const b11 = b[1 * 4 + 1];
    const b12 = b[1 * 4 + 2];
    const b20 = b[2 * 4 + 0];
    const b21 = b[2 * 4 + 1];
    const b22 = b[2 * 4 + 2];

-    return [
-      b00 * a00 + b01 * a10 + b02 * a20,
-      b00 * a01 + b01 * a11 + b02 * a21,
-      b00 * a02 + b01 * a12 + b02 * a22,
-      0,
-      b10 * a00 + b11 * a10 + b12 * a20,
-      b10 * a01 + b11 * a11 + b12 * a21,
-      b10 * a02 + b11 * a12 + b12 * a22,
-      0,
-      b20 * a00 + b21 * a10 + b22 * a20,
-      b20 * a01 + b21 * a11 + b22 * a21,
-      b20 * a02 + b21 * a12 + b22 * a22,
-      0,
-    ];
+    dst[ 0] = b00 * a00 + b01 * a10 + b02 * a20;
+    dst[ 1] = b00 * a01 + b01 * a11 + b02 * a21;
+    dst[ 2] = b00 * a02 + b01 * a12 + b02 * a22;
+
+    dst[ 4] = b10 * a00 + b11 * a10 + b12 * a20;
+    dst[ 5] = b10 * a01 + b11 * a11 + b12 * a21;
+    dst[ 6] = b10 * a02 + b11 * a12 + b12 * a22;
+
+    dst[ 7] = b20 * a00 + b21 * a10 + b22 * a20;
+    dst[ 8] = b20 * a01 + b21 * a11 + b22 * a21;
+    dst[ 9] = b20 * a02 + b21 * a12 + b22 * a22;
+    return dst;
  },
-  translation([tx, ty]) {
+  translation([tx, ty], dst) {
+    dst = dst || new Float32Array(12);
-    return [
-      1, 0, 0, 0,
-      0, 1, 0, 0,
-      tx, ty, 1, 0,
-    ];
+    dst[0] = 1;   dst[1] = 0;   dst[ 2] = 0;
+    dst[4] = 0;   dst[5] = 1;   dst[ 6] = 0;
+    dst[8] = tx;  dst[9] = ty;  dst[10] = 1;
+    return dst;
  },
-  translate(m, translation) {
-    return mat3.multiply(m, mat3.translation(m));
+  translate(m, translation, dst) {
+    return mat3.multiply(m, mat3.translation(m), dst);
  }

  ...
```

他の関数についても同じことを行うと、コードは次のようになります。

```js
-    const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
-    let matrix = mat3.translate(projectionMatrix, settings.translation);
-    matrix = mat3.rotate(matrix, settings.rotation);
-    matrix = mat3.scale(matrix, settings.scale);
-    matrixValue.set(matrix);
+    mat3.projection(canvas.clientWidth, canvas.clientHeight, matrixValue);
+    mat3.translate(matrixValue, settings.translation, matrixValue);
+    mat3.rotate(matrixValue, settings.rotation, matrixValue);
+    mat3.scale(matrixValue, settings.scale, matrixValue);
```

`matrixValue`に行列をコピーする必要はもうありません。代わりに、直接操作できます。

{{{example url="../webgpu-matrix-math-transform-trs.html"}}}

## 点を変換するか、空間を変換するか

最後に1つ、上記で順序が重要であることがわかりました。最初の例では、

    平行移動 * 回転 * スケール

2番目の例では、

    スケール * 回転 * 平行移動

そして、それらがどのように異なるかを見ました。

行列を見るには2つの方法があります。式が与えられた場合、

    射影行列 * 平行移動行列 * 回転行列 * スケール行列 * 位置

多くの人が自然だと感じる最初の方法は、右から始めて左に進むことです。

まず、位置をスケール行列で乗算して、スケーリングされた位置を取得します。

    scaledPosition = scaleMat * position

次に、スケーリングされた位置を回転行列で乗算して、回転されたスケーリングされた位置を取得します。

    rotatedScaledPosition = rotationMat * scaledPosition

次に、回転されたスケーリングされた位置を平行移動行列で乗算して、平行移動された回転されたスケーリングされた位置を取得します。

    translatedRotatedScaledPosition = translationMat * rotatedScaledPosition

そして最後に、それを射影行列で乗算して、クリップ空間の位置を取得します。

    clipSpacePosition = projectionMatrix * translatedRotatedScaledPosition

行列を見る2番目の方法は、左から右に読むことです。その場合、各行列は、描画しているテクスチャで表される*空間*を変更します。テクスチャは、各方向にクリップ空間（-1から+1）を表すことから始まります。左から右に適用される各行列は、キャンバスで表される空間を変更します。

ステップ1：行列なし（または単位行列）

> <div data-diagram="space-change-0" data-caption="クリップ空間"></div>
>
> 白い領域はテクスチャです。青はテクスチャの外側です。クリップ空間にいます。渡された位置はクリップ空間にある必要があります。右上の緑色の領域は、Fの左上隅です。クリップ空間では+Yが上ですが、Fは+Yが下のピクセル空間で設計されているため、逆さまになっています。さらに、クリップ空間は2x2単位しか表示しませんが、Fは100x150単位の大きさなので、1単位分しか見えません。

ステップ2：`mat3.projection(canvas.clientWidth, canvas.clientHeight, matrixValue);`

> <div data-diagram="space-change-1" data-caption="クリップ空間からピクセル空間へ"></div>
>
> ピクセル空間になりました。X = 0からtextureWidth、Y = 0からtextureHeightで、0,0が左上隅です。この行列を使用して渡された位置は、ピクセル空間にある必要があります。表示されるフラッシュは、空間が正のY = 上から正のY = 下に反転するときです。

ステップ3：`mat3.translate(matrixValue, settings.translation, matrixValue);`

> <div data-diagram="space-change-2" data-caption="原点をtx、tyに移動"></div>
>
> 空間の原点がtx、ty（150、100）に移動しました。

ステップ4：`mat3.rotate(matrixValue, settings.rotation, matrixValue);`

> <div data-diagram="space-change-3" data-caption="33度回転"></div>
>
> 空間がtx、tyを中心に回転しました。

ステップ5：`mat3.scale(matrixValue, settings.scale, matrixValue);`

> <div data-diagram="space-change-4" data-caption="空間をスケーリング"></div>
>
> 中心がtx、tyにある以前に回転した空間が、xで2、yで1.5にスケーリングされました。

シェーダーでは、`clipSpace = uni.matrix * vert.position;`を実行します。`vert.position`の値は、この最終的な空間で効果的に適用されます。

理解しやすいと感じる方法を使用してください。

これらの記事が、行列演算の謎を解き明かすのに役立ったことを願っています。次に、[3Dに進みます](webgpu-orthographic-projection.html)。3Dでは、行列演算は同じ原則と使用法に従います。理解を単純にするために、2Dから始めました。

また、行列演算の専門家になりたい場合は、[この素晴らしいビデオ](https://www.youtube.com/watch?v=kjBOesZCoqc&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab)をご覧ください。

<div class="webgpu_bottombar">
<h3>`clientWidth`と`clientHeight`とは何ですか？</h3>
<p>これまで、キャンバスの寸法を参照するときは常に`canvas.width`と`canvas.height`を使用していましたが、上記で`mat3.projection`を呼び出すときは、代わりに`canvas.clientWidth`と`canvas.clientHeight`を使用しました。なぜですか？</p>
<p>射影行列は、クリップ空間（各次元で-1から+1）を取得し、それをピクセルに戻す方法に関係しています。しかし、ブラウザでは、2種類のピクセルを扱っています。1つはキャンバス自体のピクセル数です。たとえば、次のように定義されたキャンバスです。</p>
<pre class="prettyprint">
  &lt;canvas width="400" height="300"&gt;&lt;/canvas&gt;
</pre>
<p>または、次のように定義されたものです。</p>
<pre class="prettyprint">
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
</pre>
<p>どちらも幅400ピクセル、高さ300ピクセルの画像が含まれています。しかし、そのサイズは、ブラウザが実際にその400x300ピクセルのキャンバスを表示するサイズとは別です。CSSは、キャンバスが表示されるサイズを定義します。たとえば、次のようなキャンバスを作成した場合です。</p>
<pre class="prettyprint">
  &lt;style&gt;
    canvas {
      width: 100%;
      height: 100%;
    }
  &lt;/style&gt;
  ...
  &lt;canvas width="400" height="300">&lt;/canvas&gt;
</pre>
<p>キャンバスは、そのコンテナのサイズで表示されます。それはおそらく400x300ではありません。</p>
<p>これは、キャンバスのCSS表示サイズを100％に設定して、キャンバスがページを埋めるようにする2つの例です。最初の例では、`mat3.projection`を呼び出すときに`canvas.width`と`canvas.height`を使用します。新しいウィンドウで開き、ウィンドウのサイズを変更します。「F」の縦横比が正しくないことに注意してください。歪んでいます。また、正しい場所にもありません。コードでは、左上隅が150、25にあるはずですが、キャンバスが引き伸ばされたり縮小されたりすると、150、25に表示したいものの位置が移動します。</p>
{{{example url="../webgpu-canvas-width-height.html" width="500" height="150" }}}
<p>この2番目の例では、`mat3.projection`を呼び出すときに`canvas.clientWidth`と`canvas.clientHeight`を使用します。`canvas.clientWidth`と`canvas.clientHeight`は、ブラウザで実際に表示されているキャンバスのサイズを報告するため、この場合、キャンバスにはまだ400x300ピクセルしかありませんが、キャンバスが表示されているサイズに基づいてアスペクト比を定義しているため、「F」は常に正しく表示され、Fは正しい場所にあります。</p>
{{{example url="../webgpu-canvas-clientwidth-clientheight.html" width="500" height="150" }}}
<p>キャンバスのサイズ変更を許可するほとんどのアプリは、ブラウザで表示される各ピクセルに対してキャンバスに1ピクセルがあるようにしたいため、`canvas.width`と`canvas.height`を`canvas.clientWidth`と`canvas.clientHeight`に一致させようとします。しかし、上記で見たように、それが唯一のオプションではありません。つまり、ほとんどすべての場合、`canvas.clientHeight`と`canvas.clientWidth`を使用して射影行列のアスペクト比を計算する方が、技術的にはより正しいということです。</p>
</div>

<!-- この記事の最後にこれを保持してください -->
<link href="webgpu-matrix-math.css" rel="stylesheet">
<script type="module" src="webgpu-matrix-math.js"></script>

