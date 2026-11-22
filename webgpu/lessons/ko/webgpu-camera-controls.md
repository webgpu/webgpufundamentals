Title: WebGPU 카메라 조작
Description: 카메라 조작하기
TOC: 카메라 조작

이 글은 3D 편집기용 부품을 만드는 방법에 관한 짧은 시리즈의 두 번째 글입니다. 각 글은 이전 글을 바탕으로 작성된 것이므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="editor.hanson"}}}

# 궤도 카메라(Orbit Camera)

Blender, Unity, Maya, 3ds Max, Unreal 같은 3D 편집기에서는 특정 버튼이나 키를 누르고 포인터를 드래그해 장면의 한 점을 중심으로 카메라를 돌릴 수 있습니다. 이를 궤도 카메라라고 합니다.

제가 알기로는, 어떤 단어들은 영화에서 유래했고, 또 다른 단어들은 항공 분야에서 유래한 것 같습니다.

* 팬(pan)은 카메라의 위치를 유지한 채 좌우로 돌리는 조작입니다.

  휴대폰으로 파노라마 사진을 찍을 때는, 카메라를 원형으로 회전시켜야 합니다.

* 틸트(tilt)는 카메라의 위치를 유지한 채 위아래로 돌리는 조작입니다.

  만약 서 있다면, 카메라를 기울여서 꽃을 사진으로 찍거나, 카메라를 위로 들어서 비행기를 사진으로 찍을 수 있습니다.

* 롤(roll)은 카메라가 바라보는 축을 중심으로 기울이는 조작입니다. 고개를 한쪽 어깨로 기울이는 것과 같습니다.

  지평선은 더 이상 평평하지 않습니다.

* 돌리(dolly)는 카메라 자체를 대상에 가깝게 또는 멀게 이동시키는 조작입니다.

  돌리를 줌이라고 부르기도 하지만, 렌즈의 줌은 시야각을 바꾸고 돌리는 카메라의 위치를 바꿉니다.

* 트랙(track)은 카메라가 바라보는 방향에 수직인 평면에서 카메라를 이동시키는 조작입니다.

  이 이름은 영화 촬영에서 카메라를 움직이는 데 쓰는 [트랙](https://en.wikipedia.org/wiki/Tracking_shot)에서 유래한 것으로 보입니다.

카메라 조작을 구현하는 한 가지 방법은 리그(rig)를 만드는 것입니다. 3D에서 리그는 장면 그래프 노드의 계층 구조로, 동작 범위를 제한하는 조건을 포함할 수도 있습니다.

이와 같은 계층 구조를 만들 수 있습니다.

```
+-camTarget (anchors the center of rotation)
  +-camPitch (lets us "pan" around the target)
    +-camTilt (lets us "tilt" above or below the target)
      +-camExtend (lets us "dolly" the camera closer or further from the target)
        +-cam (gives us a camera matrix)
```

실제 부품으로 조립한 기계 장치를 떠올려 보세요. 전차를 예로 들면 차체가 `camTarget`입니다. 차체 위에서 돌아가는 포탑은 `camPitch`입니다. 포신을 위아래로 움직이는 부분은 `camTilt`이고, 포신 자체는 `camExtend`입니다. 포신이 늘어나거나 줄어들어 길이를 바꿀 수 있다고 생각해 보세요. 그리고 포신 끝에 **차체 쪽을 바라보도록** 카메라를 붙입니다.

<div class="webgpu_center">
  <div data-diagram="camera-rig" style="width: 600px;"></div>
</div>

위의 다이어그램에서:

* 파란색 배경이 바로 `camTarget`입니다.
* 그린 헤드는 `camPitch`입니다.
* 빨간색 힌지는 `camTilt`입니다.
* 분홍색/보라색 색상의 부분이 바로 `camExtend`입니다.
* 그 흰색 프레임은, `cam` 위치에 있는 카메라가 `camTarget`을 향해 뒤를 바라보고 있는 모습을 나타냅니다.

그림의 부품을 알아보기 쉽게 서로 떨어뜨려 놓았습니다. 실제 카메라 리그에서처럼 부품을 제 위치에 모으려면 `collapse`를 켜 보세요.

어쨌든, 그 카메라 장비를 만들어보자.

먼저, UI 관련 사소한 수정 사항들을 해 보겠습니다. 결국 사용자가 장면 위에서 드래그하여 카메라를 조정할 수 있도록 하고 싶으므로, 컨트롤러를 3D 편집기처럼 만들어보겠습니다. 즉, 사용자가 장면 위에 마우스를 올리는 대신, 오른쪽에 일정한 공간이 생성됩니다. 또한, 사용자가 컨트롤러를 닫으면 장면이 그 공간을 채우도록 설정할 것입니다.

먼저, 몇 가지 HTML 태그를 변경해야 합니다.

```html
+<div id="split">
*  <canvas></canvas>
+  <div id="ui"></div>
+</div>
```

그리고 해당 CSS도 함께 제공됩니다.

```css
#split {
  display: flex;
  height: 100%;
}
#ui {
  border-left: 1px solid #888;
}
#ui.hide-ui {
  right: 0;
  position: absolute;
}
#split > :nth-child(1) {
  flex: 1 1 auto;
  min-width: 0;
}
```

그런 다음, UI 요소들을 `#ui` 이Div 안으로 이동시킵니다. 그리고 UI 상태에 따라 해당 Div의 CSS 클래스를 업데이트합니다.

```js
-  const gui = new GUI();
-  gui.onChange(render);
+  const uiElem = document.querySelector('#ui');
+  const gui = new GUI({
+    parent: uiElem,
+  });
+  gui.onChange(() => {
+    uiElem.classList.toggle('hide-ui', !gui.isOpen());
+    render();
+  });
```

이제 장면 그래프 노드로 궤도 카메라를 만들어 보겠습니다.

다음은 궤도 카메라 리그입니다.

```js
  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // 카메라 리그 생성하기
      this.#camTarget = addTRSSceneGraphNode('cam-target');
      this.#camPan = addTRSSceneGraphNode('cam-pan', this.#camTarget);
      this.#camTilt = addTRSSceneGraphNode('cam-tilt', this.#camPan);
      this.#camExtend = addTRSSceneGraphNode('cam-extend', this.#camTilt);
      this.#cam = addTRSSceneGraphNode('cam', this.#camExtend);
    }

    setParent(parent) {
      this.#camTarget.setParent(parent);
    }

    getCameraMatrix() {
      return this.#cam.worldMatrix;
    }

    get pan() { return this.#camPan.source.rotation[1]; }
    set pan(v) { this.#camPan.source.rotation[1] = v; }
    get tilt() { return this.#camTilt.source.rotation[0]; }
    set tilt(v) { this.#camTilt.source.rotation[0] = v; }
    get radius() { return this.#camExtend.source.translation[2]; }
    set radius(v) { this.#camExtend.source.translation[2] = v; }
    get target() { return vec3.copy(this.#camTarget.source.translation); }
    set target(v) { vec3.copy(v, this.#camTarget.source.translation); }
  }
```

이제 `vec3.copy`라는 함수를 추가해야 합니다. 지금까지는 이 함수가 필요하지 않았습니다.

```js
const vec3 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(3);
+    dst.set(src);
+    return dst;
+  },

   ...
```

그렇다면 `OrbitCamera`를 사용해야 합니다.

```js
+  const orbitCamera = new OrbitCamera();
+  orbitCamera.setParent(root);
+  orbitCamera.target = [120, 80, 0];
+  orbitCamera.tilt = Math.PI * -0.2;
+  orbitCamera.radius = 300;

  ...

  const settings = {
-    cameraRotation: degToRad(-45),
    showMeshNodes: false,
    showAllTRS: false,
  };

-  const cameraRadToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };

  const uiElem = document.querySelector('#ui');
  const gui = new GUI({
    parent: uiElem,
  });
  gui.onChange(() => {
    uiElem.classList.toggle('hide-ui', !gui.isOpen());
  });
-  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
  gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
  gui.add(settings, 'showAllTRS').onChange(showTRS);

  ...

  function render() {

   ...

-    // 우리가 계산한 행렬에서 카메라의 위치를 알아내세요.
-    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
-    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
-
-    // 뷰 행렬을 계산합니다.
-    const viewMatrix = mat4.inverse(cameraMatrix);

+    root.updateWorldMatrix();
+
+    // 카메라의 정보를 바탕으로 뷰 행렬를 생성합니다.
+    const viewMatrix = mat4.inverse(orbitCamera.getCameraMatrix());

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    const encoder = device.createCommandEncoder();
    {
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);

      const ctx = { pass, viewProjectionMatrix };
-      root.updateWorldMatrix();
      for (const mesh of meshes) {
        drawMesh(ctx, mesh);
      }

      pass.end();
    }

```

주의할 점은, 코드 내에서 수학적인 계산이 전혀 없다는 것입니다. `OrbitCamera` 코드에는 수학적인 계산이 전혀 없습니다. 그저 리그 노드들만 있을 뿐입니다. 이는 모든 수학적인 계산이 리그 자체에 내재되어 있기 때문입니다.

그냥 그대로 실행할 수도 있지만, 카메라 설정을 변경하는 것은 어렵습니다. 왜냐하면 기본적으로 UI에서는 각 노드의 이동, 회전, 크기 조절 설정만 표시되기 때문입니다. 즉, 9개의 설정이 모두 표시되지 않습니다.

UI를 약간 조정해서, 카메라 노드들이 관련된 설정만을 표시하도록 할 것입니다. 이를 위해, 세션 그래프 노드들의 맵을 설정에 추가할 것입니다. 간단하게 하기 위해, 원하는 위치에 컨트롤들을 배치할 것입니다. 여기서 0, 1, 2는 x, y, z 좌표이며, 3, 4, 5는 x, y, z 회전 각도를 나타냅니다. 6, 7, 8은 크기를 나타냅니다. 만약 해당 노드에 대한 설정이 없다면, 기존의 규칙에 따라 처리됩니다.

```js
+  const nodeToUISettings = new Map();

  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // 카메라 리그 생성하기
      this.#camTarget = addTRSSceneGraphNode('cam-target');
      this.#camPan = addTRSSceneGraphNode('cam-pan', this.#camTarget);
      this.#camTilt = addTRSSceneGraphNode('cam-tilt', this.#camPan);
      this.#camExtend = addTRSSceneGraphNode('cam-extend', this.#camTilt);
      this.#cam = addTRSSceneGraphNode('cam', this.#camExtend);

+      nodeToUISettings.set(this.#camTarget, { trs: [0, 1, 2] });
+      nodeToUISettings.set(this.#camPan, { trs: [4] });
+      nodeToUISettings.set(this.#camTilt, { trs: [3] });
+      nodeToUISettings.set(this.#camExtend, { trs: [2] });
+      nodeToUISettings.set(this.#cam, { trs: [] });
    }

    ...
  }

  ...

+  let currentNode;
  function setCurrentSceneGraphNode(node) {
+    currentNode = node;
    trsUIHelper.setTRS(node.source);
    trsFolder.name(`orientation: ${node.name}`);
    trsFolder.updateDisplay();

 +   showTRS();

    // Mark는 어떤 노드가 선택되었는지를 나타냅니다.
    for (const b of nodeButtons) {
      const name = b.button.getName().replace(prefixRE, '');
      b.button.name(`${b.node === node ? kSelected : kUnelected}${name}`);
    }

    selectedMeshes = meshes.filter(mesh => meshUsesNode(mesh, node));

    render();
  }

  ...

  const alwaysShow = new Set([0, 1, 2]);
-  function showTRS(show) {
+  function showTRS() {
+    const ui = nodeToUISettings.get(currentNode);
    trsControls.forEach((trs, i) => {
-      trs.show(show || alwaysShow.has(i));
+      const showThis = ui
+        ? ui.trs?.indexOf(i) >= 0
+        : (settings.showAllTRS || alwaysShow.has(i));
+      trs.show(showThis);
    });
  }
=  showTRS(false);

```

이러한 변경 사항을 통해, 우리는 기존의 카메라 관련 코드를 새로운 `OrbitCamera`로 대체했습니다. 또한, 많은 수학적 연산도 제거했으며, 카메라의 노드들이 UI에 표시되어 있어서, 그 설정들을 직접 편집할 수 있도록 했습니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-01.html"}}}

이제 기본적인 기능들이 준비되었으니, 이제 포인터 관련 기능들을 추가해 보겠습니다.

## <a id="a-pan-and-tilt"></a> 틸트 기능

포인터를 드래그할 때, 화면의 회전 각도를 조절할 수 있습니다.

우선, 드래그 기능이 캔버스 외의 다른 요소들을 선택하지 않도록, 몇 가지 CSS 설정을 조정해야 합니다.

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  touch-action: none;
}
```

그 다음, 카메라에 몇 가지 코드를 추가하여 이러한 변경 사항을 좀 더 잘 캡슐화해 보겠습니다. `getUpdateHelper`라는 함수를 만들어서, 카메라의 관련된 상태를 기록할 것입니다. 또한, 이 함수는 UI 코드가 전달하는 델타 값을 이용해 카메라의 상태를 수정할 수 있는 기능도 제공할 것입니다.

```js
  class OrbitCamera {

   ...

+    getUpdateHelper() {
+      const startTilt = this.tilt;
+      const startPan = this.pan;
+
+      return {
+        panAndTilt: (deltaPan, deltaTilt) => {
+          this.tilt = startTilt - deltaTilt;
+          this.pan = startPan - deltaPan;
+        },
+      };
+    }

   ...

  }
```

그런 다음, 포인터 입력을 연결하는 함수를 추가하여 도우미 함수를 만들 수 있습니다. 그리고 델타 값도 그 함수에 전달할 수 있습니다.

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
    let camHelper;

    const updateStartPosition = (e) => {
      startX = e.clientX;
      startY = e.clientY;
      camHelper = cam.getUpdateHelper();
    };

    const onMove = (e) => {
      if (!canvas.hasPointerCapture(e.pointerId)) {
        return;
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      camHelper.panAndTilt(deltaX * 0.01, deltaY * 0.01);
      render();
    };

    const onUp = (e) => {
      canvas.releasePointerCapture(e.pointerId);
    };

    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      updateStartPosition(e);
    };

    elem.addEventListener('pointerup', onUp);
    elem.addEventListener('pointercancel', onUp);
    elem.addEventListener('lostpointercapture', onUp);
    elem.addEventListener('pointerdown', onDown);
    elem.addEventListener('pointermove', onMove);

    return () => {
      elem.removeEventListener('pointerup', onUp);
      elem.removeEventListener('pointercancel', onUp);
      elem.removeEventListener('lostpointercapture', onUp);
      elem.removeEventListener('pointerdown', onDown);
      elem.removeEventListener('pointermove', onMove);
    };
  }

  addOrbitCameraEventListeners(orbitCamera, canvas);
```

코드는 상당히 간단합니다. `pointerdown`에서는 `cam.getUpdateHelper`를 호출하여 현재의 `pan`와 `tilt`을 기록합니다. 또한 현재 포인터의 위치도 기록합니다. `pointermove`에서는 포인터가 시작된 위치에서의 변화량을 계산하여, 그 값을 도우미 함수에 전달하여 `pan`와 `tilt`을 조정합니다. 그게 전부입니다. `addOrbitCameraEventListeners`는 필요하다면 리스너를 제거하는 함수도 반환합니다.

또 한 가지 작은 변경점을 추가하겠습니다. GUI가 값들이 업데이트되었는지 확인하도록 해 보겠습니다. 이렇게 하면 포인터를 드래그할 때 `pan`과 `tilt`을 입력하면 UI에 있는 값들이 자동으로 업데이트됩니다.

```js
-  const trsFolder = gui.addFolder('orientation');
+  const trsFolder = gui.addFolder('orientation').listen();
```

한번 시도해 보세요. 화면 위에서 손가락을 움직여서 `cam-tilt`나 `cam-pan` 노드를 선택해 보세요. 그러면 손가락을 움직일 때마다 그 값들이 변하는 것을 볼 수 있을 것입니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-02.html"}}}

## <a id="a-track"></a> 추적/관리

드래그할 때, shift와 같은 조절 키를 누르고 있는 경우가 있습니다. 이때, 카메라의 위치나 각도를 조절하는 대신, 카메라를 “추적”하는 방식으로 움직이게 됩니다.

그 점을 추가해 보겠습니다. 우선, 몇 가지 새로운 수학 함수가 필요합니다.

```js
const vec3 = {
+  create() {
+    return new Float32Array(3);
+  },

  ...

+  add(a, b, dst) {
+      dst = dst || new Float32Array(3);
+
+      dst[0] = a[0] + b[0];
+      dst[1] = a[1] + b[1];
+      dst[2] = a[2] + b[2];
+
+      return dst;
+  },
+
+  transformMat3(v, m, dst) {
+    dst = dst ?? new Float32Array(3);
+
+    const x = v[0];
+    const y = v[1];
+    const z = v[2];
+
+    dst[0] = x * m[0] + y * m[4] + z * m[8];
+    dst[1] = x * m[1] + y * m[5] + z * m[9];
+    dst[2] = x * m[2] + y * m[6] + z * m[10];
+
+    return dst;
+  },
}
```

`create`는 0이 3개 들어 있는 vec3을 만듭니다. `add`는 두 vec3을 더합니다. 마지막으로 `transformMat3`은 3x3 행렬로 벡터를 변환합니다. [조명에 쓰이는 법선을 설명하면서](webgpu-lighting-directional.html#a-normals) 소개한 연산입니다. 그때는 WGSL에서 법선(vec3f)에 법선 행렬(mat3x3f)을 곱했습니다. 여기서는 같은 연산을 JavaScript로 수행해 포인터 이동 방향을 바꿉니다.

이제, 도우미 함수를 업데이트할 수 있습니다.

```js
  class OrbitCamera {

    ...

    getUpdateHelper() {
      const startTilt = this.tilt;
      const startPan = this.pan;
+      const startCameraMatrix = mat4.copy(this.getCameraMatrix());
+      const startTarget = vec3.copy(this.target);

      return {
        panAndTilt: (deltaPan, deltaTilt) => {
          this.tilt = startTilt - deltaTilt;
          this.pan = startPan - deltaPan;
        },
+        track: (deltaX, deltaY) => {
+          const direction = vec3.transformMat3([deltaX, deltaY, 0], startCameraMatrix);
+          this.target = vec3.add(startTarget, direction);
+        },
      };
    }
```

`track`은 포인터의 X, Y 이동량을 카메라 행렬의 왼쪽 위 3×3 부분으로 변환합니다. 이로써 카메라가 바라보는 방향에 수직인 평면에서 얼마나 움직일지 구하고, 그 값을 대상 위치에 더합니다.

그런 다음, 포인터 이벤트 코드에서 `track`를 가져옵니다.

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
+    let lastMode;
    let camHelper;

    const updateStartPosition = (e) => {
      startX = e.clientX;
      startY = e.clientY;
      camHelper = cam.getUpdateHelper();
    };

    const onMove = (e) => {
      if (!canvas.hasPointerCapture(e.pointerId)) {
        return;
      }

+      const mode = e.shiftKey
+        ? 'track'
+        : 'panAndTilt';
+
+      if (mode !== lastMode) {
+        lastMode = mode;
+        updateStartPosition(e);
+      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

+      switch (mode) {
+        case 'track': {
+          const s = cam.radius * 0.001;
+          camHelper.track(-deltaX * s, deltaY * s);
+          break;
+        }
+        case 'panAndTilt':
*          camHelper.panAndTilt(deltaX * 0.01, deltaY * 0.01);
+          break;
+      }

      render();
    };

    const onUp = (e) => {
      canvas.releasePointerCapture(e.pointerId);
    };

    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      updateStartPosition(e);
    };

    elem.addEventListener('pointerup', onUp);
    elem.addEventListener('pointercancel', onUp);
    elem.addEventListener('lostpointercapture', onUp);
    elem.addEventListener('pointerdown', onDown);
    elem.addEventListener('pointermove', onMove);

    return () => {
      elem.removeEventListener('pointerup', onUp);
      elem.removeEventListener('pointercancel', onUp);
      elem.removeEventListener('lostpointercapture', onUp);
      elem.removeEventListener('pointerdown', onDown);
      elem.removeEventListener('pointermove', onMove);
    };
  }
```

위의 이벤트 코드는, 사용자가 Shift 키를 누르고 있는지 여부에 따라 모드를 결정합니다. 모드가 변경되면, 초기값을 기록해야 합니다. 그런 다음 모드가 활성화됩니다.

우리의 `'track'` 모드는 포인터의 변화량을 도우미 함수의 `track` 함수로 전달합니다. 이때, 그 변화량을 목표물까지의 거리에 따라 조정합니다. 이렇게 하면, 목표물에 매우 가까이 있을 때도 작은 단계로 이동할 수 있습니다.

또한, 사용자가 중간 마우스 버튼을 사용하는지도 추적할 수 있습니다.

```js
-      const mode = e.shiftKey
+      const mode = e.shiftKey || (e.buttons & 4) !== 0
        ? 'track'
        : 'panAndTilt';
```

이제 마우스 휠을 누른 상태에서 마우스를 움직여 트랙을 이동할 수 있습니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-03.html"}}}

## <a id="a-dolly-by-wheel"></a> 휠로 이동하는 돌리

다음으로, 스크롤 휠을 사용하여 줌 기능을 활성화할 수 있습니다. 이 기능은 꽤 흔한 기능입니다.

먼저, 도우미 함수를 업데이트해 보겠습니다.

```js
  class OrbitCamera {
    ...

    getUpdateHelper() {
      const startTilt = this.tilt;
      const startPan = this.pan;
+      const startRadius = this.radius;
      const startCameraMatrix = mat4.copy(this.getCameraMatrix());
      const startTarget = vec3.copy(this.target);

      return {
        panAndTilt: (deltaPan, deltaTilt) => {
          this.tilt = startTilt - deltaTilt;
          this.pan = startPan - deltaPan;
        },
        track: (deltaX, deltaY) => {
          const direction = vec3.transformMat3([deltaX, deltaY, 0], startCameraMatrix);
          this.target = vec3.add(startTarget, direction);
        },
+        dolly: (delta) => {
+          this.radius = startRadius + delta;
+        },
      };
    }

    ...
  }
```

그런 다음, 그걸 실제로 사용해 봅시다.

```js
  function addOrbitCameraEventListeners(cam, elem) {

  ...


+    // 사용자가 휠을 사용할 때의 돌리
+    const onWheel = (e) => {
+      e.preventDefault();
+      const helper = cam.getUpdateHelper();
+      helper.dolly(cam.radius * 0.001 * e.deltaY);
+      render();
+    };

    elem.addEventListener('pointerup', onUp);
    elem.addEventListener('pointercancel', onUp);
    elem.addEventListener('lostpointercapture', onUp);
    elem.addEventListener('pointerdown', onDown);
    elem.addEventListener('pointermove', onMove);
+    elem.addEventListener('wheel', onWheel);

    return () => {
      elem.removeEventListener('pointerup', onUp);
      elem.removeEventListener('pointercancel', onUp);
      elem.removeEventListener('lostpointercapture', onUp);
      elem.removeEventListener('pointerdown', onDown);
      elem.removeEventListener('pointermove', onMove);
+      elem.removeEventListener('wheel', onWheel);
    };
  }
```

이렇게 조금만 바꾸면 마우스 휠로 카메라를 앞뒤로 이동시켜 확대하거나 축소할 수 있습니다(돌리). 노트북의 터치패드에서는 두 손가락으로 조작할 수 있습니다.

이 코드는 반지름의 1000분의 1만큼만 조절됩니다. 이 기능은 많은 장면에서 테스트된 것은 아니지만, 너무 가까이 있을 경우 같은 속도로 움직이지 않는 것이 적절해 보입니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-04.html"}}}

## <a id="a-dolly-by-pinch"></a> 핀치 방식으로 움직이는 돌리

모바일 기기에서는 확대를 위해 손가락을 모으는 기능이 일반적입니다. 그 기능을 추가해 보겠습니다.

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
    let lastMode;
    let camHelper;
+    let startPinchDistance;
+    const pointerToLastPosition = new Map();

+    const computePinchDistance = () => {
+      const pos = [...pointerToLastPosition.values()];
+      const dx = pos[0].x - pos[1].x;
+      const dy = pos[0].y - pos[1].y;
+      return Math.hypot(dx, dy);
+    };

    const updateStartPosition = (e) => {
      startX = e.clientX;
      startY = e.clientY;
+      if (pointerToLastPosition.size === 2) {
+        startPinchDistance = computePinchDistance();
+      }
      camHelper = cam.getUpdateHelper();
    };

    const onMove = (e) => {
-      if (!canvas.hasPointerCapture(e.pointerId)) {
+      if (!pointerToLastPosition.has(e.pointerId) ||
+          !canvas.hasPointerCapture(e.pointerId)) {
        return;
      }
+      pointerToLastPosition.set(e.pointerId, { x: e.clientX, y: e.clientY });

-      const mode = e.shiftKey || (e.buttons & 4) !== 0
+      const mode = pointerToLastPosition.size === 2
+        ? 'pinch'
+        : pointerToLastPosition.size > 2
+        ? 'undefined'
+        : e.shiftKey || (e.buttons & 4) !== 0
        ? 'track'
        : 'panAndTilt';

      if (mode !== lastMode) {
        lastMode = mode;
        updateStartPosition(e);
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      switch (mode) {
+        case 'pinch': {
+          const pinchDistance = computePinchDistance();
+          const delta = pinchDistance - startPinchDistance;
+          camHelper.dolly(cam.radius * 0.002 * -delta);
+          break;
+        }
        case 'track': {
          const s = cam.radius * 0.001;
          camHelper.track(-deltaX * s, deltaY * s);
          break;
        }
        case 'panAndTilt':
          camHelper.panAndTilt(deltaX * 0.01, deltaY * 0.01);
          break;
      }

      render();
    };

    const onUp = (e) => {
+     pointerToLastPosition.delete(e.pointerId);
     canvas.releasePointerCapture(e.pointerId);
    };

    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
+      pointerToLastPosition.set(e.pointerId, { x: e.clientX, y: e.clientY });
      updateStartPosition(e);
    };

    ...
  }
```

이제, 모든 포인터의 시작 위치를 추적합니다. 2개가 있다면 그 상태를 유지합니다. 만약 2개 이상이 있다면 포기합니다. 반면, 1개만 있다면 다시 원래 위치로 돌아갑니다.

`computePinchDistance` 함수에서는 두 위치를 얻어서 그 사이의 거리를 계산합니다. 이 정보를 활용하여, 사용자가 핀치를 시작했을 때 두 위치가 얼마나 떨어져 있었는지, 그리고 나중에 두 위치가 얼마나 멀어졌는지를 확인할 수 있습니다. 이 정보는 줌 기능을 사용할 때에도 유용하게 활용될 수 있습니다.

만약 터치스크린을 가진 노트북을 사용하거나, 태블릿이나 스마트폰을 사용하고 있다면, 그걸 시도해보는 것도 좋습니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-05.html"}}}

## <a id="a-dolly-by-double-tab-drag"></a> 더블 탭 드래그를 이용한 돌리기

한 번 더 해 보겠습니다. 일부 앱에서는 화면을 두 번 탭한 후 손가락으로 화면을 드래그하면 확대되는 기능이 있습니다. 예를 들어, 구글 지도도 그렇습니다. 그 기능을 추가해 보겠습니다.

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
    let lastMode;
    let camHelper;
+    let doubleTapMode;
+    let lastSingleTapTime;
    let startPinchDistance;
    const pointerToLastPosition = new Map();

    ...

    const onMove = (e) => {
      if (!pointerToLastPosition.has(e.pointerId) ||
          !canvas.hasPointerCapture(e.pointerId)) {
        return;
      }
      pointerToLastPosition.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const mode = pointerToLastPosition.size === 2
        ? 'pinch'
        : pointerToLastPosition.size > 2
        ? 'undefined'
+        : doubleTapMode
+        ? 'doubleTapZoom'
        : e.shiftKey || (e.buttons & 4) !== 0
        ? 'track'
        : 'panAndTilt';

      if (mode !== lastMode) {
        lastMode = mode;
        updateStartPosition(e);
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      switch (mode) {
        case 'pinch': {
          const pinchDistance = computePinchDistance();
          const delta = pinchDistance - startPinchDistance;
          camHelper.dolly(cam.radius * 0.002 * -delta);
          break;
        }
        case 'track': {
          const s = cam.radius * 0.001;
          camHelper.track(-deltaX * s, deltaY * s);
          break;
        }
        case 'panAndTilt':
          camHelper.panAndTilt(deltaX * 0.01, deltaY * 0.01);
          break;
+        case 'doubleTapZoom':
+          camHelper.dolly(cam.radius * 0.002 * deltaY);
+          break;
      }

      render();
    };

    const onUp = (e) => {
      pointerToLastPosition.delete(e.pointerId);
      canvas.releasePointerCapture(e.pointerId);
+      if (pointerToLastPosition.size === 0) {
+        doubleTapMode = false;
+      }
    };

+    const kDoubleClickTimeMS = 300;
    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointerToLastPosition.set(e.pointerId, { x: e.clientX, y: e.clientY });
+      if (pointerToLastPosition.size === 1) {
+        if (!doubleTapMode) {
+          const now = performance.now();
+          const deltaTime = now - lastSingleTapTime;
+          if (deltaTime < kDoubleClickTimeMS) {
+            doubleTapMode = true;
+          }
+          lastSingleTapTime = now;
+        }
+      } else {
+        doubleTapMode = false;
+      }
      updateStartPosition(e);
    };

    ...
  }
```

이 코드는 `pointerdown`이 한 번만 발생했는지 확인합니다. 그리고 그 시점과 마지막으로 발생한 `pointerdown` 사이의 시간을 확인합니다. 만약 그 시간이 `kDoubleClickTime`보다 작다면, 우리는 `doubleTapMode` 상태에 있으며, 두 번째 탭이 시작된 위치와의 거리에 따라 줌 레벨을 조절할 수 있습니다.

ATM은 마우스나 터치스크린을 사용하여도 작동합니다. 마우스와 함께 사용하는 것이 적절할까요? 한 번 시도해 보세요.

{{{example url="../webgpu-camera-controls-scene-graph-step-06.html"}}}

## <a id="a-camera-not-at-root"></a> 카메라는 루트에 위치하지 않습니다.

우리가 다루지 않은 문제 중 하나는, 장면 그래프에 존재하는 OrbitCamera가 그래프의 루트에 위치하지 않는 경우가 있다는 것입니다.

예를 들어, 만약 그 장면에서 카메라가 무너진 탑 위에 위치해 있다고 가정해 봅시다. 탑이 무너졌기 때문에 카메라의 위치는 지면과 평행하지 않습니다.

틸트, 팬, 돌리기와 같은 기능들에 대해서는 아무런 변경이 필요하지 않습니다. 왜냐하면 이러한 기능들은 모두 카메라 자체에 의해 결정되기 때문입니다. 하지만 트랙 기능의 경우는 조금 더 많은 작업이 필요합니다. 왜냐하면 카메라의 대상은 그 카메라가 속한 노드에 의해 결정되기 때문입니다.

이 문제를 해결하기 위해서는, 우선 `target` 설정을 제거하는 것이 좋습니다. 왜냐하면 그 설정은 잘못된 정보를 제공하기 때문입니다. 대신, 카메라의 부모 객체도 고려하는 `setTarget` 함수를 만들어보겠습니다.

```js
  class OrbitCamera {

   ...

    get target() { return vec3.copy(this.#camTarget.source.translation); }
-    set target(v) { vec3.copy(v, this.#camTarget.source.translation); }
_    setTarget(worldPosition) {
_      const inv = mat4.inverse(this.#camTarget.parent?.worldMatrix ?? mat4.identity());
_      vec3.transformMat4(worldPosition, inv, this.#camTarget.source.translation);
_    }
  }
```

또한, `vec3.transformMat4`라는 함수도 추가해야 합니다. 이 함수는 정점 셰이더에서 사용하는 `uni.matrix * vert.position`과 같은 수학적 연산을 JavaScript로 변환한 것입니다.

```js
const vec3 = {
  ...
  transformMat3(v, m, dst) {
    dst = dst ?? new Float32Array(3);

    const x = v[0];
    const y = v[1];
    const z = v[2];

    dst[0] = x * m[0] + y * m[4] + z * m[8];
    dst[1] = x * m[1] + y * m[5] + z * m[9];
    dst[2] = x * m[2] + y * m[6] + z * m[10];

    return dst;
  },

+  transformMat4(v, m, dst) {
+    dst = dst ?? new Float32Array(3);
+
+    const x = v[0];
+    const y = v[1];
+    const z = v[2];
+    const w = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1;
+
+    dst[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
+    dst[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
+    dst[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
+
+    return dst;
+  },
};
```

이 setter 메서드를 제거한 후에는, 그 메서드를 사용하고 있던 코드를 수정해야 합니다.

```js
  const orbitCamera = new OrbitCamera();
  orbitCamera.setParent(root);
-  orbitCamera.target = [120, 80, 0];
+  orbitCamera.setTarget([120, 80, 0]);
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

또한, 도우미 함수인 `track` 함수를 재구현해야 합니다. 그렇게 하면, 그 위치가 루트에 있을 가능성이 없으므로, 델타 값을 카메라의 부모 객체에 대한 상대적인 값으로 조정해야 합니다.

```js
  class OrbitCamera {

    ...

    getUpdateHelper() {

      ...

        track: (deltaX, deltaY) => {
-          const direction = vec3.transformMat3([deltaX, deltaY, 0], startCameraMatrix);
-          this.target = vec3.add(startTarget, direction);
+          const worldDirection = vec3.transformMat3([deltaX, deltaY, 0], startCameraMatrix);
+          const inv = mat4.inverse(this.#camTarget.parent?.worldMatrix ?? mat4.identity());
+          const cameraDirection = vec3.transformMat3(worldDirection, inv);
-          this.target = vec3.add(startTarget, cameraDirection);
+          vec3.add(startTarget, cameraDirection, this.#camTarget.source.translation);
        },

      ...
    }
  }
```

이전에 우리가 계산했던 방향은 월드 공간 내의 방향이었습니다. 카메라가 루트 위에 있을 때는 그 방향이 유효했습니다. 하지만 이제는 카메라의 부모 월드 행렬의 역을 곱해야 합니다. 이렇게 하면 델타가 부모 월드 행렬에 비해 상대적인 값이 되도록 변경됩니다. 이것이 바로 우리가 필요로 하는 것입니다.

카메라를 몇몇 추가적인 장면 그래프 노드에 연결해 보겠습니다.

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
+  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  orbitCamera.setParent(extraMov);
```

추적 기능은 여전히 작동해야 합니다.

{{{example url="../webgpu-camera-controls-scene-graph-step-07.html"}}}

## <a id="a-frame-selected"></a> 선택한 물체를 화면에 맞추기(Frame Selected)

또 하나의 중요한 기능은, 물체를 선택한 뒤 `frame selected`를 눌러 그 물체가 화면에 들어오도록 카메라를 옮길 수 있다는 것입니다. 이를 위해서는 각 오브젝트의 크기를 알아야 합니다. 이 경우, 화면 위의 모든 오브젝트가 단일 큐브 형태라는 것을 알고 있습니다. 데이터에 각 오브젝트의 크기를 저장할 수는 있지만, 지금은 모두 큐브의 크기로 설정해두겠습니다.

```js
function createCubeVertices() {
  const positions = [
    // 왼쪽
    0, 0,  0,
    0, 0, -1,
    0, 1,  0,
    0, 1, -1,

    // 올바른쪽
    1, 0,  0,
    1, 0, -1,
    1, 1,  0,
    1, 1, -1,
  ];

  ...

  return {
    vertexData,
    numVertices,
+    aabb: {
+      min: [ 0,  0, -1],
+      max: [ 1,  1,  0],
+    },
  };
```

`aabb`는 축 정렬 경계 상자(Axis-Aligned Bounding Box)를 뜻합니다. 이번 예제에서는 큐브와 경계 상자가 일치합니다. 다른 메시에서는 각 축의 최솟값과 최댓값을 정점 데이터에서 구해야 합니다.

이 데이터를 메시의 정점들로 전달해야 합니다.

```js
-  function createVertices({vertexData, numVertices}, name) {
  function createVertices({vertexData, numVertices, aabb}, name) {
    const vertexBuffer = device.createBuffer({
      label: `${name}: vertex buffer vertices`,
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    return {
      vertexBuffer,
      numVertices,
+      aabb,
    };
```

메시의 위치와 방향은 장면 그래프에서 결정되므로, 메시의 AABB를 월드 공간으로 옮기는 함수가 필요합니다.

```js
  function computeAABBForMesh(mesh) {
    const mat = mesh.node.worldMatrix;
    const p0 = mesh.vertices.aabb.min;
    const p1 = mesh.vertices.aabb.max;
    let min;
    let max;
    for (let i = 0; i < 8; ++i) {
      const p = [
        (i & 1) ? p0[0] : p1[0],
        (i & 2) ? p0[1] : p1[1],
        (i & 4) ? p0[2] : p1[2],
      ];
      vec3.transformMat4(p, mat, p);
      if (i === 0) {
        min = p.slice();
        max = p.slice();
      } else {
        vec3.min(min, p, min);
        vec3.max(max, p, max);
      }
    }
    return { min, max };
  }
```

이 코드는 2개의 `vec3` 함수를 더 사용해야 합니다. `min`과 `max`는 각각 2개의 vec3s의 각 구성 요소의 최소값이나 최대값을 포함하는 `vec3`을 반환합니다.

```js
const vec3 = {
  ...

+  min(a, b, dst) {
+    dst = dst ?? new Float32Array(3);
+
+    dst[0] = Math.min(a[0], b[0]);
+    dst[1] = Math.min(a[1], b[1]);
+    dst[2] = Math.min(a[2], b[2]);
+
+    return dst;
+  },
+
+  max(a, b, dst) {
+    dst = dst ?? new Float32Array(3);
+
+    dst[0] = Math.max(a[0], b[0]);
+    dst[1] = Math.max(a[1], b[1]);
+    dst[2] = Math.max(a[2], b[2]);
+
+    return dst;
+  },

  ...
};
```

그런 다음, 선택된 메시들을 처리하여, 그 메시들의 AABB를 결합할 수 있는 함수가 필요합니다.

```js
  function expandAABBInPlace(aabb, otherAABB) {
    vec3.min(aabb.min, otherAABB.min, aabb.min);
    vec3.max(aabb.max, otherAABB.max, aabb.max);
  }

  function getAABBForSelectedMeshes() {
    if (selectedMeshes.length === 0) {
      return undefined;
    }
    const aabb = computeAABBForMesh(selectedMeshes[0]);
    for (let i = 1; i < selectedMeshes.length; ++i) {
      expandAABBInPlace(aabb, computeAABBForMesh(selectedMeshes[i]));
    }
    return aabb;
  }
```

그렇게 하면, 선택된 메시들을 둘러싸는 함수를 만들 수 있습니다.

```js
  function frameSelected() {
    if (selectedMeshes.length === 0) {
      return;
    }

    // 선택된 오브젝트에 대해 aabb 경계를 얻습니다.
    const aabb = getAABBForSelectedMeshes();

    const extent = vec3.subtract(aabb.max, aabb.min);
    const diameter = vec3.distance(aabb.min, aabb.max);

    // 선택된 값에 대해 반지름을 얼마나 늘려야 하는지 계산해 보세요.
    // 프레임에 넣어야 할 물체들입니다.
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fieldOfViewH = 2 * Math.atan(Math.tan(settings.fieldOfView) * aspect);
    const fov = Math.min(fieldOfViewH, settings.fieldOfView);
    const zoomScale = 1.5; // 약간의 패딩을 추가하여, 크기를 1.5배로 늘려보세요.
    const halfSize = diameter * zoomScale * 0.5;
    const distance = halfSize / Math.tan(fov * 0.5);

    orbitCamera.radius = distance;

    // 카메라를 중앙으로 향하게 합니다.
    const center = vec3.addScaled(aabb.min, extent, 0.5);
    orbitCamera.setTarget(center);

    render();
  }
```

위 코드는 선택한 메시의 AABB(축 정렬 경계 상자)를 구합니다. 이 AABB를 감싸는 구의 지름은 서로 마주 보는 두 꼭짓점 사이의 거리입니다. 지름을 구했으니 현재 `fieldOfView`에서 카메라가 얼마나 떨어져야 하는지 계산할 수 있습니다. `mat4.perspective` 함수에서 설정하는 시야각은 수직 시야각입니다. 여기에 종횡비를 적용해 수평 시야각을 구하고, 둘 중 더 작은 시야각을 기준으로 구 전체가 보이는 데 필요한 거리를 구합니다. `zoomScale`로 AABB를 감싸는 구를 1.5배 키워 여백을 확보합니다. 마지막으로 카메라의 회전 반경을 그 거리로 설정합니다.

마지막으로, 카메라의 초점을 AABB의 중심점에 맞춥니다.

더 많은 `vec3` 관련 함수들을 제공해야 합니다. 그 함수들은 바로 `distance`와 `addScaled`입니다.

```js
const vec3 = {
  ...
+  distance(a, b) {
+    const dx = a[0] - b[0];
+    const dy = a[1] - b[1];
+    const dz = a[2] - b[2];
+    return Math.sqrt(dx * dx + dy * dy + dz * dz);
+  },

...

+  addScaled(a, b, scale, dst) {
+      dst = dst || new Float32Array(3);
+
+      dst[0] = a[0] + b[0] * scale;
+      dst[1] = a[1] + b[1] * scale;
+      dst[2] = a[2] + b[2] * scale;
+
+      return dst;
+  },


  ...
};
```

`distance` 함수는 두 개의 `vec3` 값 사이의 거리를 계산합니다. `addScaled` 함수는 사실상 `a + b * scale`과 같은 작업을 수행합니다. 이 함수를 사용하면 `b`의 일부를 `a`에 더할 수 있습니다.

설정에 `fieldOfView`라는 항목을 추가해야 합니다.

```js
  const settings = {
+    fieldOfView: degToRad(60),
    showMeshNodes: false,
    showAllTRS: false,
  };

  function render() {
    ...

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
-        degToRad(60), // fieldOfView,
+        settings.fieldOfView,
        aspect,
        1,      // zNear
        2000,   // zFar
    );
```

또한, `frame selected` 버튼도 추가해야 합니다.

```js
  const uiElem = document.querySelector('#ui');
  const gui = new GUI({
    parent: uiElem,
  });
  gui.onChange(() => {
    uiElem.classList.toggle('hide-ui', !gui.isOpen());
    render();
  });
  gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
  gui.add(settings, 'showAllTRS').onChange(showTRS);
+  gui.addButton('frame selected', frameSelected);
  const trsFolder = gui.addFolder('orientation').listen();
```

또한, 4개의 캐비닛을 모두 포함하는 부모 노드도 추가해 보겠습니다. 그렇게 하면, 전체를 선택할 수 있는 요소가 생깁니다.

```js
+  const cabinets = addTRSSceneGraphNode('cabinets', root);
  // 캐비닛을 추가하세요.
  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
-    addCabinet(root, cabinetNdx);
+    addCabinet(cabinets, cabinetNdx);
  }

  ...

-  setCurrentSceneGraphNode(root.children[2]);
+  setCurrentSceneGraphNode(cabinets.children[1]);
```

그리고, 여기서 추가적인 회전과 이동도 제거해보도록 하죠.

```js
-  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
-  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  const extraRot = addTRSSceneGraphNode('extra-rot', root);
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot);
```

어떤 객체를 선택한 후, “선택된 객체를 프레임으로 저장”을 선택해 보세요.

{{{example url="../webgpu-camera-controls-scene-graph-step-08.html"}}}

## <a id="a-ux"></a> UX 관련 결정들

궤도 카메라와 관련된 UX 관련 결정들은 정말 많습니다. 그 중 일부는 다음과 같습니다:

* 롤링을 허용해야 할까요?

  롤이라는 것은, 머리를 좌우로 기울일 때와 같은 현상입니다.

  롤을 추가하는 것은, 기존 리그에 하나의 노드를 더 추가하는 것뿐입니다. 그리고 그 노드의 z축 회전 방향은 현재의 리그 상태에 따라 `#camExtend`와 `#cam` 중 하나로 설정됩니다.

* 우리가 현재 사용하고 있는 방식대로, 그냥 드래그만 해서 조절하면 되는 걸까요, 아니면 카메라를 조절하기 위해 다른 방법이 필요한 걸까요?

  유니티에서는, 카메라 제어 모드로 전환하기 위해 특정 아이콘을 클릭해야 합니다. 블렌더에서는 특정 아이콘을 클릭하거나, 마우스 중간 버튼이나 추가 키를 사용하여 카메라를 이동시킬 수 있습니다. “카메라 추적” 아이콘을 드래그하면 카메라가 그 위치를 따라 이동합니다. “카메라 궤도 설정” 아이콘을 드래그하면 카메라가 원형으로 이동합니다. “줌” 아이콘을 드래그하면 카메라의 크기가 조절됩니다.

  시청자에게는 키나 아이콘 없이도 간단히 드래그할 수 있다는 점이 편리합니다. 하지만 편집자에게는 대부분의 작업이 3D 콘텐츠를 편집하는 작업이기 때문에, 아이콘을 사용하거나 특정 키를 눌러야 하는 경우가 많습니다.

* 모바일 기기에서는 어떤 일이 일어나야 할까요?

  모바일에서 카메라를 트래킹하는 방법은 아직 구현하지 않았습니다. 지금 방식은 Shift 키를 누르고 있어야 합니다. 전용 아이콘을 드래그하는 방식도 가능하고, 일부 뷰어는 두 손가락으로 트래킹을 조작하는 것 같습니다.

* 90도를 넘어서 기울일 수 있도록 해야 할까요?

  90도를 넘어서 촬영할 수 있도록 허용했습니다. 이는 카메라가 거꾸로 움직일 수 있음을 의미합니다. 하지만 일부 앱들은 이를 방지합니다.

* “프레임”의 방향은 그대로 유지해야 할까요?

  대부분의 3D 편집기에서는 오브젝트를 선택한 후 “프레임” 옵션을 선택할 수 있습니다. 이 옵션을 사용하면 오브젝트가 카메라의 중심에 위치하게 되며, 카메라는 그 오브젝트를 중심으로 회전합니다. 하지만 문제는, 카메라의 방향이 변경된 후에도 오브젝트의 전면을 바라보는 방향이 그대로 유지되는지, 아니면 항상 양의 Z 방향으로만 보이는지입니다. 혹은, “프레임” 옵션을 선택하기 전의 방향이 그대로 유지되는지도 중요합니다. 예를 들어, 오브젝트 A를 내려다보고 있고, B를 선택했다면, 카메라는 여전히 오브젝트 A를 내려다보는 방향으로 유지되어야 할까요?

* 카메라가 포인터에 비해 어느 방향으로 이동하는가요?

  다시 말해, 포인터를 왼쪽에서 오른쪽으로 드래그하면 카메라는 시계 방향으로 회전합니다. 반대로 시계 반대 방향으로 드래그하면 카메라 주위를 돌고 있는 것처럼 보입니다. 이는 마치 트랙패드를 사용하여 내용을 스크롤하는 것과 비슷합니다. 아래로 드래그하면 내용이 위로 이동하는 것처럼 보입니다. 반대로 위로 드래그하면 내용이 아래로 이동하는 것처럼 보입니다.

  터치스크린을 사용할 때는, 마치 콘텐츠를 드래그하는 것처럼 보이는 것이 좋습니다. 하지만 스크롤바는 터치스크린이 등장하기 전부터 이미 존재했습니다. 스크롤바의 핸들을 드래그하면 콘텐츠가 아니라 화면 전체가 이동합니다. 스크롤 휠을 사용하면 그 핸들을 조작할 수 있었습니다. 트랙패드를 두 손가락으로 누르면 그 기능을 수행할 수 있었습니다.

## <a id="a-no-scene-graph"></a> 장면 그래프 없이 `OrbitCamera` 구현하기

[장면 그래프](webgpu-scene-graphs.html)에서 만든 구조를 사용하므로 다음 코드만 추가하면 됩니다.

```js
   class OrbitCamera {
    #target = vec3.create();
    #pan = 0;
    #tilt = 0;
    #radius = 0;

    constructor() {}

    getCameraMatrix(parentMatrix) {
      const mat = mat4.copy(parentMatrix ?? mat4.identity());
      mat4.translate(mat, this.#target, mat);
      mat4.rotateY(mat, this.#pan, mat);
      mat4.rotateX(mat, this.#tilt, mat);
      mat4.translate(mat, [0, 0, this.#radius], mat);
      return mat;
    }

    getUpdateHelper(parentMatrix) {
      const startTilt = this.tilt;
      const startPan = this.pan;
      const startRadius = this.radius;
      const startCameraMatrix = mat4.copy(this.getCameraMatrix());
      const startTarget = vec3.copy(this.target);

      return {
        panAndTilt: (deltaPan, deltaTilt) => {
          this.tilt = startTilt - deltaTilt;
          this.pan = startPan - deltaPan;
        },
        track: (deltaX, deltaY) => {
          const worldDirection = vec3.transformMat3([deltaX, deltaY, 0], startCameraMatrix);
          const inv = mat4.inverse(parentMatrix ?? mat4.identity());
          const cameraDirection = vec3.transformMat3(worldDirection, inv);
          this.target = vec3.add(startTarget, cameraDirection);
        },
        dolly: (delta) => {
          this.radius = startRadius + delta;
        },
      };
    }

    get pan() { return this.#pan; }
    set pan(v) { this.#pan = v; }
    get tilt() { return this.#tilt; }
    set tilt(v) { this.#tilt = v; }
    get radius() { return this.#radius; }
    set radius(v) { this.#radius = v; }
    get target() { return vec3.copy(this.#target); }
    set target(v) { vec3.copy(v, this.#target); }
  }
```

우리의 예시에서, 또 하나의 작은 변경이 필요합니다. 이 부분은 장면 그래프에 포함되어 있지 않으므로, 장면 그래프에 추가해서는 안 됩니다.

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
  orbitCamera.target = [120, 80, 0];
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

그리고 그것은 정말 효과가 있어요.

{{{example url="../webgpu-camera-controls-raw.html"}}}

이제 카메라를 조작할 수 있으니 [피킹](webgpu-picking.html)으로 클릭한 물체를 찾아보겠습니다.

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-camera-controls.css" rel="stylesheet">
<script type="module" src="webgpu-camera-controls.js"></script>
