Title: Grafos de escena en WebGPU
Description: Grafos de escena (scene graphs)
TOC: Grafos de escena

Este artículo es el noveno de una serie que esperamos que te enseñe sobre matemáticas 3D. Cada uno se basa en la lección anterior, por lo que es posible que te resulten más fáciles de entender leyéndolos en orden.

1. [Traslación](webgpu-translation.html)
2. [Rotación](webgpu-rotation.html)
3. [Escalado](webgpu-scale.html)
4. [Matemáticas de matrices](webgpu-matrix-math.html)
5. [Proyección ortográfica](webgpu-orthographic-projection.html)
6. [Proyección en perspectiva](webgpu-perspective-projection.html)
7. [Cámaras](webgpu-cameras.html)
8. [Pilas de matrices](webgpu-matrix-stacks.html)
9. [Grafos de escena](webgpu-scene-graphs.html) ⬅ estás aquí

En el último artículo cubrimos la pila de matrices (matrix stack). Nos permitió crear una pila de cambios de matriz que fue útil para posicionar, orientar y escalar cosas en relación con otras.

Un grafo de escena (scene graph) es, en cierto sentido, lo mismo, excepto que en lugar de usar código, usamos datos. Creamos un grafo de padres e hijos donde los hijos calculan su matriz basándose en la matriz de su padre.

El grafo de escena para los archivadores se vería algo así:

```
raíz (root)
  +-archivador0
  |  +-malla-archivador0
  |  +-cajón0
  |  |  +-malla-cajón-cajón0
  |  |  +-malla-tirador-cajón0
  |  +-cajón1
  |  |  +-malla-cajón-cajón1
  |  |  +-malla-tirador-cajón1
  |  +-cajón2
  |  |  +-malla-cajón-cajón2
  |  |  +-malla-tirador-cajón2
  |  +-cajón3
  |     +-malla-cajón-cajón3
  |     +-malla-tirador-cajón3
  +-archivador1
  |  ...
  +-archivador2
  |  ...
  +-archivador3
  |  ...
  +-archivador4
     +-malla-archivador4
     +-cajón0
     |  +-malla-cajón-cajón0
     |  +-malla-tirador-cajón0
     +-cajón1
     |  +-malla-cajón-cajón1
     |  +-malla-tirador-cajón1
     +-cajón2
     |  +-malla-cajón-cajón2
     |  +-malla-tirador-cajón2
     +-cajón3
        +-malla-cajón-cajón3
        +-malla-tirador-cajón3
```

La ventaja de un grafo de escena es que almacena los datos como nodos en un grafo, por lo que puedes manipular fácilmente una parte del grafo sin tener que recurrir a la recursión en el código.

## Vamos a cambiar el ejemplo de los archivadores del artículo anterior para usar un grafo de escena.

Lo primero que necesitamos es una clase que represente nuestro nodo del grafo de escena.

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
    // eliminarnos de nuestro padre actual
    if (this.parent) {
      const ndx = this.parent.children.indexOf(this);
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1);
      }
    }

    // añadirnos a nuestro nuevo padre
    if (parent) {
      parent.children.push(this);
    }
    this.parent = parent;
  }

  updateWorldMatrix() {
    // actualizar la matriz local desde su fuente si tiene una.
    this.source?.getMatrix(this.localMatrix);

    if (this.parent) {
      // tenemos un padre, hacemos la multiplicación
      mat4.multiply(this.parent.worldMatrix, this.localMatrix, this.worldMatrix);
    } else {
      // no tenemos padre, así que solo copiamos local a mundo
      mat4.copy(this.localMatrix, this.worldMatrix);
    }

    // ahora procesamos a todos los hijos
      this.children.forEach(function(child) {
      child.updateWorldMatrix();
    });
  }
}
```

La clase `SceneGraphNode` de arriba es bastante sencilla. Cada nodo tiene un array de hijos (`children`). Hay funciones para añadir y quitar hijos, así como para establecer el padre de un nodo. Cada nodo tiene una matriz local (`localMatrix`) que representa su posición, orientación y escala relativa a su padre. Cada nodo tiene una matriz de mundo (`worldMatrix`) que representa la posición, orientación y escala de este nodo respecto al "mundo" o, más específicamente, respecto al exterior del grafo de escena. Y finalmente hay un `updateWorldMatrix` que actualiza la `worldMatrix` de un nodo y de todos sus hijos. Cada nodo también tiene una fuente opcional (`source`), que es un objeto que proporciona una función `getMatrix`. Podemos usar esto para proporcionar diferentes formas de calcular una matriz local para un nodo en particular.

Proporcionemos una fuente.

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

`TRS` es la abreviatura de Traslación, Rotación y Escalado (Translation, Rotation, Scale). Es una forma común de calcular una matriz local en un grafo de escena. A menudo, algunas implementaciones usan "position" en lugar de "translation". Para este tutorial, pensé que sería mejor usar "translation" ya que coincide con lo que hacemos en `getMatrix`.

Una cosa que destaca arriba es establecer `this.translation`, `this.rotation` y `this.scale` como `new Float32Array(value)`. La ventaja de `Float32Array` es que tiene una función `set`, por lo que podemos hacer `unTRS.translation.set(unNuevoValor)`.

Puedes ver que `getMatrix` calcula una matriz usando efectivamente:

```
traslación * rotaciónX * rotaciónY * rotaciónZ * escalado
```

Es común tener opciones para cambiar el orden en que se aplica la rotación. En lugar de XYZ, podría ser ZYX o YZX o cualquier otro. También es común usar un [cuaternión](https://www.google.com/search?q=quaternion) y se está volviendo cada vez más común usar [álgebra geométrica](https://www.youtube.com/watch?v=Idlv83CxP-8).

En cualquier caso, vamos a empezar con lo que tenemos arriba.

Ahora que tenemos un `SceneGraphNode` y una fuente `TRS`, vamos a construir nuestro grafo de escena.

Primero, hagamos una función que añada tanto un `SceneGraphNode` como una fuente `TRS` a algún padre.

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

Añadamos una función que cree una "malla" (mesh). No estoy seguro de cómo llamarlo, pero será una lista de cosas para dibujar. Cada "cosa para dibujar" será una combinación de un `SceneGraphNode`, los vértices de lo que queremos dibujar y un color para dibujarlo.

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

Ahora, dado que solo tenemos un cubo, hagamos una función que añada un cubo al grafo de escena y añada una "malla" para renderizar el cubo.

```js
  function addCubeNode(name, parent, trs, color) {
    const node = addTRSSceneGraphNode(name, parent, trs);
    return addMesh(node, cubeVertices, color);
  }
```

Con estas piezas en su lugar, construyamos el grafo para los archivadores. Primero, hagamos un nodo "raíz" (root). La raíz no necesita una "fuente".

```js
  const root = new SceneGraphNode('root');
```

Luego añadamos los archivadores:

```js
  const root = new SceneGraphNode('root');
+  // Añadir archivadores
+  for (let cabinetNdx = 0; cabinetNdx < kNumCabinets; ++cabinetNdx) {
+    addCabinet(root, cabinetNdx);
+  }
```

Escribamos `addCabinet`.

```js
  function addCabinet(parent, cabinetNdx) {
    const cabinetName = `cabinet${cabinetNdx}`;

    // añadir un nodo para todo el archivador
    const cabinet = addTRSSceneGraphNode(
      cabinetName, parent, {
         translation: [cabinetNdx * kCabinetSpacing, 0, 0],
       });

    // añadir un nodo con un cubo para la malla del archivador
    const kCabinetSize = [
      kDrawerSize[kWidth] + 6,
      kDrawerSpacing * kNumDrawersPerCabinet + 6,
      kDrawerSize[kDepth] + 4,
    ];
    addCubeNode(
      `${cabinetName}-mesh`, cabinet, {
        scale: kCabinetSize,
      }, kCabinetColor);

    // Añadir los cajones
    for (let drawerNdx = 0; drawerNdx < kNumDrawersPerCabinet; ++drawerNdx) {
      addDrawer(cabinet, drawerNdx);
    }
  }
```

Y escribamos `addDrawer`.

```js
  function addDrawer(parent, drawerNdx) {
    const drawerName = `drawer${drawerNdx}`;

    // añadir un nodo para todo el cajón
    const drawer = addTRSSceneGraphNode(
      drawerName, parent, {
        translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
      });
    animNodes.push(drawer);

    // añadir un nodo con un cubo para el cubo del cajón.
    addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
      scale: kDrawerSize,
    }, kDrawerColor);

    // añadir un nodo con un cubo para el tirador
    addCubeNode(`${drawerName}-handle-mesh`, drawer, {
      translation: kHandlePosition,
      scale: kHandleSize,
    }, kHandleColor);
  }
```

Con nuestro grafo de escena listo, necesitamos actualizar nuestra función de renderizado.

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

Y ajustemos el código de la cámara:

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
-    // Calcular una matriz de vista
-    const viewMatrix = mat4.lookAt(eye, target, up);
+    // Calcular una matriz de cámara
+    const cameraMatrix = mat4.identity();
+    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
+    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+
+    // Calcular una matriz de vista
+    const viewMatrix = mat4.inverse(cameraMatrix);

     // combinar las matrices de vista y proyección
     const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);
```

Y eso nos da los mismos archivadores pero usando un grafo de escena.

{{{example url="../webgpu-scene-graphs-file-cabinets.html"}}}

## <a id="a-gui"></a> Añadir una interfaz de usuario (GUI)

Un punto importante de un grafo de escena es que, como son solo datos, podemos manipularlos. Añadamos una interfaz para ajustar y retocar el grafo.

Primero, añadamos algunos controles para la traslación, rotación y escalado. Crearemos un ayudante que la interfaz usará para ajustar un `TRS`, pero que nos permitirá cambiar qué `TRS` se está editando.

```js
   // Presenta un TRS a la interfaz, permitiendo elegir qué TRS se está editando.
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
+  const trsFolder = gui.addFolder('orientación');
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

Ahora necesitamos una forma de seleccionar un nodo, así que vamos a recorrer el grafo de escena y crear un botón para cada nodo.

```js
import GUI from '../3rdparty/muigui-0.x.module.js';
+import { addButtonLeftJustified } from './resources/js/gui-helpers.js';

...
+  const kUnelected = '\u3000'; // espacio de ancho completo
+  const kSelected = '➡️';
+  const prefixRE = new RegExp(`^(?:${kUnelected}|${kSelected})`);
+
+  function setCurrentSceneGraphNode(node) {
+    trsUIHelper.setTRS(node.source);
+    trsFolder.name(`orientación: ${node.name}`);
+    trsFolder.updateDisplay();
+
+    // Marcar qué nodo está seleccionado.
+    for (const b of nodeButtons) {
+      const name = b.button.getName().replace(prefixRE, '');
+      b.button.name(`${b.node === node ? kSelected : kUnelected}${name}`);
+    }
+  }
+
+  // \u00a0 es un espacio de no separación.
+  const threeSpaces = '\u00a0\u00a0\u00a0';
+  const barTwoSpaces = '\u00a0|\u00a0';
+  const plusDash = '\u00a0+-';
+  // añade un nodo del grafo de escena a la interfaz y añade el
+  // prefijo apropiado para que se vea algo como:
+  //
+  // +-raíz
+  // | +-hijo
+  // | | +-hijo
+  // | +-hijo
+  // +-hijo
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
+  const nodesFolder = gui.addFolder('nodos');
+  addSceneGraphNodeToGUI(nodesFolder, root);
+
+  setCurrentSceneGraphNode(root.children[0]);
```

Arriba creamos un botón para cada nodo que tiene una fuente `TRS`. Cuando se pulsa un botón, llama a `setCurrentSceneGraphNode` y le pasa el nodo de ese botón. `setCurrentSceneGraphNode` actualiza el nombre de la carpeta y luego llama a `trsFolder.updateDisplay` para actualizar la interfaz con los datos del `TRS` recién seleccionado.

Esto funciona, pero encontré que la interfaz está un poco saturada para nuestras pequeñas ventanas, así que aquí hay algunos retoques más.

1. Reducir los controles de traslación, rotación y escalado.

   Para los archivadores, aunque podemos establecer cualquiera de los 9 ajustes de traslación, rotación y escalado en cada nodo, el único que es realmente relevante es la "traslación z". Así que ocultemos todos menos la traslación por defecto.

   ```js
    const settings = {
      cameraRotation: degToRad(-45),
   +   showAllTRS: false,
    };

    const gui = new GUI();
    gui.onChange(render);
    gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
   + gui.add(settings, 'showAllTRS').onChange(showTRS);
    const trsFolder = gui.addFolder('orientación');
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
   const nodesFolder = gui.addFolder('nodos');
   addSceneGraphNodeToGUI(nodesFolder, root);

   +const alwaysShow = new Set([0, 1, 2]);
   +function showTRS(show) {
   +  trsControls.forEach((trs, i) => {
   +    trs.show(show || alwaysShow.has(i));
   +  });
   +}
   +showTRS(false);
   ```

   Este código agrupa los controles de traslación, rotación y escalado en un array y muestra todos o solo los primeros 3.

2. No mostrar las mallas (meshes).

   Tenemos un nodo '-mesh' en el grafo para cada cubo que realmente no necesitamos para mover los archivadores o los cajones, así que ocultémoslos por defecto.

   ```js
     // \u00a0 es un espacio de no separación.
     const threeSpaces = '\u00a0\u00a0\u00a0';
     const barTwoSpaces = '\u00a0|\u00a0';
     const plusDash = '\u00a0+-';
     // añade un nodo del grafo de escena a la interfaz y añade el
     // prefijo apropiado para que se vea algo como:
     //
     // +-raíz
     // | +-hijo
     // | | +-hijo
     // | +-hijo
     // +-hijo
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

   -  const nodesFolder = gui.addFolder('nodos');
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

Intenta seleccionar un "cajón" (drawer) y ajustar la "traslación z".

{{{example url="../webgpu-scene-graphs-file-cabinets-w-gui.html"}}}

Como puedes ver, al tener datos para cada nodo es fácil cambiar la posición, rotación y escala de cualquier nodo individual.

## <a id="a-animate"></a> Animación

Por diversión, vamos a animar los cajones.

Primero, hagamos una lista de los nodos de los cajones.

```js
   const animNodes = [];

   function addDrawer(parent, drawerNdx) {
     const drawerName = `drawer${drawerNdx}`;

     // añadir un nodo para todo el cajón
     const drawer = addTRSSceneGraphNode(
       drawerName, parent, {
         translation: [3, drawerNdx * kDrawerSpacing + 5, 1],
       });
+    animNodes.push(drawer);

     // añadir un nodo con un cubo para el cubo del cajón.
     addCubeNode(`${drawerName}-drawer-mesh`, drawer, {
       scale: kDrawerSize,
     }, kDrawerColor);

     // añadir un nodo con un cubo para el tirador
     addCubeNode(`${drawerName}-handle-mesh`, drawer, {
       translation: kHandlePosition,
       scale: kHandleSize,
     }, kHandleColor);
   }
```

Luego escribamos algo de código para animar los cajones basándonos en el tiempo.

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

Hagamos un bucle de renderizado. Haremos que solicite un frame de animación solo si aún no hemos solicitado uno y ningún frame se ha renderizado todavía.

```js
+  // solicitar render si aún no se ha solicitado.
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

Y necesitamos actualizar los lugares que antes llamaban a `render` para que ahora llamen a `requestRender`.

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
       // volver a renderizar
-      render();
+      requestRender();
     }
   });
   observer.observe(canvas);
```

Finalmente, configuremos algo de código para permitirnos encender y apagar la animación.

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

Una complicación de arriba es que preferimos que el reloj solo corra si "animate" está marcado. Por eso comprobamos si `wasRunning` (estaba corriendo) en el frame anterior. Si no, establecemos `deltaTime` a 0. De esa manera, el reloj no saltará hacia adelante la cantidad de tiempo que estuvimos sin animar.

Desactivamos los controles de traslación, rotación y escalado si estamos animando.

Finalmente, si `settings.animate` está activado, solicitamos otro frame de animación. El código de la interfaz ya llamará a `requestRender` en cualquier cambio, por lo que iniciará un renderizado, verá que `settings.animate` es true y solicitará otro frame.

{{{example url="../webgpu-scene-graphs-file-cabinets-w-animation.html"}}}

Otra ventaja de un grafo de escena es que facilita la aplicación de animaciones. Simplemente las aplicamos a los nodos. No tenemos que preocuparnos de antemano de cómo fueron creados.

## <a id="a-hand"></a> Creación de una mano

Hagamos un nuevo ejemplo de una mano. Para que sea sencillo, seguiremos usando cubos.

Aquí hay un diagrama de cómo se verá el grafo de escena:

```
raíz (root)
 +-muñeca (wrist)
    +-palma (palm)
    |  +-pulgar (thumb)
    |  |  +-malla-pulgar
    |  |  +-pulgar-1
    |  |     +-malla-pulgar-1
    |  +-dedo índice (index finger)
    |  |  +-malla-dedo índice
    |  |  +-dedo índice-1
    |  |     +-malla-dedo índice-1
    |  |     +-dedo índice-2
    |  |        +-malla-dedo índice-2
    |  +-dedo medio (middle finger)
    |  |  +-malla-dedo medio
    |  |  +-dedo medio-1
    |  |     +-malla-dedo medio-1
    |  |     +-dedo medio-2
    |  |        +-malla-dedo medio-2
    |  +-dedo anular (ring finger)
    |  |  +-malla-dedo anular
    |  |  +-dedo anular-1
    |  |     +-malla-dedo anular-1
    |  |     +-dedo anular-2
    |  |        +-malla-dedo anular-2
    |  +-meñique (pinky)
    |     +-malla-meñique
    |     +-meñique-1
    |        +-malla-meñique-1
    |        +-meñique-2
    |           +-malla-meñique-2
    +-malla-palma
```

Primero, movamos los vértices del cubo para que estén centrados sobre el plano XZ. Podríamos hacer esto añadiendo más nodos en el grafo de escena o aplicándolo en cada nodo '-mesh', pero sería menos lioso hacerlo simplemente en los propios vértices.

```js
function createCubeVertices() {
  const positions = [
    // izquierda
-    0, 0,  0,
-    0, 0, -1,
-    0, 1,  0,
-    0, 1, -1,
+   -0.5, 0,  0.5,
+   -0.5, 0, -0.5,
+   -0.5, 1,  0.5,
+   -0.5, 1, -0.5,

    // derecha
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

Ahora hagamos el grafo de escena. Borramos todo el código relacionado con la creación del grafo de los archivadores y lo reemplazamos por esto:

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
+    ...addFinger('pulgar',         palm, 2, 20, { translation: [-50, 0, 0], rotation }),
+    ...addFinger('dedo índice',  palm, 3, 30, { translation: [-25, 0, 0], rotation }),
+    ...addFinger('dedo medio', palm, 3, 35, { translation: [ -0, 0, 0], rotation }),
+    ...addFinger('dedo anular',   palm, 3, 33, { translation: [ 25, 0, 0], rotation }),
+    ...addFinger('meñique',         palm, 3, 25, { translation: [ 45, 0, 0], rotation }),
+  ];
```

Creamos una muñeca, a la que adjuntamos una palma y una malla de la palma. A la palma adjuntamos 5 dedos usando `addFinger`. `addFinger` añade los segmentos de un dedo, cada uno de cierta longitud.

> Sí, esto no es ni remotamente correcto para una mano humana 😂

Mientras que para los archivadores solo nos importaba la `traslación z`, la transformación más importante para la mano es la `rotación x`, así que ajustemos qué controles se muestran por defecto:

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

La animación para la mano necesita rotar en x en lugar de trasladar en z.

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

Finalmente, ajustemos un poco la cámara.

```js
     // Calcular una matriz de cámara.
     const cameraMatrix = mat4.identity();
-    mat4.translate(cameraMatrix, [120, 100, 0], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 100, 0], cameraMatrix);
     mat4.rotateY(cameraMatrix, settings.cameraRotation, cameraMatrix);
-    mat4.translate(cameraMatrix, [60, 0, 300], cameraMatrix);
+    mat4.translate(cameraMatrix, [100, 0, 300], cameraMatrix);
```

{{{example url="../webgpu-scene-graphs-hand.html"}}}

Selecciona un dedo y ajusta solo la 'rotación x' y verás que todos los segmentos de más adelante rotan con él.

## <a id="a-shoot"></a> Disparar un proyectil desde el dedo índice

Otra ventaja de un grafo de escena es que puedes preguntar fácilmente la posición y orientación de cualquier nodo del grafo.

Así que, para disparar desde el dedo índice, necesitamos conocer el nodo de la punta del dedo. Muchos APIs de grafos de escena tienen funciones para buscar nodos por nombre. Añadamos una al nuestro.

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

Con eso añadido, podemos encontrar el último segmento del dedo índice por nombre. Ese nodo representa la base del último segmento del dedo índice, el punto en el que rota, no la punta. Así que vamos a añadir otro nodo como hijo de ese último segmento del dedo índice que realmente represente la punta.

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
     ...addFinger('pulgar',         palm, 2, 20, { translation: [-50, 0, 0], rotation }),
     ...addFinger('dedo índice',  palm, 3, 30, { translation: [-25, 0, 0], rotation }),
     ...addFinger('dedo medio', palm, 3, 35, { translation: [ -0, 0, 0], rotation }),
     ...addFinger('dedo anular',   palm, 3, 33, { translation: [ 25, 0, 0], rotation }),
     ...addFinger('meñique',         palm, 3, 25, { translation: [ 45, 0, 0], rotation }),
   ];
+  const fingerTip = addTRSSceneGraphNode('punta-dedo', root.find('dedo índice-2'), { translation: [0, 30, 0] });
```

Ahora necesitamos un proyectil. Usaremos el cono que creamos para los adornos en [el artículo anterior](webgpu-matrix-stacks.html).

```js
   const cubeVertices = createVertices(createCubeVertices(), 'cube');
+  const shotVertices = createVertices(createConeVertices({
+    radius: 10,
+    height: 20,
+  }), 'disparo');
```

Ahora añadamos algo de código para disparar proyectiles.

```js
   const kShotVelocity = 100; // unidades por segundo
   const shots = [];
   let shotId = 0;
   function fireShot() {
     const node = new SceneGraphNode(`disparo-${shotId++}`);
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

Este código añade un "disparo" (shot) al array `shots`. Esto incluye un `node`, una `mesh`, una `velocity` y un `endTime`.

El `node` se posiciona 20 unidades hacia fuera en el eje Y. Esto se debe a que el código para crear los vértices del cono coloca la punta a 20 unidades, por lo que necesitamos compensarlo. Podríamos ir a modificar el código del vértice del cono, pero esto era menos trabajo 😅. Fíjate en que no estamos añadiendo una fuente `TRS` para este nodo; actualizaremos la matriz local directamente.

`mesh` son los vértices de la malla. Necesitamos esto para poder eliminar la malla del disparo de la lista de cosas a renderizar cuando el disparo haya terminado.

`velocity` es la dirección y velocidad para mover el disparo. Llamamos a `vec3.getAxis` para obtener el eje Y como la dirección para disparar, ya que ese es el eje hacia el que apuntan los dedos. Como cubrimos en [el artículo sobre matemáticas 3D](webgpu-orthographic-projection.html), el eje Y es la segunda fila de la matriz (o los elementos 4, 5, 6), por lo que `vec3.getAxis` se puede implementar así:

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

Nuestro código obtiene ese eje Y y normaliza esa dirección, y luego usa `vec3.mulScalar` para multiplicarla por nuestra velocidad deseada. Necesitamos suministrar `vec3.mulScalar`:

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

Finalmente, el `endTime` es algún momento en el futuro para eliminar el disparo. Con eso, añadamos algo de código para mover los proyectiles.

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

Ese código comprueba si el tiempo del disparo ha expirado. Si es así, elimina el nodo del disparo del grafo de escena y elimina la malla de la lista de cosas a renderizar. De lo contrario, para cada disparo en el array, añade la velocidad a la matriz del disparo, escalándola por el `deltaTime` para que sea independiente de la tasa de frames. Necesitamos suministrar `removeMesh`:

```js
   function removeMesh(mesh) {
     meshes.splice(meshes.indexOf(mesh), 1);
   }
```

Ahora necesitamos añadir un botón para disparar, así como llamar realmente a esta función de procesamiento.

```js
   const gui = new GUI();
   gui.onChange(requestRender);
   gui.add(settings, 'cameraRotation', cameraRadToDegOptions);
   gui.add(settings, 'animate').onChange(v => {
     trsFolder.enable(!v);
   });
   gui.add(settings, 'showMeshNodes').onChange(showMeshNodes);
   gui.add(settings, 'showAllTRS').onChange(showTRS);
+  gui.addButton('¡Disparar!', fireShot);

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

Necesitamos seguir ejecutando si hay disparos. Cuando se pulsa el botón '¡Disparar!', se añadirá un disparo. El GUI también llamará a `requestRender`, por lo que pasará por este código y llamará a `processShots`. `processShots` llama a `requestRender` si hay algún disparo, por lo que el bucle de animación continuará hasta que todos los disparos hayan terminado.

{{{example url="../webgpu-scene-graphs-hand-shoot.html"}}}

Intenta seleccionar uno de los dedos índice, ajustando la rotación x, y luego pulsando '¡Disparar!'. O pulsa '¡Disparar!' mientras se está animando.

Este artículo debería haberte dado una idea de qué es un grafo de escena y cómo usarlo. Unity, Blender, Unreal, Maya, 3DSMax, Three.js, todos tienen un grafo de escena. Pueden tomar diferentes formas. Algunos ponen las mallas en el propio grafo, haciéndolo no homogéneo. Otros son más "puros" y las mantienen separadas. Algunos tienen clases "fuente" bastante complejas. Tener un grafo de escena es generalmente el comienzo de un motor 3D. No todos los motores 3D tienen uno, pero la mayoría sí.

En nuestro código de arriba mantuvimos la cámara fuera del grafo de escena, pero es más común que la cámara sea parte del propio grafo. Así es como puedes ver y manipular múltiples cámaras en programas como Unity, Unreal, Blender, etc... Al ponerla en el propio grafo, podemos hacer que la cámara sea hija de algún nodo y, por tanto, se vea afectada por su padre. Por ejemplo, una cámara desde la perspectiva del conductor de un coche o una cámara en una cámara de seguridad giratoria.

Del mismo modo, los grafos de escena pueden ayudar a implementar manipuladores 3D como los que tienen muchos editores 3D. Estos son los elementos de la interfaz que te permiten trasladar, rotar y escalar objetos en la vista 3D en lugar de hacerlo desde una interfaz separada como la que usamos arriba. Quizás podamos cubrir los manipuladores 3D en otro artículo.



<!-- keep this at the bottom of the article -->

