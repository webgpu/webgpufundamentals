# Fundamentos de WebGPU

Esta es [una serie de lecciones o tutoriales sobre WebGPU](http://webgpufundamentals.org/webgpu/lessons/es/).

Este es un trabajo en progreso. Siéntete libre de contribuir, especialmente con las localizaciones (traducciones).

- [English](README.md)
- [简体中文](README.zh-CN.md)
- [한국어](README.ko.md)

## Cómo contribuir

Por supuesto, las correcciones de errores siempre son bienvenidas.

Si deseas escribir un artículo nuevo, por favor intenta hacerlo siempre paso a paso. No hagas 2 o más cosas en un solo paso. Explica cualquier concepto matemático nuevo en los términos más sencillos posibles. Idealmente con diagramas donde sea posible. También es mejor preguntar para asegurarse de que nadie más esté trabajando ya en un artículo similar.

### Traducir

Cada traducción va en una carpeta bajo `webgpu/lessons/<código-de-país>`.

Los archivos requeridos son:

    langinfo.hanson
    index.md
    toc.html

#### `langinfo.hanson`

Define varias opciones específicas del idioma.
[Hanson](https://github.com/timjansen/hanson) es un formato similar a JSON pero permite comentarios.

Los campos actuales son:

```hanson
{
  // El idioma (aparecerá en el menú de selección de idioma)
  language: 'Español',

  // Frase que aparece debajo de los ejemplos
  defaultExampleCaption: "haz clic aquí para abrir en una ventana separada",

  // Título que aparece en cada página
  title: 'Fundamentos de WebGPU',

  // Descripción básica que aparece en cada página
  description: 'Aprende WebGPU',

  // Enlace a la raíz del idioma.
  link: 'http://webgpufundamentals.org/webgpu/lessons/es',

  // html que aparece después del artículo y antes de los comentarios
  commentSectionHeader: '<div>¿Preguntas? <a href="http://stackoverflow.com/questions/tagged/webgpu">Pregunta en stackoverflow</a>.</div>\n        <div>¿Problema/Bug? <a href="http://github.com/webgpu/webgpufundamentals/issues">Crea un issue en github</a>.</div>',

  // markdown que aparece para artículos no traducidos
  missing: "Lo sentimos, este artículo aún no ha sido traducido. ¡[Las traducciones son bienvenidas](https://github.com/webgpu/webgpufundamentals)! 😄\n\n[Aquí está el artículo original en inglés por ahora]({{{origLink}}}).",

  // la frase "Tabla de Contenidos"
  toc: "Tabla de Contenidos",

  // traducción de categorías
  categoryMapping: {
    'basics': 'Conceptos básicos',
    'solutions': 'Soluciones',
    'webvr': 'WebVR',
    'optimization': 'Optimización',
    'tips': 'Consejos',
    'fundamentals': 'Fundamentos',
    'reference': 'Referencia',
  },
}
```

#### `index.md`

Esta es la plantilla para la página principal de cada idioma.

#### `toc.html`

Esta es la plantilla para la tabla de contenidos del idioma. Se incluye tanto en el índice como en cada artículo. Las únicas partes que no se generan automáticamente son los enlaces finales que puedes traducir si lo deseas.
El sistema de build creará un marcador de posición (placeholder) para cada artículo en inglés para el cual no haya un artículo correspondiente en ese idioma. Se rellenará con el mensaje `missing` de arriba.

#### `lang.css`

Este se incluye si y solo si existe. Preferiría fuertemente no tener que usarlo. En particular, no quiero que la gente entre en discusiones sobre fuentes, pero básicamente es una forma de elegir las fuentes por idioma. Solo debes establecer las variables que sean absolutamente necesarias. Ejemplo:

```css
/* lessons/es/lang.css */

/* ¡Solo comenta los cambios que sean absolutamente necesarios! */
:root {
  --article-font-family: "la mejor fuente para el texto de los artículos en español";
  --headline-font-family: "la mejor fuente para los titulares en español";
  /* un bloque de código */
  /* --code-block-font-family: "Lucida Console", Monaco, monospace; */
  /* una palabra en una oración */
  /* --code-font-family: monospace; */
}
```

Observa que hay 2 configuraciones que no se han cambiado. Me parece poco probable que el código necesite una fuente diferente por idioma.

PD: Ya que estamos aquí, me encantan las fuentes de código con ligaduras, pero parecen una mala idea para un sitio de tutoriales porque las ligaduras ocultan los caracteres reales necesarios, así que, por favor, no pidas ni uses una fuente de código con ligaduras aquí.

#### Notas de traducción

El proceso de build creará un archivo html de marcador de posición para cada artículo que tenga un archivo .md en inglés en `webgpu/lessons` pero no tenga el archivo .md correspondiente para el idioma. Esto es para facilitar la inclusión de enlaces en un artículo que apunten a otro artículo, incluso si ese otro artículo aún no ha sido traducido. De esta manera, no tienes que volver atrás y arreglar artículos ya traducidos. Simplemente traduce un artículo a la vez y deja los enlaces como están. Enlazarán a los marcadores de posición hasta que alguien traduzca los artículos faltantes.

Los artículos tienen front matter en la parte superior:

```
Title: Título localizado del artículo
Description: Descripción localizada del artículo (usada en RSS y etiquetas de redes sociales)
TOC: Texto localizado para la Tabla de Contenidos
```

**NO CAMBIES LOS ENLACES**: Por ejemplo, un enlace a recursos locales podría verse así:

    [texto](enlace)

o

    <img src="algun_enlace">

Aunque puedes añadir parámetros de consulta (ver abajo), no añadas "../" para intentar que el enlace sea relativo al archivo .md. Los enlaces deben permanecer como si el artículo existiera en la misma ubicación que el original en inglés.

### Filosofía y Reglas de Traducción al español

Para mantener la consistencia en la versión en español, seguimos estas directrices:

#### Qué se traduce
- El texto explicativo y los comentarios en fragmentos de pseudocódigo.
- Los campos `Title:`, `Description:` y `TOC:` (excepto si contienen términos técnicos estándar).
- Los textos interactivos de la interfaz de usuario (ej: "arrastra los vértices").

#### Qué NO se traduce (Términos Técnicos)
Para evitar confusión con la API real de WebGPU y la jerga de la industria, **no traducimos** los siguientes términos:
- **Objetos de la API**: buffer, bind group, bind group layout, pipeline, render pipeline, compute pipeline, sampler, encoder.
- **Conceptos de memoria**: storage buffer, vertex buffer, uniform buffer, staging buffer, offset, stride.
- **Técnicas y Texturas**: cubemap, environment map, skybox, mipmap, post-processing, compute shader.
- **Código**: Nombres de funciones, variables y atributos en JS, WGSL, HTML o CSS.

#### Estilo y Tono
- Usamos un **español neutro e internacional** (evitando regionalismos).
- El tono es **didáctico e informal**, dirigiéndonos al lector de "tú" (como el "you" original).
- En la primera mención de un término técnico complejo, se puede incluir una traducción literal entre paréntesis, pero luego se usa siempre el término en inglés. Ejemplo: "...usaremos un **storage buffer** (buffer de almacenamiento)..."

#### Integridad Estructural
- **Paridad de Enlaces**: Los enlaces internos deben ser idénticos al original. Si el original tiene un error en un enlace, la traducción debe mantenerlo para evitar fallos en el sistema de build.
- **Sin HTML extra**: No añadir etiquetas `<script>`, `<style>` o `<img>` que no existan en el original.

### Cómo construir

El sitio se construye en la carpeta `out`.

Pasos:

    git clone https://github.com/webgpu/webgpufundamentals.git
    npm ci
    npm run build
    npm run serve

Ahora abre tu navegador en `http://localhost:8080`.

### Construcción continua

Puedes ejecutar `npm run start` para obtener una construcción continua. Solo se admiten los archivos .md de artículos que existan en el momento en que ejecutas el comando y los archivos que normalmente se copian. La tabla de contenidos, las plantillas y las páginas de índice no son vigiladas.

### Desarrollo

Si estás trabajando en la actualización de dependencias con `npm link`, puedes usar `npm run build-ci` y/o `npm run watch-no-check` para omitir la verificación de dependencias.

## Construyendo la Referencia de Funciones WGSL

La [referencia de funciones WGSL](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html) se genera actualmente de forma automática para el inglés escaneando de manera un tanto rudimentaria el HTML de la especificación. "Rudimentaria" significa que es probable que se rompa, pero funciona en su mayor parte o al menos parece proporcionar algo útil, por ahora.

Para escanear la última especificación de nuevo, usa `npm run generate-wgsl-function-reference` y luego comprueba que funcionó (construye y mira la página). En particular, comprueba que los corchetes angulares como `vec4<f32>` existan donde deberían y también comprueba que las secciones `<pre>` como en `textureGather` estén correctamente formateadas.

Para otros idiomas, probablemente necesitarás copiar el archivo en inglés y traducirlo.
