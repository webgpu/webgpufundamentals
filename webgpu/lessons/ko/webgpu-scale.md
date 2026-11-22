Title: WebGPU 크기 조절
Description: 물체의 크기 조절하기
TOC: 크기 조절

이 글은 3D 수학을 설명하는 연재의 세 번째 글입니다. 각 글은 이전 글의
내용을 바탕으로 하므로 순서대로 읽으면 이해하기 쉽습니다.

{{{toc-steps list="matrix-math.hanson"}}}

크기 조절은 [이동](webgpu-translation.html)만큼 쉽습니다.

정점 위치에 원하는 크기 배율을 곱하면 됩니다. 다음은 [이전 예제](webgpu-rotation.html)의
셰이더에서 바뀐 부분입니다.

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
  rotation: vec2f,
  scale: vec2f,
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

+  // 위치의 크기를 조절합니다
+  let scaledPosition = vert.position * uni.scale;

  // 위치를 회전합니다
  let rotatedPosition = vec2f(
-    vert.position.x * uni.rotation.y - vert.position.y * uni.rotation.x,
-    vert.position.x * uni.rotation.x + vert.position.y * uni.rotation.y
+    scaledPosition.x * uni.rotation.y - scaledPosition.y * uni.rotation.x,
+    scaledPosition.x * uni.rotation.x + scaledPosition.y * uni.rotation.y
  );

  // 이동 값을 더합니다
  let position = rotatedPosition + uni.translation;

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
```

그리고 이전과 마찬가지로 크기 값을 담을 공간이 있도록 유니폼 버퍼를
변경해야 합니다.

```js
-  // 색상, 해상도, 이동, 회전, 패딩
-  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
+  // 색상, 해상도, 이동, 회전, 크기
+  const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kColorOffset = 0;
  const kResolutionOffset = 4;
  const kTranslationOffset = 6;
  const kRotationOffset = 8;
+  const kScaleOffset = 10;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
+  const scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);
```

렌더링할 때는 크기 값을 갱신해야 합니다.

```js
  const settings = {
    translation: [150, 100],
    rotation: degToRad(30),
+    scale: [1, 1],
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings.scale, '0', -5, 5).name('scale.x');
+  gui.add(settings.scale, '1', -5, 5).name('scale.y');

  function render() {
    ...

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
    rotationValue.set([
        Math.cos(settings.rotation),
        Math.sin(settings.rotation),
    ]);
+    scaleValue.set(settings.scale);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

이제 크기를 조절할 수 있습니다. 슬라이더를 움직여 보세요.

{{{example url="../webgpu-scale.html" }}}

음수 배율로 크기를 조절하면 도형이 뒤집힌다는 점에 주목하세요.

또한 크기 조절은 0, 0을 기준으로 이루어지며, F에서는 이 지점이 왼쪽 위
모서리입니다. 위치에 배율을 곱하므로 각 점이 0, 0에서 멀어지는 것은
자연스럽습니다. 이를 고칠 방법도 짐작할 수 있을 것입니다. 예를 들어 크기를
조절하기 전에 *사전 이동*을 추가할 수 있습니다. 실제 F의 위치 데이터를
변경하는 방법도 있습니다. 곧 또 다른 방법을 살펴보겠습니다.

지난 세 글이 [이동](webgpu-translation.html), [회전](webgpu-rotation.html),
크기 조절을 이해하는 데 도움이 되었기를 바랍니다. 다음 글에서는 이 세 가지를
**훨씬 간단하고** 대체로 더 유용한 형태로 결합하는
[행렬의 마법](webgpu-matrix-math.html)을 살펴보겠습니다.
