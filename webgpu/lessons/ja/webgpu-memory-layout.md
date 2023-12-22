Title: 構造体とメモリレイアウト
Description: WebGPUにおけるデータのレイアウトとデータの準備
TOC: 構造体とメモリレイアウト

WebGPUで扱うデータは、ほとんどの場合、シェーダで定義したデータ構造に合わせて
明示的にメモリレイアウトする必要があります。
このことは、JavaScriptやTypeScriptにおけるデータの扱いとは対照的です。
JavaScriptやTypeScriptのプログラミングでは、そういったことを意識する機会は滅多にありません。

シェーダはWGSLという言語で書きますが、WGSL言語のプログラミングでは、頻繁に`struct`(構造体)を定義します。
構造体というのは、JavaScriptで言えばオブジェクトと似た仕組みです。
WGSLの構造体では「メンバー変数」を定義しますが、
これはJavaScriptのオブジェクトでプロパティを定義するのに似ています。

JavaScriptでは、オブジェクトのプロパティの定義は名前を付けて終わりですが、
WGSLの構造体のメンバー変数の定義では名前のほかに、「変数のデータ型」を明示する必要があります。
また、シェーダ中の構造体に対してはバッファからデータを渡すことになりますが、
「バッファ上の、どこに、どういったデータを配置すれば、構造体の各メンバーに正しくデータが割り当てられるか」
は、**あなたの責任**となっています。

[WGSL](webgpu-wgsl.html) v1には、基本となる4種類のデータ型があります。

* `f32` (32ビット浮動小数点数型)
* `i32` (32ビット符号付き整数型)
* `u32` (32ビット符号なし整数型)
* `f16` (16ビット浮動小数点数型) [^f16-optional]

[^f16-optional]: `f16`のサポートは[オプション機能](webgpu-limits-and-features.html)となっている。

1バイトは8ビットなので、32ビット型データなら4バイト、16ビット型データなら2バイトです。

以下のような構造体の場合、

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

そのデータレイアウトを図示するとこのようになります。

<div class="webgpu_center" data-diagram="ourStructV1"></div>

図中の各四角ブロックは1バイトを表しています。
上の図の通り、この構造体全体は12バイトとなります。
12バイトの、最初の4バイトは`velocity`に、次の4バイトは`acceleration`に、
最後の4バイトは`frameCount`に使用されます。

この構造体`OurStruct`にデータを渡すためには、
渡すデータの方を構造体に合わせたメモリレイアウトにする必要があります。
実際にやってみましょう。

まず`ArrayBuffer`を12バイトのサイズで生成します。
`ArrayBuffer`に実際のデータを書き込む際には、各種の`TypedArray`(型付き配列)ビューを利用します。

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

上のコードで、`ourStructData`は`ArrayBuffer`のオブジェクトです。これはメモリチャンク、つまりは、バイト列です。
この「バイト列」を、３つの「数値」として扱うために、「ビュー(view)」を作成しています。

`ourStructValuesAsF32`は、メモリの中身を「32ビット浮動小数点数値として扱う」ためのビューです。

`ourStructValuesAsU32`は、メモリの中身を「32ビット符号なし整数値として扱う」ためのビューです。

これらのビューは**同じメモリを見ている**、という点に注意してください。

ここまでで、バッファ１つ、そのバッファに対するビューを２つ、用意しました。
これを利用して、バッファに、構造体の各メンバーのデータ型に合わせた数値データをセットできます。

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // これは整数値
```

以上で、「12バイトのバッファ」に「３つの数値」を適切に配置することができました。

さて、プログラミングでは、同じことをやるために色々な書き方ができます。
`Float32Array`のような`TypeArray`(型付き配列)には、以下のようなコンストラクタがあります。

* `new Float32Array(12)`

   このやり方では、引数に「配列要素数」を指定しています。この例ではまず48バイト(`Float32Array(12)`に合わせて48=12*4バイト)の`ArrayBuffer`が、「新たに」生成されます。そしてその`ArrayBuffer`を`Float32Array`として扱うためのビューが作られます。

* `new Float32Array([4, 5, 6])`

   このやり方では、引数に「配列要素」を直接与えています。この例ではまず12バイト(32bit floatの配列要素が３つと解釈されるので12=4*3バイト)の`ArrayBuffer`が「新たに」生成されます。そしてその`ArrayBuffer`を`Float32Array`として扱うためのビューが作られます。そして、そこに初期値として、4、5、6という数値データが書き込まれます。

   引数として「`TypedArray`」を与えるやり方もあります。たとえば、

   `new Float32Array(someUint8ArrayOf6Values)`と書いた場合(someUint8ArrayOf6Valuesは
   「6要素の、Uint8Arrayデータ」とします)、24バイト(各要素のサイズは、元データは8bitだが生成されるビューの側が32bitなので6要素*32bit=192bit=24バイト)の`ArrayBuffer`が「新たに」生成されます。そしてその`ArrayBuffer`を`Float32Array`として扱うためのビューが作られます。そして、そこに初期値として元のビュー`someUint8ArrayOf6Values`の各要素の値が`Float32Array`へとコピーされます。値のコピーは、バイナリデータとしてではなく数値として解釈されます。下のコードの様な意味です。

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

* `new Float32Array(someArrayBuffer)`

   このやり方では、引数に既存の「`ArrayBuffer`」を与えています。記事の上の方で書いたサンプルプログラムのやり方はこの形です。`Float32Array`は「**既存のバッファ**」に対するビューとなり、新たに`ArrayBuffer`が生成されることはありません。

* `new Float32Array(someArrayBuffer, byteOffset)`

   このやり方では、引数として、既存の`ArrayBuffer`と「オフセット値」を与えています。`Float32Array`は「**既存のバッファ**の先頭を`byteOffset`と見なした範囲」に対するビューとなります。また、新たに`ArrayBuffer`が生成されることはありません。

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   このやり方では、引数として、既存の`ArrayBuffer`と「オフセット値」と「length」を与えています。
   `Float32Array`は「**既存のバッファ**の、先頭を`byteOffset`、要素数を`length`と見なした範囲」に対するビューとなります。要素数なので、lengthが3であればfloat32要素が3つとなるので12バイトに相当します。また、新たに`ArrayBuffer`が生成されることはありません。

先ほどのコードを、最後のやり方で書き直すなら、このように書けます。

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

`TypedArray`についてもう少し説明します。
すべての`TypedArray`には以下のプロパティがあります。

* `length`: 要素数
* `byteLength`: 全体のバイト数
* `byteOffset`: `TypeArray`が見ている`ArrayBuffer`のオフセット値
* `buffer`: `TypeArray`が見ている`ArrayBuffer`

また、`TypeArray`には各種のメソッドがあります。
`TypeArray`の持つメソッドの多くは、JavaScriptの`Array`オブジェクトが持つメソッドと似ていますが、
独特なものとして`subarray`メソッドがあります。
`subarray`メソッドは元のビューと同じ型の`TypedArray`ビューを生成します。
引数は`subarray(begin, end)`となっていますが、`end`番要素は含まれません。
例えば`someTypedArray.subarray(5, 10)`と書いた場合、
「元のビューが見ている`ArrayBuffer`と**同じ`ArrayBuffer`** を、
someTypedArrayとして5番目から9番目の要素の部分だけを見るためのビューを生成する」、
といった意味になります。

先ほどのコードは、こんな風に書き替えることもできます。

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

[WGSL](webgpu-wgsl.html)には最初に書いた4種の基本型を基にしたデータ型が多数あります。
これを列挙してみます。

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>type</th><th>description</th><th>short name</th><tr>
    </thead>
    <tbody>
      <tr><td><code>vec2&lt;f32&gt;</code></td><td>a type with 2  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td><td>a type with 2  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td><td>a type with 2  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td><td>a type with 2  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td><td>a type with 3  <code>f32</code>s</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td><td>a type with 3  <code>u32</code>s</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td><td>a type with 3  <code>i32</code>s</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td><td>a type with 3  <code>f16</code>s</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td><td>a type with 4  <code>f32</code>s</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td><td>a type with 4  <code>u32</code>s</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td><td>a type with 4  <code>i32</code>s</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td><td>a type with 4  <code>f16</code>s</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x3u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x3i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x4u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x4i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat3x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat3x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat3x3u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat3x3i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat3x4u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat3x4i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat4x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat4x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat4x3u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat4x3i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat4x4u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat4x4i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

ここで、問題です。

「`vec3f`は、`f32`要素を3つ持つ型です。また、`mat4x4f`は、各要素が`f32`となっている4x4行列、つまり`f32`要素を16個持つ型です。
以下のような構造体を定義したとき、メモリレイアウトがどうなるか答えなさい。」

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

さて正解は！？

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

予想と違いましたか？
上の図は、「各データ型にはアラインメント(alignment)要件がある」、ということを示してます。
各データの開始バイトは、メモリ上では「各変数の型に対応した特定のバイト数の倍数」に整列(align)する必要があります。

次の表は、各種のデータ型のサイズとアラインメントの一覧です。

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

さらに！もう少し話は続きます。

以下の構造体のレイアウトはどうなると思いますか？

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

`array<type, count>`というのは、「データ型が`type`、要素数が`count`の配列」です。

正解は、このようになります。

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

アラインメントの表を見ると、`vec3<f32>`のalignの値は16となっています。
このため、`vec3<f32>`中の12バイトデータはすべて16バイト単位に整列されます。
これは、「各`vec3<f32>`の開始バイト」は、「offsetが0や16の倍数の位置」にしか置けない、ということです。
数が合わない場合は、必要に応じて、バッファには空白(padding。図中では"-pad-")が配置されます。
このルールは、`vec3<f32>`のデータが「行列の要素」であっても「配列の要素」であっても同様です。　

次の例を見てみましょう。

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

`size`は、直前の`vec3f`型データ`orientation`のすぐ後ろ、オフセット12バイト目の部分にうまくはまっています。
一方で、`scale`や`friction`はうまくはまらず、パディングを挟んで、それぞれオフセット32、64のところに飛び出して配置されています。
この違いは何でしょう。

これは、配列や構造体には、基本型とはまた別の、特別なアラインメントのルールがあるためです。
配列や構造体は、この例の`direction`のような「要素数がひとつだけの配列」であっても、
`Ex4a`のような「要素が`vec3f`ひとつだけの構造体」であっても、
配列や構造体の独自の、アラインメントのルールに従います。

# オフセットとサイズの計算は頭痛の元！

WGSL中のデータのサイズとオフセットの計算は、WebGPUの扱いにおいて、恐らくは最大の難所と言えるでしょう。
これらの計算は自分でやる必要があります。
シェーダ中の構造体のデータ構造に変更があれば、メモリレイアウトがどう変わるのか再考して、
JavaScript側でオフセット値を書き換えて、つじつまを合わせる必要があります。
変更が構造体の中ほどのデータだった場合、それ以降のすべてのメンバのオフセット値を再計算する必要があります。

どこかで１バイトでも間違えれば、シェーダには誤ったデータが送られることになります。
シェーダはエラーメッセージを返すでもなく、ただ黙々と間違った結果を出力します。
シェーダの入力データが間違っているからです。
3Dモデルが表示されなかったり、計算結果が間違ったり、といったことが起きます。

幸い、こういった作業を手助けするライブラリが存在しています。

例えば「[webgpu-utils](https://github.com/greggman/webgpu-utils)」です。

このライブラリにWGSLコードを与えると、すべてをあなたの替わりにやってくれるAPIを返してくれます。
構造体の変更をしても、これを使えばたいていの場合、コードはうまく動くはずです。

今回のサンプルプログラムで実際に`webgpu-utils`を使ってみる場合、以下のようなコードになるでしょう。

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

// Set some values via set
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

// now pass myUniformValues.arrayBuffer to WebGPU when needed.
```

このライブラリを使うか、別のライブラリを使うか、何も使わず自力でやるかは、あなたの判断です。
ただ、筆者の場合、実際の場面でどこが間違ったか調べて、オフセットとサイズを手計算するだけのために、
20分、30分……いや60分？頭を抱えるという経験を、何度もしています。
私にとっては、このライブラリはよく効く頭痛薬です。

ライブラリでなく、半手動で計算したい人のために、
「[オフセット計算機](resources/wgsl-offset-computer.html)」も用意しました。

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
