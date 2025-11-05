Title: WebGPU 투명도와 블렌딩
Description: WebGPU에서 픽셀 블렌딩하기
TOC: 투명도와 블렌딩

투명도와 블렌딩에 대해 설명하기는 어렵습니다. 왜냐하면 특정 상황에서 필요한 것이 다른 상황에서 필요한 것과 다르기 때문입니다. 따라서 이 글은 주로 WebGPU 기능에 대한 둘러보기가 될 것이며, 특정 기법을 다룰 때 여기를 다시 참조할 수 있도록 할 것입니다.

## <a href="a-alphamode"></a> 캔버스 `alphaMode`

먼저 알아야 할 것은, WebGPU 내에서의 투명도와 블렌딩이 있지만, WebGPU 캔버스와 HTML 페이지 사이의 투명도와 블렌딩도 있다는 것입니다.

기본적으로 WebGPU 캔버스는 불투명합니다. 알파 채널은 무시됩니다. 무시되지 않도록 하려면 `configure`를 호출할 때 `alphaMode`를 `'premultiplied'`로 설정해야 합니다. 기본값은 `'opaque'`입니다.

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });
```

`alphaMode: 'premultiplied'`가 무엇을 의미하는지 이해하는 것이 중요합니다. 이것은 캔버스에 넣는 색상의 색상 값이 이미 알파 값으로 곱해져 있어야 한다는 것을 의미합니다.

가능한 한 가장 작은 예제를 만들어 봅시다. 렌더 패스를 만들고 클리어 색상을 설정하기만 하면 됩니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });

  const clearValue = [1, 0, 0, 0.01];
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  function render() {
    const encoder = device.createCommandEncoder({ label: 'clear encoder' });
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      render();
    }
  });
  observer.observe(canvas);
}
```

캔버스의 CSS 배경을 회색 체크무늬로 설정해 봅시다.

```css
canvas {
  background-color: #404040;
  background-image:
     linear-gradient(45deg, #808080 25%, transparent 25%),
     linear-gradient(-45deg, #808080 25%, transparent 25%),
     linear-gradient(45deg, transparent 75%, #808080 75%),
     linear-gradient(-45deg, transparent 75%, #808080 75%);
  background-size: 32px 32px;
  background-position: 0 0, 0 16px, 16px -16px, -16px 0px;
}
```

여기에 클리어 값의 알파와 색상, 그리고 사전 곱셈 여부를 설정할 수 있는 UI를 추가해 봅시다.

```js
+import GUI from '../3rdparty/muigui-0.x.module.js';

...

+  const color = [1, 0, 0];
+  const settings = {
+    premultiply: false,
+    color,
+    alpha: 0.01,
+  };
+
+  const gui = new GUI().onChange(render);
+  gui.add(settings, 'premultiply');
+  gui.add(settings, 'alpha', 0, 1);
+  gui.addColor(settings, 'color');

  function render() {
    const encoder = device.createCommandEncoder({ label: 'clear encoder' });
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

+    const { alpha } = settings;
+    clearValue[3] = alpha;
+    if (settings.premultiply) {
+      // 색상을 알파로 사전 곱셈합니다
+      clearValue[0] = color[0] * alpha;
+      clearValue[1] = color[1] * alpha;
+      clearValue[2] = color[2] * alpha;
+    } else {
+      // 사전 곱셈되지 않은 색상을 사용합니다
+      clearValue[0] = color[0];
+      clearValue[1] = color[1];
+      clearValue[2] = color[2];
+    }

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

이것을 실행하면 문제가 있다는 것을 알 수 있을 것입니다.

{{{example url="../webgpu-canvas-alphamode-premultiplied.html"}}}

여기에 나타나는 색상은 **정의되지 않았습니다**!!!

제 컴퓨터에서는 이런 색상이 나타났습니다.

<img src="resources/canvas-invalid-color.png" class="center" style="width: 440px">

무엇이 잘못되었는지 보이시나요? 알파를 0.01로 설정했습니다. 배경 색상은 중간 회색과 진한 회색이어야 합니다. 색상은 빨강(1, 0, 0)으로 설정되어 있습니다. 중간/진한 회색 체크무늬 위에 0.01 양의 빨강을 올리면 거의 감지할 수 없어야 하는데, 왜 두 가지 밝은 분홍색 음영으로 나타날까요?

이유는 **이것이 잘못된 색상이기 때문입니다!** 캔버스의 색상은 `1, 0, 0, 0.01`이지만 이것은 사전 곱셈된 색상이 아닙니다. "사전 곱셈"은 캔버스에 넣는 색상이 이미 알파 값으로 곱해져 있어야 한다는 것을 의미합니다. 알파 값이 0.01인 경우, 다른 값은 0.01보다 크면 안 됩니다.

'premultiplied' 체크박스를 클릭하면 코드가 색상을 사전 곱셈할 것입니다. 캔버스에 넣어지는 값은 `0.01, 0, 0, 0.01`이 되고 올바르게 보이며, 거의 감지할 수 없을 것입니다.

'premultiplied'를 체크한 상태에서 알파를 조정하면, 알파가 1에 가까워질수록 빨강으로 페이드되는 것을 볼 수 있습니다.

> 참고: 예제 `1, 0, 0, 0.01`은 잘못된 색상이기 때문에, 어떻게 표시되는지는 정의되지 않았습니다. 잘못된 색상으로 어떤 일이 일어나는지는 브라우저에 달려 있으므로, 잘못된 색상을 사용하고 기기 간에 동일한 결과를 기대하지 마십시오.

색상이 1, 0.5, 0.25(주황색)이고 33% 투명하게 만들고 싶다면 알파는 0.33입니다. 그러면 "사전 곱셈된 색상"은 다음과 같습니다.

```
                      premultiplied
   ---------------------------------
   r = 1    * 0.33   = 0.33
   g = 0.5  * 0.33   = 0.165
   g = 0.25 * 0.33   = 0.0825
   a = 0.33          = 0.33
```

사전 곱셈된 색상을 얻는 방법은 여러분에게 달려 있습니다. 사전 곱셈되지 않은 색상이 있다면, 셰이더에서 다음과 같은 코드로 사전 곱셈할 수 있습니다.

```wgsl
   return vec4f(color.rgb * color.a, color.a)`;
```

[텍스처 가져오기에 관한 글](webgpu-importing-textures.html)에서 다룬 `copyExternalImageToTexture` 함수는 `premultipliedAlpha: true` 옵션을 받습니다. ([아래 참조](#copyExternalImageToTexture)) 이것은 `copyExternalImageToTexture`를 호출하여 이미지를 텍스처로 로드할 때, 텍스처로 복사하면서 WebGPU에게 색상을 사전 곱셈하도록 지시할 수 있다는 것을 의미합니다. 그렇게 하면 `textureSample`을 호출할 때 얻는 값은 이미 사전 곱셈되어 있을 것입니다.

이 섹션의 요점은 다음과 같습니다.

1. `alphaMode: 'premultiplied'` WebGPU 캔버스 설정 옵션을 설명하기 위해서입니다.

   이것은 WebGPU 캔버스가 투명도를 가질 수 있게 합니다.

2. 사전 곱셈된 알파 색상의 개념을 소개하기 위해서입니다.

   사전 곱셈된 색상을 얻는 방법은 여러분에게 달려 있습니다. 위의 예제에서는 JavaScript로 사전 곱셈된 `clearValue`를 만들었습니다.

   프래그먼트 셰이더(그리고/또는) 다른 셰이더에서 색상을 반환할 수도 있습니다. 그 셰이더들에 사전 곱셈된 색상을 제공할 수도 있습니다. 셰이더 자체에서 곱셈을 수행할 수도 있습니다. 색상을 사전 곱셈하기 위해 후처리 패스를 실행할 수도 있습니다. 중요한 것은 `alphaMode: 'premultiplied'`를 사용하는 경우, 어떤 방식으로든 캔버스의 색상이 최종적으로 사전 곱셈되어 있어야 한다는 것입니다.

   사전 곱셈된 색상과 사전 곱셈되지 않은 색상에 대한 좋은 참고 자료는 다음 글입니다:
   [GPU는 사전 곱셈을 선호합니다](https://www.realtimerendering.com/blog/gpus-prefer-premultiplication/).

## <a href="a-discard"></a> Discard

`discard`는 프래그먼트 셰이더에서 현재 프래그먼트를 버리거나, 다시 말해 픽셀을 그리지 않도록 하는 데 사용할 수 있는 WGSL 명령문입니다.

[인터 스테이지 변수에 관한 글](webgpu-inter-stage-variables.html#a-builtin-position)의 `@builtin(position)`을 사용하여 프래그먼트 셰이더에서 체크무늬를 그리는 예제를 가져와 봅시다.

2색 체크무늬를 그리는 대신, 두 경우 중 하나에서 버릴 것입니다.

```wgsl
@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-  let red = vec4f(1, 0, 0, 1);
  let cyan = vec4f(0, 1, 1, 1);

  let grid = vec2u(fsInput.position.xy) / 8;
  let checker = (grid.x + grid.y) % 2 == 1;

+        if (checker) {
+          discard;
+        }
+
+        return cyan;

-  return select(red, cyan, checker);
}
```

몇 가지 다른 변경 사항으로, 캔버스가 CSS 체크무늬 배경을 갖도록 위의 CSS를 추가할 것입니다. 또한 `alphaMode: 'premultiplied'`를 설정할 것입니다. 그리고 `clearValue`를 `[0, 0, 0, 0]`으로 설정할 것입니다.

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });

  ...

  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
-        clearValue: [0.3, 0.3, 0.3, 1],
+        clearValue: [0, 0, 0, 0],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
...

```

{{{example url="../webgpu-transparency-fragment-shader-discard.html"}}}

모든 다른 사각형이 "투명"하여 그려지지 않은 것을 볼 수 있을 것입니다.

투명도에 사용되는 셰이더에서는 알파 값을 기반으로 버리는 것이 일반적입니다. 다음과 같은 것입니다.

```wgsl
@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    let color = ... compute a color ....

    if (color.a < threshold) {
      discard;
    }

    return color;
}
```

여기서 `threshold`는 유니폼의 값이거나 상수이거나 적절한 것일 수 있습니다.

이것은 스프라이트와 풀이나 나뭇잎 같은 초목에 가장 일반적으로 사용됩니다. 왜냐하면, 그리고 있고 [정투영에 관한 글](webgpu-orthograpic-projection.html#a-depth-textures)에서 소개한 깊이 텍스처를 사용하고 있다면, 스프라이트, 잎, 또는 풀을 그릴 때, 현재 그리고 있는 것 뒤에 있는 스프라이트, 잎, 또는 풀은 알파 값이 0이더라도 그려지지 않을 것입니다. 왜냐하면 여전히 깊이 텍스처를 업데이트하고 있기 때문입니다. 따라서 그리는 대신 버립니다. 이것에 대해서는 다른 글에서 더 자세히 다룰 것입니다.

## <a href="a-blending"></a> 블렌드 설정

마지막으로 블렌드 설정에 대해 설명합니다. 렌더 파이프라인을 생성할 때, 프래그먼트 셰이더의 각 `target`에 대해 블렌딩 상태를 설정할 수 있습니다. 다시 말해, 지금까지 다른 예제들의 전형적인 파이프라인은 다음과 같습니다.

```js
    const pipeline = device.createRenderPipeline({
      label: 'hardcoded textured quad pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
    });
```

그리고 다음은 `target[0]`에 블렌딩을 추가한 것입니다.

```js
    const pipeline = device.createRenderPipeline({
      label: 'hardcoded textured quad pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
+            blend: {
+              color: {
+                srcFactor: 'one',
+                dstFactor: 'one-minus-src-alpha'
+              },
+              alpha: {
+                srcFactor: 'one',
+                dstFactor: 'one-minus-src-alpha'
+              },
+            },
          },
        ],
      },
    });
```

기본 설정의 전체 목록은 다음과 같습니다:

```js
blend: {
  color: {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'zero',
  },
  alpha: {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'zero',
  },
}
```

여기서 `color`는 색상의 `rgb` 부분에 일어나는 일이고, `alpha`는 `a`(알파) 부분에 일어나는 일입니다.

`operation`은 다음 중 하나일 수 있습니다:

  * 'add'
  * 'subtract'
  * 'reverse-subtract'
  * 'min'
  * 'max'

`srcFactor`와 `dstFactor`는 각각 다음 중 하나일 수 있습니다:

  * 'zero'
  * 'one'
  * 'src'
  * 'one-minus-src'
  * 'src-alpha'
  * 'one-minus-src-alpha'
  * 'dst'
  * 'one-minus-dst'
  * 'dst-alpha'
  * 'one-minus-dst-alpha'
  * 'src-alpha-saturated'
  * 'constant'
  * 'one-minus-constant'

대부분은 비교적 이해하기 쉽습니다. 다음과 같이 생각하세요:

```
   result = operation((src * srcFactor),  (dst * dstFactor))
```

여기서 `src`는 프래그먼트 셰이더에서 반환된 값이고, `dst`는 그리고 있는 텍스처에 이미 있는 값입니다.

`operation`이 `'add'`, `srcFactor`가 `'one'`, `dstFactor`가 `'zero'`인 기본값을 생각해 봅시다. 이것은 다음과 같은 결과를 줍니다:

```
   result = add((src * 1), (dst * 0))
   result = add(src * 1, dst * 0)
   result = add(src, 0)
   result = src;
```

보시다시피, 기본 결과는 단지 `src`입니다.

위의 블렌드 팩터 중 2개는 상수, `'constant'`와 `'one-minus-constant'`를 언급합니다. 여기서 참조되는 상수는 `setBlendConstant` 명령으로 렌더 패스에서 설정되고 기본값은 `[0, 0, 0, 0]`입니다. 이것은 드로우 사이에 변경할 수 있게 합니다.

아마도 블렌딩에서 가장 일반적인 설정은 다음과 같습니다:

```js
{
  operation: 'add',
  srcFactor: 'one',
  dstFactor: 'one-minus-src-alpha'
}
```

이 모드는 "사전 곱셈된 알파"와 함께 가장 자주 사용됩니다. 즉, 위에서 다룬 것처럼 "src"가 이미 RGB 색상을 알파 값으로 "사전 곱셈"한 것을 기대합니다.

이러한 옵션들을 보여주는 예제를 만들어 봅시다.

먼저 알파가 있는 두 개의 캔버스 2D 이미지를 만드는 JavaScript를 만들어 봅시다. 이 2개의 캔버스를 WebGPU 텍스처로 로드할 것입니다.

먼저, dst 텍스처에 사용할 이미지를 만드는 코드입니다.

```js
const hsl = (h, s, l) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

function createDestinationImage(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  for (let i = 0; i <= 6; ++i) {
    gradient.addColorStop(i / 6, hsl(i / -6, 1, 0.5));
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(0, 0, 0, 255)';
  ctx.globalCompositeOperation = 'destination-out';
  ctx.rotate(Math.PI / -4);
  for (let i = 0; i < size * 2; i += 32) {
    ctx.fillRect(-size, i, size * 2, 16);
  }

  return canvas;
}
```

그리고 이것을 실행한 결과입니다.

{{{example url="../webgpu-blend-dest-canvas.html"}}}

다음은 src 텍스처에 사용할 이미지를 만드는 코드입니다.

```js
const hsla = (h, s, l, a) => `hsla(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%, ${a})`;

function createSourceImage(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);

  ctx.globalCompositeOperation = 'screen';
  const numCircles = 3;
  for (let i = 0; i < numCircles; ++i) {
    ctx.rotate(Math.PI * 2 / numCircles);
    ctx.save();
    ctx.translate(size / 6, 0);
    ctx.beginPath();

    const radius = size / 3;
    ctx.arc(0, 0, radius, 0, Math.PI * 2);

    const gradient = ctx.createRadialGradient(0, 0, radius / 2, 0, 0, radius);
    const h = i / numCircles;
    gradient.addColorStop(0.5, hsla(h, 1, 0.5, 1));
    gradient.addColorStop(1, hsla(h, 1, 0.5, 0));

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}
```

그리고 이것을 실행한 결과입니다.

{{{example url="../webgpu-blend-src-canvas.html"}}}

이제 두 가지가 모두 있으니, [텍스처 가져오기에 관한 글](webgpu-import-textures.html#a-loading-canvas)의 캔버스 가져오기 예제를 수정할 수 있습니다.

먼저, 2개의 캔버스 이미지를 만들어 봅시다.

```js
const size = 300;
const srcCanvas = createSourceImage(size);
const dstCanvas = createDestinationImage(size);
```

셰이더를 수정하여 텍스처 좌표에 50을 곱하지 않도록 합시다. 멀리 긴 평면을 그리려고 하지 않을 것이기 때문입니다.

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    // 1st triangle
    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top

    // 2nd triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
-  vsOutput.texcoord = xy * vec2f(1, 50);
+  vsOutput.texcoord = xy;
  return vsOutput;
}
```

`createTextureFromSource` 함수를 업데이트하여 `premultipliedAlpha: true/false`를 전달할 수 있도록 하고, 이것을 `copyExternalTextureToImage`에 전달하도록 합시다.

```js
-  function copySourceToTexture(device, texture, source, {flipY} = {}) {
+  function copySourceToTexture(device, texture, source, {flipY, premultipliedAlpha} = {}) {
    device.queue.copyExternalImageToTexture(
      { source, flipY, },
-      { texture },
+      { texture, premultipliedAlpha },
      { width: source.width, height: source.height },
    );

    if (texture.mipLevelCount > 1) {
      generateMips(device, texture);
    }
  }
```

그런 다음, 이것을 사용하여 각 텍스처의 두 버전을 만들어 봅시다. 하나는 사전 곱셈된 것이고, 하나는 "사전 곱셈되지 않은" 것 또는 "곱셈되지 않은" 것입니다.

```js
  const srcTextureUnpremultipliedAlpha =
      createTextureFromSource(
          device, srcCanvas,
          {mips: true});
  const dstTextureUnpremultipliedAlpha =
      createTextureFromSource(
          device, dstCanvas,
          {mips: true});

  const srcTexturePremultipliedAlpha =
      createTextureFromSource(
          device, srcCanvas,
          {mips: true, premultipliedAlpha: true});
  const dstTexturePremultipliedAlpha =
      createTextureFromSource(
          device, dstCanvas,
          {mips: true, premultipliedAlpha: true});
```

참고: 셰이더에서 사전 곱셈하는 옵션을 추가할 수 있지만, 그것은 일반적이지 않습니다. 오히려 요구 사항에 따라 색상을 포함하는 모든 텍스처가 사전 곱셈되거나 사전 곱셈되지 않도록 결정하는 것이 더 일반적입니다. 따라서 다른 텍스처를 사용하고, 사전 곱셈된 것 또는 사전 곱셈되지 않은 것을 선택할 수 있는 UI 옵션을 추가할 것입니다.

두 드로우 각각에 대해 유니폼 버퍼가 필요합니다. 두 개의 다른 위치에 그리고 싶거나 텍스처가 두 개의 다른 크기일 경우를 대비해서입니다.

```js
  function makeUniformBufferAndValues(device) {
    // offsets to the various uniform values in float32 indices
    const kMatrixOffset = 0;

    // create a buffer for the uniform values
    const uniformBufferSize =
      16 * 4; // matrix is 16 32bit floats (4bytes each)
    const buffer = device.createBuffer({
      label: 'uniforms for quad',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // create a typedarray to hold the values for the uniforms in JavaScript
    const values = new Float32Array(uniformBufferSize / 4);
    const matrix = values.subarray(kMatrixOffset, 16);
    return { buffer, values, matrix };
  }
  const srcUniform = makeUniformBufferAndValues(device);
  const dstUniform = makeUniformBufferAndValues(device);
```

샘플러가 필요하고 각 텍스처에 대해 바인드그룹이 필요합니다. 이것은 문제를 제기합니다. 바인드그룹은 바인드그룹 레이아웃이 필요합니다. 이 사이트의 대부분의 예제는 `somePipeline.getBindGroupLayout(groupNumber)`를 호출하여 파이프라인에서 레이아웃을 가져옵니다. 하지만 우리의 경우, 선택한 블렌드 상태 설정에 따라 파이프라인을 생성할 것입니다. 따라서 렌더링 시간까지 bindGroupLayout을 가져올 파이프라인이 없을 것입니다.

렌더링 시간에 바인드그룹을 생성할 수 있습니다. 또는 우리만의 bindGroupLayout을 만들고 파이프라인에게 그것을 사용하도록 지시할 수 있습니다. 이렇게 하면 초기화 시간에 바인드그룹을 생성할 수 있고, 동일한 bindGroupLayout을 사용하는 모든 파이프라인과 호환될 것입니다.

[bindGroupLayout](GPUBindGroupLayout)과 [pipelineLayout](GPUPipelineLayout)을 생성하는 자세한 내용은 [다른 글](webgpu-bind-group-layouts.html)에서 다룹니다. 지금은 셰이더 모듈과 일치하도록 생성하는 코드입니다.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { }, },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { } },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [
      bindGroupLayout,
    ],
  });
```

bindGroupLayout이 생성되었으므로, 이것을 사용하여 바인드그룹을 만들 수 있습니다.

```js
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
  });


  const srcBindGroupUnpremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: srcTextureUnpremultipliedAlpha.createView() },
      { binding: 2, resource: { buffer: srcUniform.buffer }},
    ],
  });

  const dstBindGroupUnpremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: dstTextureUnpremultipliedAlpha.createView() },
      { binding: 2, resource: { buffer: dstUniform.buffer }},
    ],
  });

  const srcBindGroupPremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: srcTexturePremultipliedAlpha.createView() },
      { binding: 2, resource: { buffer: srcUniform.buffer }},
    ],
  });

  const dstBindGroupPremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: dstTexturePremultipliedAlpha.createView() },
      { binding: 2, resource: { buffer: dstUniform.buffer }},
    ],
  });
```

이제 바인드그룹과 텍스처가 있으므로, 사전 곱셈된 텍스처와 사전 곱셈되지 않은 텍스처의 배열을 만들어서 한 세트 또는 다른 세트를 쉽게 선택할 수 있도록 합시다.

```js
  const textureSets = [
    {
      srcTexture: srcTexturePremultipliedAlpha,
      dstTexture: dstTexturePremultipliedAlpha,
      srcBindGroup: srcBindGroupPremultipliedAlpha,
      dstBindGroup: dstBindGroupPremultipliedAlpha,
    },
    {
      srcTexture: srcTextureUnpremultipliedAlpha,
      dstTexture: dstTextureUnpremultipliedAlpha,
      srcBindGroup: srcBindGroupUnpremultipliedAlpha,
      dstBindGroup: dstBindGroupUnpremultipliedAlpha,
    },
  ];
```

렌더 패스 디스크립터에서 `clearValue`를 꺼내서 더 쉽게 접근할 수 있도록 합시다.

```js
+  const clearValue = [0, 0, 0, 0];
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- to be filled out when we render
-        clearValue: [0.3, 0.3, 0.3, 1];
+        clearValue,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
```

2개의 렌더 파이프라인이 필요합니다. 하나는 dest 텍스처를 그리기 위한 것이고, 이것은 블렌딩을 사용하지 않을 것입니다. 지금까지 대부분의 예제에서 했던 것처럼 `auto`를 사용하는 대신 pipelineLayout을 전달하고 있다는 것을 주목하세요.

```js
  const dstPipeline = device.createRenderPipeline({
    label: 'hardcoded textured quad pipeline',
    layout: pipelineLayout,
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [ { format: presentationFormat } ],
    },
  });
```

다른 파이프라인은 선택한 블렌드 옵션으로 렌더링 시간에 생성될 것입니다.

```js
  const color = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
  };

  const alpha = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
  };

  function render() {
    ...

    const srcPipeline = device.createRenderPipeline({
      label: 'hardcoded textured quad pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
            blend: {
              color,
              alpha,
            },
          },
        ],
      },
    });

```

렌더링하기 위해 텍스처 세트를 선택한 다음, dstPipeline(블렌딩 없음)로 dst 텍스처를 렌더링하고, 그 위에 srcPipeline(블렌딩 있음)로 src 텍스처를 렌더링합니다.

```js
+  const settings = {
+    textureSet: 0,
+  };

  function render() {
    const srcPipeline = device.createRenderPipeline({
      label: 'hardcoded textured quad pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [
          {
            format: presentationFormat,
            blend: {
              color,
              alpha,
            },
          },
        ],
      },
    });

+    const {
+      srcTexture,
+      dstTexture,
+      srcBindGroup,
+      dstBindGroup,
+    } = textureSets[settings.textureSet];

    const canvasTexture = context.getCurrentTexture();
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

+    function updateUniforms(uniform, canvasTexture, texture) {
+      const projectionMatrix = mat4.ortho(0, canvasTexture.width, canvasTexture.height, 0, -1, 1);
+
+      mat4.scale(projectionMatrix, [texture.width, texture.height, 1], uniform.matrix);
+
+      // copy the values from JavaScript to the GPU
+      device.queue.writeBuffer(uniform.buffer, 0, uniform.values);
+    }
+    updateUniforms(srcUniform, canvasTexture, srcTexture);
+    updateUniforms(dstUniform, canvasTexture, dstTexture);

    const encoder = device.createCommandEncoder({ label: 'render with blending' });
    const pass = encoder.beginRenderPass(renderPassDescriptor);

+    // draw dst
+    pass.setPipeline(dstPipeline);
+    pass.setBindGroup(0, dstBindGroup);
+    pass.draw(6);  // call our vertex shader 6 times
+
+    // draw src
+    pass.setPipeline(srcPipeline);
+    pass.setBindGroup(0, srcBindGroup);
+    pass.draw(6);  // call our vertex shader 6 times

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

이제 이러한 값을 설정하기 위한 UI를 만들어 봅시다.

```js
+  const operations = [
+    'add',
+    'subtract',
+    'reverse-subtract',
+    'min',
+    'max',
+  ];
+
+  const factors = [
+    'zero',
+    'one',
+    'src',
+    'one-minus-src',
+    'src-alpha',
+    'one-minus-src-alpha',
+    'dst',
+    'one-minus-dst',
+    'dst-alpha',
+    'one-minus-dst-alpha',
+    'src-alpha-saturated',
+    'constant',
+    'one-minus-constant',
+  ];

  const color = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
  };

  const alpha = {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src',
  };

  const settings = {
    textureSet: 0,
  };

+  const gui = new GUI().onChange(render);
+  gui.add(settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha']);
+  const colorFolder = gui.addFolder('color');
+  colorFolder.add(color, 'operation', operations);
+  colorFolder.add(color, 'srcFactor', factors);
+  colorFolder.add(color, 'dstFactor', factors);
+  const alphaFolder = gui.addFolder('alpha');
+  alphaFolder.add(alpha, 'operation', operations);
+  alphaFolder.add(alpha, 'srcFactor', factors);
+  alphaFolder.add(alpha, 'dstFactor', factors);
```

operation이 `'min'` 또는 `'max'`인 경우, `srcFactor`와 `dstFactor`를 `'one'`으로 설정해야 하며, 그렇지 않으면 오류가 발생합니다.

```js
+  function makeBlendComponentValid(blend) {
+    const { operation } = blend;
+    if (operation === 'min' || operation === 'max') {
+      blend.srcFactor = 'one';
+      blend.dstFactor = 'one';
+    }
+  }

  function render() {
+    makeBlendComponentValid(color);
+    makeBlendComponentValid(alpha);
+    gui.updateDisplay();

    ...
```

또한 `'constant'` 또는 `'one-minus-constant'`를 팩터로 선택할 때 블렌드 상수를 설정할 수 있도록 합시다.

```js
+  const constant = {
+    color: [1, 0.5, 0.25],
+    alpha: 1,
+  };

  const settings = {
    textureSet: 0,
  };

  const gui = new GUI().onChange(render);
  gui.add(settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha']);
  ...
+  const constantFolder = gui.addFolder('constant');
+  constantFolder.addColor(constant, 'color');
+  constantFolder.add(constant, 'alpha', 0, 1);

  ...

  function render() {
    ...

    const pass = encoder.beginRenderPass(renderPassDescriptor);

    // draw dst
    pass.setPipeline(dstPipeline);
    pass.setBindGroup(0, dstBindGroup);
    pass.draw(6);  // call our vertex shader 6 times

    // draw src
    pass.setPipeline(srcPipeline);
    pass.setBindGroup(0, srcBindGroup);
+    pass.setBlendConstant([...constant.color, constant.alpha]);
    pass.draw(6);  // call our vertex shader 6 times

    pass.end();
  }
```

13 * 13 * 5 * 13 * 13 * 5 가지의 설정이 있기 때문에, 탐색하기에는 너무 많으므로 프리셋 목록을 제공합시다. `alpha` 설정이 없으면 `color` 설정을 반복할 것입니다.

```js
+  const presets = {
+    'default (copy)': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one',
+        dstFactor: 'zero',
+      },
+    },
+    'premultiplied blend (source-over)': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one',
+        dstFactor: 'one-minus-src-alpha',
+      },
+    },
+    'un-premultiplied blend': {
+      color: {
+        operation: 'add',
+        srcFactor: 'src-alpha',
+        dstFactor: 'one-minus-src-alpha',
+      },
+    },
+    'destination-over': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one-minus-dst-alpha',
+        dstFactor: 'one',
+      },
+    },
+    'source-in': {
+      color: {
+        operation: 'add',
+        srcFactor: 'dst-alpha',
+        dstFactor: 'zero',
+      },
+    },
+    'destination-in': {
+      color: {
+        operation: 'add',
+        srcFactor: 'zero',
+        dstFactor: 'src-alpha',
+      },
+    },
+    'source-out': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one-minus-dst-alpha',
+        dstFactor: 'zero',
+      },
+    },
+    'destination-out': {
+      color: {
+        operation: 'add',
+        srcFactor: 'zero',
+        dstFactor: 'one-minus-src-alpha',
+      },
+    },
+    'source-atop': {
+      color: {
+        operation: 'add',
+        srcFactor: 'dst-alpha',
+        dstFactor: 'one-minus-src-alpha',
+      },
+    },
+    'destination-atop': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one-minus-dst-alpha',
+        dstFactor: 'src-alpha',
+      },
+    },
+    'additive (lighten)': {
+      color: {
+        operation: 'add',
+        srcFactor: 'one',
+        dstFactor: 'one',
+      },
+    },
+  };

  ...

  const settings = {
    textureSet: 0,
+    preset: 'default (copy)',
  };

  const gui = new GUI().onChange(render);
  gui.add(settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha']);
+  gui.add(settings, 'preset', Object.keys(presets))
+    .name('blending preset')
+    .onChange(presetName => {
+      const preset = presets[presetName];
+      Object.assign(color, preset.color);
+      Object.assign(alpha, preset.alpha || preset.color);
+      gui.updateDisplay();
+    });

  ...
```

또한 `alphaMode`에 대한 캔버스 설정을 선택할 수 있도록 합시다.

```js
  const settings = {
+    alphaMode: 'premultiplied',
    textureSet: 0,
    preset: 'default (copy)',
  };

  const gui = new GUI().onChange(render);
+  gui.add(settings, 'alphaMode', ['opaque', 'premultiplied']).name('canvas alphaMode');
  gui.add(settings, 'textureSet', ['premultiplied alpha', 'un-premultiplied alpha']);

  ...

  function render() {
    ...

+    context.configure({
+      device,
+      format: presentationFormat,
+      alphaMode: settings.alphaMode,
+    });

    const canvasTexture = context.getCurrentTexture();
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

```

마지막으로 렌더 패스의 clearValue를 선택할 수 있도록 합시다.

```js
+  const clear = {
+    color: [0, 0, 0],
+    alpha: 0,
+    premultiply: true,
+  };

  const settings = {
    alphaMode: 'premultiplied',
    textureSet: 0,
    preset: 'default (copy)',
  };

  const gui = new GUI().onChange(render);

  ...

+  const clearFolder = gui.addFolder('clear color');
+  clearFolder.add(clear, 'premultiply');
+  clearFolder.add(clear, 'alpha', 0, 1);
+  clearFolder.addColor(clear, 'color');

  function render() {
    ...

    const canvasTexture = context.getCurrentTexture();
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

+    {
+      const { alpha, color, premultiply } = clear;
+      const mult = premultiply ? alpha : 1;
+      clearValue[0] = color[0] * mult;
+      clearValue[1] = color[1] * mult;
+      clearValue[2] = color[2] * mult;
+      clearValue[3] = alpha;
+    }
```

옵션이 많았습니다. 너무 많았을 수도 있습니다 😅. 어쨌든 이제 블렌드 설정을 가지고 놀 수 있는 예제가 있습니다.

{{{example url="../webgpu-blend.html"}}}

원본 이미지가 주어졌을 때

<div class="webgpu_center">
  <div data-diagram="original"></div>
</div>

다음은 알려진 유용한 블렌드 설정들입니다.

<div class="webgpu_center">
  <div data-diagram="blend-premultiplied blend (source-over)"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-destination-over"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-additive (lighten)"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-source-in"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-destination-in"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-source-out"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-destination-out"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-source-atop"></div>
</div>

<div class="webgpu_center">
  <div data-diagram="blend-destination-atop"></div>
</div>

<hr>

이러한 블렌드 설정 이름은 Canvas 2D [`globalCompositeOperation`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) 옵션에서 가져온 것입니다. 해당 사양에는 더 많은 옵션이 나열되어 있지만, 나머지 대부분은 이러한 기본 블렌딩 설정만으로 수행할 수 있는 것보다 더 많은 수학이 필요하므로 다른 솔루션이 필요합니다.

이제 WebGPU에서 블렌딩의 이러한 기본 사항을 알았으므로, 다양한 기법을 다룰 때 이것들을 참조할 수 있습니다.

<!-- keep this at the bottom of the article -->
<link href="webgpu-transparency.css" rel="stylesheet">
<script type="module" src="webgpu-transparency.js"></script>
