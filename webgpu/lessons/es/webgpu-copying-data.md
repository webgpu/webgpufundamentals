Title: Copiando Datos en WebGPU
Description: Copiando datos hacia/desde buffers y texturas
TOC: Copiando Datos

En la mayoría de los artículos hasta la fecha, hemos utilizado las funciones
`writeBuffer` para poner datos en un buffer y `writeTexture`
para poner datos en una textura. Hay varias formas de introducir
datos en un buffer o una textura.

## `writeBuffer`

`writeBuffer` copia datos desde un `TypedArray` o `ArrayBuffer` en JavaScript hacia un buffer.
Esta es, posiblemente, la forma más directa de introducir datos en un buffer.

`writeBuffer` sigue este formato:

```js
device.queue.writeBuffer(
  destBuffer,  // el buffer en el que se escribirá
  destOffset,  // dónde empezar a escribir en el buffer de destino
  srcData,     // un typedArray o arrayBuffer
  srcOffset?,  // desplazamiento en **elementos** en srcData para empezar a copiar
  size?,       // tamaño en **elementos** de srcData a copiar
)
```

Si no se pasa `srcOffset`, es `0`. Si no se pasa `size`,
es el tamaño de `srcData`.

> Importante: `srcOffset` y `size` están expresados en elementos de `srcData`.
>
> En otras palabras:
>
> ```js
> device.queue.writeBuffer(
>   someBuffer,
>   someOffset,
>   someFloat32Array,
>   6,
>   7,
> )
> ``` 
>
> el código anterior copiará desde el float32 nº 6, 7 float32s de datos.
> Dicho de otro modo, copiará 28 bytes empezando en el byte 24
> de la porción del arrayBuffer del cual `someFloat32Array` es
> una vista (view).

## `writeTexture`

`writeTexture` copia datos desde un `TypedArray` o `ArrayBuffer` en JavaScript hacia una textura.
  
`writeTexture` tiene esta firma:

```js
device.queue.writeTexture(
  // detalles del destino
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // los datos de origen
  srcData,

  // detalles de los datos de origen
  { offset: 0, bytesPerRow, rowsPerImage },

  // tamaño (size):
  [ width, height, depthOrArrayLayers ] o { width, height, depthOrArrayLayers }
)
```

Cosas a tener en cuenta:

* `texture` debe tener un uso (`usage`) de `GPUTextureUsage.COPY_DST`.

* `mipLevel`, `origin` y `aspect` tienen valores por defecto, por lo que a menudo no es necesario especificarlos.

* `bytesPerRow`: Indica cuántos bytes hay que avanzar para llegar a la siguiente *fila de bloques* (block row) de datos.

   Esto es obligatorio si vas a copiar más de 1 *fila de bloques*. Casi
   siempre se copia más de 1 *fila de bloques*, por lo que suele ser
   un parámetro obligatorio.

* `rowsPerImage`: Indica el número de *filas de bloques* que hay que avanzar para ir del
   principio de una imagen a la siguiente imagen.

   Esto es obligatorio si vas a copiar más de 1 capa (layer). En otras palabras,
   si `depthOrArrayLayers` en el argumento de tamaño es > 1, entonces necesitas proporcionar
   este valor.

Puedes imaginar que la copia funciona de la siguiente manera:

```js
   // pseudo-código
   const [x, y, z] = origin ?? [0, 0, 0];
   const [blockWidth, blockHeight, bytesPerBlock] =
      getBlockInfoForTextureFormat(texture.format);

   const blocksAcross = width / blockWidth;
   const blocksDown = height / blockHeight;
   const bytesPerBlockRow = blocksAcross * bytesPerBlock;

   for (layer = 0; layer < depthOrArrayLayers; layer) {
      for (row = 0; row < blocksDown; ++row) {
        const start = offset + (layer * rowsPerImage + row) * bytesPerRow;
        copyRowToTexture(
            texture,               // textura a la que copiar
            x, y + row, z + layer, // dónde copiar en la textura
            srcDataAsBytes + start,
            bytesPerBlockRow);
      }
   }
```

### <a id="a-block-rows"></a>**fila de bloques** (block row)

Las texturas se organizan en bloques. Para la mayoría de las texturas *normales*, el ancho del bloque
y el alto del bloque son ambos 1. Para las texturas comprimidas esto cambia. Por ejemplo,
el formato `bc1-rgba-unorm` tiene un ancho de bloque de 4 y un alto de bloque de 4.
Eso significa que si estableces el ancho a 8 y el alto a 12, solo se copiarán 6 bloques:
2 bloques para la primera fila, 2 para la segunda y 2 para la tercera.

Para texturas comprimidas, el tamaño (`size`) y el origen (`origin`) deben estar alineados con los tamaños de los bloques.

> Importante: Cualquier lugar en WebGPU que acepte un tamaño (definido como `GPUExtent3D`)
> puede ser un array de 1 a 3 números, o bien un objeto con 1 a
> 3 propiedades. `height` y `depthOrArrayLayers` tienen 1 como valor por defecto, así que:
>
> * `[2]` un tamaño donde width = 2, height = 1, depthOrArrayLayers = 1
> * `[2, 3]` un tamaño donde width = 2, height = 3, depthOrArrayLayers = 1
> * `[2, 3, 4]` un tamaño donde width = 2, height = 3, depthOrArrayLayers = 4
> * `{ width: 2 }` un tamaño donde width = 2, height = 1, depthOrArrayLayers = 1
> * `{ width: 2, height: 3 }` un tamaño donde width = 2, height = 3, depthOrArrayLayers = 1
> * `{ width: 2, height: 3, depthOrArrayLayers: 4 }` un tamaño donde width = 2, height = 3, depthOrArrayLayers = 4

> Del mismo modo, en cualquier lugar donde aparezca un origen (por defecto un `GPUOrigin3D`), puedes usar un array
> de 3 números o un objeto con las propiedades `x`, `y`, `z`. Todas ellas tienen 0 como valor por defecto, así que:
>
> * `[5]` un origen donde x = 5, y = 0, z = 0
> * `[5, 6]` un origen donde x = 5, y = 6, z = 0
> * `[5, 6, 7]` un origen donde x = 5, y = 6, z = 7
> * `{ x: 5 }` un origen donde x = 5, y = 0, z = 0
> * `{ x: 5, y: 6 }` un origen donde x = 5, y = 6, z = 0
> * `{ x: 5, y: 6, z: 7 }` un origen donde x = 5, y = 6, z = 7

* `aspect` realmente solo entra en juego cuando se copian datos a un formato depth-stencil (profundidad-esténcil).
  Solo puedes copiar a un aspecto a la vez, ya sea el `depth-only` (solo profundidad) o el `stencil-only` (solo esténcil).

> Trivia: Una textura tiene propiedades `width`, `height` y `depthOrArrayLayers`, lo que
> significa que es un `GPUExtent3D` válido. En otras palabras, dada esta textura:
>
> ```js
> const texture = device.createTexture({
>   format: 'r8unorm',
>   size: [2, 4],
>   usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_ATTACHMENT,
> });
> ```
>
> todo lo siguiente funciona:
>
> ```js
> // copiar 2x4 píxeles de datos a la textura
> const bytesPerRow = 2;
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [2, 4]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, [texture.width, texture.height]);
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: 2, height: 4});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, {width: texture.width, height: texture.height});
> device.queue.writeTexture({ texture }, data, { bytesPerRow }, texture); // !!!
> ```
>
> El último ejemplo funciona porque una textura tiene propiedades `width`, `height` y `depthOrArrayLayers`.
> No solemos usar ese estilo porque no resulta tan claro, pero es válido.

## `copyBufferToBuffer`

`copyBufferToBuffer`, como su nombre sugiere, copia datos de un buffer a otro.

Firma:

```js
encoder.copyBufferToBuffer(
  source,       // buffer desde el que copiar
  sourceOffset, // dónde empezar a copiar
  dest,         // buffer al que copiar
  destOffset,   // dónde empezar a escribir
  size,         // cuántos bytes copiar
)
```

* `source` debe tener un uso (`usage`) de `GPUBufferUsage.COPY_SRC`.
* `dest` debe tener un uso (`usage`) de `GPUBufferUsage.COPY_DST`.
* `size` debe ser múltiplo de 4.

## `copyBufferToTexture`

`copyBufferToTexture`, como su nombre sugiere, copia datos de un buffer a una textura.

Firma:

```js
encoder.copyBufferToTexture(
  // detalles del buffer de origen
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // detalles de la textura de destino
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // tamaño (size):
  [ width, height, depthOrArrayLayers ] o { width, height, depthOrArrayLayers }
)
```

Esta función tiene casi exactamente los mismos parámetros que `writeTexture`.
La mayor diferencia es que `bytesPerRow` **¡debe ser
múltiplo de 256!**

* `texture` debe tener un uso de `GPUTextureUsage.COPY_DST`.
* `buffer` debe tener un uso de `GPUBufferUsage.COPY_SRC`.

## `copyTextureToBuffer`

`copyTextureToBuffer`, como su nombre sugiere, copia datos de una textura a un buffer.

Firma:

```js
encoder.copyTextureToBuffer(
  // detalles de la textura de origen
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // detalles del buffer de destino
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // tamaño (size):
  [ width, height, depthOrArrayLayers ] o { width, height, depthOrArrayLayers }
)
```

Esta tiene parámetros similares a `copyBufferToTexture`,
solo que la textura (ahora el origen) y el buffer (ahora el destino)
están intercambiados. Al igual que en `copyBufferToTexture`, `bytesPerRow` **¡debe ser
múltiplo de 256!**

* `texture` debe tener un uso de `GPUTextureUsage.COPY_SRC`.
* `buffer` debe tener un uso de `GPUBufferUsage.COPY_DST`.

## `copyTextureToTexture`

`copyTextureToTexture` copia una porción de una textura a otra. 

Ambas texturas deben tener el mismo formato o
solo deben diferenciarse por el sufijo `'-srgb'`.

Firma:

```js
encoder.copyTextureToTexture(
  // detalles de la textura de origen
  src: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // detalles de la textura de destino
  dst: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // tamaño (size):
  [ width, height, depthOrArrayLayers ] o { width, height, depthOrArrayLayers }
)
```

* src.`texture` debe tener un uso de `GPUTextureUsage.COPY_SRC`.
* dst.`texture` debe tener un uso de `GPUTextureUsage.COPY_DST`.
* `width` debe ser múltiplo del ancho de bloque.
* `height` debe ser múltiplo del alto de bloque.
* src.`origin[0]` o `.x` debe ser múltiplo del ancho de bloque.
* src.`origin[1]` o `.y` debe ser múltiplo del alto de bloque.
* dst.`origin[0]` o `.x` debe ser múltiplo del ancho de bloque.
* dst.`origin[1]` o `.y` debe ser múltiplo del alto de bloque.

## Shaders

Los shaders pueden leer y escribir en storage buffers (buffers de almacenamiento), storage textures (texturas de almacenamiento)
e, indirectamente, pueden renderizar en texturas. Todas estas son formas
de introducir datos en buffers y texturas. En otras palabras,
puedes escribir shaders para generar y/o copiar y transferir datos.

## Mapeando Buffers (Mapping)

Puedes mapear un buffer. Mapear un buffer significa hacerlo
disponible para leer o escribir desde JavaScript. 
Al menos en la versión 1 de WebGPU,
los buffers mapeables tienen restricciones severas; a saber, un
buffer mapeable solo puede usarse como un lugar temporal
desde el cual o hacia el cual copiar. Un buffer mapeable no se puede usar como ningún
otro tipo de buffer (como un uniform buffer, vertex buffer,
index buffer, storage buffer, etc...) [^mappedAtCreation]

[^mappedAtCreation]: La excepción es si estableces `mappedAtCreation: true`.
Consulta [mappedAtCreation](#a-mapped-at-creation).

Puedes crear un buffer mapeable con 2 combinaciones
de flags de uso.

* `GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST`

  Este es un buffer en el que puedes usar los comandos de copia mencionados arriba para copiar
  datos desde otro buffer o una textura, y luego mapearlo para
  leer los valores en JavaScript.

* `GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC`

  Este es un buffer que puedes mapear en JavaScript, poner datos en él desde JavaScript y, finalmente, desenmapearlo (unmap) para usar
  los comandos de copia de arriba para copiar su contenido a otro
  buffer o textura.

El proceso de mapear un buffer es asíncrono. Llamas a
`buffer.mapAsync(mode, offset = 0, size?)` donde `offset`
y `size` se expresan en bytes. Si no se especifica `size`, es
el tamaño de todo el buffer. El parámetro `mode` debe ser
`GPUMapMode.READ` o `GPUMapMode.WRITE` y, por supuesto, debe
coincidir con la flag de uso `MAP_` que pasaste al crear
el buffer.

`mapAsync` devuelve una `Promise`.
Cuando la promesa se resuelve, el buffer ya es mapeable. Entonces puedes
ver una parte o la totalidad del buffer llamando a `buffer.getMappedRange(offset = 0, size?)`,
donde `offset` es un desplazamiento en bytes dentro de la porción del buffer que
mapeaste. `getMappedRange` devuelve un `ArrayBuffer`, por lo que generalmente, para
que sea de utilidad, lo usarás para construir un TypedArray.

Aquí tienes un ejemplo de cómo mapear un buffer:

```js
const buffer = device.createBuffer({
  size: 1024,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// mapear el buffer completo
await buffer.mapAsync(GPUMapMode.READ);

// obtener el buffer completo como un array de floats de 32 bits.
const f32 = new Float32Array(buffer.getMappedRange())

...

buffer.unmap();
```

Nota: Una vez mapeado, el buffer no puede ser utilizado por WebGPU hasta que llames a `unmap`.
En el momento en que se llama a `unmap`, el buffer desaparece de JavaScript. En otras palabras,
tomemos el ejemplo anterior:

```js
const f32 = new Float32Array(buffer.getMappedRange())

f32[0] = 123;
console.log(f32[0]); // imprime 123

buffer.unmap();

console.log(f32[0]); // imprime undefined
```

Ya hemos visto ejemplos de mapeo de un buffer para lectura
en [el primer artículo](webgpu-fundamentals.html#a-run-computations-on-the-gpu), donde duplicamos algunos números
en un storage buffer, copiamos los resultados a un buffer mapeable y lo mapeamos para leer los resultados.

Otro ejemplo es el artículo sobre [lo básico de los compute shaders](webgpu-compute-shaders.md) (shaders de cómputo),
donde sacamos los diversos valores `@builtin` de un compute shader a un storage buffer.
Luego copiamos esos resultados a un buffer mapeable y lo mapeamos para leer los resultados.

## <a id="a-mapped-at-creation"></a>mappedAtCreation

`mappedAtCreation: true` es una flag que puedes añadir cuando
creas un buffer. En este caso, el buffer no necesita
las flags de uso `GPUBufferUsage.COPY_DST` ni `GPUBufferUsage.MAP_WRITE`.

Esta es una flag especial destinada únicamente a permitirte poner datos en el
buffer al crearlo. Añades `mappedAtCreation: true` al crear el
buffer. El buffer se crea y ya está mapeado para escritura. Ejemplo:

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 const arrayBuffer = buffer.getMappedRange(0, buffer.size);
 const f32 = new Float32Array(arrayBuffer);
 f32.set([1, 2, 3, 4]);
 buffer.unmap();
```

O, de forma más concisa:

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 new Float32Array(buffer.getMappedRange(0, buffer.size)).set([1, 2, 3, 4]);
 buffer.unmap();
```

Ten en cuenta que un buffer creado con `mappedAtCreation: true` no tiene
ninguna flag configurada automáticamente. Es simplemente una conveniencia para poner datos
en el buffer al crearlo. Se mapea al crearse y,
después de que lo desenmapees una vez, se comporta como cualquier otro buffer y solo
funcionará para los usos que especificaste. En otras palabras, si quieres copiar
en él más tarde, necesitarás `GPUBufferUsage.COPY_DST`, o si quieres mapearlo
después, necesitarás `GPUBufferUsage.MAP_READ` o `GPUBufferUsage.MAP_WRITE`.

## <a id="a-efficient"></a>Usando buffers mapeables de forma eficiente

Arriba vimos que mapear un buffer es asíncrono. Esto significa que transcurre
una cantidad de tiempo indeterminada desde el momento en que pedimos que el buffer
se mapee llamando a `mapAsync`, hasta que se mapea y podemos llamar a `getMappedRange`.

Una forma común de evitar esto es mantener un conjunto de buffers siempre mapeados.
Como ya están mapeados, están listos para usarse de inmediato. Tan pronto
como uses uno y lo desenmapees, y en cuanto hayas enviado (submit) cualquier
comando que use el buffer, pides que se mapee de nuevo. Cuando su promesa
se resuelva, lo devuelves a un grupo (pool) de buffers ya mapeados. Si alguna vez
necesitas un buffer mapeado y no hay ninguno disponible, creas uno nuevo y lo añades
al grupo.
