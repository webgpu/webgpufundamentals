Title: WebGPU - スポットライト
Description: WebGPUでスポットライトを実装する方法
TOC: スポットライト


この記事は、[点光源に関する記事](webgpu-lighting-point.html)の続きです。まだ読んでいない場合は、[そこから始める](webgpu-lighting-point.html)ことをお勧めします。

前の記事では、オブジェクトの表面上のすべての点について、光からその表面上の点までの方向を計算する点光源について説明しました。次に、[指向性ライティング](webgpu-lighting-directional.html)で行ったのと同じことを行いました。つまり、表面法線（表面が向いている方向）と光の方向のドット積を取りました。これにより、2つの方向が一致する場合は1、したがって完全に照らされ、2つの方向が垂直な場合は0、反対の場合は-1の値が得られました。その値を直接使用して表面の色を乗算し、ライティングを得ました。

スポットライトは、ごくわずかな変更です。実際、これまでにやったことを創造的に考えれば、独自の解決策を導き出せるかもしれません。

点光源は、その点からすべての方向に光が進む点と考えることができます。スポットライトを作成するには、その点から方向を選択するだけで済みます。これがスポットライトの方向です。次に、光が進むすべての方向について、その方向と選択したスポットライトの方向のドット積を取ることができます。任意の制限を選択し、その制限内にある場合は点灯し、制限内にない場合は点灯しないようにします。

{{{diagram url="resources/spot-lighting.html" width="700" height="400" className="noborder" }}}

上の図では、すべての方向に光線が進む光があり、それらには方向に対するドット積が印刷されています。次に、スポットライトの方向である特定の**方向**があります。制限を選択します（上記では度単位です）。制限から*ドット制限*を計算します。制限のコサインを取るだけです。スポットライトの選択した方向と各光線の方向のドット積がドット制限より大きい場合は、ライティングを行います。それ以外の場合は、ライティングは行いません。

別の言い方をすれば、制限が20度だとしましょう。それをラジアンに変換し、そこからコサインを取ることで-1から1の値に変換できます。それをドット空間と呼びましょう。つまり、制限値の小さな表を次に示します。

              制限（度単位）
     度 | ラジアン | ドット空間
     --------+---------+----------
        0    |   0.0   |    1.0
        22   |    .38  |     .93
        45   |    .79  |     .71
        67   |   1.17  |     .39
        90   |   1.57  |    0.0
       180   |   3.14  |   -1.0

次に、次のように確認できます。

    dotFromDirection = dot(surfaceToLight, -lightDirection)
    if (dotFromDirection >= limitInDotSpace) {
       // ライティングを行う
    }

では、やってみましょう。

まず、[前の記事](webgpu-lighting-point.html)のフラグメントシェーダーを変更しましょう。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
+  lightDirection: vec3f,
+  limit: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // vsOut.normalはステージ間変数であるため、
  // 補間されるため、単位ベクトルにはなりません。
  // 正規化すると、再び単位ベクトルになります。
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);


+  var light = 0.0;
+  var specular = 0.0;
+
+  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
+  if (dotFromDirection > uni.limit) {
    // 法線と光への方向のドット積を
    // 取ることで光を計算します。
-    let light = dot(normal, surfaceToLightDirection);
+    light = dot(normal, surfaceToLightDirection);

    specular = dot(normal, halfVector);
    specular = select(
        0.0,                           // 条件がfalseの場合の値
        pow(specular, uni.shininess),  // 条件がtrueの場合の値
        specular > 0.0);               // 条件
+  }

  // 色の部分（アルファではない）のみを
  // 光で乗算しましょう。
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

もちろん、ユニフォームバッファに新しい値のためのスペースを追加する必要があります。

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
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
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
+  const kLightDirectionOffset = 56;
+  const kLimitOffset = 59;

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
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
+  const lightDirectionValue = uniformValues.subarray(
+      kLightDirectionOffset, kLightDirectionOffset + 3);
+  const limitValue = uniformValues.subarray(
+      kLimitOffset, kLimitOffset + 1);
```

そして、それらを設定する必要があります。

```js
    colorValue.set([0.2, 1, 0.2, 1]);  // green
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
+    limitValue[0] = Math.cos(settings.limit);

    // ほとんどのスポットライトの例のように平面がないので、
    // スポットライトをFに向けましょう。
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 行列からzAxisを取得します
        // lookAtは-Z軸を見下ろすため、それを否定します
        lightDirectionValue.set(mat.slice(8, 11));
    }
```

上記では、[カメラに関する記事](webgpu-cameras.html)で説明した`mat4.aim`を使用しています。具体的には、Fは`target`です。スポットライトは`-10, 30, 100`にあります。スポットライトを簡単に狙えるように、ターゲットにいくつかのオフセットを追加します。次に、`z軸`（エイムが何かを指す方向）を抜き出すだけです。

UIコードを追加するだけです。

```
  const settings = {
    rotation: degToRad(0),
    shininess: 30,
+    limit: degToRad(15),
+    aimOffsetX: -10,
+    aimOffsetY: 10,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
  gui.add(settings, 'shininess', { min: 1, max: 250 });
+  gui.add(settings, 'limit', limitOptions);
+  gui.add(settings, 'aimOffsetX', -50, 50);
+  gui.add(settings, 'aimOffsetY', -50, 50);
```

そして、これがそれです。

{{{example url="../webgpu-lighting-spot.html" }}}

1つの注意点は、シェーダーで`uni.lightDirection`を否定していることです。これは[*六つのうちの一つ、半ダースのもう一つ*](https://en.wiktionary.org/wiki/six_of_one,_half_a_dozen_of_the_other)のようなものです。比較している2つの方向が一致するときに同じ方向を向くようにしたいです。つまり、surfaceToLightDirectionをスポットライトの方向の反対と比較する必要があります。

現在、スポットライトは非常に厳しいです。スポットライトの内側にいるかどうかにかかわらず、物事は真っ黒になります。

これを修正するには、1つではなく2つの制限、内側の制限と外側の制限を使用できます。内側の制限の内側にいる場合は1.0を使用します。外側の制限の外側にいる場合は0.0を使用します。内側の制限と外側の制限の間にある場合は、1.0と0.0の間を線形補間します。

これを行う1つの方法は次のとおりです。

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
-  limit: f32,
+  innerLimit: f32,
+  outerLimit: f32,
};

...

-  var light = 0.0;
-  var specular = 0.0;
-
-  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-  if (dotFromDirection > uni.limit) {
-    // 法線と光への方向のドット積を
-    // 取ることで光を計算します。
-    light = dot(normal, surfaceToLightDirection);
-    specular = dot(normal, halfVector);
-    specular = select(
-        0.0,                           // 条件がfalseの場合の値
-        pow(specular, uni.shininess),  // 条件がtrueの場合の値
-        specular > 0.0);               // 条件
-  }

    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
    let limitRange = uni.innerLimit - uni.outerLimit;
    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);

    // 法線と光への方向のドット積を
    // 取ることで光を計算します。
    let light = inLight * dot(normal, surfaceToLightDirection);

    var specular = dot(normal, halfVector);
    specular = inLight * select(
        0.0,                           // 条件がfalseの場合の値
        pow(specular, uni.shininess),  // 条件がtrueの場合の値
        specular > 0.0);               // 条件

```

`saturate`を使用しています。Saturateは値を0と1の間にクランプします。つまり、`outerLimit`の外側にいる場合、`inLight`は0になります。`innerLimit`の内側にいる場合は1になります。そして、これら2つの制限の間では0と1の間になります。次に、光とスペキュラの計算に`inLight`を乗算します。

そして、ユニフォームバッファの設定を再度更新する必要があります。

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4 + 4) * 4;
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
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
  const kLightDirectionOffset = 56;
-  const kLimitOffset = 59;
+  const kInnerLimitOffset = 59;
+  const kOuterLimitOffset = 60;

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
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
  const lightDirectionValue = uniformValues.subarray(
      kLightDirectionOffset, kLightDirectionOffset + 3);
-  const limitValue = uniformValues.subarray(
-      kLimitOffset, kLimitOffset + 1);
+  const innerLimitValue = uniformValues.subarray(
+      kInnerLimitOffset, kInnerLimitOffset + 1);
+  const outerLimitValue = uniformValues.subarray(
+      kOuterLimitOffset, kOuterLimitOffset + 1);
```

そして、それらを設定する場所です。

```js
  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
  gui.add(settings, 'shininess', { min: 1, max: 250 });
-  gui.add(settings, 'limit', limitOptions);
+  GUI.makeMinMaxPair(gui, settings, 'innerLimit', 'outerLimit', limitOptions);
  gui.add(settings, 'aimOffsetX', -50, 50);
  gui.add(settings, 'aimOffsetY', -50, 50);

  ...

  function render() {

    ...

    colorValue.set([0.2, 1, 0.2, 1]);  // green
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
-    limitValue[0] = Math.cos(settings.limit);
+    innerLimitValue[0] = Math.cos(settings.innerLimit);
+   outerLimitValue[0] = Math.cos(settings.outerLimit);

    ...
```

そして、それは機能します。

{{{example url="../webgpu-lighting-spot-w-linear-falloff.html" }}}

これで、スポットライトのように見えるものが得られました！

注意すべき点の1つは、`innerLimit`が`outerLimit`と等しい場合、`limitRange`は0.0になることです。`limitRange`で除算し、ゼロで除算することは悪い/未定義です。ここではシェーダーで何もする必要はありません。JavaScriptで`innerLimit`が`outerLimit`と等しくならないようにするだけで済みます。この場合、GUIがそれをやってくれます。

WGSLには、これを少し単純化するために使用できる関数もあります。それは`smoothstep`と呼ばれ、0から1の値を返しますが、下限と上限の両方を取り、それらの境界の間で0と1の間を線形補間します。

```wgsl
     smoothstep(lowerBound, upperBound, value)
```

では、やってみましょう。

```wgsl
    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-    let limitRange = uni.innerLimit - uni.outerLimit;
-    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);
+    let inLight = smoothStep(uni.outerLimit, uni.innerLimit, dotFromDirection);
```

それも機能します。

{{{example url="../webgpu-lighting-spot-w-smoothstep-falloff.html" }}}

違いは、`smoothstep`が線形補間の代わりに*エルミート補間*を使用することです。つまり、`lowerBound`と`upperBound`の間では、下の画像の右側のように補間しますが、線形補間は左側の画像のようになります。

<img class="webgpu_center invertdark" src="resources/linear-vs-hermite.png" />

違いが重要だと思うかどうかはあなた次第です。

もう1つ注意すべき点は、`smoothstep`関数は、`lowerBound`が`upperBound`以上の場合に未定義の結果になることです。それらが等しいことは、上記で抱えていたのと同じ問題です。`lowerBound`が`upperBound`より大きい場合に定義されないという追加の問題は新しいですが、スポットライトの目的上、それは決して真実ではありません。