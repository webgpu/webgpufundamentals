Title: WebGPU カメラ
Description: 行列によるカメラ
TOC: カメラ

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事は、3D数学について学ぶことを目的とした一連の記事の7番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html) ⬅ ここです
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

前回の投稿では、`mat4.perspective`関数が視点を原点(0, 0, 0)に置き、錐台内のオブジェクトがその手前の`-zNear`から`-zFar`の間に配置されるため、Fを錐台の前に移動させる必要がありました。これは、表示させたいものはすべてこの空間に配置する必要があることを意味します。

現実世界では、通常、カメラを動かしてあるオブジェクトの写真を撮ります。

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-camera"></div>
   <div class="caption">カメラをオブジェクトに移動する</div>
</div>

しかし、前回の投稿では、-Z軸上の原点の前にあるものを必要とする射影行列を考え出しました。これを実現するために、カメラを原点に移動させ、他のすべてを適切な量だけ移動させて、*カメラに対して*同じ場所に留まるようにする必要があります。

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-world"></div>
   <div class="caption">オブジェクトをビューに移動する</div>
</div>

私たちは、世界をカメラの前に効果的に移動させる必要があります。これを行う最も簡単な方法は、「逆」行列を使用することです。一般的な場合に逆行列を計算する数学は複雑ですが、概念的には簡単です。逆行列は、他の値を打ち消すために使用する値です。たとえば、X方向に123だけ平行移動する行列の逆行列は、X方向に-123だけ平行移動する行列です。5倍に拡大する行列の逆行列は、1/5または0.2倍に縮小する行列です。X軸を中心に30度回転する行列の逆行列は、X軸を中心に-30度回転する行列です。

これまで、平行移動、回転、拡大縮小を使用して、「F」の位置と向きに影響を与えてきました。すべての行列を乗算した後、「F」を原点から目的の場所、サイズ、向きに移動する方法を表す単一の行列が得られます。カメラについても同じことができます。カメラを原点から目的の場所に移動および回転させる方法を示す行列が得られたら、その逆行列を計算できます。これにより、他のすべてを反対の量だけ移動および回転させる方法を示す行列が得られ、カメラが(0, 0, 0)にあり、他のすべてをその前に移動させたことになります。

上の図のように、「F」の円を持つ3Dシーンを作成しましょう。

まず最初に、「F」の頂点データを調整しましょう。最初は2Dでピクセルから始めました。「F」の左上隅は0,0にあり、右に100ピクセル、下に150ピクセル伸びています。「ピクセル」は3Dの単位としてはおそらく意味がなく、作成した透視射影行列は正のYを上として使用するため、「F」を反転させて正のYが上になるようにし、原点を中心に配置しましょう。

```js
  const positions = [
-    // 左列
-    0, 0, 0,
-    30, 0, 0,
-    0, 150, 0,
-    30, 150, 0,
-
-    // 上の横木
-    30, 0, 0,
-    100, 0, 0,
-    30, 30, 0,
-    100, 30, 0,
-
-    // 中間の横木
-    30, 60, 0,
-    70, 60, 0,
-    30, 90, 0,
-    70, 90, 0,
-
-    // 左列の裏
-    0, 0, 30,
-    30, 0, 30,
-    0, 150, 30,
-    30, 150, 30,
-
-    // 上の横木の裏
-    30, 0, 30,
-    100, 0, 30,
-    30, 30, 30,
-    100, 30, 30,
-
-    // 中間の横木の裏
-    30, 60, 30,
-    70, 60, 30,
-    30, 90, 30,
-    70, 90, 30,
+    // 左列
+     -50,  75,  15,
+     -20,  75,  15,
+     -50, -75,  15,
+     -20, -75,  15,
+
+    // 上の横木
+     -20,  75,  15,
+      50,  75,  15,
+     -20,  45,  15,
+      50,  45,  15,
+
+    // 中間の横木
+     -20,  15,  15,
+      20,  15,  15,
+     -20, -15,  15,
+      20, -15,  15,
+
+    // 左列の裏
+     -50,  75, -15,
+     -20,  75, -15,
+     -50, -75, -15,
+     -20, -75, -15,
+
+    // 上の横木の裏
+     -20,  75, -15,
+      50,  75, -15,
+     -20,  45, -15,
+      50,  45, -15,
+
+    // 中間の横木の裏
+     -20,  15, -15,
+      20,  15, -15,
+     -20, -15, -15,
+      20, -15, -15,
  ];
```

さらに、[前の記事](webgpu-perspective-projection.html)で説明したように、ほとんどの2Dピクセルライブラリに合わせて正のY = 下を使用していたため、通常の3Dとは逆の三角形の頂点順序になり、Yを-1でスケーリングしていたため、通常の`'back'`向きの三角形ではなく`'front'`向きの三角形をカリングすることになりました。通常の3Dで正のY = 上を使用するようになったので、頂点の順序を反転させて、時計回りの三角形が外側を向くようにしましょう。

```js
  const indices = [
-     0,  1,  2,    2,  1,  3,  // 左列
-     4,  5,  6,    6,  5,  7,  // 上の横木
-     8,  9, 10,   10,  9, 11,  // 中間の横木
-
-    12, 14, 13,   14, 15, 13,  // 左列の裏
-    16, 18, 17,   18, 19, 17,  // 上の横木の裏
-    20, 22, 21,   22, 23, 21,  // 中間の横木の裏
-
-     0, 12,  5,   12, 17,  5,   // 上
-     5, 17,  7,   17, 19,  7,   // 上の横木の右
-     6,  7, 18,   18,  7, 19,   // 上の横木の下
-     6, 18,  8,   18, 20,  8,   // 上と中間の横木の間
-     8, 20,  9,   20, 21,  9,   // 中間の横木の上
-     9, 21, 11,   21, 23, 11,   // 中間の横木の右
-    10, 11, 22,   22, 11, 23,   // 中間の横木の下
-    10, 22,  3,   22, 15,  3,   // 幹の右
-     2,  3, 14,   14,  3, 15,   // 下
-     0,  2, 12,   12,  2, 14,   // 左
+     0,  2,  1,    2,  3,  1,   // 左列
+     4,  6,  5,    6,  7,  5,   // 上の横木
+     8, 10,  9,   10, 11,  9,   // 中間の横木
+
+    12, 13, 14,   14, 13, 15,   // 左列の裏
+    16, 17, 18,   18, 17, 19,   // 上の横木の裏
+    20, 21, 22,   22, 21, 23,   // 中間の横木の裏
+
+     0,  5, 12,   12,  5, 17,   // 上
+     5,  7, 17,   17,  7, 19,   // 上の横木の右
+     6, 18,  7,   18, 19,  7,   // 上の横木の下
+     6,  8, 18,   18,  8, 20,   // 上と中間の横木の間
+     8,  9, 20,   20,  9, 21,   // 中間の横木の上
+     9, 11, 21,   21, 11, 23,   // 中間の横木の右
+    10, 22, 11,   22, 23, 11,   // 中間の横木の下
+    10,  3, 22,   22,  3, 15,   // 幹の右
+     2, 14,  3,   14, 15,  3,   // 下
+     0, 12,  2,   12, 14,  2,   // 左
  ];
```

最後に、`cullMode`を*裏向き*の三角形をカリングするように設定しましょう。

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (4) * 4, // (3) floats 4 bytes each + one 4 byte color
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
-      cullMode: 'front',  // 注：一般的でない設定。記事を参照
+      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });
```

以下は、行列が与えられた場合にその逆行列を計算する関数です。

```js
const mat4 = {
  ...

+  inverse(m, dst) {
+    dst = dst || new Float32Array(16);
+
+    const m00 = m[0 * 4 + 0];
+    const m01 = m[0 * 4 + 1];
+    const m02 = m[0 * 4 + 2];
+    const m03 = m[0 * 4 + 3];
+    const m10 = m[1 * 4 + 0];
+    const m11 = m[1 * 4 + 1];
+    const m12 = m[1 * 4 + 2];
+    const m13 = m[1 * 4 + 3];
+    const m20 = m[2 * 4 + 0];
+    const m21 = m[2 * 4 + 1];
+    const m22 = m[2 * 4 + 2];
+    const m23 = m[2 * 4 + 3];
+    const m30 = m[3 * 4 + 0];
+    const m31 = m[3 * 4 + 1];
+    const m32 = m[3 * 4 + 2];
+    const m33 = m[3 * 4 + 3];
+
+    const tmp0 = m22 * m33;
+    const tmp1 = m32 * m23;
+    const tmp2 = m12 * m33;
+    const tmp3 = m32 * m13;
+    const tmp4 = m12 * m23;
+    const tmp5 = m22 * m13;
+    const tmp6 = m02 * m33;
+    const tmp7 = m32 * m03;
+    const tmp8 = m02 * m23;
+    const tmp9 = m22 * m03;
+    const tmp10 = m02 * m13;
+    const tmp11 = m12 * m03;
+    const tmp12 = m20 * m31;
+    const tmp13 = m30 * m21;
+    const tmp14 = m10 * m31;
+    const tmp15 = m30 * m11;
+    const tmp16 = m10 * m21;
+    const tmp17 = m20 * m11;
+    const tmp18 = m00 * m31;
+    const tmp19 = m30 * m01;
+    const tmp20 = m00 * m21;
+    const tmp21 = m20 * m01;
+    const tmp22 = m00 * m11;
+    const tmp23 = m10 * m01;
+
+    const t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) -
+               (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
+    const t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) -
+               (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
+    const t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) -
+               (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
+    const t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) -
+               (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);
+
+    const d = 1 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
+
+    dst[0] = d * t0;
+    dst[1] = d * t1;
+    dst[2] = d * t2;
+    dst[3] = d * t3;
+
+    dst[4] = d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) -
+                  (tmp0 * m10 + tmp3 * m20 + tmp4 * m30));
+    dst[5] = d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) -
+                  (tmp1 * m00 + tmp6 * m20 + tmp9 * m30));
+    dst[6] = d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) -
+                  (tmp2 * m00 + tmp7 * m10 + tmp10 * m30));
+    dst[7] = d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) -
+                  (tmp5 * m00 + tmp8 * m10 + tmp11 * m20));
+
+    dst[8] = d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) -
+                  (tmp13 * m13 + tmp14 * m23 + tmp17 * m33));
+    dst[9] = d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) -
+                  (tmp12 * m03 + tmp19 * m23 + tmp20 * m33));
+    dst[10] = d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) -
+                   (tmp15 * m03 + tmp18 * m13 + tmp23 * m33));
+    dst[11] = d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) -
+                   (tmp16 * m03 + tmp21 * m13 + tmp22 * m23));
+
+    dst[12] = d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) -
+                   (tmp16 * m32 + tmp12 * m12 + tmp15 * m22));
+    dst[13] = d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) -
+                   (tmp18 * m22 + tmp21 * m32 + tmp13 * m02));
+    dst[14] = d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) -
+                   (tmp22 * m32 + tmp14 * m02 + tmp19 * m12));
+    dst[15] = d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) -
+                   (tmp20 * m12 + tmp23 * m22 + tmp17 * m02));
+    return dst;
+  },
...
```

以前の例で行ったように、5つのものを描画するには、5つのユニフォームバッファと5つのバインドグループが必要です。

```js
+  const numFs = 5;
+  const objectInfos = [];
+  for (let i = 0; i < numFs; ++i) {
    // 行列
    const uniformBufferSize = (16) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32インデックスでのさまざまなユニフォーム値へのオフセット
    const kMatrixOffset = 0;

    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);

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
+      matrixValue,
+      bindGroup,
+    });
+  }
```

例をすっきりさせるために、いくつかの設定を取り除きましょう。

```js
  const settings = {
    fieldOfView: degToRad(100),
-    translation: [-65, 0, -120],
-    rotation: [degToRad(220), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
  };

  ...

-      mat4.translate(matrixValue, settings.translation, matrixValue);
-      mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
-      mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
-      mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
-      mat4.scale(matrixValue, settings.scale, matrixValue);
```

5つのものを描画し、それらはすべて同じ射影行列を使用するため、Fを描画するループの前に計算します。

```js
  function render() {
    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
-    mat4.perspective(
+    const projection = mat4.perspective(
        settings.fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
-        matrixValue,
    );
```

次に、カメラ行列を計算します。この行列は、世界におけるカメラの位置と向きを表します。以下のコードは、原点を中心に半径*1.5の距離でカメラを回転させ、原点を見つめる行列を作成します。

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="camera-movement"></div>
   <div class="caption">カメラの動き</div>
</div>

```js
+  const radius = 200;
  const settings = {
    fieldOfView: degToRad(100),
+    cameraAngle: 0,
  };

  ...

  function render() {

     ...
 

+    // カメラの行列を計算します。
+    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
```

次に、カメラ行列から「ビュー行列」を計算します。「ビュー行列」は、カメラの反対側にすべてを移動させる行列で、カメラが原点(0,0,0)にあるかのように、すべてをカメラに対して相対的にします。これは、逆行列（指定された行列と正反対の動作をする行列）を計算する`inverse`関数を使用することで実行できます。この場合、指定された行列はカメラをある位置と向きに原点に対して移動させます。その逆行列は、カメラが原点にあるように他のすべてを移動させる行列です。

```js
    // カメラ行列からビュー行列を作成します。
    const viewMatrix = mat4.inverse(cameraMatrix);
```

次に、ビュー行列と射影行列を組み合わせてビュー射影行列を作成します。

```js
+    // ビュー行列と射影行列を組み合わせます
+    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

最後に、Fの円を描画します。各Fについて、ビュー射影行列から始め、円上の位置を計算し、その位置に平行移動します。

```js
  function render() {
    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        settings.fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    // カメラの行列を計算します。
    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);

    // カメラ行列からビュー行列を作成します。
    const viewMatrix = mat4.inverse(cameraMatrix);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    objectInfos.forEach(({
+      matrixValue,
+      uniformBuffer,
+      uniformValues,
+      bindGroup,
+    }, i) => {
+      const angle = i / numFs * Math.PI * 2;
+      const x = Math.cos(angle) * radius;
+      const z = Math.sin(angle) * radius;

+      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

      // ユニフォーム値をユニフォームバッファにアップロードします
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(numVertices);
+    });
```

そして、出来上がり！「F」の円の周りを回るカメラです。`cameraAngle`スライダーをドラッグしてカメラを動かしてみてください。

{{{example url="../webgpu-cameras-step-1-direct-math.html" }}}

それはそれでいいのですが、回転と平行移動を使ってカメラを好きな場所に移動させ、見たいものの方を向かせるのは必ずしも簡単ではありません。たとえば、カメラが常に特定の「F」の1つを指すようにしたい場合、その「F」を指すようにカメラを回転させる方法を計算するには、かなり複雑な数学が必要になります。

幸いなことに、もっと簡単な方法があります。カメラをどこに置きたいか、何を指したいかを決めるだけで、カメラをそこに置く行列を計算できます。行列の仕組みに基づくと、これは驚くほど簡単です。

まず、カメラをどこに置きたいかを知る必要があります。これを`eye`と呼びます。次に、見たいもの、または狙いたいものの位置を知る必要があります。これを`target`と呼びます。`eye`から`target`を引くと、カメラからターゲットに到達するために必要な方向を指すベクトルが得られます。これを`zAxis`と呼びましょう。カメラは-Z方向を向いていることがわかっているので、逆方向に`eye - target`を引くことができます。結果を正規化し、行列の`z`の部分に直接コピーします。

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tr>
        <td class="m11"> </td>
        <td class="m12"> </td>
        <td class="m13">Zx</td>
        <td class="m14"> </td>
      </tr>
      <tr>
        <td class="m21"> </td>
        <td class="m22"> </td>
        <td class="m23">Zy</td>
        <td class="m24"> </td>
      </tr>
      <tr>
        <td class="m31"> </td>
        <td class="m32"> </td>
        <td class="m33">Zz</td>
        <td class="m34"> </td>
      </tr>
      <tr>
        <td class="m41"> </td>
        <td class="m42"> </td>
        <td class="m43"> </td>
        <td class="m44"> </td>
      </tr>
    </table>
  </div>
</div>

行列のこの部分はZ軸を表します。この場合、カメラのZ軸です。ベクトルを正規化するということは、1.0単位を表すベクトルにすることです。[回転に関する記事](webgpu-rotation.html)に戻ると、単位円とそれが2D回転にどのように役立ったかについて話しました。3Dでは単位球が必要であり、正規化されたベクトルは単位球上の点を表します。

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-00"></div>
  <div class="caption"><span class='z-axis'>z軸</span></div>
</div>

しかし、それだけでは情報が不十分です。単一のベクトルは単位球上の点を与えますが、その点からどの向きにものを配置すればよいのでしょうか？行列の他の部分、具体的にはX軸とY軸の部分を埋める必要があります。一般に、これら3つの部分は互いに垂直であることがわかっています。また、「一般的に」、カメラを真上に向けることはありません。それを考えると、どちらが上か、この場合は(0,1,0)がわかっていれば、それと「外積」と呼ばれるものを使って、行列のX軸とY軸を計算できます。

外積が数学的に何を意味するのかはわかりません。私が知っているのは、2つの単位ベクトルがあり、それらの外積を計算すると、それら2つのベクトルに垂直なベクトルが得られるということです。つまり、南東を指すベクトルと上を指すベクトルがあり、外積を計算すると、南西または北東を指すベクトルが得られます。なぜなら、それらは南東と上に垂直な2つのベクトルだからです。外積を計算する順序によっては、反対の答えが得られます。

いずれにせよ、<span class="z-axis">`zAxis`</span>と<span style="color: gray;">`up`</span>の外積を計算すると、カメラの<span class="x-axis">xAxis</span>が得られます。

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-01"></div>
  <div class="caption"><span style='color:gray;'>up</span> cross <span class='z-axis'>zAxis</span> = <span class='x-axis'>xAxis</span></div>
</div>

そして、<span class="x-axis">`xAxis`</span>が得られたので、<span class="z-axis">`zAxis`</span>と<span class="x-axis">`xAxis`</span>をクロスさせることができます。これにより、カメラの<span class="y-axis">`yAxis`</span>が得られます。

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-02"></div>
  <div class="caption"><span class='z-axis'>zAxis</span> cross <span class='x-axis'>xAxis</span> = <span class='y-axis'>yAxis</span></div>
</div>

あとは、3つの軸を行列に差し込むだけです。これにより、`eye`から`target`を指すものを方向付ける行列が得られます。最後の列に`eye`の位置を入れるだけです。

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tbody>
        <tr class="vertical-spans">
          <td><span class="x-axis">x軸 →</span></td>
          <td><span class="y-axis">y軸 →</span></td>
          <td><span class="z-axis">z軸 →</span></td>
          <td><span>視点の位置 →</span></td>
        </tr>
        <tr>
          <td class="m11">Xx</td>
          <td class="m12">Yx</td>
          <td class="m13">Zx</td>
          <td class="m14">Tx</td>
        </tr>
        <tr>
          <td class="m21">Xy</td>
          <td class="m22">Yy</td>
          <td class="m23">Zy</td>
          <td class="m24">Ty</td>
        </tr>
        <tr>
          <td class="m31">Xz</td>
          <td class="m32">Yz</td>
          <td class="m33">Zz</td>
          <td class="m34">Tz</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

以下は、2つのベクトルの外積を計算するコードです。行列コードと同様に、オプションの宛先配列を受け取るようにします。

```js
+const vec3 = {
+  cross(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    const t0 = a[1] * b[2] - a[2] * b[1];
+    const t1 = a[2] * b[0] - a[0] * b[2];
+    const t2 = a[0] * b[1] - a[1] * b[0];
+
+    dst[0] = t0;
+    dst[1] = t1;
+    dst[2] = t2;
+
+    return dst;
+  },
+};
```

以下は、2つのベクトルを減算するコードです。


```js
const vec3 = {
  ...
+  subtract(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    dst[0] = a[0] - b[0];
+    dst[1] = a[1] - b[1];
+    dst[2] = a[2] - b[2];
+
+    return dst;
+  },
```

以下は、ベクトルを正規化する（単位ベクトルにする）コードです。

```js
const vec3 = {
  ...
+  normalize(v, dst) {
+    dst = dst || new Float32Array(3);
+
+    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
+    // 0で除算しないようにします。
+    if (length > 0.00001) {
+      dst[0] = v[0] / length;
+      dst[1] = v[1] / length;
+      dst[2] = v[2] / length;
+    } else {
+      dst[0] = 0;
+      dst[1] = 0;
+      dst[2] = 0;
+    }
+
+    return dst;
+  },
```

以下は、*カメラ*行列を計算するコードです。上記で説明した手順に従います。

```js
const mat4 = {
  ...
  cameraAim(eye, target, up, dst) {
    dst = dst || new Float32Array(16);

    const zAxis = vec3.normalize(vec3.subtract(eye, target));
    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

    return dst;
  },
  ...
```

そして、これを使用して、移動中にカメラを特定の「F」に向ける方法は次のとおりです。

```js
-    // カメラの行列を計算します。
-    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
+    // 最初のFの位置を計算します
+    const fPosition = [radius, 0, 0];
+
+    // 行列演算を使用して、カメラがある円上の位置を計算します
+    const tempMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
+
+    // 計算した行列からカメラの位置を取得します
+    const eye = tempMatrix.slice(12, 15);
+
+    const up = [0, 1, 0];
+
+    // cameraAimを使用してカメラの行列を計算します
+    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);

    // カメラ行列からビュー行列を作成します。
    const viewMatrix = mat4.inverse(cameraMatrix);
```

そして、これが結果です。

{{{example url="../webgpu-cameras-step-2-camera-aim.html" }}}

スライダーをドラッグして、カメラが単一の「F」を追跡する方法に注目してください。

ほとんどの数学ライブラリには`cameraAim`関数がありません。代わりに、`lookAt`関数があり、これは`cameraAim`関数とまったく同じことを行いますが、ビュー行列にも変換します。機能的には、`lookAt`は次のように実装できます。

```js
const mat4 = {
  ...
+  lookAt(eye, target, up, dst) {
+    return mat4.inverse(mat4.cameraAim(eye, target, up, dst), dst);
+  },
  ...
};
```

この`lookAt`関数を使用すると、コードは次のようになります。

```js
-    // look atを使用してカメラの行列を計算します。
-    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);
-
-    // カメラ行列からビュー行列を作成します。
-    const viewMatrix = mat4.inverse(cameraMatrix);
+    // ビュー行列を計算します
+    const viewMatrix = mat4.lookAt(eye, fPosition, up);
```

{{{example url="../webgpu-cameras-step-3-look-at.html" }}}

この種の「エイム」数学は、カメラだけでなく、他の用途にも使用できることに注意してください。一般的な用途は、キャラクターの頭をあるターゲットに追従させることです。砲塔をターゲットに向けることです。オブジェクトをパスに沿って追従させることです。パス上のターゲットの位置を計算します。次に、パス上のターゲットが数秒後にどこにあるかを計算します。これら2つの値を`aim`関数にプラグインすると、オブジェクトをパスに沿って追従させ、パスに向かって方向付ける行列が得られます。

通常、何かを「狙う」には、上記の関数のように負のZ軸ではなく、正のZ軸を指すようにする必要があります。したがって、`eye`から`target`を引くのではなく、`target`から`eye`を引く必要があります。

```js
const mat4 = {
  ...
+  aim(eye, target, up, dst) {
+    dst = dst || new Float32Array(16);
+
+    const zAxis = vec3.normalize(vec3.subtract(target, eye));
+    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
+    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));
+
+    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
+    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
+    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
+    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;
+
+    return dst;
+  },

  cameraAim(eye, target, up, dst) {
    dst = dst || new Float32Array(16);

    const zAxis = vec3.normalize(vec3.subtract(eye, target));
    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

    return dst;
  },
...

<a id="a-aim-fs"></a> たくさんのFを別のFに向けるようにしましょう（ええ、Fが多すぎますが、例をこれ以上データでごちゃごちゃさせたくありません）。5x5のFのグリッドと、それらが「狙う」ためのもう1つのFを作成します。

```js
-  const numFs = 5;
+  const numFs = 5 * 5 + 1;
```

次に、カメラのターゲットをハードコーディングし、Fの1つを移動できるように設定を変更します。

```js
  const settings = {
-    fieldOfView: degToRad(100),
-    cameraAngle: 0,
+    target: [0, 200, 300],
+    targetAngle: 0,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings, 'cameraAngle', radToDegOptions);
+  gui.add(settings.target, '1', -100, 300).name('target height');
+  gui.add(settings, 'targetAngle', radToDegOptions).name('target angle');
```

そして最後に、最初の25個のFについては、`aim`を使用してグリッドに配置し、26番目のFを*狙い*ます。

```js
+    // 角度に基づいてターゲットのX、Zを更新します
+    settings.target[0] = Math.cos(settings.targetAngle) * radius;
+    settings.target[2] = Math.sin(settings.targetAngle) * radius;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
-        settings.fieldOfView,
+        degToRad(60), // fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );

-    // 最初のFの位置を計算します
-    const fPosition = [radius, 0, 0];
-
-    // 行列演算を使用して、カメラがある円上の位置を計算します
-    const tempMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
-
-    // 計算した行列からカメラの位置を取得します
-    const eye = tempMatrix.slice(12, 15);
+    const eye = [-500, 300, -500];
+    const target = [0, -100, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
-    const viewMatrix = mat4.lookAt(eye, fPosition, up);
+    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    objectInfos.forEach(({
      matrixValue,
      uniformBuffer,
      uniformValues,
      bindGroup,
    }, i) => {
-      const angle = i / numFs * Math.PI * 2;
-      const x = Math.cos(angle) * radius;
-      const z = Math.sin(angle) * radius;
-
-      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

+      const deep = 5;
+      const across = 5;
+      if (i < 25) {
+        // グリッド位置を計算します
+        const gridX = i % across;
+        const gridZ = i / across | 0;
+
+        // 0から1の位置を計算します
+        const u = gridX / (across - 1);
+        const v = gridZ / (deep - 1);
+
+        // 中央に配置して広げます
+        const x = (u - 0.5) * across * 150;
+        const z = (v - 0.5) * deep * 150;
+
+        // このFをその位置からターゲットFに向ける
+        const aimMatrix = mat4.aim([x, 0, z], settings.target, up);
+        mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue);
+      } else {
+        mat4.translate(viewProjectionMatrix, settings.target, matrixValue);
+      }

      // ユニフォーム値をユニフォームバッファにアップロードします
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

そして今、25個のFが26番目のFに面しています（前面は正のZです）。

{{{example url="../webgpu-cameras-step-4-aim-Fs.html" }}}

スライダーを動かして、25個のFすべてが*狙う*のを見てください。


<!-- この記事の最後にこれを保持してください -->
<link href="webgpu-cameras.css" rel="stylesheet">
<script type="module" src="webgpu-cameras.js"></script>
