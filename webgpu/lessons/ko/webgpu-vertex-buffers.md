Title: WebGPU 정점 버퍼
Description: 정점 데이터를 셰이더로 전달하기
TOC: 정점 버퍼

[이전 글](webgpu-storage-buffers.html)에서 우리는 정점 데이터를 
스토리지 버퍼에 넣고 내장변수(builtin) `vertex_index`를 사용해 인덱싱했습니다.
이러한 방법이 유명해지고 있긴 하지만, 전통적으로 정점 데이터를 정점 셰이더로 
넘기는 방법은 정점 버퍼와 어트리뷰트(attribute)를 사용하는 방법입니다.

정점 버퍼는 다른 WebGPU 버퍼들과 다를 바 없습니다. 데이터를 저장하죠.
차이점이라면 정점 셰이더로부터 직접 접근하지 않는다는 점입니다.
대신에, WebGPU에게 어떤 데이터가 버퍼에 있고, 어떤 구조로 저장되어 있는지 알려줍니다.
그러면 데이터를 버퍼로부터 가져와 전달해줍니다.

[지난 글](webgpu-storage-buffers.html)의 마지막 예제를 가져와서, 
스토리지 버퍼 대신에 정점 버퍼를 사용하도록 수정해 보겠습니다.

먼저 셰이더부터 정점 버퍼로부터 정점 데이터를 가져오도록 수정합니다.

```wgsl
struct OurStruct {
  color: vec4f,
  offset: vec2f,
};

struct OtherStruct {
  scale: vec2f,
};

+struct Vertex {
+  @location(0) position: vec2f,
+};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
-@group(0) @binding(2) var<storage, read> pos: array<Vertex>;

@vertex fn vs(
-  @builtin(vertex_index) vertexIndex : u32,
+  vert: Vertex,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let otherStruct = otherStructs[instanceIndex];
  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
  vsOut.position = vec4f(
-      pos[vertexIndex].position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
+      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
  vsOut.color = ourStruct.color;
  return vsOut;
}

...
```

보신 것처럼 수정된 것이 별로 없습니다.
정점 데이터를 정의하는 `Vertex` 구조체를 선언하였습니다.
중요한 부분은 position 필드를 `@location(0)`로 선언한 부분입니다.

그리고 렌더 파이프라인을 만들 때, WebGPU에게 어떻게 `@location(0)`에게 데이터를 전달해야 하는지 알려주어야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'vertex buffer pipeline',
    layout: 'auto',
    vertex: {
      module,
+      buffers: [
+        {
+          arrayStride: 2 * 4, // 2개 부동소수점 각각 4바이트
+          attributes: [
+            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+          ],
+        },
+      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```
[`pipeline` 기술자(descriptor)](GPURenderPipelineDescriptor)의 [`vertex`](GPUVertexState)에 `buffers` 배열을 추가하였습니다. 
이는 하나 이상의 정점 버퍼로부터 데이터를 어떻게 가져올지를 명시합니다.
우리의 유일한 버퍼에 대해 `arrayStride`를 바이트 단위로 명시하였습니다.
이 경우 *stride*는 버퍼에서 하나의 정점 데이터를 얻기 위해 얼마만큼의 바이트를 읽어야 하는지를 의미합니다.

<div class="webgpu_center"><img src="resources/vertex-buffer-one.svg" style="width: 1024px;"></div>

우리 데이터는 `vec2f`이므로 두 개의 float32 숫자이고, `arrayStride`를 8로 설정합니다.

다음으로 어트리뷰트의 배열을 정의합니다. 지금은 요소가 하나입니다.
`shaderLocation: 0`이 `Vertex` 구조체의 `location(0)`에 해당합니다.
`offset: 0`은 이 어트리뷰트의 데이터가 정점 버퍼의 0바이트부터 시작한다는 의미입니다.
마지막으로 `format: 'float32x2'`는 WebGPU가 버퍼로부터 두 개의 32비트 부동소수점으로 숫자를 읽어오라는 의미입니다.

버퍼의 usages를 `STORAGE`에서 `VERTEX`로 수정하고 바인드 그룹에서 제거합니다.

```js
-  const vertexStorageBuffer = device.createBuffer({
-    label: 'storage buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
-  });
+  const vertexBuffer = device.createBuffer({
+    label: 'vertex buffer vertices',
+    size: vertexData.byteLength,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const bindGroup = device.createBindGroup({
    label: 'bind group for objects',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: staticStorageBuffer }},
      { binding: 1, resource: { buffer: changingStorageBuffer }},
-      { binding: 2, resource: { buffer: vertexStorageBuffer }},
    ],
  });
```

그리고 그리기 시점에는 WebGPU에게 어떤 정점 버퍼를 사용할지 명시해주어야 합니다.

```js
    pass.setPipeline(pipeline);
+    pass.setVertexBuffer(0, vertexBuffer);
```

여기서 `0`은 위 렌더 파이프라인의 `buffers` 배열의 요소를 가리키는 인덱스입니다.

이렇게 하면 정점에 대해 스토리지 버퍼에서 정점 버퍼로 바꾸는 과정이 완료됩니다.

{{{example url="../webgpu-vertex-buffers.html"}}}

드로우 커맨드가 실행되는 시점의 상태는 아래 그림과 같을겁니다.

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram-vertex-buffer.svg" style="width: 960px;"></div>

어트리뷰트의 `format` 필드는 아래 타입 중 하나입니다.

<div class="webgpu_center data-table">
  <style>
    .vertex-type {
      text-align: center;
    }
  </style>
  <div>
  <table class="vertex-type">
    <thead>
     <tr>
      <th>Vertex format</th>
      <th>Data type</th>
      <th>Components</th>
      <th>Byte size</th>
      <th>Example WGSL type</th>
     </tr>
    </thead>
    <tbody>
      <tr><td><code>"uint8x2"</code></td><td>unsigned int </td><td>2 </td><td>2 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint8x4"</code></td><td>unsigned int </td><td>4 </td><td>4 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint8x2"</code></td><td>signed int </td><td>2 </td><td>2 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint8x4"</code></td><td>signed int </td><td>4 </td><td>4 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm8x2"</code></td><td>unsigned normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm8x4"</code></td><td>unsigned normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm8x2"</code></td><td>signed normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm8x4"</code></td><td>signed normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint16x2"</code></td><td>unsigned int </td><td>2 </td><td>4 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint16x4"</code></td><td>unsigned int </td><td>4 </td><td>8 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint16x2"</code></td><td>signed int </td><td>2 </td><td>4 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint16x4"</code></td><td>signed int </td><td>4 </td><td>8 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm16x2"</code></td><td>unsigned normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm16x4"</code></td><td>unsigned normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm16x2"</code></td><td>signed normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm16x4"</code></td><td>signed normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"float16x2"</code></td><td>float </td><td>2 </td><td>4 </td><td><code>vec2&lt;f16&gt;</code>, <code>vec2h</code></td></tr>
      <tr><td><code>"float16x4"</code></td><td>float </td><td>4 </td><td>8 </td><td><code>vec4&lt;f16&gt;</code>, <code>vec4h</code></td></tr>
      <tr><td><code>"float32"</code></td><td>float </td><td>1 </td><td>4 </td><td><code>f32</code></td></tr>
      <tr><td><code>"float32x2"</code></td><td>float </td><td>2 </td><td>8 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"float32x3"</code></td><td>float </td><td>3 </td><td>12 </td><td><code>vec3&lt;f32&gt;</code>, <code>vec3f</code></td></tr>
      <tr><td><code>"float32x4"</code></td><td>float </td><td>4 </td><td>16 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint32"</code></td><td>unsigned int </td><td>1 </td><td>4 </td><td><code>u32</code></td></tr>
      <tr><td><code>"uint32x2"</code></td><td>unsigned int </td><td>2 </td><td>8 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint32x3"</code></td><td>unsigned int </td><td>3 </td><td>12 </td><td><code>vec3&lt;u32&gt;</code>, <code>vec3u</code></td></tr>
      <tr><td><code>"uint32x4"</code></td><td>unsigned int </td><td>4 </td><td>16 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint32"</code></td><td>signed int </td><td>1 </td><td>4 </td><td><code>i32</code></td></tr>
      <tr><td><code>"sint32x2"</code></td><td>signed int </td><td>2 </td><td>8 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint32x3"</code></td><td>signed int </td><td>3 </td><td>12 </td><td><code>vec3&lt;i32&gt;</code>, <code>vec3i</code></td></tr>
      <tr><td><code>"sint32x4"</code></td><td>signed int </td><td>4 </td><td>16 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

## <a id="a-instancing"></a>정점 버퍼를 사용한 인스턴싱

어트리뷰트는 정점별(per vertex)이나 인스턴스별(per instance)로 확장될 수 있습니다. 
인스턴스별로 확장하는 것은 이전에 `otherStructs[instanceIndex]`와 `ourStructs[instanceIndex]`에서처럼 `@builtin(instance_index)`로부터 `instanceIndex`의 값을 가져오는 것과 동일합니다.

이전과 동일한 작업을 하기 위해 스토리지 버퍼 대신 정점 버퍼를 사용해 봅시다.
먼저 셰이더 쪽에서 스토리지 버퍼 대신 정점 어트리뷰를 사용하도록 수정합니다.

```wgsl
-struct OurStruct {
-  color: vec4f,
-  offset: vec2f,
-};
-
-struct OtherStruct {
-  scale: vec2f,
-};

struct Vertex {
  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

-@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
-@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

@vertex fn vs(
  vert: Vertex,
-  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
-  let otherStruct = otherStructs[instanceIndex];
-  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
-  vsOut.color = ourStruct.color;
+  vsOut.position = vec4f(
+      vert.position * vert.scale + vert.offset, 0.0, 1.0);
+  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

이제 렌더 파이프라인을, 해당 어트리뷰트들에 데이터를 어떻게 전달할건지를 알려주기 위해 수정해야 합니다.
최소한의 수정만 하기 위해 그토리지 버퍼에서 만든 데이터를 거의 그대로 사용할 것입니다. 
하나의 버퍼에는 각 인스턴스의 `color`와 `offset` 값을, 하나의 버퍼에는 `scale` 값을 갖도록 하려 총 두 개의 버퍼를 사용할 것입니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'flat colors',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
          ],
        },
+        {
+          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
+            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+          ],
+        },
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+          ],
+        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

`buffers` 배열에 두 개 요소를 추가하여 총 세 개의 버퍼를 갖게 되었습니다. 
즉 WebGPU에 데이터를 세 개 버퍼로 전달할 것임을 알려준 것입니다.

두 개의 새로운 요소의 `stepMode`를 `instance`로 설정하였습니다.
이는 이 어트리뷰트는 인스턴스별로 새로운 값을 얻어온다는 의미입니다. 
기본값은 `stepMode: 'vertex'`인데 이는 정점별로 새로운 값을 얻어오는 것입니다 (그리고 각 인스턴스에서는 처음부터 읽기 시작).

두 개의 버퍼가 있습니다. `scale`만 가지고 있는 버퍼는 간단합니다. 
`position` 값을 갖는 버퍼와 마찬가지로 정점마다 두 개의 32비트 부동소수점 값을 갖습니다.

`color`와 `offset`을 갖는 다른 버퍼는 아래와 같이 데이터가 엮어지게 될겁니다.

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x4-f32x2.svg" style="width: 1024px;"></div>

따라서 위해서 다음 데이터를 얻기 위해 건너야 하는 바이트인 `arrayStride`를 `6 * 4`, 즉 여섯 개의 32비트 부동소수점(4바이트)로 설정하였습니다. 
`color`는 0바이트부터 읽기 시작하지만 `offset`은 16바이트부터 읽기 시작해야 합니다.

다음으로 버퍼를 설정하는 코드를 수정합니다.

```js
  // create 2 storage buffers
  const staticUnitSize =
    4 * 4 + // color is 4 32bit floats (4bytes each)
-    2 * 4 + // offset is 2 32bit floats (4bytes each)
-    2 * 4;  // padding
+    2 * 4;  // offset is 2 32bit floats (4bytes each)

  const changingUnitSize =
    2 * 4;  // scale is 2 32bit floats (4bytes each)
*  const staticVertexBufferSize = staticUnitSize * kNumObjects;
*  const changingVertexBufferSize = changingUnitSize * kNumObjects;

*  const staticVertexBuffer = device.createBuffer({
*    label: 'static vertex for objects',
*    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

*  const changingVertexBuffer = device.createBuffer({
*    label: 'changing vertex for objects',
*    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

```

정점 어트리뷰트는 스토리지 버퍼의 구조체와 동일한 패딩(padding) 제약을 갖지는 않으니 여기서는 패딩은 필요 없습니다.
이 외에는 `STORAGE`를 `VERTEX`로 수정한 것 밖에는 없습니다 (변수 이름도 

이제 스토리지 버퍼는 사용하지 않으니 바인드그룹도 사용할 필요가 없습니다.

```js
-  const bindGroup = device.createBindGroup({
-    label: 'bind group for objects',
-    layout: pipeline.getBindGroupLayout(0),
-    entries: [
-      { binding: 0, resource: { buffer: staticStorageBuffer }},
-      { binding: 1, resource: { buffer: changingStorageBuffer }},
-    ],
-  });
```

마지막으로, 바인드그룹을 설정할 필요는 없지만 정점 버퍼 설정은 해 주어야 합니다.

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setVertexBuffer(1, staticVertexBuffer);
+    pass.setVertexBuffer(2, changingVertexBuffer);

    ...
-    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices, kNumObjects);

    pass.end();
```

여기서 `setVertexBuffer`의 첫 번째 매개변수가 파이프라인에서의 `buffers` 배열의 요소와 대응됩니다.

이로써 이전과 동일한 결과를, 스토리지 버퍼 없이 정점 버퍼만을 사용해서 얻을 수 있습니다.

{{{example url="../webgpu-vertex-buffers-instanced-colors"}}}

정점별 색상을 위한 또다른 어트리뷰트를 재미로 추가해 봅시다. 먼저 셰이더를 수정합니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color;
+  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

그리고 파이프라인을 업데이트하여 어떻게 데이터를 전달할 것인지 명시합니다.
perVertexColor 데이터를 아래와 같이 엮을 것입니다.

<div class="webgpu_center"><img src="resources/vertex-buffer-mixed.svg" style="width: 1024px;"></div>

따라서 `arrayStride`가 우리의 새로운 데이터를 포함하도록 수정되어야 하고, 새로운 어트리뷰트를 추가해야 합니다.
두 개의 32비트 부동소수점을 건너뛴 뒤에 데이터가 시작하므로 `offset`은 8바이트입니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          arrayStride: 5 * 4, // 5 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
          ],
        },
        {
          arrayStride: 6 * 4, // 6 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
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

원을 그리는 정점을 생성하는 코드를 수정하여 바깥쪽 정점은 어두운 색, 안쪽 정점은 밝은 색이 되도록 수정합니다.

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // subdivision마다 두 개의 삼각형, 삼각형마다 세 개의 정점, 각 정점은 (xyrgb) 세 개의 값
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * 2);
+  const vertexData = new Float32Array(numVertices * (2 + 3));

  let offset = 0;
-  const addVertex = (x, y, r, g, b) => {
+  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
+    vertexData[offset++] = r;
+    vertexData[offset++] = g;
+    vertexData[offset++] = b;
  };

+  const innerColor = [1, 1, 1];
+  const outerColor = [0.1, 0.1, 0.1];

  // 2 triangles per subdivision
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; ++i) {
    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

    const c1 = Math.cos(angle1);
    const s1 = Math.sin(angle1);
    const c2 = Math.cos(angle2);
    const s2 = Math.sin(angle2);

    // first triangle
-    addVertex(c1 * radius, s1 * radius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c1 * innerRadius, s1 * innerRadius);
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
-
-    // second triangle
-    addVertex(c1 * innerRadius, s1 * innerRadius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c2 * innerRadius, s2 * innerRadius);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
  }

  return {
    vertexData,
    numVertices,
  };
}
```

이렇게 하면 아래와 같은 원을 그릴 수 있습니다.

{{{example url="../webgpu-vertex-buffers-per-vertex-colors.html"}}}

## <a id="a-default-values"></a>WESL의 어트리뷰트와 자바스크립트 어트리뷰트가 매칭될 필요는 없습니다

위에서 `perVertexColor` 어트리뷰트를 `vec3f` 타입으로 아래와 같이 선언했습니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
*  @location(4) perVertexColor: vec3f,
};
```

그리고 아래와 같이 사용했죠.

```wgsl
@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
*  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}
```

`vec4f`로 선언하고 아래와 같이 사용할 수도 있습니다.

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
-  @location(4) perVertexColor: vec3f,
+  @location(4) perVertexColor: vec4f,
};

...

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.color = vert.color * vert.perVertexColor;
  return vsOut;
}
```

그리고 나머지는 수정하지 않습니다. 자바스크립트 쪽을 보면 우리는 여전히 정점별로 세 개의 부동소수점으로 데이터를 전달하는 것을 볼 수 있습니다.

```js
    {
      arrayStride: 5 * 4, // 5 floats, 4 bytes each
      attributes: [
        {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
*        {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
      ],
    },
```

셰이더에서 어트리뷰트는 항상 네 개의 값을 가지기 때문에 이와 같이 해도 문제 없습니다. 
기본값은 `0, 0, 0, 1`이고, 우리가 전달하지 않은 요소에 대해서는 이러한 기본값을 사용합니다.

{{{example url="../webgpu-vertex-buffers-per-vertex-colors-3-in-4-out.html"}}}

## <a id="a-normalized-attributes"></a>공간 절약을 위한 정규화된(normalized) 값의 사용

색상값으로 32비트 부동소수점 값을 사용했습니다. 
각 `perVertexColor`는 세 개의 값이니, 정점별로 총 12바이트를 사용하고 있습니다. 
`color`는 네 개의 값이니 인스턴스별로는 16바이트입니다.

8비트 값을 사용하여 이를 최적화 하고 WebGPU에게 0 ↔ 255 값을 0.0 ↔ 1.0로 정규화해서 사용하라고 할 수 있습니다.

사용 가능한 어트리뷰트 포맷 목록을 보면 8비트 3개는 없지만 `'unorm8x4'`가 있으니 이를 사용합시다.

먼저 정점을 생성하는 코드를 수정해서, 나중에 정규화될 색상 데이터를 8비트 값으로 출력하게 합니다.

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 2 triangles per subdivision, 3 verts per tri, 5 values (xyrgb) each.
+  // 2 triangles per subdivision, 3 verts per tri
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * (2 + 3));
+  // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb_)
+  // The 32-bit color value will be written/read as 4 8-bit values
+  const vertexData = new Float32Array(numVertices * (2 + 1));
+  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
+  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
-    vertexData[offset++] = r;
-    vertexData[offset++] = g;
-    vertexData[offset++] = b;
+    offset += 1;  // skip the color
+    colorData[colorOffset++] = r * 255;
+    colorData[colorOffset++] = g * 255;
+    colorData[colorOffset++] = b * 255;
+    colorOffset += 9;  // skip extra byte and the position
  };
```

`vertexData` 데이터와 동일한 `Uint8Array` 뷰(view)인 `colorData`를 만들었습니다.

그리고 `colorData`에 0 ↔ 1를 0 ↔ 255로 확장하여 색상값을 넣습니다.

이 데이터의 메모리 레이아웃은 아래와 같습니다.

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x2-u8x4.svg" style="width: 1024px;"></div>

인스턴스별 데이터로 업데이트해야 합니다.

```js
  const kNumObjects = 100;
  const objectInfos = [];

  // create 2 vertex buffers
  const staticUnitSize =
-    4 * 4 + // color is 4 32bit floats (4bytes each)
+    4 +     // color is 4 bytes
    2 * 4;  // offset is 2 32bit floats (4bytes each)
  const changingUnitSize =
    2 * 4;  // scale is 2 32bit floats (4bytes each)
  const staticVertexBufferSize = staticUnitSize * kNumObjects;
  const changingVertexBufferSize = changingUnitSize * kNumObjects;

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const changingVertexBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // offsets to the various uniform values in float32 indices
  const kColorOffset = 0;
  const kOffsetOffset = 1;

  const kScaleOffset = 0;

  {
-    const staticVertexValues = new Float32Array(staticVertexBufferSize / 4);
+    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
+    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
-      const staticOffset = i * (staticUnitSize / 4);
+      const staticOffsetU8 = i * staticUnitSize;
+      const staticOffsetF32 = staticOffsetU8 / 4;

      // These are only set once so set them now
-      staticVertexValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset);        // set the color
-      staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset);      // set the offset
+      staticVertexValuesU8.set(        // set the color
+          [rand() * 255, rand() * 255, rand() * 255, 255],
+          staticOffsetU8 + kColorOffset);
+
+      staticVertexValuesF32.set(      // set the offset
+          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
+          staticOffsetF32 + kOffsetOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
  }
```

인스턴스별 데이터의 레이아웃은 아래와 같습니다.

<div class="webgpu_center"><img src="resources/vertex-buffer-u8x4-f32x2.svg" style="width: 1024px;"></div>

이제 파이프라인을 수정하여 데이터를 8비트 부호없는 정수로 가져오고 0 ↔ 1로 정규화하도록 해야 하고, offset과 stride로 새로운 크기에 맞춰 수정해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 5 * 4, // 5 floats, 4 bytes each
+          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
-            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
+            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
-          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
-            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
-            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
+            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
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

이렇게 하여 공간을 조금 아꼈습니다. 이전에는 정점별로 20바이트를 사용했으나 이제는 12바이트만을 사용합니다. 40%의 절약이죠.
그리고 인스턴스별로는 24바이트를 사용했는데 12바이트를 사용하니 50% 절약입니다.

{{{example url="../webgpu-vertex-buffers-8bit-colors.html"}}}

구조체를 꼭 사용할 필요는 없다는 점을 명심하세요. 아래와 같이 해도 잘 동작합니다.

```WGSL
@vertex fn vs(
-  vert: Vertex,
+  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.position = vec4f(
+      position * scale + offset, 0.0, 1.0);
+  vsOut.color = color * vec4f(perVertexColor, 1);
  return vsOut;
}
```

WebGPU가 신경쓰는 것은 오직 우리가 셰이더에서 `locations`로 명시한 것들에 대해 API를 통해 제대로 데이터를 전달했는지 뿐입니다.

## <a id="a-index-buffers"></a>인덱스(index) 버퍼

마지막으로 다룰 것은 인덱스 버퍼입니다.
인덱스 버퍼는 정점의 처리와 사용 순서를 명시합니다.

`draw`를 아래와 같은 순서로 정점을 처리하는 것으로 생각할 수 있습니다.

```
0, 1, 2, 3, 4, 5, .....
```

인덱스 버퍼를 사용하면 순서를 바꿀 수 있습니다.

원을 그릴 때 subdivision마다 6개의 정점을 만들고 있는데 사실 그 중 두 개는 동일한 정점입니다.

<div class="webgpu_center"><img src="resources/vertices-non-indexed.svg" style="width: 400px"></div>  

이제, 정점은 네 개만 생성하고 대신 그 네 개의 정점을 여섯 번 사용하도록 할 것입니다. 
이는 WebGPU에게 아래와 같은 순서로 그리도록 인덱스를 명시함으로써 가능합니다.

```
0, 1, 2, 2, 1, 3, ...
```

<div class="webgpu_center"><img src="resources/vertices-indexed.svg" style="width: 400px"></div>

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 2 triangles per subdivision, 3 verts per tri
-  const numVertices = numSubdivisions * 3 * 2;
+  // 2 vertices at each subdivision, + 1 to wrap around the circle.
+  const numVertices = (numSubdivisions + 1) * 2;
  // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb)
  // The 32-bit color value will be written/read as 4 8-bit values
  const vertexData = new Float32Array(numVertices * (2 + 1));
  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
    offset += 1;  // skip the color
    colorData[colorOffset++] = r * 255;
    colorData[colorOffset++] = g * 255;
    colorData[colorOffset++] = b * 255;
    colorOffset += 9;  // skip extra byte and the position
  };
  const innerColor = [1, 1, 1];
  const outerColor = [0.1, 0.1, 0.1];

-  // 2 triangles per subdivision
-  //
-  // 0--1 4
-  // | / /|
-  // |/ / |
-  // 2 3--5
-  for (let i = 0; i < numSubdivisions; ++i) {
-    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
-    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;
-
-    const c1 = Math.cos(angle1);
-    const s1 = Math.sin(angle1);
-    const c2 = Math.cos(angle2);
-    const s2 = Math.sin(angle2);
-
-    // first triangle
-    addVertex(c1 * radius, s1 * radius, ...outerColor);
-    addVertex(c2 * radius, s2 * radius, ...outerColor);
-    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
-
-    // second triangle
-    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
-    addVertex(c2 * radius, s2 * radius, ...outerColor);
-    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
-  }
+  // 2 triangles per subdivision
+  //
+  // 0  2  4  6  8 ...
+  //
+  // 1  3  5  7  9 ...
+  for (let i = 0; i <= numSubdivisions; ++i) {
+    const angle = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
+
+    const c1 = Math.cos(angle);
+    const s1 = Math.sin(angle);
+
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+  }

+  const indexData = new Uint32Array(numSubdivisions * 6);
+  let ndx = 0;
+
+  // 1st tri  2nd tri  3rd tri  4th tri
+  // 0 1 2    2 1 3    4 5 6    6 5 7
+  //
+  // 0--2        2     4--6        6  .....
+  // | /        /|     | /        /|
+  // |/        / |     |/        / |
+  // 1        1--3     5        5--7  .....
+  for (let i = 0; i < numSubdivisions; ++i) {
+    const ndxOffset = i * 2;
+
+    // first triangle
+    indexData[ndx++] = ndxOffset;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 2;
+
+    // second triangle
+    indexData[ndx++] = ndxOffset + 2;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 3;
+  }

  return {
    vertexData,
    colorData,
+    indexData,
    numVertices: indexData.length,
  };
}
```

그리고 인덱스 버퍼를 만듭니다.

```js
-  const { vertexData, numVertices } = createCircleVertices({
+  const { vertexData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+  const indexBuffer = device.createBuffer({
+    label: 'index buffer',
+    size: indexData.byteLength,
+    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(indexBuffer, 0, indexData);
```

usage를 `INDEX`로 설정한 것에 주목하세요.

그리고 그리기 시점에는 인덱스 버퍼를 명시해 줍니다.

```js
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, staticVertexBuffer);
    pass.setVertexBuffer(2, changingVertexBuffer);
+    pass.setIndexBuffer(indexBuffer, 'uint32');
```

버퍼가 32비트 부호없는 정수 인덱스기 때문에 `'uint32'`를 전달해야 합니다.
16비트 부호없는 정수를 사용할 수도 있는데 이 경우에는 `'uint16'`를 전달합니다.

그리고 `draw` 대신 `drawIndexed`를 호출해야 합니다.

```js
-    pass.draw(numVertices, kNumObjects);
+    pass.drawIndexed(numVertices, kNumObjects);
```

이렇게 하면 공간을 절약할 수 있고(33%), 그만큼의 처리 시간도 절약할 수 있는데 
정점 셰이더에서 정점에 대한 계산을 수행할 때 GPU가 이미 계산된 값을 재사용 할 수 있기 때문입니다.

{{{example url="../webgpu-vertex-buffers-index-buffer.html"}}}

[이전 글](webgpu-storage-buffers.html)의 예제에서 스토리지 버퍼와 인덱스 버퍼 사용할 수도 있었음을 명심하세요.
이러한 경우 `@builtin(vertex_index)`로 넘어오는 값은 인덱스 버퍼의 인덱스 순서와 같습니다.

다음으로 [텍스처](webgpu-textures.html)에 대해 다뤄보겠습니다.
