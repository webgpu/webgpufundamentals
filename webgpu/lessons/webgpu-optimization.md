Title: WebGPU Speed and Optimization
Description: How to go faster in WebGPU
TOC: Speed and Optimization

Most of the examples on this site are written to be as understandable
as possible. That means they work, and they're correct, but they don't
necessarily show the most efficient way to do something in WebGPU.
Further, depending on what you need to do, there are a myriad of possible
optimizations.

In this article will cover some of the most basic optimizations and
discuss a few others.

The basics: The less work you do, and the less work you ask WebGPU to do
the faster things will go.

In pretty much all of the examples to date, if we draw multiple shapes
we've done the following steps

```
* At Init time:
   * for each thing we want to draw
      * create a uniform buffer
      * create a bindGroup that references that buffer

* At Render time:
   * for each thing we want to draw
      * update a typed array with our uniform values for this object
      * copy the typed array to the uniform buffer for this object
      * bind the bindGroup for this object
      * draw
```



Let's make an example we can optimize

## Use mappedOnCreation for initial data

In the example above, and in most of the examples on this site we've
used `writeBuffer` to copy data into a vertex or index buffer. As a very
minor optimization, for this particular case, when you create a buffer
you can pass in `mappedAtCreation: true`. This has 2 benefits.

1. It's slightly faster to put the data into the new buffer (2) 

2. You don't have to add `GPUBufferUsage.COPY_DST` to the buffer's usage.

   This assumes you're not going to change the data later.

```js
  function createBufferWithData(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
-      usage: usage | GPUBufferUsage.COPY_DST,
+      usage: usage,
+      mappedAtCreation: true,
    });
-    device.queue.writeBuffer(buffer, 0, data);
+    const dst = new Uint8Array(buffer.getMappedRange());
+    dst.set(new Uint8Array(data.buffer));
+    buffer.unmap();
    return buffer;
  }
```

Note that this optimization only helps at creation time so it will not
affect our performance at render time.

## Pack and interleave your vertices

In the example above we have 3 buffers, one for position, one for normals,
and one for texture coordinates. This is slower both on the CPU and GPU.
One the CPU in JavaScript we need to call `setVertexBuffer` once for each
buffer for each model we want to draw. On the GPU there are cache issues.
So, if we interleave the vertex data into a single buffer we'll only need
one call to `setVertexBuffer` and we'll help the GPU as well as all the
data needed for a single vertex will be located together in memory.

```js
-  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
-  const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
-  const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
+  const vertexData = new Float32Array([
+  // position       normal        texcoord
+     1,  1, -1,     1,  0,  0,    1, 0,
+     1,  1,  1,     1,  0,  0,    0, 0,
+     1, -1,  1,     1,  0,  0,    0, 1,
+     1, -1, -1,     1,  0,  0,    1, 1,
+    -1,  1,  1,    -1,  0,  0,    1, 0,
+    -1,  1, -1,    -1,  0,  0,    0, 0,
+    -1, -1, -1,    -1,  0,  0,    0, 1,
+    -1, -1,  1,    -1,  0,  0,    1, 1,
+    -1,  1,  1,     0,  1,  0,    1, 0,
+     1,  1,  1,     0,  1,  0,    0, 0,
+     1,  1, -1,     0,  1,  0,    0, 1,
+    -1,  1, -1,     0,  1,  0,    1, 1,
+    -1, -1, -1,     0, -1,  0,    1, 0,
+     1, -1, -1,     0, -1,  0,    0, 0,
+     1, -1,  1,     0, -1,  0,    0, 1,
+    -1, -1,  1,     0, -1,  0,    1, 1,
+     1,  1,  1,     0,  0,  1,    1, 0,
+    -1,  1,  1,     0,  0,  1,    0, 0,
+    -1, -1,  1,     0,  0,  1,    0, 1,
+     1, -1,  1,     0,  0,  1,    1, 1,
+    -1,  1, -1,     0,  0, -1,    1, 0,
+     1,  1, -1,     0,  0, -1,    0, 0,
+     1, -1, -1,     0,  0, -1,    0, 1,
+    -1, -1, -1,     0,  0, -1,    1, 1,
+  ]);
  const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

-  const positionBuffer = createBufferWithData(device, positions, GPUBufferUsage.VERTEX);
-  const normalBuffer = createBufferWithData(device, normals, GPUBufferUsage.VERTEX);
-  const texcoordBuffer = createBufferWithData(device, texcoords, GPUBufferUsage.VERTEX);
+  const vertexBuffer = createBufferWithData(device, vertexData, GPUBufferUsage.VERTEX);
  const indicesBuffer = createBufferWithData(device, indices, GPUBufferUsage.INDEX);
  const numVertices = indices.length;

  const pipeline = device.createRenderPipeline({
    label: 'textured model with point light w/specular highlight',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
-        // position
-        {
-          arrayStride: 3 * 4, // 3 floats
-          attributes: [
-            {shaderLocation: 0, offset: 0, format: 'float32x3'},
-          ],
-        },
-        // normal
-        {
-          arrayStride: 3 * 4, // 3 floats
-          attributes: [
-            {shaderLocation: 1, offset: 0, format: 'float32x3'},
-          ],
-        },
-        // uvs
-        {
-          arrayStride: 2 * 4, // 2 floats
-          attributes: [
-            {shaderLocation: 2, offset: 0, format: 'float32x2'},
-          ],
-        },
+        {
+          arrayStride: (3 + 3 + 2) * 4, // 8 floats
+          attributes: [
+            {shaderLocation: 0, offset: 0 * 4, format: 'float32x3'}, // position
+            {shaderLocation: 1, offset: 3 * 4, format: 'float32x3'}, // normal
+            {shaderLocation: 2, offset: 6 * 4, format: 'float32x2'}, // texcoord
+          ],
+        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  ...
-    pass.setVertexBuffer(0, positionBuffer);
-    pass.setVertexBuffer(1, normalBuffer);
-    pass.setVertexBuffer(2, texcoordBuffer);
+    pass.setVertexBuffer(0, vertexBuffer);
```

* Split uniform buffers (shared, material, per model)

Our example right now has one uniform buffer object.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  viewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
};
```

Some of those uniform values like `viewProjection`, `lightWorldPosition`
and `viewWorldPosition` can be shared.

We can split these into at least 2 uniform buffers. One for the shared
values and one for *per object values*.

```wgsl
struct SharedUniforms {
  viewProjection: mat4x4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
};
struct PerObjectUniforms {
  normalMatrix: mat3x3f,
  world: mat4x4f,
  color: vec4f,
  shininess: f32,
};
```

With this change, we'll save having to copy the  `viewProjection`, `lightWorldPosition` and `viewWorldPosition` to every uniform buffer.
We'll also copy less data with `device.queue.writeBuffer`

With that change our math portion dropped ~30%

A common organization in a 3D library is to have "models" (the vertex data),
"materials" (the colors, shininess, and texture), "lights" (which lights to use),
"viewInfo" (the view and projection matrix). In particular, in our example,
`color` and `shininess` never change so it's a waste to keep copying them
to the uniform buffer every frame.

## Double buffer uniform buffers that are updated every frame

WebGPU is required to make accessing a buffer to be safe. That means
when submit a command buffer, WebGPU has to effectively check, "is this buffer
being updated? If so wait until the update is finished". Or, going the other way,
let's say you call `device.queue.writeBuffer`. WebGPU has to check "is this buffer currently being read by shaders? If so wait until that finishes".

Double buffering in this case means, instead of one uniform buffer for
the "per object uniforms", the ones we're updating with thee world and
normal matrices, we'd have two. We'd ping-pong which one we're updating.
This why, while WebGPU is drawing using one of those 2 buffers, we'r updating
the other. So, WebGPU never has to wait.

{{{example url="../webgpu-optimization-none.html"}}}

{{{example url="../webgl-optimization-none-uniform-buffers.html"}}}





* Texture Atlas or 2D-array
* GPU Occlusion culling
* GPU Scene graph matrix calculation
* GPU Frustum culling
* Indirect Drawing
* Render Bundles
