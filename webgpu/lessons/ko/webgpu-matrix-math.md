Title: WebGPU 행렬 연산
Description: 행렬 연산으로 변환 간소화하기
TOC: 행렬 연산

이 글은 3D 수학에 대해 배우는 데 도움이 될 만한 글들의 4번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

지난 3개의 게시물에서, 우리는 [이동](webgpu-translation.html), [회전](webgpu-rotation.html), [크기 조절](webgpu-scale.html)을 어떻게 수행하는지 살펴보았습니다. 이동, 회전, 크기 조절은 각각 *변형*의 한 종류로 간주됩니다. 이러한 변형 각각에는 셰이더에 변화를 주어야 하며, 세 가지 변형 모두 순서에 따라 이루어집니다.

[크기 조절](webgpu-scale.html) 예제에서는 우리는 먼저 크기를 조정하고, 그 다음으로 회전시키고, 마지막으로 이동시켰습니다. 만약 이러한 과정을 다른 순서로 적용한다면, 다른 결과가 나올 것입니다.

예를 들어, 2, 1이라는 스케일이 있고, 회전은 30도이며, 이동은 100, 0입니다.

<img src="resources/f-scale-rotation-translation.svg" class="webgpu_center" width="400" />

여기에는 100.0, 30도의 회전, 그리고 2, 1의 스케일이 적용된 값이 있습니다.

<img src="resources/f-translation-rotation-scale.svg" class="webgpu_center" width="400" />

결과는 완전히 달랍니다. 더욱 심각한 것은, 만약 두 번째 예시가 필요하다면, 변환, 회전, 크기 조절 등을 원하는 순서대로 적용할 수 있는 새로운 셰이더를 작성해야 한다는 점입니다.

음, 몇몇 똑똑한 사람들이, 행렬 계산을 이용해서도 모든 작업을 수행할 수 있는 방법을 찾아냈습니다. 2D 경우에는 3x3 행렬을 사용합니다. 3x3 행렬이란, 9개의 칸으로 구성된 격자 모양의 구조와 같습니다.

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">4</td>
      <td class="m13">7</td>
    </tr>
    <tr>
      <td class="m21">2</td>
      <td class="m22">5</td>
      <td class="m23">8</td>
    </tr>
    <tr>
      <td class="m31">3</td>
      <td class="m32">6</td>
      <td class="m33">9</td>
    </tr>
  </table>
</div>

계산을 하려면, 행렬의 각 행에 있는 위치를 곱한 다음, 그 결과들을 모두 더해야 합니다.

<div class="webgpu_center"><img src="resources/matrix-vector-math.svg" class="noinvertdark" style="width: 1000px;"></div>

우리의 좌표는 x와 y라는 두 개의 값만을 가집니다. 하지만 이런 계산을 하려면 세 개의 값이 필요하므로, 세 번째 값은 1로 대체하겠습니다.

이 경우, 우리의 결과는 다음과 같을 것입니다.

<div class="glocal-center">
  <p>newX = x * <span class="m11">1</span> + y * <span class="m12">4</span> + 1 * <span class="m13">7</span></p>
  <p>newY = x * <span class="m21">2</span> + y * <span class="m22">5</span> + 1 * <span class="m23">8</span></p>
  <p>newZ = x * <span class="m31">3</span> + y * <span class="m32">6</span> + 1 * <span class="m33">9</span></p>
</div>

아마도 여러분은 그걸 보고 “도대체 무슨 의미가 있는 거야?”라고 생각하고 있을 것입니다. 자, 그렇다면 X축과 Y축으로 이동할 값을 각각 tx와 ty라고 하겠습니다. 이제 이런 형태의 행렬을 만들어보겠습니다.

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">0</td>
      <td class="m13">tx</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">1</td>
      <td class="m23">ty</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

이제 그걸 확인해 보세요.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">1</span> + y * <span class="m12">0</span> + 1 * <span class="m13">tx</span></div>
    <div>newY = x * <span class="m21">0</span> + y * <span class="m22">1</span> + 1 * <span class="m23">ty</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

만약 당신이 대수학을 기억한다면, 0으로 곱하는 부분을 삭제할 수 있습니다. 1으로 곱하는 것은 사실 아무런 효과가 없으므로, 무슨 일이 일어나는지 간단히 확인해보도록 합시다.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x <div class="blk">* <span class="m11">1</span></div> + <div class="blk">y * <span class="m12">0</span> + 1 * </div><span class="m13">tx</span></div>
    <div>newY = <div class="blk">x * <span class="m21">0</span> +</div> y <div class="blk">* <span class="m22">1</span></div> + <div class="blk">1 * </div><span class="m23">고마워요</span></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

혹은 더 간결하게 표현하면…

<div class="webgpu_center"><pre class="webgpu_math">
newX = x + tx;
newY = y + ty;
</pre></div>

그리고 새로운 것들에 대해서는, 우리는 사실 전혀 관심이 없습니다.

위 식은 [이동](webgpu-translation.html) 예제에서 사용한 계산과 비슷합니다.

마찬가지로, 회전도 마찬가지입니다. 앞서 회전에 관한 글에서도 언급했듯이, 회전할 각도에 대한 사인과 코사인만 알면 됩니다.

<div class="webgpu_center"><pre class="webgpu_math">
s = Math.sin(angleToRotateInRadians);
c = Math.cos(angleToRotateInRadians);
</pre></div>

그리고 우리는 이와 같은 행렬을 만듭니다.

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">c</td>
      <td class="m12">-s</td>
      <td class="m13">0</td>
    </tr>
    <tr>
      <td class="m21">s</td>
      <td class="m22">c</td>
      <td class="m23">0</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

행렬을 적용하면 다음과 같은 결과가 나옵니다.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">c</span> + y * <span class="m12">-s</span> + 1 * <span class="m13">0</span></div>
    <div>newY = x * <span class="m21">s</span> + y * <span class="m22">c</span> + 1 * <span class="m23">0</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

모든 숫자에 0과 1을 곱하면 다음과 같은 결과가 나옵니다.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">c</span> + y * <span class="m12">-s</span><div class="blk"> + 1 * <span class="m13">0</span></div></div>
    <div>newY = x * <span class="m21">s</span> + y * <span class="m22">c</span><div class="blk"> + 1 * <span class="m23">0</span></div></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

그리고 간단히 하면, 우리는 다음과 같은 결과를 얻습니다.

<div class="webgpu_center">
<pre class="webgpu_math">
newX = x * c - y * s;
newY = x * s + y * c;
</pre>
</div>

그것이 바로 우리가 [회전 예시](webgpu-rotation.html)에서 보았던 내용입니다.

마지막으로, 스케일에 대해서 말하자면, 우리는 두 개의 스케일 요소를 각각 sx과 sy라고 부를 것입니다.

그리고 우리는 이와 같은 행렬을 만듭니다.

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">sx</td>
      <td class="m12">0</td>
      <td class="m13">0</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">sy</td>
      <td class="m23">0</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

행렬을 적용하면 다음과 같은 결과가 나옵니다.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">sx</span> + y * <span class="m12">0</span> + 1 * <span class="m13">0</span></div>
    <div>newY = x * <span class="m21">0</span> + y * <span class="m22">sy</span> + 1 * <span class="m23">0</span></div>
    <div>newZ = x * <span class="m31">0</span> + y * <span class="m32">0</span> + 1 * <span class="m33">1</span></div>
  </div>
</div>

그건 사실입니다.

<div class="glocal-center">
  <div class="eq">
    <div>newX = x * <span class="m11">sx</span><div class="blk"> + y * <span class="m12">0</span> + 1 * <span class="m13">0</span></div></div>
    <div>newY = <div class="blk">x * <span class="m21">0</span> +</div> y * <span class="m22">sy</span><div class="blk"> + 1 * <span class="m23">0</span></div></div>
    <div>newZ = <div class="blk">x * <span class="m31">0</span> + y * <span class="m32">0</span> +</div> 1 <div class="blk">* <span class="m33">1</span></div></div>
  </div>
</div>

간단하게 말하자면…

<div class="webgpu_center">
<pre class="webgpu_math">
newX = x * sx;
newY = y * sy;
</pre>
</div>

[크기 조절](webgpu-scale.html) 예제에서 사용한 계산과 같습니다.

분명히, 여러분은 여전히 “그래서 뭐가 문제야? 그게 무슨 의미가 있나?”라고 생각할지도 모릅니다. 이미 하고 있던 일을 반복하는 것만으로도 충분한 노력이 필요한 것 같습니다.

이때가 바로 마법이 작용하는 순간입니다. 사실, 우리는 행렬들을 곱해주고, 그 결과를 얻을 수 있습니다. `mat3.multiply`라는 함수가 있다고 가정해 봅시다. 이 함수는 두 개의 행렬을 곱한 후 그 결과를 반환합니다.

```js
const mat3 = {
  multiply: function(a, b) {
    const a00 = a[0 * 3 + 0];
    const a01 = a[0 * 3 + 1];
    const a02 = a[0 * 3 + 2];
    const a10 = a[1 * 3 + 0];
    const a11 = a[1 * 3 + 1];
    const a12 = a[1 * 3 + 2];
    const a20 = a[2 * 3 + 0];
    const a21 = a[2 * 3 + 1];
    const a22 = a[2 * 3 + 2];
    const b00 = b[0 * 3 + 0];
    const b01 = b[0 * 3 + 1];
    const b02 = b[0 * 3 + 2];
    const b10 = b[1 * 3 + 0];
    const b11 = b[1 * 3 + 1];
    const b12 = b[1 * 3 + 2];
    const b20 = b[2 * 3 + 0];
    const b21 = b[2 * 3 + 1];
    const b22 = b[2 * 3 + 2];

    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
    ];
  }
}
```

더 명확하게 설명하기 위해, 이동, 회전, 크기 조절에 쓰는 행렬을 생성하는 함수들을 만들어보겠습니다.

```js
const mat3 = {
  multiply(a, b) {
    ...
  },
  translation([tx, ty]) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },

  rotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, s, 0,
      -s, c, 0,
      0, 0, 1,
    ];
  },

  scaling([sx, sy]) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ];
  },
};
```

이제, 셰이더를 변경해서 행렬을 사용하도록 해 보겠습니다.

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
-  translation: vec2f,
-  rotation: vec2f,
-  scale: vec2f,
+  matrix: mat3x3f,
};

...

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

-  // 위치를 조정해 주세요.
-  let scaledPosition = vert.position * uni.scale;
-
-  // 위치를 회전시킵니다.
-  let rotatedPosition = vec2f(
-    scaledPosition.x * uni.rotation.x - scaledPosition.y * uni.rotation.y,
-    scaledPosition.x * uni.rotation.y + scaledPosition.y * uni.rotation.x
-  );
-
-  // 이동 값을 더합니다.
-  let position = rotatedPosition + uni.translation;
+  // 행렬을 곱하는 것
+  let position = (uni.matrix * vec3f(vert.position, 1)).xy;

  ...
```

위에서 볼 수 있듯이, 우리는 z에 1을 대입했습니다. 그런 다음, 해당 위치를 행렬과 곱했습니다. 그 후에는 결과에서 x와 y만을 남겨두었습니다.

다시 한 번, 우리의 유니폼 버퍼의 크기와 오프셋을 업데이트해야 합니다.

```js
-  // 색상, 해상도, 이동, 회전, 크기 조절
-  const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
+  // 색상, 해상도, 패딩, 행렬
+  const uniformBufferSize = (4 + 2 + 2 + 12) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kColorOffset = 0;
  const kResolutionOffset = 4;
  const kMatrixOffset = 8;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
-  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
-  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
-  const scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);
+  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);
```

마지막으로, 렌더링 시에는 일종의 *행렬 계산*을 해야 합니다.

```js
  function render() {
    ...
+    const translationMatrix = mat3.translation(settings.translation);
+    const rotationMatrix = mat3.rotation(settings.rotation);
+    const scaleMatrix = mat3.scaling(settings.scale);
+
+    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, scaleMatrix);

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
-    translationValue.set(settings.translation);
-    rotationValue.set([
-        Math.cos(settings.rotation),
-        Math.sin(settings.rotation),
-    ]);
-    scaleValue.set(settings.scale);
+    matrixValue.set([
+      ...matrix.slice(0, 3), 0,
+      ...matrix.slice(3, 6), 0,
+      ...matrix.slice(6, 9), 0,
+    ]);
```

이것이 바로 우리의 새로운 코드를 사용한 결과입니다. 슬라이더들의 기능은 동일합니다. 즉, 텍스처의 변환, 회전, 크기 조절 등이 가능합니다. 하지만 셰이더에서 이 기능들을 사용하는 방식은 훨씬 더 간단해졌습니다.

{{{example url="../webgpu-matrix-math-transform-trs-3x3.html"}}}

## <a id="a-columns-are-rows"></a> 행렬을 열 우선으로 저장하기

행렬이 어떻게 작동하는지 설명할 때, 우리는 열과 곱하는 방법에 대해 이야기했습니다. 예를 들어, 이 행렬을 변환 행렬의 예로 보여주었습니다.

<div class="glocal-center">
  <table class="glocal-center-content glocal-mat">
    <tr>
      <td class="m11">1</td>
      <td class="m12">0</td>
      <td class="m13">tx</td>
    </tr>
    <tr>
      <td class="m21">0</td>
      <td class="m22">1</td>
      <td class="m23">ty</td>
    </tr>
    <tr>
      <td class="m31">0</td>
      <td class="m32">0</td>
      <td class="m33">1</td>
    </tr>
  </table>
</div>

하지만, 실제로 코드를 사용하여 그 행렬을 구현했을 때는 이런 방식을 사용했습니다.

```js
  translation([tx, ty]) {
    return [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1,
    ];
  },
```

`tx, ty, 1`이라는 부분은 맨 아래 행에 위치해 있으며, 마지막 열에는 없습니다.

```js
  translation([tx, ty]) {
    return [
      1, 0, 0,   // <-- 1st column
      0, 1, 0,   // <-- 2nd column
      tx, ty, 1, // <-- 3rd column
    ];
  },
```


일부 그래픽 전문가들은 이러한 행들을 별도의 열로 분류합니다. 안타깝게도, 이런 방식에 익숙해지는 것은 어렵습니다. 수학 서적이나 인터넷상의 수학 관련 글들을 보면, 위와 같은 행렬들이 표시되는데, 여기서 `tx, ty, 1`은 마지막 열에 위치합니다. 하지만 코드로 표현할 때는, 적어도 WebGPU의 경우에는 위와 같이 지정해야 합니다.

## 행렬 연산의 유연성

하지만, 그렇다면 그게 무슨 소용이 있을까요? 별로 큰 이점이 없는 것 같습니다. 하지만 이제는, 연산 순서를 변경하고 싶다면, 새로운 셰이더를 작성할 필요가 없습니다. 그냥 JavaScript 내의 수학적 계산 방식을 변경하기만 하면 됩니다.

```js
-    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
-    matrix = mat3.multiply(matrix, scaleMatrix);
+    let matrix = mat3.multiply(scaleMatrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, translationMatrix);
```

위에서 우리는 변환 과정을 translation → rotation → scale 순으로 진행하는 방식에서, scale → rotation → translation 순으로 진행하는 방식으로 변경했습니다.

{{{example url="../webgpu-matrix-math-transform-srt-3x3.html"}}}

슬라이더를 조절해보면, 이제 우리가 행렬을 구성하는 순서가 달라진다는 것을 알 수 있습니다. 예를 들어, 변환은 회전이 일어난 후에 이루어집니다.

<div class="webgpu_center compare" style="justify-content: space-evenly;">
  <div style="flex: 0 0 auto;">
    <div>이동 → 회전 → 크기 조절</div>
    <div><div data-diagram="trs"></div></div>
  </div>
  <div style="flex: 0 0 auto;">
    <div>스케일 → 회전 → 이동</div>
    <div><div data-diagram="srt"></div></div>
  </div>
</div>

왼쪽에 있는 것은, 크기가 조정되고 회전된 형태의 ‘F’ 모양으로 볼 수 있습니다. 또한, 왼쪽으로 이동된 상태에서도 그 모양이 회전되고 크기가 조정된 상태입니다. 이동 방향은 왼쪽과 오른쪽이 아니라 대각선 방향입니다. 오른쪽에 있는 ‘F’는 이동된 후에도 거의 움직이지 않습니다. 왜냐하면 이동 자체가 크기가 조정된 상태이기 때문입니다.

이러한 유연성 때문에, 행렬 계산은 거의 모든 컴퓨터 그래픽스에서 필수적인 요소가 되었습니다.

이와 같은 행렬을 사용할 수 있다는 것은, 특히 몸의 팔과 다리와 같은 하위 요소들을 애니메이션화하는 경우에 매우 중요합니다. 또한, 행성 주위를 도는 달이나, 나무의 가지와 같은 구조도 마찬가지입니다. 간단한 예로, ‘F’ 기호를 다섯 번 그려보겠습니다. 하지만 매번 이전 ‘F’ 기호에서 시작하는 행렬을 사용해야 합니다.

이를 위해서는 5개의 동일한 버퍼, 5개의 동일한 값, 그리고 5개의 bindGroup이 필요합니다.

```js
+  const numObjects = 5;
+  const objectInfos = [];
+  for (let i = 0; i < numObjects; ++i) {
    // 색상, 해상도, 패딩, 행렬
    const uniformBufferSize = (4 + 2 + 2 + 12) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
    const kColorOffset = 0;
    const kResolutionOffset = 4;
    const kMatrixOffset = 8;

    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
    const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);

    // 색상은 변하지 않으므로, 초기화 시에 한 번만 설정해두면 됩니다.
    colorValue.set([Math.random(), Math.random(), Math.random(), 1]);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: uniformBuffer },
      ],
    });

+    objectInfos.push({
+      uniformBuffer,
+      uniformValues,
+      resolutionValue,
+      matrixValue,
+      bindGroup,
+    });
+  }
```

렌더링 시에는 이러한 요소들을 하나하나 살펴보고, 이전의 행렬에 전송, 회전, 크기 조절 관련 행렬들을 곱해줍니다.

```js
function render() {
  ...

  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(translationMatrix, rotationMatrix);
-  matrix = mat3.multiply(matrix, scaleMatrix);

+  // 시작 행렬.
+  let matrix = mat3.identity();
+
+  for (const {
+    uniformBuffer,
+    uniformValues,
+    resolutionValue,
+    matrixValue,
+    bindGroup,
+  } of objectInfos) {
+    matrix = mat3.multiply(matrix, translationMatrix)
+    matrix = mat3.multiply(matrix, rotationMatrix);
+    matrix = mat3.multiply(matrix, scaleMatrix);

    // JavaScript 측 Float32Array에 유니폼 값을 설정합니다
    resolutionValue.set([canvas.width, canvas.height]);
    matrixValue.set([
      ...matrix.slice(0, 3), 0,
      ...matrix.slice(3, 6), 0,
      ...matrix.slice(6, 9), 0,
    ]);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(numVertices);
+  }

  pass.end();
```

`mat3.identity`는 항등 행렬을 만듭니다. 수에 1을 곱해도 값이 그대로이듯이, 행렬에 항등 행렬을 곱해도 결과는 바뀌지 않습니다.

<div class="webgpu_center"><div class="webgpu_math">X * 1 = X</div></div>

그렇게도요.

<div class="webgpu_center"><div class="webgpu_math">matrixX * identity = matrixX</div></div>

다음은 식별 행렬을 생성하는 코드입니다.

```js
const mat3 = {
  ...
  identity() {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
  },

  ...
```

여기 5개의 ‘F’가 있습니다.

{{{example url="../webgpu-matrix-math-transform-five-fs-3x3.html"}}}

슬라이더를 움직여서, 각각의 ‘F’가 이전의 ‘F’들과 비교했을 때 어떻게 그려지는지 확인해 보세요. 이와 같은 방식으로, CG 인간의 팔도 작동합니다. 팔의 회전은 팔뚝에 영향을 미치고, 팔뚝의 회전은 손에 영향을 미치며, 손의 회전은 손가락에 영향을 미칩니다.

## 회전 중심을 변경하거나 크기를 조정하기

한 가지 더 예를 들어보겠습니다. 지금까지의 모든 예시에서, ‘F’는 그 왼쪽 상단 모서리를 중심으로 회전했습니다. 물론, 위에서 순서를 바꾼 경우는 예외입니다. 이는 우리가 사용하는 수학적 계산 방식상, 항상 원점을 중심으로 ‘F’가 회전하기 때문입니다. 그리고 ‘F’의 왼쪽 상단 모서리는 바로 원점인 (0, 0)에 위치합니다.

하지만 이제는 행렬 연산을 사용할 수 있으므로, 변환이 적용되는 순서를 선택할 수 있습니다. 그러므로 원점을 원하는 위치로 이동시킬 수 있습니다.

```js
    const translationMatrix = mat3.translation(settings.translation);
    const rotationMatrix = mat3.rotation(settings.rotation);
    const scaleMatrix = mat3.scaling(settings.scale);
+    // ‘F’ 기호의 원점을 그 중심으로 이동시키는 행렬을 만들어보세요.
+    const moveOriginMatrix = mat3.translation([-50, -75]);

    let matrix = mat3.multiply(translationMatrix, rotationMatrix);
    matrix = mat3.multiply(matrix, scaleMatrix);
+    matrix = mat3.multiply(matrix, moveOriginMatrix);
```

F를 X축으로 -50, Y축으로 -75만큼 이동해 F의 중심이 원점 (0, 0)에 오게 했습니다. 슬라이더를 움직이면 F가 중심을 기준으로 회전하고 크기가 바뀝니다.

{{{example url="../webgpu-matrix-math-transform-move-origin-3x3.html" }}}

이 기술을 사용하면, 어느 위치에서든 이미지를 회전하거나 크기를 조절할 수 있습니다. 이제, 여러분이 선호하는 이미지 편집 프로그램이 회전점을 이동시키는 방법을 알게 되었습니다.

## 프로젝션을 추가하는 것

더욱 엉뚱한 방법을 시도해 봅시다. 셰이더 내부에는 픽셀을 클립 공간으로 변환하는 코드가 있습니다. 그 코드는 다음과 같은 형태를 가지고 있습니다.

```wgsl
// 위치 값을 픽셀 단위에서 0.0에서 1.0 사이의 값으로 변환합니다.
let zeroToOne = position / uni.resolution;

// 0 <-> 1에서 0 <-> 2로 변환하기
let zeroToTwo = zeroToOne * 2.0;

// 0 <-> 2에서 -1 <-> +1으로 변환됨 (클립 공간)
let flippedClipSpace = zeroToTwo - 1.0;

// 플립 Y
let clipSpace = flippedClipSpace * vec2f(1, -1);

vsOut.position = vec4f(clipSpace, 0.0, 1.0);
```

만약 그 각 단계들을 하나씩 살펴본다면…

첫 번째 단계인 “위치 값을 0.0에서 1.0 사이의 값으로 변환하는 것”은 사실상 크기 조절 작업입니다. `zeroToOne = position / uni.resolution`과 `zeroToOne = position * (1 / uni.resolution)`은 같은 의미입니다. 이는 곧 크기 조절 작업이라고 할 수 있습니다.

두 번째 단계인 `let zeroToTwo = zeroToOne * 2.0;`도 역시 크기 조절 연산입니다. 이는 값을 2배로 늘리는 작업입니다.

3번째 단계에서, `flippedClipSpace = zeroToTwo - 1.0;`는 이동입니다.

4번째 단계인 `clipSpace = flippedClipSpace * vec2f(1, -1);`는 크기 조절 과정입니다.

그러므로, 이를 우리의 수학 계산에 추가할 수 있습니다.

```js
+  const scaleBy1OverResolutionMatrix = mat3.scaling([1 / canvas.width, 1 / canvas.height]);
+  const scaleBy2Matrix = mat3.scaling([2, 2]);
+  const translateByMinus1 = mat3.translation([-1, -1]);
+  const scaleBy1Minus1 = mat3.scaling([1, -1]);

  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(translationMatrix, rotationMatrix);
+  let matrix = mat3.multiply(scaleBy1Minus1, translateByMinus1);
+  matrix = mat3.multiply(matrix, scaleBy2Matrix);
+  matrix = mat3.multiply(matrix, scaleBy1OverResolutionMatrix);
+  matrix = mat3.multiply(matrix, translationMatrix);
+  matrix = mat3.multiply(matrix, rotationMatrix);
  matrix = mat3.multiply(matrix, scaleMatrix);
```

그렇게 되면, 우리의 셰이더도 이렇게 변할 것입니다.

```wgsl
struct Uniforms {
  color: vec4f,
-  resolution: vec2f,
  matrix: mat3x3f,
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

-  let position = (uni.matrix * vec3f(vert.position, 1)).xy;
-
-  // 위치 값을 픽셀 단위에서 0.0에서 1.0 사이의 값으로 변환합니다.
-  let zeroToOne = position / uni.resolution;
-
-  // 0 <-> 1에서 0 <-> 2로 변환하기
-  let zeroToTwo = zeroToOne * 2.0;
-
-  // 0 <-> 2에서 -1 <-> +1으로 변환됨 (클립 공간)
-  let flippedClipSpace = zeroToTwo - 1.0;
-
-  // 플립 Y
-  let clipSpace = flippedClipSpace * vec2f(1, -1);
-
-  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
+  let clipSpace = (uni.matrix * vec3f(vert.position, 1)).xy;
+
+  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

이제 우리의 셰이더는 매우 간단해졌고, 기능적인 면에서도 손해가 없습니다. 사실, 이제는 더욱 유연해졌습니다! 이제 우리는 더 이상 픽셀을 고정된 방식으로 표현할 필요가 없습니다. 셰이더 외부에서 다른 단위를 선택할 수도 있습니다. 이 모든 것은 마스크 계산을 사용하기 때문입니다.

하지만, 그 4개의 추가적인 행렬을 만들 필요는 없습니다. 그냥 동일한 결과를 생성할 수 있는 함수를 만들면 됩니다.

```js
const mat3 = {
  projection(width, height) {
    // 참고: 이 행렬은 Y축을 반전시킴으로써, 0이 맨 위에 위치하게 됩니다.
    return [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1,
    ];
  },

  ...
```

그리고 우리의 JavaScript 코드는 이렇게 변경됩니다.

```js
-  const scaleBy1OverResolutionMatrix = mat3.scaling([1 / canvas.width, 1 / canvas.height]);
-  const scaleBy2Matrix = mat3.scaling([2, 2]);
-  const translateByMinus1 = mat3.translation([-1, -1]);
-  const scaleBy1Minus1 = mat3.scaling([1, -1]);
  const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
  const translationMatrix = mat3.translation(settings.translation);
  const rotationMatrix = mat3.rotation(settings.rotation);
  const scaleMatrix = mat3.scaling(settings.scale);

-  let matrix = mat3.multiply(scaleBy1Minus1, translateByMinus1);
-  matrix = mat3.multiply(matrix, scaleBy2Matrix);
-  matrix = mat3.multiply(matrix, scaleBy1OverResolutionMatrix);
-  matrix = mat3.multiply(matrix, translationMatrix);
  let matrix = mat3.multiply(projectionMatrix, translationMatrix);
  matrix = mat3.multiply(matrix, rotationMatrix);
  matrix = mat3.multiply(matrix, scaleMatrix);
  matrix = mat3.multiply(matrix, moveOriginMatrix);
```

또한, 유니폼 버퍼에 해상도를 저장하기 위한 코드와, 그 해상도를 설정하는 코드도 제거했습니다.

이 마지막 단계를 통해, 6~7개의 단계로 구성된 복잡한 셰이더를, 단 한 단계로 구성된 매우 간단한 셰이더로 변환할 수 있었습니다. 이는 모두 행렬 계산의 힘 덕분입니다.

{{{example url="../webgpu-matrix-math-transform-just-matrix-3x3.html" }}}

## 행렬 곱셈의 과정

계속 진행하기 전에, 조금 간단하게 설명해 보겠습니다. 다양한 행렬들을 생성하여 개별적으로 곱하는 경우도 있지만, 그냥 진행하면서 바로 곱하는 경우도 있습니다. 실제로는 다음과 같은 함수들을 사용할 수 있습니다.

```js
const mat3 = {

  ...

  translate: function(m, translation) {
    return mat3.multiply(m, mat3.translation(translation));
  },

  rotate: function(m, angleInRadians) {
    return mat3.multiply(m, mat3.rotation(angleInRadians));
  },

  scale: function(m, scale) {
    return mat3.multiply(m, mat3.scaling(scale));
  },

  ...

};
```

이렇게 하면, 위의 행렬 코드의 7줄을 단 4줄로 줄일 수 있습니다.

```js
const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
-const translationMatrix = mat3.translation(settings.translation);
-const rotationMatrix = mat3.rotation(settings.rotation);
-const scaleMatrix = mat3.scaling(settings.scale);
-
-let matrix = mat3.multiply(projectionMatrix, translationMatrix);
-matrix = mat3.multiply(matrix, rotationMatrix);
-matrix = mat3.multiply(matrix, scaleMatrix);
+let matrix = mat3.translate(projectionMatrix, settings.translation);
+matrix = mat3.rotate(matrix, settings.rotation);
+matrix = mat3.scale(matrix, settings.scale);
```

## `mat3x3f`는 `vec3f` 열 세 개로 구성됩니다

데이터 메모리 레이아웃 강의에서 설명한 것처럼, 정렬 규칙 때문에 `vec3f`를 배치할 때 부동소수점 값 4개에 해당하는 공간을 사용하는 경우가 많습니다.

이것이 바로 `mat3x3f`가 메모리상에서 어떻게 보이는지입니다.

<div class="webgpu_center" data-diagram="mat3x3f"></div>

이러한 이유로, 우리는 이 코드를 사용하여 그것을 일관된 값으로 복사해야 했습니다.

```js
    matrixValue.set([
      ...matrix.slice(0, 3), 0,
      ...matrix.slice(3, 6), 0,
      ...matrix.slice(6, 9), 0,
    ]);
```

이 문제는, 행렬 함수를 변경하여 패딩을 처리하도록 할 수 있습니다.

```js
const mat3 = {
  projection(width, height) {
    // 참고: 이 행렬은 Y축을 반전시킴으로써, 0이 맨 위에 위치하게 됩니다.
    return [
-      2 / width, 0, 0,
-      0, -2 / height, 0,
-      -1, 1, 1,
+      2 / width, 0, 0, 0,
+      0, -2 / height, 0, 0,
+      -1, 1, 1, 0,
    ];
  },
  identity() {
    return [
-      1, 0, 0,
-      0, 1, 0,
-      0, 0, 1,
+      1, 0, 0, 0,
+      0, 1, 0, 0,
+      0, 0, 1, 0,
    ];
  },
  multiply(a, b) {
-    const a00 = a[0 * 3 + 0];
-    const a01 = a[0 * 3 + 1];
-    const a02 = a[0 * 3 + 2];
-    const a10 = a[1 * 3 + 0];
-    const a11 = a[1 * 3 + 1];
-    const a12 = a[1 * 3 + 2];
-    const a20 = a[2 * 3 + 0];
-    const a21 = a[2 * 3 + 1];
-    const a22 = a[2 * 3 + 2];
-    const b00 = b[0 * 3 + 0];
-    const b01 = b[0 * 3 + 1];
-    const b02 = b[0 * 3 + 2];
-    const b10 = b[1 * 3 + 0];
-    const b11 = b[1 * 3 + 1];
-    const b12 = b[1 * 3 + 2];
-    const b20 = b[2 * 3 + 0];
-    const b21 = b[2 * 3 + 1];
-    const b22 = b[2 * 3 + 2];
+    const a00 = a[0 * 4 + 0];
+    const a01 = a[0 * 4 + 1];
+    const a02 = a[0 * 4 + 2];
+    const a10 = a[1 * 4 + 0];
+    const a11 = a[1 * 4 + 1];
+    const a12 = a[1 * 4 + 2];
+    const a20 = a[2 * 4 + 0];
+    const a21 = a[2 * 4 + 1];
+    const a22 = a[2 * 4 + 2];
+    const b00 = b[0 * 4 + 0];
+    const b01 = b[0 * 4 + 1];
+    const b02 = b[0 * 4 + 2];
+    const b10 = b[1 * 4 + 0];
+    const b11 = b[1 * 4 + 1];
+    const b12 = b[1 * 4 + 2];
+    const b20 = b[2 * 4 + 0];
+    const b21 = b[2 * 4 + 1];
+    const b22 = b[2 * 4 + 2];

    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
+      0,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
+      0,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22,
+      0,
    ];
  },
  translation([tx, ty]) {
    return [
-      1, 0, 0,
-      0, 1, 0,
-      tx, ty, 1,
+      1, 0, 0, 0,
+      0, 1, 0, 0,
+      tx, ty, 1, 0,
    ];
  },

  rotation(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
-      c, s, 0,
-      -s, c, 0,
-      0, 0, 1,
+      c, s, 0, 0,
+      -s, c, 0, 0,
+      0, 0, 1, 0,
    ];
  },

  scaling([sx, sy]) {
    return [
-      sx, 0, 0,
-      0, sy, 0,
-      0, 0, 1,
+      sx, 0, 0, 0,
+      0, sy, 0, 0,
+      0, 0, 1, 0,
    ];
  },
};
```

이제, 우리의 행렬을 설정하는 부분을 변경할 수 있습니다.

```js
-    matrixValue.set([
-      ...matrix.slice(0, 3), 0,
-      ...matrix.slice(3, 6), 0,
-      ...matrix.slice(6, 9), 0,
-    ]);
+    matrixValue.set(matrix);
```

## 행렬을 적절한 위치에 업데이트하는 방법

또 다른 방법은, 행렬 함수에 행렬을 전달할 수 있도록 하는 것입니다. 이렇게 하면, 행렬을 복사하는 대신 그대로 업데이트할 수 있습니다. 두 가지 옵션을 모두 사용할 수 있다면 좋겠죠. 따라서, 목적지 행렬가 전달되지 않았다면 새로운 행렬을 생성하도록 설정할 것입니다. 그렇지 않으면, 전달된 행렬을 그대로 사용할 것입니다.

3개의 예시를 들어보겠습니다.

```
const mat3 = {
-  multiply(a, b) {
+  multiply(a, b, dst) {
+    dst = dst || new Float32Array(12);
    const a00 = a[0 * 4 + 0];
    const a01 = a[0 * 4 + 1];
    const a02 = a[0 * 4 + 2];
    const a10 = a[1 * 4 + 0];
    const a11 = a[1 * 4 + 1];
    const a12 = a[1 * 4 + 2];
    const a20 = a[2 * 4 + 0];
    const a21 = a[2 * 4 + 1];
    const a22 = a[2 * 4 + 2];
    const b00 = b[0 * 4 + 0];
    const b01 = b[0 * 4 + 1];
    const b02 = b[0 * 4 + 2];
    const b10 = b[1 * 4 + 0];
    const b11 = b[1 * 4 + 1];
    const b12 = b[1 * 4 + 2];
    const b20 = b[2 * 4 + 0];
    const b21 = b[2 * 4 + 1];
    const b22 = b[2 * 4 + 2];

-    return [
-      b00 * a00 + b01 * a10 + b02 * a20,
-      b00 * a01 + b01 * a11 + b02 * a21,
-      b00 * a02 + b01 * a12 + b02 * a22,
-      0,
-      b10 * a00 + b11 * a10 + b12 * a20,
-      b10 * a01 + b11 * a11 + b12 * a21,
-      b10 * a02 + b11 * a12 + b12 * a22,
-      0,
-      b20 * a00 + b21 * a10 + b22 * a20,
-      b20 * a01 + b21 * a11 + b22 * a21,
-      b20 * a02 + b21 * a12 + b22 * a22,
-      0,
-    ];
+    dst[ 0] = b00 * a00 + b01 * a10 + b02 * a20;
+    dst[ 1] = b00 * a01 + b01 * a11 + b02 * a21;
+    dst[ 2] = b00 * a02 + b01 * a12 + b02 * a22;
+
+    dst[ 4] = b10 * a00 + b11 * a10 + b12 * a20;
+    dst[ 5] = b10 * a01 + b11 * a11 + b12 * a21;
+    dst[ 6] = b10 * a02 + b11 * a12 + b12 * a22;
+
+    dst[ 7] = b20 * a00 + b21 * a10 + b22 * a20;
+    dst[ 8] = b20 * a01 + b21 * a11 + b22 * a21;
+    dst[ 9] = b20 * a02 + b21 * a12 + b22 * a22;
+    return dst;
  },
-  translation([tx, ty]) {
+  translation([tx, ty], dst) {
+    dst = dst || new Float32Array(12);
-    return [
-      1, 0, 0, 0,
-      0, 1, 0, 0,
-      tx, ty, 1, 0,
-    ];
+    dst[0] = 1;   dst[1] = 0;   dst[ 2] = 0;
+    dst[4] = 0;   dst[5] = 1;   dst[ 6] = 0;
+    dst[8] = tx;  dst[9] = ty;  dst[10] = 1;
+    return dst;
  },
-  translate(m, translation) {
-    return mat3.multiply(m, mat3.translation(m));
+  translate(m, translation, dst) {
+    return mat3.multiply(m, mat3.translation(m), dst);
  }

  ...
```

다른 함수들도 마찬가지로 처리하면, 이제 우리의 코드는 이렇게 변할 수 있습니다.

```js
-    const projectionMatrix = mat3.projection(canvas.clientWidth, canvas.clientHeight);
-    let matrix = mat3.translate(projectionMatrix, settings.translation);
-    matrix = mat3.rotate(matrix, settings.rotation);
-    matrix = mat3.scale(matrix, settings.scale);
-    matrixValue.set(matrix);
+    mat3.projection(canvas.clientWidth, canvas.clientHeight, matrixValue);
+    mat3.translate(matrixValue, settings.translation, matrixValue);
+    mat3.rotate(matrixValue, settings.rotation, matrixValue);
+    mat3.scale(matrixValue, settings.scale, matrixValue);
```

이제는 `matrixValue`에 행렬을 복사할 필요가 없습니다. 대신, 그 행렬 자체를 직접 처리할 수 있습니다.

{{{example url="../webgpu-matrix-math-transform-trs.html"}}}

## 포인트를 변환하는 것과 공간을 변환하는 것

마지막으로, 위에서 말했듯이 순서가 중요합니다. 첫 번째 예시에서도 그렇게 했습니다.

    translation * rotation * scale

그리고 두 번째 경우에는…

    scale * rotation * translation

그리고 우리는 그들이 어떻게 다른지도 확인할 수 있었습니다.

행렬을 바라보는 방법은 두 가지가 있습니다. 주어진 표현식을 고려할 때…

    projectionMat * translationMat * rotationMat * scaleMat * position

많은 사람들이 가장 자연스럽다고 생각하는 방법은, 오른쪽에서 시작하여 왼쪽으로 진행하는 것입니다.

먼저, 위치를 스케일 행렬와 곱하여 스케일된 위치를 얻습니다.

    scaledPosition = scaleMat * position

그런 다음, scaledPosition에 회전 행렬을 곱하여 회전된 scaledPosition을 얻습니다.

    rotatedScaledPosition = rotationMat * scaledPosition

그런 다음, rotatedScaledPosition에 translation matrix를 곱하여 translatedRotatedScaledPosition을 얻습니다.

    translatedRotatedScaledPosition = translationMat * rotatedScaledPosition

마지막으로, 그 값에 투영 행렬을 곱하여 클립 공간의 위치를 구합니다.

    clipSpacePosition = projectionMatrix * translatedRotatedScaledPosition

행렬을 보는 두 번째 방법은 왼쪽에서 오른쪽으로 읽는 것입니다. 이 경우, 각 행렬은 우리가 그리는 텍스처가 나타내는 *공간*을 변경합니다. 텍스처는 각 방향에서 클립 공간(-1에서 +1까지)을 나타내기 시작합니다. 왼쪽에서 오른쪽으로 적용되는 각 행렬은 캔버스가 나타내는 공간을 변경합니다.

1단계: 행렬이 없거나, 행렬이 행렬인 경우는 없음.

> <div data-diagram="space-change-0" data-caption="클립 공간"></div>
>
> 흰색 부분이 바로 질감입니다. 파란색은 질감의 바깥쪽에 위치합니다. 우리는 클립 공간에 있습니다. 전달되는 위치들은 반드시 클립 공간에 맞게 조정되어야 합니다. 오른쪽 위쪽의 녹색 부분은 F의 왼쪽 상단 모서리입니다. 이 부분이 거꾸로 보이는 이유는 클립 공간에서는 +Y가 위를 의미하지만, F는 픽셀 공간에서 설계되었기 때문에 +Y가 아래를 의미하기 때문입니다. 게다가 클립 공간에서는 2x2 단위만 표시되지만, F의 크기는 100x150 단위이므로, 우리는 단지 1단위만 볼 수 있습니다.

2단계: `mat3.projection(canvas.clientWidth, canvas.clientHeight, matrixValue);`

> <div data-diagram="space-change-1" data-caption="클립 공간에서 픽셀 공간으로"></div>
>
> 이제 우리는 픽셀 공간에 있습니다. X의 값은 textureWidth 범위 내에서, Y의 값은 textureHeight 범위 내에서 정해집니다. 위치는 왼쪽 상단의 0,0점부터 시작합니다. 이 행렬을 사용하여 전달되는 위치들은 반드시 픽셀 공간에서의 위치여야 합니다. 보이는 섬광은, 공간의 Y 값이 양수에서 음수로 바뀔 때 발생합니다.

3단계: `mat3.translate(matrixValue, settings.translation, matrixValue);`

> <div data-diagram="space-change-2" data-caption="원점을 tx, ty로 이동합니다."></div>
>
> 이제, 그 공간의 위치는 tx, ty(150, 100)로 이동되었습니다.

4단계: `mat3.rotate(matrixValue, settings.rotation, matrixValue);`

> <div data-diagram="space-change-3" data-caption="33도 회전"></div>
>
> 이 공간은 tx, ty를 중심으로 회전되었습니다.

5단계: `mat3.scale(matrixValue, settings.scale, matrixValue);`

> <div data-diagram="space-change-4" data-caption="공간을 확장하는 것"></div>
>
> 이전에 회전된 공간은 중심이 tx, ty였습니다. 이 공간은 x축 방향으로 2배, y축 방향으로 1.5배로 확대되었습니다.

그런 다음, 셰이더에서는 `clipSpace = uni.matrix * vert.position;`라는 코드를 실행합니다. 여기서 `vert.position` 값들은 결국 이 최종 공간에 적용됩니다.

자신이 이해하기 쉽다고 느끼는 방식을 사용하세요.

이 기사들이 행렬 연산을 더 쉽게 이해하는 데 도움이 되었기를 바랍니다. 다음 글에서는 [직교 투영](webgpu-orthographic-projection.html)을 다룹니다. 3D에서도 행렬 연산의 원리와 사용법은 동일합니다. 2D부터 시작하여, 이해하기 쉽도록 설명했습니다.

또한, 만약 여러분이 진정으로 행렬 계산 분야의 전문가가 되고 싶다면, [이 멋진 비디오를 확인해 보세요](https://www.youtube.com/watch?v=kjBOesZCoqc&list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab).

<div class="webgpu_bottombar">
<h3><code>clientWidth</code>와 <code>clientHeight</code>는 무엇인가요?</h3>
<p>지금까지는 캔버스의 크기를 나타낼 때 항상 <code>canvas.width</code>와 <code>canvas.height</code>를 사용했습니다. 하지만 <code>mat3.projection</code> 함수를 호출할 때는 <code>canvas.clientWidth</code>와 <code>canvas.clientHeight</code>를 사용했습니다. 왜 그런가요?</p>
<p>투영 행렬는, 클립 공간의 값들(-1부터 +1까지, 각 차원마다)을 어떻게 다시 픽셀로 변환할지에 관한 것입니다. 하지만 브라우저에서는 두 종류의 픽셀을 다룹니다. 하나는 캔버스 내부에 있는 픽셀들입니다. 예를 들어, 다음과 같이 정의된 캔버스의 경우를 생각해 보세요.</p>
<pre class="prettyprint">
  &lt;canvas width="400" height="300"&gt;&lt;/canvas&gt;
</pre>
<p>또는 이와 같은 방식으로 정의된 것</p>
<pre class="prettyprint">
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
</pre>
<p>둘 다 너비 400픽셀, 높이 300픽셀인 이미지를 담습니다. 이 400x300 픽셀 크기와 브라우저가 실제로 캔버스를 표시하는 크기는 별개입니다. 표시 크기는 CSS가 정합니다. 예를 들어 캔버스를 다음과 같이 만들었다고 해 보겠습니다.</p>
<pre class="prettyprint">
  &lt;style&gt;
    canvas {
      width: 100%;
      height: 100%;
    }
  &lt;/style&gt;
  ...
  &lt;canvas width="400" height="300">&lt;/canvas&gt;
</pre>
<p>캔버스는, 그가 저장된 컨테이너의 크기에 따라 그 크기대로 표시됩니다. 아마도 400x300이 아닐 것입니다.</p>
<p>다음은 캔버스의 CSS 디스플레이 크기를 100%로 설정하여 캔버스가 페이지 전체를 채우도록 하는 두 가지 예시입니다. 첫 번째 예시에서는 <code>mat3.projection</code> 함수를 호출할 때 <code>canvas.width</code>와 <code>canvas.height</code>를 사용합니다. 새로운 창에서 이 코드를 열고 창의 크기를 조정해 보세요. 그러면 ‘F’가 올바른 비율로 표시되지 않고 왜곡된 것을 볼 수 있습니다. 또한, ‘F’가 원래 위치에 있지도 않습니다. 코드에 따르면 왼쪽 위 모서리는 150, 25에 있어야 하지만, 캔버스가 확장되거나 축소되면서 원래 위치가 변경됩니다.</p>
{{{example url="../webgpu-canvas-width-height.html" width="500" height="150" }}}
<p>이 두 번째 예시에서는 <code>mat3.projection</code> 함수를 호출할 때 <code>canvas.clientWidth</code>와 <code>canvas.clientHeight</code>를 사용합니다. <code>canvas.clientWidth</code>와 <code>canvas.clientHeight</code>는 브라우저가 캔버스를 실제로 어떻게 표시하는지 나타내는 값입니다. 따라서, 캔버스의 크기가 400x300픽셀인 경우에도 <code>F</code>가 항상 올바르게 표시됩니다.</p>
{{{example url="../webgpu-canvas-clientwidth-clientheight.html" width="500" height="150" }}}
<p>캔버스를 크기 조절할 수 있도록 하는 대부분의 앱들은, <code>canvas.width</code>와 <code>canvas.height</code>를 <code>canvas.clientWidth</code>와 <code>canvas.clientHeight</code>와 일치시키려고 합니다. 왜냐하면 브라우저가 표시하는 각 픽셀마다 캔버스에도 해당 픽셀이 존재하도록 하고 싶기 때문입니다. 하지만 위에서 살펴보았듯이, 이것이 유일한 방법은 아닙니다. 따라서 거의 모든 경우에 있어서, 투영 행렬의 비율을 계산할 때는 <code>canvas.clientHeight</code>와 <code>canvas.clientWidth</code>를 사용하는 것이 기술적으로 더 올바른 방법입니다.
</p>
</div>

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-matrix-math.css" rel="stylesheet">
<script type="module" src="webgpu-matrix-math.js"></script>
