Title: WebGPU WGSL
Description: WebGPU 셰이딩 언어 개요
TOC: WGSL

WGSL에 대한 보다 상세한 개요는 [Tour of WGSL](https://google.github.io/tour-of-wgsl/)을 참고하세요.
[실제 WGSL 명세](https://www.w3.org/TR/WGSL/)도 있는데, [언어 대법관들](http://catb.org/jargon/html/L/language-lawyer.html)이 작성한 것이라 이해하기 좀 어려울 수 있습니다 😂

이 글은 여러분이 프로그래밍을 할 줄 안다고 가정합니다. 
내용이 좀 간결하게 작성되어 있지만 그래도 WGSL 셰이더 프로그래밍에 약간이나마 도움을 줄 것입니다.

## WGSL은 강타입(strictly typed)

자바스크립트와는 다르게 WGSL은 모든 변수, 구조체, 필드, 함수 매개변수와 반환형의 타입을 알아야만 합니다. 
TypeScript, Rust, C++, C#, Java, Swift, Kotlin 등을 써보셨다면 익숙하실 겁니다.

### 기본 타입(plain types)

WGLS의 *기본* 타입은 아래와 같습니다.

* `i32` 32비트 부호있는 정수(signed integer)
* `u32` 32비트 부호없는 정수(unsigned integer)
* `f32` 32비트 부동소수점(floating point number)
* `bool` 불리언(boolean) 값
* `f16` 16비트 부동소수점 (이는 선택적 기능으로 요구한 경우에만 사용 가능)
  
### 변수의 선언

자바스크립트에서는 변수와 함수를 아래와 같이 선언합니다.

```js
var a = 1;
let c = 3;
function d(e) { return e * 2; }
```

WGSL에서는 아래와 같습니다.

```wgsl
var a: f32 = 1;
let c: f32 = 3;
fn d(e: f32) -> f32 { return e * 2; }
```

위 예시에서 중요한 점은 `: f32`처럼 변수의 선언에 `: <type>`를 추가해야만 하고, 함수 선언시에는 `-> <type>`가 필요하다는 것입니다.

### auto 타입

WGSL에는 변수를 위한 *지름길*이 있습니다. 
타입스크립트처럼 변수의 타입을 명시하지 않은 경우 자동으로 표현식(expression) 우측과 같은 타입으로 간주됩니다.

```wgsl
fn foo() -> bool { return false; }

var a = 1;     // a is an i32
let b = 2.0;   // b is an f32
var c = 3u;    // c is a u32
var d = foo(); // d is bool
```

### 타입 변환

강타입이기 때문에 타입의 변환이 필요한 경우가 있습니다.

```wgsl
let a = 1;     // a is an i32
let b = 2.0;   // b is a f32
*let c = a + b; // ERROR can't add an i32 to an f32
```

위와 같은 오류는 한쪽을 다른 타입으로 변환하여 수정할 수 있습니다.

```wgsl
let a = 1;     // a is an i32
let b = 2.0;   // b is a f32
let c = f32(a) + b; // ok
```

하지만 WGSL은 "AbstractInt"와 "AbstractFloat"이라는 것이 존재합니다. 
이들은 아직 타입이 정해지지 않은 숫자라고 보시면 됩니다. 
이는 컴파일 시점에 사용 가능한 기능입니다. 
(*역주: 컴파일 시점에 evaluation이 되어야 한다는 의미*)

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

## WGSL과 자바스크립트에서 `let` `var` `const`의 의미가 다름

자바스크립트에서 `var`은 함수 범위(scope)내의 변수를 의미합니다. 
`let`은 블럭 범위 내의 변수를 의미합니다. 
`const`는 블럭 범위의 상수 (값이 변할 수 없음)[^references]를 의미합니다.

[^references]: 자바스크립트의 변수는 `undefined`, `null`, `boolean`, `number`, `string`, `reference-to-object`의 기본 타입을 갖습니다. 
프로그래밍을 처음 하시는 분은 `o`가 상수로 선언되었는데 `const o = {name: 'foo'}; o.name = 'bar';`가 동작한다는 사실 때문에 헷갈리실 수 있습니다. 
`o`는 상수가 맞습니다. 이는 객체에 대한 상수 참조입니다. 
`o`가 참조하는 객체를 바꿀 수는 없지만 객체 자체를 바꿀수는 있습니다.

WGSL에서 모든 변수는 블럭 범위 안에 있습니다. 
`var`은 저장 공간이 있는 뮤터블(mutable) 변수입니다. 
`let`은 상수입니다.

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // ERROR: a is a constant expression
  var b = 2;
  b = b + 1;  // ok
}
```

`const`는 변수가 아니고 컴파일 시점의 상수입니다. (*역주: C++의 constexpr*) 
런타임에 정해지는 값에 대해 `const`를 선언할 수는 없습니다.

```wgsl
const one = 1;              // ok
const two = one * 2;        // ok
const PI = radians(180.0);  // ok

fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // ERROR! const can only be used with compile time expressions
  return result;
}
```

## 벡터(vector) 타입

WGSL에는 `vec2`, `vec3`, `vec4` 세 개의 벡터 타입이 있습니다. 
기본 스타일은 `vec?<type>`여서 `vec2<i32>`는 두 개의 i32를 갖는 벡터, `vec3<f32>`는 세 개의 f32를 갖는 벡터, `vec4<u32>`는 네 개의 u32를 갖는 벡터, `vec3<bool>`는 불리언 세 개를 갖는 벡터입니다.

예시는 아래와 같습니다:

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10, 11, 12);
```

### 접근자(accessors)

벡터 내부의 값들은 다양한 접근자로 접근이 가능합니다.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.z;   // via x,y,z,w
let c = a.b;   // via r,g,b,a
let d = a[2];  // via array element accessors
```

위에서 `b`, `c`, `d`는 모두 같은 값입니다. 
이 셋 모두 `a`의 세 번째 요소에 접근하는 것이어서, 값은 3입니다.

### swizzles

하나 이상의 요소에 접근할 수도 있습니다.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.zx;   // via x,y,z,w
let c = a.br;   // via r,g,b,a
let d = vec2<f32>(a[2], a[0]);
```

위에서 `b`, `c`, `d`는 모두 같은 값입니다. 
모두 `vec2<f32>(3, 1)`입니다.

요소를 반복할 수도 있습니다.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec3<f32>(a.z, a.z, a.y);
let c = a.zzy;
```

위에서 `b`, `c`는 같은 값입니다. 
요소가 3,3,2인 `vec3<f32>`입니다.

### 벡터 단축어(shortcuts)

기본 타입에 대한 단축어가 존재합니다.
`<i32>`를 `i`로, `<f32>`를 `f`로, `<u32>`를 `u`로, `<f16>`를 `h`로 단축합니다.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a` and `b`는 동일한 타입입니다.

### 벡터 생성(construction)

벡터는 보다 작은 타입을 기반으로 생성될 수 있습니다.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
let d = vec4f(1, a.yz, 4);
let e = vec4f(a.xyz, 4);
let f = vec4f(1, a.yzw);
```

`a`, `c`, `d`, `e`, `f`는 모두 같습니다.

### 벡터 연산

벡터에 대한 연산이 가능합니다.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // c is vec4f(6, 8, 10, 12)
let d = a * b;  // d is vec4f(5, 12, 21, 32)
let e = a - b;  // e is vec4f(-4, -4, -4, -4)
```

많은 함수들이 벡터에 대해서도 동작합니다.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);                   // c is vec4f(3, 4, 5, 6)
let d = mix(a, b, vec4f(0, 0.5, 0.5, 1)); // d is vec4f(1, 4, 5, 8)
```

## 행렬

WGSL에는 다양한 행렬 타입이 있습니다. 행렬은 벡터의 배열입니다. 
포맷은 `mat<numVectors>x<vectorSize><<type>>`와 같아서, 예를들면 `mat3x4<f32>`는 `vec4<f32>` 세 개로 이루어진 배열입니다. 
벡터처럼 행렬도 단축어가 있습니다.

```wgsl
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a`와 `b`는 같은 타입입니다.

### 행렬의 벡터 접근

행렬의 벡터를 참조하려면 배열 문법을 쓰면 됩니다.

```wgsl
let a = mat4x4f(...);
let b = a[2];   // b is a vec4f of the 3rd vector of a
```

3차원 계산에서 가장 흔히 사용되는 행렬 타입은 `mat4x4f`이고 `vec4f`를 곱하게 되면 `vec4f`가 도출됩니다.

```wgsl
let a = mat4x4f(....);
let b = vec4f(1, 2, 3, 4);
let c = a * b;  // c is a vec4f and the result of a * b
```

## 배열

WGSL의 배열은 `array<type, numElements>` 문법으로 선언합니다.

```wgsl
let a = array<f32, 5>;   // an array of five f32s
let b = array<vec4f, 6>; // an array of six vec4fs
```

다른 `array` 생성자(constructor)도 있습니다. 
인자를 원하는 만큼 넣으면 배열을 반환해 줍니다. 
인자는 모두 같은 타입이어야 합니다.

```wgsl;
let arrOf3Vec3fsA = array(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
let arrOf3Vec3fsB = array<vec3f, 3>(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
```

위에서 `arrOf3Vec3fsA`와 `arrOf3Vec3fsB`는 같습니다.

안타깝게도, WGSL 버전 1에서는 배열의 크기를 얻는 방법은 없습니다.

### 런타임에 크기가 정해지는 배열

루트 범위 스토리지 선언이나 루트 범위 구조체의 마지막 필드에 있는 배열만 크기를 지정하지 않아도 됩니다.

```wgsl
struct Stuff {
  color: vec4f,
  size: f32,
  verts: array<vec3f>,
};
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;
```

`foo`와 `bar.verts`의 요소 갯수는 런타임에 사용된 바인드 그룹의 설정에 따라 정해집니다. 

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Stuff;

...
  let numMatrices = arrayLength(&foo);
  let numVerts = arrayLength(&bar.verts);
```

## 함수

WGSL의 함수는 `fn name(parameters) -> returnType { ..body... }`와 같은 패턴을 따릅니다.

```wgsl
fn add(a: f32, b: f32) -> f32 {
  return a + b;
}
```

## 진입점(entry points)

WGSL 프로그램은 진입점이 필요합니다. 
진입점은 `@vertex`, `@fragment` 또는`@compute`로 지정됩니다.

```wgsl
@vertex fn myFunc(a: f32, b: f32) -> @builtin(position): vec4f {
  return vec4f(0, 0, 0, 0);
}
```

## 셰이더는 진입점이 접근하는 것들만 사용함

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

위에서 `uni`는 `vs1`에서는 접근하고 있지 않으므로 `vs1`을 파이프라인에서 사용할 때에는 바인딩이 필요하지 않습니다. 
`vs2`는 `foo` 호출을 통해 `uni`를 간접적으로 참조하므로 `vs2`를 파이프라인에서 사용할 때에는 `uni`의 바인딩이 필요합니다.

## 어트리뷰트(attributes)

WebGPU에서 *어트리뷰트*는 두 가지 의미를 가집니다. 
하나는 *정점 어트리뷰트*로 [정점 버퍼에 관한 글](webgpu-vertex-buffers.html)에서 설명한 것과 같습니다. 
다른 하나는 WGSL에서 `@`로 시작하는 어트리뷰트입니다.

### `@location(number)`

`@location(number)`는 셰이더의 입력과 출력을 정의할 떄 사용됩니다.

#### 정점 셰이더 입력

정점 셰이더에서, 입력값은 정점 셰이더의 진입점 함수의 `@location` 어트리뷰트를 통해 정의됩니다.

```wgsl
@vertex vs1(@location(0) foo: f32, @location(1) bar: vec4f) ...

struct Stuff {
  @location(0) foo: f32,
  @location(1) bar: vec4f,
};
@vertex vs2(s: Stuff) ...
```

`vs1`와 `vs2` 모두 정점 셰이더의 입력값을 location 0과 1을 통해 선언하고 있으며 이 값들은 [정점 버퍼](webgpu-vertex-buffers.html)를 통해 전달되어야 합니다.

#### 스테이지간 변수

스테이지간 변수에서 `@location` 어트리뷰트는 셰이더간 전달되는 변수의 location을 명시합니다.

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

위에서 정점 셰이더 `foo`는 `vec4f`인 `color`를 `location(0)`에, `vec2f`인 `texcoords`를 `location(1)`에 전달하고 있습니다.
프래그먼트 셰이더 `bar`는 이 값들을 location이 일치하는 `uv`와 `diffuse`로 받고 있습니다.

#### 프래그먼트 셰이더 출력값

프래그먼트 셰이더의 `@location`은 어떤 `GPURenderPassDescriptor.colorAttachment`에 출력값을 저장할지를 명시합니다.

```wgsl
struct FSOut {
  @location(0) albedo: vec4f;
  @location(1) normal: vec4f;
}
@fragment fn bar(...) -> FSOut { ... }
```

### `@builtin(name)`

`@builtin` 어트리뷰트는 특정 변수의 값이 WebGPU의 내장(built-in) 기능에 의해 전달된다는 의미입니다.

```wgsl
@vertex fn vs1(@builtin(vertex_index) foo: u32, @builtin(instance_index) bar: u32) ... {
  ...
}
```

위에서 `foo`는 내장된 `vertex_index`로부터, `bar`는 내장된 `instance_index`로부터 값을 얻어옵니다.

```wgsl
struct Foo {
  @builtin(vertex_index) vNdx: u32,
  @builtin(instance_index) iNdx: u32,
}
@vertex fn vs1(blap: Foo) ... {
  ...
}
```

위에서 `blap.vNdx`는 내장된 `vertex_index`로부터, `blap.iNdx`는 내장된 `instance_index`로부터 값을 얻어옵니다.

<div class="webgpu_center center data-table">
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
       현재 API 수준의 드로우 커맨드에서의 현재 정점의 인덱스로, 드로우 인스턴싱에 독립적인 값
       <p>인덱스를 사용하지 않는 드로우에서는 첫 번째 정점의 인덱스는 드로우 함수의 <code>firstVertex</code> 인자와 같으며 이는 직접 또는 간접적으로 명시됨.
         인덱스는 드로우 인스턴스의 각 추가 정점마다 1씩 증가함.</p>
       <p>인덱스를 사용하는 드로우에서는 정점에 대한 인덱스 버퍼의 입력에 드로우 함수의 <code>baseVertex</code> 인자를 더한 값으로, 이 값은 직접 또는 간접적으로 명시됨.</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-instance_index">instance_index</dfn> </td>
      <td>vertex </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">
       현재 API 수준 드로우 커맨드의 현재 정점의 인스턴스 인덱스.
       <p>첫 인스턴스늬 인덱스는 드로우 함수의 <code>firstInstance</code>인자와 같은 값으로, 이 값는 직접 또는 간접적으로 명시됨.
        인덱스는 드로우에서의 추가 인스턴스마다 1씩 증가함.</p></td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>vertex </td>
      <td>output </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">동차(homogeneous) 좌표로 표현된 현재 정점의 출력 위치.
      동차 정규화 (<em>w</em> 값으로 <em>x</em>, <em>y</em>, <em>z</em> 값을 나누는 것) 이후에는 WebGPU의 정규화된 장치 좌표계(NDC) 값이 됨.
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a> 참고. </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>input </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">현재 프래그먼트의 <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#framebuffer" id="ref-for-framebuffer">framebuffer</a>공간에서의 위치.
      (<em>x</em>, <em>y</em>, <em>z</em> 요소는 <em>w</em>가 1이 되도록 조정된 상태)
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a> 참고. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-front_facing">front_facing</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>bool </td>
      <td style="width:50%">현재 프래그먼트가 <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#front-facing" id="ref-for-front-facing">front-facing</a>인 프리미티브(primitive)의 일부일 경우 참, 아니라면 거짓.</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-frag_depth">frag_depth</dfn> </td>
      <td>fragment </td>
      <td>output </td>
      <td>f32 </td>
      <td style="width:50%">뷰포트의 깊이 범위로 변환된 프래그먼트의 깊이값.
      <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a> 참고. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_id">local_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">현재 호출(invocation)에 대한 <a data-link-type="dfn" href="#local-invocation-id" id="ref-for-local-invocation-id①">local invocation ID</a>, 즉<a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid①">workgroup grid</a>에서의 위치. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_index">local_invocation_index</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">현재 호출에 대한 <a data-link-type="dfn" href="#local-invocation-index" id="ref-for-local-invocation-index">local invocation index</a>, <a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid②">workgroup grid</a>에서의 호출 위치를 선형화한 인덱스. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-global_invocation_id">global_invocation_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">현재 호출에 대한 <a data-link-type="dfn" href="#global-invocation-id" id="ref-for-global-invocation-id">global invocation ID</a>, 즉, <a data-link-type="dfn" href="#compute-shader-grid" id="ref-for-compute-shader-grid">compute shader grid</a>에서의 위치. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-workgroup_id">workgroup_id</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">현재 호출에 대한 <a data-link-type="dfn" href="#workgroup-id" id="ref-for-workgroup-id">workgroup ID</a>, 즉, <a data-link-type="dfn" href="#workgroup-grid" id="ref-for-workgroup-grid③">workgroup grid</a>에서 워크그룹(workgroup)의 위치. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-num_workgroups">num_workgroups</dfn> </td>
      <td>compute </td>
      <td>input </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%"> API에 의해<a href="https://www.w3.org/TR/webgpu/#compute-pass-encoder-dispatch">dispatched</a> 된 컴퓨트 셰이더의 <a data-link-type="dfn" href="#dispatch-size" id="ref-for-dispatch-size">dispatch size</a>, <code>vec&lt;u32&gt;(group_count_x, group_count_y, group_count_z)</code>.</td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_index">sample_index</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">현재 프래그먼트의 샘플 인덱스.
        이 값은 최소 0이고 최대 <code>sampleCount</code>-1. <code>sampleCount</code>는 GPU 렌더링 파이프라인에 명시된 MSAA 샘플의 <code class="idl"><a data-link-type="idl" href="https://www.w3.org/TR/webgpu/#dom-gpumultisamplestate-count" id="ref-for-dom-gpumultisamplestate-count">개수</a>
        <br><a href="https://www.w3.org/TR/webgpu/#gpurenderpipeline"><cite>WebGPU</cite> § 10.3 GPURenderPipeline</a> 참고. </td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_mask">sample_mask</dfn> </td>
      <td>fragment </td>
      <td>input </td>
      <td>u32 </td>
      <td style="width:50%">현재 프래그먼트의 샘플 커버리지(coverage) 마스크. 
        프리미티브가 렌더링될 때 어떤 샘플들에 의해 이 프래그먼트가 그려지는지에 대한 비트 마스크를 포함함.
        <br><a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a> 참고. </td>
    </tr>
    <tr>
      <td>fragment </td>
      <td>output </td>
      <td>u32 </td>
      <td style="width:50%">현재 프래그먼트의 샘플 커버리지 마스크 컨트롤.
        이 변수에 쓰여지는 마지막 값이 <a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#shader-output-mask" id="ref-for-shader-output-mask">shader-output mask</a>가 됨.
        쓰여진 값 중 0 비트인 것은 해당하는 샘플이 컬러 어태치먼트에서 버려짐.
        <br><a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a> 참고. </td>
    </tr>
  </tbody>
  </table>
</div>

## 흐름 제어(flow control)

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

`discard`는 셰이더를 종료합니다. 프래그먼트 셰이더에서만 사용할 수 있습니다.

### switch

```wgsl
var a : i32;
let x : i32 = generateValue();
switch x {
  case 0: {      // 콜론은 선택적입니다.
    a = 1;
  }
  default {      // default는 꼭 마지막에 나타날 필요 없음.
    a = 2;
  }
  case 1, 2, {   // 여러 selector 값을 사용 가능합니다.
    a = 3;
  }
  case 3, {      // 마지막 콤마는 선택적입니다.
    a = 4;
  }
  case 4 {
    a = 5;
  }
}
```

`switch`는 `u32` 또는 `i32`에 대해서만 사용 가능하고 case들은 상수여야 합니다.

## Operators

<div class="webgpu_center center data-table">
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

## 내장 함수

[WGSL Function reference](webgpu-wgsl-function-reference.html)를 참고하세요.

## 다른 언어와의 차이점

### `if`, `while`, `switch`, `break-if` 표현식에 괄호가 필요하지 않습니다.

```wgsl
if a < 5 {
  doTheThing();
}
```

### 삼항 연산자(ternary operator)가 없습니다.

많은 언어들에 삼항 연산자 `condition ? trueExpression : falseExpression`가 있습니다.
WGSL에는 없습니다. 대신 `select`가 있습니다.

```wgsl
  let a = select(falseExpression, trueExpression, condition);
```

### `++`와 `--`는 표현식이 아닌 명령문입니다.

많은 언어들에 *전위 증가(pre-increment)* 와 *후위 증가(post-increment)* 가 있습니다.

```js
// JavaScript
let a = 5;
let b = a++;  // b = 5, a = 6  (post-increment)
let c = ++a;  // c = 7, a = 7  (pre-increment)
```

WGSL에는 둘 다 없습니다. 
단지 증가와 감소 명령문만이 존재합니다.

```wgsl
// WGSL
var a = 5;
a++;          // is now 6
*++a;          // ERROR: 전위 증가가 없습니다.
*let b = a++;  // ERROR: a++는 표현식이 아닙니다. 명령문입니다.
```

## `+=`, `-=`는 표현식이 아닌 대입 연산자입니다.

```js
// JavaScript
let a = 5;
a += 2;          // a = 7
let b = a += 2;  // a = 9, b = 9
```

```wgsl
// WGSL
let a = 5;
a += 2;           // a is 7
*let b = a += 2;   // ERROR: a += 2 는 표현식이 아닙니다.
```

## Swizzles은 왼쪽에 올 수 없습니다.

몇몇 언어들에서는 가능하지만 WGSL에서는 안됩니다.

```
var color = vec4f(0.25, 0.5, 0.75, 1);
*color.rgb = color.bgr; // ERROR
color = vec4(color.bgr, color.a);  // Ok
```

노트: 이 기능을 추가하자는 제안은 있습니다.

## `_`로의 가짜 할당(Phony assignment)

`_`는 어떤 것이 사용되는 것처럼 보이지만 실제로는 그렇지 않은 경우에 대해, 대입을 위해 사용할 수 있는 특수한 변수입니다.

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

위에서 `uni1`이나 `uni2` 모두 `vs1`에서 접근되지 않기 때문에 파이프라인에서 `vs1`을 사용할 경우 필요한 바인딩으로 판별되지 않습니다. 
`uni1`과 `uni2` 모두 `vs2`에서는 참조하므로 파이프라인에서 `vs2`를 사용할 때에는 필요한 바인딩으로 판별합니다.

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>