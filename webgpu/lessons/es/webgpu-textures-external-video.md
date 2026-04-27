Title: Uso eficiente de video en WebGPU
Description: Cómo usar video en WebGPU
TOC: Uso de video

En el [artículo anterior](webgpu-importing-textures.html), cubrimos cómo cargar imágenes, canvases y video en una textura. Este artículo tratará sobre una forma más eficiente de usar video en WebGPU.

En el artículo anterior cargamos datos de video en una textura de WebGPU llamando a `copyExternalImageToTexture`. Esta función copia el frame actual del video desde el propio video a una textura preexistente que hayamos creado.

WebGPU tiene otro método para usar video. Se llama `importExternalTexture` y, como su nombre indica, proporciona una `GPUExternalTexture`. Esta textura externa representa los datos del video directamente. No se realiza ninguna copia. [^no-copy] Pasas un video a `importExternalTexture` y te devuelve una textura lista para usar.

[^no-copy]: Lo que sucede realmente depende de la implementación del navegador. La especificación de WebGPU se diseñó con la esperanza de que el navegador no necesitara realizar una copia.

Hay algunas advertencias importantes al usar una textura de `importExternalTexture`.

* ## La textura solo es válida hasta que salgas de la tarea actual de JavaScript.

  Para la mayoría de las aplicaciones WebGPU, eso significa que la textura solo existe hasta que finaliza tu función `requestAnimationCallback`. O cualquier evento en el que estés renderizando; `requestVideoFrameCallback`, `setTimeout`, `mouseMove`, etc... Cuando tu función termina, la textura expira. Para volver a usar el video, debes llamar a `importExternalTexture` de nuevo.

  Una implicación de esto es que debes crear un nuevo bind group cada vez que llames a `importExternalTexture` [^bindgroup-exception] para poder pasar la nueva textura a tu shader.

  [^bindgroup-exception]: La especificación realmente dice que la implementación puede devolver la misma textura, pero no es obligatorio. Si quieres comprobar si obtuviste la misma textura, compárala con la textura anterior como en: <pre><code>const newTexture = device.importExternalTexture(...);<br>const same = oldTexture === newTexture;</code></pre> Si es la misma textura, entonces puedes reutilizar tu bind group existente y la `oldTexture` referenciada.

* ## Debes usar `texture_external` en tus shaders

  Hemos estado usando `texture_2d<f32>` en todos los ejemplos de texturas anteriores, pero las texturas de `importExternalTexture` solo pueden vincularse a puntos de binding que utilicen `texture_external`.

* ## Debes usar `textureSampleBaseClampToEdge` en tus shaders

  Hemos estado usando `textureSample` en todos los ejemplos de texturas anteriores, pero las texturas de `importExternalTexture` solo pueden usar `textureSampleBaseClampToEdge`. [^textureLoad] Como su nombre indica, `textureSampleBaseClampToEdge` solo muestreará el nivel de mip base (nivel 0). En otras palabras, las texturas externas no pueden tener un mipmap. Además, la función realiza un "clamp to edge" (ajuste a los bordes), lo que significa que si estableces un sampler con `addressModeU: 'repeat'`, este será ignorado.

  Ten en cuenta que puedes implementar tu propio comportamiento de repetición usando `fract` de esta manera:

  ```wgsl
  let color = textureSampleBaseClampToEdge(
     someExternalTexture,
     someSampler,
     fract(texcoord)
  );
  ```

  [^textureLoad]: También puedes usar `textureLoad` con texturas externas.

Si estas restricciones no son adecuadas para tus necesidades, entonces deberás usar `copyExternalImageToTexture` como cubrimos en [el artículo anterior](webgpu-importing-textures.html).

Hagamos un ejemplo funcional usando `importExternalTexture`. Aquí tienes un video:

<div class="webgpu_center">
  <div>
     <video muted controls src="../resources/videos/pexels-anna-bondarenko-5534310 (540p).mp4" style="width: 320px";></video>
     <div class="copyright"><a href="https://www.pexels.com/video/dog-walking-outside-the-house-5534310/">by Anna Bondarenko</a></div>
  </div>
</div>

Aquí están los cambios necesarios respecto a nuestro ejemplo anterior.

Primero necesitamos actualizar nuestro shader.

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
  matrix: mat4x4f,
};

@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
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

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy;
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
-@group(0) @binding(1) var ourTexture: texture_2d<f32>;
+@group(0) @binding(1) var ourTexture: texture_external;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
+  return textureSampleBaseClampToEdge(
+      ourTexture,
+      ourSampler,
+      fsInput.texcoord,
+  );
}
```

Arriba dejamos de multiplicar las coordenadas de textura por 50, ya que eso solo estaba ahí para mostrar la repetición, y las texturas externas no se repiten.

También realizamos los cambios obligatorios mencionados anteriormente. `texture_2d<f32>` se convierte en `texture_external` y `textureSample` se convierte en `textureSampleBaseClampToEdge`.

Eliminamos todo el código relacionado con la creación de una textura y la generación de mips.

Por supuesto, necesitamos apuntar a nuestro video:

```js
-  video.src = 'resources/videos/Golden_retriever_swimming_the_doggy_paddle-360-no-audio.webm';
+  video.src = 'resources/videos/pexels-anna-bondarenko-5534310 (540p).mp4';
```

Dado que no podemos tener niveles de mip, no hay necesidad de crear samplers que los utilicen.

```js
  const objectInfos = [];
-  for (let i = 0; i < 8; ++i) {
+  for (let i = 0; i < 4; ++i) {
    const sampler = device.createSampler({
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: (i & 1) ? 'linear' : 'nearest',
      minFilter: (i & 2) ? 'linear' : 'nearest',
-      mipmapFilter: (i & 4) ? 'linear' : 'nearest',
    });

  ...
```

Como no obtenemos una textura hasta que llamamos a `importExternalTexture`, no podemos crear nuestros bind groups por adelantado, así que guardaremos la información necesaria para crearlos más tarde. [^bindgroups-in-advance]

[^bindgroups-in-advance]: Podríamos dividir los bind groups para que haya uno que contenga el sampler y el uniformBuffer, el cual podríamos crear por adelantado, y otro que solo haga referencia a la textura externa que creamos en el momento del renderizado. Si vale la pena hacerlo o no dependerá de tus necesidades particulares.

```js
  const objectInfos = [];
  for (let i = 0; i < 4; ++i) {

    ...

-    const bindGroups = textures.map(texture =>
-      device.createBindGroup({
-        layout: pipeline.getBindGroupLayout(0),
-        entries: [
-          { binding: 0, resource: sampler },
-          { binding: 1, resource: texture },
-          { binding: 2, resource: uniformBuffer },
-        ],
-      }));

    // Guarda los datos que necesitamos para renderizar este objeto.
    objectInfos.push({
-      bindGroups,
+     sampler,
      matrix,
      uniformValues,
      uniformBuffer,
    });
```

En el momento del renderizado llamaremos a `importExternalTexture` y crearemos los bind groups:

```js
  function render() {
-    copySourceToTexture(device, texture, video);
    ...

    const encoder = device.createCommandEncoder({
      label: 'render quad encoder',
    });
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

+    const texture = device.importExternalTexture({source: video});

    objectInfos.forEach(({sampler, matrix, uniformBuffer, uniformValues}, i) => {
+      const bindGroup = device.createBindGroup({
+        layout: pipeline.getBindGroupLayout(0),
+        entries: [
+          { binding: 0, resource: sampler },
+          { binding: 1, resource: texture },
+          { binding: 2, resource: uniformBuffer },
+        ],
+      });

      ...

      pass.setBindGroup(0, bindGroup);
      pass.draw(6);  // llama a nuestro vertex shader 6 veces
    });
```

Además, dado que no podemos repetir la textura, ajustemos las matemáticas de la matriz para que los cuadriláteros que estamos dibujando sean más visibles y no los estiremos en una proporción de 50 a 1 como teníamos antes.

```js
  function render() {
    ...
    objectInfos.forEach(({bindGroups, matrix, uniformBuffer, uniformValues}, i) => {
      const bindGroup = bindGroups[texNdx];

      const xSpacing = 1.2;
-      const ySpacing = 0.7;
-      const zDepth = 50;
+      const ySpacing = 0.5;
+      const zDepth = 1;

-      const x = i % 4 - 1.5;
-      const y = i < 4 ? 1 : -1;
+      const x = i % 2 - .5;
+      const y = i < 2 ? 1 : -1;

      mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix);
-      mat4.rotateX(matrix, 0.5 * Math.PI, matrix);
-      mat4.scale(matrix, [1, zDepth * 2, 1], matrix);
+      mat4.rotateX(matrix, 0.25 * Math.PI * Math.sign(y), matrix);
+      mat4.scale(matrix, [1, -1, 1], matrix);
      mat4.translate(matrix, [-0.5, -0.5, 0], matrix);

      // copia los valores de JavaScript a la GPU
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(6);  // llama a nuestro vertex shader 6 veces
    });

```

Y con eso obtenemos una textura de video con "zero copy" en WebGPU.

{{{example url="../webgpu-simple-textured-quad-external-video.html"}}}

## ¿Por qué `texture_external`?

Algunos de ustedes habrán notado que esta forma de usar video emplea `texture_external` en lugar de algo más común como `texture_2d<f32>`, y usa `textureSampleBaseClampToEdge` en lugar de simplemente `textureSample`. Esto significa que si quieres utilizar este método para las texturas y deseas mezclarlo con otras partes de tu renderizado, necesitarás shaders diferentes. Shaders que usen `texture_2d<f32>` cuando utilices una textura estática y otros shaders que usen `texture_external` cuando quieras usar un video.

Creo que es importante entender qué está sucediendo internamente aquí.

A menudo, el video se entrega con la parte de la luminancia (el brillo de cada píxel) separada de la parte del croma (el color de cada píxel). Frecuentemente, la resolución del color es inferior a la de la luminancia. Una forma común de separar y codificar esto es [YUV](https://en.wikipedia.org/wiki/Y%E2%80%B2UV), donde los datos se dividen en luminancia (Y) e información de color (UV). Generalmente, esta representación también se comprime mejor.

El objetivo de WebGPU para las texturas externas es usar el video directamente en el formato en el que se proporciona. Para lograrlo, *finge* que hay una sola textura de video, pero en la implementación real puede haber múltiples texturas. Por ejemplo, una textura con los valores de luminancia (Y) y una textura separada con los valores UV. Además, esos valores UV podrían estar organizados de forma especial. En lugar de ser una textura con, por ejemplo, 2 valores por píxel entrelazados:

    uvuvuvuvuvuvuvuv
    uvuvuvuvuvuvuvuv
    uvuvuvuvuvuvuvuv
    uvuvuvuvuvuvuvuv
    uvuvuvuvuvuvuvuv
    uvuvuvuvuvuvuvuv

Podrían estar dispuestos así:

    uuuuuuuu
    uuuuuuuu
    uuuuuuuu
    uuuuuuuu
    uuuuuuuu
    uuuuuuuu
    vvvvvvvv
    vvvvvvvv
    vvvvvvvv
    vvvvvvvv
    vvvvvvvv
    vvvvvvvv

Un valor (u) por píxel en un área de la textura y un valor (v) en otra área. De nuevo, esto se debe a que organizar los datos de esta manera suele comprimirse mejor.

Cuando añades `texture_external` y `textureSampleBaseClampToEdge` a tu shader, WebGPU, entre bastidores, inyecta código en tu shader que toma estos datos de video y te devuelve un valor RGBA. Es posible que realice un muestreo de múltiples texturas o que tenga que hacer cálculos matemáticos con las coordenadas de textura para extraer los datos correctos de 2, 3 o más lugares y convertirlos a RGB.

Aquí están los canales Y, U y V del video anterior:

<div class="webgpu_center">
  <div class="side-by-side">
    <div class="separate">
      <img src="../resources/videos/pexels-anna-bordarenko-5534310-y-channel.png" style="width: 300px;">
      <div>Canal Y (luminancia)</div>
    </div>
    <div class="separate">
      <div class="side-by-side">
        <div class="separate">
          <img src="../resources/videos/pexels-anna-bordarenko-5534310-u-channel.png" style="width: 150px;">
          <div>Canal U<br>(rojo ↔ amarillo)</div>
        </div>
        <div class="separate">
          <img src="../resources/videos/pexels-anna-bordarenko-5534310-v-channel.png" style="width: 150px;">
          <div>Canal V<br>(azul ↔ amarillo)</div>
        </div>
      </div>
    </div>
  </div>
</div>

WebGPU está proporcionando efectivamente una optimización aquí. En las librerías gráficas tradicionales, esto te correspondería a ti. O bien escribirías el código tú mismo para convertir de YUV a RGB, o bien le pedirías al sistema operativo que lo hiciera. Copiarías los datos a una textura RGBA y luego usarías esa textura RGBA como `texture_2d<f32>`. Ese método es más flexible, ya que no tienes que escribir shaders diferentes para video frente a texturas estáticas. Sin embargo, es más lento porque la conversión debe ocurrir desde las texturas YUV a la textura RGBA.

Este método más lento pero más flexible sigue estando disponible en WebGPU y lo cubrimos [en el artículo anterior](webgpu-importing-textures.html#a-loading-video). Si necesitas esa flexibilidad, por ejemplo, si quieres poder usar video en cualquier lugar sin necesitar shaders diferentes para video vs. imágenes estáticas, entonces usa ese método.

Una razón por la que WebGPU proporciona esta optimización para `texture_external` es porque esto es la web. Los formatos de video soportados en el navegador cambian con el tiempo. WebGPU gestionará esto por ti, mientras que si tuvieras que escribir el shader tú mismo para convertir de YUV a RGB, también necesitarías saber que el formato de los videos no cambiará, algo que la web no puede garantizar.

Los lugares más obvios para usar el método `texture_external` descrito en este artículo serían funciones relacionadas con video, como por ejemplo aplicaciones tipo Meet, Zoom o FB Messenger; cuando se realiza reconocimiento facial para añadir visualizaciones o separación de fondo. Otro caso podría ser para video VR una vez que WebGPU sea compatible con WebXR.

## <a id="a-web-camera"></a> Uso de la cámara

De hecho, vamos a usar la cámara. Es un cambio muy pequeño.

Primero, no especificamos un video para reproducir.

```js
  const video = document.createElement('video');
-  video.muted = true;
-  video.loop = true;
-  video.preload = 'auto';
-  video.src = 'resources/videos/pexels-anna-bondarenko-5534310 (540p).mp4'; /* webgpufundamentals: url */
   await waitForClick();
   await startPlayingAndWaitForVideo(video);
```

Luego, cuando el usuario hace clic en reproducir, llamamos a `getUserMedia` y solicitamos la cámara. El stream resultante se aplica entonces al video.

```js
  function waitForClick() {
    return new Promise(resolve => {
      window.addEventListener(
        'click',
        'click',
-        () => {
+        async() => {
          document.querySelector('#start').style.display = 'none';
-          resolve();
+          try {
+            const stream = await navigator.mediaDevices.getUserMedia({
+              video: true,
+            });
+            video.srcObject = stream;
+            resolve();
+          } catch (e) {
+            fail(`could not access camera: ${e.message ?? ''}`);
+          }
        },
        { once: true });
    });
  }
```

Dependiendo de tu caso de uso, probablemente querrás reflejar la imagen para que aparezca igual que un espejo.

```js
      mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix);
      mat4.rotateX(matrix, 0.25 * Math.PI * Math.sign(y), matrix);
-      mat4.scale(matrix, [1, -1, 1], matrix);
+      mat4.scale(matrix, [-1, -1, 1], matrix);
      mat4.translate(matrix, [-0.5, -0.5, 0], matrix);
```

No se necesitan otros cambios.

{{{example url="../webgpu-simple-textured-quad-external-video-camera.html"}}}

Podríamos realizar cambios similares al [ejemplo de video del artículo anterior](webgpu-importing-textures.html#a-loading-video) si quisiéramos la imagen de la cámara como el tipo de textura `texture<f32>`, que es más flexible, en lugar del tipo de textura `texture_external`, que es más eficiente.
