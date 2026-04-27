Title: Carga de imágenes en texturas en WebGPU
Description: Cómo cargar una Imagen/Canvas/Video en una textura
TOC: Carga de imágenes

Cubrimos algunos conceptos básicos sobre el uso de texturas [en el artículo anterior](webgpu-textures.html). En este artículo cubriremos la carga de una imagen en una textura, así como la generación de mipmaps en la GPU.

En el artículo anterior creamos una textura llamando a `device.createTexture` y luego pusimos datos en la textura llamando a `device.queue.writeTexture`. Hay otra función en `device.queue` llamada `device.queue.copyExternalImageToTexture` que nos permite copiar una imagen en una textura.

Esta función puede tomar un `ImageBitmap`, así que tomemos [el ejemplo de magFilter del artículo anterior](webgpu-textures.html#a-mag-filter) y modifiquémoslo para cargar algunas imágenes.

Primero necesitamos algo de código para obtener un `ImageBitmap` de una imagen:

```js
  async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }
```

El código anterior llama a `fetch` con la URL de una imagen. Esto devuelve una `Response`. Luego la usamos para cargar un `Blob` que representa de forma opaca los datos del archivo de imagen. Después pasamos eso a `createImageBitmap`, que es una función estándar del navegador para crear un `ImageBitmap`. Pasamos `{ colorSpaceConversion: 'none' }` para indicarle al navegador que no aplique ningún espacio de color. Depende de ti si quieres que el navegador aplique un espacio de color o no. a menudo en WebGPU podríamos cargar una imagen que es un normal map o un mapa de altura (height map) o algo que no son datos de color. En esos casos definitivamente no queremos que el navegador manipule los datos de la imagen.

Ahora que tenemos código para crear un `ImageBitmap`, carguemos uno y creemos una textura del mismo tamaño.

Cargaremos esta imagen:

<div class="webgpu_center"><img src="../resources/images/f-texture.png"></div>

Una vez me enseñaron que una textura con una `F` es un buen ejemplo de textura porque podemos ver instantáneamente su orientación.

<div class="webgpu_center"><img src="resources/f-orientation.svg"></div>

```js
-  const texture = device.createTexture({
-    label: 'yellow F on red',
-    size: [kTextureWidth, kTextureHeight],
-    format: 'rgba8unorm',
-    usage:
-      GPUTextureUsage.TEXTURE_BINDING |
-      GPUTextureUsage.COPY_DST,
-  });
+  const url = 'resources/images/f-texture.png';
+  const source = await loadImageBitmap(url);
+  const texture = device.createTexture({
+    label: url,
+    format: 'rgba8unorm',
+    size: [source.width, source.height],
+    usage: GPUTextureUsage.TEXTURE_BINDING |
+           GPUTextureUsage.COPY_DST |
+           GPUTextureUsage.RENDER_ATTACHMENT,
+  });
```

Ten en cuenta que `copyExternalImageToTexture` requiere que incluyamos los flags de uso `GPUTextureUsage.COPY_DST` y `GPUTextureUsage.RENDER_ATTACHMENT`.

Entonces podemos copiar el `ImageBitmap` a la textura:

```js
-  device.queue.writeTexture(
-      { texture },
-      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
-      { width: kTextureWidth, height: kTextureHeight },
-  );
+  device.queue.copyExternalImageToTexture(
+    { source, flipY: true },
+    { texture },
+    { width: source.width, height: source.height },
+  );
```

Los parámetros para `copyExternalImageToTexture` son: la fuente (source), el destino (destination) y el tamaño. Para la fuente podemos especificar `flipY: true` si queremos que la textura se invierta al cargarla.

¡Y eso funciona!

{{{example url="../webgpu-simple-textured-quad-import-no-mips.html"}}}

## <a id="a-generating-mips-on-the-gpu"></a>Generación de mips en la GPU

En [el artículo anterior también generamos un mipmap](webgpu-textures.html#a-mipmap-filter), pero en ese caso teníamos fácil acceso a los datos de la imagen. Al cargar una imagen, podríamos dibujarla en un canvas 2D, llamar a `getImageData` para obtener los datos y finalmente generar los mips y subirlos. Eso sería bastante lento. También sería potencialmente con pérdida, ya que la forma en que el canvas 2D renderiza depende intencionalmente de la implementación.

Cuando generamos niveles de mip (mip levels) hicimos una interpolación bilineal, que es exactamente lo que hace la GPU con `minFilter: linear`. Podemos usar esa característica para generar niveles de mip en la GPU.

Modifiquémoslo el [ejemplo de mipmapFilter del artículo anterior](webgpu-textures.html#a-mipmap-filter) para cargar imágenes y generar mips usando la GPU.

Primero, cambiemos el código que crea la textura para crear niveles de mip. Necesitamos saber cuántos crear, lo cual podemos calcular así:

```js
  const numMipLevels = (...sizes) => {
    const maxSize = Math.max(...sizes);
    return 1 + Math.log2(maxSize) | 0;
  };
```

Podemos llamar a esa función con uno o más números y devolverá el número de mips necesarios; por ejemplo, `numMipLevels(123, 456)` devuelve `9`.

> * nivel 0: 123, 456
> * nivel 1: 61, 228
> * nivel 2: 30, 114
> * nivel 3: 15, 57
> * nivel 4: 7, 28
> * nivel 5: 3, 14
> * nivel 6: 1, 7
> * nivel 7: 1, 3
> * nivel 8: 1, 1
> 
> 9 niveles de mip

`Math.log2` nos dice la potencia de 2 que necesitamos para obtener nuestro número. En otras palabras, `Math.log2(8) = 3` porque 2<sup>3</sup> = 8. Otra forma de decir lo mismo es que `Math.log2` nos dice cuántas veces podemos dividir ese número por 2.

> ```
> Math.log2(8)
>           8 / 2 = 4
>                   4 / 2 = 2
>                           2 / 2 = 1
> ```

Así que podemos dividir 8 por 2 tres veces. Eso es exactamente lo que necesitamos para calcular cuántos niveles de mip crear. Es `Math.log2(largestSize) + 1`. El 1 es para el nivel de mip 0 (el tamaño original).

Por tanto, ahora podemos crear el número correcto de niveles de mip:

```js
  const texture = device.createTexture({
    label: url,
    format: 'rgba8unorm',
    mipLevelCount: numMipLevels(source.width, source.height),
    size: [source.width, source.height],
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_DST |
           GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source, flipY: true, },
    { texture },
    { width: source.width, height: source.height },
  );
```

Para generar el siguiente nivel de mip, dibujaremos un cuadrilátero (quad) con textura, tal como hemos estado haciendo, desde el nivel de mip existente hasta el siguiente nivel, con `minFilter: linear`.

Aquí está el código:

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
                // 1er triángulo
                vec2f( 0.0,  0.0),  // centro
                vec2f( 1.0,  0.0),  // derecha, centro
                vec2f( 0.0,  1.0),  // centro, arriba

                // 2do triángulo
                vec2f( 0.0,  1.0),  // centro, arriba
                vec2f( 1.0,  0.0),  // derecha, centro
                vec2f( 1.0,  1.0),  // derecha, arriba
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
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            {
              binding: 1,
              resource: texture.createView({
                baseMipLevel: baseMipLevel - 1,
                mipLevelCount: 1,
              }),
            },
          ],
        });

        const renderPassDescriptor = {
          label: 'our basic canvas renderPass',
          colorAttachments: [
            {
              view: texture.createView({
                baseMipLevel,
                mipLevelCount: 1,
              }),
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
      }
      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    };
  })();
```

El código anterior parece largo, pero es casi exactamente el mismo código que hemos estado usando en nuestros ejemplos con texturas hasta ahora. Lo que ha cambiado:

* Creamos un closure para mantener tres variables: `module`, `sampler` y `pipelineByFormat`. Para `module` y `sampler` comprobamos si no han sido establecidos y, si no, creamos un `GPUShaderModule` y un `GPUSampler` que podamos conservar y usar en el futuro.

* Tenemos un par de shaders que son casi exactamente iguales a todos los ejemplos anteriores. La única diferencia es esta parte:

  ```wgsl
  -  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  -  vsOutput.texcoord = xy * vec2f(1, 50);
  +  vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
  +  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
  ```

  Los datos de posición del cuadrilátero que tenemos en el shader van de 0.0 a 1.0, por lo que tal cual solo cubrirían el cuarto superior derecho de la textura que estamos dibujando, al igual que en los ejemplos. Necesitamos que cubra toda el área, por lo que al multiplicar por 2 y restar 1 obtenemos un cuadrilátero que va de -1,-1 a +1,+1.

  También invertimos la coordenada de textura Y. Esto se debe a que al dibujar en la textura, +1, +1 está en la parte superior derecha, pero queremos que la parte superior derecha de la textura que estamos muestreando esté allí. La parte superior derecha de la textura muestreada es +1, 0.

* Tenemos un objeto, `pipelineByFormat`, que usamos como un mapa de pipelines para formatos de textura. Esto es porque un pipeline necesita conocer el formato a utilizar.

* Comprobamos si ya tenemos un pipeline para un formato particular y, si no, creamos uno:
  
  ```js
      if (!pipelineByFormat[texture.format]) {
        pipelineByFormat[texture.format] = device.createRenderPipeline({
          label: 'mip level generator pipeline',
          layout: 'auto',
          vertex: {
            module,
          },
          fragment: {
            module,
  +          targets: [{ format: texture.format }],
          },
        });
      }
      const pipeline = pipelineByFormat[texture.format];
  ```

  La única diferencia importante aquí es que `targets` se establece a partir del formato de la textura, no a partir del `presentationFormat` que usamos al renderizar en el canvas.

* Finalmente usamos algunos parámetros en `texture.createView`.

  Esta es la primera vez que usamos `createView` al vincular una textura a un bind group y al establecer una textura como un `colorTarget`. Cuando vinculas una textura en un bind group, o cuando asignas una textura como un objetivo de renderizado (estableciendo `colorTargets`), puedes pasar una textura directamente o puedes pasar una `GPUTextureView`.

  ```js
     { binding: resource: someTexture },
  ```

  y

  ```js
     { binding: resource: someTexture.createView(...) }, 
  ```

  Usar la textura directamente es efectivamente un atajo para llamar a `texture.createView` sin parámetros. Sin parámetros significa que quieres acceder a toda la textura. Con parámetros, `createView` te permite seleccionar un subconjunto de la textura. En este caso usamos `createView` para seleccionar el nivel de mip del que queremos leer. Establecemos esto en el bindGroup. Y usamos `createView` de nuevo para seleccionar qué nivel de mip queremos renderizar en el descriptor del render pass (render pass descriptor).

  Iteramos sobre cada nivel de mip que necesitamos generar. Creamos un bind group para el último mip con datos y configuramos el `renderPassDescriptor` para dibujar en el nivel de mip actual. Luego codificamos un render pass para ese nivel de mip específico. Cuando terminamos, todos los mips habrán sido completados.

  ```js
      for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
  +          {
  +            binding: 1,
  +            resource: texture.createView({
  +              baseMipLevel: baseMipLevel - 1,
  +              mipLevelCount: 1,
  +            }),
  +          },
          ],
        });

        const renderPassDescriptor = {
          label: 'our basic canvas renderPass',
          colorAttachments: [
            {
  +            view: texture.createView({baseMipLevel, mipLevelCount: 1}),
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
      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
  ```

> Nota: Esta función solo maneja texturas 2D. [El artículo sobre mapas de cubo (cube maps)](webgpu-cube-maps.html#a-texture-helpers) explica cómo ampliar esta función para manejar texturas de array 2D y mapas de cubo.

## <a id="a-texture-helpers"></a>Funciones auxiliares para la carga de imágenes

Creemos algunas funciones de soporte para que sea sencillo cargar una imagen en una textura y generar mips.

Aquí hay una función que actualiza el primer nivel de mip y opcionalmente invierte la imagen. Si la textura tiene niveles de mip, los generamos.

```js
  function copySourceToTexture(device, texture, source, {flipY} = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
      { texture },
      { width: source.width, height: source.height },
    );

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }
```

<a id="a-create-texture-from-source"></a>Aquí hay una función que, dada una fuente (en este caso un `ImageBitmap`), creará una textura del tamaño correspondiente y luego llamará a la función anterior para llenarla con los datos:

```js
  function createTextureFromSource(device, source, options = {}) {
    const texture = device.createTexture({
      format: 'rgba8unorm',
*      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
      size: [source.width, source.height],
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
    copySourceToTexture(device, texture, source, options);
    return texture;
  }
```

y aquí hay una función que, dada una URL, cargará la URL como un `ImageBitmap` y llamará a la función anterior para crear una textura y llenarla con el contenido de la imagen:

```js
  async function createTextureFromImage(device, url, options) {
    const imgBitmap = await loadImageBitmap(url);
    return createTextureFromSource(device, imgBitmap, options);
  }
```

Con esas funciones configuradas, el único cambio importante en el [ejemplo de mipmapFilter](webgpu-textures.html#a-mipmap-filter) es este:

```js
-  const textures = [
-    createTextureWithMips(createBlendedMipmap(), 'blended'),
-    createTextureWithMips(createCheckedMipmap(), 'checker'),
-  ];
+  const textures = await Promise.all([
+    await createTextureFromImage(device,
+        'resources/images/f-texture.png', {mips: true, flipY: false}),
+    await createTextureFromImage(device,
+        'resources/images/coins.jpg', {mips: true}),
+    await createTextureFromImage(device,
+        'resources/images/Granite_paving_tileable_512x512.jpeg', {mips: true}),
+  ]);
```

El código anterior carga la textura F anterior así como estas dos texturas en mosaico (tiling textures):

<div class="webgpu_center side-by-side">
  <div class="separate">
    <img src="../resources/images/coins.jpg">
    <div class="copyright">
      <a href="https://renderman.pixar.com/pixar-one-thirty">CC-BY: Pixar</a>
    </div>
  </div>
  <div class="separate">
    <img src="../resources/images/Granite_paving_tileable_512x512.jpeg">
    <div class="copyright">
       <a href="https://commons.wikimedia.org/wiki/File:Granite_paving_tileable_2048x2048.jpg">CC-BY-SA: Coyau</a>
    </div>
  </div>
</div>

Y aquí está:

{{{example url="../webgpu-simple-textured-quad-import.html"}}}

## <a id="a-loading-canvas"></a>Carga de Canvas

`copyExternalImageToTexture` acepta otras *fuentes* (sources). Otra es un `HTMLCanvasElement`. Podemos usar esto para dibujar cosas en un canvas 2D y luego obtener el resultado en una textura en WebGPU. Por supuesto, puedes usar WebGPU para dibujar en una textura y usar esa textura en la que acabas de dibujar en otra cosa que renderices. De hecho, acabamos de hacer eso: renderizar en un nivel de mip y luego usar ese nivel de mip como un attachment de textura para renderizar en el siguiente nivel de mip.

Pero, a veces, usar un canvas 2D puede facilitar ciertas cosas. El canvas 2D tiene una API de nivel relativamente alto.

Así que, primero hagamos algún tipo de animación en el canvas:

```js
const size = 256;
const half = size / 2;

const ctx = document.createElement('canvas').getContext('2d');
ctx.canvas.width = size;
ctx.canvas.height = size;

const hsl = (h, s, l) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

function update2DCanvas(time) {
  time *= 0.0001;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(half, half);
  const num = 20;
  for (let i = 0; i < num; ++i) {
    ctx.fillStyle = hsl(i / num * 0.2 + time * 0.1, 1, i % 2 * 0.5);
    ctx.fillRect(-half, -half, size, size);
    ctx.rotate(time * 0.5);
    ctx.scale(0.85, 0.85);
    ctx.translate(size / 16, 0);
  }
  ctx.restore();
}

function render(time) {
  update2DCanvas(time);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

{{{example url="../canvas-2d-animation.html"}}}

Para cargar ese canvas en WebGPU solo se necesitan unos pocos cambios en nuestro ejemplo anterior.

Necesitamos crear una textura del tamaño adecuado. La forma más fácil es usar el mismo código que escribimos antes:

```js
+  const texture = createTextureFromSource(device, ctx.canvas, {mips: true});

  const textures = await Promise.all([
-    await createTextureFromImage(device,
-        'resources/images/f-texture.png', {mips: true, flipY: false}),
-    await createTextureFromImage(device,
-        'resources/images/coins.jpg', {mips: true}),
-    await createTextureFromImage(device,
-        'resources/images/Granite_paving_tileable_512x512.jpeg', {mips: true}),
+    texture,
  ]);
```

Luego necesitamos cambiar a un bucle `requestAnimationFrame`, actualizar el canvas 2D y subirlo a WebGPU:

```js
-  function render() {
+  function render(time) {
+    update2DCanvas(time);
+    copySourceToTexture(device, texture, ctx.canvas);

     ...


    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      render();
    }
  });
  observer.observe(canvas);

  canvas.addEventListener('click', () => {
    texNdx = (texNdx + 1) % textures.length;
-    render();
  });
```

Con eso podemos subir un canvas ¡Y generar niveles de mips para él!

{{{example url="../webgpu-simple-textured-quad-import-canvas.html"}}}

## <a id="a-loading-video"></a>Carga de Video

Cargar un video de esta manera no es diferente. Podemos crear un elemento `<video>` y pasarlo a las mismas funciones a las que pasamos el canvas en el ejemplo anterior, y debería funcionar con ajustes mínimos.

Aquí hay un video:

<div class="webgpu_center">
  <div>
     <video muted controls src="../resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm" style="width: 720px";></video>
     <div class="copyright"><a href="https://commons.wikimedia.org/wiki/File:Golden_retriever_swimming_the_doggy_paddle.webm">CC-BY: Golden Woofs</a></div>
  </div>
</div>

`ImageBitmap` y `HTMLCanvasElement` tienen su ancho y alto como propiedades `width` y `height`, pero `HTMLVideoElement` tiene su ancho y alto en `videoWidth` y `videoHeight`. Así que actualicemos el código para manejar esa diferencia:

```js
+  function getSourceSize(source) {
+    return [
+      source.videoWidth || source.width,
+      source.videoHeight || source.height,
+    ];
+  }

  function copySourceToTexture(device, texture, source, {flipY} = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
      { texture },
-      { width: source.width, height: source.height },
+      getSourceSize(source),
    );

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }

  function createTextureFromSource(device, source, options = {}) {
+    const size = getSourceSize(source);
    const texture = device.createTexture({
      format: 'rgba8unorm',
-      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
-      size: [source.width, source.height],
+      mipLevelCount: options.mips ? numMipLevels(...size) : 1,
+      size,
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
    });
    copySourceToTexture(device, texture, source, options);
    return texture;
  }
```

Entonces, configuremos un elemento de video:

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';

  const texture = createTextureFromSource(device, video, {mips: true});
```

y actualicémoslo en el momento del renderizado:

```js
-  function render(time) {
-    update2DCanvas(time);
-    copySourceToTexture(device, texture, ctx.canvas);
+  function render() {
+    copySourceToTexture(device, texture, video);
```

Una complicación de los videos es que necesitamos esperar a que hayan comenzado a reproducirse antes de pasarlos a WebGPU. En los navegadores modernos podemos hacerlo llamando a `video.requestVideoFrameCallback`. Nos llama cada vez que hay un nuevo frame disponible, por lo que podemos usarlo para saber cuándo hay al menos un frame disponible.

Como alternativa (fallback), podemos esperar a que el tiempo avance y rezar 🙏 porque, lamentablemente, los navegadores antiguos hacían difícil saber cuándo es seguro usar un video 😅.

```js
+  function startPlayingAndWaitForVideo(video) {
+    return new Promise((resolve, reject) => {
+      video.addEventListener('error', reject);
+      if ('requestVideoFrameCallback' in video) {
+        video.requestVideoFrameCallback(resolve);
+      } else {
+        const timeWatcher = () => {
+          if (video.currentTime > 0) {
+            resolve();
+          } else {
+            requestAnimationFrame(timeWatcher);
+          }
+        };
+        timeWatcher();
+      }
+      video.play().catch(reject);
+    });
+  }

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
+  await startPlayingAndWaitForVideo(video);

  const texture = createTextureFromSource(device, video, {mips: true});
```

Otra complicación es que necesitamos esperar a que el usuario interactúe con la página antes de poder iniciar el video [^autoplay]. Añadamos algo de HTML con un botón de reproducción.

[^autoplay]: Hay varias formas de conseguir que un video, normalmente sin audio, se reproduzca automáticamente sin tener que esperar a que el usuario interactúe con la página. Parecen cambiar con el tiempo, así que no entraremos en soluciones aquí.

```html
  <body>
    <canvas></canvas>
+    <div id="start">
+      <div>▶️</div>
+    </div>
  </body>
```

Y un poco de CSS para centrarlo:

```css
#start {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
#start>div {
  font-size: 200px;
  cursor: pointer;
}
```

Luego escribamos una función para esperar a que se haga clic y ocultarlo:

```js
+  function waitForClick() {
+    return new Promise(resolve => {
+      window.addEventListener(
+        'click',
+        () => {
+          document.querySelector('#start').style.display = 'none';
+          resolve();
+        },
+        { once: true });
+    });
+  }

  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
+  await waitForClick();
  await startPlayingAndWaitForVideo(video);

  const texture = createTextureFromSource(device, video, {mips: true});
```

Añadamos también una espera para pausar el video:

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/pexels-anna-bondarenko-5534310 (540p).mp4'; /* webgpufundamentals: url */
  await waitForClick();
  await startPlayingAndWaitForVideo(video);

+  canvas.addEventListener('click', () => {
+    if (video.paused) {
+      video.play();
+    } else {
+      video.pause();
+    }
+  });
```

Y con eso deberíamos obtener video en una textura.

{{{example url="../webgpu-simple-textured-quad-import-video.html"}}}

Una optimización que podríamos hacer: solo actualizar la textura cuando el video haya cambiado.

Por ejemplo:

```js
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
  await waitForClick();
  await startPlayingAndWaitForVideo(video);

+  let alwaysUpdateVideo = !('requestVideoFrameCallback' in video);
+  let haveNewVideoFrame = false;
+  if (!alwaysUpdateVideo) {
+    function recordHaveNewFrame() {
+      haveNewVideoFrame = true;
+      video.requestVideoFrameCallback(recordHaveNewFrame);
+    }
+    video.requestVideoFrameCallback(recordHaveNewFrame);
+  }

  ...

  function render() {
+    if (alwaysUpdateVideo || haveNewVideoFrame) {
+      haveNewVideoFrame = false;
       copySourceToTexture(device, texture, video);
+    }

    ...
```

Con este cambio solo actualizaríamos el video para cada frame nuevo. Así, por ejemplo, en un dispositivo con una frecuencia de refresco de pantalla de 120 frames por segundo, dibujaríamos a 120 frames por segundo para que las animaciones, los movimientos de cámara, etc., sean fluidos. Pero la textura del video en sí solo se actualizaría a su propia frecuencia de frames (por ejemplo, 30 fps).

**¡PERO! WebGPU tiene soporte especial para usar video de forma eficiente.**

Cubriremos eso en [otro artículo](webgpu-textures-external-video.html). La forma anterior, usando `device.queue.copyExternalImageToTexture`, en realidad está realizando **una copia**. Hacer una copia requiere tiempo. Por ejemplo, la resolución de un video 4k es generalmente de 3840 × 2160, lo que para `rgba8unorm` son 31 megas de datos que necesitan ser copiados, **por frame**. Las [texturas externas (external textures)](webgpu-textures-external-video.html) te permiten usar los datos del video directamente (sin copia) pero requieren métodos diferentes y tienen algunas restricciones.

## <a id="a-texture-atlases"></a>Atlas de texturas (Texture Atlases)

A partir de los ejemplos anteriores, podemos ver que para dibujar algo con una textura tenemos que crear la textura, ponerle datos, vincularla a un bindGroup con un sampler y referenciarla desde un shader. Entonces, ¿qué haríamos si quisiéramos dibujar múltiples texturas diferentes en un objeto? Digamos que tenemos una silla donde las patas y el respaldo son de madera pero el cojín es de tela.

<div class="webgpu_center">
  <div class="center">
    <model-viewer 
      src="/webgpu/resources/models/gltf/cc0_chair.glb"
      camera-controls
      touch-action="pan-y"
      camera-orbit="45deg 70deg 2.5m"
      interaction-prompt="none"
      disable-zoom
      disable-pan
      style="width: 400px; height: 400px;"></model-viewer>
  </div>
  <div>
    <a href="https://skfb.ly/opnwY"></a>"[CC0] Chair" by adadadad5252341 <a href="http://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>
  </div>
</div>

O un coche donde los neumáticos son de caucho, la carrocería es pintura, los parachoques y los tapacubos son cromados.

<div class="webgpu_center">
  <div class="center">
    <model-viewer 
      src="/webgpu/resources/models/gltf/classic_muscle_car.glb"
      camera-controls
      touch-action="pan-y"
      camera-orbit="45deg 70deg 20m"
      interaction-prompt="none"
      disable-zoom
      disable-pan
      style="width: 700px; height: 400px;"></model-viewer>
  </div>
  <div>
    <a href="https://skfb.ly/6Usqo"></a>"Classic Muscle car" by Lexyc16 <a href="http://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>
  </div>
</div>

Si no hiciéramos nada más, podrías pensar que tendríamos que dibujar 2 veces para la silla, una para la madera con una textura de madera y otra para el cojín con una textura de tela. Para el coche tendríamos varios dibujos, uno para los neumáticos, otro para la carrocería, otro para los parachoques, etc.

Eso terminaría siendo lento, ya que cada objeto requeriría múltiples llamadas de dibujo (draw calls). Podríamos intentar arreglarlo añadiendo más entradas a nuestro shader (2, 3, 4 texturas) con coordenadas de textura para cada una, pero eso no sería muy flexible y también sería lento, ya que tendríamos que leer las 4 texturas y añadir código para elegir entre ellas.

La forma más común de cubrir este caso es usar lo que se llama un [Atlas de texturas (Texture Atlas)](https://www.google.com/search?q=texture+atlas). Un Atlas de texturas es un nombre elegante para una textura que contiene múltiples imágenes. Luego usamos coordenadas de textura para seleccionar qué partes van a cada lugar.

Envolvamos un cubo con estas 6 imágenes:

<div class="webgpu_table_div_center">
  <style>
    table.webgpu_table_center {
      border-spacing: 0.5em;
      border-collapse: separate;
    }
    table.webgpu_table_center img {
      display:block;
    }
  </style>
  <table class="webgpu_table_center">
    <tr><td><img src="resources/noodles-01.jpg" /></td><td><img src="resources/noodles-02.jpg" /></td></tr>
    <tr><td><img src="resources/noodles-03.jpg" /></td><td><img src="resources/noodles-04.jpg" /></td></tr>
    <tr><td><img src="resources/noodles-05.jpg" /></td><td><img src="resources/noodles-06.jpg" /></td></tr>
  </table>
</div>

Usando algún software de edición de imágenes como Photoshop o [Photopea](https://photopea.com), podríamos poner las 6 imágenes en una sola imagen:

<img class="webgpu_center" src="../resources/images/noodles.jpg" />

Luego haríamos un cubo y proporcionaríamos coordenadas de textura que seleccionen cada porción de la imagen en una cara específica del cubo. Para simplificar, puse las 6 imágenes en la textura de arriba en cuadrados, en una cuadrícula de 4x2. Así que debería ser bastante fácil calcular las coordenadas de textura para cada cuadrado.

<div class="webgpu_center center diagram">
  <div>
    <div data-diagram="texture-atlas" style="display: inline-block; width: 600px;"></div>
  </div>
</div>

> El diagrama de arriba puede ser confuso porque a menudo se sugiere que las coordenadas de textura tienen el 0,0 en la esquina inferior izquierda. En realidad, no hay "abajo". Solo está la idea de que la coordenada de textura 0,0 hace referencia al primer píxel en los datos de la textura. El primer píxel en los datos de la textura es la esquina superior izquierda de la imagen. Si te convence la idea de que 0,0 = inferior izquierda, entonces nuestras coordenadas de textura se visualizarían así. **Siguen siendo las mismas coordenadas**.

<div class="webgpu_center center diagram">
  <div>
    <div data-diagram="texture-atlas-bottom-left" style="display: inline-block; width: 600px;"></div>
    <div class="center">0,0 en la parte inferior izquierda</div>
  </div>
</div>

Aquí están los vértices de posición para un cubo y las coordenadas de textura correspondientes:

```js
function createCubeVertices() {
  const vertexData = new Float32Array([
     //  posición   |  coordenada de textura
     //-------------+----------------------
     // cara frontal     selecciona la imagen superior izquierda
    -1,  1,  1,        0   , 0  ,
    -1, -1,  1,        0   , 0.5,
     1,  1,  1,        0.25, 0  ,
     1, -1,  1,        0.25, 0.5,
     // cara derecha     selecciona la imagen superior central
     1,  1, -1,        0.25, 0  ,
     1,  1,  1,        0.5 , 0  ,
     1, -1, -1,        0.25, 0.5,
     1, -1,  1,        0.5 , 0.5,
     // cara trasera     selecciona la imagen superior derecha
     1,  1, -1,        0.5 , 0  ,
     1, -1, -1,        0.5 , 0.5,
    -1,  1, -1,        0.75, 0  ,
    -1, -1, -1,        0.75, 0.5,
    // cara izquierda    selecciona la imagen inferior izquierda
    -1,  1,  1,        0   , 0.5,
    -1,  1, -1,        0.25, 0.5,
    -1, -1,  1,        0   , 1  ,
    -1, -1, -1,        0.25, 1  ,
    // cara inferior     selecciona la imagen inferior central
     1, -1,  1,        0.25, 0.5,
    -1, -1,  1,        0.5 , 0.5,
     1, -1, -1,        0.25, 1  ,
    -1, -1, -1,        0.5 , 1  ,
    // cara superior     selecciona la imagen inferior derecha
    -1,  1,  1,        0.5 , 0.5,
     1,  1,  1,        0.75, 0.5,
    -1,  1, -1,        0.5 , 1  ,
     1,  1, -1,        0.75, 1  ,

  ]);

  const indexData = new Uint16Array([
     0,  1,  2,  2,  1,  3,  // frontal
     4,  5,  6,  6,  5,  7,  // derecha
     8,  9, 10, 10,  9, 11,  // trasera
    12, 13, 14, 14, 13, 15,  // izquierda
    16, 17, 18, 18, 17, 19,  // inferior
    20, 21, 22, 22, 21, 23,  // superior
  ]);

  return {
    vertexData,
    indexData,
    numVertices: indexData.length,
  };
}
```

Para hacer este ejemplo vamos a empezar con un ejemplo del [artículo sobre cámaras](webgpu-cameras.html). Si aún no lo has leído, puedes leerlo y la serie de la que forma parte para aprender a hacer 3D. Por ahora, lo importante es que, como hicimos antes, devolvemos posiciones y coordenadas de textura desde nuestro vertex shader y las usamos para buscar valores en una textura en nuestro fragment shader. Así pues, aquí están los cambios necesarios en el shader del ejemplo de cámara, aplicando lo que tenemos arriba:

```wgsl
struct Uniforms {
  matrix: mat4x4f,
};

struct Vertex {
  @location(0) position: vec4f,
-  @location(1) color: vec4f,
+  @location(1) texcoord: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) texcoord: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
+@group(0) @binding(1) var ourSampler: sampler;
+@group(0) @binding(2) var ourTexture: texture_2d<f32>;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
-  vsOut.color = vert.color;
+  vsOut.texcoord = vert.texcoord;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  return textureSample(ourTexture, ourSampler, vsOut.texcoord);
}
```

Todo lo que hicimos fue cambiar de tomar un color por vértice a una coordenada de textura por vértice y pasar esa coordenada de textura al fragment shader, como hicimos antes. Luego la usamos en el fragment shader, como hicimos antes.

En JavaScript necesitamos cambiar el pipeline de ese ejemplo de tomar un color a tomar coordenadas de textura:

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (4) * 4, // (3) floats 4 bytes cada uno + un color de 4 bytes
+          arrayStride: (3 + 2) * 4, // (3+2) floats de 4 bytes cada uno
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // posición
-            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
+            {shaderLocation: 1, offset: 12, format: 'float32x2'},  // texcoord
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

Para mantener los datos más pequeños vamos a usar índices, tal como cubrimos en [el artículo sobre buffers de vértices](webgpu-vertex-buffers.html).

```js
-  const { vertexData, numVertices } = createFVertices();
+  const { vertexData, indexData, numVertices } = createCubeVertices();
  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer vertices',
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

Necesitamos copiar todo el código de carga de texturas y generación de mips en este ejemplo y luego usarlo para cargar la imagen del atlas de texturas. También necesitamos crear un sampler y añadirlos a nuestro bindGroup:

```js
+  const texture = await createTextureFromImage(device,
+      'resources/images/noodles.jpg', {mips: true, flipY: false});
+
+  const sampler = device.createSampler({
+    magFilter: 'linear',
+    minFilter: 'linear',
+    mipmapFilter: 'linear',
+  });

  const bindGroup = device.createBindGroup({
    label: 'bind group for object',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: uniformBuffer },
+      { binding: 1, resource: sampler },
+      { binding: 2, resource: texture },
    ],
  });
```

Necesitamos hacer algo de matemáticas 3D para configurar una matriz para dibujar en 3D. (De nuevo, consulta [el artículo sobre cámaras](webgpu-cameras.html) para ver detalles sobre matemáticas 3D).

```js
  const degToRad = d => d * Math.PI / 180;

  const settings = {
    rotation: [degToRad(20), degToRad(25), degToRad(0)],
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');

  ...

  function render() {

    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
        matrixValue,
    );
    const view = mat4.lookAt(
      [0, 1, 5],  // posición de la cámara
      [0, 0, 0],  // objetivo
      [0, 1, 0],  // arriba
    );
    mat4.multiply(matrixValue, view, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);

    // subir los valores de los uniforms al buffer de uniformes
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

And en el momento del renderizado necesitamos dibujar con índices:

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setIndexBuffer(indexBuffer, 'uint16');

    ...

    pass.setBindGroup(0, bindGroup);
-    pass.draw(numVertices);
+    pass.drawIndexed(numVertices);

    pass.end();
```

Y obtenemos un cubo, con una imagen diferente en cada lado, usando una sola textura.

{{{example url="../webgpu-texture-atlas.html"}}}

Usar un atlas de texturas es bueno porque solo hay 1 textura que cargar, el shader se mantiene simple ya que solo tiene que referenciar 1 textura, y solo requiere 1 llamada de dibujo para dibujar la forma en lugar de 1 llamada de dibujo por textura, como podría ser si mantuviéramos las imágenes por separado.

<!-- keep this at the bottom of the article -->
<script type="module" src="/3rdparty/model-viewer.3.3.0.min.js"></script>
<script type="module" src="webgpu-importing-textures.js"></script>
