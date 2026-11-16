Title: WebGPU Immediates
Description: Immediates
TOC: Immediates

이 글은 셰이더에 데이터를 전달하는 다양한 방법에 대한 시리즈 중 하나입니다.
각 글은 이전 내용을 바탕으로 작성되었으므로 순서대로 읽는 것이 가장 이해하기 좋습니다.

{{{toc-steps list="passing-data.hanson"}}}

<div class="warn">
Immediates는 WebGPU의 새로운 기능(2026년)입니다. 이 기능은 **Core** 기능으로,
기기에 관계없이 어디서나 사용할 수 있도록 제공될 예정입니다.
2026년 말까지 모든 브라우저에 적용되기를 기대하고 있습니다.
<code>wgslLanguageFeatures</code>에 <code>'immediate_address_space'</code>가 있는지 확인하여 지원 여부를 알 수 있습니다.
<pre class="prettyprint lang-javascript"><code>
const canUseImmediates = navigator.gpu.wgslLanguageFeatures.has('immediate_address_space');
</code></pre>
2027년에는 이 확인이 더 이상 필요하지 않게 되는 것이 이상적입니다.
</div>

Immediates는 작은 데이터를 셰이더에 쉽게 전달하는 방법입니다.
[유니폼 글](webgpu-uniforms.html)과 [스토리지 버퍼 글](webgpu-storage-buffers.html)에서는
버퍼를 통해 셰이더에 데이터를 전달하는 방법을 살펴보았습니다. 셰이더에 `var<uniform>` 또는 `var<storage, ...>` 바인딩을 정의하고 버퍼를 해당 바인딩에 연결했습니다. Immediates는 바인딩 없이 `var<immediate>`를 사용합니다.

`var<immediate>`와 `var<uniform>`, `var<storage>`의 차이점은 다음과 같습니다.

* 셰이더마다 `var<immediate>`를 하나만 사용할 수 있습니다

  `var<uniform>`과 `var<storage, ...>`는 여러 바인딩을 선언할 수 있지만,
  `var<immediate>`는 하나만 선언할 수 있습니다.

* Immediates는 전체 크기가 64바이트로 제한됩니다 [^maxImmediateSize]

[^maxImmediateSize]: `maxImmediateSize` 제한을 통해 64바이트보다 큰 크기를 [요청](webgpu-limits-and-features.html)할 수 있을 수도 있습니다.

* 모든 Immediates를 초기화해야 합니다

  버퍼의 내용은 0으로 초기화되지만 Immediates는 초기화되지 않으므로 명시적으로 초기화해야 합니다.
  그렇지 않으면 유효성 검사 오류가 발생합니다.

* Immediates는 다음 경우에 미정의 상태로 재설정됩니다

  * 새 컴퓨트 패스나 렌더 패스를 시작할 때
  * 렌더 번들을 실행할 때
  * 렌더 번들을 실행한 후

Immediates는 작은 유니폼 버퍼라고 생각할 수 있습니다.
하나만 있고 크기도 작습니다. `passEncoder.setImmediates`로 값을 설정합니다.

[기초 글의 마지막](webgpu-fundamentals.html#a-resizing)에 있는 간단한 삼각형 예제를 가져와
Immediates를 사용하여 서로 다른 색상의 삼각형 3개를 그리도록 바꿔 보겠습니다.

먼저 셰이더에 오프셋과 색상을 추가하겠습니다.

```wgsl
+struct MyImmediates {
+  color: vec4f,
+  offset: vec2f,
+};
+
+var<immediate> myImmediates: MyImmediates;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // 상단 중앙
    vec2f(-0.5, -0.5),  // 왼쪽 아래
    vec2f( 0.5, -0.5)   // 오른쪽 아래
  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return vec4f(pos[vertexIndex] + myImmediates.offset, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(1, 0, 0, 1);
+  return myImmediates.color;
}
```

그다음 자바스크립트에서 3번 그리도록 수정하고, 매번 `setImmediates`로 Immediates를 설정하여
서로 다른 위치에 다른 색상으로 그리겠습니다.

```js
  function render() {
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

    const encoder = device.createCommandEncoder({ label: 'our encoder' });
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
+    pass.setImmediates(0, new Float32Array([
+      1, 0, 0, 1,  // 색상
+      -0.4, -0.2,  // 오프셋
+    ]));
    pass.draw(3);

+    pass.setImmediates(0, new Float32Array([
+      0, 1, 0, 1,  // 색상
+      0.4, -0.2,   // 오프셋
+    ]));
+    pass.draw(3);
+
+    pass.setImmediates(0, new Float32Array([
+      0, 0, 1, 1,  // 색상
+      0.0, 0.2,    // 오프셋
+    ]));
+    pass.draw(3);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

`var<uniform>`과 `var<storage, ...>`처럼 Immediates도 같은 [메모리 레이아웃 규칙](webgpu-memory-layout.html)을 따릅니다.
`setImmediates`의 인수는 다음과 같습니다.

```js
passEncoder.setImmediates(
  byteOffset,  // Immediates에서의 오프셋
  src,         // ArrayBufferView 또는 ArrayBuffer
  srcOffset?,  // src에서 시작할 위치의 요소 단위 오프셋
  size?,       // 요소의 개수
);
```

이 예제에서는 `setImmediates`를 호출할 때마다 `Float32Array` 전체를 전달하므로 마지막 두 선택적 인수는 필요하지 않습니다.
`srcOffset`의 기본값은 0이고 `size`의 기본값은 `src`의 크기입니다.

{{{example url="../webgpu-immediates-triangles.html"}}}

64바이트로 제한된 Immediates를 어디에 쓸 수 있을지 궁금하실 수 있습니다.

가장 흔한 용도는 아마도 다른 데이터의 인덱스를 전달하는 것일 겁니다.
모델별 스토리지 버퍼 배열과 재질별 스토리지 버퍼 배열을 만든다고 생각해 보겠습니다.

```wgsl
struct PerModel {
  matrix: mat4x4f,
};

struct Material {
  color: vec4f,
  shininess: f32,
};

@group(0) @binding(0) var<storage, read> models: array<PerModel>;
@group(0) @binding(1) var<storage, read> materials: array<Material>;
...
```

그런 다음 Immediates로 `PerModel`과 `Material` 값을 선택할 수 있습니다.

```wgsl
struct RenderIndices {
  modelNdx: u32,
  materialNdx: u32,
};
var<immediate> renderIndices: RenderIndices;

... 정점 셰이더에서 ...

   let modelMatrix = models[renderIndices.modelNdx];

... 프래그먼트 셰이더에서 ...

   let material = materials[renderIndices.materialNdx];

```

이제 렌더링할 때 인덱스만 전달하여 모델별 데이터와 재질 데이터를 선택할 수 있습니다.

```js
   pass.setImmediates(0, new Uint32Array([modelNdx, materialNdx]))
```

모델과 재질마다 유니폼 버퍼를 관리할 필요가 없으므로 이는 [최적화](webgpu-optimization.html)가 될 수 있습니다.

다음은 전체 셰이더 예제입니다.

```wgsl
struct Material {
  color: vec4f,
};

struct PerModel {
  matrix: mat4x4f,
};

struct Globals {
  viewProjection: mat4x4f,
};

struct Vertex {
  @location(0) position: vec4f,
};

struct MyImmediates {
  modelNdx: u32,
  materialNdx: u32,
};

@group(0) @binding(0) var<storage, read> materials: array<Material>;
@group(0) @binding(1) var<storage, read> perModel: array<PerModel>;
@group(0) @binding(2) var<uniform> glb: Globals;

var<immediate> imm: MyImmediates;

@vertex fn vs(v: Vertex) -> @builtin(position) vec4f {
  let model = perModel[imm.modelNdx];
  return glb.viewProjection * model.matrix * v.position;
}

@fragment fn fs() -> @location(0) vec4f {
  let material = materials[imm.materialNdx];
  return material.color;
}
```

위 셰이더는 Immediates로 재질과 모델별 데이터를 선택합니다. 정점의 위치를 정하기 위해 [행렬 연산](webgpu-matrix-math.html)을 사용합니다.

또한 모든 모델이 공유하는 값을 위한 전역 유니폼 버퍼가 있습니다. 여기서는 공유 [뷰 투영 행렬](webgpu-orthographic-projection.html)을 사용합니다.

이 셰이더를 사용하고 정점마다 부동소수점 값 2개를 사용하는 [정점 버퍼](webgpu-vertex-buffers.html)를 지정하는 파이프라인을 만듭니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'our select model and material via immediates pipeline',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        // 위치
        {
          arrayStride: 2 * 4, // 부동소수점 값 2개, 각각 4바이트
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},
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

삼각형, 사각형, 원의 세 가지 도형을 위한 정점 버퍼를 만듭니다.

```js
  const squareVertices = [
    -0.5, -0.5,
     0.5, -0.5,
    -0.5,  0.5,
    -0.5,  0.5,
     0.5, -0.5,
     0.5,  0.5,
  ];
  const triangleVertices = [
     0,    0.5,
    -0.5, -0.5,
     0.5, -0.5,
  ];
  const circleVertices = [];
  const numCircleTriangles = 100;
  for (let i = 0; i < numCircleTriangles; ++i) {
    const angle0 = (i + 0) / numCircleTriangles * 2 * Math.PI;
    const angle1 = (i + 1) / numCircleTriangles * 2 * Math.PI;
    circleVertices.push(Math.cos(angle0) * 0.5, Math.sin(angle0) * 0.5);
    circleVertices.push(Math.cos(angle1) * 0.5, Math.sin(angle1) * 0.5);
    circleVertices.push(0, 0);
  }

  function createVertexBuffer(device, data) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return { buffer, numVertices: data.length / 2 };
  }

  const vertices = [
    createVertexBuffer(
      device, new Float32Array(triangleVertices)),
    createVertexBuffer(
      device, new Float32Array(circleVertices)),
    createVertexBuffer(
      device, new Float32Array(squareVertices)),
  ];
```

다음으로 재질 6개를 담는 스토리지 버퍼를 만들겠습니다.

```js
  const materialData = new Float32Array([
    1.0, 0.5, 0.5, 1.0,  // 빨간색
    0.5, 1.0, 0.5, 1.0,  // 초록색
    0.5, 0.5, 1.0, 1.0,  // 파란색
    1.0, 1.0, 0.5, 1.0,  // 노란색
    1.0, 0.5, 1.0, 1.0,  // 자홍색
    0.5, 1.0, 1.0, 1.0,  // 청록색
  ]);
  const numMaterials = materialData.length / 4;
  const materialBuffer = device.createBuffer({
    label: 'our material buffer',
    size: materialData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(materialBuffer, 0, materialData);
```

그리고 정점 버퍼, 재질, 모델별 데이터의 조합으로 이루어진 "모델" 200개를 정의하겠습니다.

```js
  const models = [];
  const numModels = 200;
  const modelData = new Float32Array(numModels * 16);
  for (let i = 0; i < numModels; ++i) {
    const modelNdx = i;
    const materialNdx = randInt(numMaterials);
    const geometryNdx = randInt(vertices.length);
    const {buffer, numVertices} = vertices[geometryNdx];

    const mat = mat4.translation([(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0]);
    mat4.rotateZ(mat, Math.random() * Math.PI  * 2, mat);
    mat4.scale(mat, [Math.random() * 0.1 + 0.1, Math.random() * 0.1 + 0.1, 1], mat);

    modelData.set(mat, i * 16);

    models.push({
      numVertices,
      vertexBuffer: buffer,
      immediates: new Uint32Array([
        modelNdx,
        materialNdx,
      ]),
    });
  }
```

위에서는 [행렬 연산](webgpu-matrix-math.html)을 사용하여 무작위 위치, 크기, 방향을 선택했습니다. 이 값은 모델 데이터에 저장됩니다.

그런 다음 이 데이터를 스토리지 버퍼에 업로드해야 합니다.

```js
  const perModelBuffer = device.createBuffer({
    label: 'our per model buffer',
    size: modelData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(perModelBuffer, 0, modelData);
```

모든 모델이 사용할 공유 버퍼도 있습니다. 여기에 [투영 행렬](webgpu-orthographic-projection.html)을 저장합니다.

```js
  const sharedData = new Float32Array(16);
  const sharedBuffer = device.createBuffer({
    label: 'our shared data buffer',
    size: sharedData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
```

다음으로 세 버퍼를 참조하는 바인드 그룹을 만듭니다.

```js
  const bindGroup = device.createBindGroup({
    label: 'our bind group',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: materialBuffer },
      { binding: 1, resource: perModelBuffer },
      { binding: 2, resource: sharedBuffer },
    ],
  });
```

마지막으로 렌더링할 수 있습니다. 먼저 렌더링 결과가 캔버스의 종횡비에 맞도록 [직교 행렬](webgpu-orthographic-projection.html)을 계산하고 공유 버퍼에 업로드합니다.

```js
  function render() {
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

+    const aspect = context.canvas.clientWidth / context.canvas.clientHeight;
+    mat4.ortho(-aspect, aspect, -1, 1, -1, 1, sharedData);
+    device.queue.writeBuffer(sharedBuffer, 0, sharedData);
```

그다음 모든 모델을 렌더링합니다.

```js
  function render() {
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

    const aspect = context.canvas.clientWidth / context.canvas.clientHeight;
    mat4.ortho(-aspect, aspect, -1, 1, -1, 1, sharedData);
    device.queue.writeBuffer(sharedBuffer, 0, sharedData);

    const encoder = device.createCommandEncoder({ label: 'our encoder' });
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
*    pass.setBindGroup(0, bindGroup);
*    for (let i = 0; i < numModels; ++i) {
*      const { immediates, vertexBuffer, numVertices } = models[i];
*      pass.setImmediates(0, immediates);
*      pass.setVertexBuffer(0, vertexBuffer);
*      pass.draw(numVertices);
*    }
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

이렇게 Immediates로 재질과 모델별 데이터를 선택하여 여러 모델을 그리고 있습니다.

{{{example url="../webgpu-immediates-models.html"}}}

이 글이 Immediates를 어떻게 사용하는지 이해하는 데 도움이 되었기를 바랍니다. 64바이트라는 작은 제한 때문에 이를 활용하려면 대체로 창의적인 방법이 필요합니다.