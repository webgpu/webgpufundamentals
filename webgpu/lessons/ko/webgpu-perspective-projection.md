Title: WebGPU 원근 투영
Description: 원근 투영으로 멀리 있는 물체 작게 그리기
TOC: 원근 투영

이 글은 3D 수학에 대해 배우는 데 도움이 될 만한 글들의 6번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

지난 글에서는 직교 투영으로 3D 장면을 그렸습니다. 직교 투영은 쓸모가 있지만 거리에 따른 크기 변화가 없어서, 일반적으로 기대하는 3D 장면의 원근감은 나타나지 않습니다.

이번에는 원근감을 더해 보겠습니다. 원근감이란 멀리 있는 물체가 더 작게 보이는 현상입니다.

<img class="webgpu_center noinvertdark" style="width: 800px" src="resources/perspective-example.svg" />

위의 예시를 보면, 멀리 있는 물체들은 더 작게 표시됩니다. 현재의 샘플을 기준으로, 멀리 있는 물체들을 더 작게 보이게 하려면, 클립 공간의 X와 Y 값을 Z로 나누는 방법이 있습니다.

예를 들어 (10, 15)에서 (20, 15)까지 이어지는 선분의 길이는 10단위입니다. 지금 예제에서는 화면에 10픽셀로 그려집니다. 두 끝점의 X 좌표를 Z로 나눠 보겠습니다. Z가 1이면 다음과 같습니다.

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 1 = 10
20 / 1 = 20
abs(10-20) = 10
</pre>
</div>

Z가 1이면 길이는 그대로 10픽셀입니다. Z가 2라면 다음과 같습니다.

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 2 = 5
20 / 2 = 10
abs(5 - 10) = 5
</pre>
</div>

길이가 5픽셀로 줄었습니다. Z가 3이면 다음과 같습니다.

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 3 = 3.333
20 / 3 = 6.666
abs(3.333 - 6.666) = 3.333
</pre>
</div>

Z가 커질수록 나눈 결과가 작아지고, 물체가 더 작게 그려져 멀리 있는 것처럼 보입니다. 클립 공간에서 Z는 0에서 +1 사이입니다. 나누기 전에 Z에 보정 계수 `fudgeFactor`를 곱하면 거리에 따라 크기가 줄어드는 정도를 조절할 수 있습니다.

정점 셰이더를 수정해 보겠습니다. `fudgeFactor`로 나눗셈에 사용할 값을 계산한 다음 정점의 X와 Y를 그 값으로 나눕니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  fudgeFactor: f32,
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
-  vsOut.position = uni.matrix * vert.position;
+  let position = uni.matrix * vert.position;
+
+  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
+
+  vsOut.position = vec4f(
+      position.xy / zToDivideBy,
+      position.zw);

  vsOut.color = vert.color;
  return vsOut;
}
```

참고로 `zToDivideBy`를 계산할 때 1을 더했으므로, `fudgeFactor`를 0으로 설정하면 `zToDivideBy`가 1이 됩니다. 1로 나눠도 값은 그대로이므로 원근 효과를 적용하지 않은 결과와 비교할 수 있습니다.

또한, fudgeFactor를 설정할 수 있도록 코드를 업데이트해야 합니다.

```js
-  // 행렬
-  const uniformBufferSize = (16) * 4;
+  // 행렬, fudgeFactor, 패딩
+  const uniformBufferSize = (16 + 1 + 3) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kMatrixOffset = 0;
+  const kFudgeFactorOffset = 16;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const fudgeFactorValue = uniformValues.subarray(kFudgeFactorOffset, kFudgeFactorOffset + 1);

...

  const settings = {
    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
    scale: [3, 3, 3],
+    fudgeFactor: 0.5,
  };

...

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings.translation, '2', -1000, 1000).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
  gui.add(settings.scale, '0', -5, 5).name('scale.x');
  gui.add(settings.scale, '1', -5, 5).name('scale.y');
  gui.add(settings.scale, '2', -5, 5).name('scale.z');
+  gui.add(settings, 'fudgeFactor', 0, 50);

...

  function render() {

    ...

    mat4.ortho(
        0,                   // 왼쪽
        canvas.clientWidth,  // 올바른쪽
        canvas.clientHeight, // 바닥
        0,                   // 상단
        1200,                // 가까운 곳
        -1000,               // 파르
        matrixValue,         // dst
    );
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);

+    fudgeFactorValue[0] = settings.fudgeFactor;
```

또한, `settings`를 조정하여 결과를 더 쉽게 확인할 수 있도록 했습니다.

```js
  const settings = {
-    translation: [45, 100, 0],
+    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
+    scale: [3, 3, 3],
    fudgeFactor: 10,
  };
```

그리고 이것이 그 결과입니다.

{{{example url="../webgpu-perspective-projection-step-1-fudge-factor.html" }}}

만약 명확하지 않다면, “fudgeFactor” 슬라이더를 10.0에서 0.0으로 조정하여, 우리가 divide by Z 코드를 추가하기 전의 모습을 확인해 보세요.

<img class="webgpu_center" src="resources/orthographic-vs-perspective.png" />
<div class="webgpu_center">직교 투영과 원근 투영의 차이</div>

알고 보니, WebGPU는 `@builtin(position)`에 할당된 x, y, z, w 값을 정점 셰이더에서 받아서, 그 값을 w로 자동으로 나눕니다.

이를 매우 쉽게 증명할 수 있습니다. 셰이더를 변경하여, 나눗셈을 직접 수행하는 대신, `zToDivideBy` 값을 `vsOut.position.w`에 넣으면 됩니다.

```wgsl
@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  let position = uni.matrix * vert.position;

  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;

-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
+  vsOut.position = vec4f(position.xyz, zToDivideBy);

  vsOut.color = vert.color;
  return vsOut;
}
```

그리고, 정확히 똑같다는 것을 확인해 보세요.

{{{example url="../webgpu-perspective-projection-step-2-gpu-divide-by-w.html" }}}

왜 WebGPU가 자동으로 W로 나누는 것이 유용한가요? 그 이유는, 이제 더 많은 행렬 연산을 사용할 수 있기 때문에, z를 w로 복사하는 데에도 또 다른 행렬을 사용할 수 있기 때문입니다.

이런 종류의 행렬입니다.

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  0
</pre></div>

z를 w로 복사할 수 있습니다. 그 각 행들을 개별적으로 살펴볼 수 있습니다.

<div class="webgpu_math_center"><pre class="webgpu_math">{{#escapehtml}}
x_out = x_in * 1 +
        y_in * 0 +
        z_in * 0 +
        w_in * 0 ;

y_out = x_in * 0 +
        y_in * 1 +
        z_in * 0 +
        w_in * 0 ;

z_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;

w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;
{{/escapehtml}}</pre></div>


그것을 단순화하면…

<div class="webgpu_math_center"><pre class="webgpu_math">
x_out = x_in;
y_out = y_in;
z_out = z_in;
w_out = z_in;
</pre></div>

이 행렬에 앞서서 추가했던 ‘+1’을 더할 수 있습니다. 왜냐하면 `w_in`은 항상 1.0이라는 것을 알고 있기 때문입니다.

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  1
</pre></div>

그렇게 하면 W 계산 결과가 변하게 됩니다.

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 1 ;
</pre></div>

그리고 `w_in`이 1.0이라는 것을 알고 있으니, 그렇다면 그건 사실상…

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in + 1;
</pre></div>

마지막으로, 만약 행렬이 이런 형태라면, fudgeFactor를 다시 적용할 수 있습니다.

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0            0
0  1  0            0
0  0  1            0
0  0  fudgeFactor  1
</pre></div>

즉,

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * fudgeFactor +
        w_in * 1 ;
</pre></div>

그리고 그것을 간단하게 만들었습니다.

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in * fudgeFactor + 1;
</pre></div>

자, 이제 프로그램을 다시 수정해서, 단순히 행렬을 사용하도록 해 보겠습니다.

먼저, 정점 셰이더를 다시 복원시켜서 상황을 다시 간단하게 만들어보겠습니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
-  fudgeFactor: f32,
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
-  let position = uni.matrix * vert.position;
-
-  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
-
-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
  vsOut position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

다음으로, Z &rarr; W 행렬을 생성하는 함수를 만들어보겠습니다.

```js
function makeZToWMatrix(fudgeFactor) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ];
}
```

그리고 우리는 코드를 수정해서 그 기능을 사용할 수 있도록 할 것입니다.

```
-    mat4.ortho(
+    const projection = mat4.ortho(
        0,                   // 왼쪽
        canvas.clientWidth,  // 올바른쪽
        canvas.clientHeight, // 바닥
        0,                   // 상단
        1200,                // 가까운 곳
        -1000,               // 파르
-        matrixValue,         // dst
    );
+    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);
```

그리고 다시 한 번 말하지만, 전혀 똑같습니다.

{{{example url="../webgpu-perspective-projection-step-3-perspective-z-to-w.html" }}}

지금까지 Z를 이용해 원근감을 만드는 과정을 살펴봤습니다. 이 값을 W에 넣으면 WebGPU가 X, Y, Z를 W로 나누는 원근 나눗셈을 수행합니다.

하지만 여전히 몇 가지 문제가 있습니다. 예를 들어, Z 값을 -1100 정도로 설정하면 아래와 같은 결과가 나타납니다.

<div class="webgpu_center"><div data-diagram="z-clipping" style="height: 400px;"></div></div>

F가 일찍 사라지는 이유는 클리핑 때문입니다. X와 Y의 범위는 -1부터 +1까지이지만, Z의 범위는 0부터 +1까지입니다. 여기서는 W로 나눈 뒤 Z가 0보다 작아진 부분이 잘려 나갑니다.

<div class="webgpu_center" style="width: 500px; height: 400px;"><div data-diagram="f-frustum-diagram"></div></div>

투영 행렬과 W로 나누는 연산이 함께 *시야 절두체(view frustum)*를 정의합니다. 이 절두체의 가까운 면은 Z = 0, 먼 면은 Z = 1에 대응합니다. 범위를 벗어나면 잘려 나갑니다.

<blockquote>
<h2>절두체(frustum)</h2>
<p><i>명사</i>:</p>
<ol><li>원뿔이나 각뿔을 밑면과 평행한 평면으로 잘라 꼭짓점 쪽을 제거하고 남은 부분입니다.</li></ol>
</blockquote>

수학적인 부분에 대해서는 자세히 설명할 수 있지만, [동일한 방식으로 그 결과를 추론할 수 있습니다](https://stackoverflow.com/a/28301213/128511). 즉, Z 값에 일정한 양을 더하고, 크기를 조절함으로써 원하는 범위의 값을 0에서 +1 사이로 변환할 수 있습니다.

재미있는 점은, 이 모든 과정들을 하나의 행렬로 표현할 수 있다는 것입니다. 더욱 좋은 점은, `fudgeFactor` 대신에 `fieldOfView`라는 값을 사용하여, 그 목표를 달성하기 위한 적절한 값들을 계산할 수 있다는 것입니다.

이것은 행렬을 생성하는 함수입니다.

```js
const mat4 = {
  ...
  perspective(fieldOfViewYInRadians, aspect, zNear, zFar, dst) {
    dst = dst || new Float32Array(16);

    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
    const rangeInv = 1 / (zNear - zFar);

    dst[0] = f / aspect;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;

    dst[4] = 0;
    dst[5] = f;
    dst[6] = 0;
    dst[7] = 0;

    dst[8] = 0;
    dst[9] = 0;
    dst[10] = zFar * rangeInv;
    dst[11] = -1;

    dst[12] = 0;
    dst[13] = 0;
    dst[14] = zNear * zFar * rangeInv;
    dst[15] = 0;

    return dst;
  }
```

이 행렬은 시야각과 종횡비, Z축 클리핑 범위를 한 번에 적용합니다. *눈*이나 *카메라*가 원점 (0, 0, 0)에 있고 -Z축을 바라본다고 가정합니다. W로 나눈 후에는 `zNear` 거리에 있는 점의 Z가 0, `zFar` 거리에 있는 점의 Z가 1이 됩니다. 가까운 면에서 수직 시야각 `fieldOfView`의 절반만큼 위아래로 벌어진 지점은 각각 `Y = 1`과 `Y = -1`에 대응합니다. 가로 배율은 세로 배율을 종횡비 `aspect`로 나눠 구합니다. `aspect`에는 보통 표시 영역의 `width / height`를 전달합니다.

이것은 행렬이 작동하는 모습을 나타내는 다이어그램입니다.

<div class="webgpu_center" style="width: 500px; height: 800px;"><div data-diagram="frustum-diagram"></div></div>

이 행렬은 시야 절두체 안의 좌표를 클립 공간으로 변환합니다. `zNear`와 `zFar`는 각각 가까운 쪽과 먼 쪽의 클리핑 경계를 정합니다. `zNear`를 23으로 설정하면 회전하는 큐브의 앞쪽이, `zFar`를 24로 설정하면 뒤쪽이 잘리는 것을 볼 수 있습니다.

이 함수를 우리의 예시에서 사용해 봅시다.

```js
  const settings = {
    fieldOfView: degToRad(100),
    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
    rotation: [degToRad(40), degToRad(25), degToRad(325)],
    scale: [3, 3, 3],
-    fudgeFactor: 10,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
  gui.add(settings.scale, '0', -5, 5).name('scale.x');
  gui.add(settings.scale, '1', -5, 5).name('scale.y');
  gui.add(settings.scale, '2', -5, 5).name('scale.z');
-  gui.add(settings, 'fudgeFactor', 0, 50);

  ...

  function render() {
    ....

-    const projection = mat4.ortho(
-        0,                   // 왼쪽
-        canvas.clientWidth,  // 올바른쪽
-        canvas.clientHeight, // 바닥
-        0,                   // 상단
-        1200,                // 가까운 곳
-        -1000,               // 파르
-    );
-    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
+    const aspect = canvas.clientWidth / canvas.clientHeight;
+    mat4.perspective(
+        settings.fieldOfView,
+        aspect,
+        1,      // zNear
+        2000,   // zFar
+        matrixValue,
+    );
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);
```

이제 남은 문제가 하나 있습니다. 이 투영 행렬는 시청자가 0,0,0 위치에 있으며, 음의 Z 방향을 바라보고 있고, 양의 Y 방향이 위쪽으로 가정하고 있습니다. 하지만 지금까지 사용된 행렬들은 다른 방식으로 작동했습니다. 150단위 높이, 100단위 너비, 30단위 두께인 F를 어떤 -Z 위치에 배치해야 합니다. 그리고 F가 화면 내부에 들어갈 수 있을 만큼 충분히 멀리 있어야 합니다. 위에서 정의한 프레스럼에서는 `zNear`가 1일 때, 물체가 1단위 떨어져 있을 때도 상단에서 하단까지 약 2.4단위만 표시됩니다. 따라서 F는 화면에서 98% 정도만 보일 것입니다.

몇 가지 숫자들을 조합해보면서, 이런 설정을 만들어냈습니다.

```js
  const settings = {
    fieldOfView: degToRad(100),
-    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
-    rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [3, 3, 3],
+    translation: [-65, 0, -120],
+    rotation: [degToRad(220), degToRad(25), degToRad(325)],
+    scale: [1, 1, 1],
  };
```

그리고, 그런 식으로 진행하면서, 사용자 인터페이스의 설정을 더 적절하게 조정해 보겠습니다. 또한, 화면의 복잡함을 줄이기 위해 축척 기능도 제거해 보겠습니다.


```js
  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
-  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
-  gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
+  gui.add(settings.translation, '0', -1000, 1000).name('translation.x');
+  gui.add(settings.translation, '1', -1000, 1000).name('translation.y');
+  gui.add(settings.translation, '2', -1400, -100).name('translation.z');
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
-  gui.add(settings.scale, '0', -5, 5).name('scale.x');
-  gui.add(settings.scale, '1', -5, 5).name('scale.y');
-  gui.add(settings.scale, '2', -5, 5).name('scale.z');
```

이제, 더 이상 “픽셀 공간”에 있지 않으므로, 그 그리드도 제거해버리도록 하죠.

```css
:root {
  --bg-color: #fff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #000;
  }
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
}
```

자, 이제 그걸 보세요.

{{{example url="../webgpu-perspective-projection-step-4-perspective.html" }}}

이제 다시 단순히 셰이더 내에서 행렬 곱셈만을 수행하는 단계에 돌아왔습니다. 이제 우리는 시야 범위를 선택할 수 있으며, Z 공간도 자유롭게 조절할 수 있습니다.

다음으로는 [카메라](webgpu-cameras.html)에 대해 알아보겠습니다.

<div class="webgpu_bottombar">
<h3>왜 우리는 F를 Z축에서 -120이라는 위치까지 이동시켰을까요?</h3>
<p>
다른 샘플들에서는 F의 위치가 (45, 100, 0)이었지만, 마지막 샘플에서는 (-65, 0, -120)로 이동되었습니다. 왜 그렇게 멀리 이동해야 했을까요?
</p>
<p>
그 이유는, 지금까지의 예시들을 보면, <code>mat4.projection</code> 함수는 픽셀을 클립 공간으로 프로젝션하는 작업을 수행했습니다. 즉, 우리가 표시하는 영역은 사실상 픽셀으로 표현된 것입니다. 3D 환경에서는 ‘픽셀’이라는 개념이 별로 적합하지 않습니다. 왜냐하면 ‘픽셀’이라는 것은 카메라로부터 특정 거리에 있는 픽셀만을 나타내기 때문입니다.
</p>
<p>
다시 말해, 새로운 시점 투영 행렬을 사용할 경우, F를 사용하여 0,0,0에서 평면을 그리고, 회전도 0,0,0으로 설정한다면, 다음과 같은 결과가 나옵니다.
</p>
<div class="webgpu_center"><img src="resources/f-big-and-wrong-side.svg" style="width: 500px;"></div>
<p>
F의 왼쪽 상단 모서리는 원점에 위치합니다. 원근 투영 행렬은 음수 Z 방향을 가리키지만, 우리의 F는 양수 Z 방향으로 구성되어 있습니다. 원근 투영 행렬은 Y축이 위를 가리키는 반면, 우리의 F는 Y축이 아래를 가리킵니다.
</p>
<p>
이 원근 투영에서는 파란색 영역 안에 들어오는 부분만 보입니다. <code>zNear</code>가 1이고 수직 시야각이 100도라면, Z = -1에서 이 영역의 높이는 약 2.38단위, 너비는 2.38에 종횡비를 곱한 값입니다. Z = -2000에서는 높이가 약 4767단위입니다. 높이가 150단위인 F를 전부 보려면 가까운 면보다 훨씬 뒤쪽, 카메라에서 더 먼 곳으로 옮겨야 합니다.
</p>
<p>
-120단위만큼 Z축 방향으로 이동시키면, F는 사다리꼴 내부로 이동합니다. 또한, F를 위쪽으로 회전시켜서 올바른 방향으로 배치합니다.
</p>
<div class="webgpu_center"><img src="resources/f-right-side.svg" style="width: 500px;"><div>비율에 맞게 그리지 않았습니다.</div></div>
</div>



<!-- 이 내용은 기사의 하단에 남겨두세요. -->
<script type="module" src="webgpu-perspective-projection.js"></script>
