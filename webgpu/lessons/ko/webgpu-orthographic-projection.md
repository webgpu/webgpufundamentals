Title: WebGPU 직교 투영
Description: 원근감 없는 직교 투영
TOC: 직교 투영

이 글은 3D 수학에 대해 배우는 데 도움이 될 만한 글들의 5번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

지난 포스트에서 우리는 행렬이 어떻게 작동하는지에 대해 살펴보았습니다. 변환, 회전, 크기 조절, 그리고 픽셀들을 클립 공간으로 프로젝트하는 것도 모두 하나의 행렬과 몇 가지 수학적 연산을 통해 가능하다는 것을 알아보았습니다. 3D 그래픽을 구현하는 것도 그 다음 단계에 불과합니다.

이전의 2차원 예제들에서는, (x, y) 형태의 2차원 좌표를 가지고 있었고, 그 좌표들을 3x3 행렬과 곱해주었습니다. 3차원을 다루려면, (x, y, z) 형태의 3차원 좌표와 4x4 행렬이 필요합니다.

마지막 예시를 살펴보겠습니다. 이를 3D 형태로 변경해 보겠습니다. 여전히 ‘F’를 사용하겠지만, 이번에는 3D 형태의 ‘F’를 사용할 것입니다.

우리가 먼저 해야 할 일은, 3D 처리를 할 수 있도록 정점 셰이더를 변경하는 것입니다. 여기는 기존의 정점 셰이더입니다.

```wgsl
struct Uniforms {
  color: vec4f,
-  matrix: mat3x3f,
+  matrix: mat4x4f,
};

struct Vertex {
-  @location(0) position: vec2f,
+  @location(0) position: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
-
-  let clipSpace = (uni.matrix * vec3f(vert.position, 1)).xy;
-  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  vsOut.position = uni.matrix * vert.position;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return uni.color;
}
```

더 간단해졌습니다! 2D와 마찬가지로, `x`와 `y`를 제공한 다음 `z`를 1로 설정합니다. 3D의 경우도 마찬가지로 `x`, `y`, `z`를 제공해야 하며, `w`는 1이어야 합니다. 하지만 `w`는 기본적으로 1이 되도록 되어 있으므로, 이를 활용할 수 있습니다.

그 다음으로, 3D 데이터를 제공해야 합니다.

```js
function createFVertices() {
  const vertexData = new Float32Array([
    // 왼쪽 열
*    0, 0, 0,
*    30, 0, 0,
*    0, 150, 0,
*    30, 150, 0,

    // 최고 자리
*    30, 0, 0,
*    100, 0, 0,
*    30, 30, 0,
*    100, 30, 0,

    // 중간에 위치한 사람들
*    30, 60, 0,
*    70, 60, 0,
*    30, 90, 0,
*    70, 90, 0,
  ]);

  const indexData = new Uint32Array([
    0,  1,  2,    2,  1,  3,  // 왼쪽 열
    4,  5,  6,    6,  5,  7,  // 상단으로 이동
    8,  9, 10,   10,  9, 11,  // 중간 구간
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

위에서 우리는 각 줄의 끝에 ` 0,`를 추가했습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (2) * 4, // (2) 플로트들, 각각 4바이트입니다.
+          arrayStride: (3) * 4, // (3) 플로트들, 각각 4바이트입니다.
          attributes: [
-            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
+            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

다음으로, 모든 행렬 연산을 2차원에서 3차원으로 변경해야 합니다.

<div class="webgpu_center local-compare" style="align-items: end;">
  <div>
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
    <div>2차원 변환 행렬</div>
  </div>
  <div>
    <div class="glocal-center">
      <table class="glocal-center-content glocal-mat">
        <tr>
          <td class="m11">1</td>
          <td class="m12">0</td>
          <td class="m13">0</td>
          <td class="m14">tx</td>
        </tr>
        <tr>
          <td class="m21">0</td>
          <td class="m22">1</td>
          <td class="m23">0</td>
          <td class="m24">ty</td>
        </tr>
        <tr>
          <td class="m31">0</td>
          <td class="m32">0</td>
          <td class="m33">1</td>
          <td class="m34">tz</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </table>
    </div>
    <div>3D 변환 행렬</div>
  </div>
</div>

<div class="webgpu_center local-compare" style="align-items: end;">
  <div>
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
    <div>2차원 회전 행렬</div>
  </div>
  <div>
    <div class="glocal-center">
      <table class="glocal-center-content glocal-mat">
        <tr>
          <td class="m11">c</td>
          <td class="m12">-s</td>
          <td class="m13">0</td>
          <td class="m14">0</td>
        </tr>
        <tr>
          <td class="m21">s</td>
          <td class="m22">c</td>
          <td class="m23">0</td>
          <td class="m24">0</td>
        </tr>
        <tr>
          <td class="m31">0</td>
          <td class="m32">0</td>
          <td class="m33">1</td>
          <td class="m34">0</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </table>
    </div>
    <div>3D 회전에 사용되는 Z 행렬</div>
  </div>
</div>

<div class="webgpu_center local-compare" style="align-items: end;">
  <div>
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
    <div>2차원 크기 조절 행렬</div>
  </div>
  <div>
    <div class="glocal-center">
      <table class="glocal-center-content glocal-mat">
        <tr>
          <td class="m11">sx</td>
          <td class="m12">0</td>
          <td class="m13">0</td>
          <td class="m14">0</td>
        </tr>
        <tr>
          <td class="m21">0</td>
          <td class="m22">sy</td>
          <td class="m23">0</td>
          <td class="m24">0</td>
        </tr>
        <tr>
          <td class="m31">0</td>
          <td class="m32">0</td>
          <td class="m33">sz</td>
          <td class="m34">0</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </table>
    </div>
    <div>3D 크기 조절 행렬</div>
  </div>
</div>

또한, X와 Y를 회전 행렬로 만들 수도 있습니다.

<div class="webgpu_center local-compare" style="align-items: end;">
  <div>
    <div class="glocal-center">
      <table class="glocal-center-content glocal-mat">
        <tr>
          <td class="m11">1</td>
          <td class="m12">0</td>
          <td class="m13">0</td>
          <td class="m14">0</td>
        </tr>
        <tr>
          <td class="m21">0</td>
          <td class="m22">c</td>
          <td class="m23">-s</td>
          <td class="m24">0</td>
        </tr>
        <tr>
          <td class="m31">0</td>
          <td class="m32">s</td>
          <td class="m33">c</td>
          <td class="m34">0</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </table>
    </div>
    <div>3D 회전에 사용되는 X 행렬</div>
  </div>
  <div>
    <div class="glocal-center">
      <table class="glocal-center-content glocal-mat">
        <tr>
          <td class="m11">c</td>
          <td class="m12">0</td>
          <td class="m13">s</td>
          <td class="m14">0</td>
        </tr>
        <tr>
          <td class="m21">0</td>
          <td class="m22">1</td>
          <td class="m23">0</td>
          <td class="m24">0</td>
        </tr>
        <tr>
          <td class="m31">-s</td>
          <td class="m32">0</td>
          <td class="m33">c</td>
          <td class="m34">0</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </table>
    </div>
    <div>3D 회전에 사용되는 Y 행렬</div>
  </div>
</div>

이제 우리는 3개의 회전 행렬을 가지고 있습니다. 2차원에서는 단 하나의 회전 행렬만 필요했는데, 그 이유는 실제로는 Z축을 중심으로만 회전했기 때문입니다. 하지만 3차원에서는 X축과 Y축을 중심으로도 회전할 수 있어야 합니다. 이 회전 행렬들을 보면, 모두 매우 유사한 구조를 가지고 있습니다. 만약 이 회전 행렬들을 구해보면, 이전과 마찬가지로 간단하게 줄일 수 있을 것입니다.

회전

<div class="webgpu_center"><pre class="webgpu_math">
newX = x * c + y * -s;
newY = x * s + y *  c;
</pre></div>

Y 방향의 회전

<div class="webgpu_center"><pre class="webgpu_math">
newX = x *  c + z * s;
newZ = x * -s + z * c;
</pre></div>

X 방향의 회전

<div class="webgpu_center"><pre class="webgpu_math">
newY = y * c + z * -s;
newZ = y * s + z *  c;
</pre></div>

이렇게 해서 여러 가지 회전이 발생합니다.

<iframe class="external_diagram" src="resources/axis-diagram.html" style="width: 540px; height: 280px;"></iframe>

다음은 `mat3.translation`, `mat3.rotation`, `mat3.scaling` 함수의 2D 버전입니다.

```js
const mat3 = {
  ...
  translation([tx, ty], dst) {
    dst = dst || new Float32Array(12);
    dst[0] = 1;   dst[1] = 0;   dst[2] = 0;
    dst[4] = 0;   dst[5] = 1;   dst[6] = 0;
    dst[8] = tx;  dst[9] = ty;  dst[10] = 1;
    return dst;
  },

  rotation(angleInRadians, dst) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(12);
    dst[0] = c;   dst[1] = s;  dst[2] = 0;
    dst[4] = -s;  dst[5] = c;  dst[6] = 0;
    dst[8] = 0;   dst[9] = 0;  dst[10] = 1;
    return dst;

  },

  scaling([sx, sy], dst) {
    dst = dst || new Float32Array(12);
    dst[0] = sx;  dst[1] = 0;   dst[2] = 0;
    dst[4] = 0;   dst[5] = sy;  dst[6] = 0;
    dst[8] = 0;   dst[9] = 0;   dst[10] = 1;
    return dst;
  },
  ...
```

이제, 업데이트된 3D 버전들이 여기에 있습니다.

```js
const mat4 = {
  ...
  translation([tx, ty, tz], dst) {
    dst = dst || new Float32Array(16);
    dst[ 0] = 1;   dst[ 1] = 0;   dst[ 2] = 0;   dst[ 3] = 0;
    dst[ 4] = 0;   dst[ 5] = 1;   dst[ 6] = 0;   dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;   dst[10] = 1;   dst[11] = 0;
    dst[12] = tx;  dst[13] = ty;  dst[14] = tz;  dst[15] = 1;
    return dst;
  },

  rotationX(angleInRadians, dst) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = 1;  dst[ 1] = 0;   dst[ 2] = 0;  dst[ 3] = 0;
    dst[ 4] = 0;  dst[ 5] = c;   dst[ 6] = s;  dst[ 7] = 0;
    dst[ 8] = 0;  dst[ 9] = -s;  dst[10] = c;  dst[11] = 0;
    dst[12] = 0;  dst[13] = 0;   dst[14] = 0;  dst[15] = 1;
    return dst;
  },

  rotationY(angleInRadians, dst) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = c;  dst[ 1] = 0;  dst[ 2] = -s;  dst[ 3] = 0;
    dst[ 4] = 0;  dst[ 5] = 1;  dst[ 6] = 0;   dst[ 7] = 0;
    dst[ 8] = s;  dst[ 9] = 0;  dst[10] = c;   dst[11] = 0;
    dst[12] = 0;  dst[13] = 0;  dst[14] = 0;   dst[15] = 1;
    return dst;
  },

  rotationZ(angleInRadians, dst) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    dst = dst || new Float32Array(16);
    dst[ 0] = c;   dst[ 1] = s;  dst[ 2] = 0;  dst[ 3] = 0;
    dst[ 4] = -s;  dst[ 5] = c;  dst[ 6] = 0;  dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;  dst[10] = 1;  dst[11] = 0;
    dst[12] = 0;   dst[13] = 0;  dst[14] = 0;  dst[15] = 1;
    return dst;
  },

  scaling([sx, sy, sz], dst) {
    dst = dst || new Float32Array(16);
    dst[ 0] = sx;  dst[ 1] = 0;   dst[ 2] = 0;    dst[ 3] = 0;
    dst[ 4] = 0;   dst[ 5] = sy;  dst[ 6] = 0;    dst[ 7] = 0;
    dst[ 8] = 0;   dst[ 9] = 0;   dst[10] = sz;   dst[11] = 0;
    dst[12] = 0;   dst[13] = 0;   dst[14] = 0;    dst[15] = 1;
    return dst;
  },
  ...
```

마찬가지로, 우리는 간단화된 함수들을 만들어낼 것입니다. 여기에는 2차원 함수들이 있습니다.

```js
  translate(m, translation, dst) {
    return mat3.multiply(m, mat3.translation(translation), dst);
  },

  rotate(m, angleInRadians, dst) {
    return mat3.multiply(m, mat3.rotation(angleInRadians), dst);
  },

  scale(m, scale, dst) {
    return mat3.multiply(m, mat3.scaling(scale), dst);
  },
```

자, 이제 3D 버전을 살펴보겠습니다. 이름을 `mat4`로 지정하고, 추가로 2개의 회전 기능을 추가했을 뿐, 다른 부분은 크게 변경되지 않았습니다.

```js
  translate(m, translation, dst) {
    return mat4.multiply(m, mat4.translation(translation), dst);
  },

  rotateX(m, angleInRadians, dst) {
    return mat4.multiply(m, mat4.rotationX(angleInRadians), dst);
  },

  rotateY(m, angleInRadians, dst) {
    return mat4.multiply(m, mat4.rotationY(angleInRadians), dst);
  },

  rotateZ(m, angleInRadians, dst) {
    return mat4.multiply(m, mat4.rotationZ(angleInRadians), dst);
  },

  scale(m, scale, dst) {
    return mat4.scaling(m, mat4.scaling(scale), dst);
  },
  ...
```

그리고 우리는 4x4 행렬 곱셈 함수가 필요합니다.

```js
  multiply(a, b, dst) {
    dst = dst || new Float32Array(16);
    const b00 = b[0 * 4 + 0];
    const b01 = b[0 * 4 + 1];
    const b02 = b[0 * 4 + 2];
    const b03 = b[0 * 4 + 3];
    const b10 = b[1 * 4 + 0];
    const b11 = b[1 * 4 + 1];
    const b12 = b[1 * 4 + 2];
    const b13 = b[1 * 4 + 3];
    const b20 = b[2 * 4 + 0];
    const b21 = b[2 * 4 + 1];
    const b22 = b[2 * 4 + 2];
    const b23 = b[2 * 4 + 3];
    const b30 = b[3 * 4 + 0];
    const b31 = b[3 * 4 + 1];
    const b32 = b[3 * 4 + 2];
    const b33 = b[3 * 4 + 3];
    const a00 = a[0 * 4 + 0];
    const a01 = a[0 * 4 + 1];
    const a02 = a[0 * 4 + 2];
    const a03 = a[0 * 4 + 3];
    const a10 = a[1 * 4 + 0];
    const a11 = a[1 * 4 + 1];
    const a12 = a[1 * 4 + 2];
    const a13 = a[1 * 4 + 3];
    const a20 = a[2 * 4 + 0];
    const a21 = a[2 * 4 + 1];
    const a22 = a[2 * 4 + 2];
    const a23 = a[2 * 4 + 3];
    const a30 = a[3 * 4 + 0];
    const a31 = a[3 * 4 + 1];
    const a32 = a[3 * 4 + 2];
    const a33 = a[3 * 4 + 3];

    dst[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    dst[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    dst[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    dst[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

    dst[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    dst[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    dst[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    dst[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

    dst[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    dst[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    dst[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    dst[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

    dst[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    dst[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    dst[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    dst[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

    return dst;
  },
```

또한, 프로젝션 함수도 업데이트해야 합니다. 아래는 기존의 프로젝션 함수입니다.

```js
  projection(width, height, dst) {
    // 참고: 이 행렬은 Y축을 반전시킴으로써, 0이 맨 위에 위치하게 됩니다.
    dst = dst || new Float32Array(12);
    dst[0] = 2 / width;  dst[1] = 0;             dst[2] = 0;
    dst[4] = 0;          dst[5] = -2 / height;   dst[6] = 0;
    dst[8] = -1;         dst[9] = 1;             dst[10] = 1;
    return dst;
  },
```

이것은 픽셀을 클립 공간으로 변환하는 과정입니다. 처음으로 3D로 확장해보도록 하겠습니다.


```js
  projection(width, height, depth, dst) {
    // 참고: 이 행렬은 Y축을 반전시킴으로써, 0이 맨 위에 위치하게 됩니다.
    dst = dst || new Float32Array(16);
    dst[ 0] = 2 / width;  dst[ 1] = 0;            dst[ 2] = 0;          dst[ 3] = 0;
    dst[ 4] = 0;          dst[ 5] = -2 / height;  dst[ 6] = 0;          dst[ 7] = 0;
    dst[ 8] = 0;          dst[ 9] = 0;            dst[10] = 0.5 / depth;  dst[11] = 0;
    dst[12] = -1;         dst[13] = 1;            dst[14] = 0.5;          dst[15] = 1;
    return dst;
  },
```

X와 Y의 경우에는 픽셀을 클립 공간으로 변환해야 했습니다. 마찬가지로, Z축도 같은 작업을 해야 합니다. 이 경우, Z축도 “픽셀 단위”로 변환해야 합니다. `depth`에 대해서는 `width`와 유사한 값을 입력합니다. 그러면 공간의 너비는 0부터 `width` 픽셀까지, 높이는 0부터 `height` 픽셀까지가 됩니다. 하지만 `depth`의 경우는 `-depth / 2`부터 `+depth / 2`까지가 됩니다.

우리는 유니폼에 4x4 행렬을 포함시켜야 합니다.

```js
  // 색상, 행렬
-  const uniformBufferSize = (4 + 12) * 4;
+  const uniformBufferSize = (4 + 16) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kColorOffset = 0;
  const kMatrixOffset = 4;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 12);
+  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
```

그리고, 행렬을 계산하는 코드도 업데이트해야 합니다.

```js
 const settings = {
-    translation: [150, 100],
-    rotation: degToRad(30),
-    scale: [1, 1],
+    translation: [45, 100, 0],
+    rotation: [degToRad(40), degToRad(25), degToRad(325)],
+    scale: [1, 1, 1],
  };

  ...

  function render() {
    ...

-    mat3.projection(canvas.clientWidth, canvas.clientHeight, matrixValue);
-    mat3.translate(matrixValue, settings.translation, matrixValue);
-    mat3.rotate(matrixValue, settings.rotation, matrixValue);
-    mat3.scale(matrixValue, settings.scale, matrixValue);
+    mat4.projection(canvas.clientWidth, canvas.clientHeight, 400, matrixValue);
+    mat4.translate(matrixValue, settings.translation, matrixValue);
+    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
+    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
+    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
+    mat4.scale(matrixValue, settings.scale, matrixValue);
```

{{{example url="../webgpu-orthographic-projection-step-1-flat-f.html"}}}

우리가 직면하는 첫 번째 문제는, 우리의 데이터가 평면 형태로 구성되어 있어서 3차원 형태로 볼 수 없다는 것입니다. 이 문제를 해결하기 위해, 데이터를 3차원 형태로 확장해 보겠습니다. 현재의 평면 형태의 데이터는 3개의 직사각형과 2개의 삼각형으로 구성되어 있습니다. 3차원 형태로 만들기 위해서는 총 16개의 직사각형이 필요합니다. 앞쪽에는 3개, 뒤쪽에는 3개, 왼쪽에는 1개, 오른쪽에는 4개, 위쪽에는 2개, 아래쪽에는 3개가 필요합니다.

<img class="webgpu_center noinvertdark" style="width: 400px;" src="resources/3df.svg" />

우리는 현재 가지고 있는 모든 정점들의 위치를 그대로 유지한 채로, 그 위치를 Z축으로 이동시킨 다음, 그 정점들을 모두 연결해 주면 됩니다.

```js
function createFVertices() {
  const vertexData = new Float32Array([
    // 왼쪽 열
    0, 0, 0,
    30, 0, 0,
    0, 150, 0,
    30, 150, 0,

    // 최고 자리
    30, 0, 0,
    100, 0, 0,
    30, 30, 0,
    100, 30, 0,

    // 중간에 위치한 사람들
    30, 60, 0,
    70, 60, 0,
    30, 90, 0,
    70, 90, 0,

+    // 왼쪽 열을 뒤로 이동시킵니다.
+    0, 0, 30,
+    30, 0, 30,
+    0, 150, 30,
+    30, 150, 30,
+
+    // 최고의 자리로 돌아가기
+    30, 0, 30,
+    100, 0, 30,
+    30, 30, 30,
+    100, 30, 30,
+
+    // 중간에 다시 돌아가기
+    30, 60, 30,
+    70, 60, 30,
+    30, 90, 30,
+    70, 90, 30,
  ]);

  const indexData = new Uint32Array([
+    // 전선
    0,  1,  2,    2,  1,  3,  // 왼쪽 열
    4,  5,  6,    6,  5,  7,  // 상단으로 이동
    8,  9, 10,   10,  9, 11,  // 중간 구간

+    // 뒤로
+    12,  13,  14,   14, 13, 15,  // 왼쪽 열을 뒤로 이동시킵니다.
+    16,  17,  18,   18, 17, 19,  // 상단으로 돌아가기
+    20,  21,  22,   22, 21, 23,  // 중간 지점으로 돌아가기
+
+    0, 5, 12,   12, 5, 17,   // 상단
+    5, 7, 17,   17, 7, 19,   // 최고 위치에 있음
+    6, 7, 18,   18, 7, 19,   // 최고 위치에서 가장 낮은 위치까지
+    6, 8, 18,   18, 8, 20,   // 상위 계층과 중간 계층 사이
+    8, 9, 20,   20, 9, 21,   // 중간에 위치한 곳
+    9, 11, 21,  21, 11, 23,  // 중간에 위치한 자리
+    10, 11, 22, 22, 11, 23,  // 중간에 위치한 곳
+    10, 3, 22,  22, 3, 15,   // 올바른 방향으로
+    2, 3, 14,   14, 3, 15,   // 바닥
+    0, 2, 12,   12, 2, 14,   // 왼쪽
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

그리고 이것이 바로 그 버전입니다.

{{{example url="../webgpu-orthographic-projection-step-2-3d-f.html"}}}

슬라이더를 움직여보면, 그것이 3D인지 알기 어렵습니다. 그럼 각 직사각형을 다른 색상으로 칠해보도록 하겠습니다. 이를 위해, 정점 셰이더에 또 다른 속성을 추가하고, 그 속성을 [스테이지간 변수](webgpu-inter-stage-variables.html)를 통해 프래그먼트 셰이더로 전달할 것입니다.

먼저, 셰이더를 업데이트해야 합니다.

```wgsl
struct Uniforms {
-  color: vec4f,
  matrix: mat4x4f,
};

struct Vertex {
  @location(0) position: vec4f,
+  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
+  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
+  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return uni.color;
+  return vsOut.color;
}
```

정점 데이터에 색상을 추가해야 하지만, 문제가 있습니다. 현재는 정점를 공유하기 위해 인덱스를 사용하고 있습니다. 하지만, 각 면을 다른 색상으로 표현하고 싶다면, 그 정점들은 각각 같은 색상만을 가질 수밖에 없습니다. 따라서 그 정점들을 공유할 수 없습니다.

<img src="resources/cube-faces-vertex-no-texture.svg" class="webgpu_center" style="width:400px;" />

위에서 언급된 모서리의 정점은, 그 모서리가 속한 세 면 각각에 대해 한 번씩 사용되어야 합니다. 하지만 매번 다른 색상을 사용해야 하므로, 인덱스를 사용하는 것은 문제가 됩니다. [^flat-interpolation]

[^flat-interpolation]: 창의적인 방법으로 인덱스를 구성한다면, [스테이지간 변수](webgpu-inter-stage-variables.html)의 보간 설정에서 설명한 것처럼 `@interpolate(flat)`을 지정할 수 있습니다. 그리고 여전히 인덱스를 사용할 수 있습니다.

자, 이제 데이터를 인덱스 형태에서 비인덱스 형태로 변환해 보겠습니다. 그리고 그 과정에서 각 정점에 다른 색상을 부여하여, F의 각 부분들이 서로 다른 색상을 가질 수 있도록 하겠습니다.

```js
function createFVertices() {
-  const vertexData = new Float32Array([
+  const positions = [
    // 왼쪽 열
    0, 0, 0,
    30, 0, 0,
    0, 150, 0,
    30, 150, 0,

    // 최고 자리
    30, 0, 0,
    100, 0, 0,
    30, 30, 0,
    100, 30, 0,

    // 중간에 위치한 사람들
    30, 60, 0,
    70, 60, 0,
    30, 90, 0,
    70, 90, 0,

    // 왼쪽 열을 뒤로 이동시킵니다.
    0, 0, 30,
    30, 0, 30,
    0, 150, 30,
    30, 150, 30,

    // 최고의 자리로 돌아가기
    30, 0, 30,
    100, 0, 30,
    30, 30, 30,
    100, 30, 30,

    // 중간에 다시 돌아가기
    30, 60, 30,
    70, 60, 30,
    30, 90, 30,
    70, 90, 30,
-  ]);
+  ];

-  const indexData = new Uint32Array([
+  const indices = [
    // 전선
    0,  1,  2,    2,  1,  3,  // 왼쪽 열
    4,  5,  6,    6,  5,  7,  // 상단으로 이동
    8,  9, 10,   10,  9, 11,  // 중간 구간

    // 뒤로
    12,  13,  14,   14, 13, 15,  // 왼쪽 열을 뒤로 이동시킵니다.
    16,  17,  18,   18, 17, 19,  // 상단으로 돌아가기
    20,  21,  22,   22, 21, 23,  // 중간 지점으로 돌아가기

    0, 5, 12,   12, 5, 17,   // 상단
    5, 7, 17,   17, 7, 19,   // 최고 위치에 있음
    6, 7, 18,   18, 7, 19,   // 최고 위치에서 가장 낮은 위치까지
    6, 8, 18,   18, 8, 20,   // 상위 계층과 중간 계층 사이
    8, 9, 20,   20, 9, 21,   // 중간에 위치한 곳
    9, 11, 21,  21, 11, 23,  // 중간에 위치한 자리
    10, 11, 22, 22, 11, 23,  // 중간에 위치한 곳
    10, 3, 22,  22, 3, 15,   // 올바른 방향으로
    2, 3, 14,   14, 3, 15,   // 바닥
    0, 2, 12,   12, 2, 14,   // 왼쪽
-  ]);
+  ];

+  const quadColors = [
+      200,  70, 120,  // 왼쪽 열 앞쪽
+      200,  70, 120,  // 최고 위치, 앞쪽
+      200,  70, 120,  // 중간 계층의 앞쪽
+
+       80,  70, 200,  // 왼쪽 열을 뒤로 이동시킵니다.
+       80,  70, 200,  // 최고의 자리로 돌아가기
+       80,  70, 200,  // 중간에 다시 돌아가기
+
+       70, 200, 210,  // 상단
+      160, 160, 220,  // 최고 위치에 있음
+       90, 130, 110,  // 최고 위치에서 가장 낮은 위치까지
+      200, 200,  70,  // 상위 계층과 중간 계층 사이
+      210, 100,  70,  // 중간에 위치한 곳
+      210, 160,  70,  // 중간에 위치한 자리
+       70, 180, 210,  // 중간에 위치한 곳
+      100,  70, 210,  // 올바른 방향으로
+       76, 210, 100,  // 바닥
+      140, 210,  80,  // 왼쪽
+  ];
+
+  const numVertices = indices.length;
+  const vertexData = new Float32Array(numVertices * 4); // xyz + 색상
+  const colorData = new Uint8Array(vertexData.buffer);
+
+  for (let i = 0; i < indices.length; ++i) {
+    const positionNdx = indices[i] * 3;
+    const position = positions.slice(positionNdx, positionNdx + 3);
+    vertexData.set(position, i * 4);
+
+    const quadNdx = (i / 6 | 0) * 3;
+    const color = quadColors.slice(quadNdx, quadNdx + 3);
+    colorData.set(color, i * 16 + 12);  // RGB 값 설정
+    colorData[i * 16 + 15] = 255;       // 집합 A
+  }

  return {
    vertexData,
-    indexData,
-    numVertices: indexData.length,
+    numVertices,
  };
}
```

인덱스를 하나씩 순회하면서 해당 정점의 위치를 구하고 위치 값을 `vertexData`에 넣습니다. *같은 데이터*를 바라보는 `colorData` 뷰도 있으므로, 사각형의 인덱스로 색을 찾고(정점 6개마다 사각형 하나), 해당 사각형의 모든 정점에 같은 색을 넣습니다. 결과는 다음과 같습니다.

<img class="webgpu_center" style="background-color: transparent; width: 1024px;" src="resources/vertex-buffer-f32x3-u8x4.svg" />

우리가 추가한 색상들은 0부터 255까지의 값을 가진 부호 없는 바이트입니다. 이는 [css `rgb()`색상](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/rgb)와 유사합니다. 파이프라인에서 속성 타입을 `unorm8x4`(부호 없는, 정규화된 8비트 값 x 4)로 설정하면, GPU는 버퍼에서 값을 추출하여 그 값을 셰이더에 제공할 때 그 값을 *정규화*합니다. 이는 그 값을 0에서 1로 변환하는 것을 의미하며, 이 경우 255로 나누어 처리합니다.

이제 데이터가 준비되었으니, 이 데이터를 활용할 수 있도록 파이프라인을 변경해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (3) * 4, // (3) 플로트들, 각각 4바이트입니다.
+          arrayStride: (4) * 4, // (3) 각각 4바이트인 부분들과, 4바이트인 색상 정보가 하나 더 있습니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
+            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // 색상
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

우리는 우리의 유니폼에서 오래된 색상 데이터를 제거해야 합니다.

```js
-  const uniformBufferSize = (4 + 16) * 4;
+  const uniformBufferSize = (16) * 4;
  const uniformBuffer = device.createBuffer({
    label: "uniforms",
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kColorOffset = 0;
-  const kMatrixOffset = 4;
+  const kMatrixOffset = 0;

-  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const matrixValue = uniformValues.subarray(
      kMatrixOffset,
      kMatrixOffset + 16,
  );

-  // 색상은 변하지 않으므로, 초기화 시에 한 번만 설정해두면 됩니다.
-  colorValue.set([Math.random(), Math.random(), Math.random(), 1]);
```

이제는 인덱스 버퍼를 만들 필요가 없습니다.

```js
-  const { vertexData, indexData, numVertices } = createFVertices();
+  const { vertexData, numVertices } = createFVertices();
  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
-  const indexBuffer = device.createBuffer({
-    label: 'index buffer',
-    size: indexData.byteLength,
-    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
-  });
-  device.queue.writeBuffer(indexBuffer, 0, indexData);
```

그리고 우리는 지수 없이 그림을 그려야 합니다.

```js
 function render() {
    ...
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
-    pass.setIndexBuffer(indexBuffer, 'uint32');

    ...

    pass.setBindGroup(0, bindGroup);
-    pass.drawIndexed(numVertices);
+    pass.draw(numVertices);

    ...
  }
```

이제 우리는 이를 알게 되었습니다.

{{{example url="../webgpu-orthographic-projection-step-3-colored-3d-f.html"}}}

아, 그게 무슨 문제일까요? 알고 보니, 그 3D ‘F’의 모든 부분들이, 즉 앞쪽, 뒤쪽, 측면 등이, 우리가 가지고 있는 기하학적 데이터에 나타나는 순서대로 그려지고 있더군요. 그래서 원하는 결과가 나오지 않는 경우도 있습니다. 때로는 뒤쪽에 있는 부분들이 앞쪽에 있는 부분보다 먼저 그려지기도 하거든요.

<img class="webgpu_center" style="background-color: transparent; width: 163px;" src="resources/polygon-drawing-order.gif" />

<span style="background: rgb(200, 70, 120); color: white; padding: 0.25em">붉은 부분</span>은 F의 **앞면**입니다. 데이터 맨 앞에 있으므로 먼저 그려지고, 그 뒤에 다른 삼각형이 그려지면서 앞면을 덮습니다. 예를 들어 <span style="background: rgb(80, 70, 200); color: white; padding: 0.25em">보라색 부분</span>은 실제로 F의 뒷면입니다. 데이터에서 두 번째로 나오므로 두 번째로 그려집니다.

WebGPU에서의 삼각형에는 ‘전방향’과 ‘후방향’이라는 개념이 있습니다. 기본적으로, 전방향으로 배치된 삼각형의 꼭짓점들은 클립 공간에서 반시계 방향으로 배열됩니다. 반면, 후방향으로 배치된 삼각형의 꼭짓점들은 클립 공간에서 시계 방향으로 배열됩니다.

<img src="resources/triangle-winding.svg" class="webgpu_center" style="width: 400px;" />

GPU는 앞쪽을 향하는 삼각형만을 그릴 수 있는 기능을 가지고 있습니다. 이 기능을 활성화하려면 파이프라인을 수정해야 합니다.

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
+    primitive: {
+      cullMode: 'back',
+    },
  });
```

`cullMode`를 `back`로 설정하면, “백핀” 삼각형들이 제거됩니다. 여기서 “제거”란, 그림을 그리지 않는다는 의미입니다. 따라서, `cullMode`를 `'back'`로 설정하면, 이렇게 됩니다.

{{{example url="../webgpu-orthographic-projection-step-4-cullmode-back.html"}}}

이봐! 그 모든 삼각형들은 어디로 사라진 거야? 알고 보니, 그 중 많은 삼각형들이 잘못된 방향을 향하고 있었어. 그걸 회전시키면, 다른 쪽에서도 그 삼각형들이 보일 거야. 다행히 이 문제는 쉽게 해결할 수 있어. 어떤 삼각형들이 잘못된 방향을 향하고 있는지 확인한 다음, 그 삼각형들의 꼭짓점들을 서로 바꾸면 돼. 예를 들어, 잘못된 방향을 향하는 삼각형이 있다면, 그 삼각형의 꼭짓점들을 서로 바꾸면 돼.

<div class="webgpu_center"><pre class="webgpu_math">
6, 7, 8,
</pre></div>

두 개를 바꿔서 반대 방향으로 움직이게 할 수 있습니다.

<div class="webgpu_center"><pre class="webgpu_math">
6, 8, 7,
</pre></div>

중요한 점은, WebGPU의 경우, 어떤 삼각형이 시계 방향으로 움직이는지 아니면 반시계 방향으로 움직이는지는 그 삼각형의 꼭짓점들이 클립 공간에서 어떻게 위치하는지에 따라 결정된다는 것입니다. 다시 말해, WebGPU는 정점 셰이더에서 꼭짓점들에 수학적 연산을 적용한 후에야 비로소 삼각형이 앞쪽으로 향하는지 뒤쪽으로 향하는지를 판단합니다. 예를 들어, X축 방향으로 -1로 스케일된 시계 방향의 삼각형은 반시계 방향의 삼각형이 되고, 180도 회전된 시계 방향의 삼각형도 반시계 방향의 삼각형이 됩니다. `cullMode`를 설정하지 않았기 때문에, 시계 방향과 반시계 방향의 삼각형 모두를 볼 수 있었습니다. 하지만 `cullMode`를 `back`으로 설정하면, 앞쪽으로 향하는 삼각형이 어떻게든 변형되더라도 WebGPU는 그 삼각형을 그리지 않습니다. 이는 좋은 일입니다. 왜냐하면 3D에서 어떤 물체를 회전시킬 때, 자신에게 향하는 삼각형들이 앞쪽으로 향하는 것으로 간주되도록 하는 것이 좋기 때문입니다.

하지만! 클립 공간에서는 +Y가 위쪽에 있지만, 우리의 픽셀 공간에서는 +Y가 아래쪽에 있습니다. 즉, 우리의 행렬은 모든 삼각형의 위치를 수직으로 뒤집는 역할을 합니다. 따라서 +Y가 아래쪽에 있는 모양을 그리려면, `cullMode`을 `'front'`로 설정하거나, 모든 삼각형의 정점 데이터를 뒤집어야 합니다. 먼저 `cullMode`를 `'front'`로 설정한 다음, 모든 삼각형의 정점 데이터를 동일한 방향으로 조정해 주세요.

```js
  const indices = [
    // 전선
    0,  1,  2,    2,  1,  3,  // 왼쪽 열
    4,  5,  6,    6,  5,  7,  // 상단으로 이동
    8,  9, 10,   10,  9, 11,  // 중간 구간

    // 뒤로
-    12,  13,  14,   14, 13, 15,  // 왼쪽 열을 뒤로 이동시킵니다.
+    12,  14,  13,   14, 15, 13,  // 왼쪽 열을 뒤로 이동시킵니다.
-    16,  17,  18,   18, 17, 19,  // 상단으로 돌아가기
+    16,  18,  17,   18, 19, 17,  // 상단으로 돌아가기
-    20,  21,  22,   22, 21, 23,  // 중간 지점으로 돌아가기
+    20,  22,  21,   22, 23, 21,  // 중간 지점으로 돌아가기

-    0, 5, 12,   12, 5, 17,   // 상단
+    0, 12, 5,   12, 17, 5,   // 상단
-    5, 7, 17,   17, 7, 19,   // 최고 위치에 있음
+    5, 17, 7,   17, 19, 7,   // 최고 위치에 있음
    6, 7, 18,   18, 7, 19,   // 최고 위치에서 가장 낮은 위치까지
-    6, 8, 18,   18, 8, 20,   // 상위 계층과 중간 계층 사이
+    6, 18, 8,   18, 20, 8,   // 상위 계층과 중간 계층 사이
-    8, 9, 20,   20, 9, 21,   // 중간에 위치한 곳
+    8, 20, 9,   20, 21, 9,   // 중간에 위치한 곳
-    9, 11, 21,  21, 11, 23,  // 중간에 위치한 자리
+    9, 21, 11,  21, 23, 11,  // 중간에 위치한 자리
    10, 11, 22, 22, 11, 23,  // 중간에 위치한 곳
-    10, 3, 22,  22, 3, 15,   // 올바른 방향으로
+    10, 22, 3,  22, 15, 3,   // 올바른 방향으로
    2, 3, 14,   14, 3, 15,   // 바닥
    0, 2, 12,   12, 2, 14,   // 왼쪽
  ];
```

```js
  const pipeline = device.createRenderPipeline({
    ...
    primitive: {
-      cullMode: 'back',
+      cullMode: 'front',
    },
  });
```

이러한 변경 사항을 통해, 모든 삼각형들이 같은 방향을 향하게 되면, 우리는 이런 결과를 얻게 됩니다.

{{{example url="../webgpu-orthographic-projection-step-5-order-fixed.html"}}}

그렇게 되는 경우는 줄어들었지만, 여전히 한 가지 문제가 남아 있습니다. 모든 삼각형들이 올바른 방향을 향하고 있고, 우리에게서 멀어져 있는 삼각형들은 제거된 상태이지만, 여전히 뒤쪽에 있어야 할 삼각형들이 앞쪽에 있는 삼각형들 위에 그려지는 경우가 있습니다.

## <a id="a-depth-textures"></a>깊이 텍스처 사용하기

깊이 텍스처는, 때로는 깊이 버퍼나 Z-버퍼라고도 불립니다. 이는 *깊이* 텍스셋으로 구성된 직사각형 구조입니다. 우리가 그리는 텍스처 내의 각 색상 텍스셋마다 하나씩 깊이 텍스셋이 존재합니다. 만약 깊이 텍스처를 생성하고 사용한다면, WebGPU는 각 픽셀을 그릴 때 깊이 픽셀도 함께 그릴 수 있습니다. 이는 정점 셰이더에서 반환된 Z 값을 기반으로 이루어집니다. X와 Y의 경우와 마찬가지로, Z도 클립 공간에 있습니다. 클립 공간은 0부터 +1까지입니다.

새 프래그먼트의 깊이 값을 깊이 텍스처에 저장된 값과 비교합니다. 지정한 비교 조건을 통과한 프래그먼트의 색상만 기록하고, 깊이 쓰기가 켜져 있으면 깊이 값도 갱신합니다. 예를 들어 `less`에서는 이미 그린 면보다 뒤에 있는 프래그먼트가 걸러집니다.

깊이 텍스처를 설정하고 사용하려면, 우리의 파이프라인을 업데이트해야 합니다.

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
      cullMode: 'front',
    },
+    depthStencil: {
+      depthWriteEnabled: true,
+      depthCompare: 'less',
+      format: 'depth24plus',
+    },
  });
```

위에서 `depthCompare: 'less'`를 설정했습니다. 이는 새로운 픽셀의 Z 값이 깊이 텍스처에 있는 해당 픽셀의 Z 값보다 작을 경우에만 새로운 픽셀을 그려준다는 의미입니다. 다른 옵션으로는 `never`, `equal`, `less-equal`, `greater`, `not-equal`, `greater-equal`, `always`가 있습니다.

`depthWriteEnabled: true`라는 것은, `depthCompare` 테스트를 통과할 경우, 새로운 픽셀의 Z 값을 깊이 텍스처에 기록한다는 의미입니다. 즉, 우리가 그리는 각 픽셀의 Z 값이 깊이 텍스처에 이미 저장된 값보다 낮다면, 그 픽셀을 그려서 깊이 텍스처를 업데이트합니다. 이렇게 하면, 나중에 더 멀리 위치한 픽셀을 그려보려고 해도, 그 픽셀은 그려지지 않습니다.

`format`는 `fragment.targets[?].format`와 유사합니다. 이는 우리가 사용할 깊이 텍스처의 형식입니다. 사용 가능한 깊이 텍스처 형식들은 [깊이와 스텐실 포맷](webgpu-textures.html#a-depth-stencil-formats)에서 확인할 수 있습니다. `depth24plus`는 좋은 기본 형식입니다.

또한, 렌더 패스 설명자를 업데이트하여, 그 안에 depth stencil attachment 기능을 포함시켜야 합니다.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
+    depthStencilAttachment: {
+      // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
+      depthClearValue: 1.0,
+      depthLoadOp: 'clear',
+      depthStoreOp: 'store',
+    },
  };
```

깊이 값은 일반적으로 0.0에서 1.0까지입니다. 우리는 `depthClearValue`를 1로 설정했습니다. 이는 `depthCompare`을 `less`로 설정한 것과 일치합니다.

마지막으로, 깊이 텍스처를 생성해야 합니다. 문제는, 그 텍스처의 크기가 텍스트의 색상과 일치해야 한다는 점입니다. 이 경우, 텍스처는 캔버스에서 얻어지는 텍스처와 동일합니다. 캔버스의 크기가 변경될 때, `ResizeObserver` 콜백에서 캔버스의 크기도 함께 변경됩니다. 더 명확히 말하자면, `context.getCurrentTexture`를 호출할 때 얻어지는 텍스처의 크기는 캔버스의 크기에 따라 결정됩니다. 그렇다면, 렌더링 시에 올바른 크기의 텍스처를 생성해 보겠습니다.

```js
+  let depthTexture;

  function render() {
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
-    renderPassDescriptor.colorAttachments[0].view =
-        context.getCurrentTexture().createView();
+    const canvasTexture = context.getCurrentTexture();
+    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

+    // 만약 깊이 텍스처가 없거나, 혹은 그 크기가 다른 경우라면…
+    // 새로운 깊이 텍스처를 생성할 때, 캔버스 텍스처에서 발생하는 문제들
+    if (!depthTexture ||
+        depthTexture.width !== canvasTexture.width ||
+        depthTexture.height !== canvasTexture.height) {
+      if (depthTexture) {
+        depthTexture.destroy();
+      }
+      depthTexture = device.createTexture({
+        size: [canvasTexture.width, canvasTexture.height],
+        format: 'depth24plus',
+        usage: GPUTextureUsage.RENDER_ATTACHMENT,
+      });
+    }
+    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();

  ...
```

이제, 깊이 텍스처가 추가된 상태가 되었습니다.

{{{example url="../webgpu-orthographic-projection-step-6-depth-texture.html"}}}

그건 바로 3D입니다!

## `ortho`와 `orthographic`

대부분의 3D 수학 라이브러리에는 클립 공간과 픽셀 공간을 변환하는 `projection` 함수가 없습니다. 대신 보통 다음과 같은 `ortho` 또는 `orthographic` 함수가 있습니다.

```js
const mat4 = {
  ...
  ortho(left, right, bottom, top, near, far, dst) {
    dst = dst || new Float32Array(16);

    dst[0] = 2 / (right - left);
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;

    dst[4] = 0;
    dst[5] = 2 / (top - bottom);
    dst[6] = 0;
    dst[7] = 0;

    dst[8] = 0;
    dst[9] = 0;
    dst[10] = 1 / (near - far);
    dst[11] = 0;

    dst[12] = (right + left) / (left - right);
    dst[13] = (top + bottom) / (bottom - top);
    dst[14] = near / (near - far);
    dst[15] = 1;

    return dst;
  },
  ...
```

위에서 설명한 간단한 `projection` 함수와는 달리, 이 더 일반적인 직교 투영 함수는 너비, 높이, 깊이와 같은 매개변수뿐만 아니라 왼쪽, 오른쪽, 아래쪽, 위쪽, 가까운 곳, 멀리 있는 위치도 전달할 수 있습니다. 이를 원래의 투영 함수와 동일하게 사용하려면 다음과 같이 호출해야 합니다.

```js
-    mat4.projection(canvas.clientWidth, canvas.clientHeight, 400, matrixValue);
+    mat4.ortho(
+        0,                   // 왼쪽
+        canvas.clientWidth,  // 올바른쪽
+        canvas.clientHeight, // 바닥
+        0,                   // 상단
+        200,                 // 가까운 곳
+        -200,                // 파르
+        matrixValue,         // dst
+    );
```

{{{example url="../webgpu-orthographic-projection-step-7-ortho.html"}}}

다음 글에서는 멀리 있는 물체가 더 작게 보이도록 하는 [원근 투영](webgpu-perspective-projection.html)을 살펴보겠습니다.

<div class="webgpu_bottombar">
<h3>왜 그것을 ‘ Orthographic Projection’이라고 부르는 걸까요?</h3>
<p>
이 경우, ‘Orthographic’이라는 단어는 <i>orthogonal</i>라는 단어에서 유래했습니다.
</p>
<blockquote>
<h2>직교</h2>
<p><i>형용사</i>:</p>
<ol><li>직각을 포함하거나 직각과 관련된 것</li></ol>
</blockquote>
</div>

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-orthographic-projection.css" rel="stylesheet">
<script type="module" src="webgpu-orthographic-projection.js"></script>
