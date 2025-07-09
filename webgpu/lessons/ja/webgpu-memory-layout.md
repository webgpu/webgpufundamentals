Title: WebGPU データメモリレイアウト
Description: WebGPU用のデータのレイアウトと準備方法
TOC: データメモリレイアウト

WebGPUでは、提供するデータのほとんどすべてを、シェーダーで定義したものと一致するようにメモリにレイアウトする必要があります。これは、メモリレイアウトの問題がめったに発生しないJavaScriptやTypeScriptとは大きな対照です。

WGSLでシェーダーを作成する場合、`struct`を定義するのが一般的です。構造体はJavaScriptオブジェクトのようなもので、JavaScriptオブジェクトのプロパティと同様に、構造体のメンバーを宣言します。しかし、各プロパティに名前を付けるだけでなく、型も指定する必要があります。**そして**、データを提供するとき、構造体の特定のメンバーがバッファのどこに表示されるかを計算するのは**あなた次第**です。

[WGSL](webgpu-wgsl.html) v1には、4つの基本型があります。

* `f32`（32ビット浮動小数点数）
* `i32`（32ビット整数）
* `u32`（32ビット符号なし整数）
* `f16`（16ビット浮動小数点数）[^f16-optional]

[^f16-optional]: `f16`のサポートは[オプション機能](webgpu-limits-and-features.html)です。

1バイトは8ビットなので、32ビット値は4バイト、16ビット値は2バイトかかります。

次のような構造体を宣言した場合、

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

その構造体の視覚的な表現は次のようになります。

<div class="webgpu_center" data-diagram="ourStructV1"></div>

各正方形のブロックは1バイトです。上記では、データが12バイトかかることがわかります。`velocity`は最初の4バイト、`acceleration`は次の4バイト、`frameCount`は最後の4バイトを占めます。

シェーダーにデータを渡すには、`OurStruct`のメモリレイアウトに一致するようにデータを準備する必要があります。そのためには、12バイトの`ArrayBuffer`を作成し、それを埋めることができるように正しい型の`TypedArray`ビューを設定する必要があります。

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

上記では、`ourStructData`はメモリのチャンクである`ArrayBuffer`です。このメモリの内容を見るには、そのビューを作成できます。`ourStructValuesAsF32`は、メモリを32ビット浮動小数点値として表示するビューです。`ourStructValuesAsU32`は、**同じメモリ**を32ビット符号なし整数値として表示するビューです。

バッファと2つのビューができたので、構造体にデータを設定できます。

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // 整数値
```

## <a id="a-typed-arrays"></a> `TypedArrays`

プログラミングの多くのことと同様に、`OutStruct`のデータを設定する方法は複数あります。`TypedArray`には、さまざまな形式を取るコンストラクタがあります。たとえば、

* `new Float32Array(12)`

   このバージョンは、**新しい**`ArrayBuffer`を作成します。この場合は12 * 4バイトです。次に、それを表示するための`Float32Array`を作成します。

* `new Float32Array([4, 5, 6])`

   このバージョンは、**新しい**`ArrayBuffer`を作成します。この場合は3 * 4バイトです。次に、それを表示するための`Float32Array`を作成します。そして、初期値を4、5、6に設定します。

   別の`TypedArray`を渡すこともできます。たとえば、

   `new Float32Array(someUint8ArrayOf6Values)`は、サイズ6 * 4の**新しい**`ArrayBuffer`を作成し、それを表示するための`Float32Array`を作成し、既存のビューから新しい`Float32Array`に値をコピーします。値はバイナリではなく数値でコピーされます。つまり、次のようにコピーされます。

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

   「値でコピー」とはどういう意味ですか？この例を見てみましょう。

   ```js
   const f32s = new Float32Array([0.8, 0.9, 1.0, 1.1, 1.2]);
   const u32s = new Uint32Array(f32s); 
   console.log(u32s);   // 0, 0, 1, 1, 1を生成します
   ```

   その理由は、0.8や1.2のような値を`Uint32Array`に入れることができないためです。それらは符号なし整数に変換されます。

* `new Float32Array(someArrayBuffer)`

   これは、前に使用したケースです。**既存のバッファ**に新しい`Float32Array`ビューが作成されます。

* `new Float32Array(someArrayBuffer, byteOffset)`

   これにより、**既存のバッファ**に新しい`Float32Array`が作成されますが、ビューは`byteOffset`から始まります。

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   これにより、**既存のバッファ**に新しい`Float32Array`が作成されます。ビューは`byteOffset`から始まり、長さは`length`単位です。したがって、長さに3を渡した場合、ビューは`someArrayBuffer`の3つのfloat32値の長さ（12バイト）になります。

この最後の形式を使用して、上記のコードを次のように変更できます。

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const velocityView = new Float32Array(ourStructData, 0, 1);
const accelerationView = new Float32Array(ourStructData, 4, 1);
const frameCountView = new Uint32Array(ourStructData, 8, 1);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

さらに、すべての`TypedArray`には次のプロパティがあります。

* `length`: 単位数
* `byteLength`: バイト単位のサイズ
* `byteOffset`: `TypedArray`の`ArrayBuffer`内のオフセット
* `buffer`: この`TypedArray`が表示している`ArrayBuffer`

そして、`TypedArray`にはさまざまなメソッドがあり、多くは`Array`に似ていますが、そうでないものの1つが`subarray`です。同じ型の新しい`TypedArray`ビューを作成します。そのパラメータは`subarray(begin, end)`であり、`end`は含まれません。したがって、`someTypedArray.subarray(5, 10)`は、`someTypedArray`の要素5から9の**同じ`ArrayBuffer`**の新しい`TypedArray`を作成します。

したがって、上記のコードを次のように変更できます。

```js
const kOurStructSizeFloat32Units =
  1 + // velocity
  1 + // acceleration
  1 ; // frameCount
const ourStructDataAsF32 = new Float32Array(kOurStructSizeFloat32Units);
const ourStructDataAsU32 = new Uint32Array(ourStructDataAsF32.buffer);
const velocityView = ourStructDataAsF32.subarray(0, 1);
const accelerationView = ourStructDataAsF32.subarray(1, 2);
const frameCountView = ourStructDataAsU32.subarray(2, 3);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

## 同じ`ArrayBuffer`の複数のビュー

**同じarrayBuffer**のビューを持つことは、まさにそのことを意味します。たとえば、

```js
const v1 = new Float32Array(5);
const v2 = v1.subarray(3, 5);  // v1の最後の2つの浮動小数点数を表示します
v2[0] = 123;
v2[1] = 456;
console.log(v1);  // 0, 0, 0, 123, 456を表示します
```

同様に、異なる型付きビューがある場合

```js
const f32 = new Float32Array([1, 1000, -1000])
const u32 = new Uint32Array(f32.buffer);

console.log(Array.from(u32).map(v => v.toString(16).padStart(8, '0')));
// '3f800000', '447a0000', 'c47a0000' を表示します
```

上記の数値は、1、1000、-1000の浮動小数点値の32ビット16進表現です。

例：16バイトの`ArrayBuffer`を作成しましょう。次に、同じメモリの異なる`TypedArray`ビューを作成します。

```js
const arrayBuffer = new ArrayBuffer(16);
const asInt8      = new Int8Array(arrayBuffer);
const asUint8     = new Uint8Array(arrayBuffer);
const asInt16     = new Int16Array(arrayBuffer);
const asUint16    = new Uint16Array(arrayBuffer);
const asInt32     = new Int32Array(arrayBuffer);
const asUint32    = new Uint32Array(arrayBuffer);
const asFloat32   = new Float32Array(arrayBuffer);
const asFloat64   = new Float64Array(arrayBuffer);
const asBigInt64  = new BigInt64Array(arrayBuffer);
const asBigUint64 = new BigInt64Array(arrayBuffer);

// 開始する値をいくつか設定します。
asFloat32.set([123, -456, 7.8, -0.123]);
```

これは、同じメモリを表示するすべてのビューの表現です。以下で、いずれかの数値を編集すると、同じメモリを使用している対応する値が変更されます。

<div data-diagram="typedArrays" data-caption="整数を16進数で表示"></div>

## `map`の問題

`TypedArray`の`map`関数は、同じ型の新しい型付き配列を作成することに注意してください。

```js
const f32a = new Float32Array(1, 2, 3);
const f32b = f32a.map(v => v * 2);                    // OK
const f32c = f32a.map(v => `${v} doubled = ${v *2}`); // BAD!
                    //  Float32Arrayに文字列を入れることはできません
```

型付き配列を他の型にマップする必要がある場合は、自分で配列をループするか、`Array.from`を使用してJavaScript配列に変換する必要があります。上記の例を挙げると、

```js
const f32d = Array.from(f32a).map(v => `${v} doubled = ${v *2}`); // OK
```

## vecおよびmat型

[WGSL](webgpu-wgsl.html)には、4つの基本型から作成された型があります。それらは次のとおりです。

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>型</th><th>説明</th><th>短い名前</th><tr>
    </thead>
    <tbody>
      <tr><td><code>vec2&lt;f32&gt;</code></td><td>2つの<code>f32</code>を持つ型</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td><td>2つの<code>u32</code>を持つ型</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td><td>2つの<code>i32</code>を持つ型</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td><td>2つの<code>f16</code>を持つ型</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td><td>3つの<code>f32</code>を持つ型</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td><td>3つの<code>u32</code>を持つ型</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td><td>3つの<code>i32</code>を持つ型</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td><td>3つの<code>f16</code>を持つ型</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td><td>4つの<code>f32</code>を持つ型</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td><td>4つの<code>u32</code>を持つ型</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td><td>4つの<code>i32</code>を持つ型</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td><td>4つの<code>f16</code>を持つ型</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td><td>2つの<code>vec2&lt;f32&gt;</code>の行列</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td><td>2つの<code>vec2&lt;u32&gt;</code>の行列</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td><td>2つの<code>vec2&lt;i32&gt;</code>の行列</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td><td>2つの<code>vec2&lt;f16&gt;</code>の行列</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td><td>2つの<code>vec3&lt;f32&gt;</code>の行列</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td><td>2つの<code>vec3&lt;u32&gt;</code>の行列</td><td><code>mat2x3u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td><td>2つの<code>vec3&lt;i32&gt;</code>の行列</td><td><code>mat2x3i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td><td>2つの<code>vec3&lt;f16&gt;</code>の行列</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td><td>2つの<code>vec4&lt;f32&gt;</code>の行列</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td><td>2つの<code>vec4&lt;u32&gt;</code>の行列</td><td><code>mat2x4u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td><td>2つの<code>vec4&lt;i32&gt;</code>の行列</td><td><code>mat2x4i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td><td>2つの<code>vec4&lt;f16&gt;</code>の行列</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td><td>3つの<code>vec2&lt;f32&gt;</code>の行列</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td><td>3つの<code>vec2&lt;u32&gt;</code>の行列</td><td><code>mat3x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td><td>3つの<code>vec2&lt;i32&gt;</code>の行列</td><td><code>mat3x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td><td>3つの<code>vec2&lt;f16&gt;</code>の行列</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td><td>3つの<code>vec3&lt;f32&gt;</code>の行列</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td><td>3つの<code>vec3&lt;u32&gt;</code>の行列</td><td><code>mat3x3u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td><td>3つの<code>vec3&lt;i32&gt;</code>の行列</td><td><code>mat3x3i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td><td>3つの<code>vec3&lt;f16&gt;</code>の行列</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td><td>3つの<code>vec4&lt;f32&gt;</code>の行列</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td><td>3つの<code>vec4&lt;u32&gt;</code>の行列</td><td><code>mat3x4u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td><td>3つの<code>vec4&lt;i32&gt;</code>の行列</td><td><code>mat3x4i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td><td>3つの<code>vec4&lt;f16&gt;</code>の行列</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td><td>4つの<code>vec2&lt;f32&gt;</code>の行列</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td><td>4つの<code>vec2&lt;u32&gt;</code>の行列</td><td><code>mat4x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td><td>4つの<code>vec2&lt;i32&gt;</code>の行列</td><td><code>mat4x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td><td>4つの<code>vec2&lt;f16&gt;</code>の行列</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td><td>4つの<code>vec3&lt;f32&gt;</code>の行列</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td><td>4つの<code>vec3&lt;u32&gt;</code>の行列</td><td><code>mat4x3u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td><td>4つの<code>vec3&lt;i32&gt;</code>の行列</td><td><code>mat4x3i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td><td>4つの<code>vec3&lt;f16&gt;</code>の行列</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td><td>4つの<code>vec4&lt;f32&gt;</code>の行列</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td><td>4つの<code>vec4&lt;u32&gt;</code>の行列</td><td><code>mat4x4u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td><td>4つの<code>vec4&lt;i32&gt;</code>の行列</td><td><code>mat4x4i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td><td>4つの<code>vec4&lt;f16&gt;</code>の行列</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

`vec3f`は3つの`f32`を持つ型であり、`mat4x4f`は`f32`の4x4行列なので、16個の`f32`であるとすると、次の構造体はメモリ内でどのように見えると思いますか？

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

準備はいいですか？

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

どうしたのでしょうか？すべての型にはアライメント要件があることがわかります。特定の型の場合、特定のバイト数の倍数にアライメントする必要があります。

さまざまな型のサイズとアライメントを次に示します。

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

しかし、待ってください、もっとあります！

この構造体のレイアウトはどうなると思いますか？

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

`array<type, count>`構文は、`count`個の要素を持つ`type`の配列を定義します。

どうぞ...

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

アライメントテーブルを見ると、`vec3<f32>`のアライメントが16バイトであることがわかります。つまり、行列または配列内の各`vec3<f32>`には、余分なスペースがあります。

もう1つあります。

```wgsl
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
```

<div class="webgpu_center" data-diagram="ourStructEx4"></div>

なぜ`size`は方向の直後のバイトオフセット12で終わり、`scale`と`friction`はオフセット32と64にバンプされたのでしょうか。

これは、配列と構造体には独自の特別なアライメントルールがあるためです。配列が単一の`vec3f`であり、`Ex4a`構造体も単一の`vec3f`であっても、異なるルールに従ってアライメントされます。

<a id="a-struct-array-size-alignment"></a>
<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>型</th><th>アライメント</th><th>サイズ</th><tr>
    </thead>
    <tbody>
      <tr><td><code>struct</code> SとメンバーM<sub>1</sub>...M<sub>N</sub></td><td>max(AlignOfMember(S,1), ... , AlignOfMember(S,N))</td><td>roundUp(AlignOf(S), justPastLastMember)

ここで、justPastLastMember = OffsetOfMember(S,N) + SizeOfMember(S,N)</td></tr>
      <tr><td><code>array&lt;E, N&gt;</code></td><td>AlignOf(E)</td><td>N × roundUp(AlignOf(E), SizeOf(E))</td></tr>
    </tbody>
  </table>
  </div>
</div>

[WGSL仕様のこちら](https://www.w3.org/TR/WGSL/#alignment-and-size)で、ルールをより詳しく読むことができます。

# オフセットとサイズの計算は面倒です！

WGSLでのデータのサイズとオフセットの計算は、おそらくWebGPUの最大の難点です。これらのオフセットを自分で計算し、最新の状態に保つ必要があります。シェーダーの構造体の途中にメンバーを追加した場合、JavaScriptに戻ってすべてのオフセットを更新する必要があります。1バイトまたは長さを間違えると、シェーダーに渡すデータが間違ってしまいます。エラーは発生しませんが、シェーダーは不正なデータを見ているため、おそらく間違ったことを行います。モデルが描画されないか、計算で不正な結果が生成されます。

幸いなことに、これを支援するライブラリがあります。

これはその1つです：[webgpu-utils](https://github.com/greggman/webgpu-utils)

WGSLコードを渡すと、これらすべてを行うためのAPIが提供されます。これにより、構造体を変更しても、ほとんどの場合、物事はうまくいくでしょう。

たとえば、最後の例を使用して、次のように`webgpu-utils`に渡すことができます。

```
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'https://greggman.github.io/webgpu-utils/dist/0.x/webgpu-utils-1.x.module.js';

const code = `
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
@group(0) @binding(0) var<uniform> myUniforms: Ex4;

...
`;

const defs = makeShaderDataDefinitions(code);
const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);

// set経由でいくつかの値を設定します
myUniformValues.set({
  orientation: [1, 0, -1],
  size: 2,
  direction: [0, 1, 0],
  scale: 1.5,
  info: {
    velocity: [2, 3, 4],
  },
  friction: 0.1,
});

// 必要に応じてmyUniformValues.arrayBufferをWebGPUに渡します。
```

この特定のライブラリを使用するか、別のライブラリを使用するか、まったく使用しないかはあなた次第です。私の場合、何かが機能しない理由を突き止めようとして20〜30〜60分を費やすことがよくありましたが、オフセットまたはサイズを手動で間違って計算したことが原因であることがわかりました。そのため、自分の作業では、ライブラリを使用してその苦痛を避けたいと思います。

ただし、手動で行いたい場合は、[オフセットを計算してくれるページ](resources/wgsl-offset-computer.html)があります。

それ以外の場合は、webgpuを抽象化し、これらのようなものを簡単にするのに役立つ多くのライブラリがあります。[こちら](webgpu-resources.html)でリストを見つけることができます。

<!-- この記事の最後にこれを保持してください -->
<link rel="stylesheet" href="webgpu-memory-layout.css">
<script type="module" src="webgpu-memory-layout.js"></script>