Title: WebGPU Utils와 wgpu-matrix
Description: WebGPU 유틸리티와 수학 연산
TOC: WebGPU 유틸리티와 수학 연산

> ## 이 기사에서 얻을 수 있는 교훈은 무엇일까요?
>
> WebGPU를 사용하는 것은 매우 복잡한 작업입니다. 그래서 도움말을 활용하면, 더 쉽게 이해할 수 있습니다. 그렇게 하면, 더 높은 수준의 개념에 집중할 수 있습니다.
>
> 예를 들어, 만약 당신이 수학을 배우고 있다고 가정해 봅시다. 선생님은 “평균”이 무엇인지, 그리고 어떤 숫자들의 평균을 어떻게 계산하는지에 대해 가르쳐줍니다. 그런 다음 선생님은 다른 내용으로 넘어가서, 그냥 “여기서 평균을 계산해 보세요”라고만 말합니다.
>
> > 표준편차를 계산하려면
> >
> > * 모든 데이터의 평균을 구합니다.
> > * 각 값과 평균의 차이를 구합니다.
> > * 차이를 각각 제곱합니다.
> > * 제곱값의 평균에 제곱근을 취합니다.
>
> 그들은 평균을 어떻게 계산하는지 다시 설명하지 않습니다. 이미 그 방법을 알고 있으니까요. 그러니 그들은 그냥 당신이 이미 알고 있는 내용을 참고할 뿐입니다.
>
> WebGPU에서도 WGSL에서 사용되는 유니폼 구조를 생성하는 개념이 있습니다. 그런 다음 하나 이상의 유니폼 버퍼를 생성하고, `TypedArrays`를 사용하여 해당 버퍼에 데이터를 채웁니다. 이에 대해서는 이 사이트의 처음 20-30개의 글들에서 자세히 설명했으며, [데이터 메모리 레이아웃](webgpu-memory-layout.html)에서도 설명되어 있습니다.
>
> 하지만 어느 시점부터는, 그런 세부적인 내용을 다루는 코드를 이해하는 것이 점점 더 어려워집니다. 단순히 “유니폼을 설정하라”고 말하는 것보다는 말입니다. 이전에 배운 바로는, “유니폼을 설정한다”는 것은 “각 데이터에 대한 오프셋을 계산하고, 그 데이터를 저장할 수 있는 타입화된 배열을 만들어내는 것”을 의미합니다. 그리고 그 후에는 렌더링 전에 그 값들을 설정하고 GPU에 업로드해야 합니다.
>
> 따라서, 이 사이트에서 사용되는 라이브러리들을 두려워하지 마세요. 그 라이브러리들의 기능들은 사이트의 첫 번째 글들에서 상세히 설명되어 있습니다. 아래에는 몇 가지 더 자세한 정보가 제공되어 있습니다.

이 사이트에 있는 많은 예시들은 두 개의 라이브러리를 사용하고 있습니다.

## wgpu-matrix

첫 번째는 [wgpu-matrix](https://github.com/greggman/wgpu-matrix)입니다. wgpu-matrix는 [행렬 연산](webgpu-matrix-math.html), [원근 투영](webgpu-perspective-projection.html), 그리고 [방향광](webgpu-lighting-directional.html)에서 작성한 함수들을 모아놓은 것입니다.

여기서는 특별한 일이 일어나고 있지 않습니다. 만약 수학 함수들이 어떻게 작동하는지 알고 싶다면, 위에 나열된 기사를 읽어보세요.

## webgpu-utils

두 번째는 [webgpu-utils](https://github.com/greggman/webgpu-utils)입니다.

WebGPU Utils는, 여러 기사에서 작성한 유용한 함수들을 모은 것입니다. 예를 들어, 다음과 같은 함수들이 있습니다.

* `numMipLevels`
* `loadImageBitmap`
* `copySourceToTexture`
* `createTextureFromSource`
* `createTextureFromImage`
* `generateMips`

이 모든 것들은, [이미지 로딩](webgpu-importing-textures.html)에서 설명한 내용을 바탕으로 만들어졌습니다.

또한, 다음과 같은 내용도 포함됩니다:

* `copySourcesToTexture`
* `createTextureFromSources`
* `generateMips`

큐브맵 강의의 텍스처 헬퍼 절에서 `generateMips`를 수정해 여러 레이어를 처리했습니다.

[투명도와 블렌딩](webgpu-transparency.html)에서 `premultipliedAlpha`를 텍스처 복사 함수에 전달한 방법도 포함되어 있습니다.

이 도서관에는 또한 다음과 같은 것들도 포함되어 있습니다.

* `createTextureFromImages`

[환경 맵](webgpu-environment-maps.html)

### `makeShaderDataDefinitions`와 `makeStructuredView`

이 두 함수에 대해서는 [데이터 메모리 레이아웃](webgpu-memory-layout.html)에서 간략하게 언급되었습니다.

[WebGPU 기초](webgpu-fundamentals.html), [행렬 연산](webgpu-matrix-math.html), [방향광](webgpu-lighting-directional.html)에서처럼 WGSL에서 구조체를 사용하려면 일반적으로 유니폼 버퍼나 스토리지 버퍼를 만들어 데이터를 채워야 합니다.

이는 특히 조명에 관한 기사에서 잘 드러납니다. 저희는 이러한 구조를 가지고 있었습니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

그러다가 이렇게 변경되었습니다.

```wgsl
struct Uniforms {
  world: mat4x4f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

그러니까, 이것이죠.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

그리고 이렇게 되는 거죠.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
};
```

그 다음에는 이렇게 되었습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
};
```

그리고 이것도요.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
};
```

그리고 이것도요.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
  limit: f32,
};
```

그리고 이것도요.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
  innerLimit: f32,
  outerLimit: f32,
};
```

이러한 변경을 할 때마다, 우리는 뷰를 설정하는 코드를 직접 수정해야 했습니다. 우리가 해야 했던 작업들을 설명하기 위해, 여기에 그 과정을 보여드리겠습니다.

우리는 [방향광](webgpu-lighting-directional.html)에서 여기서 시작했습니다.

```js
  // 행렬 + 색상 + 빛의 방향
  const uniformBufferSize = (16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kMatrixOffset = 0;
  const kColorOffset = 16;
  const kLightDirectionOffset = 20;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

그러니까, 이것이죠.

```js
-  const uniformBufferSize = (16 + 4 + 4) * 4;
+  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kMatrixOffset = 0;
-  const kColorOffset = 16;
-  const kLightDirectionOffset = 20;
+  const kWorldOffset = 0;
+  const kWorldViewProjectionOffset = 16;
+  const kColorOffset = 32;
+  const kLightDirectionOffset = 36;

-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

그러니까, 이것이죠.

```js
-  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kWorldOffset = 0;
-  const kWorldViewProjectionOffset = 16;
-  const kColorOffset = 32;
-  const kLightDirectionOffset = 36;
+  const kNormalMatrixOffset = 0;
+  const kWorldViewProjectionOffset = 12;
+  const kColorOffset = 28;
+  const kLightDirectionOffset = 32;

-  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const normalMatrixValue = uniformValues.subarray(
+      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

그리고 이것도요.

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
-  const kColorOffset = 28;
-  const kLightDirectionOffset = 32;
+  const kWorldOffset = 28;
+  const kColorOffset = 44;
+  const kLightPositionOffset = 48;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
+  const worldValue = uniformValues.subarray(
+      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-  const lightDirectionValue =
-      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
+  const lightPositionValue =
+      uniformValues.subarray(kLightPositionOffset, kLightPositionOffset + 3);
```

그 다음에는 이렇게 되었습니다.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightPositionOffset = 48;
+  const kViewWorldPositionOffset = 52;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightPositionValue = uniformValues.subarray(
      kLightPositionOffset, kLightPositionOffset + 3);
+  const viewWorldPositionValue = uniformValues.subarray(
+      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
```

그리고 이것도요.

```js
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
+  const kShininessOffset = 55;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightWorldPositionValue = uniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = uniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
+  const shininessValue = uniformValues.subarray(
+      kShininessOffset, kShininessOffset + 1);
```

그리고 이것도요.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
+  const kLightDirectionOffset = 56;
+  const kLimitOffset = 59;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightWorldPositionValue = uniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = uniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
+  const lightDirectionValue = uniformValues.subarray(
+      kLightDirectionOffset, kLightDirectionOffset + 3);
+  const limitValue = uniformValues.subarray(
+      kLimitOffset, kLimitOffset + 1);
```

마지막으로, [스포트라이트](webgpu-lighting-spot.html)의 끝부분에서 나온 내용입니다.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
  const kLightDirectionOffset = 56;
-  const kLimitOffset = 59;
+  const kInnerLimitOffset = 59;
+  const kOuterLimitOffset = 60;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightWorldPositionValue = uniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = uniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
  const lightDirectionValue = uniformValues.subarray(
      kLightDirectionOffset, kLightDirectionOffset + 3);
-  const limitValue = uniformValues.subarray(
-      kLimitOffset, kLimitOffset + 1);
+  const innerLimitValue = uniformValues.subarray(
+      kInnerLimitOffset, kInnerLimitOffset + 1);
+  const outerLimitValue = uniformValues.subarray(
+      kOuterLimitOffset, kOuterLimitOffset + 1);
```

제가 바라는 것은, **이러한 복잡한 구조가 아티클의 본질을 해치고 있다는 것입니다!** 우리가 정말로 말하고 싶었던 것은 “WGSL 구조를 이렇게 변경한 다음, 그림을 그리기 전에 값들을 설정해 주세요”였습니다. 하지만 대신, **예시를 통해** 40줄 이상의 코드 수정을 해야 했습니다.

`makeShaderDataDefinitions`와 `makeStructuredView`를 사용하면, 위의 모든 JavaScript 코드를 이 7줄로 변경할 수 있습니다.

```js
const defs = makeShaderDataDefinitions(code);
const uni = makeStructuredView(defs.uniforms.uni);

const uniformBuffer = device.createBuffer({
  size: uni.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

그렇습니다. 샘플들 사이에서, 우리는 적절한 방식으로 구조를 변경할 수 있습니다. 하지만 이 두 함수가 바로 모든 오프셋과 뷰를 생성해줍니다.

마지막 예시의 구조를 살펴보겠습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
  innerLimit: f32,
  outerLimit: f32,
};

*@group(0) @binding(0) var<uniform> uni: Uniforms;
```

이 두 줄

```js
const defs = makeShaderDataDefinitions(code);
const uni = makeStructuredView(defs.uniforms.uni);
```

우리가 `WGSL`에서 정의한 ‘균일 결합’인 `uni`에 대한 “구조화된 보기”를 만들어보세요.

실제로, 그 문장들은 이를 가능하게 만드는 역할을 합니다.

```js
const arrayBuffer = new ArrayBuffer(256);
const uni = {
  arrayBuffer,
  set: function(data) { /* helper */ },
  views: {
    normalMatrix: new Float32Array(arrayBuffer, 0, 12),
    worldViewProjection: new Float32Array(arrayBuffer, 48, 16),
    world: new Float32Array(arrayBuffer, 112, 16),
    color: new Float32Array(arrayBuffer, 176, 4),
    lightWorldPosition: new Float32Array(arrayBuffer, 192, 3),
    viewWorldPosition: new Float32Array(arrayBuffer, 208, 3),
    shininess: new Float32Array(arrayBuffer, 220, 1),
    lightDirection: new Float32Array(arrayBuffer, 224, 3),
    innerLimit: new Float32Array(arrayBuffer, 236, 1),
    outerLimit: new Float32Array(arrayBuffer, 240, 1),
  },
};
```

여기에는 특별한 마법 같은 것은 없습니다. 다만, `makeShaderDataDefinitions`라는 함수가 WGSL을 처리하여 이러한 기능들을 구현하는 데 필요한 데이터를 추출해내는 것뿐입니다.

위에서 언급된 기사들에는, 값을 설정하기 위한 코드가 있었습니다.

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 월드 행렬을 계산합니다.
    const world = mat4.rotationY(settings.rotation, worldValue);

    // viewProjection와 world 행렬를 결합합니다.
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // 역수로 변환하고, 그 값을 세계로 전달합니다. 역수로 변환된 값을 세계에 적용합니다.
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
    innerLimitValue[0] = Math.cos(settings.innerLimit);
    outerLimitValue[0] = Math.cos(settings.outerLimit);

    // 대부분의 스포트라이트 예시와는 달리, 우리에게는 그런 비행기가 없습니다.
    // 그럼, 빛을 F 쪽으로 비추도록 합시다.
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 행렬에서 z축 값을 얻는 방법
        // 그것을 부정해야 합니다. 왜냐하면 lookAt 함수는 -Z 축을 따라 시각화를 수행하기 때문입니다.
        lightDirectionValue.set(mat.slice(8, 11));
    }

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

그 코드는 이렇게 변할 수 있습니다.

```js
+    // 동일한 이름을 사용하여, 해당 뷰들을 다시 불러올 수 있습니다.
+    const {
+      world: worldValue,
+      worldViewProjection: worldViewProjectionValue,
+      normalMatrix: normalMatrixValue,
+      color: colorValue,
+      lightWorldPosition: lightWorldPositionValue,
+      lightDirection: lightDirectionValue,
+      viewWorldPosition: viewWorldPositionValue,
+      shininess: shininessValue,
+      innerLimit: innerLimitValue,
+      outerLimit: outerLimitValue,
+    } = uni.views;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 월드 행렬을 계산합니다.
    const world = mat4.rotationY(settings.rotation, worldValue);

    // viewProjection와 world 행렬를 결합합니다.
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // 역수로 변환하고, 그 값을 세계로 전달합니다. 역수로 변환된 값을 세계에 적용합니다.
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
    innerLimitValue[0] = Math.cos(settings.innerLimit);
    outerLimitValue[0] = Math.cos(settings.outerLimit);

    // 대부분의 스포트라이트 예시와는 달리, 우리에게는 그런 비행기가 없습니다.
    // 그럼, 빛을 F 쪽으로 비추도록 합시다.
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 행렬에서 z축 값을 얻는 방법
        // 그것을 부정해야 합니다. 왜냐하면 lookAt 함수는 -Z 축을 따라 시각화를 수행하기 때문입니다.
        lightDirectionValue.set(mat.slice(8, 11));
    }

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
-    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
+    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

또는, 그 뷰들을 그대로 사용할 수도 있습니다.

```js
-    // 동일한 이름을 사용하여, 해당 뷰들을 다시 불러올 수 있습니다.
-    const {
-      world: worldValue,
-      worldViewProjection: worldViewProjectionValue,
-      normalMatrix: normalMatrixValue,
-      color: colorValue,
-      lightWorldPosition: lightWorldPositionValue,
-      lightDirection: lightDirectionValue,
-      viewWorldPosition: viewWorldPositionValue,
-      shininess: shininessValue,
-      innerLimit: innerLimitValue,
-      outerLimit: outerLimitValue,
-    } = uni.views;
+   const { views } = uni;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 월드 행렬을 계산합니다.
-    const world = mat4.rotationY(settings.rotation, worldValue);
+    const world = mat4.rotationY(settings.rotation, views.world);

    // viewProjection와 world 행렬를 결합합니다.
-    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);
+    mat4.multiply(viewProjectionMatrix, world, views.worldViewProjection);

    // 역수로 변환하고, 그 값을 세계로 전달합니다. 역수로 변환된 값을 세계에 적용합니다.
-    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), views.normalMatrix);

-    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
-    lightWorldPositionValue.set([-10, 30, 100]);
-    viewWorldPositionValue.set(eye);
-    shininessValue[0] = settings.shininess;
-    innerLimitValue[0] = Math.cos(settings.innerLimit);
-    outerLimitValue[0] = Math.cos(settings.outerLimit);
+    views.color.set([0.2, 1, 0.2, 1]);  // 초록색
+    views.lightWorldPosition.set([-10, 30, 100]);
+    views.viewWorldPosition.set(eye);
+    views.shininess[0] = settings.shininess;
+    views.innerLimit[0] = Math.cos(settings.innerLimit);
+    views.outerLimit[0] = Math.cos(settings.outerLimit);

    // 대부분의 스포트라이트 예시와는 달리, 우리에게는 그런 비행기가 없습니다.
    // 그럼, 빛을 F 쪽으로 비추도록 합시다.
    {
        const mat = mat4.aim(
-            lightWorldPositionValue,
+            views.lightWorldPosition,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 행렬에서 z축 값을 얻는 방법
        // 그것을 부정해야 합니다. 왜냐하면 lookAt 함수는 -Z 축을 따라 시각화를 수행하기 때문입니다.
-        lightDirectionValue.set(mat.slice(8, 11));
+        views.lightDirection.set(mat.slice(8, 11));
    }

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

또는, 필요할 경우 `set` 함수를 사용하여 작업을 더욱 간단하게 만들 수도 있습니다.

```js
    const { views } = uni;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 월드 행렬을 계산합니다.
    const world = mat4.rotationY(settings.rotation, views.world);

    // viewProjection와 world 행렬를 결합합니다.
    mat4.multiply(viewProjectionMatrix, world, views.worldViewProjection);

    // 역수로 변환하고, 그 값을 세계로 전달합니다. 역수로 변환된 값을 세계에 적용합니다.
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), views.normalMatrix);

-    views.color.set([0.2, 1, 0.2, 1]);  // 초록색
-    views.lightWorldPosition.set([-10, 30, 100]);
-    views.viewWorldPosition.set(eye);
-    views.shininess[0] = settings.shininess;
-    views.innerLimit[0] = Math.cos(settings.innerLimit);
-    views.outerLimit[0] = Math.cos(settings.outerLimit);
+    uni.set({
+      color: [0.2, 1, 0.2, 1],  // 초록색
+      lightWorldPosition: [-10, 30, 100],
+      viewWorldPosition: eye,
+      shininess: settings.shininess,
+      innerLimit: settings.innerLimit,
+      outerLimit: settings.outerLimit,
+    });

    // 대부분의 스포트라이트 예시와는 달리, 우리에게는 그런 비행기가 없습니다.
    // 그럼, 빛을 F 쪽으로 비추도록 합시다.
    {
        const mat = mat4.aim(
            views.lightWorldPosition,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 행렬에서 z축 값을 얻는 방법
        // 그것을 부정해야 합니다. 왜냐하면 lookAt 함수는 -Z 축을 따라 시각화를 수행하기 때문입니다.
-        views.lightDirection.set(mat.slice(8, 11));
+        uni.set({ lightDirectionValue: mat.slice(8, 11) });
    }

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

적어도 위에서 보여준 사용 사롘의 경우, `set` 함수는 상당히 간단하게 사용할 수 있습니다.

이 방법은 효과가 있을 것입니다.

```js
const arrayBuffer = new ArrayBuffer(256);
const views = {
  normalMatrix: new Float32Array(arrayBuffer, 0, 12),
  worldViewProjection: new Float32Array(arrayBuffer, 48, 16),
  world: new Float32Array(arrayBuffer, 112, 16),
  color: new Float32Array(arrayBuffer, 176, 4),
  lightWorldPosition: new Float32Array(arrayBuffer, 192, 3),
  viewWorldPosition: new Float32Array(arrayBuffer, 208, 3),
  shininess: new Float32Array(arrayBuffer, 220, 1),
  lightDirection: new Float32Array(arrayBuffer, 224, 3),
  innerLimit: new Float32Array(arrayBuffer, 236, 1),
  outerLimit: new Float32Array(arrayBuffer, 240, 1),
};
const uni = {
  arrayBuffer,
  set: function(data) {
    // 너무 단순화된 설명입니다.
    for (const [key, value] of Object.entries(data)) {
      const view = views[key];
      if (view) {
        view.set(typeof value === 'number' ? [value] : value);
      }
    }
  },
};
```

실제로 `set`를 구현하는 것은 중첩된 구조나 배열을 처리하는 데 약간 더 복잡합니다. 자세한 내용을 보려면 소스 코드를 확인해 주세요. ‘set’ 함수의 코드는 다음과 같습니다: [link](https://github.com/greggman/webgpu-utils/blob/cb61348691718e22f877e0011673f84d456927b6/src/buffer-views.ts#L291) 그리고 그 함수가 호출하는 함수의 코드는 다음과 같습니다: [link](https://github.com/greggman/webgpu-utils/blob/cb61348691718e22f877e0011673f84d456927b6/src/buffer-views.ts#L386)

위 예제를 보면 특별한 마법이 아님을 알 수 있습니다. 이 작은 함수들로 WebGPU 코드를 작성하는 수고를 덜고 설명도 훨씬 간단하게 할 수 있습니다. 오프셋 계산과 뷰 생성을 150번째 반복해서 보여 주는 대신, “유니폼 값을 설정합니다”라고 쓰면 됩니다.

## 정점 버퍼와 속성들

정점 버퍼와 정점 속성을 설정하는 과정도 간단하게 만들 수 있습니다. 보통 정점 위치, 법선, 텍스처 좌표를 각각 배열로 갖고 있을 때는 배열별로 버퍼를 만드는 것부터 시작합니다.

```js
const positions = [];
const normals = [];
const texcoords = [];

for(each vertex) {
  ...
  position.push(x, y, z);
  normals.push(nx, ny, nz);
  texcoord.push(u, v);
}
```

이제, 3개의 버퍼와 3개의 속성 세트가 필요하다는 추가적인 문제가 생겼습니다.

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: [
*        // 위치/상태
*        {
*          arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
*          attributes: [
*            {shaderLocation: 0, offset: 0, format: 'float32x3'},
*          ],
*        },
*        // 정상적인 상태
*        {
*          arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
*          attributes: [
*            {shaderLocation: 1, offset: 0, format: 'float32x3'},
*          ],
*        },
*        // 텍스코어스
*        {
*          arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
*          attributes: [
*            {shaderLocation: 2, offset: 0, format: 'float32x2',},
*          ],
*        },
*      ],
    },

...

  function createBuffer(device, values, usage) {
    const data = new Float32Array(values);
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage,
      mappedAtCreation: true,
    });
    const dst = new data.constructor(buffer.getMappedRange());
    dst.set(data);
    buffer.unmap();
    return buffer;
  }

  const positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX);
  const normalBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX);
  const texcoordBuffer = createBuffer(device, texcoords, GPUBufferUsage.VERTEX);

```

더 지루해요. 😮‍💨

또는, 그들을 번갈아 가며 사용해보는 것도 가능합니다. 이 방법은 쉽기도 하고, 그렇지 않기도 합니다. 만약 모든 값이 같은 종류의 값이라면, 예를 들어 32비트 부동소수점 값이라면, 그럴 경우에는 다음과 같은 방법을 사용할 수 있습니다.

```js
const vertexData = [];

for (each vertex) {
  ...
  vertexData.push(
      x, y, z,
      nx, ny, nz,
      u, v);
}
```

하지만, 8비트 색상을 혼합하고자 할 때는 다시 번거로워집니다.

```js
const numVertices = ...;
const npmFloatsPerVertex = 3 + 3 + 2 + 1; // 위치 + 법선 + UV + 색상
const f32Data = new Float32Array(numFloatsPerVertex * numVertices);
const u8Data = new Uint8Array(f32Data.buffer);
const colorOffset = (3 + 3 + 2) * 4;

for (let i = 0; i < numVertices; ++i) {
   const floatOffset = numFloatsPerVertex * i;
   f32Data.set(
      [
        x, y, z,
        nx, ny, nz,
        u, v,
      ],
      floatOffset);
   const u8Offset =numFloatsPerVertex * i * 4 + colorOffset;
   u8Data.set(
      [ r, g, b, a ],
      u8Offset;
   );
}
```

그리고 아직 끝나지 않았습니다. 모든 데이터를 버퍼에 저장했다고 해도, 여전히 파이프라인을 설정해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: [
*        // 위치/상태
*        {
*          arrayStride: (3 + 3 + 2 + 1) * 4,
*          attributes: [
*            {shaderLocation: 0, offset: 0,  format: 'float32x3'},
*            {shaderLocation: 1, offset: 12, format: 'float32x3'},
*            {shaderLocation: 2, offset: 24, format: 'float32x2'},
*            {shaderLocation: 3, offset: 32, format: 'unorm8x4'},
*          ],
*        },
*      ],
    ...
```

다시 말하지만, 몇몇 도구들을 활용하면 이러한 번거로움을 없앨 수 있습니다.

우리는 이를 전달할 수 있는 함수를 만들 수 있습니다.

```js
const positions = [];
const normals = [];
const texcoords = [];

const data = {
  positions,
  normals,
  texcoords,
};
```

그리고 그것은 우리를 위해 모든 것을 만들어줍니다. 데이터를 혼합하고, 버퍼를 생성하며, 파이프라인의 `buffers` 부분을 반환합니다.

```js
const {
  bufferLayouts,
  buffers,
  numElements
} = createBuffersAndAttributesFromArrays(device, data);
```

이제 버퍼들이 이미 생성되었습니다. 기본적으로는 1개의 버퍼만 존재하며, 데이터는 여러 버퍼들 사이에 나뉘어 저장됩니다. 그 버퍼는 `buffer[0]`입니다. 또한, `bufferLayout`도 반환되었습니다. 이는 파이프라인에서 버퍼라고 불리는 부분입니다.

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: bufferLayout
    },
    ...
```

그리고, `buffers`가 배열이라는 점을 고려할 때, 원한다면 다음과 같은 버퍼 명령을 사용할 수 있습니다.

```js
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    buffers.forEach((buffer, i) => pass.setVertexBuffer(i, buffer));
    ...
```

그렇다면, 버퍼의 수가 많거나 적더라도 코드를 변경할 필요가 없습니다.

TBD: 예시가 필요합니다. 현재 존재하는 예시들 중에서는, 간단하면서도 흥미로운 데이터를 가진 예시는 없습니다. [webgpu-cube](../webgpu-cube.html)이라는 예시가 있긴 하지만, 그건 WebGL 관련 글의 일부일 뿐이며, 적절하지 않은 예시입니다.

하지만, 그 정도면 괜찮은 비교라고 할 수 있습니다.

<div class="webgpu_center compare">
  <div>
    <div>원시 WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  function createBuffer(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage,
      mappedAtCreation: true,
    });
    const dst = new data.constructor(buffer.getMappedRange());
    dst.set(data);
    buffer.unmap();
    return buffer;
  }

  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
  const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
  const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

  const positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX);
  const normalBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX);
  const texcoordBuffer = createBuffer(device, texcoords, GPUBufferUsage.VERTEX);
  const indicesBuffer = createBuffer(device, indices, GPUBufferUsage.INDEX);

  const pipeline = device.createRenderPipeline({
    label: 'fake lighting',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      buffers: [
        // 위치/상태
        {
          arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},
          ],
        },
        // 정상적인 상태
        {
          arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x3'},
          ],
        },
        // 텍스코어스
        {
          arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x2',},
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    ...(canvasInfo.sampleCount > 1 && {
        multisample: {
          count: canvasInfo.sampleCount,
        },
    }),
  });

  ...

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, normalBuffer);
    passEncoder.setVertexBuffer(2, texcoordBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
    passEncoder.drawIndexed(indices.length);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU 유틸리티</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  const {
    buffers: [vertexBuffer],
    bufferLayouts,
    indexBuffer,
    indexFormat,
    numElements,
  } = createBuffersAndAttributesFromArrays(
    device, {
      positions: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
      normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
      texcoords: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
    });

  const pipeline = device.createRenderPipeline({
    label: 'fake lighting',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      buffers: bufferLayouts,
    },
    fragment: {
      module: shaderModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    ...(canvasInfo.sampleCount > 1 && {
        multisample: {
          count: canvasInfo.sampleCount,
        },
    }),
  });

...

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, indexFormat);
    passEncoder.drawIndexed(numElements);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
</div>


[공간 절약을 위한 정규화된 값의 사용](webgpu-vertex-buffers.html#a-normalized-attributes)에 나와 있는 예시처럼, 8비트 색상이 사용되는 더 복잡한 예시는 어떻게 될까요? 그 예시에서는 3개의 버퍼가 사용되었습니다. 첫 번째 버퍼에는 위치와 각 정점의 색상이 저장되어 있습니다. 두 번째 버퍼에는 각 원의 색상과 그 원에 대한 오프셋 정보가 저장되어 있습니다. 마지막 버퍼에는 스케일 정보가 저장되어 있습니다.

`createBuffersAndAttributesFromArrays`를 사용하도록 변경합니다.

먼저, 원형 데이터를 생성하는 코드를 변경해야 합니다.

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 각 하위 구역에는 2개의 삼각형이 있고, 각 삼각형마다 3개의 정점이 있습니다.
-  const numVertices = numSubdivisions * 3 * 2;
-  // 위치에 대해서는 32비트 값이 2개 필요하며, 색상에 대해서는 32비트 값이 1개 필요합니다. 색상의 경우, rgb_라는 이름으로 표시됩니다.
-  // 32비트 색상 값은 4개의 8비트 값으로 표현됩니다.
-  const vertexData = new Float32Array(numVertices * (2 + 1));
-  const colorData = new Uint8Array(vertexData.buffer);

+  const positions = [];
+  const colors = [];

-  let offset = 0;
-  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
-    vertexData[offset++] = x;
-    vertexData[offset++] = y;
-    offset += 1;  // 색상을 생략하기
-    colorData[colorOffset++] = r * 255;
-    colorData[colorOffset++] = g * 255;
-    colorData[colorOffset++] = b * 255;
-    colorOffset += 9;  // 추가적인 바이트들을 건너뛰고, 해당 위치를 찾아내세요.
+    positions.push(x, y);
+    colors.push(r, g, b, 1);
  };

  const innerColor = [1, 1, 1];
  const outerColor = [0.1, 0.1, 0.1];

  // 하위 단계당 2개의 정점이 있습니다.
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; ++i) {
    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

    const c1 = Math.cos(angle1);
    const s1 = Math.sin(angle1);
    const c2 = Math.cos(angle2);
    const s2 = Math.sin(angle2);

    // 첫 번째 삼각형
    addVertex(c1 * radius, s1 * radius, ...outerColor);
    addVertex(c2 * radius, s2 * radius, ...outerColor);
    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

    // 두 번째 삼각형
    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
    addVertex(c2 * radius, s2 * radius, ...outerColor);
    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
  }

  return {
-    vertexData,
-    numVertices,
+    positions: { data: positions, numComponents: 2 },
+    colors,
  };
}
```

그렇게 되면 모든 것이 더 간단해집니다.

정점 버퍼를 설정하는 코드는 다음과 같습니다.

```
  const kNumObjects = 100;
  const objectInfos = [];

-  // 2개의 정점 버퍼를 생성합니다.
-  const staticUnitSize =
-    4 +     // 색상은 4바이트입니다.
-    2 * 4;  // 오프셋은 32비트 부동소수점 숫자들로 구성되어 있습니다. 각각 4바이트입니다.
-  const changingUnitSize =
-    2 * 4;  // 스케일은 2개의 32비트 부동소수점 수치입니다. 각각 4바이트입니다.
-  const staticVertexBufferSize = staticUnitSize * kNumObjects;
-  const changingVertexBufferSize = changingUnitSize * kNumObjects;
-
-  const staticVertexBuffer = device.createBuffer({
-    label: 'static vertex for objects',
-    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-
-  const changingVertexBuffer = device.createBuffer({
-    label: 'changing storage for objects',
-    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-
-  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kColorOffset = 0;
-  const kOffsetOffset = 1;

  const kScaleOffset = 0;

-  {
-    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
-    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
+  const staticColors = [];
+  const staticOffsets = [];

    for (let i = 0; i < kNumObjects; ++i) {
-      const staticOffsetU8 = i * staticUnitSize;
-      const staticOffsetF32 = staticOffsetU8 / 4;
-
-      // 이 옵션들은 단 한 번만 설정되므로, 지금 바로 설정해 주세요.
-      staticVertexValuesU8.set(        // 색상을 설정합니다.
-          [rand() * 255, rand() * 255, rand() * 255, 255],
-          staticOffsetU8 + kColorOffset);
-
-      staticVertexValuesF32.set(      // 오프셋을 설정합니다.
-          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
-          staticOffsetF32 + kOffsetOffset);
+      staticColors.push(rand() * 255, rand() * 255, rand() * 255, 255);
+      staticOffsets.push(rand(-0.9, 0.9), rand(-0.9, 0.9));

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
-    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
-  }

  const {
    buffers: [staticVertexBuffer],
    bufferLayouts: [staticVertexBufferLayout],
  } = createBuffersAndAttributesFromArrays(device, {
    staticOffsets: { data: staticOffsets, numComponents: 2 },
    staticColors: new Uint8Array(staticColors),
  }, {stepMode: 'instance', shaderLocation: 2});

  const {
    buffers: [changingVertexBuffer],
    bufferLayouts: [changingVertexBufferLayout],
  } = createBuffersAndAttributesFromArrays(device, {
    scale: { data: kNumObjects * 2, numComponents: 2 },
  }, { stepMode: 'instance', shaderLocation: 4, usage: GPUBufferUsage.COPY_DST });

+  const vertexValues = new Float32Array(changingVertexBuffer.size / 4);
+  const changingUnitSize = 8;

-  // 변경되는 StorageBuffer를 업데이트하는 데 사용할 수 있는 타입스크립트 배열입니다.
-  const vertexValues = new Float32Array(changingVertexBufferSize / 4);
-
-  const { vertexData, numVertices } = createCircleVertices({
-    radius: 0.5,
-    innerRadius: 0.25,
-  });
-  const vertexBuffer = device.createBuffer({
-    label: 'vertex buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

+  const vertexArrays = createCircleVertices({
+    radius: 0.5,
+    innerRadius: 0.25,
+  });
+  const {
+    buffers: [vertexBuffer],
+    numElements,
+    bufferLayouts: [vertexBufferLayout],
+  } = createBuffersAndAttributesFromArrays(device, vertexArrays);
```

그렇게 되자, 그 크기는 훨씬 줄어들었습니다.

파이프라인을 설정하는 코드가 이렇게 변경되었습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
-        {
-          arrayStride: 2 * 4 + 4, // 2개의 플로트, 각각 4바이트 + 4바이트
-          attributes: [
-            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
-            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
-          ],
-        },
-        {
-          arrayStride: 4 + 2 * 4, // 4바이트 + 2개의 실수형 데이터, 각각 4바이트씩
-          stepMode: 'instance',
-          attributes: [
-            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // 색상
-            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // 오프셋
-          ],
-        },
-        {
-          arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
-          stepMode: 'instance',
-          attributes: [
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // 스케일
-          ],
-        },
+        vertexBufferLayout,
+        staticVertexBufferLayout,
+        changingVertexBufferLayout,
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

그렇게 하면 더 간단해집니다.

그게 승리인가요? 결정해야 할 문제입니다.

앞으로는, 이러한 함수들을 사용하여 글의 주제에 집중할 수 있도록 할 것입니다. 그렇게 하면 세부적인 사항들에 너무 집중하지 않고도 글의 주제를 더 잘 이해할 수 있을 것입니다. 이 글이 이러한 함수들이 무엇을 하는지에 대해 더 명확하게 설명해줄 수 있기를 바랍니다. 이미 다루어진 내용은 없습니다. 그러니, 다음과 같은 내용을 볼 때는…

```js
const sphereData = createBuffersAndAttributesFromArrays(
   device,
   createSphereVertices(radius),
);
```

이 사이트에는 `createBuffersAndAttributesFromArrays`가 무엇을 의미하는지 설명하는 30~40개의 글이 있습니다. 그리고 이러한 용어들이 무섭거나 이해하기 어렵다는 것은 아닙니다. 개념을 설명하고, 이름을 붙인 다음, 그 이름만을 사용하는 것이 학습의 일반적인 방식입니다. 이렇게 하면 더 높은 수준의 개념을 이해하는 데 도움이 됩니다.
