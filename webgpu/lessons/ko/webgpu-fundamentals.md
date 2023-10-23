Title: WebGPU 기초
Description: WebGPU의 기초
TOC: 기초

이 글은 여러분에게 WebGPU의 기초를 가르쳐 드리는 글입니다.

<div class="warn">
여러분이 이 글을 읽기 전에 자바스크립트를 알고 계셔야 합니다.
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map">배열 매핑(mapping arrays)</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment">구조 분해 할당(destructuring assignment)</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax">spreading values</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules">es6 modules</a>과 같은 것들이 많이 사용될 것입니다.
</div>

<div class="warn">WebGL을 알고 계시다면, <a href="webgpu-from-webgl.html">이 글을 읽어보세요</a>.</div>

WebGPU는 여러분에게 두 가지 기본적인 것을 할 수 있게 해주는 API입니다.

1. [삼각형/점/선들을 텍스처에 그리기](#a-drawing-triangles-to-textures)

2. [GPU를 사용해 계산하기](#a-run-computations-on-the-gpu)

이게 다입니다!

이외에 WebGPU와 관련된 것은 여러분들이 하기 나름입니다. 이는 자바스크립트, 러스트, 
C++과 같은 프로그래밍 언어를 배우는 것과 비슷합니다. 기본적인 내용을 배우고 나서, 
이를 창의적으로 활용해서 문제 해결을 하는 것이죠.

WebGPU는 아주 저수준(low-level)의 API입니다. 작은 예제를 만들 수 있지만, 
대부분의 앱(app)을 위해서는 많은 양의 코드와 데이터 구조화 문제를 해결해야 합니다. 
예를 들어 [three.js](https://threejs.org)는 ~600K개의 작은 자바스크립트들로 
이루어져 있고 이것도 기본 라이브러리만 그렇습니다. 데이터 로더(loader), 컨트롤, 
후처리 및 다른 기능들은 포함하지 않은 상태에서요. 
유사하게, [WebGPU 백엔드(backend)의 텐서플로](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-webgpu)는 ~500K개의 자바스크립트로 되어 있습니다.

제가 하고자 하는 말은, 단지 화면에 무언가를 그리고 싶은 거라면 여러분이 직접 만들
어야 하는 것들을 제공해주는 라이브러리를 사용하는 것이 훨씬 낫다는 겁니다.

한편, 특수한 사용 용도가 있다거나, 기존 라이브러리를 수정하고 싶다거나,
아니면 그냥 어떻게 동작하는건지 궁금해 하실 수도 있습니다.
그런 경우에는 계속 읽어 나가시면 됩니다!

# 시작하기

어디서부터 시작해야 할지 모르겠네요. 어느 정도 수준에서는 WebGPU는 아주 간단합니다.
하는 일이라고는 GPU에서 세 가지 종류의 함수를 실행하는 것이지요.
정점 셰이더(Vertex Shader), 프래그먼트 셰이더(Fragment Shader), 컴퓨트 셰이더(Compute Shader) 말입니다.

정점 셰이더는 정점을 계산합니다. 결과로 정점의 위치를 반환해 줍니다.
3개 정점으로 이루어진 그룹마다 그 3개의 위치를 기반으로 한 삼각형이 그려집니다. [^primitives]

[^primitives]: 사실은 다섯 가지 모드가 있습니다.

    * `'point-list'`: 각 위치마다 점을 그림
    * `'line-list'`: 2개 위치마다 직선을 그림
    * `'line-strip'`: 새로운 위치와 이전 위치를 이어 직선을 그림
    * `'triangle-list'`: 3개 위치마다 삼각형을 그림 (**기본값(default)**)
    * `'triangle-strip'`: 새로운 위치와 이전 마지막 2개 위치로 삼각형을 그림

정점 셰이더는 색상값을 계산합니다[^fragment-output]. 
삼각형이 그려지면, 그려질 각 픽셀마다 GPU는 프래그먼트 셰이더를 호출(call)합니다.
그리고 프래그먼트 셰이더는 색상을 반환합니다.

[^fragment-output]: 프래그먼트 셰이더는 텍스처(texture)에 데이터를 씁니다.
그 데이터가 꼭 색상인 것은 아닙니다. 예를 들어 해당 픽셀이 표현하는 표면(surface)의 방향을 출력하는 경우도 흔합니다.

컴퓨트 셰이더는 보다 일반적입니다. 이는 말하자면 "이 함수를 N번 실행해"라고 하는 것과 비슷합니다.
GPU는 여러분이 제공한 함수를 실행할 때마다 반복 회수를 넘겨주어서 여러분은 그 값을 가지고 각 반복마다 다른 작업을 하도록 할 수 있습니다.

배경 지식이 있으신 분이면 이러한 함수는 [`array.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)나,
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)과 비슷하다고 생각하셔도 됩니다.
여러분이 GPU에서 실행하는 함수는 자바스크립트에서의 함수와 같은, 그냥 함수입니다.
다른 점은 이들을 GPU에서 실행한다는 것이고, 그래서 실행하려면 모든 접근해야 할 데이터를 버퍼(buffer)나 텍스처를 사용해 GPU에 넘겨주어야 하고, 함수의 결과도 이러한 버퍼나 텍스처로만 출력됩니다.
함수에 필요한 데이터의 바인딩(binding)이나 위치도 함수에서 알려주어야 합니다. 자바스크립트에서는 데이터가 있는 버퍼와 텍스처를 바인딩하고, 그 바인딩이나 위치에 알려주어야 합니다. 
이렇게 하고 나면 GPU에게 함수를 실행하도록 할 수 있습니다.

<a id="a-draw-diagram"></a>그림이 도움이 될 것 같네요. 아래는 WebGPU에서 정점 셰이더와 프래그먼트 셰이더를 사용해 삼각형을 그리기 위한 설정을 *간단한* 다이어그램으로 표현한 것입니다.

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram.svg" style="width: 960px;"></div>

이 다이어그램에서 아셔야 할 것은

* **파이프라인(pipeline)**이란 것이 있습니다. 여기에 GPU가 실행할 정점 셰이더와 프래그먼트 셰이더가 포함되어 있습니다. 컴퓨트 셰이더가 포함된 파이프라인도 만들 수 있습니다.

* 셰이더는 참조하는 리소스 (버퍼, 텍스처, 샘플러(sampler))를 **바인드 그룹**을 사용해 간접적으로 참조합니다.

* 파이프라인은 내부 상태(state)를 통해 버퍼를 간접적으로 참조하는 어트리뷰트(attribute)를 정의하고 있습니다.

* 어트리뷰트는 버퍼로부터 데이터를 가져오고 정점 셰이더에 넘겨줍니다.

* 정점 셰이더는 프래그먼트 셰이더에 데이터를 넘겨줄 수 있습니다.

* 프래그먼트 셰이더는 렌더 패스(render pass) 기술자(description)을 통해 텍스처에 간접적으로 출력을 씁니다.

GPU에서 셰이더를 실행하려면 이 모든 리소스를 만들고, 상태들을 설정해야 합니다.
리소스의 생성은 상대적으로 간단합니다. 흥미로운 부분은 대부분의 WebGPU 리소스는 생성되고 나면 수정할 수 없다는 점입니다.
내용은 바꿀 수 있지만 크기, 용도, 포맷 등등은 바꿀 수 없습니다.
이것들 중 하나를 바꾸고자 하면 이전 리소스를 버리고 새 리소스를 만들어야 합니다.

몇몇 상태는 생성된 후에 커맨드 버퍼(command buffer)를 통해 실행됩니다.
커맨드 버퍼는 이름 그대로입니다. 커맨드의 버퍼죠.
여러분은 인코더(encoder)를 만들고 이 인코더는 커맨드 버퍼에 커맨드들을 인코딩합니다.
인코딩을 *종료*하면 생성된 커맨드 버퍼를 얻을 수 있습니다.
이후에 커맨드 버퍼를 *제출(submit)*하여 WebGPU가 카맨드를 실행하게 할 수 있습니다.

아래는 커맨드 버퍼를 인코딩하는 의사 코드(pseudo code)와 생성된 커맨드 버퍼를 표현한 그림입니다.

<div class="webgpu_center side-by-side"><div style="min-width: 300px; max-width: 400px; flex: 1 1;"><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
encoder = device.createCommandEncoder()
// 무언가를 그림
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setVertexBuffer(1, …)
  pass.setIndexBuffer(...)
  pass.setBindGroup(0, …)
  pass.setBindGroup(1, …)
  pass.draw(...)
  pass.end()
}
// 다른 것도 그림
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// 무언가를 계산함
{
  pass = encoder.beginComputePass(...)
  pass.beginComputePass(...)
  pass.setBindGroup(0, …)
  pass.setPipeline(...)
  pass.dispatchWorkgroups(...)
  pass.end();
}
commandBuffer = encoder.finish();
{{/escapehtml}}</code></pre></div>
<div><img src="resources/webgpu-command-buffer.svg" style="width: 300px;"></div>
</div>

커맨드 버퍼가 생성되면 실행하기 위해 *제출*합니다.

```js
device.queue.submit([commandBuffer]);
```

위 다이어그램은 커맨드 버퍼에서 뭔가를 `draw`하는 명령의 상태를 표현합니다. 
커맨드를 싱행하면 *내부 상태*가 설정되고 *그리기(draw)* 명령은 GPU에게 정점 셰이더 (그리고 간접적으로 프래그먼트 셰이더도)를 실행하도록 합니다. `dispatchWorkgroup` 커맨드는 GPU에게 컴퓨트 셰이더를 실행하게 하고요.

이 설명을 통해 여러분이 설정해야 할 상태들의 이미지가 그려졌으면 합니다.
앞서 이야기 한 것처럼, WebGPU는 두 가지 일을 할 수 있습니다.

1. [삼각형/점/선들을 텍스처에 그리기](#a-drawing-triangles-to-textures)

2. [GPU를 사용해 계산하기](#a-run-computations-on-the-gpu)

각각의 작업에 대해 짧은 예제를 살펴볼 것입니다.
다른 글에서는 이러한 작업을 위해 데이터를 제공하는 다양한 방법을 보여드립니다.
이것들은 아주 기초적인 내용임을 명심하세요. 이러한 기초를 기반으로 알아야 합니다.
나중에는 이들을 활용해 일반적으로 GPU를 사용해 수행하는 2차원, 3차원 그래픽 등을 보여드릴 것입니다.

# <a id="a-drawing-triangles-to-textures"></a>텍스처에 삼각형 그리기

WebGPU는 [텍스처](webgpu-textures.html)에 삼각형을 그릴 수 있습니다. 이 글의 목적을 생각해서, 텍스처를 2차원 사각형이라고 가정하겠습니다.[^textures]
`<canvas>` 엘리먼트(element)는 웹페이지 내의 텍스처를 의미합니다.
WebGPU에서 우리는 캔버스(canvas)의 텍스처를 요청하고 거기에 렌더링(render)을 할 수 있습니다.

[^textures]: 텍스처는 픽셀로 이루어진 3차원 사각형이나, 큐브맵(cubemap, 육면체를 이루는 6개 정사각형의 픽셀들) 등등일 수 있지만 가장 흔히 사용되는 것은 픽셀로 이루어진 2차원 사각형입니다.

WebGPU를 사용해 삼각형을 그리려면 두 개의 "셰이더"를 제공해야 합니다.
다시 말하지만 셰이더는 GPU에서 실행되는 함수입니다. 두 종류의 셰이더는,

1. 정점 셰이더

   정점 셰이더는 삼각형/직선/점을 그리기 위한 정점의 위치를 계산함
   
2. 프래그먼트 셰이더

   프래그먼트 셰이더는 삼각형/직선/점을 그릴 때, 그려질/래스터화(rasterize)될 각 픽셀의 색상 (또는 다른 데이터)을 계산함
   
삼각형을 그리는 아주 작은 WebGPU 프로그램을 만들어 봅시다.

삼각형을 표현하기 위한 캔버스가 필요하고,

```html
<canvas></canvas>
```

자바스크립트를 위한 `<script>` 태그가 필요합니다.

```html
<canvas></canvas>
+<script type="module">

... javascript goes here ...

+</script>
```

아래 모든 자바스크립트 코드는 이 script 태그 사이에 들어갑니다.

WebGPU는 비동기(asynchronous) API라서 async 함수 안에서 사용하는 것이 편리합니다.
먼저 어댑터(adapter)부터 요청하고, 어댑터로부터 디바이스(device)를 요청합니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
}
main();
```

위 코드는 보시는 그대로입니다. 먼저 [`?.` optional chaining operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)으로 어댑터를 요청했으므로 `navigator.gpu`가 없다면 `adapter`는 정의되지 않을 것입니다.
존재한다면 `requestAdapter`를 호출합니다. 결과가 비동기적으로 반환되므로 `await`가 필요합니다.
어댑터는 특정 GPU를 의미합니다. 어떤 디바이스는 여러 GPU가 있을 수 있습니다.

어댑터로부터 디바이스를 요청하는데 역시 `?.`을 사용했으므로 어댑터가 정의되지 않은 경우 디바이스도 정의되지 않을 겁니다.

`device`가 설정되지 않았으면 사용자가 낡은 브라우저(browser)를 사용하고 있을 가능성이 높습니다.

다음으로 캔버스로부터 `webgpu` 컨텍스트(context)를 찾습니다.
이를 통해 렌더링을 수행할 텍스처를 얻을 수 있습니다.
그 텍스처가 웹페이지에 캔버스를 표시하는 데 사용됩니다.

```js
  // 캔버스로부터 WebGPU 컨텍스트를 얻고 설정함
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
```

역시 보시는 그대로입니다. `"webgpu"` 컨텍스트를 캔버스로부터 얻었습니다.
시스템에 선호하는 캔버스 포맷이 무엇인지 물어보았고 이는 `"rgba8unorm"` 또는 `"bgra8unorm"`입니다.
무엇인지는 중요하지 않지만 이러한 것을 질의(query)함으로써 사용자의 시스템에서 작업이 보다 빠르게 이루어지게 할 수 있습니다.

우리는 `configure`를 호출하여 이를 `format`으로 webgpu 캔버스 컨텍스트로 넘겼습니다.
또한 `device`도 넘겨 주었는데 이는 이 캔버스와 방금 생성한 장치를 연결시켜 줍니다.

다음으로 셰이더 모듈을 만듭니다. 셰이더 모듈은 하나 이상의 셰이더 함수를 포함합니다.
우리의 경우 하나의 정점 셰이더와 하나의 프래그먼트 셰이더 함수를 만들 겁니다.

```js
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });
```

셰이더는 [WebGPU Shading Language (WGSL)](https://gpuweb.github.io/gpuweb/wgsl/) 언어로 작성되었는데, 이는 wig-sil로 발음합니다.
WGSL은 강 타입 언어(strongly typed language)로 [다른 글](webgpu-wgsl.html)에서 보다 자세히 알아볼 것입니다.
지금은 기본적인 이해를 위한 최소한의 설명만 하겠습니다.

위에 `vs`로 정의된 함수가 `@vertex` 어트리뷰트를 가지고 있습니다.
이를 통해 해당 함수가 정점 셰이더 함수임을 알려줍니다.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
         ...
```

이 함수는 `vertexIndex`라고 이름지은 매개변수 하나를 받습니다. `vertexIndex`는 `u32`인데 이는 *32비트 부호 없는(unsigned) 정수*입니다. 그 값은 내장(builtin)된 `vertex_index`로부터 받습니다. `vertex_index`는 자바스크립트의 `Array.map(function(value, index) { ... })`에서와 같은 반복 회수라고 생각하십시오. 
GPU에 `draw`를 통해 이 함수를 10번 실행하라고 하면 첫 `vertex_index`는 `0`이고, 구 번째는 `1`, 세 번째는 `2`가 될겁니다.[^indices]

[^indices]: `vertex_index`를 명시하기 위해 인덱스(index) 버퍼를 사용할 수도 있습니다. 이 내용은 [정점 버퍼에 관한 글](webgpu-vertex-buffers.html#a-index-buffers)에서 다룰 것입니다.

`vs`함수는 `vec4f`를 반환하도록 선언되었고 이는 32비트 부동소수점(floating point) 네 개로 이루어진 벡터입니다. 
4개 값으로 이루어진 배열이나 `{x: 0, y: 0, z: 0, w: 0}`와 같은 네 개의 속성을 갖는 객체라고 생각하시면 됩니다. 
반환된 값은 `position` 내장 변수에 대입됩니다.
"triangle-list" 모드에서는 정점 셰이더가 세 번 실행되면 세 개의 `position`으로 정의된 삼각형이 하나 그려집니다.

WebGPU의 position은 *클립 공간(clip space)*로 반환되어야 합니다. 이는 X값이 왼쪽 -1.0에서 오른쪽 +1.0, Y값이 아래쪽 -1.0에서 위쪽 +1.0인 공간입니다. 
이는 우리가 그리려고 하는 텍스처의 크기와는 무관합니다.

<div class="webgpu_center"><img src="resources/clipspace.svg" style="width: 500px"></div>

`vs` 함수는 세 개의 `vec2f`로 이루어진 배열을 정의합니다. 각 `vec2f`는 두 개의 32비트 부동소수점으로 정의됩니다.

```wgsl
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
```

마지막으로 `vertexIndex`를 사용해서 배열로부터 이 세 개의 값 중 하나를 반환합니다.
함수는 값을 반환하기 위해 네 개의 부동소수점 값이 필요한데 `pos`는 `vec2f` 배열이므로 코드에서는 `0.0`과 `1.0`을 나머지 두 값으로 설정합니다.

```wgsl
        return vec4f(pos[vertexIndex], 0.0, 1.0);
```

셰이더 모듈은 또한 `fs`라 불리는 함수를 선언하고 `@fragment` 어트리뷰트가 있으므로 프래그먼트 셰이더 함수입니다.

```wgsl
      @fragment fn fs() -> @location(0) vec4f {
```

이 함수는 매개변수를 받지 않고 `vec4f`를 `location(0)`에 반환합니다.
이는 이 함수가 첫 렌더 타겟(render target)에 값을 쓴다는 것을 의미합니다.
나중에 첫 렌더 타겟을 우리의 캔버스 텍스처로 설정할 것입니다.

```wgsl
        return vec4f(1, 0, 0, 1);
```

코드는 `1, 0, 0, 1`를 반환하고, 이는 빨간색입니다.
WebGPU에서 색상은 대개 `0.0`과 `1.0`사이의 부동소수점으로 명시합니다.
위 4개의 값은 각각 빨간색, 초록색, 파란색, 알파(alpha)를 의미합니다.

GPU가 삼각형을 래스터화(rasterize)할 때(즉, 픽셀로 그릴 때), 프래그먼트를 호출하여 어떤 색깔로 각 픽셀을 칠할지 알아봅니다.
우리의 경우 그냥 빨간색을 반환해 주고 있습니다.

주목해야 할 한가지는 `label`입니다. WebGPU에서 생성할 수 있는 거의 모든 객체는 `label`을 받습니다. 레이블(label)은 선택적인 값이지만, 만드는 모든 것에 레이블을 붙이는 것이 *좋은 방식입니다*. 오류가 발생하면 대부분의 WebGPU 구현은 오류 메시지를 출력하는데 해당 오류와 관계된 레이블을 포함하여 출력해 주기 때문입니다.

보통의 앱에서 여러분은 100~1000 개의 버퍼, 텍스처, 셰이더 모듈, 파이프라인 등을 갖게 됩니다. 
`"WGSL syntax error in shaderModule at line 10"`과 같은 오류가 발생했는데 셰이더 모듈이 100개라면 어떤 것이 오류가 난 것일까요?
레이블을 달아 두었으면 `"WGSL syntax error in shaderModule('our hardcoded red triangle shaders') at line 10`와 같은 오류 메시지가 보일 것이고, 이것이 훨씬 유용한 오류 메시지일 것입니다. 
또한 이렇게 하면 문제를 해결하는 데 아주 많은 시간을 아낄 수 있습니다.

이제 셰이더 모듈을 만들었으니, 다음으로 렌더 파이프라인(render pipeline)을 만들어야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

In this case there isn't much to see. We set `layout` to `'auto'` which means
to ask WebGPU to derive the layout of data from the shaders. We're not using
any data though.

We then tell the render pipeline to use the `vs` function from our shader module
for a vertex shader and the `fs` function for our fragment shader. Otherwise we
tell it the format of the first render target. "render target" means the texture
we will render to. We create a pipeline
we have to specify the format for the texture(s) we'll use this pipeline to
eventually render to.

Element 0 for the `targets` array corresponds to location 0 as we specified for
the fragment shader's return value. Later, well set that target to be a texture
for the canvas.

Next up we prepare a `GPURenderPassDescriptor` which describes which textures
we want to draw to and how to use them.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };  
```

A `GPURenderPassDescriptor` has an array for `colorAttachments` which lists
the textures we will render to and how to treat them.
We'll wait to fill in which texture we actually want to render to. For now,
we setup a clear value of semi-dark gray, and a `loadOp` and `storeOp`.
`loadOp: 'clear'` specifies to clear the texture to the clear value before
drawing. The other option is `'load'` which means load the existing contents of
the texture into the GPU so we can draw over what's already there. 
`storeOp: 'store'` means store the result of what we draw. We could also pass `'discard'`
which would throw away what we draw. We'll cover why we might want to do that in
[another article](webgpu-multisampling.html).

Now it's time to render. 

```js
  function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);  // call our vertex shader 3 times
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  render();
```

First we call `context.getCurrentTexture()` to get a texture that will appear in the
canvas. Calling `createView` gets a view into a specific part of a texture but
with no parameters it will return the default part which is what we want in this
case. For now our only `colorAttachment` is a texture view from our
canvas which we get via the context we created at the start. Again, element 0 of
the `colorAttachments` array corresponds to `@location(0)` as we specified for
the return value of the fragment shader.

Next we create a command encoder. A command encoder is used to create a command
buffer. We use it to encode commands and then "submit" the command buffer it
created to have the commands executed.

We then use the command encoder to create a render pass encoder by calling `beginRenderPass`. A render
pass encoder is a specific encoder for creating commands related to rendering.
We pass it our `renderPassDescriptor` to tell it which texture we want to
render to.

We encode the command, `setPipeline`, to set our pipeline and then tell it to
execute our vertex shader 3 times by calling `draw` with 3. By default, every 3
times our vertex shader is executed a triangle will be drawn by connecting the 3
values just returned from the vertex shader.

We end the render pass, and then finish the encoder. This gives us a
command buffer that represents the steps we just specified. Finally we submit
the command buffer to be executed.

When the `draw` command is executed, this will be our state

<div class="webgpu_center"><img src="resources/webgpu-simple-triangle-diagram.svg" style="width: 723px;"></div>

We've got no textures, no buffers, no bindGroups but we do have a pipeline, a
vertex and fragment shader, and a render pass descriptor that tells our shader
to render to the the canvas texture.

The result

{{{example url="../webgpu-simple-triangle.html"}}}

It's important to emphasize that all of these functions we called
like `setPipeline`, and `draw` only add commands to a command buffer.
They don't actually execute the commands. The commands are executed
when we submit the command buffer to the device queue.

<a id="a-rasterization"></a>WebGPU takes every 3 vertices we return from our vertex shader uses
them to rasterize a triangle. It does this by determining which pixels'
centers are inside the triangle. It then calls our fragment shader for
each pixel to ask what color to make it.

Imagine the texture we are rendering
to was 15x11 pixels. These are the pixels that would be drawn to

<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; max-width: 500px; width: 100%"></div>
  <div>drag the vertices</div>
</div>

So, now we've seen a very small working WebGPU example. It should be pretty
obvious that hard coding a triangle inside a shader is not very flexible. We
need ways to provide data and we'll cover those in the following articles. The
points to take away from the code above,

* WebGPU just runs shaders. Its up to you to fill them with code to do useful things
* Shaders are specified in a shader module and then turned into a pipeline
* WebGPU can draw triangles
* WebGPU draws to textures (we happened to get a texture from the canvas)
* WebGPU works by encoding commands and then submitting them.

# <a id="a-run-computations-on-the-gpu"></a>Run computations on the GPU

Let's write a basic example for doing some computation on the GPU

We start off with the same code to get a WebGPU device

```js
async function main() {
  const adapter = await gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

When we create a shader module

```js
  const module = device.createShaderModule({
    label: 'doubling compute module',
    code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3<u32>
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });
```

First we declare a variable called `data` of type `storage` that we want to be
able to both read from and write to.

```wgsl
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

We declare its type as `array<f32>` which means an array of 32bit floating point
values. We tell it we're going to specify this array on binding location 0 (the
`binding(0)`) in bindGroup 0 (the `@group(0)`).

Then we declare a function called `computeSomething` with the `@compute`
attribute which makes it a compute shader. 

```wgsl
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        ...
```

Compute shaders are required to declare a workgroup size which we will cover
later. For now we'll just set it to 1 with the attribute `@workgroup_size(1)`.
We declare it to have one parameter `id` which uses a `vec3u`. A `vec3u` is
three unsigned 32 integer values. Like our vertex shader above, this is the
iteration number. It's different in that compute shader iteration numbers are 3
dimensional (have 3 values). We declare `id` to get its value from the built-in
`global_invocation_id`.

You can *kind of* think of a compute shaders as running like this. This is an over
simplification but it will do for now.

```js
// pseudo code
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  // from @workgroup_size in WGSL
  const workgroup_size = shaderCode.workgroup_size;
  const {x: width, y: height, z: depth} = workgroup.size;
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const local_invocation_id = {x, y, z};
        const global_invocation_id =
            workgroup_id * workgroup_size + local_invocation_id;
        computeShader(global_invocation_id)
      }
    }
  }
}
```

Since we set `@workgroup_size(1)`, effectively the pseudo code above becomes

```js
// pseudo code
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  const global_invocation_id = workgroup_id;
  computeShader(global_invocation_id)
}
```

Finally we use the `x` property of `id` to index `data` and multiply each value
by 2

```wgsl
        let i = id.x;
        data[i] = data[i] * 2.0;
```

Above, `i` is just the first of the 3 iteration numbers.

Now that we've created the shader we need to create a pipeline

```js
  const pipeline = device.createComputePipeline({
    label: 'doubling compute pipeline',
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'computeSomething',
    },
  });
```

Here we just tell it we're using a `compute` stage from the shader `module` we
created and we want to call the `computeSomething` function. `layout` is
`'auto'` again, telling WebGPU to figure out the layout from the shaders. [^layout-auto]

[^layout-auto]: `layout: 'auto'` is convenient but, it's impossible to share bind groups
across pipelines using `layout: 'auto'`. Most of the examples on this site
never use a bind group with multiple pipelines. We'll cover explicit layouts in [another article](webgpu-drawing-multiple-things.html).

Next we need some data

```js
  const input = new Float32Array([1, 3, 5]);
```

That data only exists in JavaScript. For WebGPU to use it we need to make a
buffer that exists on the GPU and copy the data to the buffer.

```js
  // create a buffer on the GPU to hold our computation
  // input and output
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // Copy our input data to that buffer
  device.queue.writeBuffer(workBuffer, 0, input);
```

Above we call `device.createBuffer` to create a buffer. `size` is the size in
bytes, in this case it will be 12 because size in bytes of a `Float32Array` of 3
values is 12. If you're not familiar with `Float32Array` and typed arrays then
see [this article](webgpu-memory-layout.html).

Every WebGPU buffer we create has to specify a `usage`. There are a bunch of
flags we can pass for usage but not all of them can be used together. Here we
say we want this buffer to be usable as `storage` by passing
`GPUBufferUsage.STORAGE`. This makes it compatible with `var<storage,...>` from
the shader. Further, we want to able to copy data to this buffer so we include
the `GPUBufferUsage.COPY_DST` flag. And finally we want to be able to copy data
from the buffer so we include `GPUBufferUsage.COPY_SRC`.

Note that you can not directly read the contents of a WebGPU buffer from
JavaScript. Instead you have to "map" it which is another way of requesting
access to the buffer from WebGPU because the buffer might be in use and because
it might only exist on the GPU.

WebGPU buffers that can be mapped in JavaScript can't be used for much else. In
other words, we can not map the buffer we just created above and if we try to add
the flag to make it mappable we'll get an error that that is not compatible with
usage `STORAGE`.

So, in order to see the result of our computation, we'll need another buffer.
After running the computation, we'll copy the buffer above to this result buffer
and set its flags so we can map it.

```js
  // create a buffer on the GPU to get a copy of the results
  const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
```

`MAP_READ` means we want to be able to map this buffer for reading data.

In order to tell our shader about the buffer we want it to work on we need to
create a bindGroup

```js
  // Setup a bindGroup to tell the shader which
  // buffer to use for the computation
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workBuffer } },
    ],
  });
```

We get the layout for the bindGroup from the pipeline. Then we setup bindGroup
entries. The 0 in `pipeline.getBindGroupLayout(0)` corresponds to the
`@group(0)` in the shader. The `{binding: 0 ...` of the `entries` corresponds to
the `@group(0) @binding(0)` in the shader.

Now we can start encoding commands

```js
  // Encode commands to do the computation
  const encoder = device.createCommandEncoder({
    label: 'doubling encoder',
  });
  const pass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
  pass.end();
```

We create a command encoder. We start a compute pass. We set the pipeline, then
we set the bindGroup. Here, the `0` in `pass.setBindGroup(0, bindGroup)`
corresponds to `@group(0)` in the shader. We then call `dispatchWorkgroups` and in
this case we pass it `input.length` which is `3` telling WebGPU to run the
compute shader 3 times. We then end the pass.

Here's what the situation will be when `dispatchWorkgroups` is executed

<div class="webgpu_center"><img src="resources/webgpu-simple-compute-diagram.svg" style="width: 553px;"></div>

After the computation is finished we ask WebGPU to copy from `workBuffer` to
`resultBuffer`

```js
  // Encode a command to copy the results to a mappable buffer.
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
```

Now we can `finish` the encoder to get a command buffer and then submit that
command buffer.

```js
  // Finish encoding and submit the commands
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

We then map the results buffer and get a copy of the data

```js
  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log('input', input);
  console.log('result', result);

  resultBuffer.unmap();
```

To map the results buffer we call `mapAsync` and have to `await` for it to
finish. Once mapped, we can call `resultBuffer.getMappedRange()` which with no
parameters will return an `ArrayBuffer` of the entire buffer. We put that in a
`Float32Array` typed array view and then we can look at the values. One
important detail, the `ArrayBuffer` returned by `getMappedRange` is only valid
until we call `unmap`. After `unmap` its length with be set to 0 and its data
no longer accessible.

Running that we can see we got the result back, all the numbers have been
doubled.

{{{example url="../webgpu-simple-compute.html"}}}

We'll cover how to really use compute shaders in other articles. For now, you
hopefully have gleaned some understanding of what WebGPU does. EVERYTHING ELSE
IS UP TO YOU! Think of WebGPU as similar to other programming languages. It
provides a few basic features, and leaves the rest to your creativity.

What makes WebGPU programming special is these functions, vertex shaders,
fragment shaders, and compute shaders, run on your GPU. A GPU could have over
10000 processors which means they can potentially do more than 10000
calculations in parallel which is likely 3 or more orders of magnitude than your
CPU can do in parallel.

## Simple Canvas Resizing

Before we move on, let's go back to our triangle drawing example and add some
basic support for resizing a canvas. Sizing a canvas is actually a topic that
can have many subtleties so [there is an entire article on it](webgpu-resizing-the-canvas.html).
For now though let's just add some basic support

First we'll add some CSS to make our canvas fill the page

```html
<style>
html, body {
  margin: 0;       /* remove the default margin          */
  height: 100%;    /* make the html,body fill the page   */
}
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
}
</style>
```

That CSS alone will make the canvas get displayed to cover the page but it won't change
the resolution of the canvas itself so you might notice if you make the example below
large, like if you click the full screen button, you'll see the edges of the triangle
are blocky.

{{{example url="../webgpu-simple-triangle-with-canvas-css.html"}}}

`<canvas>` tags, by default, have a resolution of 300x150 pixels. We'd like to
adjust the canvas resolution of the canvas to match the size it is displayed.
One good way to do this is with a `ResizeObserver`. You create a
`ResizeObserver` and give it a function to call whenever the elements you've
asked it to observe change their size. You then tell it which elements to
observe.

```js
    ...
-    render();

+    const observer = new ResizeObserver(entries => {
+      for (const entry of entries) {
+        const canvas = entry.target;
+        const width = entry.contentBoxSize[0].inlineSize;
+        const height = entry.contentBoxSize[0].blockSize;
+        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
+        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
+        // re-render
+        render();
+      }
+    });
+    observer.observe(canvas);
```

In the code above we go over all the entries but there should only ever be one
because we're only observing our canvas. We need to limit the size of the canvas
to the largest size our device supports otherwise WebGPU will start generating
errors that we tried to make a texture that is too large. We also need to make
sure it doesn't go to zero or again we'll get errors. 
[See the longer article for details](webgpu-resizing-the-canvas.html).

We call `render` to re-render the
triangle at the new resolution. We removed the old call to `render` because
it's not needed. A `ResizeObserver` will always call its callback at least once
to report the size of the elements when they started being observed.

The new size texture is created when we call `context.getCurrentTexture()` 
inside `render` so there's nothing left to do.

{{{example url="../webgpu-simple-triangle-with-canvas-resize.html"}}}

In the following articles we'll cover various ways to pass data into shaders.

* [inter-stage variables](webgpu-inter-stage-variables.html)
* [uniforms](webgpu-uniforms.html)
* [storage buffers](webgpu-storage-buffers.html)
* [vertex buffers](webgpu-vertex-buffers.html)
* [textures](webgpu-textures.html)
* [constants](webgpu-constants.html)

Then we'll cover [the basics of WGSL](webgpu-wgsl.html).

This order is from the simplest to the most complex. Inter-stage variables
require no external setup to explain. We can see how to use them using nothing
but changes to the WGSL we used above. Uniforms are effectively global variables
and as such are used in all 3 kinds of shaders (vertex, fragment, and compute).
Going from uniform buffers to storage buffers is trivial as shown at the top of
the article on storage buffers. Vertex buffers are only used in vertex shaders.
They are more complex because they require describing the data layout to WebGPU.
Textures are most complex as they have tons of types and options.

I'm a little bit worried these article will be boring at first. Feel free to
jump around if you'd like. Just remember if you don't understand something you
probably need to read or review these basics. Once we get the basics down we'll
start going over actual techniques.

One other thing. All of the example programs can be edited live in the webpage.
Further, they can all easily be exported to [jsfiddle](https://jsfiddle.net) and [codepen](https://codepen.io)
and even [stackoverflow](https://stackoverflow.com). Just click "Export".

<div class="webgpu_bottombar">
<p>
The code above gets a WebGPU device in very terse way. A more verbose
way would be something like
</p>
<pre class="prettyprint showmods">{{#escapehtml}}
async function start() {
  if (!navigator.gpu) {
    fail('this browser does not support WebGPU');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('this browser supports webgpu but it appears disabled');
    return;
  }

  const device = await adapter?.requestDevice();
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);

    // 'reason' will be 'destroyed' if we intentionally destroy the device.
    if (info.reason !== 'destroyed') {
      // try again
      start();
    }
  });
  
  main(device);
}
start();

function main(device) {
  ... do webgpu ...
}
{{/escapehtml}}</pre>
<p>
<code>device.lost</code> is a promise that starts off unresolved. It will resolve if and when the
device is lost. A device can be lost for many reasons. Maybe the user ran a really intensive
app and it crashed their GPU. Maybe the user updated their drivers. Maybe the user has
an external GPU and unplugged it. Maybe another page used a lot of GPU, your
tab was in the background and the browser decided to free up some memory by
losing the device for background tabs. The point to take away is that for any serious
apps you probably want to handle losing the device.
</p>
<p>
Note that <code>requestDevice</code> always returns a device. It just might start lost.
WebGPU is designed so that, for the most part, the device will appear to work,
at least from an API level. Calls to create things and use them will appear
to succeed but they won't actually function. It's up to you to take action
when the <code>lost</code> promise resolves.
</p>
</div>

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-fundamentals.js"></script>




