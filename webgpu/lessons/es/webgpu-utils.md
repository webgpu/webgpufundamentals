Title: Utilidades de WebGPU y wgpu-matrix
Description: Utilidades y matemáticas para WebGPU
TOC: Utilidades y Matemáticas de WebGPU

> ## Lo que deberías sacar en claro de este artículo
>
> Usar WebGPU es muy verboso. Tan verboso que resulta más fácil de entender
> si utilizas algunos ayudantes (helpers) para que puedas concentrarte en los conceptos de nivel superior.
>
> Por ejemplo, supongamos que estás aprendiendo matemáticas. Tu profesor te enseña qué significa
> "promedio" y cómo calcular el promedio de un conjunto de números. Una vez que te lo ha
> enseñado, pasa a otras cosas y simplemente dice "aquí calculas el promedio".
> Por ejemplo:
>
> > Para calcular la desviación estándar:
> > 
> > * Calcula el promedio de todos tus datos.
> > * Para cada número de tu conjunto de datos, calcula la diferencia entre ese número y el promedio.
> > * Después de hallar cada diferencia, elévala al cuadrado.
> > * Toma la raíz cuadrada del promedio de las diferencias al cuadrado.
> >
> No vuelven a explicar cómo calcular un promedio. Ya lo has aprendido y
> ahora pueden simplemente referirse a lo que ya sabes.
>
> De manera similar, en WebGPU tenemos el concepto de crear estructuras para uniformes en WGSL.
> Luego, crear uno o más uniform buffers (buffers de uniformes),
> y llenar esos buffers con datos usando `TypedArrays`. Hemos cubierto esto extensamente
> en los primeros 20-30 artículos de este sitio y en [el artículo sobre el diseño de la memoria (memory layout)](webgpu-memory-layout.html).
>
> En algún momento, sin embargo, se vuelve más difícil
> entender el código que trata con estos detalles en lugar de simplemente decir
> "establece el uniforme" y tú, habiendo aprendido previamente que "establecer los uniformes" significa
> "calcular el desplazamiento (offset) a las diversas piezas de datos, crear vistas de arreglos con tipo para
> que sea posible establecer esos datos, y luego, antes de renderizar, establecerlos y
> subir los valores a la GPU".
>
> Por lo tanto, no tengas miedo de las bibliotecas utilizadas en este sitio. Casi toda su
> funcionalidad se explica extensamente en los primeros artículos del sitio.
> A continuación se proporcionan más detalles.

Muchos de los ejemplos de este sitio utilizan dos bibliotecas.

## wgpu-matrix

La primera es [wgpu-matrix](https://github.com/greggman/wgpu-matrix). wgpu-matrix es una colección de
las mismas funciones que escribimos en 
[el artículo sobre matemáticas de matrices](webgpu-matrix-math.html) hasta
[el artículo sobre proyección en perspectiva](webgpu-perspective-projection.html), así como en
[el artículo sobre iluminación](webgpu-lighting-directional.html).

No ocurre nada especial aquí. Si quieres
saber cómo funciona cualquiera de las funciones matemáticas, puedes
leer los artículos mencionados arriba.

## webgpu-utils

La segunda es [webgpu-utils](https://github.com/greggman/webgpu-utils).

WebGPU Utils es una colección de otras funciones
útiles que hemos escrito en varios artículos.
Por ejemplo, las funciones:

* `numMipLevels`
* `loadImageBitmap`
* `copySourceToTexture`
* `createTextureFromSource`
* `createTextureFromImage`
* `generateMips`

Todas las cuales creamos en [el artículo sobre la importación de texturas](webgpu-importing-textures.html).

También incluye:

* `copySourcesToTexture`
* `createTextureFromSources`
* `generateMips`

De [el artículo sobre mapas de cubos (cubemaps)](webgpu-cubemaps.html).
En ese artículo actualizamos `generateMips` para manejar
múltiples capas.

E incluye cómo añadimos soporte para `premultipliedAlpha` en
[el artículo sobre transparencia y mezcla (transparency and blending)](webgpu-transparency.html).

La biblioteca también incluye:

* `createTextureFromImages`

de [el artículo sobre mapas de entorno (environment maps)](webgpu-environment-maps.html).

### `makeShaderDataDefinitions` y `makeStructuredView`

Estas 2 funciones se mencionaron brevemente en [el artículo sobre el diseño de la memoria (memory layout)](webgpu-memory-layout.html).

Como has visto en todos los [artículos fundamentales](webgpu-fundamentals.html), 
así como en los [artículos sobre matemáticas de matrices](webgpu-matrix-math.html) y
[los artículos sobre iluminación](webgpu-lighting-directional.html), cuando creamos
una estructura en WGSL, normalmente tenemos que crear un uniform buffer o un storage buffer (buffer de almacenamiento), y de alguna manera poner datos en él.

Puedes ver esto particularmente en los artículos sobre iluminación. Teníamos esta estructura:

```wgsl
struct Uniforms {
  matrix: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

Luego cambió a esto:

```wgsl
struct Uniforms {
  world: mat4x4f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

Luego a esto:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};
```

Y luego a esto:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightPosition: vec3f,
};
```

Seguido por esto:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
};
```

Y esto:

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
};
```

Y esto:

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
  limit: f32,
};
```

Y esto:

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
  innerLimit: f32,
  outerLimit: f32,
};
```

Cada vez que hacíamos estos cambios, teníamos que ir al código que configura las vistas
y editar muchísimas cosas. Para ilustrar lo que teníamos que hacer, aquí está la progresión:

Empezamos aquí en [el artículo sobre iluminación direccional](webgpu-lighting-directional.html).

```js
  // matriz + color + dirección de la luz
  const uniformBufferSize = (16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // desplazamientos (offsets) a los diversos valores de uniformes en índices float32
  const kMatrixOffset = 0;
  const kColorOffset = 16;
  const kLightDirectionOffset = 20;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

Luego esto:

```js
-  const uniformBufferSize = (16 + 4 + 4) * 4;
+  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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
       kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const lightDirectionValue =
       uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

Luego esto:

```js
-  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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

Y esto:

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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

Seguido por esto:

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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

Y esto:

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
```

Y esto:

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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

Y finalmente esto del final de [el artículo sobre focos (spot lighting)](webgpu-lighting-spot.html).

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4 + 4 + 4) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // desplazamientos a los diversos valores de uniformes en índices float32
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

Espero que puedas ver que: **¡ESTA VERBOSIDAD DISTRAE DEL PROPÓSITO DE LOS ARTÍCULOS!**
Todo lo que realmente queríamos decir es "cambia tu estructura de WGSL a esto, luego establece los valores
antes de dibujar", pero en su lugar tenemos más de 40 líneas de cambios de código para mostrar **POR CADA EJEMPLO**.

Usando las funciones `makeShaderDataDefinitions` y `makeStructuredView`,
todo el JavaScript anterior puede cambiarse a estas 7 líneas:

```js
const defs = makeShaderDataDefinitions(code);
const uni = makeStructuredView(defs.uniforms.uni);

const uniformBuffer = device.createBuffer({
  size: uni.arrayBuffer.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

Eso es todo. Entre muestras, cambiaríamos nuestra estructura
según corresponda, pero estas 2 funciones crearían todos esos desplazamientos y vistas por nosotros.

Para tomar la última estructura de ejemplo:

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
  innerLimit: f32,
  outerLimit: f32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
```

estas 2 líneas:

```js
const defs = makeShaderDataDefinitions(code);
const uni = makeStructuredView(defs.uniforms.uni);
```

crean una "vista estructurada" (structured view) para `uni`, el binding de uniforme que definimos
en nuestro `WGSL`.

Efectivamente, esas líneas hacen esto:

```js
const arrayBuffer = new ArrayBuffer(256);
const uni = {
  arrayBuffer,
  set: function(data) { /* ayudante */ },
  views: {
    normalMatrix: new Float32Array(arrayBuffer, 0, 12),
    worldViewProjection: new Float32Array(arrayBuffer, 48, 16),
    world: new Float32Array(arrayBuffer, 112, 16),
    color: new Float32Array(arrayBuffer, 176, 4),
    lightWorldPosition: new Float32Array(arrayBuffer, 192, 3),
    viewWorldPosition: new Float32Array(arrayBuffer, 208, 3),
    shininess: new Float32Array(arrayBuffer, 220, 1),
    lightDirection: new Float32Array(arrayBuffer, 224, 3),
    innerLimit: new Float32Array(arrayBuffer, 236, 1),
    outerLimit: new Float32Array(arrayBuffer, 240, 1),
  },
};
```

No hay magia aquí, excepto quizás el hecho de que
`makeShaderDataDefinitions` realmente analiza el WGSL
para extraer suficientes datos como para crear estas vistas.

En los artículos mencionados anteriormente había código como este para establecer los valores:

```js
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

    // Calcular una matriz de vista
    const viewMatrix = mat4.lookAt(eye, target, up);

    // Combinar las matrices de vista y proyección
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // Calcular una matriz de mundo
    const world = mat4.rotationY(settings.rotation, worldValue);

    // Combinar las matrices viewProjection y world
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // Invertirla y trasponerla en el valor worldInverseTranspose
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // verde
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
    innerLimitValue[0] = Math.cos(settings.innerLimit);
    outerLimitValue[0] = Math.cos(settings.outerLimit);

    // Dado que no tenemos un plano como en la mayoría de ejemplos de focos
    // apuntemos el foco hacia la F
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // obtener el eje zAxis de la matriz
        // negarlo porque lookAt mira hacia el eje -Z
        lightDirectionValue.set(mat.slice(8, 11));
    }

    // subir los valores de uniformes al uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

Ese código podría cambiarse por este:

```js
+    // Extraer las vistas utilizando los mismos nombres existentes.
+    const {
+      world: worldValue,
+      worldViewProjection: worldViewProjectionValue,
+      normalMatrix: normalMatrixValue,
+      color: colorValue,
+      lightWorldPosition: lightWorldPositionValue,
+      lightDirection: lightDirectionValue,
+      viewWorldPosition: viewWorldPositionValue,
+      shininess: shininessValue,
+      innerLimit: innerLimitValue,
+      outerLimit: outerLimitValue,
+    } = uni.views;

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

    // Calcular una matriz de vista
    const viewMatrix = mat4.lookAt(eye, target, up);

    // Combinar las matrices de vista y proyección
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // Calcular una matriz de mundo
    const world = mat4.rotationY(settings.rotation, worldValue);

    // Combinar las matrices viewProjection y world
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // Invertirla y trasponerla en el valor worldInverseTranspose
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // verde
    lightWorldPositionValue.set([-10, 30, 100]);
    viewWorldPositionValue.set(eye);
    shininessValue[0] = settings.shininess;
    innerLimitValue[0] = Math.cos(settings.innerLimit);
    outerLimitValue[0] = Math.cos(settings.outerLimit);

    // Dado que no tenemos un plano como en la mayoría de ejemplos de focos
    // apuntemos el foco hacia la F
    {
        const mat = mat4.aim(
            lightWorldPositionValue,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // obtener el eje zAxis de la matriz
        // negarlo porque lookAt mira hacia el eje -Z
        lightDirectionValue.set(mat.slice(8, 11));
    }

    // subir los valores de uniformes al uniform buffer
-    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
+    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

O podríamos usar las vistas directamente:

```js
-    // Extraer las vistas utilizando los mismos nombres existentes.
-    const {
-      world: worldValue,
-      worldViewProjection: worldViewProjectionValue,
-      normalMatrix: normalMatrixValue,
-      color: colorValue,
-      lightWorldPosition: lightWorldPositionValue,
-      lightDirection: lightDirectionValue,
-      viewWorldPosition: viewWorldPositionValue,
-      shininess: shininessValue,
-      innerLimit: innerLimitValue,
-      outerLimit: outerLimitValue,
-    } = uni.views;
+   const { views } = uni;

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

    // Calcular una matriz de vista
    const viewMatrix = mat4.lookAt(eye, target, up);

    // Combinar las matrices de vista y proyección
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // Calcular una matriz de mundo
-    const world = mat4.rotationY(settings.rotation, worldValue);
+    const world = mat4.rotationY(settings.rotation, views.world);

    // Combinar las matrices viewProjection y world
-    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);
+    mat4.multiply(viewProjectionMatrix, world, views.worldViewProjection);

    // Invertirla y trasponerla en el valor worldInverseTranspose
-    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), views.normalMatrix);

-    colorValue.set([0.2, 1, 0.2, 1]);  // verde
-    lightWorldPositionValue.set([-10, 30, 100]);
-    viewWorldPositionValue.set(eye);
-    shininessValue[0] = settings.shininess;
-    innerLimitValue[0] = Math.cos(settings.innerLimit);
-    outerLimitValue[0] = Math.cos(settings.outerLimit);
+    views.color.set([0.2, 1, 0.2, 1]);  // verde
+    views.lightWorldPosition.set([-10, 30, 100]);
+    views.viewWorldPosition.set(eye);
+    views.shininess[0] = settings.shininess;
+    views.innerLimit[0] = Math.cos(settings.innerLimit);
+    views.outerLimit[0] = Math.cos(settings.outerLimit);

    // Dado que no tenemos un plano como en la mayoría de ejemplos de focos
    // apuntemos el foco hacia la F
    {
        const mat = mat4.aim(
-            lightWorldPositionValue,
+            views.lightWorldPosition,
             [
               target[0] + settings.aimOffsetX,
               target[1] + settings.aimOffsetY,
               0,
             ],
             up);
        // obtener el eje zAxis de la matriz
        // negarlo porque lookAt mira hacia el eje -Z
-        lightDirectionValue.set(mat.slice(8, 11));
+        views.lightDirection.set(mat.slice(8, 11));
    }

    // subir los valores de uniformes al uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

O podríamos usar la función `set`, cuando sea apropiado, para hacer las cosas aún más fáciles:

```js
    const { views } = uni;

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

    // Calcular una matriz de vista
    const viewMatrix = mat4.lookAt(eye, target, up);

    // Combinar las matrices de vista y proyección
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // Calcular una matriz de mundo
    const world = mat4.rotationY(settings.rotation, views.world);

    // Combinar las matrices viewProjection y world
    mat4.multiply(viewProjectionMatrix, world, views.worldViewProjection);

    // Invertirla y trasponerla en el valor worldInverseTranspose
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), views.normalMatrix);

-    views.color.set([0.2, 1, 0.2, 1]);  // verde
-    views.lightWorldPosition.set([-10, 30, 100]);
-    views.viewWorldPosition.set(eye);
-    views.shininess[0] = settings.shininess;
-    views.innerLimit[0] = Math.cos(settings.innerLimit);
-    views.outerLimit[0] = Math.cos(settings.outerLimit);
+    uni.set({
+      color: [0.2, 1, 0.2, 1],  // verde
+      lightWorldPosition: [-10, 30, 100],
+      viewWorldPosition: eye,
+      shininess: settings.shininess,
+      innerLimit: settings.innerLimit,
+      outerLimit: settings.outerLimit,
+    });

    // Dado que no tenemos un plano como en la mayoría de ejemplos de focos
    // apuntemos el foco hacia la F
    {
        const mat = mat4.aim(
            views.lightWorldPosition,
            [
              target[0] + settings.aimOffsetX,
              target[1] + settings.aimOffsetY,
              0,
            ],
            up);
        // obtener el eje zAxis de la matriz
        // negarlo porque lookAt mira hacia el eje -Z
-        views.lightDirection.set(mat.slice(8, 11));
+        uni.set({ lightDirectionValue: mat.slice(8, 11) });
    }

    // subir los valores de uniformes al uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uni.arrayBuffer);
```

Puedes imaginar que la función `set`, al menos para el caso de uso mostrado arriba, es
bastante sencilla.

Esto funcionaría:

```js
const arrayBuffer = new ArrayBuffer(256);
const views = {
  normalMatrix: new Float32Array(arrayBuffer, 0, 12),
  worldViewProjection: new Float32Array(arrayBuffer, 48, 16),
  world: new Float32Array(arrayBuffer, 112, 16),
  color: new Float32Array(arrayBuffer, 176, 4),
  lightWorldPosition: new Float32Array(arrayBuffer, 192, 3),
  viewWorldPosition: new Float32Array(arrayBuffer, 208, 3),
  shininess: new Float32Array(arrayBuffer, 220, 1),
  lightDirection: new Float32Array(arrayBuffer, 224, 3),
  innerLimit: new Float32Array(arrayBuffer, 236, 1),
  outerLimit: new Float32Array(arrayBuffer, 240, 1),
};
const uni = {
  arrayBuffer,
  set: function(data) {
    // simplificado en exceso
    for (const [key, value] of Object.entries(data)) {
      const view = views[key];
      if (view) {
        view.set(typeof value === 'number' ? [value] : value);
      }
    }
  },
};
```

La implementación real de `set` es un poco más compleja para manejar
estructuras y arreglos anidados. Mira en el código fuente si deseas
ver los detalles.
Aquí está el código para 'set': [enlace](https://github.com/greggman/webgpu-utils/blob/cb61348691718e22f877e0011673f84d456927b6/src/buffer-views.ts#L291)
Y aquí está el código de la función a la que llama: [enlace](https://github.com/greggman/webgpu-utils/blob/cb61348691718e22f877e0011673f84d456927b6/src/buffer-views.ts#L386)

La esperanza es que el ejemplo anterior deje claro que
no es magia. Estas funciones simples pueden hacer que usar WebGPU sea mucho menos
tedioso y pueden hacer que explicar las cosas sea mucho más sencillo. Puedes simplemente
decir "establece los valores de los uniformes" en lugar de mostrar por 150ª vez
el tedio de calcular desplazamientos, crear vistas, etc.

## Vertex Buffers y Atributos

Otro lugar donde podemos reducir fácilmente el tedio es en la configuración de
los vertex buffers y sus atributos. El problema suele ser que
queremos algunos datos, como posiciones de vértices, normales de vértices,
coordenadas de textura de vértices. Podemos crearlos en arreglos separados.
Esto es fácil:

```js
const positions = [];
const normals = [];
const texcoords = [];

for(cada vértice) {
  ...
  position.push(x, y, z);
  normals.push(nx, ny, nz);
  texcoord.push(u, v);
}
```

Ahora tenemos la complicación añadida de que necesitamos 3 buffers
y 3 conjuntos de atributos.

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: [
*        // posición
*        {
*          arrayStride: 3 * 4, // 3 floats, 4 bytes cada uno
*          attributes: [
*            {shaderLocation: 0, offset: 0, format: 'float32x3'},
*          ],
*        },
*        // normales
*        {
*          arrayStride: 3 * 4, // 3 floats, 4 bytes cada uno
*          attributes: [
*            {shaderLocation: 1, offset: 0, format: 'float32x3'},
*          ],
*        },
*        // texcoords
*        {
*          arrayStride: 2 * 4, // 2 floats, 4 bytes cada uno
*          attributes: [
*            {shaderLocation: 2, offset: 0, format: 'float32x2',},
*          ],
*        },
*      ],
    },

...

  function createBuffer(device, values, usage) {
    const data = new Float32Array(values);
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage,
      mappedAtCreation: true,
    });
    const dst = new data.constructor(buffer.getMappedRange());
    dst.set(data);
    buffer.unmap();
    return buffer;
  }

  const positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX);
  const normalBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX);
  const texcoordBuffer = createBuffer(device, texcoords, GPUBufferUsage.VERTEX);

```

Más tedio. 😮‍💨

O podemos intentar intercalarlos. Esto puede ser
fácil o no. Si todos son del mismo tipo, como todos valores de punto flotante de
32 bits, entonces podemos hacer algo como:

```js
const vertexData = [];

for (cada vértice) {
  ...
  vertexData.push(
      x, y, z,
      nx, ny, nz,
      u, v);
}
```

Pero tan pronto como queremos intercalar, por ejemplo, colores de 8 bits, se vuelve
tedioso de nuevo:

```js
const numVertices = ...;
const numFloatsPerVertex = 3 + 3 + 2 + 1; // pos + nrm + uv + color()
const f32Data = new Float32Array(numFloatsPerVertex * numVertices);
const u8Data = new Uint8Array(f32Data.buffer);
const colorOffset = (3 + 3 + 2) * 4;

for (let i = 0; i < numVertices; ++i) {
   const floatOffset = numFloatsPerVertex * i;
   f32Data.set(
      [
        x, y, z,
        nx, ny, nz,
        u, v,
      ],
      floatOffset);
   const u8Offset = numFloatsPerVertex * i * 4 + colorOffset;
   u8Data.set(
      [ r, g, b, a ],
      u8Offset;
   );
}
```

Y aún no hemos terminado. Suponiendo que pongamos todos esos datos en un buffer,
todavía tenemos que configurar nuestro pipeline:

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: [
*        // posición
*        {
*          arrayStride: (3 + 3 + 2 + 1) * 4,
*          attributes: [
*            {shaderLocation: 0, offset: 0,  format: 'float32x3'},
*            {shaderLocation: 1, offset: 12, format: 'float32x3'},
*            {shaderLocation: 2, offset: 24, format: 'float32x2'},
*            {shaderLocation: 3, offset: 32, format: 'unorm8x4'},
*          ],
*        },
*      ],
    ...
```

Así que, de nuevo, crear algunos ayudantes puede eliminar este tedio.

Podemos crear una función a la que le pasemos esto:

```js
const positions = [];
const normals = [];
const texcoords = [];

const data = {
  positions,
  normals,
  texcoords,
};
```

Y que lo cree todo por nosotros. Intercala los datos,
crea los buffers y devuelve la porción `buffers` del
pipeline:

```js
const {
  bufferLayouts,
  buffers,
  numElements
} = createBuffersAndAttributesFromArrays(device, data);
```

Ahora los buffers ya están creados; por defecto solo hay 1 y los
datos están intercalados. Ese buffer es `buffers[0]`. También he devuelto
el `bufferLayout`, que es la porción del pipeline llamada buffers:

```js
  const pipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
*      buffers: bufferLayouts
    },
    ...
```

Y, dado que `buffers` es un arreglo, si queremos, podemos escribir
comandos de buffer como este:

```js
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    buffers.forEach((buffer, i) => pass.setVertexBuffer(i, buffer));
    ...
```

Así no tenemos que cambiar el código si hay más o menos buffers.

TBD: se necesita un ejemplo. Ninguno de los ejemplos existentes tiene suficientes datos
de vértices para ser simple pero interesante, excepto el de [webgpu-cube](../webgpu-cube.html),
pero es parte de un artículo sobre WebGPU desde WebGL y parece inapropiado.

Sin embargo, es una comparación razonablemente buena:

<div class="webgpu_center compare">
  <div>
    <div>WebGPU puro</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  function createBuffer(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage,
      mappedAtCreation: true,
    });
    const dst = new data.constructor(buffer.getMappedRange());
    dst.set(data);
    buffer.unmap();
    return buffer;
  }

  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
  const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
  const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

  const positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX);
  const normalBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX);
  const texcoordBuffer = createBuffer(device, texcoords, GPUBufferUsage.VERTEX);
  const indicesBuffer = createBuffer(device, indices, GPUBufferUsage.INDEX);

  const pipeline = device.createRenderPipeline({
    label: 'fake lighting',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      buffers: [
        // posición
        {
          arrayStride: 3 * 4, // 3 floats, 4 bytes cada uno
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},
          ],
        },
        // normales
        {
          arrayStride: 3 * 4, // 3 floats, 4 bytes cada uno
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x3'},
          ],
        },
        // texcoords
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes cada uno
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x2',},
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    ...(canvasInfo.sampleCount > 1 && {
        multisample: {
          count: canvasInfo.sampleCount,
        },
    }),
  });

  ...

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, normalBuffer);
    passEncoder.setVertexBuffer(2, texcoordBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
    passEncoder.drawIndexed(indices.length);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU Utils</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  const {
    buffers: [vertexBuffer],
    bufferLayouts,
    indexBuffer,
    indexFormat,
    numElements,
  } = createBuffersAndAttributesFromArrays(
    device, {
      positions: [1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1],
      normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
      texcoords: [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
      indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23],
    });

  const pipeline = device.createRenderPipeline({
    label: 'fake lighting',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      buffers: bufferLayouts,
    },
    fragment: {
      module: shaderModule,
      targets: [
        {format: presentationFormat},
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    ...(canvasInfo.sampleCount > 1 && {
        multisample: {
          count: canvasInfo.sampleCount,
        },
    }),
  });

  ...

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, indexFormat);
    passEncoder.drawIndexed(numElements);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
</div>


¿Qué pasa con un ejemplo más complejo, como el del
[artículo sobre los vertex buffers](webgpu-vertex-buffers.html#a-normalized-attributes)
que utiliza colores de 8 bits? Tenía 3 buffers. Uno tiene posiciones y colores por vértice. Otro tiene colores por círculo y desplazamientos por círculo, y el último
tiene escalas.

Cambiándolo para usar `createBuffersAndAttributesFromArrays`:

Primero cambiamos el código que crea los datos del círculo:

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 2 triángulos por subdivisión, 3 vértices por triángulo
-  const numVertices = numSubdivisions * 3 * 2;
-  // 2 valores de 32 bits para la posición (xy) y 1 valor de 32 bits para el color (rgb_)
-  // El valor de color de 32 bits se escribirá/leerá como 4 valores de 8 bits
-  const vertexData = new Float32Array(numVertices * (2 + 1));
-  const colorData = new Uint8Array(vertexData.buffer);

+  const positions = [];
+  const colors = [];

-  let offset = 0;
-  let colorOffset = 8;
   const addVertex = (x, y, r, g, b) => {
-    vertexData[offset++] = x;
-    vertexData[offset++] = y;
-    offset += 1;  // saltar el color
-    colorData[colorOffset++] = r * 255;
-    colorData[colorOffset++] = g * 255;
-    colorData[colorOffset++] = b * 255;
-    colorOffset += 9;  // saltar el byte extra y la posición
+    positions.push(x, y);
+    colors.push(r, g, b, 1);
   };

   const innerColor = [1, 1, 1];
   const outerColor = [0.1, 0.1, 0.1];

   // 2 vértices por subdivisión
   //
   // 0--1 4
   // | / /|
   // |/ / |
   // 2 3--5
   for (let i = 0; i < numSubdivisions; ++i) {
     const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
     const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

     const c1 = Math.cos(angle1);
     const s1 = Math.sin(angle1);
     const c2 = Math.cos(angle2);
     const s2 = Math.sin(angle2);

     // primer triángulo
     addVertex(c1 * radius, s1 * radius, ...outerColor);
     addVertex(c2 * radius, s2 * radius, ...outerColor);
     addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

     // segundo triángulo
     addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
     addVertex(c2 * radius, s2 * radius, ...outerColor);
     addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
   }

   return {
-    vertexData,
-    numVertices,
+    positions: { data: positions, numComponents: 2 },
+    colors,
   };
 }
```

Así que se volvió más sencillo.

El código que configura los vertex buffers cambia a este:

```js
  const kNumObjects = 100;
  const objectInfos = [];

-  // crear 2 vertex buffers
-  const staticUnitSize =
-    4 +     // el color son 4 bytes
-    2 * 4;  // el desplazamiento son 2 floats de 32 bits (4 bytes cada uno)
-  const changingUnitSize =
-    2 * 4;  // la escala son 2 floats de 32 bits (4 bytes cada uno)
-  const staticVertexBufferSize = staticUnitSize * kNumObjects;
-  const changingVertexBufferSize = changingUnitSize * kNumObjects;
-
-  const staticVertexBuffer = device.createBuffer({
-    label: 'static vertex for objects',
-    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-
-  const changingVertexBuffer = device.createBuffer({
-    label: 'changing storage for objects',
-    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-
-  // desplazamientos a los diversos valores de uniformes en índices float32
-  const kColorOffset = 0;
-  const kOffsetOffset = 1;

   const kScaleOffset = 0;

-  {
-    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
-    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
+  const staticColors = [];
+  const staticOffsets = [];

     for (let i = 0; i < kNumObjects; ++i) {
-      const staticOffsetU8 = i * staticUnitSize;
-      const staticOffsetF32 = staticOffsetU8 / 4;
-
-      // Estos solo se establecen una vez, así que se establecen ahora
-      staticVertexValuesU8.set(        // establecer el color
-          [rand() * 255, rand() * 255, rand() * 255, 255],
-          staticOffsetU8 + kColorOffset);
-
-      staticVertexValuesF32.set(      // establecer el desplazamiento
-          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
-          staticOffsetF32 + kOffsetOffset);
+      staticColors.push(rand() * 255, rand() * 255, rand() * 255, 255);
+      staticOffsets.push(rand(-0.9, 0.9), rand(-0.9, 0.9));

       objectInfos.push({
         scale: rand(0.2, 0.5),
       });
     }
-    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
-  }

   const {
     buffers: [staticVertexBuffer],
     bufferLayouts: [staticVertexBufferLayout],
   } = createBuffersAndAttributesFromArrays(device, {
     staticOffsets: { data: staticOffsets, numComponents: 2 },
     staticColors: new Uint8Array(staticColors),
   }, {stepMode: 'instance', shaderLocation: 2});

   const {
     buffers: [changingVertexBuffer],
     bufferLayouts: [changingVertexBufferLayout],
   } = createBuffersAndAttributesFromArrays(device, {
     scale: { data: kNumObjects * 2, numComponents: 2 },
   }, { stepMode: 'instance', shaderLocation: 4, usage: GPUBufferUsage.COPY_DST });

+  const vertexValues = new Float32Array(changingVertexBuffer.size / 4);
+  const changingUnitSize = 8;

-  // un arreglo con tipo que podemos usar para actualizar el changingStorageBuffer
-  const vertexValues = new Float32Array(changingVertexBufferSize / 4);
-
-  const { vertexData, numVertices } = createCircleVertices({
-    radius: 0.5,
-    innerRadius: 0.25,
-  });
-  const vertexBuffer = device.createBuffer({
-    label: 'vertex buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
-  });
-  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

+  const vertexArrays = createCircleVertices({
+    radius: 0.5,
+    innerRadius: 0.25,
+  });
+  const {
+    buffers: [vertexBuffer],
+    numElements,
+    bufferLayouts: [vertexBufferLayout],
+  } = createBuffersAndAttributesFromArrays(device, vertexArrays);
```

Eso se volvió mucho más corto.

El código que configura el pipeline cambia a este:

```js
   const pipeline = device.createRenderPipeline({
     label: 'per vertex color',
     layout: 'auto',
     vertex: {
       module,
       buffers: [
-        {
-          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes cada uno + 4 bytes
-          attributes: [
-            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // posición
-            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
-          ],
-        },
-        {
-          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes cada uno
-          stepMode: 'instance',
-          attributes: [
-            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
-            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
-          ],
-        },
-        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes cada uno
-          stepMode: 'instance',
-          attributes: [
-            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
-          ],
-        },
+        vertexBufferLayout,
+        staticVertexBufferLayout,
+        changingVertexBufferLayout,
       ],
     },
     fragment: {
       module,
       targets: [{ format: presentationFormat }],
     },
   });
```

Así que es más simple.

¿Es una victoria? Tendrás que decidirlo tú.

En adelante, sin embargo, algunos ejemplos empezarán a utilizar estas funciones
para concentrarse en el tema real del artículo en lugar de
perderse en los detalles de estas minucias. Con suerte, este artículo puede ayudar
a aclarar qué hacen estas funciones. No hacen nada que no se haya
cubierto ya. Así que, cuando veas algo como:

```js
const sphereData = createBuffersAndAttributesFromArrays(
   device,
   createSphereVertices(radius),
);
```

Espero que veas que hay 30-40 artículos en este sitio que explican
qué significa `createBuffersAndAttributesFromArrays` y que nada
sobre estas utilidades es aterrador o difícil de entender. Explicar
un concepto, darle un nombre y luego referirse a él por su nombre
es la norma en el aprendizaje. Te permite construir más fácilmente
conceptos de nivel superior.
