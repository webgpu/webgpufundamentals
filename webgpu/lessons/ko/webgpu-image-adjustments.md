Title: WebGPU 후처리: 이미지 조정
Description: 이미지 조정
TOC: 이미지 조정

이 글은 이미지 조정에 관한 짧은 시리즈의 첫 번째 글입니다. 각 글은 이전 글을 바탕으로 작성된 것이므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="image-adjustments.hanson"}}}

[기본 CRT 효과](webgpu-post-processing.html)에서는 후처리 구현 방법을 살펴봤습니다. 흔한 후처리 작업 중 하나가 이미지 조정입니다. Photoshop, GIMP, Affinity Photo 같은 이미지 편집 프로그램에서 자주 하는 작업입니다.

먼저 이미지를 불러와 후처리하는 예제를 만들어 보겠습니다. [기본 CRT 효과](webgpu-post-processing.html)의 첫 예제에 [이미지 로딩](webgpu-importing-textures.html)의 코드를 조합합니다.

기억하세요. 이전의 후처리 관련 글에서, 먼저 어떤 이미지를 텍스처로 그렸습니다. 그 다음에는 그 텍스처를 캔버스에 적용하기 위한 후처리 과정을 거쳤습니다. 여기서도 비슷한 방식을 사용할 것입니다. 하지만 이번에는 여러 개의 원을 그리는 대신, 단순히 하나의 이미지만 그려보겠습니다. [^one-pass]

[^one-pass]: 기술적으로 보면, 이미지 조정 작업을 위해 두 단계를 거칠 필요는 없습니다. 먼저 이미지를 텍스처로 변환한 다음, 그 다음에 조정을 적용하면 됩니다. 조정을 이미 그리는 동시에 적용할 수도 있습니다. 별도의 과정을 거치는 것이 좋은 점은, 어떤 상황에서도 이 방법을 사용할 수 있다는 것입니다. 예를 들어, 게임에서는 후처리를 통해 이미지를 조정하여 분위기를 조절하거나, 효과를 부여할 수 있습니다.

다음은 셰이더들의 내용입니다.

```wgsl
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct Uniforms {
  matrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;

@vertex fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
  let positions = array(
    vec2f( 0,  0),
    vec2f( 1,  0),
    vec2f( 0,  1),
    vec2f( 0,  1),
    vec2f( 1,  0),
    vec2f( 1,  1),
  );
  let pos = positions[vNdx];
  return VSOutput(
    uni.matrix * vec4f(pos, 0, 1),
    pos,
  );
}

@fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
  return textureSample(tex, smp, fsInput.texcoord);
}
```

이 셰이더는, 화면의 오른쪽 상단 모서리에 1x1 크기의 사각형을 그리는 기능을 가지고 있습니다. 이는 사실 [이미지 로딩](webgpu-importing-textures.html)에서 사용된 방식과 동일합니다. 다만 이번 경우에는, 사각형의 위치를 정하기 위해 사용된 행렬을 유니폼 버퍼에 저장하여 처리합니다. 이를 통해 사각형의 방향, 위치, 크기를 조절할 수 있습니다.

이것이 그 기능을 사용하는 데 필요한 코드입니다.

```js
import {mat4} from '../3rdparty/wgpu-matrix.module.js';

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
  });

  const module = device.createShaderModule({
    code: `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      struct Uniforms {
        matrix: mat4x4f,
      };

      @group(0) @binding(0) var<uniform> uni: Uniforms;
      @group(0) @binding(1) var tex: texture_2d<f32>;
      @group(0) @binding(2) var smp: sampler;

      @vertex fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
        let positions = array(
          vec2f( 0,  0),
          vec2f( 1,  0),
          vec2f( 0,  1),
          vec2f( 0,  1),
          vec2f( 1,  0),
          vec2f( 1,  1),
        );
        let pos = positions[vNdx];
        return VSOutput(
          uni.matrix * vec4f(pos, 0, 1),
          pos,
        );
      }

      @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
        return textureSample(tex, smp, fsInput.texcoord);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'textured unit quad',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: 'rgba8unorm' }],
    },
  });

  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // 보기: <- 이 정보는 페이지를 렌더링할 때 입력해야 합니다.
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  const imageUniformBuffer = device.createBuffer({
    size: 4 * 16,  // mat4x4
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const imageTexture = await createTextureFromImage(
    device,
    'resources/images/david-clode-clown-fish.jpg',
  );

  const imageSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  });

  const imageBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: imageUniformBuffer  },
      { binding: 1, resource: imageTexture },
      { binding: 2, resource: imageSampler },
    ],
  });

```

이 이미지는 [David Clode](https://unsplash.com/@davidclode)가 [이곳](https://unsplash.com/photos/orange-and-white-clown-fish-x9yfTxHpj5w)에서 가져온 것입니다.

후처리 코드는 첫 번째 후처리 예제와 거의 동일합니다. 사실 별다른 작업을 하지 않습니다. 단지, 불필요한 ‘uniform’ 구조체를 그대로 유지함으로써, ‘uniform buffer’ 설정 코드를 제거할 필요가 없도록 하고, 다음 단계에서 다시 그 코드를 추가할 수 있도록 하는 것입니다.

```js
  const postProcessModule = device.createShaderModule({
    code: `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32,
      ) -> VSOutput {
        var pos = array(
          vec2f(-1.0, -1.0),
          vec2f(-1.0,  3.0),
          vec2f( 3.0, -1.0),
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy, 0.0, 1.0);
        vsOutput.texcoord = xy * vec2f(0.5) + vec2f(0.5);
        return vsOutput;
      }

      struct Uniforms {
*        unused: f32,
      };

      @group(0) @binding(0) var postTexture2d: texture_2d<f32>;
      @group(0) @binding(1) var postSampler: sampler;
      @group(0) @binding(2) var<uniform> uni: Uniforms;

      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
*        _ = uni; // 따라서, 그것은 ‘bind group’에 포함되어 있습니다.
        let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
        var rgb = color.rgb;
        return vec4f(rgb, color.a);
      }
    `,
  });

  const postProcessPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: postProcessModule },
    fragment: {
      module: postProcessModule,
      targets: [ { format: presentationFormat }],
    },
  });

  const postProcessSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  });

  const postProcessRenderPassDescriptor = {
    label: 'post process render pass',
    colorAttachments: [
      { loadOp: 'clear', storeOp: 'store' },
    ],
  };

  const postProcessUniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let renderTarget;
  let postProcessBindGroup;

  function setupPostProcess(canvasTexture) {
    if (renderTarget?.width === canvasTexture.width &&
        renderTarget?.height === canvasTexture.height) {
      return;
    }

    renderTarget?.destroy();
    renderTarget = device.createTexture({
      size: canvasTexture,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const renderTargetView = renderTarget.createView();
    renderPassDescriptor.colorAttachments[0].view = renderTargetView;

    postProcessBindGroup = device.createBindGroup({
      layout: postProcessPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: renderTargetView },
        { binding: 1, resource: postProcessSampler },
        { binding: 2, resource: postProcessUniformBuffer  },
      ],
    });
  }

  function postProcess(encoder, srcTexture, dstTexture) {
    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }
```

연속으로 프레임을 그리는 대신, 이미지나 설정이 바뀔 때만 렌더링하도록 바꾸겠습니다.

```js
    const canvasTexture = context.getCurrentTexture();
    setupPostProcess(canvasTexture);

*    // CSS의 'cover' 방식
*    const canvasAspect = canvas.clientWidth / canvas.clientHeight;
*    const imageAspect = imageTexture.width / imageTexture.height;
*    const aspect = canvasAspect / imageAspect;
*    const aspectScale = aspect > 1 ? [1, aspect, 1] : [1 / aspect, 1, 1];
*
*    const matrix = mat4.identity();
*    mat4.scale(matrix, [2, 2, 1], matrix);
*    mat4.scale(matrix, aspectScale, matrix);
*    mat4.translate(matrix, [-0.5, -0.5, 1], matrix);
*
*    // 우리의 유니폼 값들을 GPU로 복사해 주세요.
*    device.queue.writeBuffer(imageUniformBuffer, 0, matrix);

    // 그 이미지를 텍스처로 변환해 주세요.
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, imageBindGroup);
    pass.draw(6);
    pass.end();

    postProcess(encoder, renderTarget, canvasTexture);

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
    }
    render();
  });
  observer.observe(canvas);
```

위의 코드는, 우리의 이미지를 `cover` 모드로 설정하는 데 필요한 행렬을 생성합니다. 다시 말해, 이 코드는 이미지를 확대하여 캔버스 전체가 이미지로 덮이도록 합니다.

조금 더 세밀한 장식들을 추가해 보겠습니다.

이제, 이미지를 드래그앤드롭할 수 있도록 해 보겠습니다. 이를 위해 도우미 라이브러리를 사용할 것입니다.

```js
+import * as dragAndDrop from './resources/js/drag-and-drop.js';

...

-  const imageTexture = await createTextureFromImage(
+  let imageTexture = await createTextureFromImage(
    device,
    'resources/images/david-clode-clown-fish.jpg',
  );

  const imageSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
  });

-  const imageBindGroup = device.createBindGroup({
+  let imageBindGroup;
+  function updateBindGroup() {
+    imageBindGroup = device.createBindGroup({
*      layout: pipeline.getBindGroupLayout(0),
*      entries: [
*        { binding: 0, resource: imageUniformBuffer  },
*        { binding: 1, resource: imageTexture },
*        { binding: 2, resource: imageSampler },
*      ],
*    });
+  }
+  updateBindGroup();

...

+  const gui = new GUI();
+  gui.name('Drag-n-Drop Image');
+  gui.onChange(render);

...

+  async function readImageFile(file) {
+    const newImageTexture = await createTextureFromImage(device, URL.createObjectURL(file));
+    imageTexture.destroy();
+    imageTexture = newImageTexture;
+    updateBindGroup();
+    render();
+  }
+
+  dragAndDrop.setup({msg: 'Drop Image File here'});
+  dragAndDrop.onDropFile(readImageFile);

```

`GUI` 부분은 필요하지 않지만, 사용자가 이미지를 드래그앤드롭할 수 있다는 것을 알려주는 역할을 합니다.

그리고, 대부분의 휴대폰들은 드래그 앤 드롭 기능을 지원하지 않으므로, 이미지를 붙여넣을 수 있도록 해 보겠습니다. 역시, 도움말 기능을 사용할 것입니다.

```js
+import onPasteImage from './resources/js/on-paste-image.js';

...

  dragAndDrop.setup({msg: 'Drop Image File here'});
  dragAndDrop.onDropFile(readImageFile);

+  onPasteImage(readImageFile);
```

이제, 휴대폰에서 이미지를 선택하여 예시 텍스트에 붙여넣을 수 있을 것입니다. 단, 이 기능은 해당 이미지가 화면의 중심에 위치할 경우에만 작동합니다. 혹은, 해당 이미지를 별도의 페이지에서 실행하는 경우에만 작동합니다.

그런 세부 사항들은 중요하지 않을 수도 있지만, 그래도 그 세부 사항들을 활용하여 자신만의 이미지를 만들어볼 수 있습니다.

자, 그럼 이제 그 작업을 시작해 보겠습니다.

{{{example url="../webgpu-post-processing-image-adjustments-noop.html"}}}

## <a id="a-brightness"></a> 밝기

아마도 가장 간단한 이미지 조정 방법은 “밝기” 조절일 것입니다. 다음은 또 다른 이미지입니다.

<div class="webgpu_center center"><div data-diagram="original" data-labels='{"type": "original"}'></div></div>
<div class="webgpu_center center"><div>
  <a href="https://unsplash.com/photos/a-happy-corgi-dog-rests-outdoors-with-tongue-out-RQFMEBJcolY">사진</a> by <a href="https://unsplash.com/@alvannee">Alvan Nee</a>
</div></div>

이제, 밝기 조절 기능을 사용하여 설정해 보겠습니다.

<div class="webgpu_center center"><div data-diagram="brightness" data-labels='{"type": "brightness"}'></div></div>

밝기 조절은 -1에서 1까지 가능합니다.

* &nbsp;0 = 조정하지 마세요.
* -1 = 밝기의 100%를 제거합니다.
* +1 = 가능한 한 밝게 만들기 [^hdr]

[^hdr]: HDR의 값은 1보다 더 높을 수도 있습니다.

이를 위해서는, 후처리 프래그먼트 셰이더에서 색상에 밝기 설정을 추가하기만 하면 됩니다.

이것이 우리의 셰이더에 대한 변경 사항입니다.

```wgsl
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

+fn adjustBrightness(color: vec3f, brightness: f32) -> vec3f {
+  return color + brightness;
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
) -> VSOutput {
  var pos = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  3.0),
    vec2f( 3.0, -1.0),
  );

  var vsOutput: VSOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy * vec2f(0.5) + vec2f(0.5);
  return vsOutput;
}

struct Uniforms {
-  unused: f32,
+  brightness: f32,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
-  _ = uni; // 따라서, 그것은 ‘bind group’에 포함되어 있습니다.
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
+  rgb = adjustBrightness(rgb, uni.brightness);
  return vec4f(rgb, color.a);
}
```

그 다음에는 밝기를 설정해야 합니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
+    device.queue.writeBuffer(
+      postProcessUniformBuffer,
+      0,
+      new Float32Array([
+        settings.brightness,
+      ]),
+    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }

+  const settings = {
+    brightness: 0,
+  };

  const gui = new GUI();
  gui.name('Drag-n-Drop Image');
  gui.onChange(render);
+  gui.add(settings, 'brightness', -1, 1);
```

그렇게 하면, 밝기를 조절할 수 있습니다.

{{{example url="../webgpu-post-processing-image-adjustments-brightness.html"}}}

# <a id="a-contrast"></a> 대비

또 다른 비교적 쉬운 단어는 “대조”입니다.

<div class="webgpu_center center"><div data-diagram="contrast" data-labels='{"type": "contrast"}'></div></div>

대비 설정의 범위는 -1부터 10까지입니다. 대비를 높일 때는 각 채널에서 0.5보다 작은 값은 0 쪽으로, 0.5보다 큰 값은 1 쪽으로 이동시켜 색상 값 사이의 간격을 넓힙니다.

이것이 셰이더에 대한 변경 사항입니다.

```wgsl
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

fn adjustBrightness(color: vec3f, brightness: f32) -> vec3f {
  return color + brightness;
}

+fn adjustContrast(color: vec3f, contrast: f32) -> vec3f {
+  let c = contrast + 1.0;
+  return clamp(0.5 + c * (color - 0.5), vec3f(0), vec3f(1));
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32,
) -> VSOutput {
  var pos = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  3.0),
    vec2f( 3.0, -1.0),
  );

  var vsOutput: VSOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = xy * vec2f(0.5) + vec2f(0.5);
  return vsOutput;
}

struct Uniforms {
  brightness: f32,
+  contrast: f32,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
  rgb = adjustBrightness(rgb, uni.brightness);
+  rgb = adjustContrast(rgb, uni.contrast);
  return vec4f(rgb, color.a);
}
```

먼저 각 색상 채널에서 0.5를 빼고, 여기에 대비 설정에 1을 더한 값을 곱한 다음 0.5를 다시 더합니다. 설정이 0이면 색이 바뀌지 않습니다. 설정이 0보다 작으면 색상 값이 0.5에 가까워지고, -1이면 모두 0.5(회색)가 됩니다. 설정이 0보다 크면 색상 값이 0.5에서 멀어집니다.

다시 한 번, 새로운 조정을 설정할 방법을 찾아야 합니다.

```js
  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.brightness,
+        settings.contrast,
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
+    contrast: 0,
  };

  const gui = new GUI();
  gui.name('Drag-n-Drop Image');
  gui.onChange(render);
  gui.add(settings, 'brightness', -1, 1);
+  gui.add(settings, 'contrast', -1, 10);
```

최대값으로 10을 설정한 것은 다소 임의적인 선택입니다. 콘트라스트 값을 곱함으로써 색상값을 0.5에서 벗어나게 만들기 때문입니다. 예를 들어, 색상값이 0.51이고 콘트라스트가 10이라면, 새로운 색상값은 0.60이 됩니다(0.5 + 10 * 0.01). 하지만 이는 1에 가까운 수치는 아닙니다. 실제로는 6보다 높은 콘트라스트 값을 사용할 필요가 있을 때도 있습니다. 그럴 경우에는 매우 낮은 콘트라스트 값을 선택해야 할 것입니다.

{{{example url="../webgpu-post-processing-image-adjustments-contrast.html"}}}

이러한 작업들은 순서에 따라 이루어진다는 점을 명심해야 합니다. 먼저 밝기를 조절하고, 그 다음에 대비를 조절합니다. 대비는 색상을 0.5에서 멀어지게 만드는 반면, 밝기는 전체 색상을 더욱 밝게 만듭니다. 따라서, 주어진 밝기 설정 하에서, 우리는 대비를 적용하기 전에 이미지 내에서 0.5 수준의 위치를 결정해야 합니다.

# <a id="a-hue-saturation-lightness"></a> 색상, 채도, 명도(HSL)

색상, 채도, 밝기 등을 조절할 수 있도록 하는 것은 일반적인 방법입니다.

<div class="webgpu_center center"><div data-diagram="hsl" data-labels='{"h": "hue", "s": "saturation", "l": "lightness"}'></div></div>

이러한 조정들은 일반적으로 함께 이루어집니다. 그 작동 방식에 대해 자세히 알아보면 그 이유를 알 수 있을 것입니다.

우리의 색상은 빨강, 초록, 파랑이라는 채널들로 표현됩니다. 각 채널의 값은 0에서 1까지입니다. 이를 큐브 형태로 나타낼 수 있습니다. 여기서 빨강은 하나의 축을 나타내고, 초록은 또 다른 축을 나타내며, 파랑은 세 번째 축을 나타냅니다.

HSL은 이러한 모든 색상을 하나의 원통형 구조로 변환합니다. 여기서 H는 원통형 구조를 둘러싸는 각도를 나타내고, S는 원통형 구조의 중심에서부터의 거리를 나타냅니다. 0은 원통형 구조의 중심에 위치한 상태를 의미하며, 1은 원통형 구조의 가장자리에 위치한 상태를 의미합니다. 1이 가장 높은 밝기를 나타냅니다. L은 원통형 구조의 길이에 따른 위치를 나타냅니다. 0은 밝기가 전혀 없는 상태를 의미하며, 1은 최대 밝기가 나타나는 상태를 의미합니다.

RGB 공간에 있는 모든 색상에는 해당하는 HSL 값이 존재합니다.

<div class="webgpu_center center">
  <div class="rgb-hsl" style="max-width: 1100px;">
    <div data-diagram="rgbDiagram" data-labels='{"r": "r", "g": "g", "b": "b"}'></div>
    <div data-diagram="hslDiagram" data-labels='{"h": "hue", "s": "saturation", "l": "lightness"}'></div>
  </div>
</div>

한 공간에서 다른 공간으로 변환하는 것은 그리 어렵지 않습니다. 사실, 이러한 변환 과정을 설명하는 것이 더 어렵습니다. 어쨌든, 여기 RGB를 HSL로 변환하는 데 사용할 수 있는 셰이더 함수가 있습니다.

```wgsl
struct HSL {
  h: f32,
  s: f32,
  l: f32,
};

fn rgbToHsl(rgb: vec3f) -> HSL {
  let cMin = min(min(rgb.r, rgb.b), rgb.g);
  let cMax = max(max(rgb.r, rgb.b), rgb.g);
  let delta = cMax - cMin;

  let l = (cMax + cMin) / 2.0;
  if (delta == 0.0) {
    return HSL(0, 0, l);
  }

  var h = 0.0;
  if (rgb.r == cMax) {
    h = (rgb.g - rgb.b) / delta;
  } else if (rgb.g == cMax) {
    h = 2.0 + (rgb.b - rgb.r) / delta;
  } else {
    h = 4.0 + (rgb.r - rgb.g) / delta;
  }
  h = h / 6.0;
  let s = delta / (1.0 - abs(2.0 * l - 1.0));
  return HSL(h, s, l);
}
```

이 함수는 0부터 1 사이의 값을 3개 반환합니다. 결과를 `vec3f`로 반환할 수도 있지만, 요소를 `x`, `y`, `z` 대신 `h`, `s`, `l`로 참조할 수 있도록 `HSL` 구조체를 선언했습니다.

이것은 HSL에서 RGB로 변환하는 반대 함수입니다.

```wgsl
fn hslToRgb(hsl: HSL) -> vec3f {
  let c = vec3f(fract(hsl.h), clamp(vec2f(hsl.s, hsl.l), vec2f(0), vec2f(1)));
  let rgb = clamp(abs((c.x * 6.0 + vec3f(0.0, 4.0, 2.0)) % 6.0 - 3.0) - 1.0, vec3f(0), vec3f(1));
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}
```

이 함수는 채도와 밝기를 0에서 1 사이로 제한합니다. 또한, `fract(hsl.h)`라는 함수를 사용하기 때문에, 어떤 값도 안전하게 입력할 수 있습니다. 예를 들어, 채도를 50으로 설정하면 그 값은 1로 간단히 조정됩니다. 색상값을 75.3으로 설정해도, 그 값은 0.3과 동일하게 처리됩니다.

이 두 함수를 활용하면, 셰이더를 수정하여 HSL 조정 기능을 포함시킬 수 있습니다.

```wgsl
...

+fn adjustHSL(color: vec3f, adjust: HSL) -> vec3f {
+  let hsl = rgbToHsl(color);
+  let newHSL = HSL(hsl.h + adjust.h, hsl.s + adjust.s, hsl.l + adjust.l);
+  return hslToRgb(newHSL);
+}

...

struct Uniforms {
  brightness: f32,
  contrast: f32,
+  @align(16) hsl: HSL,
};

@group(0) @binding(0) var postTexture2d: texture_2d<f32>;
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let color = textureSample(postTexture2d, postSampler, fsInput.texcoord);
  var rgb = color.rgb;
+  rgb = adjustHSL(rgb, uni.hsl);
  rgb = adjustBrightness(rgb, uni.brightness);
  rgb = adjustContrast(rgb, uni.contrast);
  return vec4f(rgb, color.a);
}
```

여기서 주목할 만한 점은, `Uniforms` 구조체에 `HSL`을 추가할 때 필요한 `@align(16)`입니다. 이를 필요로 하는 이유는, 유니폼 주소 공간에서 [구조체에 적용되는 16바이트 정렬 규칙](webgpu-memory-layout.html#a-struct-array-size-alignment) 때문입니다. 또한, 이 구조체는 유니폼과 스토리지 버퍼 모두에 사용될 수 있습니다. `@align(16)`를 제거하면, 이 구조체는 스토리지 버퍼로만 사용될 수 있습니다. WGSL은 이런 정렬 요구사항을 자동으로 추가하지 않으므로, 향후 이 요구사항이 사라질 경우, 구조체는 단 하나의 레이아웃만 필요하게 됩니다. 만약 지금은 `@align(16)`가 필요하지 않고, 자동으로 정렬된다면, 나중에 제한이 사라질 때 많은 코드가 작동하지 않게 될 것입니다.[^alignment]

[^alignment]: 이러한 제한을 없애는 작업은 이미 진행 중입니다. 적어도 새로운 장치들의 경우는 그렇습니다. 자세한 내용은 [이 링크를 참조하세요](https://github.com/gpuweb/gpuweb/issues/4973).

이를 사용하기 위해서는, 새로운 일관된 값을 설정하기 위해 JavaScript를 업데이트해야 합니다.

```js
  const postProcessUniformBuffer = device.createBuffer({
-    size: 16,
+    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

...

  function postProcess(encoder, srcTexture, dstTexture) {
    device.queue.writeBuffer(
      postProcessUniformBuffer,
      0,
      new Float32Array([
        settings.brightness,
        settings.contrast,
+        0,
+        0,
+        settings.hue,
+        settings.saturation,
+        settings.lightness,
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
+    hue: 0,
+    saturation: 0,
+    lightness: 0,
  };

  const gui = new GUI();
  gui.name('Drag-n-Drop Image');
  gui.onChange(render);
  gui.add(settings, 'brightness', -1, 1);
  gui.add(settings, 'contrast', -1, 10);
+  gui.add(settings, 'hue', -0.5, 0.5);
+  gui.add(settings, 'saturation', -1, 1);
+  gui.add(settings, 'lightness', -1, 1);
```

이제, 색조, 채도, 밝기를 조절할 수 있을 것입니다.

{{{example url="../webgpu-post-processing-image-adjustments-hsl.html"}}}

이미지 조정과 후처리에 대한 감을 잡으셨길 바랍니다. 다음 글 [1D 룩업 테이블(LUT)](webgpu-1dlut.html)에서는 1차원 텍스처로 더 다양한 효과를 만들어 보겠습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-image-adjustments.css" rel="stylesheet">
<script type="module" src="webgpu-image-adjustments.js"></script>
