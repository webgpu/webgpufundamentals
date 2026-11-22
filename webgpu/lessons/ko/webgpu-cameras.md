Title: WebGPU 카메라
Description: 행렬로 카메라 구현하기
TOC: 카메라

이 글은 3D 수학에 대해 배우는 데 도움이 될 만한 글들의 7번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

앞의 원근 투영 예제에서는 F를 시야 절두체 안으로 옮겼습니다. `mat4.perspective`는 카메라가 원점 (0, 0, 0)에서 -Z 방향을 바라본다고 가정하므로, 화면에 보이려면 물체가 `-zNear`와 `-zFar` 사이에 있어야 합니다.

실제 세계에서는, 보통 카메라를 움직여서 어떤 물체를 사진으로 찍습니다.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-camera"></div>
   <div class="caption">카메라를 물체 쪽으로 이동시키는 것</div>
</div>

하지만 지난 글에서 만든 투영 행렬을 사용하려면 물체가 원점 앞의 -Z축 쪽에 있어야 합니다. 이를 위해 카메라를 원점으로 옮기고, 다른 모든 물체도 *카메라에 대한 상대 위치*가 그대로 유지되도록 옮깁니다.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-world"></div>
    <div class="caption">물체를 카메라의 시야 안으로 옮기기</div>
</div>

카메라 앞에 있는 세계를 효과적으로 이동시켜야 합니다. 이를 가장 쉽게 하는 방법은 “역행렬”을 사용하는 것입니다. 일반적인 경우에 역행렬을 계산하는 수학적 방법은 복잡하지만, 개념적으로는 간단합니다. 역행렬이란, 다른 값을 반전시키는 데 사용되는 값입니다. 예를 들어, X축으로 123만큼 이동하는 행렬의 역행렬은 X축으로 -123만큼 이동하는 행렬입니다. 5배로 확대하는 행렬의 역행렬은 1/5 또는 0.2로 확대하는 행렬입니다. X축을 중심으로 30&deg;만큼 회전하는 행렬의 역행렬은 X축을 중심으로 -30&deg;만큼 회전하는 행렬입니다.

지금까지 우리는 ‘F’의 위치와 방향을 조절하기 위해 변환, 회전, 크기 조절과 같은 방법을 사용했습니다. 모든 행렬들을 곱한 후에는, ‘F’를 원점에서 원하는 위치, 크기, 방향으로 이동시키는 방법을 나타내는 단일 행렬을 얻을 수 있습니다. 카메라도 마찬가지입니다. 카메라를 원점에서 원하는 위치로 이동시키고 회전시키는 방법을 나타내는 행렬을 얻은 후에는, 그 행렬의 역행렬을 계산할 수 있습니다. 이 역행렬을 사용하면, 다른 모든 물체들도 반대 방향으로 이동하고 회전할 수 있습니다. 그렇게 하면 카메라는 (0, 0, 0) 위치에 있고, 그 앞에 있는 모든 물체들도 함께 이동하게 됩니다.

위의 다이어그램과 같은 형태의 ‘F’ 모양의 원을 포함하는 3D 장면을 만들어 봅시다.

먼저, F 정점의 데이터를 조정해 보겠습니다. 원래는 2D 공간에서 픽셀을 사용하여 시작했습니다. F의 왼쪽 상단 모서리는 0,0 위치에 있으며, 100픽셀 오른쪽으로, 150픽셀 아래쪽으로 뻗어 있습니다. 3D 공간에서는 “픽셀”이라는 단위가 별로 의미가 없을 것 같습니다. 그래서 투영 행렬을 사용할 때는 양의 Y축을 위쪽으로 설정해야 합니다. 그러니 F의 위치를 반전시켜서 양의 Y축이 위쪽이 되도록 하고, 원점을 중심으로 정렬해 보겠습니다.

```js
  const positions = [
-    // 왼쪽 열
-    0, 0, 0,
-    30, 0, 0,
-    0, 150, 0,
-    30, 150, 0,
-
-    // 최고 자리
-    30, 0, 0,
-    100, 0, 0,
-    30, 30, 0,
-    100, 30, 0,
-
-    // 중간에 위치한 사람들
-    30, 60, 0,
-    70, 60, 0,
-    30, 90, 0,
-    70, 90, 0,
-
-    // 왼쪽 열을 뒤로 이동시킵니다.
-    0, 0, 30,
-    30, 0, 30,
-    0, 150, 30,
-    30, 150, 30,
-
-    // 최고의 자리로 돌아가기
-    30, 0, 30,
-    100, 0, 30,
-    30, 30, 30,
-    100, 30, 30,
-
-    // 중간에 다시 돌아가기
-    30, 60, 30,
-    70, 60, 30,
-    30, 90, 30,
-    70, 90, 30,
+    // 왼쪽 열
+     -50,  75,  15,
+     -20,  75,  15,
+     -50, -75,  15,
+     -20, -75,  15,
+
+    // 최고 자리
+     -20,  75,  15,
+      50,  75,  15,
+     -20,  45,  15,
+      50,  45,  15,
+
+    // 중간에 위치한 사람들
+     -20,  15,  15,
+      20,  15,  15,
+     -20, -15,  15,
+      20, -15,  15,
+
+    // 왼쪽 열을 뒤로 이동시킵니다.
+     -50,  75, -15,
+     -20,  75, -15,
+     -50, -75, -15,
+     -20, -75, -15,
+
+    // 최고의 자리로 돌아가기
+     -20,  75, -15,
+      50,  75, -15,
+     -20,  45, -15,
+      50,  45, -15,
+
+    // 중간에 다시 돌아가기
+     -20,  15, -15,
+      20,  15, -15,
+     -20, -15, -15,
+      20, -15, -15,
  ];
```

또한 [원근 투영](webgpu-perspective-projection.html)에서 살펴봤듯이, 대부분의 2D 픽셀 라이브러리와 맞추기 위해 양의 Y축을 아래로 향하게 했습니다. Y에 -1을 곱했기 때문에 삼각형의 정점 순서가 일반적인 3D와 반대가 되어, 원래 제외해야 하는 `'back'` 면 대신 `'front'` 면을 제외했습니다. 이제 양의 Y가 위를 향하는 *일반적인* 3D로 돌아왔으니, 시계 방향으로 나열한 삼각형이 바깥을 향하도록 정점 순서를 뒤집겠습니다.

```js
  const indices = [
-     0,  1,  2,    2,  1,  3,  // 왼쪽 열
-     4,  5,  6,    6,  5,  7,  // 상단으로 이동
-     8,  9, 10,   10,  9, 11,  // 중간 구간
-
-    12, 14, 13,   14, 15, 13,  // 왼쪽 열을 뒤로 이동시킵니다.
-    16, 18, 17,   18, 19, 17,  // 상단으로 돌아가기
-    20, 22, 21,   22, 23, 21,  // 중간 지점으로 돌아가기
-
-     0, 12,  5,   12, 17,  5,   // 상단
-     5, 17,  7,   17, 19,  7,   // 최고 위치에 있음
-     6,  7, 18,   18,  7, 19,   // 최고 위치에서 가장 낮은 위치까지
-     6, 18,  8,   18, 20,  8,   // 상위 계층과 중간 계층 사이
-     8, 20,  9,   20, 21,  9,   // 중간에 위치한 곳
-     9, 21, 11,   21, 23, 11,   // 중간에 위치한 자리
-    10, 11, 22,   22, 11, 23,   // 중간에 위치한 곳
-    10, 22,  3,   22, 15,  3,   // 올바른 방향으로
-     2,  3, 14,   14,  3, 15,   // 바닥
-     0,  2, 12,   12,  2, 14,   // 왼쪽
+     0,  2,  1,    2,  3,  1,   // 왼쪽 열
+     4,  6,  5,    6,  7,  5,   // 상단으로 이동
+     8, 10,  9,   10, 11,  9,   // 중간 구간
+
+    12, 13, 14,   14, 13, 15,   // 왼쪽 열을 뒤로 이동시킵니다.
+    16, 17, 18,   18, 17, 19,   // 상단으로 돌아가기
+    20, 21, 22,   22, 21, 23,   // 중간 지점으로 돌아가기
+
+     0,  5, 12,   12,  5, 17,   // 상단
+     5,  7, 17,   17,  7, 19,   // 최고 위치에 있음
+     6, 18,  7,   18, 19,  7,   // 최고 위치에서 가장 낮은 위치까지
+     6,  8, 18,   18,  8, 20,   // 상위 계층과 중간 계층 사이
+     8,  9, 20,   20,  9, 21,   // 중간에 위치한 곳
+     9, 11, 21,   21, 11, 23,   // 중간에 위치한 자리
+    10, 22, 11,   22, 23, 11,   // 중간에 위치한 곳
+    10,  3, 22,   22,  3, 15,   // 올바른 방향으로
+     2, 14,  3,   14, 15,  3,   // 바닥
+     0, 12,  2,   12, 14,  2,   // 왼쪽
  ];
```

마지막으로, `cullMode`를 *백프레스 방향의* 삼각형들을 제외하도록 설정해 보겠습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (4) * 4, // (3) 각각 4바이트인 부분들과, 4바이트인 색상 정보가 하나 더 있습니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // 색상
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
-      cullMode: 'front',  // 참고: 드문 설정입니다. 관련 내용은 해당 문서를 참조하세요.
+      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });
```

다음은, 주어진 행렬에 대해 그 행렬의 역행렬을 계산하는 함수입니다.

```js
const mat4 = {
  ...

+  inverse(m, dst) {
+    dst = dst || new Float32Array(16);
+
+    const m00 = m[0 * 4 + 0];
+    const m01 = m[0 * 4 + 1];
+    const m02 = m[0 * 4 + 2];
+    const m03 = m[0 * 4 + 3];
+    const m10 = m[1 * 4 + 0];
+    const m11 = m[1 * 4 + 1];
+    const m12 = m[1 * 4 + 2];
+    const m13 = m[1 * 4 + 3];
+    const m20 = m[2 * 4 + 0];
+    const m21 = m[2 * 4 + 1];
+    const m22 = m[2 * 4 + 2];
+    const m23 = m[2 * 4 + 3];
+    const m30 = m[3 * 4 + 0];
+    const m31 = m[3 * 4 + 1];
+    const m32 = m[3 * 4 + 2];
+    const m33 = m[3 * 4 + 3];
+
+    const tmp0 = m22 * m33;
+    const tmp1 = m32 * m23;
+    const tmp2 = m12 * m33;
+    const tmp3 = m32 * m13;
+    const tmp4 = m12 * m23;
+    const tmp5 = m22 * m13;
+    const tmp6 = m02 * m33;
+    const tmp7 = m32 * m03;
+    const tmp8 = m02 * m23;
+    const tmp9 = m22 * m03;
+    const tmp10 = m02 * m13;
+    const tmp11 = m12 * m03;
+    const tmp12 = m20 * m31;
+    const tmp13 = m30 * m21;
+    const tmp14 = m10 * m31;
+    const tmp15 = m30 * m11;
+    const tmp16 = m10 * m21;
+    const tmp17 = m20 * m11;
+    const tmp18 = m00 * m31;
+    const tmp19 = m30 * m01;
+    const tmp20 = m00 * m21;
+    const tmp21 = m20 * m01;
+    const tmp22 = m00 * m11;
+    const tmp23 = m10 * m01;
+
+    const t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) -
+               (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
+    const t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) -
+               (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
+    const t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) -
+               (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
+    const t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) -
+               (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);
+
+    const d = 1 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
+
+    dst[0] = d * t0;
+    dst[1] = d * t1;
+    dst[2] = d * t2;
+    dst[3] = d * t3;
+
+    dst[4] = d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) -
+                  (tmp0 * m10 + tmp3 * m20 + tmp4 * m30));
+    dst[5] = d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) -
+                  (tmp1 * m00 + tmp6 * m20 + tmp9 * m30));
+    dst[6] = d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) -
+                  (tmp2 * m00 + tmp7 * m10 + tmp10 * m30));
+    dst[7] = d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) -
+                  (tmp5 * m00 + tmp8 * m10 + tmp11 * m20));
+
+    dst[8] = d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) -
+                  (tmp13 * m13 + tmp14 * m23 + tmp17 * m33));
+    dst[9] = d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) -
+                  (tmp12 * m03 + tmp19 * m23 + tmp20 * m33));
+    dst[10] = d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) -
+                   (tmp15 * m03 + tmp18 * m13 + tmp23 * m33));
+    dst[11] = d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) -
+                   (tmp16 * m03 + tmp21 * m13 + tmp22 * m23));
+
+    dst[12] = d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) -
+                   (tmp16 * m32 + tmp12 * m12 + tmp15 * m22));
+    dst[13] = d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) -
+                   (tmp18 * m22 + tmp21 * m32 + tmp13 * m02));
+    dst[14] = d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) -
+                   (tmp22 * m32 + tmp14 * m02 + tmp19 * m12));
+    dst[15] = d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) -
+                   (tmp20 * m12 + tmp23 * m22 + tmp17 * m02));
+    return dst;
+  },
...
```

이전 예시들과 마찬가지로, 5개의 물체를 그리기 위해서는 5개의 동일한 버퍼와 5개의 바인드 그룹이 필요합니다.

```js
+  const numFs = 5;
+  const objectInfos = [];
+  for (let i = 0; i < numFs; ++i) {
    // 행렬
    const uniformBufferSize = (16) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
    const kMatrixOffset = 0;

    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);

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
+      matrixValue,
+      bindGroup,
+    });
+  }
```

예제를 더 간단하게 만들기 위해, 몇 가지 설정을 제거해 보겠습니다.

```js
  const settings = {
    fieldOfView: degToRad(100),
-    translation: [-65, 0, -120],
-    rotation: [degToRad(220), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
  };

  ...

-      mat4.translate(matrixValue, settings.translation, matrixValue);
-      mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
-      mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
-      mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
-      mat4.scale(matrixValue, settings.scale, matrixValue);
```

우리는 5개의 물체를 그릴 것이며, 모든 물체는 동일한 투영 행렬을 사용할 것입니다. 그러므로, Fs를 그리는 과정이 시작되기 전에 먼저 이 행렬을 계산해두는 것이 좋습니다.

```js
  function render() {
    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
-    mat4.perspective(
+    const projection = mat4.perspective(
        settings.fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
-        matrixValue,
    );
```

다음으로, 카메라 행렬을 계산할 것입니다. 이 행렬은 세계 속에서 카메라의 위치와 방향을 나타냅니다. 아래 코드는 카메라를 원점에서 반지름 *1.5 거리만큼 회전시켜 원점을 바라보도록 하는 행렬을 만듭니다.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="camera-movement"></div>
   <div class="caption">카메라의 움직임</div>
</div>

```js
+  const radius = 200;
  const settings = {
    fieldOfView: degToRad(100),
+    cameraAngle: 0,
  };

  ...

  function render() {

     ...


+    // 카메라에 대한 행렬을 계산해 주세요.
+    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
```

그런 다음, 카메라 행렬로부터 “뷰 행렬”을 계산합니다. “뷰 행렬”이란, 카메라의 위치를 반대로 이동시키는 행렬입니다. 이렇게 하면 모든 물체들이 카메라에 대해서만 움직이는 것처럼 보입니다. 카메라가 원점(0,0,0)에 위치한 것처럼 말입니다. 이를 위해서는 `inverse` 함수를 사용합니다. 이 함수는 주어진 행렬의 역행렬을 계산해줍니다. 이 경우, 주어진 행렬은 카메라를 원점에 위치시키는 역할을 합니다. 그 역행렬은 모든 물체들을 카메라가 원점에 위치하는 위치로 이동시키는 역할을 합니다.

```js
    // 카메라 행렬로부터 뷰 행렬을 생성해 보세요.
    const viewMatrix = mat4.inverse(cameraMatrix);
```

이제, 시야 및 투영 행렬을 하나의 시야-투영 행렬로 결합합니다.

```js
+    // 보기 행렬과 투영 행렬을 결합합니다.
+    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

마지막으로 F들을 원형으로 배치합니다. 원 위에서 각 F의 위치를 구한 다음, 뷰 투영 행렬에 그 위치만큼 이동하는 변환을 적용합니다.

```js
  function render() {
    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        settings.fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    // 카메라에 대한 행렬을 계산해 주세요.
    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);

    // 카메라 행렬로부터 뷰 행렬을 생성해 보세요.
    const viewMatrix = mat4.inverse(cameraMatrix);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    objectInfos.forEach(({
+      matrixValue,
+      uniformBuffer,
+      uniformValues,
+      bindGroup,
+    }, i) => {
+      const angle = i / numFs * Math.PI * 2;
+      const x = Math.cos(angle) * radius;
+      const z = Math.sin(angle) * radius;

+      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

      // 유니폼 값을 유니폼 버퍼에 업로드합니다
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(numVertices);
+    });
```

자, 이제! ‘F’의 원을 따라 움직이는 카메라가 생겼습니다. `cameraAngle` 슬라이더를 조절하여 카메라를 원 위에서 이동시킬 수 있습니다.

{{{example url="../webgpu-cameras-step-1-direct-math.html" }}}

그건 괜찮은데, 카메라를 원하는 위치로 이동시키고, 원하는 대상을 향하게 하려면 ‘rotate’와 ‘translate’ 기능을 사용하는 것이 항상 쉽지는 않습니다. 예를 들어, 카메라가 항상 특정한 ‘F’ 중 하나를 향하도록 하고 싶다면, 카메라가 여러 ‘F’들 주위를 돌면서도 그 ‘F’를 향하게 하려면 상당히 복잡한 계산이 필요합니다.

다행히도, 더 간단한 방법이 있습니다. 우리는 카메라가 어디에 위치해야 하는지, 그리고 카메라가 어디를 향해야 하는지를 결정한 다음, 그 위치에 카메라를 배치할 수 있는 행렬을 계산할 수 있습니다. 행렬의 작동 방식을 고려하면, 이는 놀랍도록 간단한 작업입니다.

먼저, 카메라가 어디에 위치해야 하는지 알아야 합니다. 이를 `eye`라고 부릅니다. 그 다음, 우리가 관찰하거나 목표물을 겨냥하고자 하는 물체의 위치를 알아야 합니다. 이를 `target`라고 부릅니다. `target - eye`는 카메라에서 대상까지의 방향입니다. 카메라는 로컬 -Z 방향을 바라보므로, 행렬에 넣을 +Z축은 그 반대인 `eye - target`을 정규화해 구합니다. 그 결과인 `zAxis`를 행렬의 Z축에 복사합니다.

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tr>
        <td class="m11"> </td>
        <td class="m12"> </td>
        <td class="m13">Zx</td>
        <td class="m14"> </td>
      </tr>
      <tr>
        <td class="m21"> </td>
        <td class="m22"> </td>
        <td class="m23">Zy</td>
        <td class="m24"> </td>
      </tr>
      <tr>
        <td class="m31"> </td>
        <td class="m32"> </td>
        <td class="m33">Zz</td>
        <td class="m34"> </td>
      </tr>
      <tr>
        <td class="m41"> </td>
        <td class="m42"> </td>
        <td class="m43"> </td>
        <td class="m44"> </td>
      </tr>
    </table>
  </div>
</div>

여기서 구한 벡터가 카메라 행렬의 Z축입니다. 벡터를 정규화하면 길이가 1.0이 됩니다. [회전](webgpu-rotation.html)에서는 단위원 위의 점을 이용해 2D에서 회전했습니다. 3D에서는 정규화한 벡터의 끝점이 단위 구면 위에 놓입니다.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-00"></div>
  <div class="caption"><span class='z-axis'>z축</span></div>
</div>

하지만 그 정보만으로는 부족합니다. 벡터 하나는 단위 구면 위의 한 점을 알려 주지만, 그 점에서 물체를 어느 방향으로 세울지는 알려 주지 않습니다. 행렬의 나머지 부분인 X축과 Y축을 채워야 합니다. 일반적으로 세 축은 서로 수직이며, 카메라가 정위쪽을 향하는 경우는 드뭅니다. 따라서 위쪽 방향을 알면(여기서는 (0,1,0)) 외적을 이용해 행렬에 들어갈 X축과 Y축을 구할 수 있습니다.

외적이 수학적으로 무엇을 뜻하는지는 잘 모르지만, 단위 벡터 두 개의 외적을 구하면 두 벡터 모두에 수직인 벡터를 얻는다는 점은 알고 있습니다. 예를 들어 남동쪽을 가리키는 벡터와 위를 가리키는 벡터의 외적은 남서쪽이나 북동쪽을 향합니다. 두 방향 모두 남동쪽과 위쪽에 수직이기 때문입니다. 벡터의 순서를 바꾸면 결과가 반대 방향을 향합니다.

어쨌든, <span class="z-axis">`zAxis`</span>와 <span style="color: gray;">`up`</span>의 교차 벡터를 계산하면, 카메라의 <span class="x-axis">xAxis</span>를 얻을 수 있습니다.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-01"></div>
  <div class="caption"><span style='color:gray;'>위쪽</span>으로 이동하는 경우, <span class='z-axis'>zAxis</span> = <span class='x-axis'>xAxis</span>입니다.</div>
</div>

이제 <span class="x-axis">`xAxis`</span>가 있으므로, <span class="z-axis">`zAxis`</span>와 <span class="x-axis">`xAxis`</span>를 교차시킬 수 있습니다. 그러면 카메라의 <span class="y-axis">`yAxis`</span>를 얻을 수 있습니다.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-02"></div>
  <div class="caption"><span class='z-axis'>z축</span> 교차점<span class='x-axis'>x축</span> = <span class='y-axis'>y축</span></div>
</div>

이제 세 축을 행렬에 넣기만 하면 됩니다. 이 행렬은 `eye`에서 `target`을 향하도록 물체의 방향을 설정합니다. 마지막 열에 `eye`의 위치를 넣으면 됩니다.

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tbody>
        <tr class="vertical-spans">
          <td><span class="x-axis">x축 →</span></td>
          <td><span class="y-axis">y축 →</span></td>
          <td><span class="z-axis">z축 →</span></td>
          <td><span>눈의 위치 →</span></td>
        </tr>
        <tr>
          <td class="m11">Xx</td>
          <td class="m12">Yx</td>
          <td class="m13">Zx</td>
          <td class="m14">Tx</td>
        </tr>
        <tr>
          <td class="m21">Xy</td>
          <td class="m22">Yy</td>
          <td class="m23">Zy</td>
          <td class="m24">Ty</td>
        </tr>
        <tr>
          <td class="m31">Xz</td>
          <td class="m32">Yz</td>
          <td class="m33">Zz</td>
          <td class="m34">Tz</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

다음은 두 벡터의 외적을 계산하는 코드입니다. 우리의 행렬 관련 코드와 마찬가지로, 이 코드도 선택적으로 대상 배열을 받도록 설계되었습니다.

```js
+const vec3 = {
+  cross(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    const t0 = a[1] * b[2] - a[2] * b[1];
+    const t1 = a[2] * b[0] - a[0] * b[2];
+    const t2 = a[0] * b[1] - a[1] * b[0];
+
+    dst[0] = t0;
+    dst[1] = t1;
+    dst[2] = t2;
+
+    return dst;
+  },
+};
```

다음은 두 벡터를 빼는 데 사용되는 코드입니다.


```js
const vec3 = {
  ...
+  subtract(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    dst[0] = a[0] - b[0];
+    dst[1] = a[1] - b[1];
+    dst[2] = a[2] - b[2];
+
+    return dst;
+  },
```

다음은 벡터를 정규화하는 코드입니다. 즉, 벡터를 단위 벡터로 만들어주는 코드입니다.

```js
const vec3 = {
  ...
+  normalize(v, dst) {
+    dst = dst || new Float32Array(3);
+
+    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
+    // 분모가 0이 되지 않도록 주의해야 합니다.
+    if (length > 0.00001) {
+      dst[0] = v[0] / length;
+      dst[1] = v[1] / length;
+      dst[2] = v[2] / length;
+    } else {
+      dst[0] = 0;
+      dst[1] = 0;
+      dst[2] = 0;
+    }
+
+    return dst;
+  },
```

다음은 *카메라* 행렬을 계산하는 코드입니다. 이 코드는 위에서 설명한 단계들을 따릅니다.

```js
const mat4 = {
  ...
  cameraAim(eye, target, up, dst) {
    dst = dst || new Float32Array(16);

    const zAxis = vec3.normalize(vec3.subtract(eye, target));
    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

    return dst;
  },
  ...
```

이렇게 해서, 카메라를 움직일 때 특정한 ‘F’ 방향을 향하게 할 수 있습니다.

```js
-    // 카메라에 대한 행렬을 계산해 주세요.
-    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
+    // 첫 번째 F의 위치를 계산해 보세요.
+    const fPosition = [radius, 0, 0];
+
+    // 행렬 계산을 사용하여, 원 위의 특정 위치를 구할 수 있습니다.
+    // 카메라는…
+    const tempMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
+
+    // 우리가 계산한 행렬에서 카메라의 위치를 알아내세요.
+    const eye = tempMatrix.slice(12, 15);
+
+    const up = [0, 1, 0];
+
+    // 카메라의 행렬을 cameraAim을 사용하여 계산합니다.
+    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);

    // 카메라 행렬로부터 뷰 행렬을 생성해 보세요.
    const viewMatrix = mat4.inverse(cameraMatrix);
```

그리고 이것이 그 결과입니다.

{{{example url="../webgpu-cameras-step-2-camera-aim.html" }}}

슬라이더를 움직여보고, 카메라가 단 하나의 ‘F’를 따라 이동하는 모습을 확인해 보세요.

대부분의 수학 라이브러리에는 `cameraAim` 함수가 없습니다. 대신, `lookAt` 함수가 존재합니다. 이 함수는 `cameraAim` 함수가 하는 일을 정확하게 수행할 뿐만 아니라, 그 결과를 관점 행렬로 변환해 줍니다. 기능적으로 `lookAt` 함수는 다음과 같이 구현될 수 있습니다.

```js
const mat4 = {
  ...
+  lookAt(eye, target, up, dst) {
+    return mat4.inverse(mat4.cameraAim(eye, target, up, dst), dst);
+  },
  ...
};
```

이 `lookAt` 함수를 사용하면, 우리의 코드는 다음과 같아집니다.

```js
-    // 카메라의 행렬을 ‘look at’ 함수를 사용하여 계산합니다.
-    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);
-
-    // 카메라 행렬로부터 뷰 행렬을 생성해 보세요.
-    const viewMatrix = mat4.inverse(cameraMatrix);
+    // 뷰 행렬을 계산합니다.
+    const viewMatrix = mat4.lookAt(eye, fPosition, up);
```

{{{example url="../webgpu-cameras-step-3-look-at.html" }}}

이러한 “목표에 맞춘” 방식의 계산은 카메라뿐만 아니라 다른 여러 상황에도 활용될 수 있습니다. 예를 들어, 캐릭터의 머리가 특정 목표물을 따라가도록 하는 것, 타워가 목표물을 겨냥하도록 하는 것, 물체가 특정 경로를 따라가도록 하는 것 등입니다. 먼저, 목표물이 현재 어디에 있는지를 계산합니다. 그 다음, 몇 초 후에 목표물이 어디에 있을지도 계산합니다. 이 두 값을 `aim` 함수에 입력하면, 물체가 그 경로를 따라가도록 하는 행렬을 얻을 수 있습니다.

보통, 무언가를 “목표로 삼으려면”, 위의 함수처럼 음의 Z축이 아닌 양의 Z축을 향하게 해야 합니다. 따라서 이 경우에는 `eye - target`의 반대인 `target - eye`로 Z축을 구합니다.

```js
const mat4 = {
  ...
+  aim(eye, target, up, dst) {
+    dst = dst || new Float32Array(16);
+
+    const zAxis = vec3.normalize(vec3.subtract(target, eye));
+    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
+    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));
+
+    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
+    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
+    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
+    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;
+
+    return dst;
+  },

  cameraAim(eye, target, up, dst) {
    dst = dst || new Float32Array(16);

    const zAxis = vec3.normalize(vec3.subtract(eye, target));
    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

    return dst;
  },
...
```

<a id="a-aim-fs"></a> F 여러 개가 다른 F 하나를 바라보도록 만들어 보겠습니다. 예제에 데이터를 더 추가하지 않도록 같은 글자를 반복해 사용합니다. F를 5x5 격자로 놓고, 이들이 바라볼 F를 하나 더 추가합니다.

```js
-  const numFs = 5;
+  const numFs = 5 * 5 + 1;
```

그 다음에는 카메라의 타겟을 고정시키고, 설정을 변경하여 Fs 중 하나를 이동시킬 수 있도록 할 것입니다.

```js
  const settings = {
-    fieldOfView: degToRad(100),
-    cameraAngle: 0,
+    target: [0, 200, 300],
+    targetAngle: 0,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings, 'cameraAngle', radToDegOptions);
+  gui.add(settings.target, '1', -100, 300).name('target height');
+  gui.add(settings, 'targetAngle', radToDegOptions).name('target angle');
```

마지막으로 처음 25개의 F를 격자 형태로 배치하고 `aim`을 사용해 26번째 F를 *향하도록* 설정합니다.

```js
+    // 각도에 따라 목표점 X, Z를 업데이트합니다.
+    settings.target[0] = Math.cos(settings.targetAngle) * radius;
+    settings.target[2] = Math.sin(settings.targetAngle) * radius;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
-        settings.fieldOfView,
+        degToRad(60), // fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );

-    // 첫 번째 F의 위치를 계산해 보세요.
-    const fPosition = [radius, 0, 0];
-
-    // 행렬 계산을 사용하여, 원 위의 특정 위치를 구할 수 있습니다.
-    // 카메라는…
-    const tempMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
-
-    // 우리가 계산한 행렬에서 카메라의 위치를 알아내세요.
-    const eye = tempMatrix.slice(12, 15);
+    const eye = [-500, 300, -500];
+    const target = [0, -100, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
-    const viewMatrix = mat4.lookAt(eye, fPosition, up);
+    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    objectInfos.forEach(({
      matrixValue,
      uniformBuffer,
      uniformValues,
      bindGroup,
    }, i) => {
-      const angle = i / numFs * Math.PI * 2;
-      const x = Math.cos(angle) * radius;
-      const z = Math.sin(angle) * radius;
-
-      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

+      const deep = 5;
+      const across = 5;
+      if (i < 25) {
+        // 그리드 위치 계산하기
+        const gridX = i % across;
+        const gridZ = i / across | 0;
+
+        // 0부터 1까지의 위치를 계산합니다.
+        const u = gridX / (across - 1);
+        const v = gridZ / (deep - 1);
+
+        // 중앙에 모아서 흩뿌려라.
+        const x = (u - 0.5) * across * 150;
+        const z = (v - 0.5) * deep * 150;
+
+        // 이 F를 그 위치에서 목표 F를 향해 움직이게 합니다.
+        const aimMatrix = mat4.aim([x, 0, z], settings.target, up);
+        mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue);
+      } else {
+        mat4.translate(viewProjectionMatrix, settings.target, matrixValue);
+      }

      // 유니폼 값을 유니폼 버퍼에 업로드합니다
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

이제 F 25개의 앞면(+Z 방향)이 나머지 26번째 F를 향합니다.

{{{example url="../webgpu-cameras-step-4-aim-Fs.html" }}}

슬라이더를 움직여서, 25개의 *목표*를 모두 확인해 보세요.


<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-cameras.css" rel="stylesheet">
<script type="module" src="webgpu-cameras.js"></script>
