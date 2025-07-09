Title: WebGPU ステージ間変数
Description: 頂点シェーダーからフラグメントシェーダーへのデータ渡し
TOC: ステージ間変数

[前の記事](webgpu-fundamentals.html)では、WebGPUに関するいくつかの非常に基本的なことを説明しました。この記事では、ステージ間変数の*基本*について説明します。

ステージ間変数は、頂点シェーダーとフラグメントシェーダーの間で機能します。

頂点シェーダーが3つの位置を出力すると、三角形がラスタライズされます。頂点シェーダーは、それらの各位置で追加の値を出力でき、デフォルトでは、それらの値は3つの点の間で補間されます。

小さな例を作成しましょう。前の記事の三角形のシェーダーから始めます。シェーダーを変更するだけです。

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

まず、`struct`を宣言します。これは、頂点シェーダーとフラグメントシェーダーの間でステージ間変数を調整する簡単な方法の1つです。

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

次に、頂点シェーダーがこの型の構造体を返すように宣言します。

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

次に、3色の配列を作成します。

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // red
          vec4f(0, 1, 0, 1), // green
          vec4f(0, 0, 1, 1), // blue
        );
```

次に、位置に`vec4f`を返すだけでなく、構造体のインスタンスを宣言し、それを埋めて返します。

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

フラグメントシェーダーでは、関数の引数としてこれらの構造体の1つを受け取るように宣言します。

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

最後に色を返します。

これを実行すると、GPUがフラグメントシェーダーを呼び出すたびに、3つのすべての点の間で補間された色が渡されることがわかります。

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

ステージ間変数は、[テクスチャに関する記事](webgpu-textures.html)で説明するように、三角形全体でテクスチャ座標を補間するために最もよく使用されます。もう1つの一般的な用途は、[ライティングに関する最初の記事](webgpu-lighting-directional.html)で説明するように、三角形全体で法線を補間することです。

## ステージ間変数は`location`で接続されます

重要な点として、WebGPUのほとんどすべてと同様に、頂点シェーダーとフラグメントシェーダーの間の接続はインデックスによるものです。ステージ間変数の場合、それらは場所インデックスで接続されます。

私が何を意味するかを見るために、フラグメントシェーダーのみを変更して、構造体の代わりに`location(0)`で`vec4f`パラメータを受け取るようにしましょう。

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

これを実行すると、まだ機能することがわかります。

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## <a id="a-builtin-position"></a> `@builtin(position)`

それは別の奇妙な点を指摘するのに役立ちます。頂点シェーダーとフラグメントシェーダーの両方で同じ構造体を使用した元のシェーダーには、`position`というフィールドがありましたが、場所がありませんでした。代わりに、`@builtin(position)`として宣言されていました。

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

そのフィールドは**ステージ間変数ではありません**。代わりに、`builtin`です。`@builtin(position)`は、頂点シェーダーとフラグメントシェーダーで意味が異なります。実際、頂点シェーダーとフラグメントシェーダーは、たまたま同じ名前のパラメータを持つ2つの異なる関数であると考える方が良いでしょう。

2つのJavaScript関数があると想像してください。

```js
// 半径サイズの円を位置：[x, y]に描画します
function drawCircle({ ctx, position, radius }) {
  // CanvasRenderingContext2Dから
  ctx.beginPath();
  ctx.arc(...position, radius, 0, Math.PI * 2);
  ctx.fill();
}

// 位置から始まる配列内の要素のインデックスを返します
function findIndex({ array, position, value }) {
  return array.indexOf(value, position);
}
```

上記の関数の両方に`position`というパラメータがあります。通常、2つの間に混乱はありません。頂点シェーダーとフラグメントシェーダーも同様です。それらの組み込みは異なり、無関係であり、それぞれがたまたま`position`という名前の`@builtin`を持ち、各シェーダーエントリポイントをコンパイルするとき、WGSLコードはそのエントリポイントに対してのみ読み取られます。

頂点シェーダーでは、`@builtin(position)`は、GPUが三角形/線/点を描画するために使用する出力として提供する座標です。

フラグメントシェーダーでは、`@builtin(position)`は入力です。これは、フラグメントシェーダーが現在色または値を計算するように求められているピクセルのピクセル座標です。

ピクセル座標はピクセルの端で指定されます。フラグメントシェーダーに提供される値は、ピクセルの中心の座標です。

描画しているテクスチャが3x2ピクセルのサイズの場合、これらが座標になります。

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

この位置を使用するようにシェーダーを変更できます。たとえば、チェッカーボードを描画しましょう。

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

上記のコードは、`@builtin(position)`として宣言された`fsInput.position`を受け取り、その`xy`座標を2つの符号なし整数の`vec2u`に変換します。次に、それらを8で除算して、8ピクセルごとに増加するカウントを取得します。次に、`x`と`y`のグリッド座標を合計し、2を法とする剰余を計算し、結果を1と比較します。これにより、他のすべての整数に対してtrueまたはfalseのブール値が得られます。最後に、WGSL関数`select`を使用します。これは、2つの値が与えられた場合、ブール条件に基づいて一方または他方を選択します。JavaScriptでは、`select`は次のように記述されます。

```js
// 条件がfalseの場合は`a`を返し、それ以外の場合は`b`を返します
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

フラグメントシェーダーで`@builtin(position)`を使用しなくても、頂点シェーダーとフラグメントシェーダーの両方に同じ構造体を使用できるため、便利です。重要な点は、頂点シェーダーとフラグメントシェーダーの`position`構造体フィールドはまったく無関係であるということです。それらは完全に異なる変数です。

ただし、上記で指摘したように、ステージ間変数の場合、重要なのは`@location(?)`だけです。したがって、頂点シェーダーの出力とフラグメントシェーダーの入力に異なる構造体を宣言することは珍しくありません。

これをより明確にするために、この例の頂点シェーダーとフラグメントシェーダーが同じ文字列にあるという事実は、単なる便宜上のものです。それらを別々のモジュールに分割することもできます。

```js
-  const module = device.createShaderModule({
-    label: 'hardcoded checkerboard triangle shaders',
+  const vsModule = device.createShaderModule({
+    label: 'hardcoded triangle',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        return vsOutput;
      }
+    `,
+  });
+
+  const fsModule = device.createShaderModule({
+    label: 'checkerboard',
+    code: `
-      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+      @fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);

-        let grid = vec2u(fsInput.position.xy) / 8;
+        let grid = vec2u(pixelPosition.xy) / 8;
        let checker = (grid.x + grid.y) % 2 == 1;

        return select(red, cyan, checker);
      }
    `,
  });
```

そして、これらを使用するようにパイプラインの作成を更新する必要があります。

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
    },
    fragment: {
-      module,
+      module: fsModule,
      targets: [{ format: presentationFormat }],
    },
  });

```

そして、これは同じように機能します。

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

重要な点は、ほとんどのWebGPUの例で両方のシェーダーが同じ文字列にあるという事実は、単なる便宜上のものです。実際には、まずWebGPUがWGSLを解析して構文的に正しいことを確認します。次に、WebGPUは指定した各`entryPoint`を個別に調べます。各entryPointが参照する部分のみを調べ、他は調べません。

共有文字列は、複数のシェーダーが構造体、バインディングとグループの場所、定数、関数などのものを共有できるため便利です。しかし、WebGPUの観点からは、それらすべてを各entryPointに対して1回ずつ複製したかのようです。

注：`@builtin(position)`を使用してチェッカーボードを生成することはあまり一般的ではありません。チェッカーボードやその他のパターンは、[テクスチャを使用する](webgpu-textures.html)方がはるかに一般的です。実際、ウィンドウのサイズを変更すると問題が発生します。チェッカーボードはキャンバスのピクセル座標に基づいているため、三角形に対してではなく、キャンバスに対して相対的です。

## <a id="a-interpolate"></a>補間設定

上記で、ステージ間変数、つまり頂点シェーダーからの出力が、フラグメントシェーダーに渡されるときに補間されることがわかりました。動作を変更できる2つの設定セットがあります。補間タイプと補間サンプリングです。デフォルト以外のものに設定することはあまり一般的ではありませんが、他の記事で説明するユースケースがあります。

補間タイプ：

* `perspective`: 値は遠近法的に正しい方法で補間されます（**デフォルト**）
* `linear`: 値は線形、非遠近法的に正しい方法で補間されます
* `flat`: 値は補間されません。フラット補間では補間サンプリングは使用されません。

補間サンプリング：

* `center`: 補間はピクセルの中心で実行されます。（**デフォルト**）
* `centroid`: 補間は、現在のプリミティブ内のフラグメントでカバーされるすべてのサンプル内にある点で実行されます。この値は、プリミティブ内のすべてのサンプルで同じです。
* `sample`: 補間はサンプルごとに実行されます。この属性が適用されると、フラグメントシェーダーはサンプルごとに1回呼び出されます。
* `first`: `flat`型でのみ使用されます。（デフォルト）値は、描画されるプリミティブの最初の頂点から取得されます。
* `either`: `flat`型でのみ使用されます。値は、描画されるプリミティブの最初または最後の頂点のいずれかから取得されます。

これらを属性として指定します。たとえば、

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

ステージ間変数が整数型の場合、その補間を`flat`に設定する必要があることに注意してください。

補間タイプを`flat`に設定した場合、デフォルトでは、フラグメントシェーダーに渡される値は、その三角形の最初の頂点のステージ間変数の値です。ほとんどの`flat`のユースケースでは、`either`を選択する必要があります。その理由については、[別の記事](webgpu-compatibility-mode.html)で説明します。

[次の記事では、ユニフォームについて説明します](webgpu-uniforms.html)。これは、シェーダーにデータを渡す別の方法です。