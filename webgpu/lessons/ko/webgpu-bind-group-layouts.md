Title: WebGPU 바인드 그룹 레이아웃
Description: 명시적 바인드 그룹 레이아웃
TOC: 바인드 그룹 레이아웃

바인드 그룹 레이아웃은 WebGPU가 바인드 그룹을 계산 및 렌더 파이프라인과 쉽고 효율적으로 일치시키기 위해 사용됩니다.

## 동작 방식:

`GPUComputePipeline`이나 `GPURenderPipeline`과 같은 파이프라인은 0개 이상의 `GPUBindGroupLayout`을 정의하는 `GPUPipelineLayout`을 사용합니다. 각 `GPUBindGroupLayout`은 특정 그룹 인덱스에 할당됩니다.

<div class="webgpu_center"><img src="resources/webgpu-bind-group-layouts.svg" style="width: 900px;"></div>

바인드 그룹은 각각 특정 `GPUBindGroupLayout`으로 생성됩니다.

`draw`나 `dispatchWorkgroups`를 호출할 때, WebGPU는 현재 파이프라인의 `GPUPipelineLayout`에 있는 각 그룹 인덱스에 대한 `GPUBindGroupLayout`이 `setBindGroup`으로 설정된 현재 바인딩된 바인드 그룹과 일치하는지만 확인하면 됩니다. 이 확인은 매우 간단합니다. 대부분의 세부 확인은 바인드 그룹을 생성할 때 발생합니다. 이렇게 하면 실제로 그리거나 계산할 때 확인할 것이 거의 남지 않습니다.

이 웹사이트의 대부분 샘플처럼 `layout: 'auto'`로 파이프라인을 생성하면, 파이프라인은 자체 `GPUPipelineLayout`을 생성하고 `GPUBindGroupLayout`을 자동으로 채웁니다.

`layout: 'auto'`를 사용하지 **않는** 두 가지 주요 이유가 있습니다.

1. **기본 `'auto'` 레이아웃과 다른 레이아웃을 원할 경우**

   예를 들어, 텍스처로 `rgba32float`을 사용하고 싶지만, 시도할 때 오류가 발생하는 경우입니다. (아래 참조)

2. **하나의 바인드 그룹을 여러 개의 파이프라인에서 사용하고 싶을 경우**

   `layout: 'auto'`로 파이프라인에서 만들어진 bindGroupLayout에서 만든 바인드 그룹은 다른 파이프라인에서 사용할 수 없습니다.

## <a id="a-rgba32float"></a> `layout: 'auto'`와 다른 바인드 그룹 레이아웃 사용하기 - `'rgba32float'`

바인드 그룹 레이아웃이 자동으로 생성되는 규칙은 [사양에 자세히 설명되어 있습니다](https://www.w3.org/TR/webgpu/#abstract-opdef-default-pipeline-layout). 하지만 한 가지 예로...

`rgba32float` 텍스처를 사용하고 싶다고 가정해 봅시다. [텍스처에 대한 글의 첫 번째 텍스처 사용 예제](webgpu-textures.html)를 가져와서 거꾸로 된 5x7 텍셀 'F'를 그렸습니다. 이를 `rgba32float` 텍스처를 사용하도록 업데이트해 보겠습니다.

변경 사항은 다음과 같습니다.

```js
  const kTextureWidth = 5;
  const kTextureHeight = 7;
-  const _ = [255,   0,   0, 255];  // red
-  const y = [255, 255,   0, 255];  // yellow
-  const b = [  0,   0, 255, 255];  // blue
-  const textureData = new Uint8Array([
+  const _ = [1, 0, 0, 1];  // red
+  const y = [1, 1, 0, 1];  // yellow
+  const b = [0, 0, 1, 1];  // blue
+  const textureData = new Float32Array([
    b, _, _, _, _,
    _, y, y, y, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, _, _, _, _,
  ].flat());

  const texture = device.createTexture({
    label: 'yellow F on red',
    size: [kTextureWidth, kTextureHeight],
-    format: 'rgba8unorm',
+    format: 'rgba32float',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
      { texture },
      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
+      { bytesPerRow: kTextureWidth * 4 * 4 },
      { width: kTextureWidth, height: kTextureHeight },
  );

```

실행하면 오류가 발생합니다.

{{{example url="../webgpu-bind-group-layouts-rgba32float-broken.html"}}}

제가 테스트한 브라우저에서 받은 오류는 다음과 같습니다.

> - WebGPU GPUValidationError: [Texture "yellow F on red"]의 지원되는 샘플 유형(UnfilterableFloat) 중 어느 것도 예상 샘플 유형(Float)과 일치하지 않습니다.`<br>
> - entries[1]을 샘플링된 텍스처로 유효성 검사하는 동안. 예상 항목 레이아웃: {sampleType: TextureSampleType::Float, viewDimension: 2, multisampled: 0}`<br>
> - [BindGroupDescriptor]를 [BindGroupLayout (unlabeled)]에 대해 유효성 검사하는 동안`<br>
> - [Device].CreateBindGroup([BindGroupDescriptor])를 호출하는 동안`

이게 무슨 일일까요? `rgba32float`(및 모든 `xxx32float`) 텍스처는 기본적으로 필터링할 수 없습니다. 필터링 가능하게 만드는 [선택적 기능](webgpu-limits-and-features.html)이 있지만, 이 기능은 모든 곳에서 사용 가능하지 않을 수 있습니다. 특히 2024년 현재 모바일 장치에서 그럴 가능성이 높습니다.

기본적으로 다음과 같이 `texture_2d<f32>`로 바인딩을 선언할 때:

```wgsl
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;
```

그리고 파이프라인을 생성할 때 `layout: 'auto'`를 사용하면 WebGPU는 필터링 가능한 텍스처를 특별히 요구하는 바인드 그룹 레이아웃을 생성합니다. 필터링할 수 없는 텍스처를 바인딩하려고 하면 오류가 발생합니다.

필터링할 수 없는 텍스처를 사용하려면 바인드 그룹 레이아웃을 수동으로 생성해야 합니다.

[여기](resources/wgsl-offset-computer.html)에 셰이더를 붙여넣으면 자동 레이아웃을 생성해주는 도구가 있습니다. 위 예제의 셰이더를 붙여넣으면 다음과 같이 나옵니다.

```js
const bindGroupLayoutDescriptors = [
  {
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "filtering",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
    ],
  },
];
```

이것은 `GPUBindGroupLayoutDescriptor`의 배열입니다. 위에서 볼 수 있듯이 바인드 그룹은 `sampleType: "float"`을 사용합니다. 이는 `'rgba8unorm'`의 유형이지만 `'rgba32float'`의 유형은 아닙니다. 특정 텍스처 형식이 작동하는 샘플 유형은 [스펙 문서의 이 표](https://www.w3.org/TR/webgpu/#texture-format-caps)에서 읽을 수 있습니다.

예제를 수정하려면 텍스처 바인딩과 샘플러 바인딩을 모두 조정해야 합니다. 샘플러 바인딩은 `'non-filtering'` 샘플러로 변경해야 합니다. 텍스처 바인딩은 `'unfilterable-float'`으로 변경해야 합니다.

따라서 먼저 `GPUBindGroupLayout`을 생성해야 합니다.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
*          type: 'non-filtering',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
*          sampleType: 'unfilterable-float',
          viewDimension: '2d',
          multisampled: false,
        },
      },
    ],
  });
```

두 가지 변경 사항이 위에 표시되어 있습니다.

그런 다음 파이프라인에서 사용하는 `GPUBindGroupLayout`의 배열인 `GPUPipelineLayout`을 생성해야 합니다.

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

`createPipelineLayout`은 `GPUBindGroupLayout` 배열이 있는 객체를 받습니다. 그룹 인덱스 순서대로 정렬되므로 첫 번째 항목은 `@group(0)`, 두 번째 항목은 `@group(1)`이 됩니다. 하나를 건너뛰려면 비어 있거나 정의되지 않은 요소를 추가해야 합니다.

마지막으로 파이프라인을 생성할 때 파이프라인 레이아웃을 전달합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded textured quad pipeline',
-    layout: 'auto',
+    layout: pipelineLayout,
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

이제 예제가 다시 작동하지만 `rgba32float` 텍스처를 사용합니다.

{{{example url="../webgpu-bind-group-layouts-rgba32float-fixed.html"}}}

참고: 이 예제가 작동하는 이유는 위에서 unfilterable-float 를 받도록 바인드 그룹 레이아웃을 만들었기 때문이기도 하지만, 예제가 `'nearest'` 필터링만 사용하는 `GPUSampler`를 사용하기 때문이기도 합니다. `magFilter`, `minFilter`, `mipmapFilter` 중에 하나라도 `'linear'`로 설정했다면, `'non-filtering'` 샘플러 바인딩에 `'filtering'` 샘플러를 사용하려고 했다는 오류가 발생했을 것입니다.

## `layout: 'auto'`와 다른 바인드 그룹 레이아웃 사용하기 - 동적 오프셋

기본적으로 바인드 그룹을 만들고 uniform 또는 storage 버퍼를 바인딩하면 전체 버퍼가 바인딩됩니다. 바인드 그룹을 생성할 때 오프셋과 길이를 전달할 수도 있습니다. 두 경우 모두 일단 설정되면 변경할 수 없습니다.

WebGPU에는 `setBindGroup`을 호출할 때 오프셋을 변경할 수 있는 옵션이 있습니다. 이 기능을 사용하려면 바인드 그룹 레이아웃을 수동으로 생성하고 나중에 설정하려는 각 바인딩에 대해 `hasDynamicOffsets: true`를 설정해야 합니다.

[기초에 대한 글](webgpu-fundamentals.html#a-run-computations-on-the-gpu)의 간단한 계산 예제를 사용하겠습니다. 동일한 버퍼에 두 세트의 값을 추가하고, 동적 오프셋을 사용하여 어느 세트를 사용할지 선택하도록 바꿔봅니다.

먼저 셰이더를 다음과 같이 변경해 보겠습니다.

```wgsl
@group(0) @binding(0) var<storage, read_write> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3u
) {
  let i = id.x;
  dst[i] = a[i] + b[i];
}
```

`a`와 `b`를 더해서 `dst`에 쓰는 것을 볼 수 있습니다.

다음으로 바인드 그룹 레이아웃을 만들어 보겠습니다.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
    ],
  });
```

모두 `hasDynamicStorage: true`로 표시되어 있습니다.

이제 이를 사용하여 파이프라인을 만들어 보겠습니다.

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });

  const pipeline = device.createComputePipeline({
-    label: 'double compute pipeline',
-    layout: 'auto',
+    label: 'add elements compute pipeline',
+    layout: pipelineLayout,
    compute: {
      module,
    },
  });
```

버퍼를 설정해 봅시다. 오프셋은 256의 배수여야 하므로[^minStorageBufferOffsetAlignment], 256 * 3 바이트 크기의 버퍼를 만들어 최소 3개의 유효한 오프셋(0, 256, 512)을 갖도록 합니다.

[^minStorageBufferOffsetAlignment]: 장치가 더 작은 오프셋을 지원할 수도 있습니다. [제한 및 기능](webgpu-limits-and-features.html)의 `minStorageBufferOffsetAlignment` 또는 `minUniformBufferOffsetAlignment`를 참조하세요.

```js
-  const input = new Float32Array([1, 3, 5]);
+  const input = new Float32Array(64 * 3);
+  input.set([1, 3, 5]);
+  input.set([11, 12, 13], 64);

  // 계산을 담을 GPU 버퍼 생성
  // 입력 및 출력
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // 입력 데이터를 해당 버퍼에 복사
  device.queue.writeBuffer(workBuffer, 0, input);
```

위 코드는 `64 * 3`개의 32비트 부동 소수점 배열을 만듭니다. 이는 768바이트입니다.

원래 예제는 동일한 버퍼에서 읽고 썼으므로 동일한 버퍼를 3번 바인딩합니다.

```js
  // 계산에 사용할 버퍼를 셰이더에 알리기 위한
  // bindGroup 설정
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
-      { binding: 0, resource: workBuffer  },
+      { binding: 0, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 1, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 2, resource: { buffer: workBuffer, size: 256 } },
    ],
  });
```

참고로, 크기를 지정해야 합니다. 그렇지 않으면 전체 버퍼의 크기로 기본 설정됩니다. 그런 다음 오프셋 > 0을 설정하면 범위를 벗어난 버퍼 부분을 지정하게 되므로 오류가 발생합니다.

`setBindGroup`에서 이제 동적 오프셋이 있는 각 버퍼에 대해 하나의 오프셋을 전달합니다. 바인드 그룹 레이아웃의 3개 항목 모두를 `hasDynamicOffset: true`로 표시했으므로 바인딩 슬롯 순서대로 3개의 오프셋이 필요합니다.

```js
  ...
  pass.setPipeline(pipeline);
-  pass.setBindGroup(0, bindGroup);
+  pass.setBindGroup(0, bindGroup, [0, 256, 512]);
  pass.dispatchWorkgroups(3);
  pass.end();
```

마지막으로 결과를 표시하도록 코드를 변경해야 합니다.

```js
-  console.log(input);
-  console.log(result);
+  console.log('a', input.slice(0, 3));
+  console.log('b', input.slice(64, 64 + 3));
+  console.log('dst', result.slice(128, 128 + 3));
```

{{{example url="../webgpu-bind-group-layouts-dynamic-offsets.html"}}}

동적 오프셋을 사용하는 것은 비동적 오프셋보다 약간 느립니다. 그 이유는 비동적 오프셋의 경우 오프셋과 크기가 버퍼 범위 내에 있는지 여부가 바인드 그룹을 생성할 때 확인되기 때문입니다. 동적 오프셋의 경우 `setBindGroup`을 호출할 때까지 해당 확인을 할 수 없습니다. `setBindGroup`을 수백 번만 호출하는 경우 그 차이는 중요하지 않을 수 있습니다. `setBindGroup`을 수천 번 호출하는 경우 더 눈에 띌 수 있습니다.

## <a id="a-sharing-bind-groups"></a> 하나 이상의 파이프라인에서 바인드 그룹 사용하기

바인드 그룹 레이아웃을 수동으로 생성하는 또 다른 이유는 동일한 바인드 그룹을 둘 이상의 파이프라인에서 사용할 수 있도록 하기 위함입니다.

흔하게 바인드 그룹을 재사용하게 되는 경우는 그림자가 있는 기본 3D 장면 렌더러입니다.

기본 3D 장면 렌더러에서는 바인딩을 다음과 같이 분리하는 것이 일반적입니다.

* global <sup>전역</sup> (원근 및 뷰 행렬 등)
* material <sup>재질</sup> (텍스처, 색상)
* local <sup>지역</sup> (모델 행렬 등)

그런 다음 다음과 같이 렌더링합니다.

```
setBindGroup(0, globalsBG)
for each material
  setBindGroup(1, materialBG)
  for each object that uses material
    setBindGroup(2, localBG)
    draw(...)
```

[그림자](webgpu-shadows.html)를 추가할 때, 먼저 그림자 맵 파이프라인으로 그림자 맵을 그려야 합니다. 그리기 파이프라인과 그림자 맵 렌더링 파이프라인에서 작동하는 별도의 바인드 그룹을 사용하는 대신, 하나의 바인드 그룹 세트를 만들고 두 경우 모두 동일한 것을 사용하는 것이 훨씬 쉽습니다.

비록 [그림자에 대한 글](webgpu-shadows.html)이 공유 바인드 그룹을 사용하지만, 단순히 이 용도의 예제로서 보여주기에는 다소 코드 크기가 큽니다.
[기초에 대한 글](webgpu-fundamentals.html#a-run-computations-on-the-gpu)의 간단한 계산 예제를 다시 가져와서 하나의 바인드 그룹으로 2개의 계산 파이프라인을 사용하도록 만들겠습니다.

먼저 3을 더하는 기능을 가진 셰이더 모듈을 추가해 보겠습니다.

```js
-  const module = device.createShaderModule({
+  const moduleTimes2 = device.createShaderModule({
    label: 'doubling compute module',
    code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });

+  const modulePlus3 = device.createShaderModule({
+    label: 'adding 3 compute module',
+    code: /* wgsl */ `
+      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
+
+      @compute @workgroup_size(1) fn computeSomething(
+        @builtin(global_invocation_id) id: vec3u
+      ) {
+        let i = id.x;
+        data[i] = data[i] + 3.0;
+      }
+    `,
+  });
```

그런 다음 2개의 파이프라인이 동일한 `GPUBindGroup`을 공유하기 위해서 `GPUBindGroupLayout`과 `GPUPipelineLayout`을 생성해 보겠습니다.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          minBindingSize: 0,
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

이제 파이프라인을 생성할 때 이것들을 사용합니다.

```js
-  const pipeline = device.createComputePipeline({
+  const pipelineTimes2 = device.createComputePipeline({
    label: 'doubling compute pipeline',
-    layout: 'auto',
+    layout: pipelineLayout,
    compute: {
      module: moduleTimes2,
    },
  });

+  const pipelinePlus3 = device.createComputePipeline({
+    label: 'plus 3 compute pipeline',
+    layout: pipelineLayout,
+    compute: {
+      module: modulePlus3,
+    },
+  });
```

바인드 그룹을 설정할 때 `bindGroupLayout`을 직접 사용해 보겠습니다.

```js
  // 계산에 사용할 버퍼를 셰이더에 알리기 위한
  // bindGroup 설정
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
-    layout: pipeline.getBindGroupLayout(0),
+    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: workBuffer  },
    ],
  });
```

마지막으로 두 파이프라인을 모두 사용해 보겠습니다.

```js
  // 계산을 수행할 명령 인코딩
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
-  pass.setPipeline(pipeline);
+  pass.setPipeline(pipelineTimes2);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
+  pass.setPipeline(pipelinePlus3);
+  pass.dispatchWorkgroups(input.length);
  pass.end();
```

결과는 하나의 바인드 그룹으로 2를 곱하고 3을 더하는 것입니다.

{{{example url="../webgpu-bind-group-layouts-multiple-pipelines.html"}}}

별로 흥미롭지는 않지만 적어도 작동하고 간단한 예제입니다.

바인드 그룹 레이아웃을 수동으로 만들지 여부는 전적으로 사용자에게 달려 있습니다. 위 예제에서는 각 파이프라인에 대해 하나씩 2개의 바인드 그룹을 만드는 것이 더 쉬웠을 것입니다.

간단한 상황에서는 바인드 그룹 레이아웃을 수동으로 만들 필요가 없는 경우가 많지만, WebGPU 프로그램이 더 복잡해지면 바인드 그룹 레이아웃 만들기가 필요해지는 때가 올수도 있습니다.

## <a id="a-bind-group-layout-notes"></a> 바인드 그룹 레이아웃 참고 사항:

`GPUBindGroupLayout` 생성에 대한 몇 가지 참고 사항:

* ## 각 항목은 어떤 `binding`에 대한 것인지 선언해야 합니다.

* ## 각 항목은 어떤 스테이지에서 보일지 선언해야 합니다.

  위 예제에서는 하나의 가시성만 선언했습니다. 예를 들어, 정점 셰이더와 프래그먼트 셰이더 모두에서 바인드 그룹을 참조하고 싶다면 다음을 사용합니다.

  ```js
     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX
  ```

  또는 세 스테이지 모두:

  ```js
     visibility: GPUShaderStage.COMPUTE |
                 GPUShaderStage.FRAGMENT | 
                 GPUShaderStage.VERTEX
  ```

* ## 몇 가지 기본값이 있습니다.

  `texture:` 바인딩의 기본값은 다음과 같습니다.

  ```js
  {
    sampleType: 'float',
    viewDimension: '2d',
    multisampled: false,
  }
  ```

  `sampler:` 바인딩의 기본값은 다음과 같습니다.

  ```js
  {
    type: 'filtering',
  }
  ```

  즉, 가장 일반적인 샘플러 및 텍스처 사용에서 다음과 같이 샘플러 및 텍스처 항목을 선언할 수 있습니다.

  ```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},  // 기본값 사용
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},  // 기본값 사용
      },
    ],
  });
  ```

* ## 버퍼 항목은 가능하면 `minBindingSize`를 선언해야 합니다.

  버퍼 바인딩을 선언할 때 `minBindingSize`를 지정할 수 있습니다.

  좋은 예는 uniform을 위한 구조체를 만드는 것입니다. 예를 들어 [uniform에 대한 글](webgpu-uniforms.html)에서 이 구조체를 사용했습니다.

  ```wgsl
  struct OurStruct {
    color: vec4f,
    scale: vec2f,
    offset: vec2f,
  };

  @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
  ``` 

  32바이트가 필요하므로 다음과 같이 `minBindingSize`를 선언해야 합니다.

  ```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
          minBindingSize: 32,
        },
      },
    ],
  });
  ```

  `minBindingSize`를 선언하는 이유는 WebGPU가 `createBindGroup`을 호출할 때 버퍼 크기/오프셋이 올바른 크기인지 확인하도록 하기 위함입니다. `minBindingSize`를 설정하지 않으면 WebGPU는 draw 혹은 dispatchWorkgroups 호출 시점에 파이프라인의 버퍼가 올바른 크기인지 확인해야 합니다. 모든 그리기 호출을 확인하는 것은 바인드 그룹을 생성할 때 한 번 확인하는 것보다 느립니다.

  반면에, 위 예제에서 숫자를 두 배로 만드는 storage 버퍼를 사용했을 때는 `minBindingSize`를 선언하지 않았습니다. 이는 storage 버퍼가 `array`로 선언되었기 때문에 전달하는 값의 수에 따라 다른 크기의 버퍼를 바인딩할 수 있기 때문입니다.


[스펙 문서의 이 부분](https://www.w3.org/TR/webgpu/#dictdef-gpubindgrouplayoutentry)은 바인드 그룹 레이아웃을 만들기 위한 모든 옵션을 자세히 설명합니다.

[이 글](https://toji.dev/webgpu-best-practices/bind-groups) 또한 바인드 그룹 및 바인드 그룹 레이아웃에 대한 몇 가지 조언을 제공합니다.

[이 라이브러리](https://greggman.github.io/webgpu-utils)는 구조체 크기와 기본 바인드 그룹 레이아웃을 계산해 줍니다.
