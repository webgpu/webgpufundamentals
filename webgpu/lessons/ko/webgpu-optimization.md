Title: WebGPU 속도와 최적화
Description: WebGPU에서 더 빠르게 실행하는 방법
TOC: 속도와 최적화

이 사이트의 대부분의 예제는 가능한 한 이해하기 쉽게 작성되었습니다. 
즉, 작동하고 정확하지만 WebGPU에서 무언가를 수행하는 가장 효율적인 방법을 
반드시 보여주는 것은 아닙니다. 또한 수행해야 하는 작업에 따라 수많은 최적화 
방법이 있습니다.

이 글에서는 가장 기본적인 최적화 방법을 다루고 몇 가지 다른 방법에 대해 
논의할 것입니다. 분명히 말하자면, 제 생각에는 **일반적으로 이 정도까지 할 
필요는 없습니다. WebGPU를 사용하는 대부분의 예제는 수백 개의 물체를 그리므로 
이러한 최적화의 이점을 실제로 얻지 못할 것입니다**. 그래도 더 빠르게 만드는 
방법을 아는 것은 항상 좋습니다.

기본 원칙: **수행하는 작업이 적을수록, WebGPU에 요청하는 작업이 적을수록 
더 빠르게 실행됩니다.**

지금까지의 거의 모든 예제에서 여러 도형을 그릴 때 다음 단계를 수행했습니다.

* 초기화 시:
   * 그리려는 각 물체에 대해
      * 유니폼 버퍼 생성
      * 해당 버퍼를 참조하는 bindGroup 생성

* 렌더링 시:
   * 인코더와 렌더 패스 시작
   * 그리려는 각 물체에 대해
      * 이 객체의 유니폼 값으로 타입 배열 업데이트
      * 타입 배열을 이 객체의 유니폼 버퍼로 복사
      * 필요한 경우 파이프라인, 정점 및 인덱스 버퍼 설정
      * 이 객체의 bindGroup(s)을 바인딩하는 명령 인코딩
      * 그리기 명령 인코딩
   * 렌더 패스 종료, 인코더 완료, 커맨드 버퍼 제출

위의 단계를 따르는 최적화할 수 있는 예제를 만들어 보겠습니다.

참고로, 이것은 가짜 예제입니다. 우리는 단지 많은 큐브를 그릴 것이고, 
따라서 [스토리지 버퍼](webgpu-storage-buffers.html#a-instancing)와 
[정점 버퍼](webgpu-vertex-buffers.html#a-instancing)에 관한 글에서 
다룬 *인스턴싱*을 사용하여 최적화할 수 있습니다. 다양한 종류의 객체를 
처리하는 코드로 복잡하게 만들고 싶지 않았습니다. 인스턴싱은 프로젝트에서 
동일한 모델을 많이 사용하는 경우 확실히 훌륭한 최적화 방법입니다. 
식물, 나무, 바위, 쓰레기 등은 종종 인스턴싱을 사용하여 최적화됩니다. 
다른 모델의 경우 덜 일반적입니다.

예를 들어 테이블 주위에 4개, 6개 또는 8개의 의자가 있을 수 있으며 
인스턴싱을 사용하여 해당 의자를 그리는 것이 더 빠를 것입니다. 
하지만 그릴 것이 500개 이상인 목록에서 의자만 예외인 경우 어떻게든 
의자를 인스턴싱을 사용하도록 구성하지만 다른 상황에서는 인스턴싱을 
사용하지 않는 최적의 데이터 구성을 찾아내는 노력은 아마도 가치가 없을 것입니다.

위 단락의 요점은 적절한 경우 인스턴싱을 사용하라는 것입니다. 동일한 것을 
수백 개 이상 그릴 경우 인스턴싱이 적절할 것입니다. 동일한 것을 몇 개만 
그릴 경우 그 몇 가지를 특별히 처리하는 노력은 아마도 가치가 없을 것입니다.

어쨌든, 코드가 있습니다. 일반적으로 사용해 온 초기화 코드입니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter({
    powerPreference: 'high-performance',
  });
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }

  // 캔버스에서 WebGPU 컨텍스트를 가져와 설정합니다
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
```

다음으로 셰이더 모듈을 만들어 보겠습니다.

```js
  const module = device.createShaderModule({
    code: /* wgsl */ `
      struct Uniforms {
        normalMatrix: mat3x3f,
        viewProjection: mat4x4f,
        world: mat4x4f,
        color: vec4f,
        lightWorldPosition: vec3f,
        viewWorldPosition: vec3f,
        shininess: f32,
      };

      struct Vertex {
        @location(0) position: vec4f,
        @location(1) normal: vec3f,
        @location(2) texcoord: vec2f,
      };

      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) normal: vec3f,
        @location(1) surfaceToLight: vec3f,
        @location(2) surfaceToView: vec3f,
        @location(3) texcoord: vec2f,
      };

      @group(0) @binding(0) var diffuseTexture: texture_2d<f32>;
      @group(0) @binding(1) var diffuseSampler: sampler;
      @group(0) @binding(2) var<uniform> uni: Uniforms;

      @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
        vsOut.position = uni.viewProjection * uni.world * vert.position;

        // 노멀을 변환하고 프래그먼트 셰이더로 전달
        vsOut.normal = uni.normalMatrix * vert.normal;

        // 표면의 월드 위치 계산
        let surfaceWorldPosition = (uni.world * vert.position).xyz;

        // 표면에서 광원으로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
        vsOut.surfaceToLight = uni.lightWorldPosition - surfaceWorldPosition;

        // 표면에서 뷰로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
        vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;

        // 텍스처 좌표를 프래그먼트 셰이더로 전달
        vsOut.texcoord = vert.texcoord;

        return vsOut;
      }

      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        // vsOut.normal은 스테이지 간 변수이므로
        // 보간되어 단위 벡터가 아닙니다.
        // 정규화하면 다시 단위 벡터가 됩니다
        let normal = normalize(vsOut.normal);

        let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
        let surfaceToViewDirection = normalize(vsOut.surfaceToView);
        let halfVector = normalize(
          surfaceToLightDirection + surfaceToViewDirection);

        // 노멀과 광원 방향의 내적으로
        // 조명을 계산합니다
        let light = dot(normal, surfaceToLightDirection);

        var specular = dot(normal, halfVector);
        specular = select(
            0.0,                           // 조건이 거짓일 때 값
            pow(specular, uni.shininess),  // 조건이 참일 때 값
            specular > 0.0);               // 조건

        let diffuse = uni.color * textureSample(diffuseTexture, diffuseSampler, vsOut.texcoord);
        // 알파가 아닌 색상 부분만
        // 조명 계산
        let color = diffuse.rgb * light + specular;
        return vec4f(color, diffuse.a);
      }
    `,
  });
```

이 셰이더 모듈은 [다른 곳에서 다룬 스피큘러 하이라이트가 있는 점 광원](webgpu-lighting-point.html#a-specular)과 
유사한 조명을 사용합니다. 대부분의 3D 모델은 텍스처를 사용하므로 텍스처를 포함하는 것이 
가장 좋다고 생각했습니다. 각 큐브의 색상을 조정할 수 있도록 텍스처에 색상을 곱합니다. 
그리고 조명 계산과 [큐브를 3D로 투영](webgpu-perspective-projection.html)하는 데 
필요한 모든 유니폼 값이 있습니다.

큐브에 대한 데이터가 필요하고 해당 데이터를 버퍼에 넣어야 합니다.

```js
  function createBufferWithData(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
  const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
  const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

  const positionBuffer = createBufferWithData(device, positions, GPUBufferUsage.VERTEX);
  const normalBuffer = createBufferWithData(device, normals, GPUBufferUsage.VERTEX);
  const texcoordBuffer = createBufferWithData(device, texcoords, GPUBufferUsage.VERTEX);
  const indicesBuffer = createBufferWithData(device, indices, GPUBufferUsage.INDEX);
  const numVertices = indices.length;
```

렌더 파이프라인이 필요합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'textured model with point light w/specular highlight',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        // 위치
        {
          arrayStride: 3 * 4, // 3개의 float
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},
          ],
        },
        // 노멀
        {
          arrayStride: 3 * 4, // 3개의 float
          attributes: [
            {shaderLocation: 1, offset: 0, format: 'float32x3'},
          ],
        },
        // uv
        {
          arrayStride: 2 * 4, // 2개의 float
          attributes: [
            {shaderLocation: 2, offset: 0, format: 'float32x2'},
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });
```

위의 파이프라인은 각 어트리뷰트 마다 1개의 버퍼를 사용합니다. 위치 데이터용 하나, 
노멀 데이터용 하나, 텍스처 좌표(UV)용 하나입니다. 후면 제거를 수행하고, 
깊이 테스트를 위한 깊이 텍스처를 받도록 설정합니다. 모두 다른 글에서 다룬 내용입니다.

색상과 난수를 만드는 몇 가지 유틸리티를 삽입해 보겠습니다.

```js
/** CSS 색상 문자열이 주어지면 0에서 255 사이의 4개 값 배열을 반환 */
const cssColorToRGBA8 = (() => {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  return cssColor => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  };
})();

/** CSS 색상 문자열이 주어지면 0에서 1 사이의 4개 값 배열을 반환 */
const cssColorToRGBA = cssColor => cssColorToRGBA8(cssColor).map(v => v / 255);

/**
 * 0에서 1 사이의 색조, 채도, 명도 값이 주어지면
 * 해당하는 CSS hsl 문자열을 반환
 */
const hsl = (h, s, l) => `hsl(${h * 360 | 0}, ${s * 100}%, ${l * 100 | 0}%)`;

/**
 * 0에서 1 사이의 색조, 채도, 명도 값이 주어지면
 * 0에서 1 사이의 4개 값 배열을 반환
 */
const hslToRGBA = (h, s, l) => cssColorToRGBA(hsl(h, s, l));

/**
 * min과 max 사이의 난수를 반환합니다.
 * min과 max가 지정되지 않으면 0에서 1 사이를 반환
 * max가 지정되지 않으면 0에서 min 사이를 반환
 */
function rand(min, max) {
  if (min === undefined) {
    max = 1;
    min = 0;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.random() * (max - min) + min;
}

/** 배열에서 무작위 요소를 선택 */
const randomArrayElement = arr => arr[Math.random() * arr.length | 0];
```

모두 매우 간단합니다.

이제 몇 가지 텍스처와 샘플러를 만들어 보겠습니다. 캔버스를 사용하고 
이모지를 그린 다음 [텍스처 로딩에 관한 글](webgpu-importing-textures.html)에서 
작성한 `createTextureFromSource` 함수를 사용하여 텍스처를 만듭니다.

```js
  const textures = [
    '😂', '👾', '👍', '👀', '🌞', '🛟',
  ].map(s => {
    const size = 128;
    const ctx = new OffscreenCanvas(size, size).getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${size * 0.9}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const m = ctx.measureText(s);
    ctx.fillText(
      s,
      (size - m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 2,
      (size - m.actualBoundingBoxDescent + m.actualBoundingBoxAscent) / 2
    );
    return createTextureFromSource(device, ctx.canvas, {mips: true});
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'nearest',
  });
```

머티리얼(material) 정보 세트를 만들어 보겠습니다. 다른 곳에서는 이렇게 하지 않았지만 
일반적인 설정입니다. Unity, Unreal, Blender, Three.js, Babylon.js 모두 
*머티리얼* 개념을 가지고 있습니다. 일반적으로 머티리얼은 물체의 색상, 
광택, 사용할 텍스처 등의 정보를 포함합니다.

20개의 "머티리얼"을 만든 다음 각 큐브에 대해 무작위로 머티리얼을 선택합니다.

```js
  const numMaterials = 20;
  const materials = [];
  for (let i = 0; i < numMaterials; ++i) {
    const color = hslToRGBA(rand(), rand(0.5, 0.8), rand(0.5, 0.7));
    const shininess = rand(10, 120);
    materials.push({
      color,
      shininess,
      texture: randomArrayElement(textures),
      sampler,
    });
  }
```

이제 그리려는 각각의 객체(큐브)에 대한 데이터를 만들어 보겠습니다. 최대 30000개를 
지원합니다. 이전에 해오던 것처럼, 각 객체에 대해 유니폼 버퍼를 하나씩 만들고 유니폼 값으로 
업데이트할 수 있는 타입 배열을 만듭니다. 또한 각 객체에 대해 바인드 그룹을 
만듭니다. 그리고 각 객체를 배치하고 애니메이션하는 데 사용할 수 있는 무작위 
값을 선택합니다.

```js
  const maxObjects = 30000;
  const objectInfos = [];

  for (let i = 0; i < maxObjects; ++i) {
    const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
    const kNormalMatrixOffset = 0;
    const kViewProjectionOffset = 12;
    const kWorldOffset = 28;
    const kColorOffset = 44;
    const kLightWorldPositionOffset = 48;
    const kViewWorldPositionOffset = 52;
    const kShininessOffset = 55;

    const normalMatrixValue = uniformValues.subarray(
        kNormalMatrixOffset, kNormalMatrixOffset + 12);
    const viewProjectionValue = uniformValues.subarray(
        kViewProjectionOffset, kViewProjectionOffset + 16);
    const worldValue = uniformValues.subarray(
        kWorldOffset, kWorldOffset + 16);
    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
    const lightWorldPositionValue = uniformValues.subarray(
        kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
    const viewWorldPositionValue = uniformValues.subarray(
        kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
    const shininessValue = uniformValues.subarray(
        kShininessOffset, kShininessOffset + 1);

    const material = randomArrayElement(materials);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: material.texture.createView() },
        { binding: 1, resource: material.sampler },
        { binding: 2, resource: { buffer: uniformBuffer }},
      ],
    });

    const axis = vec3.normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const radius = rand(10, 100);
    const speed = rand(0.1, 0.4);
    const rotationSpeed = rand(-1, 1);
    const scale = rand(2, 10);

    objectInfos.push({
      bindGroup,

      uniformBuffer,
      uniformValues,

      normalMatrixValue,
      worldValue,
      viewProjectionValue,
      colorValue,
      lightWorldPositionValue,
      viewWorldPositionValue,
      shininessValue,

      axis,
      material,
      radius,
      speed,
      rotationSpeed,
      scale,
    });
  }
```

렌더 패스 디스크립터를 미리 만듭니다. 렌더링 시작 할때, 그 값을 일부 업데이트 할 것입니다.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- 렌더링 할때 채워야함
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      // view: <- 렌더링 할때 채워야함
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };
```

그릴 객체의 수를 조정할 수 있도록 간단한 UI가 필요합니다.

```js
  const settings = {
    numObjects: 1000,
  };

  const gui = new GUI();
  gui.add(settings, 'numObjects', { min: 0, max: maxObjects, step: 1});
```

이제 렌더 루프를 작성할 수 있습니다.

```js
  let depthTexture;
  let then = 0;

  function render(time) {
    time *= 0.001;  // 초 단위로 변환
    const deltaTime = time - then;
    then = time;


    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

렌더 루프 내부에서 렌더 패스 디스크립터를 업데이트합니다. 또한 깊이 텍스처가 
없거나 가지고 있는 것이 캔버스 텍스처와 크기가 다른 경우 깊이 텍스처를 만듭니다. 
[3D에 관한 글](webgpu-orthographic-projection.html#a-depth-textures)에서 이렇게 했습니다.

```js
    // 캔버스 컨텍스트에서 현재 텍스처를 가져와
    // 렌더링할 텍스처로 설정합니다.
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

    // 깊이 텍스처가 없거나 크기가 canvasTexture와 다르면
    // 새 깊이 텍스처를 만듭니다
    if (!depthTexture ||
        depthTexture.width !== canvasTexture.width ||
        depthTexture.height !== canvasTexture.height) {
      if (depthTexture) {
        depthTexture.destroy();
      }
      depthTexture = device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();
```

커맨드 버퍼와 렌더 패스를 시작하고 정점 및 인덱스 버퍼를 설정합니다.

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, positionBuffer);
    pass.setVertexBuffer(1, normalBuffer);
    pass.setVertexBuffer(2, texcoordBuffer);
    pass.setIndexBuffer(indicesBuffer, 'uint16');
```

그런 다음 [원근 투영에 관한 글](webgpu-perspective-projection.html)에서 
다룬 것처럼 viewProjection 행렬을 계산합니다.

```js
+  const degToRad = d => d * Math.PI / 180;

  function render(time) {
    ...

+    const aspect = canvas.clientWidth / canvas.clientHeight;
+    const projection = mat4.perspective(
+        degToRad(60),
+        aspect,
+        1,      // zNear
+        2000,   // zFar
+    );
+
+    const eye = [100, 150, 200];
+    const target = [0, 0, 0];
+    const up = [0, 1, 0];
+
+    // 뷰 행렬 계산
+    const viewMatrix = mat4.lookAt(eye, target, up);
+
+    // 뷰 행렬과 투영 행렬 결합
+    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

이제 모든 객체를 반복하여 그릴 수 있습니다. 각 객체에 대해 모든 유니폼 값을 
업데이트하고, 유니폼 값을 유니폼 버퍼에 복사하고, 이 객체의 바인드 그룹을 
바인딩하고, 그립니다.

```js
    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
        uniformBuffer,
        uniformValues,
        normalMatrixValue,
        worldValue,
        viewProjectionValue,
        colorValue,
        lightWorldPositionValue,
        viewWorldPositionValue,
        shininessValue,

        axis,
        material,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];

      // 이 객체의 유니폼 값에 viewProjectionMatrix 복사
      viewProjectionValue.set(viewProjectionMatrix);

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

      const {color, shininess} = material;

      // 머티리얼 값 복사
      colorValue.set(color);
      lightWorldPositionValue.set([-10, 30, 300]);
      viewWorldPositionValue.set(eye);
      shininessValue[0] = shininess;

      // 유니폼 값을 유니폼 버퍼에 업로드
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }
```

> "월드 행렬 계산"이라고 표시된 코드 부분은 그다지 일반적이지 않습니다. 
[씬 그래프](webgpu-scene-graphs.html)를 사용하는 것이 더 일반적이지만 
그것을 쓰면 예제가 더 복잡해집니다. 애니메이션을 보여줄 목적으로 이런 코드를 만들었습니다.

그런 다음 패스를 종료하고 커맨드 버퍼를 완료하고 제출합니다.

```js
+    pass.end();
+
+    const commandBuffer = encoder.finish();
+    device.queue.submit([commandBuffer]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

몇 가지 더 해야 할 일이 남았습니다. 크기 조정을 추가해 보겠습니다.

```js
+  const canvasToSizeMap = new WeakMap();

  function render(time) {
    time *= 0.001;  // 초 단위로 변환
    const deltaTime = time - then;
    then = time;

+    const {width, height} = canvasToSizeMap.get(canvas) ?? canvas;
+
+    // 이미 해당 크기인 경우 캔버스 크기를 설정하지 않습니다. 느릴 수 있기 때문입니다.
+    if (canvas.width !== width || canvas.height !== height) {
+      canvas.width = width;
+      canvas.height = height;
+    }

    // 캔버스 컨텍스트에서 현재 텍스처를 가져와
    // 렌더링할 텍스처로 설정합니다.
    const canvasTexture = context.getCurrentTexture();
    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();

    ...

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

+  const observer = new ResizeObserver(entries => {
+    entries.forEach(entry => {
+      canvasToSizeMap.set(entry.target, {
+        width: Math.max(1, Math.min(entry.contentBoxSize[0].inlineSize, device.limits.maxTextureDimension2D)),
+        height: Math.max(1, Math.min(entry.contentBoxSize[0].blockSize, device.limits.maxTextureDimension2D)),
+      });
+    });
+  });
+  observer.observe(canvas);
```

타이밍도 추가해 보겠습니다. [타이밍에 관한 글](webgpu-timing.html)에서 
만든 `NonNegativeRollingAverage`와 `TimingHelper` 클래스를 사용합니다.

```js
// see https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
import TimingHelper from './resources/js/timing-helper.js';
// see https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
import NonNegativeRollingAverage from './resources/js/non-negative-rolling-average.js';

const fpsAverage = new NonNegativeRollingAverage();
const jsAverage = new NonNegativeRollingAverage();
const gpuAverage = new NonNegativeRollingAverage();
const mathAverage = new NonNegativeRollingAverage();
```

그런 다음 렌더링 코드의 시작부터 끝까지 JavaScript 시간을 측정합니다.

```js
  function render(time) {
    ...

+    const startTimeMs = performance.now();

    ...

+    const elapsedTimeMs = performance.now() - startTimeMs;
+    jsAverage.addSample(elapsedTimeMs);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

3D 수학 연산을 수행하는 JavaScript 부분의 시간을 측정합니다.

```js
  function render(time) {
    ...

+    let mathElapsedTimeMs = 0;

    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
        uniformBuffer,
        uniformValues,
        normalMatrixValue,
        worldValue,
        viewProjectionValue,
        colorValue,
        lightWorldPositionValue,
        viewWorldPositionValue,
        shininessValue,

        axis,
        material,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];
+      const mathTimeStartMs = performance.now();

      // 이 객체의 유니폼 값에 viewProjectionMatrix 복사
      viewProjectionValue.set(viewProjectionMatrix);

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

      const {color, shininess} = material;

      colorValue.set(color);
      lightWorldPositionValue.set([-10, 30, 300]);
      viewWorldPositionValue.set(eye);
      shininessValue[0] = shininess;

+      mathElapsedTimeMs += performance.now() - mathTimeStartMs;

      // 유니폼 값을 유니폼 버퍼에 업로드
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }

    ...

    const elapsedTimeMs = performance.now() - startTimeMs;
    jsAverage.addSample(elapsedTimeMs);
+    mathAverage.addSample(mathElapsedTimeMs);


    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

`requestAnimationFrame` 콜백 사이의 시간을 측정합니다.

```js
  let depthTexture;
  let then = 0;

  function render(time) {
    time *= 0.001;  // 초 단위로 변환
    const deltaTime = time - then;
    then = time;

    ...

    const elapsedTimeMs = performance.now() - startTimeMs;
+    fpsAverage.addSample(1 / deltaTime);
    jsAverage.addSample(elapsedTimeMs);
    mathAverage.addSample(mathElapsedTimeMs);


    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

그리고 렌더 패스의 시간을 측정합니다.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter({
    powerPreference: 'high-performance',
  });
-  const device = await adapter?.requestDevice();
+  const canTimestamp = adapter.features.has('timestamp-query');
+  const device = await adapter?.requestDevice({
+    requiredFeatures: [
+      ...(canTimestamp ? ['timestamp-query'] : []),
+     ],
+  });
  if (!device) {
    fail('could not init WebGPU');
  }

+  const timingHelper = new TimingHelper(device);

  ...

  function render(time) {
    ...

-    const pass = encoder.beginRenderPass(renderPassEncoder);
+    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);

    ...

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    timingHelper.getResult().then(gpuTime => {
+      gpuAverage.addSample(gpuTime / 1000);
+    });

    ...

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

그리고 타이밍을 표시해야 합니다.

```js
async function main() {
  ...

  const timingHelper = new TimingHelper(device);
+  const infoElem = document.querySelector('#info');

  ...

  function render(time) {
    ...

    timingHelper.getResult().then(gpuTime => {
      gpuAverage.addSample(gpuTime / 1000);
    });

    const elapsedTimeMs = performance.now() - startTimeMs;
    fpsAverage.addSample(1 / deltaTime);
    jsAverage.addSample(elapsedTimeMs);
    mathAverage.addSample(mathElapsedTimeMs);

+    infoElem.textContent = `\
+js  : ${jsAverage.get().toFixed(1)}ms
+math: ${mathAverage.get().toFixed(1)}ms
+fps : ${fpsAverage.get().toFixed(0)}
+gpu : ${canTimestamp ? `${(gpuAverage.get() / 1000).toFixed(1)}ms` : 'N/A'}
+`;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
```

비교에 도움이 되는 것이 한가지 더 있습니다. 지금 우리의 문제는 
보이는 모든 큐브가 모든 픽셀을 렌더링하거나 최소한 렌더링해야 하는지 
확인한다는 것입니다. 픽셀 렌더링을 최적화하는 것이 아니라 WebGPU 자체의 
사용을 최적화하고 있으므로 1x1 픽셀 캔버스에 그릴 수 있으면 유용할 수 
있습니다. 이렇게 하면 삼각형을 래스터화하는 데 소요되는 거의 모든 시간이 
제거되고 수학 연산과 WebGPU와 통신하는 코드 부분만 남습니다.

그렇게 할 수 있는 옵션을 추가해 보겠습니다.

```js
  const settings = {
    numObjects: 1000,
+    render: true,
  };

  const gui = new GUI();
  gui.add(settings, 'numObjects', { min: 0, max: maxObjects, step: 1});
+  gui.add(settings, 'render');

  let depthTexture;
  let then = 0;
  let frameCount = 0;

  function render(time) {
    time *= 0.001;  // 초 단위로 변환
    const deltaTime = time - then;
    then = time;
    ++frameCount;

    const startTimeMs = performance.now();

-    const {width, height} = canvasToSizeMap.get(canvas) ?? canvas;
+    const {width, height} = settings.render
+       ? canvasToSizeMap.get(canvas) ?? canvas
+       : { width: 1, height: 1 };
```

이제 'render'를 체크 해제하면 거의 모든 렌더링이 제거됩니다.

그리고 이것으로 첫 번째 "최적화되지 않은" 예제가 완성되었습니다. 
이 글의 시작 부분에서 나열했던 단계들을 따르고 있으며 작동합니다.

{{{example url="../webgpu-optimization-none.html"}}}

객체 수를 늘려가면서 프레임 속도가 언제 떨어지는지 확인해보세요. 
제 경우 M1 Mac의 75hz 모니터에서 큐브 약 8000개부터 프레임 속도가 떨어지기 시작합니다.

# <a id="a-mapped-on-creation"></a> 최적화: 생성 시 매핑

위의 예제와 이 사이트의 대부분의 예제에서 `writeBuffer`를 사용하여 
데이터를 정점 또는 인덱스 버퍼에 복사했습니다. 이 특정 경우에 대한 
매우 사소한 최적화로, 버퍼를 만들 때 `mappedAtCreation: true`를 
전달할 수 있습니다. 이것은 2가지 이점이 있습니다.

1. 새 버퍼에 데이터를 넣는 것이 약간 더 빠릅니다.

2. 버퍼에 `GPUBufferUsage.COPY_DST` 플래그를 추가할 필요가 없습니다.

   이것은 나중에 `writeBuffer`나 버퍼로 복사하는 함수를 통해 
   데이터를 변경하지 않을 것이라고 가정합니다.

```js
  function createBufferWithData(device, data, usage) {
    const buffer = device.createBuffer({
      size: data.byteLength,
-      usage: usage | GPUBufferUsage.COPY_DST,
+      usage: usage,
+      mappedAtCreation: true,
    });
-    device.queue.writeBuffer(buffer, 0, data);
+    const dst = new Uint8Array(buffer.getMappedRange());
+    dst.set(new Uint8Array(data.buffer));
+    buffer.unmap();
    return buffer;
  }
```

이 최적화는 생성 시에만 도움이 되므로 렌더 시간의 성능에는 영향을 
미치지 않습니다.

# <a id="a-pack-verts"></a> 최적화: 정점 패킹 및 인터리빙(Interleaving)

위의 예제에는 3개의 속성이 있습니다. 위치, 노멀, 텍스처 좌표입니다. [노멀 매핑을 위한 탄젠트](webgpu-normal-mapping.html)가 
있고 [스킨 모델](webgpu-skinning.html)이 있는 경우 가중치와 조인트를 
추가해서 4~6개의 속성을 갖는 것이 일반적입니다.

위의 예제에서 각 속성은 자체 버퍼를 사용합니다. 이것은 CPU와 GPU 
모두에서 느립니다. JavaScript의 CPU에서 느린 이유는 그리려는 각 모델의 
각 버퍼에 대해 `setVertexBuffer`를 호출해야 하기 때문입니다.

큐브 대신 100개의 모델이 있다고 상상해 보세요. 그릴 모델을 전환할 때마다 
`setVertexBuffer`를 최대 6번 호출해야 합니다. 모델당 6 호출 * 100개 모델 = 600 호출.

"작업이 적음 = 더 빠름" 규칙에 따라 속성의 데이터를 단일 버퍼로 
병합하면 모델당 한 번만 `setVertexBuffer`를 호출하면 됩니다. 100 호출. 600% 더 빠릅니다!

GPU에서는 메모리 상의 가까운 위치에 모여있는 것을 로드하는 것이
먼 위치에서 로드하는 것보다 빠르므로 단일 모델의 정점 데이터를 
단일 버퍼에 넣는 것 외에도 데이터를 인터리빙하는 것이 좋습니다.

역자 주: 인터리빙(interleaving)이란 데이터를 합칠때 서로 사이사이에 끼워넣는 방식을 의미합니다. 예를 들어 12345 와 ABCDE 를 합쳐서 1A2B3C4D5E 를 만드는 것.

그 변경을 해보겠습니다.

```js
-  const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
-  const normals   = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
-  const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
+  const vertexData = new Float32Array([
+  // 위치            노멀           텍스처좌표
+     1,  1, -1,     1,  0,  0,    1, 0,
+     1,  1,  1,     1,  0,  0,    0, 0,
+     1, -1,  1,     1,  0,  0,    0, 1,
+     1, -1, -1,     1,  0,  0,    1, 1,
+    -1,  1,  1,    -1,  0,  0,    1, 0,
+    -1,  1, -1,    -1,  0,  0,    0, 0,
+    -1, -1, -1,    -1,  0,  0,    0, 1,
+    -1, -1,  1,    -1,  0,  0,    1, 1,
+    -1,  1,  1,     0,  1,  0,    1, 0,
+     1,  1,  1,     0,  1,  0,    0, 0,
+     1,  1, -1,     0,  1,  0,    0, 1,
+    -1,  1, -1,     0,  1,  0,    1, 1,
+    -1, -1, -1,     0, -1,  0,    1, 0,
+     1, -1, -1,     0, -1,  0,    0, 0,
+     1, -1,  1,     0, -1,  0,    0, 1,
+    -1, -1,  1,     0, -1,  0,    1, 1,
+     1,  1,  1,     0,  0,  1,    1, 0,
+    -1,  1,  1,     0,  0,  1,    0, 0,
+    -1, -1,  1,     0,  0,  1,    0, 1,
+     1, -1,  1,     0,  0,  1,    1, 1,
+    -1,  1, -1,     0,  0, -1,    1, 0,
+     1,  1, -1,     0,  0, -1,    0, 0,
+     1, -1, -1,     0,  0, -1,    0, 1,
+    -1, -1, -1,     0,  0, -1,    1, 1,
+  ]);
  const indices   = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);

-  const positionBuffer = createBufferWithData(device, positions, GPUBufferUsage.VERTEX);
-  const normalBuffer = createBufferWithData(device, normals, GPUBufferUsage.VERTEX);
-  const texcoordBuffer = createBufferWithData(device, texcoords, GPUBufferUsage.VERTEX);
+  const vertexBuffer = createBufferWithData(device, vertexData, GPUBufferUsage.VERTEX);
  const indicesBuffer = createBufferWithData(device, indices, GPUBufferUsage.INDEX);
  const numVertices = indices.length;

  const pipeline = device.createRenderPipeline({
    label: 'textured model with point light w/specular highlight',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
-        // 위치
-        {
-          arrayStride: 3 * 4, // 3 floats
-          attributes: [
-            {shaderLocation: 0, offset: 0, format: 'float32x3'},
-          ],
-        },
-        // 노멀
-        {
-          arrayStride: 3 * 4, // 3 floats
-          attributes: [
-            {shaderLocation: 1, offset: 0, format: 'float32x3'},
-          ],
-        },
-        // uv
-        {
-          arrayStride: 2 * 4, // 2 floats
-          attributes: [
-            {shaderLocation: 2, offset: 0, format: 'float32x2'},
-          ],
-        },
+        {
+          arrayStride: (3 + 3 + 2) * 4, // 8개의 float
+          attributes: [
+            {shaderLocation: 0, offset: 0 * 4, format: 'float32x3'}, // 위치
+            {shaderLocation: 1, offset: 3 * 4, format: 'float32x3'}, // 노멀
+            {shaderLocation: 2, offset: 6 * 4, format: 'float32x2'}, // 텍스처좌표
+          ],
+        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });

  ...
-    pass.setVertexBuffer(0, positionBuffer);
-    pass.setVertexBuffer(1, normalBuffer);
-    pass.setVertexBuffer(2, texcoordBuffer);
+    pass.setVertexBuffer(0, vertexBuffer);
```

위에서 3개의 속성에 대한 데이터를 모두 단일 버퍼에 넣은 다음 
데이터가 단일 버퍼로 인터리빙될 것으로 예상하도록 렌더 패스를 변경했습니다.

참고: gLTF 파일을 로드하는 경우, 정점 데이터가 단일 버퍼로 인터리빙되도록 
사전 처리하는 것이 최선이고, 그 다음으로는 로드 시에 데이터를 인터리빙하는 것이 좋습니다.

# 최적화: 유니폼 버퍼 분할 (공유, 머티리얼, 모델별)

현재 예제에는 객체당 하나의 유니폼 버퍼가 있습니다.

```wgsl
struct Uniforms {
  normalMatrix: mat3x3f,
  viewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
  shininess: f32,
};
```

`viewProjection`, `lightWorldPosition`, `viewWorldPosition`과 같은 
일부 유니폼 값은 공유할 수 있습니다.

셰이더에서 이것들을 분할하여 두 개의 유니폼 버퍼를 사용할 수 있습니다.
공유하는 값을 위한 것과, *객체별 값*을 위한 것.


```wgsl
struct GlobalUniforms {
  viewProjection: mat4x4f,
  lightWorldPosition: vec3f,
  viewWorldPosition: vec3f,
};
struct PerObjectUniforms {
  normalMatrix: mat3x3f,
  world: mat4x4f,
  color: vec4f,
  shininess: f32,
};
```

이 변경으로 `viewProjection`, `lightWorldPosition`, `viewWorldPosition`을 
모든 유니폼 버퍼에 복사할 필요가 없게 됩니다. 또한 `device.queue.writeBuffer`로 
객체당 더 적은 데이터를 복사하게 됩니다.

새로운 셰이더는 다음과 같습니다:

```js
  const module = device.createShaderModule({
    code: /* wgsl */ `
-      struct Uniforms {
-        normalMatrix: mat3x3f,
-        viewProjection: mat4x4f,
-        world: mat4x4f,
-        color: vec4f,
-        lightWorldPosition: vec3f,
-        viewWorldPosition: vec3f,
-        shininess: f32,
-      };

+      struct GlobalUniforms {
+        viewProjection: mat4x4f,
+        lightWorldPosition: vec3f,
+        viewWorldPosition: vec3f,
+      };
+      struct PerObjectUniforms {
+        normalMatrix: mat3x3f,
+        world: mat4x4f,
+        color: vec4f,
+        shininess: f32,
+      };

      struct Vertex {
        @location(0) position: vec4f,
        @location(1) normal: vec3f,
        @location(2) texcoord: vec2f,
      };

      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) normal: vec3f,
        @location(1) surfaceToLight: vec3f,
        @location(2) surfaceToView: vec3f,
        @location(3) texcoord: vec2f,
      };

      @group(0) @binding(0) var diffuseTexture: texture_2d<f32>;
      @group(0) @binding(1) var diffuseSampler: sampler;
-      @group(0) @binding(2) var<uniform> uni: Uniforms;
+      @group(0) @binding(2) var<uniform> obj: PerObjectUniforms;
+      @group(0) @binding(3) var<uniform> glb: GlobalUniforms;

      @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
-        vsOut.position = uni.viewProjection * uni.world * vert.position;
+        vsOut.position = glb.viewProjection * obj.world * vert.position;

        // 노멀을 변환하고 프래그먼트 셰이더로 전달
-        vsOut.normal = uni.normalMatrix * vert.normal;
+        vsOut.normal = obj.normalMatrix * vert.normal;

        // 표면의 월드 위치 계산
-        let surfaceWorldPosition = (uni.world * vert.position).xyz;
+        let surfaceWorldPosition = (obj.world * vert.position).xyz;

        // 표면에서 광원으로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
-        vsOut.surfaceToLight = uni.lightWorldPosition - surfaceWorldPosition;
+        vsOut.surfaceToLight = glb.lightWorldPosition - surfaceWorldPosition;

        // 표면에서 뷰로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
-        vsOut.surfaceToView = uni.viewWorldPosition - surfaceWorldPosition;
+        vsOut.surfaceToView = glb.viewWorldPosition - surfaceWorldPosition;

        // 텍스처 좌표를 프래그먼트 셰이더로 전달
        vsOut.texcoord = vert.texcoord;

        return vsOut;
      }

      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        // vsOut.normal은 스테이지 간 변수이므로
        // 보간되어 단위 벡터가 아닙니다.
        // 정규화하면 다시 단위 벡터가 됩니다
        let normal = normalize(vsOut.normal);

        let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
        let surfaceToViewDirection = normalize(vsOut.surfaceToView);
        let halfVector = normalize(
          surfaceToLightDirection + surfaceToViewDirection);

        // 노멀과 광원 방향의 내적으로
        // 조명을 계산합니다
        let light = dot(normal, surfaceToLightDirection);

        var specular = dot(normal, halfVector);
        specular = select(
            0.0,                           // 조건이 거짓일 때 값
-            pow(specular, uni.shininess),  // 조건이 참일 때 값
+            pow(specular, obj.shininess),  // 조건이 참일 때 값
            specular > 0.0);               // 조건

-        let diffuse = uni.color * textureSample(diffuseTexture, diffuseSampler, vsOut.texcoord);
+        let diffuse = obj.color * textureSample(diffuseTexture, diffuseSampler, vsOut.texcoord);
        // 알파가 아닌 색상 부분만
        // 조명 계산
        let color = diffuse.rgb * light + specular;
        return vec4f(color, diffuse.a);
      }
    `,
  });
```

전역 유니폼을 위한 하나의 전역 유니폼 버퍼를 만들어야 합니다.

```js
  const globalUniformBufferSize = (16 + 4 + 4) * 4;
  const globalUniformBuffer = device.createBuffer({
    label: 'global uniforms',
    size: globalUniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const globalUniformValues = new Float32Array(globalUniformBufferSize / 4);

  const kViewProjectionOffset = 0;
  const kLightWorldPositionOffset = 16;
  const kViewWorldPositionOffset = 20;

  const viewProjectionValue = globalUniformValues.subarray(
      kViewProjectionOffset, kViewProjectionOffset + 16);
  const lightWorldPositionValue = globalUniformValues.subarray(
      kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
  const viewWorldPositionValue = globalUniformValues.subarray(
      kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
```

그런 다음 객체별 유니폼 버퍼에서 이러한 유니폼을 제거하고 
각 객체의 바인드 그룹에 전역 유니폼 버퍼를 추가할 수 있습니다.

```js
  const maxObjects = 30000;
  const objectInfos = [];

  for (let i = 0; i < maxObjects; ++i) {
-    const uniformBufferSize = (12 + 16 + 16 + 4 + 4 + 4) * 4;
+    const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
    const kNormalMatrixOffset = 0;
-    const kViewProjectionOffset = 12;
-    const kWorldOffset = 28;
-    const kColorOffset = 44;
-    const kLightWorldPositionOffset = 48;
-    const kViewWorldPositionOffset = 52;
-    const kShininessOffset = 55;
+    const kWorldOffset = 12;
+    const kColorOffset = 28;
+    const kShininessOffset = 32;

    const normalMatrixValue = uniformValues.subarray(
        kNormalMatrixOffset, kNormalMatrixOffset + 12);
-    const viewProjectionValue = uniformValues.subarray(
-        kViewProjectionOffset, kViewProjectionOffset + 16);
    const worldValue = uniformValues.subarray(
        kWorldOffset, kWorldOffset + 16);
    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-    const lightWorldPositionValue = uniformValues.subarray(
-        kLightWorldPositionOffset, kLightWorldPositionOffset + 3);
-    const viewWorldPositionValue = uniformValues.subarray(
-        kViewWorldPositionOffset, kViewWorldPositionOffset + 3);
    const shininessValue = uniformValues.subarray(
        kShininessOffset, kShininessOffset + 1);

    const material = randomArrayElement(materials);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: material.texture.createView() },
        { binding: 1, resource: material.sampler },
        { binding: 2, resource: { buffer: uniformBuffer }},
+        { binding: 3, resource: { buffer: globalUniformBuffer }},
      ],
    });

    const axis = vec3.normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const radius = rand(10, 100);
    const speed = rand(0.1, 0.4);
    const rotationSpeed = rand(-1, 1);
    const scale = rand(2, 10);

    objectInfos.push({
      bindGroup,

      uniformBuffer,
      uniformValues,

      normalMatrixValue,
      worldValue,
-      viewProjectionValue,
      colorValue,
-      lightWorldPositionValue,
-      viewWorldPositionValue,
      shininessValue,
      material,

      axis,
      radius,
      speed,
      rotationSpeed,
      scale,
    });
  }
```

그런 다음 렌더 시간에 객체 렌더링 루프 외부에서 전역 유니폼 버퍼를 
한 번만 업데이트합니다.

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    // 뷰 행렬 계산
    const viewMatrix = mat4.lookAt(eye, target, up);

    // 뷰 행렬과 투영 행렬 결합
-    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
+    mat4.multiply(projection, viewMatrix, viewProjectionValue);
+
+    lightWorldPositionValue.set([-10, 30, 300]);
+    viewWorldPositionValue.set(eye);
+
+    device.queue.writeBuffer(globalUniformBuffer, 0, globalUniformValues);

    let mathElapsedTimeMs = 0;

    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
        uniformBuffer,
        uniformValues,
        normalMatrixValue,
        worldValue,
-        viewProjectionValue,
        colorValue,
-        lightWorldPositionValue,
-        viewWorldPositionValue,
        shininessValue,

        axis,
        material,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];
      const mathTimeStartMs = performance.now();

-      // 이 객체의 유니폼 값에 viewProjectionMatrix 복사
-      viewProjectionValue.set(viewProjectionMatrix);

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

      const {color, shininess} = material;
      colorValue.set(color);
-      lightWorldPositionValue.set([-10, 30, 300]);
-      viewWorldPositionValue.set(eye);
      shininessValue[0] = shininess;

      mathElapsedTimeMs += performance.now() - mathTimeStartMs;

      // 유니폼 값을 유니폼 버퍼에 업로드
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }

    pass.end();
```

이것은 WebGPU 호출 횟수를 줄이지 않습니다. 실제로는 한번 더 호출합니다.
하지만 모델당 수행하던 많은 작업을 줄였습니다.

{{{example url="../webgpu-optimization-step3-global-vs-per-object-uniforms.html"}}}

제 컴퓨터에서는 이 변경으로 수학 부분이 약 16% 감소했습니다.

# 최적화: 더 많은 유니폼 분리

3D 라이브러리의 일반적인 구성은 "모델"(정점 데이터), "머티리얼"(색상, 광택, 텍스처), 
"조명"(사용할 조명), "viewInfo"(뷰 및 투영 행렬)를 갖는 것입니다. 특히 우리 예제에서 
`color`와 `shininess`는 절대 변경되지 않으므로 매 프레임마다 유니폼 버퍼에 
복사하는 것은 낭비입니다.

머티리얼당 유니폼 버퍼를 만들어 보겠습니다. 초기화 시 머티리얼 설정을 
복사한 다음 바인드 그룹에 추가하기만 하면 됩니다.

먼저 다른 유니폼 버퍼를 사용하도록 셰이더를 변경해 보겠습니다.

```js
  const module = device.createShaderModule({
    code: /* wgsl */ `
      struct GlobalUniforms {
        viewProjection: mat4x4f,
        lightWorldPosition: vec3f,
        viewWorldPosition: vec3f,
      };

+      struct MaterialUniforms {
+        color: vec4f,
+        shininess: f32,
+      };

      struct PerObjectUniforms {
        normalMatrix: mat3x3f,
        world: mat4x4f,
-        color: vec4f,
-        shininess: f32,
      };

      struct Vertex {
        @location(0) position: vec4f,
        @location(1) normal: vec3f,
        @location(2) texcoord: vec2f,
      };

      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) normal: vec3f,
        @location(1) surfaceToLight: vec3f,
        @location(2) surfaceToView: vec3f,
        @location(3) texcoord: vec2f,
      };

      @group(0) @binding(0) var diffuseTexture: texture_2d<f32>;
      @group(0) @binding(1) var diffuseSampler: sampler;
      @group(0) @binding(2) var<uniform> obj: PerObjectUniforms;
      @group(0) @binding(3) var<uniform> glb: GlobalUniforms;
+      @group(0) @binding(4) var<uniform> material: MaterialUniforms;

      @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
        vsOut.position = glb.viewProjection * obj.world * vert.position;

        // 노멀을 변환하고 프래그먼트 셰이더로 전달
        vsOut.normal = obj.normalMatrix * vert.normal;

        // 표면의 월드 위치 계산
        let surfaceWorldPosition = (obj.world * vert.position).xyz;

        // 표면에서 광원으로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
        vsOut.surfaceToLight = glb.lightWorldPosition - surfaceWorldPosition;

        // 표면에서 뷰로의 벡터를 계산하고
        // 프래그먼트 셰이더로 전달
        vsOut.surfaceToView = glb.viewWorldPosition - surfaceWorldPosition;

        // 텍스처 좌표를 프래그먼트 셰이더로 전달
        vsOut.texcoord = vert.texcoord;

        return vsOut;
      }

      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        // vsOut.normal은 스테이지 간 변수이므로
        // 보간되어 단위 벡터가 아닙니다.
        // 정규화하면 다시 단위 벡터가 됩니다
        let normal = normalize(vsOut.normal);

        let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
        let surfaceToViewDirection = normalize(vsOut.surfaceToView);
        let halfVector = normalize(
          surfaceToLightDirection + surfaceToViewDirection);

        // 노멀과 광원 방향의 내적으로
        // 조명을 계산합니다
        let light = dot(normal, surfaceToLightDirection);

        var specular = dot(normal, halfVector);
        specular = select(
            0.0,                           // 조건이 거짓일 때의 값
            pow(specular, material.shininess),  // 조건이 참일 때의 값
            specular > 0.0);               // 조건

        let diffuse = material.color * textureSample(diffuseTexture, diffuseSampler, vsOut.texcoord);
        // 알파가 아닌 색상 부분만
        // 조명 계산
        let color = diffuse.rgb * light + specular;
        return vec4f(color, diffuse.a);
      }
    `,
  });
```

그런 다음 각 머티리얼에 대한 유니폼 버퍼를 만듭니다.

```js
  const numMaterials = 20;
  const materials = [];
  for (let i = 0; i < numMaterials; ++i) {
    const color = hslToRGBA(rand(), rand(0.5, 0.8), rand(0.5, 0.7));
    const shininess = rand(10, 120);

+    const materialValues = new Float32Array([
+      ...color,
+      shininess,
+      0, 0, 0,  // 패딩
+    ]);
+    const materialUniformBuffer = createBufferWithData(
+      device,
+      materialValues,
+      GPUBufferUsage.UNIFORM,
+    );

    materials.push({
-      color,
-      shininess,
+      materialUniformBuffer,
      texture: randomArrayElement(textures),
      sampler,
    });
  }
```

객체별 정보를 설정할 때 더 이상 머티리얼 설정을 전달할 필요가 없습니다. 
대신 머티리얼의 유니폼 버퍼를 객체의 바인드 그룹에 추가하기만 하면 됩니다.

```js
  const maxObjects = 30000;
  const objectInfos = [];

  for (let i = 0; i < maxObjects; ++i) {
-    const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
+    const uniformBufferSize = (12 + 16) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);

    // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
    const kNormalMatrixOffset = 0;
    const kWorldOffset = 12;
-    const kColorOffset = 28;
-    const kShininessOffset = 32;

    const normalMatrixValue = uniformValues.subarray(
        kNormalMatrixOffset, kNormalMatrixOffset + 12);
    const worldValue = uniformValues.subarray(
        kWorldOffset, kWorldOffset + 16);
-    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
-    const shininessValue = uniformValues.subarray(
-        kShininessOffset, kShininessOffset + 1);

    const material = randomArrayElement(materials);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: material.texture.createView() },
        { binding: 1, resource: material.sampler },
        { binding: 2, resource: { buffer: uniformBuffer }},
        { binding: 3, resource: { buffer: globalUniformBuffer }},
+        { binding: 4, resource: { buffer: material.materialUniformBuffer }},
      ],
    });

    const axis = vec3.normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const radius = rand(10, 100);
    const speed = rand(0.1, 0.4);
    const rotationSpeed = rand(-1, 1);
    const scale = rand(2, 10);

    objectInfos.push({
      bindGroup,

      uniformBuffer,
      uniformValues,

      normalMatrixValue,
      worldValue,
-      colorValue,
-      shininessValue,

      axis,
-      material,
      radius,
      speed,
      rotationSpeed,
      scale,
    });
  }
```

또한 렌더 시점에 이것들을 처리할 필요가 없습니다.

```js
    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
        uniformBuffer,
        uniformValues,
        normalMatrixValue,
        worldValue,
-        colorValue,
-        shininessValue,

        axis,
-        material,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];
      const mathTimeStartMs = performance.now();

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

-      const {color, shininess} = material;
-      colorValue.set(color);
-      shininessValue[0] = shininess;

      mathElapsedTimeMs += performance.now() - mathTimeStartMs;

      // 유니폼 값을 유니폼 버퍼에 업로드
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }
```

{{{example url="../webgpu-optimization-step4-material-uniforms.html"}}}

# 최적화: 버퍼 오프셋을 사용하는 하나의 큰 유니폼 버퍼 사용

지금 각 객체는 자체 유니폼 버퍼를 가지고 있습니다. 렌더 시간에 각 객체에 대해 
해당 객체의 유니폼 값으로 타입 배열을 업데이트한 다음 `device.queue.writeBuffer`를 
호출하여 단일 유니폼 버퍼의 값을 업데이트합니다. 8000개의 객체를 렌더링하는 경우 
`device.queue.writeBuffer`에 대한 8000번의 호출이 있습니다.

대신 하나의 더 큰 유니폼 버퍼를 만들 수 있습니다. 그런 다음 각 객체의 바인드 그룹을 
설정하여 더 큰 버퍼의 자체 부분을 사용하도록 할 수 있습니다. 렌더 시간에 하나의 
큰 타입 배열에서 모든 객체에 대한 모든 값을 업데이트하고 `device.queue.writeBuffer`를 
한 번만 호출할 수 있으며 이것이 더 빠를 것입니다.

먼저 큰 유니폼 버퍼와 큰 타입 배열을 할당해 보겠습니다. 유니폼 버퍼 오프셋에는 
기본적으로 256바이트인 최소 정렬이 있으므로 객체당 필요한 크기를 256바이트 단위로 
올림합니다.

```js
+/** v를 alignment의 배수로 올림 */
+const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;

  ...

+  const uniformBufferSize = (12 + 16) * 4;
+  const uniformBufferSpace = roundUp(uniformBufferSize, device.limits.minUniformBufferOffsetAlignment);
+  const uniformBuffer = device.createBuffer({
+    label: 'uniforms',
+    size: uniformBufferSpace * maxObjects,
+    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
+  });
+  const uniformValues = new Float32Array(uniformBuffer.size / 4);
```

이제 객체별 뷰를 해당 큰 타입 배열을 바라보도록 변경할 수 있습니다. 
또한 바인드 그룹이 큰 유니폼 버퍼의 올바른 부분을 사용하도록 설정할 수 있습니다.

```js
  for (let i = 0; i < maxObjects; ++i) {
+    const uniformBufferOffset = i * uniformBufferSpace;
+    const f32Offset = uniformBufferOffset / 4;

    // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
    const kNormalMatrixOffset = 0;
    const kWorldOffset = 12;

-    const normalMatrixValue = uniformValues.subarray(
-        kNormalMatrixOffset, kNormalMatrixOffset + 12);
-    const worldValue = uniformValues.subarray(
-        kWorldOffset, kWorldOffset + 16);
+    const normalMatrixValue = uniformValues.subarray(
+        f32Offset + kNormalMatrixOffset, f32Offset + kNormalMatrixOffset + 12);
+    const worldValue = uniformValues.subarray(
+        f32Offset + kWorldOffset, f32Offset + kWorldOffset + 16);

    const material = randomArrayElement(materials);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: material.texture.createView() },
        { binding: 1, resource: material.sampler },
-        { binding: 2, resource: { buffer: uniformBuffer }},
+        {
+          binding: 2,
+          resource: {
+            buffer: uniformBuffer,
+            offset: uniformBufferOffset,
+            size: uniformBufferSize,
+          },
+        },
        { binding: 3, resource: { buffer: globalUniformBuffer }},
        { binding: 4, resource: { buffer: material.materialUniformBuffer }},
      ],
    });

    const axis = vec3.normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const radius = rand(10, 100);
    const speed = rand(0.1, 0.4);
    const rotationSpeed = rand(-1, 1);
    const scale = rand(2, 10);

    objectInfos.push({
      bindGroup,

-      uniformBuffer,
-      uniformValues,

      normalMatrixValue,
      worldValue,

      axis,
      radius,
      speed,
      rotationSpeed,
      scale,
    });
  }
```

렌더 시점에 모든 객체 값을 업데이트한 다음 `device.queue.writeBuffer`를 
한 번만 호출합니다.

```js
    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
-        uniformBuffer,
-        uniformValues,
        normalMatrixValue,
        worldValue,

        axis,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];
      const mathTimeStartMs = performance.now();

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

      mathElapsedTimeMs += performance.now() - mathTimeStartMs;

-      // 유니폼 값을 유니폼 버퍼에 업로드
-      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }

+    // 모든 유니폼 값을 유니폼 버퍼에 업로드
+    if (settings.numObjects) {
+      const size = (settings.numObjects - 1) * uniformBufferSpace + uniformBufferSize;
+      device.queue.writeBuffer( uniformBuffer, 0, uniformValues, 0, size / uniformValues.BYTES_PER_ELEMENT);
+    }

    pass.end();
```

{{{example url="../webgpu-optimization-step5-use-buffer-offsets.html"}}}

제 컴퓨터에서는 JavaScript 시간이 40% 줄었습니다!

# 최적화: 매핑된 버퍼 사용

`device.queue.writeBuffer`를 호출하면 WebGPU는 타입 배열의 데이터를 복사합니다. 
해당 데이터를 GPU 프로세스(보안을 위해 GPU와 통신하는 별도의 프로세스)로 복사합니다. 
GPU 프로세스에서 해당 데이터는 GPU 버퍼로 복사됩니다.

매핑된 버퍼를 사용하여 이러한 복사 중 하나를 건너뛸 수 있습니다. 버퍼를 매핑하고 
유니폼 값을 해당 매핑된 버퍼에 직접 업데이트합니다. 그런 다음 버퍼를 언맵하고 
`copyBufferToBuffer` 명령을 발행하여 유니폼 버퍼로 복사합니다. 이렇게 하면 복사가 
하나 절약됩니다.

WebGPU 매핑은 비동기적으로 발생하므로 버퍼를 매핑하고 준비될 때까지 기다리는 대신 
이미 매핑된 버퍼의 배열을 유지합니다. 각 프레임마다 이미 매핑된 버퍼를 가져오거나 
이미 매핑된 새 버퍼를 만듭니다. 렌더링한 후 버퍼를 사용할 수 있을 때 매핑하도록 
콜백을 설정하고 이미 매핑된 버퍼 목록에 다시 넣습니다. 이렇게 하면 매핑된 버퍼를 
기다릴 필요가 없습니다.

먼저 매핑된 버퍼의 배열과 사전 매핑된 버퍼를 가져오거나 새 버퍼를 만드는 함수를 
만듭니다.

```js
  const mappedTransferBuffers = [];
  const getMappedTransferBuffer = () => {
    return mappedTransferBuffers.pop() || device.createBuffer({
      label: 'transfer buffer',
      size: uniformBufferSpace * maxObjects,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
  };
```

버퍼를 매핑하면 새로운 `ArrayBuffer`가 얻어지므로 더 이상 타입 배열 뷰를 
미리 만들어 둘수 없습니다. 따라서 매핑 후 새 타입 배열 뷰를 만들어야 합니다.

```js
+  // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
+  const kNormalMatrixOffset = 0;
+  const kWorldOffset = 12;

  for (let i = 0; i < maxObjects; ++i) {
    const uniformBufferOffset = i * uniformBufferSpace;
-    const f32Offset = uniformBufferOffset / 4;
-
-    // float32 인덱스에서 다양한 유니폼 값에 대한 오프셋
-    const kNormalMatrixOffset = 0;
-    const kWorldOffset = 12;
-
-    const normalMatrixValue = uniformValues.subarray(
-        f32Offset + kNormalMatrixOffset, f32Offset + kNormalMatrixOffset + 12);
-    const worldValue = uniformValues.subarray(
-        f32Offset + kWorldOffset, f32Offset + kWorldOffset + 16);
-    const material = randomArrayElement(materials);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: material.texture.createView() },
        { binding: 1, resource: material.sampler },
        { binding: 2, resource: { buffer: uniformBuffer, offset: uniformBufferOffset, size: uniformBufferSize }},
        { binding: 3, resource: { buffer: globalUniformBuffer }},
        { binding: 4, resource: { buffer: material.materialUniformBuffer }},
      ],
    });

    const axis = vec3.normalize([rand(-1, 1), rand(-1, 1), rand(-1, 1)]);
    const radius = rand(10, 100);
    const speed = rand(0.1, 0.4);
    const rotationSpeed = rand(-1, 1);
    const scale = rand(2, 10);

    objectInfos.push({
      bindGroup,

-      normalMatrixValue,
-      worldValue,

      axis,
      radius,
      speed,
      rotationSpeed,
      scale,
    });
  }
```

렌더 시점에 객체들을 반복(순회)하기 *전에* 전송 버퍼를 유니폼 버퍼로 복사하는 명령을 
인코딩합니다. 이는 `copyBufferToBuffer` 명령이 `GPUCommandEncoder`의 명령이기 
때문입니다. 객체가 렌더링되기 전에 실행되어야 합니다. 우리는 객체를 순회하면서 렌더 패스 
명령을 인코딩하여 렌더링하고 있습니다. 이전에는 타입 배열을 업데이트한 후 
`device.queue.writeBuffer`를 호출했었고, 이는 당연하게도 가장 먼저 실행되었습니다.
아직 `submit`을 호출하지 않았기 때문이죠.
하지만 이번 경우 복사는 실제로 명령이므로 그리기 명령 전에 인코딩해야 합니다. 이것은 괜찮습니다.
왜냐하면 여기서 복사는 단지 명령일 뿐이고 커맨드 버퍼를 제출할 때까지 실행되지 않으므로
복사가 아직 발생하지 않았기 때문에 여전히 전송 버퍼를 업데이트할 수 있습니다.

```js
    const encoder = device.createCommandEncoder();
-    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);
-    pass.setPipeline(pipeline);
-    pass.setVertexBuffer(0, vertexBuffer);
-    pass.setIndexBuffer(indicesBuffer, 'uint16');

    ...

    let mathElapsedTimeMs = 0;

+    const transferBuffer = getMappedTransferBuffer();
+    const uniformValues = new Float32Array(transferBuffer.getMappedRange());

+    // 전송 버퍼의 유니폼 값을 유니폼 버퍼로 복사
+    if (settings.numObjects) {
+      // 기억하세요, 이것은 나중에 실행될 명령을 인코딩하는 것일 뿐입니다.
+      const size = (settings.numObjects - 1) * uniformBufferSpace + uniformBufferSize;
+      encoder.copyBufferToBuffer(transferBuffer, 0, uniformBuffer, 0, size);
+    }

+    const pass = timingHelper.beginRenderPass(encoder, renderPassDescriptor);
+    pass.setPipeline(pipeline);
+    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setIndexBuffer(indicesBuffer, 'uint16');

    for (let i = 0; i < settings.numObjects; ++i) {
      const {
        bindGroup,
-        normalMatrixValue,
-        worldValue,
        axis,
        radius,
        speed,
        rotationSpeed,
        scale,
      } = objectInfos[i];
      const mathTimeStartMs = performance.now();

+      // 매핑된 버퍼로 뷰를 만듭니다.
+      const uniformBufferOffset = i * uniformBufferSpace;
+      const f32Offset = uniformBufferOffset / 4;
+      const normalMatrixValue = uniformValues.subarray(
+          f32Offset + kNormalMatrixOffset, f32Offset + kNormalMatrixOffset + 12);
+      const worldValue = uniformValues.subarray(
+          f32Offset + kWorldOffset, f32Offset + kWorldOffset + 16);

      // 월드 행렬 계산
      mat4.identity(worldValue);
      mat4.axisRotate(worldValue, axis, i + time * speed, worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 3.721 + time * speed) * radius], worldValue);
      mat4.translate(worldValue, [0, 0, Math.sin(i * 9.721 + time * 0.1) * radius], worldValue);
      mat4.rotateX(worldValue, time * rotationSpeed + i, worldValue);
      mat4.scale(worldValue, [scale, scale, scale], worldValue);

      // 역행렬의 전치행렬을 normalMatrix 값에 저장
      mat3.fromMat4(mat4.transpose(mat4.inverse(worldValue)), normalMatrixValue);

      mathElapsedTimeMs += performance.now() - mathTimeStartMs;

      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(numVertices);
    }
+    transferBuffer.unmap();

-    // 모든 유니폼 값을 유니폼 버퍼에 업로드
-    if (settings.numObjects) {
-      const size = (settings.numObjects - 1) * uniformBufferSpace + uniformBufferSize;
-      device.queue.writeBuffer( uniformBuffer, 0, uniformValues, 0, size / uniformValues.BYTES_PER_ELEMENT);
-    }

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
```

마지막으로 커맨드 버퍼를 제출하자마자 버퍼를 다시 매핑합니다. 
매핑은 비동기적이므로 최종적으로 준비되면 이미 매핑된 버퍼 목록에 다시 추가합니다.

```js
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

+    transferBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
+      mappedTransferBuffers.push(transferBuffer);
+    });
```

제 컴퓨터에서 이 버전은 75fps에서 약 15000개의 객체를 그립니다. 
첫 버전보다 약 87% 더 많습니다.

{{{example url="../webgpu-optimization-step6-use-mapped-buffers.html"}}}

'render' 체크를 해제하면 차이가 훨씬 더 큽니다. 저는 원래 최적화되지 않은 
예제에서 75fps에서 9000개를 그렸었고 이 마지막 버전에서 75fps에서 18000개를 그립니다. 
2배 속도 향상입니다!

도움이 *될 수 있는* 다른 것들

* **큰 유니폼 버퍼를 이중 버퍼링**

  WebGPU는 현재 사용 중인 버퍼를 업데이트할 수 없기 때문에 말이 됩니다.

  렌더링을 시작한다고 상상해 보세요(`device.queue.submit`을 호출). 
  GPU는 큰 유니폼 버퍼를 사용하여 렌더링을 시작합니다. 즉시 해당 버퍼를 
  업데이트하려고 시도합니다. 이 경우 WebGPU는 일시 중지하고 GPU가 렌더링에 
  버퍼 사용을 완료할 때까지 기다려야 합니다.

  이것은 위의 예제에서 발생할 가능성이 낮습니다. 유니폼 버퍼를 직접 업데이트하지 
  않습니다. 대신 전송 버퍼를 업데이트한 다음 나중에 GPU에 유니폼 버퍼로 복사하도록 
  요청합니다.

  이 문제는 컴퓨트 셰이더를 사용하여 GPU에서 직접 버퍼를 업데이트하는 경우 
  발생할 가능성이 더 높습니다.

* **오프셋으로 행렬 수학 계산**

  [행렬 수학에 관한 시리즈](webgpu-matrix-math.html)에서 만든 수학 라이브러리는 
  `Float32Array`를 출력으로 생성하고 `Float32Array`를 입력으로 받습니다. 
  `Float32Array`를 제자리에서 수정할 수도 있습니다. 하지만 오프셋 값을 사용하여 
  `Float32Array`를 업데이트하는 것은 불가능합니다.
  
  그렇기 때문에 객체별 유니폼 값을 업데이트하는 루프에서 각 객체에 대해 매핑된 버퍼에 
  2개의 `Float32Array` 뷰를 만들어야 합니다. 20000개의 객체의 경우 
  이러한 임시 뷰를 40000개 만드는 것입니다.
  
  모든 입력에 오프셋을 추가하면 제 생각에는 사용하기 번거로워질 것 같지만,
  테스트 삼아서 오프셋을 사용하도록 수정한 수학 함수를 작성했습니다.
  다시 말해서:

  ```js
      mat4.multiply(a, b, dst);
  ```

  위의 것이 아래것 처럼 바뀝니다.

  ```js
     mat4.multiply(a, aOffset, b, bOffset, dst, dstOffset);
  ```

  [오프셋을 사용하는 것이 약 7% 더 빠른 것으로 보입니다](../webgpu-optimization-step6-use-mapped-buffers-math-w-offsets.html).

  이것이 가치가 있다고 볼지 여부는 여러분에게 달려 있습니다. 저 개인적으로는 
  글머리에서 언급했듯이 사용하기 간단하게 유지하는 것을 선호합니다. 저는 10000개의 
  물체를 그리려고 하는 경우가 거의 없습니다. 하지만 더 성능을 짜내고 싶다면 
  여기가 들여다 볼만한 곳이라는 것은 알아두세요. 저는 그렇게까지 가야한다면
  WebAssembly를 들여다 볼 것 같습니다.

* **유니폼 버퍼를 직접 매핑**

  위의 예제에서 우리는 `COPY_SRC`와 `MAP_WRITE` 사용 플래그만 있는 버퍼인 
  전송 버퍼를 매핑합니다. 그런 다음 `encoder.copyBufferToBuffer`를 호출하여 
  해당 버퍼의 내용을 실제 유니폼 버퍼로 복사해야 합니다.

  유니폼 버퍼를 직접 매핑하고 복사를 피할 수 있다면 훨씬 좋을 것입니다. 
  불행히도 이 기능은 WebGPU 버전 1에서 사용할 수 없지만 향후 선택적 기능으로 
  고려되고 있습니다. 특히 일부 ARM 기반 장치와 같은 *통합 메모리 아키텍처*의 경우에 한해서 입니다.

* **간접 그리기**

  간접 그리기는 GPU 버퍼를 통해서 매개변수를 넘기는 그리기 명령을 의미합니다.

  ```js
  pass.draw(vertexCount, instanceCount, firstVertex, firstInstance);  // 직접
  pass.drawIndirect(someBuffer, offsetIntoSomeBuffer);                // 간접
  ```

  위의 간접 그리기의 경우 `someBuffer`는 `[vertexCount, instanceCount, firstVertex, firstInstance]`를 
  보유하는 GPU 버퍼의 16바이트 크기의 부분 영역입니다.

  간접 그리기의 장점은 GPU 자체가 값을 채울 수 있다는 것입니다. 
  무언가를 그리지 않고 싶을 때 GPU가 `vertexCount` 및/또는 `instanceCount`를 
  0으로 설정하도록 할 수도 있습니다.

  예를 들어 간접 그리기를 사용하면 모든 객체의 경계 상자 또는 경계 구를 GPU에 
  전달한 다음 GPU가 프러스텀 컬링을 수행하도록 하고 객체가 프러스텀 내부에 있는지  
  여부에 따라 해당 객체의 간접 그리기 매개변수를 결정하도록 할 수 있습니다. 
  "프러스텀 컬링"은 객체가 카메라의 프러스텀 내부에 있을 가능성이 있는지 확인하는 멋진 방법입니다. 
  [원근 투영에 관한 글](webgpu-persective-projection.html)에서 프러스텀에 대해 
  다룹니다.

* **렌더 번들**

  렌더 번들을 사용하면 많은 커맨드 버퍼 명령을 미리 기록한 다음 나중에 실행하도록 
  요청할 수 있습니다. 이것은 특히 씬(Scene)이 비교적 정적인 경우, 즉 나중에 객체를 
  추가하거나 제거할 필요가 없는 경우 유용할 수 있습니다.

  렌더 번들, 간접 그리기, GPU 프러스텀 컬링을 결합하여 특수한 상황에서 더 좋은 
  성능을 얻기 위한 몇 가지 아이디어를 보여주는 훌륭한 글이 
  [여기](https://toji.dev/webgpu-best-practices/render-bundles)에 있습니다.



