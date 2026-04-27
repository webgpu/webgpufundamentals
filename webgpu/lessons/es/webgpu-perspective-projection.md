Title: Proyección en perspectiva en WebGPU
Description: Proyección en perspectiva - más pequeño en la distancia
TOC: Proyección en perspectiva

Este artículo es el sexto de una serie que esperamos que te enseñe sobre matemáticas 3D. Cada uno se basa en la lección anterior, por lo que es posible que te resulten más fáciles de entender leyéndolos en orden.

1. [Traslación](webgpu-translation.html)
2. [Rotación](webgpu-rotation.html)
3. [Escalado](webgpu-scale.html)
4. [Matemáticas de matrices](webgpu-matrix-math.html)
5. [Proyección ortográfica](webgpu-orthographic-projection.html)
6. [Proyección en perspectiva](webgpu-perspective-projection.html) ⬅ estás aquí
7. [Cámaras](webgpu-cameras.html)
8. [Pilas de matrices](webgpu-matrix-stacks.html)
9. [Grafos de escena](webgpu-scene-graphs.html)

En la última publicación repasamos cómo hacer 3D, pero ese 3D no tenía ninguna perspectiva. Estaba usando lo que se llama una vista "ortográfica", que tiene sus usos, pero generalmente no es lo que la gente quiere cuando dice "3D".

En su lugar, necesitamos añadir perspectiva. ¿Qué es exactamente la perspectiva? Básicamente es la característica de que las cosas que están más lejos parecen más pequeñas.

<img class="webgpu_center noinvertdark" style="width: 800px" src="resources/perspective-example.svg" />

Mirando el ejemplo de arriba vemos que las cosas más alejadas se dibujan más pequeñas. Dado nuestro ejemplo actual, una forma fácil de hacer que las cosas que están más lejos parezcan más pequeñas sería dividir las coordenadas X e Y del espacio de recorte (clip space) por Z.

Piénsalo de esta manera: Si tienes una línea de (10, 15) a (20, 15), mide 10 unidades de largo. En nuestro ejemplo actual se dibujaría con 10 píxeles de largo. Pero si dividimos por Z, entonces, por ejemplo, si Z es 1:

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 1 = 10
20 / 1 = 20
abs(10-20) = 10
</pre>
</div>

tendría 10 píxeles de largo. Si Z es 2, sería:

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 2 = 5
20 / 2 = 10
abs(5 - 10) = 5
</pre>
</div>

tendría 5 píxeles de largo. Con Z = 3 sería:

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 3 = 3.333
20 / 3 = 6.666
abs(3.333 - 6.666) = 3.333
</pre>
</div>

Puedes ver que a medida que Z aumenta, a medida que se aleja, terminaremos dibujándolo más pequeño y, por lo tanto, parecerá que está más lejos. Si dividimos en el espacio de recorte podríamos obtener mejores resultados porque Z será un número pequeño (0 a +1). Si añadimos un `fudgeFactor` para multiplicar Z antes de dividir, podemos ajustar qué tan pequeñas se vuelven las cosas para una distancia dada.

Intentémoslo. Primero, cambiemos el vertex shader (shader de vértices) para dividir por Z después de haberlo multiplicado por nuestro "fudgeFactor".

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  fudgeFactor: f32,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = uni.matrix * vert.position;
+  let position = uni.matrix * vert.position;
+
+  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
+
+  vsOut.position = vec4f(
+      position.xy / zToDivideBy,
+      position.zw);

  vsOut.color = vert.color;
  return vsOut;
}
```

Nota: Al sumar 1 podemos establecer `fudgeFactor` a 0 y obtener un `zToDivideBy` igual a 1. Esto nos permitirá comparar cuando no estemos dividiendo por Z, ya que dividir por 1 no hace nada.

También necesitamos actualizar el código para permitirnos establecer el `fudgeFactor`.

```js
-  // matriz
-  const uniformBufferSize = (16) * 4;
+  // matriz, fudgeFactor, padding
+  const uniformBufferSize = (16 + 1 + 3) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de uniform en índices float32
   const kMatrixOffset = 0;
+  const kFudgeFactorOffset = 16;

   const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const fudgeFactorValue = uniformValues.subarray(kFudgeFactorOffset, kFudgeFactorOffset + 1);

...

   const settings = {
     translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
     rotation: [degToRad(40), degToRad(25), degToRad(325)],
     scale: [3, 3, 3],
+    fudgeFactor: 0.5,
   };

...

   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings.translation, '0', 0, 1000).name('translation.x');
   gui.add(settings.translation, '1', 0, 1000).name('translation.y');
   gui.add(settings.translation, '2', -1000, 1000).name('translation.z');
   gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
   gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
   gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
   gui.add(settings.scale, '0', -5, 5).name('scale.x');
   gui.add(settings.scale, '1', -5, 5).name('scale.y');
   gui.add(settings.scale, '2', -5, 5).name('scale.z');
+  gui.add(settings, 'fudgeFactor', 0, 50);

...

   function render() {

     ...

     mat4.ortho(
         0,                   // izquierda
         canvas.clientWidth,  // derecha
         canvas.clientHeight, // abajo
         0,                   // arriba
         1200,                // cerca
         -1000,               // lejos
         matrixValue,         // destino
     );
     mat4.translate(matrixValue, settings.translation, matrixValue);
     mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
     mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
     mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
     mat4.scale(matrixValue, settings.scale, matrixValue);

+    fudgeFactorValue[0] = settings.fudgeFactor;
```

También ajusté los `settings` para que, con suerte, sea fácil ver los resultados.

```js
   const settings = {
-    translation: [45, 100, 0],
+    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
     rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
+    scale: [3, 3, 3],
     fudgeFactor: 10,
   };
```

Y aquí está el resultado.

{{{example url="../webgpu-perspective-projection-step-1-fudge-factor.html" }}}

Si no está claro, mueve el deslizador de "fudgeFactor" de 10.0 a 0.0 para ver cómo se veían las cosas antes de añadir nuestro código de dividir por Z.

<img class="webgpu_center" src="resources/orthographic-vs-perspective.png" />
<div class="webgpu_center">ortográfica vs perspectiva</div>

Resulta que WebGPU toma el valor x, y, z, w que asignamos a `@builtin(position)` en nuestro vertex shader y lo divide por w automáticamente.

Podemos demostrar esto muy fácilmente cambiando el shader y, en lugar de hacer la división nosotros mismos, poner `zToDivideBy` en `vsOut.position.w`.

```wgsl
@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  let position = uni.matrix * vert.position;

  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;

-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
+  vsOut.position = vec4f(position.xyz, zToDivideBy);

  vsOut.color = vert.color;
  return vsOut;
}
```

y verás que es exactamente lo mismo.

{{{example url="../webgpu-perspective-projection-step-2-gpu-divide-by-w.html" }}}

¿Por qué es útil el hecho de que WebGPU divida automáticamente por W? Porque ahora, usando más magia de matrices, podemos simplemente usar otra matriz para copiar z a w.

Una matriz como esta:

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  0
</pre></div>

copiará z a w. Puedes ver cada una de esas filas como:

<div class="webgpu_math_center"><pre class="webgpu_math">{{#escapehtml}}
x_out = x_in * 1 +
        y_in * 0 +
        z_in * 0 +
        w_in * 0 ;
 
y_out = x_in * 0 +
        y_in * 1 +
        z_in * 0 +
        w_in * 0 ;
 
z_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;
 
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 0 ;
{{/escapehtml}}</pre></div>


que simplificado es:

<div class="webgpu_math_center"><pre class="webgpu_math">
x_out = x_in;
y_out = y_in;
z_out = z_in;
w_out = z_in;
</pre></div>

Podemos añadir el más 1 que teníamos antes con esta matriz, ya que sabemos que `w_in` siempre es 1.0.

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  1
</pre></div>

eso cambiará el cálculo de W a:

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 1 ;
</pre></div>

y como sabemos que `w_in` = 1.0, entonces es realmente:

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in + 1;
</pre></div>

Finalmente, podemos volver a incorporar nuestro `fudgeFactor` si la matriz es esta:

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0            0
0  1  0            0
0  0  1            0
0  0  fudgeFactor  1
</pre></div>

lo que significa:

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * fudgeFactor +
        w_in * 1 ;
</pre></div>

y simplificado es:

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in * fudgeFactor + 1;
</pre></div>

Entonces, modifiquemos el programa de nuevo para usar solo matrices.

Primero, pongamos el vertex shader como estaba para que sea simple otra vez.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
-  fudgeFactor: f32,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
-  let position = uni.matrix * vert.position;
-
-  let zToDivideBy = 1.0 + position.z * uni.fudgeFactor;
-
-  vsOut.position = vec4f(
-      position.xy / zToDivideBy,
-      position.zw);
  vsOut.position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

A continuación, hagamos una función para crear una matriz Z &rarr; W.

```js
function makeZToWMatrix(fudgeFactor) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, fudgeFactor,
    0, 0, 0, 1,
  ];
}
```

y cambiaremos el código para usarla.

```js
-    mat4.ortho(
+    const projection = mat4.ortho(
         0,                   // izquierda
         canvas.clientWidth,  // derecha
         canvas.clientHeight, // abajo
         0,                   // arriba
         1200,                // cerca
         -1000,               // lejos
-        matrixValue,         // destino
     );
+    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
     mat4.translate(matrixValue, settings.translation, matrixValue);
     mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
     mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
     mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
     mat4.scale(matrixValue, settings.scale, matrixValue);
```

y nota, de nuevo, que es exactamente lo mismo.

{{{example url="../webgpu-perspective-projection-step-3-perspective-z-to-w.html" }}}

Todo eso fue básicamente para mostrarte que dividir por Z nos da perspectiva y que WebGPU convenientemente hace esta división por W por nosotros.

Pero todavía hay algunos problemas. Por ejemplo, si estableces Z alrededor de -1100 verás algo como la animación de abajo:

<div class="webgpu_center"><div data-diagram="z-clipping" style="height: 400px;"></div></div>

¿Qué está pasando? ¿Por qué la F desaparece antes de tiempo? Al igual que WebGPU recorta X e Y de +1 a -1, también recorta Z. A diferencia de X e Y, Z se recorta de 0 a +1. Lo que estamos viendo aquí es Z < 0 en el espacio de recorte.

<div class="webgpu_center" style="width: 500px; height: 400px;"><div data-diagram="f-frustum-diagram"></div></div>

Con la división por W en su lugar, nuestras matemáticas de matrices + la división por W definen un *frustum* (tronco de pirámide). La parte frontal del frustum es Z = 0, la parte posterior es Z = 1. Cualquier cosa fuera de eso se recorta.

<blockquote>
<h2>frustum</h2>
<p><i>sustantivo</i>:</p>
<ol><li>un cono o pirámide con la parte superior cortada por un plano paralelo a su base</li></ol>
</blockquote>

Podría entrar en detalles sobre las matemáticas para arreglarlo, pero [puedes derivarlo](https://stackoverflow.com/a/28301213/128511) de la misma manera que hicimos la proyección 2D. Necesitamos tomar Z, añadir una cantidad (traslación) y escalar una cantidad, y podemos hacer que cualquier rango que queramos se remapee de 0 a +1.

Lo genial es que todos estos pasos se pueden hacer en una sola matriz. Mejor aún, en lugar de un `fudgeFactor` decidiremos un `fieldOfView` (campo de visión) y calcularemos los valores correctos para que eso ocurra.

Aquí hay una función para construir la matriz.

```js
const mat4 = {
  ...
  perspective(fieldOfViewYInRadians, aspect, zNear, zFar, dst) {
    dst = dst || new Float32Array(16);

    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
    const rangeInv = 1 / (zNear - zFar);

    dst[0] = f / aspect;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;

    dst[4] = 0;
    dst[5] = f;
    dst[6] = 0;
    dst[7] = 0;

    dst[8] = 0;
    dst[9] = 0;
    dst[10] = zFar * rangeInv;
    dst[11] = -1;

    dst[12] = 0;
    dst[13] = 0;
    dst[14] = zNear * zFar * rangeInv;
    dst[15] = 0;

    return dst;
  }
```

Esta matriz hará todas nuestras conversiones por nosotros. Ajustará las unidades para que estén en el espacio de recorte, hará las matemáticas para que podamos elegir un campo de visión por ángulo y nos permitirá elegir nuestro espacio de recorte en Z. Supone que hay un *ojo* o *cámara* en el origen (0, 0, 0) y, dados un `zNear` y un `fieldOfView`, calcula lo que haría falta para que las cosas en `zNear` terminen en `Z = 0` y las cosas en `zNear` que están a la mitad del `fieldOfView` por encima o por debajo del centro terminen con `Y = -1` e `Y = 1` respectivamente. Calcula qué usar para X simplemente multiplicando por el `aspect` (relación de aspecto) pasado. Normalmente estableceríamos esto como el `ancho / alto` del área de visualización. Finalmente, calcula cuánto escalar las cosas en Z para que lo que esté en `zFar` termine en `Z = 1`.

Aquí hay un diagrama de la matriz en acción.

<div class="webgpu_center" style="width: 500px; height: 800px;"><div data-diagram="frustum-diagram"></div></div>

La matriz toma el espacio dentro del frustum y lo convierte al espacio de recorte. `zNear` define dónde se recortarán las cosas por delante y `zFar` define dónde se recortarán por detrás. Si estableces `zNear` a 23, verás que la parte frontal de los cubos giratorios se recorta. Si estableces `zFar` a 24, verás que la parte posterior de los cubos se recorta.

Usemos esta función en nuestro ejemplo.

```js
   const settings = {
     fieldOfView: degToRad(100),
     translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
     rotation: [degToRad(40), degToRad(25), degToRad(325)],
     scale: [3, 3, 3],
-    fudgeFactor: 10,
   };

   const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
   gui.add(settings.translation, '0', 0, 1000).name('translation.x');
   gui.add(settings.translation, '1', 0, 1000).name('translation.y');
   gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
   gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
   gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
   gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
   gui.add(settings.scale, '0', -5, 5).name('scale.x');
   gui.add(settings.scale, '1', -5, 5).name('scale.y');
   gui.add(settings.scale, '2', -5, 5).name('scale.z');
-  gui.add(settings, 'fudgeFactor', 0, 50);

   ...

   function render() {
     ....

-    const projection = mat4.ortho(
-        0,                   // izquierda
-        canvas.clientWidth,  // derecha
-        canvas.clientHeight, // abajo
-        0,                   // arriba
-        1200,                // cerca
-        -1000,               // lejos
-    );
-    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
+    const aspect = canvas.clientWidth / canvas.clientHeight;
+    mat4.perspective(
+        settings.fieldOfView,
+        aspect,
+        1,      // zNear
+        2000,   // zFar
+        matrixValue,
+    );
     mat4.translate(matrixValue, settings.translation, matrixValue);
     mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
     mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
     mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
     mat4.scale(matrixValue, settings.scale, matrixValue);
```

Solo queda un problema. Esta matriz de proyección supone que hay un espectador en 0,0,0 y supone que está mirando en la dirección Z negativa y que el eje Y positivo es hacia arriba. Nuestras matrices hasta este punto han hecho las cosas de una manera diferente. Necesitamos poner la F, que mide 150 unidades de alto, 100 unidades de ancho y 30 unidades de grosor, en alguna posición -Z y debe estar lo suficientemente lejos como para que quepa dentro del frustum. El frustum que hemos definido arriba, con `zNear` = 1, solo mostrará unas 2.4 unidades de arriba a abajo cuando un objeto esté a 1 unidad de distancia, por lo que nuestra F estará un 98% fuera de la pantalla.

Jugando con algunos números llegué a estos ajustes.

```js
   const settings = {
     fieldOfView: degToRad(100),
-    translation: [canvas.clientWidth / 2 - 200, canvas.clientHeight / 2 - 75, -1000],
-    rotation: [degToRad(40), degToRad(25), degToRad(325)],
-    scale: [3, 3, 3],
+    translation: [-65, 0, -120],
+    rotation: [degToRad(220), degToRad(25), degToRad(325)],
+    scale: [1, 1, 1],
   };
```

Y, ya que estamos, ajustemos la configuración de la interfaz de usuario (UI) para que sea más apropiada. También eliminemos el escalado para despejar un poco la interfaz.


```js
   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
-  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
-  gui.add(settings.translation, '2', -1400, 1000).name('translation.z');
+  gui.add(settings.translation, '0', -1000, 1000).name('translation.x');
+  gui.add(settings.translation, '1', -1000, 1000).name('translation.y');
+  gui.add(settings.translation, '2', -1400, -100).name('translation.z');
   gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
   gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
   gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');
-  gui.add(settings.scale, '0', -5, 5).name('scale.x');
-  gui.add(settings.scale, '1', -5, 5).name('scale.y');
-  gui.add(settings.scale, '2', -5, 5).name('scale.z');
```

Deshagámonos también de la cuadrícula, ya que ya no estamos en el "espacio de píxeles".

```css
:root {
  --bg-color: #fff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #000;
  }
}
canvas {
  display: block;  /* hacer que el canvas se comporte como un bloque   */
  width: 100%;     /* hacer que el canvas llene su contenedor */
  height: 100%;
}
```

Y aquí está.

{{{example url="../webgpu-perspective-projection-step-4-perspective.html" }}}

Hemos vuelto a tener solo una multiplicación de matrices en nuestro shader y estamos obteniendo tanto un campo de visión como la capacidad de elegir nuestro espacio Z.

A continuación, [cámaras](webgpu-cameras.html).

<div class="webgpu_bottombar">
<h3>¿Por qué movimos la F tan lejos en Z (-120)?</h3>
<p>
En los otros ejemplos teníamos la F en (45, 100, 0), pero en el último ejemplo se ha movido a (-65, 0, -120). ¿Por qué tuvo que moverse tan lejos?
</p>
<p>
La razón es que, hasta este último ejemplo, nuestra función <code>mat4.ortho</code> (que antes llamábamos <code>mat4.projection</code>) hacía una proyección de píxeles a espacio de recorte. Eso significa que el área que mostrábamos representaba, en cierta medida, píxeles. Usar "píxeles" realmente no tiene sentido en 3D, ya que solo representarían píxeles a una distancia específica de la cámara.
</p>
<p>
En otras palabras, con nuestra nueva matriz de proyección en perspectiva, si intentáramos dibujar la F con traslación en 0,0,0 y rotación 0,0,0 obtendríamos esto:
</p>
<div class="webgpu_center"><img src="resources/f-big-and-wrong-side.svg" style="width: 500px;"></div>
<p>
La F tiene su esquina frontal superior izquierda en el origen. La matriz de proyección en perspectiva mira hacia Z negativo, pero nuestra F está construida en Z positivo. La matriz de proyección en perspectiva tiene Y positivo hacia arriba, pero nuestra F está construida con Y positivo hacia abajo.
</p>
<p>
Nuestra nueva proyección solo ve lo que está dentro del frustum azul. Con zNear = 1 y con un campo de visión de 100 grados, entonces en Z = -1 el frustum solo tiene 2.38 unidades de alto y 2.38 * aspect unidades de ancho. En Z = -2000 (zFar) tiene 4767 unidades de alto. Dado que nuestra F mide 150 unidades y la vista solo puede ver 2.38 unidades cuando algo está en <code>zNear</code>, necesitamos moverla más lejos del origen para verla completa.
</p>
<p>
Moverla -120 unidades en Z sitúa la F dentro del frustum. También la rotamos para que estuviera en la posición correcta.
</p>
<div class="webgpu_center"><img src="resources/f-right-side.svg" style="width: 500px;"><div>no está a escala</div></div>
</div>



<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-perspective-projection.js"></script>
