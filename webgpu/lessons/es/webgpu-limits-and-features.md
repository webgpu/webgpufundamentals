Title: Características Opcionales y Límites en WebGPU
Description: Características Opcionales
TOC: Características Opcionales y Límites

WebGPU tiene un conjunto de características opcionales y límites. Repasemos cómo comprobarlos
y solicitarlos.

Cuando solicitas un adapter (adaptador) con

```js
const adapter = await navigator.gpu?.requestAdapter();
```

El adapter tendrá una lista de límites en `adapter.limits` y un array de nombres de características (features)
en `adapter.features`. Por ejemplo:

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.limits.maxColorAttachments);
```

Podría imprimir `8` en la consola, lo que significa que el adapter soporta un máximo
de 8 color attachments.

Aquí tienes una lista de todos los límites, incluyendo los límites de tu adapter por defecto,
así como los límites mínimos requeridos.

<div class="webgpu_center data-table limits" data-diagram="limits"></div>

Los límites mínimos son los límites con los que puedes contar en todos los dispositivos que soportan WebGPU.

También hay una lista de características opcionales (features). Por ejemplo, podrías verlas
así:

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.features);
```

lo cual podría imprimir algo como `["texture-compression-astc", "texture-compression-bc"]`, indicándote
que esas características están disponibles si las solicitas.

Aquí está la lista de características disponibles en tu adapter por defecto.

<div class="webgpu_center data-table features" data-diagram="features"></div>

> Nota: Puedes comprobar todas las características y límites de los adapters de tu sistema en [webgpureport.org](https://webgpureport.org).

## Solicitando límites y características

Por defecto, cuando solicitas un device (dispositivo), obtienes los límites mínimos
(la columna de la derecha arriba) y no obtienes ninguna característica opcional. La
esperanza es que, si te mantienes por debajo de los límites mínimos, tu aplicación
funcionará en todos los dispositivos que soporten WebGPU.

Pero, dados los límites y características disponibles listados en el adapter,
puedes solicitarlos cuando llamas a `requestDevice` pasando
tus límites deseados como `requiredLimits` y tus características deseadas como `requiredFeatures`. Por ejemplo:

```js
const k1Gig = 1024 * 1024 * 1024;
const adapter = await navigator.gpu?.requestAdapter();
const device = adapter?.requestDevice({
  requiredLimits: { maxBufferSize: k1Gig },
  requiredFeatures: [ 'float32-filterable' ],
});
```

Arriba estamos solicitando poder usar buffers de hasta 1 GiB y poder usar texturas
float32 filtrables (por ejemplo, `'rgba32float'` con minFilter establecido en `'linear'`, que por defecto solo puede usarse con `'nearest'`).

Si alguna de esas solicitudes no puede cumplirse, `requestDevice` fallará (rechazará la promesa).

## No lo solicites todo

Podría ser tentador pedir todos los límites y características y luego comprobar cuáles necesitas.

Ejemplo:

```js
function objLikeToObj(src) {
  const dst = {};
  for (const key in src) {
    dst[key] = src[key];
  }
  return dst;
}

//
// ¡¡¡MAL!!! ?
//
async function main() {
  const adapter = await navigator?.gpu.requestAdapter();
  const device = await adapter?.requestDevice({
    requiredLimits: objLikeToObj(adapter.limits),
    requiredFeatures: adapter.features,
  });
  if (!device) {
    fail('se necesita webgpu');
    return;
  }

  const canUse128KUniformsBuffers = device.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = device.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = device.features.has('indirect-first-instance');
}
```

Esto parece una forma sencilla y clara de comprobar límites y características[^objliketoobj]. El
problema con este patrón es que podrías estar excediendo límites accidentalmente sin
saberlo. Por ejemplo, supongamos que creaste una textura `'rgba32float'` y la filtraste
con un filtrado `'linear'`.
Simplemente funcionaría "por arte de magia" en tu máquina de escritorio porque resultó que
la habías habilitado.

[^objliketoobj]: ¿Qué es esto de `objLikeToObj` y por qué lo necesito?
Es un problema esotérico de la especificación web. La especificación lista `requiredLimits` como
`record<DOMString, GPUSize64>`. La especificación Web IDL dice que, al convertir
un objeto de algo a `record<DOMString, GPUSize64>`, solo se copien
las propiedades que son realmente propiedades *propias* (own properties) del objeto.
El objeto `limits` en el adapter está listado como una `interfaz`. Las
cosas que parecen ser propiedades allí no son propiedades, son
getters que existen en el prototipo del objeto, no son realmente propiedades
propias del objeto. Por lo tanto, no se copian
cuando se convierten a `record<DOMString, GPUSize64>` y, por lo tanto, tienes que
copiarlas tú mismo.

En el teléfono del usuario, tu programa falla misteriosamente porque la característica `'float32-filterable'`
no existía y resultó que la estabas usando sin darte cuenta de que es
una característica opcional.

O podrías asignar un buffer más grande que el mínimo `maxBufferSize` y, de nuevo,
no ser consciente de que superaste el límite. Lanzas tu aplicación y un montón de usuarios no pueden ejecutar
tu página.

## Forma recomendada de solicitar características y límites

La forma recomendada de usar características y límites es decidir qué es lo que absolutamente
debes tener y solicitar únicamente esos límites.

Por ejemplo:

```js
  const adapter = await navigator?.gpu.requestAdapter();

  const canUse128KUniformsBuffers = adapter?.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = adapter?.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = adapter?.features.has('indirect-first-instance');

  // si necesitamos absolutamente una o más de estas características, fallamos ahora si no están
  // disponibles
  if (!canUse128KUniformsBuffers) {
    alert('Lo sentimos, tu dispositivo probablemente es demasiado antiguo o poco potente');
    return;
  }

  // Solicitar las características y límites disponibles que necesitamos
  const device = adapter?.requestDevice({
    requiredFeatures: [
      ...(canStoreToBGRA8Unorm ? ['bgra8unorm-storage'] : []),
      ...(canIndirectFirstInstance ? ['indirect-first-instance'] : []),
    ],
    requiredLimits: {
      maxUniformBufferBindingSize: 128 * 1024,
    }
  });
```

Haciéndolo de esta manera, si resulta que pides un uniform buffer de más de 128 KiB, obtendrás un error.
Del mismo modo, si intentas usar una característica que no solicitaste, obtendrás un error.
Entonces puedes tomar una decisión consciente de si quieres aumentar tus límites requeridos (y, por lo tanto,
negarte a funcionar en más dispositivos) o si quieres mantener los límites, o si quieres estructurar
tu código para hacer cosas diferentes según si las características o límites están o no disponibles.

<!-- keep this at the bottom of the article -->
<link rel="stylesheet" href="webgpu-limits-and-features.css">
<script type="module" src="webgpu-limits-and-features.js"></script>
