Title: WebGPUの基礎
Description: WebGPUの基礎
TOC: 基礎

この記事では、WebGPUの非常に基本的なことを説明しようとします。

<div class="warn">
この記事を読む前に、すでにJavaScriptを知っていることが期待されます。次のような概念
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map">配列のマッピング</a>、
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment">分割代入</a>、
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax">値の展開</a>、
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await</a>、
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules">es6モジュール</a>
などが多用されます。まだJavaScriptを知らず、学びたい場合は、
<a href="https://javascript.info/">JavaScript.info</a>、<a href="https://eloquentjavascript.net/">Eloquent JavaScript</a>、
および/または<a href="https://www.codecademy.com/learn/introduction-to-javascript">CodeCademy</a>を参照してください。
</div>

<div class="warn">すでにWebGLを知っている場合は、<a href="webgpu-from-webgl.html">これを読んでください</a>。</div>

WebGPUは、2つの基本的なことを行うことができるAPIです。

1. [テクスチャに三角形/点/線を描画する](#a-drawing-triangles-to-textures)

2. [GPUで計算を実行する](#a-run-computations-on-the-gpu)

以上です！

その後のWebGPUに関するすべてはあなた次第です。JavaScript、Rust、C++などのコンピューター言語を学ぶようなものです。まず基本を学び、次にそれらの基本を創造的に使用して問題を解決するのはあなた次第です。

WebGPUは非常に低レベルのAPIです。いくつかの小さな例を作成することはできますが、多くのアプリでは、大量のコードとデータの真剣な整理が必要になる可能性があります。例として、WebGPUをサポートする[three.js](https://threejs.org)は、約600kの縮小されたJavaScriptで構成されており、これはその基本ライブラリにすぎません。これには、ローダー、コントロール、後処理、および他の多くの機能は含まれていません。同様に、[WebGPUバックエンドを備えたTensorFlow](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-webgpu)は、約500kの縮小されたJavaScriptです。

要するに、画面に何かを表示したいだけなら、自分でやるときに書かなければならない大量のコードを提供するライブラリを選択する方がはるかに良いということです。

一方、カスタムのユースケースがある場合や、既存のライブラリを変更したい場合、または単にそれがどのように機能するかに興味がある場合は、読み進めてください！

# はじめに

どこから始めればよいか決めるのは難しいです。あるレベルでは、WebGPUは非常に単純なシステムです。GPUで3種類の関数（頂点シェーダー、フラグメントシェーダー、コンピュートシェーダー）を実行するだけです。

頂点シェーダーは頂点を計算します。シェーダーは頂点位置を返します。頂点シェーダー関数が返す3つの頂点のグループごとに、それら3つの位置の間に三角形が描画されます。[^primitives]

[^primitives]: 実際には5つのモードがあります。

    * `'point-list'`: 各位置に点を描画します
    * `'line-list'`: 2つの位置ごとに線を描画します
    * `'line-strip'`: 最新の点を前の点に接続する線を描画します
    * `'triangle-list'`: 3つの位置ごとに三角形を描画します（**デフォルト**）
    * `'triangle-strip'`: 新しい位置ごとに、それと最後の2つの位置から三角形を描画します

フラグメントシェーダーは色を計算します。[^fragment-output] 三角形が描画されるとき、描画される各ピクセルについて、GPUはフラグメントシェーダーを呼び出します。フラグメントシェーダーは色を返します。

[^fragment-output]: フラグメントシェーダーは、間接的にテクスチャにデータを書き込みます。そのデータは色である必要はありません。たとえば、ピクセルが表すサーフェスの方向を出力するのが一般的です。

コンピュートシェーダーはより一般的です。これは、事実上、「この関数をN回実行する」と言うだけで呼び出す関数です。GPUは、関数を呼び出すたびに反復番号を渡すため、その番号を使用して各反復で一意の何かを行うことができます。

目を細めると、これらの関数は、
[`array.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)または
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)に渡す関数に似ていると考えることができます。
GPUで実行する関数は、JavaScript関数と同じように、単なる関数です。異なる点は、GPUで実行されるため、実行するには、アクセスしたいすべてのデータをバッファとテクスチャの形式でGPUにコピーする必要があり、それらのバッファとテクスチャにのみ出力することです。関数で、関数がデータを検索するバインディングまたは場所を指定する必要があります。そして、JavaScriptに戻って、データを保持するバッファとテクスチャをバインディングまたは場所にバインドする必要があります。それが完了したら、GPUに関数を実行するように指示します。

<a id="a-draw-diagram"></a>写真が役立つかもしれません。これは、頂点シェーダーとフラグメントシェーダーを使用して三角形を描画するためのWebGPU設定の*簡略化された*図です。

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram.svg" style="width: 960px;"></div>

この図について注意すべきこと：

* **パイプライン**があります。これには、GPUが実行する頂点シェーダーとフラグメントシェーダーが含まれています。コンピュートシェーダーを持つパイプラインを持つこともできます。

* シェーダーは、**バインドグループ**を介して間接的にリソース（バッファ、テクスチャ、サンプラー）を参照します。

* パイプラインは、内部状態を介して間接的にバッファを参照する属性を定義します。

* 属性はバッファからデータを取得し、そのデータを頂点シェーダーに供給します。

* 頂点シェーダーは、フラグメントシェーダーにデータを供給する場合があります。

* フラグメントシェーダーは、レンダーパス記述を介して間接的にテクスチャに書き込みます。

GPUでシェーダーを実行するには、これらすべてのリソースを作成し、この状態を設定する必要があります。リソースの作成は比較的簡単です。興味深いことの1つは、ほとんどのWebGPUリソースは作成後に変更できないことです。内容を変更することはできますが、サイズ、使用法、フォーマットなどは変更できません。それらのいずれかを変更したい場合は、新しいリソースを作成して古いものを破棄します。

一部の状態は、コマンドバッファを作成して実行することによって設定されます。コマンドバッファは、文字通りその名前が示すものです。コマンドのバッファです。コマンドエンコーダーを作成します。エンコーダーはコマンドをコマンドバッファにエンコードします。次に、エンコーダーを*終了*すると、作成したコマンドバッファが返されます。次に、そのコマンドバッファを*送信*して、WebGPUにコマンドを実行させることができます。

これは、コマンドバッファをエンコードするための擬似コードと、作成されたコマンドバッファの表現です。

<div class="webgpu_center side-by-side"><div style="min-width: 300px; max-width: 400px; flex: 1 1;"><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
encoder = device.createCommandEncoder()
// 何かを描画します
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setVertexBuffer(1, …)
  pass.setIndexBuffer(...)
  pass.setBindGroup(0, …)
  pass.setBindGroup(1, …)
  pass.draw(...)
  pass.end()
}
// 他の何かを描画します
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// 何かを計算します
{
  pass = encoder.beginComputePass(...)
  pass.beginComputePass(...)
  pass.setBindGroup(0, …)
  pass.setPipeline(...)
  pass.dispatchWorkgroups(...)
  pass.end();
}
commandBuffer = encoder.finish();
{{/escapehtml}}</code></pre></div>
<div><img src="resources/webgpu-command-buffer.svg" style="width: 300px;"></div>
</div>

コマンドバッファを作成したら、それを*送信*して実行できます。

```js
device.queue.submit([commandBuffer]);
```

前に示した「WebGPU設定の簡略化された図」は、コマンドバッファ内の*単一*の`draw`コマンドの状態を表します。コマンドを実行すると、*内部状態*が設定され、次に`draw`コマンドがGPUに頂点シェーダー（および間接的にフラグメントシェーダー）を実行するように指示します。`dispatchWorkgroup`コマンドは、GPUにコンピュートシェーダーを実行するように指示します。

設定する必要がある状態の精神的なイメージが得られたことを願っています。上記のように、WebGPUには2つの基本的な機能があります。

1. [テクスチャに三角形/点/線を描画する](#a-drawing-triangles-to-textures)

2. [GPUで計算を実行する](#a-run-computations-on-the-gpu)

これらのそれぞれを行う小さな例を見ていきます。他の記事では、これらのものにデータを提供するさまざまな方法を示します。これは非常に基本的なものであることに注意してください。これらの基本の基礎を築く必要があります。後で、2Dグラフィックス、3Dグラフィックスなど、人々が通常GPUで行うことを行う方法を示します。

# <a id="a-drawing-triangles-to-textures"></a>テクスチャに三角形を描画する

WebGPUは、[テクスチャ](webgpu-textures.html)に三角形を描画できます。この記事の目的上、テクスチャはピクセルの2D長方形です。[^textures] `<canvas>`要素は、Webページ上のテクスチャを表します。WebGPUでは、キャンバスにテクスチャを要求し、そのテクスチャにレンダリングできます。

[^textures]: テクスチャは、ピクセルの3D長方形、キューブマップ（キューブを形成する6つのピクセルの正方形）、および他のいくつかのものにすることもできますが、最も一般的なテクスチャはピクセルの2D長方形です。

WebGPUで三角形を描画するには、2つの「シェーダー」を提供する必要があります。繰り返しになりますが、シェーダーはGPUで実行される関数です。これら2つのシェーダーは次のとおりです。

1. 頂点シェーダー

   頂点シェーダーは、三角形/線/点を描画するための頂点位置を計算する関数です。

2. フラグメントシェーダー

   フラグメントシェーダーは、三角形/線/点を描画/ラスタライズするときに描画される各ピクセルの色（または他のデータ）を計算する関数です。

三角形を描画するための非常に小さなWebGPUプログラムから始めましょう。

三角形を表示するためのキャンバスが必要です。

```html
<canvas></canvas>
```

次に、JavaScriptを保持するための`<script>`タグが必要です。

```html
<canvas></canvas>
+<script type="module">

... ここにJavaScriptが入ります ...

+</script>
```

以下のすべてのJavaScriptは、このスクリプトタグ内に入ります。

WebGPUは非同期APIなので、非同期関数で使用するのが最も簡単です。まず、アダプターを要求し、次にアダプターからデバイスを要求します。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('WebGPUをサポートするブラウザが必要です');
    return;
  }
}
main();
```

上記のコードはかなり自明です。まず、[`?.`オプショナルチェーン演算子](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)を使用してアダプターを要求します。これにより、`navigator.gpu`が存在しない場合、`adapter`は未定義になります。存在する場合は、`requestAdapter`を呼び出します。結果は非同期に返されるため、`await`が必要です。アダプターは特定のGPUを表します。一部のデバイスには複数のGPUがあります。

アダプターからデバイスを要求しますが、ここでも`?.`を使用するため、アダプターが未定義の場合、デバイスも未定義になります。

`device`が設定されていない場合、ユーザーは古いブラウザを使用している可能性があります。

次に、キャンバスを検索し、そのための`webgpu`コンテキストを作成します。これにより、レンダリングするテクスチャを取得できます。そのテクスチャは、Webページにキャンバスを表示するために使用されます。

```js
  // キャンバスからWebGPUコンテキストを取得し、構成します
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
```

繰り返しになりますが、上記のコードはかなり自明です。キャンバスから`"webgpu"`コンテキストを取得します。システムに優先キャンバス形式を問い合わせます。これは`"rgba8unorm"`または`"bgra8unorm"`のいずれかになります。それが何であるかはそれほど重要ではありませんが、それを照会すると、ユーザーのシステムにとって物事が速くなります。

`configure`を呼び出すことによって、それを`format`としてWebGPUキャンバスコンテキストに渡します。また、このキャンバスを先ほど作成したデバイスに関連付ける`device`も渡します。

次に、シェーダーモジュールを作成します。シェーダーモジュールには、1つ以上のシェーダー関数が含まれています。この場合、1つの頂点シェーダー関数と1つのフラグメントシェーダー関数を作成します。

```js
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });
```

シェーダーは、[WebGPUシェーディング言語（WGSL）](https://gpuweb.github.io/gpuweb/wgsl/)と呼ばれる言語で記述されており、しばしばウィグシルと発音されます。WGSLは厳密に型付けされた言語であり、[別の記事](webgpu-wgsl.html)で詳しく説明しようとします。今のところ、少しの説明でいくつかの基本を推測できることを願っています。

上記では、`vs`という名前の関数が`@vertex`属性で宣言されていることがわかります。これにより、頂点シェーダー関数として指定されます。

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
         ...
```

`vertexIndex`という名前の1つのパラメータを受け入れます。`vertexIndex`は`u32`であり、*32ビット符号なし整数*を意味します。その値は`vertex_index`という組み込みから取得されます。`vertex_index`は、JavaScriptの`Array.map(function(value, index) { ... })`の`index`に似た反復番号のようなものです。`draw`を呼び出してGPUにこの関数を10回実行するように指示した場合、最初の`vertex_index`は`0`、2回目は`1`、3回目は`2`などになります。[^indices]

[^indices]: インデックスバッファを使用して`vertex_index`を指定することもできます。これについては、[頂点バッファに関する記事](webgpu-vertex-buffers.html#a-index-buffers)で説明します。

`vs`関数は、4つの32ビット浮動小数点値のベクトルである`vec4f`を返すように宣言されています。4つの値の配列または`{x: 0, y: 0, z: 0, w: 0}`のような4つのプロパティを持つオブジェクトと考えてください。この戻り値は`position`組み込みに割り当てられます。「triangle-list」モードでは、頂点シェーダーが3回実行されるたびに、返された3つの`position`値を接続する三角形が描画されます。

WebGPUの位置は、*クリップ空間*で返す必要があります。Xは左の-1.0から右の+1.0まで、Yは下の-1.0から上の+1.0までです。これは、描画するテクスチャのサイズに関係なく当てはまります。

<div class="webgpu_center"><img src="resources/clipspace.svg" style="width: 500px"></div>

`vs`関数は、3つの`vec2f`の配列を宣言します。各`vec2f`は、2つの32ビット浮動小数点値で構成されます。

```wgsl
        let pos = array(
          vec2f( 0.0,  0.5),  // 上中央
          vec2f(-0.5, -0.5),  // 左下
          vec2f( 0.5, -0.5)   // 右下
        );
```

最後に、`vertexIndex`を使用して、配列から3つの値のいずれかを返します。関数は戻り値の型に4つの浮動小数点値を必要とし、`pos`は`vec2f`の配列であるため、コードは残りの2つの値に`0.0`と`1.0`を指定します。

```wgsl
        return vec4f(pos[vertexIndex], 0.0, 1.0);
```

2Dで何かを描画する場合、通常、位置にはxとyの値のみが必要であることに注意してください。z値は深度テストに使用され、[正射影に関する記事](webgpu-orthographic-projection.html)で取り上げます。z値は遠近除算に使用され、[遠近投影に関する記事](webgpu-perspective-projection.html)で取り上げます。今のところ、三角形を描画するために必要なのは、zを0.0に、wを1.0に設定することです。

シェーダーモジュールは、`@fragment`属性で宣言された`fs`という名前の関数も宣言し、フラグメントシェーダー関数にします。

```wgsl
      @fragment fn fs() -> @location(0) vec4f {
```

この関数はパラメータを受け取らず、`location(0)`で`vec4f`を返します。これは、最初のレンダーターゲットに書き込むことを意味します。後で、最初のレンダーターゲットをキャンバステクスチャにします。

```wgsl
        return vec4f(1, 0, 0, 1);
```

コードは`1, 0, 0, 1`を返します。これは赤です。WebGPUの色は通常、`0.0`から`1.0`までの浮動小数点値として指定され、上記の4つの値はそれぞれ赤、緑、青、アルファに対応します。

GPUが三角形をラスタライズ（ピクセルで描画）するとき、フラグメントシェーダーを呼び出して、各ピクセルを何色にするかを尋ねます。この場合、赤を返すだけです。

もう1つ注意すべき点は、`label`です。WebGPUで作成できるほとんどすべてのオブジェクトは、`label`を受け取ることができます。ラベルは完全にオプションですが、作成するすべてのものにラベルを付けることが*ベストプラクティス*と見なされています。その理由は、エラーが発生した場合、ほとんどのWebGPU実装は、エラーに関連するもののラベルを含むエラーメッセージを出力するためです。

通常のアプリでは、100または1000のバッファ、テクスチャ、シェーダーモジュール、パイプラインなどがあります。`"WGSL syntax error in shaderModule at line 10"`のようなエラーが発生した場合、100個のシェーダーモジュールがある場合、どのモジュールでエラーが発生しましたか？モジュールにラベルを付けると、`"WGSL syntax error in shaderModule('our hardcoded red triangle shaders') at line 10`のようなエラーメッセージが表示されます。これは、はるかに役立つエラーメッセージであり、問題を追跡する時間を大幅に節約できます。

シェーダーモジュールを作成したので、次にレンダーパイプラインを作成する必要があります。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      entryPoint: 'vs',
      module,
    },
    fragment: {
      entryPoint: 'fs',
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

この場合、見るべきものはあまりありません。`layout`を`'auto'`に設定しました。これは、WebGPUにシェーダーからデータのレイアウトを導出するように依頼することを意味します。ただし、データは使用していません。

次に、レンダーパイプラインに、頂点シェーダーにはシェーダーモジュールの`vs`関数を使用し、フラグメントシェーダーには`fs`関数を使用するように指示します。それ以外の場合は、最初のレンダーターゲットの形式を指示します。「レンダーターゲット」とは、レンダリングするテクスチャを意味します。パイプラインを作成するときは、このパイプラインを使用して最終的にレンダリングするテクスチャの形式を指定する必要があります。

`targets`配列の要素0は、フラグメントシェーダーの戻り値に指定した場所0に対応します。後で、そのターゲットをキャンバスのテクスチャに設定します。

1つのショートカットとして、各シェーダーステージ（`vertex`と`fragment`）について、対応する型の関数が1つしかない場合は、`entryPoint`を指定する必要はありません。WebGPUは、シェーダーステージに一致する唯一の関数を使用します。したがって、上記のコードを次のように短縮できます。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
-      entryPoint: 'vs',
      module,
    },
    fragment: {
-      entryPoint: 'fs',
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

次に、描画するテクスチャとそれらの使用方法を記述する`GPURenderPassDescriptor`を準備します。

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };  
```

`GPURenderPassDescriptor`には、レンダリングするテクスチャとそれらの扱い方をリストする`colorAttachments`の配列があります。実際にレンダリングしたいテクスチャを入力するのは後回しにします。今のところ、半暗い灰色のクリア値を設定し、`loadOp`と`storeOp`を設定します。`loadOp: 'clear'`は、描画する前にテクスチャをクリア値にクリアするように指定します。もう1つのオプションは`'load'`で、テクスチャの既存の内容をGPUにロードして、すでにそこにあるものの上に描画できるようにします。`storeOp: 'store'`は、描画した結果を保存することを意味します。`'discard'`を渡すこともできます。これにより、描画したものが破棄されます。なぜそうしたいのかについては、[別の記事](webgpu-multisampling.html)で説明します。

いよいよレンダリングです。

```js
  function render() {
    // キャンバスコンテキストから現在のテクスチャを取得し、
    // レンダリングするテクスチャとして設定します。
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

    // コマンドをエンコードし始めるためのコマンドエンコーダーを作成します
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // レンダリング固有のコマンドをエンコードするためのレンダーパスエンコーダーを作成します
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);  // 頂点シェーダーを3回呼び出します
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  render();
```

まず、`context.getCurrentTexture()`を呼び出して、キャンバスに表示されるテクスチャを取得します。`createView`を呼び出すと、テクスチャの特定の部分へのビューが取得されますが、パラメータがない場合は、デフォルトの部分が返されます。この場合、これが望ましいものです。今のところ、唯一の`colorAttachment`は、最初に作成したコンテキストを介して取得するキャンバスからのテクスチャビューです。繰り返しになりますが、`colorAttachments`配列の要素0は、フラグメントシェーダーの戻り値に指定した`@location(0)`に対応します。

次に、コマンドエンコーダーを作成します。コマンドエンコーダーは、コマンドバッファを作成するために使用されます。コマンドをエンコードするために使用し、作成したコマンドバッファを「送信」してコマンドを実行させます。

次に、コマンドエンコーダーを使用して、`beginRenderPass`を呼び出すことによってレンダーパスエンコーダーを作成します。レンダーパスエンコーダーは、レンダリングに関連するコマンドを作成するための特定のエンコーダーです。`renderPassDescriptor`を渡して、レンダリングしたいテクスチャを指示します。

コマンド`setPipeline`をエンコードしてパイプラインを設定し、次に`draw`を3で呼び出して頂点シェーダーを3回実行するように指示します。デフォルトでは、頂点シェーダーが3回実行されるたびに、頂点シェーダーから返された3つの値を接続して三角形が描画されます。

レンダーパスを終了し、エンコーダーを終了します。これにより、指定した手順を表すコマンドバッファが得られます。最後に、コマンドバッファを送信して実行します。

`draw`コマンドが実行されると、これが私たちの状態になります。

<div class="webgpu_center"><img src="resources/webgpu-simple-triangle-diagram.svg" style="width: 723px;"></div>

テクスチャもバッファもバインドグループもありませんが、パイプライン、頂点シェーダーとフラグメントシェーダー、そしてシェーダーにキャンバステクスチャにレンダリングするように指示するレンダーパス記述子があります。

結果です。

{{{example url="../webgpu-simple-triangle.html"}}}

`setPipeline`や`draw`などのこれらの関数はすべて、コマンドバッファにコマンドを追加するだけであることを強調することが重要です。実際にはコマンドを実行しません。コマンドは、コマンドバッファをデバイスキューに送信したときに実行されます。

<a id="a-rasterization"></a>WebGPUは、頂点シェーダーから返す3つの頂点すべてを取得し、それらを使用して三角形をラスタライズします。これは、どのピクセルの中心が三角形の内側にあるかを判断することによって行われます。次に、各ピクセルについてフラグメントシェーダーを呼び出して、何色にするかを尋ねます。

レンダリングしているテクスチャが15x11ピクセルだったと想像してみてください。これらは描画されるピクセルです。

<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; max-width: 500px; width: 100%"></div>
  <div>頂点をドラッグします</div>
</div>

さて、非常に小さな動作するWebGPUの例を見てきました。シェーダー内に三角形をハードコーディングするのはあまり柔軟ではないことは明らかです。データを提供する方法が必要であり、それらについては次の記事で説明します。上記のコードから得られるポイントは、

* WebGPUはシェーダーを実行するだけです。役立つことを行うコードでそれらを埋めるのはあなた次第です。
* シェーダーはシェーダーモジュールで指定され、次にパイプラインに変換されます。
* WebGPUは三角形を描画できます。
* WebGPUはテクスチャに描画します（たまたまキャンバスからテクスチャを取得しました）。
* WebGPUは、コマンドをエンコードして送信することによって機能します。

# <a id="a-run-computations-on-the-gpu"></a>GPUで計算を実行する

GPUでいくつかの計算を行うための基本的な例を書きましょう。

WebGPUデバイスを取得するための同じコードから始めます。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('WebGPUをサポートするブラウザが必要です');
    return;
  }
```

次に、シェーダーモジュールを作成します。

```js
  const module = device.createShaderModule({
    label: 'doubling compute module',
    code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });
```

まず、`storage`型の`data`という変数を宣言し、読み書き両方ができるようにします。

```wgsl
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

`array<f32>`として型を宣言します。これは、32ビット浮動小数点値の配列を意味します。この配列をバインドグループ0（`@group(0)`）のバインディング場所0（`binding(0)`）で指定することを伝えます。

次に、`@compute`属性を持つ`computeSomething`という関数を宣言し、コンピュートシェーダーにします。

```wgsl
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        ...
```

コンピュートシェーダーは、後で説明するワークグループサイズを宣言する必要があります。今のところ、属性`@workgroup_size(1)`で1に設定します。`vec3u`を使用する1つのパラメータ`id`を持つように宣言します。`vec3u`は、3つの符号なし32ビット整数値です。上記の頂点シェーダーと同様に、これは反復番号です。コンピュートシェーダーの反復番号が3次元（3つの値を持つ）である点が異なります。`id`を組み込みの`global_invocation_id`から値を取得するように宣言します。

コンピュートシェーダーは、次のように実行されると*考える*ことができます。これは過度の単純化ですが、今のところはこれで十分です。

```js
// 擬似コード
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  // WGSLの@workgroup_sizeから
  const workgroup_size = shaderCode.workgroup_size;
  const {x: width, y: height, z: depth} = workgroup_size;
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const local_invocation_id = {x, y, z};
        const global_invocation_id =
            workgroup_id * workgroup_size + local_invocation_id;
        computeShader(global_invocation_id)
      }
    }
  }
}
```

`@workgroup_size(1)`を設定したため、上記の擬似コードは事実上次のようになります。

```js
// 擬似コード
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  const global_invocation_id = workgroup_id;
  computeShader(global_invocation_id)
}
```

最後に、`id`の`x`プロパティを使用して`data`をインデックス付けし、各値を2倍にします。

```wgsl
        let i = id.x;
        data[i] = data[i] * 2.0;
```

上記では、`i`は3つの反復番号の最初のものにすぎません。

シェーダーを作成したので、パイプラインを作成する必要があります。

```js
  const pipeline = device.createComputePipeline({
    label: 'doubling compute pipeline',
    layout: 'auto',
    compute: {
      module,
    },
  });
```

ここでは、作成したシェーダー`module`から`compute`ステージを使用していることを伝え、`@compute`エントリポイントが1つしかないため、WebGPUはそれを呼び出したいことを知っています。`layout`は再び`'auto'`であり、WebGPUにシェーダーからレイアウトを把握するように指示します。[^layout-auto]

[^layout-auto]: `layout: 'auto'`は便利ですが、`layout: 'auto'`を使用してパイプライン間でバインドグループを共有することはできません。このサイトのほとんどの例では、複数のパイプラインでバインドグループを使用することはありません。[別の記事](webgpu-bind-group-layouts.html)で明示的なレイアウトについて説明します。

次に、いくつかのデータが必要です。

```js
  const input = new Float32Array([1, 3, 5]);
```

そのデータはJavaScriptにのみ存在します。WebGPUがそれを使用するには、GPU上に存在するバッファを作成し、そのデータをバッファにコピーする必要があります。

```js
  // 計算の入力と出力を保持するためにGPU上にバッファを作成します
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // 入力データをそのバッファにコピーします
  device.queue.writeBuffer(workBuffer, 0, input);
```

上記では、`device.createBuffer`を呼び出してバッファを作成します。`size`はバイト単位のサイズです。この場合、3つの値の`Float32Array`のバイト単位のサイズは12なので、12になります。`Float32Array`と型付き配列に慣れていない場合は、[この記事](webgpu-memory-layout.html)を参照してください。

作成するすべてのWebGPUバッファは、`usage`を指定する必要があります。使用法に渡すことができるフラグはたくさんありますが、すべてを一緒に使用できるわけではありません。ここでは、`GPUBufferUsage.STORAGE`を渡すことによって、このバッファを`storage`として使用できるようにします。これにより、シェーダーの`var<storage,...>`と互換性があります。さらに、このバッファにデータをコピーできるようにしたいので、`GPUBufferUsage.COPY_DST`フラグを含めます。そして最後に、バッファからデータをコピーできるようにしたいので、`GPUBufferUsage.COPY_SRC`フラグを含めます。

JavaScriptからWebGPUバッファの内容を直接読み取ることはできないことに注意してください。代わりに、「マップ」する必要があります。これは、バッファが使用中である可能性があり、GPU上にのみ存在する可能性があるため、WebGPUからバッファへのアクセスを要求する別の方法です。

JavaScriptでマップできるWebGPUバッファは、あまり多くの用途には使用できません。つまり、上記で作成したバッファをマップすることはできず、マップ可能にするフラグを追加しようとすると、`STORAGE`の使用法と互換性がないというエラーが発生します。

したがって、計算の結果を確認するには、別のバッファが必要です。計算を実行した後、上記のバッファをこの結果バッファにコピーし、マップできるようにフラグを設定します。

```js
  // 結果のコピーを取得するためにGPU上にバッファを作成します
  const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
```

`MAP_READ`は、このバッファをデータの読み取り用にマップできるようにしたいことを意味します。

シェーダーに作業させたいバッファについて伝えるには、バインドグループを作成する必要があります。

```js
  // 計算に使用するバッファをシェーダーに伝えるためのバインドグループを設定します
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workBuffer } },
    ],
  });
```

パイプラインからバインドグループのレイアウトを取得します。次に、バインドグループエントリを設定します。`pipeline.getBindGroupLayout(0)`の0は、シェーダーの`@group(0)`に対応します。`entries`の`{binding: 0 ...`は、シェーダーの`@group(0) @binding(0)`に対応します。

これで、コマンドのエンコードを開始できます。

```js
  // 計算を行うためのコマンドをエンコードします
  const encoder = device.createCommandEncoder({
    label: 'doubling encoder',
  });
  const pass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
  pass.end();
```

コマンドエンコーダーを作成します。コンピュートパスを開始します。パイプラインを設定し、次にバインドグループを設定します。ここで、`pass.setBindGroup(0, bindGroup)`の`0`は、シェーダーの`@group(0)`に対応します。次に、`dispatchWorkgroups`を呼び出し、この場合、`input.length`（`3`）を渡して、WebGPUにコンピュートシェーダーを3回実行するように指示します。次に、パスを終了します。

`dispatchWorkgroups`が実行されるときの状況は次のとおりです。

<div class="webgpu_center"><img src="resources/webgpu-simple-compute-diagram.svg" style="width: 553px;"></div>

計算が終了したら、WebGPUに`workBuffer`から`resultBuffer`にコピーするように依頼します。

```js
  // 結果をマップ可能なバッファにコピーするコマンドをエンコードします。
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
```

これで、エンコーダーを`finish`してコマンドバッファを取得し、そのコマンドバッファを送信できます。

```js
  // エンコードを終了し、コマンドを送信します
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

次に、結果バッファをマップし、データのコピーを取得します。

```js
  // 結果を読み取ります
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log('input', input);
  console.log('result', result);

  resultBuffer.unmap();
```

結果バッファをマップするには、`mapAsync`を呼び出し、それが完了するのを`await`する必要があります。マップされると、`resultBuffer.getMappedRange()`を呼び出すことができます。パラメータがない場合は、バッファ全体の`ArrayBuffer`が返されます。それを`Float32Array`型付き配列ビューに入れ、値を確認できます。1つの重要な詳細は、`getMappedRange`によって返される`ArrayBuffer`は、`unmap`を呼び出すまでのみ有効であるということです。`unmap`の後、その長さは0に設定され、そのデータにはアクセスできなくなります。

これを実行すると、結果が返され、すべての数値が2倍になっていることがわかります。

{{{example url="../webgpu-simple-compute.html"}}}

他の記事でコンピュートシェーダーを実際に使用する方法については説明します。今のところ、WebGPUが何をするのかについて、ある程度の理解が得られたことを願っています。その他すべてはあなた次第です！WebGPUを他のプログラミング言語と同様に考えてください。いくつかの基本的な機能を提供し、残りはあなたの創造性に任せます。

WebGPUプログラミングを特別なものにしているのは、これらの関数、頂点シェーダー、フラグメントシェーダー、コンピュートシェーダーがGPUで実行されることです。GPUには10000を超えるプロセッサがある可能性があり、これは、CPUが並行して実行できるよりも3桁以上多い計算を並行して実行できる可能性があることを意味します。

## <a id="a-resizing"></a>単純なキャンバスのサイズ変更

次に進む前に、三角形の描画の例に戻り、キャンバスのサイズ変更の基本的なサポートを追加しましょう。キャンバスのサイズ変更は、実際には多くの微妙な点があるトピックなので、[それに関する記事全体があります](webgpu-resizing-the-canvas.html)。ただし、今のところ、基本的なサポートを追加するだけです。

まず、キャンバスがページを埋めるようにCSSを追加します。

```html
<style>
html, body {
  margin: 0;       /* デフォルトのマージンを削除 */
  height: 100%;    /* html,bodyがページを埋めるようにする */
}
canvas {
  display: block;  /* canvasをブロックのように動作させる */
  width: 100%;     /* canvasがコンテナを埋めるようにする */
  height: 100%;
}
</style>
```

そのCSSだけで、キャンバスがページをカバーするように表示されますが、キャンバス自体の解像度は変更されないため、以下の例を大きくすると、たとえば全画面ボタンをクリックすると、三角形の端がブロック状になっていることがわかります。

{{{example url="../webgpu-simple-triangle-with-canvas-css.html"}}}

`<canvas>`タグは、デフォルトで300x150ピクセルの解像度を持っています。キャンバスの解像度を、表示されるサイズに合わせて調整したいです。これを行う良い方法の1つは、`ResizeObserver`を使用することです。`ResizeObserver`を作成し、監視するように依頼した要素のサイズが変更されるたびに呼び出す関数を指定します。次に、監視する要素を指示します。

```js
    ...
-    render();

+    const observer = new ResizeObserver(entries => {
+      for (const entry of entries) {
+        const canvas = entry.target;
+        const width = entry.contentBoxSize[0].inlineSize;
+        const height = entry.contentBoxSize[0].blockSize;
+        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
+        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
+      }
+      // 再レンダリング
+      render();
+    });
+    observer.observe(canvas);
```

上記のコードでは、すべてのエントリをループしますが、キャンバスのみを監視しているため、エントリは1つだけのはずです。キャンバスのサイズをデバイスがサポートする最大サイズに制限する必要があります。そうしないと、WebGPUは大きすぎるテクスチャを作成しようとしたというエラーを生成し始めます。また、ゼロにならないようにする必要もあります。そうしないと、再びエラーが発生します。[詳細については、長い記事を参照してください](webgpu-resizing-the-canvas.html)。

`render`を呼び出して、新しい解像度で三角形を再レンダリングします。古い`render`の呼び出しは不要なので削除しました。`ResizeObserver`は、監視が開始されたときの要素のサイズを報告するために、常に少なくとも1回コールバックを呼び出します。

新しいサイズのテクスチャは、`render`内で`context.getCurrentTexture()`を呼び出すときに作成されるため、他に何もする必要はありません。

{{{example url="../webgpu-simple-triangle-with-canvas-resize.html"}}}

> 注：上記のコードは、キャンバスの解像度を変更する可能性のあるズームへの応答を処理しません。また、高解像度ディスプレイの高解像度にも対応していません。これらの問題については、[キャンバスのサイズ変更に関する記事](webgpu-reszing-the-canvas.html)を参照してください。

次の記事では、シェーダーにデータを渡すさまざまな方法について説明します。

* [ステージ間変数](webgpu-inter-stage-variables.html)
* [ユニフォーム](webgpu-uniforms.html)
* [ストレージバッファ](webgpu-storage-buffers.html)
* [頂点バッファ](webgpu-vertex-buffers.html)
* [テクスチャ](webgpu-textures.html)
* [定数](webgpu-constants.html)

次に、[WGSLの基本](webgpu-wgsl.html)について説明します。

この順序は、最も単純なものから最も複雑なものまでです。ステージ間変数は、説明するための外部設定を必要としません。上記で使用したWGSLに変更を加えるだけで、それらの使用方法を確認できます。ユニフォームは、事実上グローバル変数であり、3種類のシェーダー（頂点、フラグメント、コンピュート）すべてで使用されます。ユニフォームバッファからストレージバッファへの移行は、ストレージバッファに関する記事の冒頭で示したように、些細なことです。頂点バッファは、頂点シェーダーでのみ使用されます。WebGPUにデータレイアウトを記述する必要があるため、より複雑です。テクスチャは、多数の型とオプションがあるため、最も複雑です。

これらの記事が最初は退屈になるのではないかと少し心配しています。よろしければ、自由に読み飛ばしてください。何か理解できない場合は、これらの基本を読んだり、見直したりする必要があることを覚えておいてください。基本を理解したら、実際のテクニックについて説明し始めます。

もう1つ。すべてのサンプルプログラムは、Webページでライブで編集できます。さらに、[jsfiddle](https://jsfiddle.net)や[codepen](https://codepen.io)、さらには[stackoverflow](https://stackoverflow.com)に簡単にエクスポートできます。「エクスポート」をクリックするだけです。

<div class="webgpu_bottombar">
<p>
上記のコードは、非常に簡潔な方法でWebGPUデバイスを取得します。より冗長な方法は、次のようになります。
</p>
<pre class="prettyprint showmods">{{#escapehtml}}
async function start() {
  if (!navigator.gpu) {
    fail('このブラウザはWebGPUをサポートしていません');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('このブラウザはWebGPUをサポートしていますが、無効になっているようです');
    return;
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    console.error(`WebGPUデバイスが失われました：${info.message}`);

    // 'reason'は、意図的にデバイスを破棄した場合に'destroyed'になります。
    if (info.reason !== 'destroyed') {
      // もう一度試してください
      start();
    }
  });
  
  main(device);
}
start();

function main(device) {
  ... webgpuを実行します ...
}
{{/escapehtml}}</pre>
<p>
`device.lost`は、未解決の状態で始まるプロミスです。デバイスが失われた場合に解決されます。デバイスが失われる理由はたくさんあります。ユーザーが非常に集中的なアプリを実行し、GPUがクラッシュしたのかもしれません。ユーザーがドライバーを更新したのかもしれません。ユーザーが外部GPUを持っていて、それを抜いたのかもしれません。別のページが多くのGPUを使用し、タブがバックグラウンドにあり、ブラウザがバックグラウンドタブのデバイスを失うことによってメモリを解放することにしたのかもしれません。重要な点は、本格的なアプリの場合、デバイスの喪失を処理したいということです。
</p>
<p>
`requestDevice`は常にデバイスを返しますが、失われた状態で始まる可能性があることに注意してください。WebGPUは、ほとんどの場合、少なくともAPIレベルでは、デバイスが機能しているように見えるように設計されています。ものを作成して使用するための呼び出しは成功したように見えますが、実際には機能しません。`lost`プロミスが解決されたときにアクションを起こすのはあなた次第です。
</p>
</div>

<!-- この記事の最後にこれを保持してください -->
<script type="module" src="webgpu-fundamentals.js"></script>