Title: WebGPU 이동
Description: 물체 이동하기
TOC: 이동

이 글은 [기초](webgpu-fundamentals.html), [유니폼](webgpu-uniforms.html), [정점 버퍼](webgpu-vertex-buffers.html) 글을 읽었다고 가정합니다. 아직 읽지 않았다면 먼저 읽고 돌아오세요.

이 글은 3D 수학을 다루는 연재의 첫 글입니다. 각 글은 이전 글의 내용을 바탕으로 하므로 순서대로 읽으면 이해하기 쉽습니다.

{{{toc-steps list="matrix-math.hanson"}}}

[정점 버퍼 글](webgpu-vertex-buffers.html)의 예제와 비슷한 코드에서 시작하겠습니다. 여러 원을 그리는 대신 글자 F를 하나 그리고, [인덱스 버퍼](webgpu-vertex-buffers.html#a-index-buffers)로 데이터 크기를 줄이겠습니다.

[Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)처럼 픽셀 공간에서 작업해 보겠습니다. 다음과 같이 삼각형 6개를 조합해 F를 만듭니다.

<div class="webgpu_center"><img src="resources/f-polygons.svg" style="width: 600px;"></div>

다음은 F의 데이터입니다.

```js
function createFVertices() {
  const vertexData = new Float32Array([
    // 왼쪽 세로획
    0, 0,
    30, 0,
    0, 150,
    30, 150,

    // 위쪽 가로획
    30, 0,
    100, 0,
    30, 30,
    100, 30,

    // 가운데 가로획
    30, 60,
    70, 60,
    30, 90,
    70, 90,
  ]);

  const indexData = new Uint32Array([
    0,  1,  2,    2,  1,  3,  // 왼쪽 세로획
    4,  5,  6,    6,  5,  7,  // 위쪽 가로획
    8,  9, 10,   10,  9, 11,  // 가운데 가로획
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

위의 정점 데이터는 픽셀 공간에 있으므로 클립 공간으로 변환해야 합니다. 셰이더에 해상도를 전달하고 몇 가지 계산을 하면 됩니다. 각 단계를 하나씩 살펴보겠습니다.

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

  let position = vert.position;

  // 픽셀 단위의 위치를 0.0에서 1.0 사이의 값으로 변환합니다
  let zeroToOne = position / uni.resolution;

  // 0 <-> 1을 0 <-> 2로 변환합니다
  let zeroToTwo = zeroToOne * 2.0;

  // 0 <-> 2를 -1 <-> +1로 변환합니다 (클립 공간)
  let flippedClipSpace = zeroToTwo - 1.0;

  // Y를 뒤집습니다
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

정점 위치를 해상도로 나누면 캔버스 전체에서 0부터 1까지 변하는 값을 얻습니다. 여기에 2를 곱하면 값의 범위가 0부터 2가 됩니다. 그런 다음 1을 뺍니다. 이제 값은 클립 공간에 있지만 Y축 방향이 반대입니다. 클립 공간에서는 양의 Y가 위쪽이고 Canvas 2D에서는 양의 Y가 아래쪽이기 때문입니다. 그래서 Y에 -1을 곱해 방향을 뒤집습니다. 이제 셰이더가 출력할 클립 공간 좌표를 얻었습니다.

속성이 하나뿐이므로 파이프라인은 다음과 같습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'just 2d position',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
*          arrayStride: (2) * 4, // 부동소수점 값 (2)개, 각각 4바이트
*          attributes: [
*            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치
*          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

유니폼을 담을 버퍼를 설정해야 합니다.

```js
  // 색상, 해상도, 패딩
*  const uniformBufferSize = (4 + 2) * 4 + 8;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
*  const kColorOffset = 0;
*  const kResolutionOffset = 4;
*
*  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
*  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
*
*  // 색상이 바뀌지 않으므로 초기화할 때 한 번만 설정합니다
*  colorValue.set([Math.random(), Math.random(), Math.random(), 1]);
```

렌더링할 때 해상도를 설정합니다.

```js
  function render() {
    ...

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

실행하기 전에 캔버스 배경을 모눈종이처럼 꾸며 보겠습니다. 격자 한 칸을 10x10 픽셀로 정하고, 100x100 픽셀마다 좀 더 굵은 선을 그립니다.

```css
:root {
  --bg-color: #fff;
  --line-color-1: #AAA;
  --line-color-2: #DDD;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #000;
    --line-color-1: #666;
    --line-color-2: #333;
  }
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
  background-color: var(--bg-color);
  background-image: linear-gradient(var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(90deg, var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(var(--line-color-2) 1px, transparent 1px),
      linear-gradient(90deg, var(--line-color-2) 1px, transparent 1px);
  background-position: -1.5px -1.5px, -1.5px -1.5px, -1px -1px, -1px -1px;
  background-size: 100px 100px, 100px 100px, 10px 10px, 10px 10px;
}
```

위의 CSS는 밝은 테마와 어두운 테마 모두에서 작동합니다.

지금까지 예제에서는 모두 불투명한 캔버스를 사용했습니다. 방금 설정한 배경이 보이도록 캔버스를 투명하게 만들려면 몇 가지를 바꿔야 합니다.

먼저 캔버스의 `alphaMode`를 `'premultiplied'`로 설정합니다. 기본값은 `'opaque'`입니다. `'premultiplied'` 모드에서는 캔버스에 쓰는 RGB에 알파를 미리 곱해야 합니다.

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });
```

그런 다음 `GPURenderPassDescriptor`에서 캔버스를 0, 0, 0, 0으로 지우도록 합니다. `clearValue`의 기본값이 0, 0, 0, 0이므로, 다른 값을 설정하던 줄을 삭제하면 됩니다.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- 렌더링할 때 채웁니다
-        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
```

이렇게 하면 F가 나타납니다.

{{{example url="../webgpu-translation-prep.html"}}}

배경 격자와 F의 크기를 비교해 보세요. F의 정점 위치는 너비가 100픽셀, 높이가 150픽셀인 글자를 만들며, 화면에도 그대로 표시됩니다. F는 0,0에서 시작해 오른쪽으로 100,0까지, 아래쪽으로 0,150까지 이어집니다.

기본 준비를 마쳤으니 이제 *이동*을 추가해 보겠습니다.

이동은 물체의 위치를 바꾸는 작업입니다. 유니폼에 이동 값을 추가하고 이 값을 정점 위치에 더하면 됩니다.

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
+  translation: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

+  // 이동 값을 더합니다
-  let position = vert.position;
+  let position = vert.position + uni.translation;

  // 픽셀 단위의 위치를 0.0에서 1.0 사이의 값으로 변환합니다
  let zeroToOne = position / uni.resolution;

  // 0 <-> 1을 0 <-> 2로 변환합니다
  let zeroToTwo = zeroToOne * 2.0;

  // 0 <-> 2를 -1 <-> +1로 변환합니다 (클립 공간)
  let flippedClipSpace = zeroToTwo - 1.0;

  // Y를 뒤집습니다
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

유니폼 버퍼에 이동 값을 담을 공간을 확보해야 합니다.

```js
-  // 색상, 해상도, 패딩
-  const uniformBufferSize = (4 + 2) * 4 + 8;
+  // 색상, 해상도, 이동
+  const uniformBufferSize = (4 + 2 + 2) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kColorOffset = 0;
  const kResolutionOffset = 4;
+  const kTranslationOffset = 6;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
+  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
```

그런 다음 렌더링할 때 이동 값을 설정합니다.

```js
+  const settings = {
+    translation: [0, 0],
+  };

  function render() {
    ...

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
+    translationValue.set(settings.translation);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

마지막으로 이동 값을 조절할 수 있는 UI를 추가하겠습니다.

```js
+import GUI from '../3rdparty/muigui-0.x.module.js';

...
  const settings = {
    translation: [0, 0],
  };

+  const gui = new GUI();
+  gui.onChange(render);
+  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
+  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
```

이제 F를 이동할 수 있습니다.

{{{example url="../webgpu-translation.html"}}}

이동 값이 픽셀 격자와 일치하는지 확인해 보세요. 이동 값을 200,300으로 설정하면 F의 왼쪽 위 정점인 0,0이 200,300에 그려집니다.

앞선 예제에서도 `offset`이라는 이름으로 이동 값을 여러 번 사용했습니다. 이번에 살펴본 이동은 다음 글의 회전, 크기 조절과 함께 행렬로 합칠 수 있습니다.

다음 글에서는 [회전](webgpu-rotation.html)을 살펴보겠습니다.
