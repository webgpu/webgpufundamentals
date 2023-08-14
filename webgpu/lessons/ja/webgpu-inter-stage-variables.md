Title: inter-stage(シェーダ間)変数
Description: 頂点シェーダからフラグメントシェーダへデータを渡す
TOC: inter-stage変数

前回の「[基本](webgpu-fundamentals.html)」と題した記事では、
WebGPUの、とてもとても基本的な事柄について説明しました。
今回は、inter-stage変数について、*普通に基本的な*事柄について説明します。

inter-stage変数が登場するのは、頂点シェーダとフラグメントシェーダの間です。

頂点シェーダが３点の座標値を出力すると、三角形がラスタライズ(ピクセルとして描画)されます。
頂点シェーダはこの「位置を表す座標値」のほかに、何がしかの情報を出力することができます。
この情報は各頂点と結びついており、デフォルトでは、
３点の間でグラデーションのように補間(interpolate)されます。

前回の記事で使った「三角形を描くシェーダ」を改造して、inter-stage変数を使ってみましょう。
今回改造するのは、このシェーダ部分だけです。

```js
  const module = device.createShaderModule({
-    label: 'our hardcoded red triangle shaders',
+    label: 'our hardcoded rgb triangle shaders',
    code: `
+      struct OurVertexShaderOutput {
+        @builtin(position) position: vec4f,
+        @location(0) color: vec4f,
+      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
+        var color = array<vec4f, 3>(
+          vec4f(1, 0, 0, 1), // red
+          vec4f(0, 1, 0, 1), // green
+          vec4f(0, 0, 1, 1), // blue
+        );

-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
      }

-      @fragment fn fs() -> @location(0) vec4f {
-        return vec4f(1, 0, 0, 1);
+      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+        return fsInput.color;
      }
    `,
  });
```

最初に`struct`(構造体)を宣言しています。
これはinter-stage変数を使うための簡単な方法です。
この`struct`を介して、頂点シェーダとフラグメントシェーダの間で
データの受け渡しをすることができます。


```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

頂点シェーダはは返り値として`vec4f`型変数を返していましたが、
これを、構造体`OurVertexShaderOutput`を返すように変更します。

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

三つの色を表す配列を用意します。

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // 赤
          vec4f(0, 1, 0, 1), // 緑
          vec4f(0, 0, 1, 1), // 青
        );
```

返り値として、位置を表す`vec4f`ではなく、位置と色の情報を持つ構造体を返すようにします。
そのために、まず構造体のインスタンスを宣言します。
構造体の各項目に値が設定できたら、それをreturnします。

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

フラグメントシェーダはこの構造体を、関数の引数として受け取るように変更します。

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

フラグメントシェーダの返り値は、色です。受け取った構造体の中に入っています。

これを実行します。頂点シェーダは呼ばれるたびに赤、緑、青を、それぞれの頂点の情報として返します。
３つの点を結ぶ三角形を構成する各ピクセルを描くひとつひとつのフラグメントシェーダは、
３つの点の間で補間(interpolate)された色を受け取ります。

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

inter-stage変数は、主に三角形中のテクスチャ座標の補間のために利用されます。
これについては「[テクスチャについて](webgpu-textures.html)」で説明します。
ほかの用途としては、三角形の法線情報の補間があります。
これについては、光源処理に関する記事の１本目、
「[平行光源について](webgpu-lighting-directional.html)」で扱います。

## inter-stage変数は`location`で結び付けられる

頂点シェーダとフラグメントシェーダの間での情報の受け渡しは、インデックスを介して行われる、という点に注意してください。
インデックスを介したデータの受け渡し、という考え方は、inter-stage変数に限らずWebGPUの多くの場面で登場します。
inter-stage変数の場合、`location`インデックスが使用されます。

「インデックスを介した」というのがどういうことか説明するために、試しにフラグメントシェーダ「だけ」変更してみます。
構造体`OurVertexShaderOutput`ではなく、`location(0)`の`vec4f`を受け取るようにします。

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```
上のようなコードに変更しても、挙動は変わらずに動作します。
構造体や、変数の名前や、引数の記述順、ではなく、
`location(0)`として明示的に指定したインデックスによって関係づけられている、ということです。

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## `@builtin(position)`の仕組み

これを踏まえて、`@builtin(position)`について考えてみます。
今使用しているサンプルプログラムでは、頂点シェーダとフラグメントシェーダで、共通の構造体を使っています。
この構造体には`position`というフィールドがあります。
`position`には`location`のインデックス情報がなく、替わりに`@builtin(position)`と宣言されています。

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

この構造体の`position`フィールドは**inter-stage変数ではありません**。`builtin`です。

`@builtin(position)`と記述されたものは、頂点シェーダとフラグメントシェーダで、違った解釈がされます。

頂点シェーダにおいては、`@builtin(position)`とは出力で、GPUが三角形/線/点を描くために必要とする座標情報です。

フラグメントシェーダにおいては、`@builtin(position)`は入力で、フラグメントシェーダが色を決めるべきピクセル、の座標情報です。
これは「ピクセル座標」です。

ピクセル座標は、ピクセルが構成する四角形の一端の頂点を(0,0)、同ピクセルの対角の頂点を(1,1)としています。
そして、フラグメントシェーダに渡されるのは、各ピクセルの中央の座標値です。
描画対象とするテクスチャが3x2ピクセルのサイズである場合、座標は次の図のようになります。

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

このピクセル座標によって色が決まるようなシェーダを書くこともできます。
例として、市松模様(checkerboard)を描いてみます。

```js
  const module = device.createShaderModule({
    label: 'our hardcoded checkerboard triangle shaders',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
-        @location(0) color: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
-        var color = array<vec4f, 3>(
-          vec4f(1, 0, 0, 1), // red
-          vec4f(0, 1, 0, 1), // green
-          vec4f(0, 0, 1, 1), // blue
-        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-        return fsInput.color;
+        let red = vec4f(1, 0, 0, 1);
+        let cyan = vec4f(0, 1, 1, 1);
+
+        let grid = vec2u(fsInput.position.xy) / 8;
+        let checker = (grid.x + grid.y) % 2 == 1;
+
+        return select(red, cyan, checker);
      }
    `,
  });
```

上のコードでは`fsInput.position`を使っています。
この構造体フィールドは`@builtin(position)`として宣言されています。
この`vec4f`型の値から、`xy`、つまり`vec2f`型の座標値を取り出して、それを`vec2u`型の値に変換しています。
`vec2u`は符号なし整数値を2つ持つベクトルです。
これを8で割って、「8ピクセルごとに変化する」カウンタにしています。
このgridの座標`x`と`y`を足して`% 2`（2で割った余り)を求めて、0か1の値を得ています。
その値が1ならtrue、0ならfalse、となる真偽値(boolean)としています。
この真偽値を元に、WGSLの組み込み関数`select`を使って、`red`と`cyan`のどちらかの値を選択しています。
WGSLの`select`関数の仕組みは、JavaScriptで表現するならこんな感じです
(下のJavaScriptコードが難解という人は「アロー関数」、「三項演算子」を調べてください)。

```js
// 条件(condition)がfalseなら`a`の値を、そうでなければ`b`の値を返す。
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

`@builtin(position)`をフラグメントシェーダ側のコード中で使わない場合でも、
頂点シェーダとフラグメントシェーダで「共通の構造体」が使える、というのは便利です。
一方で、共通の構造体を使っていても、頂点シェーダから見た`position`フィールドと
フラグメントシェーダから見た`position`フィールドは「関係がない、別の変数である」
ということは重要です。

inter-stage変数の本質は、ロケーション、`@location(?)`の部分です。
重要なのは「ロケーションを合わせること」なので、
頂点シェーダの出力、フラグメントシェーダの入力で、共通ではない、別の構造体を使う書き方は、
それほど珍しいことではありません。

注：今回、市松模様を描くために`@builtin(position)`を使っていますが、
これはあまり一般的なやり方ではありません。
市松模様に限らず、何がしかのパターンを描きたいとき、通常はテクスチャの仕組みを利用します。
これについては別の記事、「[テクスチャについて](webgpu-textures.html)」で説明します。
今回のやり方に問題があることは、ウィンドウサイズを変えてみると観察することができます。
市松模様の「パターンの大きさ」はピクセル座標の値を元にしているので、
描画される三角形の大きさとは関係なく、canvasの解像度に依存して決定されます。

## <a id="a-interpolate"></a>「補間(interpolation)方法」の設定

ここまで、inter-stage変数について見てきました。
inter-stage変数は、頂点シェーダで出力されて、「補間」されて、フラグメントシェーダに渡されます。
WebGPUでは、この「補間」をどうやるかについて、設定項目が２つあります。
「補間」については、デフォルトの設定以外で使いたいケースはほとんどありません。
そういった特殊ケースについては、別の記事で触れます。

補間タイプの設定：

* `perspective`: perspective correctで(３次元のパースに合うように)補間する(**default**)
* `linear`: linearに(線形補間的に)、perspective correctでない形で補間する
* `flat`: 補間しない。補間サンプリングを行なわない

補間サンプリングの設定：

* `center`: 補間に際して「ピクセルの中心」をサンプリングする(**default**)
* `centroid`: 補間に際して「プリミティブ(三角形などの基本図形)」単位でサンプリングする。プリミティブ内の全ピクセルで同じ値となる
* `sample`:  補間を「サンプル」単位で行なう。フラグメントシェーダは各サンプルについて実行される

補間の設定は、inter-stage変数の属性として記述します。たとえばこんな風に書きます。

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

なお、inter-stage変数が整数型の場合は、`flat`の設定にする必要があります。

補間タイプ`flat`に設定した場合、フラグメントシェーダに渡される値は、
「三角形の１つめの頂点」のinter-stage変数の値です。

次の記事「[uniform変数](webgpu-uniforms.html)」では、
シェーダにデータを渡す、別な方法を紹介します。
