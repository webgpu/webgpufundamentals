Title: WebGL에서 WebGPU로
Description: WebGL과 WebGPU 사용법 비교
TOC: WebGL에서 WebGPU로

이 글은, 이미 WebGL에 대한 지식을 가지고 있고, WebGPU를 사용해보고 싶은 사람들을 위한 것입니다.

WebGL에서 WebGPU로 전환할 경우, 많은 개념들이 동일하다는 점을 알아두는 것이 좋습니다. WebGL과 WebGPU 모두 GPU에서 작은 함수들을 실행할 수 있도록 해줍니다. WebGL에는 정점 셰이더와 프래그먼트 셰이더가 있습니다. WebGPU도 마찬가지로 컴퓨트 셰이더를 제공합니다. WebGL은 [GLSL](https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)을 셰이딩 언어로 사용합니다. 반면, WebGPU는 [WGSL](webgpu-wgsl.html)을 사용합니다. 두 언어는 다르지만, 개념은 대부분 동일합니다.

두 API 모두 정점 속성으로 버퍼 데이터를 정점 셰이더에 전달하고, 유니폼으로 셰이더의 여러 호출에서 공유할 값을 지정합니다. 정점 셰이더의 출력은 래스터화 중에 보간되어 프래그먼트 셰이더로 전달됩니다. 텍스처와 샘플러를 사용하면 2D 또는 3D 데이터에 접근하고 필터링할 수 있습니다. 블렌딩과 깊이 버퍼, 스텐실 버퍼의 동작도 설정할 수 있습니다.

가장 큰 차이는 WebGL이 상태를 갖는 API라는 점입니다. WebGL에는 현재 어떤 텍스처와 버퍼가 바인딩되어 있는지, 현재 프로그램이 무엇인지, 블렌딩과 깊이, 스텐실 설정이 어떤지 등을 나타내는 전역 상태가 있습니다. `gl.bindBuffer`, `gl.enable`, `gl.blendFunc` 같은 API 함수로 이 상태를 설정하면 다시 바꿀 때까지 그 값이 *전역으로* 유지됩니다.

WebGPU에는 전역 상태가 거의 없습니다. 대신 *파이프라인* 또는 *렌더 파이프라인*, 그리고 *렌더 패스*가 있습니다. 이 둘은 텍스처, 속성, 버퍼 등 WebGL에서 전역으로 설정하던 상태의 대부분을 포함합니다. 지정하지 않은 설정에는 기본값이 적용됩니다. 파이프라인은 생성한 뒤 변경할 수 없습니다. 다른 설정이 필요하면 새 파이프라인을 만들어야 합니다. *렌더 패스*에도 상태가 있지만 그 패스 안에서만 유효합니다.

두 번째로 큰 차이점은, WebGPU가 WebGL보다 **더 낮은 수준의 프로토콜을 사용한다**는 점입니다. WebGL에서는 여러 요소들이 이름으로 연결됩니다. 예를 들어, GLSL에서 uniform을 선언할 때, 그 위치를 찾아내는 과정도 있습니다.

```js
loc = gl.getUniformLocation(program, 'nameOfUniform');
```

다른 예시로는 ‘varying’이 있습니다. 정점 셰이더에서는 `varying vec2 v_texcoord` 또는 `out vec2 v_texcoord`를 사용하고, 프래그먼트 셰이더에서는 해당하는 varying의 이름을 `v_texcoord`로 선언합니다. 이 방법의 장점은 이름을 잘못 입력하면 오류가 발생한다는 것입니다.

반면, WebGPU의 경우에는 모든 데이터가 인덱스나 바이트 오프셋을 통해 완전히 연결되어 있습니다. WebGL처럼 개별적인 유니폼을 생성하는 것이 아니라, 유니폼 블록이라는 구조를 사용하여 데이터를 관리합니다. 그런 다음, 셰이더에 전달되는 데이터를 해당 구조에 맞게 수동으로 정리해야 합니다. 참고로, WebGL2도 유니폼 블록이라는 개념을 가지고 있지만, WebGL2에서는 이름으로도 유니폼을 지정할 수 있습니다. 또한, WebGL2의 유니폼 블록 내의 개별 필드들은 바이트 오프셋을 통해 설정되어야 하지만, 그 오프셋들을 직접 조회할 수도 있고, 유니폼 블록의 위치를 이름으로도 조회할 수 있습니다.

반면에 WebGPU에서는 **모든 것**이 바이트 오프셋이나 인덱스로 표시됩니다(종종 ‘*위치*’라고도 불립니다). 그리고 이러한 데이터를 조회할 수 있는 API도 없습니다. 따라서 그 위치를 동기화시키고, 바이트 오프셋을 수동으로 계산하는 것은 전적으로 사용자의 책임입니다.

JavaScript의 예를 들어보겠습니다:

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

위의 `likeWebGL` 예제에서는, 각 요소들은 이름으로 연결되어 있습니다. 우리는 `likeWebGL`을 다음과 같이 호출할 수 있습니다.

```js
const inputs = {};
inputs.normal = normal;
inputs.color = color;
inputs.position = position;
likeWebGL(inputs);
```

아니면 이런 식으로도 가능합니다.

```js
likeWebGL({color, position, normal});
```

주의할 점은, 각 매개변수들이 이름으로 연결되어 있기 때문에, 매개변수들의 순서는 중요하지 않다는 것입니다. 또한, 위 예시에서처럼 `texcoords`라는 매개변수를 생략할 수도 있습니다. 함수가 `texcoords`가 없는 상태에서도 작동할 수 있다고 가정할 수 있기 때문입니다.

반면에, `likeWebGPU`를 사용하는 경우는 어떻게 될까요?

```js
const inputs = [];
inputs[0] = position;
inputs[2] = normal;
inputs[3] = color;
likeWebGPU(inputs);
```

여기서는 매개변수들을 배열 형태로 전달합니다. 각 입력 값의 위치(인덱스)를 반드시 알아야 합니다. 예를 들어, `position`는 인덱스 0에 위치하고, `normal`은 인덱스 2에 위치한다는 것을 알아야 합니다. WebGPU 내부와 JavaScript/WASM 외부에서의 위치 정보를 동기화하는 것은 전적으로 개발자의 책임입니다.

### 기타 주목할 만한 차이점들

* 캔버스

  WebGL은 캔버스를 자동으로 관리해줍니다. WebGL 컨텍스트를 생성할 때, 안티알리아싱, 보존 드로우버퍼, 스텐실, 깊이, 알파 값 등을 설정할 수 있습니다. 그 후에는 WebGL이 캔버스 자체를 관리합니다. 이제 할 일은 단지 `canvas.width`와 `canvas.height`를 설정하는 것뿐입니다.

  WebGPU에서는 그런 작업들을 대부분 직접 해야 합니다. 깊이 버퍼가 필요하다면, 스텐실 버퍼와 함께 직접 만들어야 합니다. 안티알리아싱이 필요하다면, 여러 샘플링된 텍스처를 직접 만들어서 그 텍스처들을 캔버스 텍스처로 변환해야 합니다.

  하지만, 그 때문에 WebGL과 달리, 하나의 WebGPU 장치를 사용하여 여러 캔버스에 렌더링할 수 있습니다. 🎉🤩

* WebGPU는 미패치를 생성하지 않습니다.

  WebGL에서는 텍스처의 레벨 0 밉맵을 생성한 후, `gl.generateMipmap` 함수를 호출하면 됩니다. 그러면 WebGL이 나머지 밉 레벨을 모두 자동으로 생성합니다. 하지만 WebGPU에는 이러한 기능이 없습니다. 텍스처의 밉맵을 직접 생성해야 합니다.

  참고로 [GPU에서 밉 생성하기](webgpu-importing-textures.html#a-generating-mips-on-the-gpu)에서 밉을 만드는 코드를 볼 수 있습니다.

* WebGPU는 샘플러가 필요합니다.

  WebGL1에서는 샘플러라는 개념이 존재하지 않았습니다. 다시 말해, 샘플러는 WebGL 내부에서 직접 처리되었습니다. 반면, WebGL2에서는 샘플러를 사용하는 것이 선택적인 옵션이었습니다. 하지만 WebGPU에서는 샘플러가 반드시 필요합니다.

* 버퍼와 텍스처는 크기를 조절할 수 없습니다.

  WebGL에서는 버퍼나 텍스처를 생성한 후, 언제든지 그 크기를 변경할 수 있습니다. 예를 들어, `gl.bufferData`를 호출하면 버퍼의 크기가 재할당됩니다. `gl.texImage2D`를 호출하면 텍스처의 크기도 재할당됩니다. 텍스처를 다룰 때는 1x1픽셀 크기의 플레이스홀더를 만들어서, 렌더링을 바로 시작한 다음, 이미지를 비동기적으로 로드하는 방식을 사용합니다. 이미지가 완전히 로드되면, 그때 텍스처의 크기를 실제로 업데이트합니다.

  WebGPU에서 텍스처와 버퍼의 크기, 사용 방법, 포맷 등은 변경될 수 없습니다. 내용은 변경할 수 있지만, 그 외의 요소들은 변경할 수 없습니다. 즉, 위에서 언급된 예시와 같이 WebGL에서 변경했던 패턴들은 새로운 리소스를 생성하기 위해 재작성해야 합니다.

  다시 말해, 그 대신에…

  ```js
  // 가상 코드
  const tex = createTexture()
  fillTextureWith1x1PixelPlaceholder(tex)
  imageLoad(url).then(img => updateTextureWithImage(tex, image));
  ```

  코드를 수정하여, 효과적으로 다음과 같은 형태로 만들어야 합니다.

  ```js
  // 가상 코드
  let tex = createTexture(size: [1, 1]);
  fillTextureWith1x1PixelPlaceholder(tex)
  imageLoad(url).then(img => {
      tex.destroy();  // 오래된 텍스처를 삭제합니다.
      tex = createTexture(size: [img.width, img.height]);
      copyImageToTexture(tex, image));
  });
  ```

## 자, 그럼 WebGL과 WebGPU를 비교해보도록 하죠.

### 샤이더

여기에는 텍스처가 적용된, 빛이 비춰진 삼각형들을 그리는 셰이더가 있습니다. 하나는 GLSL로 작성된 것이고, 다른 하나는 WGSL로 작성된 것입니다.

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
  worldViewProjection: mat4x4f,
  worldInverseTranspose: mat4x4f,
};
@group(0) binding(0) var<uniform> vsUniforms: VSUniforms;

struct MyVSInput {
    @location(0) position: vec4f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f,
};

struct MyVSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) texcoord: vec2f,
};

@vertex
fn myVSMain(v: MyVSInput) -> MyVSOutput {
  var vsOut: MyVSOutput;
  vsOut.position = vsUniforms.worldViewProjection * v.position;
  vsOut.normal = (vsUniforms.worldInverseTranspose * vec4f(v.normal, 0.0)).xyz;
  vsOut.texcoord = v.texcoord;
  return vsOut;
}

struct FSUniforms {
  lightDirection: vec3f,
};

@group(0) binding(1) var<uniform> fsUniforms: FSUniforms;
@group(0) binding(2) var diffuseSampler: sampler;
@group(0) binding(3) var diffuseTexture: texture_2d<f32>;

@fragment
fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, v.texcoord);
  var a_normal = normalize(v.normal);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4f(diffuseColor.rgb * l, diffuseColor.a);
}
`;
{{/escapehtml}}</code></pre></div></div>

많은 면에서, 이들 함수들은 그다지 다르지 않습니다. 각 함수의 핵심적인 부분들은 매우 유사합니다. GLSL에서의 `vec4`는 WGSL에서는 `vec4f`가 되고, `mat4`는 `mat4x4f`가 됩니다. 다른 예시로는 `int`가 `i32`로, `uint`가 `u32`로 변경되고, `ivec2`는 `vec2i`로, `uvec3`는 `vec3u`로 변경됩니다.

GLSL은 C/C++와 유사합니다. 반면, WGSL은 Rust와 유사합니다. 한 가지 차이점은, GLSL에서는 타입들이 왼쪽에 위치하는 반면, WGSL에서는 오른쪽에 위치한다는 것입니다.

<div class="webgpu_center compare"><div><div>GLSL</div><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// vec4 타입의 변수를 선언합니다.
vec4 v;

// vec3 인자를 받는 mat4 타입의 함수를 선언합니다.
mat4 someFunction(vec3 p) { ... }

// 구조체를 선언합니다.
struct Foo { vec4 field; };
{{/escapehtml}}</code></pre>
</div><div>
<div>WGSL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// vec4f 타입의 변수를 선언합니다.
var v: vec4f;

// vec3f 타입의 매개변수를 받는 mat4x4f 타입의 함수를 선언합니다.
fn someFunction(p: vec3f) -> mat4x4f { ... }

// 구조체를 선언합니다.
struct Foo { field: vec4f, };
{{/escapehtml}}</code></pre></div></div>

WGSL에서는, 변수의 타입을 명시하지 않으면, 오른쪽에 있는 표현식의 타입을 기반으로 변수의 타입이 자동으로 결정된다고 생각합니다. 반면, GLSL에서는 항상 변수의 타입을 명시해야 합니다. 다시 말해, GLSL에서는…

```glsl
vec4 color = texture(someTexture, someTextureCoord);
```

위에서 `color`를 `vec4` 타입으로 선언해야 했지만, WGSL에서는 이 두 가지 중 하나만 사용할 수 있습니다.

```
var color: vec4f = textureSample(someTexture, someSampler, someTextureCoord);
```

혹은

```
var color = textureSample(someTexture, someSampler, someTextureCoord);
```

두 경우 모두, `color`는 `vec4f`형입니다.

다른 큰 차이는 `@???`로 표시된 부분입니다. 각 항목은 해당 데이터가 어디에서 오는지 정확히 선언합니다. 예를 들어 정점 셰이더와 프래그먼트 셰이더의 유니폼은 `@group(?) binding(?)`을 선언하며, 서로 충돌하지 않도록 직접 지정해야 합니다. 위에서 정점 셰이더는 `binding(0)`을, 프래그먼트 셰이더는 `binding(1)`, `binding(2)`, `binding(3)`을 사용합니다. 위 예제는 유니폼 블록을 2개 사용합니다. 하나만 써도 되지만, 정점 셰이더와 프래그먼트 셰이더를 더 명확히 구분하기 위해 2개를 선택했습니다.

WebGL과 WebGPU의 또 다른 차이점은, WebGPU에서는 동일한 소스 내에 여러 개의 셰이더를 포함시킬 수 있다는 점입니다. 반면 WebGL에서는 셰이더의 엔트리 포인트가 항상 `main`로 지정되었지만, WebGPU에서는 셰이더를 사용할 때 어떤 함수를 호출할지 직접 지정해야 합니다.

WebGPU에서는 속성들이 정점 셰이더 함수의 매개변수로 선언됩니다. 반면, GLSL에서는 속성들이 함수 외부의 전역 변수로 선언됩니다. 또한, GLSL과 달리, WGSL에서는 속성들의 위치를 직접 지정해야 합니다. 컴파일러는 자동으로 위치를 할당해주지 않습니다.

다른 점은, GLSL에서는 이러한 변수들을 전역 변수로 선언하는 반면, WGSL에서는 각 필드마다 위치를 지정하는 구조체를 선언합니다. 정점 셰이더에서는 해당 구조체를 반환하도록 선언하고, 함수 내에서도 그 구조체의 인스턴스를 반환합니다. 프래그먼트 셰이더에서는 함수를 선언할 때 이러한 입력값들을 받도록 합니다.

위의 코드에서는 정점 셰이더의 출력과 프래그먼트 셰이더의 입력에 대해 동일한 구조를 사용합니다. 하지만 반드시 동일한 구조를 사용해야 하는 것은 아닙니다. 필요한 것은 단지 위치가 일치한다는 것뿐입니다. 예를 들어, 다음과 같은 방식으로도 작동할 수 있습니다.

```wgsl
*struct MyFSInput {
*  @location(0) the_normal: vec3f,
*  @location(1) the_texcoord: vec2f,
*};

@fragment
*fn myFSMain(v: MyFSInput) -> @location(0) vec4f
{
*  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, v.the_texcoord);
*  var a_normal = normalize(v.the_normal);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4f(diffuseColor.rgb * l, diffuseColor.a);
}
```

이 방법도 적용될 수 있습니다.

```wgsl
@fragment
fn myFSMain(
*  @location(1) uv: vec2f,
*  @location(0) nrm: vec3f,
) -> @location(0) vec4f
{
*  var diffuseColor = textureSample(diffuseTexture, diffuseSampler, uv);
*  var a_normal = normalize(nrm);
  var l = dot(a_normal, fsUniforms.lightDirection) * 0.5 + 0.5;
  return vec4f(diffuseColor.rgb * l, diffuseColor.a);
}
```

다시 말하지만, 중요한 것은 위치가 일치하는지 여부이며, 이름은 중요하지 않습니다.

또 다른 차이점은, GLSL에서 `gl_Position`가 WGSL에서는 사용자가 선언한 구조체 필드에 대한 특별한 위치인 `@builtin(position)`를 가진다는 점입니다. 마찬가지로, 프래그먼트 셰이더의 출력값도 특정 위치가 지정됩니다. 이 경우 `@location(0)`이 사용됩니다. 이는 WebGL1의 `WEBGL_draw_buffers` 확장 기능에서 `gl_FragData[0]`를 사용하는 것과 유사합니다. 만약 여러 개의 값을 출력하고 싶다면, 구조체를 선언하고 해당 값들을 각각 다른 위치에 할당해야 합니다. 이는 마치 정점 셰이더의 출력값을 처리할 때와 같은 방식입니다.

### API를 사용하는 방법

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
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

...
}

main();
{{/escapehtml}}</code></pre>
  </div>
</div>

여기서, `adapter`는 GPU 자체를 나타내고, `device`는 해당 GPU에서 실행되는 API의 인스턴스를 나타냅니다.

아마도 여기서 가장 큰 차이점은, WebGPU를 통해 API를 얻는 과정이 비동기적이라는 점일 것입니다.

### 버퍼 생성하기

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

보시다시피, 이 두 가지는 크게 다르지 않습니다. 서로 다른 함수를 사용하지만, 그 외의 면에서는 거의 비슷합니다.

### 텍스처 생성하기

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texImage2D(
    gl.TEXTURE_2D,
    0,    // 레벨
    gl.RGBA,
    2,    // 너비
    2,    // 높이
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
  size: [2, 2],
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

다시 말하지만, 큰 차이점은 없습니다. 한 가지 차이점은, WebGPU에서는 텍스처를 어떻게 사용할지에 따라 필요한 사용자 지정 플래그를 설정해야 한다는 점입니다. 또 다른 차이점은, WebGPU에서는 샘플러를 생성해야 한다는 점인데, 이는 WebGL에서는 선택적인 기능입니다.

### 셰이더를 컴파일하는 방법

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

const vs = createShader(gl, gl.VERTEX_SHADER, vSrc);
const fs = createShader(gl, gl.FRAGMENT_SHADER, fSrc);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
const shaderModule = device.createShaderModule({code: shaderSrc});
{{/escapehtml}}</code></pre>
  </div>
</div>

작은 차이점이지만, WebGL과 달리, 우리는 한 번에 여러 개의 셰이더를 컴파일할 수 있습니다.

WebGL에서, 만약 셰이더가 컴파일되지 않는다면, `COMPILE_STATUS` 값을 `gl.getShaderParameter`를 사용하여 확인해야 합니다. 만약 오류가 발생한다면, `gl.getShaderInfoLog`를 사용하여 오류 메시지를 확인할 수 있습니다. 이 작업을 하지 않으면, 아무런 오류 메시지도 표시되지 않습니다. 하지만 나중에 셰이더 프로그램을 사용하려고 할 때 오류가 발생할 가능성이 있습니다.

WebGPU에서는 대부분의 경우, 오류가 발생할 경우 JavaScript 콘솔에 오류 메시지가 출력됩니다. 물론 직접 오류를 확인할 수도 있지만, 아무것도 하지 않아도 유용한 정보를 얻을 수 있다는 점이 매우 편리합니다.

### 프로그램을 연결하기 / 파이프라인을 설정하기

파이프라인, 혹은 더 구체적으로 말하자면 “렌더 파이프라인”이란, 특정 방식으로 사용되는 두 개의 셰이더들을 의미합니다. WebGL에서 발생하는 여러 가지 작업들이 WebGPU에서는 하나의 작업으로 통합됩니다. 예를 들어, 셰이더들을 연결하는 작업, 속성 매개변수를 설정하는 작업, 드로우 모드를 선택하는 작업, 그리고 깊이 버퍼가 어떻게 사용될지 결정하는 작업 등이 있습니다.

다음은 그 코드입니다.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
function createProgram(gl, vs, fs) {
  const prg = gl.createProgram();
  gl.attachShader(prg, vs);
  gl.attachShader(prg, fs);
  gl.linkProgram(prg);
  if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prg));
  }
  return prg;
}

const program = createProgram(gl, vs, fs);

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
  layout: 'auto',
  vertex: {
    module: shaderModule,
    buffers: [
      // 위치/상태
      {
        arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x3'},
        ],
      },
      // 정상적인 상태
      {
        arrayStride: 3 * 4, // 3개의 부유체가 있으며, 각각 4바이트의 크기입니다.
        attributes: [
          {shaderLocation: 1, offset: 0, format: 'float32x3'},
        ],
      },
      // 텍스코어스
      {
        arrayStride: 2 * 4, // 2개의 부유체가 있으며, 각각 4바이트입니다.
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
{{/escapehtml}}</code></pre>
  </div>
</div>

주의해야 할 점들:

`createRenderPipeline`을 호출할 때 셰이더를 연결합니다. 설정에 따라 내부에서 셰이더를 조정할 수 있으므로 `createRenderPipeline`은 시간이 오래 걸리는 호출입니다. `vertex`와 `fragment`에 각각 셰이더 `module`을 지정하고 `entryPoint`로 호출할 함수를 정합니다. WebGPU가 두 함수의 호환성을 확인합니다. WebGL에서 두 셰이더를 하나의 프로그램으로 연결할 때 호환성을 확인하는 것과 같습니다.

WebGL에서는 `gl.vertexAttribPointer`를 호출해 현재 `ARRAY_BUFFER`에 바인딩된 버퍼를 속성에 연결하고, 그 버퍼에서 데이터를 읽는 방법도 지정합니다. WebGPU에서는 파이프라인을 생성할 때 버퍼에서 데이터를 읽는 방법만 지정하고, 실제로 사용할 버퍼는 나중에 설정합니다.

위 예시에서 볼 수 있듯이, `buffers`는 객체들의 배열입니다. 그 객체들을 `GPUVertexBufferLayout`이라고 합니다. 각 객체 내부에는 속성들의 배열이 있습니다. 여기서는 3개의 다른 버퍼에서 데이터를 가져오려고 합니다. 데이터를 하나의 버퍼에 합쳐서 처리한다면, `GPUVertexBufferLayout`만 있으면 되겠지만, 그때는 `attribute` 배열에 3개의 항목이 포함될 것입니다.

또한, 여기서는 `shaderLocation` 값을 셰이더에서 사용된 값과 일치시켜야 합니다.

WebGPU에서는 여기서 프리미티브 유형, 컬링 모드, 깊이 설정을 지정합니다. 이 설정을 바꿔 그리려면, 예를 들어 같은 도형을 삼각형으로 그린 뒤 선으로 그리려면 파이프라인이 여러 개 필요합니다. 정점 레이아웃이 다른 경우도 마찬가지입니다. 한 모델이 위치와 텍스처 좌표를 별도 버퍼에 두고, 다른 모델은 같은 버퍼의 서로 다른 오프셋에 두고, 또 다른 모델은 두 종류의 데이터를 번갈아 저장한다면, 모델 세 개에 각각 별도의 파이프라인이 필요합니다.

마지막 부분인 `multisample`은, 다중 샘플링된 텍스처를 사용해야 할 경우에 필요합니다. 이 속성을 여기에 추가하는 이유는, 기본적으로 WebGL은 캔버스에 다중 샘플링된 텍스처를 사용하기 때문입니다. 이를 구현하려면 `multisample` 속성을 추가해야 합니다. `presentationFormat`과 `canvasInfo.sampleCount`에 대해서는 나중에 자세히 설명하겠습니다.

### 유니폼을 준비하는 것

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
const vUniformBufferSize = 2 * 16 * 4; // mat4 2개 * 행렬당 부동소수점 값 16개 * 값당 4바이트
const fUniformBufferSize = 3 * 4;      // vec3 1개 * 벡터당 부동소수점 값 3개 * 값당 4바이트

const vsUniformBuffer = device.createBuffer({
  size: vUniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const fsUniformBuffer = device.createBuffer({
  size: fUniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const vsUniformValues = new Float32Array(2 * 16); // 2개의 mat4 타입
const worldViewProjection = vsUniformValues.subarray(0, 16);
const worldInverseTranspose = vsUniformValues.subarray(16, 32);
const fsUniformValues = new Float32Array(3);  // 1 벡스3
const lightDirection = fsUniformValues.subarray(0, 3);
{{/escapehtml}}</code></pre>
  </div>
</div>

WebGL에서는 유니폼의 위치를 확인합니다. 반면, WebGPU에서는 유니폼의 값을 저장하기 위한 버퍼를 생성합니다. 위의 코드는 유니폼의 값을 저장하는 더 큰 CPU 측의 TypedArray에 대한 뷰를 생성합니다. 여기서 `vUniformBufferSize`와 `fUniformBufferSize`는 수동으로 계산됩니다. 마찬가지로, TypedArray에 대한 뷰를 생성할 때도 오프셋과 크기는 수동으로 계산됩니다. 이러한 계산은 전적으로 사용자가 직접 수행해야 합니다. WebGL과 달리, WebGPU는 이러한 오프셋과 크기를 조회할 수 있는 API를 제공하지 않습니다.

참고로, WebGL2에서는 유니폼를 사용하는 유사한 방식이 존재합니다. 하지만 유니폼를 사용한 적이 없는 분들에게는 이 내용이 새로운 내용일 수 있습니다.

### 그림을 그리기 위한 준비

WebGL의 경우, 이 시점에서 바로 그림을 그리는 작업을 진행할 수 있습니다. 하지만 WebGPU의 경우에는 아직 해야 할 일이 남아 있습니다.

우리는 바인드 그룹을 생성해야 합니다. 이를 통해, 셰이더가 어떤 리소스를 사용할지 지정할 수 있습니다.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// 렌더링 시간에 발생합니다.
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, tex);
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
// 초기 단계에서 발생할 수 있습니다.
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: vsUniformBuffer  },
    { binding: 1, resource: fsUniformBuffer  },
    { binding: 2, resource: sampler },
    { binding: 3, resource: tex },
  ],
});
{{/escapehtml}}</code></pre>
  </div>
</div>

다시 한 번, `binding`과 `group`이 우리가 셰이더에서 지정한 값과 일치해야 한다는 점을 주의해야 합니다.

WebGPU에서는 WebGL과 달리, 렌더 패스 설정을 별도로 지정할 수 있습니다. 이러한 설정들은 상태를 유지하는 API 호출을 통해 설정되거나, 자동으로 처리됩니다.

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
      // 보기: undefined, // 나중에 할당될 예정입니다.
      // resolveTarget: undefined, // 나중에 할당될 예정입니다.
      clearValue: [0.5, 0.5, 0.5, 1],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    // 보기: undefined, // 나중에 할당될 예정입니다.
    depthClearValue: 1,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
};
{{/escapehtml}}</code></pre>
  </div>
</div>

WebGPU의 많은 설정들은, 우리가 어떤 위치에서 렌더링을 하고 싶은지와 관련이 있습니다. WebGL에서는 캔버스로 렌더링할 때, 이러한 설정들이 자동으로 처리됩니다. 반면, WebGL의 프레임버퍼로 렌더링할 때는, 이러한 설정들이 `gl.framebufferTexture2D`나 `gl.framebufferRenderbuffer`와 같은 함수 호출과 동일한 역할을 합니다.

### 유니폼 바인딩하기

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

device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues);
device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues);
{{/escapehtml}}</code></pre>
  </div>
</div>

WebGL의 경우, 우리는 특정 값을 계산한 후, 그 값을 적절한 위치에 있는 `gl.uniform???`에 전달합니다.

WebGPU의 경우, 우리는 타입화된 배열에 값을 저장한 다음, 그 배열의 내용을 해당 GPU 버퍼로 복사합니다.

참고: WebGL2에서는 유니폼 블록을 사용한다면, 이 과정은 거의 동일합니다. 다만, 타입이 지정된 배열의 내용을 업로드하기 위해 `gl.bufferSubData` 함수를 사용해야 합니다.

### 드로잉 버퍼의 크기를 조정하는 것

기사의 시작 부분에서 언급했듯이, 이는 WebGL이 자동으로 처리해주는 부분입니다. 하지만 WebGPU에서는 우리가 직접 처리해야 합니다.

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
// 초기 단계에서
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');

const presentationFormat = navigator.gpu.getPreferredFormat(adapter);
context.configure({
  device,
  format: presentationFormat,
});

const canvasInfo = {
  canvas,
  presentationFormat,
  // 이 내용들은 resizeToDisplaySize에 맞게 조정되어 있습니다.
  renderTarget: undefined,
  renderTargetView: undefined,
  depthTexture: undefined,
  depthTextureView: undefined,
  sampleCount: 4,  // 1이거나 4일 수 있습니다.
};

// --- 렌더링 시에는 ---

function resizeToDisplaySize(device, canvasInfo) {
  const {
    canvas,
    context,
    renderTarget,
    presentationFormat,
    depthTexture,
    sampleCount,
  } = canvasInfo;
  const width = Math.max(1, Math.min(device.limits.maxTextureDimension2D, canvas.clientWidth));
  const height = Math.max(1, Math.min(device.limits.maxTextureDimension2D, canvas.clientHeight));

  const needResize = !canvasInfo.renderTarget ||
                     width !== canvas.width ||
                     height !== canvas.height;
  if (needResize) {
    if (renderTarget) {
      renderTarget.destroy();
    }
    if (depthTexture) {
      depthTexture.destroy();
    }

    canvas.width = width;
    canvas.height = height;

    if (sampleCount > 1) {
      const newRenderTarget = device.createTexture({
        size: [canvas.width, canvas.height],
        format: presentationFormat,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      canvasInfo.renderTarget = newRenderTarget;
      canvasInfo.renderTargetView = newRenderTarget.createView();
    }

    const newDepthTexture = device.createTexture({
      size: [canvas.width, canvas.height,
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

위에서 볼 수 있듯이, 해야 할 일이 많이 있습니다. 크기를 조정해야 한다면, 기존의 텍스처들을 수동으로 삭제하고 새로운 텍스처를 생성해야 합니다. 또한, 제한을 넘지 않도록 확인해야 합니다. 이런 작업들은 WebGL이 처리해 주는 부분입니다. 적어도 캔버스의 경우는 그렇습니다.

위에서, `sampleCount`라는 속성은 사실상 WebGL 컨텍스트를 생성할 때 사용되는 `antialias` 속성과 유사합니다. `sampleCount: 4`는 WebGL의 `antialias: true`와 동일한 값이며, 반대로 `sampleCount: 1`은 `antialias: false`와 동일합니다.

위에서 보여주지 않은 또 다른 점은, WebGL은 메모리가 부족해지는 것을 피하려고 노력합니다. 즉, 16000x16000 크기의 캔버스를 요청했다면, WebGL은 4096x4096 크기의 캔버스를 반환할 수도 있습니다. 실제로 어떤 크기의 캔버스가 반환되었는지 알아보려면 `gl.drawingBufferWidth`와 `gl.drawingBufferHeight`를 확인해 보세요.

WebGL이 이런 방식을 선택한 이유는 다음과 같습니다. (1) 캔버스를 여러 모니터에 분산하여 표시하면, 그 크기가 GPU가 처리할 수 있는 크기보다 커질 수 있습니다. (2) 시스템의 메모리가 부족한 경우, WebGL은 작동을 멈추는 대신, 더 작은 크기의 드로잉 버퍼를 반환할 수도 있습니다.

WebGPU에서는, 이 두 가지 상황을 확인하는 것은 사용자에게 맡겨집니다. 위에서 언급된 상황(1)은 우리가 직접 확인합니다. 상황(2)의 경우는 메모리가 부족한지 확인해야 합니다. 이 작업도 WebGPU의 다른 모든 작업들과 마찬가지로 비동기적으로 처리됩니다.

```js
device.pushErrorScope('out-of-memory');
context.configure({...});
if (sampleCount > 1) {
  const newRenderTarget = device.createTexture({...});
  ...
}

const newDepthTexture = device.createTexture({...});
...
device.popErrorScope().then(error => {
  if (error) {
    // 메모리가 부족해요. 더 작은 크기로 시도해보시겠어요?
  }
});
```

### 그림 그리기

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
passEncoder.end();
device.queue.submit([commandEncoder.finish()]);
{{/escapehtml}}</code></pre>
  </div>
</div>

여기서 WebGL의 속성 설정 코드를 반복해서 작성했습니다. WebGL에서는 이 작업이 초기화 시나 렌더링 시에 발생할 수 있습니다. WebGPU에서는 초기화 시에 버퍼에서 데이터를 어떻게 가져오는지 설정합니다. 하지만 실제로 사용될 버퍼는 렌더링 시에 설정됩니다.

WebGPU에서는, `resizeToDisplaySize` 함수를 통해 최근에 업데이트된 텍스처들을 사용할 수 있도록 렌더 패스 디스크립터를 업데이트해야 합니다. 그런 다음, 명령어 엔코더를 생성하여 렌더링 과정을 시작해야 합니다.

렌더링 과정 내에서, 우리는 파이프라인을 설정합니다. 이는 마치 `gl.useProgram`과 같은 역할을 합니다. 그 다음으로, 샘플러, 텍스처, 그리고 유니폼용 버퍼들을 위한 바인드 그룹을 설정합니다. 또한, 정점 버퍼들을 이전에 선언한 내용과 일치하도록 설정합니다. 마지막으로, 인덱스 버퍼를 설정하고 `drawIndexed`를 호출합니다. 이는 `gl.drawElements`와 같은 기능입니다.

WebGL에서는 `gl.viewport`를 호출해야 했습니다. WebGPU에서 렌더 패스의 기본 뷰포트는 패스에 연결한 텍스처의 크기와 같습니다. 다른 크기의 뷰포트가 필요할 때만 별도로 설정하면 됩니다.

WebGL에서는 `gl.clear` 함수를 사용하여 캔버스를 깨끗하게 만듭니다. 반면, WebGPU에서는 렌더 패스 설명자를 생성할 때 이미 이 기능을 설정해두었습니다.

## 실제 활용 사례:

WebGL

{{{example url="../webgl-cube.html"}}}

WebGPU

{{{example url="../webgpu-cube.html"}}}

또 한 가지 중요한 점은, `device.queue`라고 불리는 것에 대해 지시를 내리고 있다는 것입니다. 유니폼에 대한 값을 업로드할 때는 `device.queue.writeBuffer`를 사용했으며, 명령 엔코더를 만들고 그것을 `device.queue.submit`와 함께 제출할 때도 마찬가지였습니다. 이를 통해, 같은 명령 엔코더 내에서 드로우 호출 사이에 버퍼를 업데이트할 수 없다는 것을 분명히 알 수 있습니다. 여러 개의 객체를 그리려면 여러 개의 버퍼나 단일 버퍼에 여러 개의 값을 저장해야 합니다.

# 여러 가지 것을 그리기

여러 개의 물체를 그리는 방법에 대한 예시를 살펴보겠습니다.

위에서 언급했듯이, 여러 개의 객체를 그려내려면, 최소한 가장 일반적인 방식으로는 각 객체마다 별도의 유니폼 버퍼가 필요합니다. 그래야만 각 객체에 맞는 별도의 행렬을 제공할 수 있습니다. 유니폼 버퍼는 ‘bind group’을 통해 전달되므로, 각 객체마다 별도의 ‘bind group’도 필요합니다.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
+  const numObjects = 100;
+  const objectInfos = [];
+
+  for (let i = 0; i < numObjects; ++i) {
+    const across = Math.sqrt(numObjects) | 0;
+    const x = (i % across - (across - 1) / 2) * 3;
+    const y = ((i / across | 0) - (across - 1) / 2) * 3;
+
+    objectInfos.push({
+      translation: [x, y, 0],
+    });
+  }
{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  const vUniformBufferSize = 2 * 16 * 4; // mat4 2개 * 행렬당 부동소수점 값 16개 * 값당 4바이트
  const fUniformBufferSize = 3 * 4;      // vec3 1개 * 벡터당 부동소수점 값 3개 * 값당 4바이트

  const fsUniformBuffer = device.createBuffer({
    size: Math.max(16, fUniformBufferSize),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const fsUniformValues = new Float32Array(3);  // 1 벡스3
  const lightDirection = fsUniformValues.subarray(0, 3);

+  const numObjects = 100;
+  const objectInfos = [];
+
+  for (let i = 0; i < numObjects; ++i) {
    const vsUniformBuffer = device.createBuffer({
      size: Math.max(16, vUniformBufferSize),
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vsUniformValues = new Float32Array(2 * 16); // 2개의 mat4 타입
    const worldViewProjection = vsUniformValues.subarray(0, 16);
    const worldInverseTranspose = vsUniformValues.subarray(16, 32);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: vsUniformBuffer  },
        { binding: 1, resource: fsUniformBuffer  },
        { binding: 2, resource: sampler },
        { binding: 3, resource: tex },
      ],
    });

+    const across = Math.sqrt(numObjects) | 0;
+    const x = (i % across - (across - 1) / 2) * 3;
+    const y = ((i / across | 0) - (across - 1) / 2) * 3;
+
+    objectInfos.push({
+      vsUniformBuffer,  // 버퍼를 업데이트해야 합니다.
+      vsUniformValues,  // 버퍼를 업데이트해야 합니다.
+      worldViewProjection,  // 이 객체의 worldViewProject를 업데이트하기 위해서는 그런 것이 필요합니다.
+      worldInverseTranspose,  // 이 객체의 worldInverseTranspose를 업데이트할 수 있도록 해야 합니다.
+      bindGroup, // 이 객체를 렌더링하기 위해서는 필요합니다.
+      translation: [x, y, 0],
+    });
+  }
{{/escapehtml}}</code></pre>
  </div>
</div>

이 예시에서는 `fsUniforms`와 그 버퍼, 그리고 조명 방향을 포함하는 값들을 공유합니다. `fsUniformBuffer`는 바인드 그룹에 포함되어 있지만, 루프 외부에서 정의됩니다. 왜냐하면 사용되는 값이 단 하나뿐이기 때문입니다.

렌더링을 위해, 먼저 공유된 부분들을 설정합니다. 그런 다음 각 오브젝트에 대해 그 오브젝트의 유니폼 값을 업데이트하고, 그 값들을 해당 유니폼 버퍼로 복사합니다. 그리고 그 오브젝트를 그릴 명령어를 인코딩합니다.

<div class="webgpu_center compare">
  <div>
    <div>WebGL</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  function render(time) {
    time *= 0.001;
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);

*    const projection = mat4.perspective(30 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.5, 100);
*    const eye = [1, 4, -46];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    const viewProjection = mat4.multiply(projection, view);

    gl.uniform3fv(u_lightDirectionLoc, vec3.normalize([1, 8, -10]));
    gl.uniform1i(u_diffuseLoc, 0);

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

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);

*    objectInfos.forEach(({translation}, ndx) => {
*      const world = mat4.translation(translation);
*      mat4.rotateX(world, time * 0.9 + ndx, world);
*      mat4.rotateY(world, time + ndx, world);

      gl.uniformMatrix4fv(u_worldInverseTransposeLoc, false, mat4.transpose(mat4.inverse(world)));
      gl.uniformMatrix4fv(u_worldViewProjectionLoc, false, mat4.multiply(viewProjection, world));

      gl.drawElements(gl.TRIANGLES, 6 * 6, gl.UNSIGNED_SHORT, 0);
*    });

    requestAnimationFrame(render);
  }{{/escapehtml}}</code></pre>
  </div>
  <div>
    <div>WebGPU</div>
<pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
  function render(time) {
    time *= 0.001;
    resizeToDisplaySize(device, canvasInfo);

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

    // 물론, 이러한 경우는 개별적인 객체마다 다를 수 있습니다. 하지만 우리는 같은 객체를 그리는 것이기 때문에 그렇지 않습니다.
    // 여러 번 설정할 필요는 없어요. 단 한 번만 설정해주면 됩니다.
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, normalBuffer);
    passEncoder.setVertexBuffer(2, texcoordBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, 'uint16');

*    const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 100);
*    const eye = [1, 4, -46];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const view = mat4.lookAt(eye, target, up);
    const viewProjection = mat4.multiply(projection, view);

    // 조명 관련 정보는 공유되므로, 이 유니폼들을 일단 설정해두세요.
    vec3.normalize([1, 8, -10], lightDirection);
    device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues);

+    objectInfos.forEach(({
+      vsUniformBuffer,
+      vsUniformValues,
+      worldViewProjection,
+      worldInverseTranspose,
+      bindGroup,
+      translation,
+    }, ndx) => {
      passEncoder.setBindGroup(0, bindGroup);

*      const world = mat4.translation(translation);
*      mat4.rotateX(world, time * 0.9 + ndx, world);
*      mat4.rotateY(world, time + ndx, world);
      mat4.transpose(mat4.inverse(world), worldInverseTranspose);
      mat4.multiply(viewProjection, world, worldViewProjection);

      device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues);
      passEncoder.drawIndexed(indices.length);
+    });
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
{{/escapehtml}}</code></pre>
  </div>
</div>

우리가 사용하는 단일 큐브와는 큰 차이가 없지만, 코드는 약간 변경되어서, 공유된 데이터들이 오브젝트 루프 외부에 배치되도록 되어 있습니다. 이 경우에는, 같은 큐브를 100번이나 그리는 경우가 있기 때문에, 정점 버퍼나 인덱스 버퍼를 업데이트할 필요가 없습니다. 하지만 필요하다면 각 오브젝트마다 이러한 데이터들을 수정할 수도 있습니다.

WebGL

{{{example url="../webgl-cube-multiple.html"}}}

WebGPU

{{{example url="../webgpu-cube-multiple.html"}}}

WebGPU에서는 월드 행렬처럼 물체마다 값이 다른 유니폼을 유니폼 버퍼에 담아야 합니다. 따라서 각 물체에 별도의 바인드 그룹이 필요할 수도 있습니다.

## 기타 무작위적인 차이들

### 클립 공간에서 Z의 범위는 0부터 1까지입니다

WebGL에서는 Z 클립 공간의 값이 -1에서 +1까지였습니다. 반면, WebGPU에서는 0에서 1까지입니다. (참고로, 이 방식이 훨씬 더 합리적입니다!)

### Y축은 프레임버퍼, 뷰포트 좌표계에서 아래쪽에 위치합니다.

하지만 이는 WebGL과는 정반대입니다. 클립 공간에서 Y축은 위쪽을 가리킵니다(WebGL과 마찬가지입니다).

다시 말해, 정점 셰이더에서 (-1, -1)를 반환하면, WebGL과 WebGPU 모두에서 왼쪽 하단 모서리를 참조하게 됩니다. 반면, 뷰포트나 스캐이터를 `0, 0, 1, 1`으로 설정하면, WebGL에서는 왼쪽 하단 모서리를, WebGPU에서는 왼쪽 상단 모서리를 참조하게 됩니다.

### WGSL에서는 GLSL의 `gl_XXX` 변수들을 나타내기 위해 `@builtin(???)`을 사용합니다.

`gl_FragCoord`에 대응하는 WGSL 입력은 `@builtin(position) myVarOrField: vec4f`입니다. WebGL의 픽셀 좌표 원점은 왼쪽 아래이지만, WebGPU에서는 왼쪽 위에 있습니다.

`gl_VertexID`는 `@builtin(vertex_index) myVarOrField: u32`입니다.

`gl_InstanceID`는 `@builtin(instance_index) myVarOrField: u32`입니다.

`gl_Position`는 `@builtin(position) vec4f`입니다. 이 값은 정점 셰이더에서 반환된 값이거나, 정점 셰이더가 반환하는 구조체의 필드일 수 있습니다.

WebGPU에서 점은 1픽셀이므로 `gl_PointSize`나 `gl_PointCoord`에 해당하는 기능이 없습니다. 다행히 [점을 직접 그리기](webgpu-points.html)는 쉽습니다.

다른 내장 변수들에 대해서는 [여기](https://www.w3.org/TR/WGSL/#builtin-variables)를 참조하세요.

### WGSL은 1픽셀 너비의 선과 점만을 지원합니다.

설명에 따르면, WebGL2는 1픽셀보다 큰 선을 지원할 수 있었지만, 실제로는 그렇게 하는 구현체는 없었습니다. WebGL2는 1픽셀보다 큰 점들을 대체로 지원했지만, (a) 많은 GPU들은 최대 64픽셀까지만 지원했으며, (b) 각 GPU마다 점의 중심을 기준으로 클리핑을 해주거나 하지 않기도 했습니다. 따라서, WebGPU가 1픽셀 이외의 크기의 점들을 지원하지 않는 것은 좋은 일입니다. 이로 인해, 포터블한 점 처리 방법을 직접 구현해야 합니다.

### WebGPU의 최적화 방식은 WebGL과는 다릅니다.

만약 WebGL 애플리케이션을 직접 WebGPU로 변환한다면, 애플리케이션의 성능이 느려질 수 있습니다. WebGPU의 장점을 활용하려면 데이터를 구성하는 방식을 변경하고, 그림을 그리는 방식을 최적화해야 합니다. WebGPU 최적화에 대한 자세한 정보는 [속도와 최적화](webgpu-optimization.html)를 참고하세요.

[속도와 최적화](webgpu-optimization.html)과 함께 WebGL과 WebGPU를 비교해 보고 싶다면 다음 WebGL 예제를 참고하세요.

* [표준 WebGL 유니폼으로 물체를 최대 30,000개 그리기](../webgl-optimization-none.html)
* [WebGL에서 유니폼 블록으로 물체를 최대 30,000개 그리기](../webgl-optimization-none-uniform-buffers.html)
* [전역, 재질별, 물체별 유니폼 블록으로 WebGL에서 물체를 최대 30,000개 그리기](../webgl-optimization-global-material-per-object-uniform-buffers.html)
* [큰 유니폼 버퍼 하나로 WebGL에서 물체를 최대 30,000개 그리기](../webgl-optimization-uniform-buffers-one-large.html)

WebGL과 WebGPU의 성능을 비교하려면 [이 글](https://toji.dev/webgpu-best-practices/webgl-performance-comparison)도 참고하세요.

---

만약 여러분이 이미 WebGL에 익숙하다면, 이 글이 도움이 되었기를 바랍니다.
