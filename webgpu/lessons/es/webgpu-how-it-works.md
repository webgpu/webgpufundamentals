Title: Cómo funciona WebGPU
Description: Cómo funciona WebGPU
TOC: Cómo funciona

Intentemos explicar WebGPU implementando algo similar a lo que hace la GPU
con los vertex shaders (shaders de vértices) y fragment shaders (shaders de fragmentos), pero en JavaScript. Esperemos que esto te dé
una sensación intuitiva de lo que realmente está sucediendo.

Si estás familiarizado con
[Array.map](https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Array/map),
si entrecierras mucho los ojos puedes hacerte una idea de cómo funcionan estos dos tipos diferentes de
funciones de shader. Con `Array.map`, proporcionas una función para transformar un valor.

Ejemplo:

```js
const shader = v => v * 2;  // duplica la entrada
const input = [1, 2, 3, 4];
const output = input.map(shader);   // resultado [2, 4, 6, 8]
```

Arriba, nuestro "shader" para `array.map` es solo una función que, dado un número, devuelve
su doble. Esa es probablemente la analogía más cercana en JavaScript a lo que significa "shader".
Es una función que devuelve o genera valores. No la llamas
directamente. En su lugar, la especificas y luego el sistema la llama por ti.

Para un vertex shader de GPU, no mapeas sobre un array de entrada. En su lugar, simplemente
especificas un conteo de cuántas veces quieres que se llame a la función.

```js
function draw(count, vertexShaderFn) {
  const internalBuffer = [];
  for (let i = 0; i < count; ++i) {
    internalBuffer[i] = vertexShaderFn(i);
  }
  console.log(JSON.stringify(internalBuffer));
}
```

Una consecuencia es que, a diferencia de `Array.map`, ya no necesitamos un array de origen para hacer algo.

```js
const shader = v => v * 2;
const count = 4;
draw(count, shader);
// imprime [0, 2, 4, 6]
```

Lo que hace que el trabajo de la GPU sea complicado es que estas funciones se ejecutan en un sistema
separado en tu computadora: la GPU. Esto significa que todos los datos que creas y referencias
deben ser enviados de alguna manera a la GPU y luego debes comunicarle al shader
dónde pusiste esos datos y cómo acceder a ellos.

Los vertex shaders y fragment shaders pueden recibir datos de 6 maneras: Uniforms, Attributes (atributos), Buffers, Texturas, Variables entre etapas (inter-stage variables) y Constantes.

1. Uniforms

   Los uniforms son valores que son los mismos para cada iteración del shader. Piensa
   en ellos como variables globales constantes. Puedes configurarlos antes de que se ejecute un shader
   pero, mientras se usa el shader, permanecen constantes o, para decirlo de
   otra manera, permanecen *uniformes*.

   Cambiemos `draw` para pasar uniforms a un shader. Para hacer esto
   crearemos un array llamado `bindings` y lo usaremos para pasar los uniforms.

   ```js
   function draw(count, vertexShaderFn, bindings) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
       internalBuffer[i] = vertexShaderFn(i, bindings);
     }
     console.log(JSON.stringify(internalBuffer));
   }
   ```

   Y luego cambiemos nuestro shader para usar los uniforms:

   ```js
   const vertexShader = (v, bindings) => {
     const uniforms = bindings[0];
     return v * uniforms.multiplier;
   };
   const count = 4;
   const uniforms1 = {multiplier: 3};
   const uniforms2 = {multiplier: 5};
   const bindings1 = [uniforms1];
   const bindings2 = [uniforms2];
   draw(count, vertexShader, bindings1);
   // imprime [0, 3, 6, 9]
   draw(count, vertexShader, bindings2);
   // imprime [0, 5, 10, 15]
   ```

   Así que, el concepto de uniforms esperemos que parezca bastante sencillo. La
   indirección a través de `bindings` está ahí porque es "similar" a cómo se
   hacen las cosas en WebGPU. Como se mencionó anteriormente, accedemos a las cosas, en este caso
   los uniforms, por ubicación/índice. Aquí se encuentran en `bindings[0]`.

2. Attributes (solo vertex shaders)

   Los atributos (attributes) proporcionan datos por cada iteración del shader. En el ejemplo de `Array.map` anterior,
   el valor `v` se extraía de `input` y se proporcionaba automáticamente
   a la función. Esto es muy similar a un atributo en un shader.

   La diferencia es que no estamos mapeando sobre la entrada, sino que,
   como solo estamos contando, debemos indicarle a WebGPU
   cuáles son estas entradas y cómo extraer datos de ellas.

   Imagina que actualizamos `draw` de esta manera:

   ```js
   function draw(count, vertexShaderFn, bindings, attribsSpec) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
       const attribs = getAttribs(attribsSpec, i);
       internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
     console.log(JSON.stringify(internalBuffer));
   }

   function getAttribs(attribs, ndx) {
     return attribs.map(({source, offset, stride}) => source[ndx * stride + offset]);
   }
   ```

   Entonces podríamos llamarlo así:

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [
     { source: buffer1, offset: 0, stride: 2, },
     { source: buffer1, offset: 1, stride: 2, },
     { source: buffer2, offset: 0, stride: 1, },
   ];
   const vertexShader = (v, bindings, attribs) => (attribs[0] + attribs[1]) * attribs[2];
   const bindings = [];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // imprime [11, 110, 297, 572]
   ```

   Como puedes ver arriba, `getAttribs` usa `offset` (desplazamiento) y `stride` (salto/paso) para
   calcular los índices en el buffer `source` correspondiente y extrae los valores.
   Los valores extraídos se envían luego al shader. En cada iteración,
   `attribs` será diferente.

   ```
    iteración |  attribs
    ----------+-------------
        0     | [0, 1, 11]
        1     | [2, 3, 22]
        2     | [4, 5, 33]
        3     | [6, 7, 44]
   ```

3. Buffers de datos (Raw Buffers)

   Los buffers son efectivamente arrays; de nuevo, para nuestra analogía hagamos una versión
   de `draw` que use buffers. Pasaremos estos buffers a través de `bindings`
   como hicimos con los uniforms.

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [];
   const bindings = [
     buffer1,
     buffer2,
   ];
   const vertexShader = (ndx, bindings, attribs) => 
       (bindings[0][ndx * 2] + bindings[0][ndx * 2 + 1]) * bindings[1][ndx];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // imprime [11, 110, 297, 572]
   ```

   Aquí obtuvimos el mismo resultado que con los atributos, excepto que esta vez,
   en lugar de que el sistema extrajera los valores de los buffers por nosotros,
   calculamos nuestros propios índices dentro de los buffers vinculados. Esto es más flexible que
   los atributos, ya que básicamente tenemos acceso aleatorio a los arrays. Pero es
   potencialmente más lento por esa misma razón. Dada la forma en que funcionan los atributos, la
   GPU sabe que los valores se accederán en orden, lo que puede aprovechar para optimizar.
   Por ejemplo, el acceso en orden suele ser amigable con la memoria caché. Cuando calculamos nuestros
   propios índices, la GPU no tiene idea de qué parte de un buffer vamos a acceder
   hasta que realmente intentamos hacerlo.

4. Texturas

   Las texturas son arrays de datos de 1D, 2D o 3D. Por supuesto, podríamos implementar
   nuestros propios arrays 2D o 3D usando buffers. Lo especial de las texturas
   es que pueden ser muestreadas (sampled). Muestrear significa que podemos pedirle a la GPU que calcule
   un valor entre los valores que suministramos. Cubriremos lo que esto significa en
   [el artículo sobre texturas](webgpu-textures.html). Por ahora, hagamos
   una analogía en JavaScript de nuevo.

   Primero crearemos una función `textureSample` que *muestrea* (samples) un array
   entre valores.

   ```js
   function textureSample(texture, ndx) {
     const startNdx = ndx | 0;  // redondea hacia abajo a un entero
     const fraction = ndx % 1;  // obtiene la parte fraccionaria entre índices
     const start = texture[startNdx];
     const end = texture[startNdx + 1];
     return start + (end - start) * fraction;  // calcula el valor entre el inicio y el final
   }
   ```

   Una función similar a esa ya existe en la GPU.

   Ahora usemos eso en un shader:

   ```js
   const texture = [10, 20, 30, 40, 50, 60, 70, 80];
   const attribsSpec = [];
   const bindings = [
     texture,
   ];
   const vertexShader = (ndx, bindings, attribs) =>
       textureSample(bindings[0], ndx * 1.75);
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // imprime [10, 27.5, 45, 62.5]
   ```

   Cuando `ndx` es `3`, pasaremos `3 * 1.75` o `5.25` a `textureSample`.
   Eso calculará un `startNdx` de `5`. Así que extraeremos los índices `5` y `6`,
   que son `60` y `70`. `fraction` se convierte en `0.25`, por lo que obtendremos
   `60 + (70 - 60) * 0.25`, que es `62.5`.

   Mirando el código anterior, podríamos escribir `textureSample` nosotros mismos en nuestra función
   de shader. Podríamos extraer manualmente los 2 valores e interpolar entre ellos.
   La razón por la que la GPU tiene esta funcionalidad especial es que puede hacerlo mucho más rápido
   y, dependiendo de la configuración, puede leer hasta dieciséis valores de 4 flotantes
   para producir un solo valor de 4 flotantes para nosotros. Eso sería mucho trabajo para hacerlo manualmente.

5. Variables entre etapas (solo fragment shaders)

   Las variables entre etapas (inter-stage variables) son salidas de un vertex shader hacia un fragment shader. Como se mencionó
   anteriormente, un vertex shader genera posiciones que se utilizan para dibujar/rasterizar puntos,
   líneas y triángulos.

   Imaginemos que estamos dibujando una línea. Digamos que nuestro vertex shader se ejecutó
   dos veces: la primera vez generó el equivalente a `5,0` y la segunda vez
   el equivalente a `25,4`. Dados esos 2 puntos, la GPU dibujará una línea desde
   `5,0` hasta `25,4` (excluyente). Para hacer esto, llamará a nuestro fragment shader 20
   veces, una por cada uno de los píxeles de esa línea. Cada vez que llama a nuestro
   fragment shader, depende de nosotros decidir qué color devolver.

   Supongamos que tenemos un par de funciones que nos ayudan a dibujar una línea entre
   2 puntos. La primera función calcula cuántos píxeles necesitamos dibujar y algunos
   valores para ayudar a dibujarlos. La segunda toma esa información más un número de píxel
   y nos da una posición de píxel. Ejemplo:

   ```js
   const line = calcLine([10, 10], [13, 13]);
   for (let i = 0; i < line.numPixels; ++i) {
     const p = calcLinePoint(line, i);
     console.log(p);
   }
   // imprime
   // 10,10
   // 11,11
   // 12,12
   ```

   Nota: Cómo funcionan `calcLine` y `calcLinePoint` no es importante; lo que
   importa es que funcionan y permiten que el bucle anterior proporcione
   las posiciones de los píxeles para una línea. **Aunque si tienes curiosidad, consulta el ejemplo de
   código en vivo cerca de la parte inferior del artículo.**

   Entonces, cambiemos nuestro vertex shader para que devuelva 2 valores por iteración. Podríamos hacer eso de muchas maneras. Aquí hay una:

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;
   draw(count, vertexShader, bindings, attribsSpec);
   // imprime [[5, 0], [25, 4]]
   ```

   Ahora escribamos algo de código que recorra los puntos de 2 en 2 y
   llame a `rasterizeLines` para rasterizar una línea.

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for (let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
       const p0 = inputs[ndx    ];
       const p1 = inputs[ndx + 1];
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
         const offset = p[1] * destWidth + p[0];  // y * ancho + x
         dest[offset] = fragShaderFn(bindings);
       }
     }
   }
   ```

   Podemos actualizar `draw` para usar ese código así:

   ```js
   function draw(dest, destWidth,
                 count, vertexShaderFn, fragmentShaderFn,
                 bindings, attribsSpec,
   ) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
       const attribs = getAttribs(attribsSpec, i);
       internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
     rasterizeLines(dest, destWidth, internalBuffer,
                    fragmentShaderFn, bindings);
   }
   ```

   ¡Ahora realmente estamos usando `internalBuffer` 😃!

   Actualicemos el código que llama a `draw`:

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;

   const ancho = 30;
   const alto = 5;
   const pixels = new Array(ancho * alto).fill(0);
   const fragShader = (bindings) => 6;

   draw(
      pixels, ancho,
      count, vertexShader, fragShader,
      bindings, attribsSpec);
   ```

   Si imprimimos `pixels` como un rectángulo donde `0` se convierte en `.` obtendríamos esto:

   ```
   .....666......................
   ........66666.................
   .............66666............
   ..................66666.......
   .......................66.....
   ```

   Desafortunadamente, nuestro fragment shader no recibe ninguna entrada que cambie en cada iteración, por lo que
   no hay forma de devolver algo diferente para cada píxel. Aquí es donde
   entran en juego las variables entre etapas (inter-stage variables). Cambiemos nuestro primer shader para devolver un valor extra.

   ```js
   const buffer1 = [5, 0, 25, 4];
   const buffer2 = [9, 3];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
     {source: buffer2, offset: 0, stride: 1},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => 
       [[attribs[0], attribs[1]], [attribs[2]]];
   ```

   Si no cambiáramos nada más, después del bucle dentro de `draw`, `internalBuffer` tendría estos valores:

   ```js
    [ 
      [[ 5, 0], [9]],
      [[25, 4], [3]],
    ]
   ```

   Podemos calcular fácilmente un valor de 0.0 a 1.0 que represente qué tan avanzados
   estamos en la línea. Podemos usar esto para interpolar el valor extra que acabamos de
   añadir.

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for(let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
       const p0 = inputs[ndx    ][0];
       const p1 = inputs[ndx + 1][0];
       const v0 = inputs[ndx    ].slice(1);  // todo menos el primer valor
       const v1 = inputs[ndx + 1].slice(1);
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
         const t = i / line.numPixels;
         const interStageVariables = interpolateArrays(v0, v1, t);
         const offset = p[1] * destWidth + p[0];  // y * ancho + x
         dest[offset] = fragShaderFn(bindings, interStageVariables);
       }
     }
   }

   // interpolateArrays([[1,2]], [[3,4]], 0.25) => [[1.5, 2.5]]
   function interpolateArrays(v0, v1, t) {
     return v0.map((array0, ndx) => {
       const array1 = v1[ndx];
       return interpolateValues(array0, array1, t);
     });
   }

   // interpolateValues([1,2], [3,4], 0.25) => [1.5, 2.5]
   function interpolateValues(array0, array1, t) {
     return array0.map((a, ndx) => {
       const b = array1[ndx];
       return a + (b - a) * t;
     });
   }
   ```

   Ahora podemos usar esas variables entre etapas en nuestro fragment shader:

   ```js
   const fragShader = (bindings, interStageVariables) => 
       interStageVariables[0] | 0; // convierte a entero
   ```

   Si lo ejecutáramos ahora, veríamos resultados como este:

   ```
   .....988......................
   ........87776.................
   .............66655............
   ..................54443.......
   .......................33.....
   ```

   La primera iteración del vertex shader devolvió `[[5,0], [9]]` y
   la segunda iteración devolvió `[[25,4], [3]]` y puedes ver que,
   conforme se llamó al fragment shader, el segundo valor de cada uno de ellos
   se interpoló entre los dos valores.

   Podríamos crear otra función `mapTriangle` que, dados 3 puntos,
   rasterizara un triángulo llamando a la función del fragment shader para cada
   punto dentro del triángulo. Interpolaríamos las variables entre etapas
   a partir de 3 puntos en lugar de 2.

Aquí tienes todos los ejemplos anteriores ejecutándose en vivo, por si te resulta
útil jugar con ellos para entenderlos.

{{{example url="../webgpu-javascript-analogies.html"}}}

Lo que sucede en el código JavaScript anterior es una analogía. Los detalles
de cómo se interpolan realmente las variables entre etapas, cómo se dibujan las líneas, cómo
se accede a los buffers, cómo se muestrean las texturas, cómo se especifican los uniforms y atributos,
etc., son diferentes en WebGPU, pero los conceptos son muy similares, por lo que
espero que esta analogía en JavaScript haya servido de ayuda para obtener un modelo
mental de lo que está sucediendo.

¿Por qué es así? Bueno, si miras `draw` y `rasterizeLines`,
notarás que cada iteración es completamente independiente de
las demás iteraciones. Otra forma de decir esto es que podrías procesar
cada iteración en cualquier orden. En lugar de 0, 1, 2, 3, 4 podrías
procesarlas como 3, 1, 4, 0, 2 y obtendrías exactamente el mismo resultado.
El hecho de que sean independientes significa que cada iteración puede ser
ejecutada en paralelo por un procesador diferente. Las GPUs de gama alta modernas de 2021
tienen 10,000 o más procesadores. Eso significa que se pueden ejecutar hasta 10,000 cosas
en paralelo. De ahí proviene el poder de usar la GPU.
Al seguir estos patrones, el sistema puede paralelizar masivamente
el trabajo.

Las mayores limitaciones son:

1. Una función de shader solo puede referenciar
   sus entradas (atributos, buffers, texturas, uniforms, variables entre etapas).

2. Un shader no puede asignar memoria.

3. Un shader debe tener cuidado si referencia cosas en las que escribe, es decir, aquello para lo
   que está generando valores.

   Si lo piensas, esto tiene sentido. Imagina que `fragShader`
   intentara referenciar `dest` directamente. Eso significaría que, al
   tratar de paralelizar las cosas, sería imposible coordinarlas.
   ¿Qué iteración iría primero? Si la tercera iteración referenciara `dest[0]`,
   entonces la iteración 0 tendría que ejecutarse primero; pero si la iteración 0
   referenciara `dest[3]`, entonces la tercera iteración tendría que ejecutarse primero.

   Diseñar en torno a esta limitación también ocurre con las CPUs y los múltiples
   hilos o procesos, pero en el mundo de las GPUs, con hasta 10,000 procesadores funcionando
   a la vez, requiere una coordinación especial. Intentaremos cubrir algunas de estas
   técnicas en otros artículos.

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>
