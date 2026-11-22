Title: WebGPU 행렬 스택
Description: 행렬 스택 사용하기
TOC: 행렬 스택

이 글은 3D 수학에 대해 배우는 데 도움이 되는 글들의 8번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

행렬 스택은 이름 그대로 행렬을 쌓아 놓은 [스택](https://en.wikipedia.org/wiki/Stack_(abstract_data_type))입니다. 여러 물체의 상대적인 위치와 방향을 정할 때 유용합니다. 예를 들어 서류 캐비닛을 만들어 보겠습니다. 행렬 스택을 사용하면 쉽게 만들 수 있습니다.

간단하게 시작하기 위해 카메라 강의에서 여러 F가 다른 F 하나를 바라보도록 만든 예제를 가져와 각 F를 큐브로 바꾸겠습니다.

우리가 먼저 해야 할 일은, 우리가 그려왔던 ‘F’를 단위 큐브로 바꾸는 것입니다.

```js
-function createFVertices() {
+function createCubeVertices() {
*    // 왼쪽
*    0, 0,  0,
*    0, 0, -1,
*    0, 1,  0,
*    0, 1, -1,
*
*    // 올바른쪽
*    1, 0,  0,
*    1, 0, -1,
*    1, 1,  0,
*    1, 1, -1,
*  ];
*
*  const indices = [
*     0,  2,  1,    2,  3,  1,   // 왼쪽
*     4,  5,  6,    6,  5,  7,   // 올바른쪽
*     0,  4,  2,    2,  4,  6,   // 전선
*     1,  3,  5,    5,  3,  7,   // 뒤로
*     0,  1,  4,    4,  1,  5,   // 바닥
*     2,  6,  3,    3,  6,  7,   // 상단
*  ];
*
*  const quadColors = [
*      200,  70, 120,  // 왼쪽 열 앞쪽
*       80,  70, 200,  // 왼쪽 열을 뒤로 이동시킵니다.
*       70, 200, 210,  // 상단
*      160, 160, 220,  // 최고 위치에 있음
*       90, 130, 110,  // 최고 위치에서 가장 낮은 위치까지
*      200, 200,  70,  // 상위 계층과 중간 계층 사이
*  ];

  ...
```

위의 데이터를 바탕으로 이와 같은 입체 구조를 만들 수 있습니다.

<div class="webgpu_center"><img src="resources/unit-cube.png" class="nobg"></div>

이전의 코드에서는 26개의 “objectInfo” 객체가 미리 생성되어 있었습니다. 각 “objectInfo”는 유니폼 버퍼와 bindGroup로 구성된 집합이었습니다. 이는 우리가 그릴 대상이 되는 각 요소마다 하나씩 생성된 것입니다. 이제는 이러한 객체들을 필요에 따라 생성하도록 코드를 변경해 보겠습니다. 그렇게 하면 원하는 만큼의 객체를 그릴 수 있게 됩니다.

```js
-  const numFs = 5 * 5 + 1;
  const objectInfos = [];
-  for (let i = 0; i < numFs; ++i) {
  function createObjectInfo() {
    // 행렬
    const uniformBufferSize = (16) * 4;
    const uniformBuffer = device.createBuffer({

    ...

-    objectInfos.push({
+    return {
      uniformBuffer,
      uniformValues,
      matrixValue,
      bindGroup,
-    });
+    };
  }
```

모든 경우에 대해 동일한 단위의 큐브를 사용할 것입니다. 이렇게 하면 구조를 간단하게 유지할 수 있습니다. 하지만 각 큐브를 구분할 수 있도록 색상을 약간 변경할 필요가 있습니다. 그래서, uniform buffer를 통해 색상을 받아들일 수 있도록 업데이트해 보겠습니다. 그리고 정점들의 색상을 이 uniform color와 곱해줍니다. 이렇게 하면 각 큐브의 정점 색상을 약간 변경할 수 있습니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  color: vec4f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  return vsOut.color * uni.color;
}
```

새로운 색상을 저장할 수 있도록, 통일된 버퍼 생성 방식을 업데이트해야 합니다.

```js
  function createObjectInfo() {
-    // 행렬
-    const uniformBufferSize = (16) * 4;
+    // 행렬과 색상
+    const uniformBufferSize = (16 + 4) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
    const kMatrixOffset = 0;
+    const kColorOffset = 16;

    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: uniformBuffer },
      ],
    });

    return {
      uniformBuffer,
      uniformValues,
+      colorValue,
      matrixValue,
      bindGroup,
    };
  }
```

이제, 객체를 그리는 코드를 별도의 함수로 분리해야 합니다.

```js
  let depthTexture;
+  let objectNdx = 0;

+  function drawObject(ctx, matrix, color) {
+    const { pass, viewProjectionMatrix } = ctx;
+    if (objectNdx === objectInfos.length) {
+      objectInfos.push(createObjectInfo());
+    }
+    const {
+      matrixValue,
+      colorValue,
+      uniformBuffer,
+      uniformValues,
+      bindGroup,
+    } = objectInfos[objectNdx++];
+
+    mat4.multiply(viewProjectionMatrix, matrix, matrixValue);
+    colorValue.set(color);
+
+    // 유니폼 값을 유니폼 버퍼에 업로드합니다
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
+
+    pass.setBindGroup(0, bindGroup);
+    pass.draw(numVertices);
+  }

  function render() {
+    objectNdx = 0;

    ...

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);

-    // 각도에 따라 목표점 X, Z를 업데이트합니다.
-    settings.target[0] = Math.cos(settings.targetAngle) * radius;
-    settings.target[2] = Math.sin(settings.targetAngle) * radius;

    ...

+    objectNdx = 0;
-    objectInfos.forEach(({
-      matrixValue,
-      uniformBuffer,
-      uniformValues,
-      bindGroup,
-    }, i) => {
-      const deep = 5;
-      const across = 5;
-      if (i < 25) {
-        // 그리드 위치 계산하기
-        const gridX = i % across;
-        const gridZ = i / across | 0;
-
-        // 0부터 1까지의 위치를 계산합니다.
-        const u = gridX / (across - 1);
-        const v = gridZ / (deep - 1);
-
-        // 중앙에 모아서 흩뿌려라.
-        const x = (u - 0.5) * across * 150;
-        const z = (v - 0.5) * deep * 150;
-
-        // 이 F를 그 위치에서 목표 F를 향해 움직이게 합니다.
-        const aimMatrix = mat4.aim([x, 0, z], settings.target, up);
-        mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue);
-      } else {
-        mat4.translate(viewProjectionMatrix, settings.target, matrixValue);
-      }
-
-      // 유니폼 값을 유니폼 버퍼에 업로드합니다
-      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
-
-      pass.setBindGroup(0, bindGroup);
-      pass.draw(numVertices);
-    });

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

필요할 경우 새 "objectInfo"(유니폼 버퍼와 타입 배열 뷰)를 만드는 `drawObject` 함수를 추가했습니다. `drawObject`는 렌더 패스 인코더와 현재의 `viewProjectionMatrix`를 담은 `ctx` 컨텍스트를 받습니다. 행렬과 색상도 받습니다. 전달받은 행렬을 `viewProjectionMatrix`와 곱해 이 물체의 유니폼 버퍼를 채운 후, 해당 유니폼 버퍼를 사용하도록 바인드 그룹을 설정하고 `draw`를 호출합니다.

이제, 이를 사용하여 큐브를 그려내는 코드를 추가해 보겠습니다.

```js
  function render() {

    ...

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);

    ...

    objectNdx = 0;
+    const ctx = { pass, viewProjectionMatrix };
+    drawObject(ctx, mat4.rotationY(settings.baseRotation), [1, 1, 1, 1]);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}
```

위쪽에서는 y축을 중심으로 회전하는 행렬을 사용하여 그림을 그립니다. 그리고 색상은 흰색입니다. 이 경우, 큐브의 모든 꼭짓점의 색상은 변하지 않습니다.

GUI와 카메라 기능을 더 개선해야 합니다.

```js
-  const radius = 200;
  const settings = {
-    target: [0, 200, 300],
-    targetAngle: 0,
+    baseRotation: 0,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings.target, '1', -100, 300).name('target height');
-  gui.add(settings, 'targetAngle', radToDegOptions).name('target angle');
+  gui.add(settings, 'baseRotation', radToDegOptions);

  ...

  function render() {
    ...

-    const eye = [-500, 300, -500];
-    const target = [0, -100, 0];
+    const eye = [0, 2, 3];
+    const target = [0, 1, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

```

우리에게는 큐브가 있습니다.

{{{example url="../webgpu-matrix-stack-cube.html" }}}

이제 큐브를 렌더링할 수 있게 되었으니, 행렬 스택을 사용하여 일련의 파일 캐비닛을 만들어보겠습니다.

먼저, 행렬 스택 클래스를 만들어 보겠습니다.

```js
class MatrixStack {
  #matrix;
  #stack;

  constructor() {
    this.reset();
  }
  reset() {
    this.#matrix = mat4.identity();
    this.#stack = [];
    return this;
  }
  save() {
    this.#stack.push(this.#matrix);
    this.#matrix = mat4.copy(this.#matrix);
    return this;
  }
  restore() {
    this.#matrix = this.#stack.pop();
    return this;
  }
  get() {
    return this.#matrix;
  }
  set(matrix) {
    return this.#matrix.set(matrix);
  }
  translate(translation) {
    mat4.translate(this.#matrix, translation, this.#matrix);
    return this;
  }
  rotateX(angle) {
    mat4.rotateX(this.#matrix, angle, this.#matrix);
    return this;
  }
  rotateY(angle) {
    mat4.rotateY(this.#matrix, angle, this.#matrix);
    return this;
  }
  rotateZ(angle) {
    mat4.rotateZ(this.#matrix, angle, this.#matrix);
    return this;
  }
  scale(scale) {
    mat4.scale(this.#matrix, scale, this.#matrix);
    return this;
  }
}
```

위의 클래스는 상당히 간단합니다. 이 클래스는 `#stack`이라는 배열을 유지합니다. 그리고 `#matrix`라는 변수도 가지고 있는데, 이는 사실상 스택 상단에 있는 행렬을 나타냅니다.

스택 맨 위의 행렬을 조작하는 여러 메서드를 추가합니다. 이 메서드들은 [직교 투영](webgpu-orthographic-projection.html)에서 작성한 `mat4` 함수를 사용합니다.

참고: 스택 형태이지만, 더 전통적인 `push`와 `pop` 대신 `save`과 `restore`을 선택했습니다. 왜냐하면 `save`와 `restore`는 Canvas 2D API의 [save](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save)와 [restore](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/restore)와 같은 기능과 일치하기 때문입니다. 이 기능들은 자체적인 행렬 스택을 조작하는 데 사용됩니다.

위에서 언급했던 것 중에 아직 존재하지 않는 것이 하나 있습니다. 그건 바로 `mat4.copy` 함수입니다. 그래서 그 기능을 추가해 보겠습니다.

```js
const mat4 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(16);
+    dst.set(src);
+    return dst;
+  },

  ...
```

그렇게 하면, 손잡이가 있는 단 하나의 서랍장을 그려보겠습니다. 그 서랍장은 큰 정육면체 모양이 될 것입니다. 손잡이도 작은 정육면체 모양이 될 것입니다.

```js
+  const kHandleColor = [0.5, 0.5, 0.5, 1];
+  const kDrawerColor = [1, 1, 1, 1];
+
+  const kDrawerSize = [40, 30, 50];
+  const kHandleSize = [10, 2, 2];
+
+  const [kWidth, kHeight, kDepth] = [0, 1, 2];
+
+  const kHandlePosition = [
+    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
+    kDrawerSize[kHeight] * 2 / 3,
+    kHandleSize[kDepth],
+  ];
+
+  function drawDrawer(ctx) {
+    const { stack } = ctx;
+    stack.save();
+      stack.scale(kDrawerSize);
+      drawObject(ctx, stack.get(), kDrawerColor);
+    stack.restore();
+
+    stack.save();
+      stack.translate(kHandlePosition);
+      stack.scale(kHandleSize);
+      drawObject(ctx, stack.get(), kHandleColor);
+    stack.restore();
+  }
+
+  const stack = new MatrixStack();

  ...

  function render() {
    ...

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    stack.save();
+    stack.rotateY(settings.baseRotation);
+    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
    objectNdx = 0;
-    const ctx = { pass, stack, viewProjectionMatrix };
-    drawObject(ctx, mat4.rotationY(settings.baseRotation), [1, 1, 1, 1]);
+    const ctx = { stack, viewProjectionMatrix };
+    drawDrawer(ctx);
+    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

위의 코드는 `MatrixStack`을 생성한 후, 그 객체를 `drawDrawer`에 전달된 컨텍스트(ctx에 추가합니다. 이를 통해 행렬을 계산하는 데 도움을 받을 수 있습니다. 회전 행렬을 직접 생성하는 대신, 먼저 스택에 행렬을 저장한 다음, 도어의 너비의 절반만 이동시켜 중앙에 위치시키는 방식으로 처리합니다.

`drawDrawer`는 스택을 받아 큐브 두 개를 그립니다. 하나는 `kDrawerSize` 크기의 서랍이고, 다른 하나는 `kHandlePosition`에 놓이는 `kHandleSize` 크기의 손잡이입니다. 두 큐브에는 행렬 스택에 들어 있는 상위 변환이 공통으로 적용됩니다.

드로어 큐브는 `kDrawerColor`라는 색상으로 그려집니다. 이 색상은 흰색이므로, 큐브의 정점들의 색상은 변하지 않습니다. 핸들은 `kHandleColor`라는 색상으로 그려집니다. 이 색상은 회색의 50%에 해당하는 색상이므로, 큐브가 더 어두운 색으로 표시됩니다.

카메라 위치에 약간의 조정이 필요합니다.

```js
-    const eye = [0, 2, 3];
-    const target = [0, 1, 0];
+    const eye = [0, 20, 100];
+    const target = [0, 20, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);
```

그렇게 하면, 우리는 파일 정리함의 서랍을 얻을 수 있습니다.

{{{example url="../webgpu-matrix-stack-filing-drawer.html"}}}

아마도 궁금하실 것입니다. 왜 이런 복잡한 구조를 만들어야 하는지 말입니다. 4개의 서랍이 있는 파일 보관함을 그려보면, 그 이유를 알 수 있을 것입니다.

```js
  const kHandleColor = [0.5, 0.5, 0.5, 1];
  const kDrawerColor = [1, 1, 1, 1];
+  const kCabinetColor = [0.75, 0.75, 0.75, 0.75];
+  const kNumDrawersPerCabinet = 4;

  const kDrawerSize = [40, 30, 50];
  const kHandleSize = [10, 2, 2];

  const [kWidth, kHeight, kDepth] = [0, 1, 2];

  const kHandlePosition = [
    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
    kDrawerSize[kHeight] * 2 / 3,
    kHandleSize[kDepth],
  ];

+  const kDrawerSpacing = kDrawerSize[kHeight] + 3;

  function drawDrawer(ctx) {
    const { stack } = ctx;
    stack.save();
      stack.scale(kDrawerSize);
      drawObject(ctx, stack.get(), kDrawerColor);
    stack.restore();

    stack.save();
      stack.translate(kHandlePosition);
      stack.scale(kHandleSize);
      drawObject(ctx, stack.get(), kHandleColor);
    stack.restore();
  }

+  function drawCabinet(ctx, numDrawersPerCabinet) {
+    const { stack } = ctx;
+
+    const kCabinetSize = [
+      kDrawerSize[kWidth] + 6,
+      kDrawerSpacing * numDrawersPerCabinet + 6,
+      kDrawerSize[kDepth] + 4,
+    ];
+
+    stack.save();
+      stack.scale(kCabinetSize);
+      drawObject(ctx, stack.get(), kCabinetColor);
+    stack.restore();
+
+    for (let i = 0; i < numDrawersPerCabinet; ++i) {
+      stack.save();
+        stack.translate([3, i * kDrawerSpacing + 5, 1]);
+        drawDrawer(ctx);
+      stack.restore();
+    }
+  }

  function render() {
    ...
-    const eye = [0, 20, 100];
-    const target = [0, 20, 0];
+    const eye = [0, 80, 200];
+    const target = [0, 80, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawDrawer(ctx);
+    drawCabinet(ctx, kNumDrawersPerCabinet);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

위에서 `drawCabinet` 함수는 `kCabinetSize` 크기의 큐브를 그립니다. 이 큐브의 높이는, 우리가 요청한 캐비닛의 수보다 약간 더 큽니다.

그런 다음, 행렬 스택을 사용하여 각 서랍을 올바른 위치에 배치합니다. 그리고 서랍이 캐비닛 큐브보다 약간 앞쪽에 위치하도록 합니다.

{{{example url="../webgpu-matrix-stack-filing-cabinet.html"}}}

`drawDrawer`를 전혀 변경할 필요가 없었습니다. 행렬 스택 덕분에, 그대로 사용할 수 있었습니다.

계속 진행해 보겠습니다. 여러 개의 캐비닛을 그려보겠습니다.

```js
  const kHandleColor = [0.5, 0.5, 0.5, 1];
  const kDrawerColor = [1, 1, 1, 1];
  const kCabinetColor = [0.75, 0.75, 0.75, 0.75];
  const kNumDrawersPerCabinet = 4;
+  const kNumCabinets = 5;

  const kDrawerSize = [40, 30, 50];
  const kHandleSize = [10, 2, 2];

  const [kWidth, kHeight, kDepth] = [0, 1, 2];

  const kHandlePosition = [
    (kDrawerSize[kWidth] - kHandleSize[kWidth]) / 2,
    kDrawerSize[kHeight] * 2 / 3,
    kHandleSize[kDepth],
  ];

  const kDrawerSpacing = kDrawerSize[kHeight] + 3;
+  const kCabinetSpacing = kDrawerSize[kWidth] + 10;

  ...

  function drawCabinet(ctx, numDrawersPerCabinet) {
    const { stack } = ctx;

    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * numDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];

    stack.save();
      stack.scale(kCabinetSize);
      drawObject(ctx, stack.get(), kCabinetColor);
    stack.restore();

    for (let i = 0; i < numDrawersPerCabinet; ++i) {
      stack.save();
        stack.translate([3, i * kDrawerSpacing + 5, 1]);
        drawDrawer(ctx);
      stack.restore();
    }
  }

+  function drawCabinets(ctx, numCabinets) {
+    const { stack } = ctx;
+    for (let i = 0; i < numCabinets; ++i) {
+      stack.save();
+        stack.translate([i * kCabinetSpacing, 0, 0]);
+        drawCabinet(ctx, kNumDrawersPerCabinet);
+      stack.restore();
+    }
+  }

  function render() {
    ...
    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
-    stack.translate([(kDrawerSize[kWidth] * -0.5), 0, 0]);
+    stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawCabinet(ctx, kNumDrawersPerCabinet);
+    drawCabinets(ctx, kNumCabinets);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

이제, `drawCabinets`라는 함수가 생겼습니다. 이 함수는 지정된 수만큼의 캐비닛을 그리는 데 `drawCabinet` 함수를 사용합니다.

`render` 함수에서, 캐비닛의 너비의 절반을 중앙으로 이동시킵니다.

{{{example url="../webgpu-matrix-stack-filing-cabinets.html"}}}

이것만으로도 행렬 스택의 유용성에 대한 감을 잡을 수 있을 것입니다. 행렬 스택을 사용하면, 여러 항목들을 쉽게 재사용하거나, 위치나 방향, 크기를 조정할 수 있습니다.

## <a id="a-recursive-tree"></a> 재귀적 트리

다시 한 번 예를 들어보겠습니다. 큐브들을 이용해서 재귀적인 트리를 만들어보겠습니다. 이를 위해서는 트리의 “분기”를 추가하는 함수가 필요합니다. 이 함수는 재귀적으로 작동하며, `treeDepth`라는 매개변수를 전달받습니다. 만약 깊이가 0보다 크다면, 2개의 더 많은 분기를 추가하고, 그 다음에는 더 낮은 깊이를 전달합니다.

```js
  const degToRad = d => d * Math.PI / 180;

  const settings = {
    baseRotation: 0,
+    scale: 0.9,
+    rotationX: degToRad(20),
+    rotationY: degToRad(10),
  };

  const radToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };
+  const treeRadToDegOptions = { min: 0, max: 90, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
+  gui.add(settings, 'scale', 0.1, 1.2);
+  gui.add(settings, 'rotationX', treeRadToDegOptions);
+  gui.add(settings, 'rotationY', treeRadToDegOptions);
  gui.add(settings, 'baseRotation', radToDegOptions);

+  const kTreeDepth = 6;
+  const [/*kWidth*/, kHeight, /*kDepth*/] = [0, 1, 2];
+  // 1단위 크기의 큐브를 원점 위에 위치시키도록 합니다. 그래서 크기 조절이 일어날 때에도 큐브의 중심이 원점 위에 남아 있도록 합니다.
+  // 이 물체는 원점에서 x축과 z축을 따라 확장되며, y축 방향으로도 위로 확장됩니다.
+  const kBranchPosition = [-0.5, 0, 0.5];
+  const kBranchSize = [20, 150, 20];
+
+  const kWhite = [1, 1, 1, 1];
+
+  function drawBranch(ctx) {
+    const { stack } = ctx;
+    stack
+      .save()
+      .scale(kBranchSize)
+      .translate(kBranchPosition);
+    drawObject(ctx, stack.get(), kWhite);
+    stack.restore();
+  }
+
+  function drawTreeLevel(ctx, offset, treeDepth) {
+    const { stack } = ctx;
+    const s = offset ? settings.scale : 1;
+    const y = offset ? kBranchSize[kHeight] : 0;
+    stack
+      .save()
+      .translate([0, y, 0])
+      .rotateZ(offset * settings.rotationX)
+      .rotateY(Math.abs(offset) * settings.rotationY)
+      .scale([s, s, s]);
+
+    drawBranch(ctx);
+
+    if (treeDepth > 0) {
+      drawTreeLevel(ctx, -1, treeDepth - 1);
+      drawTreeLevel(ctx, +1, treeDepth - 1);
+    }
+
+    stack.restore();
+  }

  function render() {
    ...

-    const eye = [0, 80, 200];
-    const target = [0, 80, 0];
+    const eye = [0, 450, 1000];
+    const target = [0, 450, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    stack.save();
    stack.rotateY(settings.baseRotation);
-    stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0]);
    objectNdx = 0;
    const ctx = { pass, stack, viewProjectionMatrix };
-    drawCabinets(ctx, kNumCabinets);
+    drawTreeLevel(ctx, 0, kTreeDepth);
    stack.restore();

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

```

`drawTreeLevel`는 우리의 행렬 스택을 사용합니다. 먼저 `save` 함수를 호출하여 현재 행렬을 저장합니다. 그 다음 `translate` 함수를 사용하여 분기를 현재 분기의 끝으로 이동시킵니다. 만약 `offset`이 `0`이라면, 그 분기는 루트이므로 이동할 필요가 없습니다.

`offset`는 현재 브랜치를 시계 방향 또는 반시계 방향으로 `rotateZ`하는 데 사용됩니다. 행렬 스택의 특성상, 현재 브랜치는 부모 브랜치에 비해 회전하게 됩니다.

`offset`은 다시 사용되어, `rotateY` 함수를 통해 분기를 회전시킵니다. 이번에는 `offset`의 절댓값을 사용합니다. `Math.abs`를 생략하고 싶다면, 그 차이를 직접 확인해 보세요.

마지막으로, 우리는 `scale`번째 가지를 만들어서, 각 가지를 부모 가지보다 더 작거나 더 크게 만듭니다. 단, 루트는 예외입니다. 루트는 `offset`번째 가지와 `0`번째 가지를 가진 가지입니다.

그런 다음 `drawBranch`를 호출합니다. 분기선은 `kBranchSize` 크기의 큐브를 그립니다. 또한 원래의 단위 큐브를 변환하여 큐브가 원점 위에 위치하도록 합니다. 이렇게 하면 크기가 조절될 때 큐브가 +Y축 방향으로 커집니다.

그런 다음, 만약 깊이가 0보다 크다면, `drawTreeLevel` 함수를 재귀적으로 호출하여 두 개의 더 많은 분기를 추가합니다. 하나는 오프셋이 `-1`인 분기이고, 다른 하나는 오프셋이 `+1`인 분기입니다. 각 분기는 스택에 있는 행렬을 기반으로 시작되며, 따라서 각 분기는 자신의 부모 분기와 비교하여 위치와 방향이 결정됩니다.

마지막으로, 우리는 그 스택을 `restore`합니다.

{{{example url="../webgpu-matrix-stack-tree.html"}}}

“rotationX”를 조절하면, 가지들이 펼쳐지거나 모여 있는 모습을 볼 수 있습니다. “rotationY”를 조절하면, 가지들이 x-평면에서 멀어지는 모습을 볼 수 있습니다. 무슨 일이 일어나는지 확인하기 위해서는 “baseRotation”도 조절해야 할 수도 있습니다. “scale”을 조절하면, 각 가지들이 부모 가지보다 더 작거나 더 커지는 모습을 볼 수 있습니다.

아마도 이 방법을 활용하면, 알고리즘 기반의 나무 생성기를 만들 수 있을 것입니다. [^tree-gen]

[^tree-gen]: 개별적인 큐브나 원기둥들로부터 나무를 생성하는 것은 정상적인 방법이 아닐 것입니다. 재귀적 접근 방식과 행렬 스택을 사용해야 합니다. 하지만 큐브를 그리는 대신, 행렬들을 사용하여 나무의 정점들을 생성하고, 전체 나무를 구성하는 메시를 만들어낼 것입니다.

각 가지에 장식을 추가해 보겠습니다. 큐브를 사용하는 대신, 원뿔을 사용하여 장식을 만들어보겠습니다. 다음은 원뿔의 꼭짓점을 생성하는 코드입니다.

```js
// 팁은 위쪽에 있고, 베이스는 아래쪽에 있습니다.
function createConeVertices({radius = 1, height = 1, subdivisions = 6} = {}) {
  const positions = [];
  const colors = [];

  function addVertex(angle, radius, height, color) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    positions.push(c * radius, height, s * radius);
    colors.push(...color);
  }

  for (let i = 0; i < subdivisions; ++i) {
    const angle0 = (i + 0) / subdivisions * Math.PI * 2;
    const angle1 = (i + 1) / subdivisions * Math.PI * 2;

    const u = (i + 1) / subdivisions;
    const color = [u * 128 + 127, 0, 0];

    // 측면을 추가하기
    addVertex(angle0, 0, 0, color);
    addVertex(angle1, radius, -height, color);
    addVertex(angle0, radius, -height, color);

    // 최상위에 추가하기
    addVertex(angle0, radius, -height, color);
    addVertex(angle1, radius, -height, color);
    addVertex(angle0, 0, -height, color);
  }

  const numVertices = positions.length / 3;
  const vertexData = new Float32Array(numVertices * 4); // xyz + 색상
  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < numVertices; ++i) {
    const position = positions.slice(i * 3, i * 3 + 3);
    vertexData.set(position, i * 4);

    const color = colors.slice(i * 3, i * 3 + 3);
    colorData.set(color, i * 16 + 12);
    colorData[i * 16 + 15] = 255;
  }

  return {
    vertexData,
    numVertices,
  };
}
```

위 코드는 원을 한 바퀴 돌며 옆면과 윗면에 삼각형을 추가합니다. 각 면은 빨간색으로 표시합니다. 큐브 함수처럼 이 함수도 `vertexData`와 `numVertices`를 반환합니다. 이처럼 삼각형을 조합해 만드는 기본 도형을 프리미티브라고 합니다.

정점 버퍼를 생성하는 코드를 함수로 묶어서, 큐브와 원뿔 모두에 이 함수를 두 번 호출할 수 있도록 하겠습니다.

```js
-  const { vertexData, numVertices } = createCubeVertices();

+  function createVertices({vertexData, numVertices}, name) {
*    const vertexBuffer = device.createBuffer({
-      label: `vertex buffer vertices`,
+      label: `${name}: vertex buffer vertices`,
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+    return {
+      vertexBuffer,
+      numVertices,
+    };
*  }

+  const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const ornamentVertices = createVertices(createConeVertices({
+    radius: 20,
+    height: 60,
+  }), 'ornament');
```

그 다음으로, `drawObject` 함수를 업데이트해서, 이 함수가 정점 정보를 받을 수 있도록 해야 합니다.

```js
-  function drawObject(ctx, matrix, color) {
+  function drawObject(ctx, vertices, matrix, color) {
    const { pass, viewProjectionMatrix } = ctx;
+    const { vertexBuffer, numVertices } = vertices;
    if (objectNdx === objectInfos.length) {
      objectInfos.push(createObjectInfo());
    }
    const {
      matrixValue,
      colorValue,
      uniformBuffer,
      uniformValues,
      bindGroup,
    } = objectInfos[objectNdx++];

    mat4.multiply(viewProjectionMatrix, matrix, matrixValue);
    colorValue.set(color);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

+    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices);
  }
```

그리고 큐브의 정점들을 그리는 코드를 업데이트해야 합니다.

```js
  function drawBranch(ctx) {
    const { stack } = ctx;
    stack
      .save()
      .scale(kBranchSize)
      .translate(kBranchPosition);
-    drawObject(ctx, stack.get(), kWhite);
+    drawObject(ctx, cubeVertices, stack.get(), kWhite);
    stack.restore();
  }
```

이제는 정점 버퍼를 미리 설정할 필요가 없습니다.

```js
  function render() {

    ...
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
-    pass.setVertexBuffer(0, vertexBuffer);

    ...
```

그 다음으로, `drawTreeLevel` 함수에 코드를 추가하여, 깊이가 0이 될 때 장식물을 그려보도록 해 보겠습니다.

```js
  function drawTreeLevel(ctx, offset, treeDepth) {
    const { stack } = ctx;
    const s = offset ? settings.scale : 1;
    const y = offset ? kBranchSize[kHeight] : 0;
    stack
      .save()
      .translate([0, y, 0])
      .rotateZ(offset * settings.rotationX)
      .rotateY(Math.abs(offset) * settings.rotationY)
      .scale([s, s, s]);

    drawBranch(ctx);

    if (treeDepth > 0) {
      drawTreeLevel(ctx, -1, treeDepth - 1);
      drawTreeLevel(ctx, +1, treeDepth - 1);
    }

+    if (treeDepth === 0 && offset > 0) {
+      const position = vec3.getTranslation(stack.get());
+      drawObject(ctx, ornamentVertices, mat4.translation(position), kWhite);
+    }

    stack.restore();
  }
```

우리는 `vec3.getTranslation`이라는 함수를 사용하고 있습니다. 이 함수의 매개변수들을 적절히 제공해야 합니다.

```js
const vec3 = {
  ...
  getTranslation(m, dst) {
    dst = dst || new Float32Array(3);

    dst[0] = m[12];
    dst[1] = m[13];
    dst[2] = m[14];

    return dst;
  },
};
```

`getTranslation`은 [직교 투영](webgpu-orthographic-projection.html)에서 살펴본 것처럼 행렬에서 이동 성분을 가져옵니다.

위에서, 우리는 장식을 그리기 위해 추가한 코드에서 `getTranslation` 함수를 호출하여 현재 행렬 스택의 변환값을 얻습니다. 이 값이 바로 최종 분기의 기반이 됩니다. 행렬 스택에서 직접 장식을 그릴 수는 없습니다. 왜냐하면 행렬 스택의 방향과 크기가 분기 방향에 따라 변하기 때문입니다. 따라서, 우리는 행렬 스택에서 현재 변환값을 얻은 다음, 그 변환값을 사용하여 행렬을 생성합니다. 변환값이 분기의 기반에 위치하므로, 하나만 그려도 됩니다. 따라서 `offset > 0`인 경우에만 장식을 그립니다. 그렇지 않으면 같은 위치에 두 개의 장식을 그리게 됩니다.

{{{example url="../webgpu-matrix-stack-tree-with-ornaments.html"}}}

다음은 [장면 그래프](webgpu-scene-graphs.html)에 관한 내용입니다.
