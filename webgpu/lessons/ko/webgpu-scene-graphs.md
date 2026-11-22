Title: WebGPU 장면 그래프
Description: 장면 그래프 사용하기
TOC: 장면 그래프

이 글은 3D 수학에 대해 배우는 데 도움이 될 만한 글들의 9번째 글입니다. 각 글은 이전 글을 바탕으로 구성되어 있으므로, 순서대로 읽으면 이해하기가 더 쉬울 것입니다.

{{{toc-steps list="matrix-math.hanson"}}}

지난 글에서는 행렬 스택에 대해 다루었습니다. 이를 통해, 여러 요소들을 위치시키거나, 방향을 결정하거나, 크기를 조절하는 데 도움이 되는 행렬 변경 사항들을 생성할 수 있었습니다.

장면 그래프란, 어떤 의미에서는 같은 개념입니다. 다만, 코드를 사용하는 대신 데이터를 사용한다는 점이 다릅니다. 우리는 부모와 자식들로 구성된 그래프를 만들고, 자식들은 자신의 부모의 행렬을 기반으로 자신들의 행렬을 계산합니다.

보관함을 나타내는 시각적 그래프는 아마 이와 같은 모습일 것입니다.

```
root
  +-cabinet0
  |  +-cabinet0-mesh
  |  +-drawer0
  |  |  +-drawer0-drawer-mesh
  |  |  +-drawer0-handle-mesh
  |  +-drawer1
  |  |  +-drawer1-drawer-mesh
  |  |  +-drawer1-handle-mesh
  |  +-drawer2
  |  |  +-drawer2-drawer-mesh
  |  |  +-drawer2-handle-mesh
  |  +-drawer3
  |     +-drawer3-drawer-mesh
  |     +-drawer3-handle-mesh
  +-cabinet1
  |  ...
  +-cabinet2
  |  ...
  +-cabinet3
  |  ...
  +-cabinet4
     +-cabinet4-mesh
     +-drawer0
     |  +-drawer0-drawer-mesh
     |  +-drawer0-handle-mesh
     +-drawer1
     |  +-drawer1-drawer-mesh
     |  +-drawer1-handle-mesh
     +-drawer2
     |  +-drawer2-drawer-mesh
     |  +-drawer2-handle-mesh
     +-drawer3
        +-drawer3-drawer-mesh
        +-drawer3-handle-mesh
```

장면 그래프의 장점은, 데이터를 그래프의 노드로 저장하기 때문에, 그래프의 일부분만을 쉽게 조작할 수 있다는 점입니다. 이를 통해 코드를 반복해서 작성할 필요가 없습니다.

## 행렬 스택 예제를 장면 그래프로 바꾸기

우리가 필요로 하는 첫 번째 것은, 우리의 장면 그래프를 나타낼 수 있는 클래스입니다.

```js
class SceneGraphNode {
  constructor(name, source) {
    this.name = name;
    this.children = [];
    this.localMatrix = mat4.identity();
    this.worldMatrix = mat4.identity();
    this.source = source;
  }

  addChild(child) {
    child.setParent(this);
  }

  removeChild(child) {
    child.setParent(null);
  }

  setParent(parent) {
    // 우리를 부모님의 품에서 떼어내세요.
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this);
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1);
      }
    }

    // 우리를 새로운 부모로 추가해 주세요.
    if (parent) {
      parent.children.push(this);
    }
    this.parent = parent;
  }

  updateWorldMatrix() {
    // 만약 로컬 행렬가 원본 데이터를 가지고 있다면, 그 원본 데이터를 사용하여 로컬 행렬를 업데이트합니다.
    this.source?.getMatrix(this.localMatrix);

    if (this.parent) {
      // 우리에게는 그런 부모가 한 명 있습니다.
      mat4.multiply(this.parent.worldMatrix, this.localMatrix, this.worldMatrix);
    } else {
      // 우리에게는 부모가 없으니, 그냥 세계의 로컬 값을 복사해버리면 됩니다.
      mat4.copy(this.localMatrix, this.worldMatrix);
    }

    // 이제 모든 자녀들을 처리해 주세요.
      this.children.forEach(function(child) {
      child.updateWorldMatrix();
    });
  }
}
```

위의 `SceneGraphNode`는 상당히 간단합니다. 각 노드는 `children`라는 배열을 가지고 있습니다. 자식 노드를 추가하거나 제거하는 기능도 있으며, 노드의 부모를 설정하는 기능도 있습니다. 각 노드에는 `localMatrix`라는 속성이 있는데, 이는 해당 노드의 위치, 방향, 크기를 부모 노드에 비해 나타내는 값입니다. 또한, 각 노드에는 `worldMatrix`라는 속성이 있는데, 이는 해당 노드의 위치, 방향, 크기를 “세계”에 비해 나타내는 값입니다. 마지막으로 `updateWorldMatrix`라는 함수가 있는데, 이 함수는 노드와 그 자식 노드들의 `worldMatrix`를 업데이트합니다. 각 노드에는 선택적으로 `source`라는 속성도 있는데, 이는 `getMatrix` 함수를 제공하는 객체입니다. 이를 이용하면 특정 노드의 로컬 행렬을 다양한 방법으로 계산할 수 있습니다.

자, 그러면 출처를 하나 제시해 보겠습니다.

```js
class TRS {
  constructor({
    translation = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  } = {}) {
     this.translation = new Float32Array(translation);
     this.rotation = new Float32Array(rotation);
     this.scale = new Float32Array(scale);
  }

  getMatrix(dst) {
   mat4.translation(this.translation, dst);
   mat4.rotateX(dst, this.rotation[0], dst);
   mat4.rotateY(dst, this.rotation[1], dst);
   mat4.rotateZ(dst, this.rotation[2], dst);
   mat4.scale(dst, this.scale, dst);
   return dst;
 }
}
```

`TRS`는 Translation, Rotation, Scale의 약자입니다. 이는 장면 그래프에서 로컬 행렬을 계산하는 일반적인 방법입니다. 종종 일부 구현에서는 “translation” 대신 “position”를 사용하기도 합니다. 이 튜토리얼에서는 `getMatrix`에서 사용하는 방식과 일치하기 때문에 “translation”을 사용하는 것이 더 좋다고 생각했습니다.

특히 주목할 점은, `this.translation`, `this.rotation`, `this.scale`을 `new Float32Array(value)`로 설정하는 것입니다. `Float32Array`의 장점은 `set` 함수가 있어서, `someTRS.translation.set(someNewValue)`와 같은 작업을 수행할 수 있다는 점입니다.

`getMatrix` 함수는 실질적으로 행렬을 계산하는 데 사용됩니다.

```
translation * rotationX * rotationY * rotationZ * scale
```

회전 순서를 변경할 수 있는 옵션이 있다는 것은 흔한 일입니다. XYZ 대신 ZYX이나 YZX과 같은 순서로 회전할 수도 있습니다. 또한, [사영차원수](https://google.com/search?quaternion)를 사용하는 것도 흔한 방법이며, [기하학적 대수학](https://www.youtube.com/watch?v=Idlv83CxP-8)을 사용하는 경우도 점점 더 많아지고 있습니다.

어쨌든, 우리는 위쪽에 있는 것부터 시작할 것입니다.

이제 `SceneGraphNode`와 `TRS` 소스를 가지고 있으니, 이제 장면 그래프를 구축해 보겠습니다.

먼저, `SceneGraphNode`와 `TRS` 소스를 일정한 부모 객체에 추가하는 함수를 만들어보겠습니다.

```js
  function addTRSSceneGraphNode(
    name,
    parent,
    trs,
  ) {
    const node = new SceneGraphNode(name, new TRS(trs));
    if (parent) {
      node.setParent(parent);
    }
    return node;
  }
```

이제, “메시”를 생성하는 함수를 추가해 보겠습니다. 이를 어떻게 부르는지 잘 모르겠지만, 간단히 말하자면, 그리는 대상들의 목록이라고 할 수 있습니다. 각각의 그리는 대상은 `SceneGraphNode`와, 그 대상을 그리기 위한 정점들, 그리고 그 대상을 그릴 때 사용할 색상으로 구성됩니다.

```js
  const meshes = [];
  function addMesh(node, vertices, color) {
    const mesh = {
      node,
      vertices,
      color,
    };
    meshes.push(mesh);
    return mesh;
  }
```

이제, 우리가 가진 것은 단지 한 개의 큐브뿐이므로, 큐브를 시각적 그래프에 추가하고, 그 큐브를 렌더링하기 위해 “메시”도 함께 추가하는 함수를 만들어보겠습니다.

```js
  function addCubeNode(name, parent, trs, color) {
    const node = addTRSSceneGraphNode(name, parent, trs);
    return addMesh(node, cubeVertices, color);
  }
```

이제, 파일 보관함에 대한 그래프를 만들어보겠습니다. 먼저 “루트” 노드를 만들어보겠습니다. 루트 노드에는 “소스”가 필요하지 않습니다.

```js
  const root = new SceneGraphNode('root');
```

그 다음에는 캐비닛들을 추가해보죠.

```js
  const root = new SceneGraphNode('root');
+  // 캐비닛을 추가하세요.
+  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
+    addCabinet(root, cabinetNdx);
+  }
```

`addCabinet`라는 이름으로 코드를 작성해 봅시다.

```js
  function addCabinet(parent, cabinetNdx) {
    const cabinetName = `cabinet${cabinetNdx}`;

    // 전체 캐비닛에 대한 노드를 추가합니다.
    const cabinet = addTRSSceneGraphNode(
      cabinetName, parent, {
         translation: [cabinetNdx * kCabinetSpacing, 0, 0],
       });

    // 캐비닛을 나타내는 큐브 모양의 노드를 추가해 주세요.
    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * kNumDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];
    addCubeNode(
      `${cabinetName}-mesh`, cabinet, {
        scale: kCabinetSize,
      }, kCabinetColor);

    // 서랍들을 추가해 주세요.
    for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
      addDrawer(cabinet, drawerNdx);
    }
  }
```

그리고, `addDrawer`라는 이름의 함수를 작성해 봅시다.

```js
  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // 전체 서랍에 대한 노드를 추가합니다.
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
    animNodes.push(drawer);

    // 서랍용 큐브를 나타내는 노드를 추가해 주세요.
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // 핸들을 위한 큐브 모양의 노드를 추가해 주세요.
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

이제, 우리의 장면 그래프가 제대로 작동하게 되었으니, 렌더링 함수도 업데이트해야 합니다.

```js
-    stack.save();
-    stack.rotateY(settings.baseRotation);
-    stack.translate([(kNumCabinets - 0.5) * kCabinetSpacing * -0.5, 0, 0]);
-    objectNdx = 0;
-    const ctx = { pass, stack, viewProjectionMatrix };
-    drawCabinets(ctx, kNumCabinets);
-    stack.restore();
+    const ctx = { pass, viewProjectionMatrix };
+    root.updateWorldMatrix();
+    for (const mesh of meshes) {
+      drawMesh(ctx, mesh);
+    }
```

그리고 카메라 코드를 조금씩 수정해보도록 하죠.

```js
  const settings = {
-    baseRotation: 0,
+    cameraRotation: 0,
  };

  const radToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'baseRotation', radToDegOptions);
+  gui.add(settings, 'cameraRotation', radToDegOptions);

...

  function render() {
    ...

-    const eye = [0, 80, 200];
-    const target = [0, 80, 0];
-    const up = [0, 1, 0];
-
-    // 뷰 행렬을 계산합니다.
-    const viewMatrix = mat4.lookAt(eye, target, up);
+    // 카메라 행렬을 계산합니다.
+    const cameraMatrix = mat4.identity();
+    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
+    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+
+    // 뷰 행렬을 계산합니다.
+    const viewMatrix = mat4.inverse(cameraMatrix);

    // 보기 행렬과 투영 행렬을 결합합니다.
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

그렇게 하면, 우리는 여전히 같은 파일 저장소를 사용하게 되지만, 이번에는 장면 그래프를 사용하게 됩니다.

{{{example url="../webgpu-scene-graphs-file-cabinets.html"}}}

## <a id="a-gui"></a> GUI 추가하기

시각적 그래프의 중요한 점은, 그 그래프가 단순한 데이터에 불과하다는 것입니다. 따라서 우리는 그 데이터를 원하는 대로 조작할 수 있습니다. 이제 그래프를 조정할 수 있는 UI를 추가해 보겠습니다.

먼저, 이동, 회전, 크기 조절 기능을 위한 컨트롤을 추가해 보겠습니다. UI는 `TRS`을 조절하는 역할을 하겠지만, 어떤 `TRS`을 편집할지도 우리가 직접 선택할 수 있도록 할 것입니다.

```js
  // UI에 TRS를 전달합니다. 어떤 TRS를 설정할지 지정합니다.
  // 현재 편집 중입니다.
  class TRSUIHelper {
    #trs = new TRS();

    constructor() {}

    setTRS(trs) {
      this.#trs = trs;
    }

    get translationX() { return this.#trs.translation[0]; }
    set translationX(x) { this.#trs.translation[0] = x; }
    get translationY() { return this.#trs.translation[1]; }
    set translationY(x) { this.#trs.translation[1] = x; }
    get translationZ() { return this.#trs.translation[2]; }
    set translationZ(x) { this.#trs.translation[2] = x; }

    get rotationX() { return this.#trs.rotation[0]; }
    set rotationX(x) { this.#trs.rotation[0] = x; }
    get rotationY() { return this.#trs.rotation[1]; }
    set rotationY(x) { this.#trs.rotation[1] = x; }
    get rotationZ() { return this.#trs.rotation[2]; }
    set rotationZ(x) { this.#trs.rotation[2] = x; }

    get scaleX() { return this.#trs.scale[0]; }
    set scaleX(x) { this.#trs.scale[0] = x; }
    get scaleY() { return this.#trs.scale[1]; }
    set scaleY(x) { this.#trs.scale[1] = x; }
    get scaleZ() { return this.#trs.scale[2]; }
    set scaleZ(x) { this.#trs.scale[2] = x; }
  }
```

```js
+ const trsUIHelper = new TRSUIHelper();

  const settings = {
-    cameraRotation: 0,
+    cameraRotation: degToRad(-45),
  };

-  const radToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };
+  const radToDegOptions = { min: -90, max: 90, step: 1, converters: GUI.converters.radToDeg };
+  const cameraRadToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'cameraRotation', radToDegOptions);
+  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
+  const trsFolder = gui.addFolder('orientation');
+  trsFolder.add(trsUIHelper, 'translationX', -200, 200, 1),
+  trsFolder.add(trsUIHelper, 'translationY', -200, 200, 1),
+  trsFolder.add(trsUIHelper, 'translationZ', -200, 200, 1),
+  trsFolder.add(trsUIHelper, 'rotationX', radToDegOptions),
+  trsFolder.add(trsUIHelper, 'rotationY', radToDegOptions),
+  trsFolder.add(trsUIHelper, 'rotationZ', radToDegOptions),
+  trsFolder.add(trsUIHelper, 'scaleX', 0.1, 100),
+  trsFolder.add(trsUIHelper, 'scaleY', 0.1, 100),
+  trsFolder.add(trsUIHelper, 'scaleZ', 0.1, 100),
```

이제, 노드를 선택할 방법이 필요합니다. 그래서 장면 그래프를 따라가서 각 노드마다 버튼을 만들어보겠습니다.

```js
import GUI from '../3rdparty/muigui-0.x.module.js';
+import { addButtonLeftJustified } from './resources/js/gui-helpers.js';

...
+  const kUnelected = '\u3000'; // 전체 너비의 공간
+  const kSelected = '➡️';
+  const prefixRE = new RegExp(`^(?:${kUnelected}|${kSelected})`);
+
+  function setCurrentSceneGraphNode(node) {
+    trsUIHelper.setTRS(node.source);
+    trsFolder.name(`orientation: ${node.name}`);
+    trsFolder.updateDisplay();
+
+    // Mark는 어떤 노드가 선택되었는지를 나타냅니다.
+    for (const b of nodeButtons) {
+      const name = b.button.getName().replace(prefixRE, '');
+      b.button.name(`${b.node === node ? kSelected : kUnelected}${name}`);
+    }
+  }
+
+  // \u00a0는 비단절단 공간입니다.
+  const threeSpaces = '\u00a0\u00a0\u00a0';
+  const barTwoSpaces = '\u00a0|\u00a0';
+  const plusDash = '\u00a0+-';
+  // GUI에 장면 그래프 노드를 추가하고, 적절한 설정을 해야 합니다.
+  // 전치사어가 있어서, 그 모양은 이렇게 생겼습니다.
+  //
+  // +-root
+  // | +-child
+  // | | +-child
+  // | +-child
+  // +-child
+  function addSceneGraphNodeToGUI(gui, node, last, prefix) {
+    if (node.source instanceof TRS) {
+      const label = `${prefix === undefined ? '' : `${prefix}${plusDash}`}${node.name}`;
+      addButtonLeftJustified(
+        gui, label, () => setCurrentSceneGraphNode(node));
+    }
+    const childPrefix = prefix === undefined
+      ? ''
+      : `${prefix}${last ? threeSpaces : barTwoSpaces}`;
+    node.children.forEach((child, i) => {
+      const childLast = i === node.children.length - 1;
+      addSceneGraphNodeToGUI(gui, child, childLast, childPrefix);
+    });
+  }

  const gui = new GUI();
  ...
+  const nodesFolder = gui.addFolder('nodes');
+  addSceneGraphNodeToGUI(nodesFolder, root);
+
+  setCurrentSceneGraphNode(root.children[0]);
```

위에서, `TRS` 소스를 가진 각 노드마다 버튼을 만들었습니다. 버튼을 클릭하면 `setCurrentSceneGraphNode` 함수가 호출되며, 해당 버튼에 해당하는 노드가 전달됩니다. `setCurrentSceneGraphNode` 함수는 폴더의 이름을 업데이트한 후, `trsFolder.updateDisplay` 함수를 호출하여 새로 선택된 `TRS` 데이터를 기반으로 UI를 업데이트합니다.

이 방법은 작동하지만, 우리의 작은 창 크기로는 UI가 조금 혼란스러워 보입니다. 그래서 몇 가지 조정을 더 해 보겠습니다.

1. 변환, 회전, 크기 조절 기능들을 줄여주세요.

   각 서류 캐비닛 노드의 이동, 회전, 크기 조절 값은 총 9개입니다. 서랍을 여닫는 데 필요한 값은 `translation z`이므로, 기본 화면에선 이동 설정만 표시합니다.

   ```js
    const settings = {
      cameraRotation: degToRad(-45),
   +   showAllTRS: false,
    };

    const gui = new GUI();
    gui.onChange(render);
    gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
   + gui.add(settings, 'showAllTRS').onChange(showTRS);
    const trsFolder = gui.addFolder('orientation');
   + const trsControls = [
   *   trsFolder.add(trsUIHelper, 'translationX', -200, 200, 1),
   *   trsFolder.add(trsUIHelper, 'translationY', -200, 200, 1),
   *   trsFolder.add(trsUIHelper, 'translationZ', -200, 200, 1),
   *   trsFolder.add(trsUIHelper, 'rotationX', radToDegOptions),
   *   trsFolder.add(trsUIHelper, 'rotationY', radToDegOptions),
   *   trsFolder.add(trsUIHelper, 'rotationZ', radToDegOptions),
   *   trsFolder.add(trsUIHelper, 'scaleX', 0.1, 100),
   *   trsFolder.add(trsUIHelper, 'scaleY', 0.1, 100),
   *   trsFolder.add(trsUIHelper, 'scaleZ', 0.1, 100),
   + ];
   const nodesFolder = gui.addFolder('nodes');
   addSceneGraphNodeToGUI(nodesFolder, root);

   +const alwaysShow = new Set([0, 1, 2]);
   +function showTRS(show) {
   +  trsControls.forEach((trs, i) => {
   +    trs.show(show || alwaysShow.has(i));
   +  });
   +}
   +showTRS(false);
   ```

   이 코드는, 변환, 회전, 축척 조절 관련 기능들을 하나의 배열로 모아서 표시합니다. 여기서는 전체 기능을 보여주거나, 그중에서도 처음 3개의 기능만을 보여줍니다.

2. 메시들을 표시하지 마세요.

   그래프에는 각 큐브에 해당하는 ‘-mesh’ 노드가 있습니다. 사실, 캐비닛이나 서랍을 움직일 필요는 없으므로, 기본적으로는 이러한 요소들을 숨겨두도록 하겠습니다.

   ```js
     // \u00a0는 비단절단 공간입니다.
     const threeSpaces = '\u00a0\u00a0\u00a0';
     const barTwoSpaces = '\u00a0|\u00a0';
     const plusDash = '\u00a0+-';
     // GUI에 장면 그래프 노드를 추가하고, 적절한 설정을 해야 합니다.
     // 전치사어가 있어서, 그 모양은 이렇게 생겼습니다.
     //
     // +-root
     // | +-child
     // | | +-child
     // | +-child
     // +-child
     function addSceneGraphNodeToGUI(gui, node, last, prefix) {
   +   const nodes = [];
       if (node.source instanceof TRS) {
         const label = `${prefix === undefined ? '' : `${prefix}${plusDash}`}${node.name}`;
   -      addButtonLeftJustified(gui, label, () => setCurrentSceneGraphNode(node));
   +      nodes.push(addButtonLeftJustified(
   +        gui, label, () => setCurrentSceneGraphNode(node)));
       const childPrefix = prefix === undefined
         ? ''
         : `${prefix}${last ? threeSpaces : barTwoSpaces}`;
   -    node.children.forEach((child, i) => {
   +    nodes.push(...node.children.map((child, i) => {
   *      const childLast = i === node.children.length - 1;
   -      addSceneGraphNodeToGUI(gui, child, childLast, childPrefix);
   +      return addSceneGraphNodeToGUI(gui, child, childLast, childPrefix);
   *    }));
   +    return nodes.flat();
     }

     const settings = {
       cameraRotation: degToRad(-45),
   +    showMeshNodes: false,
       showAllTRS: false,
     };

     const gui = new GUI();
     gui.onChange(render);
     gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
   +  gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
     gui.add(settings, 'showAllTRS').onChange(showTRS);

      ...

   -  const nodesFolder = gui.addFolder('nodes');
     addSceneGraphNodeToGUI(nodesFolder, root);
   +  const nodeButtons = addSceneGraphNodeToGUI(nodesFolder, root);

   + function showMeshNodes(show) {
   +   for (const child of nodeButtons) {
   +     if (child.domElement.textContent.includes('mesh')) {
   +       child.show(show);
   +     }
   +   }
   + }
   + showMeshNodes(false);
   ```

서랍(`drawer`)을 선택하고 `translation z` 값을 조절해 보세요.

{{{example url="../webgpu-scene-graphs-file-cabinets-w-gui.html"}}}

보시다시피, 각 노드에 대한 데이터를 가지고 있기 때문에, 특정 노드의 위치, 회전, 크기를 쉽게 변경할 수 있습니다.

## <a id="a-animate"></a> 애니메이션화하기

재미삼아, 서랍들을 애니메이션으로 표현해 봅시다.

먼저, 드로어 노드들의 목록을 만들어보겠습니다.

```js
  const animNodes = [];

  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // 전체 서랍에 대한 노드를 추가합니다.
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
+    animNodes.push(drawer);

    // 서랍용 큐브를 나타내는 노드를 추가해 주세요.
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // 핸들을 위한 큐브 모양의 노드를 추가해 주세요.
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

그 다음에는, 시간에 따라 서랍의 움직임을 애니메이션화하는 코드를 작성해 보겠습니다.

```js
  const lerp = (a, b, t) => a + (b - a) * t;

  function animate(time) {
    animNodes.forEach((node, i) => {
      const source = node.source;
      const t = time + i * 1;
      const l = Math.sin(t) * 0.5 + 0.5;
      source.translation[2] = lerp(1, kDrawerSize[2] * 0.8, l);
    });
  }
```

렌더링 루프를 만들겠습니다. 이미 예약한 프레임이 있으면 또 요청하지 않고, 예약된 프레임이 없을 때만 새로 요청합니다.

```js
+  // 아직 요청되지 않았다면, 요청을 해야 합니다.
+  let renderRequestId;
+  function requestRender() {
+    if (!renderRequestId) {
+      renderRequestId = requestAnimationFrame(render);
+    }
+  }

  function render() {
+    renderRequestId = undefined;
    ...

  }
```

그리고, 이전에 `render`이라고 불렸던 곳들을 `requestRender`이라고 불리도록 업데이트해야 합니다.

```js
  const gui = new GUI();
-  gui.onChange(render);
+  gui.onChange(requestRender);
  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);

  ...

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // 재 렌더링
-      render();
+      requestRender();
    }
  });
  observer.observe(canvas);
```

마지막으로, 애니메이션을 켜거나 끌 수 있도록 코드를 설정해 보겠습니다.

```js
  const settings = {
    cameraRotation: degToRad(-45),
+    animate: false,
    showMeshNodes: false,
    showAllTRS: false,
  };

  const gui = new GUI();
  gui.onChange(requestRender);
  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
+  gui.add(settings, 'animate').onChange(v => {
+    trsFolder.enable(!v);
+  });
  gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
  gui.add(settings, 'showAllTRS').onChange(showTRS);

  ...

+  let then;
+  let time = 0;
+  let wasRunning = false;
  function render() {
    renderRequestId = undefined;

  ...

+    const isRunning = settings.animate;
+    const now = performance.now() * 0.001;
+    const deltaTime = wasRunning ? now - then : 0;
+    then = now;
+
+    if (isRunning) {
+      time += deltaTime;
+    }
+    wasRunning = isRunning;
+
+    if (settings.animate) {
+      animate(time);
+      trs.updateDisplay();
+      requestRender();
+    }
  }
```

또 다른 문제는, “animate”가 켜져 있을 때만 시계를 실행시키고 싶다는 것입니다. 그래서 우리는 마지막 프레임에서 `wasRunning` 값이 무엇인지 확인합니다. 만약 그렇지 않다면, `deltaTime`을 0으로 설정합니다. 이렇게 하면, 애니메이션이 일어나지 않았던 시간 동안 시계가 앞으로 이동하지 않습니다.

애니메이션을 진행하는 경우, 이동, 회전, 크기 조절 컨트롤을 비활성화합니다.

마지막으로, `settings.animate`가 true로 설정된 경우, 또 다른 애니메이션 프레임을 요청합니다. GUI 코드는 변경 사항이 있을 때마다 `requestRender`을 호출하므로, `settings.animate`가 true인 경우, 또 다른 프레임을 렌더링하기 시작합니다.

{{{example url="../webgpu-scene-graphs-file-cabinets-w-animation.html"}}}

장면 그래프의 또 다른 장점은 애니메이션을 쉽게 적용할 수 있다는 점입니다. 우리는 단지 노드에 애니메이션을 적용하기만 하면 됩니다. 애니메이션이 어떻게 생성되었는지는 미리 신경 쓸 필요가 없습니다.

## <a id="a-hand"></a> 손을 만드는 것

새로운 손의 예를 하나 만들어보겠습니다. 간단하게 하기 위해, 정육면체로 예를 들겠습니다.

다음은 장면 그래프가 어떤 모습일지 나타낸 도식입니다.

```
oot
 +-wrist
    +-palm
    |  +-thumb
    |  |  +-thumb-mesh
    |  |  +-thumb-1
    |  |     +-thumb-1-mesh
    |  +-index finger
    |  |  +-index finger-mesh
    |  |  +-index finger-1
    |  |     +-index finger-1-mesh
    |  |     +-index finger-2
    |  |        +-index finger-2-mesh
    |  +-middle finger
    |  |  +-middle finger-mesh
    |  |  +-middle finger-1
    |  |     +-middle finger-1-mesh
    |  |     +-middle finger-2
    |  |        +-middle finger-2-mesh
    |  +-ring finger
    |  |  +-ring finger-mesh
    |  |  +-ring finger-1
    |  |     +-ring finger-1-mesh
    |  |     +-ring finger-2
    |  |        +-ring finger-2-mesh
    |  +-pinky
    |     +-pinky-mesh
    |     +-pinky-1
    |        +-pinky-1-mesh
    |        +-pinky-2
    |           +-pinky-2-mesh
    +-palm-mesh
```

먼저, 큐브의 정점들을 XZ 평면 위에 위치하도록 이동시켜야 합니다. 이를 위해서는 장면 그래프에 더 많은 노드를 추가하거나, 각 ‘메시’ 노드에서 이 작업을 수행할 수도 있습니다. 하지만 정점 자체에서 이 작업을 수행하는 것이 더 간단할 것입니다.

```js
function createCubeVertices() {
  const positions = [
    // 왼쪽
-    0, 0,  0,
-    0, 0, -1,
-    0, 1,  0,
-    0, 1, -1,
+   -0.5, 0,  0.5,
+   -0.5, 0, -0.5,
+   -0.5, 1,  0.5,
+   -0.5, 1, -0.5,

    // 올바른쪽
-    1, 0,  0,
-    1, 0, -1,
-    1, 1,  0,
-    1, 1, -1,
+    0.5, 0,  0.5,
+    0.5, 0, -0.5,
+    0.5, 1,  0.5,
+    0.5, 1, -0.5,
  ];

  ...
```

이제, 장면 그래프를 만들어보겠습니다. 파일 캐비닛 장면 그래프를 생성하는 데 관련된 모든 코드를 삭제하고, 그 자리에 이 코드를 사용하도록 변경해 주세요.

```js
+  const kWhite = [1, 1, 1, 1];
+  function addFinger(name, parent, segments, segmentHeight, trs) {
+    const nodes = [];
+    const baseName = name;
+    for (let i = 0; i < segments; ++i) {
+      const node = addTRSSceneGraphNode(name, parent, trs);
+      nodes.push(node);
+      const meshNode = addTRSSceneGraphNode(`${name}-mesh`, node, { scale: [10, segmentHeight, 10] });
+      addMesh(meshNode, cubeVertices, kWhite);
+      parent = node;
+      name = `${baseName}-${i + 1}`;
+      trs = {
+        translation: [0, segmentHeight, 0],
+        rotation: [degToRad(15), 0, 0],
+      };
+    }
+    return nodes;
+  }

  const root = new SceneGraphNode('root');
+  const wrist = addTRSSceneGraphNode('wrist', root);
+  const palm = addTRSSceneGraphNode('palm', wrist, { translation: [0, 100, 0] });
+  const palmMesh = addTRSSceneGraphNode('palm-mesh', wrist, { scale: [100, 100, 10] });
+  addMesh(palmMesh, cubeVertices, kWhite);
+  const rotation = [degToRad(15), 0, 0];
+  const animNodes = [
+    wrist,
+    palm,
+    ...addFinger('thumb',         palm, 2, 20, { translation: [-50, 0, 0], rotation }),
+    ...addFinger('index finger',  palm, 3, 30, { translation: [-25, 0, 0], rotation }),
+    ...addFinger('middle finger', palm, 3, 35, { translation: [ -0, 0, 0], rotation }),
+    ...addFinger('ring finger',   palm, 3, 33, { translation: [ 25, 0, 0], rotation }),
+    ...addFinger('pinky',         palm, 3, 25, { translation: [ 45, 0, 0], rotation }),
+  ];
```

우리는 손목을 만들고, 그 손목에 손바닥과 손바닥의 막대를 부착합니다. 손바닥에는 `addFinger` 함수를 사용하여 5개의 손가락을 부착합니다. 손가락을 추가하는 것은 각각 특정 길이를 가진 손가락 부분들을 추가하는 것입니다.

> 네, 이건 인간의 손으로서는 전혀 적절하지 않은 모습입니다 😂

반면, 파일 캐비닛의 경우에는 `translation z`에만 관심이 있었습니다. 하지만 손에 있어서 가장 중요한 변환은 `rotation x`입니다. 그러므로, 기본적으로 어떤 제어 기능들이 표시되는지 조정해 보겠습니다.

```js
-  const alwaysShow = new Set([0, 1, 2]);
+  const alwaysShow = new Set([0, 1, 3]);
  function showTRS(show) {
    trsControls.forEach((trs, i) => {
      trs.show(show || alwaysShow.has(i));
    });
  }
  showTRS(false);
```

손의 애니메이션에서는 z 방향으로 이동하는 대신, x 방향으로 회전해야 합니다.

```js
  function animate(time) {
    animNodes.forEach((node, i) => {
      const source = node.source;
-      const t = time + i * 1;
+      const t = time + i * 0.1;
      const l = Math.sin(t) * 0.5 + 0.5;
-      source.translation[2] = lerp(1, kDrawerSize[2] * 0.8, l);
+      source.rotation[0] = lerp(0, Math.PI * 0.25, l);
    });
  }
```

마지막으로, 케트는 카메라의 위치를 약간 조정합니다.

```js
    // 카메라 행렬을 계산합니다.
    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 100, 0], cameraMatrix);
    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 0, 300], cameraMatrix);
```

{{{example url="../webgpu-scene-graphs-hand.html"}}}

손가락을 선택한 다음, ‘rotation x’를 입력하면, 아래쪽에 있는 모든 세그먼트들도 함께 회전하게 됩니다.

## <a id="a-shoot"></a> 이제 검지손가락으로 발사체를 쏴보겠습니다.

장면 그래프의 또 다른 장점은, 그래프 내의 어떤 노드의 위치와 방향을 쉽게 확인할 수 있다는 점입니다.

따라서, 검지손가락으로 사진을 찍으려면, 손가락 끝에 해당하는 노드를 알아야 합니다.

많은 장면 그래프 API들은 노드의 이름을 기준으로 노드를 찾는 기능을 제공합니다. 우리의 API에도 그러한 기능을 추가해 보겠습니다.

```js
class SceneGraphNode {
  constructor(name, source) {
    this.name = name;
    this.children = [];
    this.localMatrix = mat4.identity();
    this.worldMatrix = mat4.identity();
    this.source = source;
  }

+  find(name) {
+    if (this.name === name) {
+      return this;
+    }
+    for (const child of this.children) {
+      const found = child.find(name);
+      if (found) {
+        return found;
+      }
+    }
+    return undefined;
+  }

  ...
}
```

이렇게 하면, 검지손가락의 마지막 부분을 이름으로 찾을 수 있습니다. 그 노드는 검지손가락의 끝부분이 아니라, 그 부분이 회전하는 지점을 나타냅니다. 그러니, 그 검지손가락의 마지막 부분의 자식 노드로 또 다른 노드를 추가해 보겠습니다. 그 노드는 실제로 검지손가락의 끝부분을 나타냅니다.

```js
  const root = new SceneGraphNode('root');
  const wrist = addTRSSceneGraphNode('wrist', root);
  const palm = addTRSSceneGraphNode('palm', wrist, { translation: [0, 100, 0] });
  const palmMesh = addTRSSceneGraphNode('palm-mesh', wrist, { scale: [100, 100, 10] });
  addMesh(palmMesh, cubeVertices, kWhite);
  const rotation = [degToRad(15), 0, 0];
  const animNodes = [
    wrist,
    palm,
    ...addFinger('thumb',         palm, 2, 20, { translation: [-50, 0, 0], rotation }),
    ...addFinger('index finger',  palm, 3, 30, { translation: [-25, 0, 0], rotation }),
    ...addFinger('middle finger', palm, 3, 35, { translation: [ -0, 0, 0], rotation }),
    ...addFinger('ring finger',   palm, 3, 33, { translation: [ 25, 0, 0], rotation }),
    ...addFinger('pinky',         palm, 3, 25, { translation: [ 45, 0, 0], rotation }),
  ];
+  const fingerTip = addTRSSceneGraphNode('finger-tip', root.find('index finger-2'), { translation: [0, 30, 0] });
```

이제 우리는 발사체가 필요합니다. [행렬 스택](webgpu-matrix-stacks.html)에서 장식용으로 만들었던 원뿔 모양의 구조물을 사용할 것입니다.

```js
  const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const shotVertices = createVertices(createConeVertices({
+    radius: 10,
+    height: 20,
+  }), 'shot');
```

이제, 프로젝트를 발사하는 코드를 추가해 보겠습니다.

```js
  const kShotVelocity = 100; // 초당 단위 수
  const shots = [];
  let shotId = 0;
  function fireShot() {
    const node = new SceneGraphNode(`shot-${shotId++}`);
    node.setParent(root);
    mat4.translate(fingerTip.worldMatrix, [0, 20, 0], node.localMatrix);
    const mesh = addMesh(node, shotVertices, kWhite);
    const velocity = vec3.mulScalar(
      vec3.normalize(vec3.getAxis(fingerTip.worldMatrix, 1)),
      kShotVelocity);
    shots.push({
      node,
      mesh,
      velocity,
      endTime: performance.now() * 0.001 + 5,
    });
    requestRender();
  }
```

이 코드는 `shots` 배열에 “shot”이라는 항목을 추가합니다. 여기에는 `node`, `mesh`, `velocity`, 그리고 `endTime`이 포함됩니다.

`node`는 Y축에서 20단위 떨어진 위치에 있습니다. 이는 원뿔 모양의 꼭짓점을 만들기 위한 코드 때문에, 끝부분이 20단위나 튀어나오기 때문입니다. 그래서 그 부분을 보정해야 합니다. 하지만 그냥 원뿔 모양의 꼭짓점을 만드는 코드를 수정하는 것도 가능하지만, 그보다는 이 방법이 더 간단합니다. 참고로, 이 노드에는 `TRS` 소스를 추가하지 않습니다. 대신, 로컬 행렬을 직접 업데이트할 것입니다.

`mesh`는 메시의 정점들을 나타냅니다. 이 정보가 필요한 이유는, 샷이 완료된 후에 렌더링해야 할 요소들 목록에서 그 샷에 해당하는 메시를 제거할 수 있도록 하기 위함입니다.

`velocity`는 발사할 때의 방향과 속도를 나타냅니다. 우리는 `vec3.getAxis`를 사용하여 발사할 때의 방향인 y축을 얻습니다. 왜냐하면 손가락이 가리키는 방향이 바로 y축이기 때문입니다. [직교 투영](webgpu-orthographic-projection.html)에서 설명한 것처럼, Y축은 열 우선으로 저장한 행렬의 두 번째 열입니다. 배열 인덱스 4, 5, 6이 그 방향의 X, Y, Z 성분입니다. 따라서 `vec3.getAxis`는 다음과 같이 구현될 수 있습니다.

```js
const vec3 = {
  ...
+  // 0 = x, 1 = y, 2 = z;
+  getAxis(m, axis, dst) {
+    dst = dst || new Float32Array(3);
+
+    const offset = axis * 4;
+    dst[0] = m[offset + 0];
+    dst[1] = m[offset + 1];
+    dst[2] = m[offset + 2];
+
+    return dst;
+  },
  ...
};
```

또는, 코드는 그 y축 값을 가져와서 그 방향을 정규화한 다음, `vec3.mulScalar`을 사용하여 원하는 속도 값을 얻습니다.

`vec3.mulScalar`을 제공해야 합니다.

```js
const vec3 = {
  ...
  mulScalar(a, scale, dst) {
    dst = dst || new Float32Array(3);

    dst[0] = a[0] * scale;
    dst[1] = a[1] * scale;
    dst[2] = a[2] * scale;

    return dst;
  },  ...
};
```

마지막으로, `endTime`은 그 샷을 삭제하기 위한 미래의 시간입니다.

그렇게 하면, 프로젝트를 이동시키는 코드도 추가해 보겠습니다.

```js
  function processShots(now, deltaTime) {
    if (shots.length > 0) {
      requestRender();
      while (shots.length && shots[0].endTime <= now) {
        const shot = shots.shift();
        shot.node.setParent(null);
        removeMesh(shot.mesh);
      }
      for (const shot of shots) {
        const v = vec3.mulScalar(shot.velocity, deltaTime);
        mat4.multiply(mat4.translation(v), shot.node.localMatrix, shot.node.localMatrix);
      }
    }
  }
```

그 코드는 샷의 시간이 만료되었는지 확인합니다. 만약 그렇다면, 그 샷의 노드는 장면 그래프에서 제거되고, 그 메시도 렌더링해야 할 항목 목록에서 삭제됩니다.

그렇지 않다면, 배열에 있는 각 샷에 대해, 그 샷의 속도를 샷의 행렬에 더해줍니다. 그리고 그 값을 `deltaTime`으로 곱하여, 프레임 속도와 무관하게 처리합니다.

`removeMesh` 함수를 제공해야 합니다.

```js
  function removeMesh(mesh) {
    meshes.splice(meshes.indexOf(mesh), 1);
  }
```

이제, 발사하는 버튼도 추가해야 합니다. 또한, 이 처리 함수를 실제로 호출해야 합니다.

```js
  const gui = new GUI();
  gui.onChange(requestRender);
  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
  gui.add(settings, 'animate').onChange(v => {
    trsFolder.enable(!v);
  });
  gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
  gui.add(settings, 'showAllTRS').onChange(showTRS);
+  gui.addButton('Fire!', fireShot);

  ...

  function render() {
    ...

-      const isRunning = settings.animate;
+      const isRunning = settings.animate || shots.length;
      const now = performance.now() * 0.001;
      const deltaTime = wasRunning ? now - then : 0;
      then = now;

      if (isRunning) {
        time += deltaTime;
      }
      wasRunning = isRunning;

      if (settings.animate) {
        animate(time);
        updateCurrentNodeGUI();
        requestRender();
      }

+      processShots(now, deltaTime);
  }
```

만약 샷이 있다면 계속해서 실행해야 합니다. ‘Fire!’ 버튼을 누르면 새로운 샷이 추가됩니다. 또한, GUI도 `requestRender`을 호출하므로, 이 코드를 통해 `processShots`가 호출됩니다. `processShots`는 만약 샷이 있다면 다시 `requestRender`을 호출합니다. 그렇게 해서 애니메이션 루프가 계속 진행됩니다.

{{{example url="../webgpu-scene-graphs-hand-shoot.html"}}}

손가락 중 하나를 선택한 후, 회전 각도를 조절한 다음 ‘Fire!’를 누르세요. 또는 애니메이션이 진행되는 동안 바로 ‘Fire!’를 클릭해도 됩니다.

이 글을 읽고 나면, 장면 그래프가 무엇인지, 그리고 어떻게 사용하는지에 대한 이해가 될 것입니다. Unity, Blender, Unreal, Maya, 3DSMax, Three.js 등 모든 3D 엔진에는 장면 그래프가 있습니다. 장면 그래프의 구조는 다양합니다. 어떤 경우에는 메시들을 그 자체로 저장하여 비동기적인 구조를 만들기도 합니다. 반면, 어떤 경우에는 메시들을 별도로 저장하여 순수한 형태로 유지하기도 합니다. 또한, 장면 그래프를 구현하는 데에는 상당히 복잡한 코드가 필요할 수도 있습니다. 장면 그래프를 가지고 있다는 것은, 3D 엔진을 구축하는 데 있어서 중요한 첫 단계입니다. 모든 3D 엔진이 장면 그래프를 가지고 있는 것은 아니지만, 대부분의 엔진은 그렇습니다.

위의 코드에서, 카메라는 스테이지 그래프의 외부에 위치해 있었습니다. 하지만 실제로는 카메라가 스테이지 그래프의 일부로 포함되는 경우가 더 많습니다. 그래야만 Unity, Unreal, Blender와 같은 프로그램에서 여러 카메라를 함께 조작할 수 있습니다.

그래프 자체에 이를 포함시킴으로써, 카메라는 특정 노드의 자식이 되게 할 수 있습니다. 그렇게 되면 카메라는 그 노드의 영향을 받게 됩니다. 예를 들어, 자동차 운전자의 시점에서 보는 카메라나, 회전하는 보안 카메라 위에 설치된 카메라 등이 있습니다.

장면 그래프는 여러 3D 편집기에서 쓰는 조작 핸들(manipulator)을 만들 때도 도움이 됩니다. 이런 UI로 3D 화면에서 물체를 이동하거나 회전하고 크기를 조절할 수 있습니다. 조작 핸들은 다른 글에서 다룰 수 있을 것입니다.