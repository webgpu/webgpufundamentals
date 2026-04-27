Title: Gran Triángulo para Cubrir el Espacio de Recorte en WebGPU
Description: Gran Triángulo para Cubrir el Espacio de Recorte
TOC: Gran Triángulo de Espacio de Recorte

Este es un pequeño *truco* / *patrón* y es una optimización menor.

A menudo necesitas dibujar un quad (cuadrilátero) que ocupe toda la pantalla, todo el canvas o toda una textura.
En otras palabras, un rectángulo que cubra todo el espacio de recorte (clip space).

La forma más obvia de hacer esto es crear un quad a partir de 2 triángulos

<div class="webgpu_center">
  <div>
    <img style="width: 342px;" src="resources/quad-triangles.svg">
    <div>quad de espacio de recorte mediante 2 triángulos</div>
  </div>
</div>


```
    // triángulo inferior izquierdo
    -1, -1,
     1, -1,
    -1,  1,

    // triángulo superior derecho
    -1,  1,
     1, -1,
     1,  1,
```

Ya sea que hagas esto pasando datos a un vertex shader (shader de vértices) o codificándolos directamente en el shader, es una necesidad común. Lo hemos usado varias veces.
Por ejemplo, al [generar mipmaps en el artículo sobre la importación de texturas](webgpu-importing-textures.html).

Funciona y es fácil de entender.

Sin embargo, existe un atajo para este caso específico. En su lugar, podemos crear un único triángulo lo suficientemente grande como para cubrir toda el área del espacio de recorte. Un ejemplo sencillo es este triángulo:

<div class="webgpu_center">
  <div>
    <img style="width: 512px;" src="resources/quad-triangle.svg">
    <div>rosa = espacio de recorte (clip space)</div>
  </div>
</div>

Esto son solo 3 vértices en lugar de 6:

```
    -1,  3,
     3, -1,
    -1, -1,
```

Debido a que la GPU va a recortar este triángulo al espacio de recorte, obtenemos el mismo resultado que con el quad de 2 triángulos (6 vértices), pero nos ahorramos un poco de escritura.

Además de eso, las GPUs generalmente dibujan píxeles en unidades de 2x2 píxeles. Usan esto por varias razones, pero una es para ser más eficientes. Por lo tanto, si dibujamos 2 triángulos, a lo largo de los bordes donde se encuentran los 2 triángulos, la GPU tiene que hacer un trabajo extra. Quiere procesar un cuadrado de 2x2 pero tiene que trabajar más para dibujar solo los 1 o 2 píxeles en los que cada triángulo realmente necesitaba dibujar.

Al dibujar el triángulo único, evitamos este trabajo extra.

La verdad es que este trabajo extra es minúsculo. Para un quad de pantalla completa, probablemente use menos del 0,5% de un frame a 60Hz. No es nada, pero es poco probable que sea la diferencia entre que tu aplicación funcione de forma fluida o lenta.

Dicho esto, escribir 3 vértices es más sencillo que escribir 6, por lo que incluso si es solo una pequeña victoria de rendimiento, sigue siendo un patrón que se siente bien usar cuando es apropiado. Algunos ejemplos son cualquier momento en el que necesites dibujar un quad completo en el espacio de recorte. Por ejemplo, al generar mipmaps, dibujar un skybox, realizar post-procesamiento (post processing), crear un shader toy, etc.
