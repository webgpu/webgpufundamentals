Title: WebGPU Scene Graphs
Description: Scene Graphs
TOC: Scene Graphs

This article is the 9th in a series of articles that will hopefully teach
you about 3D math. Each one builds on the previous lesson so you may find
them easiest to understand by reading them in order.

1. [Translation](webgpu-translation.html)
2. [Rotation](webgpu-rotation.html)
3. [Scaling](webgpu-scale.html)
4. [Matrix Math](webgpu-matrix-math.html)
5. [Orthographic Projection](webgpu-orthographic-projection.html)
6. [Perspective Projection](webgpu-perspective-projection.html)
7. [Cameras](webgpu-cameras.html)
8. [Matrix Stacks](webgpu-matrix-stacks.html)
9. [Scene Graphs](webgpu-scene-graphs.html) ⬅ you are here

In the last article we covered a matrix stack. It allowed us
to build up a stack of matrix changes which was helpful for positioning,
orienting, and scaling things relative to others.

A Scene Graph is in a sense, the same thing, except instead of using
code, we use data. We build up a graph of parents and children where
the children compute their matrix based on the matrix of their parent.

The scene graph for the filing cabinets would look something like this

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

The advantage to a scene graph is it stores data as nodes in a graph
so you can easily manipulate some sub portion of the graph without
having to recurse in code.

## Let's switch the file cabinet example from the previous article to use a scene graph.

The first thing we need is a class to represent our scene graph.

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
    // remove us from our parent
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this);
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1);
      }
    }

    // Add us to our new parent
    if (parent) {
      parent.children.push(this);
    }
    this.parent = parent;
  }

  updateWorldMatrix(parentWorldMatrix) {
    // update the local matrix from its source if it has one.
    this.source?.getMatrix(this.localMatrix);

    if (parentWorldMatrix) {
      // a matrix was passed in so do the math
      mat4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
    } else {
      // no matrix was passed in so just copy local to world
      mat4.copy(this.localMatrix, this.worldMatrix);
    }

    // now process all the children
    const worldMatrix = this.worldMatrix;
    this.children.forEach(function(child) {
      child.updateWorldMatrix(worldMatrix);
    });
  }
}
```

The `SceneGraphNode` above is pretty straight forward. Each node has an array of
`children`. There are functions to add and remove children as well as set a
node's parent. Each node has a `localMatrix` which represents the position,
orientation, and scale of this node relative to its parent. Each node has a
`worldMatrix` that represents this node's position, orientation, and scale
relative to "the world" or more specifically, relative to the outside of the
scene graph. And finally there's `updateWorldMatrix` which updates the
`worldMatrix` of a node and all of its children. Each node also has an optional
`source` which is an object that provides a `getMatrix` function. We can use this
to provide different ways to compute a local matrix for a particular node.

Let's provide a source.

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

`TRS` is short for Translation, Rotation, Scale. This is a common way to
compute a local matrix in a scene graph. Often, some implementations use
"position" instead of "translation". For this tutorial, I thought it might
be better to use "translation" since it matches what we do in `getMatrix`.

One thing that sticks out above is setting `this.translation`, `this.rotation`
and `this.scale` to `new Float32Array(value)`. The advantage to `Float32Array`
is it has `set` function so we can do `someTRS.translation.set(someNewValue)`.

You can see `getMatrix` computes a matrix by using effectively

```
translation * rotationX * rotationY * rotationZ * scale
```

It's common to have options to change the order of applying rotation.
Instead of XYZ it might by ZYX or YZX or whatever. It's also common
to use a [quaternion](https://google.com/search?quaternion) and it's getting
more common to use [geometric algebra](https://www.youtube.com/watch?v=Idlv83CxP-8).

In any case, we're going to start with what's above.

Now that we have a `SceneGraphNode` and `TRS` source, let's build our
scene graph.

First let's make a function that adds both a `SceneGraphNode` and a `TRS` source to some parent.

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

Let's add a function that makes a "mesh". I'm not sure what to call this
but it will be a list of things to draw. Each "thing to draw" will be a
combination of a `SceneGraphNode`, the vertices for the thing we want to
draw, and a color to draw it with.

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

Now, since we only have a cube, let's make a function that adds a cube
to the scene graph and adds a "mesh" to render the cube.

```js
  function addCubeNode(name, parent, trs, color) {
    const node = addTRSSceneGraphNode(name, parent, trs);
    return addMesh(node, cubeVertices, color);
  }
```

With those in place, lets build the graph for the filing cabinets. First let's
make a "root" node. The root doesn't need a "source".

```js
  const root = new SceneGraphNode('root');
```

Then let's add cabinets

```js
  const root = new SceneGraphNode('root');
+  // Add cabinets
+  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
+    addCabinet(root, cabinetNdx);
+  }
```

Let's write `addCabinet`.

```js
  function addCabinet(parent, cabinetNdx) {
    const cabinetName = `cabinet${cabinetNdx}`;

    // add a node for the entire cabinet
    const cabinet = addTRSSceneGraphNode(
      cabinetName, parent, {
         translation: [cabinetNdx * kCabinetSpacing, 0, 0],
       });

    // add a node with a cube for the cabinet
    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * kNumDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];
    addCubeNode(
      `${cabinetName}-mesh`, cabinet, {
        scale: kCabinetSize,
      }, kCabinetColor);

    // Add the drawers
    for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
      addDrawer(cabinet, drawerNdx);
    }
  }
```

And, let's write `addDrawer`.

```js
  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // add a node for the entire drawer
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
    animNodes.push(drawer);

    // add a node with a cube for the drawer cube.
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // add a node with a cube for the handle
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

With our scene graph in place, we need to update our render
function.

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

And let's tweak the camera code

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
-    // Compute a view matrix
-    const viewMatrix = mat4.lookAt(eye, target, up);
+    // Compute a camera matrix
+    const cameraMatrix = mat4.identity();
+    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
+    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+
+    // Compute a view matrix
+    const viewMatrix = mat4.inverse(cameraMatrix);

    // combine the view and projection matrixes
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

And that gives us the same filing cabinets but using a scene graph.

{{{example url="../webgpu-scene-graphs-file-cabinets.html"}}}

## <a id="a-gui"></a> Add a GUI

A major point of a scene graph is that, because it's just data, we can
manipulate it. Let's add a UI to adjust and tweak the graph.

First, lets add some controls for translation, rotation, and scale.

```js
  const settings = {
-    cameraRotation: 0,
+    cameraRotation: degToRad(-45),
+    translation: new Float32Array([0, 0, 0]),
+    rotation: new Float32Array([0, 0, 0]),
+    scale: new Float32Array([1, 1, 1]),
  };

-  const radToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };
+  const radToDegOptions = { min: -90, max: 90, step: 1, converters: GUI.converters.radToDeg };
+  const cameraRadToDegOptions = { min: -180, max: 180, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
-  gui.add(settings, 'cameraRotation', radToDegOptions);
+  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
+  const trsFolder = gui.addFolder('orientation');
+  trsFolder.add(settings.translation, '0', -200, 200, 1).name('translation x');
+  trsFolder.add(settings.translation, '1', -200, 200, 1).name('translation y');
+  trsFolder.add(settings.translation, '2', -200, 200, 1).name('translation z');
+  trsFolder.add(settings.rotation, '0', radToDegOptions).name('rotation x');
+  trsFolder.add(settings.rotation, '1', radToDegOptions).name('rotation y');
+  trsFolder.add(settings.rotation, '2', radToDegOptions).name('rotation z');
+  trsFolder.add(settings.scale, '0', 0.1, 100).name('scale x');
+  trsFolder.add(settings.scale, '1', 0.1, 100).name('scale y');
+  trsFolder.add(settings.scale, '2', 0.1, 100).name('scale z');
```

Then lets add some code to update whatever the currently selected node is in the
scene graph.

```js
+  let currentNode;
+  function updateCurrentNodeFromSettings() {
+    const source = currentNode.source;
+    source.translation.set(settings.translation);
+    source.rotation.set(settings.rotation);
+    source.scale.set(settings.scale);
+  }
```

and let's call this any time one of the translation, rotation, or scale widgets is
changed.

```js
  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
  const trsFolder = gui.addFolder('orientation');
+  trsFolder.onChange(updateCurrentNodeFromSettings);
  ...
```

Now we need a way to select a node so let's walk the scene graph and make a
button for each node.

```js
import GUI from '../3rdparty/muigui-0.x.module.js';
+import { addButtonLeftJustified } from './resources/js/gui-helpers.js';

...
  let currentNode;
  function updateCurrentNodeFromSettings() {
    const source = currentNode.source;
    source.translation.set(settings.translation);
    source.rotation.set(settings.rotation);
    source.scale.set(settings.scale);
  }

+  function updateCurrentNodeGUI() {
+    const source = currentNode.source;
+    settings.translation.set(source.translation);
+    settings.rotation.set(source.rotation);
+    settings.scale.set(source.scale);
+    trsFolder.updateDisplay();
+  }
+
+  function setCurrentSceneGraphNode(node) {
+    currentNode = node;
+    trsFolder.name(`orientation: ${node.name}`);
+    updateCurrentNodeGUI();
+  }
+
+  // \u00a0 is non-breaking space.
+  const threeSpaces = '\u00a0\u00a0\u00a0';
+  const barTwoSpaces = '\u00a0|\u00a0';
+  const plusDash = '\u00a0+-';
+  // add a scene graph node to the GUI and adds the appropriate
+  // prefix so it looks something like
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

Above we made a button for each node that has a `TRS` source. 
When a button is clicked it calls
`setCurrentSceneGraphNode` and passes it the node for that button.
`setCurrentSceneGraphNode` updates the folder name and then calls
`updateCurrentNodeGUI` to update `settings` with the data from the newly
selected node.

This works but I found the UI is a little cluttered for our small windows so
here's a few more tweaks.

1. Reduce the translate, rotation, scale controls.

   For the file cabinets, although we can set any of the 9 settings of
   translation, rotation, and scale on each node. The only one that's really
   relevant is "translation z". So, lets hide all but translation by default.

   ```js
    const settings = {
      cameraRotation: degToRad(-45),
   +   showAllTRS: false,
      translation: new Float32Array([0, 0, 0]),
      rotation: new Float32Array([0, 0, 0]),
      scale: new Float32Array([1, 1, 1]),
    };

    const gui = new GUI();
    gui.onChange(render);
    gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
   + gui.add(settings, 'showAllTRS').onChange(showTRS);
    const trsFolder = gui.addFolder('orientation');
    trsFolder.onChange(updateCurrentNodeFromSettings);
   + const trsControls = [
   *   trsFolder.add(settings.translation, '0', -200, 200, 1).name('translation x'),
   *   trsFolder.add(settings.translation, '1', -200, 200, 1).name('translation y'),
   *   trsFolder.add(settings.translation, '2', -200, 200, 1).name('translation z'),
   *   trsFolder.add(settings.rotation, '0', radToDegOptions).name('rotation x'),
   *   trsFolder.add(settings.rotation, '1', radToDegOptions).name('rotation y'),
   *   trsFolder.add(settings.rotation, '2', radToDegOptions).name('rotation z'),
   *   trsFolder.add(settings.scale, '0', 0.1, 100).name('scale x'),
   *   trsFolder.add(settings.scale, '1', 0.1, 100).name('scale y'),
   *   trsFolder.add(settings.scale, '2', 0.1, 100).name('scale z'),
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

   This code collects the translation, rotation, scale controls into an array
   and shows all or just the first 3.

2. Don't show the meshes

   We have a '-mesh' node in the graph for each cube which we don't really need
   to move the cabinets or the drawers so lets hide them by default.

   ```js
     // \u00a0 is non-breaking space.
     const threeSpaces = '\u00a0\u00a0\u00a0';
     const barTwoSpaces = '\u00a0|\u00a0';
     const plusDash = '\u00a0+-';
     // add a scene graph node to the GUI and adds the appropriate
     // prefix so it looks something like
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
       translation: new Float32Array([0, 0, 0]),
       rotation: new Float32Array([0, 0, 0]),
       scale: new Float32Array([1, 1, 1]),
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

Try selecting a "drawer" and adjusting "translation z".

{{{example url="../webgpu-scene-graphs-file-cabinets-w-gui.html"}}}

As you can see, by having data for each node it makes it easy to change the
position, rotation, and scale of any individual node.

## <a id="a-animate"></a> Animate

For fun, let's animate the drawers.

First lets make a list of the drawer nodes.

```js
  const animNodes = [];

  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // add a node for the entire drawer
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
+    animNodes.push(drawer);

    // add a node with a cube for the drawer cube.
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // add a node with a cube for the handle
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

Then let's write some code to animate the drawers based on the time.

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

Let's make a render loop. We'll make it request an animation frame only if we
haven't already requested one and no frame has yet rendered.

```js
+  // request render if not already requested.
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

And we need to update the places that used to call `render` to call
`requestRender`.

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
      // re-render
-      render();
+      requestRender();
    }
  });
  observer.observe(canvas);
```

Finally lets setup some code to let us turn the animation on/off

```js
  const settings = {
+    animate: false,
    showMeshNodes: false,
    showAllTRS: false,
    translation: new Float32Array([0, 0, 0]),
    rotation: new Float32Array([0, 0, 0]),
    scale: new Float32Array([1, 1, 1]),
    cameraRotation: degToRad(-45),
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
+      updateCurrentNodeGUI();
+      requestRender();
+    }
  }
```

A complication above is that we'd prefer to only run the clock if "animate" is
checked. So we check if it `wasRunning` last frame. If not then we set
`deltaTime` to 0. That way the clock won't jump forward the amount of time we
were not animating.

We disable the translation, rotation, scale controls if we're animating.

Finally, if `settings.animate` is set we request another animation frame. The
gui code will already call `requestRender` on any change so it will start a
render, see that `settings.animate` is true, and request another frame.

{{{example url="../webgpu-scene-graphs-file-cabinets-w-animation.html"}}}

Another advantage to a scene graph is it makes it easy to apply animation.
We just apply it to the nodes. We don't have to care in advance how they were
created.

## <a id="a-hand"></a> Making a Hand

Let's make a new example of a hand. To keep it simple we'll stick with
cubes.

Here's a diagram of what the scene graph will look like

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

First, let's move the cube vertices so they are centered above the XZ plane. We
could do this by adding more nodes in the scene graph or by applying it in each
'-mesh' node but it would be less cluttered to just do it in the vertices
themselves.

```js
function createCubeVertices() {
  const positions = [
    // left
-    0, 0,  0,
-    0, 0, -1,
-    0, 1,  0,
-    0, 1, -1,
+   -0.5, 0,  0.5,
+   -0.5, 0, -0.5,
+   -0.5, 1,  0.5,
+   -0.5, 1, -0.5,

    // right
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

Now let's make the scene graph. We delete all the code
related to creating the file cabinets scene graph and replace it
with this.

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

We create a wrist, to which we attach a palm and a palm-mesh. To the palm we attach 5 fingers
using `addFinger`. Add finger adds the segments of a finger, each a certain length.

> Yes, this is not even remotely correct for a human hand 😂

Where as for the file cabinets we only really cared about `translation z`, the most
important transformation for the hand is `rotation x` so let's adjust which controls
are shown by default

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

The animation for the hand needs to rotate x instead of translate z.

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

Finally, ket's adjust the camera slightly.

```js
    // Compute a camera matrix.
    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 100, 0], cameraMatrix);
    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 0, 300], cameraMatrix);
```

{{{example url="../webgpu-scene-graphs-hand.html"}}}

Select a finger and just 'rotation x' and you'll see the segments
further down all rotate with it.

## <a id="a-shoot"></a> Let's shoot a projectile from the index finger.

Another advantage of a scene graph is that you can easily ask for the
position and orientation of any node in the graph.

So, to shoot a from the index finger we need to know the node for the
tip of the finger.

Many scene graph APIs have functions to find nodes by name. Let's add
one to ours.

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

With that added we can find last segment of the index finger by name.
That node represents the base of the last segment of the index finger,
the point at which it rotates, not the tip. So, lets add another node
as a child of that last index finger segment that actually does represent
the tip.

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

Now we need a projectile. We'll use the cone we created for ornaments
in [the previous article](webgpu-matrix-stacks.html).

```js
  const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const shotVertices = createVertices(createConeVertices({
+    radius: 10,
+    height: 20,
+  }), 'shot');
```

Now let's add some code to shoot projectiles. 

```js
  const kShotVelocity = 100; // units per second
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

This code adds a "shot" to the `shots` array. This includes a `node`,
a `mesh`, a `velocity`, and an `endTime`.

The `node` is positioned 20 units out on the Y axis. This is because the
code to make a cone vertices makes the tip 20 units out so we need to
compensate. We could go modify the cone vertex code instead but this was
less work 😅.  Notice we are not adding a `TRS` source for this node.
We will update the local matrix directly.

`mesh` is the mesh vertices. We need this so we can remove the shot's
mesh from the list of things to render when the shot is done.

`velocity` is the direction and speed to move the shot. We call `vec3.getAxis`
to get the y axis as the direction to shoot as that's the axis the fingers point. As we covered in
[the article on 3d math](webgpu-orthographic-projection.html), the y
axis is the 2nd row of the matrix or elements 4,5,6 so `vec3.getAxis`
can be implemented like this

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

Or code gets that y axis and normalizes that direction and then uses
`vec3.mulScalar` to get it to our desired velocity.

We need to supply `vec3.mulScalar`

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

Finally the `endTime` is some time in the future to remove the shot.

With that, let's add some code to move the projectiles.

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

That code checks if the shot's time has expired. If so it removes the shot's node
from the scene graph and it removes the mesh from the list of things to render.

Otherwise, for each shot in the array, it adds the velocity to the shot's matrix,
scaling it by the `deltaTime` so it's framerate independent.

We need to supply `removeMesh`

```js
  function removeMesh(mesh) {
    meshes.splice(meshes.indexOf(mesh), 1);
  }
```

Now we need to add a button to shoot with as well as actually call
this processing function.

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

We need to keep running if there are shots. When the 'Fire!' button is pressed
it will add a shot. The GUI will also call `requestRender` so it will come
through this code and call `processShots`. `processShots` calls `requestRender`
if there are any shots and so the animation loop will continue until all shots
are finished.

{{{example url="../webgpu-scene-graphs-hand-shoot.html"}}}

Try selecting one of the index fingers, adjusting the rotation x, and then
pressing 'Fire!'. Or click 'Fire!' while it's animating.

This article should have given you some idea of what a scene graph is and how to
use one. Unity, Blender, Unreal, Maya, 3DSMax, Three.js, all have a scene graph.
They can take different forms. Some put the meshes in the graph itself making it
non-homogenous. Others are more "pure" and keep them separate. Some have fairly
complex "source" classes. Having a scene graph is generally the start of a 3d
engine. Not every 3d engine has one but most do.

In our code above we kept the camera itself outside of the scene graph but it's
more common for the camera to be part of the graph itself. That's how you can
see and manipulate multiple cameras in programs like Unity, Unreal, Blender,
etc...

By putting it in the graph itself we can have the camera be a child of some node
and therefore have it affected by it's parent. For example, a camera from the
perspective of the driver of a car or a camera on a rotating security camera.

Similarly, scene graphs can help with implementing 3d manipulators like many
3d editors have. These are the UI elements that let you translate, rotate,
and scale objects in the 3D view rather than from some separate GUI like we
used above. Maybe we can cover 3D manipulators in another article.