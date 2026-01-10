Title: WebGPU Camera Controls
Description: Controlling the Camera
TOC: Camera Controls

This article is the 2nd in a short series about making parts for a 3D editor.
Each one builds on the previous lesson so you may find them easiest to
understand by reading them in order.

1. [Highlighting](webgpu-highlighting.html)
2. [Camera Controls](webgpu-camera-controls.html) ⬅ you are here
3. [Picking](webgpu-picking.html)

# Orbit Camera

An orbit camera is the camera that most 3D modeling packages like Blender,
Unity, Maya, 3DSMax, Unreal use in the editor. You can press some icon or hold
some key and then dragging the pointer orbits some point in the world.

There are some words that AFAIK, come from film and others from aviation

* "Pan" is turning the camera left and right at it's current location.

  When you take a panorama picture on your phone you "pan" the camera.

* "Tilt" is turning the camera up and down

  If you're standing you might tilt a camera down to take a picture
  of a flower or tilt it up to take a picture of an airplane.

* "Roll" is like tilting your head left or right.

  The horizon is no longer flat.

* "Dolly" is moving the camera closer or further

  This is often considered "zooming" but zoom with a camera lens is instead
  changing the field of view where as "dollying" is moving the camera closer
  or further from the target.

* "Track" is moving the camera perpendicular to the way it's facing.

  I'm only guessing this comes from
  [actually having a "track" to roll a movie camera on](https://en.wikipedia.org/wiki/Tracking_shot).

In any case, one way to solve many issues like this is to build a "rig".
A "rig" in 3D terms generally refers to some hierarchy of scene graph nodes,
potentially with some constraints added.

We could build a hierarchy like this

```
+-camTarget (anchors the center of rotation)
  +-camPitch (lets us "pan" around the target)
    +-camTilt (lets us "tilt" above or below the target)
      +-camExtend (lets us "dolly" the camera closer or further from the target)
        +-cam (gives us a camera matrix)
```

You can almost picture this as a actual mechanical rig made of physical parts.
I don't know if this is a good analogy but if you had a military tank, the tank itself would be the `camTarget`. The head that rotates on top of the
tank would be the `camPitch`. The part that lets the barrel rotate up and down
is the `camTilt`. The barrel itself is the `camExtend`. Ideally imagine a telescoping
barrel that can change length. You then attach the camera to the end of the barrel
**aimed back toward the tank**.

<div class="webgpu_center">
  <div data-diagram="camera-rig" style="width: 600px;"></div>
</div>

In the diagram above:

* the blue base is the `camTarget`
* the green head is the `camPitch`
* the red hinge is the `camTilt`
* the pink/purple barrel is the `camExtend`
* the white frame frustum represents a camera at `cam` looking back toward the `camTarget`

By default the pieces in the diagram are stacked up to make them easy to see but in our
actual rig they'd all sit on top of each other. Check "collapse" to put them where they should be.

In any case, let's make that camera rig.

First some minor UI tweaks. Since eventually
we want the user to be able to drag on the
scene to update the camera, lets make the controls
more like a 3D editor where instead of hovering
over the the scene, they fit some space on the right. We'll also make it so if the user closes
the controls the scene expands to fill the space.

First some HTML changes

```html
+<div id="split">
*  <canvas></canvas>
+  <div id="ui"></div>
+</div>
```

and the corresponding CSS

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

Then finally we'll move the UI inside this `#ui` div and update
the div's css classes based on the UI state.

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

Now let's start making an orbit camera based on scene graph nodes.

Here's the our orbit camera rig:

```js
  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // Create Camera Rig
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

We need to add `vec3.copy` which we haven't needed until this point

```js
const vec3 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(3);
+    dst.set(src);
+    return dst;
+  },

   ...
```

then we need to use the `OrbitCamera`

```js
  const orbitCamera = new OrbitCamera();
  orbitCamera.setParent(root);
  orbitCamera.target = [120, 80, 0];
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;

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

-    // Get the camera's position from the matrix we computed
-    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
-    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
-
-    // Compute a view matrix
-    const viewMatrix = mat4.inverse(cameraMatrix);

+    root.updateWorldMatrix();
+
+    // make a view matrix from the camera's
+    const viewMatrix = mat4.inverse(orbitCamera.getCameraMatrix());

    // combine the view and projection matrixes
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

Notice that a whole bunch of math disappeared. There is no math
in the `OrbitCamera` code, just rig nodes. This is because
all the math has been buried in the rig itself.

We could run it as is but it would be difficult to change any
camera settings since our UI, by default, displays translation x,y,z
only OR all 9 translation, rotation, and scale settings per node.

Let's hack the UI so we can make the camera nodes show only relevant
settings. We'll do this by adding a map of scene graph nodes to
settings just to keep it simple and terse we'll provide an array
of controls by index we want to appear where 0, 1, 2 are translation
x, y, z. 3, 4, 5 are rotation x, y, z, and 6, 7, 8 are scale.
If no settings for the node exist then they'll follow the existing
rules.

```js
+  const nodeToUISettings = new Map();

  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // Create Camera Rig
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

    // Mark which node is selected.
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

With those changes we've replaced the old camera code with
our new `OrbitCamera`, removed a bunch of math, and made the
camera's rig nodes show up in the UI with their settings
visible and editable.

{{{example url="../webgpu-camera-controls-scene-graph-step-01.html"}}}

Now that we have the basics in place, lets add some pointer controls.

## <a id="a-pan-and-tilt"></a> Pan and Tilt

Lets adjust pan and tilt when you drag the pointer.

First, we need to make minor CSS tweak so that dragging doesn't
select the canvas among other things.

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  touch-action: none;
}
```

Then, let's add some code to the camera to encapsulate these
changes a little. We'll make a function `getUpdateHelper` that
records some relevant but kind of private camera state, and the
helper will provide functions to modify the camera state by
deltas the UI code will pass in.

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

Then, we can add a function to connect pointer input to create
the helper and pass in deltas.

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

The code is pretty straight forward. On `pointerdown` we call
`cam.getUpdateHelper` which records the current `pan` and `tilt`. We also record
and the current pointer position. On `pointermove` we compute the delta from
where the pointer started and pass it into the helper to  adjust `pan` and
`tilt`. That's basically it. `addOrbitCameraEventListeners` also returns a
function to remove the listeners if that's important.

One more small change, let's make the GUI check for updates to the values.
This way when we just `pan` and `tilt` by dragging the pointer the values
in the UI will update automatically.

```js
-  const trsFolder = gui.addFolder('orientation');
+  const trsFolder = gui.addFolder('orientation').listen();
```

Give it try, drag your finger on the canvas. You can select the
`cam-tilt` or `cam-pan` nodes and you'll see the values change
as you drag.

{{{example url="../webgpu-camera-controls-scene-graph-step-02.html"}}}

## <a id="a-track"></a> Tracking

It's common that if you hold some modifying key, like shift, while dragging,
instead of adjusting the pan or tilt, you instead "track" the camera (translate it).

Let's add that. First off we need a few new math functions.

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

`create` just creates a vec3 with 3 zeros. `add` adds two vec3s.
Finally, `transformMat3` multiplies a vector by a 3x3 matrix. This was
mentioned [when we covered normals for lighting](webgpu-lighting-directional.html#a-normals). There, we multiplied a normal (vec3f) by a normal matrix (mat3x3f) in WGSL. Here, we're essentially doing the same thing but in JavaScript but instead of re-orienting a normal we're reorienting the pointer
movement.

We can now update the helper

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

`track'` takes an xy delta  multiplies it by the upper left 3x3 matrix of our
camera matrix. This has the effect of orienting the direction perpendicular to
the way the camera is facing. We can then just add that to our target

We then `track` from the pointer event code.

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

Our event code above, computes a mode based on whether or not the user is
holding the shift key. If the mode switches then we need to record starting
values. It then switches on the mode.

Our `'track'` mode passes the pointer delta to the helper's `track`
function. We scale the delta by the radius (our distance from the
target), that way we'll move in smaller steps if we're really close up.

{{{example url="../webgpu-camera-controls-scene-graph-step-03.html"}}}

## <a id="a-dolly-by-wheel"></a> Dolly by Wheel

Next let's add zooming or "dolly" with the scroll wheel which is pretty common.

First let's update our helper.

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

And then let's use it.

```js
  function addOrbitCameraEventListeners(cam, elem) {

  ...


+    // Dolly when the user uses the wheel
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

With that small change you should be able to zoom in/out (dolly) with
the mouse wheel (or with 2 fingers on a laptop).

The code is adjusting by 1000th of the radius. This has not been tested
with lots of scenes but it seems reasonable that we don't want to
move the same speed if we're too close.

{{{example url="../webgpu-camera-controls-scene-graph-step-04.html"}}}

## <a id="a-dolly-by-pinch"></a> Dolly by Pinch

On mobile it's common to pinch to zoom. Let's add that.

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

-      const mode = e.shiftKey
+      const mode = pointerToLastPosition.size === 2
+        ? 'pinch'
+        : pointerToLastPosition.size > 2
+        ? 'undefined'
+        : e.shiftKey
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

Now we tracking the starting position of all pointers. We check if there are 2.
If so we're pinching, if there are more than 2 then we give up. If there is only
1 then we're back where we were.

In `computePinchDistance` we get the 2 positions and compute the distance between
them. We can use that to record how far apart they were when the user started pinching
and how far apart they are later and apply that to zooming.

If you have a touch screen laptop, or you're on a tablet or phone, 
maybe you can give it a try.

{{{example url="../webgpu-camera-controls-scene-graph-step-05.html"}}}

## <a id="a-dolly-by-double-tab-drag"></a> Dolly by Double Tab Drag

Let's do one more. It's common on some apps that if you double tap the screen
and then drag your finger it zooms. Google Maps does this for example. Let's add
that.

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
        : e.shiftKey
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

The code checks if there is a single `pointerdown` and checks the time between that and
the last single `pointerdown`. If it's below `kDoubleClickTime` then we're in `doubleTapMode`
and we can adjust the zoom based on the distance from where the 2nd tap started.

ATM, this will work with the mouse or a touch screen. Is it appropriate for a mouse?
Give it a try.

{{{example url="../webgpu-camera-controls-scene-graph-step-06.html"}}}

## <a id="a-camera-not-at-root"></a> Camera not at root

An issue we have not covered is what if our OrbitCamera, which exists
in the scene graph, is not based at the root of the graph.

For example, lets say it was a camera in the scene on a fallen tower.
Since the tower is fallen the camera is not level with ground.

For tilt, pan, and dolly, nothing needs to change as all of these are
relative to the camera itself but for track, we need to do some extra
work since the target of the camera is relative to its parent node.

To fix this, first, we should probably remove the `target` setter
as it's mis-leading. We'll make a `setTarget` function that takes
the camera's parent into account.

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

We also need to add `vec3.transformMat4` which is the same math
we use in our vertex shader for `uni.matrix * vert.position` just
translated to JavaScript.

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

With the setter removed we need to fix the code what was using it.

```js
  const orbitCamera = new OrbitCamera();
  orbitCamera.setParent(root);
-  orbitCamera.target = [120, 80, 0];
+  orbitCamera.setTarget([120, 80, 0]);
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

We also need to refactor the helper's `track` function to
take into account it might not be at the root and adjust the delta
to be relative to the camera's parent.

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

The direction we were computing before was a direction in world space.
That worked when the camera was at the root. Now though, we multiply
by the inverse of the camera's parent worldMatrix. This effectively
changes the delta to be relative to the that parent which is what
we need.

Let's put the camera on some extra scene graph nodes

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
+  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  orbitCamera.setParent(extraMov);
```

You should set tracking still works.

{{{example url="../webgpu-camera-controls-scene-graph-step-07.html"}}}

## <a id="a-frame-selected"></a> Frame Selected

One more important feature is being able to select an object and then pick "Frame Selected"
to move the camera to show that object. To do that requires knowing how large each
object is. For this specific case, we happen to know everything on the screen is a unit cube.
We can store some extents on our data but for now just set them all to cover our cube.

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

`aabb` stands for Axis Aligned Bounding Box. We can easily see
this matches our cube. If we had different data we'd have to scan it
for the min and max values.

We need to bubble this data up to our mesh vertices

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

We need a function that given a mesh, computes the AABB for that
mesh in world space since it will have been oriented by our scene graph.

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

This used 2 more `vec3` functions we need to add. `min`, and `max`
that return the a `vec3` that contains the min or max of each component
of 2 vec3s.

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

Then, we need a function to go through the selected meshes and gives
us their combined AABB.

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

With that we can make a function that frames the selected meshes

```js
  function frameSelected() {
    if (selectedMeshes.length === 0) {
      return;
    }

    // get aabb bounds for the selected objects.
    const aabb = getAABBForSelectedMeshes();

    const extent = vec3.subtract(aabb.max, aabb.min);
    const diameter = vec3.distance(aabb.min, aabb.max);

    // compute how far we need to set the radius for the selected
    // objects to be framed.
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fieldOfViewH = 2 * Math.atan(Math.tan(settings.fieldOfView) * aspect);
    const fov = Math.min(fieldOfViewH, settings.fieldOfView);
    const zoomScale = 1.5; // make it 1.5 times as large for some padding.
    const halfSize = diameter * zoomScale * 0.5;
    const distance = halfSize / Math.tan(fov * 0.5);

    orbitCamera.radius = distance;

    // point the camera at the center
    const center = vec3.addScaled(aabb.min, extent, 0.5);
    orbitCamera.setTarget(center);

    render();
  }
```

The code above gets the AABB for the selected meshes. The diameter
of a sphere that would contain this AABB is just the distance between
2 opposite corners. Once we have that diameter we compute how far away
a camera needs to be give its current `fieldOfView`. The field of view
setting of our `mat4.perspective` function is the vertical field of view.
so based on that and the aspect we horizontal field of view and use
whichever is smaller and then use that to compute how far away we need
to be so our sphere would fit. We use `zoomScale` to make our sphere 1.5x
as large as the sphere that contains our AABB so we'll get some padding.
We then just the radius of the camera to that distance.

Finally we point the camera's target at the AABB's center point.

We need to supply a few more `vec3` functions, `distance` and `addScaled`

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

`distance` computes the distance between 2 `vec3`s. `addScaled` effectively
does `a + b * scale`. It makes it easy to add some portion of `b` to `a`.

We need to add a `fieldOfView` to settings

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

We also need to add a "frame selected" button

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

Let's also add a parent node that contains
all 4 cabinets. That way we'll have something to
select that we can frame the entire thing.

```js
+  const cabinets = addTRSSceneGraphNode('cabinets', root);
  // Add cabinets
  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
-    addCabinet(root, cabinetNdx);
+    addCabinet(cabinets, cabinetNdx);
  }
```

And while we're at it lets remove the extra rotation and translation

```js
-  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
-  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  const extraRot = addTRSSceneGraphNode('extra-rot', root);
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot);


Try selecting an object and the picking "Frame selected".

{{{example url="../webgpu-camera-controls-scene-graph-step-08.html"}}}

## <a id="a-ux"></a> UX decisions

There are TONs of UX decisions related to an orbit camera that you'll need to make.
Some off of them include:

* Should it allow roll?

  Roll is like when you tilt your head left / right.

  Adding roll would just be a matter of adding one more node at the end
  with a z rotation of our current rig between `#camExtend` and `#cam`.

* Should it be like we have it, just letting you drag, or should you it require some other way to adjust
  the camera.

  In Unity, you have to hold a key or switch to camera controlling mode by
  clicking an icon. In Blender you click and drag on certain icons or using the
  middle mouse button and modifier keys. Dragging on the "track camera" icon
  tracks the camera. Dragging the "orbit camera" icon orbits the camera.
  Dragging on the zoom icon zooms (dollies) the camera.

  For a viewer it's nice to be able to just drag with no keys or icons. For an
  editor where most activity is editing 3d content it's probably better to use
  an icon, add a mode, or have the user hold a key.

* What should happen on mobile?

  We didn't provide a solution for tracking the camera on mobile. Our only current method requires holding shift. Using an icon to drag on would
  work. I think some viewers use 2 fingers to track.

* Should it allow tilting past 90 degrees?

  We allowed going past 90 degrees which means the camera can go upside down.
  Some apps prevent that.

* Should "frame" keep the same orientation?

  Most 3D editors let you select an object and pick "Frame" which centers that object
  in the camera AND makes the camera orbit that object. The question is, does
  the orientation of the camera reset, like say, view from the front of the object. Or maybe it always switches to looking along positive Z.
  Or, does it keep whatever orientation it was before picking "frame". For example, if
  you were looking down on object A and the selected B, should it still be looking down?

* Which way does the camera move relative to the pointer?

  In other words, if you drag the pointer from left to right should the camera
  rotate clockwise or counterclockwise. counterclockwise makes it seem like
  your orbiting the camera. clockwise makes it seem like your turing the world
  under the camera. This is similar to dragging two fingers on a trackpad to
  scroll. If you drag down, should the content go up, because you're dragging
  the view over the content. Or should the content down, as though you're dragging
  the content itself.

  With touch screens you generally want it to look like your dragging the content
  but scrollbars existed before touch screens. Dragging the handle on the scroll bar
  drags the view, not the content. Scroll wheels moved that handle. Two fingers
  on a trackpad was a shortcut for that scroll wheel.

## <a id="a-no-scene-graph"></a> Implementing an OrbitCamera without a scene graph.

If you understood how a scene graph works from [the article on scene graphs](webgpu-scene-graphs.html)
then it should be pretty clear. We just need code like

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

Popping that in our example we need one more minor change. Since it's not in the scene graph
we need to not add it to the scene graph.

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
  orbitCamera.target = [120, 80, 0];
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

And it works 

{{{example url="../webgpu-camera-controls-raw.html"}}}

Now that we have a camera, let's make it so you can
[click on objects directly to select them](webgpu-picking.html).

<!-- keep this at the bottom of the article -->
<link href="webgpu-camera-controls.css" rel="stylesheet">
<script type="module" src="webgpu-camera-controls.js"></script>
