Title: Layout de memoria de datos en WebGPU
Description: Cómo organizar y preparar datos para WebGPU
TOC: Layout de memoria de datos

En WebGPU, casi todos los datos que le proporcionas deben estar
organizados en memoria para coincidir con lo que defines en tus shaders.
Este es un gran contraste con JavaScript y TypeScript, donde los problemas de
layout de memoria rara vez aparecen.

En WGSL, cuando escribes tus shaders, es común definir `struct`s.
Las structs son algo así como los objetos de JavaScript: declaras los miembros de
una struct de forma similar a las propiedades de un objeto JavaScript. Pero, además
de darle un nombre a cada propiedad, también tienes que darle un tipo.
**Y**, al proporcionar los datos, **depende de ti** calcular en qué parte
de un buffer aparecerá ese miembro en particular de la struct.

En [WGSL](webgpu-wgsl.html) v1, hay 4 tipos base:

* `f32` (un número de punto flotante de 32 bits)
* `i32` (un entero de 32 bits)
* `u32` (un entero sin signo de 32 bits)
* `f16` (un número de punto flotante de 16 bits) [^f16-optional]

[^f16-optional]: El soporte para `f16` es una [característica opcional](webgpu-limits-and-features.html)

Un byte tiene 8 bits, por lo que un valor de 32 bits ocupa 4 bytes y un valor de 16 bits ocupa 2 bytes.

Si declaramos una struct como esta:

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

Una representación visual de esa estructura podría verse algo así:

<div class="webgpu_center" data-diagram="ourStructV1"></div>

Cada bloque cuadrado es un byte. Arriba puedes ver que nuestros datos ocupan 12 bytes.
`velocity` ocupa los primeros 4 bytes. `acceleration` ocupa los siguientes 4,
y `frameCount` ocupa los últimos 4.

Para pasar datos al shader, necesitamos preparar los datos para que coincidan con el
layout de memoria de `OurStruct`. Para hacer eso, necesitamos crear un `ArrayBuffer`
de 12 bytes y luego configurar vistas `TypedArray` del tipo correcto para que
podamos completarlo.

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

Arriba, `ourStructData` es un `ArrayBuffer`, que es un trozo de memoria.
Para ver el contenido de esta memoria podemos crear vistas de ella.
`ourStructValuesAsF32` es una vista de la memoria como valores de punto flotante
de 32 bits. `ourStructValuesAsU32` es una vista de **la misma memoria** como
valores de enteros sin signo de 32 bits.

Ahora que tenemos un buffer y 2 vistas, podemos establecer los datos en la estructura.

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // un valor entero
```

## <a id="a-typed-arrays"></a> `TypedArrays`

Como muchas cosas en programación, hay múltiples formas en las que podríamos
establecer los datos para `OurStruct`. Los `TypedArray` tienen un constructor que admite varias formas. Por ejemplo:

* `new Float32Array(12)`

   Esta versión crea un **nuevo** `ArrayBuffer`, en este caso de 12 * 4 bytes. Luego crea el `Float32Array` para verlo.

* `new Float32Array([4, 5, 6])`

   Esta versión crea un **nuevo** `ArrayBuffer`, en este caso de 3 * 4 bytes. Luego crea el `Float32Array` para verlo. Y establece los valores iniciales
   en 4, 5, 6.

   Ten en cuenta que también puedes pasar otro `TypedArray`. Por ejemplo:

   `new Float32Array(someUint8ArrayOf6Values)` creará un **nuevo** `ArrayBuffer` de tamaño 6 * 4, luego creará un `Float32Array` para verlo,
   y después copiará los valores de la vista existente
   en el nuevo `Float32Array`. Los valores se copian por número, no en binario.
   En otras palabras, se copian así:

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

   ¿Qué significa "copiados por valor"? Mira este ejemplo:

   ```js
   const f32s = new Float32Array([0.8, 0.9, 1.0, 1.1, 1.2]);
   const u32s = new Uint32Array(f32s); 
   console.log(u32s);   // produce 0, 0, 1, 1, 1
   ```

   La razón es que no puedes poner valores como 0.8 y 1.2 en un `Uint32Array`. Se convierten a enteros sin signo.

* `new Float32Array(someArrayBuffer)`

   Este es el caso que usamos antes. Se crea una nueva vista `Float32Array` sobre un
   **buffer existente**.

* `new Float32Array(someArrayBuffer, byteOffset)`

   Esto crea un nuevo `Float32Array` sobre un **buffer existente** pero comienza
   la vista en `byteOffset`.

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   Esto crea un nuevo `Float32Array` sobre un **buffer existente**. La vista
   comienza en `byteOffset` y tiene una longitud de `length` unidades. Por lo tanto, si pasamos 3
   como longitud, la vista tendría 3 valores float32 de largo (12 bytes) de
   `someArrayBuffer`.

Usando esta última forma, podríamos cambiar el código anterior a este:

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const velocityView = new Float32Array(ourStructData, 0, 1);
const accelerationView = new Float32Array(ourStructData, 4, 1);
const frameCountView = new Uint32Array(ourStructData, 8, 1);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

Además, cada `TypedArray` tiene las siguientes propiedades:

* `length`: número de unidades
* `byteLength`: tamaño en bytes
* `byteOffset`: offset en el `ArrayBuffer` del `TypedArray`
* `buffer`: el `ArrayBuffer` que este `TypedArray` está viendo 

Y los `TypedArray` tienen varios métodos, muchos son similares a `Array`, pero
uno que no lo es es `subarray`. Este crea una nueva vista `TypedArray`
del mismo tipo. Sus parámetros son `subarray(inicio, fin)` donde
`fin` no está incluido. Así que `someTypedArray.subarray(5, 10)` crea
un nuevo `TypedArray` del **mismo `ArrayBuffer`** desde los elementos 5 al 9
de `someTypedArray`.

Así que podríamos cambiar el código anterior a este:

```js
const kOurStructSizeFloat32Units =
  1 + // velocity
  1 + // acceleration
  1 ; // frameCount
const ourStructDataAsF32 = new Float32Array(kOurStructSizeFloat32Units);
const ourStructDataAsU32 = new Uint32Array(ourStructDataAsF32.buffer);
const velocityView = ourStructDataAsF32.subarray(0, 1);
const accelerationView = ourStructDataAsF32.subarray(1, 2);
const frameCountView = ourStructDataAsU32.subarray(2, 3);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

## Múltiples vistas del mismo `ArrayBuffer`

Tener una vista del **mismo arrayBuffer** significa exactamente eso. Por ejemplo:

```js
const v1 = new Float32Array(5);
const v2 = v1.subarray(3, 5);  // ver los últimos 2 floats de v1
v2[0] = 123;
v2[1] = 456;
console.log(v1);  // muestra 0, 0, 0, 123, 456
```

De manera similar, si tenemos vistas de diferentes tipos:

```js
const f32 = new Float32Array([1, 1000, -1000])
const u32 = new Uint32Array(f32.buffer);

console.log(Array.from(u32).map(v => v.toString(16).padStart(8, '0')));
// muestra '3f800000', '447a0000', 'c47a0000' 
```

Los valores anteriores son las representaciones hexadecimales de 32 bits de los valores de punto flotante para 1, 1000, -1000.

Por ejemplo: Vamos a crear un `ArrayBuffer` de 16 bytes. Luego crearemos diferentes
vistas `TypedArray` de la misma memoria.

```js
const arrayBuffer = new ArrayBuffer(16);
const asInt8      = new Int8Array(arrayBuffer);
const asUint8     = new Uint8Array(arrayBuffer);
const asInt16     = new Int16Array(arrayBuffer);
const asUint16    = new Uint16Array(arrayBuffer);
const asInt32     = new Int32Array(arrayBuffer);
const asUint32    = new Uint32Array(arrayBuffer);
const asFloat32   = new Float32Array(arrayBuffer);
const asFloat64   = new Float64Array(arrayBuffer);
const asBigInt64  = new BigInt64Array(arrayBuffer);
const asBigUint64 = new BigInt64Array(arrayBuffer);

// Establecer algunos valores para empezar.
asFloat32.set([123, -456, 7.8, -0.123]);
```

Aquí tienes una representación de todas esas vistas, todas viendo la misma
memoria. Abajo, edita cualquier número y los valores correspondientes que están
usando la misma memoria cambiarán.

<div data-diagram="typedArrays" data-caption="mostrar enteros como hexadecimal"></div>

## Problemas con `map`

Ten en cuenta que la función `map` de un `TypedArray` ¡crea un nuevo typed array del mismo tipo!

```js
const f32a = new Float32Array(1, 2, 3);
const f32b = f32a.map(v => v * 2);                    // Ok
const f32c = f32a.map(v => `${v} doubled = ${v *2}`); // ¡MAL!
                    // no puedes poner un string en un Float32Array
```

Si necesitas mapear un typed array a algún otro tipo, tendrás que iterar sobre el array tú mismo
o bien convertirlo a un array de JavaScript, lo cual puedes hacer con `Array.from`. Tomando el ejemplo anterior:

```js
const f32d = Array.from(f32a).map(v => `${v} doubled = ${v *2}`); // Ok
```

## Tipos vec y mat

[WGSL](webgpu-wgsl.html) tiene tipos creados a partir de los 4 tipos base.
Ellos son:

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>tipo</th><th>descripción</th><th>nombre corto</th><tr>
    </thead>
    <tbody>
      <tr><td><code>vec2&lt;f32&gt;</code></td><td>un tipo con 2 <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td><td>un tipo con 2 <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td><td>un tipo con 2 <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td><td>un tipo con 2 <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td><td>un tipo con 3 <code>f32</code>s</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td><td>un tipo con 3 <code>u32</code>s</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td><td>un tipo con 3 <code>i32</code>s</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td><td>un tipo con 3 <code>f16</code>s</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td><td>un tipo con 4 <code>f32</code>s</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td><td>un tipo con 4 <code>u32</code>s</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td><td>un tipo con 4 <code>i32</code>s</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td><td>un tipo con 4 <code>f16</code>s</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td><td>una matriz de 2 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td><td>una matriz de 2 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td><td>una matriz de 2 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td><td>una matriz de 2 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td><td>una matriz de 2 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td><td>una matriz de 2 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td><td>una matriz de 3 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td><td>una matriz de 3 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td><td>una matriz de 3 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td><td>una matriz de 3 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td><td>una matriz de 3 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td><td>una matriz de 3 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td><td>una matriz de 4 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td><td>una matriz de 4 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td><td>una matriz de 4 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td><td>una matriz de 4 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td><td>una matriz de 4 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td><td>una matriz de 4 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

Dado que un `vec3f` es un tipo con 3 `f32`s y
`mat4x4f` es una matriz 4x4 de `f32`s (es decir, 16 `f32`s),
¿cómo crees que se ve la siguiente struct en memoria?

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

¿Listo?

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

¿Qué ha pasado ahí? Resulta que cada tipo tiene requisitos de alineación (alignment).
Para un tipo dado, debe estar alineado a un múltiplo de un cierto número
de bytes.

Aquí tienes los tamaños (sizes) y las alineaciones (alignments) de los diversos tipos.

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

¡Pero espera, hay MÁS!

¿Cuál crees que será el layout de esta struct?

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```

La sintaxis `array<type, count>` define un array de `type` con `count` elementos.

Aquí lo tienes...

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

Si miras en la tabla de alineación, verás que `vec3<f32>` tiene
una alineación de 16 bytes. Eso significa que cada `vec3<f32>`, ya sea
que esté en una matriz o en un array, termina teniendo un espacio extra.

Aquí tienes otro:

```wgsl
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
```

<div class="webgpu_center" data-diagram="ourStructEx4"></div>

¿Por qué `size` terminó en el byte offset 12, justo después de `orientation`, pero `scale` y
`friction` saltaron a los offsets 32 y 64?

Esto se debe a que los arrays y las structs tienen sus propias reglas especiales de alineación, por lo que
aunque el array sea un solo `vec3f` y la struct `Ex4a` también sea un solo
`vec3f`, se alinean de acuerdo con reglas diferentes.

<a id="a-struct-array-size-alignment"></a>
<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>tipo</th><th>alineación (align)</th><th>tamaño (size)</th><tr>
    </thead>
    <tbody>
      <tr><td><code>struct</code> S con miembros M<sub>1</sub>...M<sub>N</sub></td><td>max(AlignOfMember(S,1), ... , AlignOfMember(S,N))</td><td>roundUp(AlignOf(S), justPastLastMember)

donde justPastLastMember = OffsetOfMember(S,N) + SizeOfMember(S,N)</td></tr>
      <tr><td><code>array&lt;E, N&gt;</code></td><td>AlignOf(E)</td><td>N × roundUp(AlignOf(E), SizeOf(E))</td></tr>
    </tbody>
  </table>
  </div>
</div>

Puedes leer las reglas con más detalle [aquí en la especificación de WGSL](https://www.w3.org/TR/WGSL/#alignment-and-size).

# ¡Calcular offsets y tamaños es un dolor de cabeza!

Calcular tamaños y offsets de datos en WGSL es probablemente el mayor punto de fricción
de WebGPU. Se requiere que calcules estos offsets tú mismo y los mantengas
actualizados. Si añades un miembro en algún lugar en medio de una struct en tus shaders,
necesitas volver a tu JavaScript y actualizar todos los offsets. Si te equivocas en un solo
byte o longitud, los datos que pases al shader serán incorrectos. No
obtendrás un error, pero lo más probable es que tu shader haga algo incorrecto porque está
mirando datos erróneos. Tu modelo no se dibujará o tu cálculo producirá
malos resultados.

Afortunadamente, existen librerías para ayudar con esto.

Aquí tienes una: [webgpu-utils](https://github.com/greggman/webgpu-utils)

Le proporcionas tu código WGSL y te ofrece una API para hacer todo esto por ti.
De esta manera puedes cambiar tus structs y, casi siempre, las cosas
simplemente funcionarán.

Por ejemplo, usando ese último ejemplo, podemos pasarlo a `webgpu-utils`
así:

```js
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'https://greggman.github.io/webgpu-utils/dist/0.x/webgpu-utils-1.x.module.js';

const code = `
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
@group(0) @binding(0) var<uniform> myUniforms: Ex4;

...
`;

const defs = makeShaderDataDefinitions(code);
const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);

// Establecer algunos valores mediante set
myUniformValues.set({
  orientation: [1, 0, -1],
  size: 2,
  direction: [0, 1, 0],
  scale: 1.5,
  info: {
    velocity: [2, 3, 4],
  },
  friction: 0.1,
});

// ahora pasa myUniformValues.arrayBuffer a WebGPU cuando sea necesario.
```

Que uses esta librería en particular, una diferente o
ninguna en absoluto, depende de ti. En mi caso, a menudo pasaba 20, 30 o 60 minutos
tratando de descubrir por qué algo no funcionaba solo para encontrar
que había calculado manualmente un offset o tamaño de forma incorrecta, así que para mi propio trabajo
prefiero usar una librería y evitar ese sufrimiento.

Si de todas formas quieres hacerlo manualmente,
[aquí tienes una página que calculará los offsets por ti](resources/wgsl-offset-computer.html).

Por lo demás, hay muchas librerías para ayudar a abstraer WebGPU
y hacer que cosas como esta, y otras, sean más fáciles. Puedes encontrar
una lista [aquí](webgpu-resources.html).

<!-- keep this at the bottom of the article -->
<link rel="stylesheet" href="webgpu-memory-layout.css">
<script type="module" src="webgpu-memory-layout.js"></script>
