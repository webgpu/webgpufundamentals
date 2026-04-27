Title: Compute Shaders en WebGPU - Histograma de Imagen
Description: Cómo calcular de manera eficiente el histograma de una imagen.
TOC: Histograma de Imagen

Este artículo continúa de [el artículo sobre los conceptos básicos de los compute shaders](webgpu-compute-shaders.html).

Este va a ser un artículo largo de dos partes y vamos a seguir muchos pasos para optimizar las cosas. Esta optimización hará que todo sea más rápido, pero desafortunadamente la salida no cambiará el resultado, por lo que cada paso se verá igual que el anterior.

Además, mencionaremos la velocidad y el tiempo (timing), pero los artículos y ejemplos se alargarían aún más si añadiéramos el código para realizar las mediciones. Así que dejaremos el tiempo para [otro artículo](webgpu-timing.html) y en estos artículos simplemente mencionaré mis propios resultados de tiempo y proporcionaré algunos ejemplos ejecutables. Espero que este artículo sirva como un buen ejemplo de cómo crear un compute shader (shader de cómputo).

Un histograma de imagen es donde se suman todos los píxeles de una imagen según sus valores o alguna medida de sus valores.

Por ejemplo, esta imagen de 6x7:

<div class="webgpu_center">
  <div>
    <div data-diagram="image" style="display: inline-block; width: 240px; max-width: 100%;"></div>
    <div style="text-align: center;">6x7</div>
  </div>
</div>

Tiene estos colores:

<div class="webgpu_center">
  <div>
    <div data-diagram="colors" style="display: inline-block; width: 240px; max-width: 100%;"></div>
  </div>
</div>

Para cada color podemos calcular un nivel de luminancia (qué tan brillante es). Buscando en internet encontré esta fórmula:

```js
// Devuelve un valor de 0 a 1 para la luminancia.
// donde r, g, b van cada uno de 0 a 1.
function srgbLuminance(r, g, b) {
  // de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
  return r * 0.2126 +
         g * 0.7152 +
         b * 0.0722;
}
```

Usando eso, podemos convertir cada valor a un nivel de luminancia:

<div class="webgpu_center">
  <div>
    <div data-diagram="luminance" style="display: inline-block; width: 240px; max-width: 100%;"></div>
  </div>
</div>

Podemos decidir un número de "bins" (contenedores). Elijamos 3 bins.
Luego podemos cuantizar esos valores de luminancia para que seleccionen un "bin" y sumar el número de píxeles que caben en cada uno.

<div class="webgpu_center">
  <div>
    <div data-diagram="imageHistogram" style="display: inline-block; width: 40px; max-width: 100%;"></div>
  </div>
</div>

Finalmente podemos graficar los valores en esos bins:

<div class="webgpu_center">
  <div>
    <div data-diagram="imageHistogramGraph" style="display: inline-block; width: 96px; max-width: 100%;"></div>
  </div>
</div>

El gráfico muestra que hay más píxeles oscuros (🟦 18) que píxeles de brillo medio (🟥 16) y aún menos píxeles brillantes (🟨 8). Eso no es muy interesante con solo 3 bins. Pero, si tomamos una foto como esta:

<div class="webgpu_center">
  <div>
    <div><img src="../resources/images/pexels-francesco-ungaro-96938-mid.jpg" style="width: 700px;"></div>
    <div style="text-align: center;"><a href="https://www.pexels.com/photo/cute-kitten-hiding-behind-a-pillow-96938/">Foto de Francesco Ungaro</a></div>
  </div>
</div>

y contamos los valores de luminancia de los píxeles, los separamos en, digamos, 256 bins y los graficamos, obtenemos algo como esto:

<div class="webgpu_center center">
  <div>
    <div><img src="resources/histogram-luminosity-photoshop.png" style="width: 237px;" class="nobg"></div>
  </div>
</div>

Calcular un histograma de imagen es bastante simple. Hagámoslo primero en JavaScript.

Vamos a crear una función que, dado un objeto `ImageData`, genere un histograma.

```js
function computeHistogram(numBins, imgData) {
  const {width, height, data} = imgData;
  const bins = new Array(numBins).fill(0);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const offset = (y * width + x) * 4;

      const r = data[offset + 0] / 255;
      const g = data[offset + 1] / 255;
      const b = data[offset + 2] / 255;
      const v = srgbLuminance(r, g, b);

      const bin = Math.min(numBins - 1, v * numBins) | 0;
      ++bins[bin];
    }
  }
  return bins;
}
```

Como puedes ver arriba, recorremos cada píxel. Extraemos r, g y b de la imagen. Calculamos un valor de luminancia. Convertimos eso a un índice de bin e incrementamos el contador de ese bin.

Una vez que tenemos esos datos, podemos graficarlos. La función principal de graficado simplemente dibuja una línea para cada bin multiplicada por alguna escala y la altura del canvas.

```js
  ctx.fillStyle = '#fff';

  for (let x = 0; x < numBins; ++x) {
    const v = histogram[x] * scale * height;
    ctx.fillRect(x, height - v, 1, v);
  }
```

Decidir una escala parece ser simplemente una elección personal. Si conoces una buena fórmula para elegir una escala, deja un comentario. 😅 Basándome en lo que vi por la red, se me ocurrió esta fórmula para la escala:

```js
  const numBins = histogram.length;
  const max = Math.max(...histogram);
  const scale = Math.max(1 / max, 0.2 * numBins / numEntries);
```

Donde `numEntries` es el número total de píxeles en la imagen (es decir, ancho * alto), y básicamente intentamos escalar para que el bin con más valores toque la parte superior del gráfico pero, si ese bin es demasiado grande, tenemos una proporción que parece producir un gráfico agradable.

Poniéndolo todo junto, creamos un canvas 2D y dibujamos:

```js
function drawHistogram(histogram, numEntries, height = 100) {
  const numBins = histogram.length;
  const max = Math.max(...histogram);
  const scale = Math.max(1 / max, 0.2 * numBins / numEntries);

  const canvas = document.createElement('canvas');
  canvas.width = numBins;
  canvas.height = height;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';

  for (let x = 0; x < numBins; ++x) {
    const v = histogram[x] * scale * height;
    ctx.fillRect(x, height - v, 1, v);
  }
}
```

Ahora necesitamos cargar una imagen. Usaremos el código que escribimos en [el artículo sobre la carga de imágenes](webgpu-importing-textures.html).

```js
async function main() {
  const imgBitmap = await loadImageBitmap('resources/images/pexels-francesco-ungaro-96938-mid.jpg');
```

Necesitamos obtener los datos de una imagen. Para hacerlo, podemos dibujar la imagen en un canvas 2D y luego usar `getImageData`.

```js
function getImageData(img) {
  const canvas = document.createElement('canvas');

  // hacer que el canvas tenga el mismo tamaño que la imagen
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
```

También escribiremos una función para mostrar un `ImageBitmap`.

```js
function showImageBitmap(imageBitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;

  const bm = canvas.getContext('bitmaprenderer');
  bm.transferFromImageBitmap(imageBitmap);
  document.body.appendChild(canvas);
}
```

Añadiremos algo de CSS para que nuestra imagen no se muestre demasiado grande y le daremos un color de fondo para no tener que dibujar uno.

```css
canvas {
  display: block;
  max-width: 256px;
  border: 1px solid #888;
  background-color: #333;
}
```

Y luego simplemente necesitamos llamar a las funciones que escribimos arriba.

```js
async function main() {
  const imgBitmap = await loadImageBitmap('resources/images/pexels-francesco-ungaro-96938-mid.jpg');

  const imgData = getImageData(imgBitmap);
  const numBins = 256;
  const histogram = computeHistogram(numBins, imgData);

  showImageBitmap(imgBitmap);

  const numEntries = imgData.width * imgData.height;
  drawHistogram(histogram, numEntries);
}
```

Y aquí está el histograma de la imagen.

{{{example url="../webgpu-compute-shaders-histogram-javascript.html"}}}

Espero que haya sido fácil seguir lo que hace el código JavaScript. ¡Vamos a convertirlo a WebGPU!

# <a id="a-comptuing-a-histogram"></a>Calculando un histograma en la GPU

Empecemos con la solución más obvia. Convertiremos directamente la función JavaScript `computeHistogram` a WGSL.

La función de luminancia es bastante sencilla. Aquí está el JavaScript de nuevo:

```js
// Devuelve un valor de 0 a 1 para la luminancia.
// donde r, g, b van cada uno de 0 a 1.
function srgbLuminance(r, g, b) {
  // de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
  return r * 0.2126 +
         g * 0.7152 +
         b * 0.0722;
}
```

y aquí está el WGSL correspondiente:

```wgsl
// de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}
```

La función `dot`, que es la abreviatura de "producto punto" (dot product), multiplica cada elemento de un vector con el elemento correspondiente de otro vector y luego suma los resultados. Para un `vec3f` como el de arriba, podría definirse como:

```wgsl
fn dot(a: vec3f, b: vec3f) -> f32 {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
```

Que es lo que teníamos en JavaScript. La principal diferencia es que en WGSL pasaremos el color como un `vec3f` en lugar de los canales individuales.

Para la parte principal del cálculo del histograma, aquí está el JavaScript de nuevo:

```js
function computeHistogram(numBins, imgData) {
  const {width, height, data} = imgData;
  const bins = new Array(numBins).fill(0);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const offset = (y * width + x) * 4;

      const r = data[offset + 0] / 255;
      const g = data[offset + 1] / 255;
      const b = data[offset + 2] / 255;
      const v = srgbLuminance(r, g, b);

      const bin = Math.min(numBins - 1, v * numBins) | 0;
      ++bins[bin];
    }
  }
  return bins;
}
```

Aquí está el WGSL correspondiente:

```js
@group(0) @binding(0) var<storage, read_write> bins: array<u32>;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

// de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}

@compute @workgroup_size(1) fn cs() {
  let size = textureDimensions(ourTexture, 0);
  let numBins = f32(arrayLength(&bins));
  let lastBinIndex = u32(numBins - 1);
  for (var y = 0u; y < size.y; y++) {
    for (var x = 0u; x < size.x; x++) {
      let position = vec2u(x, y);
      let color = textureLoad(ourTexture, position, 0);
      let v = srgbLuminance(color.rgb);
      let bin = min(u32(v * numBins), lastBinIndex);
      bins[bin] += 1;
    }
  }
}
```

Arriba, no cambió mucho. En JavaScript obtenemos los datos, el ancho y el alto de `imgData`. En WGSL obtenemos el ancho y el alto de la textura pasándola a la función `textureDimensions`.

```wgsl
  let size = textureDimensions(ourTexture, 0);
```

`textureDimensions` toma una textura y un nivel de mip (el `0` de arriba) y devuelve el tamaño de ese nivel de mip para esa textura.

Recorremos todos los píxeles de la textura, tal como hicimos en JavaScript.

```wgsl
  for (var y = 0u; y < size.y; y++) {
    for (var x = 0u; x < size.x; x++) {
```

Llamamos a `textureLoad` para obtener el color de la textura.

```wgsl
      let position = vec2u(x, y);
      let color = textureLoad(ourTexture, position, 0);
```

`textureLoad` devuelve un solo téxel (texel) de un solo nivel de mip de una textura. Toma una textura, una posición de téxel `vec2u` y un nivel de mip (el `0`).

Calculamos un valor de luminancia, lo convertimos en un índice de bin e incrementamos ese bin.

```wgsl
      let position = vec2u(x, y);
      let color = textureLoad(ourTexture, position, 0);
+      let v = srgbLuminance(color.rgb);
+      let bin = min(u32(v * numBins), lastBinIndex);
+      bins[bin] += 1;
```

Ahora que tenemos un compute shader, usémoslo.

Tenemos nuestro código de inicialización estándar:

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('necesitas un navegador que soporte WebGPU');
    return;
  }
```

luego creamos nuestro shader:

```js
  const module = device.createShaderModule({
    label: 'histogram shader',
    code: /* wgsl */ `
      @group(0) @binding(0) var<storage, read_write> bins: array<u32>;
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;

      // de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
      const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
      fn srgbLuminance(color: vec3f) -> f32 {
        return saturate(dot(color, kSRGBLuminanceFactors));
      }

      @compute @workgroup_size(1) fn cs() {
        let size = textureDimensions(ourTexture, 0);
        let numBins = f32(arrayLength(&bins));
        let lastBinIndex = u32(numBins - 1);
        for (var y = 0u; y < size.y; y++) {
          for (var x = 0u; x < size.x; x++) {
            let position = vec2u(x, y);
            let color = textureLoad(ourTexture, position, 0);
            let v = srgbLuminance(color.rgb);
            let bin = min(u32(v * numBins), lastBinIndex);
            bins[bin] += 1;
          }
        }
      }
    `,
  });
```

Creamos una pipeline de cómputo para ejecutar el shader:

```js
  const pipeline = device.createComputePipeline({
    label: 'histogram',
    layout: 'auto',
    compute: {
      module,
    },
  });
```

Después de cargar la imagen, necesitamos crear una textura y copiar los datos en ella. Usaremos la función `createTextureFromSource` que escribimos en [el artículo sobre la carga de imágenes en texturas](webgpu-importing-textures.html#a-create-texture-from-source).

```js
  const imgBitmap = await loadImageBitmap('resources/images/pexels-francesco-ungaro-96938-mid.jpg');
  const texture = createTextureFromSource(device, imgBitmap);
```

Necesitamos crear un buffer de storage para que el shader sume los valores de color:

```js
  const numBins = 256;
  const histogramBuffer = device.createBuffer({
    size: numBins * 4, // 256 entradas * 4 bytes por (u32)
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
```

y un buffer para recuperar los resultados para poder dibujarlos:

```js
  const resultBuffer = device.createBuffer({
    size: histogramBuffer.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
```

Necesitamos un bind group para pasar la textura y el buffer del histograma a nuestra pipeline:

```js
  const bindGroup = device.createBindGroup({
    label: 'histogram bindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: histogramBuffer },
      { binding: 1, resource: texture },
    ],
  });
```

Ahora podemos configurar los comandos para ejecutar el compute shader:

```js
  const encoder = device.createCommandEncoder({ label: 'histogram encoder' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
```

Necesitamos copiar el buffer del histograma al buffer de resultados:

```js
  const encoder = device.createCommandEncoder({ label: 'histogram encoder' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();

+  encoder.copyBufferToBuffer(histogramBuffer, 0, resultBuffer, 0, resultBuffer.size);
```

y luego ejecutar los comandos:

```js
  const encoder = device.createCommandEncoder({ label: 'histogram encoder' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();

  encoder.copyBufferToBuffer(histogramBuffer, 0, resultBuffer, 0, resultBuffer.size);

+  const commandBuffer = encoder.finish();
+  device.queue.submit([commandBuffer]);
```

Finalmente, podemos obtener los datos del buffer de resultados y pasarlos a nuestras funciones existentes para dibujar el histograma:

```js
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const histogram = new Uint32Array(resultBuffer.getMappedRange());

  showImageBitmap(imgBitmap);

  const numEntries = texture.width * texture.height;
  drawHistogram(histogram, numEntries);

  resultBuffer.unmap();
```

Y debería funcionar:

{{{example url="../webgpu-compute-shaders-histogram-slow.html"}}}

Al medir los resultados encontré que **¡esto es aproximadamente 30 veces más lento que la versión de JavaScript!** 😱😱😱 (los resultados pueden variar).

¿A qué se debe esto? Diseñamos nuestra solución de arriba con un solo bucle y usamos una sola invocación de workgroup con un tamaño de 1. Eso significa que se usó un solo "núcleo" de la GPU para calcular el histograma. Los núcleos de la GPU generalmente no son tan rápidos como los núcleos de la CPU. Los núcleos de la CPU tienen toneladas de circuitería adicional para intentar acelerarlos. Las GPUs obtienen su velocidad de una paralización masiva pero necesitan mantener su diseño más simple. Con nuestro shader de arriba no aprovechamos ninguna paralización.

Aquí hay un diagrama de lo que está sucediendo usando nuestro pequeño ejemplo de textura.

<div class="webgpu_center compute-diagram">
  <div data-diagram="single"></div>
</div>

> ## Diferencias entre el Diagrama y el Shader
>
> Estos diagramas no son una representación perfecta de nuestros shaders:
>
> * Muestran solo 3 bins mientras que nuestro shader tiene 256 bins.
> * El código está simplificado.
> * ▢ es el color del téxel.
> * ◯ es la selección del bin representada como luminancia.
> * Muchas cosas están abreviadas.
>   * `wid` = `workgroup_id`
>   * `gid` = `global_invocation_id`
>   * `lid` = `local_invocation_id`
>   * `ourTex` = `ourTexture`
>   * `texLoad` = `textureLoad`
>   * etc...
>
> Muchos de estos cambios son porque hay un espacio limitado para intentar mostrar muchos detalles. Mientras que este primer ejemplo usa una sola invocación, a medida que avancemos necesitaremos meter más información en menos espacio. Espero que los diagramas ayuden a la comprensión en lugar de confundir más las cosas. 😅

Dado que una sola invocación de GPU es más lenta que una CPU, necesitamos encontrar una manera de paralizar nuestro enfoque.

## Optimización - Más Invocaciones

Posiblemente la forma más fácil y obvia de acelerar esto es usar un workgroup por píxel. En nuestro código de arriba tenemos un bucle for:

```js
for (y) {
   for (x) {
      ...
   }
}
```

Podríamos cambiar el código para que en su lugar use `global_invocation_id` como entrada y luego procese cada píxel en una invocación separada.

Aquí están los cambios necesarios en el shader:

```wgsl
@group(0) @binding(0) var<storage, read_write> bins: array<vec4u>;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

// de: https://www.w3.org/WAI/GL/wiki/Relative_luminance
const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}

@compute @workgroup_size(1, 1, 1)
-fn cs() {
+fn cs(@builtin(global_invocation_id) global_invocation_id: vec3u) {
-  let size = textureDimensions(ourTexture, 0);
  let numBins = f32(arrayLength(&bins));
  let lastBinIndex = u32(numBins - 1);
-  for (var y = 0u; y < size.y; y++) {
-    for (var x = 0u; x < size.x; x++) {
-      let position = vec2u(x, y);
+  let position = global_invocation_id.xy;
  let color = textureLoad(ourTexture, position, 0);
  let v = srgbLuminance(color.rgb);
  let bin = min(u32(v * numBins), lastBinIndex);
  bins[bin] += 1;
-    }
-  }
}
```

Como puedes ver, nos deshicimos del bucle y en su lugar usamos el valor de `@builtin(global_invocation_id)` para hacer que cada invocación sea responsable de un solo píxel. Teóricamente, esto significaría que todos los píxeles podrían procesarse en paralelo. Nuestra imagen es de 2448 × 1505, que son casi 3.7 millones de píxeles, por lo que hay muchas oportunidades de paralización.

El único otro cambio necesario es ejecutar realmente un workgroup por píxel.

```js
  const encoder = device.createCommandEncoder({ label: 'histogram encoder' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
-  pass.dispatchWorkgroups(1);
+  pass.dispatchWorkgroups(texture.width, texture.height);
  pass.end();
```

Aquí está en ejecución:

{{{example url="../webgpu-compute-shaders-histogram-with-race.html"}}}

¿Qué está mal? ¿Por qué este histograma no coincide con el histograma anterior y por qué los totales no coinciden? Nota: tu ordenador podría obtener resultados diferentes al mío. En el mío, este es el histograma de la versión anterior en la parte superior y luego 4 resultados de la nueva versión en la parte inferior.

<style>
.local-img img {
  border: 1px solid #888;
  margin: 0.5em;
}
</style>
<div class="webgpu_center local-img">
  <div>
      <img src="resources/histogram-slow-luminosity.png" class="histogram-img">
      <div style="text-align: center;">Resultado anterior</div>
  </div>
  <div>
    <div>
        <img src="resources/histogram-race-01.png" class="histogram-img">
        <img src="resources/histogram-race-02.png" class="histogram-img">
    </div>
    <div>
        <img src="resources/histogram-race-03.png" class="histogram-img">
        <img src="resources/histogram-race-04.png" class="histogram-img">
    </div>
    <div style="text-align: center;">Nuevos resultados</div>
  </div>
</div>

Nuestra nueva versión obtiene resultados inconsistentes (al menos en mi máquina).

¿Qué sucedió?

Esta es una clásica *condición de carrera* (race condition) como mencionamos en [el artículo anterior](../webgpu-compute-shaders.html#a-race-conditions).

Esta línea de nuestro shader:

```wgsl
        bins[bin] += 1;
```

En realidad se traduce a esto:

```wgsl
   let value = bins[bin];
   value = value + 1
   bins[bin] = value;
```

¿Qué pasa cuando 2 o más invocaciones se están ejecutando en paralelo y coinciden en tener el mismo valor de `bin`?

Imagina 2 invocaciones, donde `bin = 1` y `bins[1] = 3`. Si se ejecutan en paralelo, ambas invocaciones cargarán 3 y ambas invocaciones escribirán 4, cuando la respuesta correcta debería ser 5.

<div class="webgpu_center data-table">
  <style>
    .local-race th { text-align: center; }
    .local-race td { white-space: pre; }
    .local-race .step { color: #969896; }
  </style>
  <div>
  <table class="local-race">
    <thead>
      <th>Invocación 1</th>
      <th>Invocación 2</th>
    </thead>
    <tbody>
      <tr>
        <td>value = bins[bin]     <span class="step">// carga 3</span></td>
        <td>value = bins[bin]     <span class="step">// carga 3</span></td>
      <tr>
        <td>value = value + 1     <span class="step">// suma 1</span></td>
        <td>value = value + 1     <span class="step">// suma 1</span></td>
      </tr>
      <tr>
        <td>bins[bin] = value     <span class="step">// guarda 4</span></td>
        <td>bins[bin] = value     <span class="step">// guarda 4</span></td>
      </tr>
    </tbody>
  </table>
  </div>
</div>

Puedes ver el problema visualmente en el diagrama de abajo. Verás que varias invocaciones van a buscar el valor actual del bin, le suman uno y lo vuelven a poner, cada una ajena a que otra invocación está leyendo y actualizando el mismo bin al mismo tiempo.

<div class="webgpu_center compute-diagram"><div data-diagram="race"></div></div>

WGSL tiene instrucciones "atómicas" especiales para resolver este problema. En este caso podemos usar `atomicAdd`. `atomicAdd` hace que la suma sea "atómica", lo que significa que en lugar de 3 operaciones (cargar->sumar->guardar), las 3 operaciones ocurren a la vez, "atómicamente". Esto evita eficazmente que más de dos invocaciones actualicen un valor al mismo tiempo.

Las funciones atómicas tienen el requisito de que solo funcionan en `i32` o `u32` y requieren que los datos en sí sean de tipo `atomic`.

Aquí están los cambios en nuestros shaders:

```wgsl
-@group(0) @binding(0) var<storage, read_write> bins: array<u32>;
+@group(0) @binding(0) var<storage, read_write> bins: array<atomic<u32>>;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}

@compute @workgroup_size(1, 1, 1)
fn cs(@builtin(global_invocation_id) global_invocation_id: vec3u) {
  let numBins = f32(arrayLength(&bins));
  let lastBinIndex = u32(numBins - 1);
  let position = global_invocation_id.xy;
  let color = textureLoad(ourTexture, position, 0);
  let v = srgbLuminance(color.rgb);
  let bin = min(u32(v * numBins), lastBinIndex);
-  bins[bin] += 1;
+  atomicAdd(&bins[bin], 1u);
}
```

Con eso, nuestro compute shader, que usa 1 invocación de workgroup por píxel, ¡funciona!

{{{example url="../webgpu-compute-shaders-histogram-race-fixed.html"}}}

Desafortunadamente, tenemos un nuevo problema. `atomicAdd` necesita bloquear eficazmente otras invocaciones para que no actualicen el mismo bin al mismo tiempo. Podemos ver el problema aquí. El diagrama de abajo muestra `atomicAdd` como 3 operaciones, pero cuando una invocación está haciendo un `atomicAdd` "bloquea el bin" para que otra invocación tenga que esperar hasta que termine.

<div class="webgpu_center compute-diagram">
  <div>Dos workgroups, uno bloqueando el bin inferior, el otro bloqueado para usar el mismo bin inferior</div>
  <div data-diagram="lockedBin"></div>
</div>

En los diagramas, cuando una invocación está bloqueando un bin tendrá una línea desde la invocación hasta el bin en el color del bin. Las invocaciones que están esperando a que ese bin se desbloquee tendrán una señal de stop 🛑 sobre ellas.

<div class="webgpu_center compute-diagram"><div data-diagram="noRace"></div></div>

En mi máquina, esta nueva versión se ejecuta unas 4 veces más rápido que JavaScript, aunque los resultados pueden variar.

## Workgroups

¿Podemos ir más rápido? Como se mencionó en [el artículo anterior](../webgpu-compute-shaders.html), el "workgroup" es la unidad más pequeña de trabajo que podemos pedirle a la GPU que haga. Defines el tamaño de un workgroup en 3 dimensiones cuando creas el módulo del shader, y luego llamas a `dispatchWorkgroups` para ejecutar un montón de estos workgroups.

Los workgroups pueden compartir almacenamiento interno y coordinar ese almacenamiento dentro del propio workgroup. ¿Cómo podríamos aprovechar ese hecho?

Probemos esto. Haremos que el tamaño de nuestro workgroup sea de 256x1 (así que 256 invocaciones por workgroup). Haremos que cada invocación trabaje en una sección de 256x1 de la imagen. Esto significará que tendremos `Math.ceil(texture.width / 256) * texture.height` workgroups en total. Para nuestra imagen, que es 2448 × 1505, eso serían 10 x 1505 o 15050 workgroups.

Haremos que las invocaciones dentro del workgroup usen almacenamiento de workgroup para sumar los valores de luminancia en los bins.

Finalmente, copiaremos la memoria del workgroup a su propio "chunk" (fragmento). De esa manera, no tendremos que coordinarnos con otros workgroups. Cuando hayamos terminado, ejecutaremos otro compute shader para sumar los chunks.

Vamos a editar nuestro shader. Primero cambiaremos nuestros `bins` de tipo `storage` a tipo `workgroup` para que solo se compartan con las invocaciones del mismo workgroup.

```wgsl
-@group(0) @binding(0) var<storage, read_write> bins: array<atomic<u32>>;
+const chunkWidth = 256;
+const chunkHeight = 1;
+const chunkSize = chunkWidth * chunkHeight;
+var<workgroup> bins: array<atomic<u32>, chunkSize>;
```

Arriba declaramos algunas constantes para poder cambiarlas fácilmente.

Luego necesitamos almacenamiento para todos nuestros chunks:

```wgsl
+@group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}
```

Podemos usar las constantes para definir el tamaño de nuestro workgroup:

```wsgl
-@compute @workgroup_size(1, 1, 1)
+@compute @workgroup_size(chunkWidth, chunkHeight, 1)
```

La parte principal que incrementa los bins es muy similar a nuestro shader anterior.

```wgsl
fn cs(@builtin(global_invocation_id) global_invocation_id: vec3u) {
  let size = textureDimensions(ourTexture, 0);
  let position = global_invocation_id.xy;
+  if (all(position < size)) {
-    let numBins = f32(arrayLength(&bins));
+    let numBins = f32(chunkSize);
    let lastBinIndex = u32(numBins - 1);
    let color = textureLoad(ourTexture, position, 0);
    let v = srgbLuminance(color.rgb);
    let bin = min(u32(v * numBins), lastBinIndex);
    atomicAdd(&bins[bin], 1u);
  }
```

Debido a que el tamaño de nuestro chunk está codificado en el shader, no queremos trabajar en píxeles fuera de nuestra textura. Por ejemplo, si nuestra imagen tuviera 300 píxeles de ancho, el primer workgroup trabajaría en los píxeles 0 a 255. El segundo workgroup trabajaría en los píxeles 256 a 511. Pero solo necesitamos trabajar hasta el píxel 299. Esto es lo que hace `if(all(position < size))`. Tanto `position` como `size` son `vec2u`, por lo que `position < size` producirá 2 valores booleanos, es decir, un `vec2<bool>`. La función `all` devuelve `true` si todas sus entradas son verdaderas. Por tanto, el código solo entrará en el `if` si `position.x < size.x` y `position.y < size.y`.

En cuanto a `numBins`, tenemos tantos bins como definimos para el tamaño del chunk. Ya no podemos buscar el tamaño porque no pasamos un buffer para `var<workgroup>` como hicimos para `var<storage>`. Su tamaño se define cuando creamos el módulo del shader.

Finalmente, la parte más diferente del shader:

```wgsl
  workgroupBarrier();

  let chunksAcross = (size.x + chunkWidth - 1) / chunkWidth;
  let chunkDim = vec2u(chunkWidth, chunkHeight);
  let chunkPos = global_invocation_id.xy / chunkDim;
  let chunk = chunkPos.y * chunksAcross + chunkPos.x;
  let binPos = global_invocation_id.xy % chunkDim;
  let bin = binPos.y * chunkWidth + binPos.x;

  chunks[chunk][bin] = atomicLoad(&bins[bin]);
}
```

Esta parte simplemente hace que cada invocación copie un bin al bin correspondiente de un chunk específico, el chunk en el que está trabajando este workgroup. Algunos de los cálculos sirven para convertir `global_invocation_id` tanto en una `chunkPos` como en una `binPos`. Esos valores son efectivamente el `workgroup_id` y el `local_invocation_id`, por lo que podríamos simplificar este código a:

```wgsl
  workgroupBarrier();

  let chunksAcross = (size.x + chunkWidth - 1) / chunkWidth;
  let chunk = workgroup_id.y * chunksAcross + workgroup_id.x;
  let bin = local_invocation_id.y * chunkWidth + local_invocation_id.x;

  chunks[chunk][bin] = atomicLoad(&bins[bin]);
}
```

Luego tendríamos que añadir `workgroup_id` y `local_invocation_id` como entradas a la función del shader:

```wgsl
-fn cs(@builtin(global_invocation_id) global_invocation_id: vec3u) {
+fn cs(
+  @builtin(global_invocation_id) global_invocation_id: vec3u,
+  @builtin(workgroup_id) workgroup_id: vec3u,
+  @builtin(local_invocation_id) local_invocation_id: vec3u,
+) {

   ...
```

## workgroupBarrier

El `workgroupBarrier()` dice eficazmente "detente aquí hasta que todas las invocaciones de este workgroup lleguen a este punto". Necesitamos esto porque cada invocación está actualizando diferentes elementos en `bins`, pero después, cada invocación copiará solo un elemento de `bins` al elemento correspondiente en uno de los `chunks`, por lo que debemos asegurarnos de que todas las demás invocaciones hayan terminado.

Dicho de otra forma, cualquier invocación puede hacer un `atomicAdd` en cualquier elemento de `bins` dependiendo del color que lea de la textura. Pero solo la invocación `local_invocation_id` = 3,0 copiará `bin[3]` a `chunks[chunk][3]`, por lo que tiene que esperar a que todas las demás invocaciones hayan tenido la oportunidad de actualizar `bin[3]`.

Poniéndolo todo junto, aquí está nuestro nuevo shader:

```wgsl
const chunkWidth = 256;
const chunkHeight = 1;
const chunkSize = chunkWidth * chunkHeight;
var<workgroup> bins: array<atomic<u32>, chunkSize>;
@group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
fn srgbLuminance(color: vec3f) -> f32 {
  return saturate(dot(color, kSRGBLuminanceFactors));
}

@compute @workgroup_size(chunkWidth, chunkHeight, 1)
fn cs(
  @builtin(global_invocation_id) global_invocation_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u,
  @builtin(local_invocation_id) local_invocation_id: vec3u,
) {
  let size = textureDimensions(ourTexture, 0);
  let position = global_invocation_id.xy;
  if (all(position < size)) {
    let numBins = f32(chunkSize);
    let lastBinIndex = u32(numBins - 1);
    let color = textureLoad(ourTexture, position, 0);
    let v = srgbLuminance(color.rgb);
    let bin = min(u32(v * numBins), lastBinIndex);
    atomicAdd(&bins[bin], 1u);
  }

  workgroupBarrier();

  let chunksAcross = (size.x + chunkWidth - 1) / chunkWidth;
  let chunk = workgroup_id.y * chunksAcross + workgroup_id.x;
  let bin = local_invocation_id.y * chunkWidth + local_invocation_id.x;

  chunks[chunk][bin] = atomicLoad(&bins[bin]);
}
```

Una cosa más que podríamos hacer: en lugar de codificar `chunkWidth` y `chunkHeight`, podríamos pasarlos desde JavaScript así:

```js
+  const k = {
+    chunkWidth: 256,
+    chunkHeight: 1,
+  };
+  const sharedConstants = Object.entries(k)
+    .map(([k, v]) => `const ${k} = ${v};`)
+    .join('\n');

   const histogramChunkModule = device.createShaderModule({
     label: 'histogram chunk shader',
     code: /* wgsl */ `
-      const chunkWidth = 256;
-      const chunkHeight = 1;
+      ${sharedConstants}
       const chunkSize = chunkWidth * chunkHeight;
       var<workgroup> bins: array<atomic<u32>, chunkSize>;
       @group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;
       @group(0) @binding(1) var ourTexture: texture_2d<f32>;

       ...
     `,
   });
```

Si ejecutáramos este shader, funcionaría de forma parecida a esto:

<div class="webgpu_center compute-diagram"><div data-diagram="chunks"></div></div>

Arriba puedes ver que cada workgroup lee los píxeles de un chunk y actualiza los bins en consecuencia. Al igual que antes, si 2 invocaciones necesitan actualizar el mismo bin, una de ellas tendrá que esperar 🛑. Después, todas se esperan unas a otras en el `workgroupBarrier` 🚧. Tras eso, cada invocación copia el bin del que es responsable al bin correspondiente del chunk en el que está trabajando.

## Sumando los chunks

Todos los valores de luminancia de los píxeles han sido contados, pero necesitamos sumar los bins para obtener la respuesta. Vamos a escribir un compute shader para hacerlo. Podemos hacer una invocación por bin. Cada invocación simplemente sumará todos los valores del mismo bin en cada chunk y luego escribirá el resultado en el primer chunk.

Aquí está el código:

```wgsl
const chunkWidth = 256;
const chunkHeight = 1;
const chunkSize = chunkWidth * chunkHeight;
@group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;

@compute @workgroup_size(chunkSize, 1, 1)
fn cs(@builtin(local_invocation_id) local_invocation_id: vec3u) {
  var sum = u32(0);
  let numChunks = arrayLength(&chunks);
  for (var i = 0u; i < numChunks; i++) {
    sum += chunks[i][local_invocation_id.x];
  }
  chunks[0][local_invocation_id.x] = sum;
}
```

Y, al igual que antes, podemos inyectar `chunkWidth` y `chunkHeight`.

```js
const chunkSumModule = device.createShaderModule({
  label: 'chunk sum shader',
  code: /* wgsl */ `
*    ${sharedConstants}
     const chunkSize = chunkWidth * chunkHeight;
     @group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;

     @compute @workgroup_size(chunkSize, 1, 1)

     ...
     }
   `,
});
```

Este shader funcionará eficazmente de esta manera:

<div class="webgpu_center compute-diagram"><div data-diagram="sum"></div></div>

Ahora que tenemos estos 2 shaders, vamos a actualizar el código para usarlos. Necesitamos crear pipelines para ambos shaders.

```js
-  const pipeline = device.createComputePipeline({
-    label: 'histogram',
-    layout: 'auto',
-    compute: {
-      module,
-    },
-  });

+  const histogramChunkPipeline = device.createComputePipeline({
+    label: 'histogram',
+    layout: 'auto',
+    compute: {
+      module: histogramChunkModule,
+    },
+  });
+
+  const chunkSumPipeline = device.createComputePipeline({
+    label: 'chunk sum',
+    layout: 'auto',
+    compute: {
+      module: chunkSumModule,
+    },
+  });
```

Necesitamos crear un buffer de storage lo suficientemente grande para todos nuestros chunks, así que calculamos cuántos chunks necesitamos para cubrir la imagen completa.

```js
   const imgBitmap = await loadImageBitmap('resources/images/pexels-francesco-ungaro-96938-mid.jpg');
   const texture = createTextureFromSource(device, imgBitmap);

-  const numBins = 256;
-  const histogramBuffer = device.createBuffer({
-    size: numBins * 4, // 256 entradas * 4 bytes por (u32)
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
-  });
+  const chunkSize = k.chunkWidth * k.chunkHeight;
+  const chunksAcross = Math.ceil(texture.width / k.chunkWidth);
+  const chunksDown = Math.ceil(texture.height / k.chunkHeight);
+  const numChunks = chunksAcross * chunksDown;
+  const chunksBuffer = device.createBuffer({
+    size: numChunks * chunkSize * 4, // 4 bytes por (u32)
+    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
+  });
```

Todavía necesitamos nuestro buffer de resultados para leer el resultado, pero ya no tiene el mismo tamaño que el buffer anterior.

```js
   const resultBuffer = device.createBuffer({
-    size: histogramBuffer.size,
+    size: chunkSize * 4,  // 4 bytes por (u32)
     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
   });
```

Necesitamos un bindGroup para cada pase. Uno para pasar la textura y los chunks al primer shader y otro para pasar los chunks al segundo shader.

```js
-  const bindGroup = device.createBindGroup({
+  const histogramBindGroup = device.createBindGroup({
     label: 'histogram bindGroup',
     layout: histogramChunkPipeline.getBindGroupLayout(0),
     entries: [
-      { binding: 0, resource: histogramBuffer },
+      { binding: 0, resource: chunksBuffer },
       { binding: 1, resource: texture },
     ],
   });

   const chunkSumBindGroup = device.createBindGroup({
     label: 'sum bindGroup',
     layout: chunkSumPipeline.getBindGroupLayout(0),
     entries: [
       { binding: 0, resource: chunksBuffer },
     ],
   });
```

Finalmente podemos ejecutar nuestros shaders. Primero, la parte que lee los píxeles y los clasifica en bins; despachamos un workgroup para cada chunk.

```js
   const encoder = device.createCommandEncoder({ label: 'histogram encoder' });
   const pass = encoder.beginComputePass();

+  // crear un histograma para cada área
-  pass.setPipeline(pipeline);
-  pass.setBindGroup(0, bindGroup);
-  pass.dispatchWorkgroups(texture.width, texture.height);
+  pass.setPipeline(histogramChunkPipeline);
+  pass.setBindGroup(0, histogramBindGroup);
+  pass.dispatchWorkgroups(chunksAcross, chunksDown);
```

Luego necesitamos ejecutar el shader que suma los chunks. Es solo 1 workgroup que usa 1 invocación por bin (256 invocaciones).

```js
+  // sumar las áreas
+  pass.setPipeline(chunkSumPipeline);
+  pass.setBindGroup(0, chunkSumBindGroup);
+  pass.dispatchWorkgroups(1);
```

El resto del código es el mismo.

{{{example url="../webgpu-compute-shaders-histogram-optimized.html"}}}

Al probar esto en mi máquina, ¡me alegró ver que el primer shader se ejecuta en 0.2 ms! Leyó toda la imagen y rellenó todos los chunks en un santiamén.

Desafortunadamente, la parte que suma los chunks tardó mucho más: 11 ms. ¡Eso es más lento que nuestro shader anterior!

En una máquina diferente, la solución anterior fue de 4.4 ms y esta nueva de 1.7 ms, por lo que no fue una pérdida total.

¿Podemos hacerlo mejor?

## Reducción (Reduce)

La solución anterior usaba un solo workgroup. Aunque tiene 256 invocaciones, una GPU moderna tiene miles de núcleos y solo estamos usando 256 de ellos.

Una técnica que podríamos probar es lo que a veces se llama reducción (reducing). Haremos que cada workgroup solo sume 2 chunks, escribiendo el resultado en el primero de esos 2 chunks. De esta manera, si tenemos 1000 chunks, podemos usar 500 workgroups. Eso es mucha más paralización. Repetiremos el proceso: 500 chunks reducidos a 250, 250 -> 125, 125 -> 63, etc... hasta que hayamos reducido a 1 solo chunk.

<div class="webgpu_center compute-diagram"><div data-diagram="reduceDiagram"></div></div>

Podemos usar un solo shader y simplemente tenemos que pasar un stride (paso) para reducir los chunks hasta llegar a uno solo. El stride es el número de chunks que necesitamos avanzar para llegar al segundo chunk que estamos sumando. Si pasamos un stride de 1, sumaremos chunks adyacentes. Si pasamos un stride de 2, sumaremos cada dos chunks, etc.

Aquí están los cambios en nuestro shader:

```js
const chunkSumModule = device.createShaderModule({
  label: 'chunk sum shader',
  code: /* wgsl */ `
    ${sharedConstants}
    const chunkSize = chunkWidth * chunkHeight;

+    struct Uniforms {
+      stride: u32,
+    };

    @group(0) @binding(0) var<storage, read_write> chunks: array<array<vec4u, chunkSize>>;
+    @group(0) @binding(1) var<uniform> uni: Uniforms;

    @compute @workgroup_size(chunkSize, 1, 1) fn cs(
      @builtin(local_invocation_id) local_invocation_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u,
    ) {
-      var sum = u32(0);
-      let numChunks = arrayLength(&chunks);
-      for (var i = 0u; i < numChunks; i++) {
-        sum += chunks[i][local_invocation_id.x];
-      }
-      chunks[0][local_invocation_id.x] = sum;
+      let chunk0 = workgroup_id.x * uni.stride * 2;
+      let chunk1 = chunk0 + uni.stride;
+
+      let sum = chunks[chunk0][local_invocation_id.x] +
+                chunks[chunk1][local_invocation_id.x];
+      chunks[chunk0][local_invocation_id.x] = sum;
    }
  `,
});
```

Como puedes ver arriba, calculamos un `chunk0` y un `chunk1` basados en el `workgroup_id.x` y el `uni.stride` que pasamos como uniform. Luego simplemente sumamos los 2 bins de los 2 chunks y los guardamos de nuevo en el primero.

Si lo ejecutamos con el número correcto de invocaciones y ajustes de stride, funcionará de forma parecida a esto. Nota: los chunks oscurecidos son los que ya no se usan.

<div class="webgpu_center compute-diagram"><div data-diagram="reduce"></div></div>

Para que este nuevo funcione necesitamos añadir un buffer de uniform para cada valor de stride, así como un bindGroup.

```js
const sumBindGroups = [];
const numSteps = Math.ceil(Math.log2(numChunks));
for (let i = 0; i < numSteps; ++i) {
  const stride = 2 ** i;
  const uniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  new Uint32Array(uniformBuffer.getMappedRange()).set([stride]);
  uniformBuffer.unmap();

  const chunkSumBindGroup = device.createBindGroup({
    layout: chunkSumPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: chunksBuffer },
      { binding: 1, resource: uniformBuffer },
    ],
  });
  sumBindGroups.push(chunkSumBindGroup);
}
```

Luego solo necesitamos llamarlos con el número correcto de despachos (dispatches) hasta que hayamos reducido todo a 1 solo chunk.

```js
-  // sumar las áreas
-  pass.setPipeline(chunkSumPipeline);
-  pass.setBindGroup(0, chunkSumBindGroup);
-  pass.dispatchWorkgroups(1);
+  // reducir los chunks
+  const pass = encoder.beginComputePass();
+  pass.setPipeline(chunkSumPipeline);
+  let chunksLeft = numChunks;
+  sumBindGroups.forEach(bindGroup => {
+    pass.setBindGroup(0, bindGroup);
+    const dispatchCount = Math.floor(chunksLeft / 2);
+    chunksLeft -= dispatchCount;
+    pass.dispatchWorkgroups(dispatchCount);
+  });
```

{{{example url="../webgpu-compute-shaders-histogram-optimized-more.html"}}}

¡Al medir esta versión obtuve menos de 1 ms en ambas máquinas que probé! 🎉🚀

Aquí hay algunos tiempos de varias máquinas:

<div class="webgpu_center data-table">
  <div data-diagram="timings"></div>
</div>

Puede haber una forma más rápida de calcular un histograma. También podría ser mejor probar diferentes tamaños de chunk. Quizás 16x16 sea mejor que 256x1. Además, en algún momento WebGPU probablemente soporte *subgroups*, que es otro tema completo y un área para aún más optimización.

Por ahora, espero que estos ejemplos te hayan dado algunas ideas sobre cómo escribir y optimizar un compute shader. Las conclusiones son:

* Busca una manera de utilizar toda la paralización que ofrece la GPU.
* Sé consciente de las condiciones de carrera.
* Usa `var<workgroup>` para crear almacenamiento compartido entre todas las invocaciones de un workgroup.
* Intenta diseñar algoritmos que requieran menos coordinación entre invocaciones.
* Cuando se requiere coordinación, las operaciones atómicas pueden ser una solución, así como `workgroupBarrier`.

  Lo hicimos razonablemente bien en este frente. Al calcular nuestros chunks en la memoria del workgroup todavía tenemos conflictos que resolvimos mediante `atomicAdd`, pero no tenemos conflictos al copiar desde los `bins` en el workgroup a los `chunks`, y no tenemos conflictos cuando reducimos los `chunks` a un solo resultado final.

Quizás una más:

* No asumas que la GPU es rápida.

  Aprendimos que los núcleos individuales de una GPU no son tan rápidos. Toda la velocidad proviene de la paralización, por lo que necesitamos diseñar soluciones paralelas.

En [el próximo artículo](webgpu-compute-shaders-histogram-part-2.html) retocaremos un poco estos ejemplos y también los cambiaremos para graficar los resultados usando la GPU en lugar de devolverlos a JavaScript. También probaremos algunos ajustes de vídeo en tiempo real basados en haber creado un histograma de imagen.

<!-- keep this at the bottom of the article -->
<link rel="stylesheet" href="webgpu-compute-shaders-histogram.css">
<script type="module" src="webgpu-compute-shaders-histogram.js"></script>
