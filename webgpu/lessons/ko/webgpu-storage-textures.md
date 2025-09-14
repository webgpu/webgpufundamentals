Title: WebGPU 스토리지 텍스처
Description: 스토리지 텍스처 사용법
TOC: 스토리지 텍스처

스토리지 텍스처(Storage textures)는 직접 쓰기나 "저장"을 할 수 있는 [텍스처](webgpu-textures.html)입니다.
일반적으로는 버텍스 셰이더에서 삼각형을 지정하고 GPU가 간접적으로 텍스처를
업데이트해 주지만, 스토리지 텍스처를 사용하면 원하는 곳에 직접 텍스처에
쓸 수 있습니다.

스토리지 텍스처는 특별한 종류의 텍스처가 아니라, `createTexture`로 생성하는
다른 텍스처와 마찬가지의 텍스처입니다. 필요에 의해 사용하던 다른 '사용 플래그' 위에
`STORAGE_BINDING` 사용 플래그를 추가하면 됩니다. 그러면 그 텍스처를 스토리지 텍스처로도 사용할 수 있습니다.

어떤 면에서 스토리지 텍스처는 2D 배열로 사용하는 스토리지 버퍼와 같습니다. 예를 들어
스토리지 버퍼를 만들고 다음과 같이 코드에서 참조할 수 있습니다:

```wgsl
@group(0) @binding(0)
  var<storage> buf: array<f32>;

...
fn loadValueFromBuffer(pos: vec2u) -> f32 {
  return buffer[pos.y * width + pos.x];
}

fn storeValueToBuffer(pos: vec2u, v: f32) {
  buffer[pos.y * width + pos.x] = v;
}

...
  let pos = vec2u(2, 3);
  var v = loadValueFromBuffer(pos);
  storeValueToBuffer(pos, v * 2.0);

```

스토리지 텍스처와 비교하면:

```
@group(0) @binding(0)
  var tex: texture_storage_2d<r32float, read_write>;

...

   let pos = vec2u(2, 3);
   let mipLevel = 0;
   var v = textureLoad(tex, pos, mipLevel);
   textureStore(tex, pos, mipLevel, v * 2);

```

이 둘이 동등해 보인다면, 수동으로 스토리지 버퍼를 사용하는 것과
스토리지 텍스처를 사용하는 것 사이에는 어떤 차이가 있을까요?

* 스토리지 텍스처는 여전히 텍스처입니다.

  하나의 셰이더에서는 스토리지 텍스처로 사용하고 다른 셰이더에서는
  일반 텍스처(샘플러와 밉매핑 등과 함께)로 사용할 수 있습니다.

* 스토리지 텍스처에는 포맷 해석이 있지만, 스토리지 버퍼에는 없습니다.

  예시:

  ```wsgl
  @group(0) @binding(0) var tex: texture_storage_2d<rgba8unorm, read>;
  @group(0) @binding(1) var buf: array<f32>;

     ...
      let t = textureLoad(tex, pos, 0);
      let b = buffer[pos.y * bufferWidth + pos.x];
  ```

  위에서 `textureLoad`를 호출할 때, 텍스처는 `rgba8unorm` 텍스처이므로
  4바이트가 로드되고 자동으로 0과 1 사이의 4개의 부동소수점 값으로 변환되어
  `vec4f`로 반환됩니다.

  버퍼의 경우, 4바이트가 하나의 `f32` 값으로 로드됩니다. 물론 버퍼를
  `array<u32>`로 변경한 후 값을 로드하여 수동으로 4바이트 값으로 분할하고
  직접 float으로 변환할 수도 있지만, 이런 변환이 필요하다면 스토리지 텍스처를
  사용하면 자동으로 처리됩니다.

* 스토리지 텍스처에는 차원이 있습니다.

  버퍼의 경우, 그 길이, 더 정확히는 바인딩[^binding]의 길이가 유일한 차원입니다.
  위에서 버퍼를 2D 배열로 사용할 때, 2D 좌표를 1D 버퍼 인덱스로 변환하기 위해
  `width`가 필요했습니다. `width` 값을 하드코딩하거나 어떤 방법으로든
  전달해야 합니다[^how-to-pass-data]. 텍스처의 경우 `textureDimensions`를
  호출해서 텍스처의 차원을 얻을 수 있습니다.

  [^binding]: 바인드 그룹을 생성하고 버퍼를 지정할 때 선택적으로 오프셋과
  길이를 지정할 수 있습니다. 셰이더에서 배열의 길이는 버퍼의 길이가 아닌
  바인딩의 길이로 결정됩니다. 오프셋을 지정하지 않으면 기본값은 0이고
  길이는 전체 버퍼 크기로 기본 설정됩니다.

  [^how-to-pass-data]: [유니폼](webgpu-uniforms.html),
  다른 [스토리지 버퍼](webgpu-storage-buffers.html) 또는 심지어 같은
  버퍼의 첫 번째 값으로도 버퍼 너비를 전달할 수 있습니다.

하지만 스토리지 텍스처에는 제한이 있습니다.

* 특정 포맷만 `read_write`가 가능합니다.

  `r32float`, `r32sint`, `r32uint`입니다.

  다른 포맷들은 단일 셰이더 내에서 `read` 또는 `write`만 가능합니다.

* 특정 포맷만 스토리지 텍스처로 사용할 수 있습니다.

  텍스처 포맷은 매우 많지만 그중 일부 포맷만 스토리지 텍스처로
  사용할 수 있습니다.

  * `rgba8(unorm/snorm/sint/uint)`
  * `rgba16(float/sint/uint)`
  * `rg32(float/sint/uint)`
  * `rgba32(float/sint/uint)`

  주목할 것은 `bgra8unorm`이 사용 불가능한 점인데, 이는 아래에서 다룰 것입니다.

* 스토리지 텍스처는 샘플러를 사용할 수 없습니다.

  텍스처를 일반 `TEXTURE_BINDING`으로 사용하면 여러 밉(mip) 레벨에 걸쳐 최대 16개의
  텍셀을 로드하고 함께 블렌딩하는 `textureSample` 같은 함수를 호출할 수
  있습니다. 텍스처를 `STORAGE_BINDING`으로 사용할 때는 한 번에 단일 텍셀을
  로드하고 저장하는 `textureLoad` 또는 `textureStore`만 호출할 수 있습니다.

## <a id="canvas-as-storage-texture"></a> 캔버스를 스토리지 텍스처로

캔버스 텍스처를 스토리지 텍스처로 사용할 수 있습니다. 그렇게 하려면,
스토리지 텍스처로 사용할 수 있는 텍스처를 제공하도록 컨텍스트를 구성합니다.

```js
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format: presentationFormat,
+    usage: GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.STORAGE_BINDING,
  });
```

`TEXTURE_BINDING`은 브라우저 자체가 텍스처를 페이지에 렌더링할 수 있도록
필요합니다. `STORAGE_BINDING`은 캔버스의 텍스처를 스토리지 텍스처로
사용할 수 있게 해줍니다. 이 사이트의 대부분 예제처럼 렌더 패스를 통해
텍스처에 렌더링하려면 `RENDER_ATTACHMENT` 사용 플래그도 추가해야 합니다.

하지만 여기서 문제가 있습니다. [첫 번째 글](webgpu-fundamentals.html)에서
다룬 것처럼, 일반적으로 `navigator.gpu.getPreferredCanvasFormat`을 호출해서
선호하는 캔버스 포맷을 얻습니다. `getPreferredCanvasFormat`은 사용자
시스템에서 더 성능이 좋은 포맷에 따라 `rgba8unorm` 또는 `bgra8unorm`을
반환합니다.

하지만 위에서 언급한 것처럼, 기본적으로는 `bgra8unorm` 텍스처를
스토리지 텍스처로 사용할 수 없습니다.

다행히 `'bgra8unorm-storage'`라는 [기능](webgpu-limits-and-features.html)이
있습니다. 이 기능을 활성화하면 `bgra8unorm` 텍스처를 스토리지 텍스처로
사용할 수 있습니다. 일반적으로 `bgra8unorm`을 선호하는 캔버스 포맷으로
보고하는 모든 플랫폼에서 사용 *가능해야* 하지만, 사용할 수 없을 가능성도
있습니다. 따라서 `'bgra8unorm-storage'` *기능*이 존재하는지 확인해야 합니다.
존재한다면 device 를 얻을 때 그 기능을 요구하고, 선호하는 캔버스 포맷으로 사용할 것입니다.
그렇지 않다면 캔버스 포맷으로 `rgba8unorm`을 선택할 것입니다.

```js
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const hasBGRA8unormStorage = adapter.features.has('bgra8unorm-storage');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: hasBGRA8unormStorage
+      ? ['bgra8unorm-storage']
+      : [],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
-  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
+  const presentationFormat = hasBGRA8unormStorage
+     ? navigator.gpu.getPreferredCanvasFormat()
+     : 'rgba8unorm';
  context.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.STORAGE_BINDING,
  });
```

이제 캔버스 텍스처를 스토리지 텍스처로 사용할 수 있습니다. 텍스처에
동심원을 그리는 간단한 컴퓨트 셰이더를 만들어 보겠습니다.

```js
  const module = device.createShaderModule({
    label: 'circles in storage texture',
    code: `
      @group(0) @binding(0)
      var tex: texture_storage_2d<${presentationFormat}, write>;

      @compute @workgroup_size(1) fn cs(
        @builtin(global_invocation_id) id : vec3u
      )  {
        let size = textureDimensions(tex);
        let center = vec2f(size) / 2.0;

        // the pixel we're going to write to
        let pos = id.xy;

        // The distance from the center of the texture
        let dist = distance(vec2f(pos), center);

        // Compute stripes based on the distance
        let stripe = dist / 32.0 % 2.0;
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);
        let color = select(red, cyan, stripe < 1.0);

        // Write the color to the texture
        textureStore(tex, pos, color);
      }
    `,
  });
```

스토리지 텍스처를 `write`로 표시했고 셰이더 자체에서 특정 텍스처 포맷을
지정해야 했다는 점을 주목하세요. `TEXTURE_BINDING`과 달리, `STORAGE_BINDING`은
텍스처의 정확한 포맷을 알아야 합니다.

설정은 [첫 번째 글에서 작성한 컴퓨트 셰이더](webgpu-fundamentals.html#a-run-computations-on-the-gpu)와
비슷합니다. 셰이더 모듈을 만든 후 이를 사용할 컴퓨트 파이프라인을 설정합니다.

```js
  const pipeline = device.createComputePipeline({
    label: 'circles in storage texture',
    layout: 'auto',
    compute: {
      module,
    },
  });
```

렌더링하기 위해 캔버스의 현재 텍스처를 가져오고, 텍스처를 셰이더에
전달할 수 있도록 바인드 그룹을 만들고, 파이프라인 설정, 바인드 그룹 바인딩,
워크그룹 디스패치의 일반적인 작업을 수행합니다.

```js
  function render() {
    const texture = context.getCurrentTexture();

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
      ],
    });

    const encoder = device.createCommandEncoder({ label: 'our encoder' });
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(texture.width, texture.height);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

결과는 다음과 같습니다:

{{{example url="../webgpu-storage-texture-canvas.html"}}}

일반 텍스처를 사용하는 것도 동일하며, `getCurrentTexture` 대신
`createTexture`를 호출해서 텍스처를 만들고 필요한 다른 사용 플래그와
함께 `STORAGE_BINDING`을 전달하는 것만 다릅니다.

## 속도와 데이터 경합(data race)

위에서는 픽셀당 1개의 워크그룹을 디스패치했습니다. 이는 비효율적이고,
GPU는 훨씬 빠르게 실행할 수 있습니다. 최적의 작업량에 맞게 셰이더를
최적화하면 예제가 복잡해졌을 것입니다. 요점은 가장 빠른 셰이더가 아닌
스토리지 텍스처 사용을 보여주는 것이었습니다.
컴퓨트 셰이더 최적화 방법에 대해서는
[이미지 히스토그램 계산에 관한 글](webgpu-compute-shaders-histogram.html)에서
읽어볼 수 있습니다.

마찬가지로, 스토리지 텍스처의 어디든 쓸 수 있으므로
[다른 컴퓨트 셰이더 글](webgpu-compute-shaders.html)에서 다룬 것처럼
경쟁 조건(race condition)을 알아야 합니다. 호출 실행 순서는 보장되지 않습니다.
레이스를 피하거나 `textureBarriers` 또는 다른 방법을 삽입해서
둘 이상의 호출이 서로 방해하지 않도록 하는 것은 여러분의 몫입니다.

## 예제

[compute.toys](https://compute.toys) 웹사이트에는 스토리지 텍스처에 직접 쓰는
예제가 많이 있습니다. **경고**: [compute.toys](https://compute.toys)의
예제에서 배울 수 있는 것이 많지만 반드시 모범 사례는 아닙니다.
Compute toys는 컴퓨트 셰이더만으로 흥미로운 것을 만드는 것에 주안점을 둡니다.
컴퓨트 셰이더만으로 창의적인 무언가를 만드는 방법을 알아내는 것은
재미있는 퍼즐이지만, 다른 방법이 *10배, 100배, 또는 1000배* 더 빠를
수도 있다는 점을 알아두세요.