Title: WebGPU 강조 표시
Description: 선택한 물체 강조하기
TOC: 강조 표시

이 글은 3D 편집기를 만드는 연재의 첫 번째 글입니다. 각 글은 앞 글의 예제를 이어서 사용합니다. 먼저 [장면 그래프](webgpu-scene-graphs.html)와 [기본 CRT 효과](webgpu-post-processing.html)에서 다룬 후처리를 읽었다고 가정합니다.

{{{toc-steps list="editor.hanson"}}}

블렌더나 마야, 유니티, 언리얼과 같은 3D 편집기에서 영감을 받아, 간단한 3D 편집기를 만들고 싶습니다. 3D 공간에서 객체를 선택하고 조작할 수 있는 기능이 필요합니다. 이런 기능은 [장면 그래프](webgpu-scene-graphs.html)에서 시작되었습니다. 그 문서에서는 노드를 사용하여 UI의 버튼을 클릭하여 해당 노드의 이동, 회전, 크기 조절을 수정할 수 있었습니다. 어떤 노드가 선택되었는지 시각적으로 확인할 수 있다면 좋겠습니다. 그렇게 하도록 하겠습니다.

[장면 그래프에 GUI 추가하기](webgpu-scene-graphs.html#a-gui)에서 만든 노드 선택 예제로 시작하겠습니다.

<div class="webgpu_center center">
  <div data-diagram="standardPass" style="width: 600px"></div>
</div>

선택한 물체만 별도 텍스처에 렌더링해 강조 표시에 사용할 마스크를 만듭니다.

<div class="webgpu_center center">
  <div data-diagram="selectedPass" style="width: 600px"></div>
</div>

알파 값들은 선택된 오브젝트들의 실루엣을 만들어줄 것입니다.

<div class="webgpu_center center">
  <div data-diagram="alpha" style="width: 600px"></div>
</div>

그렇게 하면, 그 알파 마스크를 후처리 과정의 입력으로 사용할 수 있습니다. 즉, 마스크의 알파 값이 0이지만, 근처에 0이 아닌 값이 있다면, 그 부분에 하이라이트 색상을 적용할 수 있습니다. 이렇게 하면 실제로 윤곽선이 생성됩니다.

<div class="webgpu_center center">
  <div data-diagram="outline" style="width: 600px"></div>
</div>

이것은 알파 마스크가 주어졌을 때 윤곽선을 그리는 후처리 방식입니다.

```wgsl
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
  vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
  return vsOutput;
}

@group(0) @binding(0) var mask: texture_2d<f32>;

fn isOnEdge(pos: vec2i) -> bool {
  // 참고로, 우리는 제한을 넘어서는 행동을 하지 않도록 주의해야 합니다.
  // 텍셀의 좌표는 textureLoad와 일치해야 합니다. 그렇지 않으면 문제가 발생할 수 있습니다.
  // 다양한 GPU에서 다른 결과가 나타날 수 있습니다.
  let size = vec2i(textureDimensions(mask, 0));
  let start = max(pos - 2, vec2i(0));
  let end = min(pos + 2, size);

  for (var y = start.y; y <= end.y; y++) {
    for (var x = start.x; x <= end.x; x++) {
      let s = textureLoad(mask, vec2i(x, y), 0).a;
      if (s > 0) {
        return true;
      }
    }
  }
  return false;
};

@fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
  let pos = vec2i(fsInput.position.xy);

  // 현재의 texel 값을 가져오세요.
  // 만약 0이 아니라면, 우리는 선택된 객체들 안에 있습니다.
  let s = textureLoad(mask, pos, 0).a;
  if (s > 0) {
    discard;
  }

  let hit = isOnEdge(pos);
  if (!hit) {
    discard;
  }
  return vec4f(1, 0.5, 0, 1); // 오렌지
}
```

셰이더는 먼저 마스크 내의 픽셀이 0보다 큰지 확인합니다. 만약 그렇다면, 그 픽셀은 마스크 내에 있으므로, 선택된 오브젝트에 해당합니다. 따라서 아무것도 그려주고 싶지 않으므로, `discard`를 사용합니다.

마스크에 포함되지 않은 픽셀에서는 `isOnEdge`로 이웃 픽셀을 확인합니다. 값이 0보다 큰 이웃이 하나도 없으면 윤곽선이 아니므로 `discard`로 프래그먼트를 버립니다.

그렇지 않으면, 우리는 위험한 상황에 처하게 되고, 주황색으로 표시될 것입니다.

셰이더가 준비되었으니 [기본 CRT 효과](webgpu-post-processing.html)에서 사용한 후처리 코드를 가져오겠습니다.

```js
  const postProcessModule = device.createShaderModule({
    code: /* wgsl */ `
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
        vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
        return vsOutput;
      }

      @group(0) @binding(0) var mask: texture_2d<f32>;

      fn isOnEdge(pos: vec2i) -> bool {
        // 참고로, 우리는 제한을 넘어서는 행동을 하지 않도록 주의해야 합니다.
        // 텍셀의 좌표는 textureLoad와 일치해야 합니다. 그렇지 않으면 문제가 발생할 수 있습니다.
        // 다양한 GPU에서 다른 결과가 나타날 수 있습니다.
        let size = vec2i(textureDimensions(mask, 0));
        let start = max(pos - 2, vec2i(0));
        let end = min(pos + 2, size);

        for (var y = start.y; y <= end.y; y++) {
          for (var x = start.x; x <= end.x; x++) {
            let s = textureLoad(mask, vec2i(x, y), 0).a;
            if (s > 0) {
              return true;
            }
          }
        }
        return false;
      };

      @fragment fn fs2d(fsInput: VSOutput) -> @location(0) vec4f {
        let pos = vec2i(fsInput.position.xy);

        // 현재 값을 얻습니다. 만약 그 값이 0이 아니라면, 우리는 선택된 객체들 안에 있습니다.
        let s = textureLoad(mask, pos, 0).a;
        if (s > 0) {
          discard;
        }

        let hit = isOnEdge(pos);
        if (!hit) {
          discard;
        }
        return vec4f(1, 0.5, 0, 1);
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

-  const postProcessSampler = device.createSampler({
-    minFilter: 'linear',
-    magFilter: 'linear',
-  });

  const postProcessRenderPassDescriptor = {
    label: 'post process render pass',
    colorAttachments: [
-      { loadOp: 'clear', storeOp: 'store' },
+      { loadOp: 'load', storeOp: 'store' },
    ],
  };

-  let renderTarget;
  let postProcessBindGroup;
+  let lastPostProcessTexture;

  function setupPostProcess(texture) {
-    if (renderTarget?.width === canvasTexture.width &&
-        renderTarget?.height === canvasTexture.height) {
-      return;
-    }
-
-    renderTarget?.destroy();
-    renderTarget = device.createTexture({
-      size: canvasTexture,
-      format: 'rgba8unorm',
-      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
-    });
-    const renderTargetView = renderTarget.createView();
-    renderPassDescriptor.colorAttachments[0].view = renderTargetView;

+    if (!postProcessBindGroup || texture !== lastPostProcessTexture) {
+      lastPostProcessTexture = texture;
*      postProcessBindGroup = device.createBindGroup({
*        layout: postProcessPipeline.getBindGroupLayout(0),
*        entries: [
-          { binding: 0, resource: renderTargetView },
-          { binding: 1, resource: postProcessSampler },
-          { binding: 2, resource: postProcessUniformBuffer },
+          { binding: 0, resource: texture },
*        ],
*      });
+    }
  }

  function postProcess(encoder, srcTexture, dstTexture) {
-    device.queue.writeBuffer(
-      postProcessUniformBuffer,
-      0,
-      new Float32Array([
-        settings.affectAmount,
-        settings.bandMult,
-        settings.cellMult,
-        settings.cellBright,
-      ]),
-    );

    postProcessRenderPassDescriptor.colorAttachments[0].view = dstTexture.createView();
    const pass = encoder.beginRenderPass(postProcessRenderPassDescriptor);
    pass.setPipeline(postProcessPipeline);
    pass.setBindGroup(0, postProcessBindGroup);
    pass.draw(3);
    pass.end();
  }
```

또한, 렌더링할 때는 후처리 오브젝트도 사용해야 합니다.

```js
+  let selectedMeshes = [];

  function render() {

    ...

-    const encoder = device.createCommandEncoder();
-    const pass = encoder.beginRenderPass(renderPassDescriptor);
-    pass.setPipeline(pipeline);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60), // fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    // 우리가 계산한 행렬에서 카메라의 위치를 알아내세요.
    const cameraMatrix = mat4.identity();
    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);

    // 뷰 행렬을 계산합니다.
    const viewMatrix = mat4.inverse(cameraMatrix);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

+    const encoder = device.createCommandEncoder();
+    {
+      const pass = encoder.beginRenderPass(renderPassDescriptor);
+      pass.setPipeline(pipeline);

*      const ctx = { pass, viewProjectionMatrix };
*      root.updateWorldMatrix();
*      for (const mesh of meshes) {
*        drawMesh(ctx, mesh);
*      }
*
*      pass.end();
+    }

+    // 선택된 오브젝트들을 포스트테크스처로 드래그합니다.
+    {
+       if (!postTexture ||
+            postTexture.width !== canvasTexture.width)
+            postTexture.height !== canvasTexture.height) {
+         postTexture?.destroy();
+         postTexture = device.createTexture({
+          format: canvasTexture.format,
+          canvasTexture, // 크기에 관해서는…
+          usage: GPUTextureUsage.RENDER_ATTACHMENT |
+                 GPUTextureUsage.TEXTURE_BINDING,
+         });
+       }
+      setupPostProcess(postTexture);
+
+      renderPassDescriptor.colorAttachments[0].view = postTexture.createView();
+      const pass = encoder.beginRenderPass(renderPassDescriptor);
+      pass.setPipeline(pipeline);
+
+      const ctx = { pass, viewProjectionMatrix };
+      for (const mesh of selectedMeshes) {
+        drawMesh(ctx, mesh);
+      }
+
+      pass.end();
+
+      // postTexture의 알파 값을 기반으로 윤곽선을 그립니다.
+      // 캔버스 위로… 텍스처를 적용합니다.
+      postProcess(encoder, undefined, canvasTexture);
+    }

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }
```

위의 코드는 원래의 장면을 그립니다. 그런 다음 `selectedMeshes`를 `postTexture`에 그립니다. 이렇게 얻은 `postTexture`를 후처리 코드에 전달하여, `canvasTexture` 위에 윤곽선을 그립니다.

만약 다른 객체의 크기가 변했다면, 두 개의 코드를 사용하여 그 텍스처를 재생성할 수 있습니다. 하지만 이 경우, 도우미 함수를 추가함으로써 코드를 좀 더 간단하게 만들 수 있습니다.

```js
+  function makeNewTextureIfSizeDifferent(texture, size, format, usage) {
+    if (!texture ||
+        texture.width !== size.width ||
+        texture.height !== size.height) {
+      texture?.destroy();
+      texture = device.createTexture({
+        format,
+        size,
+        usage,
+      });
+    }
+    return texture;
+  }

...

  function render() {
    ...

    // 만약 깊이 텍스처가 없거나, 혹은 그 크기가 다른 경우라면…
    // 새로운 깊이 텍스처를 생성할 때, 캔버스 텍스처에서 발생하는 문제들
-    if (!depthTexture ||
-        depthTexture.width !== canvasTexture.width ||
-        depthTexture.height !== canvasTexture.height) {
-      if (depthTexture) {
-        depthTexture.destroy();
-      }
-      depthTexture = device.createTexture({
-        size: [canvasTexture.width, canvasTexture.height],
-        format: 'depth24plus',
-        usage: GPUTextureUsage.RENDER_ATTACHMENT,
-      });
-    }
+    depthTexture = makeNewTextureIfSizeDifferent(
+      depthTexture,
+      canvasTexture, // 크기에 맞게
+      'depth24plus',
+      GPUTextureUsage.RENDER_ATTACHMENT,
+    );

...

    // 선택된 오브젝트들을 포스트테크스처로 드래그합니다.
    {
-      if (!postTexture ||
-           postTexture.width !== canvasTexture.width)
-           postTexture.height !== canvasTexture.height) {
-        postTexture?.destroy();
-        postTexture = device.createTexture({
-         format: canvasTexture.format,
-         canvasTexture, // 크기에 관해서는…
-         usage: GPUTextureUsage.RENDER_ATTACHMENT |
-                GPUTextureUsage.TEXTURE_BINDING,
-        });
-      }
+      postTexture = makeNewTextureIfSizeDifferent(
+        postTexture,
+        canvasTexture, // 크기에 맞게
+        canvasTexture.format,
+        GPUTextureUsage.RENDER_ATTACHMENT |
+        GPUTextureUsage.TEXTURE_BINDING,
+      );
      setupPostProcess(postTexture);
```

남은 것은, `selectedMeshes`에 값을 채워넣는 방법을 찾는 것입니다. 문제는, 모든 요소를 큐브로 구성했으며, 기본적으로 일부 노드들은 숨겨져 있다는 점입니다. 따라서 `selectedMeshes`를 설정할 때는 해당 노드의 모든 자식들을 확인하여 더 많은 메시가 있는지 확인해야 합니다.

```js
+  function meshUsesNode(mesh, node) {
+    if (!node) {
+      return false;
+    }
+    if (mesh.node === node) {
+      return true;
+    }
+    for (const child of node.children) {
+      if (meshUsesNode(mesh, child)) {
+        return true;
+      }
+    }
+    return false;
+  }

  const kUnelected = '\u3000'; // 전체 너비의 공간
  const kSelected = '➡️';
  const prefixRE = new RegExp(`^(?:${kUnelected}|${kSelected})`);

  function setCurrentSceneGraphNode(node) {
    trsUIHelper.setTRS(node.source);
    trsFolder.name(`orientation: ${node.name}`);
    trsFolder.updateDisplay();

    // Mark는 어떤 노드가 선택되었는지를 나타냅니다.
    for (const b of nodeButtons) {
      const name = b.button.getName().replace(prefixRE, '');
      b.button.name(`${b.node === node ? kSelected : kUnelected}${name}`);
    }

+    selectedMeshes = meshes.filter(mesh => meshUsesNode(mesh, node));

+    render();
  }
```

이제 선택한 물체의 윤곽선이 표시됩니다.

{{{example url="../webgpu-highlighting.html"}}}

이제 선택한 노드를 강조할 수 있습니다. 다음 글인 [카메라 조작](webgpu-camera-controls.html)에서는 GUI 버튼 대신 드래그로 카메라를 움직이겠습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-highlighting.css" rel="stylesheet">
<script type="module" src="webgpu-highlighting.js"></script>
