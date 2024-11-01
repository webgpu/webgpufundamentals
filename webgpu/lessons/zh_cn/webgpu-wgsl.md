Title: WebGPU WGSL
Description: WebGPU着色语言简介
TOC: WGSL

对于WGSL的深入概述，请参见 [Tour of WGSL](https://google.github.io/tour-of-wgsl/)。
我们还有 [实际的WGSL规范](https://www.w3.org/TR/WGSL/) ，尽管它是为 [语言律师们](http://catb.org/jargon/html/L/language-lawyer.html) 编写的，可能难以理解 😂

本文假设您已经知道如何编程。它可能过于简略，但希望它能帮助您理解和编写WGSL着色程序。

## WGSL 是严格类型的

与 JavaScript 不同，WGSL 要求了解每个变量、结构字段、函数参数和函数返回类型的具体类型。如果您使用过TypeScript、Rust、C++、C#、Java、Swift、Kotlin 等，那么您对此应该很熟悉。

### 基本类型

WGSL 中包括这些*基本*类型
 
* `i32` 一个32位有符号整数
* `u32` 一个32位无符号整数
* `f32` 一个32位浮点数
* `bool` 一个布尔值
* `f16` 一个16位浮点数（这是一个可选特性，使用前请检查并请求）

### 变量声明

在JavaScript中，您可以像这样声明变量和函数：

```js
var a = 1;
let c = 3;
function d(e) { return e * 2; }
```

在WGSL中，这些声明的完整形式将会是：

```wgsl
var a: f32 = 1;
let c: f32 = 3;
fn d(e: f32) -> f32 { return e * 2; }
```

需要注意的是，我们在变量声明中添加了 `: <类型>`，例如 `: f32`，以及在函数声明中添加了 `-> <类型>`。

### 自动类型

WGSL为变量提供了一个*快捷方式*。类似于 TypeScript，如果您没有声明变量的类型，则它将自动成为右侧表达式的类型。

```wgsl
fn foo() -> bool { return false; }

var a = 1;     // a 是 i32 类型
let b = 2.0;   // b 是 f32 类型
var c = 3u;    // c 是 u32 类型
var d = foo(); // d 是 bool 类型
```

### 类型转换

此外，严格的类型意味着您经常需要转换类型。

```wgsl
let a = 1;     // a 是 i32 类型
let b = 2.0;   // b 是 f32 类型
*let c = a + b; // 错误：不能将一个 i32 的值添加到 f32 的值上
```

为了修复该错误，我们将其中一个变量的类型转换为另一个的类型：

```wgsl
let a = 1;     // a 是 i32 类型
let b = 2.0;   // b 是 f32 类型
let c = f32(a) + b; // 这样就行了
```

但是！WGSL有所谓的 “抽象整数（AbstractInt）” 和 “抽象浮点数（AbstractFloat）” 。您可以将它们视为尚未决定其类型的数字。这些都是仅在编译时有效的特性。

```wgsl
let a = 1;            // a 是 i32 类型
let b = 2.0;          // b 是 f32 类型
*let c = a + b;       // 错误：不能将一个 i32 的值添加到 f32 的值上
let d = 1 + 2.0;      // d 是 f32 类型
```

### 数值后缀

```
2i   // i32
3u   // u32
4f   // f32
4.5f // f32
5h   // f16
5.6h // f16
6    // 抽象整数
7.0  // 抽象浮点数
```

## `let` `var` 和 `const` 在 WGSL 和 Javascript 中的含义不同

在JavaScript中，`var` 是一个具有函数作用域的变量。`let` 是一个具有块作用域的变量。`const` 是一个常量变量（不能改变）[^references]，具有块作用域。

[^references]: JavaScript中的变量有基础类型 `undefined`, `null`, `boolean`, `number`, `string`, `reference-to-object`。
新手程序员们可能会因 `const o = {name: 'foo'}; o.name = 'bar';` 能够工作而困惑，因为 `o` 已经被声明为了 `const`。
事实上 `o` 确实是常量，它是对一个对象的常量引用。你不能再次设置 `o` 引用哪个对象，但你可以改变对象本身。

在WGSL中，所有变量都具有块作用域。`var` 是一个具有存储空间的变量，因此是可变的。`let` 是一个常量值。

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // 错误：a 是常量表达式
  var b = 2;
  b = b + 1;  // 彳亍
}
```

`const` 不是一个变量，而是一个编译时常量。您不能将 `const` 用于运行时。

```wgsl
const one = 1;              // 彳亍
const two = one * 2;        // 很好
const PI = radians(180.0);  // 没问题

fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // 错误！const 只能用于编译时表达式
  return result;
}
```

## 向量类型

WGSL有三种向量类型 `vec2`, `vec3`, 和 `vec4`。它们的基本样式是 `vec?<type>`
例如 `vec2<i32>` （两个i32的向量）, `vec3<f32>`（三个f32的向量）, `vec4<u32>`（四个u32的向量）,
`vec3<bool>`（三个布尔值的向量）。

示例:

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10, 11, 12);
```

### 选择器（accessors）

您可以使用各种选择器来访问向量内的值。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.z;   // 通过 x,y,z,w 访问
let c = a.b;   // 通过 r,g,b,a 访问
let d = a[2];  // 通过数组元素选择器访问
```

在上面的例子中，`b`, `c` 和 `d`都是相同的。它们都在访问 a 的第三个元素，而它们都是'3'。

### 调制

您也可以同时访问多个元素。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.zx;   // 通过 x,y,z,w 访问
let c = a.br;   // 通过 r,g,b,a 访问
let d = vec2<f32>(a[2], a[0]);
```

在上面的例子中，`b`, `c` 和 `d` 都是相同的，它们都是 `vec2<f32>(3, 1)`。

您还可以重复元素。

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec3<f32>(a.z, a.z, a.y);
let c = a.zzy;
```

在上面的例子中，`b` 和 `c` 是一样的。它们都是 `vec3<f32>`，其内容是 3, 3, 2。

### 向量快捷方式

基本类型有快捷方式。您可以将 `<i32>` 改为 `i`, `<f32>` 改为 `f`, `<u32>` 改为 `u` , `<f16>` 改为 `h`，如：

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a` 和 `b` 是相同的类型。

### 向量构造

可以用更小的类型构建向量。

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
let d = vec4f(1, a.yz, 4);
let e = vec4f(a.xyz, 4);
let f = vec4f(1, a.yzw);
```

`a`, `c`, `d`, `e` 和 `f` 是相同的。

### 向量数学

您可以在向量上进行数学运算。

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // c 是 vec4f(6, 8, 10, 12)
let d = a * b;  // d 是 vec4f(5, 12, 21, 32)
let e = a - b;  // e 是 vec4f(-4, -4, -4, -4)
```

许多函数也适用于向量：

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);                   // c is vec4f(3, 4, 5, 6)
let d = mix(a, b, vec4f(0, 0.5, 0.5, 1)); // d is vec4f(1, 4, 5, 8)
```

## 矩阵

WGSL有许多矩阵类型。矩阵是向量的数组，格式是 `mat<向量数量>x<向量大小><类型>`，例如 `mat3x4<f32>` 是一个包含3个 `vec4<f32>` 的数组。就像向量一样，矩阵也有相同的快捷方式：

```wgsl
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a` 和 `b` 是相同的类型。

### 矩阵向量访问

您可以使用数组语法引用矩阵中的向量。

```wgsl
let a = mat4x4f(...);
let b = a[2];  // b 是 a 中第3个向量的一个 vec4f
```
最常用的3D计算矩阵类型是 `mat4x4f` ，可以直接与`vec4f` 相乘产生另一个 `vec4f`。

```wgsl
let a = mat4x4f(....);
let b = vec4f(1, 2, 3, 4);
let c = a * b;  // c 是一个 vec4f，是 a * b 的结果
```

## 数组

WGSL中的数组使用 `array<type, numElements>` 语法声明。

```wgsl
let a = array<f32, 5>;   // 一个包含五个 f32 的数组
let b = array<vec4f, 6>; // 一个包含六个 vec4f 的数组
```

但是也有 `array` 构造函数。
它可以接受任意数量的参数，并返回一个数组。参数必须全部是相同类型。

```wgsl;
let arrOf3Vec3fsA = array(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
let arrOf3Vec3fsB = array<vec3f, 3>(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
```

在上面的例子中，`arrOf3Vec3fsA` 和 `arrOf3Vec3fsB` 是相同的类型。

不幸的是，在WGSL版本1中，没有方法获取固定大小数组的大小。

### 运行时大小数组

只有根作用域存储声明或作为根作用域结构体最后一个字段的数组才能指定为没有大小。

```wgsl
struct Stuff {
  color: vec4f,
  size: f32,
  verts: array<vec3f>,
};
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;
```

`foo` 和 `bar.verts` 中的元素数量由运行时使用的绑定组设置定义。您可以在 WGSL 中使用 `arrayLength` 查询此大小。

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;

...
  let numMatrices = arrayLength(&foo);
  let numVerts = arrayLength(&bar.verts);
```

## 函数

WGSL 中的函数遵循 `fn 函数名(参数) -> 返回类型 { ..函数体... }` 的模式。

```wgsl
fn add(a: f32, b: f32) -> f32 {
  return a + b;
}
```

## 入口点

WGSL 的程序需要一个入口点。入口点由 `@vertex`, `@fragment` 或者 `@compute` 标记。

```wgsl
@vertex fn myFunc(a: f32, b: f32) -> @builtin(position): vec4f {
  return vec4f(0, 0, 0, 0);
}
```

## 着色器只使用其入口点访问的内容

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

上面 `uni` 没有被 `vs1` 访问，因此如果在管道中使用 `vs1`，它不会显示为必需的绑定。`vs2` 通过调用 `foo` 间接引用了 `uni`，所以在管道中使用 `vs2` 时，它会显示为必需的绑定。

## 属性（attributes）

*属性（attributes）* 这个词在WebGPU有双重含义，一个是 *顶点属性（vertex attributes）* 这在[顶点缓冲区的文章](webgpu-vertex-buffers.html)有过介绍。
另一个是在WGSL中，属性以 `@` 开头。

### `@location(number)`

`@location(number)` 用于定义着色器的输入和输出。

#### 顶点着色器输入

对于顶点着色器，输入由顶点着色器入口点函数的 `@location` 属性定义。

```wgsl
@vertex vs1(@location(0) foo: f32, @location(1) bar: vec4f) ...

struct Stuff {
  @location(0) foo: f32,
  @location(1) bar: vec4f,
};
@vertex vs2(s: Stuff) ...
```

`vs1` 和 `vs2` 定义了在地址0和1的输入，它们需要由[顶点着色器](webgpu-vertex-buffers.html)提供。

#### Inter-stage 变量

对于 Inter-stage 变量, `@location` 属性定义了变量在着色器之间传递的位置。

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

上面的例子中, 顶点着色器 `foo` 将 `color` 作为 `location(0)` 上的 `vec4f`，`texcoords` 作为 `location(1)`上的 `vec2f`。
而片段着色器 `bar` 将他们以 `uv` 和 `diffuse` 接收，因为它们的位置是匹配的。

#### 片段着色器输出

对于片段着色器，`@location` 指定了将结果存储在哪个`GPURenderPassDescriptor.colorAttachment` 中。

```wgsl
struct FSOut {
  @location(0) albedo: vec4f;
  @location(1) normal: vec4f;
}
@fragment fn bar(...) -> FSOut { ... }
```

### `@builtin(name)`

`@builtin` 属性用于指定某个特定变量的值来自WebGPU的内置功能。

```wgsl
@vertex fn vs1(@builtin(vertex_index) foo: u32, @builtin(instance_index) bar: u32) ... {
  ...
}
```

在上面的例子中，`foo` 的值来自内置的 `vertex_index` 而 `bar` 的值来自内置的 `instance_index`.

```wgsl
struct Foo {
  @builtin(vertex_index) vNdx: u32,
  @builtin(instance_index) iNdx: u32,
}
@vertex fn vs1(blap: Foo) ... {
  ...
}
```

在这个例子中，`blap.vNdx` 的值来自内置的`vertex_index` 而 `blap.iNdx`的值来自内置的 `instance_index`.

<div class="webgpu_center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>内部名称</th>
      <th>阶段</th>
      <th>IO</th>
      <th>类型</th>
      <th>描述</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-vertex_index">vertex_index</dfn> </td>
      <td>vertex </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">
      当前顶点在当前API级绘制命令中的索引， 不依赖于绘制实例化。
       <p>对于非索引绘制，第一个顶点的索引等于绘制的<code>firstVertex</code> 参数的值，无论是直接还是间接提供的。 绘制实例中每个额外的顶点，索引递增一。</p>
       <p>对于索引绘制，索引等于顶点的索引缓冲条目， 加上绘制的<code>baseVertex</code> 参数的值，无论是直接还是间接提供的。</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-instance_index">instance_index</dfn> </td>
      <td>vertex </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">
       当前顶点在当前API级绘制命令中的实例索引。
       <p>第一个实例的索引等于绘制的<code>firstInstance</code> 参数的值，
         无论是直接还是间接提供的。 绘制中每个额外的实例，索引递增一。</p></td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>vertex </td>
      <td>output </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">当前顶点的输出位置，使用齐次坐标。 齐次归一化（也就是所有的 <em>x</em>, <em>y</em>, 和 <em>z</em> 分量都除以 <em>w</em> 分量）后, 位置处于WebGPU标准化设备坐标空间。参见<a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>。 </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>input </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">当前片段在<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#framebuffer" id="ref-for-framebuffer">帧缓冲（framebuffer）</a> 空间的位置。
      (<em>x</em>, <em>y</em>和<em>z</em> 分量都已经被缩放过所以 <em>w</em> 现在是1。)
      参见 <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-front_facing">front_facing</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>bool </td>
      <td style="width:50%">当当前片段位于<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#front-facing" id="ref-for-front-facing">面向前方的</a> 图元上时为真，否则为假。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-frag_depth">frag_depth</dfn> </td>
      <td>fragment </td>
      <td>output </td>
      <td>f32 </td>
      <td style="width:50%">视口深度范围内的片段更新后的深度。参见<a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_id">local_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">当前调用的<a data-link-type="dfn" href="#local-invocation-id" id="ref-for-local-invocation-id①">局部调用ID（local invocation ID）</a>， 即其在<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid①">工作组网格（workgroup grid）</a>中的位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_index">local_invocation_index</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">当前调用的<a data-link-type="dfn" href="#local-invocation-index" id="ref-for-local-invocation-index">局部调用索引（local invocation index）</a>, 即调用在<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid②">工作组网格（workgroup grid）</a>中的线性索引。 </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-global_invocation_id">global_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">当前调用的<a data-link-type="dfn" href="#global-invocation-id" id="ref-for-global-invocation-id">全局调用ID（global invocation ID）</a>,
          也就是它在<a data-link-type="dfn" href="#compute-shader-grid" id="ref-for-compute-shader-grid">计算着色器（compute shader grid）</a>中的位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-workgroup_id">workgroup_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">当前调用的<a data-link-type="dfn" href="#workgroup-id" id="ref-for-workgroup-id">工作组ID（workgroup ID）</a>,
          也就是该工作组在<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid③">工作组网格（workgroup grid）</a>中的位置。</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-num_workgroups">num_workgroups</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">通过API<a href="https://www.w3.org/TR/webgpu/#compute-pass-encoder-dispatch">调度的</a>计算着色器的<a data-link-type="dfn" href="#dispatch-size" id="ref-for-dispatch-size">调度大小（dispatch size）</a>，即<code>vec&lt;u32&gt;(group_count_x, group_count_y, group_count_z)</code></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_index">sample_index</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">当前片段的样本索引。 该值至少为0且至多为<code>sampleCount</code>-1, 其中<code>sampleCount</code> 是为GPU渲染管线指定的MSAA样本<code class="idl"><a data-link-type="idl" href="https://www.w3.org/TR/webgpu/#dom-gpumultisamplestate-count" id="ref-for-dom-gpumultisamplestate-count">数量</a></code><br>参见<a href="https://www.w3.org/TR/webgpu/#gpurenderpipeline"><cite>WebGPU</cite> § 10.3 GPURenderPipeline</a>. </td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_mask">sample_mask</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">当前片段的样本覆盖率掩码。它包含一个位掩码，指示此片段中哪些样本被正在渲染的图元覆盖。<br>参见<a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>output </td>
      <td>u32 </td>
      <td style="width:50%">控制当前片段的样本覆盖率的掩码。写入此变量的最后一个值成为<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#shader-output-mask" id="ref-for-shader-output-mask">着色器输出掩码</a>.
         写入值中的零位将导致颜色附件（color attachments）中相应的样本被丢弃。<br>See <a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
  </tbody>
  </table>
</div>

## 流程控制

像大多数计算机语言一样，WGSL具有流程控制语句。

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
      // continue goes here
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

使用 `discard` 会退出当前着色器。它只能在片段着色器中使用。

### switch

```wgsl
var a : i32;
let x : i32 = generateValue();
switch x {
  case 0: {      // 冒号是可选的
    a = 1;
  }
  default {      // 默认分支不需要出现在最后
    a = 2;
  }
  case 1, 2, {   // 可以使用多个选择值
    a = 3;
  }
  case 3, {      // 尾随逗号也是可选的
    a = 4;
  }
  case 4 {
    a = 5;
  }
}
```

`switch` 仅与 `u32` 和 `i32` 类型的变量工作，并且各分支的匹配值必须是常量。

## 操作符

<div class="webgpu_center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>名称</th>
      <th>操作符</th>
      <th>Associativity </th>
      <th>Binding </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Parenthesized </td>
      <td><code>(...)</code> </td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Primary </td>
      <td><code>a()</code>, <code>a[]</code>, <code>a.b</code> </td>
      <td>Left-to-right </td>
      <td></td>
    </tr>
    <tr>
      <td>Unary </td>
      <td><code>-a</code>, <code>!a</code>, <code>~a</code>, <code>*a</code>, <code>&amp;a</code> </td>
      <td>Right-to-left </td>
      <td>All above </td>
    </tr>
    <tr>
      <td>Multiplicative </td>
      <td><code>a * b</code>, <code>a / b</code>, <code>a % b</code> </td>
      <td>Left-to-right </td>
      <td>All above </td>
    </tr>
    <tr>
      <td>Additive </td>
      <td><code>a + b</code>, <code>a - b</code> </td>
      <td>Left-to-right </td>
      <td>All above </td>
    </tr>
    <tr>
      <td>Shift </td>
      <td><code>a &lt;&lt; b</code>, <code>a &gt;&gt; b</code> </td>
      <td>Requires parentheses </td>
      <td>Unary </td>
    </tr>
    <tr>
      <td>Relational </td>
      <td><code>a &lt; b</code>, <code>a &gt; b</code>, <code>a &lt;= b</code>, <code>a &gt;= b</code>, <code>a == b</code>, <code>a != b</code> </td>
      <td>Requires parentheses </td>
      <td>All above </td>
    </tr>
    <tr>
      <td>Binary AND </td>
      <td><code>a &amp; b</code> </td>
      <td>Left-to-right </td>
      <td>Unary </td>
    </tr>
    <tr>
      <td>Binary XOR </td>
      <td><code>a ^ b</code> </td>
      <td>Left-to-right </td>
      <td>Unary </td>
    </tr>
    <tr>
      <td>Binary OR </td>
      <td><code>a | b</code> </td>
      <td>Left-to-right </td>
      <td>Unary </td>
    </tr>
    <tr>
      <td>Short-circuit AND </td>
      <td><code>a &amp;&amp; b</code> </td>
      <td>Left-to-right </td>
      <td>Relational </td>
    </tr>
    <tr>
      <td>Short-circuit OR </td>
      <td><code>a || b</code> </td>
      <td>Left-to-right </td>
      <td>Relational </td>
    </tr>
  </tbody>
</table>
</div>

## 内部函数

请见 [the WGSL Function reference](webgpu-wgsl-function-reference.html).

## 与其他语言的不同

### `if`, `while`, `switch`, `break-if` 表达式不需要括号。

```wgsl
if a < 5 {
  doTheThing();
}
```

### 没有三元运算符

许多语言有一个三元运算符 `condition ? trueExpression : falseExpression`
但WGSL没有。WGSL有 `select`.

```wgsl
  let a = select(falseExpression, trueExpression, condition);
```

### `++` and `--` are statements, not expressions.

许多语言有 *前置递增 * 和 *后置递增* 运算符。

```js
// JavaScript
let a = 5;
let b = a++;  // b = 5, a = 6  (前置递增)
let c = ++a;  // c = 7, a = 7  (后置递增)
```

WGSL没有这些。它只有递增和递减语句。

```wgsl
// WGSL
var a = 5;
a++;          // a 现在是 6
*++a;          // 错误：没有前置递增这种东西
*let b = a++;  // 错误：a++ 不是一个表达式，而是一个语句（译者注：语句（statement）不返回值）
```

## `+=`, `-=` 不是表达式，它们是赋值语句

```js
// JavaScript
let a = 5;
a += 2;          // a = 7
let b = a += 2;  // a = 9, b = 9
```

```wgsl
// WGSL
let a = 5;
a += 2;           // a 是 7
*let b = a += 2;  // 错误：a += 2 不是一个表达式
```

## 调制（swizzles）不能出现在左边

在某些语言中可以这样做，但在WGSL中不可以。

```
var color = vec4f(0.25, 0.5, 0.75, 1);
*color.rgb = color.bgr; // 错误
color = vec4(color.bgr, color.a);  // 彳亍
```

Note：有一个提议是增加这个功能。

## 假装赋值给 `_`

`_` 是一个特殊的变量，你可以赋值给它，来让某些东西看起来被使用了，但实际上并不使用它。

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

上面的例子中，无论是 `uni1` 还是 `uni2` 都没有被 `vs1` 访问到，因此如果在管线中使用 `vs1`，它们都不会作为必需的绑定出现。而 `vs2` 则引用了 `uni1` 和 `uni2`，所以当使用 `vs2` 在管线中时，它们都会作为必需的绑定出现。

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>
