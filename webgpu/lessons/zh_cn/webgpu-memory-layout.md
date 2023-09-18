Title: WebGPU 数据内存布局
Description: 如何为WebGPU布局及准备数据
TOC: 数据内存布局


在 WebGPU 中，您提供的几乎所有数据都需要在内存中进行布局，以便与着色器中的定义相匹配。这与 JavaScript 和 TypeScript 形成了巨大反差，在 JavaScript 和 TypeScript 中，内存布局问题很少出现。

在 WGSL 中，当您编写着色器时，通常会定义 `struct`结构体。结构体有点像 JavaScript 中的对象。结构体的成员，类似于 JavaScript 对象的属性。但是除了给每个属性命名外，您还必须给它定义一个类型。**此外**，在提供数据时，**您还需要计算**结构体中的特定成员将出现在缓冲区的哪个位置。

在[WGSL](webgpu-wgsl.html) v1中, 有4中基本类型

* `f32` (32位浮点数)
* `i32` (32位整数)
* `u32` (32位无符号整数)
* `f16` (16位浮点数) [^f16-optional]

[^f16-optional]: `f16` 类型支持是 [可选的特性](webgpu-limits-and-features.html)

1个字节为8位，所以一个32位的值需要4个字节，一个16位的值则需要2个字节。
A byte is 8 bits so a 32 bit value takes 4 bytes and a 16 bit value takes 2 bytes.

如果我们定义个类似下面这样的结构体

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

这种结构体的可视化表示可能是这样的

<div class="webgpu_center" data-diagram="ourStructV1"></div>

每个方形块为一个字节。正如图中所示，一共需要12个字节，`velocity`占前 4 个字节，`acceleration`占后 4 个字节，`frameCount`占最后 4 个字节。

要将数据传递给着色器，我们需要准备数据以匹配内存布局 `OurStruct`。为此，我们需要创建一个 12 字节的 `ArrayBuffer然后设置正确类型的 `TypedArray` 视图，这样我们就可以将其填满。

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

在上面，`ourStructData` 是一个 ArrayBuffer，它是一块内存空间。，`ourStructValuesAsF32`与`ourStructValuesAsU32`的内存空间是同一个，但是显示的方式不同，一个是以32位浮点数显示值的内存视图，另一个则是以32位无符号整数显示值得内存视图。

现在我们有了一个缓冲区和两个视图，可以在结构体上设置数据了。

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // an integer value
```
请注意，就像编程中的许多事情一样，我们有多种方法可以做到这一点。TypeArray 的构造函数有多种形式。例如

* `new Float32Array(12)`
  该版本创建了一个**新的** `ArrayBuffer`，在本例中为 12 * 4 字节。然后创建 `Float32Array`类型的内存视图 来查看它。

* `new Float32Array([4, 5, 6])`
  该版本创建了一个**新的** `ArrayBuffer`，在本例中为 3 * 4 字节。然后创建 `Float32Array`类型的内存视图 来查看它。并且设置其初始值为4, 5, 6。

   请注意，您也可以传递另一个 `TypedArray`作为参数。例如

  `new Float32Array(someUint8ArrayOf6Values)` 将新建一个大小为 6 * 4 的 `ArrayBuffer`，然后创建一个 `Float32Array` 来查看它，再将现有视图中的值复制到新的 `Float32Array` 中。数值是按数字而不是二进制复制的。换句话说，它们是这样被复制的
   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

* `new Float32Array(someArrayBuffer)`
  这就是我们之前使用的例子。在**现有缓冲区**上新建一个 `Float32Array` 视图。

* `new Float32Array(someArrayBuffer, byteOffset)`

  这将在**现有缓冲区上**创建一个新的 `Float32Array`，但会从`byteOffset`偏移处开始创建视图

* `new Float32Array(someArrayBuffer, byteOffset, length)`
  这会在现有缓冲区上新建一个 `Float32Array`。视图从 `byteOffset`偏移处开始，且具有`length`个单位长度。因此，如果我们以3为长度，该视图将是 3 个 float32 值（12 字节）的 `someArrayBuffer`
   This makes a new `Float32Array` on an **existing buffer**. The view
   starts at `byteOffset` and is `length` units long. So if we passed 3
   for length the view would be 3 float32 values long (12 bytes) of
   `someArrayBuffer`

使用最后一种形式，我们可以将上面的代码改为

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
此外，每个类型数组都具有以下属性

* `length`: 单元数量
* `byteLength`: 字节长度
* `byteOffset`: `TypeArray`在其`ArrayBuffer`中的偏移起始位置
* `buffer`: `TypeArray`正在查看的`ArrayBuffer`

`TypeArray` 有多种方法，其中许多方法与 `Array` 相似，但有一种方法与 Array 不同，那就是 `subarray`。它可以创建一个新的相同类型的 `TypeArray` 视图。它的参数是 `subarray(begin，end)`， end索引的元素不在其中。因此，`someTypedArray.subarray(5, 10)` 将创建一个新的`TypedArray`，其中的 `ArrayBuffer` 与原来的`TypedArray`中的`ArrayBuffer`是同一个。其中包含 `someTypedArray` 的第 5 至 9 个元素。

And `TypeArray`s have various methods, many are similar to `Array` but
one that is not is `subarray`. It creates a new `TypedArray` view
of the same type. Its parameters are `subarray(begin, end)` were
`end` is not included. So `someTypedArray.subarray(5, 10)` makes
a new `TypedArray` of **the same `ArrayBuffer`** of elements 5 to 9
of `someTypedArray`.

所以我们能够将上面的代码改下如下

```js
const kOurStructSizeFloat32Units =
  1 + // velocity
  1 + // acceleration
  1 ; // frameCount
const ourStructDataAsF32 = new Float32Array(kOurStructSizeFloat32Units);
const ourStructDataAsU32 = new Uint32Array(ourStructDataAsU32);
const velocityView = ourStructDataAsF32.subarray(0, 1);
const accelerationView = ourStructDataAsF32.subarray(1, 2);
const frameCountView = ourStructDataAsU32(ourStructData, 2, 3);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```
[WGSL](webgpu-wgsl.html) 有 4 种基本类型。它们是：

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
      <tr><td><code>vec2&lt;f32&gt;</code></td></td><td>a type with 2  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td></td><td>a type with 2  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td></td><td>a type with 2  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td></td><td>a type with 2  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td></td><td>a type with 3  <code>f32</code>s</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td></td><td>a type with 3  <code>u32</code>s</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td></td><td>a type with 3  <code>i32</code>s</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td></td><td>a type with 3  <code>f16</code>s</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td></td><td>a type with 4  <code>f32</code>s</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td></td><td>a type with 4  <code>u32</code>s</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td></td><td>a type with 4  <code>i32</code>s</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td></td><td>a type with 4  <code>f16</code>s</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x3u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x3i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x4u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x4i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat3x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat3x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat3x3u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat3x3i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat3x4u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat3x4i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat4x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat4x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat4x3u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat4x3i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat4x4u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat4x4i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

已知 `vec3f` 是一个有 3 个 `f32` 的类型，而 `mat4x4f` 是一个由 `f32` 组成的 4x4 矩阵，因此它有 16 个 `f32`，那么你认为下面的结构在内存中是什么样子的？

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```
想好了吗？

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

What's up with that? It turns out every type has alignment requirements.
For a given type it must be aligned to a multiple of a certain number
of bytes.

Here are the sizes and alignments of the various types.

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

But wait, there's MORE!

What do you think the layout of this struct will be?

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

The `array<type, count>` syntax defines an array of `type` with `count` elements.

Here's you go...

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

If you look in the alignment table you'll see `vec3<f32>` has
an alignment of 16 bytes. That means each `vec3<f32>`, whether
it's in a matrix or an array ends up having an extra space.

Here's another one

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

Why did `size` end up at byte offset 12, just after orientation but `scale` and
`friction` got bumped offsets 32 and 64

That's because arrays and structs have their own own special alignment rules so
even though the array is a single `vec3f` and the `Ex4a` struct is also a single
`vec3f` they get aligned according to different rules.

# Computing Offset and Sizes is a PITA!

Computing sizes and offsets of data in WGSL is probably the largest pain point
of WebGPU. You are required to compute these offsets yourself and keep them up
to date. If you add a member somewhere in the middle of a struct in your shaders
you need to go back to your JavaScript and update all the offsets. Get a single
byte or length wrong and the data you pass to the shader will be wrong. You
won't get an error, but your shader will likely do the wrong thing because it's
looking at bad data. Your model won't draw or your computation will produce
bad results.

Fortunately there are libraries to help with this.

Here's one: [webgpu-utils](https://github.com/greggman/webgpu-utils)

You give it your WGSL code and it gives an API do all of this for you.
This way you can change your structs and, more often than not, things
will just work.

For example, using that last example we can pass it to `webgpu-utils`
like this

```
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'https://greggman.github.io/webgpu-utils/dist/0.x/webgpu-utils.module.js';

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

Whether you use this particular library or a different one or
none at all is up to you. For me, I would often spent 20-30-60 minutes
trying to figure out why something was not working only to find
that I manually computed an offset or size wrong so for my own work
I'd rather use a library and avoid that pain.

If you do want to do it manually though, 
[here's a page that will compute the offsets for you](resources/wgsl-offset-computer.html)

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
