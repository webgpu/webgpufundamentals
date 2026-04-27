Title: Texturas de almacenamiento (Storage Textures) en WebGPU
Description: Cómo usar texturas de almacenamiento (storage textures)
TOC: Texturas de almacenamiento (Storage Textures)

Las texturas de almacenamiento (storage textures) son simplemente [texturas](webgpu-textures.html) en las que puedes escribir o "almacenar" directamente.
Normalmente especificamos triángulos en un vertex shader (shader de vértices) y la GPU actualiza la textura
por nosotros de forma indirecta, pero con una textura de almacenamiento podemos escribir directamente en la
textura donde queramos.

Las texturas de almacenamiento no son un tipo especial de textura; más bien, son simplemente una
textura como cualquier otra que creas con `createTexture`. Añades el
flag de uso `STORAGE_BINDING` y ahora puedes usar la textura como una textura de almacenamiento
además de cualquier otro flag de uso que necesites, y entonces también puedes usar
la textura como una textura de almacenamiento.

En cierto sentido, una textura de almacenamiento es como un storage buffer (buffer de almacenamiento) que usamos como un array 2D. Por ejemplo, podríamos
crear un storage buffer y referenciarlo en el código de esta manera:

```wgsl
@group(0) @binding(0)
  var<storage> buf: array<f32>;

...
fn loadValueFromBuffer(pos: vec2u) -> f32 {
  return buffer[pos.y * width + pos.x];
}

fn storeValueToBuffer(pos: vec2u, v: f32) {
  buffer[pos.y * width + pos.x] = v;
}

...
  let pos = vec2u(2, 3);
  var v = loadValueFromBuffer(pos);
  storeValueToBuffer(pos, v * 2.0);

```

frente a una textura de almacenamiento:

```
@group(0) @binding(0)
  var tex: texture_storage_2d<r32float, read_write>;

...

   let pos = vec2u(2, 3);
   let mipLevel = 0;
   var v = textureLoad(tex, pos, mipLevel);
   textureStore(tex, pos, mipLevel, v * 2);

```

Dado que parecen equivalentes, ¿cuáles son las diferencias entre usar manualmente
un storage buffer y una textura de almacenamiento?

* Una textura de almacenamiento sigue siendo una textura.

  Puedes usarla con un shader como una textura de almacenamiento y como una textura normal
  (con samplers, mipmaps (niveles de mip), etc.) en otro shader.

* Una textura de almacenamiento tiene interpretación de formato, un storage buffer no.

  Ejemplo:

  ```wsgl
  @group(0) @binding(0) var tex: texture_storage_2d<rgba8unorm, read>;
  @group(0) @binding(1) var buf: array<f32>;

     ...
      let t = textureLoad(tex, pos, 0);
      let b = buffer[pos.y * bufferWidth + pos.x];
  ```

  Arriba, cuando llamamos a `textureLoad`, la textura es una textura `rgba8unorm`,
  lo que significa que se cargan 4 bytes y se convierten automáticamente en 4 valores de
  punto flotante entre 0 y 1, y se devuelven como un `vec4f`.

  En el caso del buffer, se cargan 4 bytes como un único valor `f32`. Podríamos
  cambiar el buffer a `array<u32>` y luego cargar un valor, y dividirlo manualmente en
  4 valores de un byte, y convertirlos nosotros mismos a flotantes pero, si eso es lo que
  queríamos, lo obtenemos gratis con una textura de almacenamiento.

* Una textura de almacenamiento tiene dimensiones.

  Para un buffer, la única dimensión es su longitud, o mejor dicho, la longitud de
  su binding [^binding]. Arriba, cuando usamos un buffer como un array 2D,
  necesitábamos `width` (ancho) para convertir de una coordenada 2D a un índice de buffer 1D.
  Tendríamos que escribir el valor de `width` directamente en el código o pasarlo de
  alguna manera[^how-to-pass-data]. Con una textura podemos llamar a `textureDimensions`
  para obtener las dimensiones de la textura.

  [^binding]: Cuando creas un bind group y especificas un buffer, opcionalmente puedes
  especificar un offset y una longitud. En el shader, la longitud del
  array se calcula a partir de la longitud del binding, no de la longitud de
  todo el buffer. Si no especificas un offset, por defecto es 0 y la
  longitud por defecto es el tamaño de todo el buffer.

  [^how-to-pass-data]: Podrías pasar el ancho del buffer a través de un [uniform](webgpu-uniforms.html),
  otro [storage buffer](webgpu-storage-buffers.html) o incluso como
  el primer valor en el mismo buffer.

Dicho esto, hay límites en las texturas de almacenamiento.

* Solo ciertos formatos pueden ser `read_write` (lectura_escritura).

  Esos son `r32float`, `r32sint` y `r32uint`.

  Otros formatos soportados solo pueden ser `read` (lectura) o `write` (escritura) dentro de un único
  shader.

* Solo ciertos formatos pueden usarse como texturas de almacenamiento.

  Hay una gran cantidad de formatos de textura, pero solo algunos
  pueden usarse como texturas de almacenamiento.

  * `rgba8(unorm/snorm/sint/uint)`
  * `rgba16(float/sint/uint)`
  * `rg32(float/sint/uint)`
  * `rgba32(float/sint/uint)`

  Un formato que notarás que falta es `bgra8unorm`, que cubriremos a continuación.

* Las texturas de almacenamiento no pueden usar samplers.

  Si usamos una textura como un `TEXTURE_BINDING` normal, podemos llamar a
  funciones como `textureSample`, que cargan hasta 16 téxeles (texels) a través de niveles de mip y
  los mezclan. Cuando usamos una textura como un `STORAGE_BINDING`,
  solo podemos llamar a `textureLoad` y/o `textureStore`, que cargan
  y almacenan un solo téxel a la vez.

## <a id="canvas-as-storage-texture"></a> El Canvas como textura de almacenamiento

Puedes usar una textura de canvas como una textura de almacenamiento. Para hacerlo, configuras
el contexto para que te dé una textura que pueda usarse como una textura de almacenamiento.

```js
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.STORAGE_BINDING,
  });
```

`TEXTURE_BINDING` es necesario para que el propio navegador pueda renderizar la textura
en la página. `STORAGE_BINDING` nos permite usar las texturas del canvas como
texturas de almacenamiento. Si aún quisiéramos renderizar en la textura a través de un
render pass, como la mayoría de los ejemplos en este sitio, también añadiríamos el
uso `RENDER_ATTACHMENT`.

Sin embargo, hay una complicación. Como vimos en
[el primer artículo](webgpu-fundamentals.html), normalmente llamamos a
`navigator.gpu.getPreferredCanvasFormat` para obtener el formato preferido del canvas.
`getPreferredCanvasFormat` devolverá `rgba8unorm` o `bgra8unorm`
dependiendo de qué formato sea más eficiente para el sistema del usuario.

Pero, como mencionamos anteriormente, por defecto, no podemos usar una textura
`bgra8unorm` como textura de almacenamiento.

Afortunadamente, existe una [característica (feature)](webgpu-limits-and-features.html) llamada
`'bgra8unorm-storage'`. Habilitar esa característica permitirá usar una textura `bgra8unorm` como textura de almacenamiento.
En general, *debería* estar disponible en cualquier plataforma que informe
`bgra8unorm` como su formato de canvas preferido pero, existe la posibilidad de
que no esté disponible. Por lo tanto, necesitamos verificar si la característica
`'bgra8unorm-storage'` existe. Si existe, la requeriremos para nuestro dispositivo y usaremos
el formato preferido del canvas. Si no, elegiremos `rgba8unorm` como nuestro
formato de canvas.

```js
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const hasBGRA8unormStorage = adapter.features.has('bgra8unorm-storage');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: hasBGRA8unormStorage
+      ? ['bgra8unorm-storage']
+      : [],
+  });
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
-  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
+  const presentationFormat = hasBGRA8unormStorage
+     ? navigator.gpu.getPreferredCanvasFormat()
+     : 'rgba8unorm';
  context.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.STORAGE_BINDING,
  });
```

Ahora podemos usar la textura del canvas como una textura de almacenamiento. Hagamos un
compute shader (shader de cómputo) simple para dibujar círculos concéntricos en la textura.

```js
  const module = device.createShaderModule({
    label: 'circles in storage texture',
    code: /* wgsl */ `
      @group(0) @binding(0)
      var tex: texture_storage_2d<${presentationFormat}, write>;

      @compute @workgroup_size(1) fn cs(
        @builtin(global_invocation_id) id : vec3u
      )  {
        let size = textureDimensions(tex);
        let center = vec2f(size) / 2.0;

        // el píxel en el que vamos a escribir
        let pos = id.xy;

        // La distancia desde el centro de la textura
        let dist = distance(vec2f(pos), center);

        // Calcular franjas basadas en la distancia
        let stripe = dist / 32.0 % 2.0;
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);
        let color = select(red, cyan, stripe < 1.0);

        // Escribir el color en la textura
        textureStore(tex, pos, color);
      }
    `,
  });
```

Fíjate que marcamos la textura de almacenamiento como `write` (escritura) y que tuvimos que especificar
el formato de textura exacto en el propio shader. A diferencia de los `TEXTURE_BINDING`,
los `STORAGE_BINDING` necesitan conocer el formato exacto de la textura.

La configuración es similar a [el compute shader que escribimos en el primer artículo](webgpu-fundamentals.html#a-run-computations-on-the-gpu).
Después de crear un módulo de shader, configuramos un pipeline de computación para usarlo.

```js
  const pipeline = device.createComputePipeline({
    label: 'circles in storage texture',
    layout: 'auto',
    compute: {
      module,
    },
  });
```

Para renderizar, obtenemos la textura actual del canvas, creamos un bind group para
poder pasar la textura al shader, y luego hacemos lo normal: establecer un
pipeline, asignar los bind groups y despachar los workgroups.

```js
  function render() {
    const texture = context.getCurrentTexture();

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture },
      ],
    });

    const encoder = device.createCommandEncoder({ label: 'our encoder' });
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(texture.width, texture.height);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

Y aquí está:

{{{example url="../webgpu-storage-texture-canvas.html"}}}

Usar una textura normal no cambiaría nada, excepto que llamaríamos a
`createTexture` en lugar de `getCurrentTexture` para crear nuestra textura
y pasaríamos `STORAGE_BINDING` junto con cualquier otro flag de uso
que necesitemos.

## Velocidad y condiciones de carrera (data races)

Arriba, despachamos 1 workgroup por píxel. Esto es ineficiente y la
GPU puede funcionar mucho más rápido. Optimizar el shader para la cantidad
óptima de trabajo habría complicado el ejemplo. El objetivo era demostrar
el uso de una textura de almacenamiento, no el shader más rápido posible.
Puedes leer sobre algunos métodos para optimizar
shaders de computación en [el artículo sobre el cálculo de un histograma de imagen](webgpu-compute-shaders-histogram.html).

Del mismo modo, dado que puedes escribir en cualquier lugar de la textura de almacenamiento,
debes tener cuidado con las condiciones de carrera (race conditions) como las que vimos en
[los otros artículos sobre compute shaders](webgpu-compute-shaders.html).
El orden en que se ejecutan las invocaciones no está garantizado.
Depende de ti evitar las carreras y/o insertar `textureBarriers` u otras cosas
para asegurarte de que 2 o más invocaciones no interfieran entre sí.

## Ejemplos

[compute.toys](https://compute.toys) es un sitio web con muchos ejemplos
de escritura directa en una textura de almacenamiento. **ADVERTENCIA**: Aunque hay
muchas cosas que aprender de los ejemplos en [compute.toys](https://compute.toys),
no son necesariamente buenas prácticas. Compute toys trata de hacer
cosas interesantes solo con compute shaders. Es un rompecabezas divertido descubrir
cómo hacer algo creativo solo con shaders de computación, pero ten en cuenta que
otros métodos *podrían* ser 10, 100 o 1000 veces más rápidos.
