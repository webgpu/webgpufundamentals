Title: WebGPUのバインドグループレイアウト
Description: 明示的なバインドグループレイアウト
TOC: バインドグループレイアウト

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

バインドグループレイアウトは、WebGPUがバインドグループをコンピュートパイプラインやレンダーパイプラインに簡単かつ効率的に一致させるために使用されます。

## 仕組み：

`GPUComputePipeline`や`GPURenderPipeline`のようなパイプラインは、0個以上の`GPUBindGroupLayout`を定義する`GPUPipelineLayout`を使用します。各`GPUBindGroupLayout`は特定のグループインデックスに割り当てられます。

<div class="webgpu_center"><img src="resources/webgpu-bind-group-layouts.svg" style="width: 900px;"></div>

バインドグループもそれぞれ特定の`GPUBindGroupLayout`で作成されます。

`draw`や`dispatchWorkgroups`を実行する際、WebGPUは、現在のパイプラインの`GPUPipelineLayout`上の各グループインデックスの`GPUBindGroupLayout`が、`setBindGroup`で設定された現在バインドされているバインドグループと一致するかどうかをチェックするだけで済みます。このチェックは非常に単純です。詳細なチェックのほとんどは、バインドグループを作成するときに行われます。そうすることで、実際に描画や計算を行うときには、チェックするものはほとんど残っていません。

このウェブサイトのほとんどのサンプルがそうであるように、`layout: 'auto'`でパイプラインを作成すると、パイプラインは独自の`GPUPipelineLayout`を生成し、`GPUBindGroupLayout`を自動的に設定します。

`layout: 'auto'`を**使用しない**主な理由は2つあります。

1.  **デフォルトの`'auto'`レイアウトとは異なるレイアウトが必要な場合**

    例えば、テクスチャとして`rgba32float`を使用したいが、試すとエラーが発生する場合などです。（下記参照）

2.  **1つ以上のパイプラインでバインドグループを使用したい場合**

    `layout: 'auto'`でパイプラインから作成されたbindGroupLayoutから作られたバインドグループを、別のパイプラインで使用することはできません。

## <a id="a-rgba32float"></a> `layout: 'auto'`とは異なるバインドグループレイアウトの使用 - `'rgba32float'`

バインドグループレイアウトが自動的に作成される方法のルールは[仕様書に詳述されています](https://www.w3.org/TR/webgpu/#abstract-opdef-default-pipeline-layout)が、一例として...

`rgba32float`テクスチャを使用したいとしましょう。[テクスチャに関する記事の最初のテクスチャ使用例](webgpu-textures.html)を取り上げ、逆さまの5x7テクセルの「F」を描画しました。これを`rgba32float`テクスチャを使用するように更新しましょう。

変更点は以下の通りです。

```js
  const kTextureWidth = 5;
  const kTextureHeight = 7;
-  const _ = [255,   0,   0, 255];  // 赤
-  const y = [255, 255,   0, 255];  // 黄
-  const b = [  0,   0, 255, 255];  // 青
-  const textureData = new Uint8Array([
+  const _ = [1, 0, 0, 1];  // 赤
+  const y = [1, 1, 0, 1];  // 黄
+  const b = [0, 0, 1, 1];  // 青
+  const textureData = new Float32Array([
    b, _, _, _, _,

    _, y, y, y, _,

    _, y, _, _, _,

    _, y, y, _, _,

    _, y, _, _, _,

    _, y, _, _, _,

    _, _, _, _, _,

  ].flat());

  const texture = device.createTexture({
    label: '赤地に黄色のF',

    size: [kTextureWidth, kTextureHeight],
-    format: 'rgba8unorm',
+    format: 'rgba32float',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
      { texture },
      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
+      { bytesPerRow: kTextureWidth * 4 * 4 },
      { width: kTextureWidth, height: kTextureHeight },
  );

```

これを実行するとエラーが発生します。

{{{example url="../webgpu-bind-group-layouts-rgba32float-broken.html"}}}

私がテストしたブラウザで得られたエラーは次のとおりです。

> - WebGPU GPUValidationError: [Texture "yellow F on red"]でサポートされているサンプルタイプ（UnfilterableFloat）のいずれも、期待されるサンプルタイプ（Float）と一致しません。`<br>
> - Sampled Textureとしてentries[1]を検証中。期待されるエントリレイアウト：{sampleType: TextureSampleType::Float, viewDimension: 2, multisampled: 0}`<br>
> - [BindGroupDescriptor]を[BindGroupLayout (unlabeled)]に対して検証中`<br>
> - [Device].CreateBindGroup([BindGroupDescriptor])を呼び出し中`

これはどういうことでしょうか？ `rgba32float`（およびすべての`xxx32float`）テクスチャは、デフォルトではフィルタリングできないことが判明しました。フィルタリング可能にするための[オプション機能](webgpu-limits-and-features.html)がありますが、その機能はどこでも利用できるとは限りません。これは特にモバイルデバイスで、少なくとも2024年にはその可能性が高いです。

デフォルトでは、次のように`texture_2d<f32>`でバインディングを宣言すると、

```wgsl
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;
```

そしてパイプラインを作成するときに`layout: 'auto'`を使用すると、WebGPUはフィルタリング可能なテクスチャを具体的に要求するバインドグループレイアウトを作成します。フィルタリング不可能なものをバインドしようとすると、エラーが発生します。

フィルタリングできないテクスチャを使用したい場合は、手動でバインドグループレイアウトを作成する必要があります。

[ここ](resources/wgsl-offset-computer.html)に、シェーダーを貼り付けると自動レイアウトを生成してくれるツールがあります。上記の例のシェーダーを貼り付けると、次のようになります。

```js
const bindGroupLayoutDescriptors = [
  {
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "filtering",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
    ],
  },
];
```

これは`GPUBindGroupLayoutDescriptor`の配列です。上記では、バインドグループが`sampleType: "float"`を使用していることがわかります。これは`'rgba8unorm'`のタイプですが、`'rgba32float'`のタイプではありません。特定のテクスチャフォーマットが動作するサンプルタイプは、[仕様書のこの表](https://www.w3.org/TR/webgpu/#texture-format-caps)で確認できます。

この例を修正するには、テクスチャバインディングとサンプラーバインディングの両方を調整する必要があります。サンプラーバインディングは`'non-filtering'`サンプラーに変更する必要があります。テクスチャバインディングは`'unfilterable-float'`に変更する必要があります。

そこで、まず`GPUBindGroupLayout`を作成する必要があります。

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
*          type: 'non-filtering',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
*          sampleType: 'unfilterable-float',
          viewDimension: '2d',
          multisampled: false,
        },
      },
    ],
  });
```

2つの変更点は上記でマークされています。

次に、パイプラインで使用される`GPUBindGroupLayout`の配列である`GPUPipelineLayout`を作成する必要があります。

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

`createPipelineLayout`は、`GPUBindGroupLayout`の配列を持つオブジェクトを受け取ります。これらはグループインデックス順に並べられているため、最初のエントリは`@group(0)`になり、2番目のエントリは`@group(1)`になります。いずれかをスキップする必要がある場合は、空のバインドグループレイアウトを追加する必要があります。

最後に、パイプラインを作成するときに、パイプラインレイアウトを渡します。

```js
  const pipeline = device.createRenderPipeline({
    label: 'ハードコードされたテクスチャ付きクワッドパイプライン',

-    layout: 'auto',
+    layout: pipelineLayout,
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

これで、この例は再び機能しますが、今度は`rgba32float`テクスチャを使用しています。

{{{example url="../webgpu-bind-group-layouts-rgba32float-fixed.html"}}}

注：この例が機能するのは、フィルタリング不可能な浮動小数点数を受け入れるバインドグループレイアウトを作成するために上記の作業を行ったためですが、`'nearest'`フィルタリングのみを使用する`GPUSampler`を使用しているためでもあります。`magFilter`、`minFilter`、または`mipmapFilter`のいずれかのフィルタを`'linear'`に設定すると、`'non-filtering'`サンプラーバインディングで`'filtering'`サンプラーを使用しようとしたというエラーが表示されます。

## `layout: 'auto'`とは異なるバインドグループレイアウトの使用 - 動的オフセット

デフォルトでは、バインドグループを作成してユニフォームバッファまたはストレージバッファをバインドすると、バッファ全体がバインドされます。バインドグループを作成するときにオフセットと長さを渡すこともできます。どちらの場合も、一度設定すると変更できません。

WebGPUには、`setBindGroup`を呼び出すときにオフセットを変更できるオプションがあります。この機能を使用するには、手動でバインドグループレイアウトを作成し、後で設定できるようにしたい各バインディングに`hasDynamicOffsets: true`を設定する必要があります。

これを簡単にするために、[基礎に関する記事](webgpu-fundamentals.html#a-run-computations-on-the-gpu)の単純な計算例を使用します。同じバッファから2セットの値を加算するように変更し、動的オフセットを使用してどちらのセットかを選択します。

まず、シェーダーを次のように変更しましょう。

```wgsl
@group(0) @binding(0) var<storage, read_write> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3u
) {
  let i = id.x;
  dst[i] = a[i] + b[i];
}
```

`a`を`b`に加算して`dst`に書き込むだけであることがわかります。

次に、バインドグループレイアウトを作成しましょう。

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
    ],
  });
```

すべて`hasDynamicStorage: true`とマークされています。

では、これを使ってパイプラインを作成しましょう。

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });

  const pipeline = device.createComputePipeline({
-    label: 'double compute pipeline',
+    label: 'add elements compute pipeline',
-    layout: 'auto',
+    layout: pipelineLayout,
    compute: {
      module,
    },
  });
```

バッファを設定しましょう。オフセットは256の倍数でなければならないため[^minStorageBufferOffsetAlignment]、少なくとも3つの有効なオフセット（0、256、512）を持つように、256 * 3バイトの大きさのバッファを作成しましょう。

[^minStorageBufferOffsetAlignment]: デバイスがより小さいオフセットをサポートしている可能性があります。[limits and features](webgpu-limits-and-features.html)の`minStorageBufferOffsetAlignment`または`minUniformBufferOffsetAlignment`を参照してください。

```js
-  const input = new Float32Array([1, 3, 5]);
+  const input = new Float32Array(64 * 3);
+  input.set([1, 3, 5]);
+  input.set([11, 12, 13], 64);

  // 計算の入力と出力を保持するためにGPU上にバッファを作成します
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // 入力データをそのバッファにコピーします
  device.queue.writeBuffer(workBuffer, 0, input);
```

上記のコードは、`64 * 3`個の32ビット浮動小数点数の配列を作成します。これは768バイトです。

元の例では同じバッファの読み書きを行っていたので、同じバッファを3回バインドするだけにします。

```js
  // シェーダーにどのバッファを計算に使用するかを伝えるためのbindGroupを設定します
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
-      { binding: 0, resource: { buffer: workBuffer } },
+      { binding: 0, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 1, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 2, resource: { buffer: workBuffer, size: 256 } },
    ],
  });
```

注意：サイズを指定する必要があります。そうしないと、バッファ全体のサイズがデフォルトになります。その後、オフセット > 0 を設定すると、範囲外のバッファの一部を指定しているため、エラーが発生します。

`setBindGroup`では、動的オフセットを持つ各バッファに対して1つのオフセットを渡すようになりました。バインドグループレイアウトの3つのエントリすべてを`hasDynamicOffset: true`とマークしたため、バインディングスロットの順序で3つのオフセットが必要です。

```js
  ...
  pass.setPipeline(pipeline);
-  pass.setBindGroup(0, bindGroup);
+  pass.setBindGroup(0, bindGroup, [0, 256, 512]);
  pass.dispatchWorkgroups(3);
  pass.end();
```

最後に、結果を表示するコードを変更する必要があります。

```js
-  console.log(input);
-  console.log(result);
+  console.log('a', input.slice(0, 3));
+  console.log('b', input.slice(64, 64 + 3));
+  console.log('dst', result.slice(128, 128 + 3));
```

{{{example url="../webgpu-bind-group-layouts-dynamic-offsets.html"}}}

動的オフセットを使用すると、非動的オフセットよりもわずかに遅くなることに注意してください。その理由は、非動的オフセットでは、オフセットとサイズがバッファの範囲内にあるかどうかは、バインドグループを作成するときにチェックされるためです。動的オフセットでは、そのチェックは`setBindGroup`を呼び出すまで行えません。`setBindGroup`を数百回しか呼び出さない場合は、その差は問題にならないでしょう。`setBindGroup`を数千回呼び出す場合は、より顕著になる可能性があります。

## <a id="a-sharing-bind-groups"></a> 1つ以上のパイプラインでバインドグループを使用する

バインドグループレイアウトを手動で作成するもう1つの理由は、同じバインドグループを複数のパイプラインで使用できるようにするためです。

バインドグループを再利用したい一般的な場所の1つは、シャドウ付きの基本的な3Dシーンレンダラーです。

基本的な3Dシーンレンダラーでは、バインディングを次のように分割するのが一般的です。

*   グローバル（パースペクティブ行列やビュー行列など）
*   マテリアル（テクスチャ、色）
*   ローカル（モデル行列など）

次に、次のようにレンダリングします。

```
setBindGroup(0, globalsBG)
for each material
  setBindGroup(1, materialBG)
  for each object that uses material
    setBindGroup(2, localBG)
    draw(...)
```

[シャドウ](webgpu-shadows.html)を追加する場合、まずシャドウマップパイプラインでシャドウマップを描画する必要があります。それらのすべてのものに対して別々のバインドグループ（描画するパイプラインで動作するものと、シャドウマップをレンダリングするパイプラインで動作する別のバインドグループ）を持つのではなく、1セットのバインドグループを作成し、両方のケースで同じものを使用する方がはるかに簡単です。

これは、バインドグループの共有を披露するためだけに書くには、かなり大きなサンプルです。[シャドウに関する記事](webgpu-shadows.html)では共有バインドグループを使用していますが、[基礎に関する記事](webgpu-fundamentals.html#a-run-computations-on-the-gpu)の単純な計算例を再度取り上げ、1つのバインドグループで2つの計算パイプラインを使用するようにします。

まず、3を加算する別のシェーダーモジュールを追加しましょう。

```js
-  const module = device.createShaderModule({
+  const moduleTimes2 = device.createShaderModule({
    label: 'doubling compute module',
    code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });

+  const modulePlus3 = device.createShaderModule({
+    label: 'adding 3 compute module',
+    code: /* wgsl */ `
+      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
+
+      @compute @workgroup_size(1) fn computeSomething(
+        @builtin(global_invocation_id) id: vec3u
+      ) {
+        let i = id.x;
+        data[i] = data[i] + 3.0;
+      }
+    `,
+  });
```

次に、2つのパイプラインが同じ`GPUBindGroup`を共有できるように、`GPUBindGroupLayout`と`GPUPipelineLayout`を作成しましょう。

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          minBindingSize: 0,
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

では、パイプラインを作成するときにそれらを使用しましょう。

```js
-  const pipeline = device.createComputePipeline({
+  const pipelineTimes2 = device.createComputePipeline({
    label: 'doubling compute pipeline',
-    layout: 'auto',
+    layout: pipelineLayout,
    compute: {
      module: moduleTimes2,
    },
  });

+  const pipelinePlus3 = device.createComputePipeline({
+    label: 'plus 3 compute pipeline',
+    layout: pipelineLayout,
+    compute: {
      module: modulePlus3,
+    },
+  });
```

バインドグループを設定するときは、`bindGroupLayout`を直接使用しましょう。

```js
  // シェーダーにどのバッファを計算に使用するかを伝えるためのbindGroupを設定します
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
-    layout: pipeline.getBindGroupLayout(0),
+    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: workBuffer } },
    ],
  });
```

最後に、両方のパイプラインを使用しましょう。

```js
  // 計算を行うためのコマンドをエンコードします
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
-  pass.setPipeline(pipeline);
+  pass.setPipeline(pipelineTimes2);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
+  pass.setPipeline(pipelinePlus3);
+  pass.dispatchWorkgroups(input.length);
  pass.end();
```

結果は、1つのバインドグループで2を掛けて3を加算します。

{{{example url="../webgpu-bind-group-layouts-multiple-pipelines.html"}}}

あまり面白くありませんが、少なくとも動作する簡単な例です。

いつ手動でバインドグループレイアウトを作成し、いつ作成しないかは、本当にあなた次第です。上記の例では、各パイプラインに1つずつ、2つのバインドグループを作成する方が間違いなく簡単だったでしょう。

単純な状況では、手動でバインドグループレイアウトを作成する必要はほとんどありませんが、WebGPUプログラムがより複雑になるにつれて、バインドグループレイアウトを作成することが、あなたが頼るテクニックになる可能性があります。

## <a id="a-bind-group-layout-notes"></a> バインドグループレイアウトの注意点：

`GPUBindGroupLayout`を作成する際の注意点：

*   ## 各エントリは、どの`binding`に対応するかを宣言する必要があります。

*   ## 各エントリは、どのステージで表示されるかを宣言する必要があります。

    上記の例では、1つの可視性のみを宣言しました。
    たとえば、頂点シェーダーとフラグメントシェーダーの両方でバインドグループを参照したい場合は、次のように使用します。

    ```js
       visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX
    ```

    または3つのステージすべて：

    ```js
       visibility: GPUShaderStage.COMPUTE |
                   GPUShaderStage.FRAGMENT | 
                   GPUShaderStage.VERTEX
    ```

*   ## いくつかのデフォルトがあります：

    `texture:`バインディングのデフォルトは次のとおりです。

    ```js
    {
      sampleType: 'float',
      viewDimension: '2d',
      multisampled: false,
    }
    ```

    `sampler:`バインディングのデフォルトは次のとおりです。

    ```js
    {
      type: 'filtering',
    }
    ```

    つまり、最も一般的なサンプラーとテクスチャの使用法では、サンプラーとテクスチャのエントリを次のように宣言できます。

    ```js
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},  // デフォルトを使用
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},  // デフォルトを使用
        },
      ],
    });
    ```

*   ## バッファエントリは、可能な場合は`minBindingSize`を宣言する必要があります。

    バッファバインディングを宣言するときに、`minBindingSize`を指定できます。

    良い例は、ユニフォーム用の構造体を作成することかもしれません。たとえば、[ユニフォームに関する記事](webgpu-uniforms.html)では、この構造体がありました。

    ```wgsl
    struct OurStruct {
      color: vec4f,
      scale: vec2f,
      offset: vec2f,
    };

    @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
    ``` 

    32バイト必要なので、`minBindingSize`を次のように宣言する必要があります。

    ```js
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'uniform',
            minBindingSize: 32,
          },
        },
      ],
    });
    ```

    `minBindingSize`を宣言する理由は、`createBindGroup`を呼び出すときにWebGPUがバッファサイズ/オフセットが正しいサイズであるかどうかをチェックできるようにするためです。`minBindingSize`を設定しない場合、WebGPUは、バッファがパイプラインの正しいサイズであるかどうかを、描画/ディスパッチワークグループ時にチェックする必要があります。すべての描画呼び出しをチェックするよりも、バインドグループを作成するときに一度チェックする方が高速です。

    一方、数値を2倍にするためにストレージバッファを使用した上記の例では、`minBindingSize`を宣言しませんでした。これは、ストレージバッファが`array`として宣言されているため、渡す値の数に応じて異なるサイズのバッファをバインドできるためです。


[仕様書のこの部分](https://www.w3.org/TR/webgpu/#dictdef-gpubindgrouplayoutentry)は、バインドグループレイアウトを作成するためのすべてのオプションを詳述しています。

[この記事](https://toji.dev/webgpu-best-practices/bind-groups)も、バインドグループとバインドグループレイアウトに関するいくつかのアドバイスがあります。

[このライブラリ](https://greggman.github.io/webgpu-utils)は、構造体のサイズとデフォルトのバインドグループレイアウトを計算します。
