Title: WebGPU Fundamentals
Description: TBD
TOC: Fundamentals

If you're coming from WebGL to WebGPU it's worth noting that many of the
concepts are the same. Both WebGL and WebGPU let you run small functions on the
GPU. WebGL has vertex shaders and fragment shaders. WebGPU has the same plus
compute shaders . WebGL uses GLSL as its shading language. WebGPU uses WGSL.
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
those settings *globally* until you change them.

By contrast, In WebGPU there is no or almost no *global* state. Instead there
concept of a `Pipeline` which effectively contains most of the state that was
global in WebGL. Which textures, which attributes, which buffers, and all the
various outer settings. Any settings you don't set have defaults.

The second biggest difference is that WebGPU **is lower level** than WebGL. In
WebGL most things connect by names. For example you declare a uniform in GLSL
and you look up its location `loc = gl.getUniformLocation(program,
'nameOfUniform')`. Another example is varyings, in a vertex shader you use
`varying vec2 v_texcoord` or `out vec2 v_texcoord` and in the fragment shader
you declare the corresponding varying naming it `v_texcoord`. The good part of
this is that if you mis-type the name you'll get or at least can get an error.

WebGPU, on the other hand, everything is entirely connected by index or byte
offset. You don't create individual uniforms like WebGL, instead you declare a
uniform block (a structure that declares your uniform inputs). It's then up to
you to make sure you manually organize the data you pass to the shader to match
that structure. (note: WebGL2 has the same concept, known as Uniform Blocks, but
WebGL2 also had the concept of uniforms by name. And, even though individual
fields in a WebGL2 Uniform Block needed to be set via byte offsets, (a) you
could lookup those offsets and (b) you could still look up the block locations
themselves by name.

In WebGPU on the other hand EVERYTHING is by byte offset or index (often called
'*location*'). That means it's entirely up to you to keep those locations in
sync and to compute byte offsets.

To give a JavaScript example

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
`texcoords` because if we didn't things would get out of order. The `normal` we
passed into`likeWebGPU` would become `texcoords` inside the function. Keeping
the code inside (WGSL) and outside (JavaScript/WASM) in sync in WebGPU is
entirely your responsibility.

So, let's compare drawing something in WebGL to WebGPU

Here are some shaders for a lit, textured, object in WebGL

```js
const vs = `
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldInverseTranspose;

attribute vec4 a_position;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

varying vec4 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;

void main() {
  v_texCoord = a_texcoord;
  v_position = (u_worldViewProjection * a_position);
  v_normal = (u_worldInverseTranspose * vec4(a_normal, 0)).xyz;
  gl_Position = v_position;
}
`;

const fs = `
precision highp float;

varying vec4 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;

uniform sampler2D u_diffuse;
uniform vec4 u_lightDirection;

vec4 lit(float l ,float h, float m) {
  return vec4(1.0,
              max(l, 0.0),
              (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
              1.0);
}

void main() {
  vec4 diffuseColor = texture2D(u_diffuse, v_texCoord);
  vec3 a_normal = normalize(v_normal);
  vec4 l = dot(a_normal, u_lightDirection) * 0.5 + 0.5;
  gl_FragColor = vec3(diffuseColor.rgb * l, diffuseColor.a);
}
`
```