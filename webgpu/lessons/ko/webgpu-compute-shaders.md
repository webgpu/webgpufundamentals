Title: WebGPU 컴퓨트 셰이더 기초
Description: WebGPU에서 컴퓨트 셰이더를 사용하는 방법에 대해 알아봅시다.
TOC: 컴퓨트 셰이더 기초

이 문서는 [WebGPU 기초](webgpu-fundamentals.html) 문서에서부터 이어집니다.
저희는 컴퓨트 셰이더의 기초를 배우고, 실제 문제를 해결하는 예제를 살펴볼 것입니다.

이전 문서에서 숫자를 두배로 늘려주는 아주 간단한 컴퓨트 셰이더를 만들어봤습니다.

아래가 바로 그 내용이었죠.

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  let i = id.x;
  data[i] = data[i] * 2.0;
}
```

그런 다음 이 컴퓨트 셰이더를 다음과 같이 효율적으로 실행했습니다.


```js
  ...
  pass.dispatchWorkgroups(count);
```

이 작업 그룹(workgroup)의 정의에 대해 살펴볼 필요가 있습니다.

하나의 작업 그룹을 스레드의 작은 묶음으로 생각하셔도 좋습니다.
각 스레드는 병렬로 실행됩니다. 작업 그룹의 크기는 WGSL에서 정적으로 정의해야 합니다.
작업 그룹의 크기는 3차원으로 정의되지만, 기본값은 1입니다.
따라서 `@workgroup_size(1)`은 `@workgroup_size(1, 1, 1)`과 동일합니다.

<a id="a-local-invocation-id"></a>만약 작업 그룹을 `@workgroup_size(3, 4, 2)`로 정의한다면, 이는 총 3 * 4 * 2개의 스레드를 정의하는 것으로, 다르게 말하자면 24개의 스레드로 구성된 작업 그룹을 정의하는 것입니다.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup.svg" style="width: 500px;">
  <div>작업 그룹 내 각 스레드의 <code>local_invocation_id</code></div>
</div>

<a id="a-workgroup-id"></a>만약 저희가 `pass.dispatchWorkgroups(4, 3, 2)`를 호출한다면, 24개의 스레드를 가진 한 작업 그룹을 총 4 * 3 * 2번 (24번), 총 576개의 스레드로 실행합니다.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup-dispatch.svg" style="width: 500px;">
  <div>디스패치된 작업 그룹의 <code>workgroup_id</code></div>
</div>

저희가 만든 컴퓨트 셰이더의 각 "실행(invocation)"에서는 다음과 같은 빌트인 변수들을 사용할 수 있습니다.

* `local_invocation_id`: 작업 그룹 내 스레드의 고유한 ID입니다.

  [위의 다이어그램을 다시 살펴보세요](#a-local-invocation-id).

* `workgroup_id`: 작업 그룹의 고유한 ID입니다.

  한 작업 그룹의 모든 스레드는 동일한 작업 그룹 ID를 갖게됩니다.

  [위의 다이어그램을 다시 살펴보세요](#a-workgroup-id).

* `global_invocation_id`: 각 스레드의 고유한 ID입니다.

  이는 다음과 같이 생각할 수 있습니다.

  ```
  global_invocation_id = workgroup_id * workgroup_size + local_invocation_id
  ```

* `num_workgroups`: `pass.dispatchWorkgroups`로 전달하는 값입니다.

* `local_invocation_index`: 스레드의 선형화된(linearized) ID입니다.

  이는 다음과 같이 생각할 수 있습니다.

  ```
  rowSize = workgroup_size.x
  sliceSize = rowWidth * workgroup_size.y
  local_invocation_index =
        local_invocation_id.x +
        local_invocation_id.y * rowSize +
        local_invocation_id.z * sliceSize
  ```

이 값들을 사용하는 예시를 하나 만들어봅시다. 각 호출마다 버퍼에 값을 쓰고, 그 값을 출력해보겠습니다.

아래는 작성한 셰이더입니다.

```js
const dispatchCount = [4, 3, 2];
const workgroupSize = [2, 3, 4];

// 배열 내 모든 요소들을 곱합니다.
const arrayProd = arr => arr.reduce((a, b) => a * b);

const numThreadsPerWorkgroup = arrayProd(workgroupSize);

const code = `
// NOTE!: vec3u은 4바이트씩 패딩됩니다.
@group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
@group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
@group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

@compute @workgroup_size(${workgroupSize}) fn computeSomething(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
    @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  // workgroup_index는 local_invocation_index와 비슷하지만,
  // 작업 그룹 내 스레드가 아닌, 작업 그룹을 대상으로 하는 인덱스라는 점이 다릅니다.
  // 이는 빌트인 변수로 존재하지 않기 때문에, 직접 계산합니다.

  let workgroup_index =  
     workgroup_id.x +
     workgroup_id.y * num_workgroups.x +
     workgroup_id.z * num_workgroups.x * num_workgroups.y;

  // global_invocation_index는 local_invocation_index와 비슷하지만,
  // 디스패치된 모든 작업 그룹의 모든 호출에 걸쳐 선형적이라는 점이 다릅니다.
  // 이는 빌트인 변수로 존재하지 않기 때문에, 직접 계산합니다.

  let global_invocation_index =
     workgroup_index * ${numThreadsPerWorkgroup} +
     local_invocation_index;

  // 이제 버퍼에 각 빌트인 변수들을 쓸 수 있습니다.
  workgroupResult[global_invocation_index] = workgroup_id;
  localResult[global_invocation_index] = local_invocation_id;
  globalResult[global_invocation_index] = global_invocation_id;
`;
```

여기서는 JavaScript의 템플릿 리터럴을 사용하여 `workgroupSize` 변수를 통해 작업 그룹의 크기를 설정했습니다.
이는 결국 셰이더에 하드코딩됩니다.

이제 셰이더가 생겼으니, 그 결과를 저장할 3개의 버퍼를 만들 수 있습니다.

```js
  const numWorkgroups = arrayProd(dispatchCount);
  const numResults = numWorkgroups * numThreadsPerWorkgroup;
  const size = numResults * 4 * 4;  // vec3f * u32

  let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
  const workgroupBuffer = device.createBuffer({size, usage});
  const localBuffer = device.createBuffer({size, usage});
  const globalBuffer = device.createBuffer({size, usage});
```

이전에 언급했듯이, 스토리지 버퍼를 곧장 JavaScript로 매핑할 수는 없기 때문에, 이를 매핑해 줄 버퍼가 추가로 필요합니다.
스토리지 버퍼에서의 결과를 복사하여 매핑이 가능한 결과 버퍼에 저장한 다음, 그 결과를 읽어와야 합니다.

```js
  usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
  const workgroupReadBuffer = device.createBuffer({size, usage});
  const localReadBuffer = device.createBuffer({size, usage});
  const globalReadBuffer = device.createBuffer({size, usage});
```

이제 바인드그룹을 만들어 스토리지 버퍼들을 모두 바인드합니다.

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workgroupBuffer }},
      { binding: 1, resource: { buffer: localBuffer }},
      { binding: 2, resource: { buffer: globalBuffer }},
    ],
  });
```

이전 예제와 동일하게, 인코더와 컴퓨트 패스 인코더를 실행한 다음 명령을 추가하여 컴퓨트 셰이더를 실행합니다.

```js
  // 계산을 수행하기 위한 명령을 인코딩합니다.
  const encoder = device.createCommandEncoder({ label: 'compute builtin encoder' });
  const pass = encoder.beginComputePass({ label: 'compute builtin pass' });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...dispatchCount);
  pass.end();
```

스토리지 버퍼로부터 매핑 가능한 결과 버퍼에 이를 복사합니다.

```js
  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
  encoder.copyBufferToBuffer(localBuffer, 0, localReadBuffer, 0, size);
  encoder.copyBufferToBuffer(globalBuffer, 0, globalReadBuffer, 0, size);
```

그런 다음 인코더를 종료하고 명령 버퍼를 제출합니다.

```js
  // 인코딩을 완료하고 명령을 제출합니다.
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

이전과 마찬가지로, 결과를 읽기 위해서는 버퍼를 매핑하고 준비가 되면 해당 내용의 typed array 뷰를 가져옵니다.

```js
  // 결과를 읽어옵니다.
   await Promise.all([
    workgroupReadBuffer.mapAsync(GPUMapMode.READ),
    localReadBuffer.mapAsync(GPUMapMode.READ),
    globalReadBuffer.mapAsync(GPUMapMode.READ),
  ]);

  const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange());
  const local = new Uint32Array(localReadBuffer.getMappedRange());
  const global = new Uint32Array(globalReadBuffer.getMappedRange());
```
> 중요: 여기서 3개의 버퍼를 매핑하고, `await Promise.all`을 사용하여 모든 버퍼가 사용 가능할 때까지 기다립니다.
> 마지막 버퍼만 기다리는 것은 *불가능*합니다. 반드시 모든 3개의 버퍼를 기다려야 합니다.

마침내 결과를 출력할 수 있습니다.

```js
  const get3 = (arr, i) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
  };

  for (let i = 0; i < numResults; ++i) {
    if (i % numThreadsPerWorkgroup === 0) {
      log(`\
 ---------------------------------------
 global                 local     global   dispatch: ${i / numThreadsPerWorkgroup}
 invoc.    workgroup    invoc.    invoc.
 index     id           id        id
 ---------------------------------------`);
    }
    log(` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`)
  }
}

function log(...args) {
  const elem = document.createElement('pre');
  elem.textContent = args.join(' ');
  document.body.appendChild(elem);
}
```

아래는 그 결과입니다.

{{{example url="../webgpu-compute-shaders-builtins.html"}}}

이 빌트인 변수들은 일반적으로 `pass.dispatchWorkgroups`의 호출마다 컴퓨트 셰이더의 각 스레드에 대해 변경되는 유일한 입력값입니다.
따라서 주어지는 `...id` 빌트인들을 입력값으로 사용하여 원하는 작업을 수행하는 컴퓨트 셰이더 함수를 설계하는 방법을 파악해야 합니다.

## 작업 그룹의 크기

작업 그룹의 크기는 어떻게 정해야 할까요? 이는 종종 나오는 질문입니다.
그냥 항상 `@workgroup_size(1, 1, 1)`을 사용하고, `pass.dispatchWorkgroups`의 매개변수들만으로 실행할 반복 횟수를 결정하면 더 쉽지 않을까요?

그 이유는 한 작업 그룹 내 여러 개의 스레드가 개별적인 디스패치보다 빠르기 때문입니다.

우선, 작업 그룹의 스레드는 종종 락스텝(lockstep)으로 실행되기 때문에, 여기서 16개의 스레드를 실행하는 것은 1개의 스레드를 실행하는 것과 동일한 속도로 실행됩니다.

WebGPU의 기본 제한은 다음과 같습니다.

* `maxComputeInvocationsPerWorkgroup`: 256
* `maxComputeWorkgroupSizeX`: 256
* `maxComputeWorkgroupSizeY`:	256
* `maxComputeWorkgroupSizeZ`:	64

위에서 확인할 수 있듯, 가장 앞의 `maxComputeInvocationsPerWorkgroup`는 `@workgroup_size`의 3개 매개변수의 곱이 256보다 큰 수가 될 수 없다는 것을 의미합니다. 

이는 다시 말해, 다음과 같습니다.

```
   @workgroup_size(256, 1, 1)   // ok
   @workgroup_size(128, 2, 1)   // ok
   @workgroup_size(16, 16, 1)   // ok
   @workgroup_size(16, 16, 2)   // bad 16 * 16 * 2 = 512
```

안타깝게도, "완벽한 크기"는 GPU에 따라 다르며, WebGPU는 이를 제공할 수 없습니다.
다른 크기를 선택해야 하는 특별한 이유가 없는 한, **WebGPU는 일반적으로 작업 그룹 크기를 64로 선택할 것을 권장**합니다.
대부분의 GPU는 64개의 작업을 락스텝으로 효율적으로 실행할 수 있습니다.
더 높은 숫자를 선택했지만 GPU가 빠른 경로로 이를 처리할 수 없다면, 느린 경로를 선택하게 됩니다.
반면, GPU가 처리할 수 있는 숫자보다 낮은 숫자를 선택하면 최대 성능을 얻을 수 없습니다.

## 컴퓨트 셰이더에서의 경쟁(Race)

WebGPU에서 흔히 발생하는 실수는 경쟁 상태(race condition)를 처리하지 않는 것입니다.
경쟁 상태란 여러 스레드가 동시에 실행되는 상황에서 사실상 어느 쪽이 먼저 또는 마지막으로 끝날지 경쟁하는 상황입니다.

아래와 같은 컴퓨트 셰이더가 있다고 해봅시다.

```wgsl
@group(0) @binding(0) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(32) fn computeSomething(
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
) {
  result[0] = local_invocation_id.x;
`;
```

이것이 읽기 어렵다면, 다음의 JavaScript 코드와 비슷합니다.

```js
const result = [];
for (let i = 0; i < 32; ++i) {
  result[0] = i;
}
```

JavaScript의 경우, 코드가 전부 실행되면 `result[0]`은 분명히 31입니다.
하지만 컴퓨트 셰이더의 경우 셰이더의 32개의 반복이 모두 병렬로 실행됩니다.
가장 마지막에 완료되는 것이 곧 `result[0]`의 값이 됩니다.
어떤 것이 마지막으로 실행되는지는 정의되어 있지 않습니다.

규격(spec)을 살펴보자면:

> WebGPU는 다음에 대한 보장을 제공하지 않습니다:
>
> * 서로 다른 작업 그룹의 호출이 동시에 실행되는지에 대한 여부를 보장하지 않습니다.
>   즉, 한번에 두 개 이상의 작업 그룹이 실행된다고 가정할 수 없습니다.
>
> * 작업 그룹의 호출이 실행되기 시작하면 다른 작업 그룹의 실행이 차단되는지에 대한 여부를 보장하지 않습니다.
>   즉, 한 번에 하나의 작업 그룹만 실행된다고 가정할 수 없습니다.
>   작업 그룹이 실행되는 동안, 구현(implementation)은 다른 작업 그룹이나 대기 중인지만 차단되지 않은 다른 작업도 동시에 실행하도록 선택할 수 있습니다.
>
> * 특정 작업 그룹의 호출이 다른 작업 그룹의 호출보다 먼저 실행되기 시작하는지의 여부를 보장하지 않습니다.
>   즉, 작업 그룹이 특정 순서로 실행된다고 가정할 수 없습니다.

추후 예제를 통해 이 문제를 처리하는 몇 가지 방법을 살펴보겠습니다. 
지금까지의 두 예제들은 모두 각 컴퓨트 셰이더의 반복이 다른 반복에 영향을 받지 않는 작업을 수행하기 때문에 경쟁 상태가 발생하지 않습니다.

추가 예제: TBD
