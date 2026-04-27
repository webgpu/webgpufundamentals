Title: Escalado en WebGPU
Description: Escalar un objeto
TOC: Escalado

Este artículo es el tercero de una serie que esperamos que te enseñe sobre matemáticas 3D. Cada uno se basa en la lección anterior, por lo que es posible que te resulten más fáciles de entender leyéndolos en orden.

1. [Traslación](webgpu-translation.html)
2. [Rotación](webgpu-rotation.html)
3. [Escalado](webgpu-scale.html) ⬅ estás aquí
4. [Matemáticas de matrices](webgpu-matrix-math.html)
5. [Proyección ortográfica](webgpu-orthographic-projection.html)
6. [Proyección en perspectiva](webgpu-perspective-projection.html)
7. [Cámaras](webgpu-cameras.html)
8. [Pilas de matrices](webgpu-matrix-stacks.html)
9. [Grafos de escena](webgpu-scene-graphs.html)

Escalar es tan [fácil como trasladar](webgpu-translation.html).

Multiplicamos las posiciones de los vértices por nuestro escalado deseado. Aquí están los cambios en el shader de nuestro [ejemplo anterior](webgpu-rotation.html).

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
  rotation: vec2f,
  scale: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

+  // Escalar la posición
+  let scaledPosition = vert.position * uni.scale;

  // Rotar la posición
  let rotatedPosition = vec2f(
-    vert.position.x * uni.rotation.y - vert.position.y * uni.rotation.x,
-    vert.position.x * uni.rotation.x + vert.position.y * uni.rotation.y
+    scaledPosition.x * uni.rotation.y - scaledPosition.y * uni.rotation.x,
+    scaledPosition.x * uni.rotation.x + scaledPosition.y * uni.rotation.y
  );

  // Añadir la traslación
  let position = rotatedPosition + uni.translation;

  // convertir la posición de píxeles a un valor de 0.0 a 1.0
  let zeroToOne = position / uni.resolution;

  // convertir de 0 <-> 1 a 0 <-> 2
  let zeroToTwo = zeroToOne * 2.0;

  // convertir de 0 <-> 2 a -1 <-> +1 (espacio de recorte)
  let flippedClipSpace = zeroToTwo - 1.0;

  // invertir Y
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}
```

Y, como antes, necesitamos actualizar nuestro buffer de uniform para tener espacio para el valor de escalado.

```js
-  // color, resolution, translation, rotation, padding
-  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
+  // color, resolution, translation, rotation, scale
+  const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
   const uniformBuffer = device.createBuffer({
     label: 'uniforms',
     size: uniformBufferSize,
     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
   });

   const uniformValues = new Float32Array(uniformBufferSize / 4);

   // offsets a los diversos valores de uniform en índices float32
   const kColorOffset = 0;
   const kResolutionOffset = 4;
   const kTranslationOffset = 6;
   const kRotationOffset = 8;
+  const kScaleOffset = 10;

   const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
   const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
   const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
   const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
+  const scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);
```

y en el momento del renderizado necesitamos actualizar el escalado:

```js
   const settings = {
     translation: [150, 100],
     rotation: degToRad(30),
+    scale: [1, 1],
   };

   const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

   const gui = new GUI();
   gui.onChange(render);
   gui.add(settings.translation, '0', 0, 1000).name('translation.x');
   gui.add(settings.translation, '1', 0, 1000).name('translation.y');
   gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings.scale, '0', -5, 5).name('scale.x');
+  gui.add(settings.scale, '1', -5, 5).name('scale.y');

   function render() {
     ...

     // Establecer los valores de uniform en nuestro Float32Array del lado de JavaScript
     resolutionValue.set([canvas.width, canvas.height]);
     translationValue.set(settings.translation);
     rotationValue.set([
         Math.cos(settings.rotation),
         Math.sin(settings.rotation),
     ]);
+    scaleValue.set(settings.scale);

     // subir los valores de uniform al buffer de uniform
     device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

Y ahora tenemos el escalado. Arrastra los deslizadores.

{{{example url="../webgpu-scale.html" }}}

Una cosa a tener en cuenta es que escalar por un valor negativo invierte nuestra geometría.

Otra cosa a notar es que escala desde el punto 0, 0, que para nuestra F es la esquina superior izquierda. Eso tiene sentido ya que estamos multiplicando las posiciones por el escalado, se alejarán de 0, 0. Probablemente puedas imaginar formas de solucionar eso. Por ejemplo, podrías añadir otra traslación antes de escalar, una traslación *pre-escalado*. Otra solución sería cambiar los datos de posición reales de la F. Pronto veremos otra forma.

Espero que estas últimas 3 publicaciones hayan sido útiles para entender la [traslación](webgpu-translation.html), [rotación](webgpu-rotation.html) y el escalado. A continuación veremos [la magia de las matrices](webgpu-matrix-math.html), que combina estas tres en una forma **mucho más simple** y a menudo más útil.
