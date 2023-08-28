Title: WebGPU Perspective Projection
Description: Perspective Projection - smaller in the distance
TOC: Perspective Projection

This article is the 6th in a series of articles that will hopefully teach
you about 3D math. Each one builds on the previous lesson so you may find
them easiest to understand by reading them in order.

1. [Translation](webgpu-translation.html)
2. [Rotation](webgpu-rotation.html)
3. [Scaling](webgpu-scale.html)
4. [Matrix Math](webgpu-matrix-math.html)
5. [Orthographic Projection](webgpu-orthographic-projection.html)
6. [Perspective Projection](webgpu-perspective-projection.html) ⬅ you are here
7. [Cameras](webgpu-cameras.html)
8. [Matrix Stacks](webgpu-matrix-stacks.html)
9. [Scene Graphs](webgpu-scene-graphs.html)

In the last post we went over how to do 3D but that 3D didn't have any
perspective.  It was using what's called an "orthographic" view which has
its uses but it's generally not what people want when they say "3D".

Instead we need to add perspective. Just what is perspective?
It's basically the feature that things that are further away appear
smaller.

<img class="webgpu_center noinvertdark" style="width: 800px" src="resources/perspective-example.svg" />

Looking at the example above we see that things further away
are drawn smaller. Given our current sample one easy way to
make it so that things that are further away appear smaller
would be to divide the clip space X and Y by Z.

Think of it this way: If you have a line from (10, 15) to (20,15)
it's 10 units long. In our current sample it would be drawn 10 pixels
long. But if we divide by Z then for example if Z is 1

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 1 = 10
20 / 1 = 20
abs(10-20) = 10
</pre>
</div>

it would be 10 pixels long, If Z is 2 it would be

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 2 = 5
20 / 2 = 10
abs(5 - 10) = 5
</pre>
</div>

5 pixels long.  At Z = 3 it would be

<div class="webgpu_center">
<pre class="webgpu_math">
10 / 3 = 3.333
20 / 3 = 6.666
abs(3.333 - 6.666) = 3.333
</pre>
</div>

You can see that as Z increases, as it gets smaller, we'll end up
drawing it smaller, and therefore it will appear further way.
If we divide in clip space we might get better
results because Z will be a smaller number (0 to +1).  If we add a
fudgeFactor to multiply Z before we divide we can adjust how much smaller
things get for a given distance.

Let's try it.  First let's change the vertex shader to divide by Z after
we've multiplied it by our "fudgeFactor".

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

Note: By adding 1 we can set `fudgeFactor` to 0 and get a `zToDivideBy`
that is equal to 1. This will let is compare when not dividing by Z
because dividing by 1 does nothing.

We also need to update the code to let us set the fudgeFactor.

```js
-  // matrix
-  const uniformBufferSize = (16) * 4;
+  // matrix, fudgeFactor, padding
+  const uniformBufferSize = (16 + 1 + 3) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
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
        0,                   // left
        canvas.clientWidth,  // right
        canvas.clientHeight, // bottom
        0,                   // top
        1200,                // near
        -1000,               // far
        matrixValue,         // dst
    );
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);

+    fudgeFactorValue[0] = settings.fudgeFactor;
```

I also adjusted the `settings` to hopefully make it easy to see the results.

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

And here's the result.

{{{example url="../webgpu-perspective-projection-step-1-fudge-factor.html" }}}

If it's not clear drag the "fudgeFactor" slider from 10.0 to 0.0 to see
what things used to look like before we added our divide by Z code.

<img class="webgpu_center" src="resources/orthographic-vs-perspective.png" />
<div class="webgpu_center">orthographic vs perspective</div>

It turns out WebGPU takes the x,y,z,w value we assign to `@builtin(position)`
our vertex shader and divides it by w automatically.

We can prove this very easily by changing the shader and instead of doing
the division ourselves, put `zToDivideBy` in `vsOut.position.w`.

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

and see how it's exactly the same.

{{{example url="../webgpu-perspective-projection-step-2-gpu-divide-by-w.html" }}}

Why is the fact that WebGPU automatically divides by W useful?  Because
now, using more matrix magic, we can just use yet another matrix to copy z
to w.

A Matrix like this

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  0
</pre></div>

will copy z to w. You can look at each of those rows as

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


which when simplified is

<div class="webgpu_math_center"><pre class="webgpu_math">
x_out = x_in;
y_out = y_in;
z_out = z_in;
w_out = z_in;
</pre></div>

We can add the plus 1 we had before with this matrix since we know `w_in` is always 1.0.

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0  0
0  1  0  0
0  0  1  0
0  0  1  1
</pre></div>

that will change the W calculation to

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * 1 +
        w_in * 1 ;
</pre></div>

and since we know `w_in` = 1.0 then that's really

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in + 1;
</pre></div>

Finally we can work our fudgeFactor back in if the matrix is this

<div class="webgpu_math_center"><pre class="webgpu_math">
1  0  0            0
0  1  0            0
0  0  1            0
0  0  fudgeFactor  1
</pre></div>

which means

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = x_in * 0 +
        y_in * 0 +
        z_in * fudgeFactor +
        w_in * 1 ;
</pre></div>

and simplified that's

<div class="webgpu_math_center"><pre class="webgpu_math">
w_out = z_in * fudgeFactor + 1;
</pre></div>

So, let's modify the program again to just use matrices.

First let's put the vertex shader back so it's simple again

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
  vsOut position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

Next let's make a function to make a Z &rarr; W matrix.

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

and we'll change the code to use it.

```
-    mat4.ortho(
+    const projection = mat4.ortho(
        0,                   // left
        canvas.clientWidth,  // right
        canvas.clientHeight, // bottom
        0,                   // top
        1200,                // near
        -1000,               // far
-        matrixValue,         // dst
    );
+    mat4.multiply(makeZToWMatrix(settings.fudgeFactor), projection, matrixValue);
    mat4.translate(matrixValue, settings.translation, matrixValue);
    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
    mat4.scale(matrixValue, settings.scale, matrixValue);
```

and note, again, it's exactly the same.

{{{example url="../webgpu-perspective-projection-step-3-perspective-z-to-w.html" }}}

All that was basically just to show you that dividing by Z gives us
perspective and that WebGPU conveniently does this divide by Z for us.

But there are still some problems.  For example if you set Z to around
-1100 you'll see something like the animation below

<div class="webgpu-center"><div data-diagram="z-clipping" style="height: 400px;"></div></div>

What's going on?  Why is the F disappearing early?  Just like WebGPU clips
X and Y or +1 to -1 it also clips Z. Unlike X and Y, Z clips 0 to +1.
What we're seeing here is Z < 0 in clip space.

<div class="webgpu-center" style="width: 500px; height: 400px;"><div data-diagram="f-frustum-diagram"></div></div>

With with divide by W in place, our matrix math + the divide by W defines
a *frustum*. The front of the frustum is Z = 0, the back is Z = 1. Anything
outside of that is clipped.

<blockquote>
<h2>frustum</h2>
<p><i>noun</i>:</p>
<ol><li>a cone or pyramid with the upper part cut off by a plane parallel to its base</li></ol>
</blockquote>

I could go into detail about the math to fix it but [you can derive
it](https://stackoverflow.com/a/28301213/128511) the same way we did 2D
projection.  We need to take Z, add some amount (translation) and scale some amount and
we can make any range we want get remapped to the -1 to +1.

The cool thing is all of these steps can be done in 1 matrix.  Even
better, rather than a `fudgeFactor` we'll decide on a `fieldOfView` and
compute the right values to make that happen.

Here's a function to build the matrix.

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

This matrix will do all our conversions for us.  It will adjust the units
so they are in clip space, it will do the math so that we can choose a
field of view by angle and it will let us choose our Z-clipping space.  It
assumes there's an *eye* or *camera* at the origin (0, 0, 0) and given a
`zNear` and a `fieldOfView` it computes what it would take so that stuff
at `zNear` ends up at `Z = 0` and stuff at `zNear` that is half of
`fieldOfView` above or below the center ends up with `Y = -1` and `Y = 1`
respectively.  It computes what to use for X by just multiplying by the
`aspect` passed in.  We'd normally set this to the `width / height` of the
display area.  Finally, it figures out how much to scale things in Z so
that stuff at zFar ends up at `Z = 1`.

Here's a diagram of the matrix in action.

<div class="webgpu-center" style="width: 500px; height: 800px;"><div data-diagram="frustum-diagram"></div></div>

The matrix takes the space inside the frustum and
converts that to clip space.  `zNear` defines where things will get
clipped in the front and `zFar` defines where things get clipped in the
back.  Set `zNear` to 23 and you'll see the front of the spinning cubes
get clipped.  Set `zFar` to 24 and you'll see the back of the cubes get
clipped.

Let's use this function in our example.

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
-        0,                   // left
-        canvas.clientWidth,  // right
-        canvas.clientHeight, // bottom
-        0,                   // top
-        1200,                // near
-        -1000,               // far
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

There's just one problem left.  This projection matrix assumes there's a viewer at 0,0,0
and it assumes it's looking in the negative Z direction and that positive Y is
up.  Our matrices up to this point have done things in a different way.
We need to put the F, which is 150 units tall, 100 units wide, and 30 units thick,
in some -Z position and it needs to be far enough away that it fits inside the frustum.
The frustum we've defined above, with `zNear` = 1 will only show about 2.4 units from
top to bottom when an object is 1 unit away so our F will be %98 off the screen.

Playing around with some numbers I came up with these settings.

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

And, while we're at it let's adjust the UI settings to be more appropriate.
Let's also remove the scale to unclutter to UI a little.


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

Let's also get rid of the grid since we're no longer in "pixel space".

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
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
}
```

And here it is.

{{{example url="../webgpu-perspective-projection-step-4-perspective.html" }}}

We're back to just a matrix multiply on our shader and we're getting both a field of
view and we're able to choose our Z space.

Next up, [cameras](webgpu-cameras.html).

<div class="webgpu_bottombar">
<h3>Why did we move the F so far in Z (-120)?</h3>
<p>
In the other samples we had the F at (45, 100, 0) but in the last sample
it's been moved to (-65, 0, -120).  Why did it need to be moved so far
away?
</p>
<p>
The reason is up until this last sample our <code>mat4.projection</code> function
made a projection from pixels to clip space.  That means the area we
were displaying kinda of represented pixels.  Using 'pixels' really doesn't
make sense in 3D since it would only represent pixels at a specific distance from the camera.
</p>
<p>
In other words, with our new perspective projection matrix, if we tried to draw with the F with translation at 0,0,0 and rotation 0,0,0 it we'd get this
</p>
<div class="webgpu_center"><img src="resources/f-big-and-wrong-side.svg" style="width: 500px;"></div>
<p>
The F has its top left front corner at the origin. The perspective projection matrix
looks toward negative Z but our F is built in positive Z. The perspective projection matrix has
positive Y up but our F is built with positive Z down.
</p>
<p>
Our new projection only sees what's in the blue frustum. With -zNear = 1 and with a field of view of 100 degrees
then at Z = -1 the frustum is only 2.38 units tall and 2.38 * aspect units wide. At Z = -2000 (-zFar) its 4767 units tall.
Since our F is 150 units big and the view can only see 2.38
units when something is at <code>-zNear</code> we need to move it further away from the origin to see all of it.
</p>
<p>
Moving it -120 units in Z moves the F inside the frustum. We also rotated it to be right side up.
</p>
<div class="webgpu_center"><img src="resources/f-right-side.svg" style="width: 500px;"><div>not to scale</div></div>
</div>



<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-perspective-projection.js"></script>

