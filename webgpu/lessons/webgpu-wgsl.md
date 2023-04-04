Title: WebGPU WGSL
Description: An introduction to WebGPU Shading Language
TOC: WGSL

For an in-depth overview of WGSL see [Tour of WGSL](https://google.github.io/tour-of-wgsl/).

This article assumes you already know how to program. We'll cover various basis to hopefully
give you some help in understanding and writing WGSL shader programs.

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

WGSL does have a *shortcut* for variables. Similar to typescript, if you don't
declare the type of the variable then it automatically becomes the type of
the expression on the right

```wgsl
var a = 1;    // a is an i32
let b = 2.0;  // b is an f32
var c = 3u;   // c is a u32
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

## `let` `var` and `const` mean different things in WGSL vs JavaScript

In JavaScript `var` is a variable with function scope. `let` is a variable with block scope. `const` is a constant variable (can't be changed) [^references]

[^references]: Variables in JavaScript hold base types of `undefined`, `null`, `boolean`, `number`, `string`, `reference-to-object`.
It can be confusing for people new to programming that `const o = {name: 'foo'}; o.name = 'bar';` works because `o` was declared as `const`.
The thing is, `o` is const. It is constant reference to the object. You can not change which object `o` references. You can object itself.

In WGSL all variables have block scope. `var` is a variable that has storage and so is mutable. `let` is a constant value.

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // ERROR: a is a constant expression
}
```

`const` is not a variable, it's a compile time constant. You can
not use `const` for something that happens at runtime.

```wgsl
fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // ERROR! const can only be used with compile time expressions
  return result;
}
```

## vector types

WGSL has 3 vector types `vec2`, `vec3`, and `vec4`. Their basic style is `vec?<type>`
so `vec2<i32>` (a vector of two i32s), `vec3<f32>` (a vector of 3 f32s), `vec4<u32>`(a vector of 4 u32s),
`vec3<bool>` a vector of boolean values.

Examples:

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10);
```

### accessors

You can access the values inside a vector with various accessors

```wgsl
let a = vec4<f32>(1, 2, 3, 4)
let b = a.z;   // via x,y,z,w
let c = a.b;   // via r,g,b,a
let d = a[2];  // via array element accessors
```

Above, `b`, `c`, and `d` are all the same. They are all accessing the 3rd element of `a`.

### swizzles

You can also access more than 1 element.

```wgsl
let a = vec4<f32>(1, 2, 3, 4)
let b = a.zx;   // via x,y,z,w
let c = a.br;   // via r,g,b,a
let d = vec2<f32>(a[2], a[0]);
```
Above, `b`, `c`, and `d` are all the same.

### vector shortcuts

There are shortcuts for the base types. Change the `<i32>` => `i`, `<f32>` => `f`, and `<u32>` to `u` so

```wgsl
let a = vec4f<32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a` and `b` are the same type

### vector construction

vectors can be constructed with smaller types

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
```

`a` and `c` are the same.

### vector math

You can do math on vectors

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // c is vec4f(6, 8, 10, 12)
let d = a * b;  // d is vec4f(6, 12, 21, 32)
let e = a - b;  // e is vec4f(-4, -4, -4, -4)
```

Many functions also work on vectors

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);  // c is vec4f(3, 4, 5, 6)
```

## matrices

WGSL has a bunch of matrix types matrices are arrays of vectors.
The format is `mat<numVectors>x<vectorSize><<type>>` so for example
`mat3x4<f32>` is an array of 3 `vec4<32>`s. Like vectors, matrices
have the same shortcuts

```
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a` and `b` are the same type

### matrix vector access

You can reference a vector of a matrix with array syntax

```
let a = mat4x4f(...);
let b = a[2];   // b is a vec4f of the 3rd vector of a
```

The most common matrix type for 3D computation is `mat4x4f` and can be multiplied directly
with a `vec4f` to produce another `vec4f`

```
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

### runtime sized arrays

Arrays that are at the root scope for uniform and storage declarations
are the only arrays that can be specified with no size

```wgsl
@group(0) @binding(0) var<uniform> foo: array<mat4x4f>;
```

The number of elements in `foo` is defined by the settings of the bind group
used at runtime

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

## flow control

This is mostly same as JavaScript, `for`, `while`, `do`, `break`, `continue`, `if`, `else` all work
as expected.

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

## Other differences

### `++` and `--` are statements, not expressions.

Most languages I've used have *pre-increment* and *post-increment* operators

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
