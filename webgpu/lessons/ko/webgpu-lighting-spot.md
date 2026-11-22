Title: WebGPU 스포트라이트
Description: WebGPU에서 스포트라이트 구현하기
TOC: 스포트라이트


이 글은 [점광원](webgpu-lighting-point.html)에 이어집니다. 아직 읽지 않았다면 먼저 읽어 보세요.

점광원에서처럼 표면의 각 점에서 광원으로 향하는 방향을 구합니다. 그런 다음 [방향광](webgpu-lighting-directional.html)에서처럼 그 방향과 표면 법선의 내적을 계산합니다. 두 단위 벡터가 같은 방향이면 1, 수직이면 0, 반대 방향이면 -1입니다. 이 값으로 표면의 색상을 조절해 조명 효과를 냅니다.

점광원 예제를 조금만 바꾸면 스포트라이트를 만들 수 있습니다. 지금까지의 예제를 바탕으로 접근법을 먼저 생각해 봐도 좋습니다.

점광원은 모든 방향으로 빛을 내보냅니다. 스포트라이트를 만들려면 그중 한 방향을 중심축으로 정하고, 중심축과 이루는 각도가 일정한 범위 안에 있는 곳만 비춥니다. 각도가 범위 안에 있는지는 방향 벡터의 내적으로 확인할 수 있습니다.

{{{diagram url="resources/spot-lighting.html" width="700" height="400" className="noborder" }}}

그림에는 광원에서 여러 방향으로 뻗는 빛과 각 방향의 내적 값이 표시되어 있습니다. 스포트라이트가 향하는 **방향**과 빛을 비출 최대 각도를 정한 뒤, 그 각도를 *내적의 기준값*으로 바꿉니다. 두 방향의 내적이 기준값 이상인 곳에만 조명을 적용합니다.

다시 말해, 그 한계값이 20도라고 가정해 봅시다. 이 값을 라디안으로 변환할 수 있으며, 그 다음으로 코사인 함수를 사용하여 -1에서 1 사이의 값을 얻을 수 있습니다. 그 값을 ‘dot space’라고 부릅니다. 즉, 이곳에는 한계값에 대한 간단한 표가 있습니다.

              limits in
     degrees | radians | dot space
     --------+---------+----------
        0    |   0.0   |    1.0
        22   |    .38  |     .93
        45   |    .79  |     .71
        67   |   1.17  |     .39
        90   |   1.57  |    0.0
       180   |   3.14  |   -1.0

그렇다면, 우리는 그냥 확인해볼 수 있습니다.

    dotFromDirection = dot(surfaceToLight, -lightDirection)
    if (dotFromDirection >= limitInDotSpace) {
       // 조명을 설치해 주세요.
    }

그렇게 하도록 합시다.

먼저, [점광원](webgpu-lighting-point.html)에서 작성한 프래그먼트 셰이더를 수정해 보겠습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
+  lightDirection: vec3f,
+  limit: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // 왜냐하면, vsOut.normal은 여러 단계를 거쳐 변수가 변하는 값이기 때문입니다.
  // 이 값은 보간된 값이기 때문에, 단위 벡터가 되지 않습니다.
  // 이를 정규화하면, 다시 단위 벡터가 됩니다.
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);


+  var light = 0.0;
+  var specular = 0.0;
+
+  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
+  if (dotFromDirection > uni.limit) {
    // 점곱을 이용하여 빛을 계산합니다.
    // 정상적인 상태에서, 빛의 방향을 따라서…
-    let light = dot(normal, surfaceToLightDirection);
+    light = dot(normal, surfaceToLightDirection);

    specular = dot(normal, halfVector);
    specular = select(
        0.0,                           // 조건이 거짓일 경우의 값
        pow(specular, uni.shininess),  // 조건이 참일 경우의 값
        specular > 0.0);               // 조건/환경
+  }

  // 이제, 색상 부분만 곱해주면 됩니다. 알파 부분은 포함하지 않습니다.
  // 빛에 의해
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

물론, 새로운 값들을 저장하기 위해 유니폼 버퍼에 공간을 추가해야 합니다.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
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
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
+  const kLightDirectionOffset = 56;
+  const kLimitOffset = 59;

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
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
+  const lightDirectionValue = uniformValues.subarray(
+      kLightDirectionOffset, kLightDirectionOffset + 3);
+  const limitValue = uniformValues.subarray(
+      kLimitOffset, kLimitOffset + 1);
```

그리고 우리는 그들을 설정해야 합니다.

```js
    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
+    limitValue[0] = Math.cos(settings.limit);

    // 대부분의 스포트라이트 예시와는 달리, 우리에게는 그런 비행기가 없습니다.
    // 그럼, 빛을 F 쪽으로 비추도록 합시다.
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // 행렬에서 z축 값을 얻는 방법
        // 그것을 부정해야 합니다. 왜냐하면 lookAt 함수는 -Z 축을 따라 시각화를 수행하기 때문입니다.
        lightDirectionValue.set(mat.slice(8, 11));
    }
```

위에서 우리는 `mat4.aim`를 사용하고 있습니다. 이에 대해서는 [카메라](webgpu-cameras.html)에서 다뤘습니다. 구체적으로 말하자면, 우리의 F는 `target`입니다. 스포트라이트는 `-10, 30, 100` 위에 위치합니다. 스포트라이트를 쉽게 조준할 수 있도록 대상에 일정한 오프셋을 추가합니다. 그런 다음, 조준점이 가리키는 방향이 바로 *z 축*이기 때문에, 그 축만을 사용합니다.

단지, 몇 가지 UI 코드를 추가하기만 하면 됩니다.

```
  const settings = {
    rotation: degToRad(0),
    shininess: 30,
+    limit: degToRad(15),
+    aimOffsetX: -10,
+    aimOffsetY: 10,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
  gui.add(settings, 'shininess', { min: 1, max: 250 });
+  gui.add(settings, 'limit', limitOptions);
+  gui.add(settings, 'aimOffsetX', -50, 50);
+  gui.add(settings, 'aimOffsetY', -50, 50);
```

그래, 여기 있습니다.

{{{example url="../webgpu-lighting-spot.html" }}}

주의할 점은, 셰이더에서 `uni.lightDirection`를 반전시키는 것입니다. 그건 [*하나는 하나로, 다른 하나는 반으로*](https://en.wiktionary.org/wiki/six_of_one,_half_a_dozen_of_the_other)와 같은 종류의 것입니다. 우리가 비교하는 두 방향이 일치할 때는 같은 방향으로 가야 합니다. 그러므로 surfaceToLightDirection을 스포트라이트 방향의 반대 방향과 비교해야 합니다.

지금은 주목을 받는 상황이 너무 심각합니다. 우리는 주목을 받고 있는 상태이거나, 그렇지 않은 경우도 있습니다. 그리고 그런 상황에서는 모든 것이 어둡게 변합니다.

이 문제를 해결하기 위해, 하나가 아닌 두 개의 한계를 사용할 수 있습니다. 즉, 내부 한계와 외부 한계가 있습니다. 만약 우리가 내부 한계 내에 있다면, 1.0을 사용합니다. 반대로, 외부 한계 밖에 있다면, 0.0을 사용합니다. 그리고 내부 한계와 외부 한계 사이에 있다면, 1.0과 0.0 사이의 값을 반영합니다.

이것을 해낼 수 있는 방법이 하나 있습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
-  limit: f32,
+  innerLimit: f32,
+  outerLimit: f32,
};

...

-  var light = 0.0;
-  var specular = 0.0;
-
-  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-  if (dotFromDirection > uni.limit) {
-    // 점곱을 이용하여 빛을 계산합니다.
-    // 정상적인 상태에서, 빛의 방향을 따라서…
-    light = dot(normal, surfaceToLightDirection);
-    specular = dot(normal, halfVector);
-    specular = select(
-        0.0,                           // 조건이 거짓일 경우의 값
-        pow(specular, uni.shininess),  // 조건이 참일 경우의 값
-        specular > 0.0);               // 조건/환경
-  }

    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
    let limitRange = uni.innerLimit - uni.outerLimit;
    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);

    // 점곱을 이용하여 빛을 계산합니다.
    // 정상적인 상태에서, 빛의 방향을 따라서…
    let light = inLight * dot(normal, surfaceToLightDirection);

    var specular = dot(normal, halfVector);
    specular = inLight * select(
        0.0,                           // 조건이 거짓일 경우의 값
        pow(specular, uni.shininess),  // 조건이 참일 경우의 값
        specular > 0.0);               // 조건/환경

```

`saturate`를 사용합니다. Saturate 함수는 값을 0과 1 사이로 조절합니다. 즉, `outerLimit`의 범위 밖에 있으면 `inLight`은 0이 되고, `innerLimit`의 범위 안에 있으면 1이 됩니다. 그리고, 그 두 한계 사이에서는 0과 1 사이의 값이 됩니다. 그런 다음, 빛과 반사 계산 결과를 `inLight`로 곱합니다.

다시 한 번, 우리의 유니폼 버퍼 설정을 업데이트해야 합니다.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4 + 4) * 4;
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
  const kLightWorldPositionOffset = 48;
  const kViewWorldPositionOffset = 52;
  const kShininessOffset = 55;
  const kLightDirectionOffset = 56;
-  const kLimitOffset = 59;
+  const kInnerLimitOffset = 59;
+  const kOuterLimitOffset = 60;

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
  const shininessValue = uniformValues.subarray(
      kShininessOffset, kShininessOffset + 1);
  const lightDirectionValue = uniformValues.subarray(
      kLightDirectionOffset, kLightDirectionOffset + 3);
-  const limitValue = uniformValues.subarray(
-      kLimitOffset, kLimitOffset + 1);
+  const innerLimitValue = uniformValues.subarray(
+      kInnerLimitOffset, kInnerLimitOffset + 1);
+  const outerLimitValue = uniformValues.subarray(
+      kOuterLimitOffset, kOuterLimitOffset + 1);
```

그리고 우리는 그들을 어디에 배치할까요?

```js
  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
  gui.add(settings, 'shininess', { min: 1, max: 250 });
-  gui.add(settings, 'limit', limitOptions);
+  GUI.makeMinMaxPair(gui, settings, 'innerLimit', 'outerLimit', limitOptions);
  gui.add(settings, 'aimOffsetX', -50, 50);
  gui.add(settings, 'aimOffsetY', -50, 50);

  ...

  function render() {

    ...

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
-    limitValue[0] = Math.cos(settings.limit);
+    innerLimitValue[0] = Math.cos(settings.innerLimit);
+   outerLimitValue[0] = Math.cos(settings.outerLimit);

    ...
```

그리고 그 방법은 효과가 있습니다.

{{{example url="../webgpu-lighting-spot-w-linear-falloff.html" }}}

이제, 이건 마치 스포트라이트처럼 보이는군요!

주의해야 할 점은, `innerLimit`이 `outerLimit`과 같다면 `limitRange`는 0.0이 됩니다. 이 경우 `limitRange`로 나누는 것은 잘못된 작업이며, 0으로 나누는 것은 undefined 상태가 됩니다. 여기서는 셰이더 내부에서 이를 처리할 필요가 없습니다. JavaScript에서 `innerLimit`이 결코 `outerLimit`과 같지 않도록 해야 합니다. 이 경우, GUI가 이를 자동으로 처리해줍니다.

WGSL에는 이 문제를 약간 간단하게 해결할 수 있는 함수가 있습니다. 그 함수의 이름은 `smoothstep`입니다. 이 함수는 0에서 1 사이의 값을 반환합니다. 하지만 이 함수는 낮은 경계값과 높은 경계값을 모두 받으며, 그 두 경계값 사이에서 0에서 1 사이의 값을 보간합니다.

```wgsl
     smoothstep(lowerBound, upperBound, value)
```

그렇게 하도록 합시다.

```wgsl
    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-    let limitRange = uni.innerLimit - uni.outerLimit;
-    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);
+    let inLight = smoothStep(uni.outerLimit, uni.innerLimit, dotFromDirection);
```

그 방법도 괜찮습니다.

{{{example url="../webgpu-lighting-spot-w-smoothstep-falloff.html" }}}

차이점은 `smoothstep`에서는 선형 보간법 대신 *헤르미테 보간법*을 사용한다는 것입니다. 즉, `lowerBound`와 `upperBound` 사이의 값은 아래 오른쪽 그림과 같은 방식으로 보간됩니다. 반면 선형 보간법의 경우는 왼쪽 그림과 같은 방식으로 보간됩니다.

<img class="webgpu_center invertdark" src="resources/linear-vs-hermite.png" />

그 차이가 중요하다고 생각하는지는, 당신에게 달려 있습니다.

또 한 가지 주의해야 할 점은, `lowerBound`가 `upperBound`와 같거나 더 큰 경우, `smoothstep` 함수는 정의되지 않는 결과를 반환합니다. 이는 위에서도 언급한 문제와 동일합니다. 또한, `lowerBound`가 `upperBound`보다 큰 경우에도 정의되지 않는다는 점이 새로운 문제입니다. 하지만 이는 결코 일어나서는 안 되는 상황입니다.
