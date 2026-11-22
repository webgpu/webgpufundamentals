Title: WebGPU 피킹
Description: 클릭한 물체 찾기
TOC: 피킹

이 글은 3D 편집기용 부품을 만드는 방법에 관한 짧은 시리즈의 세 번째 글입니다. 각 글은 이전 글을 바탕으로 작성된 것이므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="editor.hanson"}}}

피킹(picking)은 화면을 클릭했을 때 어떤 물체를 클릭했는지 알아내는 작업입니다.

## CPU 피킹

우리의 3D 수학 관련 시리즈에서, 행렬을 사용하여 3D 정점들의 위치를 클립 공간의 위치로 변환하는 방법을 배웠습니다. 반대로, 사용자가 화면에서 클릭한 위치를 클립 공간의 위치로 변환할 수도 있습니다. 그런 다음, 정점들의 위치를 클립 공간으로 변환하는 데 사용된 행렬의 역행렬을 사용하여, 클립 공간의 위치를 다시 정점 공간의 위치로 변환할 수 있습니다.

일단 두 물체가 같은 공간에 있다면, 현재의 볼록부의 앞쪽에서 뒤쪽으로 향하는 광선이 어떤 물체와 교차하는지 확인하는 것은 상대적으로 쉽습니다.

자, 이제 작업을 진행해 보겠습니다. 먼저, 언제 피킹을 해야 할지 결정해야 합니다. 카메라를 이동시키는 데도 포인터를 사용하므로, 사용자가 포인터를 움직이지 않았다면, 포인터가 위쪽으로 향하는 시점을 피킹하는 것이 좋습니다.

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
+    let moved;
    let lastMode;
    let camHelper;
    let doubleTapMode;
    let lastSingleTapTime;
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
        : doubleTapMode
        ? 'doubleTapZoom'
        : e.shiftKey || (e.buttons & 4) !== 0
        ? 'track'
        : 'panAndTilt';

      if (mode !== lastMode) {
        lastMode = mode;
        updateStartPosition(e);
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

+      if (pointerToLastPosition.size === 1 &&
+          Math.hypot(deltaX, deltaY) > 1) {
+        moved = true;
+      }

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
        case 'doubleTapZoom':
          camHelper.dolly(cam.radius * 0.002 * deltaY);
          break;
      }

      render();
    };

    const onUp = (e) => {
+      const numPointers = pointerToLastPosition.size;
      pointerToLastPosition.delete(e.pointerId);
      canvas.releasePointerCapture(e.pointerId);
-      if (pointerToLastPosition.size === 0) {
+      if (numPointers === 1 && pointerToLastPosition.size === 0) {
        doubleTapMode = false;
+        if (!moved) {
+          pickMeshes(e, cam, moved);
+        }
      }
    };

    const kDoubleClickTimeMS = 300;
    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointerToLastPosition.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointerToLastPosition.size === 1) {
+        moved = false;
        if (!doubleTapMode) {
          const now = performance.now();
          const deltaTime = now - lastSingleTapTime;
          if (deltaTime < kDoubleClickTimeMS) {
            doubleTapMode = true;
          }
          lastSingleTapTime = now;
        }
      } else {
        doubleTapMode = false;
      }
      updateStartPosition(e);
    };

    ...
  }
```

그렇게 되면, 사용자가 포인터를 움직이지 않았다면 `pickMeshes` 함수를 호출합니다. 이 함수를 구현해야 하지만, 그 전에 현재의 뷰 투영 행렬을 준비해야 합니다. 그러니 현재의 뷰 투영 행렬 코드를 가져와보겠습니다.

```js
+  function getViewProjectionMatrix(cam, canvas) {
+    const aspect = canvas.clientWidth / canvas.clientHeight;
+    const projection = mat4.perspective(
+        settings.fieldOfView,
+        aspect,
+        1,      // zNear
+        2000,   // zFar
+    );
+
+    const viewMatrix = mat4.inverse(cam.getCameraMatrix());
+
+    // 보기 행렬과 투영 행렬을 결합합니다.
+    return mat4.multiply(projection, viewMatrix);
+  }

   ...

  function render() {
    ...


-    const aspect = canvas.clientWidth / canvas.clientHeight;
-    const projection = mat4.perspective(
-        settings.fieldOfView,
-        aspect,
-        1,      // zNear
-        2000,   // zFar
-    );
-
    root.updateWorldMatrix();
-
-    // 카메라의 정보를 바탕으로 뷰 행렬를 생성합니다.
-    const viewMatrix = mat4.inverse(orbitCamera.getCameraMatrix());
-
-    // 보기 행렬과 투영 행렬을 결합합니다.
-    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
+    const viewProjectionMatrix = getViewProjectionMatrix(orbitCamera, canvas);
```

이제 그걸 이용해서 `pickMeshes`를 만들어보겠습니다.

```js
+  function pickMeshes(e, cam) {
+    const rect = e.target.getBoundingClientRect();
+    const clipX = (e.clientX - rect.left) / e.target.clientWidth  *  2 - 1;
+    const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;
+
+    const viewProjectionValue = getViewProjectionMatrix(cam, canvas);
+    const intersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);
+    ???
+  }
```

`pickMeshes`는 클립 공간의 X와 Y, 뷰 투영 행렬을 계산하고, 이 값을 `getIntersectionMeshes`에 전달해 메시 배열을 받습니다.

`getIntersectingMeshes` 함수를 만들어보겠습니다.

```js
  function getIntersectingMeshes(clipX, clipY, viewProjection) {
    const clipNear = [clipX, clipY, 0];
    const clipFar = [clipX, clipY, 1];

    // 일시적으로 사용할 수 있는 수학 변수들을 만들어보세요.
    const worldViewProjection = mat4.identity();
    const mat = mat4.identity();
    const near = vec3.create();
    const far = vec3.create();

    const verts = [
      vec3.create(),
      vec3.create(),
      vec3.create(),
    ];

    const intersectingMeshes = [];
    for (const mesh of meshes) {
      // 모델 공간(정점 데이터가 저장된 공간)에 매트를 배치합니다.
      mat4.multiply(viewProjection, mesh.node.worldMatrix, worldViewProjection);

      // 그렇게 반전시켜서, 클립 공간 좌표를 사용하면 그 값들이 변환됩니다.
      // 모델 공간을 만드는 것입니다.
      mat4.inverse(worldViewProjection, mat);

      // 이제 클립 공간의 좌표들을 모델 공간으로 변환해야 합니다.
      // 그래서 우리는 그들을 모델의 정점들과 AABB와 비교할 수 있습니다.
      vec3.transformMat4(clipNear, mat, near);
      vec3.transformMat4(clipFar, mat, far);

      const { vertexData, numVertices } = mesh.vertices;

      const numTriangles = numVertices / 3;
      let closest;
      for (let t = 0; t < numTriangles; ++t) {
        // 삼각형을 구성하는 세 개의 위치를 찾아내세요.
        verts.forEach((v, i) => {
          const offset = (t * 3 + i) * 4;
          v[0] = vertexData[offset + 0];
          v[1] = vertexData[offset + 1];
          v[2] = vertexData[offset + 2];
        });

        const result = intersectLineSegmentAndTriangle(near, far, ...verts);
        if (result) {
          // 클립 공간으로 다시 변환해야 하므로, Z축 값을 확인할 수 있도록 해야 합니다.
          // 가장 가까운 타격점입니다.
          vec3.transformMat4(result, worldViewProjection, result);
          if (closest = == undefined || result[2] < closest[2]) {
            closest = result;
          }
        }
      }

      if (closest !== undefined) {
        intersectingMeshes.push({
          position: closest,
          mesh,
        });
      }
    }

    return intersectingMeshes;
  }
```

이 코드는 상당히 간단한 구조를 가지고 있습니다. `clipNear`와 `clipFar`라는 두 개의 변수가 생성됩니다. 이 두 변수는 사실 `clipX`와 `clipY`와 같습니다. 단, `clipNear`의 값은 0으로 설정되고, `clipFar`의 값은 1로 설정됩니다.

그런 다음, 각 메시에 대해 그 메시의 `worldMatrix`를 얻고, 그 값을 카메라의 시점 투영값과 곱합니다. 그 다음, 그 결과를 역수로 계산합니다. 이렇게 하면 `clipNear`와 `clipFar`를 정점 데이터와 같은 공간에서 동일한 위치로 변환할 수 있습니다. 우리는 이러한 결과를 각각 `near`와 `far`라고 부릅니다.

그런 다음, 정점 데이터가 포함된 삼각형들을 순서대로 처리합니다. 각 삼각형에 대해 `intersectLineSegmentAndTriangle` 함수를 호출합니다. 이 함수는, `near`와 `far` 선분이 교차하지 않는 경우 undefined를 반환합니다. 반면, 선분이 교차하는 경우에는 교차점의 위치를 반환합니다.

우리는 다시 클립 공간으로 변환하여, 위치가 시청자에 대해 올바른 방향으로 정렬되도록 합니다. 이렇게 하면 카메라에 가장 가까운 점을 유지할 수 있습니다.

만약 세 개의 삼각형 중 하나가 관심이 가는 것 같다면, 그 메시를 우리의 결과물에 포함시킵니다.

그렇게 하면, 다시 `pickMeshes` 함수를 완료할 수 있습니다.

```js
  function pickMeshes(e, cam) {
    const rect = e.target.getBoundingClientRect();
    const clipX = (e.clientX - rect.left) / e.target.clientWidth  *  2 - 1;
    const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;

    const viewProjectionValue = getViewProjectionMatrix(cam, canvas);
    const intersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);

    // 결과들을 z 값에 따라 정렬합니다.
    intersectingMeshes.sort((a, b) => a.position[2] - b.position[2]);

    // 첫 번째 것을 선택하세요.
    if (intersectingMeshes.length > 0) {
      let node = intersectingMeshes[0].mesh.node;
      if (!settings.showMeshNodes) {
        while (node.name.includes('mesh')) {
          node = node.parent;
        }
      }
      setCurrentSceneGraphNode(node);
    }
  }
```

아직 해야 할 일이 몇 가지 남아 있습니다. `intersectLineSegmentAndTriangle` 함수를 구현해야 합니다. 이 알고리즘은 [뮐러-트룸보르 선-삼각형 교차 알고리즘](https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm)이라고 불립니다.

```js
  // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
  function intersectLineSegmentAndTriangle(p0, p1, v0, v1, v2) {
    const edge1 = vec3.subtract(v1, v0);
    const edge2 = vec3.subtract(v2, v0);
    const dir = vec3.subtract(p1, p0); // 선분의 방향

    const h = vec3.cross(dir, edge2);
    const a = vec3.dot(edge1, h);

    // 만약 ‘a’가 거의 0에 가까우면, 그 선은 평행합니다.
    // 삼각형의 평면으로
    if (Math.abs(a) < 0.00001) {
      return undefined;
    }

    const f = 1 / a;
    const s = vec3.subtract(p0, v0);
    const u = f * vec3.dot(s, h);

    // 교점이 외부에 있는지 확인해 주세요.
    // 삼각형의 U 매개변수의 범위는 [0, 1]입니다.
    if (u < 0.0 || u > 1.0) {
      return undefined;
    }

    const q = vec3.cross(s, edge1);
    const v = f * vec3.dot(dir, q);

    // 교점이 외부에 있는지 확인해 주세요.
    // 삼각형의 V 매개변수의 범위는 [0, 1]이며, S+T의 범위도 [0, 1]입니다.
    if (v < 0.0 || u + v > 1.0) {
      return undefined;
    }

    // 이 단계에서는, 교차점이 위치하는 곳이 바로 그 지점입니다.
    // 무한한 선과 삼각형 내부에서
    const t = f * vec3.dot(edge2, q);

    // 교점이 해당 영역 내에 있는지 확인해 주세요.
    // 선분의 T 매개변수의 범위는 [0, 1]입니다.
    if (t < 0.0 || t > 1.0) {
      return undefined;
    }

    // 교점을 원래의 위치로 돌려놓습니다.
    return vec3.addScaled(p0, dir, t);
  }
```

그래서 `vec3.dot`을 호출해야 합니다. 따라서 이를 제공해야 합니다.

```js
const vec3 = {
  ...

+  dot(a, b) {
+    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
+  },

}
```

`dot`은 [방향광](webgpu-lighting-directional.html) 등에서 이미 사용했습니다. 두 vec3의 대응하는 성분을 각각 곱한 뒤 모두 더합니다.

또한, 정점에 대한 데이터도 계속 보관해두어야 합니다.

```js
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
      aabb,
+      vertexData,
    };
  }
```

그렇게 되면, 우리는 선택을 할 수 있습니다!

{{{example url="../webgpu-picking-cpu-step-01.html"}}}

만약 우리가 현재 선택된 항목을 해제할 때, 어디든 클릭하지 않아도 되다면 좋을 텐데요. 그렇게 해 보겠습니다.

```js
  function pickMeshes(e, cam) {
    const rect = e.target.getBoundingClientRect();
    const clipX = (e.clientX - rect.left) / e.target.clientWidth  *  2 - 1;
    const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;

    const viewProjectionValue = getViewProjectionMatrix(cam, canvas);
    const intersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);

    // 결과들을 z 값에 따라 정렬합니다.
    intersectingMeshes.sort((a, b) => a.position[2] - b.position[2]);

    // 첫 번째 것을 선택하세요.
    if (intersectingMeshes.length > 0) {
      let node = intersectingMeshes[0].mesh.node;
      if (!settings.showMeshNodes) {
        while (node.name.includes('mesh')) {
          node = node.parent;
        }
      }
      setCurrentSceneGraphNode(node);
-    }
+    } else {
+      setCurrentSceneGraphNode(undefined);
+    }
  }

  ...

  // UI에 TRS를 전달합니다. 어떤 TRS를 설정할지 지정합니다.
  // 현재 편집 중입니다.
  class TRSUIHelper {
    #trs = new TRS();

    constructor() {}

    setTRS(trs) {
-      this.#trs = trs;
+      this.#trs = trs ?? new TRS();
    }

    ...
  }

  ...

  let currentNode;
  function setCurrentSceneGraphNode(node) {
    currentNode = node;
-    trsUIHelper.setTRS(node.source);
-    trsFolder.name(`orientation: ${node.name}`);
+    trsUIHelper.setTRS(node?.source);
+    trsFolder.name(`orientation: ${node?.name ?? '--none--'}`);
    trsFolder.updateDisplay();

    showTRS();

    // Mark는 어떤 노드가 선택되었는지를 나타냅니다.
    for (const b of nodeButtons) {
      const name = b.button.getName().replace(prefixRE, '');
      b.button.name(`${b.node === node ? kSelected : kUnelected}${name}`);
    }

    selectedMeshes = meshes.filter(mesh => meshUsesNode(mesh, node));

    render();
  }

...

-  setCurrentSceneGraphNode(cabinets.children[1]);
+  setCurrentSceneGraphNode(undefined);
```

{{{example url="../webgpu-picking-cpu-step-02.html"}}}

지금 우리가 겪고 있는 문제는, 가장 가까운 객체만을 선택할 수 있다는 것입니다. 하지만 우리의 코드가 좋은 점은, 사용자의 포인터가 가리키는 모든 객체들을 리스트로 얻을 수 있다는 것입니다. 편집기에서는 처음 클릭했을 때 가장 가까운 객체가 선택됩니다. 두 번째 클릭할 때, 포인터가 움직이지 않았다면, 다음 객체가 선택됩니다. 이 과정이 계속 반복되어서, 포인터가 가리키는 모든 객체들을 순서대로 확인할 수 있습니다. 그럼 실제로 그렇게 해 보겠습니다.

```js
+  let lastPickX;
+  let lastPickY;
+  let lastPickNdx;
+  let lastIntersectingMeshes;
  function pickMeshes(e, cam) {
+    if (!lastIntersectingMeshes ||
+        lastPickX !== e.clientX ||
+        lastPickY !== e.clientY) {
+      lastPickNdx = 0;
+      lastPickX = e.clientX;
+      lastPickY = e.clientY;
       const rect = e.target.getBoundingClientRect();
       const clipX = (e.clientX - rect.left) / e.target.clientWidth  *  2 - 1;
       const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;

       const viewProjectionValue = getViewProjectionMatrix(cam, canvas);
-      const intersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);
-
-    // 결과들을 z 값에 따라 정렬합니다.
-    intersectingMeshes.sort((a, b) => a.position[2] - b.position[2]);
-
-    // 첫 번째 것을 선택하세요.
-    if (intersectingMeshes.length > 0) {
-      let node = intersectingMeshes[0].mesh.node;
+      lastIntersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);
+      lastIntersectingMeshes.sort((a, b) => a.position[2] - b.position[2]);
+    }
+
+    // 결과들을 순서대로 살펴보세요.
+    if (lastIntersectingMeshes.length > 0) {
+      let node = lastIntersectingMeshes[lastPickNdx].mesh.node;
+      lastPickNdx = ++lastPickNdx % lastIntersectingMeshes.length;
      if (!settings.showMeshNodes) {
        while (node.name.includes('mesh')) {
          node = node.parent;
        }
      }
      setCurrentSceneGraphNode(node);
    } else {
      setCurrentSceneGraphNode(undefined);
    }
```

이제, 드로어를 클릭하면 해당 드로어가 선택됩니다. 포인터를 움직이지 않은 상태에서 다시 클릭하면, 드로어 뒤에 있는 캐비닛이 선택됩니다.

{{{example url="../webgpu-picking-cpu-step-03.html"}}}

우리가 할 수 있는 일반적인 최적화 방법은, 광선이 정점 데이터가 포함된 AABB 영역과 교차하는지 확인하는 것입니다. 만약 교차하지 않는다면, 모든 삼각형을 확인할 필요는 없습니다.

[선택한 물체를 화면에 맞추기(Frame Selected)](webgpu-camera-controls.html#a-frame-selected)를 구현하면서 AABB를 구해 두었습니다. 이제 그 데이터를 사용해 교차 여부를 확인하면 됩니다.

```js
  function getIntersectingMeshes(clipX, clipY, viewProjection) {

    ...
    const intersectingMeshes = [];
    for (const mesh of meshes) {
      // 모델 공간(정점 데이터가 저장된 공간)에 매트를 배치합니다.
      mat4.multiply(viewProjection, mesh.node.worldMatrix, worldViewProjection);

      // 그렇게 반전시켜서, 클립 공간 좌표를 사용하면 그 값들이 변환됩니다.
      // 모델 공간을 만드는 것입니다.
      mat4.inverse(worldViewProjection, mat);

      // 이제 클립 공간의 좌표들을 모델 공간으로 변환해야 합니다.
      // 그래서 우리는 그들을 모델의 정점들과 AABB와 비교할 수 있습니다.
      vec3.transformMat4(clipNear, mat, near);
      vec3.transformMat4(clipFar, mat, far);

      const { vertexData, numVertices, aabb } = mesh.vertices;

+      // 그 광선이 AABB 영역을 통과하는지 확인해 주세요.
+      if (!intersectSegmentAABB(near, far, aabb)) {
+        // 각 삼각형을 모두 확인할 필요는 없어요.
+        continue;
+      }

      ...
    }

    return intersectingMeshes;
  }
```

다음은 AABB를 사용하여 광선을 검사하는 코드입니다.

```js
  // 브랜치리스 슬래브 레이/세그먼트 – AABB 교차점 (윌리엄스 등)
  // 참고: JS로 최적화되지 않았습니다.
  const kEpsilon = 1e-12;
  function intersectSegmentAABB(p0, p1, aabb) {
    const delta = vec3.subtract(p1, p0);

    const invDelta = delta.map(v =>
      1 / (Math.abs(v) > kEpsilon ? v : Math.sign(v) * kEpsilon));

    const t0 = vec3.multiply(vec3.subtract(aabb.min, p0), invDelta);
    const t1 = vec3.multiply(vec3.subtract(aabb.max, p0), invDelta);

    const min = vec3.min(t0, t1);
    const max = vec3.max(t0, t1);

    const tMin = Math.max(0, ...min);
    const tMax = Math.min(1, ...max);

    for (let c = 0; c < 3; ++c) {
      if (Math.abs(delta[c]) <= kEpsilon &&
          (p0[c] < aabb.min[c] || p0[c] > aabb.max[c])) {
        return undefined;
      }
    }

    return tMin > tMax
      ? undefined
      : { tMin, tMax };
  }
```

`vec3.multiply` 함수를 추가해야 합니다.

```js
const vec3 = {
  ...

+  multiply(a, b, dst) {
+    dst = dst ?? new Float32Array(3);
+
+    dst[0] = a[0] * b[0];
+    dst[1] = a[1] * b[1];
+    dst[2] = a[2] * b[2];
+
+    return dst;
+  },

  ...
};
```

우리의 캐비닛은 각각 작은 단위의 큐브로 구성되어 있기 때문에, 그 캐비닛의 경계 상자는 그 큐브들과 완벽하게 일치합니다. 그러므로 모든 것이 제대로 작동하는지 확인하기 위해, 다른 글에서 사용했던 F 값도 다시 추가해 보겠습니다.

```js
+function computeAABBForVertices(vertexData, stride = 3) {
+  const numVertices = vertexData.length / stride;
+  const min = [...vertexData.slice(0, 3)];
+  const max = [...min];
+
+  for (let i = 1; i < numVertices; ++i) {
+    const offset = i * stride;
+    const p = vertexData.slice(offset, offset + 3);
+    vec3.min(min, p, min);
+    vec3.max(max, p, max);
+  }
+  return { min, max };
+}
+
+function createFVertices() {
  ...

  return {
    vertexData,
    numVertices,
+    aabb: computeAABBForVertices(vertexData, 4),
  };
}
```

우리는 단지 F의 AABB를 계산하기만 하면 되었습니다.

이제, 캐비닛을 추가하기 직전에 그것을 장면에 추가해 보겠습니다.

```js
+  {
+    const fVertices = createVertices(createFVertices(), 'f');
+    const node = addTRSSceneGraphNode('f', root, {
+      translation: [100, 75, 30],
+      rotation: [Math.PI, Math.PI * 0.33, 0],
+      scale: [0.5, 0.5, 0.5],
+    });
+    addMesh(node, fVertices, [1, 1, 1, 1]);
+  }

  const cabinets = addTRSSceneGraphNode('cabinets', root);
  // 캐비닛을 추가하세요.
  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
    addCabinet(cabinets, cabinetNdx);
  }
```

사실, 볼 만한 것은 별로 없습니다. 그냥 약간의 최적화된 버전일 뿐입니다.

{{{example url="../webgpu-picking-cpu-step-04.html"}}}

CPU 기반의 처리 방식의 문제점은, 처리 속도가 느릴 수 있다는 점입니다. 또한, 새로운 GPU 기반의 렌더링 기능들이 추가될 때마다, 이를 따라잡기 위해 많은 작업이 필요합니다. 또한, CPU가 버텀 데이터에 계속 접근할 수 있어야 합니다.

## <a id="a-gpu-picking"></a> GPU 피킹

또한, GPU를 사용하여 선택할 수도 있습니다. 각 오브젝트를 개별적으로 색상으로 표시하는 대신, 각 오브젝트에 고유한 ID를 부여합니다. 그런 다음, 해당 ID를 통해 해당 오브젝트가 어디에 위치하는지 확인할 수 있습니다. 우리가 보는 그 ID가 바로 클릭된 오브젝트의 ID입니다.

<div class="webgpu_center">
  <div data-diagram="id-render" style="width: 1200px; max-width: 80%;"></div>
  <div>회전시키기 위해 드래그하세요.</div>
</div>

위에는 큐브, 구, 피라미드의 모습이 표시되어 있습니다. 각각의 객체 위에는 해당 객체의 ID가 표시되어 있습니다.

그렇게 하기 위해서는, ID가 있는 오브젝트들을 렌더링할 수 있는 방법이 필요합니다. 몇 가지 방법이 있습니다.

1. 우리의 셰이더에 두 번째 출력을 추가할 수 있습니다.

   현재, 우리의 프래그먼트 셰이더는 단일 색상을 반환하고 있습니다.

   ```wgsl
   @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
      return vsOut.color * uni.color;
   }
   ```

   이를 변경하여, 색상과 해당 객체의 ID를 모두 반환할 수 있도록 할 수 있습니다.

   ```wgsl
    struct Uniforms {
      matrix: mat4x4f,
      color: vec4f,
   +   id: u32,
    };

   +struct MyOutput {
   +  @location(0) color: vec4f,
   +  @location(1) id: vec4u,
   +};

   -@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
   -   return vsOut.color * uni.color;
   +@fragment fn fs(vsOut: VSOutput) -> MyOutput {
   +   return MyOutput(
   +     vsOut.color * uni.color,
   +     uni.id,
   +   );
   }
   ```

   이 방법의 장점은, 한 번만 렌더링만 하면 되며, 이미지와 해당 이미지에 대한 ID를 모두 얻을 수 있다는 것입니다.

2. 우리는 두 번에 걸쳐 렌더링할 수 있습니다. 한 번은 색상에 맞게, 다른 한 번은 ID에 맞게 렌더링하는 것입니다.

   현재는 이 방법을 선택하겠습니다. 이유는 이 단계를 거친 후에 분명해질 것입니다. [^render-twice]

   [^render-twice]: 방법 2를 선택한 이유는, 포인터를 사용하여 모든 오브젝트들을 선택적으로 렌더링할 수 있는 방법이 필요했기 때문입니다.

그러니까, 먼저 우리의 유니폼에 ID를 추가해 주고, ID를 출력하는 프래그먼트 셰이더를 만들어보겠습니다.

```wgsl
struct Uniforms {
  matrix: mat4x4f,
  color: vec4f,
+  id: u32,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color * uni.color;
}

+@fragment fn fsPicking(vsOut: VSOutput) -> @location(0) vec4u {
+  return vec4u(uni.id);
+}
```

앞서 언급했듯이, `layout: 'auto'`를 사용하는 파이프라인으로 만들어진 bindGroups는 공유될 수 없습니다. 따라서 두 개의 프래그먼트 셰이더에서도 같은 bindGroups를 사용하고 싶다면, 직접 bindGroupLayout과 pipelineLayout를 생성해야 합니다.

```js
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { minBindingSize: 96 },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });
```

그렇게 되면, 기존의 처리 로직을 업데이트할 수 있을 뿐만 아니라, ID를 렌더링하기 위한 새로운 처리 로직도 만들 수 있습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes with color',
+    layout: 'auto',
+    layout: pipelineLayout,
    vertex: {
      module,
      buffers: [
        {
          arrayStride: (4) * 4, // (3) 각각 4바이트인 부분들과, 4바이트인 색상 정보가 하나 더 있습니다.
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // 색상
          ],
        },
      ],
    },
    fragment: {
      module,
+      entryPoint: 'fs',
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

+  const pickPipeline = device.createRenderPipeline({
+    label: '2 attributes with id for picking',
+    layout: pipelineLayout,
+    vertex: {
+      module,
+      buffers: [
+        {
+          arrayStride: (4) * 4, // (3) 각각 4바이트인 부분들과, 4바이트인 색상 정보가 하나 더 있습니다.
+          attributes: [
+            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // 위치/상태
+            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // 색상
+          ],
+        },
+      ],
+    },
+    fragment: {
+      module,
+      entryPoint: 'fsPicking',
+      targets: [{ format: 'r32uint' }],
+    },
+    primitive: {
+      cullMode: 'back',
+    },
+    depthStencil: {
+      depthWriteEnabled: true,
+      depthCompare: 'less',
+      format: 'depth24plus',
+    },
+  });
```

객체당 사용할 유니폼 버퍼를 업데이트해야 합니다. 그래야 해당 객체에 대한 ID를 저장할 공간이 있고, 그 값을 설정할 수 있는 방법도 마련될 수 있습니다.

```js
  const objectInfos = [];
  function createObjectInfo() {
-    // 행렬과 색상
-    const uniformBufferSize = (16 + 4) * 4;
+    // 행렬, 색상, ID, 패딩
+    const uniformBufferSize = (16 + 4 + 1 + 3) * 4;
    const uniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);
+    const asU32 = new Uint32Array(uniformValues.buffer);

    // float32 인덱스로 나타낸 각 유니폼 값의 오프셋
    const kMatrixOffset = 0;
    const kColorOffset = 16;
+    const kIdOffset = 20;

    const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
    const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
+    const idValue = asU32.subarray(kIdOffset, kIdOffset + 1);

    const bindGroup = device.createBindGroup({
      label: 'bind group for object',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: uniformBuffer },
      ],
    });

    return {
      uniformBuffer,
      uniformValues,
      colorValue,
      matrixValue,
+      idValue,
      bindGroup,
    };
  }
```

그리고 렌더링 코드를 업데이트하여, 해당 아이디를 포함시켜야 합니다.

```js
  let depthTexture;
  let postTexture;
  let objectNdx = 0;

  function drawObject(ctx, vertices, matrix, color) {
    const { pass, viewProjectionMatrix } = ctx;
    const { vertexBuffer, numVertices } = vertices;
    if (objectNdx === objectInfos.length) {
      objectInfos.push(createObjectInfo());
    }
    const {
      matrixValue,
      colorValue,
+      idValue,
      uniformBuffer,
      uniformValues,
      bindGroup,
    } = objectInfos[objectNdx++];

    mat4.multiply(viewProjectionMatrix, matrix, matrixValue);
    colorValue.set(color);
+    idValue[0] = objectNdx;

    // 유니폼 값을 유니폼 버퍼에 업로드합니다
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices);
  }
```

두 번 렌더링할 수 있도록 `render`를 `renderToTexture`로 재구성하겠습니다. `GPUCommandEncoder`, 렌더링할 대상 텍스처인 `target`, 그리기 파이프라인 또는 ID 렌더링 파이프라인을 선택하는 `pipeline`, 그리고 `viewProjectionMatrix`를 전달합니다.

```js
+  function renderToTexture(
+      encoder, target, pipeline, viewProjectionMatrix) {
    objectNdx = 0;

-    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
-    // 그것을 렌더링할 텍스처로 설정해 주세요.
-    const canvasTexture = context.getCurrentTexture();
-    renderPassDescriptor.colorAttachments[0].view = canvasTexture.createView();
+    renderPassDescriptor.colorAttachments[0].view = target.createView();

    depthTexture = makeNewTextureIfSizeDifferent(
      depthTexture,
-      canvasTexture, // 크기에 맞게
+      target,  // 크기에 맞게
      'depth24plus',
      GPUTextureUsage.RENDER_ATTACHMENT,
    );
    renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();

-    root.updateWorldMatrix();
-    const viewProjectionMatrix = getViewProjectionMatrix(orbitCamera, canvas);
-
-    const encoder = device.createCommandEncoder();
    {
      const pass = encoder.beginRenderPass(renderPassDescriptor);
      pass.setPipeline(pipeline);

      const ctx = { pass, viewProjectionMatrix };
      for (const mesh of meshes) {
        drawMesh(ctx, mesh);
      }

      pass.end();
    }
  }

+  function render() {
+    root.updateWorldMatrix();
+    const viewProjectionMatrix = getViewProjectionMatrix(orbitCamera, canvas);
+
+    const encoder = device.createCommandEncoder();
+
+    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
+    // 그것을 렌더링할 텍스처로 사용합니다.
+    const canvasTexture = context.getCurrentTexture();
+    renderToTexture(
+      encoder,
+      canvasTexture,
+      pipeline,
+      viewProjectionMatrix,
+      meshes);

      ...
}
```

이제, 픽 텍스처를 렌더링하기 위해 `pick` 함수를 만들어 보겠습니다.

```js
  const pickBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  let pickTexture;
  async function pick(clipX, clipY, viewProjectionMatrix) {
    const x = Math.floor((clipX *  0.5 + 0.5) * canvas.width);
    const y = Math.floor((clipY * -0.5 + 0.5) * canvas.height);
    const encoder = device.createCommandEncoder();
    pickTexture = makeNewTextureIfSizeDifferent(
      pickTexture,
      canvas,  // 크기에 맞게
      'r32uint',
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    );

    renderToTexture(
      encoder,
      pickTexture,
      pickPipeline,
      viewProjectionMatrix,
    );

    // pointer 아래에 있는 texel을 pickBuffer로 복사해 주세요.
    encoder.copyTextureToBuffer(
      { texture: pickTexture, origin: [x, y] },
      { buffer: pickBuffer },
      [1, 1]
    );

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    // pickBuffer에서 값을 추출해내세요.
    await pickBuffer.mapAsync(GPUMapMode.READ);
    const id = new Uint32Array(pickBuffer.getMappedRange())[0];
    pickBuffer.unmap();
    return id;
  }
```

상당히 간단합니다. 먼저 `clipX`와 `clipY`를 포인터가 위치한 텍스셋의 좌표로 변환합니다. 그 다음, 캔버스와 같은 크기의 `r32uint` 텍스처를 생성합니다. `renderToTexture` 함수를 사용하여 이 텍스처에 시각을 렌더링합니다. 그 후, 포인터가 위치한 부분에 있는 단일 텍스셋을 `pickBuffer`에 복사합니다. 그리고 그 값을 읽어옵니다.

이를 사용하려면, 기존의 `pickMeshes` 함수를 이 함수로 바꾸면 됩니다.

```js
-  let lastPickX;
-  let lastPickY;
-  let lastPickNdx;
-  let lastIntersectingMeshes;
  function pickMeshes(e, cam) {
-    if (!lastIntersectingMeshes ||
-        lastPickX !== e.clientX ||
-        lastPickY !== e.clientY) {
-      lastPickNdx = 0;
-      lastPickX = e.clientX;
-      lastPickY = e.clientY;

*    const rect = e.target.getBoundingClientRect();
*    const clipX = (e.clientX - rect.left) / e.target.clientWidth  *  2 - 1;
*    const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;

-      const viewProjectionValue = getViewProjectionMatrix(cam, canvas);
-      lastIntersectingMeshes = getIntersectingMeshes(clipX, clipY, viewProjectionValue);
-      lastIntersectingMeshes.sort((a, b) => a.position[2] - b.position[2]);
-    }
-
-    // 결과들을 순서대로 살펴보세요.
-    if (lastIntersectingMeshes.length > 0) {
-      let node = lastIntersectingMeshes[lastPickNdx].mesh.node;
-      lastPickNdx = ++lastPickNdx % lastIntersectingMeshes.length;

    const viewProjectionMatrix = getViewProjectionMatrix(cam, canvas);
    const id = await pick(clipX, clipY, viewProjectionMatrix);
    if (id > 0) {
      let node = meshes[id - 1].node;
      if (!settings.showMeshNodes) {
        while (node.name.includes('mesh')) {
          node = node.parent;
        }
      }
      setCurrentSceneGraphNode(node);
    } else {
      setCurrentSceneGraphNode(undefined);
    }
  }
```

정말 많은 변화가 있었지만, 그럼에도 불구하고 GPU 선택이 가능해졌습니다.

{{{example url="../webgpu-picking-gpu-step-01.html"}}}

안타깝게도, 포인터가 가리키는 모든 오브젝트들을 순환적으로 선택할 수 있는 기능을 잃어버렸습니다. 이 문제를 해결해 보겠습니다. `pickableMeshes`라는 배열을 만들어서, 선택할 수 있는 메시들만 남도록 할 것입니다. 매번 메시를 선택할 때마다, 그 메시는 `pickableMeshes`에서 제거됩니다. 그렇게 되면, 이전에 선택된 메시를 다시 클릭해도 그 메시는 렌더링되지 않게 됩니다. 따라서, 그 메시의 ID가 없다면, 모든 메시들을 다시 `pickableMeshes`에 넣고 다시 시도할 것입니다.

먼저, `renderToTexture` 함수가 메시들의 배열을 받도록 해 보겠습니다.

```js
  function renderToTexture(
-      encoder, target, pipeline, viewProjectionMatrix) {
+      encoder, target, pipeline, viewProjectionMatrix, meshes) {

      ...

      const ctx = { pass, viewProjectionMatrix };
      for (const mesh of meshes) {
        drawMesh(ctx, mesh);
      }

    ...
  }
```

그리고 기존의 `render` 함수가 메시들을 전달하도록 해 보겠습니다.

```js
  function render() {
    ...

    // 캔버스 컨텍스트에서 현재의 텍스처를 가져옵니다.
    // 그것을 렌더링할 텍스처로 사용합니다.
    const canvasTexture = context.getCurrentTexture();
    renderToTexture(
      encoder,
      canvasTexture,
      pipeline,
      viewProjectionMatrix,
+      meshes,
    );

    ...
```

그리고 `pick` 함수에 메시들의 배열을 전달할 수 있도록 해보자.

```js
  let pickTexture;
-  async function pick(clipX, clipY, viewProjectionMatrix) {
+  async function pick(clipX, clipY, viewProjectionMatrix, pickableMeshes) {

    ...

    renderToTexture(
      encoder,
      pickTexture,
      pickPipeline,
      viewProjectionMatrix,
+      pickableMeshes,
    );

    ...
  }
```

그렇다면, 위에서 언급한 것처럼 `pickMeshes` 코드를 조정해야 합니다.

```js
+  let lastPickX;
+  let lastPickY;
+  let pickableMeshes;
  async function pickMeshes(e, cam) {
+    // 만약 메시가 전혀 없거나, 포인터가 이동했다면…
+    if (!pickableMeshes ||
+        lastPickX !== e.clientX ||
+        lastPickY !== e.clientY) {
+      lastPickX = e.clientX;
+      lastPickY = e.clientY;
+
+      // 모든 메시들을 얻어야 합니다.
+      pickableMeshes = meshes.slice();
+    }

    const rect = e.target.getBoundingClientRect();
    const clipX = (e.clientX - rect.left) / e.target.clientWidth * 2 - 1;
    const clipY = (e.clientY - rect.top ) / e.target.clientHeight * -2 + 1;

    const viewProjectionMatrix = getViewProjectionMatrix(cam, canvas);
    // 가용 중인 메시들 중에서 선택하기
-    const id = await pick(clipX, clipY, viewProjectionMatrix);
-    if (id > 0) {
+    let id = await pick(clipX, clipY, viewProjectionMatrix, pickableMeshes);
+    if (id === 0) {
+      // 만약 아무것도 찾지 못했다면, 다시 모든 것을 시도해 보세요.
+      pickableMeshes = meshes.slice();
+      id = await pick(clipX, clipY, viewProjectionMatrix, pickableMeshes);
+      // 만약 여전히 그곳에서 아무것도 발견하지 못했다면, 포인터 아래에는 아무것도 없다는 뜻입니다.
+      if (id === 0) {
+        setCurrentSceneGraphNode(undefined);
+        return;
+      }
+    }

-      let node = meshes[id - 1].node;
+    // 선택된 메시를 제거하고, 그 메시의 노드들을 얻습니다.
+    let node = pickableMeshes.splice(id - 1, 1)[0].node;
    if (!settings.showMeshNodes) {
      while (node.name.includes('mesh')) {
        node = node.parent;
      }
    }
    setCurrentSceneGraphNode(node);
-    } else {
-      setCurrentSceneGraphNode(undefined);
-    }
  }
```

<sup>그러한 변경 사항들은 잘 보이지 않을 수도 있습니다. “삭제된 항목 숨기기”를 클릭해 보세요.</sup>

그렇게 되면, 다시는 포인터 아래에 있는 객체들을 순서대로 클릭할 수 있게 됩니다.

{{{example url="../webgpu-picking-gpu-step-02.html"}}}

GPU를 선택하는 데 있어서의 몇 가지 장점들:

* 모든 GPU 정점 효과가 적용됩니다.

  좋은 예로는 스키닝 처리가 있습니다. 스키닝은 보통 GPU에서만 수행됩니다. 하지만 스키닝이 적용된 물체를 처리하기 위해서는 CPU에서도 모든 스키닝 관련 로직을 수행해야 합니다. 마찬가지로 블렌드 타깃도 CPU에서 처리해야 합니다. 현재의 코드에서도, CPU에서 오브젝트를 처리할 때는 각 정점의 형식과 스트라이드를 반드시 알아야 했습니다. 우리는 단 하나의 정점 형식만을 사용하기 때문에, 이런 문제는 그다지 큰 부담이 되지 않습니다. 하지만 여러 가지 정점 형식을 사용하는 경우에는 각 형식을 지원하기 위해 CPU 코드를 업데이트해야 합니다.

* 필요하다면, 투명성을 고려할 수도 있습니다.

  만약 여러분이 비행기를 가지고 있다고 상상해 보세요. 그 비행기에 ‘잎 모양의 질감’이 적용되어 있습니다. 잎 모양의 질감이 있는 부분은 100% 투명하므로, 뒤에 있는 것들을 볼 수 있습니다. 우리가 구현한 CPU 기반의 선택 방식으로는, 모든 선택 코드는 단지 잎 모양을 형성하는 두 개의 삼각형만을 인식합니다.

  GPU 피킹을 사용하면 텍스처의 알파 값을 쉽게 확인할 수 있으며, `discard`번호가 표시된 부분이 특정 임계값 이하인 경우에는 그 객체의 ID를 기록할 수 있습니다. 이렇게 하면, 잎의 투명한 부분을 통해 볼 수 있는 물체들을 쉽게 선택할 수 있으며, 더 자연스러운 느낌을 줄 수 있습니다.

위에서 설명한 CPU 관련 문제와 비교했을 때, 이 경우에는 앞쪽에 있는 오브젝스만을 표시할 뿐입니다. 모든 오브젝스를 회전시키기 위해 클릭을 해야 하는데, 만약 포인터가 움직이지 않았다면, 마지막으로 선택된 오브젝스를 그리지 않는 것이 좋습니다. 그렇게 하면, 다음으로 가까운 오브젝스가 결과로 나타날 것입니다.

## 최적화

하지만, 현재로서는 세 가지 간단한 최적화 방법을 사용할 수 있습니다. 하지만 이 방법들은 독자들이 스스로 해결해야 할 과제로 남겨두겠습니다 😛

1. 포인터 아래의 텍셀 하나만 그리도록 시저 사각형(scissor rectangle)을 설정합니다.

   포인터 아래 텍셀의 정수 좌표를 `texelX`, `texelY`라고 하면, `pass.setScissorRect(texelX, texelY, 1, 1)`로 결과를 쓸 영역을 그 텍셀 하나로 제한할 수 있습니다. 여기에는 클립 공간 좌표가 아니라 렌더 타깃의 텍셀 좌표를 전달합니다.

2. 시야 절두체 컬링이나 잠재 가시 집합(PVS) 같은 방법을 사용합니다.

   만약 어떤 물체가 분명히 카메라 앞에 있지 않다는 것을 쉽게 판단할 수 있다면, GPU에게 그 물체의 모든 삼각형들을 처리하도록 요청하는 것은 피할 수 있습니다.

   시야 절두체 컬링은 피킹뿐 아니라 일반 렌더링에도 도움이 됩니다. 물체가 시야 절두체 안에 있는지 확인하는 검사는 다음 방법에서도 사용합니다.

3. 1x1 픽셀 크기의 텍스처를 사용하고, 다른 투영 행렬을 사용해야 합니다.

   커서가 위치한 픽셀을 포함하는 부분만을 나타내는 투영 행렬을 만들 수 있습니다. 그렇게 하면, 1x1픽셀의 텍스처만을 사용해도 충분합니다. 이 방법에는 두 가지 장점이 있습니다. 첫째, 1x1픽셀의 텍스처를 사용하면 메모리 소비가 훨씬 적습니다. 둘째, 같은 시야 절두체 컬링 검사를 적용하면, 더 좁은 절두체를 사용하므로 더 많은 물체를 걸러낼 수 있습니다.


<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-picking.css" rel="stylesheet">
<script type="module" src="webgpu-picking.js"></script>
