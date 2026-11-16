Title: 기타 셰이더 입력
Description: 셰이더에 데이터를 전달하는 다른 방법
TOC: 기타 셰이더 입력

이 글은 셰이더에 데이터를 전달하는 다양한 방법에 대한 시리즈 중 하나입니다.
각 글은 이전 내용을 바탕으로 작성되었으므로 순서대로 읽는 것이 가장 이해하기 좋습니다.

{{{toc-steps list="passing-data.hanson"}}}

이전 글에서는 셰이더에 데이터를 전달하고 셰이더로부터 데이터를 받는 일반적인 방법을 살펴보았습니다. 인터 스테이지 변수, 유니폼 버퍼, 스토리지 버퍼, 정점 버퍼, 텍스처가 있었습니다.

덜 일반적이지만 때로는 매우 유용한 방법도 몇 가지 있습니다.

그중 하나는 `draw` 또는 `drawIndexed` 명령을 호출할 때 `firstInstance` 값을 전달하는 것입니다.

```js
pass.draw(numVertices,
          numInstances = 1,
          firstVertex = 0,
          firstInstance = 0); // <== 여기
pass.drawIndexed(indexCount,
                 instanceCount = 1,
                 firstIndex = 0,
                 baseVertex = 0,
                 firstInstance = 0); // <== 여기
```

이 값은 셰이더에서 `@builtin(instance_index)`로 나타납니다. 따라서 이전 글에서처럼 실제 인스턴싱에 사용하고 있지 않다면 이 값으로 무언가를 선택할 수 있습니다.

예를 들어 [첫 번째 글](webgpu-fundamentals.html)의 간단한 삼각형 예제를 수정해 보겠습니다.

```wgsl
+struct VertexOut {
+  @builtin(position) pos: vec4f,
+  @location(0) @interpolate(flat, either) colorNdx: u32,
+};

@vertex fn vs(
*  @builtin(vertex_index) vertexIndex : u32,
+  @builtin(instance_index) instanceIndex: u32,
) -> VertexOut {
  let pos = array(
    vec2f( 0.0,  0.5),  // 상단 중앙
    vec2f(-0.5, -0.5),  // 왼쪽 아래
    vec2f( 0.5, -0.5)   // 오른쪽 아래
  );
+  let offsets = array(
+    vec2f( 0.0,  0.5),  // 상단 중앙
+    vec2f(-0.5, -0.5),  // 왼쪽 아래
+    vec2f( 0.5, -0.5),  // 오른쪽 아래
+  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return VertexOut(
+    vec4f(pos[vertexIndex] + offsets[instanceIndex], 0.0, 1.0),
+    instanceIndex,
+  );
}

-@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(1, 0, 0, 1);
-}
+@fragment fn fs(in: VertexOut) -> @location(0) vec4f {
+  let colors = array(
+    vec4f(1, 1, 0, 1),  // 노란색
+    vec4f(0, 1, 1, 1),  // 청록색
+    vec4f(1, 0, 1, 1),  // 자홍색
+  );
+  return colors[in.colorNdx];
+}
```

위 코드는 `instanceIndex`로 오프셋을 선택합니다. 그런 다음 `@interpolate(flat, either)` 인터 스테이지 변수로 이 값을 프래그먼트 셰이더에 전달합니다. `flat`은 "보간하지 않음"을 뜻하고, `either`는 그려지는 각 삼각형의 첫 번째 정점이나 마지막 정점의 값을 사용한다는 뜻입니다. 모든 정점에 같은 값을 전달하므로 어느 쪽이든 상관없지만, `either`는 호환성 모드에서도 동작하므로 더 좋은 선택입니다.

마지막으로 `draw` 호출을 수정하여 3번 그리면 됩니다.

```js
    function render() {
      // 캔버스 컨텍스트에서 현재 텍스처를 가져와
      // 렌더링 대상 텍스처로 설정합니다.
      renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

      const encoder = device.createCommandEncoder({ label: 'our encoder' });
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);
      pass.draw(3);  // 정점 셰이더를 3번 호출
+      pass.draw(3, 1, 0, 1); // instance_index에 1 전달
+      pass.draw(3, 1, 0, 2); // instance_index에 2 전달
      pass.end();

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    }
```

그러면 다음과 같은 결과가 나옵니다.

{{{example url="../webgpu-misc-instance-index.html"}}}

셰이더에 배열을 하드 코딩했지만, 같은 방식으로 스토리지 버퍼 배열의 데이터를 선택할 수도 있습니다.

```wgsl
struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat, either) instanceIndex: u32,
};

struct PerInstanceInfo {
  matrix: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<storage, read> perInst: array<PerInstanceInfo>;

@vertex fn vs(
  @location(0) position: vec4f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOut {
  let info = perInst[instanceIndex];

  return VertexOut(
    info.matrix * position,
    instanceIndex,
  );
}

@fragment fn fs(in: VertexOut) -> @location(0) vec4f {
  let info = perInst[in.instanceIndex];
  return info.color;
}
```

이 방법을 언제 사용할지는 여러분에게 달려 있습니다. 그리기 호출 사이의 작은 변경에는 [Immediates](webgpu-immediates.html)를 사용할 수도 있습니다. `firstInstance`의 장점은 WebGPU 호출이 더 적고 숫자 하나를 전달하기 위해 `ArrayBufferView`가 필요하지 않다는 것입니다.

[밉맵 생성 코드가 호환성 모드에서 동작하도록 만들 때](webgpu-compatibility-mode.html#a-generating-mipmaps) 이 방법을 사용합니다. 유니폼 버퍼를 설정하지 않고도 2D 배열이나 큐브 맵의 슬라이스를 쉽게 선택할 수 있기 때문입니다.

`vertex_index`도 같은 방식으로 제어할 수 있습니다. 이 역시 `draw` 호출의 매개변수입니다. 하지만 일반적으로 정점을 선택하는 데 필요하므로 데이터를 전달하는 데 사용할 수 있는 경우는 더 드뭅니다.