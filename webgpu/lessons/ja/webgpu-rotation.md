Title: WebGPU 回転
Description: オブジェクトの回転
TOC: 回転

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事は、3D数学について学ぶことを目的とした一連の記事の2番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html) ⬅ ここです
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

最初に、私がこれをどのように説明するかが理にかなっているかどうかはわかりませんが、とにかく試してみる価値はあると思います。

まず、「単位円」と呼ばれるものを紹介したいと思います。中学校の数学を覚えているなら（私に眠らないでください！）、円には半径があります。円の半径は、円の中心から端までの距離です。単位円は、半径が1.0の円です。

これが単位円です。[^ydown]

[^ydown]: この単位円は、ピクセル空間に合わせて+Yが下になっています。これもYが下です。WebGPUの通常のクリップ空間は+Yが上です。前の記事で説明したように、シェーダーでYを反転させました。

<div class="webgpu_center"><div data-diagram="unit-circle" style="display: inline-block; width: 500px;"></div></div>

円の周りの青いハンドルをドラッグすると、XとYの位置が変わることに注意してください。それらは、円上のその点の位置を表します。上部ではYが1、Xが0です。右側ではXが1、Yが0です。

基本的な3年生の数学から覚えているなら、何かを1で乗算すると、それは同じままです。したがって、123 * 1 = 123です。かなり基本的ですよね？さて、単位円、半径が1.0の円も1の一種です。回転する1です。したがって、何かをこの単位円で乗算することができ、ある意味では、1で乗算するようなものですが、魔法が起こり、物事が回転します。

単位円上の任意の点からそのXとYの値を取得し、[前の例](webgpu-translation.html)から頂点位置をそれらで乗算します。

シェーダーの更新は次のとおりです。


```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
+  rotation: vec2f,
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

+  // 位置を回転させます
+  let rotatedPosition = vec2f(
+    vert.position.x * uni.rotation.x - vert.position.y * uni.rotation.y,
+    vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x
+  );

  // 平行移動を追加します
-  let position = vert.position + uni.translation;
+  let position = rotatedPosition + uni.translation;

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
```

そして、新しいユニフォーム値のためのスペースを追加するようにJavaScriptを更新します。

```js
-  // 色、解像度、平行移動
-  const uniformBufferSize = (4 + 2 + 2) * 4;
+  // 色、解像度、平行移動、回転、パディング
+  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
  const kResolutionOffset = 4;
  const kTranslationOffset = 6;
+  const kRotationOffset = 8;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
+  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
```

そして、何らかのUIが必要です。これはUIを作成するためのチュートリアルではないので、1つだけ使用します。まず、それを配置するためのHTMLです。

```html
  <body>
    <canvas></canvas>
+    <div id="circle"></div>
  </body>
```

次に、どこかに配置するためのCSSです。

```css
#circle {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 300px;
  background-color: var(--bg-color);
}
```

そして最後に、それを使用するためのJavaScriptです。

```js
+import UnitCircle from './resources/js/unit-circle.js';

...

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');

+  const unitCircle = new UnitCircle();
+  document.querySelector('#circle').appendChild(unitCircle.domElement);
+  unitCircle.onChange(render);

  function render() {
    ...

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
+    rotationValue.set([unitCircle.x, unitCircle.y]);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

そして、これが結果です。円のハンドルをドラッグして回転させるか、スライダーをドラッグして平行移動します。

{{{example url="../webgpu-rotation-via-unit-circle.html"}}}

なぜ機能するのでしょうか？まあ、数学を見てください。

<div class="webgpu_center">
<pre class="webgpu_math">
rotatedX = a_position.x * u_rotation.x - a_position.y * u_rotation.y;
rotatedY = a_position.x * u_rotation.y + a_position.y * u_rotation.x;
</pre>
</div>

長方形があり、それを回転させたいとします。回転を開始する前は、右上隅は3.0、-9.0にあります。単位円上の点を3時から時計回りに30度の点を選択しましょう。

<div class="webgpu_center"><div data-diagram="static-circle-30" style="display: inline-block; width: 400px;"></div></div>

円上の位置はx = 0.87、y = 0.50です。

<div class="webgpu_center">
<pre class="webgpu_math">
 3.0 * 0.87 - -9.0 * 0.50 =  7.1
 3.0 * 0.50 + -9.0 * 0.87 = -6.3
</pre>
</div>

それはまさに私たちが必要とする場所です。

<img src="resources/rotation-drawing.svg" width="500" class="webgpu_center" style="width: 1000px"/>

時計回りに60度の場合も同じです。

<div class="webgpu_center"><div data-diagram="static-circle-60" style="display: inline-block; width: 400px;"></div></div>

円上の位置は0.87と0.50です。

<div class="webgpu_center">
<pre class="webgpu_math">
 3.0 * 0.50 - -9.0 * 0.87 =  9.3
 3.0 * 0.87 + -9.0 * 0.50 = -1.9
</pre>
</div>

その点を時計回りに回転させると、X値が大きくなり、Yが小さくなることがわかります。90度を超えて進み続けると、Xは再び小さくなり始め、Yは大きくなり始めます。そのパターンが回転を与えます。

単位円上の点には別の名前があります。それらはサインとコサインと呼ばれます。したがって、任意の角度に対して、次のようにサインとコサインを検索するだけです。

    function printSineAndCosineForAnAngle(angleInDegrees) {
      const angleInRadians = angleInDegrees * Math.PI / 180;
      const s = Math.sin(angleInRadians);
      const c = Math.cos(angleInRadians);
      console.log('s =', s, 'c =', c);
    }

JavaScriptコンソールにコードをコピーして貼り付け、`printSineAndCosignForAngle(30)`と入力すると、`s = 0.50 c = 0.87`と表示されます（注：数値を丸めました）。

すべてをまとめると、頂点位置を好きな角度に回転させることができます。回転を、回転させたい角度のサインとコサインに設定するだけです。

      ...
      const angleInRadians = angleInDegrees * Math.PI / 180;
      rotation[0] = Math.cos(angleInRadians);
      rotation[1] = Math.sin(angleInRadians);

回転設定のみを持つように変更しましょう。

```js
+  const degToRad = d => d * Math.PI / 180;

  const settings = {
    translation: [150, 100],
+    rotation: degToRad(30),
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
+  gui.add(settings, 'rotation', radToDegOptions);

-  const unitCircle = new UnitCircle();
-  document.querySelector('#circle').appendChild(unitCircle.domElement);
-  unitCircle.onChange(render);

  function render() {
    ...

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
-    rotationValue.set([unitCircle.x, unitCircle.y]);
+    rotationValue.set([
+        Math.cos(settings.rotation),
+        Math.sin(settings.rotation),
+    ]);
```

スライダーをドラッグして平行移動または回転します。

{{{example url="../webgpu-rotation.html"}}}

これが少しでも意味をなしたことを願っています。[次はもっと簡単なものです。スケール](webgpu-scale.html)です。

<div class="webgpu_bottombar"><h3>ラジアンとは何ですか？</h3>
<p>
ラジアンは、円、回転、角度で使用される測定単位です。距離をインチ、ヤード、メートルなどで測定できるように、角度を度またはラジアンで測定できます。
</p>
<p>
メートル法での数学は、ヤード・ポンド法での数学よりも簡単であることはご存知でしょう。インチからフィートに変換するには、12で割ります。インチからヤードに変換するには、36で割ります。私は頭の中で36で割ることはできません。メートル法でははるかに簡単です。ミリメートルからセンチメートルに変換するには、10で割ります。ミリメートルからメートルに変換するには、1000で割ります。私は頭の中で1000で割る**こと**ができます。
</p>
<p>
ラジアンと度は似ています。度は数学を難しくします。ラジアンは数学を簡単にします。円には360度ありますが、2πラジアンしかありません。したがって、1回転は2πラジアンです。半回転は1πラジアンです。1/4回転、つまり90度は1/2πラジアンです。したがって、何かを90度回転させたい場合は、`Math.PI * 0.5`を使用するだけです。45度回転させたい場合は、`Math.PI * 0.25`などを使用します。
</p>
<p>
角度、円、または回転を含むほとんどすべての数学は、ラジアンで考え始めると非常に単純に機能します。だから試してみてください。UI表示を除いて、度ではなくラジアンを使用してください。
</p>
</div>

<!-- この記事の最後にこれを保持してください -->
<script type="module" src="webgpu-rotation.js"></script>

