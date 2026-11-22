Title: WebGPU 후처리: 1D 룩업 테이블(1D-LUT)
Description: 1D 룩업 테이블(LUT)
TOC: 1D 룩업 테이블(LUT)

이 글은 이미지 조정에 관한 짧은 시리즈의 두 번째 글입니다. 각 글은 이전 글을 바탕으로 작성된 것이므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="image-adjustments.hanson"}}}

이전 글에 이어 이미지의 밝기에 따라 두 색을 섞는 듀오톤 효과를 만들어 보겠습니다.

<div class="webgpu_center center"><div data-diagram="duotone" data-labels='{"type": "duotone"}'></div></div>

위 예제에서 이미지가 어두울수록 첫 번째 색상에 가까워지고, 밝을수록 두 번째 색상에 가까워집니다.

최대 색상 채널만을 밝기로 선택해도 효과는 얻을 수 있습니다. 하지만 인간의 눈은 녹색에 더 민감하기 때문에, 적어도 컴퓨터 모니터나 휴대폰 화면에서는 녹색이 붉은색보다 더 밝습니다. 그리고 붉은색은 파란색보다도 더 밝습니다.

RGB를 밝기, 즉 “휘도”로 변환하는 공식은 다음과 같습니다.

```
luminance = red * 0.2126 + green * 0.7152 + blue * 0.07222
```

그 공식을 보면, 녹색은 빨간색보다 약 2.5배 더 밝고, 파란색보다도 약 10배 더 밝습니다.

<div class="webgpu_center center">
  <img src="resources/images/rba-luminance.svg" class="noinvertdark" style="width: 600px;">
  <div>빨강, 초록, 파랑, 그리고 그에 해당하는 밝기들</div>
</div>

이를 WGSL로 옮기면 다음과 같습니다.

```wgsl
fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}
```

여기서 `dot`은 두 벡터의 대응하는 성분끼리 곱한 뒤 그 결과를 모두 더합니다.

이를 활용하면 듀오톤 효과를 적용할 수 있으며, 이를 우리의 셰이더에 추가할 수 있습니다. 이전 글에서 계속 진행하는 방식으로 말이죠.

```wgsl
fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

+fn applyDuotone(color: vec3f, color1: vec3f, color2: vec3f) -> vec3f {
+  let l = luminance(color);
+  return mix(color1, color2, l);
+}

...

struct Uniforms {
  brightness: f32,
  contrast: f32,
  @align(16) hsl: HSL,
+  @align(16) duotone: f32,
+  @align(16) duotoneColor1: vec3f,
+  @align(16) duotoneColor2: vec3f,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
  rgb = adjustHSL(rgb, uni.hsl);
  rgb = adjustBrightness(rgb, uni.brightness);
  rgb = adjustContrast(rgb, uni.contrast);
+  rgb = mix(rgb, applyDuotone(rgb, uni.duotoneColor1, uni.duotoneColor2), uni.duotone);
  return vec4f(rgb, color.a);
}
```

듀오톤 혼합 효과를 얼마나 적용할지 정할 수 있도록 `duotone`이라는 혼합 비율을 추가했습니다.

HSL 설정을 제거해 보겠습니다. 왜냐하면 그 설정들이 예제를 복잡하게 만들기 때문입니다.

```wgsl
struct Uniforms {
  brightness: f32,
  contrast: f32,
-  @align(16) hsl: HSL,
  @align(16) duotone: f32,
  @align(16) duotoneColor1: vec3f,
  @align(16) duotoneColor2: vec3f,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
-  rgb = adjustHSL(rgb, uni.hsl);
  rgb = adjustBrightness(rgb, uni.brightness);
  rgb = adjustContrast(rgb, uni.contrast);
  rgb = mix(rgb, applyDuotone(rgb, uni.duotoneColor1, uni.duotoneColor2), uni.duotone);
  return vec4f(rgb, color.a);
}
```

그리고 우리는 JavaScript를 업데이트하여 듀오톤 관련 매개변수들을 설정해야 합니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.brightness,
        settings.contrast,
        0,
        0,
-        settings.hue,
-        settings.saturation,
-        settings.lightness,
-        0,
+        settings.duotone,
+        0,
+        0,
+        0,
+        ...settings.duotoneColor1, 0,
+        ...settings.duotoneColor2, 0,
      ]),
    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }

  const settings = {
    brightness: 0,
    contrast: 0,
-    hue: 0,
-    saturation: 0,
-    lightness: 0,
+    duotone: 1,
+    duotoneColor1: new Float32Array([0.1, 0, 0.5]),
+    duotoneColor2: new Float32Array([1, 0.69, 0.4]),
  };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'brightness', -1, 1);
  gui.add(settings, 'contrast', -1, 10);
-  gui.add(settings, 'hue', -0.5, 0.5);
-  gui.add(settings, 'saturation', -1, 1);
-  gui.add(settings, 'lightness', -1, 1);
+  gui.add(settings, 'duotone', 0, 1);
+  gui.addColor(settings, 'duotoneColor1');
+  gui.addColor(settings, 'duotoneColor2');
```

그렇게 해서, 듀오톤 효과가 생깁니다.

{{{example url="../webgpu-post-processing-image-adjustments-duotone.html"}}}

많은 일반적인 효과들은 이 방법으로도 만들 수 있습니다. 예를 들어, “세피아” 효과도 단순히 세피아톤을 선택하는 것만으로 만들 수 있습니다.

<div class="webgpu_center center"><div data-diagram="sepia" data-labels='{"type": "sepia"}'></div></div>

# <a href="a-texture"></a> 텍스처를 사용하기

위 코드에서 우리는 두 가지 색상 사이에서 `mix`을 사용하고 있습니다.

```js
  let l = luminance(color);
  return mix(color1, color2, l);
```

[텍스처의 선형 보간](webgpu-textures.html#a-linear-interpolation)에서 살펴본 것처럼, 2ˣ1 픽셀 텍스처에 선형 필터링을 적용해 두 색상을 섞을 수도 있습니다.

그렇게 하도록 하죠. 여기에 WGSL 코드가 있습니다. 이 코드를 사용하면 텍스처의 색상을 혼합할 수 있습니다.

```wgsl
fn apply1DLUT(
    color: vec3f,
    lut: texture_2d<f32>,
    smp: sampler) -> vec3f {
  let l = luminance(color);
  let width = f32(textureDimensions(lut, 0).x);
  let range = (width - 1) / width;
  let u = 0.5 / width + l * range;
  return textureSample(lut, smp, vec2f(u, 0.5)).rgb;
}
```

그런 추가적인 수학적 계산들이 왜 필요한 걸까요? 굳이 그렇게 할 필요가 있을까요?

```wgsl
// 경고: 작동하지 않습니다!
fn apply1DLUT(
    color: vec3f,
    lut: texture_2d<f32>,
    smp: sampler) -> vec3f {
  let l = luminance(color);
  return textureSample(lut, smp, vec2f(l, 0.5)).rgb;
}
```

선형 텍스처 샘플링이 어떻게 작동하는지 다시 한 번 살펴보세요.

<div class="webgpu_center center">
  <img src="resources/images/linear-texture-interpolation.svg" class="noinvertdark" style="width: 600px;">
  <div>2x1 픽셀 크기의 텍스처이며, 각 좌표에서 얻어진 색상도 함께 포함됩니다.</div>
</div>

2ˣ1 픽셀 텍스처에서 0.0부터 왼쪽 픽셀의 중심까지 샘플링하면 첫 번째 픽셀의 색상만 얻습니다. 마찬가지로 오른쪽 픽셀의 중심부터 1.0까지는 두 번째 픽셀의 색상만 얻습니다. 원하는 것은 두 픽셀 중심 사이의 영역입니다. 휘도 값을 두 픽셀 사이의 좌표 범위에 대응시키고, 여기에 반 픽셀만큼 더합니다.

이렇게 하면, 우리는 새로운 함수를 사용할 수 있습니다.

```wgsl
struct Uniforms {
  brightness: f32,
  contrast: f32,
-  @align(16) duotone: f32,
-  @align(16) duotoneColor1: vec3f,
-  @align(16) duotoneColor2: vec3f,
+  gradient: f32,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;
+@group(1) @binding(0) var lut: texture_2d<f32>;
+@group(1) @binding(1) var lutSampler: sampler;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
  rgb = adjustBrightness(rgb, uni.brightness);
  rgb = adjustContrast(rgb, uni.contrast);
-  rgb = mix(rgb, applyDuotone(rgb, uni.duotoneColor1, uni.duotoneColor2), uni.duotone);
+  rgb = mix(rgb, apply1DLUT(rgb, lut, lutSampler), uni.gradient);

  return vec4f(rgb, color.a);
}
```

셰이더에서는 그라디언트 텍스처와 샘플러를 별도의 그룹에 배치합니다.

그 다음으로는 텍스처와 샘플러, 그리고 바인드 그룹을 생성해야 합니다.

```js
  const lutSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const rgbToUnorm8 = (rgb) => [0, 0, 0, 1].map((v, i) => (rgb[i] ?? v) * 255 | 0);
  const gradientColors = new Uint8Array([
    ...rgbToUnorm8([0.1, 0, 0.5]),
    ...rgbToUnorm8([1, 0.69, 0.4]),
  ]);
  const lutTexture = device.createTexture({
    size: [2],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  device.queue.writeTexture(
    { texture: lutTexture },
    gradientColors,
    { },
    [2],
  );

  const lutBindGroup = device.createBindGroup({
    layout: postProcessPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: lutTexture },
      { binding: 1, resource: lutSampler },
    ],
  });
```

앞에서 고른 듀오톤 색상 두 개를 `rgba8unorm` 형식으로 변환해 2×1 텍스처에 업로드합니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.brightness,
        settings.contrast,
-        0,
-        0,
-        settings.duotone,
-        0,
-        0,
-        0,
-        ...settings.duotoneColor1, 0,
-        ...settings.duotoneColor2, 0,
+        settings.lutAmount,
      ]),
    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
+    pass.setBindGroup(0, lutBindGroup);
    pass.draw(3);
    pass.end();
  }

  const settings = {
    brightness: 0,
    contrast: 0,
-    duotone: 1,
-    duotoneColor1: new Float32Array([0.1, 0, 0.5]),
-    duotoneColor2: new Float32Array([1, 0.69, 0.4]),
+    lutAmount: 1,
  };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'brightness', -1, 1);
  gui.add(settings, 'contrast', -1, 10);
-  gui.add(settings, 'duotone', 0, 1);
-  gui.addColor(settings, 'duotoneColor1');
-  gui.addColor(settings, 'duotoneColor2');
+  gui.add(settings, 'lutAmount', 0, 1);
```

그렇게 해서, 이제는 텍스처를 사용하기로 했습니다.

{{{example url="../webgpu-post-processing-image-adjustments-1d-lut.html"}}}

그렇게 많은 노력을 기울였음에도 불구하고, 결과는 전과 똑같습니다. 그렇다면 그게 무슨 의미가 있을까요? 게다가 색상을 변경하려면 텍스처도 새로운 색상으로 업데이트해야 합니다.

즉, 이제는 원하는 색상의 수를 자유롭게 선택할 수 있습니다. 단, 텍스처의 크기를 더 크게 만드면 됩니다. 셰이더를 업데이트할 필요는 없습니다.

아래에는 12개의 예시가 있습니다. 각 이미지 아래에는 위에서 언급된 코드에 전달되는 256x1 크기의 텍스처가 표시되어 있습니다. 이를 [그라디언트 맵](https://google.com/search?q=gradient%20map)이라고 합니다. 이는 이미지의 밝기를 “그라디언트” 형태로 표현하는 방식입니다. 하지만 텍스처가 반드시 그라디언트 형태일 필요는 없습니다. 그라디언트가 아닌, 단색의 텍스처를 가진 예시들도 있습니다.

<div class="webgpu_center center"><div data-diagram="luts" class="fill-container" style="max-width: 1200px"></div></div>

이러한 그라디언트 텍스처를 만들기 위해 코드를 작성해 보겠습니다. 0에서 1 사이의 색상들을 주면, 그 사이의 색상을 조절하여 텍스처를 생성할 수 있습니다. 하지만 브라우저에는 이미 그라디언트를 만들기 위한 기능이 내장되어 있으니, 그 기능을 활용해 보도록 하겠습니다.

다음은 그라디언트 데이터입니다. 각 항목의 처음 세 값은 unorm8 형식(0~255)의 r, g, b이며, 마지막 값은 그라디언트에서 해당 색상이 놓인 위치를 나타내는 0.0부터 1.0 사이의 값입니다.

```js
  const gradients = [
    [
      [  0,   0,   0, 0.0],
      [236,  23, 223, 0.37],
      [255, 144,   0, 0.48],
      [255, 255, 255, 1],
    ],
    [
      [  0,   0,   0, 0.0],
      [236,  23,  23, 0.33],
      [230, 194, 108, 0.50],
      [249, 197, 241, 0.64],
      [255, 255, 255, 1],
    ],
    [
      [ 10,  10,  10, 0.0],
      [ 90,   0, 255, 0.40],
      [255,   0,   0, 0.70],
      [132, 255,   0, 1],
    ],
    [
      [ 20,  20,  20, 0.0],
      [  0,  61, 201, 0.24],
      [ 76, 229, 155, 0.47],
      [246, 239,  45, 0.66],
      [255, 255, 255, 0.80],
    ],
    [
      [  4,   4,   4, 0.0],
      [  0, 184, 255, 0.50],
      [255, 133,   0, 0.60],
      [255, 255, 255, 1],
    ],
    [
      [ 17,  37,  81, 0.0],
      [198, 229, 112, 0.43],
      [255, 215, 104, 0.51],
      [252, 235, 241, 0.59],
      [ 97, 159, 234, 0.85],
      [  0,  65, 128, 1],
    ],
    [
      [  0,   0,   0, 0.0],
      [ 10,   0, 178, 0.14],
      [255,   0,   0, 0.50],
      [ 50, 178,   0, 0.61],
      [255, 252,   0, 0.80],
      [255, 255, 255, 0.98],
    ],
    [
      [  0,   0,   0, 0.0],
      [204,  27, 236, 0.25],
      [ 54, 129, 221, 0.41],
      [ 71, 193, 223, 0.60],
      [231, 203,  47, 0.79],
      [255, 255, 255, 1],
    ],
    [
      [ 27,  27,  27, 0.4],
      [114,   0, 255, 0.15],
      [  0, 228, 255, 0.61],
      [236, 196, 196, 0.68],
      [255, 211, 211, 1],
    ],
    [
      [ 26,  47,  71, 0.44],
      [207,  27,  38, 0.44],
      [207,  27,  38, 0.64],
      [103, 138, 146, 0.64],
      [103, 138, 146, 0.75],
      [231, 210, 155, 0.75],
    ],
    [
      [  0,   0,   0, 0.0],
      [ 51, 186, 236, 0.42],
      [248, 179,  13, 0.74],
      [255, 255, 255, 1],
    ],
    [
      [  0,   0,   0, 0.27],
      [ 54, 167, 227, 0.27],
      [ 54, 167, 227, 0.38],
      [154, 148, 194, 0.38],
      [154, 148, 194, 0.49],
      [166, 204,  59, 0.49],
      [166, 204,  59, 0.60],
      [227, 141,  32, 0.60],
      [227, 141,  32, 0.73],
      [246, 231,   8, 0.73],
      [246, 231,   8, 0.82],
      [255, 255, 255, 0.82],
    ],
    [
      [  0,   0,   0, 0],
      [255, 255, 255, 1],
    ],
    [
      [  0,   0,   0, 0.25],
      [255, 255, 255, 0.75],
    ],
    [
      [112,  66,  20, 0],
      [250, 235, 215, 1],
    ],
  ];
```

이러한 요소들을 사용하여 그라디언트 텍스처를 만들 수 있습니다. 이를 위해서는 2D [선형 그라디언트](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient)를 사용하면 됩니다.

```js
  const lutSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

-  const rgbToUnorm8 = (rgb) => [0, 0, 0, 1].map((v, i) => (rgb[i] ?? v) * 255 | 0);
-  const gradientColors = new Uint8Array([
-    ...rgbToUnorm8([0.1, 0, 0.5]),
-    ...rgbToUnorm8([1, 0.69, 0.4]),
-  ]);
-  const lutTexture = device.createTexture({
-    size: [2],
-    format: 'rgba8unorm',
-    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
-  });
-  device.queue.writeTexture(
-    { texture: lutTexture },
-    gradientColors,
-    { },
-    [2],
-  );
+  const ctx = new OffscreenCanvas(256, 1).getContext('2d');
+  const lutBindGroups = gradients.map(stops => {
+    const grad = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
+    for (const [r, g, b, stop] of stops) {
+      grad.addColorStop(stop, `rgb(${r}, ${g}, ${b})`);
+    }
+    ctx.fillStyle = grad;
+    ctx.fillRect(0, 0, ctx.canvas.width, 1);
+    const texture = createTextureFromSource(device, ctx.canvas);
+
+    return device.createBindGroup({
+      layout: postProcessPipeline.getBindGroupLayout(1),
+      entries: [
+        { binding: 0, resource: texture },
+        { binding: 1, resource: lutSampler },
+      ],
+    });
+  });
```

각 그라디언트마다 바인드 그룹을 만들었습니다. 이제 그리기에 사용하겠습니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    ...

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
-    pass.setBindGroup(1, lutBindGroup);
+    pass.setBindGroup(1, lutBindGroups[settings.lut]);
    pass.draw(3);
    pass.end();
  }

  const settings = {
    brightness: 0,
    contrast: 0,
    lutAmount: 1,
+    lut: 0,
  };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'brightness', -1, 1);
  gui.add(settings, 'contrast', -1, 10);
  gui.add(settings, 'lutAmount', 0, 1);
```

클릭해서 그라디언트를 선택할 수 있도록 CSS로 선택 목록을 표시합니다.

먼저, 컨테이너 요소부터 시작해 보겠습니다.

```html
  <body>
    <canvas></canvas>
+    <div id="ui"></div>
  </body>
```

그리고 몇 가지 CSS도 있어요.

```css
#ui {
  position: absolute;
  left: 0px;
  top: 0px;
  overflow: auto;
  height: 100%;
}
.gradient {
  margin: 1px;
  width: 100px;
  height: 20px;
}
```

그 다음에는 CSS의 [linear-gradient](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/linear-gradient)를 사용하여 그라디언트가 있는 요소들을 만들어보겠습니다.

```js
  const uiElem = document.querySelector('#ui');
  gradients.forEach((stops, i) => {
    const div = document.createElement('div');
    div.className = 'gradient';
    div.style.background = `linear-gradient(to right,
      ${stops.map(([r, g, b, stop]) => `rgb(${r}, ${g}, ${b}) ${stop * 100}%`).join(',')}
    )`;
    div.addEventListener('click', () => {
      settings.lut = i;
      render();
    });
    uiElem.append(div);
  });
```

그리고 그 결과는…

{{{example url="../webgpu-post-processing-image-adjustments-1d-luts.html"}}}

[3D 룩업 테이블(LUT)](webgpu-3dlut.html)에서는 이 방법을 3D 텍스처로 확장해 보겠습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-1dlut.css" rel="stylesheet">
<script type="module" src="webgpu-1dlut.js"></script>
