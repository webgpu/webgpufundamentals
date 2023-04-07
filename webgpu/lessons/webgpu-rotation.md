Title: WebGPU Rotation
Description: Rotating an object
TOC: Rotation

This article is the first of series of articles that will hopefully teach
you about 3D math. Each one builds on the previous lesson so you may find
them easiest to understand by reading them in order.

1. [Translation](webgpu-translation.html)
2. [Rotation](webgpu-rotation.html) ⬅ you are here
3. [Scaling](webgpu-scale.html)
4. [Matrix Math](webgpu-matrix-math.html)
5. [Orthographic Projection](webgpu-orthographic-projection.html)
6. [Perspective Projection](webgpu-perspective-projection.html)
7. [Cameras](webgpu-cameras.html)
8. [Matrix Stacks](webgpu-matrix-stacks.html)
9. [Scene Graphs](webgpu-scene-graphs.html)

I'm going to admit right up front I have no idea if how I explain this
 will make sense but what the heck, might as well try.

First I want to introduce you to what's called a "unit circle". If you
remember your junior high school math (don't go to sleep on me!) a
circle has a radius. The radius of a circle is the distance from the center
of the circle to the edge. A unit circle is a circle with a radius of 1.0.

Here's a unit circle.

<div class="webgpu_center"><div data-diagram="unit-circle" style="display: inline-block; width: 500px;"></div></div>

Notice as you drag the blue handle around the circle the X and Y positions
change. Those represent the position of that point on the circle. At the
top Y is 1 and X is 0. On the right X is 1 and Y is 0.

If you remember from basic 3rd grade math if you multiply something by 1
it stays the same. So 123 * 1 = 123. Pretty basic, right? Well, a unit circle,
a circle with a radius of 1.0 is also a form of 1. It's a rotating 1.
So you can multiply something by this unit circle and in a way it's kind
of like multiplying by 1 except magic happens and things rotate.

We're going to take that X and Y value from any point on the unit circle
and we'll multiply our vertex positions by them from [our previous example](webgpu-translation.html).

Here are the updates to our shader.


```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
+  rotation: vec2f,
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

+  // Rotate the position
+  let rotatedPosition = vec2f(
+    vert.position.x * uni.rotation.y + vert.position.y * uni.rotation.x,
+    vert.position.y * uni.rotation.y - vert.position.x * uni.rotation.x
+  );

  // Add in the translation
-  let position = vert.position + uni.translation;
+  let position = rotatedPosition + uni.translation;

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

And we update the JavaScript to add space to the new uniform value.

```js
-  // color, resolution, translation
-  const uniformBufferSize = (4 + 2 + 2) * 4;
+  // color, resolution, translation, rotation, padding
+  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
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
+  const kRotationOffset = 8;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
+  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
```

And we need some kind of UI. This isn't a tutorial about making UIs so
I'm just going to use one. First some HTML to give it a place to be

```html
  <body>
    <canvas></canvas>
+    <div id="circle"></div>
  </body>
```

Then some CSS to put it somewhere

```css
#circle {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 300px;
  background-color: var(--bg-color);
}
```

and finally the JavaScript to use it.

```js
+import UnitCircle from './resources/js/unit-circle.js';

...

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');

+  const unitCircle = new UnitCircle();
+  document.querySelector('#circle').appendChild(unitCircle.domElement);
+  unitCircle.onChange(render);

  function render() {
    ...

    // Set the uniform values in our JavaScript side Float32Array
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
+    rotationValue.set([unitCircle.x, unitCircle.y]);

    // upload the uniform values to the uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

And here's the result. Drag the handle on the circle to rotate
or the sliders to translate.

{{{example url="../webgpu-rotation-via-unit-circle.html"}}}

Why does it work? Well, look at the math.

<pre class="webgpu_center">
    rotatedX = a_position.x * u_rotation.y + a_position.y * u_rotation.x;
    rotatedY = a_position.y * u_rotation.y - a_position.x * u_rotation.x;
</pre>

Let's say you have a rectangle and you want to rotate it.
Before you start rotating it the top right corner is at 3.0, 9.0.
Let's pick a point on the unit circle 30 degrees clockwise from 12 o'clock.

<img src="resources/rotate-30.png" class="webgpu_center invertdark" />

The position on the circle there is 0.50 and 0.87

<pre class="webgpu_center">
   3.0 * 0.87 + 9.0 * 0.50 = 7.1
   9.0 * 0.87 - 3.0 * 0.50 = 6.3
</pre>

That's exactly where we need it to be

<img src="resources/rotation-drawing.svg" width="500" class="webgpu_center"/>

The same for 60 degrees clockwise

<img src="resources/rotate-60.png" class="webgpu_center invertdark" />

The position on the circle there is 0.87 and 0.50

<pre class="webgpu_center">
   3.0 * 0.50 + 9.0 * 0.87 = 9.3
   9.0 * 0.50 - 3.0 * 0.87 = 1.9
</pre>

You can see that as we rotate that point clockwise to the right the X
value gets bigger and the Y gets smaller. If we kept going past 90 degrees
X would start getting smaller again and Y would start getting bigger.
That pattern gives us rotation.

There's another name for the points on a unit circle. They're called
the sine and cosine. So for any given angle we can just look up the
sine and cosine like this.

    function printSineAndCosineForAnAngle(angleInDegrees) {
      const angleInRadians = angleInDegrees * Math.PI / 180;
      const s = Math.sin(angleInRadians);
      const c = Math.cos(angleInRadians);
      console.log('s =', s, 'c =', c);
    }

If you copy and paste the code into your JavaScript console and
type `printSineAndCosignForAngle(30)` you see it prints
`s = 0.49 c = 0.87` (note: I rounded off the numbers)

If you put it all together you can rotate your vertex positions to any angle
you desire. Just set the rotation to the sine and cosine of the angle
you want to rotate to.

      ...
      const angleInRadians = angleInDegrees * Math.PI / 180;
      rotation[0] = Math.sin(angleInRadians);
      rotation[1] = Math.cos(angleInRadians);

Let's change things to just have an rotation setting.

```js
+  const degToRad = d => d * Math.PI / 180;
+  const radToDeg = r => r * 180 / Math.PI;

  const settings = {
    translation: [150, 100],
+    rotation: degToRad(30),
  };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
+  gui.add(settings, 'rotation', {
+      min: -360,
+      max: 360,
+      step: 1,
+      converters: {
+        to: radToDeg,
+        from: v => [true, degToRad(v)],
+      },
+    });

-  const unitCircle = new UnitCircle();
-  document.querySelector('#circle').appendChild(unitCircle.domElement);
-  unitCircle.onChange(render);

  function render() {
    ...

    // Set the uniform values in our JavaScript side Float32Array
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
-    rotationValue.set([unitCircle.x, unitCircle.y]);
+    rotationValue.set([
+        Math.cos(settings.rotation),
+        Math.sin(settings.rotation),
+    ]);
```

Drag the sliders to translate or rotate.

{{{example url="../webgpu-rotation.html"}}}

I hope that made some sense. [Next up a simpler one. Scale](webgpu-scale.html).

<div class="webgpu_bottombar"><h3>What are radians?</h3>
<p>
Radians are a unit of measurement used with circles, rotation and angles.
Just like we can measure distance in inches, yards, meters, etc we can
measure angles in degrees or radians.
</p>
<p>
You're probably aware that math with metric measurements is easier than
math with imperial measurements. To go from inches to feet we divide by 12.
To go from inches to yards we divide by 36. I don't know about you but I
can't divide by 36 in my head. With metric it's much easier. To go from
millimeters to centimeters we divide by 10. To go from millimeters to meters
we divide by 1000. I **can** divide by 1000 in my head.
</p>
<p>
Radians vs degrees are similar. Degrees make the math hard. Radians make
the math easy. There are 360 degrees in a circle but there are only 2π radians.
So a full turn is 2π radians. A half turn is 1π radian. A 1/4 turn, ie 90 degrees
is 1/2π radians. So if you want to rotate something 90 degrees just use
<code>Math.PI * 0.5</code>. If you want to rotate it 45 degrees use
<code>Math.PI * 0.25</code> etc.
</p>
<p>
Nearly all math involving angles, circles or rotation works very simply
if you start thinking in radians. So give it try. Use radians, not degrees,
except in UI displays.
</p>
</div>

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-rotation.js"></script>

