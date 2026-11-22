Title: WebGPU 투명도와 블렌딩
Description: WebGPU에서 픽셀 블렌딩하기
TOC: 투명도와 블렌딩

투명성과 블렌딩과 관련된 내용을 다루는 것은 어렵습니다. 왜냐하면, 상황에 따라 필요한 작업이 달라질 수 있기 때문입니다. 따라서 이 글에서는 WebGPU의 기능들에 대해 간단히 설명할 것입니다. 나중에 특정 기술들을 다룰 때 다시 이 내용을 참고할 수 있도록 하기 위함입니다.

## <a id="a-alphamode"></a> 캔버스의 `alphaMode` 속성

우리가 먼저 인지해야 할 것은, WebGPU 내에서의 투명성과 블렌딩 기능이 존재한다는 것입니다. 하지만 WebGPU 캔버스와 HTML 페이지 간에도 투명성과 블렌딩 기능이 존재합니다.

기본적으로 WebGPU 캔버스는 불투명한 상태입니다. 알파 채널은 무시됩니다. 이를 무시하지 않으려면, `configure` 함수를 호출할 때 `alphaMode`를 `'premultiplied'`로 설정해야 합니다. 기본값은 `'opaque'`입니다.

```js
  context.configure({
    device,
    format: presentationFormat,
+    alphaMode: 'premultiplied',
  });
```

`alphaMode: 'premultiplied'`가 무엇을 의미하는지 이해하는 것이 중요합니다. 이는, 캔버스에 넣는 색상 값이 이미 알파 값과 곱해져야 한다는 것을 의미합니다.

가능한 한 가장 간단한 예시를 만들어보겠습니다. 단순히 렌더 패스를 생성하고, 그 안의 색상을 설정하는 것만으로도 충분합니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // 캔버스에서 WebGPU 컨텍스트를 얻어서 설정해줍니다.
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
        // view: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
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

또한, 캔버스의 CSS 배경색을 회색 체크무늬로 설정해 보겠습니다.

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

알파와 색상을 설정하는 UI에 `premultiply` 체크박스를 추가해, 캔버스에 넣을 색상을 premultiplied 상태로 만들지 정할 수 있게 합니다.

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
+      // 색상들을 알파 값으로 곱해줍니다.
+      clearValue[0] = color[0] * alpha;
+      clearValue[1] = color[1] * alpha;
+      clearValue[2] = color[2] * alpha;
+    } else {
+      // 미리 곱해지지 않은 색상을 사용합니다.
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

만약 이걸 실행해보면 문제가 있다는 것을 여러분들은 알아차릴 수 있을 것입니다.

{{{example url="../webgpu-canvas-alphamode-premultiplied.html"}}}

여기서 나타나는 색상들은 **정의되지 않았습니다**!!!

제 컴퓨터에서는 이런 색상들을 얻을 수 있었습니다.

<img src="resources/canvas-invalid-color.png" class="center" style="width: 440px">

문제가 무엇인지 알겠나요? 알파 값을 0.01로 설정해 두었습니다. 배경 색상은 중간색과 어두운 회색이어야 합니다. 하지만 색상은 빨간색으로 설정되어 있습니다(1, 0, 0). 중간색/어두운 회색 위에 0.01의 빨간색을 더하는 것도 거의 눈에 띄지 않아야 합니다. 그런데 왜 여기에는 2가지 밝은 분홍색 색상이 있는 걸까요?

그 이유는, **이 색상은 불법적인(Illegal) 색상입니다!** 우리의 캔버스 색상은 `1, 0, 0, 0.01`입니다. 하지만 이 색상은 미리 곱해진 색상이 아닙니다. premultiplied 색상은 RGB에 알파 값을 미리 곱한 색상입니다. 알파 값이 0.01이라면, 다른 값도 0.01보다 크면 안 됩니다.

`premultiply` 체크박스를 켜면, 코드가 색상을 미리 곱해줍니다. 캔버스에 입력된 값은 `0.01, 0, 0, 0.01`가 되며, 이 값은 거의 눈에 띄지 않을 정도로 작습니다.

`premultiply` 체크박스를 켠 상태에서, 알파 값을 조정하면, 알파 값이 1에 가까워질 때 점차 빨간색으로 변하는 것을 볼 수 있습니다.

> 참고: 예시인 `1, 0, 0, 0.01`은 불법적인 색상이므로, 이 색상이 어떻게 표시될지는 정의되어 있지 않습니다. 불법적인 색상을 사용할 경우, 브라우저에 따라 다양한 결과가 발생할 수 있습니다. 그러므로 불법적인 색상을 사용하지 말고, 모든 기기에서 동일한 결과가 나올 것이라고 기대하지 마세요.

만약 우리의 색상이 1, 0.5, 0.25라면, 이는 주황색입니다. 그리고 이 색상이 33% 정도 투명해야 하므로, 알파 값은 0.33이 됩니다. 그렇다면, “미리 곱해진 색상”은 다음과 같습니다.

```
                      premultiplied
   ---------------------------------
   r = 1    * 0.33   = 0.33
   g = 0.5  * 0.33   = 0.165
   g = 0.25 * 0.33   = 0.0825
   a = 0.33          = 0.33
```

색상을 미리 곱하는 방법은 사용자가 결정할 수 있습니다. 만약 색상이 미리 곱되어 있지 않다면, 셰이더 내에서 다음과 같은 코드를 사용하여 미리 곱할 수 있습니다.

```wgsl
   return vec4f(color.rgb * color.a, color.a)`;
```

[이미지 로딩](webgpu-importing-textures.html)에서 사용한 `copyExternalImageToTexture`에 [`premultipliedAlpha: true` 옵션](#copyExternalImageToTexture)을 전달할 수 있습니다. 이 옵션을 켜면 WebGPU가 이미지를 텍스처로 복사할 때 RGB에 알파를 미리 곱하므로, `textureSample`로 읽는 값은 이미 premultiplied 상태입니다.

이 섹션의 목적은…

1. `alphaMode: 'premultiplied'`라는 WebGPU 캔버스 설정 옵션에 대해 설명합니다.

   이를 통해 WebGPU 캔버스에 투명성이 부여될 수 있습니다.

2. 미리 곱해진 알파 색상이라는 개념을 소개해 보겠습니다.

   색상이 어떻게 미리 곱해지는지는 사용자가 결정할 수 있습니다. 위 예제에서는 JavaScript로 premultiplied 색상 값을 만들어 `clearValue`에 넣었습니다.

   또한, 프래그먼트 셰이더나 다른 셰이더들로부터 색상을 가져올 수도 있습니다. 그 셰이더들에게는 미리 곱해진 색상을 제공할 수도 있습니다. 그 곱셈 작업을 셰이더 자체에서 수행할 수도 있고, 또는 후처리 단계에서 색상을 미리 곱할 수도 있습니다. `alphaMode: 'premultiplied'`를 사용할 때는 어떤 방식으로 계산하든 캔버스에 쓰는 색상이 premultiplied 상태여야 합니다.

   다른 색상의 경우, premultiplied 색상과 un-premultiplied 색상의 차이에 대한 좋은 참고 자료는 다음 글입니다: [GPU는 premultiplied color를 선호합니다](https://www.realtimerendering.com/blog/gpus-prefer-premultiplication/).

## <a id="a-discard"></a> `discard`로 프래그먼트 버리기

`discard`는 WGSL에서 사용할 수 있는 명령어로, 현재의 프래그먼트를 무시하거나, 다른 말로 하면 해당 픽셀을 그리지 않도록 하는 역할을 합니다.

[스테이지간 변수의 `@builtin(position)` 절](webgpu-inter-stage-variables.html#a-builtin-position)에서처럼, 프래그먼트 셰이더에서 픽셀 위치를 이용해 체크무늬를 그려 보겠습니다.

두 색으로 체크무늬를 그리는 대신, 한쪽 프래그먼트는 `discard`로 버리겠습니다.

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

다른 몇 가지 변경 사항도 있습니다. 위의 CSS 코드에 추가하여 캔버스에 체크보드 배경을 적용할 것입니다. 또한 `alphaMode: 'premultiplied'`를 설정하고, `clearValue`을 `[0, 0, 0, 0]`로 설정할 것입니다.

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
        // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
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

각각의 사각형들은 “투명한” 상태입니다. 즉, 그 사각형들은 전혀 그려지지 않았다는 뜻입니다.

투명도를 처리하는 셰이더에서는 알파 값을 기준으로 데이터를 버리는 것이 일반적입니다.

```wgsl
@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    let color = ... compute a color ....

    if (color.a < threshold) {
      discard;
    }

    return color;
}
```

`threshold`는 유니폼 값이나 상수 등, 적절한 값일 수 있습니다.

이 방법은 주로 스프라이트나 풀, 잎과 같은 물체를 그릴 때 사용됩니다. 왜냐하면, 우리가 depth 텍스처를 사용하여 그림을 그릴 때, 직교 투영 강의에서 깊이 텍스처를 설명할 때 살펴봤듯이, 현재 그려지고 있는 물체 뒤에 있는 스프라이트나 잎, 풀 등은 그려지지 않습니다. 알파 값이 0이더라도 마찬가지입니다. 왜냐하면 depth 텍스처가 계속 업데이트되기 때문입니다. 따라서 해당 물체를 그리는 것을 포기하는 것입니다. 이에 대해서는 다른 글에서 더 자세히 설명하겠습니다.

## <a id="a-blending"></a> 블렌딩 설정

마지막으로 블렌딩 설정을 살펴보겠습니다. 렌더링 파이프라인을 생성할 때, 프래그먼트 셰이더 내의 각 `target`에 대해 블렌딩 상태를 설정할 수 있습니다. 다시 말해, 지금까지 살펴본 다른 예시들에서 볼 수 있듯이, 이곳에서도 마찬가지로 블렌딩 상태를 설정할 수 있습니다.

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

그리고 여기서는 `target[0]`에 블렌딩 기능이 적용된 상태입니다.

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

`color`는 색상의 `rgb` 부분에 적용되는 값이며, `alpha`는 색상의 `a` 부분에 적용되는 값입니다.

`operation`는 다음 중 하나가 될 수 있습니다.

  * 'add'
  * 'subtract'
  * 'reverse-subtract'
  * 'min'
  * 'max'

`srcFactor`와 `dstFactor`는 각각 다음 중 하나가 될 수 있습니다.

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

그 중 대부분은 상당히 쉽게 이해할 수 있습니다. 그냥 이렇게 생각하시면 됩니다.

```
   result = operation((src * srcFactor),  (dst * dstFactor))
```

여기서 `src`은 여러분의 프래그먼트 셰이더가 반환하는 값이며, `dst`는 이미 텍스처에 저장된 값입니다.

`operation`이 `'add'`, `srcFactor`가 `'one'`, `dstFactor`가 `'zero'`인 경우를 생각해 보세요. 이 경우는 다음과 같은 결과가 나옵니다.

```
   result = add((src * 1), (dst * 0))
   result = add(src * 1, dst * 0)
   result = add(src, 0)
   result = src;
```

보시다시피, 기본적으로 얻어지는 결과는 단순히 `src`입니다.

위의 블렌딩 요소들 중에서, 2번은 상수인 `'constant'`과 `'one-minus-constant'`을 언급합니다. 여기서 말하는 상수는 `setBlendConstant` 명령어를 사용하여 렌더 패스에서 설정되며, 기본값은 `[0, 0, 0, 0]`입니다. 이를 통해 여러 번의 그림을 그릴 때마다 이 상수를 변경할 수 있습니다.

아마도, 블렌딩 작업을 할 때 가장 흔히 사용되는 설정은…

```js
{
  operation: 'add',
  srcFactor: 'one',
  dstFactor: 'one-minus-src-alpha'
}
```

이 모드는 주로 premultiplied 색상과 함께 사용합니다. 위에서 설명한 것처럼 소스(`src`) 이미지의 RGB에 이미 알파가 곱해져 있다고 가정합니다.

이러한 옵션들을 보여주는 예를 들어보겠습니다.

먼저, 알파 값을 포함한 두 개의 2D 캔버스 이미지를 생성하는 JavaScript 코드를 작성해 보겠습니다. 이 두 캔버스 이미지를 WebGPU 텍스처로 로드할 것입니다.

먼저, dst 텍스처로 사용할 이미지를 생성하는 코드입니다.

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

그리고 이제, 그것은 실행 중입니다.

{{{example url="../webgpu-blend-dest-canvas.html"}}}

다음은, 우리가 사용할 이미지를 생성하는 데 필요한 코드입니다. 이 이미지는 텍스처로 사용될 것입니다.

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

그리고 이것이 바로 그 실행 중인 상태입니다.

{{{example url="../webgpu-blend-src-canvas.html"}}}

이제 두 가지를 모두 가지고 있으므로, [이미지 로딩](webgpu-importing-textures.html)의 캔버스 로딩 예제를 수정할 수 있습니다.

먼저, 두 개의 캔버스 이미지를 만들어보겠습니다.

```js
const size = 300;
const srcCanvas = createSourceImage(size);
const dstCanvas = createDestinationImage(size);
```

셰이더를 수정해서, 텍스처 좌표를 50으로 곱하지 않도록 해야 합니다. 왜냐하면, 멀리 있는 곳에 긴 평면을 그리려고 하지 않기 때문입니다.

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    // 첫 번째 삼각형
    vec2f( 0.0,  0.0),  // 중심점
    vec2f( 1.0,  0.0),  // 오른쪽, 중앙
    vec2f( 0.0,  1.0),  // 중심, 상단

    // 두 번째 삼각형
    vec2f( 0.0,  1.0),  // 중심, 상단
    vec2f( 1.0,  0.0),  // 오른쪽, 중앙
    vec2f( 1.0,  1.0),  // 오른쪽, 위쪽
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
-  vsOutput.texcoord = xy * vec2f(1, 50);
+  vsOutput.texcoord = xy;
  return vsOutput;
}
```

<a id="copyExternalImageToTexture"></a>

`createTextureFromSource`에 `premultipliedAlpha` 옵션을 추가해 보겠습니다. `true` 또는 `false`를 넘기면 그 값이 `copyExternalImageToTexture`의 대상 옵션으로 전달됩니다.

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

이 옵션을 사용해 각 텍스처를 premultiplied 버전과 un-premultiplied 버전으로 만듭니다.

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

셰이더에서 텍스처를 샘플링한 뒤 RGB에 알파를 곱할 수도 있지만, 보통은 색상 텍스처를 만들 때 premultiplied 여부를 정합니다. 예제에서는 두 방식을 비교할 수 있도록 UI의 텍스처 선택 옵션에 `premultiplied alpha`와 `un-premultiplied alpha`를 추가하겠습니다.

두 번의 드로우를 할 때마다, 혹시 두 곳에서 드로우를 해야 하거나, 텍스처의 크기가 다를 경우를 대비해서, 각각에 대해 유니폼 버퍼를 사용해야 합니다.

```js
  function makeUniformBufferAndValues(device) {
    // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
    const kMatrixOffset = 0;

    // 유니폼 값들을 저장하기 위한 버퍼를 생성합니다.
    const uniformBufferSize =
      16 * 4; // 행렬는 16개의 32비트 부동소수점 데이터로 구성되어 있습니다. 각 데이터는 4바이트입니다.
    const buffer = device.createBuffer({
      label: 'uniforms for quad',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // JavaScript에서 유니폼에 대한 값들을 저장하기 위해 typedarray를 생성합니다.
    const values = new Float32Array(uniformBufferSize / 4);
    const matrix = values.subarray(kMatrixOffset, 16);
    return { buffer, values, matrix };
  }
  const srcUniform = makeUniformBufferAndValues(device);
  const dstUniform = makeUniformBufferAndValues(device);
```

우리에게는 샘플러가 필요하며, 각 텍스처마다 bindGroup도 필요합니다. 하지만 이때 문제가 생깁니다. bindGroup에는 bindGroup layout이 필요합니다. 이 사이트에 있는 대부분의 예제들은 `somePipeline.getBindGroupLayout(groupNumber)`라는 함수를 호출하여 layout을 얻습니다. 하지만 우리의 경우는 선택한 블렌드 상태에 따라 파이프라인을 직접 생성할 것입니다. 따라서 렌더링이 진행될 때까지는 bindGroupLayout을 얻을 수 없습니다.

우리는 렌더링 시에 bindGroups를 생성할 수도 있습니다. 혹은, 직접 bindGroupLayout을 만들어서 파이프라인에 그걸 사용하도록 지시할 수도 있습니다. 이렇게 하면, bindGroups를 초기화 시에 생성할 수 있으며, 이는 동일한 bindGroupLayout을 사용하는 모든 파이프라인과 호환됩니다.

[bindGroupLayout](GPUBindGroupLayout)와 [pipelineLayout](GPUPipelineLayout)를 생성하는 방법에 대한 자세한 내용은 [바인드 그룹 레이아웃](webgpu-bind-group-layouts.html)에서 확인할 수 있습니다. 여기서는 우리의 셰이더 모듈에 맞는 코드를 보여줍니다.

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

bindGroupLayout가 생성된 후에는, 이를 사용하여 bindGroup들을 만들 수 있습니다.

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
      { binding: 1, resource: srcTextureUnpremultipliedAlpha },
      { binding: 2, resource: { buffer: srcUniform.buffer }},
    ],
  });

  const dstBindGroupUnpremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: dstTextureUnpremultipliedAlpha },
      { binding: 2, resource: { buffer: dstUniform.buffer }},
    ],
  });

  const srcBindGroupPremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: srcTexturePremultipliedAlpha },
      { binding: 2, resource: { buffer: srcUniform.buffer }},
    ],
  });

  const dstBindGroupPremultipliedAlpha = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: dstTexturePremultipliedAlpha },
      { binding: 2, resource: { buffer: dstUniform.buffer }},
    ],
  });
```

이제 bindGroups와 텍스처가 있으므로, 프리멤플라이된 텍스처와 비프리멤플라이된 텍스처를 나열된 배열로 만들어서, 어떤 셋을 쉽게 선택할 수 있도록 해 보겠습니다.

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

우리의 렌더링 설명자에서는 `clearValue`를 추출하여, 더 쉽게 접근할 수 있도록 합니다.

```js
+  const clearValue = [0, 0, 0, 0];
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
-        clearValue: [0.3, 0.3, 0.3, 1];
+        clearValue,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
```

렌더 파이프라인이 두 개 필요합니다. 첫 번째는 블렌딩 없이 대상(`dst`) 텍스처를 그립니다. 이전 예제에서 사용한 `auto` 대신 직접 만든 파이프라인 레이아웃을 전달합니다.

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

나머지 파이프라인은 렌더링 시에 우리가 선택한 블렌딩 옵션에 따라 생성됩니다.

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

렌더링을 위해, 먼저 텍스처 세트를 선택합니다. 그런 다음 dstPipeline을 사용하여 dst 텍스처를 렌더링합니다(블렌딩은 하지 않습니다). 그 다음, srcPipeline을 사용하여 src 텍스처를 렌더링합니다(블렌딩은 합니다).

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
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

+    function updateUniforms(uniform, canvasTexture, texture) {
+      const projectionMatrix = mat4.ortho(0, canvasTexture.width, canvasTexture.height, 0, -1, 1);
+
+      mat4.scale(projectionMatrix, [texture.width, texture.height, 1], uniform.matrix);
+
+      // JavaScript에서 얻은 값들을 GPU로 복사해 넣습니다.
+      device.queue.writeBuffer(uniform.buffer, 0, uniform.values);
+    }
+    updateUniforms(srcUniform, canvasTexture, srcTexture);
+    updateUniforms(dstUniform, canvasTexture, dstTexture);

    const encoder = device.createCommandEncoder({ label: 'render with blending' });
    const pass = encoder.beginRenderPass(renderPassDescriptor);

+    // dst 그리기
+    pass.setPipeline(dstPipeline);
+    pass.setBindGroup(0, dstBindGroup);
+    pass.draw(6);  // 정점 셰이더를 6번 호출합니다.
+
+    // src 그리기
+    pass.setPipeline(srcPipeline);
+    pass.setBindGroup(0, srcBindGroup);
+    pass.draw(6);  // 정점 셰이더를 6번 호출합니다.

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

이제, 이러한 값들을 설정할 수 있는 UI를 만들어보겠습니다.

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

만약 그 작업이 `'min'` 또는 `'max'`인 경우, `srcFactor`와 `dstFactor`을 `'one'`로 설정해야 합니다. 그렇지 않으면 오류가 발생합니다.

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

`'constant'`나 `'one-minus-constant'`를 인수로 사용할 때의 블렌딩 상수를 설정할 수 있도록 해야 합니다.

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

    // dst 그리기
    pass.setPipeline(dstPipeline);
    pass.setBindGroup(0, dstBindGroup);
    pass.draw(6);  // 정점 셰이더를 6번 호출합니다.

    // src 그리기
    pass.setPipeline(srcPipeline);
    pass.setBindGroup(0, srcBindGroup);
+    pass.setBlendConstant([...constant.color, constant.alpha]);
    pass.draw(6);  // 정점 셰이더를 6번 호출합니다.

    pass.end();
  }
```

13*13*5*13*13*5 가지 가능한 설정이 있으므로, 모든 설정을 하나씩 확인하는 것은 너무 많은 작업입니다. 그래서 미리 정해둔 설정 목록을 제공하겠습니다. `alpha` 설정이 없는 경우에는 `color` 설정을 반복할 것입니다.

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

또한, `alphaMode`에 대한 캔버스 설정을 직접 선택할 수 있도록 해 보겠습니다.

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
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
    renderPassDescriptor.colorAttachments[0].view =
        canvasTexture.createView();

```

마지막으로, 렌더링 과정에서 사용할 clearValue를 직접 선택할 수 있도록 해 보겠습니다.

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
    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 설정해 주세요.
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

정말 많은 옵션들이 있군요. 너무 많은 것 같아요 😅. 어쨌든, 이제 우리는 블렌딩 설정을 다양하게 조절해볼 수 있는 예시를 가지고 있게 되었습니다.

{{{example url="../webgpu-blend.html"}}}

우리가 가진 원본 이미지들을 고려할 때…

<div class="webgpu_center">
  <div data-diagram="original"></div>
</div>

다음은 유용한 블렌딩 설정들입니다.

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

이러한 블렌딩 설정들의 이름들은 Canvas 2D의 [`globalCompositeOperation`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) 옵션에서 유래되었습니다. 그 문서에는 더 많은 옵션들이 나와 있지만, 그 중 대부분의 경우는 이러한 기본적인 블렌딩 설정만으로는 처리할 수 없는 복잡한 수학적 연산이 필요하기 때문에, 별도의 해결 방법이 필요합니다.

이제 WebGPU에서의 블렌딩 작업에 관련된 기본 개념들을 알게 되었으니, 다양한 기술들을 다룰 때 이러한 개념들을 참고할 수 있습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-transparency.css" rel="stylesheet">
<script type="module" src="webgpu-transparency.js"></script>
