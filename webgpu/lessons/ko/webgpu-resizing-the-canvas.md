Title: WebGPU 캔버스 크기 조절
Description: WebGPU 캔버스 크기를 조절하는 방법과 주의할 점
TOC: 캔버스 크기 조절

[WebGPU 기초](webgpu-fundamentals.html)에서, 우리는 캔버스의 해상도를 화면에 표시되는 크기와 일치하도록 설정하는 기본 구조를 설정했습니다. 이제 캔버스의 크기를 조정하는 방법에 대해 자세히 살펴보겠습니다.

모든 캔버스에는 두 가지 크기가 있습니다. 첫 번째 크기는 캔버스의 *드로잉 버퍼*의 크기입니다. 이는 캔버스 자체에 포함된 픽셀의 수를 나타냅니다. 두 번째 크기는 캔버스가 표시되는 크기입니다. 캔버스가 표시되는 크기는 CSS에 의해 결정됩니다.

캔버스의 드로잉 버퍼의 크기를 설정할 수 있는 방법은 두 가지가 있습니다. 그 중 하나는 HTML을 사용하는 방법입니다.

```html
<canvas id="c" width="400" height="300"></canvas>
```

다른 사람은 JavaScript를 사용하고 있습니다.

```html
<canvas id="c"></canvas>
```

JavaScript

```js
const canvas = document.querySelector("#c");
canvas.width = 400;
canvas.height = 300;
```

표시 크기를 지정하는 CSS 규칙이 없으면 캔버스는 드로잉 버퍼와 같은 크기로 표시됩니다. 위 두 예제에서는 드로잉 버퍼와 표시 크기가 모두 400×300입니다.

다음은, 그림 버퍼가 10x15픽셀인 캔버스의 예시입니다. 이 캔버스가 페이지에서 400x300픽셀로 표시됩니다.

```html
<canvas id="c" width="10" height="15" style="width: 400px; height: 300px;"></canvas>
```

또는, 예를 들어 이런 식으로도 가능합니다.

```html
<style>
#c {
  width: 400px;
  height: 300px;
}
</style>
<canvas id="c" width="10" height="15"></canvas>
```

만약 그 캔버스에 단일 픽셀 너비의 회전하는 선을 그려보면, 이런 모습이 나옵니다.

{{{example url="../webgpu-10x15-canvas-400x300-css.html" }}}

왜 이렇게 흐릿할까요? 브라우저가 10x15 픽셀 캔버스를 400x300 픽셀로 늘리면서 일반적으로 *필터링*하기 때문입니다.

그렇다면, 예를 들어, 캔버스를 창의 전체 공간을 채우고 싶다면 어떻게 해야 할까요? 우선, CSS를 사용하여 브라우저가 캔버스를 확장시켜 창의 전체 공간을 채울 수 있도록 할 수 있습니다. 예시:

```html
<html>
  <head>
    <style>
    html, body {
      margin: 0;       /* remove the default margin          */
      height: 100%;    /* make the html,body fill the page   */
    }
    #c {
      display: block;  /* make the canvas act like a block   */
      width: 100%;     /* make the canvas fill its container */
      height: 100%;
    }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
  </body>
</html>
```

이제, 드로우 버퍼의 크기를 브라우저가 캔버스를 확장한 크기와 일치시켜야 합니다. 안타깝게도 이는 예상보다 훨씬 복잡한 문제입니다. 여러 가지 방법들을 살펴보겠습니다.

## `ResizeObserver`를 사용하세요.

이에 대해서는 [WebGPU 기초](webgpu-fundamentals.html)에서 다루었습니다. 이것이 바로 현대적인 방식입니다. WebGPU를 지원하는 모든 브라우저는 `ResizeObserver`도 함께 지원합니다.

다른 기사에서 말한 내용을 다시 반복하자면, `ResizeObserver`를 생성하고, 그 객체가 관찰해야 할 요소들의 크기가 변할 때 호출될 함수를 지정해야 합니다. 그런 다음, 어떤 요소들을 관찰할지도 지정해야 합니다.

```js
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
    const width = entry.contentBoxSize[0].inlineSize;
    const height = entry.contentBoxSize[0].blockSize;
    const canvas = entry.target;
    canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
    canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
  }
});
observer.observe(canvas);
```

위의 코드에서는 모든 항목들을 살펴보고 있지만, 실제로는 하나만 있어야 합니다. 왜냐하면 우리는 단 하나의 캔버스만을 관찰하고 있기 때문입니다. 캔버스의 크기는 장치가 지원할 수 있는 최대 크기로 제한해야 합니다. 그렇지 않으면 WebGPU가 오류를 발생시킬 것입니다. 또한, 캔버스의 크기가 0이 되는 것도 피해야 합니다. 그렇지 않으면 다시 오류가 발생할 것입니다.

만약 우리가 요청에 따라만 렌더링을 한다면, 위 코드 내부에 렌더링 함수를 호출할 수 있습니다. 하지만, `requestAnimationFrame` 루프나 다른 방법을 사용하여 애니메이션을 수행하는 경우에는, 다음에 렌더링할 때 캔버스에 설정된 크기에 맞는 텍스처가 반환됩니다. 이때 `context.getCurrentTexture()`을 호출하면 됩니다.

> `inlineSize`와 `blockSize`는 정수가 아닙니다.

## `clientWidth`와 `clientHeight`를 사용하세요.

`ResizeObserver`가 존재하기 전에는 `clientWidth`와 `clientHeight`를 사용하는 것이 일반적이었습니다. 이러한 속성들은 HTML 내의 모든 요소에 존재하며, CSS 픽셀 단위로 해당 요소의 크기를 나타냅니다.

> 참고: `clientWidth`는 클라이언트의 너비를 나타내는 값입니다. 따라서, 클라이언트의 여백을 고려하여 CSS에서 해당 값을 사용해야 합니다.
또한, `clientHeight`와 관련해서도, 캔버스 요소에 어떠한 여백도 주지 않는 것이 가장 좋습니다.

JavaScript로 캔버스가 화면에 표시되는 크기를 읽은 뒤, 드로잉 버퍼의 크기를 그에 맞춰 조절할 수 있습니다.

```js
  // 브라우저가 캔버스를 CSS 픽셀 단위로 표시하는 크기를 확인해 보세요.
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
  canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
```

이 코드는 `context.getCurrentTexture()`을 호출하기 직전에 사용됩니다.

이 방법은 개인적으로는 구식으로 보이지만, 아마도 여기저기서 이런 방법을 사용하는 경우가 많을 것입니다. 아마도 이 방법은 다른 API들을 사용하는 예시들을 복사해서 붙여넣은 것일 것입니다.

## `getBoundingClientRect`를 사용하세요.

이를 수행하는 또 다른 방법은 `getBoundingClientRect`라는 함수를 호출하는 것입니다.

```js
  // 브라우저가 캔버스를 CSS 픽셀 단위로 표시하는 크기를 확인해 보세요.
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
  canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
```

`clientWidth`, `clientHeight`, 그리고 `getBoundingClientRect`의 차이점은, `getBoundingClientRect`를 통해 얻어진 너비와 높이가 정수가 되어야 하는 반면, `clientWidth`와 `clientHeight`의 값은 그렇지 않다는 것입니다.

왜 너비나 높이가 정수가 아닐까요? [`devicePixelRatio`와 줌 처리 방법](#a-dpr)을 참고하세요.

## `window.innerWidth`와 `window.innerHeight`를 사용하세요.

이런 상황을 자주 보게 되는데, 이는 분명히 **안티패턴**이라고 할 수 있습니다. 그 이유는 이 방법들이 유연하지 않기 때문입니다. 위에서 언급한 두 가지 방법은 모든 상황에서 잘 작동하지만, `window.innerWidth`와 `window.innerHeight`를 사용하는 방법은 페이지를 가득 채우고 싶을 때만 작동합니다. 이미 위에서 언급한 방법들은 페이지를 잘 채울 수 있지만, 다른 상황에서도 잘 작동합니다.

캔버스가 페이지 전체를 채우지 *않는* 경우입니다. 예를 들어 문서 속 그림이나 도구 모음이 있는 편집기가 해당합니다.

첫 번째 두 가지 방법을 사용하는 것이 더 쉽고 번거롭지 않으니, 이 덜 유용한 방법을 사용하는 것은 무의미해 보입니다. 안타깝게도 “복사 및 붙여넣기”라는 방법의 영향력도 상당히 큽니다 😂

## <a id="a-dpr"></a>`devicePixelRatio`와 줌 처리 방법

왜 그게 끝이 되지 않는 걸까요? 음, 여기서 상황이 복잡해집니다.

먼저 이해해야 할 것은, 브라우저에서 사용되는 대부분의 크기는 CSS 픽셀 단위로 표시된다는 점입니다. 이는 장치와 관계없이 동일한 크기를 유지하려는 시도입니다. 예를 들어, 이 기사의 상단 부분에서 캔버스의 디스플레이 크기를 400x300 CSS 픽셀로 설정했습니다. 사용자의 디스플레이가 HD-DPI 모드인지, 아니면 확대/축소된 상태인지, 혹은 OS의 줌 설정이 있는지에 따라, 실제 모니터에서 표시되는 크기는 달라질 수 있습니다.

`devicePixelRatio`는 일반적으로, 사용자의 모니터에서 실제 픽셀과 CSS로 표시된 픽셀의 비율을 나타냅니다. 예를 들어, 이는 브라우저의 현재 설정입니다.

> <div>devicePixelRatio = <span data-diagram="dpr"></span></div>

데스크톱이나 노트북을 사용하는 경우, <kbd>ctrl</kbd>+<kbd>+</kbd>와 <kbd>ctrl</kbd>+<kbd>-</kbd>를 눌러 확대/축소할 수 있습니다. (Mac에서는 <kbd>⌘</kbd>+<kbd>+</kbd>와 <kbd>⌘</kbd>+<kbd>-</kbd>를 사용합니다.) Firefox, Chrome, Edge에서는 숫자가 변하는 것을 볼 수 있습니다. 하지만 Safari에서는 그렇지 않습니다.

따라서, 캔버스에 표시되는 픽셀의 수가 실제로 사용되는 픽셀의 수와 일치하도록 하고 싶다면, 위에서 구한 값들을 곱하는 것이 가장 간단한 해결 방법일 것입니다.

```js
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
-    const width = entry.contentBoxSize[0].inlineSize;
-    const height = entry.contentBoxSize[0].blockSize;
+    const width = entry.contentBoxSize[0].inlineSize * devicePixelRatio;
+    const height = entry.contentBoxSize[0].blockSize * devicePixelRatio;
```

아니면 이런 식이죠.

```js
-  const width = canvas.clientWidth;
-  const height = canvas.clientHeight;
+ const width = canvas.clientWidth * devicePixelRatio;
+ const height = canvas.clientHeight * devicePixelRatio;
```

아니면 이런 식이죠.

```js
  const rect = canvas.getBoundingClientRect();
-  const width = rect.width;
-  const height = rect.height;
+  const width = rect.width * devicePixelRatio;
+  const height = rect.height * devicePixelRatio;
```

> **위의 예시들은 실제로 올바른 결과를 보여주지 않습니다!!!**

그렇긴 하지만, 충분히 좋은 선택이 될 수도 있습니다. 만약 화면에서 1:1의 정확한 픽셀 렌더링을 기대하지 않는다면, 위에서 언급한 방법들을 사용해도 됩니다.

위의 코드가 올바른 결과를 반환하지 않는 이유를 설명하는 방법은 두 가지가 있습니다.

1. `devicePixelRatio`는 정수가 아닙니다.

   Firefox, Edge, 또는 Chrome을 사용하는 경우, 위에서 언급한 방법으로 확대/축소 키를 누르면, 소수점 이하의 `devicePixelRatio` 값을 쉽게 확인할 수 있습니다.

2. 어떠한 요소의 크기 자체가 정수가 아닙니다.

   위에서 살펴보았듯이, `ResizeObserver`와 `getBoundingClientRect` 모두, 요소의 크기를 정수로 반환하지 않습니다.

이 문제가 발생하는 구체적인 예로, 부모의 너비의 33%만큼의 너비를 가진 3개의 자식 요소를 포함하는 디바이스를 만들 수 있습니다.

```html
<div id="parent">
  <div id="left">left</div>
  <div id="middle">middle</div>
  <div id="right">right</div>
</div>
```

```css
#parent {
  display: flex;
  width: 299px;
  height: 40px;
  align-items: stretch;
  background-color: red;
}
#parent>* {
  flex: 1 1 33%;
}
#left { background-color: #A44; }
#middle { background-color: #4A4; }
#right { background-color: #66C; }
```

{{{example url="../fractional-element-size-issues.html"}}}

제 컴퓨터 중 하나에서는, 기본 설정의 브라우저 창을 사용할 때, 다음과 같은 결과가 나타납니다.

<pre class="fixed-size-text">
devicePixelRatio: 2
--------------- #left ---------------
                 inlineSize: 99.65625
                clientWidth: 100
getBoundingClientRect.width: 99.6640625
--------------- #middle ---------------
                 inlineSize: 99.65625
                clientWidth: 100
getBoundingClientRect.width: 99.6640625
--------------- #right ---------------
                 inlineSize: 99.65625
                clientWidth: 100
getBoundingClientRect.width: 99.6640625
--------------- #parent ---------------
                 inlineSize: 299
                clientWidth: 299
getBoundingClientRect.width: 299
</pre>

가장 먼저 볼 점은 **자식 요소 3개의 수치가 모두 정확히 같다는 것입니다!!** 부모 요소의 너비는 299 CSS 픽셀입니다. 여기에 devicePixelRatio인 2를 곱하면 실제 픽셀은 598개입니다. 자식 요소는 3개입니다. `598 / 3 = 199.33333333333334`이지만 실제 픽셀을 199.33333333334개 할당할 수는 없습니다. 199로 반올림하면 199 + 199 + 199 = 597입니다. 부모 요소의 너비인 598을 채우려면 자식 요소 하나에 픽셀을 하나 더 줘야 합니다. 세 요소의 정보가 정확히 같은데, 어느 요소에 그 픽셀을 줘야 할까요?

## <a id="a-devicepixelcontentboxsize"></a> `devicePixelContentBoxSize`

해결책은 `ResizeObserver`가 그 해답을 제공한다는 것입니다. 이 값의 이름은 `devicePixelContentBoxSize`입니다.

```
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
-    const width = entry.contentBoxSize[0].inlineSize;
-    const height = entry.contentBoxSize[0].blockSize;
+    const width = entry.devicePixelContentBoxSize[0].inlineSize;
+    const height = entry.devicePixelContentBoxSize[0].blockSize;
```

만약 그 측정을 우리의 예시에 추가한다면, 실제적인 답을 얻을 수 있습니다.

{{{example url="../fractional-element-size-device-pixel-content-box-size.html"}}}

위의 결과를 얻은 컴퓨터에서 다음과 같은 결과가 나타났습니다.

<pre class="fixed-size-text">
devicePixelRatio: 2
--------------- #left ---------------
                          inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 199    <=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #middle ---------------
                          inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 200    <=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #right ---------------
                          inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 199    <=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #parent ---------------
                          inlineSize: 299
devicePixelContentBoxSize.inlineSize: 598    <=====
                         clientWidth: 299
         getBoundingClientRect.width: 299
</pre>

보시다시피, 제 컴퓨터에서는 브라우저가 중앙에 있는 요소에 추가적인 픽셀을 할당했습니다. 그 요소의 너비는 200개의 디바이스 픽셀입니다. 반면, 다른 두 요소의 너비는 199개의 디바이스 픽셀입니다.

이 문제는 단지 이 한 가지 경우에만 국한된 것이 아닙니다. 이는, 다른 방법으로는 이 정보를 얻을 수 없다는 것을 보여주는 가장 간단한 예시일 뿐입니다. 중요한 점은, 픽셀 수준의 완벽함을 원한다면, `devicePixelRatio`를 사용해서 어떤 측정값을 곱하는 것만으로는 충분하지 않다는 것입니다. 반드시 `ResizeObserver`와 `devicePixelContentBoxSize`를 사용해야 합니다.

참고로 2023년 11월 기준 Safari는 `devicePixelContentBoxSize`를 지원하지 않으며, 확대하거나 축소해도 `devicePixelRatio`가 변경되지 않습니다. 따라서 **Safari에서는 1x1 픽셀이 정확히 맞는 캔버스를 표시할 수 없습니다**.

## `content-box`와 `device-pixel-content-box`의 차이점

`ResizeObserver.observe`를 호출할 때, 두 개의 박스 중 하나의 크기가 변할 때를 감지하도록 지정할 수 있습니다. 기본적으로는 `content-box`의 크기가 변할 때만 감지됩니다. 이는 요소의 CSS 크기입니다. 위 예시에서는 요소의 크기가 변하지 않는 경우도 있습니다. 부모 요소의 크기는 299픽셀으로 설정되어 있으며, 줌 레벨과 관계없이 동일하게 유지됩니다. 자식 요소의 크기는 33%로 설정되어 있으며, 이는 299의 33%에 해당하는 값입니다. 즉, 항상 99.666666픽셀입니다. 반면, 요소가 페이지의 전체 크기일 경우, 줌할 때마다 크기가 변합니다. [^safari]

또한, `device-pixel-content-box`도 관찰할 수 있습니다. 이는 해당 요소가 실제로 차지하는 디바이스 픽셀의 크기를 나타냅니다. 줌 레벨이 변경될 때 이 값도 변합니다[^safari]. 하지만 요소의 디바이스 픽셀 크기가 실제로 변하지 않는 경우에는 이 값은 변하지 않습니다. 예를 들어, 요소가 페이지의 전체 크기인 경우, 줌을 해도 그 요소의 크기는 여전히 페이지의 전체 크기로 유지되므로, 디바이스 픽셀의 수도 변하지 않습니다.

[^safari]: 사파리에서는 예외입니다. 🤬

`ResizeObserver`가 어떤 크기를 감시해야 하는지를 알려주려면, `observe` 함수를 호출할 때 해당 크기를 전달해야 합니다.

```
resizeObserver.observe(someElement1, {box: 'device-pixel-content-box'});
resizeObserver.observe(someElement2, {box: 'content-box'});
```

안타깝게도, 사파리는 이 기능을 지원하지 않습니다. `'device-pixel-content-box'`를 전달하려고 하면 예외가 발생합니다.

## <a id="a-actual-pixels"></a> 실제 픽셀 수 – 해결책

따라서 2023년 11월을 기준으로 실제 픽셀 수를 구하려면 위의 두 상자 유형을 모두 요청하고 Safari에서 발생하는 문제를 처리해야 합니다. `devicePixelContentBoxSize`를 사용할 수 없을 때는 `contentBoxSize`를 사용합니다.

다음은, 모든 표준을 준수하는 브라우저에서 픽셀 정확도 높은 렌더링을 지원하기 위해 업데이트된 우리의 코드입니다. [^safari]

```js
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                    entry.contentBoxSize[0].inlineSize * devicePixelRatio;
      const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                     entry.contentBoxSize[0].blockSize * devicePixelRatio;
      const canvas = entry.target;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // 재 렌더링
      render();
    }
  });
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas, { box: 'content-box' });
  }
```

이를 확인하기 위해, 렌더링이 픽셀 단위로 완벽하지 않을 경우 [모이레 효과](https://www.google.com/search?q=moire+effect)가 나타나는 패턴을 그려보았습니다. 이 패턴은 [`@builtin(position)` 절](webgpu-inter-stage-variables.html#a-builtin-position)에서 그려진 것입니다.

위의 코드를 캔버스의 크기 조절 코드로 바꾸고, 패턴을 마젠타색, 녹색, 흰색, 검은색의 체크무늬로 변경합니다.

```wgsl
  @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-    let red = vec4f(1, 0, 0, 1);
-    let cyan = vec4f(0, 1, 1, 1);
-    return select(red, cyan, checker);

+    let hv = vec2f(floor(fsInput.position.xy % 2));
+    return vec4f(1, 0, 1, 1) * hv.x +
+           vec4f(0, 1, 0, 1) * hv.y;
  }
```

또한, 캔버스를 덮을 수 있을 만큼 충분히 큰 삼각형을 만들어보자. [^large-triangle]

[^large-triangle]: 이러한 정점 위치가 왜 그런지는 [클립 공간을 덮는 큰 삼각형](webgpu-large-triangle-to-cover-clip-space.html)를 참조하세요.

```js
    let pos = array(
-      vec2f( 0.0,  0.5),  // 상단 중앙
-      vec2f(-0.5, -0.5),  // 왼쪽 하단
-      vec2f( 0.5, -0.5)   // 오른쪽 하단
+      vec2f(-1.0,  3.0),
+      vec2f( 3.0, -1.0),
+      vec2f(-1.0, -1.0),
    );
```

{{{example url="../webgpu-resize-pixel-perfect.html" }}}

새 창에서 열어서 확대하거나 축소해 보세요. 그러면 단색의 패턴이 보일 것입니다. 이 패턴은 확대 수준과 관계없이 변하지 않습니다. 다만, Safari에서는 확대하면 [무어 패턴](https://www.google.com/search?q=moire+pattern)이 나타나는데, 이는 Safari에서는 픽셀 수준의 완벽함을 얻는 것이 불가능함을 의미합니다.

> 참고: 만약 원한다면…
Safari에서 `devicePixelContentBox` 기능을 지원하기 위해, 여러분의 의견을 [여기](https://bugs.webkit.org/show_bug.cgi?id=264158)에 버그 보고서에 추가해 주세요. 또한, Safari가 확대/축소에 반응하여 `devicePixelRatio`를 변경하지 않는 문제에 대해서도 [여기](https://bugs.webkit.org/show_bug.cgi?id=124862)에 버그 보고서를 등록해 주세요. 버그들은 그에 대한 관심의 정도에 따라 해결될 수 있으니, 꼭 여러분의 의견을 남겨주세요.

## `devicePixelRatio`를 사용해야 하나요?

더 높은 해상도로 그리는 것은 낮은 해상도로 그리는 것보다 더 느립니다. 항상 `devicePixelRatio`를 사용할 필요는 없습니다. 설령 사용하기로 결정하더라도, [많은 휴대폰의 경우 devicePixelRatio가 4에 달하기도 합니다](https://yesviz.com/viewport/). 즉, CSS 단위 1픽셀당 16픽셀이 그려집니다. 따라서 그리는 속도는 1픽셀을 그리는 것보다 16배나 느릴 수 있습니다. 그러므로 `dpr = Math.min(2, devicePixelRatio)`와 같은 방식으로 devicePixelRatio의 사용을 제한하는 것이 좋을 것입니다.

또한, 게임이 느리다면 사용자 경험이 나쁜 경우가 많습니다. 따라서 사용자가 자신이 원하는 배율을 직접 선택할 수 있도록 하는 것이 좋습니다. 많은 컴퓨터 게임들도 그래픽 설정에서 이런 기능을 제공합니다. 그러면 사용자는 해상도와 속도 중에서 원하는 것을 선택할 수 있습니다.

<!-- 이 내용은 기사의 하단에 남겨두세요. -->
<script type="module" src="webgpu-resizing-the-canvas.js"></script>
