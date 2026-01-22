Title: WebGPU コンピュートシェーダーの基本
Description: WebGPUでコンピュートシェーダーを使用する方法
TOC: コンピュートシェーダーの基本

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事は、[基礎に関する記事](webgpu-fundamentals.html)の続きです。コンピュートシェーダーのいくつかの基本から始めて、うまくいけば、現実世界の問題を解決する例に進みます。

[前の記事](webgpu-fundamentals.html)では、数値をその場で2倍にする非常に単純なコンピュートシェーダーを作成しました。

これがシェーダーです。

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  let i = id.x;
  data[i] = data[i] * 2.0;
}
```

次に、コンピュートシェーダーを次のように効果的に実行しました。

```js
  ...
  pass.dispatchWorkgroups(count);
```

ワークグループの定義について説明する必要があります。

ワークグループは、スレッドの小さなコレクションと考えることができます。各スレッドは並行して実行されます。WGSLでワークグループのサイズを静的に定義します。ワークグループのサイズは3次元で定義されますが、デフォルトは1なので、`@workgroup_size(1)`は`@workgroup_size(1, 1, 1)`と同じです。

<a id="a-local-invocation-id"></a>ワークグループをたとえば`@workgroup_size(3, 4, 2)`と定義すると、3 * 4 * 2個のスレッドを定義していることになります。別の言い方をすれば、24スレッドのワークグループを定義していることになります。

<div class="webgpu_center">
  <img src="resources/gpu-workgroup.svg" style="width: 500px;">
  <div>ワークグループ内のスレッドの<code>local_invocation_id</code></div>
</div>

<a id="a-workgroup-id"></a>次に`pass.dispatchWorkgroups(4, 3, 2)`を呼び出すと、24スレッドのワークグループを4 * 3 * 2回（24回）実行し、合計576スレッドを実行するように指示していることになります。

<div class="webgpu_center">
  <img src="resources/gpu-workgroup-dispatch.svg" style="width: 500px;">
  <div>ディスパッチされたワークグループの<code>workgroup_id</code></div>
</div>

コンピュートシェーダーの各「呼び出し」内で、次の組み込み変数が利用可能です。

* `local_invocation_id`: ワークグループ内のこのスレッドのID

  [上の図を参照してください](#a-local-invocation-id)。

* `workgroup_id`: ワークグループのID

  ワークグループ内のすべてのスレッドは同じワークグループIDを持ちます。[上の図を参照してください](#a-workgroup-id)。

* `global_invocation_id`: 各スレッドの一意のID

  これは次のように考えることができます。

  ```
  global_invocation_id = workgroup_id * workgroup_size + local_invocation_id
  ```

* `num_workgroups`: `pass.dispatchWorkgroups`に渡したもの

* `local_invocation_index`: このスレッドの線形化されたID

  これは次のように考えることができます。

  ```
  rowSize = workgroup_size.x
  sliceSize = rowWidth * workgroup_size.y
  local_invocation_index =
        local_invocation_id.x +
        local_invocation_id.y * rowSize +
        local_invocation_id.z * sliceSize
  ```

これらの値を使用するサンプルを作成しましょう。各呼び出しからバッファに値を書き込み、その値を表示するだけです。

これがシェーダーです。

```js
const dispatchCount = [4, 3, 2];
const workgroupSize = [2, 3, 4];

// 配列のすべての要素を乗算します
const arrayProd = arr => arr.reduce((a, b) => a * b);

const numThreadsPerWorkgroup = arrayProd(workgroupSize);

const code = `
// 注！: vec3uは4バイトでパディングされます
@group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
@group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
@group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

@compute @workgroup_size(${workgroupSize}) fn computeSomething(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
    @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  // workgroup_indexは、ワークグループ内のスレッドではなく、
  // ワークグループのlocal_invocation_indexに似ています。
  // 組み込みではないので、自分で計算します。

  let workgroup_index =  
     workgroup_id.x +
     workgroup_id.y * num_workgroups.x +
     workgroup_id.z * num_workgroups.x * num_workgroups.y;

  // global_invocation_indexはlocal_invocation_indexに似ています
  // ただし、ディスパッチされたすべてのワークグループのすべての呼び出しにわたって線形です。
  // 組み込みではないので、自分で計算します。

  let global_invocation_index =
     workgroup_index * ${numThreadsPerWorkgroup} +
     local_invocation_index;

  // これで、これらの各組み込みをバッファに書き込むことができます。
  workgroupResult[global_invocation_index] = workgroup_id;
  localResult[global_invocation_index] = local_invocation_id;
  globalResult[global_invocation_index] = global_invocation_id;
`;
```

JavaScriptテンプレートリテラルを使用して、JavaScript変数`workgroupSize`からワークグループサイズを設定できるようにしました。これは、シェーダーにハードコーディングされます。

シェーダーができたので、これらの結果を格納するための3つのバッファを作成できます。

```js
  const numWorkgroups = arrayProd(dispatchCount);
  const numResults = numWorkgroups * numThreadsPerWorkgroup;
  const size = numResults * 4 * 4;  // vec3f * u32

  let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
  const workgroupBuffer = device.createBuffer({size, usage});
  const localBuffer = device.createBuffer({size, usage});
  const globalBuffer = device.createBuffer({size, usage});
```

前に指摘したように、ストレージバッファをJavaScriptにマップすることはできないため、マップできるバッファが必要です。ストレージバッファからこれらのマップ可能な結果バッファに結果をコピーし、その結果を読み取ります。

```js
  usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
  const workgroupReadBuffer = device.createBuffer({size, usage});
  const localReadBuffer = device.createBuffer({size, usage});
  const globalReadBuffer = device.createBuffer({size, usage});
```

すべてのストレージバッファをバインドするためのバインドグループを作成します。

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: workgroupBuffer },
      { binding: 1, resource: localBuffer },
      { binding: 2, resource: globalBuffer },
    ],
  });
```

エンコーダーとコンピュートパスエンコーダーを開始し、前の例と同じように、コンピュートシェーダーを実行するコマンドを追加します。

```js
  // 計算を行うためのコマンドをエンコードします
  const encoder = device.createCommandEncoder({ label: 'compute builtin encoder' });
  const pass = encoder.beginComputePass({ label: 'compute builtin pass' });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...dispatchCount);
  pass.end();
```

ストレージバッファからマップ可能な結果バッファに結果をコピーする必要があります。

```js
  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
  encoder.copyBufferToBuffer(localBuffer, 0, localReadBuffer, 0, size);
  encoder.copyBufferToBuffer(globalBuffer, 0, globalReadBuffer, 0, size);
```

そして、エンコーダーを終了し、コマンドバッファを送信します。

```js
  // エンコードを終了し、コマンドを送信します
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

以前と同様に、結果を読み取るには、バッファをマップし、準備ができたら、その内容の型付き配列ビューを取得します。

```js
  // 結果を読み取ります
   await Promise.all([
    workgroupReadBuffer.mapAsync(GPUMapMode.READ),
    localReadBuffer.mapAsync(GPUMapMode.READ),
    globalReadBuffer.mapAsync(GPUMapMode.READ),
  ]);

  const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange());
  const local = new Uint32Array(localReadBuffer.getMappedRange());
  const global = new Uint32Array(globalReadBuffer.getMappedRange());
```

> 重要：ここでは3つのバッファをマップし、`await Promise.all`を使用して、それらすべてが使用できる準備が整うのを待ちました。最後のバッファだけを待つことは**できません*。3つのバッファすべてを待つ必要があります。

最後に、それらを表示できます。

```js
  const get3 = (arr, i) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
  };

  for (let i = 0; i < numResults; ++i) {
    if (i % numThreadsPerWorkgroup === 0) {
      log(`\
 ---------------------------------------
 global                 local     global   dispatch: ${i / numThreadsPerWorkgroup}
 invoc.    workgroup    invoc.    invoc.
 index     id           id        id
 ---------------------------------------`);
    }
    log(` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`)
  }
}

function log(...args) {
  const elem = document.createElement('pre');
  elem.textContent = args.join(' ');
  document.body.appendChild(elem);
}
```

これが結果です。

{{{example url="../webgpu-compute-shaders-builtins.html"}}}

これらの組み込みは、一般的に、`pass.dispatchWorkgroups`への1回の呼び出しに対してコンピュートシェーダーのスレッドごとに変更される唯一の入力です。したがって、効果的であるためには、これらの`..._id`組み込みを入力として、目的の処理を行うコンピュートシェーダー関数を設計する方法を理解する必要があります。

## ワークグループサイズ

ワークグループのサイズはどのくらいにすればよいでしょうか？なぜ常に`@workgroup_size(1, 1, 1)`を使用しないのか、という疑問がよくあります。そうすれば、`pass.dispatchWorkgroups`のパラメータのみで実行する反復回数を決定するのがより簡単になります。

その理由は、ワークグループ内の複数のスレッドが個々のディスパッチよりも高速だからです。

1つには、ワークグループ内のスレッドはしばしばロックステップで実行されるため、16個実行するのは1個実行するのと同じくらい高速です。

WebGPUのデフォルトの制限は次のとおりです。

* `maxComputeInvocationsPerWorkgroup`: 256
* `maxComputeWorkgroupSizeX`: 256
* `maxComputeWorkgroupSizeY`: 256
* `maxComputeWorkgroupSizeZ`: 64

ご覧のとおり、最初の制限`maxComputeInvocationsPerWorkgroup`は、`@workgroup_size`の3つのパラメータが256より大きい数値に乗算できないことを意味します。つまり、

```
   @workgroup_size(256, 1, 1)   // ok
   @workgroup_size(128, 2, 1)   // ok
   @workgroup_size(16, 16, 1)   // ok
   @workgroup_size(16, 16, 2)   // bad 16 * 16 * 2 = 512
```

残念ながら、最適なサイズはGPUに依存し、WebGPUはその情報を提供できません。**WebGPUの一般的なアドバイスは、別のサイズを選択する特定の理由がない限り、ワークグループサイズを64にすることです。** どうやら、ほとんどのGPUは64個のものをロックステップで効率的に実行できるようです。より高い数値を選択し、GPUが高速パスとして実行できない場合、より遅いパスを選択します。一方、GPUが実行できるよりも低い数値を選択した場合、最大のパフォーマンスが得られない可能性があります。

## <a href="a-race-conditions"></a>コンピュートシェーダーの競合状態

WebGPUでよくある間違いは、競合状態を処理しないことです。競合状態とは、複数のスレッドが同時に実行されており、事実上、誰が最初または最後に到達するかを競っている状態です。

このコンピュートシェーダーがあったとします。

```wgsl
@group(0) @binding(0) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(32) fn computeSomething(
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
) {
  result[0] = local_invocation_id.x;
`;
```

読みにくい場合は、同じようなJavaScriptを次に示します。

```js
const result = [];
for (let i = 0; i < 32; ++i) {
  result[0] = i;
}
```

JavaScriptの場合、コードが実行された後、`result[0]`は明らかに31です。しかし、コンピュートシェーダーの場合、シェーダーの32回の反復すべてが並行して実行されています。最後に終了したものが、`result[0]`の値になります。どれが最後に実行されるかは未定義です。

仕様から：

> WebGPUは、以下について保証しません。
>
> * 異なるワークグループからの呼び出しが同時に実行されるかどうか。つまり、一度に複数のワークグループが実行されると想定することはできません。
>
> * ワークグループからの呼び出しが実行を開始すると、他のワークグループが実行からブロックされるかどうか。つまり、一度に1つのワークグループのみが実行されると想定することはできません。ワークグループが実行されている間、実装は他のワークグループも同時に実行することを選択したり、キューに入れられているがブロックされていない他の作業を実行したりする場合があります。
>
> * ある特定のワークグループからの呼び出しが、別のワークグループの呼び出しの前に実行を開始するかどうか。つまり、ワークグループが特定の順序で起動されると想定することはできません。

この問題に対処する方法のいくつかについては、今後の例で説明します。今のところ、コンピュートシェーダーの2つの例には競合状態はありません。コンピュートシェーダーの各反復は、他の反復の影響を受けない何かを実行するためです。

次は：[コンピュートシェーダーの例 - 画像ヒストグラム](webgpu-compute-shaders-histogram.html)

```