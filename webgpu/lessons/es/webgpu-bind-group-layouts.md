Title: Bind Group Layouts en WebGPU
Description: Layouts de grupos de bindings explícitos
TOC: Bind Group Layouts

Los Bind Group Layouts se utilizan para que a WebGPU le resulte fácil y eficiente
emparejar Bind Groups con Compute y Render Pipelines.

## Cómo funciona: 

Un Pipeline, como un `GPUComputePipeline` o `GPURenderPipeline`,
utiliza un `GPUPipelineLayout` que define 0 o más
`GPUBindGroupLayout`s. Cada `GPUBindGroupLayout` se asigna
a un índice de grupo específico.

<div class="webgpu_center"><img src="resources/webgpu-bind-group-layouts.svg" style="width: 900px;"></div>

Los Bind Groups también se crean con un `GPUBindGroupLayout`
específico.

Cuando vas a `draw` (dibujar) o a `dispatchWorkgroups`, WebGPU solo
necesita comprobar: ¿coincide el `GPUBindGroupLayout` para cada índice de grupo
en el `GPUPipelineLayout` del pipeline actual con los
bind groups actualmente vinculados, los establecidos con `setBindGroup`?
Esta comprobación es trivialmente sencilla. La mayor parte de la comprobación detallada
ocurre cuando creas el bind group. De esa manera, cuando estás
realmente dibujando o computando, casi no queda nada por
comprobar.

Los Pipelines generarán su propio `GPUPipelineLayout` y lo
poblarán con `GPUBindGroupLayouts` automáticamente si
creas el pipeline con `layout: 'auto'`, que es lo que
hacen la mayoría de los ejemplos de este sitio web.

Hay 2 razones principales para **NO** usar `layout: 'auto'`.

1. **Quieres un layout que sea diferente al layout `'auto'` por defecto**

   Por ejemplo, quieres usar un `rgba32float` como textura
   pero obtienes un error cuando lo intentas (ver más abajo).

2. **Quieres usar un bind group con más de 1 pipeline**

   No puedes usar un bind group hecho a partir de un bindGroupLayout
   que se creó desde un pipeline con `layout: 'auto'` con un
   pipeline diferente.

## <a id="a-rgba32float"></a> Usar un bind group layout diferente a `layout: 'auto'` - `'rgba32float'`

Las reglas sobre cómo se crea automáticamente un bind group layout están
[detalladas en la especificación](https://www.w3.org/TR/webgpu/#abstract-opdef-default-pipeline-layout), pero, como ejemplo...

Digamos que queremos usar una textura `rgba32float`. Tomemos
[nuestro primer ejemplo de uso de una textura del artículo sobre texturas](webgpu-textures.html) que dibujaba una 'F' de 5x7 téxeles al revés. Actualicémoslo para usar una textura `rgba32float`.

Aquí están los cambios:

```js
  const kTextureWidth = 5;
  const kTextureHeight = 7;
-  const _ = [255,   0,   0, 255];  // rojo
-  const y = [255, 255,   0, 255];  // amarillo
-  const b = [  0,   0, 255, 255];  // azul
-  const textureData = new Uint8Array([
+  const _ = [1, 0, 0, 1];  // rojo
+  const y = [1, 1, 0, 1];  // amarillo
+  const b = [0, 0, 1, 1];  // azul
+  const textureData = new Float32Array([
     b, _, _, _, _,
     _, y, y, y, _,
     _, y, _, _, _,
     _, y, y, _, _,
     _, y, _, _, _,
     _, y, _, _, _,
     _, _, _, _, _,
   ].flat());

   const texture = device.createTexture({
     label: 'F amarilla sobre rojo',
     size: [kTextureWidth, kTextureHeight],
-    format: 'rgba8unorm',
+    format: 'rgba32float',
     usage:
       GPUTextureUsage.TEXTURE_BINDING |
       GPUTextureUsage.COPY_DST,
   });
   device.queue.writeTexture(
       { texture },
       textureData,
-      { bytesPerRow: kTextureWidth * 4 },
+      { bytesPerRow: kTextureWidth * 4 * 4 },
       { width: kTextureWidth, height: kTextureHeight },
   );

```

Cuando lo ejecutemos obtendremos un error.

{{{example url="../webgpu-bind-group-layouts-rgba32float-broken.html"}}}

El error que obtuve en el navegador que probé fue:

> - WebGPU GPUValidationError: None of the supported sample types (UnfilterableFloat) of [Texture "yellow F on red"] match the expected sample types (Float).`<br>
> - While validating entries[1] as a Sampled Texture. Expected entry layout: {sampleType: TextureSampleType::Float, viewDimension: 2, multisampled: 0}`<br>
> - While validating [BindGroupDescriptor] against [BindGroupLayout (unlabeled)]`<br>
> - While calling [Device].CreateBindGroup([BindGroupDescriptor])`

¿A qué se debe esto? Resulta que las texturas `rgba32float` (y todas las `xxx32float`)
no son filtrables por defecto. Existe una [característica opcional](webgpu-limits-and-features.html) para hacerlas filtrables pero esa
característica podría no estar disponible en todas partes. Esto es especialmente probable en
dispositivos móviles, al menos en 2024.

Por defecto, cuando declaras un binding con un `texture_2d<f32>` como
este:

```wgsl
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;
```

Y usas `layout: 'auto'` al crear tu pipeline, WebGPU crea
un bind group layout que requiere específicamente texturas filtrables. Si
intentas vincular una no filtrable obtienes un error.

Si quieres usar una textura que no se puede filtrar, entonces necesitarás
crear manualmente un bind group layout.

Hay una herramienta, [aquí](resources/wgsl-offset-computer.html), que si
pegas tus shaders, generará el auto layout por ti. Al pegar
el shader del ejemplo anterior, me da:

```js
const bindGroupLayoutDescriptors = [
  {
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
          type: "filtering",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
      },
    ],
  },
];
```

Esto es un array de `GPUBindGroupLayoutDescriptor`s. Arriba puedes
ver que el bind group usa `sampleType: "float"`. Ese es el tipo para
`'rgba8unorm'` pero no es el tipo para `'rgba32float'`. Puedes consultar
los tipos de muestra (sample types) con los que trabaja un formato de textura particular en
[esta tabla de la especificación](https://www.w3.org/TR/webgpu/#texture-format-caps).

Para arreglar el ejemplo necesitamos ajustar tanto el binding de la textura como el
binding del sampler. El binding del sampler debe cambiarse a un
sampler `'non-filtering'`. El binding de la textura debe cambiarse a
un `'unfilterable-float'`.

Así que, primero, necesitamos crear un `GPUBindGroupLayout`:

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {
*          type: 'non-filtering',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
*          sampleType: 'unfilterable-float',
           viewDimension: '2d',
           multisampled: false,
        },
      },
    ],
  });
```

Los dos cambios están marcados arriba.

Luego necesitamos crear un `GPUPipelineLayout`, que es un array
de los `GPUBindGroupLayout`s usados por un pipeline.

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

`createPipelineLayout` toma un objeto con un array de `GPUBindGroupLayout`s. 
Están ordenados por índice de grupo, así que la primera entrada se convierte en `@group(0)`,
la segunda entrada se convierte en `@group(1)`, etc... Si necesitas
saltarte uno, tendrás que añadir un elemento vacío o undefined.

Finalmente, cuando creamos el pipeline, pasamos el pipeline layout:

```js
  const pipeline = device.createRenderPipeline({
    label: 'pipeline de quad texturizado hardcodeado',
-    layout: 'auto',
+    layout: pipelineLayout,
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

Con eso, nuestro ejemplo vuelve a funcionar pero ahora está usando una textura
`rgba32float`.

{{{example url="../webgpu-bind-group-layouts-rgba32float-fixed.html"}}}

Nota: el ejemplo funciona tanto porque hicimos el trabajo anterior para crear
un bind group layout que aceptara unfilterable-float como porque el ejemplo utiliza un `GPUSampler` usando solo filtrado `'nearest'`. Si estableciéramos cualquiera de los filtros, `magFilter`, `minFilter` o
`mipmapFilter` a `'linear'`, obtendríamos un error diciendo que intentamos
usar un sampler `'filtering'` en un binding de sampler `'non-filtering'`.

## Usar un bind group layout diferente a `layout: 'auto'` - offsets dinámicos

Por defecto, cuando creas un bind group y vinculas un uniform o un storage buffer, se vincula todo el buffer. También puedes pasar un offset y una longitud al crear tu bind group. En ambos casos, una vez establecidos, no se pueden
cambiar.

WebGPU tiene una opción para permitirte cambiar el offset cuando llamas a
`setBindGroup`. Para usar esta característica, tienes que crear manualmente bind group
layouts y establecer `hasDynamicOffsets: true` para cada binding que quieras que se pueda
establecer más tarde.

Para mantener esto simple, usemos el ejemplo de computación simple
del [artículo sobre lo básico](webgpu-fundamentals.html#a-run-computations-on-the-gpu). Lo modificaremos para añadir
2 conjuntos de valores del mismo buffer y elegiremos qué
conjunto usando offsets dinámicos.

Primero, cambiemos el shader a este:

```wgsl
@group(0) @binding(0) var<storage, read_write> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3u
) {
  let i = id.x;
  dst[i] = a[i] + b[i];
}
```

Puedes ver que simplemente suma `a` a `b` y escribe en `dst`.

A continuación, creemos el bind group layout:

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      },
    ],
  });
```

Todos ellos están marcados como `hasDynamicStorage: true`.

Ahora usémoslo para crear nuestro pipeline:

```js
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });

  const pipeline = device.createComputePipeline({
-    label: 'double compute pipeline',
-    layout: 'auto',
+    label: 'add elements compute pipeline',
+    layout: pipelineLayout,
    compute: {
      module,
    },
  });
```

Configuremos el buffer. El offset debe ser un múltiplo de 256 [^minStorageBufferOffsetAlignment], así que creemos un buffer
de 256 * 3 bytes de tamaño para tener al menos 3 offsets válidos: 0, 256 y 512.

[^minStorageBufferOffsetAlignment]: Es posible que tu dispositivo
soporte offsets más pequeños. Consulta `minStorageBufferOffsetAlignment`
o `minUniformBufferOffsetAlignment` en [límites y características](webgpu-limits-and-features.html).

```js
-  const input = new Float32Array([1, 3, 5]);
+  const input = new Float32Array(64 * 3);
+  input.set([1, 3, 5]);
+  input.set([11, 12, 13], 64);

  // crear un buffer en la GPU para mantener nuestra computación
  // entrada y salida
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // Copiar nuestros datos de entrada a ese buffer
  device.queue.writeBuffer(workBuffer, 0, input);
```

El código anterior crea un array de `64 * 3` floats de 32 bits. Eso son 768 bytes.

Dado que nuestro ejemplo original leía y escribía en el mismo buffer,
simplemente vincularemos el mismo buffer 3 veces.

```js
  // Configurar un bindGroup para decirle al shader qué
  // buffers usar para la computación
  const bindGroup = device.createBindGroup({
    label: 'bindGroup para el buffer de trabajo',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
-      { binding: 0, resource: workBuffer  },
+      { binding: 0, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 1, resource: { buffer: workBuffer, size: 256 } },
+      { binding: 2, resource: { buffer: workBuffer, size: 256 } },
    ],
  });
```

Nota: debemos especificar el tamaño (size); de lo contrario, se usará por defecto el tamaño
de todo el buffer. Si luego estableciéramos un offset > 0, obtendríamos un
error ya que estaríamos especificando una porción del buffer que está fuera de rango.

En `setBindGroup`, ahora pasamos un offset por cada buffer que tenga offsets dinámicos. Dado que marcamos las 3 entradas en el bind group layout como
`hasDynamicOffset: true`, necesitamos 3 offsets en el orden de su slot de binding.

```js
  ...
  pass.setPipeline(pipeline);
-  pass.setBindGroup(0, bindGroup);
+  pass.setBindGroup(0, bindGroup, [0, 256, 512]);
  pass.dispatchWorkgroups(3);
  pass.end();
```

Finalmente, necesitamos cambiar el código para mostrar el resultado:

```js
-  console.log(input);
-  console.log(result);
+  console.log('a', input.slice(0, 3));
+  console.log('b', input.slice(64, 64 + 3));
+  console.log('dst', result.slice(128, 128 + 3));
```

{{{example url="../webgpu-bind-group-layouts-dynamic-offsets.html"}}}

Ten en cuenta que usar offsets dinámicos es ligeramente más lento que los offsets no dinámicos. La razón es que, con los offsets no dinámicos, si el offset y el tamaño están dentro del rango del buffer se comprueba cuando creas el bind group. Con los offsets dinámicos, esa comprobación no se puede hacer hasta que llamas a `setBindGroup`. Si solo llamas a `setBindGroup` unos cientos de veces,
esa diferencia probablemente no importará. Si llamas a `setBindGroup`
miles de veces, podría ser más notoria.

## <a id="a-sharing-bind-groups"></a> Usar un bind group con más de 1 pipeline

Otra razón para crear bind group layouts manualmente es para poder
usar el mismo bind group con más de un pipeline.

Un lugar común donde podrías querer reutilizar un bind group es en un renderizador de escenas 3D básico con sombras.

En un renderizador de escenas 3D básico es común separar los bindings
en:

* globales (como las matrices de perspectiva y vista)
* materiales (las texturas, colores)
* locales (como la matriz de modelo)

Luego renderizas así:

```
setBindGroup(0, globalsBG)
por cada material
  setBindGroup(1, materialBG)
  por cada objeto que usa el material
    setBindGroup(2, localBG)
    draw(...)
```

Cuando añades [sombras](webgpu-shadows.html), primero necesitas
dibujar los mapas de sombras (shadow maps) con un pipeline de mapa de sombras. En lugar de
tener bind groups separados para todas esas cosas —unos para trabajar
con el pipeline que dibuja y otros bind groups diferentes para trabajar
con el pipeline que renderiza el mapa de sombras—, sería mucho
más fácil simplemente crear un conjunto de bind groups y usar los mismos
en ambos casos.

Ese es un ejemplo bastante grande de escribir solo para mostrar cómo compartir
bind groups. Aunque el [artículo sobre sombras](webgpu-shadows.html)
utiliza bind groups compartidos, volveremos a tomar el ejemplo de computación simple del [artículo sobre lo básico](webgpu-fundamentals.html#a-run-computations-on-the-gpu) y haremos que use 2 pipelines de computación con un solo bind group.

Primero, añadamos otro módulo de shader que multiplique por 3:

```js
-  const module = device.createShaderModule({
+  const moduleTimes2 = device.createShaderModule({
     label: 'módulo de computación para duplicar',
     code: /* wgsl */ `
       @group(0) @binding(0) var<storage, read_write> data: array<f32>;

       @compute @workgroup_size(1) fn computeSomething(
         @builtin(global_invocation_id) id: vec3u
       ) {
         let i = id.x;
         data[i] = data[i] * 2.0;
       }
     `,
   });

+  const modulePlus3 = device.createShaderModule({
+    label: 'módulo de computación para sumar 3',
+    code: /* wgsl */ `
+      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
+
+      @compute @workgroup_size(1) fn computeSomething(
+        @builtin(global_invocation_id) id: vec3u
+      ) {
+        let i = id.x;
+        data[i] = data[i] + 3.0;
+      }
+    `,
+  });
```

Luego, creemos un `GPUBindGroupLayout` y un `GPUPipelineLayout`
que podamos usar para que los 2 pipelines compartan el mismo `GPUBindGroup`.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'storage',
          minBindingSize: 0,
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bindGroupLayout ],
  });
```

Ahora usémoslos al crear los pipelines:

```js
-  const pipeline = device.createComputePipeline({
+  const pipelineTimes2 = device.createComputePipeline({
     label: 'pipeline de computación para duplicar',
-    layout: 'auto',
+    layout: pipelineLayout,
     compute: {
       module: moduleTimes2,
     },
   });

+  const pipelinePlus3 = device.createComputePipeline({
+    label: 'pipeline de computación para sumar 3',
+    layout: pipelineLayout,
+    compute: {
+      module: modulePlus3,
+    },
+  });
```

Cuando configuremos el bind group, usemos el `bindGroupLayout`
directamente:

```js
  // Configurar un bindGroup para decirle al shader qué
  // buffer usar para la computación
  const bindGroup = device.createBindGroup({
    label: 'bindGroup para el buffer de trabajo',
-    layout: pipeline.getBindGroupLayout(0),
+    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: workBuffer  },
    ],
  });
```

Finalmente, usemos ambos pipelines:

```js
  // Codificar comandos para hacer la computación
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
-  pass.setPipeline(pipeline);
+  pass.setPipeline(pipelineTimes2);
   pass.setBindGroup(0, bindGroup);
   pass.dispatchWorkgroups(input.length);
+  pass.setPipeline(pipelinePlus3);
+  pass.dispatchWorkgroups(input.length);
   pass.end();
```

El resultado es que multiplicamos por 2 y sumamos 3 con un solo bind group.

{{{example url="../webgpu-bind-group-layouts-multiple-pipelines.html"}}}

No es muy emocionante, pero al menos es un ejemplo sencillo y funcional.

Cuándo crear manualmente bind group layouts y cuándo no es algo que realmente depende
de ti. En el ejemplo anterior, se podría argumentar que habría sido más fácil simplemente crear 2 bind groups, uno para cada pipeline.

Para situaciones sencillas, a menudo no es necesario crear manualmente bind group layouts pero, a medida que tus
programas de WebGPU se vuelvan más complejos, es probable que la creación de bind group layouts
sea una técnica que necesites utilizar.

## <a id="a-bind-group-layout-notes"></a> Notas sobre el Bind Group Layout:

Algunas cosas a tener en cuenta al crear un `GPUBindGroupLayout`:

* ## Cada entrada debe declarar para qué `binding` es.

* ## Cada entrada debe declarar en qué etapas (stages) será visible.

  En nuestros ejemplos anteriores, declaramos solo una visibilidad.
  Si, por ejemplo, quisiéramos referenciar el bind group tanto en el
  vertex shader como en el fragment shader usaríamos:

  ```js
     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX
  ```

  o las 3 etapas:

  ```js
     visibility: GPUShaderStage.COMPUTE |
                 GPUShaderStage.FRAGMENT | 
                 GPUShaderStage.VERTEX
  ```

* ## Hay varios valores por defecto:

  Para bindings de `texture:` los valores por defecto son:

  ```js
  {
    sampleType: 'float',
    viewDimension: '2d',
    multisampled: false,
  }
  ```

  Para bindings de `sampler:` los valores por defecto son:

  ```js
  {
    type: 'filtering',
  }
  ```

  Eso significa que, en los usos más comunes de sampler y textura, podrías declarar
  las entradas de sampler y textura así:

  ```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},  // usar los valores por defecto
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},  // usar los valores por defecto
      },
    ],
  });
  ```

* ## las entradas de buffer deberían declarar un `minBindingSize` cuando sea posible.

  Cuando declaras un binding de buffer puedes especificar un `minBindingSize`.

  Un buen ejemplo podría ser cuando creas un struct para uniforms. Por ejemplo,
  en [el artículo sobre uniforms](webgpu-uniforms.html) teníamos este struct:

  ```wgsl
  struct OurStruct {
    color: vec4f,
    scale: vec2f,
    offset: vec2f,
  };

  @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
  ``` 

  Requiere 32 bytes, así que deberíamos declarar su `minBindingSize` así:

  ```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
          minBindingSize: 32,
        },
      },
    ],
  });
  ```

  La razón para declarar un `minBindingSize` es que permite a WebGPU comprobar
  si el tamaño/offset de tu buffer es el tamaño correcto cuando llamas a
  `createBindGroup`. Si no estableces un `minBindingSize`, entonces
  WebGPU tendrá que comprobar en el momento de draw/dispatchWorkgroups que
  el buffer tiene el tamaño correcto para el pipeline. Comprobar en cada
  llamada de dibujo es más lento que comprobar una vez cuando creas un bind
  group.

  Por otro lado, en nuestro ejemplo anterior que usaba un storage
  buffer para duplicar números, etc., no declaramos un `minBindingSize`.
  Eso se debe a que, dado que el storage buffer se declara como un `array`,
  puedes vincular buffers de diferentes tamaños dependiendo de cuántos
  valores pases.


[Esta parte de la especificación](https://www.w3.org/TR/webgpu/#dictdef-gpubindgrouplayoutentry) detalla todas las opciones para crear
bind group layouts.

[Este artículo](https://toji.dev/webgpu-best-practices/bind-groups) también
tiene algunos consejos sobre bind groups y bind group layouts.

[Esta librería](https://greggman.github.io/webgpu-utils) calculará
los tamaños de los structs y los bind group layouts por defecto por ti.
