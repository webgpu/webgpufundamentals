Title: WebGPU WGSL
Description: An introduction to WebGPU Shading Language
TOC: WGSL

For an in-depth overview of WGSL see [Tour of WGSL](https://google.github.io/tour-of-wgsl/).
There's also [the actual WGSL spec](https://www.w3.org/TR/WGSL/) though it can be hard
to process since it's written for [language lawyers](http://catb.org/jargon/html/L/language-lawyer.html) 😂

This article assumes you already know how to program. It's probably way too
terse but hopefully it can give you some help in understanding and writing WGSL
shader programs.

## WGSL is strictly typed

Unlike JavaScript, WGSL requires knowing the types of every variable, struct field,
function parameter and function return type. If you've used typescript, rust, C++, C#,
Java, Swift, Kotlin, etc then you're used to this.

### plain types

The *plain* types in WGSL are

* `i32` a 32 bit signed integer
* `u32` a 32 bit unsigned integer
* `f32` a 32 bit floating point number
* `bool` a boolean value
* `f16` a 16 bit floating point number (this is an optional feature you need to check for and request)

### variable declaration

In JavaScript you can declare variables and functions like this

```js
var a = 1;
let c = 3;
function d(e) { return e * 2; }
```

In WGSL the full form of those would be

```wgsl
var a: f32 = 1;
let c: f32 = 3;
fn d(e: f32) -> f32 { return e * 2; }
```

The important thing to note from above is having to add `: <type>` like `: f32`
for the variable declarations and `-> <type>` to function declarations.

### auto types

WGSL has a *shortcut* for variables. Similar to typescript, if you don't
declare the type of the variable then it automatically becomes the type of
the expression on the right

```wgsl
fn foo() -> bool { return false; }

var a = 1;     // a is an i32
let b = 2.0;   // b is an f32
var c = 3u;    // c is a u32
var d = foo(); // d is bool
```

### type conversion

Further, being strictly type means you often have to convert types

```wgsl
let a = 1;     // a is an i32
let b = 2.0;   // b is a f32
*let c = a + b; // ERROR can't add an i32 to an f32
```

The fix is to convert one to the other

```wgsl
let a = 1;     // a is an i32
let b = 2.0;   // b is a f32
let c = f32(a) + b; // ok
```

but!, WGSL has what are called "AbstractInt" and "AbstractFloat". You can
think of them as numbers that have not yet decided their type. These
are compile time only features.

```wgsl
let a = 1;            // a is an i32
let b = 2.0;          // b is a f32
*let c = a + b;       // ERROR can't add an i32 to an f32
let d = 1 + 2.0;      // d is a f32
```

### numeric suffixes

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

## `let` `var` and `const` mean different things in WGSL vs JavaScript

In JavaScript `var` is a variable with function scope. `let` is a variable with block scope. `const` is a constant variable (can't be changed) [^references] with block scope.

[^references]: Variables in JavaScript hold base types of `undefined`, `null`, `boolean`, `number`, `string`, `reference-to-object`.
It can be confusing for people new to programming that `const o = {name: 'foo'}; o.name = 'bar';` works because `o` was declared as `const`.
The thing is, `o` is const. It is a constant reference to the object. You can not change which object `o` references. You can change object itself.

In WGSL all variables have block scope. `var` is a variable that has storage and so is mutable. `let` is a constant value.

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // ERROR: a is a constant expression
  var b = 2;
  b = b + 1;  // ok
}
```

`const` is not a variable, it's a compile time constant. You can
not use `const` for something that happens at runtime.

```wgsl
const one = 1;              // ok
const two = one * 2;        // ok
const PI = radians(180.0);  // ok

fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // ERROR! const can only be used with compile time expressions
  return result;
}
```

## vector types

WGSL has 3 vector types `vec2`, `vec3`, and `vec4`. Their basic style is `vec?<type>`
so `vec2<i32>` (a vector of two i32s), `vec3<f32>` (a vector of 3 f32s), `vec4<u32>`(a vector of 4 u32s),
`vec3<bool>` a vector of 3 boolean values.

Examples:

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10);
```

### accessors

You can access the values inside a vector with various accessors

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.z;   // via x,y,z,w
let c = a.b;   // via r,g,b,a
let d = a[2];  // via array element accessors
```

Above, `b`, `c`, and `d` are all the same. They are all accessing the 3rd element of `a`.

### swizzles

You can also access more than 1 element.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.zx;   // via x,y,z,w
let c = a.br;   // via r,g,b,a
let d = vec2<f32>(a[2], a[0]);
```

Above, `b`, `c`, and `d` are all the same.

You can also repeat elements

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec3<f32>(a.z, a.z, a.y);
let c = a.zzy;
```

Above `b` and `c` are the same. They both `vec3<f32>` who contents is 3, 3, 2

### vector shortcuts

There are shortcuts for the base types. Change the `<i32>` => `i`, `<f32>` => `f`, `<u32>` to `u` and `<f16>` to `h` so

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a` and `b` are the same type

### vector construction

vectors can be constructed with smaller types

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
let d = vec2f(1, a.yz, 4);
let e = vec2f(a.xyz, 4);
let f = vec2f(1, a.yzw);
```

`a`, `c`, `d`, `e` and `f` are the same.

### vector math

You can do math on vectors

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // c is vec4f(6, 8, 10, 12)
let d = a * b;  // d is vec4f(5, 12, 21, 32)
let e = a - b;  // e is vec4f(-4, -4, -4, -4)
```

Many functions also work on vectors

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);                   // c is vec4f(3, 4, 5, 6)
let d = mix(a, b, vec4f(0, 0.5, 0.5, 1)); // d is vec4f(1, 4, 5, 8)
```

## matrices

WGSL has a bunch of matrix types. Matrices are arrays of vectors.
The format is `mat<numVectors>x<vectorSize><<type>>` so for example
`mat3x4<f32>` is an array of 3 `vec4<32>`s. Like vectors, matrices
have the same shortcuts

```wgsl
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a` and `b` are the same type

### matrix vector access

You can reference a vector of a matrix with array syntax

```wgsl
let a = mat4x4f(...);
let b = a[2];   // b is a vec4f of the 3rd vector of a
```

The most common matrix type for 3D computation is `mat4x4f` and can be multiplied directly
with a `vec4f` to produce another `vec4f`

```wgsl
let a = mat4x4f(....);
let b = vec4f(1, 2, 3, 4);
let c = a * b;  // c is a vec4f and the result of a * b
```

## arrays

Arrays in WGSL are declared with the `array<type, numElements>` syntax

```wgsl
let a = array<f32, 5>;   // an array of five f32s
let b = array<vec4f, 6>; // an array of six vec4fs
```

But there's also the `array` constructor. It takes any number of arguments
and returns an array. The arguments must all be of the same type.

```wgsl;
let arrOf3Vec3fsA = array(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
let arrOf3Vec3fsB = array<vec3f, 3>(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
```

Above `arrOf3Vec3fsA` is the same as `arrOf3Vec3fsB`.

Unfortunately, as of version 1 of WGSL there is no way to get the size of
fixed size array.

### runtime sized arrays

Arrays that are at the root scope storage declarations
are the only arrays that can be specified with no size

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
```

The number of elements in `foo` is defined by the settings of the bind group
used at runtime. You can query this size in your WGSL with `arrayLength`.

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;

...
  let numMatrices = arrayLength(&foo);
```

## functions

Functions in WGSL follow the pattern `fn name(parameters) -> returnType { ..body... }`.

```wgsl
fn add(a: f32, b: f32) -> f32 {
  return a + b;
}
```

## entry points

WGSL programs need an entry point. An entry point is designated by either `@vertex`, `@fragment` or `@compute`

```wgsl
@vertex fn myFunc(a: f32, b: f32) -> @builtin(position): vec4f {
  return vec4f(0, 0, 0, 0);
}
```

## shaders only use what their entry point accesses

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

Above `uni` is not accessed by `vs1` and so will not show up as a required
binding if you use `vs1` in a pipeline. `vs2` does reference `uni` indirectly through
calling `foo` so it will show up as a required binding when using `vs2` in a pipeline.

## attributes

The word *attributes* has 2 means in WebGPU. One is *vertex attributes* which is covered in [the article on vertex buffers](webgpu-vertex-buffers.html).
The other is in WGSL where an attribute starts with `@`.

### `@location(number)`

`@location(number)` is used to defined inputs and outputs of shaders. 

#### vertex shader inputs

For a vertex shader, inputs are defined by the `@location` attributes
of the entry point function of the vertex shader

```wgsl
@vertex vs1(@location(0) foo: f32, @location(1) bar: vec4f) ...

struct Stuff {
  @location(0) foo: f32,
  @location(1) bar: vec4f,
};
@vertex vs2(s: Stuff) ...
```

Both `vs1` and `vs2` declare inputs to the vertex shader on locations 0 and 1 which need to be supplied by [vertex buffers](webgpu-vertex-buffers.html).

#### inter stage variables

For inter stage variables, `@location` attributes define the location where the variables are passed between shaders

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

Above, the vertex shader `foo` passes `color` as `vec4f` on `location(0)` and `texcoords` as a `vec2f` on `location(1)`.
The fragment shader `bar` receives them as `uv` and `diffuse` because their locations match.

#### fragment shader outputs

For fragment shaders `@location` specifies which `GPURenderPassDescriptor.colorAttachment` to store the result in.

```wgsl
struct FSOut {
  @location(0) albedo: vec4f;
  @location(1) normal: vec4f;
}
@fragment fn bar(...) -> FSOut { ... }
```

### `@builtin(name)`

The `@builtin` attribute is used to specify that a particular variable's value comes
from a built-in feature of WebGPU

```wgsl
@vertex fn vs1(@builtin(vertex_index) foo: u32, @builtin(instance_index) bar: u32) ... {
  ...
}
```

Above `foo` gets its value from the builtin `vertex_index` and `bar` gets its value from `instance_index`

```wgsl
struct Foo {
  @builtin(vertex_index) vNdx: u32,
  @builtin(instance_index) iNdx: u32,
}
@vertex fn vs1(blap: Foo) ... {
  ...
}
```

Above `blap.vNdx` gets its value from the builtin `vertex_index` and `blap.iNdx` gets its value from `instance_index`

<div class="webgpu-center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>Builtin Name</th>
      <th>Stage</th>
      <th>IO</th>
      <th>Type</th>
      <th>Description </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-vertex_index">vertex_index</dfn> </td>
      <td>vertex </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">
       Index of the current vertex within the current API-level draw command,
         independent of draw instancing. 
       <p>For a non-indexed draw, the first vertex has an index equal to the <code>firstVertex</code> argument
         of the draw, whether provided directly or indirectly.
         The index is incremented by one for each additional vertex in the draw instance.</p>
       <p>For an indexed draw, the index is equal to the index buffer entry for the
         vertex, plus the <code>baseVertex</code> argument of the draw, whether provided directly or indirectly.</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-instance_index">instance_index</dfn> </td>
      <td>vertex </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">
       Instance index of the current vertex within the current API-level draw command. 
       <p>The first instance has an index equal to the <code>firstInstance</code> argument of the draw,
         whether provided directly or indirectly.
         The index is incremented by one for each additional instance in the draw.</p></td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>vertex </td>
      <td>output </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">Output position of the current vertex, using homogeneous coordinates.
      After homogeneous normalization (where each of the <em>x</em>, <em>y</em>, and <em>z</em> components
      are divided by the <em>w</em> component), the position is in the WebGPU normalized device
      coordinate space.
      See <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>input </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">Framebuffer position of the current fragment in <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#framebuffer" id="ref-for-framebuffer">framebuffer</a> space.
      (The <em>x</em>, <em>y</em>, and <em>z</em> components have already been scaled such that <em>w</em> is now 1.)
      See <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-front_facing">front_facing</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>bool </td>
      <td style="width:50%">True when the current fragment is on a <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#front-facing" id="ref-for-front-facing">front-facing</a> primitive.
         False otherwise. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-frag_depth">frag_depth</dfn> </td>
      <td>fragment </td>
      <td>output </td>
      <td>f32 </td>
      <td style="width:50%">Updated depth of the fragment, in the viewport depth range.
      See <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_id">local_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">The current invocation’s <a data-link-type="dfn" href="#local-invocation-id" id="ref-for-local-invocation-id①">local invocation ID</a>,
            i.e. its position in the <a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid①">workgroup grid</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_index">local_invocation_index</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">The current invocation’s <a data-link-type="dfn" href="#local-invocation-index" id="ref-for-local-invocation-index">local invocation index</a>, a linearized index of
          the invocation’s position within the <a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid②">workgroup grid</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-global_invocation_id">global_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">The current invocation’s <a data-link-type="dfn" href="#global-invocation-id" id="ref-for-global-invocation-id">global invocation ID</a>,
          i.e. its position in the <a data-link-type="dfn" href="#compute-shader-grid" id="ref-for-compute-shader-grid">compute shader grid</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-workgroup_id">workgroup_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">The current invocation’s <a data-link-type="dfn" href="#workgroup-id" id="ref-for-workgroup-id">workgroup ID</a>,
          i.e. the position of the workgroup in the <a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid③">workgroup grid</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-num_workgroups">num_workgroups</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">The <a data-link-type="dfn" href="#dispatch-size" id="ref-for-dispatch-size">dispatch size</a>, <code>vec&lt;u32&gt;(group_count_x, group_count_y, group_count_z)</code>, of the compute shader <a href="https://www.w3.org/TR/webgpu/#compute-pass-encoder-dispatch">dispatched</a> by the API. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_index">sample_index</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">Sample index for the current fragment.
         The value is least 0 and at most <code>sampleCount</code>-1, where <code>sampleCount</code> is the MSAA sample <code class="idl"><a data-link-type="idl" href="https://www.w3.org/TR/webgpu/#dom-gpumultisamplestate-count" id="ref-for-dom-gpumultisamplestate-count">count</a></code> specified for the GPU render pipeline. <br>See <a href="https://www.w3.org/TR/webgpu/#gpurenderpipeline"><cite>WebGPU</cite> § 10.3 GPURenderPipeline</a>. </td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_mask">sample_mask</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">Sample coverage mask for the current fragment.
         It contains a bitmask indicating which samples in this fragment are covered
         by the primitive being rendered. <br>See <a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>output </td>
      <td>u32 </td>
      <td style="width:50%">Sample coverage mask control for the current fragment.
         The last value written to this variable becomes the <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#shader-output-mask" id="ref-for-shader-output-mask">shader-output mask</a>.
         Zero bits in the written value will cause corresponding samples in
         the color attachments to be discarded. <br>See <a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
  </tbody>
  </table>
</div>

## flow control

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

`discard` exits the shader. It can only be used in a fragment shader

### switch

```wgsl
var a : i32;
let x : i32 = generateValue();
switch x {
  case 0: {      // The colon is optional
    a = 1;
  }
  default {      // The default need not appear last
    a = 2;
  }
  case 1, 2, {   // Multiple selector values can be used
    a = 3;
  }
  case 3, {      // The trailing comma is optional
    a = 4;
  }
  case 4 {
    a = 5;
  }
}
```

`switch` only works with `u32` or `i32` and cases must be constants.

## Operators

<div class="webgpu-center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>Name </th>
      <th>Operators </th>
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

## Builtin functions

See [the WGSL Function reference](webgpu-wgsl-function-reference.html).

## Differences with other languages

### `if`, `while`, `switch`, `break-if` expressions don't need parenthesizes.

```wgsl
if a < 5 {
  doTheThing();
}
```

### no ternary operator

Many languages have a ternary operator `condition ? trueExpression : falseExpression`
WGSL does not. WGSL does have `select`

```wgsl
  let a = select(falseExpression, trueExpression, condition);
```

### `++` and `--` are statements, not expressions.

Many languages have *pre-increment* and *post-increment* operators

```js
let a = 5;
let b = a++;  // b = 5, a = 6  (post-increment)
let c = ++a;  // c = 7, a = 7  (pre-increment)
```

WGSL has neither. It just has the increment and decrement statements

```wgsl
var a = 5;
a++;          // is now 6
*++a;          // ERROR: no such thing has pre-increment
*let b = a++;  // ERROR: a++ is not an expression, it's a statement
```

## `+=`, `-=` are not expressions, they're assignment statements

```js
let a = 5;
a += 2;          // a = 7
let b = a += 2;  // a = 9, b = 9
```

```wgsl
let a = 5;
a += 2;           // a is 7
*let b = a += 2;  // ERROR: a += 2 is not an expression
```

## Swizzles can not appear on the left

In some languages but not WGSL

```
var color = vec4f(0.25, 0.5, 0.75, 1);
*color.rgb = color.bgr; // ERROR
color = vec4(color.bgr, 1);  // Ok
```

## Phony assignment to `_`

`_` is a special variable you can assign to to make something appear used but not actually use it. 

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

Above neither `uni1` nor `uni2` are accessed by `vs1` and so they will not show up as a required
bindings if you use `vs1` in a pipeline. `vs2` does reference both `uni1` and `uni2` 
so they will both show up as a required bindings when using `vs2` in a pipeline.

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>