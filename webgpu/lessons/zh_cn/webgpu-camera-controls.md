Title: WebGPU 相机控制
Description: 控制相机
TOC: 相机控制

本文是关于制作 3D 编辑器组件的短系列文章的第二篇。每个章节都建立在前一篇的基础上，因此你可能会发现按顺序阅读更容易理解。

1. [高亮显示](webgpu-highlighting.html)
2. [相机控制](webgpu-camera-controls.html) ⬅ 你在这里
3. [拾取](webgpu-picking.html)

# 轨道相机

轨道相机是大多数 3D 建模软件（如 Blender、Unity、Maya、3DSMax、Unreal）在编辑器中使用的相机。你可以按下某个图标或按住某个键，然后拖动鼠标绕世界中的某个点旋转。

据我所知，有些术语来自电影行业，有些来自航空领域：

* "平移"（Pan）是指相机在当前位置左右转动。

  当你在手机上拍摄全景照片时，就是"平移"相机。

* "倾斜"（Tilt）是指相机上下转动。

  如果你站着，可能会将相机向下倾斜拍摄花朵，或者向上倾斜拍摄飞机。

* "翻滚"（Roll）就像你把头向左或向右倾斜。

  地平线不再保持水平。

* "推拉"（Dolly）是指将相机靠近或远离目标。

  这通常被认为是"缩放"，但相机的缩放实际上是指改变视野范围，而"推拉"则是指将相机靠近或远离目标。

* "跟踪"（Track）是指将相机沿垂直于其朝向的方向移动。

  我只是猜测这来自于[实际上有一个"轨道"可以滚动电影相机](https://en.wikipedia.org/wiki/Tracking_shot)。

总之，解决这类问题的一种方法是构建一个"支架"（rig）。在 3D 术语中，"支架"通常指的是场景图节点的一个层级结构，可能还附带一些约束。

我们可以构建一个如下层级的结构：

```
+-camTarget（旋转中心的锚点）
  +-camPitch（绕目标"平移"）
    +-camTilt（在目标上方或下方"倾斜"）
      +-camExtend（将相机"推拉"靠近或远离目标）
        +-cam（提供相机矩阵）
```

你可以把它想象成一个由实际机械零件组成的物理支架。我不知道这是否是个好类比，但如果你有一辆军用坦克，坦克本身就是一个 `camTarget`。安装在坦克顶部的旋转炮塔就是 `camPitch`。让炮管上下旋转的部分就是 `camTilt`。炮管本身则是 `camExtend`。可以想象一个可伸缩的炮管，可以改变长度。然后你把相机安装在炮管末端，**朝向坦克方向**。

<div class="webgpu_center">
  <div data-diagram="camera-rig" style="width: 600px;"></div>
</div>

在上图中：

* 蓝色底座是 `camTarget`
* 绿色炮塔头部是 `camPitch`
* 红色铰链是 `camTilt`
* 粉色/紫色炮管是 `camExtend`
* 白色视锥体框架表示位于 `cam` 处的相机，朝向 `camTarget`

默认情况下，图中的各部件是堆叠在一起的，以便于查看，但在我们实际的支架中，它们都叠在一起。点击"折叠"可以将它们放到正确的位置。

无论如何，让我们来构建这个相机支架。

首先做一些小的 UI 调整。因为最终我们希望用户能够在场景上拖动来更新相机，让我们把控件做成更像 3D 编辑器的样式——不是悬浮在场景上方，而是放在右侧的一块区域。我们还要让用户关闭控件时，场景能够扩展填充这部分空间。

首先是一些 HTML 改动：

```html
+<div id="split">
*  <canvas></canvas>
+  <div id="ui"></div>
+</div>
```

以及对应的 CSS：

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

最后，我们将 UI 移到这个 `#ui` div 中，并根据 UI 状态更新 div 的 CSS 类。

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

现在让我们开始构建基于场景图节点的轨道相机。

这是我们的轨道相机支架：

```js
  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // 创建相机支架
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

我们需要添加 `vec3.copy`，这是我们之前没有用到的：

```js
const vec3 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(3);
+    dst.set(src);
+    return dst;
+  },

   ...
```

然后我们需要使用 `OrbitCamera`：

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

-    // 从我们计算的矩阵中获取相机的位置
-    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
-    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
-
-    // 计算视图矩阵
-    const viewMatrix = mat4.inverse(cameraMatrix);
+
+    root.updateWorldMatrix();
+
+    // 根据相机的矩阵创建视图矩阵
+    const viewMatrix = mat4.inverse(orbitCamera.getCameraMatrix());

    // 合并视图矩阵和投影矩阵
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

注意，很多数学运算消失了。`OrbitCamera` 代码中没有数学运算，只有支架节点。这是因为所有数学运算都已经被埋没在支架本身中了。

我们可以这样运行它，但会很难更改任何相机设置，因为我们的 UI 默认只显示平移 x、y、z，或者显示每个节点的所有 9 个平移、旋转和缩放设置。

让我们黑入 UI，这样可以让相机节点只显示相关设置。我们通过添加一个场景图节点到设置的映射来实现，为了简单起见，我们将提供一个索引数组来指定想要显示哪些控件。0、1、2 是平移 x、y、z，3、4、5 是旋转 x、y、z，6、7、8 是缩放。如果节点没有设置，则沿用现有规则。

```js
+  const nodeToUISettings = new Map();

  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // 创建相机支架
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

    // 标记选中的节点
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

通过这些更改，我们用新的 `OrbitCamera` 替换了旧的相机代码，移除了大量数学运算，并让相机的支架节点在 UI 中显示可编辑的设置。

{{{example url="../webgpu-camera-controls-scene-graph-step-01.html"}}}

现在我们有了基础结构，让我们添加一些指针控制。

## <a id="a-pan-and-tilt"></a> 平移和倾斜

让我们在拖动指针时调整平移和倾斜。

首先，我们需要做一个小的 CSS 调整，这样拖动时不会选中画布等内容。

```css
canvas {
  display: block;  /* 让画布表现得像一个块级元素 */
  width: 100%;     /* 让画布填充其容器 */
  height: 100%;
+  touch-action: none;
}
```

然后，让我们在相机中添加一些代码来封装这些变化。我们将创建一个 `getUpdateHelper` 函数，它记录一些相关的、但有点私有的相机状态，这个辅助函数将提供一些函数来根据 UI 代码传入的增量来修改相机状态。

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

然后，我们可以添加一个函数来连接指针输入，创建辅助函数并传入增量。

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

代码非常直接。在 `pointerdown` 时，我们调用 `cam.getUpdateHelper` 来记录当前的 `pan` 和 `tilt`。我们还记录当前的指针位置。在 `pointermove` 时，我们计算从指针开始位置的增量，并将其传递给辅助函数来调整 `pan` 和 `tilt`。基本上就是这样。`addOrbitCameraEventListeners` 还返回一个函数，以便在需要时移除监听器。

再做一个小的改动，让我们让 GUI 检查值的更新。这样当我们只是通过拖动指针来平移和倾斜时，UI 中的值会自动更新。

```js
-  const trsFolder = gui.addFolder('orientation');
+  const trsFolder = gui.addFolder('orientation').listen();
```

试试看，在画布上拖动手指。你可以选择 `cam-tilt` 或 `cam-pan` 节点，你会看到在拖动时值会发生变化。

{{{example url="../webgpu-camera-controls-scene-graph-step-02.html"}}}

## <a id="a-track"></a> 跟踪

通常，如果你按住某个修饰键（如 shift）同时拖动，不是调整平移或倾斜，而是"跟踪"相机（平移它）。

让我们添加这个功能。首先我们需要几个新的数学函数。

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

`create` 只是创建一个包含 3 个零的 vec3。`add` 将两个 vec3 相加。最后，`transformMat3` 将向量乘以 3x3 矩阵。这在[讨论光照法线时](webgpu-lighting-directional.html#a-normals)提到过。在那里，我们将法线（vec3f）乘以法线矩阵（mat3x3f）。这里我们在 JavaScript 中做基本相同的事情，但不是重新定向法线，我们是在重新定向指针移动的方向。

我们现在可以更新辅助函数：

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

`track` 接收一个 xy 增量，将其乘以相机矩阵的左上 3x3 矩阵。这样做的效果是将方向调整为垂直于相机朝向。然后我们只需将其加到目标上。

然后我们从指针事件代码中调用 `track`。

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

我们的事件代码根据用户是否按住 shift 键来计算模式。如果模式切换了，我们需要记录起始值。然后它切换到对应的模式。

我们的 `'track'` 模式将指针增量传递给辅助函数的 `track` 函数。我们按半径（我们离目标的距离）缩放增量，这样如果距离很近，我们会以更小的步幅移动。

我们也可以让用户使用鼠标中键来跟踪。

```js
-      const mode = e.shiftKey
+      const mode = e.shiftKey || (e.buttons & 4) !== 0
        ? 'track'
        : 'panAndTilt';
```

现在你也可以按住鼠标滚轮并移动鼠标来跟踪。

{{{example url="../webgpu-camera-controls-scene-graph-step-03.html"}}}

## <a id="a-dolly-by-wheel"></a> 通过滚轮推拉

接下来让我们用滚轮添加缩放或"推拉"功能，这很常见。

首先更新我们的辅助函数。

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

然后使用它。

```js
  function addOrbitCameraEventListeners(cam, elem) {

  ...


+    // 当用户使用滚轮时推拉
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

通过这个小改动，你应该能够用鼠标滚轮（或笔记本上的两根手指）缩放（推拉）。

代码按半径的千分之一进行调整。这没有在大量场景中测试过，但似乎我们不希望在太近时以相同的速度移动。

{{{example url="../webgpu-camera-controls-scene-graph-step-04.html"}}}

## <a id="a-dolly-by-pinch"></a> 通过双指捏合推拉

在移动设备上，双指捏合缩放很常见。让我们添加这个功能。

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

现在我们跟踪所有指针的起始位置。我们检查是否有 2 个。如果有 2 个，我们在捏合；如果有超过 2 个，我们就放弃；如果只有 1 个，我们回到之前的状态。

在 `computePinchDistance` 中，我们获取 2 个位置并计算它们之间的距离。我们可以用它来记录用户开始捏合时它们之间的距离，以及后来它们之间的距离，然后将这个值应用到缩放上。

如果你有触摸屏笔记本，或者在平板或手机上，你可以试试看。

{{{example url="../webgpu-camera-controls-scene-graph-step-05.html"}}}

## <a id="a-dolly-by-double-tab-drag"></a> 通过双击拖动推拉

再做一个。某些应用中，如果在屏幕上双击然后拖动手指会缩放。比如 Google Maps 就是这样做的。让我们添加这个功能。

```js
  function addOrbitCameraEventListeners(cam, elem) {
    let startX;
    let startY;
    let lastMode;
    let camHelper;
+    let doubleTapMode;
+    let lastSingleTapTime;
+    let startPinchDistance;
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

代码检查是否有单个 `pointerdown`，并检查它与上一次单个 `pointerdown` 之间的时间。如果小于 `kDoubleClickTime`，那么我们就进入 `doubleTapMode`，然后我们可以根据第二次点击开始处的距离来调整缩放。

目前，这适用于鼠标或触摸屏。鼠标用户适合这样吗？试试看。

{{{example url="../webgpu-camera-controls-scene-graph-step-06.html"}}}

## <a id="a-camera-not-at-root"></a> 相机不在根节点

我们还没有涉及的一个问题是，如果我们的 OrbitCamera（在场景图中存在的）不是基于图的根节点怎么办？

例如，假设它是一个在倒塌塔楼上的相机。由于塔楼倒塌了，相机与地面不在同一水平面上。

对于倾斜、平移和推拉，不需要改变，因为这些都是相对于相机本身的。但对于跟踪，我们需要做一些额外的工作，因为相机的目标是相对于其父节点的。

要修复这个问题，首先，我们应该移除 `target` 的 setter，因为它有误导性。我们将创建一个 `setTarget` 函数，该函数会考虑相机的父节点。

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

我们还需要添加 `vec3.transformMat4`，这与我们在顶点着色器中使用 `uni.matrix * vert.position` 相同的数学运算，只是翻译成了 JavaScript。

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

移除了 setter 后，我们需要修复使用它的代码。

```js
  const orbitCamera = new OrbitCamera();
  orbitCamera.setParent(root);
-  orbitCamera.target = [120, 80, 0];
+  orbitCamera.setTarget([120, 80, 0]);
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

我们还需要重构辅助函数的 `track` 函数，以考虑它可能不在根节点的情况，并将增量调整为相对于相机的父节点。

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

我们之前计算的方向是世界空间中的方向。当相机在根节点时这是可行的。但现在，我们乘以相机父节点的 worldMatrix 的逆。这有效地将增量调整为相对于该父节点，这就是我们需要的。

让我们把相机放在一些额外的场景图节点上：

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
+  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  orbitCamera.setParent(extraMov);
```

你应该设置跟踪功能仍然有效。

{{{example url="../webgpu-camera-controls-scene-graph-step-07.html"}}}

## <a id="a-frame-selected"></a> 帧选中的对象

另一个重要功能是能够选择一个对象，然后选择"帧选中"来移动相机显示该对象。要做到这一点，需要知道每个对象的大小。对于这个特定情况，我们恰好知道屏幕上的所有东西都是单位立方体。我们可以在数据上存储一些边界范围，但现在将它们设置为覆盖我们的立方体。

```js
function createCubeVertices() {
  const positions = [
    // left
    0, 0,  0,
    0, 0, -1,
    0, 1,  0,
    0, 1, -1,

    // right
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

`aabb` 是轴对齐边界框（Axis Aligned Bounding Box）的缩写。我们可以很容易地看到这与我们的立方体匹配。如果我们有不同的数据，我们需要扫描它来找到最小值和最大值。

我们需要将这个数据冒泡到我们的网格顶点：

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

我们需要一个函数，给定一个网格，计算该网格在世界空间中的 AABB，因为它会被我们的场景图定向。

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

这使用了另外两个我们需要添加的 `vec3` 函数。`min` 和 `max`，它们返回一个包含 2 个 vec3 每个分量最小或最大值的 `vec3`。

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

然后，我们需要一个函数来遍历选中的网格并获取它们的组合 AABB。

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

有了这些，我们可以创建一个函数来框选选中的网格：

```js
  function frameSelected() {
    if (selectedMeshes.length === 0) {
      return;
    }

    // 获取选中对象的 aabb 边界
    const aabb = getAABBForSelectedMeshes();

    const extent = vec3.subtract(aabb.max, aabb.min);
    const diameter = vec3.distance(aabb.min, aabb.max);

    // 计算我们需要设置半径的距离，以便选中的对象被框住
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fieldOfViewH = 2 * Math.atan(Math.tan(settings.fieldOfView) * aspect);
    const fov = Math.min(fieldOfViewH, settings.fieldOfView);
    const zoomScale = 1.5; // 放大 1.5 倍以提供一些边距
    const halfSize = diameter * zoomScale * 0.5;
    const distance = halfSize / Math.tan(fov * 0.5);

    orbitCamera.radius = distance;

    // 将相机目标指向中心
    const center = vec3.addScaled(aabb.min, extent, 0.5);
    orbitCamera.setTarget(center);

    render();
  }
```

上面的代码获取选中网格的 AABB。包含这个 AABB 的球的直径就是 2 个对角顶点之间的距离。一旦我们有了这个直径，我们计算相机需要距离多远才能给定的当前 `fieldOfView`。我们的 `mat4.perspective` 函数的视野设置是垂直视野，所以我们基于它和宽高比计算水平视野，并使用两者中较小的那个，然后使用它来计算我们需要距离多远才能让我们的球体容纳进去。我们使用 `zoomScale` 使我们的球体比包含我们的 AABB 的球体大 1.5 倍，这样我们会得到一些边距。然后我们只需将相机半径设置为那个距离。

最后，我们将相机的目标指向 AABB 的中心点。

我们需要提供几个更多的 `vec3` 函数，`distance` 和 `addScaled`：

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

`distance` 计算 2 个 `vec3` 之间的距离。`addScaled` 有效地执行 `a + b * scale`。它可以轻松地将 `b` 的某个部分加到 `a` 上。

我们需要在设置中添加 `fieldOfView`：

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

我们还需要添加一个"帧选中"按钮：

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

我们还要添加一个包含所有 4 个柜子的父节点。这样我们就可以选择一个可以框住整个物体的对象。

```js
+  const cabinets = addTRSSceneGraphNode('cabinets', root);
  // 添加柜子
  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
-    addCabinet(root, cabinetNdx);
+    addCabinet(cabinets, cabinetNdx);
  }

  ...

-  setCurrentSceneGraphNode(root.children[2]);
+  setCurrentSceneGraphNode(cabinets.children[1]);
```

同时，顺便移除额外的旋转和平移：

```js
-  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
-  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  const extraRot = addTRSSceneGraphNode('extra-rot', root);
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot);
```

试着选择一个对象然后点击"帧选中"。

{{{example url="../webgpu-camera-controls-scene-graph-step-08.html"}}}

## <a id="a-ux"></a> 用户体验决策

关于轨道相机有非常多的用户体验决策你需要做。其中包括：

* 是否应该允许翻滚？

  翻滚就像你把头向左/右倾斜。

  添加翻滚只需要在我们的当前支架中 `camExtend` 和 `cam` 之间再添加一个带有 z 旋转的节点。

* 是否应该像我们这样只是让你拖动，还是应该要求你用其他方式调整相机？

  在 Unity 中，你必须按住一个键或通过点击图标切换到相机控制模式。在 Blender 中，你点击某些图标或使用鼠标中键和修饰键进行拖动。在"跟踪相机"图标上拖动会跟踪相机。在"轨道相机"图标上拖动会旋转相机。在缩放图标上拖动会缩放（推拉）相机。

  对于查看器来说，能够直接拖动而不需要任何按键或图标会很方便。对于编辑器来说，大多数活动是编辑 3D 内容，可能最好使用图标、添加模式，或者让用户按住一个键。

* 在移动设备上应该发生什么？

  我们没有为跟踪相机提供解决方案。我们目前唯一的方法需要按住 shift。使用图标拖动可以工作。我认为一些查看器使用两个手指来跟踪。

* 是否应该允许倾斜超过 90 度？

  我们允许超过 90 度，这意味着相机可以翻转过来。有些应用会阻止这种情况。

* "帧"应该保持相同的方向吗？

  大多数 3D 编辑器让你选择一个对象然后选择"帧"，该对象会在相机中居中，并且相机会围绕该对象旋转。问题是，相机的方向是否会重置，比如从对象的正面观看。或者它可能总是沿着正 Z 方向看。或者它是否保持选择"帧"之前的方向。例如，如果你俯视对象 A 然后选择 B，它仍然应该俯视吗？

* 相机应该相对于指针向哪个方向移动？

  换句话说，如果你从左到右拖动指针，相机应该顺时针还是逆时针旋转。逆时针让你感觉你在绕着相机旋转。顺时针让你感觉你在转动相机下的世界。这类似于在触控板上拖动两根手指滚动。如果你向下拖动，内容应该向上移动，因为你在视图上拖动内容。或者内容应该向下移动，就好像你在拖动内容本身。

  在触摸屏上，你通常希望它看起来像你在拖动内容，但滚动条在触摸屏之前就存在了。拖动滚动条上的手柄会拖动视图，而不是内容。滚轮移动那个手柄。触控板上的两根手指是滚轮的一种快捷方式。

## <a id="a-no-scene-graph"></a> 不使用场景图实现 OrbitCamera

如果你理解了[场景图相关文章](webgpu-scene-graphs.html)中场景图的工作原理，那就应该很清楚了。我们只需要这样的代码：

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

把它放到我们的示例中只需要一个小的改动。因为它不在场景图中，所以我们不需要把它添加到场景图中。

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
  orbitCamera.target = [120, 80, 0];
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

它可以工作。

{{{example url="../webgpu-camera-controls-raw.html"}}}

现在我们有了相机，让我们实现[直接点击对象来选择它们](webgpu-picking.html)。

<!-- keep this at the bottom of the article -->
<link href="webgpu-camera-controls.css" rel="stylesheet">
<script type="module" src="webgpu-camera-controls.js"></script>
