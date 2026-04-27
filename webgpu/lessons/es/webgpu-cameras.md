Title: Cámaras en WebGPU
Description: Cámaras mediante matrices
TOC: Cámaras

Este artículo es el séptimo de una serie que esperamos que te enseñe sobre matemáticas 3D. Cada uno se basa en la lección anterior, por lo que es posible que te resulten más fáciles de entender leyéndolos en orden.

1. [Traslación](webgpu-translation.html)
2. [Rotación](webgpu-rotation.html)
3. [Escalado](webgpu-scale.html)
4. [Matemáticas de matrices](webgpu-matrix-math.html)
5. [Proyección ortográfica](webgpu-orthographic-projection.html)
6. [Proyección en perspectiva](webgpu-perspective-projection.html)
7. [Cámaras](webgpu-cameras.html) ⬅ estás aquí
8. [Pilas de matrices](webgpu-matrix-stacks.html)
9. [Grafos de escena](webgpu-scene-graphs.html)

En la última publicación tuvimos que mover la F frente al frustum (tronco de pirámide) porque la función `mat4.perspective` coloca el ojo en el origen (0, 0, 0) y los objetos en el frustum están entre `-zNear` y `-zFar` frente a él. Esto significa que cualquier cosa que queramos que aparezca debe colocarse en este espacio.

En el mundo real, normalmente mueves la cámara para tomar una foto de algún objeto.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-camera"></div>
   <div class="caption">moviendo la cámara hacia los objetos</div>
</div>

Pero, en nuestra última publicación, creamos una matriz de proyección que requiere que las cosas estén frente al origen en el eje -Z. Para lograr esto, lo que queremos hacer es mover la cámara al origen y mover todo lo demás la cantidad correcta para que siga en el mismo lugar *relativo a la cámara*.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="move-world"></div>
   <div class="caption">moviendo los objetos hacia la vista</div>
</div>

Efectivamente, necesitamos mover el mundo frente a la cámara. La forma más fácil de hacer esto es usar una matriz "inversa". Las matemáticas para calcular una matriz inversa en el caso general son complejas, pero conceptualmente es fácil. La inversa es el valor que usarías para negar algún otro valor. Por ejemplo, la inversa de una matriz que traslada en X por 123 es una matriz que traslada en X por -123. La inversa de una matriz que escala por 5 es una matriz que escala por 1/5 o 0.2. La inversa de una matriz que rota 30&deg; alrededor del eje X sería una que rota -30&deg; alrededor del eje X.

Hasta este punto, hemos usado traslación, rotación y escalado para afectar la posición y orientación de nuestra 'F'. Después de multiplicar todas las matrices, tenemos una sola matriz que representa cómo mover la 'F' desde el origen hasta el lugar, tamaño y orientación que queremos. Podemos hacer lo mismo para una cámara. Una vez que tengamos la matriz que nos dice cómo mover y rotar la cámara desde el origen hasta donde queramos, podemos calcular su inversa, lo que nos dará una matriz que nos dirá cómo mover y rotar todo lo demás la cantidad opuesta, lo que efectivamente hará que la cámara esté en (0, 0, 0) y hayamos movido todo frente a ella.

Hagamos una escena 3D con un círculo de 'F's como en los diagramas de arriba.

Lo primero es ajustar nuestros datos de vértices de la F. Originalmente empezamos en 2D con píxeles. La esquina superior izquierda de la F está en 0,0 y se extiende 100 píxeles a la derecha y 150 píxeles hacia abajo. Los "píxeles" probablemente no tengan sentido como unidad en 3D y la matriz de proyección en perspectiva que hicimos usa Y positivo hacia arriba, así que giremos nuestra F para que Y positivo sea hacia arriba y centrémosla alrededor del origen.

```js
   const positions = [
-    // columna izquierda
-    0, 0, 0,
-    30, 0, 0,
-    0, 150, 0,
-    30, 150, 0,
-
-    // travesaño superior
-    30, 0, 0,
-    100, 0, 0,
-    30, 30, 0,
-    100, 30, 0,
-
-    // travesaño central
-    30, 60, 0,
-    70, 60, 0,
-    30, 90, 0,
-    70, 90, 0,
-
-    // columna izquierda posterior
-    0, 0, 30,
-    30, 0, 30,
-    0, 150, 30,
-    30, 150, 30,
-
-    // travesaño superior posterior
-    30, 0, 30,
-    100, 0, 30,
-    30, 30, 30,
-    100, 30, 30,
-
-    // travesaño central posterior
-    30, 60, 30,
-    70, 60, 30,
-    30, 90, 30,
-    70, 90, 30,
+    // columna izquierda
+     -50,  75,  15,
+     -20,  75,  15,
+     -50, -75,  15,
+     -20, -75,  15,
+
+    // travesaño superior
+     -20,  75,  15,
+      50,  75,  15,
+     -20,  45,  15,
+      50,  45,  15,
+
+    // travesaño central
+     -20,  15,  15,
+      20,  15,  15,
+     -20, -15,  15,
+      20, -15,  15,
+
+    // columna izquierda posterior
+     -50,  75, -15,
+     -20,  75, -15,
+     -50, -75, -15,
+     -20, -75, -15,
+
+    // travesaño superior posterior
+     -20,  75, -15,
+      50,  75, -15,
+     -20,  45, -15,
+      50,  45, -15,
+
+    // travesaño central posterior
+     -20,  15, -15,
+      20,  15, -15,
+     -20, -15, -15,
+      20, -15, -15,
   ];
```

Además, como vimos en [el artículo anterior](webgpu-perspective-projection.html), debido a que estábamos usando Y positivo = abajo para coincidir con la mayoría de las librerías de píxeles 2D, el orden de los vértices de nuestros triángulos estaba al revés para el 3D normal y terminamos descartando (culling) los triángulos que miraban hacia adelante (`'front'`) en lugar de los normales que miran hacia atrás (`'back'`), ya que estábamos escalando Y por -1. Ahora que estamos haciendo 3D *normal* con Y positivo = arriba, cambiemos el orden de los vértices para que los triángulos en sentido horario miren hacia afuera.

```js
   const indices = [
-     0,  1,  2,    2,  1,  3,  // columna izquierda
-     4,  5,  6,    6,  5,  7,  // travesaño superior
-     8,  9, 10,   10,  9, 11,  // travesaño central
-
-    12, 14, 13,   14, 15, 13,  // columna izquierda posterior
-    16, 18, 17,   18, 19, 17,  // travesaño superior posterior
-    20, 22, 21,   22, 23, 21,  // travesaño central posterior
-
-     0, 12,  5,   12, 17,  5,   // parte superior
-     5, 17,  7,   17, 19,  7,   // lateral derecho travesaño superior
-     6,  7, 18,   18,  7, 19,   // parte inferior travesaño superior
-     6, 18,  8,   18, 20,  8,   // entre travesaño superior y central
-     8, 20,  9,   20, 21,  9,   // parte superior travesaño central
-     9, 21, 11,   21, 23, 11,   // lateral derecho travesaño central
-    10, 11, 22,   22, 11, 23,   // parte inferior travesaño central
-    10, 22,  3,   22, 15,  3,   // lateral derecho del tallo
-     2,  3, 14,   14,  3, 15,   // parte inferior
-     0,  2, 12,   12,  2, 14,   // lateral izquierdo
+     0,  2,  1,    2,  3,  1,   // columna izquierda
+     4,  6,  5,    6,  7,  5,   // travesaño superior
+     8, 10,  9,   10, 11,  9,   // travesaño central
+
+    12, 13, 14,   14, 13, 15,   // columna izquierda posterior
+    16, 17, 18,   18, 17, 19,   // travesaño superior posterior
+    20, 21, 22,   22, 21, 23,   // travesaño central posterior
+
+     0,  5, 12,   12,  5, 17,   // parte superior
+     5,  7, 17,   17,  7, 19,   // lateral derecho travesaño superior
+     6, 18,  7,   18, 19,  7,   // parte inferior travesaño superior
+     6,  8, 18,   18,  8, 20,   // entre travesaño superior y central
+     8,  9, 20,   20,  9, 21,   // parte superior travesaño central
+     9, 11, 21,   21, 11, 23,   // lateral derecho travesaño central
+    10, 22, 11,   22, 23, 11,   // parte inferior travesaño central
+    10,  3, 22,   22,  3, 15,   // lateral derecho del tallo
+     2, 14,  3,   14, 15,  3,   // parte inferior
+     0, 12,  2,   12, 14,  2,   // lateral izquierdo
   ];
```

Finalmente, configuremos el `cullMode` para descartar los triángulos que miran hacia atrás (`back facing`).

```js
   const pipeline = device.createRenderPipeline({
     label: '2 attributes',
     layout: 'auto',
     vertex: {
       module,
       buffers: [
         {
           arrayStride: (4) * 4, // (3) floats de 4 bytes cada uno + un color de 4 bytes
           attributes: [
             {shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
             {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
           ],
         },
       ],
     },
     fragment: {
       module,
       targets: [{ format: presentationFormat }],
     },
     primitive: {
-      cullMode: 'front',  // nota: ajuste poco común. Ver artículo
+      cullMode: 'back',
     },
     depthStencil: {
       depthWriteEnabled: true,
       depthCompare: 'less',
       format: 'depth24plus',
     },
   });
```

Aquí hay una función que, dada una matriz, calculará su matriz inversa.

```js
const mat4 = {
  ...

+  inverse(m, dst) {
+    dst = dst || new Float32Array(16);
+
+    const m00 = m[0 * 4 + 0];
+    const m01 = m[0 * 4 + 1];
+    const m02 = m[0 * 4 + 2];
+    const m03 = m[0 * 4 + 3];
+    const m10 = m[1 * 4 + 0];
+    const m11 = m[1 * 4 + 1];
+    const m12 = m[1 * 4 + 2];
+    const m13 = m[1 * 4 + 3];
+    const m20 = m[2 * 4 + 0];
+    const m21 = m[2 * 4 + 1];
+    const m22 = m[2 * 4 + 2];
+    const m23 = m[2 * 4 + 3];
+    const m30 = m[3 * 4 + 0];
+    const m31 = m[3 * 4 + 1];
+    const m32 = m[3 * 4 + 2];
+    const m33 = m[3 * 4 + 3];
+
+    const tmp0 = m22 * m33;
+    const tmp1 = m32 * m23;
+    const tmp2 = m12 * m33;
+    const tmp3 = m32 * m13;
+    const tmp4 = m12 * m23;
+    const tmp5 = m22 * m13;
+    const tmp6 = m02 * m33;
+    const tmp7 = m32 * m03;
+    const tmp8 = m02 * m23;
+    const tmp9 = m22 * m03;
+    const tmp10 = m02 * m13;
+    const tmp11 = m12 * m03;
+    const tmp12 = m20 * m31;
+    const tmp13 = m30 * m21;
+    const tmp14 = m10 * m31;
+    const tmp15 = m30 * m11;
+    const tmp16 = m10 * m21;
+    const tmp17 = m20 * m11;
+    const tmp18 = m00 * m31;
+    const tmp19 = m30 * m01;
+    const tmp20 = m00 * m21;
+    const tmp21 = m20 * m01;
+    const tmp22 = m00 * m11;
+    const tmp23 = m10 * m01;
+
+    const t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) -
+               (tmp1 * m11 + tmp2 * m21 + tmp5 * m31);
+    const t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) -
+               (tmp0 * m01 + tmp7 * m21 + tmp8 * m31);
+    const t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) -
+               (tmp3 * m01 + tmp6 * m11 + tmp11 * m31);
+    const t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) -
+               (tmp4 * m01 + tmp9 * m11 + tmp10 * m21);
+
+    const d = 1 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
+
+    dst[0] = d * t0;
+    dst[1] = d * t1;
+    dst[2] = d * t2;
+    dst[3] = d * t3;
+
+    dst[4] = d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) -
+                  (tmp0 * m10 + tmp3 * m20 + tmp4 * m30));
+    dst[5] = d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) -
+                  (tmp1 * m00 + tmp6 * m20 + tmp9 * m30));
+    dst[6] = d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) -
+                  (tmp2 * m00 + tmp7 * m10 + tmp10 * m30));
+    dst[7] = d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) -
+                  (tmp5 * m00 + tmp8 * m10 + tmp11 * m20));
+
+    dst[8] = d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) -
+                  (tmp13 * m13 + tmp14 * m23 + tmp17 * m33));
+    dst[9] = d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) -
+                  (tmp12 * m03 + tmp19 * m23 + tmp20 * m33));
+    dst[10] = d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) -
+                   (tmp15 * m03 + tmp18 * m13 + tmp23 * m33));
+    dst[11] = d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) -
+                   (tmp16 * m03 + tmp21 * m13 + tmp22 * m23));
+
+    dst[12] = d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) -
+                   (tmp16 * m32 + tmp12 * m12 + tmp15 * m22));
+    dst[13] = d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) -
+                   (tmp18 * m22 + tmp21 * m32 + tmp13 * m02));
+    dst[14] = d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) -
+                   (tmp22 * m32 + tmp14 * m02 + tmp19 * m12));
+    dst[15] = d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) -
+                   (tmp20 * m12 + tmp23 * m22 + tmp17 * m02));
+    return dst;
+  },
+...
+```

Como hemos hecho en ejemplos anteriores, para dibujar 5 cosas necesitamos 5 buffers de uniform y 5 bind groups.

```js
+  const numFs = 5;
+  const objectInfos = [];
+  for (let i = 0; i < numFs; ++i) {
     // matriz
     const uniformBufferSize = (16) * 4;
     const uniformBuffer = device.createBuffer({
       label: 'uniforms',
       size: uniformBufferSize,
       usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
     });

     const uniformValues = new Float32Array(uniformBufferSize / 4);

     // offsets a los diversos valores de uniform en índices float32
     const kMatrixOffset = 0;

     const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);

     const bindGroup = device.createBindGroup({
       label: 'bind group for object',
       layout: pipeline.getBindGroupLayout(0),
       entries: [
         { binding: 0, resource: uniformBuffer },
       ],
     });

+    objectInfos.push({
+      uniformBuffer,
+      uniformValues,
+      matrixValue,
+      bindGroup,
+    });
+  }
```

Eliminemos algunos de los ajustes para simplificar nuestro ejemplo:

```js
   const settings = {
     fieldOfView: degToRad(100),
-    translation: [-65, 0, -120],
-    rotation: [degToRad(220), degToRad(25), degToRad(325)],
-    scale: [1, 1, 1],
   };

   ...

-      mat4.translate(matrixValue, settings.translation, matrixValue);
-      mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
-      mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
-      mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
-      mat4.scale(matrixValue, settings.scale, matrixValue);
```

Como estamos dibujando 5 cosas y todas usarán la misma matriz de proyección, la calcularemos antes del bucle de dibujo de las F.

```js
   function render() {
     ...

     const aspect = canvas.clientWidth / canvas.clientHeight;
-    mat4.perspective(
+    const projection = mat4.perspective(
         settings.fieldOfView,
         aspect,
         1,      // zNear
         2000,   // zFar
-        matrixValue,
     );
```

A continuación, calcularemos una matriz de cámara. Esta matriz representa la posición y orientación de la cámara en el mundo. El código de abajo crea una matriz que rota la cámara alrededor del origen a una distancia de `radius * 1.5` y mirando hacia el origen.

<div class="webgpu_center" style="width: 512px">
   <div data-diagram="camera-movement"></div>
   <div class="caption">movimiento de la cámara</div>
</div>

```js
+  const radius = 200;
   const settings = {
     fieldOfView: degToRad(100),
+    cameraAngle: 0,
   };

   ...

   function render() {

      ...
 

+    // calcular una matriz para la cámara.
+    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
```

Luego calculamos una "matriz de vista" a partir de la matriz de cámara. Una "matriz de vista" es la matriz que mueve todo lo opuesto a la cámara, haciendo que todo sea relativo a la cámara como si esta estuviera en el origen (0,0,0). Podemos hacer esto usando la función `inverse` que calcula la matriz inversa (la matriz que hace exactamente lo contrario de la matriz suministrada). En este caso, la matriz suministrada movería la cámara a cierta posición y orientación relativa al origen. La inversa de eso es una matriz que moverá todo lo demás de tal manera que la cámara quede en el origen.

```js
     // Crear una matriz de vista a partir de la matriz de cámara.
     const viewMatrix = mat4.inverse(cameraMatrix);
```

Ahora combinamos la matriz de vista y la de proyección en una matriz de vista-proyección.

```js
+    // combinar las matrices de vista y proyección
+    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

Finalmente, dibujamos un círculo de F. Para cada F, comenzamos con la matriz de vista-proyección, luego calculamos una posición en un círculo y nos trasladamos a esa posición.

```js
   function render() {
     ...

     const aspect = canvas.clientWidth / canvas.clientHeight;
     const projection = mat4.perspective(
         settings.fieldOfView,
         aspect,
         1,      // zNear
         2000,   // zFar
     );

     // calcular una matriz para la cámara.
     const cameraMatrix = mat4.rotationY(settings.cameraAngle);
     mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);

     // Crear una matriz de vista a partir de la matriz de cámara.
     const viewMatrix = mat4.inverse(cameraMatrix);

     // combinar las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    objectInfos.forEach(({
+      matrixValue,
+      uniformBuffer,
+      uniformValues,
+      bindGroup,
+    }, i) => {
+      const angle = i / numFs * Math.PI * 2;
+      const x = Math.cos(angle) * radius;
+      const z = Math.sin(angle) * radius;

+      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

       // subir los valores de uniform al buffer de uniform
       device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

       pass.setBindGroup(0, bindGroup);
       pass.draw(numVertices);
+    });
```

¡Y voilà! Una cámara que gira alrededor del círculo de 'F's. Mueve el deslizador de `cameraAngle` para mover la cámara.

{{{example url="../webgpu-cameras-step-1-direct-math.html" }}}

Todo eso está muy bien, pero usar rotación y traslación para mover una cámara a donde quieres y apuntar hacia lo que quieres ver no siempre es fácil. Por ejemplo, si quisiéramos que la cámara apuntara siempre a una 'F' específica, harían falta unas matemáticas bastante locas para calcular cómo rotar la cámara para que apunte a esa 'F' mientras gira alrededor del círculo de 'F's.

Afortunadamente, hay una forma más fácil. Podemos simplemente decidir dónde queremos la cámara y a qué queremos que apunte, y luego calcular una matriz que coloque la cámara allí. Basándonos en cómo funcionan las matrices, esto es sorprendentemente fácil.

Primero necesitamos saber dónde queremos la cámara. Llamaremos a esto el ojo (`eye`). Luego necesitamos saber la posición de lo que queremos mirar o a lo que queremos apuntar. Lo llamaremos el objetivo (`target`). Si restamos el `target` del `eye`, tendremos un vector que apunta en la dirección en la que tendríamos que ir desde la cámara para llegar al objetivo. Llamémoslo `zAxis`. Como sabemos que la cámara apunta en la dirección -Z, podemos restar al revés: `eye - target`. Normalizamos el resultado y lo copiamos directamente en la parte `z` de una matriz.

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tr>
        <td class="m11"> </td>
        <td class="m12"> </td>
        <td class="m13">Zx</td>
        <td class="m14"> </td>
      </tr>
      <tr>
        <td class="m21"> </td>
        <td class="m22"> </td>
        <td class="m23">Zy</td>
        <td class="m24"> </td>
      </tr>
      <tr>
        <td class="m31"> </td>
        <td class="m32"> </td>
        <td class="m33">Zz</td>
        <td class="m34"> </td>
      </tr>
      <tr>
        <td class="m41"> </td>
        <td class="m42"> </td>
        <td class="m43"> </td>
        <td class="m44"> </td>
      </tr>
    </table>
  </div>
</div>

Esta parte de la matriz representa el eje Z. En este caso, el eje Z de la cámara. Normalizar un vector significa convertirlo en un vector que representa 1.0 unidad. Si vuelves al [artículo sobre rotación](webgpu-rotation.html) donde hablamos de los círculos unitarios y cómo ayudaban con la rotación 2D. En 3D necesitamos esferas unitarias y un vector normalizado representa un punto en una esfera unitaria.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-00"></div>
  <div class="caption">el <span class='z-axis'>eje z (z axis)</span></div>
</div>

Sin embargo, eso no es información suficiente. Un solo vector nos da un punto en una esfera unitaria, pero ¿qué orientación tomar desde ese punto? Necesitamos completar las otras partes de la matriz. Específicamente, las partes de los ejes X e Y. Sabemos que, en general, estas 3 partes son perpendiculares entre sí. También sabemos que, "en general", no apuntamos la cámara directamente hacia arriba. Dado eso, si sabemos qué dirección es "arriba", en este caso (0,1,0), podemos usar eso y algo llamado "producto cruzado" (cross product) para calcular los ejes X e Y de la matriz.

No tengo idea de qué significa un producto cruzado en términos matemáticos. Lo que sí sé es que, si tienes 2 vectores unitarios y calculas el producto cruzado de ellos, obtendrás un vector que es perpendicular a esos 2 vectores. En otras palabras, si tienes un vector apuntando al sureste y un vector apuntando hacia arriba, y calculas el producto cruzado, obtendrás un vector que apunta al suroeste o al noreste, ya que esos son los 2 vectores que son perpendiculares al sureste y hacia arriba. Dependiendo de en qué orden calcules el producto cruzado, obtendrás la respuesta opuesta.

En cualquier caso, si calculamos el producto cruzado de nuestro <span class="z-axis">`zAxis`</span> y <span style="color: gray;">`up`</span> (arriba), obtendremos el <span class="x-axis">xAxis</span> para la cámara.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-01"></div>
  <div class="caption"><span style='color:gray;'>arriba</span> cruz <span class='z-axis'>zAxis</span> = <span class='x-axis'>xAxis</span></div>
</div>

Y ahora que tenemos el <span class="x-axis">`xAxis`</span>, podemos cruzar el <span class="z-axis">`zAxis`</span> y el <span class="x-axis">`xAxis`</span>, lo que nos dará el <span class="y-axis">`yAxis`</span> de la cámara.

<div class="webgpu_center" style="width: 768px">
  <div data-diagram="cross-product-02"></div>
  <div class="caption"><span class='z-axis'>zAxis</span> cruz <span class='x-axis'>xAxis</span> = <span class='y-axis'>yAxis</span></div>
</div>

Ahora todo lo que tenemos que hacer es poner los 3 ejes en una matriz. Eso nos da una matriz que orientará algo que apunta al `target` desde el `eye`. Solo necesitamos poner la posición del `eye` en la última columna.

<div class="webgpu_center">
  <div class="glocal-center">
    <table class="glocal-center-content glocal-mat">
      <tbody>
        <tr class="vertical-spans">
          <td><span class="x-axis">eje x →</span></td>
          <td><span class="y-axis">eje y →</span></td>
          <td><span class="z-axis">eje z →</span></td>
          <td><span>pos. ojo →</span></td>
        </tr>
        <tr>
          <td class="m11">Xx</td>
          <td class="m12">Yx</td>
          <td class="m13">Zx</td>
          <td class="m14">Tx</td>
        </tr>
        <tr>
          <td class="m21">Xy</td>
          <td class="m22">Yy</td>
          <td class="m23">Zy</td>
          <td class="m24">Ty</td>
        </tr>
        <tr>
          <td class="m31">Xz</td>
          <td class="m32">Yz</td>
          <td class="m33">Zz</td>
          <td class="m34">Tz</td>
        </tr>
        <tr>
          <td class="m41">0</td>
          <td class="m42">0</td>
          <td class="m43">0</td>
          <td class="m44">1</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

Aquí está el código para calcular el producto cruzado de 2 vectores. Al igual que nuestro código de matrices, haremos que tome un array de destino opcional.

```js
+const vec3 = {
+  cross(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    const t0 = a[1] * b[2] - a[2] * b[1];
+    const t1 = a[2] * b[0] - a[0] * b[2];
+    const t2 = a[0] * b[1] - a[1] * b[0];
+
+    dst[0] = t0;
+    dst[1] = t1;
+    dst[2] = t2;
+
+    return dst;
+  },
+};
```

Aquí está el código para restar dos vectores.

```js
const vec3 = {
  ...
+  subtract(a, b, dst) {
+    dst = dst || new Float32Array(3);
+
+    dst[0] = a[0] - b[0];
+    dst[1] = a[1] - b[1];
+    dst[2] = a[2] - b[2];
+
+    return dst;
+  },
```

Aquí está el código para normalizar un vector (convertirlo en un vector unitario).

```js
const vec3 = {
  ...
+  normalize(v, dst) {
+    dst = dst || new Float32Array(3);
+
+    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
+    // asegurarnos de no dividir por 0.
+    if (length > 0.00001) {
+      dst[0] = v[0] / length;
+      dst[1] = v[1] / length;
+      dst[2] = v[2] / length;
+    } else {
+      dst[0] = 0;
+      dst[1] = 0;
+      dst[2] = 0;
+    }
+
+    return dst;
+  },
```

Aquí está el código para calcular una matriz de *cámara*. Sigue los pasos descritos arriba.

```js
const mat4 = {
  ...
  cameraAim(eye, target, up, dst) {
    dst = dst || new Float32Array(16);

    const zAxis = vec3.normalize(vec3.subtract(eye, target));
    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

    return dst;
  },
  ...
```

Y así es como podríamos usarla para hacer que la cámara apunte a una 'F' específica mientras la movemos.

```js
-    // calcular una matriz para la cámara.
-    const cameraMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(cameraMatrix, [0, 0, radius * 1.5], cameraMatrix);
+    // Calcular la posición de la primera F
+    const fPosition = [radius, 0, 0];
+
+    // Usar matemáticas de matrices para calcular una posición en un círculo
+    // donde está la cámara
+    const tempMatrix = mat4.rotationY(settings.cameraAngle);
+    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
+
+    // Obtener la posición de la cámara de la matriz que calculamos
+    const eye = tempMatrix.slice(12, 15);
+
+    const up = [0, 1, 0];
+
+    // Calcular la matriz de la cámara usando cameraAim
+    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);

     // Crear una matriz de vista a partir de la matriz de cámara.
     const viewMatrix = mat4.inverse(cameraMatrix);
```

Y aquí está el resultado.

{{{example url="../webgpu-cameras-step-2-camera-aim.html" }}}

Mueve el deslizador y observa cómo la cámara sigue a una sola 'F'.

La mayoría de las librerías matemáticas no tienen una función `cameraAim`. En su lugar, tienen una función `lookAt` que calcula exactamente lo mismo que nuestra función `cameraAim`, pero ADEMÁS la convierte en una matriz de vista. Funcionalmente, `lookAt` podría implementarse así:

```js
const mat4 = {
  ...
+  lookAt(eye, target, up, dst) {
+    return mat4.inverse(mat4.cameraAim(eye, target, up, dst), dst);
+  },
  ...
};
```

Usando esta función `lookAt`, nuestro código cambiaría a esto:

```js
-    // Calcular la matriz de la cámara usando cameraAim.
-    const cameraMatrix = mat4.cameraAim(eye, fPosition, up);
-
-    // Crear una matriz de vista a partir de la matriz de cámara.
-    const viewMatrix = mat4.inverse(cameraMatrix);
+    // Calcular una matriz de vista
+    const viewMatrix = mat4.lookAt(eye, fPosition, up);
```

{{{example url="../webgpu-cameras-step-3-look-at.html" }}}

Ten en cuenta que puedes usar este tipo de matemáticas de "apuntar" para algo más que cámaras. Los usos comunes son hacer que la cabeza de un personaje siga a algún objetivo. Hacer que una torreta apunte a un objetivo. Hacer que un objeto siga un camino. Calculas en qué punto del camino está el objetivo. Luego calculas dónde estaría el objetivo en el camino unos momentos en el futuro. Pones esos 2 valores en tu función de apuntar y obtendrás una matriz que hace que tu objeto siga el camino y también se oriente hacia él.

Normalmente, para "apuntar" algo quieres que apunte hacia el eje Z positivo en lugar de hacia el eje Z negativo como hacía nuestra función de arriba. Por lo tanto, necesitamos restar `eye` de `target` en lugar de `target` de `eye`.

```js
const mat4 = {
  ...
+  aim(eye, target, up, dst) {
+    dst = dst || new Float32Array(16);
+
+    const zAxis = vec3.normalize(vec3.subtract(target, eye));
+    const xAxis = vec3.normalize(vec3.cross(up, zAxis));
+    const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));
+
+    dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
+    dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
+    dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
+    dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;
+
+    return dst;
+  },

   cameraAim(eye, target, up, dst) {
     dst = dst || new Float32Array(16);

     const zAxis = vec3.normalize(vec3.subtract(eye, target));
     const xAxis = vec3.normalize(vec3.cross(up, zAxis));
     const yAxis = vec3.normalize(vec3.cross(zAxis, xAxis));

     dst[ 0] = xAxis[0];  dst[ 1] = xAxis[1];  dst[ 2] = xAxis[2];  dst[ 3] = 0;
     dst[ 4] = yAxis[0];  dst[ 5] = yAxis[1];  dst[ 6] = yAxis[2];  dst[ 7] = 0;
     dst[ 8] = zAxis[0];  dst[ 9] = zAxis[1];  dst[10] = zAxis[2];  dst[11] = 0;
     dst[12] = eye[0];    dst[13] = eye[1];    dst[14] = eye[2];    dst[15] = 1;

     return dst;
   },
...
```

<a id="a-aim-fs"></a> Hagamos que un montón de F apunten a otra F (sí, demasiadas F, pero no quiero llenar el ejemplo con más datos). Haremos una cuadrícula de 5x5 F más una extra para que "apunten" a ella.

```js
-  const numFs = 5;
+  const numFs = 5 * 5 + 1;
```

Luego fijaremos un objetivo de cámara y cambiaremos los ajustes para que podamos mover una de las F.

```js
   const settings = {
-    fieldOfView: degToRad(100),
-    cameraAngle: 0,
+    target: [0, 200, 300],
+    targetAngle: 0,
   };

   const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

   const gui = new GUI();
   gui.onChange(render);
-  gui.add(settings, 'fieldOfView', {min: 1, max: 179, converters: GUI.converters.radToDeg});
-  gui.add(settings, 'cameraAngle', radToDegOptions);
+  gui.add(settings.target, '1', -100, 300).name('altura del objetivo');
+  gui.add(settings, 'targetAngle', radToDegOptions).name('ángulo del objetivo');
```

Y finalmente, para las primeras 25 F, las orientaremos en una cuadrícula usando `aim` y las *apuntaremos* a la F número 26.

```js
+    // actualizar X,Z del objetivo basándose en el ángulo
+    settings.target[0] = Math.cos(settings.targetAngle) * radius;
+    settings.target[2] = Math.sin(settings.targetAngle) * radius;

     const aspect = canvas.clientWidth / canvas.clientHeight;
     const projection = mat4.perspective(
-        settings.fieldOfView,
+        degToRad(60), // fieldOfView,
         aspect,
         1,      // zNear
         2000,   // zFar
     );

-    // Calcular la posición de la primera F
-    const fPosition = [radius, 0, 0];
-
-    // Usar matemáticas de matrices para calcular una posición en un círculo
-    // donde está la cámara
-    const tempMatrix = mat4.rotationY(settings.cameraAngle);
-    mat4.translate(tempMatrix, [0, 0, radius * 1.5], tempMatrix);
-
-    // Obtener la posición de la cámara de la matriz que calculamos
-    const eye = tempMatrix.slice(12, 15);
+    const eye = [-500, 300, -500];
+    const target = [0, -100, 0];
     const up = [0, 1, 0];

     // Calcular una matriz de vista
-    const viewMatrix = mat4.lookAt(eye, fPosition, up);
+    const viewMatrix = mat4.lookAt(eye, target, up);

     // combinar las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

     objectInfos.forEach(({
       matrixValue,
       uniformBuffer,
       uniformValues,
       bindGroup,
     }, i) => {
-      const angle = i / numFs * Math.PI * 2;
-      const x = Math.cos(angle) * radius;
-      const z = Math.sin(angle) * radius;
-
-      mat4.translate(viewProjectionMatrix, [x, 0, z], matrixValue);

+      const deep = 5;
+      const across = 5;
+      if (i < 25) {
+        // calcular posiciones de la cuadrícula
+        const gridX = i % across;
+        const gridZ = i / across | 0;
+
+        // calcular posiciones de 0 a 1
+        const u = gridX / (across - 1);
+        const v = gridZ / (deep - 1);
+
+        // centrar y extender
+        const x = (u - 0.5) * across * 150;
+        const z = (v - 0.5) * deep * 150;
+
+        // apuntar esta F desde su posición hacia la F objetivo
+        const aimMatrix = mat4.aim([x, 0, z], settings.target, up);
+        mat4.multiply(viewProjectionMatrix, aimMatrix, matrixValue);
+      } else {
+        mat4.translate(viewProjectionMatrix, settings.target, matrixValue);
+      }

       // subir los valores de uniform al buffer de uniform
       device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

Y ahora 25 F están mirando (su parte frontal es Z positivo) a la F número 26.

{{{example url="../webgpu-cameras-step-4-aim-Fs.html" }}}

Mueve los deslizadores y observa cómo todas las 25 F *apuntan*.


<!-- keep this at the bottom of the article -->
<link href="webgpu-cameras.css" rel="stylesheet">
<script type="module" src="webgpu-cameras.js"></script>
