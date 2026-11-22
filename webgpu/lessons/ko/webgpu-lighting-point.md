Title: WebGPU 점광원
Description: WebGPU에서 점광원 구현하기
TOC: 점광원

이 글은 [방향광](webgpu-lighting-directional.html)에 이어집니다. 아직 읽지 않았다면 먼저 읽어 보세요.

이전 글에서는, 빛이 항상 같은 방향에서 나오는 방향 조명에 대해 다루었습니다. 우리는 렌더링하기 전에 그 방향을 미리 설정했습니다.

방향을 하나 정하는 대신, 3D 공간에 광원의 위치를 두고 모델 표면의 각 점에서 광원으로 향하는 방향을 구하면 점광원을 만들 수 있습니다.

{{{diagram url="resources/point-lighting.html" width="700" height="400" className="noborder" }}}

위쪽 표면을 회전시키면 표면의 각 점에서 광원을 향하는 벡터가 다르다는 점을 볼 수 있습니다. 각 점에서 이 방향과 표면 법선의 내적을 구하면, 표면 위의 위치마다 다른 값을 얻습니다.

그러니까, 그렇게 하도록 하죠.

먼저, 빛의 위치를 알아야 합니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
-  lightDirection: vec3f,
+  lightPosition: vec3f,
};
```

그리고 우리는 표면의 월드 좌표를 계산할 방법이 필요합니다. 그를 위해, 우리의 위치를 월드 행렬로 곱해주면 됩니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
+  world: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
  lightPosition: vec3f,
};

....

  // 표면의 월드 좌표를 계산해 주세요.
  let surfaceWorldPosition = (u_world * vert.position).xyz;


```

광원의 월드 위치에서 표면의 월드 위치를 빼면 표면에서 광원으로 향하는 벡터를 얻습니다. 점광원은 고정된 한 방향에서 비추지 않으므로 이 벡터는 표면 위의 위치에 따라 달라집니다.

```wgsl
  struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) surfaceToLight: vec3f,
  };

  ...

    // 빛이 닿는 표면의 벡터를 계산해 보세요.
    // 그런 다음 그 데이터를 프래그먼트 셰이더로 전달합니다.
    vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;
```

이것이 바로 전체적인 맥락에서의 내용입니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
*  world: mat4x4f,
  color: vec4f,
*  lightPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
*  @location(1) surfaceToLight: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // normal을 방향을 맞추고, 그 다음으로 프래그먼트 셰이더로 전달합니다.
  vsOut.normal = uni.normalMatrix * vert.normal;

*  // 표면의 월드 좌표를 계산해 주세요.
*  let surfaceWorldPosition = (uni.world * vert.position).xyz;
*
*  // 빛이 닿는 표면의 벡터를 계산해 보세요.
*  // 그런 다음 그 데이터를 프래그먼트 셰이더로 전달합니다.
*  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

  return vsOut;
}
```

표면에서 광원으로 향하는 벡터는 프래그먼트 셰이더에서 정규화합니다. 정점 셰이더에서 이미 정규화했더라도, 정점 사이를 보간한 결과의 길이는 1이라고 보장할 수 없습니다.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // 왜냐하면, vsOut.normal은 여러 단계를 거쳐 변수가 변하는 값이기 때문입니다.
  // 이 값은 보간된 값이기 때문에, 단위 벡터가 되지 않습니다.
  // 이를 정규화하면, 다시 단위 벡터가 됩니다.
  let normal = normalize(vsOut.normal);

+  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // 점곱을 이용하여 빛을 계산합니다.
-  // 빛의 반대 방향으로 향하는 평면과의 관계
-  let light = dot(normal, -uni.lightDirection);
+  // 정상적인 상태에서, 빛의 방향을 따라서…
+  let light = dot(normal, surfaceToLightDirection);

  // 이제, 색상 부분만 곱해주면 됩니다. 알파 부분은 포함하지 않습니다.
  // 빛에 의해
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}
```

그런 다음, 유니폼 버퍼, 오프셋, 그리고 뷰를 업데이트해야 합니다.

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
-  const kColorOffset = 28;
-  const kLightDirectionOffset = 32;
+  const kWorldOffset = 28;
+  const kColorOffset = 44;
+  const kLightPositionOffset = 48;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
+  const worldValue = uniformValues.subarray(
+      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-  const lightDirectionValue =
-      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
+  const lightPositionValue =
+      uniformValues.subarray(kLightPositionOffset, kLightPositionOffset + 3);
```

그리고 우리는 그들을 설정해야 합니다.

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // 월드 행렬을 계산합니다.
-    const world = mat4.rotationY(settings.rotation);
+    const world = mat4.rotationY(settings.rotation, worldValue);

    // viewProjection와 world 행렬를 결합합니다.
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // 역수로 변환하고, 그 값을 세계로 전달합니다. 역수로 변환된 값을 세계에 적용합니다.
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
=    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
+    lightPositionValue.set([-10, 30, 100]);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

```

그래, 여기 있습니다.

{{{example url="../webgpu-lighting-point.html" }}}

# <a id="a-specular"></a> 정반사

이제, 우리가 원하는 효과를 얻을 수 있는 방법이 생겼으니, ‘반사 효과’라고 불리는 것을 추가해 보겠습니다.

실제 세계에 있는 물체를 보면, 만약 그 물체가 약간 반짝거린다면, 그 물체가 빛을 바로 우리 쪽으로 반사한다면, 그건 마치 거울과 같은 것입니다.

<img class="webgpu_center" src="resources/specular-highlights.jpg" />

이 효과를 시뮬레이션하려면, 빛이 우리의 눈으로 반사되는지 여부를 계산해보면 됩니다. 역시, *dot-product* 함수가 여기서 큰 역할을 합니다.

어떤 것을 확인해야 할까요? 잘 생각해 보겠습니다. 빛은 표면에 닿았을 때와 같은 각도로 반사됩니다. 따라서, 표면이 빛을 향하는 방향이, 빛이 눈을 향하는 방향과 정확히 반대라면, 그때는 빛이 완벽한 각도로 반사된다는 것입니다.

{{{diagram url="resources/surface-reflection.html" width="700" height="400" className="noborder" }}}

표면에서 광원과 카메라로 향하는 두 단위 벡터를 더한 뒤 정규화하면 두 방향의 중간을 가리키는 `halfVector`를 얻습니다. 이 벡터가 표면 법선과 같은 방향이면 빛이 카메라 쪽으로 반사됩니다. 두 단위 벡터의 내적은 같은 방향에서 1, 수직에서 0, 반대 방향에서 -1입니다.

{{{diagram url="resources/specular-lighting.html" width="700" height="400" className="noborder" }}}

먼저 카메라의 월드 위치를 전달합니다. 각 정점에서 카메라로 향하는 벡터를 구해 프래그먼트 셰이더로 전달하겠습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
+  viewWorldPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) surfaceToLight: vec3f,
+  @location(2) surfaceToView: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // normal을 방향을 맞추고, 그 다음으로 프래그먼트 셰이더로 전달합니다.
  vsOut.normal = uni.normalMatrix * vert.normal;

  // 표면의 월드 좌표를 계산해 주세요.
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  // 빛이 닿는 표면의 벡터를 계산해 보세요.
  // 그런 다음 그 데이터를 프래그먼트 셰이더로 전달합니다.
  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

+  // 보기 방향에서 표면의 벡터를 계산합니다.
+  // 그런 다음 그 데이터를 프래그먼트 셰이더로 전달합니다.
+  vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;

  return vsOut;
}
```

프래그먼트 셰이더에서 표면에서 카메라로 향하는 방향과 표면에서 광원으로 향하는 방향의 중간 벡터인 `halfVector`를 구합니다. 이 벡터와 표면 법선의 내적으로 정반사에 얼마나 가까운지 알아냅니다.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // 왜냐하면, vsOut.normal은 여러 단계를 거쳐 변수가 변하는 값이기 때문입니다.
  // 이 값은 보간된 값이기 때문에, 단위 벡터가 되지 않습니다.
  // 이를 정규화하면, 다시 단위 벡터가 됩니다.
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // 점곱을 이용하여 빛을 계산합니다.
  // 정상적인 상태에서, 빛의 방향을 따라서…
  let light = dot(normal, surfaceToLightDirection);

+  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
+  let halfVector = normalize(
+    surfaceToLightDirection + surfaceToViewDirection);
+  let specular = dot(normal, halfVector);

  // 이제, 색상 부분만 곱해주면 됩니다. 알파 부분은 포함하지 않습니다.
  // 빛에 의해
-  let color = uni.color.rgb * light;
+  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

다시 한 번, viewWorldPosition에 대한 공간을 uniformBuffer에 추가했습니다.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightPositionOffset = 48;
+  const kViewWorldPositionOffset = 52;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightPositionValue = uniformValues.subarray(
      kLightPositionOffset, kLightPositionOffset + 3);
+  const viewWorldPositionValue = uniformValues.subarray(
+      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
```

그리고 그것을 설정해 주세요.

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    ...

    viewWorldPositionValue.set(eye);
```

그게 바로 그 것입니다.

{{{example url="../webgpu-lighting-point-w-specular.html" }}}

**위험해요!**

밝기를 조절하기 위해서는, dot-product 결과를 일정한 거듭제곱으로 제곱하는 방법을 사용할 수 있습니다. 이렇게 하면 반사광의 밝기는 선형 감소에서 지수적 감소로 변화하게 됩니다.

{{{diagram url="resources/power-graph.html" width="400" height="400" className="noborder" }}}

빨간선이 그래프의 상단에 가까워질수록, 우리의 반사 효과는 더욱 강해집니다. 지수를 높이면, 빨간선이 밝아지는 범위가 더 넓어집니다.

그것을 `shininess`라고 부르고, 셰이더에 추가해 보겠습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
+  shininess: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {

  ...

-  let specular = dot(normal, halfVector);
+  var specular = dot(normal, halfVector);
+  specular = select(
+      0.0,                           // 조건이 거짓일 경우의 값
+      pow(specular, uni.shininess),  // 조건이 참일 경우의 값
+      specular > 0.0);               // 조건/환경
```

dot product는 음수가 될 수도 있습니다. 음수를 거듭제곱하는 것은 WebGPU에서는 정의되지 않습니다(혹은 NaN이 되는 것일 수도 있죠). 이는 좋지 않은 상황입니다. 따라서, dot product가 음수인 경우에는 specular 값을 0.0으로 설정해 버립니다.

물론, `shininess` 값을 설정해야 합니다.

```js
  const kNormalMatrixOffset = 0;
  const kWorldViewProjectionOffset = 12;
  const kWorldOffset = 28;
  const kColorOffset = 44;
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
+  const kShininessOffset = 55;

  const normalMatrixValue = uniformValues.subarray(
      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const worldValue = uniformValues.subarray(
      kWorldOffset, kWorldOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightWorldPositionValue = uniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = uniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
+  const shininessValue = uniformValues.subarray(
+      kShininessOffset, kShininessOffset + 1);

...

  const settings = {
    rotation: degToRad(0),
+    shininess: 30,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings, 'shininess', { min: 1, max: 250 });

...

  function render() {

   ...

+    shininessValue[0] = settings.shininess;

```

그게 바로 그 것입니다.

{{{example url="../webgpu-lighting-point-w-specular-power.html" }}}

다음으로는 [스포트라이트](webgpu-lighting-spot.html)에 대해 설명하겠습니다.

<div class="webgpu_bottombar">
<h3>왜 <code>pow(negative, power)</code>는 정의되지 않았나요?</h3>
<p>이것은 무엇을 의미하는 걸까요?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 2)</pre></div>
<p>음, 그걸 그렇게 생각해도 괜찮아요.</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 = 25</pre></div>
<p>그럼 어떻게 되는 걸까요?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 3)</pre></div>
<p>음, 그걸 그렇게 생각해도 괜찮아요.</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 * 5 = 125</pre></div>
<p>음, 그렇다면 어떻게 할까요?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2)</pre></div>
<p>음, 그렇게 될 수도 있겠네요.</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 = 25</pre></div>
<p>그리고…</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 3)</pre></div>
<p>음, 그렇게 생각해도 괜찮아요.</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 * -5 = -125</pre></div>
<p>알다시피, 음수와 음수를 곱하면 양수가 됩니다. 하지만 다시 음수와 곱하면 다시 음수가 됩니다.</p>
<p>그렇다면 이건 도대체 무슨 의미일까요?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2.5)</pre></div>
<p>그 결과가 양의 값인지, 아니면 음의 값인지를 어떻게 판단할까요? 그건 <a href="https://betterexplained.com/articles/a-visual-intuitive-guide-to-imaginary-numbers/">가상수에 대한 시각적이고 직관적인 가이드</a>에서 설명해줍니다.</p>
</div>
