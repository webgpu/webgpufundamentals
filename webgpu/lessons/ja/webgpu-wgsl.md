Title: WebGPU WGSL
Description: WebGPUシェーディング言語の紹介
TOC: WGSL

WGSLの詳細な概要については、[WGSLツアー](https://google.github.io/tour-of-wgsl/)を参照してください。また、[実際のWGSL仕様](https://www.w3.org/TR/WGSL/)もありますが、[言語弁護士](http://catb.org/jargon/html/L/language-lawyer.html)向けに書かれているため、処理が難しい場合があります😂

この記事は、すでにプログラミングの方法を知っていることを前提としているため、WGSLの例を見るだけで、何が表示されているかを*理解*できる可能性が高いです。おそらく簡潔すぎますが、WGSLシェーダープログラムの理解と作成に役立つことを願っています。

## WGSLは厳密に型付けされています

JavaScriptとは異なり、WGSLでは、すべての変数、構造体フィールド、関数パラメータ、および関数戻り値の型を知る必要があります。typescript、rust、C++、C#、Java、Swift、Kotlinなどを使用したことがある場合は、これに慣れています。

### プレーン型

WGSLの*プレーン*型は次のとおりです。

* `i32` 32ビット符号付き整数
* `u32` 32ビット符号なし整数
* `f32` 32ビット浮動小数点数
* `bool` ブール値
* `f16` 16ビット浮動小数点数（これは、確認して要求する必要があるオプション機能です）

### 変数宣言

JavaScriptでは、次のように変数と関数を宣言できます。

```js
var a = 1;
let c = 3;
function d(e) { return e * 2; }
```

WGSLでは、それらの完全な形式は次のようになります。

```wgsl
var a: f32 = 1;
let c: f32 = 3;
fn d(e: f32) -> f32 { return e * 2; }
```

上記から注意すべき重要な点は、変数宣言に`: f32`のような`: <type>`を追加し、関数宣言に`-> <type>`を追加する必要があることです。

### 自動型

WGSLには、変数の*ショートカット*があります。typescriptと同様に、変数の型を宣言しない場合、右側の式の型に自動的になります。

```wgsl
fn foo() -> bool { return false; }

var a = 1;     // aはi32です
let b = 2.0;   // bはf32です
var c = 3u;    // cはu32です
var d = foo(); // dはboolです
```

### 型変換

さらに、厳密に型付けされているということは、多くの場合、型を変換する必要があることを意味します。

```wgsl
let a = 1;     // aはi32です
let b = 2.0;   // bはf32です
*let c = a + b; // エラー：i32をf32に追加できません
```

修正は、一方を他方に変換することです。

```wgsl
let a = 1;     // aはi32です
let b = 2.0;   // bはf32です
let c = f32(a) + b; // ok
```

しかし、WGSLには「AbstractInt」と「AbstractFloat」と呼ばれるものがあります。これらは、まだ型が決定されていない数値と考えることができます。これらはコンパイル時のみの機能です。

```wgsl
let a = 1;            // aはi32です
let b = 2.0;          // bはf32です
*let c = a + b;       // エラー：i32をf32に追加できません
let d = 1 + 2.0;      // dはf32です
```

### 数値サフィックス

```
2i   // i32
3u   // u32
4f   // f32
4.5f // f32
5h   // f16
5.6h // f16
6    // AbstractInt
7.0  // AbstractFloat
```

## `let`、`var`、`const`は、WGSLとJavaScriptで意味が異なります。

JavaScriptでは、`var`は関数スコープを持つ変数です。`let`はブロックスコープを持つ変数です。`const`は、ブロックスコープを持つ定数変数（変更不可）です[^references]。

[^references]: JavaScriptの変数は、`undefined`、`null`、`boolean`、`number`、`string`、`reference-to-object`の基本型を保持します。プログラミングに慣れていない人にとって、`const o = {name: 'foo'}; o.name = 'bar';`が機能するのは、`o`が`const`として宣言されているため、混乱する可能性があります。重要なのは、`o`が定数であるということです。これは、オブジェクトへの定数参照です。`o`が参照するオブジェクトを変更することはできません。オブジェクト自体を変更することはできます。

WGSLでは、すべての変数はブロックスコープを持ちます。`var`はストレージを持つ変数であり、したがって変更可能です。`let`は定数値です。

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // エラー：aは定数式です
  var b = 2;
  b = b + 1;  // ok
}
```

`const`は変数ではなく、コンパイル時の定数です。実行時に発生するものに`const`を使用することはできません。

```wgsl
const one = 1;              // ok
const two = one * 2;        // ok
const PI = radians(180.0);  // ok

fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // エラー：constはコンパイル時式でのみ使用できます
  return result;
}
```

## ベクトル型

WGSLには、`vec2`、`vec3`、`vec4`の3つのベクトル型があります。基本的なスタイルは`vec?<type>`なので、`vec2<i32>`（2つのi32のベクトル）、`vec3<f32>`（3つのf32のベクトル）、`vec4<u32>`（4つのu32のベクトル）、`vec3<bool>`（3つのブール値のベクトル）です。

例：

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10, 11, 12);
```

### アクセサー

さまざまなアクセサーを使用して、ベクトル内の値にアクセスできます。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.z;   // x、y、z、w経由
let c = a.b;   // r、g、b、a経由
let d = a[2];  // 配列要素アクセサー経由
```

上記では、`b`、`c`、`d`はすべて同じです。それらはすべて`a`の3番目の要素にアクセスしています。それらはすべて「3」です。

### スウィズル

複数の要素にアクセスすることもできます。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.zx;   // x、y、z、w経由
let c = a.br;   // r、g、b、a経由
let d = vec2<f32>(a[2], a[0]);
```

上記では、`b`、`c`、`d`はすべて同じです。それらはすべて`vec2<f32>(3, 1)`です。

要素を繰り返すこともできます。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec3<f32>(a.z, a.z, a.y);
let c = a.zzy;
```

上記では、`b`と`c`は同じです。どちらも、内容が3、3、2の`vec3<f32>`です。

### ベクトルのショートカット

基本型にはショートカットがあります。`<i32>`を`i`に、`<f32>`を`f`に、`<u32>`を`u`に、`<f16>`を`h`に変更します。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a`と`b`は同じ型です。

### ベクトル構築

ベクトルは、より小さな型で構築できます。

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
let d = vec4f(1, a.yz, 4);
let e = vec4f(a.xyz, 4);
let f = vec4f(1, a.yzw);
```

`a`、`c`、`d`、`e`、`f`は同じです。

### ベクトル演算

ベクトルで数学を行うことができます。

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // cはvec4f(6, 8, 10, 12)です
let d = a * b;  // dはvec4f(5, 12, 21, 32)です
let e = a - b;  // eはvec4f(-4, -4, -4, -4)です
```

多くの関数はベクトルでも機能します。

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);                   // cはvec4f(3, 4, 5, 6)です
let d = mix(a, b, vec4f(0, 0.5, 0.5, 1)); // dはvec4f(1, 4, 5, 8)です
```

## 行列

WGSLには多数の行列型があります。行列はベクトルの配列です。形式は`mat<numVectors>x<vectorSize><<type>>`なので、たとえば`mat3x4<f32>`は3つの`vec4<f32>`の配列です。ベクトルと同様に、行列にも同じショートカットがあります。

```wgsl
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a`と`b`は同じ型です。

### 行列ベクトルアクセス

配列構文を使用して、行列のベクトルを参照できます。

```wgsl
let a = mat4x4f(...);
let b = a[2];   // bはaの3番目のベクトルのvec4fです
```

3D計算で最も一般的な行列型は`mat4x4f`であり、`vec4f`と直接乗算して別の`vec4f`を生成できます。

```wgsl
let a = mat4x4f(....);
let b = vec4f(1, 2, 3, 4);
let c = a * b;  // cはvec4fであり、a * bの結果です
```

## 配列

WGSLの配列は、`array<type, numElements>`構文で宣言されます。

```wgsl
let a = array<f32, 5>;   // 5つのf32の配列
let b = array<vec4f, 6>; // 6つのvec4fの配列
```

しかし、`array`コンストラクタもあります。任意の数の引数を受け取り、配列を返します。引数はすべて同じ型でなければなりません。

```wgsl;
let arrOf3Vec3fsA = array(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
let arrOf3Vec3fsB = array<vec3f, 3>(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
```

上記では、`arrOf3Vec3fsA`は`arrOf3Vec3fsB`と同じです。

残念ながら、WGSLのバージョン1の時点では、固定サイズの配列のサイズを取得する方法はありません。

### ランタイムサイズの配列

ルートスコープのストレージ宣言にある配列、またはルートスコープ構造体の最後のフィールドとしてある配列は、サイズなしで指定できる唯一の配列です。

```wgsl
struct Stuff {
  color: vec4f,
  size: f32,
  verts: array<vec3f>,
};
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;
```

`foo`と`bar.verts`の要素数は、実行時に使用されるバインドグループの設定によって定義されます。WGSLで`arrayLength`を使用してこのサイズを照会できます。

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;

...
  let numMatrices = arrayLength(&foo);
  let numVerts = arrayLength(&bar.verts);
```

## 関数

WGSLの関数は、`fn name(parameters) -> returnType { ..body... }`のパターンに従います。

```wgsl
fn add(a: f32, b: f32) -> f32 {
  return a + b;
}
```

## エントリポイント

WGSLプログラムにはエントリポイントが必要です。エントリポイントは、`@vertex`、`@fragment`、または`@compute`のいずれかで指定されます。

```wgsl
@vertex fn myFunc(a: f32, b: f32) -> @builtin(position): vec4f {
  return vec4f(0, 0, 0, 0);
}
```

## シェーダーは、エントリポイントがアクセスするもののみを使用します。

```wgsl
@group(0) @binding(0) var<uniforms> uni: vec4f;

vec4f fn foo() {
  return uni;
}

@vertex fn vs1(): @builtin(position) vec4f {
  return vec4f(0);
}

@vertex fn vs2(): @builtin(position) vec4f {
  return foo();
}
```

上記では、`uni`は`vs1`によってアクセスされないため、パイプラインで`vs1`を使用する場合、必須のバインディングとして表示されません。`vs2`は、`foo`を呼び出すことによって間接的に`uni`を参照するため、パイプラインで`vs2`を使用する場合、必須のバインディングとして表示されます。

## 属性

*属性*という言葉は、WebGPUで2つの意味を持ちます。1つは、[頂点バッファに関する記事](webgpu-vertex-buffers.html)で説明されている*頂点属性*です。もう1つは、`@`で始まるWGSLの属性です。

### `@location(number)`

`@location(number)`は、シェーダーの入力と出力を定義するために使用されます。

#### 頂点シェーダーの入力

頂点シェーダーの場合、入力は頂点シェーダーのエントリポイント関数の`@location`属性によって定義されます。

```wgsl
@vertex vs1(@location(0) foo: f32, @location(1) bar: vec4f) ...

struct Stuff {
  @location(0) foo: f32,
  @location(1) bar: vec4f,
};
@vertex vs2(s: Stuff) ...
```

`vs1`と`vs2`の両方が、[頂点バッファ](webgpu-vertex-buffers.html)によって供給される必要がある場所0と1の頂点シェーダーへの入力を宣言します。

#### ステージ間変数

ステージ間変数の場合、`@location`属性は、変数がシェーダー間で渡される場所を定義します。

```wgsl
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) texcoords: vec2f,
};

struct FSIn {
  @location(1) uv: vec2f,
  @location(0) diffuse: vec4f,
};

@vertex fn foo(...) -> VSOut { ... }
@fragment fn bar(moo: FSIn) ... 
```

上記では、頂点シェーダー`foo`は`location(0)`で`color`を`vec4f`として、`location(1)`で`texcoords`を`vec2f`として渡します。フラグメントシェーダー`bar`は、場所が一致するため、それらを`uv`と`diffuse`として受け取ります。

#### フラグメントシェーダーの出力

フラグメントシェーダーの場合、`@location`は、結果を格納する`GPURenderPassDescriptor.colorAttachment`を指定します。

```wgsl
struct FSOut {
  @location(0) albedo: vec4f;
  @location(1) normal: vec4f;
}
@fragment fn bar(...) -> FSOut { ... }
```

### `@builtin(name)`

`@builtin`属性は、特定の変数の値がWebGPUの組み込み機能から取得されることを指定するために使用されます。

```wgsl
@vertex fn vs1(@builtin(vertex_index) foo: u32, @builtin(instance_index) bar: u32) ... {
  ...
}
```

上記では、`foo`は組み込みの`vertex_index`から値を取得し、`bar`は組み込みの`instance_index`から値を取得します。

```wgsl
struct Foo {
  @builtin(vertex_index) vNdx: u32,
  @builtin(instance_index) iNdx: u32,
}
@vertex fn vs1(blap: Foo) ... {
  ...
}
```

上記では、`blap.vNdx`は組み込みの`vertex_index`から値を取得し、`blap.iNdx`は組み込みの`instance_index`から値を取得します。

<div class="webgpu_center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>組み込み名</th>
      <th>ステージ</th>
      <th>IO</th>
      <th>型</th>
      <th>説明</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-vertex_index">vertex_index</dfn> </td>
      <td>頂点</td>
      <td>入力</td>
      <td>u32</td>
      <td style="width:50%">
       現在のAPIレベルの描画コマンド内の現在の頂点のインデックス。描画インスタンス化とは無関係です。
       <p>非インデックス描画の場合、最初の頂点のインデックスは、直接または間接的に提供される描画の<code>firstVertex</code>引数と等しくなります。
         インデックスは、描画インスタンス内の追加の頂点ごとに1ずつインクリメントされます。</p>
       <p>インデックス描画の場合、インデックスは、頂点のインデックスバッファエントリに、直接または間接的に提供される描画の<code>baseVertex</code>引数を加えたものと等しくなります。</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-instance_index">instance_index</dfn> </td>
      <td>頂点</td>
      <td>入力</td>
      <td>u32</td>
      <td style="width:50%">
       現在のAPIレベルの描画コマンド内の現在の頂点のインスタンスインデックス。
       <p>最初のインスタンスのインデックスは、直接または間接的に提供される描画の<code>firstInstance</code>引数と等しくなります。
         インデックスは、描画内の追加のインスタンスごとに1ずつインクリメントされます。</p></td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>頂点</td>
      <td>出力</td>
      <td>vec4&lt;f32&gt;</td>
      <td style="width:50%">同次座標を使用した現在の頂点の出力位置。
      同次正規化（<em>x</em>、<em>y</em>、<em>z</em>の各成分が<em>w</em>成分で除算される）の後、位置はWebGPU正規化デバイス座標空間にあります。
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 座標系</a>を参照してください。</td>
    </tr>
    <tr>
      <td>フラグメント</td>
      <td>入力</td>
      <td>vec4&lt;f32&gt;</td>
      <td style="width:50%"><a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#framebuffer" id="ref-for-framebuffer">フレームバッファ</a>空間内の現在のフラグメントのフレームバッファ位置。
      （<em>x</em>、<em>y</em>、<em>z</em>の成分は、<em>w</em>が1になるようにすでにスケーリングされています。）
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 座標系</a>を参照してください。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-front_facing">front_facing</dfn> </td>
      <td>フラグメント</td>
      <td>入力</td>
      <td>bool</td>
      <td style="width:50%">現在のフラグメントが<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#front-facing" id="ref-for-front-facing">前面</a>プリミティブ上にある場合はtrue。
         それ以外の場合はfalse。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-frag_depth">frag_depth</dfn> </td>
      <td>フラグメント</td>
      <td>出力</td>
      <td>f32</td>
      <td style="width:50%">ビューポート深度範囲内のフラグメントの更新された深度。
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 座標系</a>を参照してください。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_id">local_invocation_id</dfn> </td>
      <td>コンピュート</td>
      <td>入力</td>
      <td>vec3&lt;u32&gt;</td>
      <td style="width:50%">現在の呼び出しの<a data-link-type="dfn" href="#local-invocation-id" id="ref-for-local-invocation-id①">ローカル呼び出しID</a>、
            つまり、<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid①">ワークグループグリッド</a>内の位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_index">local_invocation_index</dfn> </td>
      <td>コンピュート</td>
      <td>入力</td>
      <td>u32</td>
      <td style="width:50%">現在の呼び出しの<a data-link-type="dfn" href="#local-invocation-index" id="ref-for-local-invocation-index">ローカル呼び出しインデックス</a>、<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid②">ワークグループグリッド</a>内の呼び出しの位置の線形化されたインデックス。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-global_invocation_id">global_invocation_id</dfn> </td>
      <td>コンピュート</td>
      <td>入力</td>
      <td>vec3&lt;u32&gt;</td>
      <td style="width:50%">現在の呼び出しの<a data-link-type="dfn" href="#global-invocation-id" id="ref-for-global-invocation-id">グローバル呼び出しID</a>、
          つまり、<a data-link-type="dfn" href="#compute-shader-grid" id="ref-for-compute-shader-grid">コンピュートシェーダーグリッド</a>内の位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-workgroup_id">workgroup_id</dfn> </td>
      <td>コンピュート</td>
      <td>入力</td>
      <td>vec3&lt;u32&gt;</td>
      <td style="width:50%">現在の呼び出しの<a data-link-type="dfn" href="#workgroup-id" id="ref-for-workgroup-id">ワークグループID</a>、
          つまり、<a data-link-type="dfn" href="#compute-shader-grid" id="ref-for-compute-shader-grid">コンピュートシェーダーグリッド</a>内のワークグループの位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-num_workgroups">num_workgroups</dfn> </td>
      <td>コンピュート</td>
      <td>入力</td>
      <td>vec3&lt;u32&gt;</td>
      <td style="width:50%"><a data-link-type="dfn" href="#dispatch-size" id="ref-for-dispatch-size">ディスパッチサイズ</a>、<code>vec&lt;u32&gt;(group_count_x, group_count_y, group_count_z)</code>、APIによって<a href="https://www.w3.org/TR/webgpu/#compute-pass-encoder-dispatch">ディスパッチ</a>されたコンピュートシェーダーの。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_index">sample_index</dfn> </td>
      <td>フラグメント</td>
      <td>入力</td>
      <td>u32</td>
      <td style="width:50%">現在のフラグメントのサンプルインデックス。
         値は少なくとも0で、最大で<code>sampleCount</code>-1です。ここで、<code>sampleCount</code>は、GPUレンダーパイプラインに指定されたMSAAサンプル<code class="idl"><a data-link-type="idl" href="https://www.w3.org/TR/webgpu/#dom-gpumultisamplestate-count" id="ref-for-dom-gpumultisamplestate-count">count</a></code>です。<br><a href="https://www.w3.org/TR/webgpu/#gpurenderpipeline"><cite>WebGPU</cite> § 10.3 GPURenderPipeline</a>を参照してください。</td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_mask">sample_mask</dfn> </td>
      <td>フラグメント</td>
      <td>入力</td>
      <td>u32</td>
      <td style="width:50%">現在のフラグメントのサンプルカバレッジマスク。
         このフラグメント内のどのサンプルがレンダリングされるプリミティブでカバーされているかを示すビットマスクが含まれています。<br><a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 サンプルマスキング</a>を参照してください。</td>
    </tr>
    <tr>
      <td>フラグメント</td>
      <td>出力</td>
      <td>u32</td>
      <td style="width:50%">現在のフラグメントのサンプルカバレッジマスク制御。
         この変数に書き込まれた最後の値が<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#shader-output-mask" id="ref-for-shader-output-mask">シェーダー出力マスク</a>になります。
         書き込まれた値のゼロビットにより、カラーアタッチメントの対応するサンプルが破棄されます。<br><a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 サンプルマスキング</a>を参照してください。</td>
    </tr>
  </tbody>
  </table>
</div>

## フロー制御

ほとんどのコンピュータ言語と同様に、WGSLにはフロー制御ステートメントがあります。

### for

```wgsl
  for (var i = 0; i < 10; i++) { ... }
```

### if

```wgsl
    if (i < 5) {
      ...
    } else if (i > 7) {
      ..
    } else {
      ...
    }
```

### while

```wgsl
  var j = 0;
  while (j < 5) {
    ...
    j++;
  }
```

### loop

```wgsl
  var k = 0;
  loop {
    k++;
    if (k >= 5) {
      break;
    }
  }
```

### break


```wgsl
  var k = 0;
  loop {
    k++;
    if (k >= 5) {
      break;
    }
  }
```

### break if


```wgsl
  var k = 0;
  loop {
    k++;
    break if (k >= 5);
  }
```

### continue

```wgsl
  for (var i = 0; i < 10; ++i) {
    if (i % 2 == 1) {
      continue;
    }
    ...
  }
```

### continuing

```wgsl
  for (var i = 0; i < 10; ++i) {
    if (i % 2 == 1) {
      continue;
    }
    ...

    continuing {
      // continueはここに行きます
      ...
    }
  }
```

### discard

```wgsl
   if (v < 0.5) {
     discard;
   }
```

`discard`はシェーダーを終了します。フラグメントシェーダーでのみ使用できます。

### switch

```wgsl
var a : i32;
let x : i32 = generateValue();
switch x {
  case 0: {      // コロンはオプションです
    a = 1;
  }
  default {      // デフォルトは最後に表示する必要はありません
    a = 2;
  }
  case 1, 2, {   // 複数のセレクター値を使用できます
    a = 3;
  }
  case 3, {      // 末尾のカンマはオプションです
    a = 4;
  }
  case 4 {
    a = 5;
  }
}
```

`switch`は`u32`または`i32`でのみ機能し、ケースは定数でなければなりません。

## 演算子

<div class="webgpu_center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>名前</th>
      <th>演算子</th>
      <th>結合性</th>
      <th>バインディング</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>括弧付き</td>
      <td><code>(...)</code></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>プライマリ</td>
      <td><code>a()</code>, <code>a[]</code>, <code>a.b</code></td>
      <td>左から右</td>
      <td></td>
    </tr>
    <tr>
      <td>単項</td>
      <td><code>-a</code>, <code>!a</code>, <code>~a</code>, <code>*a</code>, <code>&amp;a</code></td>
      <td>右から左</td>
      <td>上記すべて</td>
    </tr>
    <tr>
      <td>乗法</td>
      <td><code>a * b</code>, <code>a / b</code>, <code>a % b</code></td>
      <td>左から右</td>
      <td>上記すべて</td>
    </tr>
    <tr>
      <td>加法</td>
      <td><code>a + b</code>, <code>a - b</code></td>
      <td>左から右</td>
      <td>上記すべて</td>
    </tr>
    <tr>
      <td>シフト</td>
      <td><code>a &lt;&lt; b</code>, <code>a &gt;&gt; b</code></td>
      <td>括弧が必要</td>
      <td>単項</td>
    </tr>
    <tr>
      <td>関係</td>
      <td><code>a &lt; b</code>, <code>a &gt; b</code>, <code>a &lt;= b</code>, <code>a &gt;= b</code>, <code>a == b</code>, <code>a != b</code></td>
      <td>括弧が必要</td>
      <td>上記すべて</td>
    </tr>
    <tr>
      <td>バイナリAND</td>
      <td><code>a &amp; b</code></td>
      <td>左から右</td>
      <td>単項</td>
    </tr>
    <tr>
      <td>バイナリXOR</td>
      <td><code>a ^ b</code></td>
      <td>左から右</td>
      <td>単項</td>
    </tr>
    <tr>
      <td>バイナリOR</td>
      <td><code>a | b</code></td>
      <td>左から右</td>
      <td>単項</td>
    </tr>
    <tr>
      <td>短絡AND</td>
      <td><code>a &amp;&amp; b</code></td>
      <td>左から右</td>
      <td>関係</td>
    </tr>
    <tr>
      <td>短絡OR</td>
      <td><code>a || b</code></td>
      <td>左から右</td>
      <td>関係</td>
    </tr>
  </tbody>
</table>
</div>

## 組み込み関数

[WGSL関数リファレンス](webgpu-wgsl-function-reference.html)を参照してください。

## 他の言語との違い

### `if`、`while`、`switch`、`break-if`式には括弧は必要ありません。

```wgsl
if a < 5 {
  doTheThing();
}
```

### 三項演算子なし

多くの言語には、三項演算子`condition ? trueExpression : falseExpression`があります。WGSLにはありません。WGSLには`select`があります。

```wgsl
  let a = select(falseExpression, trueExpression, condition);
```

### `++`と`--`は式ではなく、ステートメントです。

多くの言語には、*前置インクリメント*と*後置インクリメント*演算子があります。

```js
// JavaScript
let a = 5;
let b = a++;  // b = 5, a = 6  (後置インクリメント)
let c = ++a;  // c = 7, a = 7  (前置インクリメント)
```

WGSLにはどちらもありません。インクリメントおよびデクリメントステートメントのみがあります。

```wgsl
// WGSL
var a = 5;
a++;          // は現在6です
*++a;          // エラー：前置インクリメントのようなものはありません
*let b = a++;  // エラー：a++は式ではなく、ステートメントです
```

## `+=`、`-=`は式ではなく、代入ステートメントです。

```js
// JavaScript
let a = 5;
a += 2;          // a = 7
let b = a += 2;  // a = 9, b = 9
```

```wgsl
// WGSL
let a = 5;
a += 2;           // aは7です
*let b = a += 2;  // エラー：a += 2は式ではありません
```

## スウィズルは左側に表示できません。

一部の言語ではそうですが、WGSLではそうではありません。

```
var color = vec4f(0.25, 0.5, 0.75, 1);
*color.rgb = color.bgr; // エラー
color = vec4(color.bgr, color.a);  // OK
```

注：この機能を追加する提案があります。

## `_`への偽の代入

`_`は、何かを使用済みのように見せるが、実際には使用しないように代入できる特別な変数です。

```wgsl
@group(0) @binding(0) var<uniforms> uni1: vec4f;
@group(0) @binding(0) var<uniforms> uni2: mat4x4f;

@vertex fn vs1(): @builtin(position) vec4f {
  return vec4f(0);
}

@vertex fn vs2(): @builtin(position) vec4f {
  _ = uni1;
  _ = uni2;
  return vec4f(0);
}
```

上記では、`uni1`も`uni2`も`vs1`によってアクセスされないため、パイプラインで`vs1`を使用する場合、必須のバインディングとして表示されません。`vs2`は`uni1`と`uni2`の両方を参照するため、パイプラインで`vs2`を使用する場合、両方とも必須のバインディングとして表示されます。

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>
