Title: WebGPU 스카이박스
Description: 스카이박스로 하늘 그리기
TOC: 스카이박스


이 글은 [환경 맵](webgpu-environment-maps.html)의 연속적인 내용입니다.

*스카이박스*란, 모든 방향에서 하늘처럼 보이도록 처리된 텍스처가 적용된 상자입니다. 혹은, 지평선을 포함하여 아주 멀리 있는 곳의 모습을 표현하는 것도 가능합니다. 마치 방 안에 서 있는 것처럼 상상해 보세요. 각각의 벽에는 실제 크기의 그림이 있고, 천장에는 하늘을 나타내는 그림이 있으며, 바닥에는 땅을 나타내는 그림이 있습니다. 이것이 바로 스카이박스입니다.

많은 3D 게임들은 단순히 큐브를 만들어서 그 크기를 매우 크게 만든 다음, 그 위에 하늘의 질감을 입힌 것입니다.

이 방법에도 몇 가지 문제가 있습니다. 카메라가 어느 쪽을 향하든 큐브의 면은 멀리 있어야 하지만 모서리가 클리핑 평면을 넘어서는 안 됩니다. 성능도 고려해야 합니다. GPU는 깊이 텍스처를 사용해 깊이 테스트를 통과하지 못할 픽셀의 처리를 건너뛸 수 있으므로, 스카이박스는 마지막에 그리는 편이 좋습니다. 실제 큐브를 그리면 바라보는 방향에 따라 면보다 모서리까지의 거리가 더 길어집니다.

<div class="webgpu_center"><img src="resources/skybox-issues.svg" style="width: 500px"></div>

위에서 볼 수 있듯이, 큐브의 가장 먼 부분이 프레스턴 내부에 있도록 해야 합니다. 하지만 그렇게 하면 큐브의 일부 모서리들이 원하지 않는 물체들을 가릴 수도 있습니다.

일반적인 해결 방법은 깊이 테스트를 비활성화하고 먼저 스카이박스를 그리는 것입니다. 하지만 그렇게 하면, 나중에 장면에 물체를 추가할 때 필요한 픽셀들을 그릴 수 없게 되어 성능상의 이점을 얻을 수 없습니다.

큐브를 그리는 대신 [클립 공간을 덮는 큰 삼각형](webgpu-large-triangle-to-cover-clip-space.html)을 그리고 [큐브맵](webgpu-cube-maps.html)을 사용하겠습니다. 보통 뷰 투영 행렬로 3D 공간의 도형을 투영합니다. 여기서는 이 과정을 거꾸로 진행합니다. 뷰 투영 행렬의 역행렬로 그리는 각 픽셀에서 카메라가 바라보는 방향을 구합니다. 이 방향으로 큐브맵을 샘플링하면 됩니다.

먼저, [환경 맵](webgpu-environment-maps.html)부터 시작해 보겠습니다. 이 예시에서는 이미 큐브맵이 로드되어 있고, 그에 대한 MIP 이미지도 생성되어 있습니다. 이제, 고정된 삼각형을 사용해 보겠습니다. 다음은 셰이더의 코드입니다.

```wgsl
struct Uniforms {
  viewDirectionProjectionInverse: mat4x4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) pos: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
  let pos = array(
    vec2f(-1, 3),
    vec2f(-1,-1),
    vec2f( 3,-1),
  );
  var vsOut: VSOutput;
  vsOut.position = vec4f(pos[vNdx], 1, 1);
  vsOut.pos = vsOut.position;
  return vsOut;
}
```

위에서 볼 수 있듯이, 먼저 `@builtin(position)`을 `vsOut.position`을 통해 우리의 정점 위치로 설정합니다. 또한 z 값을 1로 설정하여, 그 quad가 가장 멀리 위치할 때를 나타내도록 합니다. 또한, 정점 위치를 프래그먼트 셰이더에도 전달합니다.

프래그먼트 셰이더에서 클립 공간 위치에 역행렬을 적용하고 결과의 XYZ를 W로 나눕니다. 위치를 동차 좌표에서 3차원 좌표로 되돌리는 과정으로, 일반적인 렌더링에서는 GPU가 `@builtin(position)`에 대해 처리합니다.

```glsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  let t = uni.viewDirectionProjectionInverse * vsOut.pos;
  return textureSample(ourTexture, ourSampler, normalize(t.xyz / t.w) * vec3f(1, 1, -1));
}
```

참고: z 방향의 값을 -1로 곱하는 것은, [반사 방향을 수정하기](webgpu-environment-maps.html#a-flipped)에서 설명한 이유 때문입니다.

이 파이프라인에는 정점 단계에서 버퍼가 존재하지 않습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'no attributes',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less-equal',
      format: 'depth24plus',
    },
  });
```

깊이 텍스처를 1.0으로 지우고 스카이박스도 깊이 1.0에 그립니다. 기본 `less` 비교에서는 두 값이 같으면 그리지 않으므로, 이 경우에는 `less-equal`를 사용합니다.

다시 한 번, 우리는 유니폼 버퍼를 설정해야 합니다.

```js
  // viewDirectionProjectionInverse
  const uniformBufferSize = (16) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
  const kViewDirectionProjectionInverseOffset = 0;

  const viewDirectionProjectionInverseValue = uniformValues.subarray(
      kViewDirectionProjectionInverseOffset,
      kViewDirectionProjectionInverseOffset + 16);
```

그리고 렌더링 시간에 그 값을 설정합니다.

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
    );
    // 카메라가 원점에서 벗어나서 다시 원점을 향해 돌아가는 모습입니다.
    const cameraPosition = [Math.cos(time * .1), 0, Math.sin(time * .1)];
    const view = mat4.lookAt(
      cameraPosition,
      [0, 0, 0],  // 목표/대상
      [0, 1, 0],  // 위로
    );
    // 방향만 필요하므로 이동 성분은 생략합니다.
    view[12] = 0;
    view[13] = 0;
    view[14] = 0;

    const viewProjection = mat4.multiply(projection, view);
    mat4.inverse(viewProjection, viewDirectionProjectionInverseValue);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

위에서 보듯이, 우리는 카메라를 원점을 기준으로 회전시킵니다. 그렇게 하면 `cameraPosition`을 계산할 수 있습니다. 그 다음, `view` 행렬을 만들고, 카메라가 어느 방향을 향하고 있는지만을 고려합니다. 카메라가 실제로 어디에 위치해 있는지는 중요하지 않습니다.

그 다음, 그 결과에 투영 행렬을 곱합니다. 그 다음, 역행렬을 구한 뒤, 그 행렬을 설정합니다.

{{{example url="../webgpu-skybox.html" }}}

이제, 매핑된 큐브를 다시 이 샘플에 통합해 보겠습니다. 먼저, 여러 변수들의 이름을 바꾸어 보겠습니다.

스카이박스의 예시에서

```
module -> skyBoxModule
pipeline -> skyBoxPipeline
uniformBuffer -> skyBoxUniformBuffer
uniformValues -> skyBoxUniformValues
bindGroup -> skyBoxBindGroup
```

환경 맵의 예시에서도 마찬가지입니다.

```
module -> envMapModule
pipeline -> envMapPipeline
uniformBuffer -> envMapUniformBuffer
uniformValues -> envMapUniformValues
bindGroup -> envMapBindGroup
```

이렇게 이름이 변경된 경우, 우리는 렌더링 코드를 업데이트해야 합니다. 먼저, 두 경우 모두에 대한 유니폼 값을 업데이트해야 합니다.

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
        projectionValue,
    );
    // 카메라가 원점에서 벗어나서 다시 원점을 향해 돌아가는 모습입니다.
    cameraPositionValue.set([Math.cos(time * .1) * 5, 0, Math.sin(time * .1) * 5]);
    const view = mat4.lookAt(
      cameraPositionValue,
      [0, 0, 0],  // 목표/대상
      [0, 1, 0],  // 위로
    );
    // 우리가 앞으로 진행할 작업을 고려하여, 그 뷰를 viewValue에 복사해 두도록 합시다.
    // 뷰 행렬의 이동 성분을 0으로 설정합니다.
    viewValue.set(view);

    // 방향만 필요하므로 이동 성분은 생략합니다.
    view[12] = 0;
    view[13] = 0;
    view[14] = 0;
    const viewProjection = mat4.multiply(projectionValue, view);
    mat4.inverse(viewProjection, viewDirectionProjectionInverseValue);

    // 큐브를 회전시켜 주세요.
    mat4.identity(worldValue);
    mat4.rotateX(worldValue, time * -0.1, worldValue);
    mat4.rotateY(worldValue, time * -0.2, worldValue);

    // 유니폼 값을 유니폼 버퍼에 업로드합니다.
    device.queue.writeBuffer(envMapUniformBuffer, 0, envMapUniformValues);
    device.queue.writeBuffer(skyBoxUniformBuffer, 0, skyBoxUniformValues);
```

그런 다음, 둘 다 렌더링합니다. 먼저 환경을 렌더링하고, 그 다음에 스카이박스를 렌더링합니다. 이렇게 하면 스카이박스를 나중에 렌더링하는 것이 가능하다는 것을 확인할 수 있습니다.

```js
    // 큐브를 그려보세요.
    pass.setPipeline(envMapPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint16');
    pass.setBindGroup(0, envMapBindGroup);
    pass.drawIndexed(numVertices);

    // 하늘박스를 그려보세요.
    pass.setPipeline(skyBoxPipeline);
    pass.setBindGroup(0, skyBoxBindGroup);
    pass.draw(3);
```

{{{example url="../webgpu-skybox-plus-environment-map.html" }}}

이 두 가지 글이, 큐브맵을 어떻게 사용하는지에 대한 아이디어를 제공했기를 바랍니다. 예를 들어, [스포트라이트](webgpu-lighting-spot.html)의 조명 계산 코드를 사용하여 얻은 결과와 환경 맵의 결과를 결합함으로써, 자동차의 후드나 매끄러운 바닥과 같은 재질들을 만들 수 있습니다.
