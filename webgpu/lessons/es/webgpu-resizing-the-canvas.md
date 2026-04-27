Title: Redimensionando el canvas en WebGPU
Description: Cómo redimensionar un canvas de WebGPU y los problemas involucrados
TOC: Redimensionando el canvas

En [el artículo sobre los fundamentos de webgpu](webgpu-fundamentals.html) configuramos una estructura básica para establecer la resolución del canvas de modo que coincida con el tamaño en el que se muestra. Repasemos algunos de los detalles sobre el redimensionamiento de un canvas.

Cada canvas tiene dos tamaños. El tamaño de su *drawing buffer* (buffer de dibujo). Esto indica cuántos píxeles hay en el propio canvas. El segundo tamaño es el tamaño en el que se muestra el canvas. El CSS determina el tamaño de visualización del canvas.

Puedes establecer el tamaño del drawing buffer del canvas de dos maneras. Una usando HTML:

```html
<canvas id="c" width="400" height="300"></canvas>
```

La otra usando JavaScript:

```html
<canvas id="c"></canvas>
```

JavaScript:

```js
const canvas = document.querySelector("#c");
canvas.width = 400;
canvas.height = 300;
```

En cuanto a establecer el tamaño de visualización de un canvas, si no tienes ningún CSS que afecte al tamaño de visualización del canvas, el tamaño de visualización será el mismo que el de su drawing buffer. Por lo tanto, en los dos ejemplos anteriores, el drawing buffer del canvas es de 400x300 y su tamaño de visualización también es de 400x300.

Aquí tienes un ejemplo de un canvas cuyo drawing buffer es de 10x15 píxeles que se muestra a 400x300 píxeles en la página:

```html
<canvas id="c" width="10" height="15" style="width: 400px; height: 300px;"></canvas>
```

o, por ejemplo, así:

```html
<style>
#c {
  width: 400px;
  height: 300px;
}
</style>
<canvas id="c" width="10" height="15"></canvas>
```

Si dibujamos una línea giratoria de un solo píxel de ancho en ese canvas, veremos algo como esto:

{{{example url="../webgpu-10x15-canvas-400x300-css.html" }}}

¿Por qué se ve tan borroso? Porque el navegador toma nuestro canvas de 10x15 píxeles y lo estira a 400x300 píxeles y, por lo general, lo *filtra* cuando lo estira.

Entonces, ¿qué hacemos si, por ejemplo, queremos que el canvas ocupe toda la ventana? Bueno, primero podemos hacer que el navegador estire el canvas para llenar la ventana con CSS. Ejemplo:

```html
<html>
  <head>
    <style>
    html, body {
      margin: 0;       /* elimina el margen por defecto       */
      height: 100%;    /* haz que html,body llenen la página  */
    }
    #c {
      display: block;  /* haz que el canvas actúe como bloque */
      width: 100%;     /* haz que el canvas llene su contenedor */
      height: 100%;
    }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
  </body>
</html>
```

Ahora solo necesitamos que el drawing buffer coincida con el tamaño al que el navegador ha estirado el canvas. Desafortunadamente, este es un tema más complicado de lo que podrías esperar. Repasemos algunos métodos diferentes.

## Usar `ResizeObserver`

Cubrimos esto en [el artículo sobre los fundamentos de webgpu](webgpu-fundamentals.html). Esta es la forma moderna y todos los navegadores que soportan WebGPU también soportan `ResizeObserver`.

Para repetir lo que escribimos en el otro artículo: creas un `ResizeObserver` y le pasas una función para que la llame cada vez que los elementos que le has pedido observar cambien su tamaño. Luego le indicas qué elementos observar.

```js
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
    const width = entry.contentBoxSize[0].inlineSize;
    const height = entry.contentBoxSize[0].blockSize;
    const canvas = entry.target;
    canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
    canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
  }
});
observer.observe(canvas);
```

En el código anterior recorremos todas las entradas (`entries`), pero normalmente solo habrá una porque solo estamos observando un canvas. Necesitamos limitar el tamaño del canvas al tamaño máximo que soporte nuestro dispositivo; de lo contrario, WebGPU empezará a generar errores indicando que intentamos crear una textura demasiado grande. También debemos asegurarnos de que no llegue a cero o, de nuevo, obtendremos errores.

Si solo estamos renderizando bajo demanda, podríamos poner una llamada a nuestra función de renderizado dentro del código anterior. De lo contrario, si estamos animando mediante un bucle de `requestAnimationFrame` (bucle rAF) u otros medios, la próxima vez que rendericemos obtendremos una textura que coincida con el tamaño que establecimos en el canvas cuando llamemos a `context.getCurrentTexture()`.

> Ten en cuenta que `inlineSize` y `blockSize` no son enteros.

## Usar `clientWidth` y `clientHeight`

Antes de que existiera `ResizeObserver`, era común usar `clientWidth` y `clientHeight`. Estas son propiedades que tiene cada elemento en HTML y que nos indican el tamaño del elemento en píxeles CSS.

> Nota: El rect del cliente incluye cualquier padding de CSS, por lo que si usas `clientWidth` y/o `clientHeight`, es mejor no poner ningún padding en tu elemento canvas.

Usando JavaScript podemos comprobar a qué tamaño se está mostrando ese elemento y luego ajustar el tamaño de su drawing buffer para que coincida.

```js
  // Consulta el tamaño en el que el navegador muestra el canvas en píxeles CSS.
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
  canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
```

Usaríamos este código justo antes de llamar a `context.getCurrentTexture()`.

Personalmente, esta forma parece desactualizada, pero es probable que la veas por aquí y por allá, probablemente copiada y pegada de ejemplos antiguos que usan otras APIs.

## Usar `getBoundingClientRect`

Otra forma de hacer esto es llamar a `getBoundingClientRect`.

```js
  // Consulta el tamaño en el que el navegador muestra el canvas en píxeles CSS.
  const rect = canvas.getBoundingClientRect();
  const width = rect.width; 
  const height = rect.height; 
  canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
  canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
```

La diferencia entre `clientWidth`, `clientHeight` y `getBoundingClientRect` es que el ancho y el alto de `getBoundingClientRect` no tienen por qué ser enteros, mientras que los valores de `clientWidth` y `clientHeight` sí lo son.

¿Por qué el ancho o el alto no serían enteros? [Mira más abajo](#a-dpr).

## Usar `window.innerWidth` y `window.innerHeight`

Veo esto a menudo y realmente parece un **anti-patrón**. La razón es que es inflexible. Las dos técnicas anteriores funcionan en cada situación, mientras que usar `window.innerWidth` y `window.innerHeight` solo funciona en una situación específica: cuando quieres llenar la página. Ya hemos demostrado que las técnicas anteriores llenan la página perfectamente, pero también funcionan en cualquier otra situación.

Por ejemplo, tener el canvas *sin* llenar la página. Como un diagrama en un artículo o en un editor con una barra de herramientas.

No supone más trabajo usar las dos primeras técnicas, por lo que parece absurdo usar esta técnica menos útil. Desafortunadamente, la fuerza del "copiar y pegar" es poderosa 😂

## <a id="a-dpr"></a>Manejo de `devicePixelRatio` y zoom

¿Por qué no termina ahí la cosa? Bueno, aquí es donde se complica.

Lo primero que hay que entender es que la mayoría de los tamaños en el navegador están en unidades de píxeles CSS. Este es un intento de hacer que los tamaños sean independientes del dispositivo. Así, por ejemplo, al principio de este artículo establecimos el tamaño de visualización del canvas en 400x300 píxeles CSS. Dependiendo de si el usuario tiene una pantalla de alta densidad (HD-DPI), o si ha ampliado o reducido el zoom, o si tiene configurado un nivel de zoom en el sistema operativo, la cantidad de píxeles reales que eso represente en el monitor será diferente.

`devicePixelRatio` nos indicará, en general, la relación entre píxeles reales y píxeles CSS en tu monitor. Por ejemplo, aquí tienes la configuración actual de tu navegador:

> <div>devicePixelRatio = <span data-diagram="dpr"></span></div>

Si estás en un ordenador de sobremesa o portátil, intenta pulsar <kbd>ctrl</kbd>+<kbd>+</kbd> y <kbd>ctrl</kbd>+<kbd>-</kbd> para acercar y alejar el zoom (<kbd>⌘</kbd>+<kbd>+</kbd> y <kbd>⌘</kbd>+<kbd>-</kbd> en Mac). Deberías ver que el número cambia en Firefox, Chrome, Edge (pero no en Safari).

Así que, si queremos que el número de píxeles en el canvas coincida con el número de píxeles utilizados realmente para mostrarlo, la solución aparentemente obvia sería multiplicar los valores que consultamos anteriormente de esta manera:

```js
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
-    const width = entry.contentBoxSize[0].inlineSize;
-    const height = entry.contentBoxSize[0].blockSize;
+    const width = entry.contentBoxSize[0].inlineSize * devicePixelRatio;
+    const height = entry.contentBoxSize[0].blockSize * devicePixelRatio;
```

O esta:

```js
-  const width = canvas.clientWidth;
-  const height = canvas.clientHeight;
+ const width = canvas.clientWidth * devicePixelRatio;
+ const height = canvas.clientHeight * devicePixelRatio;
```

O esta:

```js
  const rect = canvas.getBoundingClientRect();
-  const width = rect.width; 
-  const height = rect.height; 
+  const width = rect.width * devicePixelRatio; 
+  const height = rect.height * devicePixelRatio; 
```

> **¡¡¡LOS EJEMPLOS ANTERIORES NO DARÁN REALMENTE EL RESULTADO CORRECTO!!!**

Dicho esto, es una aproximación cercana y podría ser suficiente para tus necesidades. Si no te importa no obtener un renderizado perfecto de 1 a 1 píxeles en la pantalla, puedes usar las soluciones anteriores.

Hay dos formas de ver por qué el código anterior no proporciona la respuesta correcta:

1. `devicePixelRatio` no es un entero.

   Si estás en Firefox, Edge o Chrome y pulsas las teclas de zoom como se mencionó anteriormente, puedes ver fácilmente valores fraccionarios de `devicePixelRatio`.

2. El tamaño de cualquier elemento en sí mismo no es un entero.

   Arriba vimos que tanto `ResizeObserver` como `getBoundingClientRect` devuelven valores no enteros para el tamaño de un elemento.

Para ver un ejemplo concreto de dónde surge este problema, podemos crear un div con 3 hijos, cada uno configurado para tener el 33% del ancho de su padre:

```html
<div id="parent">
  <div id="left">left</div>
  <div id="middle">middle</div>
  <div id="right">right</div>
</div>
```

```css
#parent {
  display: flex;
  width: 299px;
  height: 40px;
  align-items: stretch;
  background-color: red;
}
#parent>* {
  flex: 1 1 33%;
}
#left { background-color: #A44; }
#middle { background-color: #4A4; }
#right { background-color: #66C; }
```

{{{example url="../fractional-element-size-issues.html"}}}

En una de mis máquinas, con una ventana del navegador por defecto (sin zoom), obtengo estos resultados:

<pre class="fixed-size-text">
devicePixelRatio: 2
--------------- #left ---------------
                 inlineSize: 99.65625
                clientWidth: 100
 getBoundingClientRect.width: 99.6640625
--------------- #middle ---------------
                 inlineSize: 99.65625
                clientWidth: 100
 getBoundingClientRect.width: 99.6640625
--------------- #right ---------------
                 inlineSize: 99.65625
                clientWidth: 100
 getBoundingClientRect.width: 99.6640625
--------------- #parent ---------------
                 inlineSize: 299
                clientWidth: 299
 getBoundingClientRect.width: 299
</pre>

Lo primero a notar es que **¡¡los números para los 3 hijos son exactamente iguales!!** Pero nuestro padre tiene 299 píxeles CSS de ancho. Si multiplicamos eso por el `devicePixelRatio` de 2, obtenemos 598 píxeles reales. Tenemos 3 hijos. `598 / 3 = 199.33333333333334`. No podemos tener 199.33333333334 píxeles reales. Si redondeamos a 199, entonces 199 + 199 + 199 = 597. Pero nuestro padre tiene 598. Para llegar a 598, uno de esos elementos necesita un píxel extra pero, dado que la información para los 3 es exactamente la misma, ¿cuál de ellos recibe el píxel extra?

## <a id="a-devicepixelcontentboxsize"></a> `devicePixelContentBoxSize`

La solución es que `ResizeObserver` proporciona la respuesta. Se llama `devicePixelContentBoxSize`.

```
const observer = new ResizeObserver(entries => {
  for (const entry of entries) {
-    const width = entry.contentBoxSize[0].inlineSize;
-    const height = entry.contentBoxSize[0].blockSize;
+    const width = entry.devicePixelContentBoxSize[0].inlineSize;
+    const height = entry.devicePixelContentBoxSize[0].blockSize;
```

Si añadimos esa medida a nuestro ejemplo, nos da la respuesta real:

{{{example url="../fractional-element-size-device-pixel-content-box-size.html"}}}

En la máquina que usé para los resultados anteriores, obtengo estos resultados:

<pre class="fixed-size-text">
devicePixelRatio: 2
--------------- #left ---------------
                           inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 199    &lt;=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #middle ---------------
                           inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 200    &lt;=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #right ---------------
                           inlineSize: 99.65625
devicePixelContentBoxSize.inlineSize: 199    &lt;=====
                         clientWidth: 100
         getBoundingClientRect.width: 99.6640625
--------------- #parent ---------------
                           inlineSize: 299
devicePixelContentBoxSize.inlineSize: 598    &lt;=====
                         clientWidth: 299
         getBoundingClientRect.width: 299
</pre>

Como puedes ver, en mi máquina el navegador le dio el píxel extra al elemento central. Tiene 200 píxeles de dispositivo de ancho frente a los otros 2 elementos que tienen 199 píxeles de dispositivo de ancho.

Este problema no se limita a este caso, es solo la forma más sencilla de mostrar un ejemplo concreto de no poder obtener esta información de ninguna otra manera. El punto es que, si quieres perfección de píxeles, no puedes simplemente multiplicar alguna otra medida por `devicePixelRatio`. Debes usar `ResizeObserver` y `devicePixelContentBoxSize`.

Nota: Safari, a fecha de noviembre de 2023, no soporta `devicePixelContentBoxSize`, ni tampoco cambia el `devicePixelRatio` en respuesta al zoom. Esto significa que **es imposible en Safari mostrar un canvas con una perfección de 1x1 píxeles**.

## `content-box` vs `device-pixel-content-box`

Cuando llamas a `ResizeObserver.observe` puedes indicarle que observe los cambios de uno de dos tamaños de caja. El predeterminado es observar el tamaño de `content-box`. Este es el tamaño CSS del elemento. Arriba, los elementos pueden no cambiar nunca su tamaño CSS. El padre está configurado a 299px píxeles CSS independientemente del nivel de zoom. Los hijos están configurados al 33%, que es el 33% de 299, lo que siempre es 99.666666 (o lo que sea que computen, ver resultados arriba). Por otro lado, si el elemento ocupa todo el tamaño de la página, entonces sí cambiaría al hacer zoom. [^safari]

También puedes observar `device-pixel-content-box`. Este es el tamaño de la cantidad real de píxeles de dispositivo que ocupa el elemento. Esto cambiará cuando cambie el nivel de zoom [^safari]. No cambiará si el tamaño en píxeles de dispositivo del elemento no ha cambiado realmente. Por ejemplo, si el elemento ocupa todo el tamaño de la página, hacer zoom no cambia el hecho de que sigue ocupando todo el tamaño de la página y, por lo tanto, sigue teniendo el mismo número de píxeles de dispositivo.

[^safari]: Excepto en Safari 🤬

Para decirle a `ResizeObserver` qué tamaño observar, se lo pasas al llamar a `observe`.

```
resizeObserver.observe(someElement1, {box: 'device-pixel-content-box'});
resizeObserver.observe(someElement2, {box: 'content-box'});
```

Desafortunadamente, de nuevo, Safari no soporta esto y lanzará una excepción si intentas pasar `'device-pixel-content-box'`.

## <a id="a-actual-pixels"></a> Píxeles reales - solución

A partir de noviembre de 2023, la solución para obtener el número real de píxeles es solicitar ambos tipos de cajas anteriores, capturar el problema de Safari y, si `devicePixelContentBoxSize` no está disponible, recurrir a `contentBoxSize`.

Aquí tienes nuestro código estándar para redimensionar el canvas actualizado para soportar un renderizado perfecto de píxeles en todos los navegadores que cumplen con los estándares [^safari]:

```js
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                    entry.contentBoxSize[0].inlineSize * devicePixelRatio;
      const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                     entry.contentBoxSize[0].blockSize * devicePixelRatio;
      const canvas = entry.target;
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      // re-renderizar
      render();
    }
  });
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas, { box: 'content-box' });
  }
```

Podemos probar esto dibujando un patrón que mostrará un [efecto moiré](https://www.google.com/search?q=moire+effect) si el renderizado no es perfecto a nivel de píxel. Dibujamos un patrón como este en [el artículo sobre variables inter-etapa (inter-stage variables)](webgpu-inter-stage-variables.html#a-builtin-position).

Reemplazando el código de redimensionamiento del canvas con el fragmento anterior y cambiando el patrón a un tablero de ajedrez magenta, verde, blanco y negro.

```wgsl
  @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-    let red = vec4f(1, 0, 0, 1);
-    let cyan = vec4f(0, 1, 1, 1);
-    return select(red, cyan, checker);

+    let hv = vec2f(floor(fsInput.position.xy % 2));
+    return vec4f(1, 0, 1, 1) * hv.x +
+           vec4f(0, 1, 0, 1) * hv.y;
  }
```

Hagamos también el triángulo lo suficientemente grande como para cubrir el canvas [^large-triangle].

[^large-triangle]: Consulta [este artículo](webgpu-large-triangle-to-cover-clip-space.html) para saber por qué estas posiciones de vértices.

```js
    let pos = array(
-      vec2f( 0.0,  0.5),  // centro superior
-      vec2f(-0.5, -0.5),  // inferior izquierda
-      vec2f( 0.5, -0.5)   // inferior derecha
+      vec2f(-1.0,  3.0),
+      vec2f( 3.0, -1.0),
+      vec2f(-1.0, -1.0),
    );
```

{{{example url="../webgpu-resize-pixel-perfect.html" }}}

Ábrelo en una ventana nueva y acerca o aleja el zoom. Deberías ver un patrón monótono que parece casi un color sólido que no cambia independientemente del nivel de zoom, excepto en Safari donde, si haces zoom, podrías ver [patrones de moiré](https://www.google.com/search?q=moire+pattern) que muestran que era imposible obtener perfección de píxeles en Safari.

> Nota: Si quieres añadir tu voz educada para que Safari soporte `devicePixelContentBox`, puedes hacerlo en el informe de errores [aquí](https://bugs.webkit.org/show_bug.cgi?id=264158), así como en el error sobre Safari que no cambia `devicePixelRatio` en respuesta al zoom [aquí](https://bugs.webkit.org/show_bug.cgi?id=124862). Los errores a menudo se trabajan según la atención que reciben, así que por favor añade tu voz a los errores.

## ¿Necesitas usar `devicePixelRatio`?

Dibujar a resoluciones más altas es más lento que dibujar a resoluciones más bajas. No siempre es importante usar `devicePixelRatio`. Incluso si decides soportarlo, [muchos teléfonos tienen relaciones de píxeles de dispositivo de hasta 4](https://yesviz.com/viewport/). Eso es un total de 16 píxeles por cada píxel CSS. Dibujar 16 veces más píxeles es literalmente hasta 16 veces más lento que dibujar 1. Así que quizás quieras considerar limitar cómo usas `devicePixelRatio`, como `dpr = Math.min(2, devicePixelRatio)`.

Además, dado que los juegos suelen ofrecer una mala experiencia si son lentos, podrías considerar permitir que el usuario elija un multiplicador, que es lo que hacen muchos juegos de ordenador nativos en su configuración de opciones gráficas. De esta forma, el usuario puede elegir si prefiere resolución o velocidad.

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-resizing-the-canvas.js"></script>
