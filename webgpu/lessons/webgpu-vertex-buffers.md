Title: WebGPU Vertex Buffers
Description: Passing Vertex Data to Shaders
TOC: Vertex Buffers

In [the previous article](webgpu-storage-buffers.html) we put vertex
data in a storage buffer and indexed it using the builtin `vertex_index`.
While that technique is growing in popularity, the traditional way to
provide vertex data to a vertex shader is via vertex buffers and
attributes.

Vertex buffers are just like any other WebGPU buffer. They hold data.
The difference is we don't access them directly from the vertex shader.
Instead, we tell WebGPU what kind of data is in the buffer as well as
where it is and how it's organized. It then pulls the data out of the
buffer and provides it for us.

Let's take the last example from
[the previous article](webgpu-storage-buffers.html)
and change it from using a storage buffer to using a vertex buffer.

The first thing to do is change the shader to get its vertex data
from a vertex buffer. 

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

As you can see, it's a small change. We declared a struct `Vertex` to define the data
for a vertex. The important part is declaring the position field with `@location(0)`

Then, when we create the render pipeline, we have to tell WebGPU how to get data
for `@location(0)`

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

To the [`vertex`](GPUVertexState) entry of the [`pipeline` descriptor](GPURenderPipelineDescriptor) 
we added a `buffers` array which is used to describe how to pull data out of 1 or more vertex buffers.
For our first and only buffer, we set an `arrayStride` in number of bytes. a *stride* in this case is
how many bytes to get from the data for one vertex in the buffer, to the next vertex in the buffer.

<div class="webgpu_center"><img src="resources/vertex-buffer-one.svg" style="width: 1024px;"></div>

Since our data is `vec2f`, which is two float32 numbers, we set the
`arrayStride` to 8.

Next we define an array of attributes. We only have one. `shaderLocation: 0`
corresponds to `location(0)` in our `Vertex` struct. `offset: 0` says the data
for this attribute starts at byte 0 in the vertex buffer. Finally `format:
'float32x2'` says we want WebGPU to pull the data out of the buffer as two 32bit
floating point numbers.

We need to change the usages of the buffer holding vertex data from `STORAGE`
to `VERTEX` and remove it from the bind group.

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

And then at draw time we need to tell webgpu which vertex buffer to
use

```js
    pass.setPipeline(pipeline);
+    pass.setVertexBuffer(0, vertexBuffer);
```

The `0` here corresponds to first element of the the render pipeline `buffers`
array we specified above.

And with that we've switched from using a storage buffer for vertices to a
vertex buffer.

{{{example url="../webgpu-vertex-buffers.html"}}}

The state when the draw command is executed would look something like this

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram-vertex-buffer.svg" style="width: 960px;"></div>

The attribute `format` field can be one of these types

<div class="webgpu_center data-table">
  <style>
    .vertex-type td:nth-child(3),
    .vertex-type td:nth-child(4) {
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
      <tr><td><code>"uint8x2"</code></td><td>unsigned int </td><td>2 </td><td>2 </td><td><code>vec2&lt;u32&gt;</code></td></tr>
      <tr><td><code>"uint8x4"</code></td><td>unsigned int </td><td>4 </td><td>4 </td><td><code>vec4&lt;u32&gt;</code></td></tr>
      <tr><td><code>"sint8x2"</code></td><td>signed int </td><td>2 </td><td>2 </td><td><code>vec2&lt;i32&gt;</code></td></tr>
      <tr><td><code>"sint8x4"</code></td><td>signed int </td><td>4 </td><td>4 </td><td><code>vec4&lt;i32&gt;</code></td></tr>
      <tr><td><code>"unorm8x2"</code></td><td>unsigned normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code></td></tr>
      <tr><td><code>"unorm8x4"</code></td><td>unsigned normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code></td></tr>
      <tr><td><code>"snorm8x2"</code></td><td>signed normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code></td></tr>
      <tr><td><code>"snorm8x4"</code></td><td>signed normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code></td></tr>
      <tr><td><code>"uint16x2"</code></td><td>unsigned int </td><td>2 </td><td>4 </td><td><code>vec2&lt;u32&gt;</code></td></tr>
      <tr><td><code>"uint16x4"</code></td><td>unsigned int </td><td>4 </td><td>8 </td><td><code>vec4&lt;u32&gt;</code></td></tr>
      <tr><td><code>"sint16x2"</code></td><td>signed int </td><td>2 </td><td>4 </td><td><code>vec2&lt;i32&gt;</code></td></tr>
      <tr><td><code>"sint16x4"</code></td><td>signed int </td><td>4 </td><td>8 </td><td><code>vec4&lt;i32&gt;</code></td></tr>
      <tr><td><code>"unorm16x2"</code></td><td>unsigned normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code></td></tr>
      <tr><td><code>"unorm16x4"</code></td><td>unsigned normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code></td></tr>
      <tr><td><code>"snorm16x2"</code></td><td>signed normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code></td></tr>
      <tr><td><code>"snorm16x4"</code></td><td>signed normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code></td></tr>
      <tr><td><code>"float16x2"</code></td><td>float </td><td>2 </td><td>4 </td><td><code>vec2&lt;f16&gt;</code></td></tr>
      <tr><td><code>"float16x4"</code></td><td>float </td><td>4 </td><td>8 </td><td><code>vec4&lt;f16&gt;</code></td></tr>
      <tr><td><code>"float32"</code></td><td>float </td><td>1 </td><td>4 </td><td><code>f32</code></td></tr>
      <tr><td><code>"float32x2"</code></td><td>float </td><td>2 </td><td>8 </td><td><code>vec2&lt;f32&gt;</code></td></tr>
      <tr><td><code>"float32x3"</code></td></td><td>float </td><td>3 </td><td>12 </td><td><code>vec3&lt;f32&gt;</code></td></tr>
      <tr><td><code>"float32x4"</code></td><td>float </td><td>4 </td><td>16 </td><td><code>vec4&lt;f32&gt;</code></td></tr>
      <tr><td><code>"uint32"</code></td><td>unsigned int </td><td>1 </td><td>4 </td><td><code>u32</code></td></tr>
      <tr><td><code>"uint32x2"</code></td><td>unsigned int </td><td>2 </td><td>8 </td><td><code>vec2&lt;u32&gt;</code></td></tr>
      <tr><td><code>"uint32x3"</code></td><td>unsigned int </td><td>3 </td><td>12 </td><td><code>vec3&lt;u32&gt;</code></td></tr>
      <tr><td><code>"uint32x4"</code></td><td>unsigned int </td><td>4 </td><td>16 </td><td><code>vec4&lt;u32&gt;</code></td></tr>
      <tr><td><code>"sint32"</code></td><td>signed int </td><td>1 </td><td>4 </td><td><code>i32</code></td></tr>
      <tr><td><code>"sint32x2"</code></td><td>signed int </td><td>2 </td><td>8 </td><td><code>vec2&lt;i32&gt;</code></td></tr>
      <tr><td><code>"sint32x3"</code></td><td>signed int </td><td>3 </td><td>12 </td><td><code>vec3&lt;i32&gt;</code></td></tr>
      <tr><td><code>"sint32x4"</code></td><td>signed int </td><td>4 </td><td>16 </td><td><code>vec4&lt;i32&gt;</code> </td></tr>
    </tbody>
  </table>
  </div>
</div>

Let's add a 2nd attribute for color. First let's change the shader

```wgsl
struct OurStruct {
  color: vec4f,
  offset: vec2f,
};

struct OtherStruct {
  scale: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
+  @location(1) color: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

@vertex fn vs(
  vert: Vertex,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let otherStruct = otherStructs[instanceIndex];
  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
-  vsOut.color = ourStruct.color;
+  vsOut.color = ourStruct.color * vec4f(vert.color, 1);
  return vsOut;
}
```

Then we need to update the pipeline to describe how we'll supply the data.
We're going to interleave the data like this

<div class="webgpu_center"><img src="resources/vertex-buffer-mixed.svg" style="width: 1024px;"></div>

So, the `arrayStride` needs to be changed to cover our new data and we need
to add the new attribute. It starts after two 32bit floating point numbers
so its `offset` into the buffer is 8 bytes.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: (2 + 3) * 4, // (2 + 3) floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'}, // position
+            {shaderLocation: 1, offset: 8, format: 'float32x3'}, // color
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

We'll update the circle vertex generation code to provide a dark color
for vertices on the outer edge of the circle and a light color for
the inner vertices.

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

And with that we get shaded circles

{{{example url="../webgpu-vertex-buffers-2-attributes.html"}}}

We're using 32bit floating point values for colors. Each color has 3 values for a total of 12 bytes per color per vertex.
We could optimize that by using 8bit values and telling WebGPU they should be normalized from 0 to 255 to 0.0 to 1.0

Looking at the list of valid attribute formats there is no 3 value 8bit format but there is `'unorm8x4` so let's
use that.

First let's change the code that generates the vertices to store colors as 8bit values that
will be normalized

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
  const vertexData = new Float32Array(numVertices * (2 + 3));
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

Above we make `colorData` which is a `Uint8Array` view of the same
data as `vertexData`

We then use `colorData` to insert the colors, expanding them from 0 ↔ 1
to 0 ↔ 255

We then need to change the pipeline to pull out the data as 8bit unsigned
values and to normalize them back to 0 ↔ 1 and update the stride to its
new size.

```js
  const pipeline = device.createRenderPipeline({
    ...
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
-          arrayStride: (2 + 3) * 4, // (2 + 3) floats, 4 bytes each
+          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes color
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
-            {shaderLocation: 1, offset: 8, format: 'float32x3'},  // color
+            {shaderLocation: 1, offset: 8, format: 'unorm8x4'},  // color
          ],
        },
      ],
    },
    ...
  });
```

And with that we've save a little space. We were using 20 bytes per vertex,
now we're using 12 bytes per vertex, a 40% savings.

{{{example url="../webgpu-vertex-buffers-2-attributes-8bit-colors.html"}}}

Note that we don't have to use a struct. This would work just as well

```WGSL
@vertex fn vs(
-  vert: Vertex,
+  @location(0) position: vec2f,
+  @location(1) color: vec3f,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let otherStruct = otherStructs[instanceIndex];
  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
  vsOut.position = vec4f(
-      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
-  vsOut.color = ourStruct.color * vec4f(vert.color, 1);
+      position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
+  vsOut.color = ourStruct.color * vec4f(color, 1);
  return vsOut;
}
```

As again, all WebGPU cares about that we define `locations` in the shader
and supply data to those locations via the API.

We could also supply the data in separate buffers. Nothing changes
in the shader. Instead we just update the pipeline

```js
      buffers: [
        {
-          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes color
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
-            {shaderLocation: 1, offset: 8, format: 'unorm8x4'},  // color
          ],
        },
+        {
+          arrayStride: 4, // 4 bytes each
+          attributes: [
+            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},  // color
+          ],
+        },
      ],
```

And of course we need to separate the vertex data.

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
-  const vertexData = new Float32Array(numVertices * (2 + 3));
-  const colorData = new Uint8Array(vertexData.buffer);
+  const vertexData = new Float32Array(numVertices * 2);
+  const colorData = new Uint8Array(numVertices * 4);

  let offset = 0;
  let colorOffset = 0;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
-    offset += 1;  // skip the color
    colorData[colorOffset++] = r * 255;
    colorData[colorOffset++] = g * 255;
    colorData[colorOffset++] = b * 255;
-    colorOffset += 9;  // skip extra byte and the position
+    colorOffset += 1; // skip the extra byte
  };


  ...

  return {
    vertexData,
+    colorData,
    numVertices,
  };
}
```

In the interest of correctly naming things, lets change `vertexData` to `positionData`
since our "vertex" is the combination of both a position and a color

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
+  const positionData = new Float32Array(numVertices * 2);
  const colorData = new Uint8Array(numVertices * 4);

-  let offset = 0;
+  let positionOffset = 0;
  let colorOffset = 0;
  const addVertex = (x, y, r, g, b) => {
-    vertexData[offset++] = x;
-    vertexData[offset++] = y;
+    positionData[positionOffset++] = x;
+    positionData[positionOffset++] = y;
    colorData[colorOffset++] = r * 255;
    colorData[colorOffset++] = g * 255;
    colorData[colorOffset++] = b * 255;
    colorOffset += 1; // skip the extra byte
  };

  ...

  return {
-    vertexData,
+    positionData,
    colorData,
    numVertices,
  };
}
```

Then we need to create 2 buffers instead of 1

```js
-  const { vertexData, numVertices } = createCircleVertices({
+  const { positionData, colorData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
-  const vertexBuffer = device.createBuffer({
-    label: 'vertex buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+  const positionBuffer = device.createBuffer({
+    label: 'position buffer',
+    size: positionData.byteLength,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(positionBuffer, 0, positionData);
+  const colorBuffer = device.createBuffer({
+    label: 'color buffer',
+    size: colorData.byteLength,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(colorBuffer, 0, colorData);
```

And then at render time we need to specify the both buffers

```js
    pass.setPipeline(pipeline);
-    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setVertexBuffer(0, positionBuffer);
+    pass.setVertexBuffer(1, colorBuffer);
```

{{{example url="../webgpu-vertex-buffers-2-buffers.html"}}}

Like when we separated our first uniform buffer into 2 uniform buffers,
one reason you might want to separate vertex data into 2 buffers is if
some of the vertex data was static and other vertex data was updated
often.

## <a id="a-index-buffers"></a>Index Buffers

One last thing to cover here are index buffers. Index buffers describe
the order to process and use the vertices.

You can think of `draw` as going through the vertices in order

```
0, 1, 2, 3, 4, 5, .....
```

With an index buffer we can change that order.

We were creating 6 vertices per subdivision of the circle even though 2
of them were identical.

<div class="webgpu_center"><img src="resources/vertices-non-indexed.svg" style="width: 400px"></div>  

Now instead, we'll only create 4 but then use indices to
use those 4 vertices 6 times by telling WebGPU to draw indices in this order

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
  // 2 triangles per subdivision, 3 verts per tri, 5 values (xyrgb) each.
  const numVertices = (numSubdivisions + 1) * 2;
  const positionData = new Float32Array(numVertices * 2);
  const colorData = new Uint8Array(numVertices * 4);

  let positionOffset = 0;
  let colorOffset = 0;
  const addVertex = (x, y, r, g, b) => {
    positionData[positionOffset++] = x;
    positionData[positionOffset++] = y;
    colorData[colorOffset++] = r * 255;
    colorData[colorOffset++] = g * 255;
    colorData[colorOffset++] = b * 255;
    colorOffset += 1; // skip the extra byte
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

Then we need to create an index buffer

```js
-  const { positionData, colorData, numVertices } = createCircleVertices({
+  const { positionData, colorData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
  const positionBuffer = device.createBuffer({
    label: 'position buffer',
    size: positionData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(positionBuffer, 0, positionData);
  const colorBuffer = device.createBuffer({
    label: 'color buffer',
    size: colorData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(colorBuffer, 0, colorData);
+  const indexBuffer = device.createBuffer({
+    label: 'index buffer',
+    size: indexData.byteLength,
+    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(indexBuffer, 0, indexData);
```

Notice we changed the usage to `INDEX`.

Then finally at draw time we need to specify the index buffer

```js
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, positionBuffer);
    pass.setVertexBuffer(1, colorBuffer);
+    pass.setIndexBuffer(indexBuffer, 'uint32');
```

Because our buffer contains 32bit unsigned integer indices
we need to pass `'uint32'` here. We could also use 16 bit
unsigned indices in which case we'd pass in `'uint16'`.

And we need to call `drawIndexed` instead of `draw`

```js
-    pass.draw(numVertices, kNumObjects);
+    pass.drawIndexed(numVertices, kNumObjects);
```

With that we saved some space (33%) and, potentially
a similar amount of processing when computing vertices
in the vertex shader.

{{{example url="../webgpu-vertex-buffers-index-buffer.html"}}}

Note that we could have also used an index buffer with the
storage buffer example from [the previous article](webgpu-storage-buffers.html).
In that case `vertex_index` that's passed in matches the index
from the index buffer.

Next up we'll cover [textures](webgpu-textures.html).


