Title: WebGPU 후처리: 기본 CRT 효과
Description: 후처리
TOC: 기본 CRT 효과

후처리이란, “원본” 이미지를 만들어낸 후에 추가적인 처리를 하는 것을 의미합니다. 후처리은 사진, 비디오, 2D 장면, 3D 장면 등에 적용될 수 있습니다. 일반적으로 말하자면, 이미지를 가지고 그 이미지에 특정 효과를 적용하는 것을 의미합니다. 예를 들어, 인스타그램에서 필터를 선택하는 것과 같은 경우가 있습니다.

지금까지의 예제에서는 대부분 캔버스에 바로 렌더링했습니다. 후처리를 할 때는 장면을 먼저 별도 텍스처에 렌더링합니다. 그런 다음 이 텍스처를 읽어 이미지 효과를 적용하면서 결과를 캔버스에 그립니다.

간단한 예로, 이미지를 처리하여 1980년대의 TV처럼 보이도록 만드는 방법을 시도해 봅시다. 그러기 위해서는 스캔라인과 CRT RGB 색상 공간을 사용해야 합니다.

<div class="webgpu_center"><img class="nobg" src="resources/gemini-generated-1980s-tv-1024.png" style="width: 700px"></div>

그렇게 하기 위해, [타이밍 성능](webgpu-timing.html)의 상단에 있는 애니메이션 예시를 참고해 보겠습니다. 먼저, 그 애니메이션을 별도의 텍스처로 렌더링한 다음, 그 텍스처를 캔버스에 출력합니다.

이 셰이더는 [클립 공간을 덮는 큰 삼각형](webgpu-large-triangle-to-cover-clip-space.html)을 그립니다. 클립 공간에 들어오는 부분에 텍스처 전체가 맞도록 UV 좌표를 출력합니다.

```js
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
      ) -> VSOutput {
        var pos = array(
          vec2f(-1.0, -1.0),
          vec2f(-1.0,  3.0),
          vec2f( 3.0, -1.0),
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy, 0.0, 1.0);
        vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
        return vsOutput;
      }

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;

      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
        let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
        return vec4f(color);
      }
    `,
  })
```

상당히 간단한 방식이며, [이미지 로딩](webgpu-importing-textures.html)에서 사용했던 셰이더와 유사합니다. 유일한 차이점은 원래의 셰이더가 클립 공간을 커버하기 위해 2개의 삼각형을 사용하는 반면, 이번 셰이더는 [클립 공간을 덮는 큰 삼각형](webgpu-large-triangle-to-cover-clip-space.html) 하나를 사용합니다.

그렇다면, 이러한 셰이더들을 사용하려면 파이프라인이 필요합니다.

```js
  const postProcessPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: postProcessModule },
    fragment: {
      module: postProcessModule,
      targets: [ { format: presentationFormat }],
    },
  });
```

이 파이프라인은 캔버스에 렌더링될 것입니다. 따라서 `presentationFormat`이라는 값을 설정해야 합니다. 이 값은 앞서 확인한 내용입니다.

샘플러와 renderPassDescriptor가 필요합니다.

```js
  const postProcessSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  });

  const postProcessRenderPassDescriptor = {
    label: 'post process render pass',
    colorAttachments: [
      { loadOp: 'clear', storeOp: 'store' },
    ],
  };
```

원래 렌더 패스가 캔버스 대신 별도 텍스처에 그리도록 바꿉니다.

```js
+  let renderTarget;
+
+  function setupPostProcess(canvasTexture) {
+    if (renderTarget?.width === canvasTexture.width &&
+        renderTarget?.height === canvasTexture.height) {
+      return;
+    }
+
+    renderTarget?.destroy();
+    renderTarget = device.createTexture({
+      size: canvasTexture,
+      format: 'rgba8unorm',
+      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
+    });
+    const renderTargetView = renderTarget.createView();
+    renderPassDescriptor.colorAttachments[0].view = renderTargetView;
+  }

  let then = 0;
  function render(now) {
    now *= 0.001;  // 초로 변환하기
    const deltaTime = now - then;
    then = now;

-    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
-    // 그것을 렌더링할 텍스처로 설정해 주세요.
-    renderPassDescriptor.colorAttachments[0].view =
-        context.getCurrentTexture().createView();
+    const canvasTexture = context.getCurrentTexture();
+    setupPostProcess(canvasTexture);

    ...
```

위에서, 현재의 `canvasTexture`를 `setupPostProcess`에 전달합니다. 이때, “renderTarget” 텍스처의 크기가 캔버스의 크기와 같은지 확인합니다. 만약 그렇지 않다면, 동일한 크기의 새로운 텍스처를 생성합니다.

그런 다음, 원래의 `renderPassDescriptor`의 색상 값을 이 renderTarget 텍스처에 할당합니다.

우리의 기존 파이프라인은 이 텍스처를 사용하고 있기 때문에, 이 텍스처의 형식에 맞게 업데이트해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        ...
      ],
    },
    fragment: {
      module,
-      targets: [{ format: presentationFormat }],
+      targets: [{ format: 'rgba8unorm' }],
    },
  });
```

이러한 변화만으로도 원본 장면이 이 렌더링 대상 텍스처에 표시되기 시작할 것입니다. 하지만 여전히 캔버스에 무언가를 그려야 합니다. 그렇지 않으면 아무것도 볼 수 없을 것입니다. 그러니 그 작업을 해 보겠습니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }

  ...


  let then = 0;
  function render(now) {
    now *= 0.001;  // 초로 변환하기
    const deltaTime = now - then;
    then = now;

    const canvasTexture = context.getCurrentTexture();
    setupPostProcess(canvasTexture);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);

    ...

    pass.draw(numVertices, settings.numObjects);

    pass.end();

+    postProcess(encoder, renderTarget, canvasTexture);

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

또 하나 고쳐야 할 부분은, 오브젝트 수 설정을 제거하는 것입니다. 왜냐하면 그 설정은 후처리 과정과는 관련이 없기 때문입니다.

```js
  const settings = {
-    numObjects: 100,
+    numObjects: 200,
  };

  const gui = new GUI();
-  gui.add(settings, 'numObjects', 0, kNumObjects, 1);
```

`settings.numObjects`는 완전히 제거할 수도 있었지만, 여러 곳에서 수정이 필요하기 때문에 일단 그대로 두기로 했습니다. 이미지를 채우기 위해 숫자를 200으로 설정해 두겠습니다.

이 프로그램을 실행해도, 원래의 결과와는 눈에 띄는 차이가 없습니다.

{{{example url="../webgpu-post-processing-step-01.html"}}}

먼저 장면을 `renderTarget` 텍스처에 그린 다음, 후처리 패스에서 그 텍스처를 읽어 캔버스에 출력합니다. 이제 이 두 번째 패스에서 여러 효과를 적용할 수 있습니다.

오래된 CRT 모니터의 가장 두드러진 문제는, 화면에 선들이 보인다는 것입니다. 이는 이미지가 화면 위를 가로로 퍼져 나가도록 하는 방식으로 프로젝션되기 때문입니다.

사인파를 사용하여 밝고 어두운 패턴을 만들고, 그 값을 절댓값으로 취함으로써도 비슷한 효과를 얻을 수 있습니다.

<div class="webgpu_center">
  <div style="width: 100%;"><img class="ddnobg" src="resources/sinewave-40.svg"></div>
  <div lass="caption">sin(x)</div>
</div>
<div class="webgpu_center">
   <div style="width: 100%;"><img class="ddnobg" src="resources/abs-sinewave-40.svg"></div>
   <div class="caption">abs(sin(x))</div>
</div>
<div class="webgpu_center">
   <div style="width: 100%;"><div data-diagram="sine" style="aspect-ratio: 981 / 50; width: 100%;"></div></div>
   <div class="caption">abs(x)의 값을 그레이스케일 색상으로 변환합니다.</div>
</div>


이것을 코드에 추가해 보겠습니다. 먼저, 이 사인파를 적용하기 위해 셰이더를 수정해 봅시다.

```js
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
      ) -> VSOutput {
        var pos = array(
          vec2f(-1.0, -1.0),
          vec2f(-1.0,  3.0),
          vec2f( 3.0, -1.0),
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy, 0.0, 1.0);
        vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
        return vsOutput;
      }

+      struct Uniforms {
+        effectAmount: f32,
+        bandMult: f32,
+      };

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;
+      @group(0) @binding(2) var<uniform> uni: Uniforms;

      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
+        let banding = abs(sin(fsInput.position.y * uni.bandMult));
+        let effect = mix(1.0, banding, uni.effectAmount);

        let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
-        return vec4f(color);
+        return vec4f(color.rgb * effect, color.a);
      }
    `,
  });
```

사인파는 현재 쓰고 있는 픽셀의 Y 좌표인 `fsInput.position.y`를 기준으로 합니다. 즉, 0번째 스캔라인부터 0.5, 1.5, 2.5, 3.5처럼 증가합니다. `bendMult`로 띠의 크기를 조절하고, `effectAmount`로 효과를 켜거나 꺼서 적용 전후를 비교할 수 있습니다.

새로운 셰이더를 사용하려면, 유니폼 버퍼가 필요합니다.

```js
  const postProcessUniformBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
```

이것을 우리의 바인드 그룹에 추가해야 합니다.

```js
    postProcessBindGroup = device.createBindGroup({
      layout: postProcessPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: renderTargetView },
        { binding: 1, resource: postProcessSampler },
+        { binding: 2, resource: postProcessUniformBuffer },
      ],
    });
```

그리고, 몇 가지 설정을 추가해야 합니다.

```js
  const settings = {
    numObjects: 200,
+    affectAmount: 1,
+    bandMult: 1,
  };

  const gui = new GUI();
+  gui.add(settings, 'affectAmount', 0, 1);
+  gui.add(settings, 'bandMult', 0.01, 2.0);
```

그리고 그 설정을 유니폼 버퍼에 업로드해야 합니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
+    device.queue.writeBuffer(
+      postProcessUniformBuffer,
+      0,
+      new Float32Array([
+        settings.affectAmount,
+        settings.bandMult,
+      ]),
+    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }
```

그리고 그렇게 하면, 우리가 원하는 CRT와 같은 스캔라인 효과를 얻을 수 있습니다.

{{{example url="../webgpu-post-processing-step-02.html"}}}

CRT도 LCD와 마찬가지로, 이미지를 빨강, 초록, 파랑색으로 나눕니다. CRT의 경우, 이러한 색상 구역들이 대부분 오늘날의 LCD보다 더 크기 때문에, 때로는 이러한 특징이 눈에 띄었습니다. 이 효과를 더욱 강조하기 위해, 몇 가지 요소를 추가해 보겠습니다.

먼저, 셰이더를 변경해 봅시다.

```
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
      ) -> VSOutput {
        var pos = array(
          vec2f(-1.0, -1.0),
          vec2f(-1.0,  3.0),
          vec2f( 3.0, -1.0),
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy, 0.0, 1.0);
        vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
        return vsOutput;
      }

      struct Uniforms {
        effectAmount: f32,
        bandMult: f32,
+        cellMult: f32,
+        cellBright: f32,
      };

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;
      @group(0) @binding(2) var<uniform> uni: Uniforms;

      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
        let banding = abs(sin(fsInput.position.y * uni.bandMult));

+        let cellNdx = u32(fsInput.position.x * uni.cellMult) % 3;
+        var cellColor = vec3f(0);
+        cellColor[cellNdx] = 1;
+        let cMult = cellColors[cellNdx] + uni.cellBright;

-        let effect = mix(1.0, banding, uni.effectAmount);
+        let effect = mix(vec3f(1), banding * cMult, uni.effectAmount);
        let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
        return vec4f(color.rgb * effect, 1);
      }
    `,
  });
```

위에서 우리는 `fsInput.position.x`를 사용합니다. 이 값은 쓰여지는 픽셀의 x 좌표입니다. `cellMult`과 이 값을 곱하면 셀의 크기를 선택할 수 있습니다. 그런 다음 그 값을 정수로 변환하고 3으로 나누어 결과를 얻습니다. 이 결과는 0, 1, 2 중 하나가 되며, 이 숫자들을 이용해 `cellColor`의 빨간색, 녹색, 파란색 채널을 각각 1로 설정할 수 있습니다.

`cellBright`을 조정용으로 추가한 다음, 기존의 밴딩 효과와 새로운 효과를 함께 곱합니다. `effect`의 타입은 `f32`에서 `vec3f`로 변경되었으므로, 각 채널에 개별적으로 영향을 줄 수 있습니다.

JavaScript에서는 유니폼 버퍼의 크기를 조정해야 합니다.

```js
  const postProcessUniformBuffer = device.createBuffer({
-    size: 8,
+    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
```

그리고 GUI에 몇 가지 설정을 추가해 주세요.

```js
  const settings = {
    numObjects: 200,
    affectAmount: 1,
    bandMult: 1,
+    cellMult: 0.5,
+    cellBright: 1,
  };

  const gui = new GUI();
  gui.add(settings, 'affectAmount', 0, 1);
  gui.add(settings, 'bandMult', 0.01, 2.0);
+  gui.add(settings, 'cellMult', 0, 1);
+  gui.add(settings, 'cellBright', 0, 2);
```

그리고 새로운 설정을 업로드해 주세요.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.affectAmount,
        settings.bandMult,
+        settings.cellMult,
+        settings.cellBright,
      ]),
    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }
```

이제, CRT 색상 요소가 *마치* 그런 효과를 내는 것 같습니다.

{{{example url="../webgpu-post-processing-step-03.html"}}}

위에 나열된 효과들은 CRT가 어떻게 작동하는지를 완벽하게 나타내는 것은 아닙니다. 단지 CRT와 유사한 모습을 보여주고, 이해하기 쉽도록 하는 데 목적이 있습니다. 인터넷에서는 더 복잡한 기술들도 찾아볼 수 있습니다.

## <a id="compute"></a> 컴퓨트 셰이더를 사용하기

이 주제에 대해 질문이 있어요. 이 경우 컴퓨트 셰이더를 사용할 수 있을까요? 그리고, 더 중요한 것은, 그렇게 해야 할까요? 먼저 “그렇게 할 수 있을까?”라는 점에 대해 알아보겠습니다.

컴퓨트 셰이더를 사용하여 텍스처에 렌더링하는 방법에 대해서는, [스토리지 텍스처](webgpu-storage-textures.html)를 참조하세요.

코드를 컴퓨트 셰이더로 변환하려면, `STORAGE_BINDING` 속성을 캔버스 텍스처에 추가해야 합니다. 이를 위해서는 [스토리지 텍스처](webgpu-storage-textures.html)를 참고하여, 텍스처가 이 기능을 지원하는지 확인하고, 그에 맞는 텍스처 형식을 선택해야 합니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
+  const hasBGRA8UnormStorage = adapter?.features.has('bgra8unorm-storage');
-  const device = await adapter?.requestDevice();
+  const device = await adapter?.requestDevice({
+    requiredFeatures: [
+      ...(hasBGRA8UnormStorage ? ['bgra8unorm-storage'] : []),
+    ],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // 캔버스에서 WebGPU 컨텍스트를 얻어서 설정해줍니다.
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
-  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
+  const presentationFormat = hasBGRA8UnormStorage
+    ? navigator.gpu.getPreferredCanvasFormat()
+    : 'rgab8unorm';
  context.configure({
    device,
    format: presentationFormat,
+    usage: GPUTextureUsage.RENDER_ATTACHMENT |
+           GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.STORAGE_BINDING,
  });
```

우리는 셰이더를 변경하여 스토리지 텍스처에 데이터를 쓰도록 해야 합니다.

```js
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
-      struct VSOutput {
-        @builtin(position) position: vec4f,
-        @location(0) texcoord: vec2f,
-      };
-
-      @vertex fn vs(
-        @builtin(vertex_index) vertexIndex : u32,
-      ) -> VSOutput {
-        var pos = array(
-          vec2f(-1.0, -1.0),
-          vec2f(-1.0,  3.0),
-          vec2f( 3.0, -1.0),
-        );
-
-        var vsOutput: VSOutput;
-        let xy = pos[vertexIndex];
-        vsOutput.position = vec4f(xy, 0.0, 1.0);
-        vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
-        return vsOutput;
-      }

      struct Uniforms {
        effectAmount: f32,
        bandMult: f32,
        cellMult: f32,
        cellBright: f32,
      };

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;
      @group(0) @binding(2) var<uniform> uni: Uniforms;
+      @group(1) @binding(0) var outTexture: texture_storage_2d<${presentationFormat}, write>;

-      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
-        let banding = abs(sin(fsInput.position.y * uni.bandMult));
-
-        let cellNdx = u32(fsInput.position.x * uni.cellMult) % 3;
+      @compute @workgroup_size(1) fn cs(@builtin(global_invocation_id) gid: vec3u) {
+        let outSize = textureDimensions(outTexture);
+        let banding = abs(sin(f32(gid.y) * uni.bandMult));
+
+        let cellNdx = u32(f32(gid.x) * uni.cellMult) % 3;
        var cellColor = vec3f(0);
        cellColor[cellNdx] = 1.0;
        let cMult = cellColor + uni.cellBright;

        let effect = mix(vec3f(1), banding * cMult, uni.effectAmount);
-        let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
-        return vec4f(color.rgb * effect, color.a);
+        let uv = (vec2f(gid.xy) + 0.5) / vec2f(outSize);
+        let color = textureSampleLevel(postTexture2d, postSampler, uv, 0);
+        textureStore(outTexture, gid.xy, vec4f(color.rgb * effect, color.a));
      }
    `,
  });
```

위 코드에서는 정점 셰이더와 관련 부분을 없앴습니다. 쓰고 있는 픽셀의 좌표였던 `fsInput.position`도 없습니다. 대신 컴퓨트 셰이더의 개별 호출에 해당하는 `global_invocation_id`를 `gid`로 받습니다. 이 값을 텍스처 좌표로 사용하겠습니다. 형식이 `vec3u`이므로 필요한 곳에서 형 변환을 합니다. `fsInput.texcoord`도 없어졌지만 `(vec2f(gid.xy) + 0.5) / vec2f(outSize)`로 같은 값을 구할 수 있습니다.

이제는 렌더링 과정을 사용하는 것을 중단하고, 대신 후처리 단계에서 컴퓨팅 과정을 사용해야 합니다.

```js
  const postProcessPipeline = device.createRenderPipeline({
    layout: 'auto',
-    vertex: { module: postProcessModule },
-    fragment: {
-      module: postProcessModule,
-      targets: [ { format: presentationFormat }],
-    },
+    compute: { module: postProcessModule },
  });

  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.affectAmount,
        settings.bandMult,
        settings.cellMult,
        settings.cellBright,
      ]),
    );

+    const outBindGroup = device.createBindGroup({
+      layout: postProcessPipeline.getBindGroupLayout(1),
+      entries: [
+        { binding: 0, resource: dstTexture },
+      ],
+    });

-    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
-    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
+    const pass = encoder.beginComputePass();
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
-    pass.draw(3);
+    pass.dispatchWorkgroups(dstTexture.width, dstTexture.height);
    pass.end();
  }
```

그 방법은 효과가 있어요.

{{{example url="../webgpu-post-processing-step-03-compute.html"}}}

안타깝게도, GPU에 따라 성능이 저하됩니다. 이미지 히스토그램 강의의 컴퓨트 셰이더 최적화 설명에서 그 이유를 살펴봤습니다. 워크그룹 크기를 1로 설정하면 작업이 간단해지지만, 그 대신 성능이 느려집니다.

더 큰 워크그룹 크기를 사용할 수 있습니다. 이를 위해, 경계를 넘어서게 되면 텍스처에 데이터를 기록하지 않는 방식으로 처리해야 합니다.

```js
+  const workgroupSize = [16, 16];
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
      struct Uniforms {
        effectAmount: f32,
        bandMult: f32,
        cellMult: f32,
        cellBright: f32,
      };

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;
      @group(0) @binding(2) var<uniform> uni: Uniforms;
      @group(1) @binding(0) var outTexture: texture_storage_2d<${presentationFormat}, write>;

-      @compute @workgroup_size(1) fn cs(@builtin(global_invocation_id) gid: vec3u) {
+      @compute @workgroup_size(${workgroupSize}) fn cs(@builtin(global_invocation_id) gid: vec3u) {
        let outSize = textureDimensions(outTexture);
+        if (gid.x >= outSize.x || gid.y >= outSize.y) {
+          return;
+        }
        let banding = abs(sin(f32(gid.y) * uni.bandMult));

        let cellNdx = u32(f32(gid.x) * uni.cellMult) % 3;
        var cellColor = vec3f(0);
        cellColor[cellNdx] = 1.0;
        let cMult = cellColor + uni.cellBright;

        let effect = mix(vec3f(1), banding * cMult, uni.effectAmount);
        let uv = (vec2f(gid.xy) + 0.5) / vec2f(outSize);
        let color = textureSampleLevel(postTexture2d, postSampler, uv, 0);
        textureStore(outTexture, gid.xy, vec4f(color.rgb * effect, color.a));
      }
    `,
  });
```

이렇게 하면 디스패치할 워크그룹 수를 줄일 수 있습니다.

```js
    const pass = encoder.beginComputePass();
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.setBindGroup(1, outBindGroup);
-    pass.dispatchWorkgroups(dstTexture.width, dstTexture.height);
+    pass.dispatchWorkgroups(
+      Math.ceil(dstTexture.width / workgroupSize[0]),
+      Math.ceil(dstTexture.height / workgroupSize[1]),
+    );
    pass.end();
```

이 방법은 작동합니다.

{{{example url="../webgpu-post-processing-step-03-compute-workgroups.html"}}}

이 방법은 훨씬 빠릅니다! 하지만 안타깝게도, 일부 GPU에서는 여전히 렌더링 과정을 사용하는 것보다 느립니다.

<div class="webgpu_center data-table">
  <table>
    <thead>
      <tr><th>GPU</th><th>계산된 패스 타임과 비교하기<br>시간을 보내는 방법<br>더 높은 수치일수록 좋습니다.</th></tr>
    </thead>
    <tbody>
      <tr><td>M1 맥스                 </td><td>1x</td></tr>
      <tr><td>AMD 라데온 프로 5300M   </td><td>1x</td></tr>
      <tr><td>AMD 라데온 프로 WX 32000</td><td>1.3x</td></tr>
      <tr><td>인텔 UHD 그래픽스 630 </td><td>1.7x</td></tr>
      <tr><td>NVidia 2070 Super      </td><td>2x</td></tr>
    </tbody>
  </table>
</div>

어떻게 하면 작업을 더 빠르게 수행할 수 있을지에 대한 내용은 이 글에서는 다루기에는 너무 범위가 넓습니다. 이미지 히스토그램 강의에서 다룬 컴퓨트 셰이더 최적화와 같은 원칙이 적용됩니다. 하지만 그 중 어느 것도 이 예시와는 관련이 없습니다. 만약 여러분이 수행하고자 하는 후처리 작업에서 공유된 워크그룹 메모리를 활용할 수 있다면, 컴퓨트 셰이더를 사용하는 것이 유리할 수 있습니다. 또한, GPU가 많은 캐시 미스를 겪지 않도록 하는 것도 중요할 수 있습니다. 또 다른 방법으로는 [서브그룹](webgpu-subgroups.html)을 활용하는 것도 있습니다.

현재로서는, 여러 가지 기술들을 시도해보고 그들의 적용 시점을 확인해보는 것이 좋습니다. 혹은, 구현하고자 하는 알고리즘이 워크그룹이나 서브그룹의 데이터를 공유함으로써 실제로 이점을 얻을 수 있는 경우가 아니라면, 그냥 렌더링 과정을 그대로 사용하는 것이 좋습니다. GPU는 컴퓨트 셰이더를 사용하는 것보다 텍스처를 렌더링하는 데 더 오랫동안 사용되어 왔습니다. 따라서 그 과정에 관한 많은 부분들이 이미 최적화되어 있습니다.

---

이 글에서는 *후처리*라는 개념을 소개했습니다. 다음 글에서는 [이미지 조정](webgpu-image-adjustments.html)에 대해 설명하겠습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-post-processing.css" rel="stylesheet">
<script type="module" src="webgpu-post-processing.js"></script>
