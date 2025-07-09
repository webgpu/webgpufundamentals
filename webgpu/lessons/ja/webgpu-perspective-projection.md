Title: WebGPU 透視投影
Description: 透視投影 - 遠くのものは小さく
TOC: 透視投影

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事は、3D数学について学ぶことを目的とした一連の記事の6番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html) ⬅ ここです
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

前回の投稿では、3Dを行う方法について説明しましたが、その3Dには遠近感がありませんでした。それは「正射影」ビューと呼ばれるものを使用していましたが、それには用途がありますが、一般的に人々が「3D」と言うときに望むものではありません。

代わりに、遠近感を追加する必要があります。遠近感とは何でしょうか？基本的には、遠くにあるものが小さく見えるという特徴です。

<img class="webgpu_center noinvertdark" style="width: 800px" src="resources/perspective-example.svg" />

上の例を見ると、遠くにあるものが小さく描かれていることがわかります。現在のサンプルを考えると、遠くにあるものが小さく見えるようにする簡単な方法の1つは、クリップ空間のXとYをZで割ることです。

このように考えてみてください：(10, 15)から(20,15)までの線がある場合、それは10単位の長さです。現在のサンプルでは、10ピクセルの長さで描画されます。しかし、Zで割ると、たとえばZが1の場合、

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 1 = 10
20 / 1 = 20
abs(10-20) = 10
</pre>
</div>

10ピクセルの長さになります。Zが2の場合、

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 2 = 5
20 / 2 = 10
abs(5 - 10) = 5
</pre>
</div>

5ピクセルの長さになります。Z = 3の場合、

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 3 = 3.333
20 / 3 = 6.666
abs(3.333 - 6.666) = 3.333
</pre>
</div>

Zが大きくなるにつれて、小さくなるにつれて、最終的には小さく描画され、したがって、より遠くに見えることがわかります。クリップ空間で除算すると、Zがより小さい数値（0から+1）になるため、より良い結果が得られる可能性があります。除算する前にZに乗算するfudgeFactorを追加すると、特定の距離に対して物がどれだけ小さくなるかを調整できます。

試してみましょう。まず、頂点シェーダーを変更して、「fudgeFactor」で乗算した後にZで除算するようにします。

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  fudgeFactor: f32,
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
-  vsOut.position = uni.matrix * vert.position;
+  let position = uni.matrix * vert.position;
+
+  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
+
+  vsOut.position = vec4f(
+      position.xy / zToDivideBy,
+      position.zw);

  vsOut.color = vert.color;
  return vsOut;
}
```

注：1を追加することで、`fudgeFactor`を0に設定し、1に等しい`zToDivideBy`を取得できます。これにより、Zで除算しない場合と比較できます。なぜなら、1で除算しても何も起こらないからです。

また、fudgeFactorを設定できるようにコードを更新する必要があります。

```js
-  // 行列
-  const uniformBufferSize = (16) * 4;
+  // 行列、fudgeFactor、パディング
+  const uniformBufferSize = (16 + 1 + 3) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kMatrixOffset = 0;
+  const kFudgeFactorOffset = 16;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const fudgeFactorValue = uniformValues.subarray(kFudgeFactorOffset, kFudgeFactorOffset + 1);

...

  const settings = {
    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
    scale: [3, 3, 3],
+    fudgeFactor: 0.5,
  };

...

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings.translation, '2', -1000, 1000).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
  gui.add(settings.scale, '0', -5, 5).name('scale.x');
  gui.add(settings.scale, '1', -5, 5).name('scale.y');
  gui.add(settings.scale, '2', -5, 5).name('scale.z');
+  gui.add(settings, 'fudgeFactor', 0, 50);

...

  function render() {

    ...

    mat4.ortho(
        0,                   // left
        canvas.clientWidth,  // right
        canvas.clientHeight, // bottom
        0,                   // top
        1200,                // near
        -1000,               // far
        matrixValue,         // dst
    );
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);

+    fudgeFactorValue[0] = settings.fudgeFactor;
```

また、結果が見やすくなるように`settings`を調整しました。

```js
  const settings = {
-    translation: [45, 100, 0],
+    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
+    scale: [3, 3, 3],
    fudgeFactor: 10,
  };
```

そして、これが結果です。

{{{example url="../webgpu-perspective-projection-step-1-fudge-factor.html" }}}

明確でない場合は、「fudgeFactor」スライダーを10.0から0.0にドラッグして、Zで除算するコードを追加する前の様子を確認してください。

<img class="webgpu_center" src="resources/orthographic-vs-perspective.png" />
<div class="webgpu_center">正射影と透視投影</div>

WebGPUは、頂点シェーダーの`@builtin(position)`に割り当てたx、y、z、wの値を取得し、それをwで自動的に除算することがわかりました。

これを非常に簡単に証明するには、シェーダーを変更し、自分で除算を行う代わりに、`zToDivideBy`を`vsOut.position.w`に入れます。

```wgsl
@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  let position = uni.matrix * vert.position;

  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;

-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
+  vsOut.position = vec4f(position.xyz, zToDivideBy);

  vsOut.color = vert.color;
  return vsOut;
}
```

そして、それがまったく同じであることがわかります。

{{{example url="../webgpu-perspective-projection-step-2-gpu-divide-by-w.html" }}}

WebGPUが自動的にWで除算するという事実はなぜ便利なのでしょうか？なぜなら、今では、さらに多くの行列の魔法を使用して、zをwにコピーするための別の行列を使用するだけで済むからです。

このような行列

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  0
</pre></div>

zをwにコピーします。これらの各行を次のように見ることができます。

<div class="webgpu_math_center"><pre class="webgpu_math">{{#escapehtml}}
x_out = x_in * 1 +
        y_in * 0 +
        z_in * 0 +
        w_in * 0 ;
 
y_out = x_in * 0 +
        y_in * 1 +
        z_in * 0 +
        w_in * 0 ;
 
z_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;
 
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;
{{/escapehtml}}</pre></div>


単純化すると、次のようになります。

<div class="webgpu_math_center"><pre class="webgpu_math">
x_out = x_in;
y_out = y_in;
z_out = z_in;
w_out = z_in;
</pre></div>

`w_in`が常に1.0であることがわかっているので、この行列で以前にあったプラス1を追加できます。

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  1
</pre></div>

これにより、Wの計算が次のように変更されます。

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 1 ;
</pre></div>

そして、`w_in` = 1.0であることがわかっているので、実際には

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in + 1;
</pre></div>

最後に、行列がこれである場合、fudgeFactorを元に戻すことができます。

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0            0
0  1  0            0
0  0  1            0
0  0  fudgeFactor  1
</pre></div>

つまり

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * fudgeFactor +
        w_in * 1 ;
</pre></div>

そして、単純化すると、次のようになります。

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in * fudgeFactor + 1;
</pre></div>

では、プログラムを再度変更して、行列のみを使用するようにしましょう。

まず、頂点シェーダーを元に戻して、再び単純にしましょう。

```wgsl
struct Uniforms {
  matrix: mat4x4f,
-  fudgeFactor: f32,
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
-  let position = uni.matrix * vert.position;
-
-  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
-
-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
  vsOut position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

次に、Z→W行列を作成する関数を作成しましょう。

```js
function makeZToWMatrix(fudgeFactor) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ];
}
```

そして、それを使用するようにコードを変更します。

```
-    mat4.ortho(
+    const projection = mat4.ortho(
        0,                   // left
        canvas.clientWidth,  // right
        canvas.clientHeight, // bottom
        0,                   // top
        1200,                // near
        -1000,               // far
-        matrixValue,         // dst
    );
+    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);
```

そして、繰り返しになりますが、まったく同じであることに注意してください。

{{{example url="../webgpu-perspective-projection-step-3-perspective-z-to-w.html" }}}

これらすべては、基本的に、Zで除算すると遠近感が得られ、WebGPUがこのZによる除算を便利に行ってくれることを示すためだけのものでした。

しかし、まだいくつかの問題があります。たとえば、Zを-1100あたりに設定すると、下のアニメーションのようなものが表示されます。

<div class="webgpu_center"><div data-diagram="z-clipping" style="height: 400px;"></div></div>

どうしたのでしょうか？なぜFが早く消えるのでしょうか？WebGPUがXとYを+1から-1にクリップするのと同じように、Zもクリップします。XとYとは異なり、Zは0から+1にクリップします。ここで見ているのは、クリップ空間でZ < 0です。

<div class="webgpu_center" style="width: 500px; height: 400px;"><div data-diagram="f-frustum-diagram"></div></div>

Wによる除算が適用されると、行列演算+Wによる除算は*錐台*を定義します。錐台の前面はZ = 0、背面はZ = 1です。その外側にあるものはすべてクリップされます。

<blockquote>
<h2>錐台</h2>
<p><i>名詞</i>:</p>
<ol><li>円錐または角錐の上部が底面に平行な平面で切り取られたもの</li></ol>
</blockquote>

それを修正するための数学について詳しく説明することもできますが、2D射影を行ったのと同じ方法で[導出できます](https://stackoverflow.com/a/28301213/128511)。Zを取得し、ある量（平行移動）を加え、ある量をスケーリングする必要があり、目的の範囲を-1から+1に再マッピングできます。

クールなのは、これらすべてのステップを1つの行列で実行できることです。さらに良いことに、`fudgeFactor`の代わりに、`fieldOfView`を決定し、それを実現するための適切な値を計算します。

行列を作成する関数は次のとおりです。

```js
const mat4 = {
  ...
  perspective(fieldOfViewYInRadians, aspect, zNear, zFar, dst) {
    dst = dst || new Float32Array(16);

    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
    const rangeInv = 1 / (zNear - zFar);

    dst[0] = f / aspect;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;

    dst[4] = 0;
    dst[5] = f;
    dst[6] = 0;
    dst[7] = 0;

    dst[8] = 0;
    dst[9] = 0;
    dst[10] = zFar * rangeInv;
    dst[11] = -1;

    dst[12] = 0;
    dst[13] = 0;
    dst[14] = zNear * zFar * rangeInv;
    dst[15] = 0;

    return dst;
  }
```

この行列は、すべての変換を自動的に行います。単位をクリップ空間に調整し、角度で視野を選択できるように数学を行い、Zクリッピング空間を選択できるようにします。原点（0、0、0）に*目*または*カメラ*があり、`zNear`と`fieldOfView`が与えられると、`zNear`にあるものが`Z = 0`になり、`zNear`にあるものが中心の上下に`fieldOfView`の半分であるものがそれぞれ`Y = -1`と`Y = 1`になるように計算します。渡された`aspect`で乗算するだけでXに使用するものを計算します。通常、これを表示領域の`width / height`に設定します。最後に、zFarにあるものが`Z = 1`になるようにZで物をどれだけスケーリングするかを計算します。

これは、動作中の行列の図です。

<div class="webgpu_center" style="width: 500px; height: 800px;"><div data-diagram="frustum-diagram"></div></div>

行列は、錐台内の空間を取得し、それをクリップ空間に変換します。`zNear`は、物が前面でクリップされる場所を定義し、`zFar`は、物が背面でクリップされる場所を定義します。`zNear`を23に設定すると、回転するキューブの前面がクリップされるのがわかります。`zFar`を24に設定すると、キューブの背面がクリップされるのがわかります。

この関数を例で使用しましょう。

```js
  const settings = {
    fieldOfView: degToRad(100),
    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
    scale: [3, 3, 3],
-    fudgeFactor: 10,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
-  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
-  gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
+  gui.add(settings.translation, '0', -1000, 1000).name('translation.x');
+  gui.add(settings.translation, '1', -1000, 1000).name('translation.y');
+  gui.add(settings.translation, '2', -1400, -100).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
-  gui.add(settings.scale, '0', -5, 5).name('scale.x');
-  gui.add(settings.scale, '1', -5, 5).name('scale.y');
-  gui.add(settings.scale, '2', -5, 5).name('scale.z');

  ...

  function render() {
    ....

-    const projection = mat4.ortho(
-        0,                   // left
-        canvas.clientWidth,  // right
-        canvas.clientHeight, // bottom
-        0,                   // top
-        1200,                // near
-        -1000,               // far
-    );
-    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
+    const aspect = canvas.clientWidth / canvas.clientHeight;
+    mat4.perspective(
+        settings.fieldOfView,
+        aspect,
+        1,      // zNear
+        2000,   // zFar
+        matrixValue,
+    );
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);
```

まだ1つ問題があります。この射影行列は、0,0,0にビューアがあり、負のZ方向を見ていて、正のYが上であると仮定しています。これまでの行列は、異なる方法で物事を行ってきました。高さ150単位、幅100単位、厚さ30単位のFを、ある-Z位置に配置する必要があり、錐台の内側に収まるように十分に離れている必要があります。上記で定義した錐台は、`zNear` = 1で、オブジェクトが1単位離れている場合、上から下まで約2.4単位しか表示されないため、Fは画面の98％オフになります。

いくつかの数値をいじってみたところ、これらの設定になりました。

```js
  const settings = {
    fieldOfView: degToRad(100),
-    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
-    rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [3, 3, 3],
+    translation: [-65, 0, -120],
+    rotation: [degToRad(220), degToRad(25), degToRad(325)],
+    scale: [1, 1, 1],
  };
```

そして、ついでに、UI設定をより適切なものに調整しましょう。また、UIを少しすっきりさせるためにスケールを削除しましょう。


```js
  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
-  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
-  gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
+  gui.add(settings.translation, '0', -1000, 1000).name('translation.x');
+  gui.add(settings.translation, '1', -1000, 1000).name('translation.y');
+  gui.add(settings.translation, '2', -1400, -100).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
-  gui.add(settings.scale, '0', -5, 5).name('scale.x');
-  gui.add(settings.scale, '1', -5, 5).name('scale.y');
-  gui.add(settings.scale, '2', -5, 5).name('scale.z');
```

「ピクセル空間」ではなくなったので、グリッドも削除しましょう。

```css
:root {
  --bg-color: #fff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #000;
  }
}
canvas {
  display: block;  /* canvasをブロックのように動作させる */
  width: 100%;     /* canvasがコンテナを埋めるようにする */
  height: 100%;
}
```

そして、これがそれです。

{{{example url="../webgpu-perspective-projection-step-4-perspective.html" }}}

シェーダーで1つの行列乗算に戻り、視野とZ空間の両方を選択できるようになりました。

次は、[カメラ](webgpu-cameras.html)です。

<div class="webgpu_bottombar">
<h3>なぜFをZで-120も移動させたのですか？</h3>
<p>
他のサンプルでは、Fは(45, 100, 0)にありましたが、最後のサンプルでは(-65, 0, -120)に移動しました。なぜそんなに遠くに移動する必要があったのでしょうか？
</p>
<p>
その理由は、この最後のサンプルまで、`mat4.projection`関数がピクセルからクリップ空間への射影を作成していたためです。つまり、表示していた領域はピクセルを表していました。「ピクセル」を使用することは、カメラから特定の距離にあるピクセルのみを表すため、3Dではあまり意味がありません。
</p>
<p>
つまり、新しい透視投影行列では、Fを平行移動0,0,0、回転0,0,0で描画しようとすると、次のようになります。
</p>
<div class="webgpu_center"><img src="resources/f-big-and-wrong-side.svg" style="width: 500px;"></div>
<p>
Fの左上前面の角は原点にあります。透視投影行列は負のZ方向を見ていますが、Fは正のZで構築されています。透視投影行列は正のYが上ですが、Fは正のZが下で構築されています。
</p>
<p>
新しい射影は、青い錐台の内側にあるものしか見えません。-zNear = 1で、視野が100度の場合、Z = -1では錐台の高さはわずか2.38単位、幅は2.38 * アスペクト単位です。Z = -2000（-zFar）では、高さは4767単位です。Fは150単位の大きさで、ビューは`zNear`にあるときに2.38単位しか見えないため、すべてを見るには原点からさらに離す必要があります。
</p>
<p>
Zで-120単位移動すると、Fが錐台の内側に移動します。また、右側が上になるように回転させました。
</p>
<div class="webgpu_center"><img src="resources/f-right-side.svg" style="width: 500px;"><div>縮尺どおりではありません</div></div>
</div>



<!-- この記事の最後にこれを保持してください -->
<script type="module" src="webgpu-perspective-projection.js"></script>

