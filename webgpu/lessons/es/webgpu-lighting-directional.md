Title: WebGPU - Iluminación direccional
Description: Cómo implementar la iluminación direccional en WebGPU
TOC: Iluminación direccional


Este artículo asume que has leído [el artículo sobre cámaras](webgpu-cameras.html).

Hay muchas formas de implementar la iluminación. Probablemente la más sencilla sea la *iluminación direccional*.

La iluminación direccional supone que la luz proviene uniformemente de una dirección. El sol en un día despejado suele considerarse una luz direccional. Está tan lejos que se puede considerar que sus rayos alcanzan la superficie de un objeto de forma paralela.

Calcular la iluminación direccional es en realidad bastante sencillo. Si sabemos en qué dirección viaja la luz y sabemos en qué dirección "mira" la superficie del objeto, podemos calcular el *producto escalar* (producto punto) de las 2 direcciones y nos dará el coseno del ángulo entre ambas.

Aquí tienes un ejemplo:

{{{diagram url="resources/dot-product.html" caption="arrastra los puntos" width="700" height="400"}}}

Arrastra los puntos; si los pones exactamente opuestos entre sí, verás que el producto escalar es -1. Si están exactamente en el mismo lugar, el producto escalar es 1.

¿Cómo es esto útil? Bueno, si sabemos en qué dirección mira la superficie de nuestro objeto 3D y conocemos la dirección en la que brilla la luz, podemos simplemente calcular su producto escalar y nos dará el número 1 si la luz apunta directamente a la superficie y -1 si apuntan en direcciones opuestas.

{{{diagram url="resources/directional-lighting.html" caption="rota la dirección" width="700" height="400"}}}

¡Podemos multiplicar nuestro color por ese valor del producto escalar y listo! ¡Luz!

Un problema: ¿cómo sabemos hacia qué dirección miran las superficies de nuestro objeto 3D?

## <a id="a-normals"></a> Introducción a las normales

No tengo idea de por qué se llaman *normales* (normals), pero al menos en gráficos 3D, una normal es la palabra para referirse a un vector unitario que describe la dirección hacia la que mira una superficie.

Aquí tienes algunas normales para un cubo y una esfera.

{{{diagram url="resources/normals.html" width="700" height="400"}}}

Las líneas que sobresalen de los objetos representan las normales de cada vértice.

Observa que el cubo tiene 3 normales en cada esquina. Eso es porque necesitas 3 normales diferentes para representar la dirección hacia la que mira cada cara del cubo.

Aquí las normales también están coloreadas según su dirección: el eje X positivo es <span style="color: red;">rojo</span>, el eje Y positivo (arriba) es <span style="color: green;">verde</span> y el eje Z positivo es <span style="color: blue;">azul</span>.

Así que, vamos a añadir normales a nuestra `F` de [nuestros ejemplos anteriores](webgpu-cameras.html) para poder iluminarla. Dado que la `F` es muy cuadrada y sus caras están alineadas con los ejes X, Y o Z, será bastante fácil. Las partes que miran hacia adelante tienen la normal `0, 0, 1` (Z positivo). Las que miran hacia atrás son `0, 0, -1` (Z negativo). Mirar a la izquierda es `-1, 0, 0` (X negativo), mirar a la derecha es `1, 0, 0` (X positivo). Arriba es `0, 1, 0` (Y positivo) y abajo es `0, -1, 0` (Y negativo).
De paso, eliminaremos los colores de los vértices, ya que dificultarán ver la iluminación.

```js
function createFVertices() {
  const positions = [
    // columna izquierda
     -50,  75,  15,
     -20,  75,  15,
     -50, -75,  15,
     -20, -75,  15,

    // travesaño superior
     -20,  75,  15,
      50,  75,  15,
     -20,  45,  15,
      50,  45,  15,

    // travesaño central
     -20,  15,  15,
      20,  15,  15,
     -20, -15,  15,
      20, -15,  15,

    // columna izquierda atrás
     -50,  75, -15,
     -20,  75, -15,
     -50, -75, -15,
     -20, -75, -15,

    // travesaño superior atrás
     -20,  75, -15,
      50,  75, -15,
     -20,  45, -15,
      50,  45, -15,

    // travesaño central atrás
     -20,  15, -15,
      20,  15, -15,
     -20, -15, -15,
      20, -15, -15,
  ];

  const indices = [
     0,  2,  1,    2,  3,  1,   // columna izquierda
     4,  6,  5,    6,  7,  5,   // travesaño superior
     8, 10,  9,   10, 11,  9,   // travesaño central

    12, 13, 14,   14, 13, 15,   // columna izquierda atrás
    16, 17, 18,   18, 17, 19,   // travesaño superior atrás
    20, 21, 22,   22, 21, 23,   // travesaño central atrás

     0,  5, 12,   12,  5, 17,   // parte superior
     5,  7, 17,   17,  7, 19,   // derecha del travesaño superior
     6, 18,  7,   18, 19,  7,   // parte inferior del travesaño superior
     6,  8, 18,   18,  8, 20,   // entre travesaño superior y central
     8,  9, 20,   20,  9, 21,   // parte superior del travesaño central
     9, 11, 21,   21, 11, 23,   // derecha del travesaño central
    10, 22, 11,   22, 23, 11,   // parte inferior del travesaño central
    10,  3, 22,   22,  3, 15,   // derecha del tallo
     2, 14,  3,   14, 15,  3,   // parte inferior
     0, 12,  2,   12, 14,  2,   // izquierda
  ];

-  const quadColors = [
-      200,  70, 120,  // frente de la columna izquierda
-      200,  70, 120,  // frente del travesaño superior
-      200,  70, 120,  // frente del travesaño central
-
-       80,  70, 200,  // atrás de la columna izquierda
-       80,  70, 200,  // atrás del travesaño superior
-       80,  70, 200,  // atrás del travesaño central
-
-       70, 200, 210,  // parte superior
-      160, 160, 220,  // derecha del travesaño superior
-       90, 130, 110,  // parte inferior del travesaño superior
-      200, 200,  70,  // entre travesaño superior y central
-      210, 100,  70,  // parte superior del travesaño central
-      210, 160,  70,  // derecha del travesaño central
-       70, 180, 210,  // parte inferior del travesaño central
-      100,  70, 210,  // derecha del tallo
-       76, 210, 100,  // parte inferior
-      140, 210,  80,  // izquierda
+  const normals = [
+        0,   0,   1,  // frente de la columna izquierda
+        0,   0,   1,  // frente del travesaño superior
+        0,   0,   1,  // frente del travesaño central
+
+        0,   0,  -1,  // atrás de la columna izquierda
+        0,   0,  -1,  // atrás del travesaño superior
+        0,   0,  -1,  // atrás del travesaño central
+
+        0,   1,   0,  // parte superior
+        1,   0,   0,  // derecha del travesaño superior
+        0,  -1,   0,  // parte inferior del travesaño superior
+        1,   0,   0,  // entre travesaño superior y central
+        0,   1,   0,  // parte superior del travesaño central
+        1,   0,   0,  // derecha del travesaño central
+        0,  -1,   0,  // parte inferior del travesaño central
+        1,   0,   0,  // derecha del tallo
+        0,  -1,   0,  // parte inferior
+       -1,   0,   0,  // izquierda
   ];

   const numVertices = indices.length;
-  const vertexData = new Float32Array(numVertices * 4); // xyz + color
   const vertexData = new Float32Array(numVertices * 6); // xyz + normal
-  const colorData = new Uint8Array(vertexData.buffer);

   for (let i = 0; i < indices.length; ++i) {
     const positionNdx = indices[i] * 3;
     const position = positions.slice(positionNdx, positionNdx + 3);
     vertexData.set(position, i * 6);

     const quadNdx = (i / 6 | 0) * 3;
-    const color = quadColors.slice(quadNdx, quadNdx + 3);
-    colorData.set(color, i * 16 + 12);
-    colorData[i * 16 + 15] = 255;
+    const normal = normals.slice(quadNdx, quadNdx + 3);
+    vertexData.set(normal, i * 6 + 3);
   }

   return {
     vertexData,
     numVertices,
   };
}
```

Necesitamos cambiar nuestro pipeline para usar estas normales en lugar de los colores.

```js
   const pipeline = device.createRenderPipeline({
     label: '2 attributes',
     layout: 'auto',
     vertex: {
       module,
       buffers: [
         {
-          arrayStride: (4) * 4, // (3) floats de 4 bytes cada uno + un color de 4 bytes
+          arrayStride: (3 + 3) * 4, // (3+3) floats de 4 bytes cada uno
           attributes: [
             {shaderLocation: 0, offset: 0, format: 'float32x3'},  // posición
-            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
+            {shaderLocation: 1, offset: 12, format: 'float32x3'},  // normal
           ],
         },
       ],
     },

     ...
```

Ahora necesitamos que nuestros shaders utilicen las normales.

En el vertex shader (shader de vértices), simplemente pasamos las normales al fragment shader (shader de fragmentos).

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  color: vec4f,
+  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
-  @location(1) color: vec4f,
+  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
-  vsOut.color = vert.color;
+  vsOut.normal = vert.normal;
  return vsOut;
}
```

En el fragment shader, realizaremos el cálculo utilizando el producto escalar de la dirección inversa de la luz y la normal.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  // Debido a que vsOut.normal es una variable entre etapas (inter-stage variable)
+  // está interpolada, por lo que no será un vector unitario.
+  // Normalizarla la convertirá de nuevo en un vector unitario.
+  let normal = normalize(vsOut.normal);
+
+  // Calcula la luz calculando el producto escalar
+  // de la normal por la dirección inversa de la luz
+  let light = dot(normal, -uni.lightDirection);
+
+  // Multipliquemos solo la porción de color (no el alfa)
+  // por la luz
+  let color = uni.color.rgb * light;
+  return vec4f(color, uni.color.a);
}
```

Necesitamos añadir espacio a nuestro uniform buffer para el color y la dirección de la luz, y crear vistas para configurarlos.

```js
-  // matriz
-  const uniformBufferSize = (16) * 4;
+  // matriz + color + dirección de la luz
+  const uniformBufferSize = (16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de los uniforms en índices float32
   const kMatrixOffset = 0;
+  const kColorOffset = 16;
+  const kLightDirectionOffset = 20;

   const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
+  const lightDirectionValue =
       uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

y necesitamos configurarlos

```js
   const settings = {
     rotation: degToRad(0),
   };

   ...

   function render() {
     ...


     const aspect = canvas.clientWidth / canvas.clientHeight;
     const projection = mat4.perspective(
         degToRad(60),
         aspect,
         1,      // zNear
         2000,   // zFar
     );

     const eye = [100, 150, 200];
     const target = [0, 35, 0];
     const up = [0, 1, 0];

     // Calcula una matriz de vista (view matrix)
     const viewMatrix = mat4.lookAt(eye, target, up);

     // combina las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);
+    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);
+
+    colorValue.set([0.2, 1, 0.2, 1]);  // verde
+    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));

-    // sube los valores de los uniforms al uniform buffer
-    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
+    // sube los valores de los uniforms al uniform buffer
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

Nuestra cámara/ojo está en z = 200 y mira hacia Z = 0. En otras palabras, mira en la dirección Z negativa.

`normalize`, que revisamos anteriormente, convertirá cualquier valor que pongamos allí en un vector unitario. Los valores específicos para la luz en el ejemplo son:
`x = -0.5`, que es `x` negativo, pero como estamos mirando en Z negativo significa que la luz está a la derecha apuntando a la izquierda.
`y = -0.7`, que es `y` negativo, significa que la luz está arriba apuntando hacia abajo, ya que abajo es negativo.
`z = -1`, que es `z` negativo, significa que la luz apunta en la misma dirección que nuestra cámara.
Los valores relativos significan que la dirección apunta principalmente hacia el interior de la escena y apunta más hacia abajo que hacia la derecha.

Y aquí está:

{{{example url="../webgpu-lighting-directional.html" }}}

Si giras la F, notarás algo. La F está rotando pero la iluminación no cambia. A medida que la F rota, queremos que la parte que mira en la dirección de la luz sea la más brillante.

Para solucionar esto, necesitamos reorientar las normales a medida que el objeto se reorienta. Al igual que hicimos con las posiciones, podemos multiplicar las normales por alguna matriz. La matriz más obvia sería la matriz de mundo (*world matrix*). Tal como está ahora, solo pasamos una matriz. Vamos a cambiarlo para pasar 2 matrices. Una llamada `world`, que será la matriz de mundo. Otra llamada `worldViewProjection`, que será lo que actualmente pasamos como `matrix`.

```wgsl
struct Uniforms {
-  matrix: mat4x4f,
+  world: mat4x4f,
+  worldViewProjection: mat4x4f,
   color: vec4f,
   lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;
-  vsOut.normal = vert.normal;

+  // Orienta las normales y pásalas al fragment shader
+  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;

   return vsOut;
}

...
```

Ten en cuenta que estamos pasando 0 para W cuando multiplicamos la normal por `uni.world`. Eso es porque las normales son una dirección, por lo que no nos importa la traslación. Al establecer `w` en 0, toda la traslación se multiplicará por cero[^matrix-math].

[^matrix-math]: consulta el artículo sobre [matemáticas de matrices](webgpu-matrix-math.html).

Necesitamos actualizar nuestro uniform buffer y las vistas de los valores.

```js
-  const uniformBufferSize = (16 + 4 + 4) * 4;
+  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de los uniforms en índices float32
-  const kMatrixOffset = 0;
-  const kColorOffset = 16;
-  const kLightDirectionOffset = 20;
+  const kWorldOffset = 0;
+  const kWorldViewProjectionOffset = 16;
+  const kColorOffset = 32;
+  const kLightDirectionOffset = 36;

-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const worldViewProjectionValue = uniformValues.subarray(
+      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const lightDirectionValue =
       uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

Y tenemos que cambiar el código que los actualiza:

```js
     // Calcula una matriz de vista
     const viewMatrix = mat4.lookAt(eye, target, up);

     // Combina las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);
+    // Calcula una matriz de mundo directamente en worldValue
+    mat4.rotationY(settings.rotation, worldValue);

+    // Combina las matrices viewProjection y world
+    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);

     colorValue.set([0.2, 1, 0.2, 1]);  // verde
     lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
```

y aquí está:

{{{example url="../webgpu-lighting-directional-world.html" }}}

Gira la F y observa que cualquier lado que mire hacia la dirección de la luz se ilumina.

Hay un problema que no sé cómo mostrar directamente, así que lo voy a mostrar en un diagrama. Estamos multiplicando la `normal` por la matriz `world` para reorientar las normales. ¿Qué sucede si escalamos la matriz de mundo? Resulta que obtenemos normales incorrectas.

{{{diagram url="resources/normals-scaled.html" caption="haz clic para alternar las normales" width="700" height="400" }}}

Nunca me he molestado en entender la solución, pero resulta que puedes obtener la inversa de la matriz de mundo, trasponerla (lo que significa intercambiar las columnas por las filas) y usar eso en su lugar, y obtendrás la respuesta correcta.

En el diagrama de arriba, la esfera <span style="color: #F0F;">púrpura</span> no está escalada. La esfera <span style="color: #F00;">roja</span> de la izquierda está escalada y las normales se multiplican por la matriz de mundo. Puedes ver que algo anda mal. La esfera <span style="color: #00F;">azul</span> de la derecha está utilizando la matriz inversa traspuesta del mundo (*world inverse transpose matrix*).

Haz clic en el diagrama para alternar entre diferentes representaciones. Deberías notar que cuando la escala es extrema, es muy fácil ver que las normales de la izquierda (mundo) **no** permanecen perpendiculares a la superficie de la esfera, mientras que las de la derecha (worldInverseTranspose) sí lo hacen. El último modo las sombrea todas de rojo. Verás que la iluminación en las 2 esferas exteriores es muy diferente según la matriz que se utilice. Es difícil saber cuál es la correcta, por eso este es un problema sutil, pero basándonos en las otras visualizaciones, está claro que usar la `worldInverseTranspose` es lo correcto.

Para implementar esto en nuestro ejemplo, cambiemos el código de esta manera. Primero, actualizaremos el shader. Técnicamente, podríamos simplemente actualizar el valor de `world`, pero es mejor si cambiamos el nombre de las cosas para que se llamen como realmente son; de lo contrario, será confuso. Podríamos llamarla `worldInverseTranspose`, pero es común llamarla `normalMatrix` y, dado que realmente solo nos importa cómo orienta la normal, solo necesitamos una matriz de 3x3.

```wgsl
struct Uniforms {
-  world: mat4x4f,
+  normalMatrix: mat3x3f,
   worldViewProjection: mat4x4f,
   color: vec4f,
   lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // Orienta las normales y pásalas al fragment shader
-  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;
+  vsOut.normal = uni.normalMatrix * vert.normal;

  return vsOut;
}
```

Debido a que estamos usando una matriz de 3x3, nuestro cálculo de la normal se volvió ligeramente más sencillo.

Y, por supuesto, necesitamos actualizar el JavaScript para la nueva forma de nuestros uniforms.

```js
-  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de los uniforms en índices float32
-  const kWorldOffset = 0;
-  const kWorldViewProjectionOffset = 16;
-  const kColorOffset = 32;
-  const kLightDirectionOffset = 36;
+  const kNormalMatrixOffset = 0;
+  const kWorldViewProjectionOffset = 12;
+  const kColorOffset = 28;
+  const kLightDirectionOffset = 32;

-  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const normalMatrixValue = uniformValues.subarray(
+      kNormalMatrixOffset, kNormalMatrixOffset + 12);
   const worldViewProjectionValue = uniformValues.subarray(
       kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const lightDirectionValue =
       uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

Antes de poder calcular nuestra matriz normal, necesitamos una función para trasponer una matriz:

```js
const mat4 = {
  ....
  transpose(m, dst) {
    dst = dst || new Float32Array(16);

    dst[ 0] = m[ 0];  dst[ 1] = m[ 4];  dst[ 2] = m[ 8];  dst[ 3] = m[12];
    dst[ 4] = m[ 1];  dst[ 5] = m[ 5];  dst[ 6] = m[ 9];  dst[ 7] = m[13];
    dst[ 8] = m[ 2];  dst[ 9] = m[ 6];  dst[10] = m[10];  dst[11] = m[14];
    dst[12] = m[ 3];  dst[13] = m[ 7];  dst[14] = m[11];  dst[15] = m[15];

    return dst;
  },
  ...
```

Y necesitamos una función para obtener una matriz de 3x3 a partir de una de 4x4:

```js
const mat3 = {
  fromMat4(m, dst) {
    dst = dst || new Float32Array(12);

    dst[0] = m[0]; dst[1] = m[1];  dst[ 2] = m[ 2];
    dst[4] = m[4]; dst[5] = m[5];  dst[ 6] = m[ 6];
    dst[8] = m[8]; dst[9] = m[9];  dst[10] = m[10];

    return dst;
  },
};

```

Ten en cuenta que una matriz de 3x3 en WebGPU tiene cada columna rellena (*padded*). Cubrimos esto en [el artículo sobre el diseño de memoria](webgpu-memory-layout.html).

Ahora que tenemos estas 2 funciones, podemos calcular y establecer la matriz normal.

```js
     // Calcula una matriz de vista
     const viewMatrix = mat4.lookAt(eye, target, up);

     // Combina las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    // Calcula una matriz de mundo directamente en worldValue
-    mat4.rotationY(settings.rotation, worldValue);
-
-    // Combina las matrices viewProjection y world
-    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);
+    // Calcula una matriz de mundo
+    const world = mat4.rotationY(settings.rotation);
+
+    // Combina las matrices viewProjection y world
+    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);
+
+    // Inviértela y traspónla en el valor normalMatrix
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

Debido a que el efecto es sutil y a que no estamos escalando nada, no hay una diferencia notable, pero al menos ahora estamos preparados.

{{{example url="../webgpu-lighting-directional-worldinversetranspose.html" }}}

Espero que este primer paso en la iluminación haya sido claro. A continuación, [iluminación puntual (point lighting)](webgpu-lighting-point.html).
