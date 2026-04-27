Title: WebGPU - Iluminación focal
Description: Cómo implementar focos (spot lights) en WebGPU
TOC: Iluminación focal


Este artículo es una continuación de [el artículo sobre iluminación puntual](webgpu-lighting-point.html). Si no lo has leído, te sugiero que [comiences por ahí](webgpu-lighting-point.html).

En el último artículo, cubrimos la iluminación puntual donde, para cada punto de la superficie de nuestro objeto, calculamos la dirección desde la luz hasta ese punto de la superficie. Luego hicimos lo mismo que hicimos para la [iluminación direccional](webgpu-lighting-directional.html): calculamos el producto escalar de la normal de la superficie (la dirección hacia la que mira la superficie) y la dirección de la luz. Esto nos dio un valor de 1 si las dos direcciones coincidían y, por lo tanto, debía estar totalmente iluminado. 0 si las dos direcciones eran perpendiculares y -1 si eran opuestas. Utilizamos ese valor directamente para multiplicar el color de la superficie, lo que nos proporcionó la iluminación.

La iluminación focal (*spot lighting*) es solo un cambio muy pequeño. De hecho, si piensas de forma creativa en las cosas que hemos hecho hasta ahora, podrías ser capaz de derivar tu propia solución.

Puedes imaginar una luz puntual como un punto con luz que sale en todas las direcciones desde ese punto. Para hacer un foco, lo único que tenemos que hacer es elegir una dirección desde ese punto: esta es la dirección de nuestro foco. Luego, para cada dirección en la que va la luz, podríamos calcular el producto escalar de esa dirección con nuestra dirección elegida para el foco. Elegiríamos un límite arbitrario y decidiríamos que si estamos dentro de ese límite, iluminamos. Si no estamos dentro de ese límite, no iluminamos.

{{{diagram url="resources/spot-lighting.html" width="700" height="400" className="noborder" }}}

En el diagrama de arriba podemos ver una luz con rayos que van en todas direcciones y impresos sobre ellos está su producto escalar relativo a la dirección. Luego tenemos una **dirección** específica que es la dirección del foco. Elegimos un límite (arriba está en grados). A partir del límite calculamos un *límite de punto* (*dot limit*); simplemente calculamos el coseno del límite. Si el producto escalar de nuestra dirección elegida para el foco con la dirección de cada rayo de luz es mayor que el límite de punto, entonces realizamos la iluminación. De lo contrario, no hay iluminación.

Dicho de otra manera, supongamos que el límite es de 20 grados. Podemos convertir eso a radianes y, a partir de ahí, a un valor de -1 a 1 tomando el coseno. Llamemos a eso espacio de punto (*dot space*). En otras palabras, aquí hay una pequeña tabla para los valores límite:

              límites en
     grados | radianes | dot space
     -------+----------+----------
        0   |    0.0   |    1.0
        22  |     .38  |     .93
        45  |     .79  |     .71
        67  |    1.17  |     .39
        90  |    1.57  |    0.0
       180  |    3.14  |   -1.0

Entonces podemos simplemente comprobar:

    dotFromDirection = dot(surfaceToLight, -lightDirection)
    if (dotFromDirection >= limitInDotSpace) {
       // realizar la iluminación
    }

Hagamos eso.

Primero modifiquemos nuestro fragment shader del [último artículo](webgpu-lighting-point.html).

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
+  lightDirection: vec3f,
+  limit: f32,
};

...

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Debido a que vsOut.normal es una variable entre etapas (inter-stage variable)
  // está interpolada, por lo que no será un vector unitario.
  // Normalizarla la convertirá de nuevo en un vector unitario.
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);


+  var light = 0.0;
+  var specular = 0.0;
+
+  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
+  if (dotFromDirection > uni.limit) {
    // Calcula la luz calculando el producto escalar
    // de la normal con la dirección hacia la luz
-    let light = dot(normal, surfaceToLightDirection);
+    light = dot(normal, surfaceToLightDirection);

    specular = dot(normal, halfVector);
    specular = select(
        0.0,                           // valor si la condición es falsa
        pow(specular, uni.shininess),  // valor si la condición es verdadera
        specular > 0.0);               // condición
+  }

  // Multipliquemos solo la porción de color (no el alfa)
  // por la luz
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

Por supuesto, necesitamos añadir espacio para los nuevos valores en nuestro uniform buffer.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
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
   const kLightWorldPositionOffset = 48;
   const kViewWorldPositionOffset = 52;
   const kShininessOffset = 55;
+  const kLightDirectionOffset = 56;
+  const kLimitOffset = 59;

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
   const shininessValue = uniformValues.subarray(
       kShininessOffset, kShininessOffset + 1);
+  const lightDirectionValue = uniformValues.subarray(
+      kLightDirectionOffset, kLightDirectionOffset + 3);
+  const limitValue = uniformValues.subarray(
+      kLimitOffset, kLimitOffset + 1);
```

y tenemos que configurarlos:

```js
    colorValue.set([0.2, 1, 0.2, 1]);  // verde
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
+    limitValue[0] = Math.cos(settings.limit);

    // Dado que no tenemos un plano como en la mayoría de los ejemplos de focos,
    // vamos a apuntar el foco hacia la F
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // obtenemos el eje Z de la matriz
        // lo negamos porque lookAt mira hacia el eje -Z
        lightDirectionValue.set(mat.slice(8, 11));
    }
```

Arriba estamos usando `mat4.aim`, que cubrimos en [el artículo sobre cámaras](webgpu-cameras.html). Específicamente, nuestra `F` es el `target` (objetivo). El foco está en `-10, 30, 100`. Añadimos algunos offsets al objetivo para poder apuntar el foco fácilmente. Luego simplemente extraemos el *eje Z*, ya que esa es la dirección hacia la que `aim` apunta algo.

Solo necesitamos añadir un poco de código para la interfaz de usuario:

```js
  const settings = {
    rotation: degToRad(0),
    shininess: 30,
+    limit: degToRad(15),
+    aimOffsetX: -10,
+    aimOffsetY: 10,
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'rotation', radToDegOptions);
  gui.add(settings, 'shininess', { min: 1, max: 250 });
+  gui.add(settings, 'limit', limitOptions);
+  gui.add(settings, 'aimOffsetX', -50, 50);
+  gui.add(settings, 'aimOffsetY', -50, 50);
```

Y aquí está:

{{{example url="../webgpu-lighting-spot.html" }}}

Una nota es que estamos negando `uni.lightDirection` en el shader. Eso es algo así como "la misma gata, pero revolcada" (*six of one, half dozen of another*). Queremos que las 2 direcciones que estamos comparando apunten en el mismo sentido cuando coincidan. Eso significa que necesitamos comparar la `surfaceToLightDirection` con el opuesto de la dirección del foco.

En este momento el foco es súper brusco. O estamos dentro del foco o no lo estamos, y las cosas simplemente se vuelven negras.

Para solucionar esto, podríamos usar 2 límites en lugar de uno: un límite interno (*inner limit*) y un límite externo (*outer limit*). Si estamos dentro del límite interno, usamos 1.0. Si estamos fuera del límite externo, usamos 0.0. Si estamos entre el límite interno y el externo, interpolamos linealmente (*lerp*) entre 1.0 y 0.0.

Aquí hay una forma de hacerlo:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
  lightDirection: vec3f,
-  limit: f32,
+  innerLimit: f32,
+  outerLimit: f32,
};

...

-  var light = 0.0;
-  var specular = 0.0;
-
-  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-  if (dotFromDirection > uni.limit) {
-    // Calcula la luz calculando el producto escalar
-    // de la normal con la dirección hacia la luz
-    light = dot(normal, surfaceToLightDirection);
-    specular = dot(normal, halfVector);
-    specular = select(
-        0.0,                           // valor si la condición es falsa
-        pow(specular, uni.shininess),  // valor si la condición es verdadera
-        specular > 0.0);               // condición
-  }

    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
    let limitRange = uni.innerLimit - uni.outerLimit;
    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);

    // Calcula la luz calculando el producto escalar
    // de la normal con la dirección hacia la luz
    let light = inLight * dot(normal, surfaceToLightDirection);

    var specular = dot(normal, halfVector);
    specular = inLight * select(
        0.0,                           // valor si la condición es falsa
        pow(specular, uni.shininess),  // valor si la condición es verdadera
        specular > 0.0);               // condición

```

Estamos usando `saturate`. `Saturate` limita un valor entre 0 y 1. Esto significa que `inLight` será 0 si estamos fuera del `outerLimit`. Será 1 si estamos dentro del `innerLimit`. Y estará entre 0 y 1 entre esos 2 límites. Luego multiplicamos los cálculos de luz y especular por `inLight`.

Y de nuevo tenemos que actualizar la configuración de nuestro uniform buffer:

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4 + 4) * 4;
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
   const kLightWorldPositionOffset = 48;
   const kViewWorldPositionOffset = 52;
   const kShininessOffset = 55;
   const kLightDirectionOffset = 56;
-  const kLimitOffset = 59;
+  const kInnerLimitOffset = 59;
+  const kOuterLimitOffset = 60;

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
   const shininessValue = uniformValues.subarray(
       kShininessOffset, kShininessOffset + 1);
   const lightDirectionValue = uniformValues.subarray(
       kLightDirectionOffset, kLightDirectionOffset + 3);
-  const limitValue = uniformValues.subarray(
-      kLimitOffset, kLimitOffset + 1);
+  const innerLimitValue = uniformValues.subarray(
+      kInnerLimitOffset, kInnerLimitOffset + 1);
+  const outerLimitValue = uniformValues.subarray(
+      kOuterLimitOffset, kOuterLimitOffset + 1);
```

y donde los configuramos:

```js
   const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
+  const limitOptions = { min: 0, max: 90, minRange: 1, step: 1, converters: GUI.converters.radToDeg };

   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings, 'rotation', radToDegOptions);
   gui.add(settings, 'shininess', { min: 1, max: 250 });
-  gui.add(settings, 'limit', limitOptions);
+  GUI.makeMinMaxPair(gui, settings, 'innerLimit', 'outerLimit', limitOptions);
   gui.add(settings, 'aimOffsetX', -50, 50);
   gui.add(settings, 'aimOffsetY', -50, 50);

   ...

   function render() {

     ...

     colorValue.set([0.2, 1, 0.2, 1]);  // verde
     lightWorldPositionValue.set([-10, 30, 100]);
     viewWorldPositionValue.set(eye);
     shininessValue[0] = settings.shininess;
-    limitValue[0] = Math.cos(settings.limit);
+    innerLimitValue[0] = Math.cos(settings.innerLimit);
+    outerLimitValue[0] = Math.cos(settings.outerLimit);

     ...
```

Y eso funciona:

{{{example url="../webgpu-lighting-spot-w-linear-falloff.html" }}}

¡Ahora estamos obteniendo algo que se parece más a un foco!

Una cosa a tener en cuenta es que si `innerLimit` es igual a `outerLimit`, entonces `limitRange` será 0.0. Dividimos por `limitRange` y la división por cero es mala/indefinida. No hay nada que hacer en el shader aquí. Solo tenemos que asegurarnos en nuestro JavaScript de que `innerLimit` nunca sea igual a `outerLimit`, lo cual, en este caso, nuestra interfaz gráfica hace por nosotros.

WGSL también tiene una función que podríamos usar para simplificar esto ligeramente. Se llama `smoothstep`: devuelve un valor de 0 a 1 pero toma tanto un límite inferior como uno superior e interpola entre 0 y 1 entre esos límites.

```wgsl
     smoothstep(límiteInferior, límiteSuperior, valor)
```

Hagamos eso:

```wgsl
    let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
-    let limitRange = uni.innerLimit - uni.outerLimit;
-    let inLight = saturate((dotFromDirection - uni.outerLimit) / limitRange);
+    let inLight = smoothStep(uni.outerLimit, uni.innerLimit, dotFromDirection);
```

Eso también funciona:

{{{example url="../webgpu-lighting-spot-w-smoothstep-falloff.html" }}}

La diferencia es que `smoothstep` utiliza una *interpolación de Hermite* en lugar de una interpolación lineal. Eso significa que entre el `límiteInferior` y el `límiteSuperior` interpola como la imagen de abajo a la derecha, mientras que una interpolación lineal es como la imagen de la izquierda.

<img class="webgpu_center invertdark" src="resources/linear-vs-hermite.png" />

Depende de ti si crees que la diferencia importa.

Otra cosa a tener en cuenta es que la función `smoothstep` tiene resultados indefinidos si el `límiteInferior` es mayor o igual que el `límiteSuperior`. Que sean iguales es el mismo problema que mencionamos arriba. El problema añadido de no estar definida si el `límiteInferior` es mayor que el `límiteSuperior` es nuevo, pero para el propósito de un foco, eso nunca debería ser cierto.
