Title: WebGPU シーングラフ
Description: シーングラフ
TOC: シーングラフ

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事は、3D数学について学ぶことを目的とした一連の記事の9番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html)
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html) ⬅ ここです

前回の記事では、行列スタックについて説明しました。これにより、行列の変更のスタックを構築でき、他のものに対して相対的に物事を配置、方向付け、スケーリングするのに役立ちました。

シーングラフは、ある意味では同じものですが、コードを使用する代わりに、データを使用します。親と子のグラフを構築し、子は親の行列に基づいて行列を計算します。

ファイリングキャビネットのシーングラフは次のようになります。

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

シーングラフの利点は、データをグラフのノードとして格納するため、コードで再帰することなく、グラフの任意の部分を簡単に操作できることです。

## 前の記事のファイルキャビネットの例をシーングラフを使用するように切り替えましょう。

最初に必要なのは、シーングラフを表すクラスです。

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
    // 親から自分を削除します
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this);
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1);
      }
    }

    // 新しい親に自分を追加します
    if (parent) {
      parent.children.push(this);
    }
    this.parent = parent;
  }

  updateWorldMatrix(parentWorldMatrix) {
    // ソースがある場合は、そのソースからローカル行列を更新します。
    this.source?.getMatrix(this.localMatrix);

    if (parentWorldMatrix) {
      // 行列が渡されたので、計算を行います
      mat4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
    } else {
      // 行列が渡されなかったので、ローカルをワールドにコピーするだけです
      mat4.copy(this.localMatrix, this.worldMatrix);
    }

    // すべての子を処理します
    const worldMatrix = this.worldMatrix;
    this.children.forEach(function(child) {
      child.updateWorldMatrix(worldMatrix);
    });
  }
}
```

上記の`SceneGraphNode`は非常に単純です。各ノードには`children`の配列があります。子を追加および削除したり、ノードの親を設定したりする関数があります。各ノードには、このノードの位置、向き、スケールを親に対して表す`localMatrix`があります。各ノードには、このノードの位置、向き、スケールを「ワールド」に対して、より具体的にはシーングラフの外部に対して表す`worldMatrix`があります。そして最後に、ノードとそのすべての子の`worldMatrix`を更新する`updateWorldMatrix`があります。各ノードには、`getMatrix`関数を提供するオブジェクトであるオプションの`source`もあります。これを使用して、特定のノードのローカル行列を計算するさまざまな方法を提供できます。

ソースを提供しましょう。

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

`TRS`は、Translation、Rotation、Scaleの略です。これは、シーングラフでローカル行列を計算する一般的な方法です。多くの場合、一部の実装では「translation」の代わりに「position」を使用します。このチュートリアルでは、`getMatrix`で行うことと一致するため、「translation」を使用する方が良いと思いました。

上記で目立つことの1つは、`this.translation`、`this.rotation`、`this.scale`を`new Float32Array(value)`に設定することです。`Float32Array`の利点は、`set`関数があるため、`someTRS.translation.set(someNewValue)`を実行できることです。

`getMatrix`が、事実上、次を使用して行列を計算することがわかります。

```
平行移動 * X回転 * Y回転 * Z回転 * スケール
```

回転を適用する順序を変更するオプションがあるのが一般的です。XYZの代わりに、ZYX、YZXなどになる場合があります。[クォータニオン](https://google.com/search?quaternion)を使用するのが一般的であり、[幾何代数](https://www.youtube.com/watch?v=Idlv83CxP-8)を使用するのがますます一般的になっています。

いずれにせよ、上記から始めます。

`SceneGraphNode`と`TRS`ソースができたので、シーングラフを構築しましょう。

まず、`SceneGraphNode`と`TRS`ソースの両方をいくつかの親に追加する関数を作成しましょう。

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

「メッシュ」を作成する関数を追加しましょう。これを何と呼ぶべきかわかりませんが、描画するもののリストになります。各「描画するもの」は、`SceneGraphNode`、描画したいものの頂点、およびそれを描画する色の組み合わせになります。

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

さて、キューブしかないので、シーングラフにキューブを追加し、キューブをレンダリングするための「メッシュ」を追加する関数を作成しましょう。

```js
  function addCubeNode(name, parent, trs, color) {
    const node = addTRSSceneGraphNode(name, parent, trs);
    return addMesh(node, cubeVertices, color);
  }
```

これらが設定されたら、ファイリングキャビネットのグラフを構築しましょう。まず、「ルート」ノードを作成します。ルートには「ソース」は必要ありません。

```js
  const root = new SceneGraphNode('root');
```

次に、キャビネットを追加しましょう。

```js
  const root = new SceneGraphNode('root');
+  // キャビネットを追加します
+  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
+    addCabinet(root, cabinetNdx);
+  }
```

`addCabinet`を書きましょう。

```js
  function addCabinet(parent, cabinetNdx) {
    const cabinetName = `cabinet${cabinetNdx}`;

    // キャビネット全体にノードを追加します
    const cabinet = addTRSSceneGraphNode(
      cabinetName, parent, {
         translation: [cabinetNdx * kCabinetSpacing, 0, 0],
       });

    // キャビネットのキューブを持つノードを追加します
    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * kNumDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];
    addCubeNode(
      `${cabinetName}-mesh`, cabinet, {
        scale: kCabinetSize,
      }, kCabinetColor);

    // 引き出しを追加します
    for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
      addDrawer(cabinet, drawerNdx);
    }
  }
```

そして、`addDrawer`を書きましょう。

```js
  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // 引き出し全体にノードを追加します
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
    animNodes.push(drawer);

    // 引き出しキューブのキューブを持つノードを追加します。
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // ハンドルのキューブを持つノードを追加します
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

シーングラフができたので、レンダー関数を更新する必要があります。

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

そして、カメラコードを微調整しましょう。

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
-    // ビュー行列を計算します
-    const viewMatrix = mat4.lookAt(eye, target, up);
+    // カメラ行列を計算します
+    const cameraMatrix = mat4.identity();
+    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
+    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+
+    // ビュー行列を計算します
+    const viewMatrix = mat4.inverse(cameraMatrix);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

そして、シーングラフを使用して同じファイリングキャビネットが得られます。

{{{example url="../webgpu-scene-graphs-file-cabinets.html"}}}

## <a id="a-gui"></a>GUIの追加

シーングラフの主なポイントは、データであるため、操作できることです。グラフを調整および微調整するためのUIを追加しましょう。

まず、平行移動、回転、スケールのコントロールを追加しましょう。

```js
  // Presents a TRS to the UI. Letting set which TRS
  // is being edited.
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

次に、ノードを選択する方法が必要なので、シーングラフをウォークし、各ノードにボタンを作成しましょう。

```js
import GUI from '../3rdparty/muigui-0.x.module.js';
+import { addButtonLeftJustified } from './resources/js/gui-helpers.js';

...

+  function setCurrentSceneGraphNode(node) {
+    trsUIHelper.setTRS(node.source);
+    trsFolder.name(`orientation: ${node.name}`);
+    trsFolder.updateDisplay();
+  }
+
+  // \u00a0は改行しないスペースです。
+  const threeSpaces = '\u00a0\u00a0\u00a0';
+  const barTwoSpaces = '\u00a0|\u00a0';
+  const plusDash = '\u00a0+-';
+  // GUIにシーングラフノードを追加し、適切な
+  // プレフィックスを追加して、次のように見えるようにします。
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

上記では、`TRS`ソースを持つ各ノードにボタンを作成しました。ボタンがクリックされると、`setCurrentSceneGraphNode`が呼び出され、そのボタンのノードが渡されます。`setCurrentSceneGraphNode`はフォルダ名を更新し、次に`trsFolder.updateDisplay`を呼び出して、新しく選択された`TRS`のデータでUIを更新します。

これは機能しますが、UIが小さなウィンドウには少し乱雑であることがわかったので、いくつかの調整を次に示します。

1. 平行移動、回転、スケールのコントロールを減らします。

   ファイルキャビネットの場合、各ノードで平行移動、回転、スケールの9つの設定のいずれかを設定できますが、本当に重要なのは「平行移動z」だけです。したがって、デフォルトでは平行移動以外のすべてを非表示にしましょう。

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

   このコードは、平行移動、回転、スケールのコントロールを配列に収集し、すべてまたは最初の3つのみを表示します。

2. メッシュを表示しない

   グラフには、各キューブの「-mesh」ノードがあり、キャビネットや引き出しを移動するために実際に移動する必要はないので、デフォルトで非表示にしましょう。

   ```js
     // \u00a0は改行しないスペースです。
     const threeSpaces = '\u00a0\u00a0\u00a0';
     const barTwoSpaces = '\u00a0|\u00a0';
     const plusDash = '\u00a0+-';
     // GUIにシーングラフノードを追加し、適切な
     // プレフィックスを追加して、次のように見えるようにします。
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

「引き出し」を選択し、「平行移動z」を調整してみてください。

{{{example url="../webgpu-scene-graphs-file-cabinets-w-gui.html"}}}

ご覧のとおり、各ノードにデータがあるため、個々のノードの位置、回転、スケールを簡単に変更できます。

## <a id="a-animate"></a>アニメーション

楽しみのために、引き出しをアニメーション化しましょう。

まず、引き出しノードのリストを作成しましょう。

```js
  const animNodes = [];

  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // 引き出し全体にノードを追加します
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
+    animNodes.push(drawer);

    // 引き出しキューブのキューブを持つノードを追加します。
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // ハンドルのキューブを持つノードを追加します
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

次に、時間に基づいて引き出しをアニメーション化するコードを記述しましょう。

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

レンダー ループを作成しましょう。まだリクエストされておらず、フレームがまだレンダリングされていない場合にのみ、アニメーション フレームをリクエストするようにします。

```js
+  // まだリクエストされていない場合はレンダリングをリクエストします。
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

そして、`render`を呼び出していた場所を更新して、`requestRender`を呼び出す必要があります。

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
      // 再レンダリング
-      render();
+      requestRender();
    }
  });
  observer.observe(canvas);
```

最後に、アニメーションのオン/オフを切り替えるためのコードを設定しましょう。

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

上記の複雑な点は、アニメーションがチェックされている場合にのみクロックを実行したいということです。したがって、前のフレームで`wasRunning`だったかどうかを確認します。そうでない場合は、`deltaTime`を0に設定します。そうすれば、アニメーション化していなかった時間だけクロックが進むことはありません。

アニメーション化している場合は、平行移動、回転、スケールのコントロールを無効にします。

最後に、`settings.animate`が設定されている場合は、別のアニメーションフレームをリクエストします。GUIコードは、変更時にすでに`requestRender`を呼び出すため、レンダリングを開始し、`settings.animate`がtrueであることを確認し、別のフレームをリクエストします。

{{{example url="../webgpu-scene-graphs-file-cabinets-w-animation.html"}}}

「引き出し」を選択し、「平行移動z」を調整してみてください。

## <a id="a-hand"></a>手の作成

手の新しい例を作成しましょう。簡単にするために、キューブに固執します。

シーングラフがどのようになるかの図を次に示します。

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

まず、キューブの頂点を移動して、XZ平面の上に中央に配置しましょう。これは、シーングラフにさらにノードを追加するか、各「-mesh」ノードに適用することで実行できますが、頂点自体で実行する方がすっきりします。

```js
function createCubeVertices() {
  const positions = [
    // 左
-    0, 0,  0,
-    0, 0, -1,
-    0, 1,  0,
-    0, 1, -1,
+   -0.5, 0,  0.5,
+   -0.5, 0, -0.5,
+   -0.5, 1,  0.5,
+   -0.5, 1, -0.5,

    // 右
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

次に、シーングラフを作成しましょう。ファイルキャビネットのシーングラフを作成に関連するすべてのコードを削除し、これに置き換えます。

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

手首を作成し、それに手のひらと手のひらメッシュを取り付けます。手のひらに、`addFinger`を使用して5本の指を取り付けます。`addFinger`は、特定の長さの指のセグメントを追加します。

> はい、これは人間の手とはまったく異なります😂

ファイルキャビネットの場合、`translation z`のみを気にしましたが、手で最も重要な変換は`rotation x`なので、デフォルトで表示されるコントロールを調整しましょう。

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

手のアニメーションは、zを平行移動する代わりにxを回転させる必要があります。

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

最後に、カメラをわずかに調整しましょう。

```js
    // カメラ行列を計算します。
    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 100, 0], cameraMatrix);
    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 0, 300], cameraMatrix);
```

{{{example url="../webgpu-scene-graphs-hand.html"}}}

人差し指の1つを選択し、「回転x」を調整してから、「発射！」を押します。または、アニメーション中に「発射！」をクリックします。

## <a id="a-shoot"></a>人差し指から発射体を発射しましょう。

シーングラフのもう1つの利点は、グラフ内の任意のノードの位置と向きを簡単に要求できることです。

したがって、人差し指から発射するには、指の先端のノードを知る必要があります。

多くのシーングラフAPIには、名前でノードを検索する関数があります。私たちのものに追加しましょう。

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

これを追加すると、名前で人差し指の最後のセグメントを見つけることができます。そのノードは、人差し指の最後のセグメントの基部、つまり回転する点を表し、先端ではありません。したがって、実際に先端を表す最後の指のセグメントの子として別のノードを追加しましょう。

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

次に、発射体が必要です。[前の記事](webgpu-matrix-stacks.html)で装飾品用に作成した円錐を使用します。

```js
  const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const shotVertices = createVertices(createConeVertices({
+    radius: 10,
+    height: 20,
+  }), 'shot');
```

次に、発射体を発射するコードを追加しましょう。

```js
  const kShotVelocity = 100; // 単位/秒
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

このコードは、「ショット」を`shots`配列に追加します。これには、`node`、`mesh`、`velocity`、`endTime`が含まれます。

`node`はY軸上で20単位外側に配置されます。これは、円錐の頂点を作成するコードが先端を20単位外側に作成するため、補正する必要があるためです。代わりに円錐の頂点コードを変更することもできますが、これは手間がかかりませんでした😅。このノードに`TRS`ソースを追加していないことに注意してください。ローカル行列を直接更新します。

`mesh`はメッシュの頂点です。ショットが完了したときにレンダリングするもののリストからショットのメッシュを削除できるように、これが必要です。

`velocity`は、ショットを移動する方向と速度です。指が指す軸であるため、発射する方向としてy軸を取得するために`vec3.getAxis`を呼び出します。[3D数学に関する記事](webgpu-orthographic-projection.html)で説明したように、y軸は行列の2行目または要素4、5、6なので、`vec3.getAxis`は次のように実装できます。

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

または、コードはそのy軸を取得し、その方向を正規化し、次に`vec3.mulScalar`を使用して目的の速度にします。

`vec3.mulScalar`を提供する必要があります。

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

最後に、`endTime`は、ショットを削除するための将来のある時点です。

これで、発射体を移動するコードを追加しましょう。

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

そのコードは、ショットの時間が期限切れになったかどうかを確認します。その場合、ショットのノードをシーングラフから削除し、レンダリングするもののリストからメッシュを削除します。

それ以外の場合は、配列内の各ショットについて、速度をショットの行列に追加し、`deltaTime`でスケーリングしてフレームレートに依存しないようにします。

`removeMesh`を提供する必要があります。

```js
  function removeMesh(mesh) {
    meshes.splice(meshes.indexOf(mesh), 1);
  }
```

次に、発射するためのボタンと、この処理関数を実際に呼び出すためのコードを追加する必要があります。

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

ショットがある場合は、実行し続ける必要があります。「発射！」ボタンが押されると、ショットが追加されます。GUIは`requestRender`も呼び出すため、このコードを通過して`processShots`を呼び出します。`processShots`は、ショットがある場合は`requestRender`を呼び出すため、すべてのアニメーションループは、すべてのショットが終了するまで続行されます。

{{{example url="../webgpu-scene-graphs-hand-shoot.html"}}}

人差し指の1つを選択し、回転xを調整してから、「発射！」を押します。または、アニメーション中に「発射！」をクリックします。

この記事で、シーングラフとは何か、そしてその使用方法についてある程度のアイデアが得られたことを願っています。Unity、Blender、Unreal、Maya、3DSMax、Three.jsはすべてシーングラフを持っています。それらはさまざまな形式を取ることができます。一部はメッシュをグラフ自体に入れて不均一にしますが、他はより「純粋」で、それらを分離します。一部には、かなり複雑な「ソース」クラスがあります。シーングラフを持つことは、一般的に3Dエンジンの始まりです。すべての3Dエンジンが持っているわけではありませんが、ほとんどが持っています。

上記のコードでは、カメラ自体をシーングラフの外に保持しましたが、カメラがグラフ自体の一部であることがより一般的です。これにより、Unity、Unreal、Blenderなどのプログラムで複数のカメラを表示および操作できます。

グラフ自体に入れることで、カメラをあるノードの子にすることができ、したがって、その親の影響を受けることができます。たとえば、車の運転手の視点からのカメラや、回転する防犯カメラのカメラなどです。

同様に、シーングラフは、多くの3Dエディターが持つような3Dマニピュレーターの実装に役立ちます。これらは、上記で使用したような別のGUIからではなく、3Dビューでオブジェクトを平行移動、回転、スケーリングできるUI要素です。別の記事で3Dマニピュレーターについて説明できるかもしれません。