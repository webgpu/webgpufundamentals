Title: WebGPU 텍스처
Description: 텍스처 사용하기
TOC: 텍스처

이 글에서는 텍스처(texture)의 기본에 대해 알아보겠습니다.
이전 글에서 우리는 데이터를 셰이더에 전달하는 주요 방법들을 설명했습니다.
이는 [스테이지간 변수](webgpu-inter-stage-variables.html),
[uniforms](webgpu-uniforms.html), [스토리지 버퍼](webgpu-storage-buffers.html),
[정점 버퍼](webgpu-vertex-buffers)였습니다.
셰이더에 데이터를 전달하는 마지막 주요 방법은 텍스처입니다.

텍스처는 주로 2차원 이미지로 표현됩니다.
2차원 이미지는 색상값의 2차원 배열일 뿐이라는 것을 생각해보면 왜 2차원 배열 데이터를 전달하기 위해 텍스처를 사용해야 하는지 의문이 생기실 수 있습니다.
그냥 스토리지 버퍼를 2차원 배열로 만들어도 되죠.
텍스처가 특별한 이유는 *샘플러(sampler)*라는 특수한 하드웨어로 접근할 수 있기 때문입니다. 
샘플러는 텍스처로부터 16개의 서로 다른 값을 읽을 수 있고, 이들을 다양한 사용 용도에 맞게 적절히 섞을 수 있는 기능을 가지고 있습니다.

하나의 예시로, 2차원 이미지를 원래 크기보다 더 크게 그리고 싶다고 해 봅시다.

<div class="center">
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 128px; height: 128px; image-rendering: pixelated; image-rendering: crisp-edges;"></div>
    <div style="text-align: center;">원본</div>
  </div>
</div>

단순히 원본 이미지로부터 하나의 픽셀을 가져와 각 픽셀을 더 큰 이미지로 만들면 아래 첫 번째 예제같이 보이게 됩니다.
대신에 하나의 픽셀을 가지고 더 큰 이미지를 만들 때 원본 이미지의 여러 픽셀을 고려해서 만들면, 아래 오른쪽처럼 덜 픽셀화(pixelated)된 이미지를 볼 수 있게 됩니다.

<div class="webgpu_center compare">
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 512px; height: 512px; image-rendering: pixelated; image-rendering: crisp-edges;"></div>
    <div>필터링 되지 않았을 때</div>
  </div>
  <div>
    <div><img class="pixel-perfect" src="resources/kiana.png" style="max-width: 100%; width: 512px; height: 512px;"></div>
    <div>필터링 되었을 때</div>
  </div>
</div>

텍스처로부터 개별적인 픽셀을 얻어오는 WGSL 함수가 있고, 이들도 사용을 안하는 것은 아니지만 
이러한 함수들은 흥미롭지 않은 것이, 동일한 작업을 스토리지 버퍼로도 할 수 있기 때문입니다. 
WGSL의 텍스처 관련한 흥미로운 함수들은 여러 픽셀들을 필터링하고 섞는 함수들입니다.

WGSL 함수는 데이터를 표현하는 텍스처와, 텍스처로부터 데이터를 어떻게 얻어올 것인지를 표현하는 샘플러, 
그리고 값을 얻어오고자 하는 텍스처 좌표를 입력으로 받습니다.

샘플링된 텍스처에 대한 텍스처 좌표는 가로세로 0.0에서 1.0 사이이고 이는 실제 텍스처의 크기와는 관계 없습니다. [^up-or-down]

[^up-or-down]: 텍스처 좌표가 위(0 = bottom, 1 = top)인지 아래(0 = top, 1 = bottom)인지는 관점의 차이입니다.
중요한 것은 텍스처 좌표 0,0이 텍스처의 첫 데이터를 참조한다는 사실입니다.

<div class="webgpu_center"><img src="resources/texture-coordinates-diagram.svg" style="width: 500px;"></div>

[스테이지간 변수에 관한 글](webgpu-inter-stage-variables.html)의 예제를 가지고 
수정해서 사각형(삼각형 두 개)에 텍스처를 그리도록 해 봅시다.

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) texcoord: vec2f,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
-  let pos = array(
-    vec2f( 0.0,  0.5),  // top center
-    vec2f(-0.5, -0.5),  // bottom left
-    vec2f( 0.5, -0.5)   // bottom right
-  );
-  var color = array<vec4f, 3>(
-    vec4f(1, 0, 0, 1), // red
-    vec4f(0, 1, 0, 1), // green
-    vec4f(0, 0, 1, 1), // blue
-  );
+  let pos = array(
+    // 1st triangle
+    vec2f( 0.0,  0.0),  // center
+    vec2f( 1.0,  0.0),  // right, center
+    vec2f( 0.0,  1.0),  // center, top
+
+    // 2st triangle
+    vec2f( 0.0,  1.0),  // center, top
+    vec2f( 1.0,  0.0),  // right, center
+    vec2f( 1.0,  1.0),  // right, top
+  );

  var vsOutput: OurVertexShaderOutput;
-  vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-  vsOutput.color = color[vertexIndex];
+  let xy = pos[vertexIndex];
+  vsOutput.position = vec4f(xy, 0.0, 1.0);
+  vsOutput.texcoord = xy;
  return vsOutput;
}

+@group(0) @binding(0) var ourSampler: sampler;
+@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-  return fsInput.color;
+  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

위 예제에서 우리는 캔버스 중심에 삼각형을 그리기 위한 세 개의 정점을 
캔버스 오른쪽 위에 사각형을 그리기 위한 여섯 개의 정점으로 수정했습니다.

`OutVertexShaderOutput`를 `vec2f`인 `texcoord`를 전달하도록 수정하였고, 이를 통해 텍스처 좌표를 프래그먼트 셰이더로 넘길 수 있습니다.
정점 셰이더에서 `vsOutput.texcoord`를 클립 공간 위치와 같은 값으로 설정하였고, 
이는 하드코딩된 위치값과 같은 값입니다. 
`vsOutput.texcoord`는 프래그먼트 셰이더로 넘어가면서 삼각형의 세 개 정점 사이에서 보간됩니다.

그리고 샘플러와 텍스처를 선언하고 프래그먼트 셰이더에서 이들을 참조합니다.
`textureSample`함수는 텍스처를 *샘플링*합니다. 
첫 번째 인자는 샘플링할 텍스처이고, 두 번째 인자는 텍스처를 샘플링한 방법이 명시된 샘플러이며 
세 번째 인자는 어디서 샘플링할 것인지에 대한 텍스처 좌표입니다.

> Note: 텍스처 좌표로 위치값을 넘기는 것은 흔한 일이 아닙니다.
> 이 예제와 같은 단위 사각형 (너비와 높이가 1인 사각형)에서는 
> 우연히 위치값과 텍스처 좌표가 일치한 것 뿐입니다.
> 이런 방식으로 우리 예제가 간결하고 단순해 집니다.
> 텍스처 좌표는 [정점 버퍼](webgpu-vertex-buffers.html)를 통해
> 전달하는 것이 훨씬 일반적입니다.

이제 텍스처 데이터를 만들어야 합니다. 5x7 크기의 `F` 텍셀(texel)을 만들겠습니다. [^texel]

[^texel]: 텍셀은 "texture element"의 약어로 픽셀이 "picture element"의 약어닌 것과 대응됩니다.
저는 픽셀이나 텍셀이나 동일하다고 생각하지만 어떤 사람들은 텍스처에 대해 이야기 할 때 *텍셀*이라는 단어를 사용하는 것을 더 선호합니다.

```js
  const kTextureWidth = 5;
  const kTextureHeight = 7;
  const _ = [255,   0,   0, 255];  // red
  const y = [255, 255,   0, 255];  // yellow
  const b = [  0,   0, 255, 255];  // blue
  const textureData = new Uint8Array([
    b, _, _, _, _,
    _, y, y, y, _,
    _, y, _, _, _,
    _, y, y, _, _,
    _, y, _, _, _,
    _, y, _, _, _,
    _, _, _, _, _,
  ].flat());
```

`F`가 보이실 것이고, 왼쪽 위 코너(첫 번째 값)에는 파란색 텍셀이 있습니다.

우리는 `rgba8unorm` 텍스처를 만들 것입니다. 
`rgba8unorm`는 텍스처가 빨강, 초록, 파랑색과 알파(alpha)값을 가질 것이라는 의미입니다. 
각 값은 8비트 부호없는 값이고 텍스처에 사용될 떄 정규화될 것입니다.
`unorm`은 `unsigned normalzed`라는 뜻인데 이 값이 0에서 255 사이의 
값을 갖는 부호없는 바이트에서 0.0과 1.0 사이의 부동소수점으로 변환된 것임을 
이야기하는 멋있는 단어입니다.

다시 말해 우리가 텍스처에 넣은 값이 `[64, 128, 192, 255]`라면 셰이더에서는 `[64 / 255, 128 / 255, 192 / 255, 255 / 255]`가 되고, 
이는 다시말해 `[0.25, 0.50, 0.75, 1.00]` 입니다.

이제 데이터가 준비되었으니 텍스처를 만듭니다.

```js
  const texture = device.createTexture({
    size: [kTextureWidth, kTextureHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
```

`device.createTexture`에서 `size` 매개변수는 이름 그대로죠.
포맷은 위에서 이야기한대로 `rgba8unorm`이고요. 
`usage`의 `GPUTextureUsage.TEXTURE_BINDING`는 우리가 이 텍스처를 바인드그룹[^texture-binding]에 바인딩할 것임을 의미하고, 
`COPY_DST`는 데이터를 복사할 수 있도록 하겠다는 의미입니다.

[^texture-binding]: 텍스처의 다른 사용 용도 중 하나는 `GPUTextureUsage.RENDER_ATTACHMENT` 입니다.
이는 텍스처를 우리가 렌더링을 하는 대상으로 쓰겠다는 의미입니다. 
예제에서 `context.getCurrentTexture()`를 통해 우리가 사용하는 캔버스의 텍스처는 
`GPUTextureUsage.RENDER_ATTACHMENT`가 기본으로 설정되어 있습니다.

다음으로 할 일은 데이터를 복사하는 것입니다.

```js
  device.queue.writeTexture(
      { texture },
      textureData,
      { bytesPerRow: kTextureWidth * 4 },
      { width: kTextureWidth, height: kTextureHeight },
  );
```

`device.queue.writeTexture`의 첫 번째 매개변수는 업데이트하고자 하는 텍스처입니다. 
두 번째는 복사하고자 하는 데이터, 세 번째는 텍스처에 복사할 때 데이터를 어떻게 읽을지를 명시합니다. 
`bytesPerRow`가 한 행(row)에서 다음 행으로 넘어갈때까지 얼마나 많은 바이트가 사용되는지를 의미합니다. 
마지막 매개변수는 복사 대상의 크기입니다.

추가적으로 샘플러를 만들어야 합니다.

```js
  const sampler = device.createSampler();
```

텍스처화 샘플러를 모두 바인드그룹에 추가하고 이는 우리가 셰이더에 추가한 
`@binding(?)`와 매칭되어야 합니다.

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });
```

렌더링 부분에서는 바인드그룹을 명시하고 두 개의 삼각형으로 이루어진 사각형을 
렌더링하기위해 여섯 개의 정점을 그려야 합니다.

```js
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
+    pass.setBindGroup(0, bindGroup);
-    pass.draw(3);  // call our vertex shader 3 times
+    pass.draw(6);  // call our vertex shader 6 times
    pass.end();
```

실행하면 아래와 같은 결과를 얻게됩니다.

{{{example url="../webgpu-simple-textured-quad.html"}}}

**왜 F가 뒤집혀있을까?**

위로 다시 올라가 텍스처 좌표와 관련한 다이어그램을 살펴보면 
텍스처 좌표 0,0이 텍스처의 첫 번째 텍셀을 참조하는 것을 볼 수 있습니다. 
사각형의 캔버스 중심 부분의 위치가 0,0이고 그 값을 텍스처 좌표로 사용하므로, 
다이어그램에 대응해 보면 0,0은 첫 번째인 파란색 값을 참조하는 것을 알 수 있습니다.

이를 수정하는 방법은 일반적으로 두 가지입니다.

1. 텍스처 좌표를 뒤집는다(flip).

   이 예제의 경우 텍스처 좌표의 수정은 정점 셰이더에서 수정하거나,
      
   ```wgsl
   -  vsOutput.texcoord = xy;
   +  vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
   ```
   
   프래그먼트 셰이더에서 수정할 수 있습니다.

   ```wgsl
   -  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
   +  let texcoord = vec2f(fsInput.texcoord.x, 1.0 - fsInput.texcoord.y);
   +  return textureSample(ourTexture, ourSampler, texcoord);
   ```
   
   당연히 [정점 버퍼](webgpu-vertex-buffers.html), 또는 [스토리지 버퍼](webgpu-storage-buffers.html)를 사용해 텍스처 좌표를 넘겨주는 경우, 
   이를 원본 데이터에서 뒤집는 것이 좋습니다.

2. 텍스처 데이터를 뒤집는다.

   ```js
    const textureData = new Uint8Array([
   -   b, _, _, _, _,
   -   _, y, y, y, _,
   -   _, y, _, _, _,
   -   _, y, y, _, _,
   -   _, y, _, _, _,
   -   _, y, _, _, _,
   -   _, _, _, _, _,
   +   _, _, _, _, _,
   +   _, y, _, _, _,
   +   _, y, _, _, _,
   +   _, y, y, _, _,
   +   _, y, _, _, _,
   +   _, y, y, y, _,
   +   b, _, _, _, _,
    ].flat());
   ```

   데이터를 뒤집으면 위에 있는 값이 아래로 와서, 바꾸기 전의 왼쪽 아래 데이터가 
   첫 번째 데이터, 즉 0,0 텍스처 좌표가 참조하는 데이터가 됩니다. 
   이것이 텍스처 좌표를 대개 아래쪽이 0, 위쪽이 1로 생각하는 이유입니다.
   
   <div class="webgpu_center"><img src="resources/texture-coordinates-y-flipped.svg" style="width: 500px;"></div>

   데이터를 뒤집는 것은 흔한 일이라 이미지, 비디오, 캔버스로부터 데이터를 읽어 올 때 데이터를 뒤집어주는 옵션이 존재하기도 합니다.

## <a id="a-mag-filter"></a>magFilter

위 예제에서 우리는 기본 설정으로 샘플러를 사용했습니다. 
5x7 크기의 텍스처를 원본 5x7 텍셀 크기보다 크게 그리고 있기 때문에 샘플러는 
`magFilter`, 즉 텍스처가 확대(magnifying)될 때 사용되는 필터를 사용하고 있습니다. 
이를 `nearest` 에서 `linear`로 바꾸면 네 개 픽셀 사이에서 선형(linear) 보간합니다.

<a id="a-linear-interpolation"></a>
<div class="webgpu-center center diagram"><div data-diagram="linear-interpolation" style="display: inline-block; width: 600px;"></div></div>

텍스처 좌표는 일반적으로 "UV"(you-vee로 발음)로 불리며, 따라서 위 다이어그램에서 
`uv`는 텍스처 좌표를 의미합니다. 주어진 uv에 대해 가까운 네 개 픽셀이 선택됩니다. 
`t1`은 선택된 왼쪽 위 픽셀의 중심에서부터 `u`좌표까지의 수평 거리 비율이며 0은 `u` 
가 왼쪽 픽셀의 중심선상에 있다는 뜻이고 1은 오른쪽 픽셀의 중심선상에 있다는 뜻입니다. 
`t2`도 비슷한데 수평 거리가 아닌 수직 거리입니다.

`t1`값은 위쪽 두 개의 픽셀값을 *mix*하여 중간 색상값을 계산하는데 사용됩니다. 
*mix*는 두 값 사이를 선형 보간하며, `t1`이 0이면 첫 번째 값이 선택됩니다. 
`t1`이 1이면 두 번째 값이 선택됩니다. 0과 1 사이의 값에서는 비율에 따라 섞이게 됩니다. 
예를들어 0.3일 경우 첫 번째 값을 70%, 두 전째 값을 30% 섞습니다. 
비슷하게 두 번째 중간 색상도 아래 두 픽셀값으로 계산됩니다. 
마지막으로, `t2`를 사용해 이 두개의 중간 색상값을 다시 섞으면 최종 색상이 됩니다.

중요한 또다른 점은 다이어그램 아래쪽에 있는 두 개의 샘플러 설정인 `addressModeU`와 
`addressModeV`입니다. 이 값들을 `repeat` 또는 
`clamp-to-edge`로 설정할 수 있습니다. [^mirror-repeat]
`repeat`로 설정하면 텍스처 좌표가 모서리 픽셀에 대해 바깥쪽으로 절반을 넘어가게 되면 반대쪽의 픽셀로 되돌아와 색상을 섞습니다. 
`clamp-to-edge`인 경우 텍스처 좌표가 clamp되어 모서리 픽셀 절반 밖으로 넘어가 계산될 수 없습니다. 
이렇게 되면 텍스처 좌표 범위 밖의 값에 대해서는 모서리 색상만이 보여집니다.

[^mirror-repeat]: 추가적으로 `mirror-repeat` 모드도 있습니다. 우리 텍스처가 "🟥🟩🟦"라면, repeat는 "🟥🟩🟦🟥🟩🟦🟥🟩🟦🟥🟩🟦"인데 mirror-repeat는 "🟥🟩🟦🟦🟩🟥🟥🟩🟦🟦🟩🟥"입니다.

예제를 수정하여 이런 모든 옵션을 사용해 사각형을 그려볼 수 있도록 하겠습니다.

먼저 각 설정값의 조합으로 샘플러들을 만듭니다. 
또한 이 샘플러를 사용하는 바인드그룹도 만듭니다.

```js
+  const bindGroups = [];
+  for (let i = 0; i < 8; ++i) {
-   const sampler = device.createSampler();
+   const sampler = device.createSampler({
+      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
+      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
+      magFilter: (i & 4) ? 'linear' : 'nearest',
+    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });
+    bindGroups.push(bindGroup);
+  }
```

아래과 같이 설정들을 만듭니다.

```js
  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
  };
```

그리고 렌더링 시에 설정값을 탐색해 어떤 바인드 그룹을 사용할지 결정합니다.

```js
  function render() {
+    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
+                (settings.addressModeV === 'repeat' ? 2 : 0) +
+                (settings.magFilter === 'linear' ? 4 : 0);
+    const bindGroup = bindGroups[ndx];
   ...
```

이제 남은 것은 이러한 설정을 바꿀 수 있는 UI를 만들고 값이 바뀔때 마다 다시 렌더링하는 것입니다. 
저는 "muigui"라는, [dat.GUI](https://github.com/dataarts/dat.gui)와 유사한 API를 갖는 라이브러리를 사용합니다.

```js
import GUI from '/3rdparty/muigui-0.x.module.js';

...

  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
  };

  const addressOptions = ['repeat', 'clamp-to-edge'];
  const filterOptions = ['nearest', 'linear'];

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  gui.add(settings, 'addressModeU', addressOptions).onChange(render);
  gui.add(settings, 'addressModeV', addressOptions).onChange(render);
  gui.add(settings, 'magFilter', filterOptions).onChange(render);
```

위 코드는 `settings`를 선언하고 이들을 설정하는 UI를 만든 후, 
값이 변경되는 경우에 `render`를 호출합니다.

{{{example url="../webgpu-simple-textured-quad-linear.html"}}}

우리 프래그먼트 셰이더는 보간된 텍스처 좌표를 받고 이를 바탕으로 
`textureSample`를 호출하기 때문에 각 픽셀에 대한 색상을 요청할 때 다른 섞인 색상이 반환될 수 있습니다. 
`repeat`모드일 때 WebGPU가 텍스처의 반대쪽에서 텍셀을 "샘플링"해 오는 것에 주목하세요.

## <a id="a-min-filter"></a>minFilter

`minFilter` 설정도 있는데 텍스처가 원래 크기보다 작게 그려질 때 `magFilter`와 비슷한 연산을 합니다. 
`linear`로 설정하면 마찬가지로 네 개의 픽셀을 선택하고 비슷한 수식을 통해 섞습니다.

문제는, 큰 텍스처로부터 네 개의 섞을 픽셀을 선택하여 예를들어 하나의 픽셀 
색상을 결정하려고 하면, 색상이 바뀌어 깜박임(flickering) 현상이 발생하게 됩니다.

직접 만들어서 문제를 살펴 봅시다.

먼저 캔버스를 저해상도로 만듭니다. 이를 위해서는 css를 수정해서 브라우저가 
우리의 캔버스에 대해 `magFilter: 'linear'`와 같은 처리를 하지 않도록 합니다. 
아래와 같이 css를 설정하면 됩니다.

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  image-rendering: pixelated;
+  image-rendering: crisp-edges;
}
```

다음으로 `ResizeObserver` 콜백에서 캔버스의 해상도를 낮춥니다.

```js
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
-      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
-      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
+      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
+      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // re-render
      render();
    }
  });
  observer.observe(canvas);
```

[uniforms에 관한 글](webgpu-uniforms.html)의 첫 번째 예제에서처럼 
사각형을 옮기고 크기를 조정할 수 있도록 하기 위해 uniform 버퍼를 추가합니다.

```wgsl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

+struct Uniforms {
+  scale: vec2f,
+  offset: vec2f,
+};
+
+@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    // 1st triangle
    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top

    // 2st triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
-  vsOutput.position = vec4f(xy, 0.0, 1.0);
+  vsOutput.position = vec4f(xy * uni.scale + uni.offset, 0.0, 1.0);
  vsOutput.texcoord = xy;
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

uniform이 추가되었으니 uniform 버퍼를 만들고 바인드 그룹에 추가합니다.

```js
+  // create a buffer for the uniform values
+  const uniformBufferSize =
+    2 * 4 + // scale is 2 32bit floats (4bytes each)
+    2 * 4;  // offset is 2 32bit floats (4bytes each)
+  const uniformBuffer = device.createBuffer({
+    label: 'uniforms for quad',
+    size: uniformBufferSize,
+    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
+  });
+
+  // create a typedarray to hold the values for the uniforms in JavaScript
+  const uniformValues = new Float32Array(uniformBufferSize / 4);
+
+  // offsets to the various uniform values in float32 indices
+  const kScaleOffset = 0;
+  const kOffsetOffset = 2;

  const bindGroups = [];
  for (let i = 0; i < 8; ++i) {
    const sampler = device.createSampler({
      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
      magFilter: (i & 4) ? 'linear' : 'nearest',
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
+        { binding: 2, resource: { buffer: uniformBuffer }},
      ],
    });
    bindGroups.push(bindGroup);
  }
```

uniform의 값을 설정하고 GPU에 업로드하는 코드도 추가해야 합니다. 
이 과정을 애니메이션할 예정이므로 `requestAnimationFrame`를 사용하도록 
코드를 수정하여 연속적인 렌더링이 이루어지도록 합니다.

```js
  function render(time) {
    time *= 0.001;
    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
                (settings.addressModeV === 'repeat' ? 2 : 0) +
                (settings.magFilter === 'linear' ? 4 : 0);
    const bindGroup = bindGroups[ndx];

+    // compute a scale that will draw our 0 to 1 clip space quad
+    // 2x2 pixels in the canvas.
+    const scaleX = 4 / canvas.width;
+    const scaleY = 4 / canvas.height;
+
+    uniformValues.set([scaleX, scaleY], kScaleOffset); // set the scale
+    uniformValues.set([Math.sin(time * 0.25) * 0.8, -0.8], kOffsetOffset); // set the offset
+
+    // copy the values from JavaScript to the GPU
+    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    ...

+    requestAnimationFrame(render);
  }
+  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
-      // re-render
-      render();
    }
  });
  observer.observe(canvas);
}
```

The code above sets the scale so that we'll draw the quad the size of 2x2 pixels in the canvas.
It also sets the offset from -0.8 to +0.8 using `Math.sin` so that the quad will
slowly go back and forth across the canvas.

Finally let's add `minFilter` to our settings and combinations

```js
  const bindGroups = [];
  for (let i = 0; i < 16; ++i) {
    const sampler = device.createSampler({
      addressModeU: (i & 1) ? 'repeat' : 'clamp-to-edge',
      addressModeV: (i & 2) ? 'repeat' : 'clamp-to-edge',
      magFilter: (i & 4) ? 'linear' : 'nearest',
+      minFilter: (i & 8) ? 'linear' : 'nearest',
    });

...

  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
+    minFilter: 'linear',
  };

  const addressOptions = ['repeat', 'clamp-to-edge'];
  const filterOptions = ['nearest', 'linear'];

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  -gui.add(settings, 'addressModeU', addressOptions).onChange(render);
  -gui.add(settings, 'addressModeV', addressOptions).onChange(render);
  -gui.add(settings, 'magFilter', filterOptions).onChange(render);
+  gui.add(settings, 'addressModeU', addressOptions);
+  gui.add(settings, 'addressModeV', addressOptions);
+  gui.add(settings, 'magFilter', filterOptions);
+  gui.add(settings, 'minFilter', filterOptions);

  function render(time) {
    time *= 0.001;
    const ndx = (settings.addressModeU === 'repeat' ? 1 : 0) +
                (settings.addressModeV === 'repeat' ? 2 : 0) +
-                (settings.magFilter === 'linear' ? 4 : 0);
+                (settings.magFilter === 'linear' ? 4 : 0) +
+                (settings.minFilter === 'linear' ? 8 : 0);
```

We no longer need to call `render` when a setting changes since we're
rendering constantly using `requestAnimationFrame` (often called "rAF"
and this style of rendering loop is often called a "rAF loop")

{{{example url="../webgpu-simple-textured-quad-minfilter.html"}}}

You can see the quad is flickering and changing colors. If the `minFilter`
is set to `nearest` then for each of the 2x2 pixels of the quad it's picking 
one pixel from our texture. If you set it to `linear` then it does the
bilinear filtering we mentioned above but it still flickers.

One reason is, the quad is positioned with real numbers but pixels are integers.
The texture coordinates are interpolated from the real numbers, or rather, they
are computed from the real numbers.

<a id="a-pixel-to-texcoords"></a>
<div class="webgpu-center center diagram">
  <div class="fit-container">
    <div class="text-align: center">drag to move</div>
    <div class="fit-container" data-diagram="pixel-to-texcoords" style="display: inline-block; width: 600px;"></div>
  </div>
</div>

In the diagram above, the <span style="color: red;">red</span> rectangle
represents the quad we asked the GPU to draw based on the values we return
from our vertex shader. When the GPU draws, it computes which pixels' centers
are inside our quad (our 2 triangles). Then, it computes what interpolated
inter-stage variable value to pass to the fragment shader based on where the
center of the pixel to be drawn is relative to the where the original points
are. In our fragment shader we then pass that texture coordinate to the WGSL
`textureSample` function and get back a sampled color as the previous diagram
showed. Hopefully you can see why the colors are flickering. You can see them
blend to different colors depending on which UV coordinates are computed for the
pixel being drawn.

Textures offer a solution to this problem. It's called mip-mapping. I think (but
could be wrong) that "mipmap" stands for "multi-image-pyramid-map".

We take our texture and create a smaller texture that is half the size in each
dimension, rounding down. We then fill the smaller texture with blended colors
from the first original texture. We repeat this until we get to a 1x1 texture.
In our example we have a 5x7 texel texture. Dividing by 2 in each dimension and
rounding down gives us a 2x3 texel texture. We take that one and repeat so we
end up with 1x1 texel texture.

<div class="webgpu-center center diagram"><div data-diagram="mips" style="display: inline-block;"></div></div>

Given a mipmap, we can then ask the GPU to choose a smaller mip level when we're
drawing something smaller than the original texture size. This will look better
because it has been "pre-blended" and better represents what the texture's color
would be when scaled down.

The best algorithm for blending the pixels from one mip to the next is a topic
of research as well as a matter of opinion. As a first idea, here's some code
that generates each mip from the previous mip by bilinear filtering (as
demonstrated above).

```js
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const bilinearFilter = (tl, tr, bl, br, t1, t2) => {
  const t = mix(tl, tr, t1);
  const b = mix(bl, br, t1);
  return mix(t, b, t2);
};

const createNextMipLevelRgba8Unorm = ({data: src, width: srcWidth, height: srcHeight}) => {
  // compute the size of the next mip
  const dstWidth = Math.max(1, srcWidth / 2 | 0);
  const dstHeight = Math.max(1, srcHeight / 2 | 0);
  const dst = new Uint8Array(dstWidth * dstHeight * 4);

  const getSrcPixel = (x, y) => {
    const offset = (y * srcWidth + x) * 4;
    return src.subarray(offset, offset + 4);
  };

  for (let y = 0; y < dstHeight; ++y) {
    for (let x = 0; x < dstWidth; ++x) {
      // compute texcoord of the center of the destination texel
      const u = (x + 0.5) / dstWidth;
      const v = (y + 0.5) / dstHeight;

      // compute the same texcoord in the source - 0.5 a pixel
      const au = (u * srcWidth - 0.5);
      const av = (v * srcHeight - 0.5);

      // compute the src top left texel coord (not texcoord)
      const tx = au | 0;
      const ty = av | 0;

      // compute the mix amounts between pixels
      const t1 = au % 1;
      const t2 = av % 1;

      // get the 4 pixels
      const tl = getSrcPixel(tx, ty);
      const tr = getSrcPixel(tx + 1, ty);
      const bl = getSrcPixel(tx, ty + 1);
      const br = getSrcPixel(tx + 1, ty + 1);

      // copy the "sampled" result into the dest.
      const dstOffset = (y * dstWidth + x) * 4;
      dst.set(bilinearFilter(tl, tr, bl, br, t1, t2), dstOffset);
    }
  }
  return { data: dst, width: dstWidth, height: dstHeight };
};

const generateMips = (src, srcWidth) => {
  const srcHeight = src.length / 4 / srcWidth;

  // populate with first mip level (base level)
  let mip = { data: src, width: srcWidth, height: srcHeight, };
  const mips = [mip];

  while (mip.width > 1 || mip.height > 1) {
    mip = createNextMipLevelRgba8Unorm(mip);
    mips.push(mip);
  }
  return mips;
};
```

We'll go over how to do this on the GPU in [another article](webgpu-importing-textures.html).
For now, we can use the code above to generate a mipmap.

We pass our texture data to the function above, and it returns an array of mip level data.
We can then create a texture with all the mip levels

```js
  const mips = generateMips(textureData, kTextureWidth);

  const texture = device.createTexture({
    label: 'yellow F on red',
+    size: [mips[0].width, mips[0].height],
+    mipLevelCount: mips.length,
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  mips.forEach(({data, width, height}, mipLevel) => {
    device.queue.writeTexture(
-      { texture },
-      textureData,
-      { bytesPerRow: kTextureWidth * 4 },
-      { width: kTextureWidth, height: kTextureHeight },
+      { texture, mipLevel },
+      data,
+      { bytesPerRow: width * 4 },
+      { width, height },
    );
  });
```

Notice we pass in `mipLevelCount` to the number of mip levels. WebGPU will then
create the correct sized mip level at each level. We then copy the data to each
level by specifying the `mipLevel`

Let's also add a scale setting so we can see the quad drawn at different sizes.

```js
  const settings = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
    minFilter: 'linear',
+    scale: 1,
  };

  ...

  const gui = new GUI();
  Object.assign(gui.domElement.style, {right: '', left: '15px'});
  gui.add(settings, 'addressModeU', addressOptions);
  gui.add(settings, 'addressModeV', addressOptions);
  gui.add(settings, 'magFilter', filterOptions);
  gui.add(settings, 'minFilter', filterOptions);
+  gui.add(settings, 'scale', 0.5, 6);

  function render(time) {

    ...

-    const scaleX = 4 / canvas.width;
-    const scaleY = 4 / canvas.height;
+    const scaleX = 4 / canvas.width * settings.scale;
+    const scaleY = 4 / canvas.height * settings.scale;

```

And with that the GPU is choosing the smallest mip to draw and the flickering is
gone.

{{{example url="../webgpu-simple-textured-quad-mipmap.html"}}}

Adjust the scale and you can see as we get bigger, which mip level is used
changes. There's a pretty harsh transition between scale 2.4 and scale 2.5
where the GPU switches between mip level 0 (the largest mip level) and
mip level 1 (the middle size). What to do about that?

## <a id="a-mipmap-filter"></a>mipmapFilter

Just like we have a `magFilter` and a `minFilter` both of which can be `nearest`
or `linear`, there is also a `mipmapFilter` setting which can also be `nearest`
or `linear`.

This chooses if we blend between mip levels. In `mipmapFilter: 'linear'`, colors
are sampled from 2 mip levels, either with nearest or linear filtering based on
the previous settings, then, those 2 colors are again `mix`ed in a similar way.

This comes up most when drawing things in 3D. How to draw in 3D is covered in
[other articles](webgpu-perspective.html) so I'm not going to cover that here
but we'll change our previous example to show some 3D so we can see better
how `mipmapFilter` works.

First let's make some textures. We'll make one 16x16 texture which I think will
better show `mipmapFilter`'s effect.

```js
  const createBlendedMipmap = () => {
    const w = [255, 255, 255, 255];
    const r = [255,   0,   0, 255];
    const b = [  0,  28, 116, 255];
    const y = [255, 231,   0, 255];
    const g = [ 58, 181,  75, 255];
    const a = [ 38, 123, 167, 255];
    const data = new Uint8Array([
      w, r, r, r, r, r, r, a, a, r, r, r, r, r, r, w,
      w, w, r, r, r, r, r, a, a, r, r, r, r, r, w, w,
      w, w, w, r, r, r, r, a, a, r, r, r, r, w, w, w,
      w, w, w, w, r, r, r, a, a, r, r, r, w, w, w, w,
      w, w, w, w, w, r, r, a, a, r, r, w, w, w, w, w,
      w, w, w, w, w, w, r, a, a, r, w, w, w, w, w, w,
      w, w, w, w, w, w, w, a, a, w, w, w, w, w, w, w,
      b, b, b, b, b, b, b, b, a, y, y, y, y, y, y, y,
      b, b, b, b, b, b, b, g, y, y, y, y, y, y, y, y,
      w, w, w, w, w, w, w, g, g, w, w, w, w, w, w, w,
      w, w, w, w, w, w, r, g, g, r, w, w, w, w, w, w,
      w, w, w, w, w, r, r, g, g, r, r, w, w, w, w, w,
      w, w, w, w, r, r, r, g, g, r, r, r, w, w, w, w,
      w, w, w, r, r, r, r, g, g, r, r, r, r, w, w, w,
      w, w, r, r, r, r, r, g, g, r, r, r, r, r, w, w,
      w, r, r, r, r, r, r, g, g, r, r, r, r, r, r, w,
    ].flat());
    return generateMips(data, 16);
  };
```

This will generate these mip levels

<div class="webgpu-center center diagram"><div data-diagram="blended-mips" style="display: inline-block;"></div></div>

We're free to put any data in each mip level so another good way to see what's happening
is to make each mip level different colors. Let's use the canvas 2d api to make mip levels.

```js
  const createCheckedMipmap = () => {
    const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
    const levels = [
      { size: 64, color: 'rgb(128,0,255)', },
      { size: 32, color: 'rgb(0,255,0)', },
      { size: 16, color: 'rgb(255,0,0)', },
      { size:  8, color: 'rgb(255,255,0)', },
      { size:  4, color: 'rgb(0,0,255)', },
      { size:  2, color: 'rgb(0,255,255)', },
      { size:  1, color: 'rgb(255,0,255)', },
    ];
    return levels.map(({size, color}, i) => {
      ctx.canvas.width = size;
      ctx.canvas.height = size;
      ctx.fillStyle = i & 1 ? '#000' : '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size / 2, size / 2);
      ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
      return ctx.getImageData(0, 0, size, size);
    });
  };
```

This code will generate these mip levels.

<div class="webgpu-center center diagram"><div data-diagram="checkered-mips" style="display: inline-block;"></div></div>

Now that we've created the data lets create the textures

```js
+  const createTextureWithMips = (mips, label) => {
    const texture = device.createTexture({
-      label: 'yellow F on red',
+      label,
      size: [mips[0].width, mips[0].height],
      mipLevelCount: mips.length,
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });
    mips.forEach(({data, width, height}, mipLevel) => {
      device.queue.writeTexture(
          { texture, mipLevel },
          data,
          { bytesPerRow: width * 4 },
          { width, height },
      );
    });
    return texture;
+  };

+  const textures = [
+    createTextureWithMips(createBlendedMipmap(), 'blended'),
+    createTextureWithMips(createCheckedMipmap(), 'checker'),
+  ];
```

We're going to draw a quad extending into the distance in 8 location. 
We'll use matrix math as covered in [the series of articles on 3D](webgpu-cameras.html).

```wsgl
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
-  scale: vec2f,
-  offset: vec2f,
+  matrix: mat4x4f,
};

@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(

    vec2f( 0.0,  0.0),  // center
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 0.0,  1.0),  // center, top

    // 2st triangle
    vec2f( 0.0,  1.0),  // center, top
    vec2f( 1.0,  0.0),  // right, center
    vec2f( 1.0,  1.0),  // right, top
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
-  vsOutput.position = vec4f(xy * uni.scale + uni.offset, 0.0, 1.0);
+  vsOutput.position = uni.matrix * vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy * vec2f(1, 50);
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
```

Each of the 8 planes will use different combinations of `minFilter`, `magFilter`
and `mipmapFilter`. That means each one needs a different bind group that
contains a sampler with that specific combination of filters. Further, we have 2
textures. Textures are part of the bind group as well so we'll need 2 bind
groups per object, one for each texture. We can then select which one to use
when we render. To draw the plane in 8 locations we'll also need one uniform
buffer per location like we covered in [the article on uniforms](webgpu-uniforms.html). 

```js
  // offsets to the various uniform values in float32 indices
  const kMatrixOffset = 0;

  const objectInfos = [];
  for (let i = 0; i < 8; ++i) {
    const sampler = device.createSampler({
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: (i & 1) ? 'linear' : 'nearest',
      minFilter: (i & 2) ? 'linear' : 'nearest',
      mipmapFilter: (i & 4) ? 'linear' : 'nearest',
    });

    // create a buffer for the uniform values
    const uniformBufferSize =
      16 * 4; // matrix is 16 32bit floats (4bytes each)
    const uniformBuffer = device.createBuffer({
      label: 'uniforms for quad',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // create a typedarray to hold the values for the uniforms in JavaScript
    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const matrix = uniformValues.subarray(kMatrixOffset, 16);

    const bindGroups = textures.map(texture =>
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer }},
        ],
      }));

    // Save the data we need to render this object.
    objectInfos.push({
      bindGroups,
      matrix,
      uniformValues,
      uniformBuffer,
    });
  }
```

At render time we [compute a viewProjection matrix](webgpu-cameras.html).

```js
  function render() {
    const fov = 60 * Math.PI / 180;  // 60 degrees in radians
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const zNear  = 1;
    const zFar   = 2000;
    const projectionMatrix = mat4.perspective(fov, aspect, zNear, zFar);

    const cameraPosition = [0, 0, 2];
    const up = [0, 1, 0];
    const target = [0, 0, 0];
    const cameraMatrix = mat4.lookAt(cameraPosition, target, up);
    const viewMatrix = mat4.inverse(cameraMatrix);
    const viewProjectionMatrix = mat4.multiply(projectionMatrix, viewMatrix);

    ...
```

Then for each plane, we select a bind group based on which texture we want to show
and compute a unique matrix to position that plane.

```js
  let texNdx = 0;

  function render() {
    ...

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);

    objectInfos.forEach(({bindGroups, matrix, uniformBuffer, uniformValues}, i) => {
      const bindGroup = bindGroups[texNdx];

      const xSpacing = 1.2;
      const ySpacing = 0.7;
      const zDepth = 50;

      const x = i % 4 - 1.5;
      const y = i < 4 ? 1 : -1;

      mat4.translate(viewProjectionMatrix, [x * xSpacing, y * ySpacing, -zDepth * 0.5], matrix);
      mat4.rotateX(matrix, 0.5 * Math.PI, matrix);
      mat4.scale(matrix, [1, zDepth * 2, 1], matrix);
      mat4.translate(matrix, [-0.5, -0.5, 0], matrix);

      // copy the values from JavaScript to the GPU
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(6);  // call our vertex shader 6 times
    });

    pass.end();
```

I removed the existing UI code, switched back from a rAF loop to rendering
in the `ResizeObserver` callback, and stopped making the resolution low.

```js
-  function render(time) {
-    time *= 0.001;
+  function render() {

    ...

-    requestAnimationFrame(render);
  }
-  requestAnimationFrame(render);

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
-      const width = entry.contentBoxSize[0].inlineSize / 64 | 0;
-      const height = entry.contentBoxSize[0].blockSize / 64 | 0;
+      const width = entry.contentBoxSize[0].inlineSize;
+      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
+      render();
    }
  });
  observer.observe(canvas);
```

Since we're no longer low-res we can get rid of the CSS that was preventing the browser
from filtering the canvas itself.

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
-  image-rendering: pixelated;
-  image-rendering: crisp-edges;
}
```

And we can make it so if you click the canvas it switches which texture to
draw with and re-renders

```js
  canvas.addEventListener('click', () => {
    texNdx = (texNdx + 1) % textures.length;
    render();
  });
```

{{{example url="../webgpu-simple-textured-quad-mipmapfilter.html"}}}

Hopefully you can see the progression from the top left with all filtering
set to `nearest` to the bottom right where all filtering is set to `linear`.
In particular, since we added `mipmapFilter` in this example, if you click
the image to show the checked texture where every mip level is a different
color, you should be able to see that every plane at the top has
`mipmapFilter` set to `nearest` so the point when switching from one mip level
to the next is abrupt. On the bottom, each plane has `mipmapFilter` set to
`linear` so blending happens between the mip levels.

You might wonder, why not always set all filtering to `linear`? The obvious
reason is style. If you're trying to make a pixelated looking image then
of course you might not want filtering. Another is speed. Reading 1 pixel
from a texture when all filtering is set to nearest is faster then reading
8 pixels from a texture when all filtering is set to linear.

TBD: Repeat

TBD: Anisotropic filtering

## Texture Types and Texture Views

Until this point we've only used 2d textures. There are 3 types of textures

* "1d"
* "2d"
* "3d"

In some way you can *kind of* consider a "2d" texture just a "3d" texture with a
depth of 1. And a "1d" texture is just a "2d" texture with a height of 1. Two
actual differences, textures are limited in their maximum allowed dimensions. The
limit is different for each type of texture "1d", "2d", and "3d". We've used the
"2d" limit when setting the size of the canvas.

```js
canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
```

Another is speed, at least for a 3d texture vs a 2d texture, with all the
sampler filters set to `linear`, sampling a 3d texture would require looking at
16 texels and blending them all together. Sampling a 2d texture only needs 8
texels. It's possible a 1d texture only needs 4 but I have no idea if any GPUs
actually optimize for 1d textures.

### Texture Views

There are 6 types of texture views

* "1d"
* "2d"
* "2d-array"
* "3d"
* "cube"
* "cube-array"

"1d" textures can only have a "1d" view. "3d" textures can only have a "3d" view.
"2d" texture can have a "2d-array" view. If a "2d" texture has 6 layers it can
have a "cube" view. If it has a multiple of 6 layers it can have a "cube-array"
view. You can choose how to view a texture when you call `someTexture.createView`.
Texture views default to the same as their dimension but you can pass a different
dimension to `someTexture.createView`.

We'll cover "3d" textures [in the article on tone mapping / 3dLUTs](webgpu-3dluts.html)

A "cube" texture is a texture that represents the 6 faces of a cube. Cube textures
are often used to draw sky boxes and for reflections and environment maps. We'll cover
that in [the article on cube maps](webgpu-cube-maps.html)

A "2d-array" is an array of 2d textures. You can then choose which texture of
the array to access in your shader. They are commonly used for terrain rendering
among other things.

A "cube-array" is an array of cube textures.

Each type of texture has its own corresponding type in WGSL.

<div class="webgpu_center data-table" style="max-width: 500px;">
  <style>
    .texture-type {
      text-align: left;
      font-size: large;
      line-height: 1.5em;
    }
    .texture-type td:nth-child(1) {
      white-space: nowrap;
    }
  </style>
  <table class="texture-type">
   <thead>
    <tr>
     <th>type</th>
     <th>WGSL types</th>
    </tr>
   </thead>
   <tbody>
    <tr><td>"1d"</td><td><code>texture_1d</code> or <code>texture_storage_1d</code></td></tr>
    <tr><td>"2d"</td><td><code>texture_2d</code> or <code>texture_storage_2d</code> or <code>texture_multisampled_2d</code> as well as a special case for in certain situations <code>texture_depth_2d</code> and <code>texture_depth_multisampled_2d</code></td></tr>
    <tr><td>"2d-array"</td><td><code>texture_2d_array</code> or <code>texture_storage_2d_array</code> and sometimes <code>texture_depth_2d_array</code></td></tr>
    <tr><td>"3d"</td><td><code>texture_3d</code> or <code>texture_storage_3d</code></td></tr>
    <tr><td>"cube"</td><td><code>texture_cube</code> and sometimes <code>texture_depth_cube</code></td></tr>
    <tr><td>"cube-array"</td><td><code>texture_cube_array</code> and sometimes <code>texture_depth_cube_array</code></td></tr>
   </tbody>
  </table>
</div>

We'll cover some of this in actual use but, it can be a little confusing that
when creating a texture (calling `device.createTexture`), there is only "1d",
"2d", or "3d" as options and the default is "2d" so we have not had to specify
the dimensions yet.

## Texture Formats

For now, this is the basics of textures.
Textures are a huge topic and there's a bunch more to cover.

We've used `rgba8unorm` textures through out this article but there are
a ton of different texture formats.

Here are the "color" formats though of course you don't have to store colors in them.

<div class="webgpu_center data-table"><div data-diagram="color-texture-formats"></div></div>

To read a format, like "rg16float". the first letters are the channels supported
in the texture so "rg16float" supports "rg" or red and green (2 channels). The
number, 16, means those channels are 16bits each. The word at the end is what
kind of data is in the channel. "float" is floating point data.

"unorm" is unsigned normalized data (0 to 1) meaning the data in the texture
goes from 0 to N where N is the maximum integer value for that number of bits.
That range of integers is then interpreted as a floating point range of (0 to
1). In other words, for an 8unorm texture, that's 8 bits (so values from 0 to
255) that get interpreted as values from (0 to 1).

"snorm" is signed normalized data (-1 to +1) so the range of data goes from the
most negative integer represented by the number of bits to the most positive.For
example 8snorm is 8bits. As a signed integer the lowest number would be -128 and
the highest is +127. That range gets converted to (-1 to +1).

"sint" is signed integers. "uint" is unsigned integer. If there are multiple
letter number combinations it's specifying the number of bits for each channel.
For example "rg11b10ufloat" is "rg11" so 11bits each of red and green. "b10" so
10bits of blue and they are all unsigned floating point numbers.

* **renderable**

  True means you can render to it (set its usage to `GPUTextureUsage.RENDER_ATTACHMENT`)

* **multisample**

  Can be [multisampled](webgpu-multisampling.html)

* **storage**

  Can be written to as a [storage texture](webgpu-storage-textures.html)

* **sampler type**

  This has implications for what type of texture you need to declare it in WGSL
  and how you bind a sampler to a bind group. Above we used `texture_2d<f32>`
  but for example, `sint` would need `texture_2d<i32>` and `uint` would need
  `texture_2d<u32>` in WGSL.

  In the sampler type column, `unfilterable-float` means your sampler can only
  use `nearest` for that format and it means you may have to manually
  create a bind group layout, something we haven't done before as we've been
  using `'auto'` layout. This mostly exists because desktop GPU can generally
  filter 32bit floating point textures but, at least as of 2023, most mobile
  devices can not. If your adaptor supports the `float32-filterable`
  [feature](webgpu-limits-and-features.html) and you enable it when requesting a
  device then the formats `r32float`, `rg32float`, and `rgba32float` switch from
  `unfilterable-float` to `float` and these textures formats will work with no
  other changes.

<a id="a-depth-stencil-formats"></a>And here are the depth and stencil formats

<div class="webgpu_center data-table"><div data-diagram="depth-stencil-texture-formats"></div></div>

* **feature**

  means this [*optional* feature](webgpu-limits-and-features.html) is required to use this format.

* **copy src**

  Whether you're allowed to specify `GPUTextureUsage.COPY_SRC`

* **copy dst**

  Whether you're allowed to specify `GPUTextureUsage.COPY_DST`

We'll use a depth texture in [an article in the series on 3d](webgpu-orthographic-projection.html) as well
as [the article about shadow maps](webgpu-shadow-maps.html).

There's also a bunch compressed texture formats which we'll save for another article.

Let's cover [importing external textures](webgpu-importing-textures.html) next.

<!-- keep this at the bottom of the article -->
<script type="module" src="/3rdparty/pixel-perfect.js"></script>
<script type="module" src="webgpu-textures.js"></script>
