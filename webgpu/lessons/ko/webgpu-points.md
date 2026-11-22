Title: WebGPU 점
Description: WebGPU에서 점 그리기
TOC: 점

WebGPU에서는 렌더 파이프라인의 프리미티브 토폴로지를 `'point-list'`로 지정해 점을 그릴 수 있습니다.

[정점 버퍼에 관한 문서](webgpu-vertex-buffers.html)에서 제시된 아이디어를 바탕으로, 간단한 예시를 만들어보겠습니다.

먼저, 간단한 정점 셰이더와 프래그먼트 셰이더를 만들어보겠습니다. 간단하게 하기 위해, 위치 정보는 클립 공간 좌표를 사용하고, 색상은 노란색으로 고정시킬 것입니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@vertex fn vs(vert: Vertex,) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vert.position;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vec4f(1, 1, 0, 1); // 노란색
}
```

그런 다음, 파이프라인을 생성할 때, 토폴로지를 `'point-list'`로 설정합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '1 pixel points',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
+    primitive: {
+      topology: 'point-list',
+    },
  });
```

그럼, 정점 버퍼에 무작위로 선택된 클립 공간 점들을 채워보겠습니다.

```js
  const rand = (min, max) => min + Math.random() * (max - min);

  const kNumPoints = 100;
  const vertexData = new Float32Array(kNumPoints * 2);
  for (let i = 0; i < kNumPoints; ++i) {
    const offset = i * 2;
    vertexData[offset + 0] = rand(-1, 1);
    vertexData[offset + 1] = rand(-1, 1);
  }

  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
```

그런 다음 그려보세요.

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(kNumPoints);
    pass.end();
```

그렇게 해서, 우리는 100개의 무작위로 생성된 노란색 점들을 얻게 됩니다.

{{{example url="../webgpu-points.html"}}}

안타깝게도, 그들의 크기는 모두 1픽셀에 불과합니다. WebGPU는 1픽셀 크기의 포인트만을 지원합니다. 더 큰 크기의 객체를 만들고 싶다면, 직접 처리해야 합니다. 다행히도 이는 쉽게 할 수 있습니다. 그냥 쿼드를 만들고 [인스턴싱](webgpu-vertex-buffers.html#a-instancing)을 사용하면 됩니다.

정점 셰이더에 쿼드 포맷을 추가하고, 크기 관련 속성도 추가해 보겠습니다. 또한, 텍스처의 크기를 전달하기 위한 유니폼도 추가해 보겠습니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
+  @location(1) size: f32,
};

+struct Uniforms {
+  resolution: vec2f,
+};

struct VSOutput {
  @builtin(position) position: vec4f,
};

+@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(
    vert: Vertex,
+    @builtin(vertex_index) vNdx: u32,
) -> VSOutput {
+  let points = array(
+    vec2f(-1, -1),
+    vec2f( 1, -1),
+    vec2f(-1,  1),
+    vec2f(-1,  1),
+    vec2f( 1, -1),
+    vec2f( 1,  1),
+  );
  var vsOut: VSOutput;
+  let pos = points[vNdx];
-  vsOut.position = vec4f(vert.position, 0, 1);
+  vsOut.position = vec4f(vert.position + pos * vert.size / uni.resolution, 0, 1);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vec4f(1, 1, 0, 1); // 노란색
}
```

JavaScript에서는 각 점마다 크기를 나타내는 속성을 추가해야 합니다. 또한, `stepMode: 'instance'`를 설정하여 각 인스턴스마다의 이동 단계를 설정할 수 있습니다. 그리고, 기본값인 `'triangle-list'`를 유지하므로, 트opoLOGY 설정을 제거할 수 있습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'sizeable points',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
+          arrayStride: (2 + 1) * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
+          stepMode: 'instance',
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
+            {shaderLocation: 1, offset: 8, format: 'float32'},  // 크기
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
-    primitive: {
-      topology: 'point-list',
-    },
  });
```

각 정점의 데이터에 무작위 크기를 추가해 보겠습니다.

```js
  const kNumPoints = 100;
-  const vertexData = new Float32Array(kNumPoints * 2);
+  const vertexData = new Float32Array(kNumPoints * 3);
  for (let i = 0; i < kNumPoints; ++i) {
-    const offset = i * 2;
+    const offset = i * 3;
    vertexData[offset + 0] = rand(-1, 1);
    vertexData[offset + 1] = rand(-1, 1);
+    vertexData[offset + 2] = rand(1, 32);
  }
```

유니폼 버퍼가 필요합니다. 그래야만 해상도를 전달할 수 있습니다.

```js
  const uniformValues = new Float32Array(2);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const kResolutionOffset = 0;
  const resolutionValue = uniformValues.subarray(
      kResolutionOffset, kResolutionOffset + 2);
```

그리고, 유니폼 버퍼를 연결하기 위해서는 바인드 그룹이 필요합니다.

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: uniformBuffer },
    ],
  });
```

그런 다음, 렌더링 시간에 현재의 해상도에 맞게 유니폼 버퍼를 업데이트할 수 있습니다.

```js
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

+    // 유니폼 버퍼의 해상도를 업데이트합니다.
+    resolutionValue.set([canvasTexture.width, canvasTexture.height]);
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

그런 다음, 우리의 바인드 그룹을 설정하고, 각 포인트마다 인스턴스를 렌더링합니다.

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setBindGroup(0, bindGroup);
-    pass.draw(kNumPoints);
+    pass.draw(6, kNumPoints);
    pass.end();
```

이제 우리는 상당한 수의 점들을 가지고 있습니다.

{{{example url="../webgpu-points-w-size.html"}}}

만약 우리가 점들에 질감을 부여하고 싶다면 어떻게 해야 할까요? 그냥 정점 셰이더에서 질감 좌표를 프레그먼트 셰이더로 전달하면 됩니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) size: f32,
};

struct Uniforms {
  resolution: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
+  @location(0) texcoord: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(
    vert: Vertex,
    @builtin(vertex_index) vNdx: u32,
) -> VSOutput {
  let points = array(
    vec2f(-1, -1),
    vec2f( 1, -1),
    vec2f(-1,  1),
    vec2f(-1,  1),
    vec2f( 1, -1),
    vec2f( 1,  1),
  );
  var vsOut: VSOutput;
  let pos = points[vNdx];
  vsOut.position = vec4f(vert.position + pos * vert.size / uni.resolution, 0, 1);
+  vsOut.texcoord = pos * 0.5 + 0.5;
  return vsOut;
}
```

물론, 프래그먼트 셰이더에서는 텍스처를 사용해야 합니다.

```wgsl
+@group(0) @binding(1) var s: sampler;
+@group(0) @binding(2) var t: texture_2d<f32>;

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vec4f(1, 1, 0, 1); // 노란색
+  return textureSample(t, s, vsOut.texcoord);
}
```

[이미지 로딩](webgpu-importing-textures.html)에서 설명한 것처럼, 캔버스를 사용하여 간단한 텍스처를 만들어 보겠습니다.

```js
  const ctx = new OffscreenCanvas(32, 32).getContext('2d');
  ctx.font = '27px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥑', 16, 16);

  const texture = device.createTexture({
    size: [32, 32],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: ctx.canvas, flipY: true },
    { texture, premultipliedAlpha: true },
    [32, 32],
  );
```

그리고 우리는 샘플러가 필요합니다. 그러므로 그 샘플러들을 우리의 ‘bind group’에 추가해야 합니다.

```js
  const sampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: uniformBuffer },
+      { binding: 1, resource: sampler },
+      { binding: 2, resource: texture },
    ],
  });
```

또한, 블렌딩 기능도 활성화해 보겠습니다. [투명도와 블렌딩](webgpu-transparency.html)에서 다룬 블렌딩 설정을 사용하면 텍스처의 알파에 따라 점이 배경에 섞입니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'sizeable points with texture',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (2 + 1) * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
            {shaderLocation: 1, offset: 8, format: 'float32'},  // 크기
          ],
        },
      ],
    },
    fragment: {
      module,
-      targets: [{ format: presentationFormat }],
+      targets: [
+        {
+         format: presentationFormat,
+          blend: {
+            color: {
+              srcFactor: 'one',
+              dstFactor: 'one-minus-src-alpha',
+              operation: 'add',
+            },
+            alpha: {
+              srcFactor: 'one',
+              dstFactor: 'one-minus-src-alpha',
+              operation: 'add',
+            },
+          },
+        },
+      ],
    },
  });
```

이제 우리는 질감이 있는 점들을 가지고 있습니다.

{{{example url="../webgpu-points-w-texture.html"}}}

그리고 우리는 계속해서 이런 방식으로 진행할 수 있습니다. 그렇다면, 각 점마다 한 번씩 회전하는 것도 가능할까요? [행렬 연산](webgpu-matrix-math.html)에서 다루었던 수학적 방법을 활용하면 됩니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) size: f32,
+  @location(2) rotation: f32,
};

struct Uniforms {
  resolution: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(
    vert: Vertex,
    @builtin(vertex_index) vNdx: u32,
) -> VSOutput {
  let points = array(
    vec2f(-1, -1),
    vec2f( 1, -1),
    vec2f(-1,  1),
    vec2f(-1,  1),
    vec2f( 1, -1),
    vec2f( 1,  1),
  );
  var vsOut: VSOutput;
  let pos = points[vNdx];
+  let c = cos(vert.rotation);
+  let s = sin(vert.rotation);
+  let rot = mat2x2f(
+     c, s,
+    -s, c,
+  );
-  vsOut.position = vec4f(vert.position + pos * vert.size / uni.resolution, 0, 1);
+  vsOut.position = vec4f(vert.position + rot * pos * vert.size / uni.resolution, 0, 1);
  vsOut.texcoord = pos * 0.5 + 0.5;
  return vsOut;
      }
```

우리는 우리의 처리 과정에 ‘rotation’ 속성을 추가해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'sizeable rotatable points with texture',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (2 + 1) * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
+          arrayStride: (2 + 1 + 1) * 4, // 4개의 플로트, 각각 4바이트입니다.
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // 위치/상태
            {shaderLocation: 1, offset: 8, format: 'float32'},  // 크기
+            {shaderLocation: 2, offset: 12, format: 'float32'},  // 회전
          ],
        },
      ],
    },
    ...
```

정점 데이터에 회전 정보를 추가해야 합니다.

```js
  const kNumPoints = 100;
-  const vertexData = new Float32Array(kNumPoints * 3);
+  const vertexData = new Float32Array(kNumPoints * 4);
  for (let i = 0; i < kNumPoints; ++i) {
-    const offset = i * 3;
+    const offset = i * 4;
    vertexData[offset + 0] = rand(-1, 1);
    vertexData[offset + 1] = rand(-1, 1);
*    vertexData[offset + 2] = rand(10, 64);
+    vertexData[offset + 3] = rand(0, Math.PI * 2);
  }

```

또한, 🥑라는 텍스처를 👉로 변경해 보겠습니다.

```js
-  ctx.fillText('🥑', 16, 16);
+  ctx.fillText('👉', 16, 16);
```

{{{example url="../webgpu-points-w-rotation.html" }}}

# 그럼 3D 공간에서의 점들은 어떻게 될까요?

한 가지 방법은 [원근 투영](webgpu-perspective-projection.html)으로 정점의 위치를 계산한 다음, 그 결과에 사각형의 오프셋을 더하는 것입니다.

예를 들어, [피보나치 구체](https://www.google.com/search?q=fibonacci+sphere)의 3D 위치를 구하는 코드가 있습니다.

```js
function createFibonacciSphereVertices({
  numSamples,
  radius,
}) {
  const vertices = [];
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numSamples; ++i) {
    const offset = 2 / numSamples;
    const y = ((i * offset) - 1) + (offset / 2);
    const r = Math.sqrt(1 - Math.pow(y, 2));
    const phi = (i % numSamples) * increment;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    vertices.push(x * radius, y * radius, z * radius);
  }
  return new Float32Array(vertices);
}
```

각 점의 기준 위치도 카메라 강의에서 다룬 3D 변환으로 계산할 수 있습니다.

```wgsl
struct Vertex {
  @location(0) position: vec4f,
};

struct Uniforms {
*  matrix: mat4x4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(
    vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
*  let clipPos = uni.matrix * vert.position;
  vsOut.position = clipPos;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vec4f(1, 0.5, 0.2, 1);  // 오렌지
}
```

다음은 우리의 파이프라인과 정점 버퍼입니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '3d points with fixed size',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (3) * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [
        {
         format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: 'point-list',
    },
  });

  const vertexData = createFibonacciSphereVertices({
    radius: 1,
    numSamples: 1000,
  });
  const kNumPoints = vertexData.length / 3;

  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
```

또한, 행렬에 사용되는 버퍼와 값들도 모두 일관된 형태여야 합니다. 또한, 셰이더가 해당 버퍼를 사용할 수 있도록 하는 bindGroup도 필요합니다.

```js
  const uniformValues = new Float32Array(16);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const kMatrixOffset = 0;
  const matrixValue = uniformValues.subarray(
      kMatrixOffset, kMatrixOffset + 16);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: uniformBuffer },
    ],
  });
```

그리고 투영 행렬, 카메라, 그리고 다른 3D 수학적 방법을 사용하여 그림을 그리는 코드도 있습니다.

```js
  function render(time) {
    time *= 0.001;

    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

    // 유니폼 버퍼에 행렬를 설정합니다.
    const fov = 90 * Math.PI / 180;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(fov, aspect, 0.1, 50);
    const view = mat4.lookAt(
      [0, 0, 1.5],  // 위치/상태
      [0, 0, 0],    // 목표/대상
      [0, 1, 0],    // 위로
    );
    const viewProjection = mat4.multiply(projection, view);
    mat4.rotateY(viewProjection, time, matrixValue);
    mat4.rotateX(matrixValue, time * 0.5, matrixValue);

    // 유니폼 값들을 GPU로 복사해 주세요.
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(kNumPoints);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
```

또한, `requestAnimationFrame` 루프를 사용하기로 변경했습니다.

{{{example url="../webgpu-points-3d-1px.html"}}}

그건 잘 보이지 않아요. 그래서 위에서 설명한 기술들을 적용하기 위해서는, 이전과 마찬가지로 ‘인 쿼드 위치’에 그 값을 더해주는 것입니다.

```wgsl
struct Vertex {
  @location(0) position: vec4f,
};

struct Uniforms {
  matrix: mat4x4f,
+  resolution: vec2f,
+  size: f32,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(
    vert: Vertex,
+    @builtin(vertex_index) vNdx: u32,
) -> VSOutput {
+  let points = array(
+    vec2f(-1, -1),
+    vec2f( 1, -1),
+    vec2f(-1,  1),
+    vec2f(-1,  1),
+    vec2f( 1, -1),
+    vec2f( 1,  1),
+  );
  var vsOut: VSOutput;
+  let pos = points[vNdx];
  let clipPos = uni.matrix * vert.position;
+  let pointPos = vec4f(pos * uni.size / uni.resolution, 0, 0);
-  vsOut.position = clipPos;
+  vsOut.position = clipPos + pointPos;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vec4f(1, 0.5, 0.2, 1);
}
```

이전의 예시와 달리, 각 정점에 다른 크기를 사용하지는 않습니다. 대신, 모든 정점에 동일한 크기를 사용합니다.

```js
-  const uniformValues = new Float32Array(16);
+  const uniformValues = new Float32Array(16 + 2 + 1 + 1);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const kMatrixOffset = 0;
+  const kResolutionOffset = 16;
+  const kSizeOffset = 18;
  const matrixValue = uniformValues.subarray(
      kMatrixOffset, kMatrixOffset + 16);
+  const resolutionValue = uniformValues.subarray(
+      kResolutionOffset, kResolutionOffset + 2);
+  const sizeValue = uniformValues.subarray(
+      kSizeOffset, kSizeOffset + 1);
```

위에서 설명한 것처럼, 해상도를 설정해야 합니다. 또한, 크기도 정해야 합니다.

```js
  function render(time) {
    ...
+    // 유니폼 버퍼의 크기를 설정합니다.
+    sizeValue[0] = 10;

    const fov = 90 * Math.PI / 180;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(fov, aspect, 0.1, 50);
    const view = mat4.lookAt(
      [0, 0, 1.5],  // 위치/상태
      [0, 0, 0],    // 목표/대상
      [0, 1, 0],    // 위로
    );
    const viewProjection = mat4.multiply(projection, view);
    mat4.rotateY(viewProjection, time, matrixValue);
    mat4.rotateX(matrixValue, time * 0.5, matrixValue);

+    // 유니폼 버퍼의 해상도를 업데이트합니다.
+    resolutionValue.set([canvasTexture.width, canvasTexture.height]);

    // 유니폼 값들을 GPU로 복사해 주세요.
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

앞에서처럼 점 하나를 그리는 대신 인스턴싱으로 사각형을 그립니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '3d points',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (3) * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
+          stepMode: 'instance',
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [
        {
         format: presentationFormat,
        },
      ],
    },
-    primitive: {
-      topology: 'point-list',
-    },
  });

  ...

  function render(time) {

    ...

-    pass.draw(kNumPoints);
+    pass.draw(6, kNumPoints);

    ...
```

이를 통해 3D 공간에서 점들이 생성됩니다. 또한, 점들은 카메라와의 거에 따라 크기가 조절됩니다.

{{{example url="../webgpu-points-3d.html"}}}

## <a id="a-fixed-size-3d-points"></a> 고정된 크기의 3D 점

만약 점들의 크기를 일정하게 유지하고 싶다면 어떻게 해야 할까요?

[원근 투영](webgpu-perspective-projection.html)에서 언급했듯이, GPU는 정점 셰이더에서 반환된 위치를 W로 나눕니다. 이러한 분할 방식 덕분에, 멀리 있는 물체들이 더 작게 보입니다. 따라서, 크기를 변경하고 싶지 않은 점들의 경우, 그 점들을 W로 곱하기만 하면 됩니다. 그러면 분할된 후에 원하는 값이 얻어집니다.

```wgsl
    var vsOut: VSOutput;
    let pos = points[vNdx];
    let clipPos = uni.matrix * vert.position;
-    let pointPos = vec4f(pos * uni.size / uni.resolution, 0, 0);
+    let pointPos = vec4f(pos * uni.size / uni.resolution * clipPos.w, 0, 0);
    vsOut.position = clipPos + pointPos;
    return vsOut;
```

그리고 이제는 그 크기가 변하지 않았습니다.

{{{example url="../webgpu-points-3d-fixed-size.html"}}}

<div class="webgpu_bottombar">
<h3>왜 WebGPU는 1x1픽셀보다 큰 크기의 포인트를 지원하지 않나요?</h3>
<p>WebGPU는 Vulkan, Metal, DirectX, 그리고 OpenGL과 같은 네이티브 GPU API들을 기반으로 구축되었습니다. 하지만 안타깝게도, 이러한 API들은 점을 렌더링하는 방법에 대해 서로 다른 규칙을 가지고 있습니다. 일부 API는 장치에 따라 점의 크기에 대한 제한을 두고 있습니다. 또 다른 API들은 점의 중심이 클립 공간 밖에 있을 경우 그 점을 렌더링하지 않습니다. 반면, 또 다른 API들은 이 문제를 드라이버가 결정하도록 합니다. 이러한 문제들 때문에 WebGPU는 포터블한 방식을 선택하여, 1x1 크기의 픽셀만을 지원하기로 결정했습니다.</p>
<p>좋은 점은, 위에서 보여준 것처럼, 더 큰 점들을 쉽게 처리할 수 있다는 것입니다. 위에서 제시된 해결 방법들은 다양한 기기에서도 사용할 수 있으며, 점의 크기에 대한 제한도 없습니다. 또한, 이 방법을 사용하면 모든 기기에서 점들을 일관되게 처리할 수 있습니다. 점의 중심이 클립 공간 밖에 있든, 그렇지 않든 상관없이, 클립 공간 내에 있는 점의 부분만을 그려냅니다.</p>
<p>더 나아가, 이러한 솔루션들은 훨씬 더 유연합니다. 예를 들어, 점을 회전시키는 기능은 기존의 API에서는 지원되지 않습니다. 하지만 우리만의 솔루션을 구현함으로써, 더 많은 기능을 쉽게 추가할 수 있습니다. 그렇게 하면 시스템의 유연성이 더욱 향상됩니다.</p>
</div>
