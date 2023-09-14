Title: WebGPU 데이터 메모리 레이아웃
Description: WebGPU를 위한 데이터 메모리 레이아웃과 준비 방법
TOC: 데이터 메모리 레이아웃

WebGPU에서는 거의 모든 데이터가 셰이더에서 정의한 것과 일치하도록 메모리에 배치되어야 합니다. 
이는 JavaScript와 TypeScript에서는 메모리 레이아웃 문제가 거의 발생하지 않는다는 점에서 큰 차이점입니다.

WGSL에서는 여러분이 셰이더를 작성할 때, `struct`(구조체)를 정의하는 것이 일반적입니다.
구조체는 JavaScript의 객체와 유사하며, JavaScript 객체의 프로퍼티를 선언하는 것과 유사하게 구조체의 멤버를 선언합니다.
그러나, 각 프로퍼티에 이름을 지정하는 것 외에도 타입을 지정해야 합니다.
**또한**, 데이터를 제공할 때 **여러분이 직접** 버퍼에서 구조체의 특정 멤버가 나타나는 위치를 계산해야 합니다.

[WGSL](webgpu-wgsl.html) v1에서는 4가지 기본 타입이 있습니다.

* `f32` (32비트 부동 소수점) - 32bit floating point number
* `i32` (32비트 정수) - 32bit integer
* `u32` (32비트 부호 없는 정수) - 32bit unsigned integer
* `f16` (16비트 부동 소수점) - 16bit floating point number [^f16-optional]

[^f16-optional]: `f16` 지원은 [선택적인 기능](webgpu-limits-and-features.html)입니다.

1바이트(byte)는 8비트(bit)입니다. 따라서 32비트는 4바이트를, 16비트는 2바이트를 차지합니다.

만약에 다음과 같은 구조체를 선언했다고 합시다.

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

이 구조체를 시각적으로 나타내보면 다음과 같습니다.

<div class="webgpu_center" data-diagram="ourStructV1"></div>

각각의 네모 블럭은 1바이트입니다. 따라서 위 그림의 데이터는 총 12바이트를 차지합니다.
`velocity`는 처음의 4바이트, `acceleration`은 그 다음 4바이트, `frameCount`가 마지막의 4바이트를 차지합니다.

셰이더에 데이터를 넘기기 위해서, 우리는 `OurStruct`의 메모리 레이아웃과 일치하도록 데이터를 준비해야 합니다.
이를 위해서는 12바이트의 `ArrayBuffer`를 만들고, 올바른 타입의 `TypedArray` 뷰를 설정하여 채워 넣어야 합니다.

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

위에서, `ourStructData`는 `ArrayBuffer`로 메모리의 한 덩어리입니다.
이 메모리의 내용을 확인하기 위해서는 뷰를 만들어야 합니다.
`ourStructValuesAsF32`는 메모리를 32비트 부동 소수점 값으로 보는 뷰입니다.
`ourStructDataAsU32`는 **동일한 메모리**를 32비트 부호 없는 정수 값으로 보는 뷰입니다.

이제 저희는 하나의 버퍼와 2개의 뷰를 가지고 있습니다. 이제 구조체의 데이터를 설정할 수 있습니다.

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // 정수값
```

유의할 것은, 이를 수행하기 위한 방법에는 수많은 방법이 존재한다는 겁니다.
`TypeArray`의 생성자는 다양한 형태를 가질 수 있습니다.

예를 들어 아래와 같습니다.

* `new Float32Array(12)`

   이는 **새로운** `ArrayBuffer`를 만듭니다. 이 경우 12 * 4바이트의 크기를 가집니다. 그리고 이를 보기 위한 `Float32Array`를 만듭니다.

* `new Float32Array([4, 5, 6])`

   이는 **새로운** `ArrayBuffer`를 만듭니다. 이 경우 3 * 4바이트의 크기를 가집니다. 그리고 이를 보기 위한 `Float32Array`를 만듭니다. 그리고 초기값을 4, 5, 6으로 설정합니다.

   다른 `TypedArray`도 전달할 수 있다는 점에 유의하세요. 예를 들어

   `new Float32Array(someUint8ArrayOf6Values)`는 **새로운** 6 * 4 바이트의 크기를 갖는 `ArrayBuffer`를 만들고, 이를 보기 위한 `Float32Array`를 만듭니다. 그리고는 기존 뷰에서 새로운 `Float32Array`로 값을 복사합니다. 이 값들은 이진값으로 복사되는 것이 아니라, 숫자로 복사됩니다. 즉, 다음과 같습니다.

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

* `new Float32Array(someArrayBuffer)`

   이건 저희가 이전에 사용해봤습니다. **기존에 있던 버퍼**를 보기 위한 새로운 `Float32Array` 뷰를 만듭니다.

* `new Float32Array(someArrayBuffer, byteOffset)`

   이는 **기존에 있던 버퍼**를 보기 위한 새로운 `Float32Array` 뷰를 만듭니다. 그러나 `byteOffset`에서부터 시작합니다.

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   이는 **기존에 있던 버퍼**를 보기 위한 새로운 `Float32Array` 뷰를 만듭니다. 뷰는 `byteOffset`에서 시작하고, `length`만큼의 크기를 갖습니다. 예를 들어, `length`에 3을 전달하면 뷰는 3개의 f32 값(=12바이트)을 갖습니다.   

이 마지막 형태를 사용하면 위쪽의 코드를 다음과 같이 변경할 수 있습니다.

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

여기에, 모든 `TypedArray`는 다음과 같은 프로퍼티를 가집니다.

* `length`: 요소의 개수
* `byteLength`: 바이트 기반의 크기
* `byteOffset`: `ArrayBuffer`에 대한 `TypeArray`의 오프셋
* `buffer`: 이 `TypeArray`가 바라보고 있는 `ArrayBuffer`

그리고 `TypeArray`는 여러 메서드를 갖고 있습니다.
많은 메서드들은 `Array`에 있는 것과 유사하지만, `subarray`는 그렇지 않습니다.
이는 동일한 타입의 새로운 `TypedArray` 뷰를 만듭니다.
파라미터는 `subarray(begin, end)`이며, `end`는 포함되지 않습니다.
따라서 `someTypedArray.subarray(5, 10)`은 `someTypedArray`의 5부터 9까지의 요소로 **동일한** `ArrayBuffer`를 갖는 새로운 `TypedArray`를 만듭니다.

따라서 위의 코드를 다음과 같이 변경할 수 있습니다.

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

[WGSL](webgpu-wgsl.html)는 4개의 기본 타입에서 비롯된 여러 타입들을 갖고 있습니다.
아래처럼요.

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
      <tr><td><code>vec2&lt;f32&gt;</code></td></td><td>2개의 <code>f32</code>를 갖는 타입</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td></td><td>2개의 <code>u32</code>를 갖는 타입</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td></td><td>2개의 <code>i32</code>를 갖는 타입</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td></td><td>2개의 <code>f16</code>를 갖는 타입</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td></td><td>3개의 <code>f32</code>를 갖는 타입</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td></td><td>3개의 <code>u32</code>를 갖는 타입</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td></td><td>3개의 <code>i32</code>를 갖는 타입</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td></td><td>3개의 <code>f16</code>를 갖는 타입</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td></td><td>4개의 <code>f32</code>를 갖는 타입</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td></td><td>4개의 <code>u32</code>를 갖는 타입</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td></td><td>4개의 <code>i32</code>를 갖는 타입</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td></td><td>4개의 <code>f16</code>를 갖는 타입</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td></td><td>2개의 <code>vec2&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td></td><td>2개의 <code>vec2&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td></td><td>2개의 <code>vec2&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td></td><td>2개의 <code>vec2&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td></td><td>2개의 <code>vec3&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td></td><td>2개의 <code>vec3&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat2x3u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td></td><td>2개의 <code>vec3&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat2x3i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td></td><td>2개의 <code>vec3&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td></td><td>2개의 <code>vec4&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td></td><td>2개의 <code>vec4&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat2x4u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td></td><td>2개의 <code>vec4&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat2x4i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td></td><td>2개의 <code>vec4&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td></td><td>3개의 <code>vec2&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td></td><td>3개의 <code>vec2&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat3x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td></td><td>3개의 <code>vec2&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat3x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td></td><td>3개의 <code>vec2&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td></td><td>3개의 <code>vec3&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td></td><td>3개의 <code>vec3&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat3x3u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td></td><td>3개의 <code>vec3&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat3x3i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td></td><td>3개의 <code>vec3&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td></td><td>3개의 <code>vec4&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td></td><td>3개의 <code>vec4&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat3x4u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td></td><td>3개의 <code>vec4&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat3x4i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td></td><td>3개의 <code>vec4&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td></td><td>4개의 <code>vec2&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td></td><td>4개의 <code>vec2&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat4x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td></td><td>4개의 <code>vec2&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat4x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td></td><td>4개의 <code>vec2&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td></td><td>4개의 <code>vec3&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td></td><td>4개의 <code>vec3&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat4x3u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td></td><td>4개의 <code>vec3&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat4x3i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td></td><td>4개의 <code>vec3&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td></td><td>4개의 <code>vec4&lt;f32&gt;</code>를 갖는 행렬</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td></td><td>4개의 <code>vec4&lt;u32&gt;</code>를 갖는 행렬</td><td><code>mat4x4u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td></td><td>4개의 <code>vec4&lt;i32&gt;</code>를 갖는 행렬</td><td><code>mat4x4i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td></td><td>4개의 <code>vec4&lt;f16&gt;</code>를 갖는 행렬</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

하나의 `vec3f`는 3개의 `f32`를 갖는 타입이고, `mat4x4f`는 `f32`의 4x4 행렬이므로, 16개의 `f32`를 갖습니다.
그렇다면 다음과 같은 구조체는 메모리에서 어떻게 보일까요?

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

답을 아시겠나요?

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

무슨 일이 있는 걸까요? 사실 모든 타입에는 요구되는 정렬(align)이 있습니다.
주어진 타입에는 특정 바이트의 배수로 정렬되어야 합니다.

다음은 다양한 타입이 갖는 크기와 정렬입니다.

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

잠깐만요. 이게 끝이 아닙니다!

아래 구조체는 어떤 레이아웃을 가질 것 같나요?

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

`count` 개의 요소를 갖는 `type` 배열을 정의하는 `array<type, count>` 구문입니다.

확인해봅시다..

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

위에서 보여드린 정렬 테이블을 살펴보면, `vec3<f32>`는 16바이트의 정렬을 갖습니다.
이는 행렬이나 배열에 있더라도 각각의 `vec3<f32>`가 추가적인 공간을 갖는다는 것을 의미합니다.

다른 것도 살펴봅시다.

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

`size`는 `orientation` 바로 뒤에 있는 12바이트에 위치한 반면, 왜 `scale`과 `friction`은 32바이트와 64바이트로 오프셋이 밀렸을까요?

이는 배열과 구조체가 자신만의 특별한 정렬 규칙을 갖기 때문입니다.
따라서 오직 하나의 `vec3f`만 가진 배열과 오직 하나의 `vec3f`만 가진 `Ex4a` 구조체는 별도의 룰에 따라 정렬됩니다.

# 오프셋과 크기를 계산하는 것은 아주 번거로운 일입니다!

WGSL에서의 데이터 크기와 오프셋을 계산하는 것은 아마도 WebGPU의 가장 큰 고통일 것입니다.
여러분은 이러한 오프셋을 직접 계산하고, 최신 상태로 유지해야 합니다.
만약 여러분이 셰이더의 구조체 중간에 멤버를 추가한다면, 여러분은 자바스크립트로 돌아가서 모든 오프셋을 업데이트해야 합니다.
하나라도 바이트나 길이를 잘못 계산하면, 여러분이 셰이더에 전달하는 데이터는 잘못될 것입니다.
여러분은 코드를 작성하는 시점에서 에러를 받지 않을 것이지만, 여러분의 셰이더는 잘못된 데이터를 보고할 것입니다.
여러분의 모델은 그려지지 않을 것이고, 여러분의 계산은 잘못된 결과를 만들 것입니다.

다행히, 이를 돕기 위한 라이브러리들이 존재합니다.

[webgpu-utils](https://github.com/greggman/webgpu-utils)가 그 중 하나입니다.

WGSL 코드를 제공하면 API가 이 모든 작업을 대신 수행합니다.
이렇게하면 구조체만 변경하더라도 대부분의 경우, 모든 것이 잘 작동합니다.

예를 들어, 마지막 예제를 아래처럼 `webgpu-utils`에 전달할 수 있습니다.

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

// set으로 일부 값들을 설정합니다.
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

// 이제 필요한 경우에 myUniformValues.buffer를 WebGPU에 전달하면 됩니다.
```

이 라이브러리를 사용할지, 다른 것을 사용할지, 아예 사용하지 않을지는 여러분의 선택에 달려있습니다.
제 경우, 무엇인가 작동하지 않는 이유를 알기 위해 20분, 30분, 60분 동안 고민하다가 결국 수동으로 계산한 오프셋이나 크기가 잘못된 것이 문제였던 일이 많았습니다.
결국 차라리 라이브러리를 사용하여 이러한 수고를 피하고 싶었습니다.

만약, 수동으로 계산하고자 한다면, [여기에 오프셋을 계산해주는 페이지](resources/wgsl-offset-computer.html)가 있습니다.

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
