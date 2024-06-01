Title: WebGPU - Point Lighting
Description: How to implement point lighting in WebGPU
TOC: Point Lighting

This article is a continuation of [WebGPU Directional Lighting](webgpu-lighting-directional.html).
If you haven't read that I suggest [you start there](webgpu-lighting-directional.html).

In the previous article we covered directional lighting where the light is coming
universally from the same direction. We set that direction before rendering.

What if instead of setting the direction for the light we picked a point in 3d space for the light
and computed the direction from that point to each visible spot on the surface of our model in our shader?
That would give us a point light.

{{{diagram url="resources/point-lighting.html" width="700" height="400" className="noborder" }}}

If you rotate the surface above you'll see how each point on the surface has a different
*surface to light* vector. Getting the dot product of the surface normal and each individual
surface to light vector gives us a different value at each point on the surface.

So, let's do that.

First we need the light position

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
-  lightDirection: vec3f,
+  lightPosition: vec3f,
};
```

And we need a way to compute the world position of the surface. For that we can multiply
our positions by the world matrix so ...

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
+  world: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
  lightPosition: vec3f,
};

....

  // Compute the world position of the surface
  let surfaceWorldPosition = (u_world * vert.position).xyz;


```

And we can compute a vector from the surface to the light which is similar to the
light direction we had before except this time we're computing it for every position on the
surface to a light's world position point.

```wgsl
  struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) surfaceToLight: vec3f,
  };

  ...

    // Compute the vector of the surface to the light
    // and pass it to the fragment shader
    vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;
```

Here's all that in context

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

  // Orient the normals and pass to the fragment shader
  vsOut.normal = uni.normalMatrix * vert.normal;

*  // Compute the world position of the surface
*  let surfaceWorldPosition = (uni.world * vert.position).xyz;
*
*  // Compute the vector of the surface to the light
*  // and pass it to the fragment shader
*  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

  return vsOut;
}
```

Now in the fragment shader we need to normalize the surface to light vector
since it's a not a unit vector. Note that we could normalize in the vertex shader
but because it's an *inter-stage variable* it will be linearly interpolated between our positions
and so would not be a complete unit vector

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Because vsOut.normal is an inter-stage variable 
  // it's interpolated so it will not be a unit vector.
  // Normalizing it will make it a unit vector again
  let normal = normalize(vsOut.normal);

+  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // Compute the light by taking the dot product
-  // of the normal to the light's reverse direction
-  let light = dot(normal, -uni.lightDirection);
+  // of the normal with the direction to the light
+  let light = dot(normal, surfaceToLightDirection);

  // Lets multiply just the color portion (not the alpha)
  // by the light
  let color = uni.color.rgb * light;
  return vec4f(color, uni.color.a);
}
```

Then we need to update our uniform buffer, offsets, and views

```js
-  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
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

and we need to set them

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // Compute a view matrix
    const viewMatrix = mat4.lookAt(eye, target, up);

    // Combine the view and projection matrixes
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    // Compute a world matrix
-    const world = mat4.rotationY(settings.rotation);
+    const world = mat4.rotationY(settings.rotation, worldValue);

    // Combine the viewProjection and world matrices
    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);

    // Inverse and transpose it into the worldInverseTranspose value
    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // green
=    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
+    lightPositionValue.set([-10, 30, 100]);

    // upload the uniform values to the uniform buffer
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

```

And here it is

{{{example url="../webgpu-lighting-point.html" }}}

Now that we have a point we can add something called specular highlighting.

If you look at on object in the real world, if it's remotely shiny, then if it happens
to reflect the light directly at you it's almost like a mirror

<img class="webgpu_center" src="resources/specular-highlights.jpg" />

We can simulate that effect by computing if the light reflects into our eyes. Again the *dot-product*
comes to the rescue.

What do we need to check? Well let's think about it. Light reflects at the same angle it hits a surface
so if the direction of the surface to the light is the exact reflection of the surface to the eye
then it's at the perfect angle to reflect

{{{diagram url="resources/surface-reflection.html" width="700" height="400" className="noborder" }}}

If we know the direction from the surface of our model to the light (which we do since we just did that).
And if we know the direction from the surface to view/eye/camera, which we can compute, then we can add
those 2 vectors and normalize them to get the `halfVector` which is the vector that sits half way between them.
If the halfVector and the surface normal match then it's the perfect angle to reflect the light into
the view/eye/camera. And how can we tell when they match? Take the *dot product* just like we did
before. 1 = they match, same direction, 0 = they're perpendicular, -1 = they're opposite.

{{{diagram url="resources/specular-lighting.html" width="700" height="400" className="noborder" }}}

So first thing is we need to pass in the view/camera/eye position, compute the surface to view vector
and pass it to the fragment shader.

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

  // Orient the normals and pass to the fragment shader
  vsOut.normal = uni.normalMatrix * vert.normal;

  // Compute the world position of the surface
  let surfaceWorldPosition = (uni.world * vert.position).xyz;

  // Compute the vector of the surface to the light
  // and pass it to the fragment shader
  vsOut.surfaceToLight = uni.lightPosition - surfaceWorldPosition;

+  // Compute the vector of the surface to the light
+  // and pass it to the fragment shader
+  vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;

  return vsOut;
}
```

Next in the fragment shader we need to compute the `halfVector` between
the surface to view and surface to light vectors. Then we can take the dot
product the `halfVector` and the normal to find out if the light is reflecting
into the view.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // Because vsOut.normal is an inter-stage variable 
  // it's interpolated so it will not be a unit vector.
  // Normalizing it will make it a unit vector again
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);

  // Compute the light by taking the dot product
  // of the normal with the direction to the light
  let light = dot(normal, surfaceToLightDirection);

+  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
+  let halfVector = normalize(
+    surfaceToLightDirection + surfaceToViewDirection);
+  let specular = dot(normal, halfVector);

  // Lets multiply just the color portion (not the alpha)
  // by the light
-  let color = uni.color.rgb * light;
+  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

Again we have add room for viewWorldPosition to our
uniformBuffer.

```js
-  const uniformBufferSize = (12 + 16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // offsets to the various uniform values in float32 indices
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

and set it

```js
    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    ...

    viewWorldPositionValue.set(eye);
```

And here's that

{{{example url="../webgpu-lighting-point-w-specular.html" }}}

**DANG THAT'S BRIGHT!**

We can fix the brightness by raising the dot-product result to a power. This will scrunch up
the specular highlight from a linear falloff to an exponential falloff.

{{{diagram url="resources/power-graph.html" width="400" height="400" className="noborder" }}}

The closer the red line is to the top of the graph the brighter our specular addition
will be. By raising the power it scrunches the range where it goes bright to the
right.

Let's call that `shininess` and add it to our shader.

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
+      0.0,                           // value if condition false
+      pow(specular, uni.shininess),  // value if condition is true
+      specular > 0.0);               // condition
```

The dot product can go negative. Taking a negative number to a power is undefined in WebGPU (or is NaN?) which would be bad. So, if the dot product is negative then we just leave specular at 0.0.

Of course we need to set `shininess`.

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

And here's that

{{{example url="../webgpu-lighting-point-w-specular-power.html" }}}

Coming up next [spot lighting](webgpu-lighting-spot.html).

<div class="webgpu_bottombar">
<h3>Why is <code>pow(negative, power)</code> undefined?</h3>
<p>What does this mean?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 2)</pre></div>
<p>Well you can look at it as</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 = 25</pre></div>
<p>What about</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(5, 3)</pre></div>
<p>Well you can look at that as</p>
<div class="webgpu_center"><pre class="glocal-center-content">5 * 5 * 5 = 125</pre></div>
<p>Ok, how about</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2)</pre></div>
<p>Well that could be</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 = 25</pre></div>
<p>And</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 3)</pre></div>
<p>Well you can look at as</p>
<div class="webgpu_center"><pre class="glocal-center-content">-5 * -5 * -5 = -125</pre></div>
<p>As you know multiplying a negative by a negative makes a positive. Multiplying by a negative
again makes it negative.</p>
<p>Well then what does this mean?</p>
<div class="webgpu_center"><pre class="glocal-center-content">pow(-5, 2.5)</pre></div>
<p>How do you decide whether the result of that positive or negative? That's
the land of <a href="https://betterexplained.com/articles/a-visual-intuitive-guide-to-imaginary-numbers/">imaginary numbers</a>.</p>
</div>

