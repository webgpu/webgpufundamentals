Title: WebGPU 후처리: 3D 룩업 테이블(LUT)
Description: 3D 룩업 테이블(LUT)
TOC: 3D 룩업 테이블(LUT)

이 글은 이미지 조정에 관한 세 번째 글입니다. 이 글들은 이전 글들을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="image-adjustments.hanson"}}}


[1D 룩업 테이블(LUT)](webgpu-1dlut.html)에서는 그라디언트 맵을 살펴봤습니다. 1D-LUT로 사용한 텍스처는 너비가 n픽셀, 높이가 1픽셀이었습니다. 3D-LUT는 이 방식을 3차원으로 확장한 것입니다.

먼저 여러 색을 담은 정육면체를 만듭니다. 원본 이미지의 각 픽셀에서 R, G, B 성분을 이 정육면체의 좌표로 사용합니다. 3D-LUT에서 그 위치의 색을 읽어 새 픽셀 색으로 사용합니다.

JavaScript에서는 이렇게 처리할 수 있습니다. 색상이 0부터 255까지의 정수로 표현된다고 가정해 봅시다. 그리고 256x256x256 크기의 3차원 배열을 가지고 있다고 합시다. 그렇다면 색상을 해당 룩업 테이블을 통해 변환하려면 다음과 같이 처리해야 합니다.

```js
    const newColor = lut[origColor.red][origColor.green][origColor.bue];
```

물론, 256x256x256 크기의 배열이라면 상당히 큰 데이터가 될 것입니다. 하지만 [텍스처](webgpu-textures.html)에서 언급했듯이, 텍스처는 그 크기에 관계없이 0.0부터 1.0까지의 값으로 참조됩니다.

8x8x8 크기의 입방체를 상상해 봅시다.

<div class="webgpu_center"><img src="resources/images/3dlut-rgb.svg" class="noinvertdark" style="width: 500px"></div>

먼저, 각 모서리에는 0,0,0으로 채울 수 있습니다. 이는 순수한 검은색을 나타냅니다. 반대로, 1,1,1으로 채우면 순수한 흰색이 됩니다. 1,0,0은 순수한 <span style="color:red;">빨간색</span>을 나타냅니다. 0,1,0은 순수한 <span style="color:green;">녹색</span>을 나타내며, 0,0,1은 순수한 <span style="color:blue;">파란색</span>을 나타냅니다.

<div class="webgpu_center"><img src="resources/images/3dlut-axis.svg" class="noinvertdark" style="width: 500px"></div>

각 축에 해당하는 색상을 추가해 주겠습니다.

<div class="webgpu_center"><img src="resources/images/3dlut-edges.svg" class="noinvertdark" style="width: 500px"></div>

그리고, 2개 이상의 채널을 사용하는 가장자리 부분의 색상들도 마찬가지입니다.

<div class="webgpu_center"><img src="resources/images/3dlut-standard.svg" class="noinvertdark" style="width: 500px"></div>

마지막으로 그 사이를 모두 채우면 항등 3D-LUT가 됩니다. 이 LUT에서는 어느 색을 조회하더라도 입력과 같은 색이 나옵니다.

<div class="webgpu_center"><object type="image/svg+xml" data="resources/images/3dlut-standard-lookup.svg" class="noinvertdark" data-diagram="lookup" style="width: 600px"></object></div>

만약 큐브의 색상을 호박색으로 변경한다면, 색상을 확인할 때도 3D 데이터 테이블에서 같은 위치들을 참조하지만, 그 결과는 달라집니다.

<div class="webgpu_center"><object type="image/svg+xml" data="resources/images/3dlut-amber-lookup.svg" class="noinvertdark" data-diagram="lookup" style="width: 600px"></object></div>

이 기술을 사용하면, 다양한 효과를 적용할 수 있습니다. 기본적으로, 단일 색상 입력만으로도 계산될 수 있는 모든 효과들을 적용할 수 있습니다. 이러한 효과들에는 색상의 휘도, 대비, 채도, 색조, 밝기, 노출, 레벨, 곡선, 포스터화, 그림자, 하이라이트 등이 포함됩니다. 더욱 좋은 점은, 이러한 효과들을 모두 하나의 업로드 테이블에 통합할 수 있다는 것입니다.

우리가 필요로 하는 WGSL은, `apply1DLUT` 함수와 매우 유사합니다.

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

+fn apply3DLUT(
+    color: vec3f,
+    lut: texture_3d<f32>,
+    smp: sampler) -> vec3f {
+  let size = vec3f(textureDimensions(lut, 0));
+  let range = (size - 1) / size;
+  let uvw = 0.5 / size + color * range;
+  return textureSample(lut, smp, uvw).rgb;
+}
```

이 방법을 우리의 셰이더에 적용해 봅시다. 그런데, 다른 모든 조정들을 제거해버리도록 합시다.

```wgsl
struct Uniforms {
-  brightness: f32,
-  contrast: f32,
  lutAmount: f32,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;
-@group(1) @binding(0) var lut: texture_2d<f32>;
+@group(1) @binding(0) var lut: texture_3d<f32>;
@group(1) @binding(1) var lutSampler: sampler;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
-  rgb = adjustBrightness(rgb, uni.brightness);
-  rgb = adjustContrast(rgb, uni.contrast);
-  rgb = mix(rgb, apply1DLUT(rgb, lut, lutSampler), uni.lutAmount);
+  rgb = mix(rgb, apply3DLUT(rgb, lut, lutSampler), uni.lutAmount);
  return vec4f(rgb, color.a);
}
```

이를 사용하려면 3D 텍스처가 필요합니다. 가장 간단한 3D-LUT는 2x2x2 크기의 항등 LUT입니다. 여기서 *항등*이란 값이 바뀌지 않는다는 뜻입니다. LUT에서 색상을 조회하더라도 입력 색상과 같은 색상이 출력됩니다. 1을 곱하는 것과 같습니다.

<div class="webgpu_center"><img src="resources/images/3dlut-standard-2x2.svg" class="noinvertdark" style="width: 200px"></div>

다음은 항등 LUT에 필요한 색상을 담은 2ˣ2ˣ2 크기의 3D 텍스처를 만드는 코드입니다.

```js
function makeIdentityLutTexture(device) {
  const texture = device.createTexture({
    size: [2, 2, 2],
    dimension: '3d',
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const identityLUT = new Uint8Array([
      0,   0,   0, 255,  // 검은색
    255,   0,   0, 255,  // 빨간색
      0, 255,   0, 255,  // 초록색
    255, 255,   0, 255,  // 노란색
      0,   0, 255, 255,  // 푸른색
    255,   0, 255, 255,  // 마젠타
      0, 255, 255, 255,  // 시안
    255, 255, 255, 255,  // 하얀색
  ]);

  device.queue.writeTexture(
    { texture },
    identityLUT,
    { bytesPerRow: 8, rowsPerImage: 2 },
    [2, 2, 2],
  );

  return texture;
}
```

이걸 사용하려면 일정한 코드가 필요합니다. 그럼, 이를 두 번 사용해 보겠습니다. 한 번은 선형 필터링을 사용하여, 다른 한 번은 선형 필터링을 사용하지 않고 사용해 보겠습니다.

```js
  const lutNearestSampler = device.createSampler();
  const lutLinearSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  function makeLutBindGroup(texture, sampler) {
    return device.createBindGroup({
      layout: postProcessPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: texture },
        { binding: 1, resource: sampler },
      ],
    });
  }

  const identityLutTexture = makeIdentityLutTexture(device);
  const lutBindGroups = [
    {
      name: 'identity',
      bindGroup: makeLutBindGroup(identityLutTexture, lutLinearSampler),
    },
    {
      name: 'identity (nearest)',
      bindGroup: makeLutBindGroup(identityLutTexture, lutNearestSampler),
    },
  ];

  ...

  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
-        settings.brightness,
-        settings.contrast,
        settings.lutAmount,
      ]),
    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
-    pass.setBindGroup(1, lutBindGroups[settings.lut]);
+    pass.setBindGroup(1, lutBindGroups[settings.lut].bindGroup);
    pass.draw(3);
    pass.end();
  }

  const settings = {
-    brightness: 0,
-    contrast: 0,
    lutAmount: 1,
    lut: 0,
  };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'brightness', -1, 1);
-  gui.add(settings, 'contrast', -1, 10);
  gui.add(settings, 'lutAmount', 0, 1);
+  const keyValues = Object.fromEntries(lutBindGroups.map(({name}, i) => [name, i]));
+  gui.add(settings, 'lut', { keyValues });

-  const uiElem = document.querySelector('#ui');
-  gradients.forEach((stops, i) => {
-    const div = document.createElement('div');
-    div.className = 'gradient';
-    div.style.background = `linear-gradient(to right,
-      ${stops.map(([r, g, b, stop]) => `rgb(${r}, ${g}, ${b}) ${stop * 100}%`).join(',')}
-    )`;
-    div.addEventListener('click', () => {
-      settings.lut = i;
-      render();
-    });
-    uiElem.append(div);
-  });
```

그렇게 하면, 영향을 전혀 받지 않는 id Lut가 얻어집니다 😂 하지만 적어도 필터링 없이 시도해보면서 강력한 효과가 있는지 확인할 수 있습니다.

{{{example url="../webgpu-post-processing-image-adjustments-3d-lut.html" }}}

먼저 원하는 LUT 해상도를 정한 뒤, 스크립트로 3D 룩업 테이블의 각 단면을 생성합니다.

```js
const ctx = document.querySelector('canvas').getContext('2d');

function drawColorCubeImage(ctx, size) {
  const canvas = ctx.canvas;
  canvas.width = size * size;
  canvas.height = size;

  for (let zz = 0; zz < size; ++zz) {
    for (let yy = 0; yy < size; ++yy) {
      for (let xx = 0; xx < size; ++xx) {
        const r = Math.floor(xx / (size - 1) * 255);
        const g = Math.floor(yy / (size - 1) * 255);
        const b = Math.floor(zz / (size - 1) * 255);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(zz * size + xx, yy, 1, 1);
      }
    }
  }
}

drawColorCubeImage(ctx, 8);
```

그리고 우리는 몇 가지 HTML 코드가 필요합니다.

```html
<h1>Color Cube Image Maker</h1>
<div>size:<input id="size" type="number" value="8" min="2" max="64"/></div>
<p><button type="button">Save...</button></p>
<div id="cube"><canvas></canvas></div>
<div>( note: actual image size is
<span id="width"></span>x<span id="height"></span> )</div>
</p>
```

그리고 JS를 사용해서 UI를 만들어야 합니다.

```js
function update(size) {
  drawColorCubeImage(ctx, size);
  document.querySelector('#width').textContent = ctx.canvas.width;
  document.querySelector('#height').textContent = ctx.canvas.height;
}
update(8);

function handleSizeChange(event) {
  const elem = event.target;
  elem.style.background = '';
  try {
    const size = parseInt(elem.value);
    if (size >= 2 && size <= 64) {
      update(size);
    }
  } catch (e) {
    elem.style.background = 'red';
  }
}

const sizeElem = document.querySelector('#size');
sizeElem.addEventListener('change', handleSizeChange, true);

const saveData = (function() {
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  return function saveData(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
  };
}());

document.querySelector('button').addEventListener('click', () => {
  ctx.canvas.toBlob((blob) => {
    saveData(blob, `identity-lut-s${ctx.canvas.height}.png`);
  });
});
```

이제 원하는 크기의 항등 3D-LUT를 만들 수 있습니다. [^size]

[^size]: Adobe의 .cube 파일들은 일반적으로 33×33×33 크기입니다.

{{{example url="../3dlut-base-cube-maker.html" }}}

해상도가 높을수록 더 세밀한 조정이 가능하지만, 데이터의 크기가 점점 커집니다. 예를 들어, 크기가 8인 데이터는 2k만 필요하지만, 크기가 64인 데이터는 1메가가 필요합니다. 따라서 원하는 효과를 얻을 수 있는 최소한의 크기만을 사용해야 합니다.

크기를 16로 설정한 다음, 파일을 저장해 보겠습니다. 그러면 다음과 같은 파일이 생성됩니다.

<div class="webgpu_center"><img src="resources/images/identity-lut-s16.png" style="image-rendering: pixelated; width: 256px;"></div>

그 다음, 이미지 편집기로 이동합니다. 제 경우에는 Photoshop을 사용합니다. 샘플 이미지를 불러온 후, 3D-LUT을 이미지의 왼쪽 상단 모서리에 붙입니다.

> 참고로, 처음에는 포토샵에서 큐브 파일을 이미지 위에 드래그앤드롭해보았지만, 그 방법은 작동하지 않았습니다. 포토샵은 이미지를 두 배로 확대시켰습니다. 아마도 포토샵이 DPI와 같은 요소를 고려하여 그렇게 한 것 같습니다. 큐브 파일을 별도로 불러온 다음, 그 파일을 화면 캡처 화면에 복사하는 방식으로는 문제가 해결되었습니다.

<div class="webgpu_center"><img class="nobg" src="resources/images/3d-lut-photoshop-before.png" style="width: 1100px"></div>

그 다음에는, 색상 기반의 전체 이미지 조정 기능을 사용하여 이미지를 조정할 수 있습니다. 포토샵의 경우, 대부분의 조정 기능들은 ‘조정’ 탭에서 사용할 수 있습니다.

<div class="webgpu_center"><img class="nobg" src="resources/images/3d-lut-photoshop-after.png" style="width: 1100px"></div>

이미지를 원하는 대로 조정한 후에는, 왼쪽 상단 모서리에 배치된 큐브 조각들도 같은 조정이 적용된 것을 확인할 수 있습니다.

알겠어요. 하지만 그걸 어떻게 사용해야 할까요?

먼저 `3d-lut-orange-to-green-s16.png`라는 PNG 파일로 저장했습니다. 메모리를 아끼려면 LUT 왼쪽 위의 256ˣ16 영역만 잘라 저장할 수도 있지만, 여기서는 불러온 뒤 잘라 보겠습니다. 이 방식의 장점은 PNG 파일을 보기만 해도 LUT의 효과를 어느 정도 파악할 수 있다는 것입니다. 단점은 대역폭이 낭비된다는 점입니다.

이 코드는 그 이미지를 로드하는 데 사용됩니다. 이 코드는 이미지를 로드한 후, 3D-LUT 부분만 캔버스에 복사합니다. 그런 다음 캔버스에서 데이터를 가져와서, 그 데이터를 텍스처에 한 번에 업로드합니다.

```js
/**
 * 이미지 URL을 기반으로 LUT 텍스처를 생성해야 합니다. LUT의 크기를 반드시 지정해야 합니다.
 * 이 위치는 이미지의 왼쪽 상단 모서리에 있을 것으로 추정됩니다.
 *
 * +---------+---------+---------+---------+---------+---------+---→
 * |         |         |         |         |         |         |
 * | 레이어 0 | 레이어 1 | 레이어 2 | 레이어 3 | … | 레이어 n |
 * |         |         |         |         |         |         |
 * +---------+---------+---------+---------+---------+---------+
 * |
 * ↓
 */
const createLUTTextureFromImage = (function() {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });

  return async function createLUTTextureFromImage(device, url, lutSize) {
    const img = new Image();
    img.src = url;
    await img.decode();
    ctx.canvas.width = lutSize * lutSize;
    ctx.canvas.height = lutSize;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, lutSize * lutSize, lutSize);

    const texture = device.createTexture({
      size: [lutSize, lutSize, lutSize],
      dimension: '3d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    for (let z = 0; z < lutSize; ++z) {
      device.queue.writeTexture(
        { texture, origin: [0, 0, z] },
        imgData.data,
        { offset: z * lutSize * 4, bytesPerRow: imgData.width * 4 },
        [lutSize, lutSize],
      );
    }
    return texture;
  };
})();
```

이제, 우리가 만든 맞춤형 LUT를 기존의 LUT 목록에 추가해 보겠습니다.

```js
+  const lutTextures = [
+    { name: 'custom',          url: 'resources/images/lut/3d-lut-orange-to-green-s16.png'},
+  ];
+  lutBindGroups.push(...await Promise.all(lutTextures.map(async({name, url}) => {
+    // 파일 이름은 '-s<num>[n]'로 끝납니다.
+    // 여기서 <num>은 3DLUT 큐브의 크기를 나타냅니다.
+    // 그리고 [n]은 “필터링하지 않음” 또는 “가장 가까운 값”을 의미합니다.
+    //
+    // 예시들:
+    //    ‘foo-s16.png’ = 크기: 16, 필터: true
+    //    ‘bar-s8n.png’ = 크기: 8, 필터: false
+    const m = /-s(\d+)(n*)\.[^.]+$/.exec(url);
+    const size = parseInt(m[1]);
+    const filter = m[2] === '';
+
+    const texture = await createLUTTextureFromImage(device, url, size);
+    const sampler = filter
+      ? lutLinearSampler
+      : lutNearestSampler;
+    return {name, bindGroup: makeLutBindGroup(texture, sampler)};
+  })));
```

위에서 볼 수 있듯이, LUT의 크기를 파일명의 끝부분에 저장했습니다. 이렇게 하면 LUT를 PNG 파일로 쉽게 전달할 수 있습니다.

그런데, 그럴 때마다, 더 많은 이미지를 포함한 3D 모델들을 불러오도록 합시다.

```js
  const lutTextures = [
    { name: 'custom',          url: 'resources/images/lut/3d-lut-orange-to-green-s16.png'},
+    { name: 'monochrome',      url: 'resources/images/lut/monochrome-s8.png' },
+    { name: 'sepia',           url: 'resources/images/lut/sepia-s8.png' },
+    { name: 'saturated',       url: 'resources/images/lut/saturated-s8.png', },
+    { name: 'posterize',       url: 'resources/images/lut/posterize-s8n.png', },
+    { name: 'posterize-3-rgb', url: 'resources/images/lut/posterize-3-rgb-s8n.png', },
+    { name: 'posterize-3-lab', url: 'resources/images/lut/posterize-3-lab-s8n.png', },
+    { name: 'posterize-4-lab', url: 'resources/images/lut/posterize-4-lab-s8n.png', },
+    { name: 'posterize-more',  url: 'resources/images/lut/posterize-more-s8n.png', },
+    { name: 'inverse',         url: 'resources/images/lut/inverse-s8.png', },
+    { name: 'color negative',  url: 'resources/images/lut/color-negative-s8.png', },
+    { name: 'funky contrast',  url: 'resources/images/lut/funky-contrast-s8.png', },
+    { name: 'nightvision',     url: 'resources/images/lut/nightvision-s8.png', },
+    { name: 'thermal',         url: 'resources/images/lut/thermal-s8.png', },
+    { name: 'b/w',             url: 'resources/images/lut/black-white-s8n.png', },
+    { name: 'hue +60',         url: 'resources/images/lut/hue-plus-60-s8.png', },
+    { name: 'hue +180',        url: 'resources/images/lut/hue-plus-180-s8.png', },
+    { name: 'hue -60',         url: 'resources/images/lut/hue-minus-60-s8.png', },
+    { name: 'red to cyan',     url: 'resources/images/lut/red-to-cyan-s8.png' },
+    { name: 'blues',           url: 'resources/images/lut/blues-s8.png' },
+    { name: 'infrared',        url: 'resources/images/lut/infrared-s8.png' },
+    { name: 'radioactive',     url: 'resources/images/lut/radioactive-s8.png' },
+    { name: 'goolgey',         url: 'resources/images/lut/googley-s8.png' },
+    { name: 'bgy',             url: 'resources/images/lut/bgy-s8.png' },
  ];
```

그런데, 어떻게 하면 그런 상황을 겪을 수 있을까요?

{{{example url="../webgpu-post-processing-image-adjustments-3d-luts.html" }}}

이것이 바로 우리 이미지에 적용된 모든 효과들입니다.

<div class="webgpu_center">
   <div data-diagram="imageLuts" class="fill-container"></div>
</div>

마지막으로 재미있는 점이 하나 있습니다. Adobe가 정의한 표준 LUT 형식이 있습니다. [인터넷에서 검색하면 이런 LUT 파일을 많이 찾을 수 있습니다](https://www.google.com/search?q=lut+files). 예를 들어 [이 사이트](https://freshluts.com/)에는 LUT가 많이 있습니다.

간단한 로더를 작성해보았습니다. 하지만 이 형식에는 4가지 변형이 있는데, 제가 찾은 예시는 그 중 하나뿐이었습니다. 그래서 모든 변형이 제대로 작동하는지 쉽게 확인할 수 없었습니다.

만약 Lut 파일을 드래그앤드롭해서 적용한다면, 그 파일이 정상적으로 적용될 수 있도록 해 보겠습니다.

먼저, 관련 라이브러리가 필요합니다.

```js
import * as lutParser from './resources/lut-reader.js';
```

그렇게 하면, 그들을 이런 식으로 사용할 수 있습니다.

```js
-  dragAndDrop.setup({msg: 'Drop Image File here'});
-  dragAndDrop.onDropFile(readImageFile);
+  dragAndDrop.setup({msg: 'Drop LUT or Img File here'});
+  dragAndDrop.onDropFile(readLUTOrImgFile);

+  function ext(s) {
+    return s.substr(s.lastIndexOf('.') + 1);
+  }
+
+  function readLUTOrImgFile(file) {
+    const type = ext(file.name);
+    switch (type.toLowerCase()) {
+      case 'jpg':
+      case 'jpeg':
+      case 'png':
+      case 'webp':
+        readImageFile(file);
+        break;
+      default:
+        readLUTFile(file);
+        break;
+    }
+  }

  async function readImageFile(file) {
    const newImageTexture = await createTextureFromImage(device, URL.createObjectURL(file));
    imageTexture.destroy();
    imageTexture = newImageTexture;
    updateBindGroup();
    render();
  }

+  function readLUTFile(file) {
+    const reader = new FileReader();
+    reader.onload = (e) => {
+      const type = ext(file.name);
+      const name = file.name.substring(file.name.lastIndexOf('/'));
+      const {size, data} = lutParser.lutTo2D3Drgba8(lutParser.parse(e.target.result, type));
+      const texture = device.createTexture({
+        size: [size, size, size],
+        dimension: '3d',
+        format: 'rgba8unorm',
+        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
+      });
+      device.queue.writeTexture(
+        { texture },
+        data,
+        { bytesPerRow: size * 4, rowsPerImage: size },
+        [size, size, size],
+      );
+      lutBindGroups.push({
+        name: (name && name.toLowerCase().trim() !== 'untitled')
+          ? name
+          : file.name,
+        bindGroup: makeLutBindGroup(texture, lutLinearSampler),
+      });
+      settings.lut = lutBindGroups.length - 1;
+      updateGUI();
+      render();
+    };
+
+    reader.readAsText(file);
+  }
```

그리고 새로운 파일들을 포함하도록 GUI를 업데이트해야 합니다.

```js
  const gui = new GUI();
  gui.name('Choose LUT or Drag&Drop LUT File(s)');
  gui.onChange(render);
  gui.add(settings, 'amount', 0, 1);
-  const keyValues = Object.fromEntries(lutBindGroups.map(({name}, i) => [name, i]));
-  gui.add(settings, 'lut', { keyValues });

+  let lutGUI;
+  function updateGUI() {
+    if (lutGUI) {
+      gui.remove(lutGUI);
+    }
+    const keyValues = Object.fromEntries(lutBindGroups.map(({name}, i) => [name, i]));
+    lutGUI = gui.add(settings, 'lut', { keyValues });
+  }
+  updateGUI();
```

그러면 [Adobe LUT 파일을 다운로드할 수 있습니다](https://www.google.com/search?q=lut+files). 그런 다음, 그 파일을 아래에 있는 예시 이미지 위에 드래그앤드롭할 수 있습니다.

{{{example url="../webgpu-post-processing-image-adjustments-3d-luts-w-loader.html"}}}

이것은 온라인에서 찾은 몇 가지 그림자 이미지들입니다. 이 그림자들을 어떤 이미지에 적용해 보았습니다.

<div class="webgpu_center">
   <div data-diagram="cubeLuts" class="fill-container" style="max-width: 1200px"></div>
</div>

Adobe LUT는 온라인 사용을 염두에 둔 형식이 아닙니다. 파일 크기가 약 1MB로 큽니다. 아래 예제에 파일을 끌어다 놓고 “Save...”를 클릭하면 더 작은 PNG 형식으로 변환해 저장할 수 있습니다. PNG 파일은 대개 약 50KB로, 원본의 약 20분의 1입니다.

{{{example url="../adobe-lut-to-png-converter.html" }}}

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-3dlut.css" rel="stylesheet">
<script type="module" src="webgpu-3dlut.js"></script>
