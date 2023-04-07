Title: WebGPU Scale
Description: Scaling an Object
TOC: Scale

This article is the 3nd in a series of articles that will hopefully teach
you about 3D math. Each one builds on the previous lesson so you may find
them easiest to understand by reading them in order.

1. [Translation](webgpu-translation.html)
2. [Rotation](webgpu-rotation.html)
3. [Scaling](webgpu-scale.html) ⬅ you are here
4. [Matrix Math](webgpu-matrix-math.html)
5. [Orthographic Projection](webgpu-orthographic-projection.html)
6. [Perspective Projection](webgpu-perspective-projection.html)
7. [Cameras](webgpu-cameras.html)
8. [Matrix Stacks](webgpu-matrix-stacks.html)
9. [Scene Graphs](webgpu-scene-graphs.html)

Scaling is just as [easy as translation](webgpu-translation.html).

We multiply the vertex positions by our desired scale. Here are the changes
to the shader from our [previous example](webgpu-rotation.html).

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

+  // Scale the position
+  let scaledPosition = vert.position * uni.scale;

  // Rotate the position
  let rotatedPosition = vec2f(
-    vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x,
-    vert.position.y * uni.rotation.y - vert.position.x * uni.rotation.x
+    scaledPosition.x * uni.rotation.y + scaledPosition.y * uni.rotation.x,
+    scaledPosition.y * uni.rotation.y - scaledPosition.x * uni.rotation.x
  );

  // Add in the translation
  let position = rotatedPosition + uni.translation;

  // convert the position from pixels to a 0.0 to 1.0 value
  let zeroToOne = position / uni.resolution;

  // convert from 0 <-> 1 to 0 <-> 2
  let zeroToTwo = zeroToOne * 2.0;

  // covert from 0 <-> 2 to -1 <-> +1 (clip space)
  let flippedClipSpace = zeroToTwo - 1.0;

  // flip Y
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}
```

And, like before, we need to update our uniform buffer to have room for
the scale value.

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

  // offsets to the various uniform values in float32 indices
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

and at render time we need to update the scale

```js
  const settings = {
    translation: [150, 100],
    rotation: degToRad(30),
+    scale: [1, 1],
  };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings, 'rotation', {
      min: -360,
      max: 360,
      step: 1,
      converters: {
        to: radToDeg,
        from: v => [true, degToRad(v)],
      },
    });
+  gui.add(settings.scale, '0', -5, 5).name('scale.x');
+  gui.add(settings.scale, '1', -5, 5).name('scale.y');

  function render() {
    ...

    // Set the uniform values in our JavaScript side Float32Array
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
    rotationValue.set([
        Math.cos(settings.rotation),
        Math.sin(settings.rotation),
    ]);
+    scaleValue.set(settings.scale);

    // upload the uniform values to the uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

And now we have scale. Drag the sliders.

{{{example url="../webgpu-scale.html" }}}

One thing to notice is that scaling by a negative value flips our geometry.

Another thing to notice is it scales from 0, 0 which for our F is the
top left corner. That makes sense since we're multiplying the positions
by the scale they will move away from 0, 0. You can probably
imagine ways to fix that. For example you could add another translation
before you scale, a *pre scale* translation. Another solution would be
to change the actual F position data. We'll go over another way soon.

I hope these last 3 posts were helpful in understanding
[translation](webgpu-translation.html), [rotation](webgpu-rotation.html)
and scale. Next we'll go over [the magic that is matrices](webgpu-matrix-math.html)
that combines all 3 of these into a **much simpler** and often more useful form.
