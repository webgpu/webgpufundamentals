Title: WebGPU 데이터 메모리 레이아웃
Description: WebGPU를 위해 데이터를 레이아웃하고 준비하는 방법
TOC: 데이터 메모리 레이아웃

WebGPU에서 여러분이 제공하는 거의 모든 데이터는 셰이더에 정의한 것과 맞게 메모리에 레이아웃되어야 합니다.
이는 자바스크립트나 타입스크립트와의 큰 차이점인데, 이 둘에서는 메모리 레이아웃 문제가 발생할 일이 거의 없습니다.

WGSL에서 셰이더를 작성할 때 `struct`를 정의하는 것이 일반적입니다.
구조체(struct)는 자바스크립트의 객체와 비슷하게 멤버를 선언할 수 있는데 이는 자바스크립트 객체의 속성(property)와 비슷합니다.
하지만 각 속성의 이름에 앞서 타입을 지정해 주어야 합니다.
**또한** 데이터를 제공할 때에 버퍼의 어느 부분에 구조체의 어떤 멤버가 있을지를 명시하는 작업은 **여러분이 직접 해야 합니다**.

[WGSL](webgpu-wgsl.html) v1에는 네 가지 기본 타입이 있습니다.

* `f32` (32비트 부동소수점)
* `i32` (32비트 정수)
* `u32` (32비트 부호없는 정수)
* `f16` (16비트 부동소수점) [^f16-optional]

[^f16-optional]: `f16` 지원은 [선택적 기능](webgpu-limits-and-features.html)입니다.

바이트(byte)는 8비트이므로 32비트는 4바이트이고 16비트는 2바이트입니다.

아래와 같은 구조체를 선언했다고 합시다.

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

구조체를 가시적으로 표현하면 아래와 같습니다.

<div class="webgpu_center" data-diagram="ourStructV1"></div>

각 사각형 블럭은 바이트를 의미합니다.
위에서 데이터가 12바이트를 차지하는 것을 볼 수 있습니다.
`velocity`는 첫 4바이트고, `acceleration`은 다음 4바이트, `frameCount`는 마지막 4바이트입니다.

셰이더에 데이터를 넘겨주기 위해서는 `OurStruct`에 맞는 메모리 레이아웃을 준비해야 합니다.
그러기 위해서 12바이트의 `ArrayButter`를 만들고 데이터를 채울 수 있도록 올바른 타입의 `TypedArray` 뷰(view)를 설정해야 합니다.

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

위에서 `ourStructData`는 메모리의 덩어리(chunk)인 `ArrayBuffer`입니다.
이 메모리 안의 내용을 보기 위해서는 뷰를 만들어야 합니다.
`ourStructValuesAsF32`는 메모리를 32비트 부동소수점 값으로 보는 뷰입니다.
`ourStructValuesAsU32`는 **동일한 메모리**를 32비트 부호없는 정수값으로 보는 뷰입니다.

이제 버퍼와 두 개의 뷰가 있으니 구조체의 데이터를 설정할 수 있습니다.

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // an integer value
```

다른 모든 프로그래밍과 마찬가지로 이러한 작업은 여러가지 다른 방식으로 가능하다는 점을 유의하세요.
`TypeArray`는 여러 다른 형태의 생성자(constructor)가 있습니다. 예를 들어,

* `new Float32Array(12)`

   이 버전은 **새로운(new)** `ArrayBuffer`를 만듭니다. 이 경우에는 12 * 4바이트입니다. 그리고 `Float32Array` 뷰를 만듭니다.
   
* `new Float32Array([4, 5, 6])`

   이 버전은 **새로운** `ArrayBuffer`를 만들고 이 경우 3 * 4 바이트입니다. 그리고 `Float32Array` 뷰를 만듭니다. 또한 초기값으로 4, 5, 6을 설정합니다.
   
   또다른 `TypedArray`를 넘겨줄 수도 있습니다. 예를들어,

   `new Float32Array(someUint8ArrayOf6Values)`는 **새로운** 6 * 4 크기의 `ArrayBuffer`를 만듭니다. 그리고 `Float32Array` 뷰를 만든 뒤 기존 뷰로부터 값을 새로운 `Float32Array`에 복사합니다. 복사되는 값은 바이너리가 아닌 숫자입니다.
   다시 말해 아래와 같이 복사되는 것입니다.
   
   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

* `new Float32Array(someArrayBuffer)`

   이것이 우리가 사용한 방식입니다. **기존 버퍼**에 대해 새로운 `Float32Array` 뷰가 만들어집니다.
   
* `new Float32Array(someArrayBuffer, byteOffset)`

   **기존 버퍼**에 새로운 `Float32Array`를 만들지만 뷰는 `byteOffset`부터 시작됩니다.
   
* `new Float32Array(someArrayBuffer, byteOffset, length)`

   **기존 버퍼**에 새로운 `Float32Array`를 만듭니다. 뷰는 `byteOffset`에서부터 `length`만큼의 길이를 가집니다. 만일 우리가 길이(length)로 3을 넘겨준다면 `someArrayBuffer`에 대한 3개의 float32값 길이만큼 (12바이트만큼)의 뷰를 갖게 됩니다.
   
제일 마지막 방법으로 우리는 위 코드를 아래와 같이 바꿀 수 있습니다.

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

또한 모든 `TypedArray`는 아래와 같은 속성을 갖습니다.

* `length`: 유닛(unit)의 개수
* `byteLength`: 바이트 크기
* `byteOffset`: `TypeArray`의 `ArrayBuffer`의 오프셋(offset)
* `buffer`: 이 `TypeArray`가 보는(viewing) `ArrayBuffer`

`TypeArray`는 다양한 메소드(method)가 있는데 대부분은 `Array`와 유사하지만 하나 다른 것은 `subarray`입니다.
이는 동일한 타입에 대해 새로운 `TypedArray` 뷰를 만듭니다.
매개변수는 `subarray(begin, end)`와 같은 형태이고 `end`는 결과에 포함되지 않습니다.
따라서 `someTypedArray.subarray(5, 10)`는 **동일한 `ArrayBuffer`**에 대한 새로운 `TypedArray`를 만드는데 `someTypedArray`의 다섯 번째에서부터 아홉 번째까지의 요소를 갖습니다.

따라서 위 코드를 아래와 같이 바꿀 수 있습니다.

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

[WGSL](webgpu-wgsl.html)는 네 개의 기본 타입으로부터 만들어진 타입들이 있습니다. 아래와 같습니다:

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

`vec3f`는 세 개의 `f32`로 이루어진 타입이고 `mat4x4f`는 `f32`로 이루어진 4x4 행렬이며 따라서 16개의 `f32`로 이루어져 있습니다.
그러면 아래와 같은 구조체는 메모리에 있을 때 어떻게 보일까요?

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

예상해 보셨나요?

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

이건 뭘까요? 사실은 모든 타입에 대해 정렬(alignment)가 필요합니다.
주어진 타입은 특정 바이트의 배수로 정렬되어야만 합니다.

아래는 여러 타입들의 크기와 정렬을 표로 나타낸 것입니다.

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

여기서 끝이 아닙니다!

아래 구조체는 어떤 레이아웃이 될 것 같으신가요?

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

`array<type, count>` 문법은 `type`이 `count`개 있는 배열을 정의하는 문법입니다.

한번 보죠...

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

정렬 테이블을 보면 `vec3<f32>`는 16바이트 정렬인 것을 볼 수 있습니다.
즉, `vec3<f32>`는 그것이 행렬 안에 있건 배열에 있건 부가적인 공간을 차지하고 있게 된다는 뜻입니다.

아래 다른 예제가 더 있습니다.

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

왜 `size`는 오프셋 12로 orientation바로 뒤에 놓여있는데 `scale`과 `friction`은 32와 64에 각각 있는걸까요?

이는 배열과 구조체가 각각의 고유한 정렬 규칙이 있기 때문입니다.
배열이 단일 `vec3f`로 이루어져 있거나 `Ex4a` 처럼 단일 `vec3f`로 이루어져 있어도 다른 규칙이 적용되기 때문입니다. (*역주: orientation, direction, info 모두 vec3f지만 orientation과 direction/info는 서로 다른 규칙이 적용됨*)

# 오프셋과 사이즈 계산은 골치아픕니다!

WGSL에서 데이터의 크기와 오프셋을 계산하는 부분이 아마 WebGPU에서 가장 골치아픈 부분일겁니다.
이러한 로프셋을 직접 계산하고 갱신해야 합니다.
구조체 중간에 멤버를 추가하게되면 자바스크립트로 돌아가 모든 오프셋을 갱신해 주어야 합니다.
바이트나 길이 하나만 잘못되어도 셰이더에 전달되는 데이터가 틀리게 됩니다.
오류가 발생하진 않지만 셰이더가 잘못된 데이터를 참조함으로써 의도하지 않은대로 동작하게 될겁니다.
모델이 그려지지 않거나, 계산 결과가 잘못되거나 하겠죠.

다행히 이러한 것을 도와주는 라이브러리가 있습니다.

그중 하나는 이겁니다: [webgpu-utils](https://github.com/greggman/webgpu-utils)

여기에 WGSL 코드를 넣으면 위와 같은 작업을 대신 해주는 API를 알려줍니다.
이렇게 하면 구조체를 변경해도 대부분 제대로 동작할 겁니다.

예를 들어 마지막 예시를 `webgpu-util`에 넣으면 아래와 같은 결과가 나옵니다.

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

// set으로 값을 설정함
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

// 이제 필요할 때 myUniformValues.arrayBuffer를 WebGPU에 넘기면 됨
```

이 라이브러리를 쓰건 다른 것을 쓰건 아니면 아무것도 쓰지 않건 여러분 마음입니다. 
저같은 경우 오프셋과 크기를 일일히 손으로 계산하다 발생한 실수 때문에 20, 30, 60분이나 왜 제대로 동작하지 않는지 이유를 찾아내려 시간을 낭비한 적이 있습니다.
그러느니 그냥 라이브러리를 쓰고 이러한 고통에서 탈출하렵니다.

그래도 직접 하는 방식을 원한다면 [이 페이지가 오프셋을 대신 계산해 줍니다](resources/wgsl-offset-computer.html).

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
