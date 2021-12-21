Title: WebGPU from WebGL
Description: Comparing using WebGL to WebGPU
TOC: WebGPU from WebGL

This article is meant for people who already know WebGL and want to start
using WebGPU.

If you're coming from WebGL to WebGPU it's worth noting that many of the
concepts are the same. Both WebGL and WebGPU let you run small functions on the
GPU. WebGL has vertex shaders and fragment shaders. WebGPU has the same plus
compute shaders. WebGL uses GLSL as its shading language. WebGPU uses WGSL.
While they are different languages the concepts are mostly the same.

Both APIs have attributes, a way to specify data pulled from buffers and fed
each iteration of a vertex shader. Both APIs have uniforms, a way to specify
values shared by all iterations of a shader function. Both APIs have varyings, a
way to pass data from a vertex shader to a fragment shader and interpolate
between values computed by the vertex shader when rasterizing via a fragment
shader. Both APIs have textures and samplers, ways to provide 2D or 3D data and
sample it (filter multiple pixels into a single value). Both APIs provide ways
to render to textures. And, both have a bunch of settings for how pixels are
blended, how the depth buffer and stencil buffers work, etc...

The biggest difference is WebGL is a stateful API and WebGPU is not. By that I
mean in WebGL there is whole bunch of global state. Which textures are currently
bound, which buffers are currently bound, what the current program is, what the
blending, depth, and stencil settings are. You set those states by calling
various API functions like `gl.bindBuffer` or `gl.enable` etc and they stay
what you set them *globally* until you change them to something else.

By contrast, In WebGPU there is almost no *global* state. Instead there concepts
of a *pipeline* and a *render pass* which effectively contain most of the state
that was global in WebGL. Which textures, which attributes, which buffers, and
all the various other settings. Any settings you don't set have default values.
You can't modify a pipeline. Instead you create them and after that they are
immutable. If you want different settings you need to create another pipeline.
*render passes* do have some state but that state is local to the render pass.

The second biggest difference is that WebGPU **is lower level** than WebGL. In
WebGL many things connect by names. For example you declare a uniform in GLSL
and you look up its location 

```js
loc = gl.getUniformLocation(program, 'nameOfUniform');
```

Another example is varyings, in a vertex shader you use
`varying vec2 v_texcoord` or `out vec2 v_texcoord` and in the fragment shader
you declare the corresponding varying naming it `v_texcoord`. The good part of
this is if you mis-type the name you'll get an error.

WebGPU, on the other hand, everything is entirely connected by index or byte
offset. You don't create individual uniforms like WebGL, instead you declare
uniform blocks (a structure that declares your uniforms). It's then up to you to
make sure you manually organize the data you pass to the shader to match that
structure. Note: WebGL2 has the same concept, known as Uniform Blocks, but
WebGL2 also had the concept of uniforms by name. And, even though individual
fields in a WebGL2 Uniform Block needed to be set via byte offsets, (a) you
could query WebGL2 for those offsets and (b) you could still look up the block
locations themselves by name.

In WebGPU on the other hand **EVERYTHING** is by byte offset or index (often
called '*location*'). That means it's entirely up to you to keep those locations
in sync and to manually compute byte offsets.

To give a JavaScript analogy:

```js
function likeWebGL(inputs) {
  const {position, texcoords, normal, color} = inputs;
  ...
}

function likeWebGPU(inputs) {
  const [position, texcoords, normal, color] = inputs;
  ...
}
```

In the `likeWebGL` example above, things are connected by name. We can call
`likeWebGL` like this

```js
likeWebGL({normal, color, position});
```

Notice because we are connected by names, the order of our parameters does not
matter. Further, we can skip a parameter (`texcoords` in the example above)
assuming the function can run without `texcoords`.

On the other hand with `likeWebGPU`

```js
likeWebGPU([position, undefined, normal, color]);
```

We pass in our parameters in an array. Notice we have to pass in something for
`texcoords` because if we didn't things would get out of order and the `normal` we
passed into`likeWebGPU` would become `texcoords` inside the function. Keeping
the code inside (WGSL) and outside (JavaScript/WASM) in sync in WebGPU is
entirely your responsibility.

### Other notable differences

* The Canvas

  WebGL manages the canvas itself for you. You choose antialias,
  preserveDrawingBuffer, stencil, depth, alpha when you create the WebGL context
  and after that WebGL manages the canvas itself. All you have to is set
  `canvas.width` and `canvas.height`.

  WebGPU you have to do all of that yourself. You create the canvas's
  drawingbuffer (with or without alpha) and if you want a depth buffer you create
  that yourself too (with or without a stencil buffer). If you want to resize you
  need to delete the old ones and create new ones yourself.

  But, because of that, unlike WebGL, you can use one WebGPU device to
  render to multiple canvases.

* WebGPU does not generate mipmaps.

  In WebGL you could create a texture's level 0 mip and then call
  `gl.generateMipmap` and WebGL would generate all the other mip levels. WebGPU
  has no such function. If you want mips for your textures you have to generate
  them yourself.

* WebGPU requires samplers

  In WebGL1, samplers did not exist or to put it another way, samplers were handled
  by WebGL internally. In WebGL2 using samplers was optional. In WebGPU
  samplers are required.

## Let's compare WebGL to WebGPU

### Shaders

Here is a shader that draws textured, lit, triangles. One in GLSL and the other
in WGSL.

<div class="webgpu_center compare"><div><div>GLSL</div><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const vSrc = `
uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;

attribute vec4 a_position;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

varying vec2 v_texCoord;
varying vec3 v_normal;

void main() {
  gl_Position = u_worldViewProjection * a_position;
  v_texCoord = a_texcoord;
  v_normal = (u_worldInverseTranspose * vec4(a_normal, 0)).xyz;
}
`;

const fSrc = `
precision highp float;

varying vec2 v_texCoord;
varying vec3 v_normal;

uniform sampler2D u_diffuse;
uniform vec3 u_lightDirection;

void main() {
  vec4 diffuseColor = texture2D(u_diffuse, v_texCoord);
  vec3 a_normal = normalize(v_normal);
  float l = dot(a_normal, u_lightDirection) * 0.5 + 0.5;
  gl_FragColor = vec4(diffuseColor.rgb * l, diffuseColor.a);
}
`;
{{/escapehtml}}</code></pre>
</div><div>
<div>WGSL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const shaderSrc = `
struct VSUniforms {
  worldViewProjection: mat4x4<f32>;
  worldInverseTranspose: mat4x4<f32>;
};
[[group(0), binding(0)]] var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    [[location(0)]] position: vec4<f32>;
    [[location(1)]] normal: vec3<f32>;
    [[location(2)]] texcoord: vec2<f32>;
};

struct MyVSOutput {
  [[builtin(position)]] position: vec4<f32>;
  [[location(0)]] normal: vec3<f32>;
  [[location(1)]] texcoord: vec2<f32>;
};

[[stage(vertex)]]
fn myVSMain(v: MyVSInput) -> MyVSOutput
{
  var vsOut: MyVSOutput;

  vsOut.position = vsUniforms.worldViewProjection * v.position;
  vsOut.normal = (vsUniforms.worldInverseTranspose * vec4<f32>(v.normal, 0.0)).xyz;
  vsOut.texcoord = v.texcoord;
  return vsOut;
}

struct FSUniforms {
  lightDirection: vec3<f32>;
};

[[group(0), binding(1)]] var<uniform> fsUniforms: FSUniforms;
[[group(0), binding(2)]] var diffuseSampler: sampler;
[[group(0), binding(3)]] var diffuseTexture: texture_2d<f32>;

[[stage(fragment)]]
fn myFSMain(v: MyVSOutput) -> [[location(0)]] vec4<f32>
{
  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, v.texcoord);
  var a_normal = normalize(v.normal);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4<f32>(diffuseColor.rgb * l, diffuseColor.a);
}
`;
{{/escapehtml}}</code></pre></div></div>

Notice in many ways they aren't all that different. The core parts of each
function are very similar. `vec4` in GLSL becomes `vec4<f32>` in WGSL, `mat4`
becomes `mat4x4<f32>`. WGSL has the concept `var` which means a variable's type
becomes the type of the expression on the right where as GLSL required you to
specify the type. In other words in GLSL

```glsl
vec4 color = texture(someTexture, someTextureCoord);
```

Above you needed to declare `color` as a `vec4` but in WGSL you can do either of these

```
vec4<f32> color = textureSampler(someTexture, someSampler, someTextureCoord);
```

or

```
var color = textureSampler(someTexture, someSampler, someTextureCoord);
```

In both cases `color` is a `vec4<f32>`.

On the other hand, the biggest difference is all of the `[[???]]` parts. Each
one is declaring exactly where that particular piece of data is coming from. For
example, notice that uniforms in the vertex shader and uniforms the fragment
shader declare their `[[group(?), binding(?)]]` and that it's up to you to make
sure they don't clash. Above the vertex shader uses `binding(0)` and the
fragment shader `binding(1)`, `binding(2)`, `binding(3)` In the example above
there are 2 uniform blocks. We could have used 1. I chose to use 2 to more
separate the vertex shader from the fragment shader.

Another difference between WebGL and WebGPU is that in WebGPU you can put
multiple shaders in the same source. In WebGL a shader's entry point was always
called `main` but in WebGPU when you use a shader you specify which function to
call.

Notice in WebGPU the attributes are declared as parameters to the vertex shader
function vs GLSL where they are declared as globals outside the function.

For varyings, in GLSL they are also declared as global variables where as in
WGSL you declare a structure with locations for each field, you declare your
vertex shader as returning that structure and you return an instance of that
structure in the function itself. In the fragment shader you declare your
function as taking these inputs.

In the code above uses the same structure for both the vertex shaders output and
the fragment shader's input but there's not requirement to use the same
structure. All that's required is that the locations match. For example this
would work:

```wgsl
struct MyFSInput {
  [[location(0)]] normal: vec3<f32>;
  [[location(1)]] texcoord: vec2<f32>;
};

[[stage(fragment)]]
fn myFSMain(v: MyFSInput) -> [[location(0)]] vec4<f32>
{
  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, v.texcoord);
  var a_normal = normalize(v.normal);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4<f32>(diffuseColor.rgb * l, diffuseColor.a);
}
```

This would also work

```wgsl
[[stage(fragment)]]
fn myFSMain(
  [[location(0)]] normal: vec3<f32>,
  [[location(1)]] texcoord: vec2<f32>,
) -> [[location(0)]] vec4<f32>
{
  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, texcoord);
  var a_normal = normalize(normal);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4<f32>(diffuseColor.rgb * l, diffuseColor.a);
}
```

Again, what matters is the that the locations match.

### Getting the API

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function main() {
  const gl = document.querySelector('canvas').getContext('webgl');
  if (!gl) {
    fail('need webgl');
    return;
  }
}

main();
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
async function main() {
  const gpu = navigator.gpu;
  if (!gpu) {
    fail('this browser does not support webgpu');
    return;
  }

  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    fail('this browser appears to support WebGPU but it\'s disabled');
    return;
  }
  const device = await adapter.requestDevice();

...
}

main();
{{/escapehtml}}</code></pre>
  </div>
</div>

Here, `adapter` represents the GPU itself where as `device` represents
an instance of the API on that GPU.

Probably the biggest difference here is that getting the API in WebGPU
is asynchronous.

### Compiling shaders

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function createShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh));
  }
  return sh;
}

function createProgram(gl, vSrc, fSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fSrc);
  const prg = gl.createProgram();
  gl.attachShader(prg, vs);
  gl.attachShader(prg, fs);
  gl.linkProgram(prg);
  if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prg));
  }
  return prg;
}

const program = createProgram(gl, vSrc, fSrc);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function showErrorsSimple(code, info) {
  let hasError = false;
  info.messages.forEach(m => {
    console[m.type](`${m.lineNum}:${m.linePos}:${m.message}`);
    hasError |= m.type === 'error';
  });
  return hasError;
}

async function createShaderModule(device, code) {
  const shader = device.createShaderModule({code});
  const info = await shader.compilationInfo();
  if (info.messages.length) {
    const hasError = showErrorsSimple(code, info);
    if (hasError) {
      throw new Error('can not compile shader');
    }
  }
  return shader;
}

const shaderModule = await createShaderModule(device, shaderSrc);
{{/escapehtml}}</code></pre>
  </div>
</div>

A minor difference, unlike WebGL, we can compile multiple shaders at once.

The code above is probably a little controversial. In WebGL if your shader
didn't compile it is up to you to check vs `gl.getShaderParameter` and then if
it failed, pull out the error messages with a call to `gl.getShaderInfoLog`. If
you didn't do this no errors are shown. You'd likely just get an error later
when you tried to use the shader program.

In WebGPU, according to the spec, it's similar, but, at least at the moment,
most implementations print shader complication errors to the JavaScript console
even if you don't ask for them.

Further, the code above waits for the error message, which is slower than
not waiting. (The same is true in WebGL). The point being there's less reason
to check for the errors yourself since, at least at the moment, the browser
will show you the errors automatically, so many WebGPU example don't check.
But, in WebGPU you can only get the errors asynchronously, so you have to
choose. Do you want to `await` for the errors, do you want to get them
*out of band*, or do you just want to ignore them.

A big difference is that errors are structured in WebGPU. In WebGL it was
just a string. In WebGPU it's an array of messages and those messages may or
may not be errors. To show them you have to loop through them.

### Preparing for uniforms

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const u_lightDirectionLoc = gl.getUniformLocation(program, 'u_lightDirection');
const u_diffuseLoc = gl.getUniformLocation(program, 'u_diffuse');
const u_worldInverseTransposeLoc = gl.getUniformLocation(program, 'u_worldInverseTranspose');
const u_worldViewProjectionLoc = gl.getUniformLocation(program, 'u_worldViewProjection');
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const vUniformBufferSize = 2 * 16 * 4; // 2 mat4s * 16 floats per mat * 4 bytes per float
const fUniformBufferSize = 3 * 4;      // 1 vec3 * 3 floats per vec3 * 4 bytes per float

const vsUniformBuffer = device.createBuffer({
  size: vUniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const fsUniformBuffer = device.createBuffer({
  size: fUniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const vsUniformValues = new Float32Array(2 * 16); // 2 mat4s
const worldViewProjection = vsUniformValues.subarray(0, 16);
const worldInverseTranspose = vsUniformValues.subarray(16, 32);
const fsUniformValues = new Float32Array(3);  // 1 vec3
const lightDirection = fsUniformValues.subarray(0, 3);
{{/escapehtml}}</code></pre>
  </div>
</div>

In WebGL we lookup the locations of the uniforms. In WebGPU we create
buffers to hold the values of the uniforms. The code above then creates
TypedArray views into larger CPU side TypedArrays that hold the values
for the uniforms. Notice `vUniformBufferSize` and `fUniformBufferSize`
are hand computed. Similarly when creating views into type typed arrays
the offsets and sizes are hand computed. It's entirely up to use to
do those calculations. Unlike WebGL, WebGPU provides no API to query these offsets
and sizes.

Note, a similar process exists for WebGL2 using Uniform Blocks but if
you've never used Uniform Blocks then this will be new.

### Creating Buffers

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function createBuffer(gl, data, type = gl.ARRAY_BUFFER) {
  const buf = gl.createBuffer();
  gl.bindBuffer(type, buf);
  gl.bufferData(type, data, gl.STATIC_DRAW);
  return buf;
}

const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

const positionBuffer = createBuffer(gl, positions);
const normalBuffer = createBuffer(gl, normals);
const texcoordBuffer = createBuffer(gl, texcoords);
const indicesBuffer = createBuffer(gl, indices, gl.ELEMENT_ARRAY_BUFFER);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
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
{{/escapehtml}}</code></pre>
  </div>
</div>

You can see, at a glance, these are not too different. You call different
functions but otherwise it's pretty similar.

### Creating a Texture

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texImage2D(
    gl.TEXTURE_2D,
    0,    // level
    gl.RGBA,
    2,    // width
    2,    // height
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([
      255, 255, 128, 255,
      128, 255, 255, 255,
      255, 128, 255, 255,
      255, 128, 128, 255,
    ]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const tex = device.createTexture({
  size: [2, 2, 1],
  format: 'rgba8unorm',
  usage:
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST,
});
device.queue.writeTexture(
    { texture: tex },
    new Uint8Array([
      255, 255, 128, 255,
      128, 255, 255, 255,
      255, 128, 255, 255,
      255, 128, 128, 255,
    ]),
    { bytesPerRow: 8, rowsPerImage: 2 },
    { width: 2, height: 2 },
);

const sampler = device.createSampler({
  magFilter: 'nearest',
  minFilter: 'nearest',
});
{{/escapehtml}}</code></pre>
  </div>
</div>

Again, not all that different. One difference is there are usage flags in WebGPU
that you need to set depending on what you plan to do with the texture. Another
is that in WebGPU we need to create a sampler which is optional in WebGL

### Setting up a Pipeline

Several things that happen in WebGL are combined into one thing in WebGPU
when creating a pipeline. For example, linking the shaders, setting up
attributes, choosing the draw mode (points, line, triangles), setting up
how the depth buffer is used. 

Here's the code.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
gl.linkProgram(prg);

...

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(positionLoc);

gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(normalLoc);

gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(texcoordLoc);

....

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const pipeline = device.createRenderPipeline({
  vertex: {
    module: shaderModule,
    entryPoint: 'myVSMain',
    buffers: [
      // position
      {
        arrayStride: 3 * 4, // 3 floats, 4 bytes each
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x3'},
        ],
      },
      // normals
      {
        arrayStride: 3 * 4, // 3 floats, 4 bytes each
        attributes: [
          {shaderLocation: 1, offset: 0, format: 'float32x3'},
        ],
      },
      // texcoords
      {
        arrayStride: 2 * 4, // 2 floats, 4 bytes each
        attributes: [
          {shaderLocation: 2, offset: 0, format: 'float32x2',},
        ],
      },
    ],
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'myFSMain',
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
{{/escapehtml}}</code></pre>
  </div>
</div>

Parts to note:

Shader linking happens when you call `createRenderPipeline` and in fact
`createRenderPipeline` is a slow call as your shaders might be adjusted
internally depending on the settings. You can see, for `vertex` and `fragment`
we specify a shader `module` and specify which function to call via `entryPoint`.
WebGPU then needs to make sure those 2 functions are compatible with each other.

In WebGL we call `gl.vertexAttribPointer` to attach the current ARRAY_BUFFER
buffer to an attribute *and* to specify how to pull data out of that buffer. In
WebGPU we only specify how to pull data out of buffers when creating the
pipeline. We specify what buffers to use later.

In the example above you can see `buffers` is an array of objects.
Those objects are called `GPUVertexBufferLayout`. Within each one is
an array of attributes. Here we're setting up to get our data from
3 different buffers. If we interleaved the data into one buffer
we'd only need one `GPUVertexBufferLayout` but its `attribute` array
would have 3 entries.

Also note here is a place where we have to match `shaderLocation` to
what we used in the shader.

In WebGPU we setup the `primitive`, cull mode, and depth settings here.
That means if we want to draw something with any of those settings different,
for example if we want to draw some geometry with triangles and later with
lines, we have to create multiple pipelines.

The last part `multisample` we need if we're drawing to a multi-sampled
destination texture. I put that in here because by default, WebGL will use a
multi sampled texture for the canvas. To emulate that requires adding a
`multisample` property. `presentationFormat` and `canvasInfo.sampleCount` areß
something we'll below. Similarly

### Preparing to draw

In WebGL we'd get straight to drawing at this point but in WebGPU we have some
work left.

We need to create a bind group. This lets us specify what resources our
shaders will use

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// happens at render time
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, tex);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// can happen at init time
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: vsUniformBuffer } },
    { binding: 1, resource: { buffer: fsUniformBuffer } },
    { binding: 2, resource: sampler },
    { binding: 3, resource: tex.createView() },
  ],
});
{{/escapehtml}}</code></pre>
  </div>
</div>

Again, notice the `binding` add group must match what we specified in our shaders.

In WebGPU we also create a render pass descriptor vs WebGL where these
settings are set via stateful API calls or handled automatically.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
gl.clearColor(0.5, 0.5, 0.5, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const renderPassDescriptor = {
  colorAttachments: [
    {
      // view: undefined, // Assigned later
      // resolveTarget: undefined, // Assigned Later
      loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    // view: undefined,  // Assigned later
    depthLoadValue: 1.0,
    depthStoreOp: 'store',
    stencilLoadValue: 0,
    stencilStoreOp: 'store',
  },
};
{{/escapehtml}}</code></pre>
  </div>
</div>

Note that many of the settings in WebGPU are related to where we want to render.
In WebGL, when rendering to the canvas, all of this was handled for us. When
rendering to a framebuffer these settings are the equivalent of calls to
`gl.framebufferTexture2D` and/or `gl.framebufferRenderbuffer`.

### Setting Uniforms

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
gl.uniform3fv(u_lightDirectionLoc, v3.normalize([1, 8, -10]));
gl.uniform1i(u_diffuseLoc, 0);
gl.uniformMatrix4fv(u_worldInverseTransposeLoc, false, m4.transpose(m4.inverse(world)));
gl.uniformMatrix4fv(u_worldViewProjectionLoc, false, m4.multiply(viewProjection, world));
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
m4.transpose(m4.inverse(world), worldInverseTranspose);
m4.multiply(viewProjection, world, worldViewProjection);

v3.normalize([1, 8, -10], lightDirection);

device.queue.writeBuffer(
  vsUniformBuffer,
  0,
  vsUniformValues.buffer,
  vsUniformValues.byteOffset,
  vsUniformValues.byteLength,
);
device.queue.writeBuffer(
  fsUniformBuffer,
  0,
  fsUniformValues.buffer,
  fsUniformValues.byteOffset,
  fsUniformValues.byteLength,
);
{{/escapehtml}}</code></pre>
  </div>
</div>

In the WebGL case we compute a value and pass it to `gl.uniform???` with
the appropriate location.

In the WebGPU case we write values into our typed arrays and then copy the
contents of those typed arrays to the corresponding GPU buffers.

Note: In WebGL2, if we were using Uniform Blocks, this process is almost
exactly the same except we'd call `gl.bufferSubData` to upload the typed array
contents.

### Resizing the drawing buffer

As mentioned near the start of the article, this is one place that WebGL just
handled for us but in WebGPU we need to do ourselves.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function resizeCanvasToDisplaySize(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = width !== canvas.width || height !== canvas.height;
  if (needResize) {
    canvas.width = width;
    canvas.height = height;
  }
  return needResize;
}
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// At init time
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');

const presentationFormat = context.getPreferredFormat(adapter);
const presentationSize = [300, 150];  // default canvas size

const canvasInfo = {
  canvas,
  context,
  presentationSize,
  presentationFormat,
  // these are filled out in resizeToDisplaySize
  renderTarget: undefined,
  renderTargetView: undefined,
  depthTexture: undefined,
  depthTextureView: undefined,
  sampleCount: 4,  // can be 1 or 4
};

// --- At render time ---

function resizeToDisplaySize(device, canvasInfo) {
  const {
    canvas,
    context,
    renderTarget,
    presentationSize,
    presentationFormat,
    depthTexture,
    sampleCount,
  } = canvasInfo;
  const width = Math.min(device.limits.maxTextureDimension2D, canvas.clientWidth);
  const height = Math.min(device.limits.maxTextureDimension2D, canvas.clientHeight);

  const needResize = !canvasInfo.renderTarget ||
                     width !== presentationSize[0] ||
                     height !== presentationSize[1];
  if (needResize) {
    if (renderTarget) {
      renderTarget.destroy();
    }
    if (depthTexture) {
      depthTexture.destroy();
    }

    presentationSize[0] = width;
    presentationSize[1] = height;

    context.configure({
      device,
      format: presentationFormat,
      size: presentationSize,
    });

    if (sampleCount > 1) {
      const newRenderTarget = device.createTexture({
        size: presentationSize,
        format: presentationFormat,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      canvasInfo.renderTarget = newRenderTarget;
      canvasInfo.renderTargetView = newRenderTarget.createView();
    }

    const newDepthTexture = device.createTexture({
      size: presentationSize,
      format: 'depth24plus',
      sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    canvasInfo.depthTexture = newDepthTexture;
    canvasInfo.depthTextureView = newDepthTexture.createView();
  }
  return needResize;
}
{{/escapehtml}}</code></pre>
  </div>
</div>

You can see above there's a bunch of work to do. If we need to resize, 
we need to manually destroy the old textures (color and depth) and create
new ones. We also need to check that we don't go over the limits, something
WebGL handled for us, at least for the canvas.

Above, the property `sampleCount` effectively becomes the `antialias` property
of the WebGL context's creation attributes. `sampleCount: 4` would be the equivalent of `antialias: true` (the default), were as `sampleCount: 1` would be
the equivalent of `antialias: false` when creating the WebGL context.

### Drawing

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

...
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, tex);

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(positionLoc);

gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(normalLoc);

gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(texcoordLoc);

...

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);

gl.drawElements(gl.TRIANGLES, 6 * 6, gl.UNSIGNED_SHORT, 0);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
if (canvasInfo.sampleCount === 1) {
    const colorTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view = colorTexture.createView();
} else {
  renderPassDescriptor.colorAttachments[0].view = canvasInfo.renderTargetView;
  renderPassDescriptor.colorAttachments[0].resolveTarget = context.getCurrentTexture().createView();
}
renderPassDescriptor.depthStencilAttachment.view = canvasInfo.depthTextureView;

const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
passEncoder.setPipeline(pipeline);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.setVertexBuffer(0, positionBuffer);
passEncoder.setVertexBuffer(1, normalBuffer);
passEncoder.setVertexBuffer(2, texcoordBuffer);
passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
passEncoder.drawIndexed(indices.length);
passEncoder.endPass();
device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
</div>

Note that I repeated the WebGL attribute setup code here. In WebGL, this can
happen at init time or at render time. In WebGPU we setup how to pull data out
of the buffers at init time but we set the actual buffers to use at render time.

In WebGPU, we need to update our render pass descriptor to use the textures
we may have just updated in `resizeToDisplaySize`. Then we need to create a 
command encoder and begin a render pass.

In the render pass we set the pipeline, which is kind of like the equivalent of
`gl.useProgram`. We then set our bind group which supplies our sampler, texture,
and the 2 buffers for our uniforms. We set the vertex buffers to match
what we declared earlier. Finally we set an index buffer can call `drawIndexed`
which is the equivalent of calling `gl.drawElements`.

In WebGL we needed to call `gl.viewport`. In WebGPU the pass encoder defaults
to a viewport that matches the size of the attachments so unless we want a
different viewport setting we don't have to set a viewport separately.

In WebGL we called `gl.clear` to clear the canvas. In WebGPU we had previously
set that up when creating our render pass descriptor.

## Working Examples:

WebGL

{{{example url="../webgl-cube.html"}}}

WebGPU

{{{example url="../webgpu-cube.html"}}}

Another important thing to notice, We're issue instructions to something
referred to as the `device.queue`. Notice that when we uploaded the values
for the uniforms we called `device.queue.writeBuffer` and then when we created
a command encoder and submitted it with `device.queue.submit`. That should
make it pretty clear that we can't update the buffers between draw calls within
the same command encoder. If we want to draw multiple things we'd need
multiple buffers or multiple sets of values in a single buffer.

Let's go over and example of drawing multiple things.

TBD


If you were already familiar with WebGL then I hope this article was useful.

