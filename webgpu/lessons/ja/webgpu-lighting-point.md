Title: WebGPU - 点光源
Description: WebGPUで点光源を実装する方法
TOC: 点光源

この記事は、[WebGPU指向性ライティング](webgpu-lighting-directional.html)の続きです。まだ読んでいない場合は、[そこから始める](webgpu-lighting-directional.html)ことをお勧めします。

前の記事では、光が普遍的に同じ方向から来る指向性ライティングについて説明しました。レンダリングする前にその方向を設定しました。

光の方向を設定する代わりに、光の3D空間内の点を選択し、その点からモデルの表面上の各可視点までの方向をシェーダーで計算したらどうなるでしょうか？これにより、点光源が得られます。

{{{diagram url="resources/point-lighting.html" width="700" height="400" className="noborder" }}}

上の表面を回転させると、表面上の各点が異なる*表面から光への*ベクトルを持っていることがわかります。表面法線と個々の表面から光へのベクトルのドット積を取得すると、表面上の各点で異なる値が得られます。

では、やってみましょう。

まず、光の位置が必要です。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
-  lightDirection: vec3f,
+  lightPosition: vec3f,
};
```

そして、表面のワールド位置を計算する方法が必要です。そのためには、位置をワールド行列で乗算できますので...

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
+  world: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
  lightPosition: vec3f,
};

....

  // 表面のワールド位置を計算します
  let surfaceWorldPosition = (u_world * vert.position).xyz;


```

そして、表面から光へのベクトルを計算できます。これは、以前にあった光の方向と似ていますが、今回は表面上のすべての位置から光のワールド位置点まで計算しています。

```wgsl
  struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) surfaceToLight: vec3f,
  };

  ...

    // 表面から光へのベクトルを計算し、
    // フラグメントシェーダーに渡します
    vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;
```

文脈の中で、すべてを次に示します。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
*  world: mat4x4f,
  color: vec4f,
*  lightPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
*  @location(1) surfaceToLight: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // 法線を方向付け、フラグメントシェーダーに渡します
  vsOut.normal = uni.normalMatrix * vert.normal;

*  // 表面のワールド位置を計算します
*  let surfaceWorldPosition = (uni.world * vert.position).xyz;
*
*  // 表面から光へのベクトルを計算し、
*  // フラグメントシェーダーに渡します
*  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

  return vsOut;
}
```

次に、フラグメントシェーダーで、表面から光へのベクトルを正規化する必要があります。これは単位ベクトルではないためです。頂点シェーダーで正規化することもできますが、*ステージ間変数*であるため、位置間で線形補間され、完全な単位ベクトルにはなりません。

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // vsOut.normalはステージ間変数であるため、
  // 補間されるため、単位ベクトルにはなりません。
  // 正規化すると、再び単位ベクトルになります。
  let normal = normalize(vsOut.normal);

+  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // 法線と光の逆方向のドット積を
-  // 取ることで光を計算します。
-  let light = dot(normal, -uni.lightDirection);
+  // 法線と光への方向のドット積を取ることで光を計算します。
+  let light = dot(normal, surfaceToLightDirection);

  // 色の部分（アルファではない）のみを
  // 光で乗算しましょう。
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}
```

次に、ユニフォームバッファ、オフセット、ビューを更新する必要があります。

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
-  const kColorOffset = 28;
-  const kLightDirectionOffset = 32;
+  const kWorldOffset = 28;
+  const kColorOffset = 44;
+  const kLightPositionOffset = 48;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
+  const worldValue = uniformValues.subarray(
+      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-  const lightDirectionValue =
-      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
+  const lightPositionValue =
+      uniformValues.subarray(kLightPositionOffset, kLightPositionOffset + 3);
```

そして、それらを設定する必要があります。

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // ワールド行列を計算します
-    const world = mat4.rotationY(settings.rotation);
+    const world = mat4.rotationY(settings.rotation, worldValue);

    // ビュー射影行列とワールド行列を組み合わせます
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // 逆行列と転置行列をworldInverseTranspose値に変換します
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // green
=    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
+    lightPositionValue.set([-10, 30, 100]);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

```

そして、これがそれです。

{{{example url="../webgpu-lighting-point.html" }}}

# <a id="a-specular"></a>スペキュラハイライト

点ができたので、スペキュラハイライトと呼ばれるものを追加できます。

現実世界のオブジェクトを見ると、少しでも光沢がある場合、光が直接あなたに反射すると、ほとんど鏡のようになります。

<img class="webgpu_center" src="resources/specular-highlights.jpg" />

光が目に反射するかどうかを計算することで、その効果をシミュレートできます。ここでも、*ドット積*が役立ちます。

何をチェックする必要がありますか？まあ、考えてみましょう。光は表面に当たったのと同じ角度で反射するので、表面から光への方向が表面から目への方向の正確な反射である場合、それは光を目に反射するのに最適な角度です。

{{{diagram url="resources/surface-reflection.html" width="700" height="400" className="noborder" }}}

モデルの表面から光への方向がわかっていれば（先ほど行ったのでわかっています）、表面からビュー/目/カメラへの方向がわかっていれば、それら2つのベクトルを足して正規化して、それらの間の中間にあるベクトルである`halfVector`を取得できます。ハーフベクトルと表面法線が一致する場合、それは光をビュー/目/カメラに反射するのに最適な角度です。そして、それらが一致するかどうかをどうやって判断できますか？以前に行ったように、*ドット積*を取ります。1 = 一致、同じ方向、0 = 垂直、-1 = 反対。

{{{diagram url="resources/specular-lighting.html" width="700" height="400" className="noborder" }}}

したがって、まず、ビュー/カメラ/目の位置を渡し、表面からビューへのベクトルを計算し、それをフラグメントシェーダーに渡す必要があります。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
+  viewWorldPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) surfaceToLight: vec3f,
+  @location(2) surfaceToView: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // 法線を方向付け、フラグメントシェーダーに渡します
  vsOut.normal = uni.normalMatrix * vert.normal;

  // 表面のワールド位置を計算します
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  // 表面から光へのベクトルを計算し、
  // フラグメントシェーダーに渡します
  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

+  // 表面から光へのベクトルを計算し、
+  // フラグメントシェーダーに渡します
+  vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;

  return vsOut;
}
```

次に、フラグメントシェーダーで、表面からビューへのベクトルと表面から光へのベクトルの間の`halfVector`を計算する必要があります。次に、`halfVector`と法線のドット積を取って、光がビューに反射しているかどうかを調べることができます。

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // vsOut.normalはステージ間変数であるため、
  // 補間されるため、単位ベクトルにはなりません。
  // 正規化すると、再び単位ベクトルになります。
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // 法線と光への方向のドット積を
  // 取ることで光を計算します。
  let light = dot(normal, surfaceToLightDirection);

+  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
+  let halfVector = normalize(
+    surfaceToLightDirection + surfaceToViewDirection);
+  let specular = dot(normal, halfVector);

  // 色の部分（アルファではない）のみを
  // 光で乗算しましょう。
-  let color = uni.color.rgb * light;
+  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

繰り返しになりますが、ユニフォームバッファにviewWorldPosition用のスペースを追加する必要があります。

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightPositionOffset = 48;
+  const kViewWorldPositionOffset = 52;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightPositionValue = uniformValues.subarray(
      kLightPositionOffset, kLightPositionOffset + 3);
+  const viewWorldPositionValue = uniformValues.subarray(
+      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
```

そして、それを設定します。

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    ...

    viewWorldPositionValue.set(eye);
```

そして、これがそれです。

{{{example url="../webgpu-lighting-point-w-specular.html" }}}

**なんて明るいんだ！**

ドット積の結果をべき乗することで、明るさを修正できます。これにより、スペキュラハイライトが線形フォールオフから指数フォールオフに圧縮されます。

{{{diagram url="resources/power-graph.html" width="400" height="400" className="noborder" }}}

赤い線がグラフの上部に近いほど、スペキュラ加算は明るくなります。べき乗を上げると、明るくなる範囲が右に圧縮されます。

それを`shininess`と呼び、シェーダーに追加しましょう。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
+  shininess: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {

  ...

-  let specular = dot(normal, halfVector);
+  var specular = dot(normal, halfVector);
+  specular = select(
+      0.0,                           // 条件がfalseの場合の値
+      pow(specular, uni.shininess),  // 条件がtrueの場合の値
+      specular > 0.0);               // 条件
```

ドット積は負になる可能性があります。負の数をべき乗すると、WebGPUでは未定義（またはNaN？）になり、これは悪いことです。したがって、ドット積が負の場合は、スペキュラを0.0のままにします。

もちろん、`shininess`を設定する必要があります。

```js
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
+  const kShininessOffset = 55;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightWorldPositionValue = uniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = uniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
+  const shininessValue = uniformValues.subarray(
+      kShininessOffset, kShininessOffset + 1);

...

  const settings = {
    rotation: degToRad(0),
+    shininess: 30,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings, 'shininess', { min: 1, max: 250 });

...

  function render() {

   ...

+    shininessValue[0] = settings.shininess;

```

そして、これがそれです。

{{{example url="../webgpu-lighting-point-w-specular-power.html" }}}

次は[スポットライト](webgpu-lighting-spot.html)です。

<div class="webgpu_bottombar">
<h3>なぜ`pow(negative, power)`は未定義なのですか？</h3>
<p>これはどういう意味ですか？</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 2)</pre></div>
<p>まあ、次のように見ることができます。</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 = 25</pre></div>
<p>では、これはどうですか？</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 3)</pre></div>
<p>まあ、それは次のように見ることができます。</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 * 5 = 125</pre></div>
<p>さて、これはどうですか？</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2)</pre></div>
<p>まあ、それは次のようになります。</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 = 25</pre></div>
<p>そして</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 3)</pre></div>
<p>まあ、それは次のように見ることができます。</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 * -5 = -125</pre></div>
<p>ご存知のように、負の数を負の数で乗算すると正になります。もう一度負の数で乗算すると負になります。</p>
<p>では、これはどういう意味ですか？</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2.5)</pre></div>
<p>その結果が正か負かをどのように判断しますか？それは<a href="https://betterexplained.com/articles/a-visual-intuitive-guide-to-imaginary-numbers/">虚数</a>の世界です。</p>
</div>

