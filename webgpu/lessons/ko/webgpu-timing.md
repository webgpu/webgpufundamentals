Title: WebGPU 타이밍 성능
Description: WebGPU에서의 타이밍 작업
TOC: 타이밍 성능

성능 측정을 하고 싶은 다양한 것들이 있습니다. 우리는 다음 3가지를 측정해 볼 것입니다:

* 초당 프레임 수 (fps)
* 프레임당 JavaScript에서 소요된 시간
* 프레임당 GPU에서 소요된 시간

먼저, [정점 버퍼에 관한 글](webgpu-vertex-buffers.html)의 원 예제를 가져와서, 
작업에 걸리는 시간의 변화를 쉽게 볼 수 있도록 애니메이션을 만들어 보겠습니다.

그 예제에는 3개의 정점 버퍼가 있었습니다. 하나는 원의 정점 위치와 밝기를 위한 것이었습니다. 
또 하나는 원의 오프셋과 색상을 포함하는 것으로 인스턴스 별로 정적이었습니다.
그리고 마지막 하나는 렌더링할 때마다 변경되는 것으로, 사용자가 창 크기를 변경할 때 
원의 종횡비를 유지하여 타원이 아닌 원으로 유지하기 위한 스케일이었습니다.

우리는 원들이 움직이도록 애니메이션을 만들고 싶으므로 오프셋을 스케일과 같은 버퍼로 옮기겠습니다. 
먼저 렌더링 파이프라인을 변경하여 오프셋을 스케일과 같은 버퍼로 이동합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
-          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
+          arrayStride: 4, // 4 bytes
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
-            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
          ],
        },
        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+            {shaderLocation: 2, offset: 0, format: 'float32x2'},   // offset
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+            {shaderLocation: 3, offset: 8, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

그런 다음 정점 버퍼를 설정하는 부분을 변경하여 오프셋을 스케일과 비슷한 코드로 만듭니다.

```js
  // 2개의 정점 버퍼 생성
  const staticUnitSize =
-    4 +     // color is 4 bytes
-    2 * 4;  // offset is 2 32bit floats (4bytes each)
+    4;     // color is 4 bytes
  const changingUnitSize =
-    2 * 4;  // scale is 2 32bit floats (4bytes each)
+    2 * 4 + // offset is 2 32bit floats (4bytes each)
+    2 * 4;  // scale is 2 32bit floats (4bytes each)
  const staticVertexBufferSize = staticUnitSize * kNumObjects;
  const changingVertexBufferSize = changingUnitSize * kNumObjects;

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const changingVertexBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
  const kColorOffset = 0;
-  const kOffsetOffset = 1;
+
-  const kScaleOffset = 0;
+  const kOffsetOffset = 0;
+  const kScaleOffset = 2;

  {
    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
-    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffsetU8 = i * staticUnitSize;
-      const staticOffsetF32 = staticOffsetU8 / 4;

      // 한 번만 설정되므로 지금 설정합니다.
      staticVertexValuesU8.set(        // set the color
          [rand() * 255, rand() * 255, rand() * 255, 255],
          staticOffsetU8 + kColorOffset);

-      staticVertexValuesF32.set(      // set the offset
-          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
-          staticOffsetF32 + kOffsetOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
+        offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
+        velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
      });
    }
-    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
+    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesU8);
  }
```

렌더링 시에는 속도에 따라 원의 오프셋을 업데이트한 다음 GPU에 업로드할 수 있습니다.

```js
+  const euclideanModulo = (x, a) => x - a * Math.floor(x / a);

+  let then = 0;
-  function render() {
  function render(now) {
+    now *= 0.001;  // 초 단위로 변환
+    const deltaTime = now - then;
+    then = now;

...
      // 각 객체의 스케일 설정
-    objectInfos.forEach(({scale}, ndx) => {
-      const offset = ndx * (changingUnitSize / 4);
-      vertexValues.set([scale / aspect, scale], offset + kScaleOffset); // set the scale
+    objectInfos.forEach(({scale, offset, veloctiy}, ndx) => {
+      // -1.5 에서 1.5 까지
+      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
+      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

+      const off = ndx * (changingUnitSize / 4);
+      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
    });

...

+    requestAnimationFrame(render);
  }
+  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      // 다시 그리기
-      render();
    }
  });
  observer.observe(canvas);
```

또한 rAF 루프[^rAF]로 전환했습니다.

[^rAF]: `rAF`는 `requestAnimationFrame`의 약자입니다.

<a id="a-euclidianModulo"></a>위의 코드는 오프셋을 업데이트하기 위해 `euclideanModulo`를 사용합니다.
`euclideanModulo`는 나머지가 항상 양수이고 같은 방향인 나눗셈의 나머지를 반환합니다.
예를 들어

<div class="webgpu_center">
  <div class="center">
    <div class="data-table center" data-table='{
  "cols": ["value", "% operator", "euclideanModulo"],
  "classNames": ["a", "b", "c"],
  "rows": [
    [ "0.3", "0.3", "0.3" ],
    [ "2.3", "0.3", "0.3" ],
    [ "4.3", "0.3", "0.3" ],
    [ "-1.7", "-1.7", "0.3" ],
    [ "-3.7", "-1.7", "0.3" ]
  ]
}'>
     </div>
  </div>
  <div>modulo 2 of % vs euclideanModulo</div>
</div>

다르게 말하면, 다음은 `%` 연산자 대 `euclideanModulo`의 그래프입니다.

<div class="webgpu_center">
  <img style="width: 700px" src="resources/euclidean-modulo.svg">
  <div>euclideanModule(v, 2)</div>
</div>
<div class="webgpu_center">
  <img  style="width: 700px" src="resources/modulo.svg">
  <div>v % 2</div>
</div>

따라서 위의 코드는 클립 공간에 있는 오프셋을 가져와 1.5를 더합니다. 그런 다음 3으로 euclideanModulo를 취하면 0.0에서 3.0 사이의 숫자가 나오고, 여기서 1.5를 뺍니다. 이렇게 하면 -1.5에서 +1.5 사이의 숫자가 유지되고 반대쪽으로 래핑됩니다. 원들이 화면을 벗어날 때까지 래핑되지 않도록 -1.5에서 +1.5를 사용합니다. [^offscreen]

[^offscreen]: 이것은 원의 반지름이 0.5보다 작은 경우에만 작동합니다. 크기 체크를 복잡하게 하느라 코드를 크게 부풀리고 싶지는 않습니다.

원을 몇개나 그릴지 조정할 수 있도록 해보겠습니다.

```js
-  const kNumObjects = 100;
+  const kNumObjects = 10000;


...

  const settings = {
    numObjects: 100,
  };

  const gui = new GUI();
  gui.add(settings, 'numObjects', 0, kNumObjects, 1);

  ...

    // 각 객체의 스케일과 오프셋 설정
-    objectInfos.forEach(({scale, offset, veloctiy}, ndx) => {
+    for (let ndx = 0; ndx < settings.numObjects; ++ndx) {
+      const {scale, offset, velocity} = objectInfos[ndx];

      // -1.5 에서 1.5
      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

      const off = ndx * (changingUnitSize / 4);
      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
-    });
+    }

    // 모든 오프셋과 스케일을 한 번에 업로드
-    device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues);
+    device.queue.writeBuffer(
        changingVertexBuffer, 0,
        vertexValues, 0, settings.numObjects * changingUnitSize / 4);

-    pass.draw(numVertices, kNumObjects);
+    pass.draw(numVertices, settings.numObjects);
```

이제 애니메이션이 되는 무언가가 생겼고, 원의 수를 설정하여 얼마나 많은 작업이 수행되는지 조정할 수 있습니다.

{{{example url="../webgpu-timing-animated.html"}}}

여기에 초당 프레임 수(fps)와 JavaScript에서 소요된 시간을 추가해 보겠습니다.

먼저 이 정보를 표시할 방법이 필요하므로 캔버스 위에 위치한 `<pre>` 요소를 추가해 보겠습니다.

```html
  <body>
    <canvas></canvas>
+    <pre id="info"></pre>
  </body>
```

```css
html, body {
  margin: 0;       /* remove the default margin          */
  height: 100%;    /* make the html,body fill the page   */
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
}
+#info {
+  position: absolute;
+  top: 0;
+  left: 0;
+  margin: 0;
+  padding: 0.5em;
+  background-color: rgba(0, 0, 0, 0.8);
+  color: white;
+}
```

우리는 이미 초당 프레임 수를 표시하는 데 필요한 데이터를 가지고 있습니다. 위에서 계산한 `deltaTime`입니다.

JavaScript 시간의 경우 `requestAnimationFrame`이 시작된 시간과 종료된 시간을 기록할 수 있습니다.

```js
  let then = 0;
  function render(now) {
    now *= 0.001;  // 초 단위로 변환
    const deltaTime = now - then;
    then = now;

+    const startTime = performance.now();

    ...

+    const jsTime = performance.now() - startTime;

+    infoElem.textContent = `\
+fps: ${(1 / deltaTime).toFixed(1)}
+js: ${jsTime.toFixed(1)}ms
+`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

이렇게 하면 처음 두 가지 시간 측정치를 얻을 수 있습니다.

{{{example url="../webgpu-timing-with-fps-js-time.html"}}}

## <a id="a-timestamp-query"></a> GPU 시간 측정

WebGPU는 GPU에서 작업이 얼마나 걸리는지 확인하기 위한 **선택적** `'timestamp-query'` 기능을 제공합니다.
선택적 기능이므로 [제한 및 기능에 관한 글](webgpu-limits-and-features.html)에서 다룬 것처럼 존재하는지 확인하고 요청해야 합니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const canTimestamp = adapter.features.has('timestamp-query');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: [
+      ...(canTimestamp ? ['timestamp-query'] : []),
+     ],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

위에서 어댑터가 `'timestamp-query'` 기능을 지원하는지에 따라 `canTimestamp`를 true 또는 false로 설정했습니다. 지원한다면 장치를 생성할 때 해당 기능을 요구합니다.

기능이 활성화되면 렌더 패스나 컴퓨트 패스에 대해 WebGPU에 *타임스탬프*를 요청할 수 있습니다. `GPUQuerySet`을 만들고 컴퓨트 또는 렌더 패스에 추가하여 이를 수행합니다. `GPUQuerySet`은 사실상 쿼리 결과의 배열입니다. WebGPU에 배열의 어느 요소에 패스가 시작된 시간을 기록할지, 어느 요소에 패스가 끝난 시간을 기록할지 알려줍니다. 그런 다음 해당 타임스탬프를 버퍼에 복사하고 버퍼를 매핑하여 결과를 읽을 수 있습니다.[^mapping-not-necessary]

[^mapping-not-necessary]: 쿼리 결과를 매핑 가능한 버퍼로 복사하는 것은 JavaScript에서 값을 읽기 위한 목적일 뿐입니다. 사용 사례에서 결과가 GPU에만 있어도 그만인 경우(예: 다른 무언가에 대한 입력으로), 결과를 매핑 가능한 버퍼로 복사할 필요가 없습니다.

먼저 쿼리 세트를 생성합니다.

```js
  const querySet = device.createQuerySet({
     type: 'timestamp',
     count: 2,
  });
```

시작 및 종료 타임스탬프를 모두 쓸 수 있도록 count는 최소 2여야 합니다.

querySet 정보를 액세스할 수 있는 데이터로 변환하기 위한 버퍼가 필요합니다.

```js
  const resolveBuffer = device.createBuffer({
    size: querySet.count * 8,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
```

querySet의 각 요소는 8바이트를 차지합니다.
`QUERY_RESOLVE` 플래그를 지정해야 하며, 결과를 JavaScript에서 다시 읽으려면 결과를 매핑 가능한 버퍼로 복사할 수 있도록 `COPY_SRC` 플래그가 필요합니다.

마지막으로 결과를 읽기 위한 매핑 가능한 버퍼를 생성합니다.

```js
  const resultBuffer = device.createBuffer({
    size: resolveBuffer.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
```

기능이 존재하는 경우에만 이러한 것들을 생성하도록 코드를 감싸야 합니다. 그렇지 않으면 `'timestamp'` querySet을 만들려고 할 때 오류가 발생합니다.

```js
+  const { querySet, resolveBuffer, resultBuffer } = (() => {
+    if (!canTimestamp) {
+      return {};
+    }

    const querySet = device.createQuerySet({
       type: 'timestamp',
       count: 2,
    });
    const resolveBuffer = device.createBuffer({
      size: querySet.count * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const resultBuffer = device.createBuffer({
      size: resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
+    return {querySet, resolveBuffer, resultBuffer };
+  })();
```

사용할 querySet과 시작 및 종료 타임스탬프를 쓸 querySet의 요소 인덱스를 렌더 패스 디스크립터에 지정합니다.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass with timing',
    colorAttachments: [
      {
        // view: <- 렌더링할 때 채워짐
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    ...(canTimestamp && {
      timestampWrites: {
        querySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      },
    }),
  };
```

위에서 기능이 존재하면 renderPassDescriptor에 `timestampWrites` 섹션을 추가하고 
querySet을 전달한 다음 시작을 세트의 요소 0에, 종료를 요소 1에 쓰도록 지시합니다.

패스를 종료한 후 `resolveQuerySet`을 호출해야 합니다. 이것은 쿼리 결과를 가져와 버퍼에 넣습니다.
querySet, 해결을 시작할 쿼리 세트의 첫 번째 인덱스, 해결할 항목 수, 해결할 버퍼, 결과를 저장할 버퍼의
오프셋을 전달합니다.

```js
    pass.end();

+    if (canTimestamp) {
+      encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
+    }
```

또한 `resolveBuffer`를 `resultsBuffer`로 복사하여 매핑하고 JavaScript에서 결과를 볼 수 있도록 하고 싶습니다. 하지만 문제가 있습니다. `resultsBuffer`가 매핑된 동안에는 거기로 복사할 수 없습니다. 다행히 버퍼에는 매핑 상태를 확인할 수 있는 `mapState` 속성이 있습니다. 시작 값인 `unmapped`로 설정되어 있으면 안전하게 복사할 수 있습니다. 다른 값으로는 `mapAsync`를 호출하는 순간의 값인 `'pending'`과 `mapAsync`가 해결된 이후의 값인 `'mapped'`가 있습니다. `unmap`한 후에는 다시 `'unmapped'`로 돌아갑니다.

```js
    if (canTimestamp) {
      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
+      if (resultBuffer.mapState === 'unmapped') {
+        encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
+      }
    }
```

커맨드 버퍼를 제출한 후 `resultBuffer`를 매핑할 수 있습니다. 위와 마찬가지로 `'unmapped'`일 때만 매핑하고 싶습니다.

```js
+  let gpuTime = 0;

   ...

   function render(now) {

    ...

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
+      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
+        const times = new BigUint64Array(resultBuffer.getMappedRange());
+        gpuTime = Number(times[1] - times[0]);
+        resultBuffer.unmap();
+      });
+    }
```

쿼리 세트 결과는 나노초 단위이며 64비트 정수로 저장됩니다. JavaScript에서 읽으려면 
`BigUint64Array` 타입 배열 뷰를 사용할 수 있습니다. `BigUint64Array`를 사용하려면
특별한 주의가 필요합니다. `BigUint64Array`에서 요소를 읽을 때 타입은 `number`가 아니라 `bigint`이므로
많은 수학 함수와 함께 사용할 수 없습니다. 또한 숫자로 변환할 때 `number`는 53비트 크기의 정수만 정확히
저장할 수 있므로 정밀도가 손실될 수 있습니다. 따라서 먼저 2개의 `bigint`를 뺄셈하여 `bigint` 값을 얻습니다.
그런 다음 그 값을 `number`로 변환하면 정상적으로 사용할 수 있습니다.

위의 코드에서는 매핑되지 않았을 때만 `resultBuffer`에 결과를 복사하고 있습니다. 
즉, 일부 프레임에서만 시간을 읽게 됩니다. 아마도 두 프레임마다 한번씩이 되겠지만,
`mapAsync`가 해결될 때까지 얼마나 걸릴지에 대한 엄격한 보장은 없습니다.
그래서, `gpuTime` 변수에 업데이트된 값을 기록해두고, 아무때나 최근 값을 읽기로 합니다.

```js
    infoElem.textContent = `\
fps: ${(1 / deltaTime).toFixed(1)}
js: ${jsTime.toFixed(1)}ms
gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
`;
```

그리고 이것으로 WebGPU에서 GPU 시간을 얻습니다.

{{{example url="../webgpu-timing-with-timestamp.html"}}}

화면에 표시되는 숫자가 너무 자주 바뀌어서 읽기 어렵습니다. 이를 해결하는 한 가지 방법은
롤링 평균을 계산하는 것입니다. 다음은 롤링 평균을 계산하는 데 도움이 되는 클래스입니다.

```js
// 참고: 쿼리가 종료 시간보다 큰 시작 시간을 반환할 수 있는 타임스탬프 쿼리에 사용됩니다.
// 그런 경우 값이 음수가 될수 있지만, 음수 값은 무시합니다.
// 참조: https://gpuweb.github.io/gpuweb/#timestamp
class NonNegativeRollingAverage {
  #total = 0;
  #samples = [];
  #cursor = 0;
  #numSamples;
  constructor(numSamples = 30) {
    this.#numSamples = numSamples;
  }
  addSample(v) {
    if (!Number.isNaN(v) && Number.isFinite(v) && v >= 0) {
      this.#total += v - (this.#samples[this.#cursor] || 0);
      this.#samples[this.#cursor] = v;
      this.#cursor = (this.#cursor + 1) % this.#numSamples;
    }
  }
  get() {
    return this.#total / this.#samples.length;
  }
}
```

값의 배열과 합계를 유지합니다. 새 값이 추가되면 새 값이 추가될 때 가장 오래된 값이 합계에서 뺍니다.

다음과 같이 사용할 수 있습니다.

```js
+const fpsAverage = new NonNegativeRollingAverage();
+const jsAverage = new NonNegativeRollingAverage();
+const gpuAverage = new NonNegativeRollingAverage();

function render(now) {
  ...

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const times = new BigUint64Array(resultBuffer.getMappedRange());
        gpuTime = Number(times[1] - times[0]);
+        gpuAverage.addSample(gpuTime / 1000);
        resultBuffer.unmap();
      });
    }

    const jsTime = performance.now() - startTime;

+    fpsAverage.addSample(1 / deltaTime);
+    jsAverage.addSample(jsTime);

    infoElem.textContent = `\
-fps: ${(1 / deltaTime).toFixed(1)}
-js: ${jsTime.toFixed(1)}ms
-gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
+fps: ${fpsAverage.get().toFixed(1)}
+js: ${jsAverage.get().toFixed(1)}ms
+gpu: ${canTimestamp ? `${gpuAverage.get().toFixed(1)}µs` : 'N/A'}
`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
```

이제 숫자가 좀 더 안정적입니다.

{{{example url="../webgpu-timing-with-timestamp-w-average.html"}}}

## <a id="a-timing-helper"></a> 헬퍼 사용

저는 이 모든 것이 조금 지루하고 뭔가 잘못하기 쉬운 것 같습니다. querySet과 2개의 버퍼, 총 3가지를 만들어야 했습니다. renderPassDescriptor를 변경해야 했습니다. 결과를 resolve 처리하고 매핑 가능한 버퍼로 복사해야 했습니다.

덜 지루하게 만드는 한 가지 방법은 타이밍을 수행하는 데 도움이 되는 클래스를 만드는 것입니다. 다음은 이러한 문제 중 일부를 해결하는 데 도움이 될 수 있는 헬퍼의 예입니다.

```js
function assert(cond, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}

// 커맨드 버퍼가 실행되기 전에 결과를 읽으려고 시도하면 오류를 생성할 수 있도록
// 커맨드 버퍼를 추적합니다.
const s_unsubmittedCommandBuffer = new Set();

/* global GPUQueue */
GPUQueue.prototype.submit = (function(origFn) {
  return function(commandBuffers) {
    origFn.call(this, commandBuffers);
    commandBuffers.forEach(cb => s_unsubmittedCommandBuffer.delete(cb));
  };
})(GPUQueue.prototype.submit);

// 참조 https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
export default class TimingHelper {
  #canTimestamp;
  #device;
  #querySet;
  #resolveBuffer;
  #resultBuffer;
  #commandBuffer;
  #resultBuffers = [];
  // 상태는 'free', 'need resolve', 'wait for result'일 수 있습니다.
  #state = 'free';

  constructor(device) {
    this.#device = device;
    this.#canTimestamp = device.features.has('timestamp-query');
    if (this.#canTimestamp) {
      this.#querySet = device.createQuerySet({
         type: 'timestamp',
         count: 2,
      });
      this.#resolveBuffer = device.createBuffer({
        size: this.#querySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
    }
  }

  #beginTimestampPass(encoder, fnName, descriptor) {
    if (this.#canTimestamp) {
      assert(this.#state === 'free', 'state not free');
      this.#state = 'need resolve';

      const pass = encoder[fnName]({
        ...descriptor,
        ...{
          timestampWrites: {
            querySet: this.#querySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        },
      });

      const resolve = () => this.#resolveTiming(encoder);
      const trackCommandBuffer = (cb) => this.#trackCommandBuffer(cb);
      pass.end = (function(origFn) {
        return function() {
          origFn.call(this);
          resolve();
        };
      })(pass.end);

      encoder.finish = (function(origFn) {
        return function() {
          const cb = origFn.call(this);
          trackCommandBuffer(cb);
          return cb;
        };
      })(encoder.finish);

      return pass;
    } else {
      return encoder[fnName](descriptor);
    }
  }

  beginRenderPass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginRenderPass', descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginComputePass', descriptor);
  }

  #trackCommandBuffer(cb) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(this.#state === 'need finish', 'you must call encoder.finish');
    this.#commandBuffer = cb;
    s_unsubmittedCommandBuffer.add(cb);
    this.#state = 'wait for result';
  }

  #resolveTiming(encoder) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(
      this.#state === 'need resolve',
      'you must use timerHelper.beginComputePass or timerHelper.beginRenderPass',
    );
    this.#state = 'need finish';

    this.#resultBuffer = this.#resultBuffers.pop() || this.#device.createBuffer({
      size: this.#resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.resolveQuerySet(this.#querySet, 0, this.#querySet.count, this.#resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.#resolveBuffer, 0, this.#resultBuffer, 0, this.#resultBuffer.size);
  }

  async getResult() {
    if (!this.#canTimestamp) {
      return 0;
    }
    assert(
      this.#state === 'wait for result',
      'you must call encoder.finish and submit the command buffer before you can read the result',
    );
    assert(!!this.#commandBuffer); // 내부 검사
    assert(
      !s_unsubmittedCommandBuffer.has(this.#commandBuffer),
      'you must submit the command buffer before you can read the result',
    );
    this.#commandBuffer = undefined;
    this.#state = 'free';

    const resultBuffer = this.#resultBuffer;
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigUint64Array(resultBuffer.getMappedRange());
    const duration = Number(times[1] - times[0]);
    resultBuffer.unmap();
    this.#resultBuffers.push(resultBuffer);
    return duration;
  }
}
```

assert는 이 클래스를 잘못 사용하지 않도록 돕기 위한 것입니다. 
예를 들어 패스를 종료했지만 해결하지 않거나, 해결하고 결과를 읽으려고 시도했지만 제출하지 않은 경우입니다.

이 클래스를 사용하면 이전에 있었던 코드의 많은 부분을 제거할 수 있습니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const canTimestamp = adapter.features.has('timestamp-query');
  const device = await adapter?.requestDevice({
    requiredFeatures: [
      ...(canTimestamp ? ['timestamp-query'] : []),
     ],
  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

+  const timingHelper = new TimingHelper(device);

  ...

-  const { querySet, resolveBuffer, resultBuffer } = (() => {
-    if (!canTimestamp) {
-      return {};
-    }
-
-    const querySet = device.createQuerySet({
-       type: 'timestamp',
-       count: 2,
-    });
-    const resolveBuffer = device.createBuffer({
-      size: querySet.count * 8,
-      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
-    });
-    const resultBuffer = device.createBuffer({
-      size: resolveBuffer.size,
-      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
-    });
-    return {querySet, resolveBuffer, resultBuffer };
-  })();

  ...

  function render(now) {

    ...

-    const pass = encoder.beginRenderPass(renderPassDescriptor);
+    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);

    ...

    pass.end();

-    if (canTimestamp) {
-      encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
-      if (resultBuffer.mapState === 'unmapped') {
-        encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
-      }
-    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    timingHelper.getResult().then(gpuTime => {
+        gpuAverage.addSample(gpuTime / 1000);
+    });

    ...
```

{{{example url="../webgpu-timing-with-timing-helper.html"}}}

`TimingHelper` 클래스에 대한 몇 가지 사항:

* 장치를 생성할 때 여전히 `'timestamp-query'` 기능을 수동으로 요청해야 하지만, 클래스는 장치에 해당 기능이 있는지 여부를 처리합니다.

* `timerHelper.beginRenderPass` 또는 `timerHelper.beginComputePass`를 호출하면 패스 디스크립터에 적절한 속성이 자동으로 추가됩니다. 또한 `end` 함수가 쿼리를 자동으로 resolve 하는 패스 인코더를 반환합니다.

* 잘못 사용하면 불평하도록 설계되었습니다.

* 1개의 패스만 처리합니다.

  여기에는 많은 타협이 있으며 더 많은 탐색 없이는 무엇이 최선인지 명확하지 않습니다.

  여러 패스를 처리하는 클래스가 유용할 수 있지만, 이상적으로는 패스당 1개의 `GPUQuerySet`이 아니라 모든 패스를 처리할 충분한 공간이 있는 단일 `GPUQuerySet`을 사용하는 것이 좋습니다.

  하지만 그렇게 하려면 사용자가 사용할 최대 패스 수를 미리 알려주도록 해야 합니다. 또는 작은 `GPUQuerySet`으로 시작하여 늘려가려면,
  이전 것을 삭제하고 더 큰 새 `GPUQuerySet`을 만드는 더 복잡한 코드를 만들어야 합니다. 그렇게 하더라도 적어도 1 프레임 동안은 여러 `GPUQuerySet`을 처리해야 합니다.

  그 모든 것이 과도해 보여서 지금은 하나의 패스를 처리하도록 만들고, 변경이 필요해지면 이 코드를 기반으로 구축할 수 있도록 하는 것이 최선인 것 같습니다.

`NoTimingHelper`를 만들 수도 있습니다.

```js
class NoTimingHelper {
  constructor() { }
  beginRenderPass(encoder, descriptor = {}) {
    return encoder.beginTimestampPass(descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return encoder.beginComputePass(descriptor);
  }
  async getResult() { return 0; }
}
```

너무 많은 코드를 변경하지 않고도 타이밍을 추가하고 끌 수 있도록 만드는 한 가지 가능한 방법입니다.

어쨌든 저는 `TimingHelper` 클래스를 사용하여 [컴퓨트 쉐이더를 사용하여 이미지 히스토그램을 계산하는 방법에 대한 글](webgpu-compute-shaders-histogram.html)의 다양한 예제 시간을 측정했습니다. 
다음은 그 목록입니다. 비디오 예제만 지속적으로 실행되므로 아마도 가장 좋은 예일 것입니다.

* <a target="_blank" href="../webgpu-compute-shaders-histogram-video-w-timing.html">4채널 비디오 히스토그램</a>

나머지는 한 번만 실행되고 결과를 JavaScript 콘솔에 출력합니다.

* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-optimized-more-w-timing.html">reduce를 사용한 청크당 4채널 워크그룹 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-race-fixed-w-timing.html">픽셀당 4채널 워크그룹 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-javascript-w-timing.html">4채널 JavaScript 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-more-w-timing.html">reduce를 사용한 청크당 1채널 워크그룹 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-w-timing.html">sum을 사용한 청크당 1채널 워크그룹 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-race-fixed-w-timing.html">픽셀당 1채널 워크그룹 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-slow-w-timing.html">1채널 단일 코어 히스토그램</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-javascript-w-timing.html">1채널 JavaScript 히스토그램</a>

# <a id="a-implementation-defined"></a> 중요: `timestamp-query` 결과는 WebGPU 구현체에 따라 다를 수 있음

위 내용들을 디버깅 및 기술 비교에 사용할 수 있지만 모든 사용자에게 유사한 결과를 반환한다고 신뢰할 수 없음을 사실상 의미합니다.
상대적인 결과조차 가정할 수 없습니다. 서로 다른 GPU는 서로 다른 방식으로 작동하며 패스 전체에서 렌더링 및 컴퓨팅을 최적화할 수 있습니다.
즉, 한 머신에서는 첫 번째 패스가 100개를 그리는 데 200µs가 걸리고 두 번째 패스도 200개를 그리는 데 200µs가 걸릴 수 있지만,
다른 GPU는 처음 100개를 그리는 데 100µs가 걸리고 두 번째 100개를 그리는 데 200µs가 걸릴 수 있으므로
첫 번째 GPU는 상대적 차이가 0µs인 반면 두 번째 GPU는 두 GPU 모두 같은 것을 그리도록 요청받았음에도 불구하고 상대적 차이가 100µs였습니다.

# <a id="a-implementation-defined"></a> 중요: `timestamp-query` 결과는 성능의 좋은 척도가 아님

타임스탬프 쿼리는 전체 성능을 결정하는 다른 많은 요소가 있으므로 성능의 좋은 척도가 아닙니다. 구체적인 예를 들어보겠습니다. 우리는 [텍스처로 이미지 로드에 관한 글](webgpu-importing-textures.html#a-generating-mips-on-the-gpu)에서 렌더 패스 기반 밉맵 생성기를 작성했습니다.
저는 컴퓨트 패스 기반 밉맵 생성기도 작성했습니다. timestamp-query를 사용하여 둘 다 시간을 측정했을 때 컴퓨트 패스 방식이 렌더 패스 기반 방식보다 5배 빠르다고 나왔습니다. 야호! 하지만 그 후 처리량 테스트로 전환했습니다. timestamp-query를 사용하는 대신 초당 60프레임으로 밉맵을 생성할 2048x2048 텍스처의 수를 늘릴 수 있는 테스트를 작성했습니다. 프레임 속도가 60fps 아래로 떨어질 때까지 숫자를 늘렸습니다. 이 방법을 사용하면 렌더 패스 방식이 한 머신에서는 컴퓨트 패스 방식보다 20% 빠르고 다른 머신에서는 8% 더 빠른 것으로 나타났습니다.

요점은 timestamp-query만 단독으로 사용하여 무언가가 얼마나 빨리 실행될지 알 수 없다는 것입니다.

<div class="webgpu_bottombar">기본적으로 <code>'timestamp-query'</code> 시간 값은 100µ초로 양자화됩니다. Chrome에서 <a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">about:flags</a>의 <a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">"enable-webgpu-developer-features"</a>를 활성화하면 시간 값이 양자화되지 않을 수 있습니다. 이렇게 하면 이론적으로 더 정확한 타이밍을 얻을 수 있습니다. 그렇긴 하지만 일반적으로 100µ초 양자화된 값은 성능을 위해 쉐이더 기술을 비교하기에 충분해야 합니다.
</div>
