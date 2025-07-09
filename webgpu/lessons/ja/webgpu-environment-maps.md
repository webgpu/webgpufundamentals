Title: WebGPU 環境マップ（反射）
Description: 環境マップの実装方法
TOC: 環境マップ

この記事は、[キューブマップに関する記事](webgpu-cube-maps.html)の続きです。この記事では、[ライティングに関する記事](webgpu-lighting-directional.html)で説明されている概念も使用します。これらの記事をまだ読んでいない場合は、最初に読むことをお勧めします。

*環境マップ*は、描画しているオブジェクトの環境を表します。屋外のシーンを描画している場合は、屋外を表します。ステージ上の人物を描画している場合は、会場を表します。宇宙のシーンを描画している場合は、星になります。キューブマップの6つの方向から空間内の点からの環境を示す6つの画像があれば、キューブマップで環境マップを実装できます。

これは、ロンドンのレドンホールマーケットのロビーからの環境マップです。

<div class="webgpu_center">
  <div class="side-by-side center-by-margin" style="max-width: 800px">
    <div><img src="../resources/images/leadenhall_market/pos-x.jpg" style="min-width: 256px; width: 256px" class="border"><div>正のx</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-x.jpg" style="min-width: 256px; width: 256px" class="border"><div>負のx</div></div>
    <div><img src="../resources/images/leadenhall_market/pos-y.jpg" style="min-width: 256px; width: 256px" class="border"><div>正のy</div></div>
    <div><img src="../resources/images/leadenhall_market/pos-z.jpg" style="min-width: 256px; width: 256px" class="border"><div>正のz</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-z.jpg" style="min-width: 256px; width: 256px" class="border"><div>負のz</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-y.jpg" style="min-width: 256px; width: 256px" class="border"><div>正のy</div></div>
  </div>
</div>
<div class="webgpu_center">
  <a href="https://polyhaven.com/a/leadenhall_market">レドンホールマーケット</a>、CC0 by: <a href="https://www.artstation.com/andreasmischok">Andreas Mischok</a>
</div>

[前の記事](webgpu-cube-maps.html)のコードに基づいて、生成したキャンバスの代わりにそれらの6つの画像を読み込みましょう。[テクスチャへの画像のインポートに関する記事](webgpu-importing-textures.html)から、画像を読み込む関数と画像からテクスチャを作成する関数の2つがありました。

```js
  async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  async function createTextureFromImage(device, url, options) {
    const imgBitmap = await loadImageBitmap(url);
    return createTextureFromSource(device, imgBitmap, options);
  }
```

複数の画像を読み込むためのものを追加しましょう。

```js
+  async function createTextureFromImages(device, urls, options) {
+    const imgBitmaps = await Promise.all(url.map(loadImageBitmap));
+    return createTextureFromSource(device, imgBitmaps, options);
+  }

  async function createTextureFromImage(device, url, options) {
-    const imgBitmap = await loadImageBitmap(url);
-    return createTextureFromSource(device, imgBitmap, options);
+    return createTextureFromImages(device, [url], options);
  }
```

ついでに、既存の関数を新しい関数を使用するように変更しました。これで、新しい関数を使用して6つの画像を読み込むことができます。

```js
-  const texture = await createTextureFromSources(
-      device, faceCanvases, {mips: true, flipY: false});
+  const texture = await createTextureFromImages(
+      device,
+      [
+        'resources/images/leadenhall_market/pos-x.jpg',
+        'resources/images/leadenhall_market/neg-x.jpg',
+        'resources/images/leadenhall_market/pos-y.jpg',
+        'resources/images/leadenhall_market/neg-y.jpg',
+        'resources/images/leadenhall_market/pos-z.jpg',
+        'resources/images/leadenhall_market/neg-z.jpg',
+      ],
+      {mips: true, flipY: false},
+  );
```

フラグメントシェーダーでは、描画する各フラグメントについて、目/カメラからオブジェクトの表面上のその位置までのベクトルが与えられた場合、その表面からどの方向に反射するかを知りたいです。その方向を使用して、キューブマップから色を取得できます。

反射の式は次のとおりです。

    reflectionDir = eyeToSurfaceDir –
        2 ∗ dot(surfaceNormal, eyeToSurfaceDir) ∗ surfaceNormal

私たちが見ることができるものについて考えると、それは真実です。[ライティングの記事](webgpu-lighting-directional.html)から、2つのベクトルのドット積は2つのベクトル間の角度のコサインを返すことを思い出してください。ベクトルを追加すると新しいベクトルが得られるので、平らな表面に垂直に直接見ている目の例を見てみましょう。

<div class="webgpu_center"><img src="resources/reflect-180-01.svg" style="width: 400px"></div>

上記の式を視覚化しましょう。まず、正反対の方向を向いている2つのベクトルのドット積が-1であることを思い出してください。視覚的には

<div class="webgpu_center"><img src="resources/reflect-180-02.svg" style="width: 400px"></div>

そのドット積を<span style="color:black; font-weight:bold;">eyeToSurfaceDir</span>と<span style="color:green;">normal</span>で反射式に代入すると、次のようになります。

<div class="webgpu_center"><img src="resources/reflect-180-03.svg" style="width: 400px"></div>

-2に-1を掛けると正の2になります。

<div class="webgpu_center"><img src="resources/reflect-180-04.svg" style="width: 400px"></div>

したがって、ベクトルを接続して追加すると、<span style="color: red">反射ベクトル</span>が得られます。

<div class="webgpu_center"><img src="resources/reflect-180-05.svg" style="width: 400px"></div>

上記のように、2つの法線が与えられると、1つは目からの方向を完全に打ち消し、2つ目は反射を直接目の方に向けます。これを元の図に戻すと、まさに期待どおりになります。

<div class="webgpu_center"><img src="resources/reflect-180-06.svg" style="width: 400px"></div>

表面を右に45度回転させましょう。

<div class="webgpu_center"><img src="resources/reflect-45-01.svg" style="width: 400px"></div>

135度離れた2つのベクトルのドット積は-0.707です。

<div class="webgpu_center"><img src="resources/reflect-45-02.svg" style="width: 400px"></div>

したがって、すべてを式に代入すると

<div class="webgpu_center"><img src="resources/reflect-45-03.svg" style="width: 400px"></div>

再び2つの負の数を掛けると正になりますが、<span style="color: green">ベクトル</span>は約30％短くなります。

<div class="webgpu_center"><img src="resources/reflect-45-04.svg" style="width: 400px"></div>

ベクトルを足し合わせると、<span style="color: red">反射ベクトル</span>が得られます。

<div class="webgpu_center"><img src="resources/reflect-45-05.svg" style="width: 400px"></div>

これを元の図に戻すと、正しいように見えます。

<div class="webgpu_center"><img src="resources/reflect-45-06.svg" style="width: 400px"></div>

その<span style="color: red">反射方向</span>を使用して、キューブマップを見てオブジェクトの表面を色付けします。

これは、表面の回転を設定し、方程式のさまざまな部分を見ることができる図です。また、反射ベクトルがキューブマップのさまざまな面を指し、表面の色に影響を与えることもわかります。

{{{diagram url="resources/environment-mapping.html" width="700" height="500" }}}

反射の仕組みと、それを使用してキューブマップから値を検索できることがわかったので、シェーダーを変更してそれを実行しましょう。

まず、頂点シェーダーで、頂点のワールド位置とワールド指向の法線を計算し、それらをステージ間変数としてフラグメントシェーダーに渡します。これは、[スポットライトに関する記事](webgpu-3d-lighting-spot.html)で行ったことと似ています。

```wgsl
struct Uniforms {
-  matrix: mat4x4f,
+  projection: mat4x4f,
+  view: mat4x4f,
+  world: mat4x4f,
+  cameraPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
+  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) normal: vec3f,
+  @location(0) worldPosition: vec3f,
+  @location(1) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = uni.matrix * vert.position;
-  vsOut.normal = normalize(vert.position.xyz);
+  vsOut.position = uni.projection * uni.view * uni.world * vert.position;
+  vsOut.worldPosition = (uni.world * vert.position).xyz;
+  vsOut.worldNormal = (uni.world * vec4f(vert.normal, 0)).xyz;
  return vsOut;
}
```

次に、フラグメントシェーダーで、頂点間でサーフェスを横切って補間されるため、`worldNormal`を正規化します。[カメラに関する記事](webgpu-cameras.html)の行列演算に基づいて、ビュー行列の3行目を取得してそれを否定し、それをサーフェスのワールド位置から引くことで、カメラのワールド位置を取得できます。これにより、`eyeToSurfaceDir`が得られます。

そして最後に、上記で説明した式を実装する組み込みWGSL関数である`reflect`を使用します。その結果を使用して、キューブマップから色を取得します。

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
+  let worldNormal = normalize(vsOut.worldNormal);
+  let eyeToSurfaceDir = normalize(vsOut.worldPosition - uni.cameraPosition);
+  let direction = reflect(eyeToSurfaceDir, worldNormal);

-  return textureSample(ourTexture, ourSampler, normalize(vsOut.normal));
+  return textureSample(ourTexture, ourSampler, direction);
}
```

この例には、実際の法線も必要です。キューブの面が平らに見えるように、実際の法線が必要です。前の例では、キューブマップが機能することを確認するためだけに、キューブの位置を再利用しましたが、この場合は、[ライティングに関する記事](webgpu-lighting-directional.html)で説明したように、キューブの実際の法線が必要です。

```js
  const vertexData = new Float32Array([
-     // 前面
-    -1,  1,  1,
-    -1, -1,  1,
-     1,  1,  1,
-     1, -1,  1,
-     // 右面
-     1,  1, -1,
-     1,  1,  1,
-     1, -1, -1,
-     1, -1,  1,
-     // 背面
-     1,  1, -1,
-     1, -1, -1,
-    -1,  1, -1,
-    -1, -1, -1,
-    // 左面
-    -1,  1,  1,
-    -1,  1, -1,
-    -1, -1,  1,
-    -1, -1, -1,
-    // 底面
-     1, -1,  1,
-    -1, -1,  1,
-     1, -1, -1,
-    -1, -1, -1,
-    // 上面
-    -1,  1,  1,
-     1,  1,  1,
-    -1,  1, -1,
-     1,  1, -1,
+     //  位置   |  法線
+     //-------------+----------------------
+     // 前面      正のz
+    -1,  1,  1,         0,  0,  1,
+    -1, -1,  1,         0,  0,  1,
+     1,  1,  1,         0,  0,  1,
+     1, -1,  1,         0,  0,  1,
+     // 右面      正のx
+     1,  1, -1,         1,  0,  0,
+     1,  1,  1,         1,  0,  0,
+     1, -1, -1,         1,  0,  0,
+     1, -1,  1,         1,  0,  0,
+     // 背面       負のz
+     1,  1, -1,         0,  0, -1,
+     1, -1, -1,         0,  0, -1,
+    -1,  1, -1,         0,  0, -1,
+    -1, -1, -1,         0,  0, -1,
+    // 左面        負のx
+    -1,  1,  1,        -1,  0,  0,
+    -1,  1, -1,        -1,  0,  0,
+    -1, -1,  1,        -1,  0,  0,
+    -1, -1, -1,        -1,  0,  0,
+    // 底面      負のy
+     1, -1,  1,         0, -1,  0,
+    -1, -1,  1,         0, -1,  0,
+     1, -1, -1,         0, -1,  0,
+    -1, -1, -1,         0, -1,  0,
+    // 上面         正のy
+    -1,  1,  1,         0,  1,  0,
+     1,  1,  1,         0,  1,  0,
+    -1,  1, -1,         0,  1,  0,
+     1,  1, -1,         0,  1,  0,
  ]);
```

そしてもちろん、法線を提供するためにパイプラインを変更する必要があります。

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (3) * 4, // (3) floats 4 bytes each
+          arrayStride: (3 + 3) * 4, // (6) floats 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
+            {shaderLocation: 1, offset: 12, format: 'float32x3'},  // normal
          ],
        },
      ],
    },

```

いつものように、ユニフォームバッファとビューを設定する必要があります。

```js
-  // 行列
-  const uniformBufferSize = (16) * 4;
+  // 射影、ビュー、ワールド、カメラ位置、パッド
+  const uniformBufferSize = (16 + 16 + 16 + 3 + 1) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
-  const kMatrixOffset = 0;
-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
  const kProjectionOffset = 0;
  const kViewOffset = 16;
  const kWorldOffset = 32;
+  const projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16);
+  const viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const cameraPositionValue = uniformValues.subarray(
+      kCameraPositionOffset, kCameraPositionOffset + 3);
```

そして、レンダリング時にそれらを設定する必要があります。

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
-        matrixValue,
+        projectionValue,
    );
+    cameraPositionValue.set([0, 0, 4]);  // カメラ位置
    const view = mat4.lookAt(
-      [0, 1, 5],  // カメラ位置
+      cameraPositionValue,
      [0, 0, 0],  // ターゲット
      [0, 1, 0],  // 上
+      viewValue,
    );
-    mat4.multiply(matrixValue, view, matrixValue);
-    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
-    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
-    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
+    mat4.identity(worldValue);
+    mat4.rotateX(worldValue, time * -0.1, worldValue);
+    mat4.rotateY(worldValue, time * -0.2, worldValue);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

レンダリングをrAFループに変更しましょう。

```js
-  const degToRad = d => d * Math.PI / 180;
-
-  const settings = {
-    rotation: [degToRad(20), degToRad(25), degToRad(0)],
-  };
-
-  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
-
-  const gui = new GUI();
-  gui.onChange(render);
-  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
-  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
-  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');

  let depthTexture;

-  function render() {
+  function render(time) {
+    time *= 0.001;

     ...

+    requestAnimationFrame(render);
+  }
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

そして、それで得られるものは次のとおりです。

{{{example url="../webgpu-environment-map-backward.html" }}}

よく見ると、小さな問題が見えるかもしれません。

<div class="webgpu_center"><img src="resources/environment-map-backward.png" class="nobg" style="width: 600px;"></div>

## <a id="a-flipped"></a>反射方向の修正

環境マップが適用されたキューブは、鏡張りのキューブを表します。しかし、鏡は通常、水平方向に反転して表示されます。何が起こっているのでしょうか？

問題は、私たちがキューブの内側から外側を見ていることですが、[前の記事](webgpu-cube-maps.html)から、キューブの各面にテクスチャをマッピングしたとき、外側から見ると正しくマッピングされたことを思い出してください。

<div class="webgpu_center">
  <div data-diagram="show-cube-map" class="center-by-margin" style="width: 700px; height: 400px"></div>
</div>

これを別の見方をすると、キューブの内側から見ると、「y-up右手座標系」にいます。これは、正のzが前方であることを意味します。一方、これまでの3D数学はすべて、「y-up左手座標系」[^xxx-handed]を使用しており、負のzが前方です。簡単な解決策は、テクスチャをサンプリングするときにZ座標を反転させることです。

[^xxx-handed]: 正直なところ、この「左手」対「右手」座標系の話は非常に紛らわしいと感じており、「+xが右、+yが上、-zが前方」と言った方がはるかに曖昧さがないと思います。もっと知りたい場合は、[ググってみてください](https://www.google.com/search?q=right+handed+vs+left+handed+coordinate+system&tbm=isch)😄

```wgsl
-  return textureSample(ourTexture, ourSampler, direction);
+  return textureSample(ourTexture, ourSampler, direction * vec3f(1, 1, -1));
```

これで、鏡のように反射が反転しました。

{{{example url="../webgpu-environment-map.html" }}}

次に、[スカイボックスにキューブマップを使用する方法](webgpu-skybox.html)を示します。

## キューブマップの検索と作成

[polyhaven.com](https://polyhaven.com/hdris)で何百もの無料のパノラマを見つけることができます。それらのいずれかのjpgまたはpngをダウンロードします（右上の≡メニューをクリックします）。次に、[このページ](https://greggman.github.io/panorama-to-cubemap/)に移動し、.jpgまたは.pngファイルをそこにドラッグアンドドロップします。必要なサイズと形式を選択し、ボタンをクリックして画像をキューブマップの面として保存します。