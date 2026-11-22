Title: WebGPU 호환 모드
Description: 구형 기기에서 WebGPU 실행하기
TOC: 호환 모드

WebGPU 호환 모드는 WebGPU의 한 버전으로, 일부 제한이 있음에도 불구하고 구형 장치에서도 실행될 수 있습니다. 즉, 앱이 일부 제한과 조건을 받아들일 수 있다면, WebGPU 호환 어댑터를 사용하여 앱을 더 많은 장치에서 실행할 수 있습니다.

> 참고: 호환 모드는 Chrome 146 버전에서 사용할 수 있습니다. (2026-02-23) 이 기능은 여러분의 브라우저에서도 시험적으로 사용할 수 있을 수 있습니다. [Chrome Canary](https://www.google.com/chrome/canary/)의 경우, 버전 136.0.7063.0 (2025-03-11)부터 “enable-unsafe-webgpu”라는 플래그를 활성화함으로써 호환 모드를 사용할 수 있습니다. 이 플래그는 `chrome://flags/#enable-unsafe-webgpu`에서 활성화할 수 있습니다.

호환 모드에서 할 수 있는 일을 가늠해 보자면, 사실상 *거의* 모든 WebGL2 프로그램을 호환 모드에서 실행하도록 바꿀 수 있습니다.

이렇게 하면 됩니다.

```js
const adapter = await navigator.gpu.requestAdapter({
  featureLevel: 'compatibility',
});
const device = await adapter.requestDevice();
```

간단합니다! 호환 모드의 모든 제한을 준수하는 모든 앱은 유효한 “코어” WebGPU 앱이 되며, WebGPU가 이미 실행 중인 곳 어디에서나 실행될 수 있습니다.

# 주요 제한 및 금지 사항들

## 정점 셰이더에는 아마도 0개의 스토리지 버퍼가 있을 것입니다.

WebGPU 앱에 가장 큰 영향을 미칠 수 있는 제한점은, 약 45%의 구형 장치들이 정점 셰이더에서 스토리지 버퍼를 지원하지 않는다는 점입니다.

이 사이트의 세 번째 강의인 [스토리지 버퍼](webgpu-storage-buffers.html)에서 이 기능을 사용했습니다. 이후에는 일반적이고 폭넓게 지원되는 [정점 버퍼](webgpu-vertex-buffers.html)를 사용했습니다. 상황에 따라 스토리지 버퍼가 더 간단할 때도 있습니다. 예를 들어 [와이어프레임 그리기 예제](https://webgpu.github.io/webgpu-samples/?sample=wireframe)에서는 스토리지 버퍼에서 정점 데이터를 읽어 삼각형을 만듭니다.

정점 데이터가 스토리지 버퍼에 저장되어 있기 때문에, 우리는 정점 데이터를 무작위로 접근할 수 있습니다. 하지만 정점 데이터가 정점 버퍼에 저장되어 있으면, 그러한 접근은 불가능합니다. 물론, 다른 해결책도 존재합니다.

## 중간 수준의 제한과 한계들

## `TEXTURE_BINDING`으로 사용할 수 있는 텍스처 뷰 차원은 하나입니다

일반적인 WebGPU에서는 이와 같은 2D 텍스처를 만들 수 있습니다.

```js
const myTexture = device.createTexture({
  size: [width, height, 6],
  usage: ...
  format: ...
});
```

그런 다음, 3가지 다른 방식으로 그 이미지를 볼 수 있습니다.

```js
// myTexture를 6개의 층으로 구성된 2차원 배열로 볼 수 있습니다.
const as2DArray = myTexture.createView();

// myTexture의 3번째 레이어를 2차원 텍스처로 처리합니다.
const as2D = myTexture.createView({
  dimension: '2d',
  baseArrayLayer: 3,
  arrayLayerCount: 1,
});

// myTexture를 큐베이스로 볼 때의 모습입니다.
const asCube = myTexture.createView({
  dimension: 'cube',
});
```

호환 모드에서는 텍스처를 만들 때 셰이더에서 사용할 뷰 차원을 정합니다. 기본값은 레이어가 하나인 2D 텍스처의 경우 `'2d'`, 레이어가 둘 이상인 경우 `'2d-array'`입니다. 큐브맵처럼 기본값과 다른 뷰가 필요하면 텍스처를 만들 때 지정합니다.

```js
const cubeTexture = device.createTexture({
  size: [width, height, 6],
  usage: ...
  format: ...
  textureBindingViewDimension: 'cube',
});
```

참고로, 이 추가된 매개변수는 `textureBindingViewDimension`이라고 불립니다. 이는 `TEXTURE_BINDING` 방식으로 텍스처를 사용하는 것과 관련이 있습니다. 여전히 큐브맵이나 2D 배열의 단일 레이어를 2D 텍스처로 사용할 수 있습니다. 이 경우, 해당 레이어를 `RENDER_ATTACHMENT`로 사용할 수 있습니다.

바인드 그룹에서 텍스처를 사용할 때는 지정한 뷰 차원을 사용해야 합니다. 이 제한은 셰이더에 바인딩할 때 적용되므로, `textureBindingViewDimension`이 `2d-array`나 `cube`여도 렌더 타깃으로 사용할 때는 `2d` 뷰를 만들 수 있습니다.

호환 모드에서는, 텍스처를 다른 유형의 뷰와 함께 바인드 그룹에 사용하면 유효성 검사 오류가 발생합니다.

```js
// cubeTexture를 6개의 층으로 구성된 2차원 배열로 볼 수 있습니다.
const bindGroup = device.createBindGroup({
  ...
  entries: [
    {
      binding,
      // 호환 모드에서 오류가 발생했습니다. 텍스처는 2D 배열이 아니라 큐베이스입니다.
      // (1개 이상의 레이어를 가진 텍스처의 기본 설정)
      resource: cubeTexture,
    },
  ],
})
```

```js
// cubeTexture의 3번째 레이어를 2차원 텍스처로 처리합니다.
const bindGroup = device.createBindGroup({
  ...
  entries: [
    {
      binding,
      // 호환 모드 관련 오류: 텍스처가 2D가 아니라 큐브맵입니다.
      resource: cubeTexture.createView({
        viewDimension: '2d',
        baseArrayLayer: 3,
        arrayLayerCount: 1,
      }),
    },
  ]
});
```

```js
// 큐브텍스처를 큐브맵으로 보는 방식
const bindGroup = device.createBindGroup({
  ...
  entries: [
    {
      binding,
      // 잘됐어요!
      resource: cubeTexture.createView({
        viewDimension: 'cube',
      }),
    },
  ],
});
```

이런 제한은 그다지 큰 문제가 되지 않습니다. 대부분의 프로그램들은 다양한 종류의 뷰를 가진 텍스처를 사용하고 싶어하지 않습니다.

## `texture.createView`를 호출할 때, bindGroup 내의 일부 레이어만을 선택할 수는 없습니다.

WebGPU의 핵심 기능을 활용하면, 여러 층으로 구성된 텍스처를 만들 수 있습니다.

```js
const texture = device.createTexture({
  size: [64, 128, 8],   // 8개의 층이 있습니다.
  ...
});
```

그런 다음, 레이어들의 하위 집합을 선택할 수 있습니다.

```js
const bindGroup = device.createBindGroup({
  ...
  entries: [
    {
      binding,
      // 호환 모드에서 오류가 발생했습니다. 3번과 4번 레이어를 선택해 주세요.
      resource: cubeTexture.createView({
        baseArrayLayer: 3,
        arrayLayerCount: 2,
      }),
    },
  ],
});
```

이런 제한도 그다지 큰 문제는 아닙니다. 텍스처에서 특정 레이어들을 선택하고 싶어하는 프로그램은 거의 없습니다.

## <a id="a-generating-mipmaps"></a> 호환 모드에서 Mipmap을 생성하는 방법입니다.

하지만, 이러한 제한들이 모두 적용되는 경우가 있습니다. 그곳은 바로 미파일을 생성할 때입니다. 미파일 생성은 매우 흔한 사용 사례입니다.

[GPU에서 밉 생성하기](webgpu-importing-textures.html#a-generating-mips-on-the-gpu)에서 밉맵 생성기를 만들었습니다. 이후 [텍스처 헬퍼가 여러 레이어를 처리할 수 있도록 하기](webgpu-cube-maps.html#a-texture-helpers)에서 그 함수를 수정해 2D 배열과 큐브맵의 밉도 생성했습니다. 그 구현은 텍스처에서 레이어 하나를 `'2d'` 뷰로 만들 수 있어야 합니다. 호환 모드에서는 `'2d-array'`나 `'cube'` 텍스처를 `'2d'` 뷰로 바인딩해 레이어 하나만 읽을 수 없습니다.

호환 모드에서 동작하려면 텍스처를 만들 때 지정한 차원으로 바인딩합니다. 뷰에는 모든 레이어를 포함하고, 프래그먼트 셰이더에서 읽을 레이어를 선택합니다. 이 경우 `createView`를 호출해 레이어 하나를 선택하지 않습니다.

먼저 큐브맵의 [여러 레이어를 처리하는 텍스처 헬퍼](webgpu-cube-maps.html#a-texture-helpers)에 있는 `generateMips` 코드부터 살펴보겠습니다.

```js
  const generateMips = (() => {
    let sampler;
    let module;
    const pipelineByFormat = {};

    return function generateMips(device, texture) {
      if (!module) {
        module = device.createShaderModule({
          label: 'textured quad shaders for mip level generation',
          code: /* wgsl */ `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
              let pos = array(

                vec2f( 0.0,  0.0),  // 중심점
                vec2f( 1.0,  0.0),  // 오른쪽, 중앙
                vec2f( 0.0,  1.0),  // 중심, 상단

                // 2번째 삼각형
                vec2f( 0.0,  1.0),  // 중심, 상단
                vec2f( 1.0,  0.0),  // 오른쪽, 중앙
                vec2f( 1.0,  1.0),  // 오른쪽, 위쪽
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
        });

        sampler = device.createSampler({
          minFilter: 'linear',
          magFilter: 'linear',
        });
      }

      if (!pipelineByFormat[texture.format]) {
        pipelineByFormat[texture.format] = device.createRenderPipeline({
          label: 'mip level generator pipeline',
          layout: 'auto',
          vertex: {
            module,
          },
          fragment: {
            module,
            targets: [{ format: texture.format }],
          },
        });
      }
      const pipeline = pipelineByFormat[texture.format];

      const encoder = device.createCommandEncoder({
        label: 'mip gen encoder',
      });

      for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
        for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
          const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              {
                binding: 1,
                resource: texture.createView({
                  dimension: '2d',
                  baseMipLevel: baseMipLevel - 1,
                  mipLevelCount: 1,
                  baseArrayLayer: layer,
                  arrayLayerCount: 1,
                }),
              },
            ],
          });

          const renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
              {
                view: texture.createView({
                  dimension: '2d',
                  baseMipLevel: baseMipLevel,
                  mipLevelCount: 1,
                  baseArrayLayer: layer,
                  arrayLayerCount: 1,
                }),
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          };

          const pass = encoder.beginRenderPass(renderPassDescriptor);
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(6);  // 정점 셰이더를 6번 호출합니다.
          pass.end();
        }
      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    };
  })();
```

WGSL을 변경해야 합니다. 즉, 각각의 텍스처 유형(2D, 2D-배열, 큐브 등)에 대해 별도의 프래그먼트 셰이더를 사용해야 합니다. 또한, 읽을 수 있는 레이어도 함께 전달할 수 있어야 합니다.

```wgsl
+const faceMat = array(
+  mat3x3f( 0,  0,  -2,  0, -2,   0,  1,  1,   1),   // pos-x
+  mat3x3f( 0,  0,   2,  0, -2,   0, -1,  1,  -1),   // neg-x
+  mat3x3f( 2,  0,   0,  0,  0,   2, -1,  1,  -1),   // pos-y
+  mat3x3f( 2,  0,   0,  0,  0,  -2, -1, -1,   1),   // neg-y
+  mat3x3f( 2,  0,   0,  0, -2,   0, -1,  1,   1),   // pos-z
+  mat3x3f(-2,  0,   0,  0, -2,   0,  1,  1,  -1));  // neg-z

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
+  @location(1) @interpolate(flat, either) baseArrayLayer: u32,
};

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
+  @builtin(instance_index) baseArrayLayer: u32,
) -> VSOutput {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  3.0),
    vec2f( 3.0, -1.0),
  );

  var vsOutput: VSOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
+  vsOutput.baseArrayLayer = baseArrayLayer;
  return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
-@group(0) @binding(1) var ourTexture: texture_2d<f32>;

+@group(0) @binding(1) var ourTexture2d: texture_2d<f32>;
@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
-  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
+  return textureSample(ourTexture2d, ourSampler, fsInput.texcoord);
}

+@group(0) @binding(1) var ourTexture2dArray: texture_2d_array<f32>;
+@fragment fn fs2darray(fsInput: VSOutput) -> @location(0) vec4f {
+  return textureSample(
+    ourTexture2dArray,
+    ourSampler,
+    fsInput.texcoord,
+    fsInput.baseArrayLayer);
+}
+
+@group(0) @binding(1) var ourTextureCube: texture_cube<f32>;
+@fragment fn fscube(fsInput: VSOutput) -> @location(0) vec4f {
+  return textureSample(
+    ourTextureCube,
+    ourSampler,
+    faceMat[fsInput.baseArrayLayer] * vec3f(fract(fsInput.texcoord), 1));
+}
```

이 코드에는 `'2d'`, `'2d-array'`, `'cube'`용 프래그먼트 셰이더가 하나씩 총 3개 있습니다. [클립 공간을 덮는 큰 삼각형](webgpu-large-triangle-to-cover-clip-space.html) 기법으로 그립니다. 레이어는 `@builtin(instance_index)`로 선택합니다. 이 방법은 [유니폼 버퍼 없이 셰이더에 정수 하나를 전달하는 간단하고 빠른 방법](webgpu-miscellaneous-input.html)입니다. `draw`의 네 번째 인수는 첫 인스턴스 번호이며, 셰이더에는 `@builtin(instance_index)`로 전달됩니다. 정점 셰이더에서는 이 값을 `VSOutput.baseArrayLayer`에 넣고, 프래그먼트 셰이더에서는 `fsInput.baseArrayLayer`로 읽습니다.

큐브맵용 코드는 2D 배열의 레이어 번호와 정규화된 UV 좌표를 큐브맵을 샘플링할 3D 방향으로 바꿉니다. 호환 모드에서 큐브맵은 `cube` 뷰로만 바인딩할 수 있기 때문입니다.

자, 다시 JavaScript로 돌아가서, `textureBindingViewDimension` 속성을 텍스처에서 읽어와야 합니다. 참고로, **호환 모드가 아닌 경우**에는 이 값은 undefined가 됩니다. 하지만 그런 경우에는 `'2d-array'`라고 가정해도 됩니다. 왜냐하면 일반적인 “코어” WebGPU에서는 `'2d-array'`가 항상 작동하기 때문입니다.

```js
  const generateMips = (() => {
    let sampler;
    let module;
    const pipelineByFormat = {};

    return function generateMips(device, texture) {
+      // 만약 그 텍스처에 ‘textureBindingViewDimension’이 없다면, ‘2d-array’를 사용해야 합니다.
+      const textureBindingViewDimension = texture.textureBindingViewDimension ?? '2d-array';
      if (!module) {
        module = device.createShaderModule({
          label: 'textured quad shaders for mip level generation',
          code: /* wgsl */ `
            const faceMat = array(
              mat3x3f( 0,  0,  -2,  0, -2,   0,  1,  1,   1),   // pos-x
              mat3x3f( 0,  0,   2,  0, -2,   0, -1,  1,  -1),   // neg-x
              mat3x3f( 2,  0,   0,  0,  0,   2, -1,  1,  -1),   // pos-y
              mat3x3f( 2,  0,   0,  0,  0,  -2, -1, -1,   1),   // neg-y
              mat3x3f( 2,  0,   0,  0, -2,   0, -1,  1,   1),   // pos-z
              mat3x3f(-2,  0,   0,  0, -2,   0,  1,  1,  -1));  // neg-z

            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
              @location(1) @interpolate(flat, either) baseArrayLayer: u32,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32,
              @builtin(instance_index) baseArrayLayer: u32,
            ) -> VSOutput {
              var pos = array<vec2f, 3>(
                vec2f(-1.0, -1.0),
                vec2f(-1.0,  3.0),
                vec2f( 3.0, -1.0),
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy, 0.0, 1.0);
              vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
              vsOutput.baseArrayLayer = baseArrayLayer;
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;

            @group(0) @binding(1) var ourTexture2d: texture_2d<f32>;
            @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture2d, ourSampler, fsInput.texcoord);
            }

            @group(0) @binding(1) var ourTexture2dArray: texture_2d_array<f32>;
            @fragment fn fs2darray(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(
                ourTexture2dArray,
                ourSampler,
                fsInput.texcoord,
                fsInput.baseArrayLayer);
            }

            @group(0) @binding(1) var ourTextureCube: texture_cube<f32>;
            @fragment fn fscube(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(
                ourTextureCube,
                ourSampler,
                faceMat[fsInput.baseArrayLayer] * vec3f(fract(fsInput.texcoord), 1));
            }
          `,
        });

        sampler = device.createSampler({
          minFilter: 'linear',
          magFilter: 'linear',
        });
      }

    ...
```

동일한 형식의 텍스처를 재사용할 수 있도록, 각 형식마다 별도의 파이프라인을 사용하도록 변경해야 합니다. 이를 위해서는 각 뷰마다 다른 파이프라인을 사용해야 합니다.

```js
  const generateMips = (() => {
    let sampler;
    let module;
-    const pipelineByFormat = {};
+    const pipelineByFormatAndView = {};

    return function generateMips(device, texture, textureBindingViewDimension) {
      // 만약 그 텍스처에 textureBindingViewDimension이 없다면, ‘2d-array’를 사용해야 합니다.
      // 이는 Core WebGPU 모드에서도 동일하게 적용됩니다.
      const textureBindingViewDimension = texture.textureBindingViewDimension ?? '2d-array';
      let module = moduleByViewDimension[textureBindingViewDimension];
      if (!module) {
        ...
      }

+      const id = `${texture.format}.${textureBindingViewDimension}`;

-      if (!pipelineByFormat[texture.format]) {
-        pipelineByFormat[texture.format] = device.createRenderPipeline({
-          label: 'mip level generator pipeline',
+      if (!pipelineByFormatAndView[id]) {
+        // viewDimension에 기반한 프래그먼트 셰이더를 선택합니다. 이때, 2d-array와 cube-array에서 ‘-’ 기호를 제거합니다.
+        const entryPoint = `fs${textureBindingViewDimension.replace(/[\W]/, '')}`;
+        pipelineByFormatAndView[id] = device.createRenderPipeline({
+          label: `mip level generator pipeline for ${textureBindingViewDimension}, format: ${texture.format}`,
          layout: 'auto',
          vertex: {
            module,
          },
          fragment: {
            module,
            entryPoint,
            targets: [{ format: texture.format }],
          },
        });
      }
-      const pipeline = pipelineByFormat[texture.format];
+      const pipeline = pipelineByFormatAndView[id];

      ...
}
```

그러므로, MIP맵을 생성하는 루프에서는 전체 레이어를 사용해야 합니다. 왜냐하면 호환 모드는 일부 레이어만을 사용할 수 없기 때문입니다. 또한, draw 함수를 통해 원하는 레이어를 선택할 수 있도록 해야 합니다.

```js
  const generateMips = (() => {

      ...

      const pipeline = pipelineByFormatAndView[id];

      for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
        for (let layer = 0; layer < texture.depthOrArrayLayers; ++layer) {
          const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              {
                binding: 1,
                resource: texture.createView({
-                  dimension: '2d',
+                  dimension: textureBindingViewDimension,
                  baseMipLevel: baseMipLevel - 1,
                  mipLevelCount: 1,
-                  baseArrayLayer: layer,
-                  arrayLayerCount: 1,
                }),
              },
            ],
          });

          const renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
              {
                view: texture.createView({
                  dimension: '2d',
                  baseMipLevel,
                  mipLevelCount: 1,
                  baseArrayLayer: layer,
                  arrayLayerCount: 1,
                }),
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          };

          const pass = encoder.beginRenderPass(renderPassDescriptor);
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
-          pass.draw(6);
+          // 3개의 정점을 그려냅니다. 1개의 인스턴스가 있으며, 첫 번째 인스턴스의 인스턴스 인덱스는 layer입니다.
+          pass.draw(3, 1, 0, layer);
          pass.end();
        }
      }

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    };
  })();
```

이렇게 하면, 우리의 밉맵 생성 코드는 호환 모드에서도 제대로 작동합니다. 또한, 이 코드는 Core WebGPU에서도 여전히 제대로 작동합니다.

하지만, 이 예제가 제대로 작동하도록 하기 위해서는 몇 가지 사항을 업데이트해야 합니다.

우리에게는 `createTextureFromSources`라는 함수가 있어서, 이 함수를 사용하면 소스를 전달할 수 있고, 그 결과로 텍스처가 생성됩니다. 원래는 항상 `'2d'`라는 텍스처를 생성했지만, 코어에서는 6개의 레이어로 구성된 `'2d'`라는 텍스처를 볼 수 있습니다. 하지만 이제는 `textureBindingViewDimension`이나 치수를 전달할 수 있도록 해야 합니다. 그래야 텍스처를 생성할 때, 호환 모드에 따라 텍스처를 어떻게 보여줄지 결정할 수 있습니다.

```js
+  function textureViewDimensionToDimension(viewDimension) {
+   switch (viewDimension) {
+      case '1d': return '1d';
+      case '3d': return '3d';
+      default: return '2d';
+    }
+  }

  function createTextureFromSources(device, sources, options = {}) {
+    const viewDimension = options.dimension ??
+      getDefaultViewDimensionForTexture(options.textureBindingViewDimension);
+    const dimension = options.dimension ?? textureViewDimensionToDimension(viewDimension);
    // 모든 소스의 크기가 동일하다고 가정하므로, 너비와 높이는 첫 번째 소스를 그대로 사용하면 됩니다.
    const source = sources[0];
    const texture = device.createTexture({
      format: 'rgba8unorm',
      mipLevelCount: options.mips ? numMipLevels(source.width, source.height) : 1,
      size: [source.width, source.height, sources.length],
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT,
+      dimension,
+      textureBindingViewDimension: options.textureBindingViewDimension,
    });
    copySourcesToTexture(device, texture, sources, options);
    return texture;
  }
```

또한, `createTextureFromSources` 함수에 대한 호출을 업데이트해야 합니다. 이때, 큐브맵을 원한다는 사실을 미리 알려주어야 합니다.

```js
  const texture = await createTextureFromSources(
-      device, faceCanvases, {mips: true, flipY: false});
+      device, faceCanvases, {mips: true, flipY: false, textureBindingViewDimension: 'cube'});
```

이 예제가 호환 모드에서 실행되도록 하려면, 이 기사의 시작 부분에서 설명한 방법대로 요청해야 합니다.

```js
async function main() {
-  const adapter = await navigator.gpu?.requestAdapter()
+  const adapter = await navigator.gpu?.requestAdapter({
+    featureLevel: 'compatibility',
+  });
  const device = await adapter?.requestDevice();

  ...
```

그렇게 되면, 우리의 큐브맵 샘플도 호환 모드에서 작동하게 됩니다.

{{{example url="../webgpu-compatibility-mode-generatemips.html"}}}

이제 코어 모드와 호환 모드 모두에서 사용할 수 있는 `generateMips` 함수가 생겼습니다. 호환 모드에서 큐브맵이나 레이어가 하나뿐인 2D 배열 텍스처를 만들려면 `textureBindingViewDimension`을 명시해야 합니다. 코어 모드에서는 생략해도 됩니다.

# 소소한 제한과 조건들

다음은 *대부분의* 프로그램에서 마주칠 일이 없는 한계와 제약 사항입니다.

* ## 모든 색상 타깃에서 블렌딩 설정이 같아야 합니다

  기본적으로, 렌더링 파이프라인을 생성할 때, 각 색상 타깃은 블렌딩 설정을 지정할 수 있습니다. [투명도와 블렌딩](webgpu-transparency.html)에서 이 설정을 사용했습니다. 호환 모드에서는, 단일 파이프라인 내의 모든 색상 타깃의 설정들이 모두 동일해야 합니다.

* ## `copyTextureToBuffer`와 `copyTextureToTexture`는 압축 텍스처에 사용할 수 없습니다

* ## `copyTextureToTexture`는 멀티샘플링된 텍스처에 사용할 수 없습니다

* ## `cube-array`는 지원되지 않습니다

* ## 단일 드로우 또는 디스패치 호출에서 같은 텍스처의 뷰들은 애스펙트와 밉 레벨이 같아야 합니다

  WebGPU의 핵심 기능 중 하나는, 텍스처를 여러 개의 밉 레벨로 분할하여 사용할 수 있다는 것입니다. 그리고 이러한 여러 밉 레벨을 동일한 드로우 호출에서 사용할 수도 있습니다. 이는 비교적 드문 기능입니다. 참고로, 이러한 제한은 `TEXTURE_BINDING`을 사용할 때만 적용됩니다. 즉, 텍스처를 bindGroup을 통해 사용할 때만 이러한 제한이 적용됩니다. 하지만 위에서 설명한 밉맵 생성 코드와 마찬가지로, 다른 밉 레벨을 `RENDER_ATTACHMENT`로 사용할 수도 있습니다.

* ## `@builtin(sample_mask)`와 `@builtin(sample_index)`는 지원되지 않습니다

* ## `rg32uint`, `rg32sint`, `rg32float` 형식은 스토리지 텍스처에 사용할 수 없습니다

* ## `depthClampBias`는 0이어야 합니다

  이는 렌더링 파이프라인을 생성할 때 사용되는 설정입니다.

* ## `@interpolation(linear)`와 `@interpolation(..., sample)`은 지원되지 않습니다

  이 내용은 [보간 설정](webgpu-inter-stage-variables.html#a-interpolate)에서 간략하게 언급되었습니다.

* ## <a id="flat"></a> `@interpolate(flat)`과 `@interpolate(flat, first)`는 지원되지 않습니다

  호환 모드에서는, 플랫 보간을 원할 때 `@interpolate(flat, either)`를 사용해야 합니다. 여기서 `either`라는 것은, 프래그먼트 셰이더에 전달되는 값이 삼각형이나 선의 첫 번째 또는 마지막 정점에서 가져온 값일 수 있다는 것을 의미합니다. 이는 구현 방식에 따라 달라집니다.

  이 경우에는 그다지 중요하지 않은 경우가 많습니다. 정점 셰이더에서 프래그먼트 셰이더로 값을 전달하는 가장 일반적인 경우는, 각 모델, 각 재질, 또는 각 인스턴스에 해당하는 값을 전달하는 경우입니다. 예를 들어, 위의 밉맵 생성 코드는 `instance_index` 값을 프래그먼트 셰이더로 전달하는 데 사용되었습니다. 이 방식은 삼각형의 모든 정점에 대해 동일하게 적용될 수 있으며, `@interpolate(flat, either)`와 함께 사용해도 문제없습니다.

* ## 텍스처 형식을 재해석할 수 없습니다

  Core WebGPU에서는 `'rgba8unorm'` 텍스처를 생성할 수 있으며, 이를 `'rgba8unorm-srgb'` 텍스처로 볼 수도 있고, 그 반대의 경우도 가능합니다. 또한 다른 `'-srgb'` 형식과 그에 해당하는 비`'-srgb'` 형식으로도 표시할 수 있습니다. 하지만 호환 모드는 이러한 기능을 허용하지 않습니다. 텍스처를 생성하는 형식이 바로 사용할 수 있는 유일한 형식이 됩니다.

* ## `bgra8unorm-srgb`는 지원되지 않습니다

* ## `rgba16float`와 `r32float` 텍스처는 멀티샘플링할 수 없습니다

* ## 모든 정수 텍스처 형식은 멀티샘플링할 수 없습니다

* ## `depthOrArrayLayers`는 `textureBindingViewDimension`과 호환되어야 합니다

  즉, `textureBindingViewDimension: '2d'`로 표시된 텍스처는 반드시 `depthOrArrayLayers: 1`을 가져야 합니다. 반면, `textureBindingViewDimension: 'cube'`로 표시된 텍스처는 반드시 `depthOrArrayLayers: 6`을 가져야 합니다.

* ## `textureLoad`는 깊이 텍스처에 사용할 수 없습니다

  “깊이 텍스처”란, WGSL에서 `texture_depth`, `texture_depth_2d_array`, 또는 `texture_depth_cube`와 함께 사용되는 텍스처입니다. 이러한 텍스처들은 호환 모드에서 `textureLoad`와 함께 사용될 수 없습니다.

  반면에, `textureLoad`는 `texture_2d<f32>`, `texture_2d_array<f32>`, `texture_cube<f32>`와 함께 사용될 수 있습니다. 또한, 깊이 형식을 가진 텍스처도 이러한 객체들과 함께 사용될 수 있습니다.

* ## 깊이 텍스처는 비교 기능이 없는 샘플러와 함께 사용할 수 없습니다

  다시 말해, “깊이 텍스처”란 WGSL에서 `texture_depth`, `texture_depth_2d_array`, 또는 `texture_depth_cube`와 같은 명칭으로 불리는 텍스처를 말합니다. 이러한 텍스처들은 호환 모드에서 비교 기능이 없는 샘플러와 함께 사용될 수 없습니다.

  이는, `texture_depth`, `texture_depth_2d_array`, `texture_depth_cube`와 같은 매개변수들은 호환 모드에서만 `textureSampleCompare`, `textureSampleCompareLevel`, `textureGatherCompare`와 함께 사용될 수 있다는 의미입니다.

  반면에, 깊이 형식을 사용하는 텍스처를 `texture_2d<f32>`, `texture_2d_array<f32>`, `texture_cube<f32>`와 같은 타입에 바인딩할 수 있습니다. 단, 필터링되지 않는 샘플러를 사용해야 한다는 제한이 있습니다.

* ## 세밀한 미분 함수는 지원되지 않습니다

  WGSL의 `dpdxFine`, `dpdyFine`, `fwidthFine` 함수들은 호환 모드에서는 지원되지 않습니다. 하지만 `dpdx`, `dpdxCoarse`, `dpdy`, `dpdyCoarse`, `fwidth`, `fwidthCoarse` 함수들은 여전히 사용할 수 있습니다.

* ## 텍스처와 샘플러의 조합이 더 제한됩니다

  핵심적으로는, 16개 이상의 텍스처와 16개 이상의 샘플러를 결합할 수 있습니다. 그리고 셰이더에서는 이 모든 조합들을 활용할 수 있습니다. 즉, 총 256개 이상의 조합을 사용할 수 있습니다.

  호환 모드에서는, 한 단계에서 총 16개의 조합만을 사용할 수 있습니다.

  실제 규칙은 조금 더 복잡합니다. 여기서는 그 규칙을 Pseudo Code로 설명해 보겠습니다.

  ```
  maxCombinationsPerStage =
     min(device.limits.maxSampledTexturesPerShaderStage, device.limits.maxSamplersPerShaderStage)
  for each stage of the pipeline:
    sum = 0
    for each texture binding in the pipeline layout which is visible to that stage:
      sum += max(1, number of texture sampler combos for that texture binding)
    for each external texture binding in the pipeline layout which is visible to that stage:
      sum += 1 // LUT 텍스처 + LUT 샘플러용입니다.
      sum += 3 * max(1, number of external_texture sampler combos) // Y+U+V를 위해
    if sum > maxCombinationsPerStage
      generate a validation error.
  ```

* ## 호환 모드에서는 일부 기본 한도가 더 낮습니다

  | 제한                               | 호환 모드  | 코어      |
  | :---------------------------------- | ------: | --------: |
  | `maxColorAttachments`               |       4 |         8 |
  | `maxComputeInvocationsPerWorkgroup` |     128 |       256 |
  | `maxComputeWorkgroupSizeX`          |     128 |       256 |
  | `maxComputeWorkgroupSizeY`          |     128 |       256 |
  | `maxInterStageShaderVariables`      |      15 |        16 |
  | `maxTextureDimension1D`             |    4096 |      8192 |
  | `maxTextureDimension2D`             |    4096 |      8192 |
  | `maxUniformBufferBindingSize`       |   16384 |     65536 |
  | `maxVertexAttributes`        | 16<sup>a</sup> |        16 |

  호환 모드에서는, `@builtin(vertex_index)` 및/또는 `@builtin(instance_index)`를 속성으로 사용할 수 있습니다.

  물론, 그 어댑터는 이러한 모든 경우에 대해 더 높은 한계를 지원할 수도 있습니다.

* ## 새로운 한도가 4개 추가됩니다

  * `maxStorageBuffersInVertexStage` (기본값: 0)
  * `maxStorageTexturesInVertexStage` (기본값: 0)
  * `maxStorageBuffersInFragmentStage` (기본값: 4)
  * `maxStorageTexturesInFragmentStage` (기본값: 4)

  다른 제한 사항들과 마찬가지로, 어댑터를 요청할 때 해당 어댑터가 어떤 기능을 지원하는지 확인할 수 있습니다. 또한, 더 많은 기능이 필요한 경우, 기본 설정보다 더 높은 수준의 기능을 요구할 수도 있습니다.

  위에서 언급했듯이, 약 45%의 장치들은 정점 셰이더에서 `0`개의 스토리지 버퍼와 스토리지 텍스처를 지원합니다.

# 호환 모드에서 코어 모드로 업그레이드하기

호환 모드는 사용자가 원할 경우에만 활성화될 수 있도록 설계되었습니다. 만약 사용자가 위에서 언급된 제한사항들을 견딜 수 있는 방식으로 애플리케이션을 설계할 수 있다면, 호환 모드를 선택할 필요가 없습니다. 그렇지 않다면, 기본 모드를 선택해야 합니다. 만약 장치가 기본 모드를 처리할 수 없다면, 어댑터가 반환되지 않을 것입니다.

반면에, 사용자가 WebGPU 기능을 지원하는 기기를 가지고 있다면, 앱을 호환 모드로 설정하여도 모든 핵심 기능들을 활용할 수 있습니다.

이를 위해서는 호환 모드 어댑터를 요청한 다음, `core-features-and-limits` 기능이 있는지 확인하고 이 기능을 활성화해야 합니다. 만약 어댑터에 이 기능이 있고, 사용자도 이 기능을 필요로 한다면, 그 장치는 코어 장치가 되며, 위에서 언급된 제한들은 적용되지 않습니다.

예시:

```js
const adapter = await navigator.gpu.requestAdapter({
  featureLevel: 'compatibility',
});
const hasCore = adapter.features.has('core-features-and-limits');
const device = await adapter.requestDevice({
  requiredFeatures: [
    ...(hasCore ? ['core-features-and-limits'] : []),
  ],
});
```

만약 `hasCore`가 참이면, 위의 모든 제한 및 조건은 적용되지 않습니다.

또한, 장치가 코어 장치인지, 아니면 호환 가능한 장치인지를 확인하고자 하는 다른 코드들도 해당 장치의 기능들을 확인해야 합니다.

```js
const isCore = device.features.has('core-features-and-limits');
```

이것은 항상 핵심 장치에서도 성립됩니다.

# 호환 모드 테스트

호환 모드를 지원하는 브라우저에서는, 애플리케이션이 이러한 제한 사항을 준수하는지 테스트할 수 있습니다. 즉, 위에서 설명한 것처럼 `'core-features-and-limits'`를 요청하지 않도록 할 수 있습니다. 실제로 호환 가능한 기기에서 테스트를 진행하여, 제한 사항이 제대로 적용되고 있는지 확인하는 것이 좋습니다.

```js
const adapter = await navigator.gpu.requestAdapter({
  featureLevel: 'compatibility',
});
const device = await adapter.requestDevice();

const isCompatibilityMode = !device.features.has('core-features-and-limits');
```

이것은, 사용자의 앱이 이러한 구형 장치에서 제대로 작동하는지 확인할 수 있는 좋은 방법입니다.

# WebGPU-개발 확장 기능을 통해 간단한 테스트를 수행할 수 있습니다.

[webgpu-dev-extension](https://github.com/greggman/webgpu-dev-extension)를 사용하면, 앱에 대한 변경 없이도 앱이 호환 모드로 작동하도록 할 수 있습니다. 또한, 자동으로 코어 웹gpu로 업그레이드되는 앱도 호환 모드에서도 제대로 작동하는지 확인할 수 있습니다.

단계들:

1. Devtools를 열고, 앱을 실행해 보세요.
2. Devtools에서 설정 메뉴를 열어보세요.

   <div class="webgpu_left"><img src="resources/images/webgpu-devtools-settings.png" style="width: 554px"></div>

3. ‘사용자 정의 형식터’를 켜세요.

   <div class="webgpu_left"><img src="resources/images/webgpu-devtools-custom-formatters.png" style="width: 554px"></div>

4. WebGPU-Dev-Extension에서 다음 옵션들을 선택하세요:

   <div class="webgpu_left"><img src="resources/images/webgpu-dev-extension-compat.png" style="width: 274px"></div>

    * ### Force Mode: 'compatibility-mode'

      이 옵션을 설정하면 앱이 `navigator.gpu.requestAdapter({ featureLevel: 'compatibility' });`를 호출합니다.

      앱이 이미 호환 모드를 지원한다면 기본값을 유지하세요.

    * ### Block Features 'core-features-and-limits'

      앱이 코어 모드를 요청하지 못하게 하는 옵션입니다.

    * ### DevTools Custom Formatters

      이 옵션을 켜면 개발자 도구에서 디바이스를 검사할 때 device.features가 문자열 배열로 표시됩니다. 옵션이 꺼져 있으면 내부를 볼 수 없는 객체로 표시되어 기능 목록을 확인할 수 없습니다.

    * ### Show Adapter Info

      새 어댑터나 디바이스가 생성될 때마다 console.log(adapter)와 console.log(device)를 호출하는 옵션입니다. 디바이스가 호환 모드인지 확인할 수 있습니다. device.features에 'core-features-and-limits'가 없는지 확인하세요.

5. 페이지를 새로고침하세요.
6. 앱이 호환 모드에서 실행되고 있는지 확인해 주세요.

   JavaScript 콘솔에서 다음과 같은 내용을 볼 수 있을 것입니다.

<div class="webgpu_center"><img src="resources/images/webgpu-compat-verification.png" style="width: 1100px" class="nobg"></div>

   위쪽에서 `webgpu-dev-extension: custom-formatters`를 찾아 형식터가 페이지에 삽입되었는지 확인하세요.

   그런 다음, `GPUDevice`를 찾아서 `features`를 확장합니다. `"core-features-and-limits"`가 **표시되지 않아야 합니다**.

# 예시들:

2026년 2월 1일 기준으로, [webgpu-samples](https://webgpu.github.io/webgpu-samples)에 있는 모든 예제들은 호환 모드에서도 정상적으로 작동합니다. 또한, [threejs.org/examples](https://threejs.org/examples/)에 있는 193개의 WebGPU 예제 중 185개도 호환 모드에서도 작동합니다. 나머지 8개의 예제도 향후 소소한 수정만으로 호환 모드에서도 작동할 수 있도록 업데이트될 예정입니다.