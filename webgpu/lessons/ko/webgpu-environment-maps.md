Title: WebGPU 환경 맵(반사)
Description: 환경 맵 구현하기
TOC: 환경 맵

이 글은 [큐브맵](webgpu-cube-maps.html)에 이어집니다. [방향광](webgpu-lighting-directional.html)에서 다룬 개념도 사용하므로 두 글을 먼저 읽어 보세요.

*환경 맵*은 그리려는 물체를 둘러싼 환경을 나타냅니다. 야외 장면이라면 주변 풍경을, 무대에 있는 사람을 그린다면 공연장을, 우주 장면이라면 별을 나타냅니다. 공간의 한 점에서 큐브의 여섯 방향을 바라본 이미지 6장이 있으면, 큐브맵으로 환경 맵을 구현할 수 있습니다.

이것은 런던의 레이든홀 마켓 로비에서 본 환경 지도입니다.

<div class="webgpu_center">
  <div class="side-by-side center-by-margin" style="max-width: 800px">
    <div><img src="../resources/images/leadenhall_market/pos-x.jpg" style="min-width: 256px; width: 256px" class="border"><div>양의 x</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-x.jpg" style="min-width: 256px; width: 256px" class="border"><div>음의 x</div></div>
    <div><img src="../resources/images/leadenhall_market/pos-y.jpg" style="min-width: 256px; width: 256px" class="border"><div>양의 y</div></div>
    <div><img src="../resources/images/leadenhall_market/pos-z.jpg" style="min-width: 256px; width: 256px" class="border"><div>긍정적인 z</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-z.jpg" style="min-width: 256px; width: 256px" class="border"><div>음성적인 z</div></div>
    <div><img src="../resources/images/leadenhall_market/neg-y.jpg" style="min-width: 256px; width: 256px" class="border"><div>양의 y</div></div>
  </div>
</div>
<div class="webgpu_center">
  <a href="https://polyhaven.com/a/leadenhall_market">레이든홀 마켓</a>. 저작권은 CC0로 배포됩니다. 출처: <a href="https://www.artstation.com/andreasmischok">안드레아스 미슈콕</a>
</div>

[큐브맵](webgpu-cube-maps.html)의 코드를 바탕으로, 예제에서 직접 만든 캔버스 대신 이미지 6장을 불러오겠습니다. [이미지 로딩](webgpu-importing-textures.html)에서 이미지를 불러오는 함수와 이미지로 텍스처를 만드는 함수를 작성했습니다.

```js
  async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  async function createTextureFromImage(device, url, options) {
    const imgBitmap = await loadImageBitmap(url);
    return createTextureFromSource(device, imgBitmap, options);
  }
```

여러 장의 이미지를 표시하기 위해 1을 더해 보겠습니다.

```js
+  async function createTextureFromImages(device, urls, options) {
+    const imgBitmaps = await Promise.all(url.map(loadImageBitmap));
+    return createTextureFromSource(device, imgBitmaps, options);
+  }

  async function createTextureFromImage(device, url, options) {
-    const imgBitmap = await loadImageBitmap(url);
-    return createTextureFromSource(device, imgBitmap, options);
+    return createTextureFromImages(device, [url], options);
  }
```

그런데, 우리는 기존의 함수도 새로운 함수로 바꾸었습니다. 이제는 새로운 함수를 사용하여 여섯 장의 이미지를 불러올 수 있습니다.

```js
-  const texture = await createTextureFromSources(
-      device, faceCanvases, {mips: true, flipY: false});
+  const texture = await createTextureFromImages(
+      device,
+      [
+        'resources/images/leadenhall_market/pos-x.jpg',
+        'resources/images/leadenhall_market/neg-x.jpg',
+        'resources/images/leadenhall_market/pos-y.jpg',
+        'resources/images/leadenhall_market/neg-y.jpg',
+        'resources/images/leadenhall_market/pos-z.jpg',
+        'resources/images/leadenhall_market/neg-z.jpg',
+      ],
+      {mips: true, flipY: false},
+  );
```

프래그먼트 셰이더에서는, 각 프래그먼트가 그려질 때, 눈/카메라에서 그 위치까지의 벡터가 주어졌을 때, 그 벡터가 물체 표면에서 어떤 방향으로 반사될지를 알아야 합니다. 그런 다음, 그 방향을 이용하여 큐브맵에서 색상을 얻을 수 있습니다.

반영하는 공식은 다음과 같습니다.

    reflectionDir = eyeToSurfaceDir –
        2 ∗ dot(surfaceNormal, eyeToSurfaceDir) ∗ surfaceNormal

[방향광](webgpu-lighting-directional.html)에서 살펴봤듯이, 단위 벡터 두 개의 내적은 두 벡터 사이 각도의 코사인입니다. 벡터를 더하면 새 방향 벡터를 만들 수 있습니다. 먼저 평평한 표면을 수직으로 바라보는 경우를 생각해 보겠습니다.

<div class="webgpu_center"><img src="resources/reflect-180-01.svg" style="width: 400px"></div>

위의 공식을 시각적으로 표현해 봅시다. 우선, 정확히 반대 방향으로 있는 두 벡터의 내적은 -1이라는 것을 기억해야 합니다. 그래서 시각적으로는…

<div class="webgpu_center"><img src="resources/reflect-180-02.svg" style="width: 400px"></div>

그 dot 제품을 반사 공식에 넣고, <span style="color:black; font-weight:bold;">eyeToSurfaceDir</span>과 <span style="color:green;">normal</span>을 사용하면 다음과 같은 결과를 얻습니다.

<div class="webgpu_center"><img src="resources/reflect-180-03.svg" style="width: 400px"></div>

-2 곱하기 -1을 하면, 결과는 양수인 2가 됩니다.

<div class="webgpu_center"><img src="resources/reflect-180-04.svg" style="width: 400px"></div>

따라서, 이러한 벡터들을 서로 연결하면, <span style="color: red">반사된 벡터</span>이 얻어집니다.

<div class="webgpu_center"><img src="resources/reflect-180-05.svg" style="width: 400px"></div>

위에서 주어진 두 개의 법선을 볼 수 있습니다. 하나는 눈에서 나온 방향과 완전히 반대되는 방향을 나타내고, 다른 하나는 반사된 물체가 다시 눈을 향하는 방향을 나타냅니다. 이 두 법선을 원래의 도식에 다시 넣으면, 바로 우리가 예상했던 결과가 나옵니다.

<div class="webgpu_center"><img src="resources/reflect-180-06.svg" style="width: 400px"></div>

그럼, 표면을 45도 정도 오른쪽으로 회전시켜 봅시다.

<div class="webgpu_center"><img src="resources/reflect-45-01.svg" style="width: 400px"></div>

135도 간격을 이루는 두 벡터의 내적은 -0.707입니다.

<div class="webgpu_center"><img src="resources/reflect-45-02.svg" style="width: 400px"></div>

그러니까, 모든 값을 그 공식에 대입해보는 것입니다.

<div class="webgpu_center"><img src="resources/reflect-45-03.svg" style="width: 400px"></div>

다시 두 개의 음수를 곱하면 양수가 나옵니다. 하지만 <span style="color: green">벡터</span>의 길이는 이제 약 30% 줄어들었습니다.

<div class="webgpu_center"><img src="resources/reflect-45-04.svg" style="width: 400px"></div>

벡터들을 더하면, <span style="color: red">반사된 벡터</span>을 얻을 수 있습니다.

<div class="webgpu_center"><img src="resources/reflect-45-05.svg" style="width: 400px"></div>

만약 이를 원래의 다이어그램에 다시 넣는다면, 그렇게 해도 올바른 결과가 나올 것입니다.

<div class="webgpu_center"><img src="resources/reflect-45-06.svg" style="width: 400px"></div>

우리는 그 <span style="color: red">반사된 방향</span>을 사용하여 큐브맵을 살펴보고, 객체의 표면에 색상을 입힙니다.

여기에는 표면의 회전을 설정할 수 있는 다이어그램이 있습니다. 또한, 방정식의 각 부분들을 확인할 수 있습니다. 또한, 반사 벡터가 큐브맵의 다양한 면들을 가리키는 것을 볼 수 있으며, 이를 통해 표면의 색상을 조절할 수 있습니다.

{{{diagram url="resources/environment-mapping.html" width="700" height="500" }}}

이제 반사가 어떻게 작동하는지 알았고, 큐브맵에서 값을 검색하는 데 이를 사용할 수 있다는 것을 알았으니, 이제 셰이더를 변경해서 그렇게 할 수 있도록 해 보겠습니다.

스포트라이트 강의의 예제처럼, 정점 셰이더에서 정점의 월드 위치와 월드 공간의 법선을 계산해 프래그먼트 셰이더로 전달합니다.

```wgsl
struct Uniforms {
-  matrix: mat4x4f,
+  projection: mat4x4f,
+  view: mat4x4f,
+  world: mat4x4f,
+  cameraPosition: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
+  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) normal: vec3f,
+  @location(0) worldPosition: vec3f,
+  @location(1) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = uni.matrix * vert.position;
-  vsOut.normal = normalize(vert.position.xyz);
+  vsOut.position = uni.projection * uni.view * uni.world * vert.position;
+  vsOut.worldPosition = (uni.world * vert.position).xyz;
+  vsOut.worldNormal = (uni.world * vec4f(vert.normal, 0)).xyz;
  return vsOut;
}
```

`worldNormal`은 정점 사이에서 보간되므로 프래그먼트 셰이더에서 다시 정규화합니다. [카메라](webgpu-cameras.html)에서 설명했듯이 뷰 행렬을 만드는 데 카메라의 월드 위치가 필요합니다. 이 예제에서는 그 위치를 `uni.cameraPosition`으로도 전달합니다. 표면의 월드 위치에서 카메라의 월드 위치를 빼고 정규화해 `eyeToSurfaceDir`를 구합니다.

마지막으로, `reflect`라는 함수를 사용합니다. 이 함수는 WGSL에 내장된 함수로서, 위에서 설명한 공식을 실제로 구현하는 역할을 합니다. 이 함수의 결과를 이용하여 큐브맵에서 색상을 추출할 수 있습니다.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
+  let worldNormal = normalize(vsOut.worldNormal);
+  let eyeToSurfaceDir = normalize(vsOut.worldPosition - uni.cameraPosition);
+  let direction = reflect(eyeToSurfaceDir, worldNormal);

-  return textureSample(ourTexture, ourSampler, normalize(vsOut.normal));
+  return textureSample(ourTexture, ourSampler, direction);
}
```

이 예시를 위해서는 실제의 법선도 필요합니다. 큐브의 면들이 평평하게 보이도록 하기 위해서는 실제 법선이 필요합니다. 이전 예시에서는 큐브맵이 어떻게 작동하는지 확인하기 위해 큐브의 위치를 변경했지만, 이번 경우에는 [방향광](webgpu-lighting-directional.html)에서 설명한 것처럼, 큐브에 대한 실제 법선이 필요합니다.

```js
  const vertexData = new Float32Array([
-     // 전면
-    -1,  1,  1,
-    -1, -1,  1,
-     1,  1,  1,
-     1, -1,  1,
-     // 오른쪽 얼굴
-     1,  1, -1,
-     1,  1,  1,
-     1, -1, -1,
-     1, -1,  1,
-     // 뒷면
-     1,  1, -1,
-     1, -1, -1,
-    -1,  1, -1,
-    -1, -1, -1,
-    // 왼쪽 얼굴
-    -1,  1,  1,
-    -1,  1, -1,
-    -1, -1,  1,
-    -1, -1, -1,
-    // 하단면
-     1, -1,  1,
-    -1, -1,  1,
-     1, -1, -1,
-    -1, -1, -1,
-    // 상면
-    -1,  1,  1,
-     1,  1,  1,
-    -1,  1, -1,
-     1,  1, -1,
+     //  위치 | 정상적인 상태
+     //-------------+----------------------
+     // 전면면적      양의 z
+    -1,  1,  1,         0,  0,  1,
+    -1, -1,  1,         0,  0,  1,
+     1,  1,  1,         0,  0,  1,
+     1, -1,  1,         0,  0,  1,
+     // 오른쪽 얼굴      긍정적인 값 x
+     1,  1, -1,         1,  0,  0,
+     1,  1,  1,         1,  0,  0,
+     1, -1, -1,         1,  0,  0,
+     1, -1,  1,         1,  0,  0,
+     // 백면       음수 z
+     1,  1, -1,         0,  0, -1,
+     1, -1, -1,         0,  0, -1,
+    -1,  1, -1,         0,  0, -1,
+    -1, -1, -1,         0,  0, -1,
+    // 왼쪽 얼굴        음수 x
+    -1,  1,  1,        -1,  0,  0,
+    -1,  1, -1,        -1,  0,  0,
+    -1, -1,  1,        -1,  0,  0,
+    -1, -1, -1,        -1,  0,  0,
+    // 하단 면은 음수 y 방향입니다.
+     1, -1,  1,         0, -1,  0,
+    -1, -1,  1,         0, -1,  0,
+     1, -1, -1,         0, -1,  0,
+    -1, -1, -1,         0, -1,  0,
+    // 상단 면        양의 y
+    -1,  1,  1,         0,  1,  0,
+     1,  1,  1,         0,  1,  0,
+    -1,  1, -1,         0,  1,  0,
+     1,  1, -1,         0,  1,  0,
  ]);
```

물론, 우리는 정육면체의 형태를 변경해야 합니다. 그래야만 정육면체가 올바르게 표현될 수 있습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (3) * 4, // (3) 각각 4바이트의 데이터가 저장됩니다.
+          arrayStride: (3 + 3) * 4, // (6) 각각 4바이트로 구성된 데이터들입니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
+            {shaderLocation: 1, offset: 12, format: 'float32x3'},  // 정상적인
          ],
        },
      ],
    },

```

평소와 같이, 우리는 유니폼 버퍼와 뷰를 설정해야 합니다.

```js
-  // 행렬
-  const uniformBufferSize = (16) * 4;
+  // 프로젝션, 뷰, 세계, 카메라 위치, 패드
+  const uniformBufferSize = (16 + 16 + 16 + 3 + 1) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
-  const kMatrixOffset = 0;
-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
  const kProjectionOffset = 0;
  const kViewOffset = 16;
  const kWorldOffset = 32;
+  const projectionValue = uniformValues.subarray(kProjectionOffset, kProjectionOffset + 16);
+  const viewValue = uniformValues.subarray(kViewOffset, kViewOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const cameraPositionValue = uniformValues.subarray(
+      kCameraPositionOffset, kCameraPositionOffset + 3);
```

그리고 우리는 렌더링 시에 그들을 적절한 위치에 배치해야 합니다.

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
-        matrixValue,
+        projectionValue,
    );
+    cameraPositionValue.set([0, 0, 4]);  // camera position;
    const view = mat4.lookAt(
-      [0, 1, 5],  // 카메라의 위치
+      cameraPositionValue,
      [0, 0, 0],  // 목표/대상
      [0, 1, 0],  // 위로
+      viewValue,
    );
-    mat4.multiply(matrixValue, view, matrixValue);
-    mat4.rotateX(matrixValue, settings.rotation[0], matrixValue);
-    mat4.rotateY(matrixValue, settings.rotation[1], matrixValue);
-    mat4.rotateZ(matrixValue, settings.rotation[2], matrixValue);
+    mat4.identity(worldValue);
+    mat4.rotateX(worldValue, time * -0.1, worldValue);
+    mat4.rotateY(worldValue, time * -0.2, worldValue);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

또한, 렌더링 방식을 rAF 루프로 변경해 보겠습니다.

```js
-  const degToRad = d => d * Math.PI / 180;
-
-  const settings = {
-    rotation: [degToRad(20), degToRad(25), degToRad(0)],
-  };
-
-  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };
-
-  const gui = new GUI();
-  gui.onChange(render);
-  gui.add(settings.rotation, '0', radToDegOptions).name('rotation.x');
-  gui.add(settings.rotation, '1', radToDegOptions).name('rotation.y');
-  gui.add(settings.rotation, '2', radToDegOptions).name('rotation.z');

  let depthTexture;

-  function render() {
+  function render(time) {
+    time *= 0.001;

     ...

+    requestAnimationFrame(render);
+  }
+  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      // 재 렌더링
-      render();
    }
  });
  observer.observe(canvas);
```

그렇게 해서 우리는 원하는 것을 얻게 됩니다.

{{{example url="../webgpu-environment-map-backward.html" }}}

자세히 살펴보면, 작은 문제가 하나 있을 수 있습니다.

<div class="webgpu_center"><img src="resources/environment-map-backward.png" class="nobg" style="width: 600px;"></div>

## <a id="a-flipped"></a> 반사 방향을 수정하기

환경 맵이 적용된 우리의 큐브는 마치 반사된 큐브와 같습니다. 하지만 거울은 일반적으로 사물을 수평으로 뒤집어서 보여줍니다. 도대체 무슨 일이 일어나고 있는 걸까요?

문제는, 우리가 큐브의 내부를 바라보고 있다는 점입니다. 하지만 [큐브맵](webgpu-cube-maps.html)에서 언급했듯이, 큐브의 각 면에 텍스처를 매핑할 때는 외부에서 볼 때와 마찬가지로 올바르게 매핑됩니다.

<div class="webgpu_center">
  <div data-diagram="show-cube-map" class="center-by-margin" style="width: 700px; height: 400px"></div>
</div>

다르게 보면 큐브 안에서는 “Y가 위를 향하는 오른손 좌표계”를 사용하므로 양의 Z가 앞쪽입니다. 지금까지 사용한 3D 수학은 “Y가 위를 향하는 왼손 좌표계”[^xxx-handed]를 사용하므로 음의 Z가 앞쪽입니다. 텍스처를 샘플링할 때 Z 좌표를 뒤집으면 간단히 해결할 수 있습니다.

[^xxx-handed]: 솔직히 말해서, “왼손잡이용”과 “오른손잡이용” 좌표계에 대한 이런 설명은 너무 혼란스럽습니다. 차라리 “+x 방향은 오른쪽으로, +y 방향은 위쪽으로, -z 방향은 앞으로”라고 말하는 게 훨씬 낫습니다. 그렇게 하면 아무런 혼동도 없을 것입니다. 하지만 더 자세히 알고 싶다면, [구글에서 검색해 보세요](https://www.google.com/search?q=right+handed+vs+left+handed+coordinate+system&tbm=isch) 😄

```wgsl
-  return textureSample(ourTexture, ourSampler, direction);
+  return textureSample(ourTexture, ourSampler, direction * vec3f(1, 1, -1));
```

이제, 그 반사된 이미지는 거울처럼 뒤집혀 있습니다.

{{{example url="../webgpu-environment-map.html" }}}

다음 글에서는 큐브맵으로 [스카이박스](webgpu-skybox.html)를 그려 보겠습니다.

## 큐브맵을 찾고 만들기

[polyhaven.com](https://polyhaven.com/hdris)에서는 수백 개의 무료 파노라마 이미지를 찾을 수 있습니다. 그 중 하나를 jpg나 png 형식으로 다운로드할 수 있습니다(오른쪽 상단의 ≡ 메뉴를 클릭하세요). 그런 다음 [이 페이지](https://greggman.github.io/panorama-to-cubemap/)로 이동하여 .jpg나 .png 파일을 드래그하여 해당 페이지에 업로드합니다. 원하는 크기와 형식을 선택한 후, 이미지를 큐베이스 형태로 저장하기 위해 버튼을 클릭합니다.

<!-- 이 내용은 기사의 하단에 남겨두세요. -->
<script type="module" src="webgpu-environment-maps.js"></script>
