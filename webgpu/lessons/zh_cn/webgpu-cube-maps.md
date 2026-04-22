Title: WebGPU 立方体贴图
Description: 如何在 WebGPU 中使用立方体贴图
TOC: 立方体贴图

本文假设你已经阅读了[纹理相关的文章](webgpu-textures.html)以及[将图像导入纹理相关的文章](webgpu-importing-textures.html)。本文还使用了[方向光相关的文章](webgpu-lighting-directional.html)中介绍的概念。如果你还没有阅读这些文章，可能需要先读一下。

在[上一篇文章](webgpu-textures.html)中，我们介绍了如何使用纹理、如何使用从 0 到 1 的纹理坐标来引用纹理，以及如何通过 mip 可选地过滤纹理。

另一种纹理类型是*立方体贴图（cubemap）*。立方体贴图由 6 个面组成，代表立方体的 6 个面。与传统的二维纹理坐标不同，立方体贴图使用的是法线，也就是三维方向。根据法线指向的方向，会选择立方体的 6 个面之一，然后在该面内对像素进行采样以产生颜色。

让我们来制作一个简单的例子，使用二维 Canvas 来制作 6 个面中每个面所使用的图像。

以下是一些用颜色和居中消息填充 Canvas 的代码

```js
function generateFace(size, {faceColor, textColor, text}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${size * 0.7}px sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const m = ctx.measureText(text);
  ctx.fillText(
    text,
    (size - m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 2,
    (size - m.actualBoundingBoxDescent + m.actualBoundingBoxAscent) / 2
  );
  return canvas;
}
```

下面是调用它来生成 6 张图像的代码

```js
const faceSize = 128;
const faceCanvases = [
  { faceColor: '#F00', textColor: '#0FF', text: '+X' },
  { faceColor: '#FF0', textColor: '#00F', text: '-X' },
  { faceColor: '#0F0', textColor: '#F0F', text: '+Y' },
  { faceColor: '#0FF', textColor: '#F00', text: '-Y' },
  { faceColor: '#00F', textColor: '#FF0', text: '+Z' },
  { faceColor: '#F0F', textColor: '#0F0', text: '-Z' },
].map(faceInfo => generateFace(faceSize, faceInfo));

// show the results
for (const canvas of faceCanvases) {
  document.body.appendChild(canvas);
}
```

{{{example url="../webgpu-cube-faces.html" }}}

现在让我们使用立方体贴图将这些图像应用到立方体上。我们将从[导入纹理文章中的纹理图集示例](webgpu-importing-textures.html#a-texture-atlases)的代码开始。

首先让我们修改着色器以使用立方体贴图

```wgsl
struct Uniforms {
  matrix: mat4x4f,
};

struct Vertex {
  @location(0) position: vec4f,
-  @location(1) texcoord: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) texcoord: vec2f,
+  @location(0) normal: vec3f,
};

...

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
-  vsOut.texcoord = vert.texcoord;
+  vsOut.normal = normalize(vert.position.xyz);
  return vsOut;
}
```

我们从着色器中移除了纹理坐标，并将阶段间变量改为向片段着色器传递法线。由于我们立方体的位置完美地以原点为中心，我们可以直接用法线。

回想一下[光照相关的文章](webgpu-lighting-directional.html)，法线是一个方向，通常用于指定某个顶点的表面方向。因为我们用法线化的位置作为法线，如果我们对其进行光照，将会在立方体上获得平滑的光照效果。

{{{diagram url="resources/cube-normals.html" caption="标准立方体法线 vs 本立方体的法线" width="700" height="400"}}}

由于我们不再使用纹理坐标，因此可以移除所有与设置纹理坐标相关的代码。

```js
  const vertexData = new Float32Array([
-     // front face     select the top left image
-    -1,  1,  1,        0   , 0  ,
-    -1, -1,  1,        0   , 0.5,
-     1,  1,  1,        0.25, 0  ,
-     1, -1,  1,        0.25, 0.5,
-     // right face     select the top middle image
-     1,  1, -1,        0.25, 0  ,
-     1,  1,  1,        0.5 , 0  ,
-     1, -1, -1,        0.25, 0.5,
-     1, -1,  1,        0.5 , 0.5,
-     // back face      select to top right image
-     1,  1, -1,        0.5 , 0  ,
-     1, -1, -1,        0.5 , 0.5,
-    -1,  1, -1,        0.75, 0  ,
-    -1, -1, -1,        0.75, 0.5,
-     // left face       select the bottom left image
-    -1,  1,  1,        0   , 0.5,
-    -1,  1, -1,        0.25, 0.5,
-    -1, -1,  1,        0   , 1  ,
-    -1, -1, -1,        0.25, 1  ,
-     // bottom face     select the bottom middle image
-     1, -1,  1,        0.25, 0.5,
-    -1, -1,  1,        0.5 , 0.5,
-     1, -1, -1,        0.25, 1  ,
-    -1, -1, -1,        0.5 , 1  ,
-     // top face        select the bottom right image
-    -1,  1,  1,        0.5 , 0.5,
-     1,  1,  1,        0.75, 0.5,
-    -1,  1, -1,        0.5 , 1  ,
-     1,  1, -1,        0.75, 1  ,
+     // front face
+    -1,  1,  1,
+    -1, -1,  1,
+     1,  1,  1,
+     1, -1,  1,
+     // right face
+     1,  1, -1,
+     1,  1,  1,
+     1, -1, -1,
+     1, -1,  1,
+     // back face
+     1,  1, -1,
+     1, -1, -1,
+    -1,  1, -1,
+    -1, -1, -1,
+     // left face
+    -1,  1,  1,
+    -1,  1, -1,
+    -1, -1,  1,
+    -1, -1, -1,
+     // bottom face
+     1, -1,  1,
+    -1, -1,  1,
+     1, -1, -1,
+    -1, -1, -1,
+     // top face
+    -1,  1,  1,
+     1,  1,  1,
+    -1,  1, -1,
+     1,  1, -1,
  ]);

  ...

  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (3 + 2) * 4, // (3+2) floats 4 bytes each
+          arrayStride: (3) * 4, // (3) floats 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
-            {shaderLocation: 1, offset: 12, format: 'float32x2'},  // texcoord
          ],
        },
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
```

在片段着色器中，我们需要使用 `texture_cube` 而不是 `texture_2d`，并且与 `texture_cube` 一起使用时，`textureSample` 接受一个 `vec3f` 方向，因此我们传递法线。由于法线是一个阶段间变量，会被插值，所以我们需要对其进行法线化。

```wgsl
@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
-@group(0) @binding(2) var ourTexture: texture_2d<f32>;
+@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return textureSample(ourTexture, ourSampler, vsOut.texcoord);
+  return textureSample(ourTexture, ourSampler, normalize(vsOut.normal));
}
```

要真正创建一个立方体贴图，我们需要创建一个包含 6 层的二维纹理。让我们修改所有辅助函数来处理多个数据源。

## <a id="a-texture-helpers"></a> 让纹理辅助函数支持多层

首先，让我们把 `createTextureFromSource` 改成 `createTextureFromSources`，它接受一个数据源数组

```js
-  function createTextureFromSource(device, source, options = {}) {
+  function createTextureFromSources(device, sources, options = {}) {
+    // Assume are sources all the same size so just use the first one for width and height
+    const source = sources[0];
    const texture = device.createTexture({
      format: 'rgba8unorm',
      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
-      size: [source.width, source.height],
+      size: [source.width, source.height, sources.length],
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
-    copySourceToTexture(device, texture, source, options);
+    copySourcesToTexture(device, texture, sources, options);
    return texture;
  }
```

上面的代码创建了一个包含多层的纹理，每个数据源对应一层。它还假设所有数据源的大小相同。这似乎是一个合理的假设，因为同一纹理的不同层具有不同大小的情况非常罕见。

现在我们需要更新 `copySourceToTexture` 来处理多个数据源。

```js
-  function copySourceToTexture(device, texture, source, {flipY} = {}) {
+  function copySourcesToTexture(device, texture, sources, {flipY} = {}) {
+    sources.forEach((source, layer) => {
*      device.queue.copyExternalImageToTexture(
*        { source, flipY, },
-        { texture },
+        { texture, origin: [0, 0, layer] },
*        { width: source.width, height: source.height },
*      );
+  });

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }
```

上面，唯一的主要区别是我们添加了一个循环来遍历所有数据源，并设置了一个 `origin` 来指定要复制到纹理的哪个位置，这样每个数据源就被复制到对应的层中。

现在我们需要更新 `generateMips` 来处理多个数据源。

```js
  const generateMips = (() => {
    let sampler;
    let module;
    const pipelineByFormat = {};

    return function generateMips(device, texture) {
      if (!module) {
        module = device.createShaderModule({
          label: 'textured quad shaders for mip level generation',
          code: /* wgsl */ `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
              let pos = array(
                // 1st triangle
                vec2f( 0.0,  0.0),  // center
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 0.0,  1.0),  // center, top

                // 2nd triangle
                vec2f( 0.0,  1.0),  // center, top
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 1.0,  1.0),  // right, top
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
        });

        sampler = device.createSampler({
          minFilter: 'linear',
          magFilter: 'linear',
        });
      }

      if (!pipelineByFormat[texture.format]) {
        pipelineByFormat[texture.format] = device.createRenderPipeline({
          label: 'mip level generator pipeline',
          layout: 'auto',
          vertex: {
            module,
          },
          fragment: {
            module,
            targets: [{ format: texture.format }],
          },
        });
      }
      const pipeline = pipelineByFormat[texture.format];

      const encoder = device.createCommandEncoder({
        label: 'mip gen encoder',
      });

      for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
+        for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
*          const bindGroup = device.createBindGroup({
*            layout: pipeline.getBindGroupLayout(0),
*            entries: [
*              { binding: 0, resource: sampler },
-              { binding: 1, resource: texture.createView({baseMipLevel, mipLevelCount: 1}) },
+              {
+                binding: 1,
+                resource: texture.createView({
+                  dimension: '2d',
+                  baseMipLevel: baseMipLevel - 1,
+                  mipLevelCount: 1,
+                  baseArrayLayer: layer,
+                  arrayLayerCount: 1,
+                }),
*            ],
*          });

*          const renderPassDescriptor = {
*            label: 'our basic canvas renderPass',
*            colorAttachments: [
*              {
-                view: texture.createView({baseMipLevel, mipLevelCount: 1}),
+                view: texture.createView({
+                  dimension: '2d',
+                  baseMipLevel: baseMipLevel,
+                  mipLevelCount: 1,
+                  baseArrayLayer: layer,
+                  arrayLayerCount: 1,
+                }),
*                loadOp: 'clear',
*                storeOp: 'store',
*              },
*            ],
*          };

*          const pass = encoder.beginRenderPass(renderPassDescriptor);
*          pass.setPipeline(pipeline);
*          pass.setBindGroup(0, bindGroup);
*          pass.draw(6);  // call our vertex shader 6 times
*          pass.end();
+        }
+      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    };
  })();
```

我们添加了一个循环来处理纹理的每一层。我们修改了视图，使它们只选择一个层。我们还必须显式选择 `dimension: '2d'`，因为默认情况下，具有多层以上的二维纹理的视图会得到 `dimension: '2d-array'`，而对于生成 mipmap 来说，这不是我们想要的。

> 注意：[兼容性模式的文章](webgpu-compatibility-mode.html)提供了一个可在兼容性模式下工作的 `generateMips` 版本。

虽然我们这里不会用到它们，但原来的 `createTextureFromSource` 和 `copySourceToTexture` 函数可以很容易地被替换为

```js
  function copySourceToTexture(device, texture, source, options = {}) {
    copySourcesToTexture(device, texture, [source], options);
  }

  function createTextureFromSource(device, source, options = {}) {
    return createTextureFromSources(device, [source], options);
  }
```

现在我们准备好了这些函数，就可以使用文章开头创建的 6 个面了

```js
  const texture = await createTextureFromSources(
      device, faceCanvases, {mips: true, flipY: false});
```

剩下的就是修改绑定组中纹理的视图

```js
  const bindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: uniformBuffer },
      { binding: 1, resource: sampler },
-      { binding: 2, resource: texture },
+      { binding: 2, resource: texture.createView({dimension: 'cube'}) },
    ],
  });
```

然后就可以了

{{{example url="../webgpu-cube-map.html" }}}

注意这些面作为纹理层的顺序

* layer 0 => 正 x
* layer 1 => 负 x
* layer 2 => 正 y
* layer 3 => 负 y
* layer 4 => 正 z
* layer 5 => 负 z

另一种理解方式是，如果你调用 `textureSample` 并传递相应的方向，它将返回该纹理层中心像素的颜色。

* `textureSample(tex, sampler, vec3f( 1, 0, 0))` => layer 0 的中心
* `textureSample(tex, sampler, vec3f(-1, 0, 0))` => layer 1 的中心
* `textureSample(tex, sampler, vec3f( 0, 1, 0))` => layer 2 的中心
* `textureSample(tex, sampler, vec3f( 0,-1, 0))` => layer 3 的中心
* `textureSample(tex, sampler, vec3f( 0, 0, 1))` => layer 4 的中心
* `textureSample(tex, sampler, vec3f( 0, 0,-1))` => layer 5 的中心

使用立方体贴图来给立方体贴纹理**不是**立方体贴图的典型用法。给立方体贴纹理的*正确*或标准方法是像我们[之前提到的](webgpu-importing-textures.html#a-texture-atlases)那样使用纹理图集。本文的目的只是介绍立方体贴图的概念，并展示如何传递方向（法线），它就会返回该方向上立方体的颜色。

现在我们学习了什么是立方体贴图以及如何设置它，立方体贴图有什么用？立方体贴图最常见的用途可能是作为[*环境贴图*](webgpu-environment-maps.html)。

