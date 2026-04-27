Title: Conceptos básicos de Compute Shader en WebGPU
Description: Cómo usar compute shaders en WebGPU
TOC: Conceptos básicos de Compute Shader

Este artículo continúa de [el artículo sobre los fundamentos](webgpu-fundamentals.html).
Comenzaremos con algunos conceptos básicos de los compute shaders (shaders de cómputo) y luego, con suerte, pasaremos a ejemplos de resolución de problemas del mundo real.

En el [artículo anterior](webgpu-fundamentals.html) creamos un compute shader extremadamente simple que duplicaba números en su lugar.

Aquí está el shader:

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  let i = id.x;
  data[i] = data[i] * 2.0;
}
```

Luego ejecutamos el compute shader efectivamente de esta manera:

```js
  ...
  pass.dispatchWorkgroups(count);
```

Necesitamos repasar la definición de workgroup.

Puedes pensar en un workgroup como una pequeña colección de hilos (threads). Cada hilo se ejecuta en paralelo. Defines el tamaño del workgroup estáticamente en WGSL. Los tamaños de workgroup se definen en 3 dimensiones, pero por defecto es 1, por lo que nuestro `@workgroup_size(1)` es equivalente a `@workgroup_size(1, 1, 1)`.

<a id="a-local-invocation-id"></a>Si definimos un workgroup como, por ejemplo, `@workgroup_size(3, 4, 2)`, entonces estamos definiendo 3 * 4 * 2 hilos o, dicho de otra forma, estamos definiendo un workgroup de 24 hilos.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup.svg" style="width: 500px;">
  <div><code>local_invocation_id</code> de los hilos en un workgroup</div>
</div>

<a id="a-workgroup-id"></a>Si luego llamamos a `pass.dispatchWorkgroups(4, 3, 2)`, estamos diciendo: ejecuta un workgroup de 24 hilos, 4 * 3 * 2 veces (24) para un total de 576 hilos.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup-dispatch.svg" style="width: 500px;">
  <div><code>workgroup_id</code> de los workgroups despachados</div>
</div>

Dentro de cada "invocación" de nuestro compute shader, están disponibles las siguientes variables integradas (builtins).

* `local_invocation_id`: El id de este hilo dentro de un workgroup.

  [Ver el diagrama de arriba](#a-local-invocation-id).

* `workgroup_id`: El id del workgroup.

  Cada hilo dentro de un workgroup tendrá el mismo id de workgroup.
  [Ver el diagrama de arriba](#a-workgroup-id).

* `global_invocation_id`: Un id único para cada hilo.

  Puedes pensar en esto como:

  ```
  global_invocation_id = workgroup_id * workgroup_size + local_invocation_id
  ```

* `num_workgroups`: Lo que pasaste a `pass.dispatchWorkgroups`.

* `local_invocation_index`: El id de este hilo linealizado.

  Puedes pensar en esto como:

  ```
  rowSize = workgroup_size.x
  sliceSize = rowSize * workgroup_size.y
  local_invocation_index =
        local_invocation_id.x +
        local_invocation_id.y * rowSize +
        local_invocation_id.z * sliceSize
  ```

Hagamos un ejemplo para usar estos valores. Simplemente escribiremos los valores de cada invocación en buffers y luego imprimiremos los valores.

Aquí está el shader:

```js
const dispatchCount = [4, 3, 2];
const workgroupSize = [2, 3, 4];

// multiplica todos los elementos de un array
const arrayProd = arr => arr.reduce((a, b) => a * b);

const numThreadsPerWorkgroup = arrayProd(workgroupSize);

const code = `
// ¡NOTA!: vec3u tiene un padding de 4 bytes
@group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
@group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
@group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

@compute @workgroup_size(${workgroupSize}) fn computeSomething(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
    @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  // workgroup_index es similar a local_invocation_index excepto que es para
  // workgroups, no hilos dentro de un workgroup.
  // No es un builtin, así que lo calculamos nosotros mismos.

  let workgroup_index =  
     workgroup_id.x +
     workgroup_id.y * num_workgroups.x +
     workgroup_id.z * num_workgroups.x * num_workgroups.y;

  // global_invocation_index es like local_invocation_index
  // excepto que es lineal a través de todas las invocaciones en todos los
  // workgroups despachados. No es un builtin, así que lo calculamos nosotros mismos.

  let global_invocation_index =
     workgroup_index * ${numThreadsPerWorkgroup} +
     local_invocation_index;

  // ahora podemos escribir cada uno de estos builtins en nuestros buffers.
  workgroupResult[global_invocation_index] = workgroup_id;
  localResult[global_invocation_index] = local_invocation_id;
  globalResult[global_invocation_index] = global_invocation_id;
`;
```

Usamos un template literal de JavaScript para poder establecer el tamaño del workgroup desde la variable de JavaScript `workgroupSize`. Esto termina quedando codificado (hardcoded) en el shader.

Ahora que tenemos el shader, podemos crear 3 buffers para almacenar estos resultados.

```js
  const numWorkgroups = arrayProd(dispatchCount);
  const numResults = numWorkgroups * numThreadsPerWorkgroup;
  const size = numResults * 4 * 4;  // vec3f * u32

  let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
  const workgroupBuffer = device.createBuffer({size, usage});
  const localBuffer = device.createBuffer({size, usage});
  const globalBuffer = device.createBuffer({size, usage});
```

Como señalamos antes, no podemos mapear buffers de storage directamente en JavaScript, por lo que necesitamos algunos buffers que sí podamos mapear. Copiaremos los resultados desde los buffers de storage a estos buffers de resultados mapeables y luego leeremos los resultados.

```js
  usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
  const workgroupReadBuffer = device.createBuffer({size, usage});
  const localReadBuffer = device.createBuffer({size, usage});
  const globalReadBuffer = device.createBuffer({size, usage});
```

Creamos un bindgroup para vincular todos nuestros buffers de storage:

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: workgroupBuffer },
      { binding: 1, resource: localBuffer },
      { binding: 2, resource: globalBuffer },
    ],
  });
```

Iniciamos un codificador (encoder) y un codificador de compute pass, igual que en nuestro ejemplo anterior, y luego añadimos los comandos para ejecutar el compute shader.

```js
  // Codificar comandos para realizar el cálculo
  const encoder = device.createCommandEncoder({ label: 'compute builtin encoder' });
  const pass = encoder.beginComputePass({ label: 'compute builtin pass' });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...dispatchCount);
  pass.end();
```

Necesitamos copiar los resultados de los buffers de storage a los buffers de resultados mapeables.

```js
  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
  encoder.copyBufferToBuffer(localBuffer, 0, localReadBuffer, 0, size);
  encoder.copyBufferToBuffer(globalBuffer, 0, globalReadBuffer, 0, size);
```

Y luego finalizamos el encoder y enviamos el buffer de comandos.

```js
  // Finalizar la codificación y enviar (submit) los comandos
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

Como antes, para leer los resultados mapeamos los buffers y, una vez que estén listos, obtenemos vistas de arrays con tipo (typed arrays) de su contenido.

```js
  // Leer los resultados
   await Promise.all([
    workgroupReadBuffer.mapAsync(GPUMapMode.READ),
    localReadBuffer.mapAsync(GPUMapMode.READ),
    globalReadBuffer.mapAsync(GPUMapMode.READ),
  ]);

  const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange());
  const local = new Uint32Array(localReadBuffer.getMappedRange());
  const global = new Uint32Array(globalReadBuffer.getMappedRange());
```

> Importante: Mapeamos 3 buffers aquí y usamos `await Promise.all` para esperar a que todos estén listos para su uso. **NO** puedes simplemente esperar al último buffer. Debes esperar a los 3 buffers.

Finalmente, podemos imprimirlos:

```js
  const get3 = (arr, i) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
  };

  for (let i = 0; i < numResults; ++i) {
    if (i % numThreadsPerWorkgroup === 0) {
      log(`\
 ---------------------------------------
 global                 local     global   dispatch: ${i / numThreadsPerWorkgroup}
 invoc.    workgroup    invoc.    invoc.
 index     id           id        id
 ---------------------------------------`);
    }
    log(` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`)
  }
}

function log(...args) {
  const elem = document.createElement('pre');
  elem.textContent = args.join(' ');
  document.body.appendChild(elem);
}
```

Aquí está el resultado:

{{{example url="../webgpu-compute-shaders-builtins.html"}}}

Estas variables integradas suelen ser las únicas entradas que cambian por hilo de un compute shader para una llamada a `pass.dispatchWorkgroups`, por lo que para ser efectivo necesitas descubrir cómo usarlas para diseñar una función de compute shader que haga lo que quieres, dadas estas variables integradas `..._id` como entrada.

## Tamaño del Workgroup

¿Qué tamaño deberías darle a un workgroup? A menudo surge la pregunta: ¿por qué no usar siempre `@workgroup_size(1, 1, 1)`? Así sería más trivial decidir cuántas iteraciones ejecutar solo con los parámetros de `pass.dispatchWorkgroups`.

La razón es que múltiples hilos dentro de un workgroup son más rápidos que despachos individuales.

Por un lado, los hilos en un workgroup a menudo se ejecutan al unísono (lockstep), por lo que ejecutar 16 de ellos es tan rápido como ejecutar 1.

Los límites por defecto para WebGPU son los siguientes:

* `maxComputeInvocationsPerWorkgroup`: 256
* `maxComputeWorkgroupSizeX`: 256
* `maxComputeWorkgroupSizeY`:	256
* `maxComputeWorkgroupSizeZ`:	64

Como puedes ver, el primer límite `maxComputeInvocationsPerWorkgroup` significa que los 3 parámetros de `@workgroup_size` no pueden multiplicarse para dar un número mayor que 256. En otras palabras:

```
    @workgroup_size(256, 1, 1)   // bien
    @workgroup_size(128, 2, 1)   // bien
    @workgroup_size(16, 16, 1)   // bien
    @workgroup_size(16, 16, 2)   // mal: 16 * 16 * 2 = 512
```

Desafortunadamente, el tamaño perfecto depende de la GPU y WebGPU no puede proporcionar esa información. **El consejo general para WebGPU es elegir un tamaño de workgroup de 64**, a menos que tengas alguna razón específica para elegir otro tamaño. Aparentemente, la mayoría de las GPUs pueden ejecutar eficientemente 64 cosas al unísono. Si eliges un número mayor y la GPU no puede hacerlo de forma rápida, elegirá un camino más lento. Si, por otro lado, eliges un número menor de lo que la GPU puede manejar, es posible que no obtengas el máximo rendimiento.

## <a id="a-race-conditions"></a>Condiciones de Carrera en Compute Shaders

Un error común en WebGPU es no manejar las condiciones de carrera (race conditions). Una condición de carrera ocurre cuando múltiples hilos se están ejecutando al mismo tiempo y, efectivamente, están en una carrera por ver quién llega primero o último.

Digamos que tienes este compute shader:

```wgsl
@group(0) @binding(0) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(32) fn computeSomething(
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
) {
  result[0] = f32(local_invocation_id.x);
}
```

Si eso es difícil de leer, aquí tienes más o menos el mismo JavaScript:

```js
const result = [];
for (let i = 0; i < 32; ++i) {
  result[0] = i;
}
```

En el caso de JavaScript, después de que se ejecuta el código, `result[0]` es claramente 31. Sin embargo, en el caso del compute shader, las 32 iteraciones del shader se ejecutan en paralelo. Cualquiera que termine última será la que deje su valor en `result[0]`. Cuál de ellas se ejecutará última no está definido.

De la especificación:

> WebGPU no ofrece garantías sobre:
>
> * Si las invocaciones de diferentes workgroups se ejecutan de forma concurrente. Es decir, no puedes asumir que se ejecutan más de un workgroup a la vez.
>
> * Si, una vez que las invocaciones de un workgroup comienzan a ejecutarse, otros workgroups se bloquean. Es decir, no puedes asumir que solo se ejecuta un workgroup a la vez. Mientras se ejecuta un workgroup, la implementación puede optar por ejecutar simultáneamente otros workgroups también, u otro trabajo en cola pero no bloqueado.
>
> * Si las invocaciones de un workgroup en particular comienzan a ejecutarse antes que las invocaciones de otro workgroup. Es decir, no puedes asumir que los workgroups se lanzan en un orden particular.

Repasaremos algunas de las formas de lidiar con este problema en futuros ejemplos. Por ahora, nuestros dos ejemplos no tienen condiciones de carrera, ya que cada iteración del compute shader hace algo que no se ve afectado por las demás iteraciones.

Siguiente: [Ejemplos de Compute Shaders - Histograma de imagen](webgpu-compute-shaders-histogram.html)
