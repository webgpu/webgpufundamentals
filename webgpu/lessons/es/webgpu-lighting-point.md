Title: WebGPU - Iluminación puntual
Description: Cómo implementar la iluminación puntual en WebGPU
TOC: Iluminación puntual


Este artículo es una continuación de [Iluminación direccional en WebGPU](webgpu-lighting-directional.html). Si no lo has leído, te sugiero que [comiences por ahí](webgpu-lighting-directional.html).

En el artículo anterior, cubrimos la iluminación direccional, donde la luz proviene universalmente de la misma dirección. Configuramos esa dirección antes de renderizar.

¿Qué pasaría si, en lugar de configurar la dirección de la luz, eligiéramos un punto en el espacio 3D para la luz y calculáramos la dirección desde ese punto a cada lugar visible de la superficie de nuestro modelo en nuestro shader? Eso nos daría una luz puntual (*point light*).

{{{diagram url="resources/point-lighting.html" width="700" height="400" className="noborder" }}}

Si rotas la superficie de arriba, verás cómo cada punto de la superficie tiene un vector *superficie a luz* (*surface to light*) diferente. Obtener el producto escalar de la normal de la superficie y cada vector individual de superficie a luz nos da un valor diferente en cada punto de la superficie.

Así que, hagamos eso.

Primero necesitamos la posición de la luz:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
-  lightDirection: vec3f,
+  lightPosition: vec3f,
};
```

Y necesitamos una forma de calcular la posición en el mundo de la superficie. Para eso, podemos multiplicar nuestras posiciones por la matriz de mundo, así que...

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
+  world: mat4x4f,
   color: vec4f,
-  lightDirection: vec3f,
-  lightPosition: vec3f,
+  lightPosition: vec3f,
};

....

  // Calcula la posición en el mundo de la superficie
  let surfaceWorldPosition = (uni.world * vert.position).xyz;
```

Y podemos calcular un vector desde la superficie a la luz, que es similar a la dirección de la luz que teníamos antes, excepto que esta vez lo calculamos para cada posición de la superficie respecto al punto de posición de la luz en el mundo.

```wgsl
  struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) surfaceToLight: vec3f,
  };

  ...

    // Calcula el vector de la superficie a la luz
    // y pásalo al fragment shader
    vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;
```

Aquí está todo eso en contexto:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
*  world: mat4x4f,
  color: vec4f,
*  lightPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
*  @location(1) surfaceToLight: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // Orienta las normales y pásalas al fragment shader
  vsOut.normal = uni.normalMatrix * vert.normal;

*  // Calcula la posición en el mundo de la superficie
*  let surfaceWorldPosition = (uni.world * vert.position).xyz;
*
*  // Calcula el vector de la superficie a la luz
*  // y pásalo al fragment shader
*  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

  return vsOut;
}
```

Ahora en el fragment shader necesitamos normalizar el vector de la superficie a la luz, ya que no es un vector unitario. Ten en cuenta que podríamos normalizarlo en el vertex shader, pero debido a que es una *variable entre etapas* (*inter-stage variable*), se interpolará linealmente entre nuestras posiciones y, por lo tanto, no sería un vector unitario completo.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Debido a que vsOut.normal es una variable entre etapas (inter-stage variable)
  // está interpolada, por lo que no será un vector unitario.
  // Normalizarla la convertirá de nuevo en un vector unitario.
  let normal = normalize(vsOut.normal);

+  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // Calcula la luz calculando el producto escalar
-  // de la normal por la dirección inversa de la luz
-  let light = dot(normal, -uni.lightDirection);
+  // de la normal con la dirección hacia la luz
+  let light = dot(normal, surfaceToLightDirection);

  // Multipliquemos solo la porción de color (no el alfa)
  // por la luz
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}
```

Luego necesitamos actualizar nuestro uniform buffer, los offsets y las vistas.

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de los uniforms en índices float32
   const kNormalMatrixOffset = 0;
   const kWorldViewProjectionOffset = 12;
-  const kColorOffset = 28;
-  const kLightDirectionOffset = 32;
+  const kWorldOffset = 28;
+  const kColorOffset = 44;
+  const kLightPositionOffset = 48;

   const normalMatrixValue = uniformValues.subarray(
       kNormalMatrixOffset, kNormalMatrixOffset + 12);
   const worldViewProjectionValue = uniformValues.subarray(
       kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
+  const worldValue = uniformValues.subarray(
+      kWorldOffset, kWorldOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-  const lightDirectionValue =
-      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
+  const lightPositionValue =
+      uniformValues.subarray(kLightPositionOffset, kLightPositionOffset + 3);
```

y necesitamos configurarlos:

```js
     const eye = [100, 150, 200];
     const target = [0, 35, 0];
     const up = [0, 1, 0];

     // Calcula una matriz de vista
     const viewMatrix = mat4.lookAt(eye, target, up);

     // Combina las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

     // Calcula una matriz de mundo
-    const world = mat4.rotationY(settings.rotation);
+    const world = mat4.rotationY(settings.rotation, worldValue);

     // Combina las matrices viewProjection y world
     mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

     // Inviértela y traspónla en el valor worldInverseTranspose
     mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

     colorValue.set([0.2, 1, 0.2, 1]);  // verde
-    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
+    lightPositionValue.set([-10, 30, 100]);

     // sube los valores de los uniforms al uniform buffer
     device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

Y aquí está:

{{{example url="../webgpu-lighting-point.html" }}}

# <a id="a-specular"></a> Brillo especular (Specular Highlighting)

Ahora que tenemos un punto, podemos añadir algo llamado brillo especular (*specular highlighting*).

Si miras un objeto en el mundo real, si es remotamente brillante y da la casualidad de que refleja la luz directamente hacia ti, es casi como un espejo.

<img class="webgpu_center" src="resources/specular-highlights.jpg" />

Podemos simular ese efecto calculando si la luz se refleja en nuestros ojos. Una vez más, el *producto escalar* viene al rescate.

¿Qué necesitamos comprobar? Pensemos en ello. La luz se refleja con el mismo ángulo con el que golpea una superficie, por lo que si la dirección de la superficie a la luz es el reflejo exacto de la superficie al ojo, entonces está en el ángulo perfecto para reflejarse.

{{{diagram url="resources/surface-reflection.html" width="700" height="400" className="noborder" }}}

Si conocemos la dirección desde la superficie de nuestro modelo hasta la luz (que ya conocemos porque acabamos de hacerlo). Y si conocemos la dirección desde la superficie hasta la vista/ojo/cámara, que podemos calcular, entonces podemos sumar esos 2 vectores y normalizarlos para obtener el `halfVector` (vector medio), que es el vector que se encuentra a medio camino entre ellos. Si el `halfVector` y la normal de la superficie coinciden, entonces es el ángulo perfecto para reflejar la luz hacia la vista/ojo/cámara. ¿Y cómo podemos saber cuándo coinciden? Calcula el *producto escalar*, tal como hicimos antes. 1 = coinciden, misma dirección; 0 = son perpendiculares; -1 = son opuestos.

{{{diagram url="resources/specular-lighting.html" width="700" height="400" className="noborder" }}}

Así que lo primero es pasar la posición de la vista/cámara/ojo, calcular el vector superficie a vista y pasarlo al fragment shader.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
+  viewWorldPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) surfaceToLight: vec3f,
+  @location(2) surfaceToView: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // Orienta las normales y pásalas al fragment shader
  vsOut.normal = uni.normalMatrix * vert.normal;

  // Calcula la posición en el mundo de la superficie
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  // Calcula el vector de la superficie a la luz
  // y pásalo al fragment shader
  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

+  // Calcula el vector de la superficie a la vista
+  // y pásalo al fragment shader
+  vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;

  return vsOut;
}
```

Luego, en el fragment shader, necesitamos calcular el `halfVector` entre los vectores de superficie a vista y superficie a luz. Después, podemos calcular el producto escalar del `halfVector` y la normal para averiguar si la luz se refleja en la vista.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Debido a que vsOut.normal es una variable entre etapas (inter-stage variable)
  // está interpolada, por lo que no será un vector unitario.
  // Normalizarla la convertirá de nuevo en un vector unitario.
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // Calcula la luz calculando el producto escalar
  // de la normal con la dirección hacia la luz
  let light = dot(normal, surfaceToLightDirection);

+  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
+  let halfVector = normalize(
+    surfaceToLightDirection + surfaceToViewDirection);
+  let specular = dot(normal, halfVector);

  // Multipliquemos solo la porción de color (no el alfa)
  // por la luz
-  let color = uni.color.rgb * light;
+  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

Nuevamente tenemos que añadir espacio para `viewWorldPosition` en nuestro `uniformBuffer`.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de los uniforms en índices float32
   const kNormalMatrixOffset = 0;
   const kWorldViewProjectionOffset = 12;
   const kWorldOffset = 28;
   const kColorOffset = 44;
   const kLightPositionOffset = 48;
+  const kViewWorldPositionOffset = 52;

   const normalMatrixValue = uniformValues.subarray(
       kNormalMatrixOffset, kNormalMatrixOffset + 12);
   const worldViewProjectionValue = uniformValues.subarray(
       kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
   const worldValue = uniformValues.subarray(
       kWorldOffset, kWorldOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const lightPositionValue = uniformValues.subarray(
       kLightPositionOffset, kLightPositionOffset + 3);
+  const viewWorldPositionValue = uniformValues.subarray(
+      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
```

y configurarlo:

```js
     const eye = [100, 150, 200];
     const target = [0, 35, 0];
     const up = [0, 1, 0];

     ...

     viewWorldPositionValue.set(eye);
```

Y aquí está:

{{{example url="../webgpu-lighting-point-w-specular.html" }}}

**¡DIANTRES, QUÉ BRILLO!**

Podemos corregir el brillo elevando el resultado del producto escalar a una potencia. Esto comprimirá el brillo especular desde una caída lineal a una caída exponencial.

{{{diagram url="resources/power-graph.html" width="400" height="400" className="noborder" }}}

Cuanto más cerca esté la línea roja de la parte superior del gráfico, más brillante será nuestra adición especular. Al elevar la potencia, se comprime el rango donde se vuelve brillante hacia la derecha.

Llamemos a eso `shininess` (brillo/lustre) y añadámoslo a nuestro shader.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
+  shininess: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {

  ...

-  let specular = dot(normal, halfVector);
+  var specular = dot(normal, halfVector);
+  specular = select(
+      0.0,                           // valor si la condición es falsa
+      pow(specular, uni.shininess),  // valor si la condición es verdadera
+      specular > 0.0);               // condición
```

El producto escalar puede ser negativo. Elevar un número negativo a una potencia no está definido en WebGPU (¿o es NaN?), lo cual sería malo. Por lo tanto, si el producto escalar es negativo, simplemente dejamos el valor especular en 0.0.

Por supuesto, necesitamos configurar `shininess`.

```js
   const kNormalMatrixOffset = 0;
   const kWorldViewProjectionOffset = 12;
   const kWorldOffset = 28;
   const kColorOffset = 44;
   const kLightWorldPositionOffset = 48;
   const kViewWorldPositionOffset = 52;
+  const kShininessOffset = 55;

   const normalMatrixValue = uniformValues.subarray(
       kNormalMatrixOffset, kNormalMatrixOffset + 12);
   const worldViewProjectionValue = uniformValues.subarray(
       kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
   const worldValue = uniformValues.subarray(
       kWorldOffset, kWorldOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const lightWorldPositionValue = uniformValues.subarray(
       kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
   const viewWorldPositionValue = uniformValues.subarray(
       kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
+  const shininessValue = uniformValues.subarray(
+      kShininessOffset, kShininessOffset + 1);

...

   const settings = {
     rotation: degToRad(0),
+    shininess: 30,
   };

   const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings, 'shininess', { min: 1, max: 250 });

...

   function render() {

    ...

+    shininessValue[0] = settings.shininess;

```

Y aquí está:

{{{example url="../webgpu-lighting-point-w-specular-power.html" }}}

A continuación, [iluminación focal (spot lighting)](webgpu-lighting-spot.html).

<div class="webgpu_bottombar">
<h3>¿Por qué <code>pow(negativo, potencia)</code> no está definido?</h3>
<p>¿Qué significa esto?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 2)</pre></div>
<p>Bueno, puedes verlo como:</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 = 25</pre></div>
<p>¿Y qué hay de esto?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 3)</pre></div>
<p>Bueno, puedes verlo como:</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 * 5 = 125</pre></div>
<p>Ok, ¿y esto?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2)</pre></div>
<p>Bueno, eso podría ser:</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 = 25</pre></div>
<p>Y esto:</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 3)</pre></div>
<p>Bueno, puedes verlo como:</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 * -5 = -125</pre></div>
<p>Como sabes, multiplicar un negativo por un negativo da como resultado un positivo. Multiplicar por un negativo de nuevo lo hace negativo.</p>
<p>Bueno, entonces, ¿qué significa esto?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2.5)</pre></div>
<p>¿Cómo decides si el resultado de eso es positivo o negativo? Eso es territorio de los <a href="https://betterexplained.com/articles/a-visual-intuitive-guide-to-imaginary-numbers/">números imaginarios</a>.</p>
</div>
