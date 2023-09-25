Title: WebGPU 顶点缓冲区（Vertex Buffers）
Description: 向着色器中传递顶点数据
TOC: 顶点缓冲区（Vertex Buffers）

在[上一篇文章中](webgpu-storage-buffers.html)，我们将顶点数据放入存储缓冲区，并使用内置的 `vertex_index` 对其进行索引。虽然这种技术越来越受欢迎，但向顶点着色器提供顶点数据的传统方法是通过顶点缓冲区和属性。

顶点缓冲区与其他 WebGPU 缓冲区一样。它们都保存数据。不同的是，我们不直接从顶点着色器访问它们。相反，我们要告诉 WebGPU 缓冲区中的数据种类、位置和组织方式。然后，WebGPU 会从缓冲区中提取数据并提供给我们。

让我们将[上一篇文章](webgpu-storage-buffers.html)中的最后一个示例从使用存储缓冲区改为使用顶点缓冲区。

首先要做的是更改着色器，使其从顶点缓冲区获取顶点数据。

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

正如你所看到的，这只是一个很小的改动。我们声明了一个 `Vertex` 结构体来定义顶点的数据。重要的部分是用 `@location(0)` 声明 position 字段

然后，在创建渲染管道时，我们必须告诉 WebGPU 如何获取 `@location(0)` 的数据

```js
  const pipeline = device.createRenderPipeline({
    label: 'vertex buffer pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
+      buffers: [
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          attributes: [
+            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+          ],
+        },
+      ],
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

在[`管道描述符(pipeline descriptor)`](GPURenderPipelineDescriptor)的[`vertex`](GPUVertexState)字段中，我们添加了一个`buffers`数组，用于描述如何从一个或多个顶点缓冲区中提取数据。对于第一个也是唯一一个缓冲区，我们设置了一个以字节数为单位的`arrayStride`字段。在这种情况下，`stride` 是指从缓冲区中一个顶点的数据到缓冲区中下一个顶点的数据所需的字节数。

<div class="webgpu_center"><img src="resources/vertex-buffer-one.svg" style="width: 1024px;"></div>

由于我们的数据是 `vec2f`，即两个 `float32` 数字，因此我们将 `arrayStride` 设置为 8。

接下来，我们定义一个名为`attribute`的数组。我们只有一个该数组：`shaderLocation: 0`的属性对应我们`Vertex`结构体中的的`location(0)` 。 `offset: 0`表示对于该`attribute`数组来说数据是从顶点缓冲区中的第 0 个偏移位置开始的。最后，`format: 'float32x2'`是说我们想要 WebGPU 以两个 32 位浮点数的形式从缓冲区中提取数据。

我们需要将顶点数据缓冲区的用途从 `STORAGE` 更改为 `VERTEX`，并将其从绑定组中移除。

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

然后在绘制时，我们需要告诉 webgpu 使用哪个顶点缓冲区

```js
pass.setPipeline(pipeline);
+pass.setVertexBuffer(0, vertexBuffer);
```

这里的 `0` 相当于我们上面指定的渲染管道`buffers`数组的第一个元素。

至此，我们已经将使用存储缓冲区改为了使用顶点缓冲区。

{{{example url="../webgpu-vertex-buffers.html"}}}

执行绘制命令时的状态如下所示

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram-vertex-buffer.svg" style="width: 960px;"></div>

attribute 的`format`字段可以是以下类型之一
The attribute `format` field can be one of these types

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
      <tr><td><code>"float32x3"</code></td></td><td>float </td><td>3 </td><td>12 </td><td><code>vec3&lt;f32&gt;</code>, <code>vec3f</code></td></tr>
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

## <a id="a-instancing"></a>使用顶点缓冲区进行多实例绘制

属性可以按顶点或按实例递进。按实例递进实际上与我们索引 `otherStructs[instanceIndex]` 和 `ourStructs[instanceIndex]` 时所做的事情相同，其中 `instanceIndex` 的值来自 `@builtin(instance_index)`。

让我们去掉存储缓冲区，使用顶点缓冲区来实现同样的目的。首先，让我们更改着色器，使用顶点属性代替存储缓冲区。

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

@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

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

现在，我们需要更新渲染管道，告诉它我们希望如何为这些属性提供数据。为了尽量减少改动，我们将几乎原封不动地使用为存储缓冲区创建的数据。我们将使用两个缓冲区，一个缓冲区将保存每个实例的`color`和`offset`，另一个将保存`scale`。

```js
  const pipeline = device.createRenderPipeline({
    label: 'flat colors',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
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
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

上面我们在 pipleine 描述的缓冲区数组中新添加了 2 项，因此现在有 3 个缓冲区，这意味着我们告诉 WebGPU 我们将在 3 个缓冲区中提供数据。

对于 2 个新条目，我们将 `stepMode` 设置为 `instance`。这意味着该属性在每个实例中只会前进一次到下一个值。默认值为 `stepMode: 'vertex'` 即每个顶点递进一次（每个实例重新开始）。

Above we added 2 entries to the `buffers` array on our pipleine description so now there are 3 buffer entries, meaning
we're telling WebGPU we'll supply the data in 3 buffers.

For our 2 new entires we set the `stepMode` to `instance`. This means this attribute
will only advance to next value once per instance. The default is `stepMode: 'vertex'`
which advances once per vertex (and starts over for each instance).

我们有两个缓冲区。其中一个只保存`scale`，为其设置`attribute`非常简单。就像第一个缓冲区保存`position`一样，每个顶点有 2 个 32 位浮点数。

另一个缓冲区保存`color`和`offset`，它们将在数据中这样交错排列

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x4-f32x2.svg" style="width: 1024px;"></div>

因此，上面我们说从一组数据到下一组数据的 `arrayStride` 是 `6 * 4`，6 个 32 位浮点，每个 4 字节（共 24 字节）。颜色从偏移量 0 开始，但偏移量从 16 字节开始。

接下来，我们可以修改设置缓冲区的代码。

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

顶点属性不像存储缓冲区中的结构那样有填充限制，因此我们不再需要填充空白数据。除此之外，我们所做的只是将用途从 `STORAGE` 改为 `VERTEX`（并将所有变量的名称从 "storage "改为 "vertex"）。

由于我们不再使用存储缓冲区，因此不再需要 bindGroup

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

最后，我们不需要设置绑定组，但需要设置顶点缓冲区

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

在这里，`setVertexBuffer` 的第一个参数对应于我们上面创建的管道中`buffers`数组的元素。

这样，我们就拥有了与之前相同的功能，但我们使用的全部是顶点缓冲区，而没有使用存储缓冲区。

{{{example url="../webgpu-vertex-buffers-instanced-colors"}}}

为了增加一些乐趣，让我们为每个顶点颜色添加第二个属性。首先，让我们更改着色器

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

然后，我们需要更新管道，以描述如何提供数据。我们将把每顶点颜色数据与位置数据交错组织在一起，如下所示

<div class="webgpu_center"><img src="resources/vertex-buffer-mixed.svg" style="width: 1024px;"></div>

因此，我们需要修改 `arrayStride` 以覆盖新数据，并添加新属性。它从两个 32 位浮点数后开始，因此在缓冲区中的`offset`为 8 字节。

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
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
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

我们将更新圆的顶点生成代码，为圆外缘的顶点提供深色，为圆内缘的顶点提供浅色。

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // 2 triangles per subdivision, 3 verts per tri, 5 values (xyrgb) each.
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

  // 2 vertices per subdivision
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

这样，我们就得到了有阴影的圆

{{{example url="../webgpu-vertex-buffers-per-vertex-colors.html"}}}

## <a id="a-default-values"></a>WGSL 中的 attribute 不必与 JavaScript 中的 attribute 一致

在 WGSL 中，我们将 `perVertexColor` 属性声明为 `vec3f`，如下所示

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
*  @location(4) perVertexColor: vec3f,
};
```

并这样使用

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

我们也可以将其声明为 `vec4f`，然后这样使用它

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

其他什么都不用改。在 JavaScript 中，我们仍然只能为每个顶点提供 3 个浮点数据。

```js
    {
      arrayStride: 5 * 4, // 5 floats, 4 bytes each
      attributes: [
        {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
*        {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
      ],
    },
```

这样做能行是因为属性在着色器中始终有 4 个值。它们的默认值为 `0、0、0、1`，因此我们不提供的任何值都会得到这些默认值。

{{{example url="../webgpu-vertex-buffers-per-vertex-colors-3-in-4-out.html"}}}

## <a id="a-normalized-attributes"></a>使用归一化数值以节省空间

我们使用 32 位浮点数值来表示颜色。每个 `perVertexColor` 有 3 个值，共有 12 个字节。每个`color`有 4 个值，则每个实例的每个颜色共占用 16 个字节。

我们可以通过使用 8 位值并告诉 WebGPU 它们应从 0 ↔ 255 归一化为 0.0 ↔ 1.0 来进行优化。

在有效属性格式列表中，没有 3 个 8 位值的格式，但有 `'unorm8x4'`，因此我们就使用它。

首先，让我们修改生成顶点的代码，将颜色存储为 8 位值，并进行归一化处理

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

上面我们创建了 `colorData`，它是与`vertexData`相同的 `Uint8Array` 视图

然后，我们往 `colorData` 中插入颜色，将它们从 0 ↔ 1 扩展到 0 ↔ 255

此时数据的内存布局如下

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x2-u8x4.svg" style="width: 1024px;"></div>

我们还需要更新每个实例的数据。

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

每个实例数据的布局如下

<div class="webgpu_center"><img src="resources/vertex-buffer-u8x4-f32x2.svg" style="width: 1024px;"></div>

然后，我们需要更改管道，将数据提取为 8 位无符号值，并将其归一化为 0 ↔ 1，更新偏移量，并将步长更新为新大小。
We then need to change the pipeline to pull out the data as 8bit unsigned
values and to normalize them back to 0 ↔ 1, update the offsets, and update the stride to its
new size.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
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
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

这样我们就节省了一些空间。我们原来每个顶点使用 20 个字节，现在每个顶点使用 12 个字节，节省了 40%。我们原来每个实例使用 24 个字节，现在使用 12 个字节，节省了 50%。

{{{example url="../webgpu-vertex-buffers-8bit-colors.html"}}}

请注意，我们不一定要使用结构体。也可以这样

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

同样，WebGPU 关心的只是我们在着色器中定义的`location`，并通过 API 向这些位置提供数据。

## <a id="a-index-buffers"></a>索引缓冲区(Index Buffers)

最后要介绍的是索引缓冲区。索引缓冲区描述了处理和使用顶点的顺序。

你可以把`draw`看作是按以下顺序遍历顶点

```
0, 1, 2, 3, 4, 5, .....
```

有了索引缓冲器，我们就可以改变遍历顶点的顺序。

我们为圆的每个小部分创建了 6 个顶点，尽管其中两个顶点是相同的。

<div class="webgpu_center"><img src="resources/vertices-non-indexed.svg" style="width: 400px"></div>

现在，我们只创建 4 个顶点，然后使用索引将这 4 个顶点使用 6 次，方法是告诉 WebGPU 按照以下顺序绘制索引

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

-  // 2 vertices per subdivision
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
+  // 2 vertices per subdivision
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
+  // 0---2---4---...
+  // | //| //|
+  // |// |// |//
+  // 1---3-- 5---...
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
    positionData,
    colorData,
+    indexData,
    numVertices: indexData.length,
  };
}
```

然后，我们需要创建一个索引缓冲区

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

请注意，我们将用途设置为 `INDEX`。

最后，在绘制时，我们需要指定索引缓冲区

```js
pass.setPipeline(pipeline);
pass.setVertexBuffer(0, vertexBuffer);
pass.setVertexBuffer(1, staticVertexBuffer);
pass.setVertexBuffer(2, changingVertexBuffer);
+pass.setIndexBuffer(indexBuffer, 'uint32');
```

因为我们的缓冲区包含 32 位无符号整数索引，所以需要在这里输入 `'uint32'`。我们也可以使用 16 位无符号整数索引，在这种情况下，我们需要输入 `'uint16'`。

并且，我们需要调用 `drawIndexed` 而不是 `draw`

```js
-pass.draw(numVertices, kNumObjects);
+pass.drawIndexed(numVertices, kNumObjects);
```

这样我们又节省了一些空间（33%），在顶点着色器中计算顶点时也可能节省类似的处理量，因为 GPU 有可能重复使用已经计算过的顶点。

{{{example url="../webgpu-vertex-buffers-index-buffer.html"}}}

请注意，我们也可以在[上一篇文章](webgpu-storage-buffers.html)中的存储缓冲区示例中使用索引缓冲区。在这种情况下，从 `@builtin(vertex_index)` 中传入的值与索引缓冲区中的索引相匹配。
