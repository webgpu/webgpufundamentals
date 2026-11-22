Title: WebGPU 방향광
Description: WebGPU에서 방향광 구현하기
TOC: 방향광


이 글은, [카메라](webgpu-cameras.html)을 이미 읽어보았다고 가정합니다.

조명을 구현하는 방법은 여러 가지입니다. 가장 간단한 방법은 아마도 *방향광*일 것입니다.

방향광이란, 빛이 한 방향에서 균일하게 비추는 것을 가정합니다. 맑은 날에 떠오르는 태양도 종종 방향광으로 간주됩니다. 태양은 너무 멀리 있어서, 그 빛이 물체의 표면에 평행하게 비추는 것으로 볼 수 있습니다.

방향광을 처리하는 것은 사실 매우 간단합니다. 빛이 어느 방향으로 흐르는지, 그리고 물체의 표면이 어느 방향을 향하고 있는지 알고 있다면, 두 방향의 *dot product*를 계산하면 두 방향 사이의 각도의 코사인 값을 얻을 수 있습니다.

다음은 예시입니다.

{{{diagram url="resources/dot-product.html" caption="drag the points" width="700" height="400"}}}

점들을 이동시켜보세요. 만약 점들이 서로 정확히 반대쪽에 위치한다면, 그때 dot product의 값은 -1이 됩니다. 반대로, 점들이 정확히 같은 위치에 있다면, dot product의 값은 1이 됩니다.

그게 어떻게 유용할까요? 만약 우리가 3D 오브젝트의 표면이 어느 방향을 향하고 있는지, 그리고 빛이 어느 방향으로 비추고 있는지 알고 있다면, 그 두 방향의 내적을 계산하면 됩니다. 만약 빛이 표면을 직접 향하고 있다면 그 결과는 1이 되고, 반대로 빛이 표면과 정반대 방향을 향하고 있다면 그 결과는 -1이 됩니다.

{{{diagram url="resources/directional-lighting.html" caption="rotate the direction" width="700" height="400"}}}

우리는 그 내적 값에 색상을 곱해버리면 됩니다. 그러면 빛이 나옵니다!

문제는, 3D 오브젝트의 표면들이 어느 방향을 향하고 있는지 어떻게 알 수 있는가 하는 것입니다.

## <a id="a-normals"></a> 법선 알아보기

3D 그래픽에서 *법선(normal)*은 표면이 향하는 방향을 나타내는 단위 벡터입니다.

다음은 큐브와 구체에 대한 표준값들입니다.

{{{diagram url="resources/normals.html" width="700" height="400"}}}

물체에서 튀어나온 선들은 각 정점에 대한 normal을 나타냅니다.

삼각형에는 각 모서리마다 3개의 법선이 있습니다. 그 이유는, 삼각형의 각 면이 어떤 방향을 가리키는지를 나타내기 위해서는 3개의 서로 다른 법선이 필요하기 때문입니다.

여기서도 법선들은 그 방향에 따라 색상이 지정됩니다. x축 방향으로 향하는 법선은 <span style="color: red;">빨간색</span>으로 표시되고, 위쪽 방향으로 향하는 법선은 <span style="color: green;">녹색</span>으로 표시됩니다. z축 방향으로 향하는 법선은 <span style="color: blue;">파란색</span>으로 표시됩니다.

자, 이제 [카메라](webgpu-cameras.html)에서 사용한 `F`에 법선을 추가해 보겠습니다. 그래야 조명을 줄 수 있겠죠. `F`는 매우 직사각형 모양이며, 그 면들은 x, y, z 축에 맞춰져 있으므로 처리하기가 매우 쉽습니다. 앞을 향하는 면의 법선은 `0, 0, 1`이며, 뒤를 향하는 면의 법선은 `0, 0, -1`입니다. 왼쪽을 향하는 면의 법선은 `-1, 0, 0`이며, 오른쪽을 향하는 면의 법선은 `1, 0, 0`입니다. 위를 향하는 면의 법선은 `0, 1, 0`이며, 아래를 향하는 면의 법선은 `0, -1, 0`입니다. 그리고, 정점의 색상은 제거해버리겠습니다. 그렇지 않으면 조명을 확인하기가 어려워질 테니까요.

```js
function createFVertices() {
  const positions = [
    // 왼쪽 열
     -50,  75,  15,
     -20,  75,  15,
     -50, -75,  15,
     -20, -75,  15,

    // 최고 자리
     -20,  75,  15,
      50,  75,  15,
     -20,  45,  15,
      50,  45,  15,

    // 중간에 위치한 사람들
     -20,  15,  15,
      20,  15,  15,
     -20, -15,  15,
      20, -15,  15,

    // 왼쪽 열을 뒤로 이동시킵니다.
     -50,  75, -15,
     -20,  75, -15,
     -50, -75, -15,
     -20, -75, -15,

    // 최고의 자리로 돌아가기
     -20,  75, -15,
      50,  75, -15,
     -20,  45, -15,
      50,  45, -15,

    // 중간에 다시 돌아가기
     -20,  15, -15,
      20,  15, -15,
     -20, -15, -15,
      20, -15, -15,
  ];

  const indices = [
     0,  2,  1,    2,  3,  1,   // 왼쪽 열
     4,  6,  5,    6,  7,  5,   // 상단으로 이동
     8, 10,  9,   10, 11,  9,   // 중간 구간

    12, 13, 14,   14, 13, 15,   // 왼쪽 열을 뒤로 이동시킵니다.
    16, 17, 18,   18, 17, 19,   // 상단으로 돌아가기
    20, 21, 22,   22, 21, 23,   // 중간 지점으로 돌아가기

     0,  5, 12,   12,  5, 17,   // 상단
     5,  7, 17,   17,  7, 19,   // 최고 위치에 있음
     6, 18,  7,   18, 19,  7,   // 최고 위치에서 가장 낮은 위치까지
     6,  8, 18,   18,  8, 20,   // 상위 계층과 중간 계층 사이
     8,  9, 20,   20,  9, 21,   // 중간에 위치한 곳
     9, 11, 21,   21, 11, 23,   // 중간에 위치한 자리
    10, 22, 11,   22, 23, 11,   // 중간에 위치한 곳
    10,  3, 22,   22,  3, 15,   // 올바른 방향으로
     2, 14,  3,   14, 15,  3,   // 바닥
     0, 12,  2,   12, 14,  2,   // 왼쪽
  ];

-  const quadColors = [
-      200,  70, 120,  // 왼쪽 열 앞쪽
-      200,  70, 120,  // 최고 위치, 앞쪽
-      200,  70, 120,  // 중간 계층의 앞쪽
-
-       80,  70, 200,  // 왼쪽 열을 뒤로 이동시킵니다.
-       80,  70, 200,  // 최고의 자리로 돌아가기
-       80,  70, 200,  // 중간에 다시 돌아가기
-
-       70, 200, 210,  // 상단
-      160, 160, 220,  // 최고 위치에 있음
-       90, 130, 110,  // 최고 위치에서 가장 낮은 위치까지
-      200, 200,  70,  // 상위 계층과 중간 계층 사이
-      210, 100,  70,  // 중간에 위치한 곳
-      210, 160,  70,  // 중간에 위치한 자리
-       70, 180, 210,  // 중간에 위치한 곳
-      100,  70, 210,  // 올바른 방향으로
-       76, 210, 100,  // 바닥
-      140, 210,  80,  // 왼쪽
+  const normals = [
+        0,   0,   1,  // 왼쪽 열 앞쪽
+        0,   0,   1,  // 최고 위치, 앞쪽
+        0,   0,   1,  // 중간 계층의 앞쪽
+
+        0,   0,  -1,  // 왼쪽 열을 뒤로 이동시킵니다.
+        0,   0,  -1,  // 최고의 자리로 돌아가기
+        0,   0,  -1,  // 중간에 다시 돌아가기
+
+        0,   1,   0,  // 상단
+        1,   0,   0,  // 최고 위치에 있음
+        0,  -1,   0,  // 최고 위치에서 가장 낮은 위치까지
+        1,   0,   0,  // 상위 계층과 중간 계층 사이
+        0,   1,   0,  // 중간에 위치한 곳
+        1,   0,   0,  // 중간에 위치한 자리
+        0,  -1,   0,  // 중간에 위치한 곳
+        1,   0,   0,  // 올바른 방향으로
+        0,  -1,   0,  // 바닥
+       -1,   0,   0,  // 왼쪽
  ];

  const numVertices = indices.length;
-  const vertexData = new Float32Array(numVertices * 4); // xyz + 색상
  const vertexData = new Float32Array(numVertices * 6); // xyz + 정상적인 상태
-  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3;
    const position = positions.slice(positionNdx, positionNdx + 3);
    vertexData.set(position, i * 6);

    const quadNdx = (i / 6 | 0) * 3;
-    const color = quadColors.slice(quadNdx, quadNdx + 3);
-    colorData.set(color, i * 16 + 12);
-    colorData[i * 16 + 15] = 255;
+    const normal = normals.slice(quadNdx, quadNdx + 3);
+    vertexData.set(normal, i * 6 + 3);
  }

  return {
    vertexData,
    numVertices,
  };
}
```

우리는 파이프라인을 변경하여, 색상 대신 이 법선을 사용해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (4) * 4, // (3) 각각 4바이트인 부분들과, 4바이트인 색상 정보가 하나 더 있습니다.
+          arrayStride: (3 + 3) * 4, // (3+3)개의 부동소수점 숫자는 각각 4바이트입니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
-            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // 색상
+            {shaderLocation: 1, offset: 12, format: 'float32x3'},  // 정상적인
          ],
        },
      ],
    },

    ...
```

이제, 우리의 셰이더가 법선을 사용하도록 해야 합니다.

정점 셰이더에서는, 법선 값을 그냥 프래그먼트 셰이더로 전달합니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  color: vec4f,
+  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
-  @location(1) color: vec4f,
+  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
-  vsOut.color = vert.color;
+  vsOut.normal = vert.normal;
  return vsOut;
}
```

프래그먼트 셰이더에서는, 빛의 반대 방향과 법선의 내적을 사용하여 계산을 수행합니다.

```
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  // 왜냐하면, vsOut.normal은 여러 단계를 거쳐 변수가 변하는 값이기 때문입니다.
+  // 이 값은 보간된 값이기 때문에, 단위 벡터가 되지 않습니다.
+  // 이를 정규화하면, 다시 단위 벡터가 됩니다.
+  let normal = normalize(vsOut.normal);
+
+  // 점곱을 이용하여 빛을 계산합니다.
+  // 빛의 반대 방향으로 향하는 평면과의 관계
+  let light = dot(normal, -uni.lightDirection);
+
+  // 이제, 색상 부분만 곱해주면 됩니다. 알파 부분은 포함하지 않습니다.
+  // 빛에 의해
+  let color = uni.color.rgb * light;
+  return vec4f(color, uni.color.a);
}
```

우리는 유니폼 버퍼에 색상과 빛의 방향에 관련된 정보를 저장할 공간을 추가해야 합니다. 또한, 이러한 정보를 설정할 수 있는 기능도 필요합니다.

```js
-  // 행렬
-  const uniformBufferSize = (16) * 4;
+  // 행렬 + 색상 + 빛의 방향
+  const uniformBufferSize = (16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kMatrixOffset = 0;
+  const kColorOffset = 16;
+  const kLightDirectionOffset = 20;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
+  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

그리고 우리는 그들을 설정해야 합니다.

```js
  const settings = {
    rotation: degToRad(0),
  };

  ...

  function render() {
    ...


    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

우리의 카메라/시선은 z = 200 위에 위치해 있으며, Z = 0 방향을 바라보고 있습니다. 다시 말해, 시선은 음의 Z 방향으로 향하고 있습니다.

앞서 설명했던 `normalize` 함수는, 우리가 넣는 모든 값들을 단위 벡터로 변환해 줍니다. 이 예시에서 사용된 빛의 값들은 다음과 같습니다: `x = -0.5`인데, 이는 음수 `x`를 의미합니다. 하지만 Z축의 반대 방향을 보기 때문에, 빛은 왼쪽을 향하고 있습니다. `y = -0.7`인데, 이는 음수 `y`를 의미합니다. 따라서 빛은 아래를 향하고 있습니다. 마지막으로 `z = -1`인데, 이는 음수 `z`를 의미합니다. 따라서 빛은 카메라와 같은 방향을 향하고 있습니다. 이러한 상대적 값들로 미루어보면, 빛의 방향은 주로 장면 안쪽을 향하며, 오른쪽보다는 아래를 더 많이 향하고 있습니다.

그래, 여기 있습니다.

{{{example url="../webgpu-lighting-directional.html" }}}

F를 회전시키면 뭔가 변화가 있을 것 같습니다. F가 회전하고 있지만, 조명은 변하지 않습니다. F가 회전할 때, 빛이 비치는 방향을 향하는 부분이 가장 밝아집니다.

이 문제를 해결하기 위해서는, 객체의 방향이 변경될 때 함께 방향을 다시 조정해야 합니다. 위치에 대해 했던 것처럼, 방향도 일종의 행렬로 곱해줄 수 있습니다. 가장 직관적인 행렬은 `world` 행렬입니다. 하지만 지금은 단 하나의 행렬만 전달하고 있습니다. 이제는 두 개의 행렬을 전달하도록 변경해 보겠습니다. 하나는 `world` 행렬이고, 다른 하나는 `worldViewProjection` 행렬입니다. 현재는 `matrix` 행렬로 전달하고 있습니다.

```wgsl
struct Uniforms {
-  matrix: mat4x4f,
+  world: mat4x4f,
+  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;
-  vsOut.normal = vert.normal;

+  // normal을 방향을 맞추고, 그 다음으로 프래그먼트 셰이더로 전달합니다.
+  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;

  return vsOut;
}

...
```

법선에 `uni.world`를 곱할 때 W에 0을 전달하는 점을 보세요. 법선은 방향이므로 이동의 영향을 받지 않아야 합니다. `w`를 0으로 설정하면 이동 성분에 모두 0이 곱해집니다[^matrix-math].

[^matrix-math]: [행렬 연산](webgpu-matrix-math.html)에 대한 문서를 참조하세요.

우리는 유니폼 버퍼와 값 뷰를 업데이트해야 합니다.

```js
-  const uniformBufferSize = (16 + 4 + 4) * 4;
+  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kMatrixOffset = 0;
-  const kColorOffset = 16;
-  const kLightDirectionOffset = 20;
+  const kWorldOffset = 0;
+  const kWorldViewProjectionOffset = 16;
+  const kColorOffset = 32;
+  const kLightDirectionOffset = 36;

-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

그리고 우리는 그들을 업데이트하는 코드를 변경해야 합니다.

```js
    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);
+    // 월드 행렬을 직접 worldValue로 변환합니다.
+    mat4.rotationY(settings.rotation, worldValue);

+    // viewProjection와 world 행렬를 결합합니다.
+    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // 초록색
    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
```

그게 바로 그 것입니다.

{{{example url="../webgpu-lighting-directional-world.html" }}}

F를 회전시켜 보세요. 빛이 향하는 방향을 향하는 쪽이 점등됩니다.

직접 보여드릴 수 없는 문제가 하나 있는데, 그래서 그림으로 설명하겠습니다. 우리는 `normal`를 `world` 행렬과 곱하여 법선을 다시 정렬합니다. 그렇다면 월드 행렬을 크기 조절하면 어떻게 될까요? 결국 잘못된 법선이 나오게 됩니다.

{{{diagram url="resources/normals-scaled.html" caption="click to toggle normals" width="700" height="400" }}}

저는 그 해결 방법을 이해하려고 노력해본 적이 없어요. 하지만 알고 보니, 월드 행렬의 역행렬을 구할 수 있더군요. 그 방법은 행렬의 열들을 행으로 바꾸는 것입니다. 그렇게 하면 올바른 답을 얻을 수 있을 것입니다.

위의 다이어그램에서, <span style="color: #F0F;">보라색</span> 구체는 크기가 조정되어 있지 않습니다. 왼쪽에 있는 <span style="color: #F00;">빨간색</span> 구체는 크기가 조정되어 있으며, 그 구체의 법선 벡터는 월드 좌표계의 행렬과 곱해집니다. 여기서 뭔가 잘못된 것 같습니다. 오른쪽에 있는 <span style="color: #00F;">파란색</span> 구체는 월드 좌표계의 역전사 행렬을 사용하고 있습니다.

그림을 클릭하면 표시 방식이 차례로 바뀝니다. 크기 배율이 극단적일 때 왼쪽(world)의 법선은 구 표면에 **수직을 유지하지 못하지만**, 오른쪽(worldInverseTranspose)은 계속 수직이라는 점이 잘 보입니다. 마지막 모드에서는 모두 빨간색으로 셰이딩합니다. 어떤 행렬을 쓰느냐에 따라 양쪽 구의 조명이 크게 달라집니다. 조명만 보면 어느 쪽이 맞는지 판단하기 어렵지만, 다른 표시 방식으로 확인하면 worldInverseTranspose가 맞다는 점이 드러납니다.

이를 우리의 예시에 적용하기 위해, 코드를 다음과 같이 수정해 보겠습니다. 먼저 셰이더를 업데이트해야 합니다. 기술적으로는 `world`의 값만 업데이트해도 되지만, 이름을 바꿔서 실제 이름대로 부르는 것이 좋습니다. 그렇지 않으면 혼동될 수 있습니다. `worldInverseTranspose`라고 부를 수도 있지만, 보통은 `normalMatrix`라고 부릅니다. 그리고 우리가 관심 있는 것은 정확히는 normal의 방향입니다. 그러므로 3x3 크기의 행렬만 필요합니다.

```wgsl
struct Uniforms {
-  world: mat4x4f,
+  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // normal을 방향을 맞추고, 그 다음으로 프래그먼트 셰이더로 전달합니다.
-  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;
+  vsOut.normal = uni.normalMatrix * vert.normal;

  return vsOut;
}
```

3x3 행렬을 사용하기 때문에, 일반적인 계산 방식이 약간 더 간단해집니다.

물론, 유니폼의 형태가 변경되었으므로, JavaScript 코드도 그에 맞게 업데이트해야 합니다.

```js
-  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kWorldOffset = 0;
-  const kWorldViewProjectionOffset = 16;
-  const kColorOffset = 32;
-  const kLightDirectionOffset = 36;
+  const kNormalMatrixOffset = 0;
+  const kWorldViewProjectionOffset = 12;
+  const kColorOffset = 28;
+  const kLightDirectionOffset = 32;

-  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const normalMatrixValue = uniformValues.subarray(
+      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

법선 행렬을 계산하려면 먼저 행렬을 전치하는 함수가 필요합니다.

```js
const mat4 = {
  ....
  transpose(m, dst) {
    dst = dst || new Float32Array(16);

    dst[ 0] = m[ 0];  dst[ 1] = m[ 4];  dst[ 2] = m[ 8];  dst[ 3] = m[12];
    dst[ 4] = m[ 1];  dst[ 5] = m[ 5];  dst[ 6] = m[ 9];  dst[ 7] = m[13];
    dst[ 8] = m[ 2];  dst[ 9] = m[ 6];  dst[10] = m[10];  dst[11] = m[14];
    dst[12] = m[ 3];  dst[13] = m[ 7];  dst[14] = m[11];  dst[15] = m[15];

    return dst;
  },
  ...
```

그리고 4x4 행렬에서 3x3 행렬을 얻기 위한 함수가 필요합니다.

```js
const mat3 = {
  fromMat4(m, dst) {
    dst = dst || new Float32Array(12);

    dst[0] = m[0]; dst[1] = m[1];  dst[ 2] = m[ 2];
    dst[4] = m[4]; dst[5] = m[5];  dst[ 6] = m[ 6];
    dst[8] = m[8]; dst[9] = m[9];  dst[10] = m[10];

    return dst;
  },
};

```

WebGPU에서의 3x3 행렬은 각 열이 자동으로 확장된 형태로 저장됩니다. 이에 대해서는 [데이터 메모리 레이아웃](webgpu-memory-layout.html)에서 자세히 설명했습니다.

이제, 이 두 함수를 가지고 있으므로, 정상 행렬을 계산하고 설정할 수 있습니다.

```js
    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 보기 행렬과 프로젝션 행렬을 결합해 주세요.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    // 월드 행렬을 직접 worldValue로 변환합니다.
-    mat4.rotationY(settings.rotation, worldValue);
-
-    // viewProjection와 world 행렬를 결합합니다.
-    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);
+    // 월드 행렬을 계산합니다.
+    const world = mat4.rotationY(settings.rotation);
+
+    // viewProjection와 world 행렬를 결합합니다.
+    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);
+
+    // 그것을 역전시켜서, normalMatrix 값으로 변환합니다.
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

그 효과는 미묘하기 때문에, 아무것도 확장시키지 않기 때문에 눈에 띄는 차이가 없겠지만, 적어도 이제는 준비가 되었습니다.

{{{example url="../webgpu-lighting-directional-worldinversetranspose.html" }}}

이번에 조명에 대한 첫 번째 단계가 명확하게 설명되었기를 바랍니다. 다음으로는 [점광원](webgpu-lighting-point.html)에 대해 알아보겠습니다.
