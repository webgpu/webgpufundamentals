Title: Rendimiento y Timing en WebGPU
Description: Operaciones de timing en WebGPU
TOC: Rendimiento y Timing

Repasemos varias cosas que podrías querer
medir para el rendimiento. Mediremos 3 cosas:

* La tasa de fotogramas en fotogramas por segundo (fps)
* El tiempo invertido en JavaScript por fotograma
* El tiempo invertido en la GPU por fotograma

Primero, tomemos un ejemplo de círculos del
[artículo sobre buffers de vértices (vertex buffers)](webgpu-vertex-buffers.html)
y animémoslos para que tengamos algo en lo que sea fácil
ver cambios en cuánto tiempo toman las cosas.

En ese ejemplo teníamos 3 vertex buffers. Uno era para
las posiciones y el brillo de los vértices de un círculo.
Otro era para cosas que son por instancia pero estáticas,
que incluían el offset y el color del círculo. Y el último
era para cosas que cambian cada vez que renderizamos; en este
caso era la escala, para que pudiéramos mantener la relación de aspecto de
los círculos correctamente de modo que siguieran siendo círculos y no elipses
cuando el usuario cambia el tamaño de la ventana.

Queremos animarlos moviéndose, así que movamos el offset
al mismo buffer que la escala. Primero cambiaremos el
render pipeline para mover el offset al mismo buffer
que la escala.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
          arrayStride: 4, // 4 bytes
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
          ],
        },
        {
          arrayStride: 4 * 4, // 4 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x2'},  // offset
            {shaderLocation: 3, offset: 8, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

Luego cambiaremos la parte que configura los vertex buffers
para mover los offsets junto con las escalas.

```js
  // create 2 vertex buffers
  const staticUnitSize =
    4;     // color is 4 bytes
  const changingUnitSize =
    2 * 4 + // offset is 2 32bit floats (4bytes each)
    2 * 4;  // scale is 2 32bit floats (4bytes each)
  const staticVertexBufferSize = staticUnitSize * kNumObjects;
  const changingVertexBufferSize = changingUnitSize * kNumObjects;

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const changingVertexBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // offsets to the various uniform values in float32 indices
  const kColorOffset = 0;

  const kOffsetOffset = 0;
  const kScaleOffset = 2;

  {
    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffsetU8 = i * staticUnitSize;

      // These are only set once so set them now
      staticVertexValuesU8.set(        // set the color
          [rand() * 255, rand() * 255, rand() * 255, 255],
          staticOffsetU8 + kColorOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
        offset: [rand(-0.9, 0.9), rand(-0.9, 0.9)],
        velocity: [rand(-0.1, 0.1), rand(-0.1, 0.1)],
      });
    }
    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesU8);
  }
```

En el momento del renderizado podemos actualizar los offsets de los círculos basándonos en su velocidad y luego subirlos a la GPU.

```js
  const euclideanModulo = (x, a) => x - a * Math.floor(x / a);

  let then = 0;
  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

...
      // set the scales for each object
    objectInfos.forEach(({scale, offset, veloctiy}, ndx) => {
      // -1.5 to 1.5
      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

      const off = ndx * (changingUnitSize / 4);
      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
    });

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
    }
  });
  observer.observe(canvas);
```

También cambiamos a un bucle rAF[^rAF].

[^rAF]: `rAF` es la abreviatura de `requestAnimationFrame`

<a id="a-euclidianModulo"></a>El código anterior utiliza `euclideanModulo` para actualizar el offset.
`euclideanModulo` devuelve el resto de una división donde
el resto es siempre positivo, mientras que el operador `%` devuelve el resto en la misma dirección que el valor.
Por ejemplo:

<div class="webgpu_center">
  <div class="center">
    <div class="data-table center" data-table='{
  "cols": ["valor", "operador %", "euclideanModulo"],
  "classNames": ["a", "b", "c"],
  "rows": [
    [ "0.3", "0.3", "0.3" ],
    [ "2.3", "0.3", "0.3" ],
    [ "4.3", "0.3", "0.3" ],
    [ "-1.7", "-1.7", "0.3" ],
    [ "-3.7", "-1.7", "0.3" ]
  ]
}'>
     </div>
  </div>
  <div>módulo 2 de % vs euclideanModulo</div>
</div>

Dicho de otra manera, aquí hay una gráfica del operador `%` frente a `euclideanModulo`:

<div class="webgpu_center">
  <img style="width: 700px" src="resources/euclidean-modulo.svg">
  <div>euclideanModule(v, 2)</div>
</div>
<div class="webgpu_center">
  <img  style="width: 700px" src="resources/modulo.svg">
  <div>v % 2</div>
</div>

Entonces, el código anterior toma el offset, que está en espacio de recorte (clip space), y le suma 1.5. Luego toma el `euclideanModulo`
entre 3, lo que nos dará un número que está envuelto entre 0.0 y 3.0,
y luego resta 1.5. Esto nos da números
que se mantienen entre -1.5 y +1.5 y les permite dar la vuelta
al otro lado. Usamos de -1.5 a +1.5 para que
los círculos no den la vuelta hasta que estén fuera de la pantalla. [^offscreen]

[^offscreen]: Esto solo funciona si el radio del círculo es menor que 0.5,
pero pareció mejor no inflar el código con comprobaciones complicadas de tamaño.

Para darnos algo que ajustar, hagamos que podamos
establecer cuántos círculos dibujar.

```js
  const kNumObjects = 10000;


...

  const settings = {
    numObjects: 100,
  };

  const gui = new GUI();
  gui.add(settings, 'numObjects', 0, kNumObjects, 1);

  ...

    // set the scale and offset for each object
    for (let ndx = 0; ndx < settings.numObjects; ++ndx) {
      const {scale, offset, velocity} = objectInfos[ndx];

      // -1.5 to 1.5
      offset[0] = euclideanModulo(offset[0] + velocity[0] * deltaTime + 1.5, 3) - 1.5;
      offset[1] = euclideanModulo(offset[1] + velocity[1] * deltaTime + 1.5, 3) - 1.5;

      const off = ndx * (changingUnitSize / 4);
      vertexValues.set(offset, off + kOffsetOffset);
      vertexValues.set([scale / aspect, scale], off + kScaleOffset);
    }

    // upload all offsets and scales at once
    device.queue.writeBuffer(
        changingVertexBuffer, 0,
        vertexValues, 0, settings.numObjects * changingUnitSize / 4);

    pass.draw(numVertices, settings.numObjects);
```

Así que ahora deberíamos tener algo que se anima
y podemos ajustar cuánto trabajo se hace configurando
el número de círculos.

{{{example url="../webgpu-timing-animated.html"}}}

A eso, añadamos fotogramas por segundo (fps) y
el tiempo invertido en JavaScript.

Primero necesitamos una forma de mostrar esta información, así que
añadamos un elemento `<pre>` posicionado encima del canvas.

```html
  <body>
    <canvas></canvas>
+    <pre id="info"></pre>
  </body>
```

```css
html, body {
  margin: 0;       /* remove the default margin          */
  height: 100%;    /* make the html,body fill the page   */
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
}
+#info {
+  position: absolute;
+  top: 0;
+  left: 0;
+  margin: 0;
+  padding: 0.5em;
+  background-color: rgba(0, 0, 0, 0.8);
+  color: white;
+}
```

Ya tenemos los datos necesarios para mostrar
los fotogramas por segundo. Es el `deltaTime` que
calculamos arriba.

Para el tiempo de JavaScript, podemos registrar el momento en que
comenzó nuestro `requestAnimationFrame` y el momento en que
terminó.

```js
  let then = 0;
  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

+    const startTime = performance.now();

    ...

+    const jsTime = performance.now() - startTime;

+    infoElem.textContent = `\
+fps: ${(1 / deltaTime).toFixed(1)}
+js: ${jsTime.toFixed(1)}ms
+`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

Y eso nos da nuestras dos primeras mediciones de timing.

{{{example url="../webgpu-timing-with-fps-js-time.html"}}}

## <a id="a-timestamp-query"></a> Timing de la GPU

WebGPU proporciona una característica **opcional** `'timestamp-query'` para comprobar cuánto tiempo tarda una operación en la GPU.
Como es una característica opcional, necesitamos ver si
existe y solicitarla como vimos en [el artículo sobre límites y características](webgpu-limits-and-features.html).

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
-  const device = await adapter?.requestDevice();
+  const canTimestamp = adapter.features.has('timestamp-query');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: [
+      ...(canTimestamp ? ['timestamp-query'] : []),
+     ],
+  });
  if (!device) {
    fail('necesitas un navegador que soporte WebGPU');
    return;
  }
```

Arriba, establecemos `canTimestamp` a true o false basándonos en si el adaptador soporta
la característica `'timestamp-query'`. Si es así, requerimos esa característica cuando
creamos nuestro dispositivo.

Con la característica habilitada, podemos pedir a WebGPU *timestamps* (marcas de tiempo) para un render pass o
un compute pass. Esto se hace creando un `GPUQuerySet` y añadiéndolo a tu
compute o render pass. Un `GPUQuerySet` es efectivamente un array de resultados de
consultas. Le dices a WebGPU en qué elemento del array debe registrar el tiempo en que el pass comenzó
y en qué elemento del array debe registrar cuándo terminó. Luego puedes copiar esos
timestamps a un buffer y mapear el buffer para leer los resultados.[^mapping-not-necessary]

[^mapping-not-necessary]: Copiar los resultados de la consulta a un buffer mapeable es solo con el
propósito de leer los valores desde JavaScript. Si tu caso de uso solo necesita que los
resultados permanezcan en la GPU, por ejemplo como entrada para otra cosa, entonces no necesitas
copiar los resultados a un buffer mapeable.

Así que, primero creamos un query set.

```js
  const querySet = device.createQuerySet({
     type: 'timestamp',
     count: 2,
  });
```

Necesitamos que el conteo (count) sea al menos 2 para poder escribir
tanto un timestamp de inicio como uno de fin.

Necesitamos un buffer para convertir la información del querySet
en datos a los que podamos acceder.

```js
  const resolveBuffer = device.createBuffer({
    size: querySet.count * 8,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
```

Cada elemento en un querySet ocupa 8 bytes.
Necesitamos darle un uso de `QUERY_RESOLVE`
y, si queremos poder leer los resultados
de vuelta en JavaScript, necesitamos el uso `COPY_SRC`
para poder copiar el resultado a un buffer mapeable.

Finalmente, creamos un buffer mapeable para leer los
resultados.

```js
  const resultBuffer = device.createBuffer({
    size: resolveBuffer.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
```

Necesitamos envolver este código de manera que solo
cree estas cosas si la característica existe; de lo contrario, obtendremos
un error al intentar crear un querySet de tipo `'timestamp'`.

```js
+  const { querySet, resolveBuffer, resultBuffer } = (() => {
+    if (!canTimestamp) {
+      return {};
+    }

    const querySet = device.createQuerySet({
       type: 'timestamp',
       count: 2,
    });
    const resolveBuffer = device.createBuffer({
      size: querySet.count * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const resultBuffer = device.createBuffer({
      size: resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
+    return {querySet, resolveBuffer, resultBuffer };
+  })();
```

En nuestro descriptor de render pass le indicamos el
querySet a usar y el índice de los elementos
en el querySet donde escribir los timestamps de inicio
y fin.

```js
  const renderPassDescriptor = {
    label: 'nuestro renderPass básico del canvas con timing',
    colorAttachments: [
      {
        // view: <- se rellenará cuando rendericemos
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    ...(canTimestamp && {
      timestampWrites: {
        querySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      },
    }),
  };
```

Arriba, si la característica existe, añadimos una sección `timestampWrites` a nuestro
renderPassDescriptor y pasamos el querySet, indicándole que escriba el inicio en el
elemento 0 del set y el final en el elemento 1.

Después de terminar el pass, necesitamos llamar a `resolveQuerySet`. Esto toma los resultados
de la consulta y los pone en un buffer. Le pasamos el querySet, el primer índice
en el query set desde donde empezar a resolver, el número de entradas a resolver, un
buffer al que resolver y un desplazamiento (offset) en ese buffer donde almacenar el resultado.

```js
    pass.end();

+    if (canTimestamp) {
+      encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
+    }
```

También queremos copiar el `resolveBuffer` a nuestro `resultBuffer` para poder mapearlo
y ver los resultados en JavaScript. Sin embargo, tenemos un problema. No podemos copiar
a nuestro `resultBuffer` mientras esté mapeado. Afortunadamente, los buffers tienen una
propiedad `mapState` que podemos comprobar. Si está establecida en `'unmapped'`, el valor con el que comienza, entonces
es seguro copiar en él. Otros valores son `'pending'`, el valor que adquiere en el
momento en que llamamos a `mapAsync`, y `'mapped'`, el valor que tiene cuando `mapAsync`
se resuelve. Después de llamar a `unmap` vuelve a `'unmapped'`.

```js
    if (canTimestamp) {
      encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
+      if (resultBuffer.mapState === 'unmapped') {
+        encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
+      }
    }
```

Después de haber enviado (submitted) el command buffer podemos mapear el `resultBuffer`. Al igual
que arriba, solo queremos mapearlo si está en `'unmapped'`.

```js
+  let gpuTime = 0;

    ...

    function render(now) {

     ...

     const commandBuffer = encoder.finish();
     device.queue.submit([commandBuffer]);

+    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
+      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
+        const times = new BigUint64Array(resultBuffer.getMappedRange());
+        gpuTime = Number(times[1] - times[0]);
+        resultBuffer.unmap();
+      });
+    }
```

Los resultados del query set están en nanosegundos y se almacenan como enteros de 64 bits. Para leerlos
en JavaScript podemos usar una vista de array tipado `BigUint64Array`. El uso de
`BigUint64Array` requiere especial cuidado. Cuando lees un elemento de un
`BigUint64Array`, el tipo es un `bigint`, no un `number`, por lo que no puedes usarlo
con muchas funciones matemáticas. Además, cuando los conviertes a números pueden
perder precisión porque un `number` solo puede contener enteros de hasta 53 bits de tamaño.
Por lo tanto, primero restamos los 2 `bigint`, lo cual sigue siendo un `bigint`. Luego convertimos
el resultado a un número para poder usarlo con normalidad.

En el código anterior, solo estamos copiando los resultados al `resultBuffer` algunas
veces, cuando no está mapeado. Eso significa que solo estaremos leyendo el tiempo en algunos
fotogramas. Lo más probable es que sea cada dos fotogramas, pero no hay una garantía estricta de cuánto
tiempo tardará hasta que `mapAsync` se resuelva. Por eso, actualizamos `gpuTime`,
que podemos usar en cualquier momento para obtener el último tiempo registrado.

```js
    infoElem.textContent = `\
fps: ${(1 / deltaTime).toFixed(1)}
js: ${jsTime.toFixed(1)}ms
+gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
`;
```

Y con eso obtenemos un tiempo de GPU de WebGPU.

{{{example url="../webgpu-timing-with-timestamp.html"}}}

Para mí, los números cambian con demasiada frecuencia para ver algo
útil. Una forma de solucionar esto es calcular un promedio móvil
(rolling average). Aquí tienes una clase para ayudar a calcular un promedio
móvil.

```js
// Nota: No permitimos valores negativos, ya que esto se usa para consultas de timestamp
// donde es posible que una consulta devuelva un tiempo de inicio mayor que el
// de finalización. Consulta: https://gpuweb.github.io/gpuweb/#timestamp
class NonNegativeRollingAverage {
  #total = 0;
  #samples = [];
  #cursor = 0;
  #numSamples;
  constructor(numSamples = 30) {
    this.#numSamples = numSamples;
  }
  addSample(v) {
    if (!Number.isNaN(v) && Number.isFinite(v) && v >= 0) {
      this.#total += v - (this.#samples[this.#cursor] || 0);
      this.#samples[this.#cursor] = v;
      this.#cursor = (this.#cursor + 1) % this.#numSamples;
    }
  }
  get() {
    return this.#total / this.#samples.length;
  }
}
```

Mantiene un array de valores y un total. Cuando se añade un nuevo valor, el
valor más antiguo se resta del total a medida que se añade el nuevo valor.

Podemos usarlo así:

```js
+const fpsAverage = new NonNegativeRollingAverage();
+const jsAverage = new NonNegativeRollingAverage();
+const gpuAverage = new NonNegativeRollingAverage();

function render(now) {
  ...

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    if (canTimestamp && resultBuffer.mapState === 'unmapped') {
      resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const times = new BigUint64Array(resultBuffer.getMappedRange());
        gpuTime = Number(times[1] - times[0]);
+        gpuAverage.addSample(gpuTime / 1000);
        resultBuffer.unmap();
      });
    }

    const jsTime = performance.now() - startTime;

+    fpsAverage.addSample(1 / deltaTime);
+    jsAverage.addSample(jsTime);

    infoElem.textContent = `\
-fps: ${(1 / deltaTime).toFixed(1)}
-js: ${jsTime.toFixed(1)}ms
-gpu: ${canTimestamp ? `${(gpuTime / 1000).toFixed(1)}µs` : 'N/A'}
+fps: ${fpsAverage.get().toFixed(1)}
+js: ${jsAverage.get().toFixed(1)}ms
+gpu: ${canTimestamp ? `${gpuAverage.get().toFixed(1)}µs` : 'N/A'}
`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
```

Y ahora los números son un poco más estables.

{{{example url="../webgpu-timing-with-timestamp-w-average.html"}}}

## <a id="a-timing-helper"></a> Usar un ayudante

Para mí, todo esto me resulta un poco tedioso y probablemente sea fácil equivocarse
en algo. Tuvimos que crear 3 cosas: un querySet y 2 buffers. Tuvimos que cambiar nuestro
renderPassDescriptor. Tuvimos que resolver los resultados y copiarlos a un buffer mapeable.

Una forma de hacer esto menos tedioso sería crear una clase que nos ayude con el
timing. Aquí tienes un ejemplo de un ayudante (helper) que podría ser útil para algunos de estos problemas.

```js
function assert(cond, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}

// Hacemos un seguimiento de los command buffers para poder generar un error si
// intentamos leer el resultado antes de que el command buffer se haya ejecutado.
const s_unsubmittedCommandBuffer = new Set();

/* global GPUQueue */
GPUQueue.prototype.submit = (function(origFn) {
  return function(commandBuffers) {
    origFn.call(this, commandBuffers);
    commandBuffers.forEach(cb => s_unsubmittedCommandBuffer.delete(cb));
  };
})(GPUQueue.prototype.submit);

// Ver https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
export default class TimingHelper {
  #canTimestamp;
  #device;
  #querySet;
  #resolveBuffer;
  #resultBuffer;
  #commandBuffer;
  #resultBuffers = [];
  // el estado puede ser 'free', 'need resolve', 'wait for result'
  #state = 'free';

  constructor(device) {
    this.#device = device;
    this.#canTimestamp = device.features.has('timestamp-query');
    if (this.#canTimestamp) {
      this.#querySet = device.createQuerySet({
         type: 'timestamp',
         count: 2,
      });
      this.#resolveBuffer = device.createBuffer({
        size: this.#querySet.count * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
    }
  }

  #beginTimestampPass(encoder, fnName, descriptor) {
    if (this.#canTimestamp) {
      assert(this.#state === 'free', 'state not free');
      this.#state = 'need resolve';

      const pass = encoder[fnName]({
        ...descriptor,
        ...{
          timestampWrites: {
            querySet: this.#querySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        },
      });

      const resolve = () => this.#resolveTiming(encoder);
      const trackCommandBuffer = (cb) => this.#trackCommandBuffer(cb);
      pass.end = (function(origFn) {
        return function() {
          origFn.call(this);
          resolve();
        };
      })(pass.end);

      encoder.finish = (function(origFn) {
        return function() {
          const cb = origFn.call(this);
          trackCommandBuffer(cb);
          return cb;
        };
      })(encoder.finish);

      return pass;
    } else {
      return encoder[fnName](descriptor);
    }
  }

  beginRenderPass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginRenderPass', descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginComputePass', descriptor);
  }

  #trackCommandBuffer(cb) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(this.#state === 'need finish', 'debes llamar a encoder.finish');
    this.#commandBuffer = cb;
    s_unsubmittedCommandBuffer.add(cb);
    this.#state = 'wait for result';
  }

  #resolveTiming(encoder) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(
      this.#state === 'need resolve',
      'debes usar timerHelper.beginComputePass o timerHelper.beginRenderPass',
    );
    this.#state = 'need finish';

    this.#resultBuffer = this.#resultBuffers.pop() || this.#device.createBuffer({
      size: this.#resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.resolveQuerySet(this.#querySet, 0, this.#querySet.count, this.#resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.#resolveBuffer, 0, this.#resultBuffer, 0, this.#resultBuffer.size);
  }

  async getResult() {
    if (!this.#canTimestamp) {
      return 0;
    }
    assert(
      this.#state === 'wait for result',
      'debes llamar a encoder.finish y enviar el command buffer antes de poder leer el resultado',
    );
    assert(!!this.#commandBuffer); // comprobación interna
    assert(
      !s_unsubmittedCommandBuffer.has(this.#commandBuffer),
      'debes enviar el command buffer antes de poder leer el resultado',
    );
    this.#commandBuffer = undefined;
    this.#state = 'free';

    const resultBuffer = this.#resultBuffer;
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigUint64Array(resultBuffer.getMappedRange());
    const duration = Number(times[1] - times[0]);
    resultBuffer.unmap();
    this.#resultBuffers.push(resultBuffer);
    return duration;
  }
}
```

Los asserts están ahí para ayudarnos a no usar mal esta clase. Por ejemplo, si
terminamos un pass pero no lo resolvemos, o si lo resolvemos e intentamos leer el resultado
pero no lo hemos enviado.

Con esta clase, podemos eliminar gran parte del código que teníamos antes.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const canTimestamp = adapter.features.has('timestamp-query');
  const device = await adapter?.requestDevice({
    requiredFeatures: [
      ...(canTimestamp ? ['timestamp-query'] : []),
     ],
  });
  if (!device) {
    fail('necesitas un navegador que soporte WebGPU');
    return;
  }

+  const timingHelper = new TimingHelper(device);

  ...

-  const { querySet, resolveBuffer, resultBuffer } = (() => {
-    if (!canTimestamp) {
-      return {};
-    }
-
-    const querySet = device.createQuerySet({
-       type: 'timestamp',
-       count: 2,
-    });
-    const resolveBuffer = device.createBuffer({
-      size: querySet.count * 8,
-      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
-    });
-    const resultBuffer = device.createBuffer({
-      size: resolveBuffer.size,
-      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
-    });
-    return {querySet, resolveBuffer, resultBuffer };
-  })();

  ...

  function render(now) {

    ...

-    const pass = encoder.beginRenderPass(renderPassDescriptor);
+    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);

    ...

    pass.end();

-    if (canTimestamp) {
-      encoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);
-      if (resultBuffer.mapState === 'unmapped') {
-        encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
-      }
-    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    timingHelper.getResult().then(gpuTime => {
+        gpuAverage.addSample(gpuTime / 1000);
+    });

    ...
```

{{{example url="../webgpu-timing-with-timing-helper.html"}}}

Algunos puntos sobre la clase `TimingHelper`:

* Todavía tienes que solicitar manualmente la característica `'timestamp-query'` cuando
  creas tu dispositivo, pero la clase gestiona si existe o no en el
  dispositivo.

* Cuando llamas a `timerHelper.beginRenderPass` o `timerHelper.beginComputePass`,
  añade automáticamente las propiedades apropiadas al descriptor del pass. También
  devuelve un codificador de pass (pass encoder) cuya función `end` resuelve automáticamente las
  consultas.

* Está diseñada para que si la usas mal, se queje.

* Solo gestiona 1 pass.

  Hay una serie de compromisos aquí y, sin más investigación, no está
  claro qué sería lo mejor.

  Una clase que gestione múltiples passes podría ser útil pero, idealmente, usarías un
  único `GPUQuerySet` que tenga suficiente espacio para todos tus passes, en lugar de
  un `GPUQuerySet` por cada pass.

  Pero, para hacer eso, tendrías que pedir al usuario que te diga de antemano
  el número máximo de passes que usará. O bien, tendrías que complicar más el código
  para que comience con un `GPUQuerySet` pequeño, lo elimine y
  cree uno nuevo más grande si usas más. Pero entonces, al menos durante un fotograma,
  tendrías que gestionar el tener múltiples `GPUQuerySets`.

  Todo eso parecía excesivo, así que por ahora pareció mejor hacer que gestione un
  solo pass y tú puedes construir sobre él hasta que decidas que necesita cambiarse.

También podrías crear un `NoTimingHelper`.

```js
class NoTimingHelper {
  constructor() { }
  beginRenderPass(encoder, descriptor = {}) {
    return encoder.beginTimestampPass(descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return encoder.beginComputePass(descriptor);
  }
  async getResult() { return 0; }
}
```

Como una posible forma de hacer que puedas añadir timing y desactivarlo sin tener
que cambiar demasiado código.

En cualquier caso, he utilizado la clase `TimingHelper` para medir los diversos
ejemplos de [los artículos sobre el uso de compute shaders para calcular histogramas de imagen](webgpu-compute-shaders-histogram.html). Aquí tienes
una lista de ellos. Dado que solo el ejemplo de vídeo se ejecuta continuamente, es probablemente
el mejor ejemplo.

* <a target="_blank" href="../webgpu-compute-shaders-histogram-video-w-timing.html">Histograma de vídeo de 4 canales</a>

El resto solo se ejecutan una vez e imprimen su resultado en la consola de JavaScript.

* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-optimized-more-w-timing.html">Histograma por trozos (chunks) de 4 canales en workgroup con reducción (reduce)</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-race-fixed-w-timing.html">Histograma por píxel de 4 canales en workgroup</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-4ch-javascript-w-timing.html">Histograma de 4 canales en JavaScript</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-more-w-timing.html">Histograma por trozos (chunks) de 1 canal en workgroup con reducción (reduce)</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-optimized-w-timing.html">Histograma por trozos (chunks) de 1 canal en workgroup con suma</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-race-fixed-w-timing.html">Histograma por píxel de 1 canal en workgroup</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-slow-w-timing.html">Histograma de 1 canal en un solo núcleo</a>
* <a target="_blank" href="../webgpu-compute-shaders-histogram-javascript-w-timing.html">Histograma de 1 canal en JavaScript</a>

# <a id="a-implementation-defined"></a> Importante: los resultados de `timestamp-query` están definidos por la implementación

Esto significa efectivamente que puedes usarlos para depurar y comparar técnicas, pero no puedes confiar en que devuelvan resultados similares para todos tus usuarios.
Ni siquiera puedes asumir resultados relativos. Diferentes GPUs funcionan de maneras distintas
y son capaces de optimizar el renderizado y el cómputo a través de los passes. Eso significa que
en una máquina un primer pass podría tardar 200µs en dibujar 100 cosas y el segundo pass
podría tardar también 200µs para 200 cosas, pero otra GPU podría tardar 100µs en dibujar las primeras 100 cosas y 200µs en dibujar las segundas 100 cosas; así, mientras que la primera GPU
tuvo una diferencia relativa de 0µs, la segunda tuvo una diferencia relativa de 100µs,
a pesar de que a ambas GPUs se les pidió dibujar lo mismo.

# <a id="a-implementation-defined"></a> Importante: los resultados de `timestamp-query` no son una buena medida del rendimiento

Las consultas de timestamp no son una buena medida del rendimiento ya que hay muchos otros factores que determinan
el rendimiento general. Para dar un ejemplo concreto: escribimos un generador de mipmaps basado en render pass en
[el artículo sobre la carga de imágenes en texturas](webgpu-importing-textures.html#a-generating-mips-on-the-gpu).
También escribí un generador de mipmaps basado en compute pass. Cuando usé `timestamp-query` para medir ambos,
me indicó que el método del compute pass era 5 veces más rápido que el método basado en render pass. ¡Genial! Pero luego pasé a una prueba de rendimiento (throughput test). En lugar de usar `timestamp-query`, escribí una prueba que me permitía aumentar
el número de texturas de 2048x2048 para las que generar mipmaps a 60 fotogramas por segundo. Iba aumentando el
número hasta que la tasa de fotogramas bajaba de 60fps. Este método mostró que el método del render pass
era un 20% más rápido que el método del compute pass en una máquina, y un 8% más rápido en otra.

El punto es que no puedes usar `timestamp-query` de forma aislada para saber qué tan rápido
se ejecutará algo.

<div class="webgpu_bottombar">Por defecto, los valores de tiempo de <code>'timestamp-query'</code>
están cuantizados a 100µ segundos. En Chrome, si habilitas <a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">"enable-webgpu-developer-features"</a> en <a href="chrome://flags/#enable-webgpu-developer-features" target="_blank">about:flags</a>, los valores de tiempo podrían no estar cuantizados. Esto
teóricamente te daría tiempos más precisos. Dicho esto, normalmente los valores cuantizados a 100µ segundos deberían ser suficientes para que compares técnicas de shaders por rendimiento.
</div>



