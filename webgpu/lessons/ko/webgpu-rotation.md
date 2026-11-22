Title: WebGPU 회전
Description: 물체 회전하기
TOC: 회전

이 글은 3D 수학을 다루는 연재의 두 번째 글입니다. 각 글은 이전 글의 내용을 바탕으로 하므로 순서대로 읽으면 이해하기 쉽습니다.

{{{toc-steps list="matrix-math.hanson"}}}

제가 설명하는 방식이 잘 전달될지는 모르겠지만, 한번 설명해 보겠습니다.

먼저 “단위원”을 소개하겠습니다. 중학교 수학 시간에 배운 내용을 떠올려 보세요. 원에는 반지름이 있습니다. 반지름은 원의 중심에서 원 위의 점까지의 거리입니다. 단위원은 반지름이 1.0인 원입니다.

아래 그림이 단위원입니다. [^ydown]

[^ydown]: 이 단위원에서는 아래쪽이 +Y입니다. 픽셀 공간에서 Y축이 아래를 향하기 때문입니다. WebGPU의 클립 공간에서는 위쪽이 +Y입니다. 이전 글에서 설명했듯이 셰이더에서 Y를 뒤집었습니다.

<div class="webgpu_center"><div data-diagram="unit-circle" style="display: inline-block; width: 500px;"></div></div>

파란색 손잡이를 원을 따라 움직이면 X와 Y 위치가 바뀝니다. 이 값은 원 위에 있는 점의 위치를 나타냅니다. 맨 위에서는 Y가 1이고 X가 0입니다. 맨 오른쪽에서는 X가 1이고 Y가 0입니다.

초등학교 3학년 때 배웠듯이 어떤 수에 1을 곱하면 값이 그대로입니다. 123 * 1 = 123인 셈이죠. 반지름이 1.0인 단위원도 어떤 의미에서는 1의 한 형태입니다. 회전하는 1이라고 생각해 보세요. 단위원을 곱하는 것은 1을 곱하는 것과 비슷한데, 신기하게도 물체가 회전합니다.

단위원 위에서 임의의 점을 골라 그 점의 X와 Y 값으로 [이동](webgpu-translation.html)의 정점 위치를 곱해 보겠습니다.

셰이더의 변경 사항은 다음과 같습니다.


```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
+  rotation: vec2f,
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

+  // 위치를 회전합니다
+  let rotatedPosition = vec2f(
+    vert.position.x * uni.rotation.x - vert.position.y * uni.rotation.y,
+    vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x
+  );

  // 이동 값을 더합니다
-  let position = vert.position + uni.translation;
+  let position = rotatedPosition + uni.translation;

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

JavaScript도 수정해 새 유니폼 값을 담을 공간을 확보합니다.

```js
-  // 색상, 해상도, 이동
-  const uniformBufferSize = (4 + 2 + 2) * 4;
+  // 색상, 해상도, 이동, 회전, 패딩
+  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
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
+  const kRotationOffset = 8;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
+  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
```

UI도 필요합니다. 여기서는 UI 제작법을 다루지 않으므로 기존 UI를 가져다 쓰겠습니다. 먼저 HTML에 UI가 들어갈 자리를 만듭니다.

```html
  <body>
    <canvas></canvas>
+    <div id="circle"></div>
  </body>
```

그런 다음 CSS로 위치를 잡습니다.

```css
#circle {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 300px;
  background-color: var(--bg-color);
}
```

마지막으로 JavaScript에서 UI를 사용합니다.

```js
+import UnitCircle from './resources/js/unit-circle.js';

...

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');

+  const unitCircle = new UnitCircle();
+  document.querySelector('#circle').appendChild(unitCircle.domElement);
+  unitCircle.onChange(render);

  function render() {
    ...

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
+    rotationValue.set([unitCircle.x, unitCircle.y]);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

다음이 결과입니다. 원 위의 손잡이를 드래그해 회전하거나 슬라이더로 이동해 보세요.

{{{example url="../webgpu-rotation-via-unit-circle.html"}}}

왜 이렇게 동작할까요? 수식을 살펴보겠습니다.

<div class="webgpu_center">
<pre class="webgpu_math">
rotatedX = a_position.x * u_rotation.x - a_position.y * u_rotation.y;
rotatedY = a_position.x * u_rotation.y + a_position.y * u_rotation.x;
</pre>
</div>

직사각형을 회전시킨다고 가정하겠습니다. 회전하기 전 오른쪽 위 모서리는 3.0, -9.0에 있습니다. 단위원에서 3시 방향을 기준으로 시계 방향으로 30도 떨어진 점을 골라 봅시다.

<div class="webgpu_center"><div data-diagram="static-circle-30" style="display: inline-block; width: 400px;"></div></div>

원 위의 그 점은 x = 0.87, y = 0.50입니다.

<div class="webgpu_center">
<pre class="webgpu_math">
 3.0 * 0.87 - -9.0 * 0.50 =  7.1
 3.0 * 0.50 + -9.0 * 0.87 = -6.3
</pre>
</div>

우리가 원하는 위치가 바로 여기입니다.

<img src="resources/rotation-drawing.svg" width="500" class="webgpu_center" style="width: 1000px"/>

시계 방향으로 60도 회전할 때도 같습니다.

<div class="webgpu_center"><div data-diagram="static-circle-60" style="display: inline-block; width: 400px;"></div></div>

이때 원 위의 위치는 0.87과 0.50입니다.

<div class="webgpu_center">
<pre class="webgpu_math">
 3.0 * 0.50 - -9.0 * 0.87 =  9.3
 3.0 * 0.87 + -9.0 * 0.50 = -1.9
</pre>
</div>

점을 시계 방향으로 돌리면 X 값은 커지고 Y 값은 작아집니다. 90도를 넘기면 X 값은 다시 작아지고 Y 값은 커지기 시작합니다. 이 패턴을 이용해 회전시킬 수 있습니다.

단위원에서 각도에 대응하는 점의 X 좌표가 코사인이고, Y 좌표가 사인입니다. 주어진 각도의 사인과 코사인은 다음과 같이 구할 수 있습니다.

    function printSineAndCosineForAnAngle(angleInDegrees) {
      const angleInRadians = angleInDegrees * Math.PI / 180;
      const s = Math.sin(angleInRadians);
      const c = Math.cos(angleInRadians);
      console.log('s =', s, 'c =', c);
    }

코드를 JavaScript 콘솔에 붙여 넣고 `printSineAndCosineForAnAngle(30)`을 입력하면 `s = 0.50 c = 0.87`에 해당하는 값이 출력됩니다. 여기서는 소수점 둘째 자리까지 반올림했습니다.

이 내용을 조합하면 정점을 원하는 각도로 회전시킬 수 있습니다. 회전 값에 원하는 각도의 사인과 코사인을 설정하면 됩니다.

      ...
      const angleInRadians = angleInDegrees * Math.PI / 180;
      rotation[0] = Math.cos(angleInRadians);
      rotation[1] = Math.sin(angleInRadians);

이제 설정에는 회전 각도만 담도록 바꿔 보겠습니다.

```js
+  const degToRad = d => d * Math.PI / 180;

  const settings = {
    translation: [150, 100],
+    rotation: degToRad(30),
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
+  gui.add(settings, 'rotation', radToDegOptions);

-  const unitCircle = new UnitCircle();
-  document.querySelector('#circle').appendChild(unitCircle.domElement);
-  unitCircle.onChange(render);

  function render() {
    ...

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
-    rotationValue.set([unitCircle.x, unitCircle.y]);
+    rotationValue.set([
+        Math.cos(settings.rotation),
+        Math.sin(settings.rotation),
+    ]);
```

슬라이더를 움직여 이동하거나 회전해 보세요.

{{{example url="../webgpu-rotation.html"}}}

설명이 도움이 되었기를 바랍니다. [다음 글에서는 더 간단한 크기 조절을 살펴봅니다](webgpu-scale.html).

<div class="webgpu_bottombar"><h3>라디안이란?</h3>
<p>
라디안은 원, 회전, 각도에 사용하는 측정 단위입니다. 거리를 인치, 야드, 미터 등으로 측정하듯이 각도는 도나 라디안으로 나타낼 수 있습니다.
</p>
<p>
미터법으로 계산하는 편이 야드파운드법으로 계산하는 것보다 쉽습니다. 인치를 피트로 바꿀 때는 12로, 야드로 바꿀 때는 36으로 나눕니다. 저는 36으로 나누는 계산을 암산으로 하기 어렵습니다. 미터법은 훨씬 쉽습니다. 밀리미터를 센티미터로 바꿀 때는 10으로, 미터로 바꿀 때는 1000으로 나눕니다. 1000으로는 **암산으로도** 나눌 수 있습니다.
</p>
<p>
도와 라디안의 차이도 비슷합니다. 도로 계산하면 복잡하지만 라디안은 계산하기 쉽습니다. 한 바퀴는 360도이자 2π 라디안입니다. 반 바퀴는 1π 라디안이고, 1/4바퀴인 90도는 1/2π 라디안입니다. 따라서 90도를 회전하려면 <code>Math.PI * 0.5</code>를 쓰면 됩니다. 45도를 회전하려면 <code>Math.PI * 0.25</code>를 쓰면 됩니다.
</p>
<p>
각도, 원, 회전을 계산할 때 라디안을 기준으로 생각하면 대부분 간단해집니다. 직접 써 보세요. 계산에는 라디안을 쓰고 UI에서 값을 표시할 때는 도를 사용하세요.
</p>
</div>

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<script type="module" src="webgpu-rotation.js"></script>
