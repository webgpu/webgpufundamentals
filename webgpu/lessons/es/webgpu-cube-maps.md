Title: Cubemaps en WebGPU
Description: Cómo usar cubemaps en WebGPU
TOC: Cubemaps

Este artículo asume que has leído [el artículo sobre texturas](webgpu-textures.html) y [el artículo sobre la importación de imágenes en texturas](webgpu-importing-textures.html).
Este artículo también utiliza conceptos cubiertos en [el artículo sobre iluminación direccional](webgpu-lighting-directional.html).
Si aún no has leído esos artículos, es posible que quieras leerlos primero.

En un [artículo anterior](webgpu-textures.html) cubrimos cómo usar texturas, cómo se referencian mediante coordenadas de textura que van de 0 a 1 a lo ancho y a lo largo de la textura, y cómo se filtran opcionalmente usando mips.

Otro tipo de textura es un **cubemap** (mapa de cubo). Un cubemap consta de 6 caras que representan las 6 caras de un cubo. En lugar de las coordenadas de textura tradicionales que tienen 2 dimensiones, un cubemap utiliza una normal o, en otras palabras, una dirección 3D. Dependiendo de la dirección a la que apunte la normal, se selecciona una de las 6 caras del cubo y luego, dentro de esa cara, se muestrean los píxeles para producir un color.

Hagamos un ejemplo sencillo: utilizaremos un canvas 2D para crear las imágenes utilizadas en cada una de las 6 caras.

Aquí hay algo de código para rellenar un canvas con un color y un mensaje centrado:

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

Y aquí el código para llamarlo y generar las 6 imágenes:

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

// muestra los resultados
for (const canvas of faceCanvases) {
  document.body.appendChild(canvas);
}
```

{{{example url="../webgpu-cube-faces.html" }}}

Ahora apliquemos estas imágenes a un cubo aplicando un cubemap. Comenzaremos con el código del ejemplo de atlas de texturas [en el artículo sobre la importación de texturas](webgpu-importing-textures.html#a-texture-atlases).

En primer lugar, cambiemos los shaders para usar un cubemap:

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

Hemos eliminado las coordenadas de textura del shader y cambiado la variable inter-stage para pasar una normal al fragment shader (shader de fragmentos). Dado que las posiciones de nuestro cubo están perfectamente centradas alrededor del origen, podemos usarlas simplemente como nuestras normales.

Recuerda del [artículo sobre iluminación](webgpu-lighting-directional.html) que las normales son una dirección y se suelen utilizar para especificar la dirección de la superficie de algún vértice. Debido a que estamos usando las posiciones normalizadas para nuestras normales, si ilumináramos esto obtendríamos una iluminación suave en todo el cubo.

{{{diagram url="resources/cube-normals.html" caption="normales de cubo estándar vs. normales de este cubo" width="700" height="400"}}}

Como no estamos usando coordenadas de textura, podemos eliminar todo el código relacionado con su configuración.

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
-    // left face       select the bottom left image
-    -1,  1,  1,        0   , 0.5,
-    -1,  1, -1,        0.25, 0.5,
-    -1, -1,  1,        0   , 1  ,
-    -1, -1, -1,        0.25, 1  ,
-    // bottom face     select the bottom middle image
-     1, -1,  1,        0.25, 0.5,
-    -1, -1,  1,        0.5 , 0.5,
-     1, -1, -1,        0.25, 1  ,
-    -1, -1, -1,        0.5 , 1  ,
-    // top face        select the bottom right image
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
+    // left face
+    -1,  1,  1,
+    -1,  1, -1,
+    -1, -1,  1,
+    -1, -1, -1,
+    // bottom face
+     1, -1,  1,
+    -1, -1,  1,
+     1, -1, -1,
+    -1, -1, -1,
+    // top face
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
+          arrayStride: (3) * 4, // (3) floats 4 bytes cada uno
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

En el fragment shader necesitamos usar un `texture_cube` en lugar de un `texture_2d`. Además, `textureSample`, cuando se usa con un `texture_cube`, recibe una dirección `vec3f`, así que pasamos la normal. Dado que la normal es una variable inter-stage y será interpolada, necesitamos normalizarla.

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

Para crear realmente un cubemap, creamos una textura 2D con 6 capas. Cambiemos todas nuestras funciones de ayuda (helpers) para que admitan múltiples fuentes.

## <a id="a-texture-helpers"></a> Hacer que nuestras funciones de ayuda de texturas admitan múltiples capas

Primero, tomemos nuestra función `createTextureFromSource` y cambiémosla a `createTextureFromSources`, de modo que reciba un array de fuentes:

```js
-  function createTextureFromSource(device, source, options = {}) {
+  function createTextureFromSources(device, sources, options = {}) {
+    // Asumimos que todas las fuentes son del mismo tamaño, así que usamos la primera para el ancho y el alto
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

El código anterior crea una textura con múltiples capas, una para cada fuente. También asume que todas las fuentes tienen el mismo tamaño. Esto parece una apuesta segura, ya que sería muy raro que tuvieran tamaños diferentes para capas de la misma textura.

Ahora necesitamos actualizar `copySourceToTexture` para que admita múltiples fuentes.

```js
-  function copySourceToTexture(device, texture, source, {flipY} = {}) {
+  function copySourcesToTexture(device, texture, sources, {flipY} = {}) {
+    sources.forEach((source, layer) => {
+      device.queue.copyExternalImageToTexture(
+        { source, flipY, },
+        { texture, origin: [0, 0, layer] },
+        { width: source.width, height: source.height },
+      );
+  });

     if (texture.mipLevelCount > 1) {
       generateMips(device, texture);
     }
   }
```

Arriba, la única diferencia importante es que añadimos un bucle para recorrer las fuentes y establecimos un `origin` para indicar en qué lugar de la textura copiar la fuente, de modo que copiemos cada fuente en su capa correspondiente.

Ahora necesitamos actualizar `generateMips` para que admita múltiples fuentes.

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
           const bindGroup = device.createBindGroup({
             layout: pipeline.getBindGroupLayout(0),
             entries: [
               { binding: 0, resource: sampler },
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
+              },
             ],
           });

           const renderPassDescriptor = {
             label: 'our basic canvas renderPass',
             colorAttachments: [
               {
-                view: texture.createView({baseMipLevel, mipLevelCount: 1}),
+                view: texture.createView({
+                  dimension: '2d',
+                  baseMipLevel: baseMipLevel,
+                  mipLevelCount: 1,
+                  baseArrayLayer: layer,
+                  arrayLayerCount: 1,
+                }),
                 loadOp: 'clear',
                 storeOp: 'store',
               },
             ],
           };

           const pass = encoder.beginRenderPass(renderPassDescriptor);
           pass.setPipeline(pipeline);
           pass.setBindGroup(0, bindGroup);
           pass.draw(6);  // llama a nuestro vertex shader 6 veces
           pass.end();
+        }
       }

       const commandBuffer = encoder.finish();
       device.queue.submit([commandBuffer]);
     };
   })();
```

Añadimos un bucle para manejar cada capa de la textura. Cambiamos las vistas (views) para que seleccionen una única capa. También tuvimos que elegir explícitamente `dimension: '2d'` para nuestras vistas porque, por defecto, una vista de una textura 2D con más de 1 capa obtiene la dimensión `dimension: '2d-array'`, lo cual no es lo que queremos para generar mipmaps.

> Nota: [El artículo sobre el modo de compatibilidad](webgpu-compatibility-mode.html) proporciona una versión de `generateMips` que funciona en dicho modo.

Aunque no las usaremos aquí, nuestras funciones originales `createTextureFromSource` y `copySourceToTexture` pueden reemplazarse fácilmente por:

```js
  function copySourceToTexture(device, texture, source, options = {}) {
    copySourcesToTexture(device, texture, [source], options);
  }

  function createTextureFromSource(device, source, options = {}) {
    return createTextureFromSources(device, [source], options);
  }
```

Ahora que tenemos esto listo, podemos usar las caras que creamos al principio del artículo:

```js
  const texture = await createTextureFromSources(
      device, faceCanvases, {mips: true, flipY: false});
```

Todo lo que queda por hacer es cambiar la vista de nuestra textura en el bindGroup:

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

Y ¡listo!

{{{example url="../webgpu-cube-map.html" }}}

Ten en cuenta el orden de las caras como capas de la textura:

* capa 0 => x positiva
* capa 1 => x negativa
* capa 2 => y positiva
* capa 3 => y negativa
* capa 4 => z positiva
* capa 5 => z negativa

Otra forma de pensarlo es que si llamaras a `textureSample` y pasaras las direcciones correspondientes, devolvería el color del píxel (o píxeles) central de esa capa de la textura.

* `textureSample(tex, sampler, vec3f( 1, 0, 0))` => centro de la capa 0
* `textureSample(tex, sampler, vec3f(-1, 0, 0))` => centro de la capa 1
* `textureSample(tex, sampler, vec3f( 0, 1, 0))` => centro de la capa 2
* `textureSample(tex, sampler, vec3f( 0,-1, 0))` => centro de la capa 3
* `textureSample(tex, sampler, vec3f( 0, 0, 1))` => centro de la capa 4
* `textureSample(tex, sampler, vec3f( 0, 0,-1))` => centro de la capa 5

Usar un **cubemap** para texturizar un cubo **no** es para lo que se suelen usar los cubemaps. La forma *correcta*, o más bien estándar, de texturizar un cubo es usar un atlas de texturas como [mencionamos antes](webgpu-importing-textures.html#a-texture-atlases). El objetivo de este artículo era introducir el concepto de **cubemap** y mostrar cómo se le pasan direcciones (normales) y devuelve el color del cubo en esa dirección.

Ahora que hemos aprendido qué es un **cubemap** y cómo configurarlo, ¿para qué se utiliza? Probablemente, el uso más común de un **cubemap** es como un [**environment map** (mapa de entorno)](webgpu-environment-maps.html).

