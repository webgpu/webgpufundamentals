Title: Controles de cámara en WebGPU
Description: Controlando la cámara
TOC: Controles de cámara

Este artículo es el segundo de una breve serie sobre cómo crear partes para un editor 3D. Cada uno se basa en la lección anterior, por lo que te resultará más fácil entenderlos si los lees en orden.

1. [Resaltado](webgpu-highlighting.html)
2. [Controles de cámara](webgpu-camera-controls.html) ⬅ estás aquí
3. [Picking (Selección)](webgpu-picking.html)

# Cámara de órbita (Orbit Camera)

Una cámara de órbita es la que utilizan la mayoría de los paquetes de modelado 3D como Blender, Unity, Maya, 3DSMax o Unreal en sus editores. Puedes presionar algún icono o mantener pulsada una tecla y luego arrastrar el puntero para orbitar alrededor de algún punto del mundo.

Existen algunos términos que, hasta donde sé, provienen del cine y otros de la aviación:

* **"Pan"** (Panorámica) consiste en girar la cámara a izquierda y derecha desde su ubicación actual.

  Cuando haces una foto panorámica con tu teléfono, estás "paneando" la cámara.

* **"Tilt"** (Inclinación) consiste en girar la cámara hacia arriba y hacia abajo.

  Si estás de pie, podrías inclinar la cámara hacia abajo para fotografiar una flor, o hacia arriba para fotografiar un avión.

* **"Roll"** (Rotación longitudinal) es como inclinar la cabeza hacia la izquierda o la derecha.

  El horizonte deja de estar plano.

* **"Dolly"** consiste en acercar o alejar la cámara.

  A menudo se confunde con "hacer zoom", pero el zoom con una lente de cámara cambia el campo de visión, mientras que "dollying" mueve físicamente la cámara más cerca o más lejos del objetivo.

* **"Track"** consiste en mover la cámara perpendicularmente a la dirección en la que está mirando.

  Supongo que esto viene de [tener realmente una vía (track) sobre la que desplazar la cámara de cine](https://en.wikipedia.org/wiki/Tracking_shot).

En cualquier caso, una forma de resolver muchos problemas de este tipo es construir un "rig". Un "rig" en términos de 3D generalmente se refiere a una jerarquía de nodos de un grafo de escena, potencialmente con algunas restricciones añadidas.

Podríamos construir una jerarquía como esta:

```
+-camTarget (ancla el centro de rotación)
  +-camPan (nos permite "panear" alrededor del objetivo)
    +-camTilt (nos permite inclinar la cámara por encima o por debajo del objetivo)
      +-camExtend (nos permite alejar o acercar la cámara al objetivo)
        +-cam (nos da la matriz de cámara)
```

Casi puedes imaginar esto como un rig mecánico real hecho de piezas físicas. No sé si es una buena analogía, pero si tuvieras un tanque militar, el tanque mismo sería el `camTarget`. La torreta que gira sobre el tanque sería el `camPan`. La pieza que permite que el cañón suba y baje es el `camTilt`. El cañón mismo es el `camExtend`. Idealmente, imagina un cañón telescópico que puede cambiar de longitud. Luego acoplas la cámara al final del cañón **apuntando de vuelta hacia el tanque**.

<div class="webgpu_center">
  <div data-diagram="camera-rig" style="width: 600px;"></div>
</div>

En el diagrama de arriba:

* la base azul es el `camTarget`
* la cabeza verde es el `camPan`
* la bisagra roja es el `camTilt`
* el cañón rosa/morado es el `camExtend`
* el frustum blanco representa una cámara en `cam` mirando hacia el `camTarget`

Por defecto, las piezas en el diagrama están apiladas para que sean fáciles de ver, pero en nuestro rig real estarían todas una encima de otra. Marca "collapse" para ponerlas donde deberían estar.

En cualquier caso, vamos a crear ese rig de cámara.

Primero, unos pequeños ajustes en la interfaz de usuario. Como eventualmente queremos que el usuario pueda arrastrar sobre la escena para actualizar la cámara, hagamos que los controles se parezcan más a un editor 3D donde, en lugar de flotar sobre la escena, ocupen un espacio a la derecha. También haremos que si el usuario cierra los controles, la escena se expanda para llenar el espacio.

Primero, algunos cambios en el HTML:

```html
+<div id="split">
*  <canvas></canvas>
+  <div id="ui"></div>
+</div>
```

y el CSS correspondiente:

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

Finalmente, moveremos la interfaz dentro de este div `#ui` y actualizaremos las clases CSS del div según el estado de la interfaz.

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

Ahora empecemos a crear una cámara de órbita basada en nodos del grafo de escena.

Aquí tienes nuestro rig de cámara de órbita:

```js
  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // Create the Camera Rig
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

Necesitamos añadir `vec3.copy`, que no habíamos necesitado hasta ahora:

```js
const vec3 = {
+  copy(src, dst) {
+    dst = dst || new Float32Array(3);
+    dst.set(src);
+    return dst;
+  },

    ...
```

luego necesitamos usar la `OrbitCamera`:

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

-    // Obtenemos la posición de la cámara a partir de la matriz que calculamos
-    const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
-    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
-
-    // Calculamos una matriz de vista
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

Observa que ha desaparecido un montón de matemáticas. No hay matemáticas en el código de `OrbitCamera`, solo nodos del rig. Esto se debe a que todas las matemáticas han quedado enterradas en el propio rig.

Podríamos ejecutarlo tal cual, pero sería difícil cambiar cualquier ajuste de la cámara ya que nuestra interfaz, por defecto, muestra solo la traslación x,y,z O bien los 9 ajustes de traslación, rotación y escala por nodo.

Vamos a "hackear" la interfaz para que los nodos del rig de la cámara muestren solo los ajustes relevantes. Lo haremos añadiendo un mapa de nodos del grafo de escena a ajustes; para mantenerlo simple, proporcionaremos un array de controles por índice que queremos que aparezcan, donde 0, 1, 2 son traslación x, y, z; 3, 4, 5 son rotación x, y, z; y 6, 7, 8 son escala. Si no existen ajustes para el nodo, seguirán las reglas existentes.

```js
+  const nodeToUISettings = new Map();

  class OrbitCamera {
    #camTarget;
    #camPan;
    #camTilt;
    #camExtend;
    #cam;

    constructor() {
      // Create the Camera Rig
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
    trsFolder.name(`orientación: ${node.name}`);
    trsFolder.updateDisplay();

+   showTRS();

    // Marcamos qué nodo está seleccionado.
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

Con esos cambios hemos reemplazado el viejo código de cámara por nuestra nueva `OrbitCamera`, hemos eliminado un montón de matemáticas y hemos hecho que los nodos del rig de la cámara aparezcan en la interfaz con sus ajustes visibles y editables.

{{{example url="../webgpu-camera-controls-scene-graph-step-01.html"}}}

Ahora que tenemos lo básico en su lugar, añadamos algunos controles de puntero.

## <a id="a-pan-and-tilt"></a> Pan y Tilt

Ajustemos el pan y el tilt cuando arrastres el puntero.

Primero, necesitamos hacer un pequeño ajuste en el CSS para que al arrastrar no se seleccione el canvas, entre otras cosas.

```css
canvas {
  display: block;  /* make the canvas act like a block   */
  width: 100%;     /* make the canvas fill its container */
  height: 100%;
+  touch-action: none;
}
```

Luego, añadamos algo de código a la cámara para encapsular un poco estos cambios. Crearemos una función `getUpdateHelper` que registre parte del estado relevante (pero privado) de la cámara, y el ayudante proporcionará funciones para modificar el estado de la cámara mediante deltas que el código de la interfaz le pasará.

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

Entonces podemos añadir una función para conectar la entrada del puntero, crear el ayudante y pasarle los deltas.

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

El código es bastante directo. En `pointerdown` llamamos a `cam.getUpdateHelper`, que registra el `pan` y `tilt` actuales. También registramos la posición actual del puntero. En `pointermove` calculamos el delta desde donde empezó el puntero y lo pasamos al ayudante para ajustar `pan` y `tilt`. Eso es básicamente todo. `addOrbitCameraEventListeners` también devuelve una función para eliminar los escuchadores si fuera necesario.

Un pequeño cambio más: hagamos que la interfaz de usuario (GUI) compruebe si hay actualizaciones en los valores. De esta forma, cuando hagamos `pan` y `tilt` arrastrando el puntero, los valores en la interfaz se actualizarán automáticamente.

```js
-  const trsFolder = gui.addFolder('orientation');
+  const trsFolder = gui.addFolder('orientation').listen();
```

Pruébalo, arrastra el dedo por el canvas. Puedes seleccionar los nodos `cam-tilt` o `cam-pan` y verás cómo cambian los valores al arrastrar.

{{{example url="../webgpu-camera-controls-scene-graph-step-02.html"}}}

## <a id="a-track"></a> Tracking

Es común que si mantienes pulsada alguna tecla modificadora, como Shift, mientras arrastras, en lugar de ajustar el pan o el tilt, realices un "track" de la cámara (la traslades).

Vamos a añadirlo. Primero, necesitamos algunas funciones matemáticas nuevas:

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

`create` simplemente crea un vec3 con 3 ceros. `add` suma dos vec3. Finalmente, `transformMat3` multiplica un vector por una matriz 3x3. Esto se mencionó [cuando cubrimos las normales para la iluminación](webgpu-lighting-directional.html#a-normals). Allí multiplicamos una normal (vec3f) por una matriz normal (mat3x3f) en WGSL. Aquí estamos haciendo esencialmente lo mismo pero en JavaScript; en lugar de reorientar una normal, estamos reorientando el movimiento del puntero.

Ahora podemos actualizar el ayudante:

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

`track` toma un delta xy y lo multiplica por la matriz 3x3 superior izquierda de nuestra matriz de cámara. Esto tiene el efecto de orientar la dirección de forma perpendicular a donde apunta la cámara. Luego simplemente sumamos eso a nuestro objetivo (target).

Después ejecutamos `track` desde el código del evento de puntero:

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
+          camHelper.panAndTilt(deltaX * 0.01, deltaY * 0.01);
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

Nuestro código de evento arriba calcula un modo basándose en si el usuario mantiene pulsada la tecla Shift o no. Si el modo cambia, registramos los valores iniciales. Luego actúa según el modo.

Nuestro modo `'track'` pasa el delta del puntero a la función `track` del ayudante. Escalamos el delta por el radio (nuestra distancia al objetivo), de modo que nos moveremos en pasos más pequeños si estamos muy cerca.

También podemos hacer que realice un track si el usuario usa el botón central del ratón:

```js
-      const mode = e.shiftKey
+      const mode = e.shiftKey || (e.buttons & 4) !== 0
         ? 'track'
         : 'panAndTilt';
```

Ahora también puedes mantener presionada la rueda del ratón y moverlo para realizar un track.

{{{example url="../webgpu-camera-controls-scene-graph-step-03.html"}}}

## <a id="a-dolly-by-wheel"></a> Dolly mediante la rueda del ratón

A continuación, añadamos el zoom o "dolly" con la rueda de desplazamiento, lo cual es muy común.

Primero, actualicemos nuestro ayudante:

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

Y luego usémoslo:

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

Con ese pequeño cambio, deberías ser capaz de acercar/alejar (dolly) con la rueda del ratón (o con 2 dedos en un portátil).

El código ajusta el radio en una milésima parte. Esto no ha sido probado con muchísimas escenas, pero parece razonable que no queramos movernos a la misma velocidad si estamos demasiado cerca.

{{{example url="../webgpu-camera-controls-scene-graph-step-04.html"}}}

## <a id="a-dolly-by-pinch"></a> Dolly mediante pellizco (pinch)

En dispositivos móviles es común pellizcar para hacer zoom. Vamos a añadirlo.

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

Ahora estamos rastreando la posición inicial de todos los punteros. Comprobamos si hay 2. Si es así, estamos pellizcando; si hay más de 2, nos rendimos. Si solo hay 1, volvemos a donde estábamos.

En `computePinchDistance` obtenemos las 2 posiciones y calculamos la distancia entre ellas. Podemos usar eso para registrar qué tan separados estaban cuando el usuario comenzó a pellizcar y qué tan separados están después, aplicando eso al zoom.

Si tienes un portátil con pantalla táctil, o estás en una tableta o teléfono, puedes intentarlo.

{{{example url="../webgpu-camera-controls-scene-graph-step-05.html"}}}

## <a id="a-dolly-by-double-tab-drag"></a> Dolly mediante doble toque y arrastre

Hagamos uno más. Es común en algunas aplicaciones que si das dos toques a la pantalla y luego arrastras el dedo, se haga zoom. Google Maps hace esto, por ejemplo. Vamos a añadirlo.

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

El código comprueba si hay un único `pointerdown` y mira el tiempo transcurrido entre ese y el anterior. Si es inferior a `kDoubleClickTime`, estamos en `doubleTapMode` y podemos ajustar el zoom basándonos en la distancia desde donde empezó el segundo toque.

Por ahora esto funcionará con el ratón o una pantalla táctil. ¿Es apropiado para un ratón? Pruébalo.

{{{example url="../webgpu-camera-controls-scene-graph-step-06.html"}}}

## <a id="a-camera-not-at-root"></a> La cámara no está en la raíz

Un problema que no hemos cubierto es qué sucede si nuestra `OrbitCamera`, que existe en el grafo de escena, no se encuentra en la raíz del grafo.

Por ejemplo, supongamos que es una cámara situada en una torre caída dentro de la escena. Como la torre está caída, la cámara no está nivelada con el suelo.

Para tilt, pan y dolly nada necesita cambiar, ya que todos ellos son relativos a la propia cámara; pero para track necesitamos hacer un trabajo extra, puesto que el objetivo (target) de la cámara es relativo a su nodo padre.

Para solucionar esto, primero probablemente deberíamos eliminar el setter de `target`, ya que induce a error. Crearemos una función `setTarget` que tenga en cuenta al padre de la cámara.

```js
  class OrbitCamera {

   ...

    get target() { return vec3.copy(this.#camTarget.source.translation); }
-    set target(v) { vec3.copy(v, this.#camTarget.source.translation); }
+    setTarget(worldPosition) {
+      const inv = mat4.inverse(this.#camTarget.parent?.worldMatrix ?? mat4.identity());
+      vec3.transformMat4(worldPosition, inv, this.#camTarget.source.translation);
+    }
  }
```

También necesitamos añadir `vec3.transformMat4`, que es la misma matemática que usamos en nuestro vertex shader para `uni.matrix * vert.position`, pero traducida a JavaScript.

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

Con el setter eliminado, tenemos que arreglar el código que lo estaba usando:

```js
  const orbitCamera = new OrbitCamera();
  orbitCamera.setParent(root);
-  orbitCamera.target = [120, 80, 0];
+  orbitCamera.setTarget([120, 80, 0]);
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

También necesitamos refactorizar la función `track` del ayudante para tener en cuenta que podría no estar en la raíz y ajustar el delta para que sea relativo al padre de la cámara.

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

La dirección que calculábamos antes estaba en el espacio del mundo. Eso funcionaba cuando la cámara estaba en la raíz. Ahora, sin embargo, multiplicamos por la inversa de la `worldMatrix` del padre de la cámara. Esto cambia efectivamente el delta para que sea relativo a ese padre, que es lo que necesitamos.

Pongamos la cámara en algunos nodos extra del grafo de escena:

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
+  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  orbitCamera.setParent(extraMov);
```

Verás que el tracking sigue funcionando.

{{{example url="../webgpu-camera-controls-scene-graph-step-07.html"}}}

## <a id="a-frame-selected"></a> Encuadrar selección (Frame Selected)

Otra característica importante es poder seleccionar un objeto y elegir "Encuadrar selección" (Frame Selected) para mover la cámara y mostrar ese objeto. Para ello es necesario saber qué tan grande es cada objeto. En este caso específico, sabemos que todo lo que hay en la pantalla es un cubo unitario. Podríamos almacenar algunas extensiones en nuestros datos, pero por ahora simplemente las estableceremos para que cubran nuestro cubo.

```js
function createCubeVertices() {
  const positions = [
    // izquierda
    0, 0,  0,
    0, 0, -1,
    0, 1,  0,
    0, 1, -1,

    // derecha
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

`aabb` significa Axis Aligned Bounding Box (Caja Envolvente Alineada con los Ejes). Vemos fácilmente que esto coincide con nuestro cubo. Si tuviéramos datos diferentes, tendríamos que analizarlos para encontrar los valores mínimos y máximos.

Necesitamos propagar estos datos hasta nuestros vértices de malla (mesh):

```js
-  function createVertices({vertexData, numVertices}, name) {
+  function createVertices({vertexData, numVertices, aabb}, name) {
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

Necesitamos una función que, dada una malla, calcule el AABB de esa malla en el espacio del mundo, ya que habrá sido orientada por nuestro grafo de escena.

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

Esto usa 2 funciones más de `vec3` que debemos añadir: `min` y `max`, que devuelven un `vec3` con el mínimo o máximo de cada componente de dos vec3.

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

Luego, necesitamos una función que recorra las mallas seleccionadas y nos devuelva su AABB combinado.

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

Con eso ya podemos crear una función que encuadre las mallas seleccionadas:

```js
  function frameSelected() {
    if (selectedMeshes.length === 0) {
      return;
    }

    // obtener los límites aabb de los objetos seleccionados.
    const aabb = getAABBForSelectedMeshes();

    const extent = vec3.subtract(aabb.max, aabb.min);
    const diameter = vec3.distance(aabb.min, aabb.max);

    // calcular qué tan lejos necesitamos establecer el radio para que los
    // objetos seleccionados queden encuadrados.
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const fieldOfViewH = 2 * Math.atan(Math.tan(settings.fieldOfView) * aspect);
    const fov = Math.min(fieldOfViewH, settings.fieldOfView);
    const zoomScale = 1.5; // lo hacemos 1.5 veces más grande para dar margen.
    const halfSize = diameter * zoomScale * 0.5;
    const distance = halfSize / Math.tan(fov * 0.5);

    orbitCamera.radius = distance;

    // apuntar la cámara al centro
    const center = vec3.addScaled(aabb.min, extent, 0.5);
    orbitCamera.setTarget(center);

    render();
  }
```

El código anterior obtiene el AABB de las mallas seleccionadas. El diámetro de una esfera que contendría este AABB es simplemente la distancia entre 2 esquinas opuestas. Una vez que tenemos ese diámetro, calculamos qué tan lejos debe estar una cámara dado su `fieldOfView` actual. El ajuste de campo de visión de nuestra función `mat4.perspective` es el campo de visión vertical; así que basándonos en eso y en la relación de aspecto, obtenemos el campo de visión horizontal, usamos el que sea menor y luego lo empleamos para calcular qué tan lejos debemos estar para que nuestra esfera encaje. Usamos `zoomScale` para hacer que nuestra esfera sea 1.5 veces más grande que la que contiene nuestro AABB y así tener algo de margen. Luego ajustamos el radio de la cámara a esa distancia.

Finalmente, apuntamos el objetivo de la cámara al punto central del AABB.

Necesitamos suministrar un par de funciones `vec3` más: `distance` y `addScaled`.

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

`distance` calcula la distancia entre 2 `vec3`. `addScaled` hace efectivamente `a + b * scale`. Facilita añadir una parte de `b` a `a`.

Necesitamos añadir un `fieldOfView` a los ajustes:

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

También necesitamos añadir un botón "encuadrar selección":

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
+  gui.addButton('encuadrar selección', frameSelected);
  const trsFolder = gui.addFolder('orientation').listen();
```

Añadamos también un nodo padre que contenga los 4 armarios. De esa forma tendremos algo que seleccionar para poder encuadrar el conjunto completo.

```js
+  const cabinets = addTRSSceneGraphNode('armarios', root);
  // Añadir armarios
  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
-    addCabinet(root, cabinetNdx);
+    addCabinet(cabinets, cabinetNdx);
  }

  ...

-  setCurrentSceneGraphNode(root.children[2]);
+  setCurrentSceneGraphNode(cabinets.children[1]);
```

Y ya que estamos, eliminemos la rotación y traslación extra:

```js
-  const extraRot = addTRSSceneGraphNode('extra-rot', root, { rotation: [0, 0, Math.PI * 0.35] });
-  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot, { translation: [-30, -90, 40] });
+  const extraRot = addTRSSceneGraphNode('extra-rot', root);
+  const extraMov = addTRSSceneGraphNode('extra-mov', extraRot);
```

Prueba a seleccionar un objeto y elegir "Encuadrar selección".

{{{example url="../webgpu-camera-controls-scene-graph-step-08.html"}}}

## <a id="a-ux"></a> Decisiones de UX

Hay MUCHÍSIMAS decisiones de UX (Experiencia de Usuario) relacionadas con una cámara de órbita que tendrás que tomar. Algunas de ellas incluyen:

* **¿Debería permitir el roll?**

  El roll es como cuando inclinas la cabeza a izquierda o derecha. Añadir roll sería simplemente cuestión de añadir un nodo más al final con una rotación en z de nuestro rig actual entre `#camExtend` y `#cam`.

* **¿Debería ser como lo tenemos, permitiendo simplemente arrastrar, o debería requerir alguna otra forma de ajustar la cámara?**

  En Unity, tienes que mantener pulsada una tecla o cambiar al modo de control de cámara haciendo clic en un icono. En Blender, haces clic y arrastras sobre ciertos iconos o usas el botón central del ratón y teclas modificadoras. Arrastrar el icono de "track camera" traslada la cámara. Arrastrar el icono de "orbit camera" la orbita. Arrastrar el icono de zoom hace dolly de la cámara.

  Para un visor (viewer), es agradable poder simplemente arrastrar sin teclas ni iconos. Para un editor, donde la mayor parte de la actividad es editar contenido 3D, probablemente sea mejor usar un icono, añadir un modo o hacer que el usuario mantenga pulsada una tecla.

* **¿Qué debería pasar en móviles?**

  No proporcionamos una solución para realizar tracking de la cámara en móviles. Nuestro único método actual requiere mantener pulsada la tecla Shift. Usar un icono para arrastrar funcionaría. Creo que algunos visores usan 2 dedos para realizar tracking.

* **¿Debería permitir inclinarse más de 90 grados?**

  Hemos permitido pasar de 90 grados, lo que significa que la cámara puede quedar boca abajo. Algunas aplicaciones lo impiden.

* **¿Debería el "encuadre" mantener la misma orientación?**

  La mayoría de los editores 3D te permiten seleccionar un objeto y elegir "Encuadrar", lo que centra ese objeto en la cámara Y hace que la cámara orbite ese objeto. La pregunta es: ¿se restablece la orientación de la cámara (por ejemplo, vista desde el frente del objeto) o tal vez siempre cambia a mirar a lo largo del eje Z positivo? ¿O mantiene la orientación que tuviera antes de elegir "encuadrar"? Por ejemplo, si estabas mirando hacia abajo el objeto A y seleccionas B, ¿debería seguir mirando hacia abajo?

* **¿En qué dirección se mueve la cámara respecto al puntero?**

  En otras palabras, si arrastras el puntero de izquierda a derecha, ¿debería la cámara girar en sentido horario o antihorario? El sentido antihorario hace parecer que estás orbitando la cámara. El sentido horario hace parecer que estás girando el mundo bajo la cámara. Esto es similar a arrastrar dos dedos en un trackpad para desplazarse (scroll). Si arrastras hacia abajo, ¿debería el contenido subir, porque estás arrastrando la vista sobre el contenido? ¿O debería el contenido bajar, como si estuvieras arrastrando el contenido mismo?

  Con las pantallas táctiles, generalmente quieres que parezca que estás arrastrando el contenido, pero las barras de desplazamiento existían antes que las pantallas táctiles. Arrastrar el tirador de la barra de desplazamiento arrastra la vista, no el contenido. Las ruedas de desplazamiento movían ese tirador. Dos dedos en un trackpad eran un atajo para esa rueda.

## <a id="a-no-scene-graph"></a> Implementar una OrbitCamera sin un grafo de escena.

Si entendiste cómo funciona un grafo de escena en [el artículo sobre grafos de escena](webgpu-scene-graphs.html), entonces esto debería estar bastante claro. Solo necesitamos un código como este:

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

Al introducirlo en nuestro ejemplo, necesitamos un pequeño cambio más. Como no está en el grafo de escena, no debemos añadirlo a dicho grafo.

```js
  const orbitCamera = new OrbitCamera();
-  orbitCamera.setParent(root);
  orbitCamera.target = [120, 80, 0];
  orbitCamera.tilt = Math.PI * -0.2;
  orbitCamera.radius = 300;
```

Y funciona:

{{{example url="../webgpu-camera-controls-raw.html"}}}

Ahora que tenemos una cámara, hagamos que se pueda [hacer clic en los objetos directamente para seleccionarlos](webgpu-picking.html).

<!-- keep this at the bottom of the article -->
<link href="webgpu-camera-controls.css" rel="stylesheet">
<script type="module" src="webgpu-camera-controls.js"></script>
