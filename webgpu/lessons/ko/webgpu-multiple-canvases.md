Title: WebGPU에서 여러 캔버스 사용하기
Description: 여러 캔버스에 그리기
TOC: 여러 캔버스

WebGPU에서 여러 캔버스를 사용하는 것은 매우 간단합니다. [WebGPU 기초](webgpu-fundamentals.html)를 참고하면, 먼저 캔버스를 생성한 다음 `getContext`를 호출하여 컨텍스트를 설정할 수 있습니다.

```js
  // 캔버스에서 WebGPU 컨텍스트를 얻어서 설정해줍니다.
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
```

캔버스에 그림을 그리기 위해, 우리는 그 컨텍스트를 활용하여 캔버스에 대한 텍스처를 얻고, 그 텍스처를 렌더 패스의 첫 번째 `colorAttachment`로 설정했습니다.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
*        // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  function render() {
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
*    renderPassDescriptor.colorAttachments[0].view =
*        context.getCurrentTexture().createView();

    // 명령어를 인코딩하기 위한 명령어 인코더를 만들어야 합니다.
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // 렌더링 관련 명령어들을 인코딩하기 위한 엔코더를 만들어야 합니다.
    const pass = encoder.beginRenderPass(renderPassDescriptor);

```

다른 캔버스에 그림을 그리려면, 그 캔버스에 대해서도 같은 단계를 따르면 됩니다.

1. 캔버스를 확인해 보세요… 혹은 직접 캔버스를 만들어보세요.
2. “webgpu” 컨텍스트를 얻으세요.
3. 컨텍스트를 설정합니다.
4. 그 캔버스에 렌더링하고 싶다면, `context.getCurrentTexture`를 호출하여 그 텍스처를 `colorAttachment`로 사용하면 됩니다.

첫 번째 예시를 들어보겠습니다. 이를 3개의 캔버스에 표현해 보겠습니다.

먼저, 2개의 캔버스를 더 추가해 보겠습니다.

```html
  <body>
    <canvas></canvas>
+    <canvas></canvas>
+    <canvas></canvas>
  </body>
```

다음으로, 컨텍스트를 설정하고 모든 캔버스들을 구성해 보겠습니다.

```js
  // 각 캔버스마다 WebGPU 컨텍스트를 얻고, 그 설정을 해야 합니다.
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  const infos = [];
  for (const canvas of document.querySelectorAll('canvas')) {
    const context = canvas.getContext('webgpu');
    context.configure({
      device,
      format: presentationFormat,
    });
    infos.push({ context });
  }
```

그리고 마지막으로, 그 모든 것들을 렌더링해 보겠습니다.

```js
  function render() {
*    // 명령어를 인코딩하기 위한 명령어 인코더를 만들어야 합니다.
*    const encoder = device.createCommandEncoder({ label: 'our encoder' });

+    for (const {context} of infos) {
      // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
      // 그것을 렌더링할 텍스처로 설정해 주세요.
      renderPassDescriptor.colorAttachments[0].view =
          context.getCurrentTexture().createView();

      // 렌더링 관련 명령어들을 인코딩하기 위한 엔코더를 만들어야 합니다.
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
      pass.draw(3);  // 정점 셰이더를 3번 호출합니다.
      pass.end();
+    }

*    const commandBuffer = encoder.finish();
*    device.queue.submit([commandBuffer]);
  }

  render();
```

우리가 수정한 부분은 다음과 같습니다: (1) 명령어를 생성할 때, 그 명령어가 모든 3개의 캔버스에 공유될 수 있도록 인코딩하는 방식을 변경했습니다. (2) 컨텍스트들을 반복하는 방식도 변경했습니다.

그리고 우리가 3개의 캔버스에 그림을 그렸다는 것을 알 수 있습니다.

{{{example url="../webgpu-multiple-canvases.html" }}}

참고: 반드시 하나의 명령 인코더를 사용할 필요는 없지만, 그렇게 하는 것이 약간 더 효율적입니다.

그렇다면, 남은 것은 또 무엇일까요?

## 많은 캔버스를 최적화하는 방법

제품을 회전시키는 예에는 정점을 직접 지정한 삼각형을 사용하겠습니다. 회전은 [행렬 연산](webgpu-matrix-math.html)에서 설명한 행렬로 처리하고, 제품마다 색상을 다르게 설정하겠습니다.

```wgsl
+  struct Uniforms {
+    matrix: mat4x4f,
+    color: vec4f,
+  };
+
+  @group(0) @binding(0) var<uniform> uni: Uniforms;

  @vertex fn vs(
    @builtin(vertex_index) vertexIndex : u32
  ) -> @builtin(position) vec4f {
    let pos = array(
      vec2f( 0.0,  0.5),  // 상단 중앙
      vec2f(-0.5, -0.5),  // 왼쪽 하단
      vec2f( 0.5, -0.5)   // 오른쪽 하단
    );

-    return vec4f(pos[vertexIndex], 0.0, 1.0);
+    return uni.matrix * vec4f(pos[vertexIndex], 0.0, 1.0);
  }

  @fragment fn fs() -> @location(0) vec4f {
-    return vec4f(1, 0, 0, 1);
+    return uni.color;
  }
```


각각의 경우에는 [유니폼 버퍼](webgpu-uniforms.html)가 필요합니다. 또한, 바인드 그룹과 관련된 요소들도 필요합니다.

200개의 캔버스를 만들고, 그것들을 WebGPU용으로 설정해 보겠습니다.

```js
  const infos = [];
  const numProducts = 200;
  for (let i = 0; i < numProducts; ++i) {
    // 이렇게 만들어내는 것
    // <div class="product size?">
    //   <canvas></canvas>
    //   <div>Product#: ?</div>
    // </div>
    const canvas = document.createElement('canvas');

    const container = document.createElement('div');
    container.className = `product size${i % 4}`;

    const description = document.createElement('div');
    description.textContent = `product#: ${i + 1}`;

    container.appendChild(canvas);
    container.appendChild(description);
    document.body.appendChild(container);

    // WebGPU 컨텍스트를 얻고, 그 설정을 해야 합니다.
    const context = canvas.getContext('webgpu');
    context.configure({
      device,
      format: presentationFormat,
    });

    infos.push({
      context,
    });
  }
```

이를 보완하기 위해서는 CSS가 필요합니다.

```js
  .product {
    display: inline-block;
    padding: 1em;
    background: #888;
    margin: 1em;
  }
  .size0>canvas {
    width: 200px;
    height: 200px;
  }
  .size1>canvas {
    width: 250px;
    height: 200px;
  }
  .size2>canvas {
    width: 300px;
    height: 200px;
  }
  .size3>canvas {
    width: 100px;
    height: 200px;
  }
```

4가지 크기는, 우리가 올바른 방법으로 작업을 하고 있는지 확인하기 위한 것입니다. 만약 모든 제품을 같은 크기로 만들었다면, 실수를 숨길 수 있을지도 모릅니다.

각각에 대해 유니폼 버퍼와 바인드 그룹이 필요합니다. 나중에 색상을 변경하지 않으므로, 지금부터 하나를 선택해 보겠습니다. 또한, rand clearValue도 선택해 보겠습니다. 왜 안 되겠습니까? 🤷‍♂️

```js
+  function randomColor() {
+    return [Math.random(), Math.random(), Math.random(), 1];
+  }

  const infos = [];
  const numProducts = 200;
  for (let i = 0; i < numProducts; ++i) {
    ...

+    // 유니폼 버퍼를 만들고 배열 뷰를 입력합니다.
+    // 우리의 유니폼을 위해서입니다.
+    const uniformValues = new Float32Array(16 + 4);
+    const uniformBuffer = device.createBuffer({
+      size: uniformValues.byteLength,
+      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
+    });
+    const kMatrixOffset = 0;
+    const kColorOffset = 16;
+    const matrixValue = uniformValues.subarray(
+        kMatrixOffset, kMatrixOffset + 16);
+    const colorValue = uniformValues.subarray(
+        kColorOffset, kColorOffset + 4);
+    colorValue.set(randomColor());
+
+    // 이 유니폼을 위해 단체를 만들어보세요.
+    const bindGroup = device.createBindGroup({
+      layout: pipeline.getBindGroupLayout(0),
+      entries: [
+        { binding: 0, resource: uniformBuffer },
+      ],
+    });

    infos.push({
      context,
+      clearValue: randomColor(),
+      matrixValue,
+      uniformValues,
+      uniformBuffer,
+      bindGroup,
    });

```

또한 [간단한 캔버스 리사이징](webgpu-fundamentals.html#a-resizing)에서처럼 `ResizeObserver`를 사용해 각 캔버스의 크기 변화를 감지합니다.

```js
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
    }
  });

  ...

  const infos = [];
  const numProducts = 200;
  for (let i = 0; i < numProducts; ++i) {
    // 이렇게 만들어내는 것
    // <div class="product size?">
    //   <canvas></canvas>
    //   <div>Product#: ?</div>
    // </div>
    const canvas = document.createElement('canvas');
    resizeObserver.observe(canvas);

    ...
```

렌더링 시에는, requestAnimationFrame(rAF) 루프를 사용하여 애니메이션을 구현합니다.

```js
+  function render(time) {
+    time *= 0.001; // 초로 변환하기

    ...

+    requestAnimationFrame(render);
  }

-  render();
+  requestAnimationFrame(render);
```

또한, 각 캔버스에 대한 행렬을 업데이트해야 합니다. 새로운 값들을 유니폼 버퍼에 업로드해야 하며, 바인드 그룹도 설정해야 합니다.

```js
  function render(time) {
    time *= 0.001; // 초로 변환하기

    // 명령어를 인코딩하기 위한 명령어 인코더를 만들어야 합니다.
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    for (const {
      context,
      uniformBuffer,
      uniformValues,
      matrixValue,
      bindGroup,
      clearValue,
    } of infos) {
      // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
      // 그것을 렌더링할 텍스처로 설정해 주세요.
      renderPassDescriptor.colorAttachments[0].view =
          context.getCurrentTexture().createView();
+      renderPassDescriptor.colorAttachments[0].clearValue = clearValue;
+
+      const { canvas } = context;
+      const aspect = canvas.clientWidth / canvas.clientHeight;
+      mat4.ortho(-aspect, aspect, -1, 1, -1, 1, matrixValue);
+      mat4.rotateZ(matrixValue, time * 0.1, matrixValue);
+
+      // 우리의 일관된 가치관을 업로드해 주세요.
+      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      // 렌더링 관련 명령어들을 인코딩하기 위한 엔코더를 만들어야 합니다.
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
+      pass.setBindGroup(0, bindGroup);
      pass.draw(3);  // 정점 셰이더를 3번 호출합니다.
      pass.end();
    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
  }
```

더 많은 내용을 추가해 보겠습니다. 그 이유는 나중에 설명하겠습니다.

이제, 전체 프로세스를 중단시키고 다시 시작할 수 있는 방법을 추가해 보겠습니다. 먼저, 버튼을 추가해 보겠습니다.

```js
  <body>
+    <button type="button" id="stop">Stop/Start</button>
  </body>
```

그리고 그에 필요한 CSS도 함께 포함되어 있습니다.

```css
  #stop {
    position: fixed;
    right: 0;
    top: 0;
    margin: 0.5em;
    z-index: 1;
  }
```

그 다음에는 애니메이션을 시작하고 중단시키는 코드를 변경해 보겠습니다.

```js
+  let requestId;
  function render(time) {
    ...

-    requestAnimationFrame(render);
+    requestId = requestAnimationFrame(render);
  }

-  requestAnimationFrame(render);

+  function toggleAnimation() {
+    if (requestId) {
+      cancelAnimationFrame(requestId);
+      requestId = undefined;
+    } else {
+      requestId = requestAnimationFrame(render);
+    }
+  }
+
+  toggleAnimation();
+  document.querySelector('#stop')
+      .addEventListener('click', toggleAnimation);

```

이렇게 하면 화면 밖에 있는 캔버스를 그리지 않을 수 있습니다. 다만 `time`은 페이지가 열린 뒤의 경과 시간이므로, 캔버스가 다시 보일 때는 보이지 않았던 시간도 회전에 반영됩니다.

그러니까, 우리가 애니메이션을 만들 때만만이 시간이 진행되는 방식으로 조정해보도록 합시다.

```js
+  let time = 0;
+  let then = 0;
  let requestId;
-  function render(time) {
-    time *= 0.001
+  function render(now) {
+    now *= 0.001; // convert to seconds;
+    const deltaTime = now - then;
+    time += deltaTime;
+    then = now;

  ...

    requestId = requestAnimationFrame(render);
  }

  function toggleAnimation() {
    if (requestId) {
      cancelAnimationFrame(requestId);
      requestId = undefined;
    } else {
      requestId = requestAnimationFrame(render);
+      then = performance.now() * 0.001;
    }
  }
```

이제 우리는 200개의 캔버스를 가지고 있습니다.

{{{example url="../webgpu-multiple-canvases-x200.html"}}}

이 예시를 보면, 매우 복잡해 보일 수 있습니다. 문제는, 겨우 몇 개의 캔버스만 보일 뿐이지만, 200개의 캔버스 전체를 렌더링해야 한다는 것입니다. 만약 각 캔버스에 단 하나의 삼각형 모델만 그려진다면, 상황은 훨씬 더 나빠질 것입니다. 그래서 ‘중지/재개’ 버튼을 추가한 것입니다. 이 페이지가 너무 복잡해 보인다면, 계속 진행하기 전에 일단 중지해도 됩니다.

> 참고: 이 사이트는, 예제가 실제로 보일 때만 그 예제가 렌더링되고 애니메이션되는 방식을 구현하려고 합니다.

이 문제를 해결할 수 있는 방법 중 하나는 `IntersectionObserver`를 사용하는 것입니다.

## <a id="a-intersection-observer"></a> `IntersectionObserver`를 사용하여 구현하기

`IntersectionObserver`를 사용하면 요소가 브라우저의 뷰포트와 겹치는지 감지할 수 있습니다. 이를 이용해 화면에 보이는 캔버스만 렌더링하겠습니다.

다음은 그 코드입니다.

먼저, `IntersectionObserver`를 생성해야 합니다. `ResizeObserver`와 마찬가지로, 이 객체는 관찰 대상이 창과 교차하기 시작하거나 멈출 때 호출되는 함수를 받습니다.

```js
  const visibleCanvasSet = new Set();
  const intersectionObserver = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) {
        visibleCanvasSet.add(target);
      } else {
        visibleCanvasSet.delete(target);
      }
    }
  });
```

위에서 보듯 콜백은 항목 배열을 받습니다. 각 항목은 대상이 관찰 영역과 교차하는지 알려 줍니다. 그 결과로 현재 보이는 캔버스의 `Set`을 관리합니다.

각 캔버스를 관찰해야 합니다. 또한, 특정 캔버스에서 해당 캔버스에 대한 정보를 얻는 방법도 필요합니다. 이 경우, 그 정보는 컨텍스트, 유니폼 버퍼, 바인드 그룹 등과 같은 요소들입니다. 우리는 `Map`을 사용하여 특정 캔버스에서 해당 정보를 얻을 것입니다.

```js
-  const infos = [];
+  const canvasToInfoMap = new Map();
  const numProducts = 200;
  for (let i = 0; i < numProducts; ++i) {
    // 이렇게 만들어내는 것
    // <div class="product size?">
    //   <canvas></canvas>
    //   <div>Product#: ?</div>
    // </div>
    const canvas = document.createElement('canvas');
    resizeObserver.observe(canvas);
+    intersectionObserver.observe(canvas);

    ...

-    infos.push({
+    canvasToInfoMap.set(canvas, {
      context,
      clearValue: randomColor(),
      matrixValue,
      uniformValues,
      uniformBuffer,
      bindGroup,
      rotation: Math.random() * Math.PI * 2,
    });
  }
```

우리의 렌더링 함수에서는, 보이는 캔버스들만을 렌더링할 수 있습니다.

```js
  function render(now) {
    ...

    // 명령어를 인코딩하기 위한 명령어 인코더를 만들어야 합니다.
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

-    for (const {
+    visibleCanvasSet.forEach(canvas => {
*      const {
*       context,
*       uniformBuffer,
*       uniformValues,
*       matrixValue,
*       bindGroup,
*       clearValue,
*       rotation,
-    } of infos) {
+      } = canvasToInfoMap.get(canvas);

      // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
      // 그것을 렌더링할 텍스처로 설정해 주세요.
      renderPassDescriptor.colorAttachments[0].view =
          context.getCurrentTexture().createView();
      renderPassDescriptor.colorAttachments[0].clearValue = clearValue;

-      const { canvas } = context;
      const aspect = canvas.clientWidth / canvas.clientHeight;
      mat4.ortho(-aspect, aspect, -1, 1, -1, 1, matrixValue);
      mat4.rotateZ(matrixValue, time * 0.1 + rotation, matrixValue);

      // 우리의 일관된 가치관을 업로드해 주세요.
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      // 렌더링 관련 명령어들을 인코딩하기 위한 엔코더를 만들어야 합니다.
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);  // 정점 셰이더를 3번 호출합니다.
      pass.end();
-    }
+    };

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    requestId = requestAnimationFrame(render);
  }
```

그렇게 되면, 우리가 그리는 것은 실제로 보이는 캔버스들뿐입니다. 기대컨대, 그 캔버스들의 무게는 훨씬 가벼울 것입니다.

{{{example url="../webgpu-multiple-canvases-x200-optimized.html"}}}

`IntersectionObserver`는 아마도 모든 경우를 다 커버할 수는 없을 것입니다. 만약 각 캔버스에 매우 복잡한 요소들을 그리는 경우라면, 사용자가 선택한 캔버스만 애니메이션 효과를 주는 것이 좋습니다. 어쨌든, 여러분의 도구 상자에는 더 많은 도구들이 있기를 바랍니다.
