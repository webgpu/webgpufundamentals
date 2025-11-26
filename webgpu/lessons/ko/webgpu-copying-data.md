Title: WebGPU 데이터 복사하기
Description: 버퍼와 텍스처로/로부터 데이터 복사
TOC: 데이터 복사하기

지금까지 대부분의 글에서 버퍼에 데이터를 넣기 위해서 `writeBuffer`를 사용하고 텍스처에 데이터를 넣기 위해서 `writeTexture`를 사용했습니다. 
버퍼나 텍스처에 데이터를 전달하는 다양한 방법이 있습니다.

## `writeBuffer`

`writeBuffer`는 자바스크립트의 `TypedArray` 또는 `ArrayBuffer`로부터 버퍼로 데이터를 복사합니다. 
이는 버퍼로 데이터를 전달하는 가장 직관적인 방법입니다.

`writeBuffer`는 아래와 같은 포맷을 따릅니다.

```js
device.queue.writeBuffer(
  destBuffer,  // 데이터를 쓸 대상 버퍼
  destOffset,  // 대상의 어디에서부터 데이터를 쓰기 시작할 것인지
  srcData,     // typedArray 또는 arrayBuffer
  srcOffset?,  // srcData의 어떤 **요소(element)**부터 복사할 것인지 오프셋
  size?,       // 복사할 srcData의 **요소**단위 크기
)
```

`srcOffset`이 전달되지 않았으면 `0`을 사용합니다.
`size`가 전달되지 않았다면 `srcData`의 크기가 사용됩니다.

> 중요: `srcOffset`과 `size`는 `srcData`의 요소 단위입니다.
>
> 다시 말해,
>
> ```js
> device.queue.writeBuffer(
>   someBuffer,
>   someOffset,
>   someFloat32Array,
>   6,
>   7,
> )
> ```
>
> 위 코드는 float32의 6번째부터 7개의 데이터를 복사합니다. 
> 다른 방식으로 말하자면 `someFloat32Array`의 뷰(view)가 가리키고 있는 arrayBuffer의 24바이트 위치부터 시작해서 28 바이트를 복사합니다.

## `writeTexture`

`writeTexture`는 자바스크립트의 `TypedArray` 또는 `ArrayBuffer`로부터 텍스처로 데이터를 복사합니다. 

`writeTexture`는 아래와 같은 시그니처(signature)를 갖습니다.

```js
device.queue.writeTexture(
  // 복사 대상의 세부사항
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 소스 데이터
  srcData,

  // 소스 데이터 세부사항
  { offset: 0, bytesPerRow, rowsPerImage },

  // 크기:
  [width, height, depthOrArrayLayers] or { width, height, depthOrArrayLayers }
)
```

주의 사항으로:

- `texture`에 `GPUTextureUsage.COPY_DST` usage가 있어야 합니다.

- `mipLevel`, `origin`, `aspect` 는 모두 기본값이 있어서 생략하는 경우가 많습니다.

- `bytesPerRow`: 이 값은 다음 *블럭 행(block row)* 의 데이터를 얻기 위해 알마나 많은 바이트를 건너가야 하는지에 대한 값입니다.

  이는 2개 이상의 *블럭 행*을 복사할 떄 필요합니다. 
  보통 2개 이상의 *블럭 행*을 복사하기 때문에 거의 대부분의 경우에 값을 명시해야 합니다.

- `rowsPerImage`: 이 값은 하나의 이미지에서부터 다음 이미지까지 얼마나 많은 *블럭 행*을 건너가야 하는지에 대한 값입니다.

  이는 하나 이상의 레이어를 복사할 때 필요합니다. 
  다시 말해, 크기 인자의 `depthOrArrayLayers`가 1 보다 크면 이 값을 명시해야 합니다.
  
복사는 아래와 같은 방식으로 동작한다고 생각할 수 있습니다.

```js
// pseudo code
const [x, y, z] = origin ?? [0, 0, 0];
const [blockWidth, blockHeight] = 
   getBlockSizeForTextureFormat(texture.format);

const blocksAcross = width / blockWidth;
const blocksDown = height / blockHeight;
const bytesPerBlockRow = blocksAcross * bytesPerBlock;

for (layer = 0; layer < depthOrArrayLayers; layer) {
   for (row = 0; row < blocksDown; ++row) {
     const start = offset + (layer * rowsPerImage + row) * bytesPerRow;
     copyRowToTexture(
         texture,               // 복사 대상 텍스쳐
         x, y + row, z + layer, // 텍스쳐 내부 어디에 복사할것인가
         srcDataAsBytes + start,
         bytesPerBlockRow);
   }
}
```

### <a id="a-block-rows"></a>**블럭 행(block row)**

텍스처는 블럭과 같은 구조입니다. 
대부분의 *일반적인* 텍스처는 블럭 행과 열이 모두 1입니다. 
압축된(compressed) 텍스처에서는 상황이 변합니다. 
예를들어 `bc1-rgba-unorm` 포맷은 블럭의 너비와 높이가 4입니다. 
즉 width를 8로, 높이를 12로 설정했다면 여섯 개의 블럭만 복사됩니다. 
첫 번째와 두 번째 행에서는 2개씩, 세 번째 행에서 2개가 복사됩니다.

압축된 텍스처에서는 크기와 원점(origin)이 블럭의 크기와 정렬되어야 합니다.

> 주의: WebGPU에서 (`GPUExtent3D`로 정의된)크기를 입력받는 경우 1~3개의 숫자로 이루어진 배열이거나, 1~3개의 속성을 갖는 객체입니다.
> `height`와 `depthOrArrayLayers`의 기본값은 1입니다. 따라서,
>
> - `[2]` width = 2, height = 1, depthOrArrayLayers = 1
> - `[2, 3]` width = 2, height = 3, depthOrArrayLayers = 1
> - `[2, 3, 4]` width = 2, height = 3, depthOrArrayLayers = 4
> - `{ width: 2 }` width = 2, height = 1, depthOrArrayLayers = 1
> - `{ width: 2, height: 3 }` width = 2, height = 3, depthOrArrayLayers = 1
> - `{ width: 2, height: 3, depthOrArrayLayers: 4 }` width = 2, height = 3, depthOrArrayLayers = 4

> 같은 방식으로 (`GPUOrigin3D`로 정의된) 원점에 대해서는 3개의 숫자로 이루어진 배열이거나 `x`, `y`, `z` 속성을 갖는 객체입니다.
> 기본값은 모두 0입니다. 따라서,
>
> - `[5]` an origin where x = 5, y = 0, z = 0
> - `[5, 6]` an origin where x = 5, y = 6, z = 0
> - `[5, 6, 7]` an origin where x = 5, y = 6, z = 7
> - `{ x: 5 }` an origin where x = 5, y = 0, z = 0
> - `{ x: 5, y: 6 }` an origin where x = 5, y = 6, z = 0
> - `{ x: 5, y: 6, z: 7 }` an origin where x = 5, y = 6, z = 7

- `aspect`는 깊이-스텐실(stencil) 포맷으로 데이터를 복사할 때만 관여합니다. 
  각 aspect마다 한 번씩 데이터를 복사해야 하며 `depth-only` 또는 `stencil-only`를 사용해야 합니다.

> 여담: 텍스쳐 객체는 `width`, `height`, `depthOrArrayLayer` 프로퍼티를 가지고 있습니다. `GPUExtent3D` 도 마찬가지죠.
> 그런 측면에서 아래와 같이 텍스쳐를 생성하면
>
> ```js
> const texture = device.createTexture({
>   format: 'r8unorm',
>   size: [2, 4],
>   usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_ATTACHMENT,
> });
> ```
>
> 아래의 모든 코드가 제대로 동작합니다.
>
> ```js
> // copy 2x4 pixels of data to texture
> const bytesPerRow = 2;
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [2, 4]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [texture.width, texture.height]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: 2, height: 4});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: texture.width, height: texture.height});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, texture); // !!!
> ```
>
> 마지막 줄도 역시 제대로 동작합니다. 왜냐하면 텍스쳐 객체는 `width`, `height`, `depthOrArrayLayers` 프로퍼티를 가지고 있기 때문입니다.
> 코드가 다소 불명확하게 보일수 있어서, 지금까지 이런 스타일의 코드는 사용하지 않았지만, 틀린 코드는 아닙니다.

## `copyBufferToBuffer`

`copyBufferToBuffer`는 이름 그대로 하나의 버퍼에서 다른 버퍼로 데이터를 복사합니다.

시그니처는:

```js
encoder.copyBufferToBuffer(
  source, // 복사할 값을 얻어올 버퍼
  sourceOffset, // 어느 위치부터 가져올 것인지
  dest, // 복사할 대상 버퍼
  destOffset, // 어느 위치부터 넣을 것인지
  size // 몇 바이트를 복사할 것인지
);
```

- `source`는 `GPUBufferUsage.COPY_SRC`여야 합니다.
- `dest`는 `GPUBufferUsage.COPY_DST`여야 합니다.
- `size`는 4의 배수여야 합니다.

## `copyBufferToTexture`

`copyBufferToTexture`는 이름 그대로 버퍼에서 텍스처로 데이터를 복사합니다.

시그니처는:

```js
encoder.copyBufferToTexture(
  // 소스 버퍼 세부사항
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // 대상 텍스처 세부사항
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 크기:
  [width, height, depthOrArrayLayers] or { width, height, depthOrArrayLayers }
)
```

`writeTexture`와 거의 동일한 매개변수를 갖습니다. 
가장 큰 차이는 `bytesPerRow`이며 **256의 배수여야 합니다!!**

- `texture`는 `GPUTextureUsage.COPY_DST`여야 합니다.
- `buffer`는 `GPUBufferUsage.COPY_SRC`여야 합니다.

## `copyTextureToBuffer`

`copyTextureToBuffer`는 이름 그대로 텍스처에서 버퍼로 데이터를 복사합니다.

시그니처는:

```js
encoder.copyTextureToBuffer(
  // 소스 텍스처 세부사항
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 대상 버퍼 세부사항
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // 크기:
  [width, height, depthOrArrayLayers] or { width, height, depthOrArrayLayers }
)
```

이는 `copyBufferToTexture`와 비슷한 매개변수를 가지며, 텍스처(여기서는 소스)와 버퍼(여기서는 대상)가 뒤바뀐 형태입니다. 
`copyBufferToTexture`에서처럼 `bytesPerRow`는 **256의 배수여야 합니다!!**

- `texture`는 `GPUTextureUsage.COPY_SRC`여야 합니다.
- `buffer`는`GPUBufferUsage.COPY_DST`여야 합니다.

## `copyTextureToTexture`

`copyTextureToTexture`는 텍스처의 일부분을 다른 텍스처에 복사합니다.

두 텍스처는 모두 같은 포맷이거나 접미어인 `'-srgb'`만 달라야 합니다.

시그니처는:

```js
encoder.copyTextureToTexture(
  // 소스 텍스처 세부사항
  src: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 대상 텍스처 세부사항
  dst: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // 크기:
  [ width, height, depthOrArrayLayers ] or { width, height, depthOrArrayLayers }
)
```

- src.`texture`는 `GPUTextureUsage.COPY_SRC`여야 합니다.
- dst.`texture`는 `GPUTextureUsage.COPY_DST`여야 합니다.
- `width`는 블럭 너비의 배수여야 합니다.
- `height`는 블럭 높이의 배수여야 합니다.
- src.`origin[0]` 또는 `.x` 는 너비의 배수여야 합니다.
- src.`origin[1]` 또는 `.y` 는 높이의 배수여야 합니다.
- dst.`origin[0]` 또는 `.x` 는 너비의 배수여야 합니다.
- dst.`origin[1]` 또는 `.y` 는 높이의 배수여야 합니다.

## 셰이더

셰이더는 스토리지 버퍼, 스토리지 텍스처에 값을 쓸 수 있으며 간접적으로 텍스처에 렌더링을 할 수 있습니다. 
이러한 방법들이 버퍼나 텍스처에 값을 쓰는 방법입니다. 
즉 데이터를 생성/복사하는 셰이더를 만들 수 있습니다.

## 버퍼 맵핑(mapping)

버퍼를 맵핑할 수 있습니다. 
버퍼를 맵핑한다는 뜻은 자바스크립트에서 값을 읽거나 쓸 수 있도록 한다는 뜻입니다. 
최소한 WebGPU의 버전 1에서 맵핑 가능한(mappable) 버퍼에는 심각한 제약사항이 있습니다. 
이는 맵핑 가능한 버퍼가 데이터를 읽기 혹은 쓰기 목적으로 복사할 임시 공간으로만 사용 가능한 점입니다.
맵핑 가능한 버퍼는 다른 종류의 버퍼(Uniform 버퍼, 정점 버퍼, 인덱스 버퍼, 스토리지 버퍼 등)로 사용할 수 없습니다. [^mappedAtCreation]

[^mappedAtCreation]:
    `mappedAtCreation: true`로 설정할 때는 예외인데, [mappedAtCreation](#a-mapped-at-creation)를 참고하세요.
    
맵핑가능한 버퍼는 두 종류의 사용법 플래그의 조합으로 만들 수 있습니다.

- `GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST`

  다른 버퍼나 텍스처로부터 데이터를 복사하는 커맨드를 사용할 수 있는 버퍼로, 맵핑하여 자바스크립트로부터 데이터를 읽을 수 있습니다.
  
- `GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC`

  자바스크립트에서 맵핑하여 데이터를 넣을 수 있는 버퍼입니다. 
  그리고 언맵핑(unmap)하여 위에서 설명한 복사 커맨드로 그 내용을 다른 버퍼나 텍스처에 복사할 수 있습니다.

버퍼의 맵핑 과정은 비동기적입니다. 
`offset`과 `size`를 바이트 단위로 하여 `buffer.mapAsync(mode, offset = 0, size?)`를 호출할 수 있습니다.
`size`가 명시되어 있지 않으면 전체 버퍼 크기를 의미합니다. 
`mode`는 `GPUMapMode.READ` 또는 `GPUMapMode.WRITE`여야 하며 당연히 버퍼를 생성할 때 사용한 `MAP_` 사용법 플래그와 일치해야 합니다.

`mapAsync`는 `Promise`를 반환합니다. 
프라미스(Promise)가 해소(resolve)되면 버퍼는 맵핑 가능한 상태가 됩니다. 
이후에 `buffer.getMappedRange(offset = 0, size?)`를 호출해서 버퍼의 일부 또는 전체를 볼 수 있으며, 여기서 `offset`은 맵핑한 버퍼의 일부분에 대한 바이트 오프셋입니다. 
`getMappedRange`는 `ArrayBuffer`를 반환하므로 이 걸로 TypedArray를 만들어 쓰는 것이 일반적입니다.

아래는 버퍼 맵핑의 한 예입니다.

```js
const buffer = device.createBuffer({
  size: 1024,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// 전체 버퍼를 매핑
await buffer.mapAsync(GPUMapMode.READ);

// 전체 버퍼 내용을 32bit float 의 배열로 가져옴
const f32 = new Float32Array(buffer.getMappedRange())

...

buffer.unmap();
```

Note: 한 번 맵핑이 되면, 버퍼는 `unmap`을 호출하기 전까지는 WebGPU에서 사용 불가능한 상태가 됩니다. 
`unmap`을 호출한 순간 버퍼는 자바스크립트에서 사라집니다. 
위 예제를 기반으로, 코드로 설명하자면 아래와 같습니다.

```js
const f32 = new Float32Array(buffer.getMappedRange());

f32[0] = 123;
console.log(f32[0]); // 123 출력됨

buffer.unmap();

console.log(f32[0]); // undefined 출력됨
```

데이터를 읽기 위해 버퍼를 맵핑하는 예제는 이미 본 적이 있습니다.
[첫 번째 글](webgpu-fundamentals.html#a-run-computations-on-the-gpu)에서 스토리지 버퍼의 숫자에 2를 곱하고 이를 맵핑 가능한 버퍼에 복사한 후 그 결과를 읽기 위해서 맵핑하였습니다.

다른 예시는 [컴퓨트 셰이더 기본](webgpu-compute-shaders.md)에 있는데, 컴퓨트 셰이더의 여러 `@builtin` 값을 스토리지 버퍼에 맵핑하였습니다. 
그리고 그 결과를 맵핑 가능한 버퍼에 복사하고 맵핑하여 값을 읽어옵니다.

## <a id="a-mapped-at-creation"></a>mappedAtCreation

`mappedAtCreation: true`은 버퍼를 생성할 때 추가할 수 있는 플래그입니다. 
이 경우 버퍼는 `GPUBufferUsage.COPY_DST`와 `GPUBufferUsage.MAP_WRITE` 사용법 플래그를 명시할 필요가 없어집니다.

이는 버퍼 생성시에 데이터를 넣을 수 있도록 하는 특별한 플래그입니다. 
버퍼를 생성할 때 `mappedAtCreation: true`를 추가할 수 있습니다. 
버퍼가 생성되면, 이미 값을 쓸 수 있도록 맵핑 가능한 상태가 됩니다.
그 예로:

```js
const buffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM,
  mappedAtCreation: true,
});
const arrayBuffer = buffer.getMappedRange(0, buffer.size);
const f32 = new Float32Array(arrayBuffer);
f32.set([1, 2, 3, 4]);
buffer.unmap();
```

좀더 간결하게는,

```js
const buffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM,
  mappedAtCreation: true,
});
new Float32Array(buffer.getMappedRange(0, buffer.size)).set([1, 2, 3, 4]);
buffer.unmap();
```

`mappedAtCreation: true`로 생성된 버퍼에는 자동으로 설정된 플래그가 없습니다.
이는 버퍼 생성 시 데이터를 넣기 위한 편의 기능일 뿐입니다. 생성 시 매핑되며,
한 번 언맵(unmap)하면 다른 버퍼와 동일하게 동작하며 지정된 용도에서만 작동합니다. 
다시 말해, 나중에 데이터를 복사하려면 `GPUBufferUsage.COPY_DST`를,
나중에 매핑하려면 `GPUBufferUsage.MAP_READ` 또는 `GPUBufferUsage.MAP_WRITE`가 필요합니다.

## <a id="a-efficient"></a>맵핑가능한 버퍼의 효율적인 사용

위에서 우리는 버퍼 맵핑이 비동기적이라고 했습니다. 
즉 `mapAsync`를 호출하여 버퍼를 맵핑하기를 요청하는 시점부터, 맵핑이 되어 `getMappedRange`를 호출할 수 있게되는 시점까지의 시간이 미정이라는 뜻입니다.

이를 해결하는 일반적인 방법은 몇몇 버퍼들을 항상 맵핑 상태로 두는 것입니다.
그러면 이미 맵핑이 되어 있어서 바로 사용 가능하게 됩니다. 
사용한 후에 언맵핑을 하고, 어떤 커맨드든 해당 버퍼를 사용하는 커맨드를 제출하고 나면 다시 맵핑하도록 요청합니다. 
프라미스가 해소되면 이를 다시 이미 맵핑된 버퍼 풀(pool)로 되돌립니다. 
맵핑 가능한 버퍼가 필요한데 사용할 수 있는게 없으면 새로운 버퍼를 만들어 풀에 넣으면 됩니다.
