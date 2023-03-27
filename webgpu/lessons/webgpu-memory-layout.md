Title: WebGPU Data Memory Layout
Description: How to layout and prepare data for WebGPU
TOC: Data Memory Layout

In WebGPU, nearly all of the data you provide to it needs to
be layed out in memory to match what you define in your shaders.
This is a big contrast to JavaScript and TypeScript where memory
layout issues rarely come up.

In WGSL when you write your shaders, it's common to define `struct`s.
Structs are kind of line JavaScript objects, you declare members of
a struct, similar to properties of a JavaScript object. But, on top
of giving each property a name, you also have to give it a type.
**AND**, when providing the data **it's up to you** to compute where
in a buffer that particular member of the struct will appear.

In [WGSL](webgpu-wgsl.html) v1, there are 4 base types

* `f32` (a 32bit floating point number)
* `i32` (a 32bit integer)
* `u32` (a 32bit unsigned integer)
* `f16` (a 16bit floating point number) [^f16-optional]

[^f16-optional]: `f16` support is an [optional feature](webgpu-limits-and-features.html)

A byte is 8 bits so a 32 bit value takes 4 bytes and a 16 bit value takes 2 bytes.

If we declare a struct like this

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

A visual representation of that structure might look something like this

<div class="webgpu_center" data-diagram="ourStructV1"></div>

Each square block is a byte. Above you can see our data takes 12 bytes.
`velocity` takes the first 4 bytes. `acceleration` takes the next 4,
and `frameCount` takes the last 4.

To pass data to the shader we need to prepare data to match the
memory layout `OurStruct`. To do that we need to make an `ArrayBuffer`
of 12 bytes, then setup `TypedArray` views of the correct type so we
can fill it out.

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

Above, `ourStructData` is an `ArrayBuffer` which is a chunk of memory.
To look at the contents of this memory we an create views of it.
`ourStructValuesAsF32` is a view of the memory as 32bit floating point
values. `ourStructValuesAsU32` is a view of **the same memory** as
32bit unsigned integer values.

Now that we have a buffer and 2 views we can set the data in the structure.

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // an integer value
```

Note, like many things in programming there are multiple ways we could
do this. `TypeArray`s have a constructor that takes various forms. For example

* `new Float32Array(12)`

   This version makes a **new** `ArrayBuffer`, in this case of 12 * 4 bytes. It then creates the `Float32Array` to view it.

* `new Float32Array([4, 5, 6])`

   This version makes a **new** `ArrayBuffer`, in this case of 3 * 4 bytes. It then creates the `Float32Array` to view it. And it sets the initial values
   to 4, 5, 6.

   Note you can also pass another `TypedArray`. For example

   `new Float32Array(someUint8ArrayOf6Values)` will make a **new** `ArrayBuffer` of size 6 * 4, then create a `Float32Array` to view it,
   then copy the values from the existing view
   into the new `Float32Array`. The values are copied by number, not in binary.
   In other words, they are copied like this

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

* `new Float32Array(someArrayBuffer)`

   This is the case we used before. A new `Float32Array` view is made on an
   **existing buffer**.

* `new Float32Array(someArrayBuffer, byteOffset)`

   This makes a new `Float32Array` on an **existing buffer** but starts
   the view at `byteOffset`

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   This makes a new `Float32Array` on an **existing buffer**. The view
   starts at `byteOffset` and is `length` units long. So if we passed 3
   or length the view would be 3 float32 values long (12 bytes) of
   `someArrayBuffer`

Using this last form we could change the code above to this

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

Further, every `TypedArray` has the following properties

* `length`: number of units
* `byteLength`: size in bytes
* `byteOffset`: offset in the `TypeArray`'s `ArrayBuffer`
* `buffer`: the `ArrayBuffer` this `TypeArray` is viewing 

And `TypeArray`s have various methods, many are similar to `Array` but
one that is not is `subarray`. It creates a new `TypedArray` view
of the same type. Its parameters are `subarray(begin, end)` were
`end` is not included. So `someTypedArray.subarray(5, 10)` makes
a new `TypedArray` of **the same `ArrayBuffer`** of elements 5 to 9
of `someTypedArray`.

So we could change the code above to this

```js
const kOurStructSizeFloat32Units =
  1 + // velocity
  1 + // acceleration
  1 ; // frameCount
const ourStructData = new Float32Array(kOurStructSizeFloat32Units)
const velocityView = ourStructData.subarray(0, 1)
const accelerationView = new Float32Array(ourStructData, 1, 2);
const frameCountView = new Uint32Array(ourStructData, 2, 3);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

[WGSL](webgpu-wgsl.html) has types made from the 4 base types.
They are:

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><td>type</td><td>description</td><td>short name</td><tr>
    </thead>
    <tbody>
      <tr><td><code>vec2&lt;f32&gt;</code></td></td><td>a type with 2  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td></td><td>a type with 2  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td></td><td>a type with 2  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td></td><td>a type with 2  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td></td><td>a type with 3  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td></td><td>a type with 3  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td></td><td>a type with 3  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td></td><td>a type with 3  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td></td><td>a type with 4  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td></td><td>a type with 4  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td></td><td>a type with 4  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td></td><td>a type with 4  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td></td><td>a matrix of 2 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td></td><td>a matrix of 3 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td></td><td>a matrix of 4 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

Given that a `vec3f` is a type with 3 `f32`s and
`mat4x4f` is an 4x4 matrix of `f32`s, so it's 16 `f32`s,
what do think the following struct looks like in memory?

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

Ready?

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

What's up with that? It turns out every type as alignment requirements.
For a given type it must be aligned to a multiple of a certain number
of bytes.

Here are the sizes and alignments of the various types.

<div class="webgpu_center data-table"><div data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div></div>

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
[here's a page that will compute the offsets for you](wgsl-offset-computer.html)

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
