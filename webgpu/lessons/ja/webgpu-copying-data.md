Title: WebGPU データのコピー
Description: バッファとテクスチャとの間でデータをコピーする
TOC: データのコピー

これまでのほとんどの記事では、バッファにデータを入れるために`writeBuffer`関数を使用し、テクスチャにデータを入れるために`writeTexture`関数を使用してきました。バッファやテクスチャにデータを入れる方法はいくつかあります。

## `writeBuffer`

`writeBuffer`は、JavaScriptの`TypedArray`または`ArrayBuffer`からバッファにデータをコピーします。これは、バッファにデータを取り込む最も簡単な方法と言えるでしょう。

`writeBuffer`は次の形式に従います。

```js
device.queue.writeBuffer(
  destBuffer,  // 書き込み先のバッファ
  destOffset,  // 書き込みを開始する宛先バッファ内の場所
  srcData,     // TypedArrayまたはArrayBuffer
  srcOffset?,  // コピーを開始するsrcData内の**要素**のオフセット
  size?,       // コピーするsrcDataの**要素**のサイズ
)
```

`srcOffset`が渡されない場合は`0`です。`size`が渡されない場合は`srcData`のサイズです。

> 重要：`srcOffset`と`size`は`srcData`の要素単位です。
>
> 言い換えると、
>
> ```js
> device.queue.writeBuffer(
>   someBuffer,
>   someOffset,
>   someFloat32Array,
>   6,
>   7,
> )
> ``` 
>
> 上記のコードは、float32 #6から7つのfloat32のデータをコピーします。別の言い方をすれば、`someFloat32Array`がビューであるArrayBufferの部分から、バイト24から始まる28バイトをコピーします。

## `writeTexture`

`writeTexture`は、JavaScriptの`TypedArray`または`ArrayBuffer`からテクスチャにデータをコピーします。
  
`writeTexture`には次のシグネチャがあります。

```js
device.writeTexture(
  // 宛先の詳細
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // ソースデータ
  srcData,

  // ソースデータの詳細
  { offset: 0, bytesPerRow, rowsPerImage },

  // サイズ：
  [ width, height, depthOrArrayLayers ] または { width, height, depthOrArrayLayers }
)
```

注意点：

* `texture`には`GPUTextureUsage.COPY_DST`の使用法が必要です。

* `mipLevel`、`origin`、`aspect`はすべてデフォルト値を持つため、指定する必要がない場合が多いです。

* `bytesPerRow`：これは、データの次の*ブロック行*に進むために進むバイト数です。

   これは、1つ以上の*ブロック行*をコピーする場合に必要です。ほとんどの場合、1つ以上の*ブロック行*をコピーしているため、ほとんどの場合に必要です。

* `rowsPerImage`：これは、ある画像の開始から次の画像に進むために進む*ブロック行*の数です。

   これは、1つ以上のレイヤーをコピーする場合に必要です。つまり、サイズ引数の`depthOrArrayLayers`が1より大きい場合は、この値を指定する必要があります。

コピーは次のように機能すると考えることができます。

```js
   // 擬似コード
   const [x, y, z] = origin ?? [0, 0, 0];
   const [blockWidth, blockHeight, bytesPerBlock] = 
      getBlockInfoForTextureFormat(texture.format);

   const blocksAcross = width / blockWidth;
   const blocksDown = height / blockHeight;
   const bytesPerBlockRow = blocksAcross * bytesPerBlock;

   for (layer = 0; layer < depthOrArrayLayers; layer) {
      for (row = 0; row < blocksDown; ++row) {
        const start = offset + (layer * rowsPerImage + row) * bytesPerRow;
        copyRowToTexture(
            texture,               // コピー先のテクスチャ
            x, y + row, z + layer, // コピー先のテクスチャ内の場所
            srcDataAsBytes + start,
            bytesPerBlockRow);
      }
   }
```

### <a id="a-block-rows"></a>**ブロック行**

テクスチャはブロックに編成されています。ほとんどの*通常の*テクスチャでは、ブロックの幅と高さは両方とも1です。圧縮テクスチャでは、これが変わります。たとえば、フォーマット`bc1-rgba-unorm`のブロック幅は4、ブロック高さは4です。つまり、幅を8、高さを12に設定すると、6つのブロックしかコピーされません。最初の行に2ブロック、2番目の行に2ブロック、3番目の行に2ブロックです。

圧縮テクスチャの場合、サイズと原点はブロックサイズに合わせる必要があります。

> 重要：WebGPUでサイズ（`GPUExtent3D`として定義）を受け取る場所はどこでも、1〜3個の数値の配列、または1〜3個のプロパティを持つオブジェクトのいずれかになります。`height`と`depthOrArrayLayers`はデフォルトで1なので、
>
> * `[2]` 幅=2、高さ=1、depthOrArrayLayers=1のサイズ
> * `[2, 3]` 幅=2、高さ=3、depthOrArrayLayers=1のサイズ
> * `[2, 3, 4]` 幅=2、高さ=3、depthOrArrayLayers=4のサイズ
> * `{ width: 2 }` 幅=2、高さ=1、depthOrArrayLayers=1のサイズ
> * `{ width: 2, height: 3 }` 幅=2、高さ=3、depthOrArrayLayers=1のサイズ
> * `{ width: 2, height: 3, depthOrArrayLayers: 4 }` 幅=2、高さ=3、depthOrArrayLayers=4のサイズ

> 同様に、原点が表示される場所（デフォルトは`GPUOrigin3D`）はどこでも、3つの数値の配列、または`x`、`y`、`z`プロパティを持つオブジェクトのいずれかを持つことができます。それらはすべてデフォルトで0なので、
>
> * `[5]` x=5、y=0、z=0の原点
> * `[5, 6]` x=5、y=6、z=0の原点
> * `[5, 6, 7]` x=5、y=6、z=7の原点
> * `{ x: 5 }` x=5、y=0、z=0の原点
> * `{ x: 5, y: 6 }` x=5、y=6、z=0の原点
> * `{ x: 5, y: 6, z: 7 }` x=5、y=6、z=7の原点

* `aspect`は、深度ステンシル形式にデータをコピーする場合にのみ実際に機能します。一度に1つのアスペクト（`depth-only`または`stencil-only`のいずれか）にのみコピーできます。

> 豆知識：テクスチャには`width`、`height`、`depthOrArrayLayer`プロパティがあり、これは有効な`GPUExtent3D`であることを意味します。つまり、このテクスチャが与えられた場合、
>
> ```js
> const texture = device.createTexture({
>   format: 'r8unorm',
>   size: [2, 4],
>   usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_ATTACHMENT,
> });
> ```
>
> これらはすべて機能します。
>
> ```js
> // 2x4ピクセルのデータをテクスチャにコピーします
> const bytesPerRow = 2;
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [2, 4]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [texture.width, texture.height]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: 2, height: 4});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: texture.width, height: texture.height});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, texture); // !!!
> ```
>
> 最後のものは、テクスチャに`width`、`height`、`depthOrArrayLayers`があるため機能します。あまり明確ではないため、そのスタイルは使用していませんが、有効です。

## `copyBufferToBuffer`

`copyBufferToBuffer`は、名前が示すように、あるバッファから別のバッファにデータをコピーします。

シグネチャ：

```js
encoder.copyBufferToBuffer(
  source,       // コピー元のバッファ
  sourceOffset, // コピーを開始する場所
  dest,         // コピー先のバッファ
  destOffset,   // コピーを開始する場所
  size,         // コピーするバイト数
)
```

* `source`には`GPUBufferUsage.COPY_SRC`の使用法が必要です。
* `dest`には`GPUBufferUsage.COPY_DST`の使用法が必要です。
* `size`は4の倍数でなければなりません。

## `copyBufferToTexture`

`copyBufferToTexture`は、名前が示すように、バッファからテクスチャにデータをコピーします。

シグネチャ：

```js
encoder.copyBufferToTexture(
  // ソースバッファの詳細
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // 宛先テクスチャの詳細
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // サイズ：
  [ width, height, depthOrArrayLayers ] または { width, height, depthOrArrayLayers }
)
```

これは`writeTexture`とほぼ同じパラメータを持っています。最大の違いは、`bytesPerRow`が**256の倍数でなければならない**ことです。

* `texture`には`GPUTextureUsage.COPY_DST`の使用法が必要です。
* `buffer`には`GPUBufferUsage.COPY_SRC`の使用法が必要です。

## `copyTextureToBuffer`

`copyTextureToBuffer`は、名前が示すように、テクスチャからバッファにデータをコピーします。

シグネチャ：

```js
encoder.copyTextureToBuffer(
  // ソーステクスチャの詳細
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 宛先バッファの詳細
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // サイズ：
  [ width, height, depthOrArrayLayers ]
)
```

これは`copyBufferToTexture`と同様のパラメータを持っていますが、テクスチャ（現在はソース）とバッファ（現在は宛先）が入れ替わっています。`copyBufferToTexture`と同様に、`bytesPerRow`は**256の倍数でなければなりません**。

* `texture`には`GPUTextureUsage.COPY_SRC`の使用法が必要です。
* `buffer`には`GPUBufferUsage.COPY_DST`の使用法が必要です。

## `copyTextureToTexture`

`copyTextureToTexture`は、あるテクスチャの一部を別のテクスチャにコピーします。

2つのテクスチャは、同じフォーマットであるか、接尾辞`'-srgb'`のみが異なる必要があります。

シグネチャ：

```js
encoder.copyTextureToTexture(
  // ソーステクスチャの詳細
  src: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 宛先テクスチャの詳細
  dst: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // サイズ：
  [ width, height, depthOrArrayLayers ] または { width, height, depthOrArrayLayers }
);
```

* src.`texture`には`GPUTextureUsage.COPY_SRC`の使用法が必要です。
* dst.`texture`には`GPUTextureUsage.COPY_DST`の使用法が必要です。
* `width`はブロック幅の倍数でなければなりません。
* `height`はブロック高さの倍数でなければなりません。
* src.`origin[0]`または`.x`はブロック幅の倍数でなければなりません。
* src.`origin[1]`または`.y`はブロック高さの倍数でなければなりません。
* dst.`origin[0]`または`.x`はブロック幅の倍数でなければなりません。
* dst.`origin[1]`または`.y`はブロック高さの倍数でなければなりません。

## シェーダー

シェーダーは、ストレージバッファ、ストレージテクスチャに読み書きでき、間接的にテクスチャにレンダリングできます。これらはすべて、バッファやテクスチャにデータを取り込む方法です。つまり、データを生成したり、コピーしたり、転送したりするシェーダーを作成できます。

## バッファのマッピング

バッファをマップできます。バッファをマップするということは、JavaScriptから読み書きできるようにすることです。少なくともWebGPUのバージョン1では、マップ可能なバッファには厳しい制限があります。つまり、マップ可能なバッファは、コピー元またはコピー先の一時的な場所としてのみ使用できます。マップ可能なバッファは、他の種類のバッファ（ユニフォームバッファ、頂点バッファ、インデックスバッファ、ストレージバッファなど）として使用することはできません[^mappedAtCreation]。

[^mappedAtCreation]: 例外は、`mappedAtCreation: true`を設定した場合です。[mappedAtCreation](#a-mapped-at-creation)を参照してください。

2つの使用法フラグの組み合わせでマップ可能なバッファを作成できます。

* `GPUBufferUsage.MAP_READ | GPU_BufferUsage.COPY_DST`

  これは、上記のコピーコマンドを使用して別のバッファまたはテクスチャからデータをコピーし、それをマップしてJavaScriptで値を読み取ることができるバッファです。

* `GPUBufferUsage.MAP_WRITE | GPU_BufferUsage.COPY_SRC`

  これは、JavaScriptでマップできるバッファです。JavaScriptからデータを入れ、最後にマップを解除して、上記のコピーコマンドを使用してその内容を別のバッファまたはテクスチャにコピーできます。

バッファのマッピングプロセスは非同期です。`buffer.mapAsync(mode, offset = 0, size?)`を呼び出します。ここで、`offset`と`size`はバイト単位です。`size`が指定されていない場合は、バッファ全体のサイズです。`mode`は`GPUMapMode.READ`または`GPUMapMode.WRITE`のいずれかでなければならず、もちろん、バッファを作成したときに渡した`MAP_`使用法フラグと一致する必要があります。

`mapAsync`は`Promise`を返します。プロミスが解決されると、バッファはマップ可能になります。次に、`buffer.getMappedRange(offset = 0, size?)`を呼び出して、バッファの一部またはすべてを表示できます。ここで、`offset`はマップしたバッファの部分へのバイトオフセットです。`getMappedRange`は`ArrayBuffer`を返すため、一般的に、何らかの用途に使用するには、それを使用してTypedArrayを構築します。

バッファをマッピングする例を次に示します。

```js
const buffer = device.createBuffer({
  size: 1024,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// バッファ全体をマップします
await buffer.mapAsync(GPUMapMode.READ);

// バッファ全体を32ビット浮動小数点数の配列として取得します
const f32 = new Float32Array(buffer.getMappedRange())

...

buffer.unmap();
```

注：一度マップされると、`unmap`を呼び出すまでバッファはWebGPUで使用できません。`unmap`が呼び出された瞬間に、バッファはJavaScriptから消えます。つまり、上記の例を考えてみましょう。

```js
const f32 = new Float32Array(buffer.getMappedRange())

f32[0] = 123;
console.log(f32[0]); // 123を出力します

buffer.unmap();

console.log(f32[0]); // undefinedを出力します
```

[最初の記事](webgpu-fundamentals.html#a-run-computations-on-the-gpu)で、ストレージバッファ内の数値を2倍にし、その結果をマップ可能なバッファにコピーして、結果を読み取るためにマップした例をすでに見てきました。

もう1つの例は、[コンピュートシェーダーの基本](webgpu-compute-shaders.md)に関する記事です。ここでは、さまざまな`@builtin`コンピュートシェーダーの値をストレージバッファに出力しました。次に、それらの結果をマップ可能なバッファにコピーし、結果を読み取るためにマップしました。

## <a id="a-mapped-at-creation"></a>mappedAtCreation

`mappedAtCreation: true`は、バッファを作成するときに追加できるフラグです。この場合、バッファには`GPUBufferUsage.COPY_DST`も`GPUBufferUsage.MAP_WRITE`も使用法フラグは必要ありません。

これは、作成時にバッファにデータを入れるための特別なフラグです。バッファを作成するときに`mappedAtCreation: true`フラグを追加します。バッファは、書き込み用にすでにマップされた状態で作成されます。例：

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 const arrayBuffer = buffer.getMappedRange(0, buffer.size);
 const f32 = new Float32Array(arrayBuffer);
 f32.set([1, 2, 3, 4]);
 buffer.unmap();
```

または、より簡潔に

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 new Float32Array(buffer.getMappedRange(0, buffer.size)).set([1, 2, 3, 4]);
 buffer.unmap();
```

`mappedAtCreation: true`で作成されたバッファには、自動的にフラグが設定されないことに注意してください。これは、最初に作成するときにバッファにデータを入れるための便宜上のものです。作成時にマップされ、一度マップを解除すると、他のバッファと同様に動作し、指定した使用法に対してのみ機能します。つまり、後でコピーしたい場合は`GPUBufferUsage.COPY_DST`が必要であり、後でマップしたい場合は`GPUBufferData.MAP_READ`または`GPUBufferData.MAP_WRITE`が必要です。

## <a id="a-efficient"></a>マップ可能なバッファを効率的に使用する

上記で、バッファのマッピングが非同期であることがわかりました。つまり、`mapAsync`を呼び出してバッファのマッピングを要求してから、マップされて`getMappedRange`を呼び出すことができるようになるまで、不確定な時間がかかります。

これを回避する一般的な方法は、常にマップされたバッファのセットを保持することです。すでにマップされているため、すぐに使用できます。1つ使用してマップを解除し、バッファを使用するコマンドを送信したらすぐに、再度マップするように要求します。プロミスが解決されると、すでにマップされたバッファのプールに戻します。マップされたバッファが必要で、利用可能なものがない場合は、新しいものを作成してプールに追加します。