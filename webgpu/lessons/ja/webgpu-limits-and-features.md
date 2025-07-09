Title: WebGPUのオプション機能と制限
Description: オプション機能
TOC: オプション機能と制限

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

WebGPUには、多数のオプション機能と制限があります。それらを確認し、要求する方法について説明します。

アダプターを要求する場合

```js
const adapter = await navigator.gpu?.requestAdapter();
```

アダプターには、`adapter.limits`に制限のリストと、`adapter.features`に機能名の配列があります。たとえば、

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.limits.maxColorAttachments);
```

コンソールに`8`と表示される場合があります。これは、アダプターが最大8つのカラーアタッチメントをサポートしていることを意味します。

これは、デフォルトのアダプターの制限と、最小限必要な制限を含む、すべての制限のリストです。

<div class="webgpu_center data-table limits" data-diagram="limits"></div>

最小制限は、WebGPUをサポートするすべてのデバイスで期待できる制限です。

オプション機能のリストもあります。たとえば、次のように表示できます。

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.features);
```

これは、`["texture-compression-astc", "texture-compression-bc"]`のようなものを出力し、要求すればそれらの機能が利用可能であることを示します。

これは、デフォルトのアダプターで利用可能な機能のリストです。

<div class="webgpu_center data-table features" data-diagram="features"></div>

> 注：[webgpureport.org](https://webgpureport.org)で、システムのすべてのアダプターの機能と制限を確認できます。

## 制限と機能の要求

デフォルトでは、デバイスを要求すると、最小制限（上記の右側の列）が得られ、オプション機能は得られません。最小制限内に収まっていれば、アプリはWebGPUをサポートするすべてのデバイスで実行されることが期待されます。

しかし、アダプターにリストされている利用可能な制限と機能があれば、`requestDevice`を呼び出すときに、目的の制限を`requiredLimits`として、目的の機能を`requiredFeatures`として渡すことで、それらを要求できます。たとえば、

```js
const k1Gig = 1024 * 1024 * 1024;
const adapter = await navigator.gpu?.requestAdapter();
const device = adapter?.requestDevice({
  requiredLimits: { maxBufferSize: k1Gig },
  requiredFeatures: [ 'float32-filterable' ],
});
```

上記では、最大1ギガバイトのバッファを使用できることと、フィルタリング可能なfloat32テクスチャ（たとえば、デフォルトでは`'nearest'`でのみ使用できる`minFilter`が`'linear'`に設定された`'rgba32float'`）を使用できることを要求しています。

これらの要求のいずれかが満たされない場合、`requestDevice`は失敗します（プロミスを拒否します）。

## すべてを要求しない

すべての制限と機能を要求し、必要なものを確認したくなるかもしれません。

例：

```js
function objLikeToObj(src) {
  const dst = {};
  for (const key in src) {
    dst[key] = src[key];
  }
  return dst;
}

//
// 悪い!!! ?
//
async function main() {
  const adapter = await navigator?.gpu.requestAdapter();
  const device = await adapter?.requestDevice({
    requiredLimits: objLikeToObj(adapter.limits),
    requiredFeatures: adapter.features,
  });
  if (!device) {
    fail('need webgpu');
    return;
  }

  const canUse128KUniformsBuffers = device.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = device.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = device.features.has('indirect-first-instance');
}
```

これは、制限と機能を確認するための単純で明確な方法のように思えます[^objliketoobj]。このパターンの問題は、誤って制限を超えてしまい、それに気づかない可能性があることです。たとえば、`'rgba32float'`テクスチャを作成し、`'linear'`フィルタリングでフィルタリングしたとします。デスクトップマシンでは、たまたま有効にしていたため、魔法のように機能します。

[^objliketoobj]: この`objLikeToObj`とは何ですか？なぜ必要なのですか？これは、難解なWeb仕様の問題です。仕様では、`requiredLimits`を`record<DOMString, GPUSize64>`としてリストしています。Web IDL仕様では、オブジェクトを何かから`record<DOMString, GPUSize64>`に変換する場合、実際にオブジェクトの*独自の*プロパティであるプロパティのみをコピーすると記載されています。アダプターの`limits`オブジェクトは`interface`としてリストされています。そこにあるように見えるものはプロパティではなく、オブジェクトのプロトタイプに存在するゲッターであり、実際にはオブジェクトの独自のプロパティではありません。したがって、`record<DOMString, GPUSize64>`に変換されるときにコピーされないため、自分でコピーする必要があります。

ユーザーの携帯電話では、`'float32-filterable'`機能が存在せず、オプション機能であることを認識せずに使用していたため、プログラムが不思議なことに失敗します。

または、最小の`maxBufferSize`より大きいバッファを割り当ててしまい、制限を超えたことに気づかない可能性があります。出荷すると、多くのユーザーがページを実行できなくなります。

## 機能と制限を要求する推奨方法

機能と制限を使用する推奨方法は、絶対に必要とするものを決定し、それらの制限のみを要求することです。

例：

```js
  const adapter = await navigator?.gpu.requestAdapter();

  const canUse128KUniformsBuffers = adapter?.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = adapter?.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = adapter?.features.has('indirect-first-instance');

  // これらの機能の1つ以上が絶対に必要で、利用できない場合は、ここで失敗します
  if (!canUse128kUniformBuffers) {
    alert('申し訳ありませんが、お使いのデバイスは古すぎるか、性能が低い可能性があります');
    return;
  }

  // 必要な利用可能な機能と制限を要求します
  const device = adapter?.requestDevice({
    requiredFeatures: [
      ...(canStorageBGRA8Unorm ? ['bgra8unorm'] : []),
      ...(canIndirectFirstInstance) ? ['indirect-first-instance']),
    ],
    requiredLimits: [
      maxUniformBufferBindingSize: 128 * 1024,
    ]
  });
```

このようにすると、128kより大きいユニフォームバッファを要求すると、エラーが発生します。同様に、要求しなかった機能を使用しようとすると、エラーが発生します。次に、必要な制限を増やす（したがって、より多くのデバイスで実行を拒否する）か、制限を維持するか、機能や制限が利用可能かどうかに応じてコードを構造化して異なることを行うかを、意識的に決定できます。

<!-- この記事の最後にこれを保持してください -->
<link rel="stylesheet" href="webgpu-limits-and-features.css">
<script type="module" src="webgpu-limits-and-features.js"></script>



