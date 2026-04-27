Title: WGSL de WebGPU
Description: Una introducción al lenguaje de sombreado de WebGPU (WebGPU Shading Language)
TOC: WGSL

Para una visión detallada de WGSL, consulta [Tour of WGSL](https://google.github.io/tour-of-wgsl/).
También está [la especificación real de WGSL](https://www.w3.org/TR/WGSL/), aunque puede ser difícil
de procesar ya que está escrita para [expertos en lenguajes](http://catb.org/jargon/html/L/language-lawyer.html) 😂

Este artículo asume que ya sabes programar, por lo que con solo
mirar los ejemplos de WGSL es probable que puedas captar o *entender* lo que ves. Probablemente sea demasiado
sucinto, pero espero que pueda ayudarte a comprender y escribir programas de
shader en WGSL.

## WGSL es fuertemente tipado

A diferencia de JavaScript, WGSL requiere conocer los tipos de cada variable, campo de estructura (struct),
parámetro de función y tipo de retorno de función. Si has usado TypeScript, Rust, C++, C#,
Java, Swift, Kotlin, etc., entonces estarás acostumbrado a esto.

### tipos simples

Los tipos *simples* (plain types) en WGSL son:

* `i32` un entero de 32 bits con signo
* `u32` un entero de 32 bits sin signo
* `f32` un número de punto flotante de 32 bits
* `bool` un valor booleano
* `f16` un número de punto flotante de 16 bits (esta es una característica opcional que debes verificar y solicitar)

### declaración de variables

En JavaScript puedes declarar variables y funciones así:

```js
var a = 1;
let c = 3;
function d(e) { return e * 2; }
```

En WGSL, la forma completa de estas sería:

```wgsl
var a: f32 = 1;
let c: f32 = 3;
fn d(e: f32) -> f32 { return e * 2; }
```

Lo importante a notar arriba es que hay que añadir `: <tipo>` como `: f32`
para las declaraciones de variables y `-> <tipo>` para las declaraciones de funciones.

### tipos automáticos

WGSL tiene un *atajo* para las variables. Al igual que en TypeScript, si no
declaras el tipo de la variable, automáticamente toma el tipo de
la expresión a la derecha.

```wgsl
fn foo() -> bool { return false; }

var a = 1;     // a es un i32
let b = 2.0;   // b es un f32
var c = 3u;    // c es un u32
var d = foo(); // d es bool
```

### conversión de tipos

Además, ser fuertemente tipado significa que a menudo tienes que convertir tipos.

```wgsl
let a = 1;     // a es un i32
let b = 2.0;   // b es un f32
*let c = a + b; // ERROR: no se puede sumar un i32 a un f32
```

La solución es convertir uno al otro.

```wgsl
let a = 1;     // a es un i32
let b = 2.0;   // b es un f32
let c = f32(a) + b; // ok
```

¡Pero!, WGSL tiene lo que se llama "AbstractInt" (entero abstracto) y "AbstractFloat" (punto flotante abstracto). Puedes
pensar en ellos como números que aún no han decidido su tipo. Estas
son características exclusivas del tiempo de compilación.

```wgsl
let a = 1;            // a es un i32
let b = 2.0;          // b es un f32
*let c = a + b;       // ERROR: no se puede sumar un i32 a un f32
let d = 1 + 2.0;      // d es un f32
```

### sufijos numéricos

```
2i   // i32
3u   // u32
4f   // f32
4.5f // f32
5h   // f16
5.6h // f16
6    // AbstractInt
7.0  // AbstractFloat
```

## `let`, `var` y `const` significan cosas diferentes en WGSL vs. JavaScript

En JavaScript, `var` es una variable con ámbito de función. `let` es una variable con ámbito de bloque. `const` es una variable constante (no se puede cambiar) [^references] con ámbito de bloque.

[^references]: Las variables en JavaScript contienen tipos base como `undefined`, `null`, `boolean`, `number`, `string`, `reference-to-object`.
Puede ser confuso para los nuevos en la programación que `const o = {name: 'foo'}; o.name = 'bar';` funcione porque `o` se declaró como `const`.
El asunto es que `o` es constante. Es una referencia constante al objeto. No puedes cambiar a qué objeto hace referencia `o`. Puedes cambiar el objeto en sí.

En WGSL, todas las variables tienen ámbito de bloque. `var` es una variable que tiene almacenamiento y, por lo tanto, es mutable. `let` es un valor constante.

```wgsl
fn foo() {
  let a = 1;
*  a = a + 1;  // ERROR: a es una expresión constante
  var b = 2;
  b = b + 1;  // ok
}
```

`const` no es una variable, es una constante en tiempo de compilación. No puedes
usar `const` para algo que sucede en tiempo de ejecución.

```wgsl
const one = 1;              // ok
const dos = one * 2;        // ok
const PI = radians(180.0);  // ok

fn add(a: f32, b: f32) -> f32 {
*  const result = a + b;   // ¡ERROR! const solo se puede usar con expresiones en tiempo de compilación
  return result;
}
```

## tipos vectoriales

WGSL tiene 3 tipos de vectores: `vec2`, `vec3` y `vec4`. Su estilo básico es `vec?<tipo>`
así que `vec2<i32>` (un vector de dos i32), `vec3<f32>` (un vector de 3 f32), `vec4<u32>` (un vector de 4 u32),
`vec3<bool>` un vector de 3 valores booleanos.

Ejemplos:

```wgsl
let a = vec2<i32>(1, -2);
let b = vec3<f32>(3.4, 5.6, 7.8);
let c = vec4<u32>(9, 10, 11, 12);
```

### accesores

Puedes acceder a los valores dentro de un vector con varios accesores.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.z;   // vía x,y,z,w
let c = a.b;   // vía r,g,b,a
let d = a[2];  // vía accesores de elementos de array
```

Arriba, `b`, `c` y `d` son lo mismo. Todos están accediendo al tercer elemento de `a`. Todos son '3'.

### swizzles

También puedes acceder a más de un elemento.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = a.zx;   // vía x,y,z,w
let c = a.br;   // vía r,g,b,a
let d = vec2<f32>(a[2], a[0]);
```

Arriba, `b`, `c` y `d` son lo mismo. Todos son un `vec2<f32>(3, 1)`.

También puedes repetir elementos.

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec3<f32>(a.z, a.z, a.y);
let c = a.zzy;
```

Arriba, `b` y `c` son lo mismo. Ambos son `vec3<f32>` cuyo contenido es 3, 3, 2.

### atajos de vectores

Existen atajos para los tipos base. Cambia el `<i32>` => `i`, `<f32>` => `f`, `<u32>` a `u` y `<f16>` a `h`, así:

```wgsl
let a = vec4<f32>(1, 2, 3, 4);
let b = vec4f(1, 2, 3, 4);
```

`a` y `b` son del mismo tipo.

### construcción de vectores

Los vectores se pueden construir con tipos más pequeños.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec2f(2, 3);
let c = vec4f(1, b, 4);
let d = vec4f(1, a.yz, 4);
let e = vec4f(a.xyz, 4);
let f = vec4f(1, a.yzw);
```

`a`, `c`, `d`, `e` y `f` son iguales.

### matemática de vectores

Puedes realizar operaciones matemáticas con vectores.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = a + b;  // c es vec4f(6, 8, 10, 12)
let d = a * b;  // d es vec4f(5, 12, 21, 32)
let e = a - b;  // e es vec4f(-4, -4, -4, -4)
```

Muchas funciones también funcionan con vectores.

```wgsl
let a = vec4f(1, 2, 3, 4);
let b = vec4f(5, 6, 7, 8);
let c = mix(a, b, 0.5);                   // c es vec4f(3, 4, 5, 6)
let d = mix(a, b, vec4f(0, 0.5, 0.5, 1)); // d es vec4f(1, 4, 5, 8)
```

## matrices

WGSL tiene varios tipos de matrices. Las matrices son arrays de vectores.
El formato es `mat<númVectores>x<tamañoVector><<tipo>>`, así por ejemplo
`mat3x4<f32>` es un array de 3 `vec4<f32>`. Al igual que los vectores, las matrices
tienen los mismos atajos:

```wgsl
let a: mat4x4<f32> = ...
let b: mat4x4f = ...
```

`a` y `b` son del mismo tipo.

### acceso a vectores de la matriz

Puedes referenciar un vector de una matriz con la sintaxis de array.

```wgsl
let a = mat4x4f(...);
let b = a[2];   // b es un vec4f del tercer vector de a
```

El tipo de matriz más común para computación 3D es `mat4x4f` y se puede multiplicar directamente
por un `vec4f` para producir otro `vec4f`.

```wgsl
let a = mat4x4f(....);
let b = vec4f(1, 2, 3, 4);
let c = a * b;  // c es un vec4f y el resultado de a * b
```

## arrays

Los arrays en WGSL se declaran con la sintaxis `array<tipo, númElementos>`.

```wgsl
let a = array<f32, 5>;   // un array de cinco f32
let b = array<vec4f, 6>; // un array de seis vec4f
```

Pero también existe el constructor `array`. Toma cualquier número de argumentos
y devuelve un array. Todos los argumentos deben ser del mismo tipo.

```wgsl;
let arrDe3Vec3fsA = array(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
let arrDe3Vec3fsB = array<vec3f, 3>(vec3f(1,2,3), vec3f(4,5,6), vec3f(7,8,9));
```

Arriba, `arrDe3Vec3fsA` es igual a `arrDe3Vec3fsB`.

Desafortunadamente, a partir de la versión 1 de WGSL no hay forma de obtener el tamaño de un
array de tamaño fijo.

### arrays de tamaño en tiempo de ejecución

Los arrays que están en declaraciones de almacenamiento (storage) de ámbito raíz o como el último
campo en un struct de ámbito raíz
son los únicos arrays que pueden especificarse sin tamaño.

```wgsl
struct Cosas {
  color: vec4f,
  size: f32,
  verts: array<vec3f>,
};
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Cosas;
```

El número de elementos en `foo` y en `bar.verts` se define por la configuración
del bind group utilizado en tiempo de ejecución. Puedes consultar este tamaño en tu WGSL con
`arrayLength`.

```wgsl
@group(0) @binding(0) var<storage> foo: array<mat4x4f>;
@group(0) @binding(1) var<storage> bar: Cosas;

...
  let numMatrices = arrayLength(&foo);
  let numVerts = arrayLength(&bar.verts);
```

## funciones

Las funciones en WGSL siguen el patrón `fn nombre(parámetros) -> tipoRetorno { ..cuerpo... }`.

```wgsl
fn add(a: f32, b: f32) -> f32 {
  return a + b;
}
```

## puntos de entrada (entry points)

Los programas WGSL necesitan un punto de entrada (entry point). Un punto de entrada se designa mediante `@vertex`, `@fragment` o `@compute`.

```wgsl
@vertex fn myFunc(a: f32, b: f32) -> @builtin(position): vec4f {
  return vec4f(0, 0, 0, 0);
}
```

## los shaders solo usan aquello a lo que su punto de entrada accede

```wgsl
@group(0) @binding(0) var<uniforms> uni: vec4f;

vec4f fn foo() {
  return uni;
}

@vertex fn vs1(): @builtin(position) vec4f {
  return vec4f(0);
}

@vertex fn vs2(): @builtin(position) vec4f {
  return foo();
}
```

Arriba, `vs1` no accede a `uni`, por lo que no aparecerá como un
binding requerido si usas `vs1` en un pipeline. `vs2` sí referencia a `uni` indirectamente al
llamar a `foo`, por lo que aparecerá como un binding requerido al usar `vs2` en un pipeline.

## atributos (attributes)

La palabra *atributos* (attributes) tiene 2 significados en WebGPU. Uno es *atributos de vértice* (vertex attributes), que se trata en [el artículo sobre buffers de vértices](webgpu-vertex-buffers.html).
El otro es en WGSL, donde un atributo comienza con `@`.

### `@location(número)`

`@location(número)` se utiliza para definir las entradas y salidas de los shaders.

#### entradas del vertex shader

Para un vertex shader (shader de vértices), las entradas se definen mediante los atributos `@location`
de la función del punto de entrada del vertex shader.

```wgsl
@vertex vs1(@location(0) foo: f32, @location(1) bar: vec4f) ...

struct Cosas {
  @location(0) foo: f32,
  @location(1) bar: vec4f,
};
@vertex vs2(s: Cosas) ...
```

Tanto `vs1` como `vs2` declaran entradas para el vertex shader en las ubicaciones (locations) 0 y 1, que deben ser suministradas por [buffers de vértices (vertex buffers)](webgpu-vertex-buffers.html).

#### variables entre etapas (inter-stage variables)

Para las variables entre etapas (inter-stage variables), los atributos `@location` definen la ubicación donde las variables se pasan entre shaders.

```wgsl
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) texcoords: vec2f,
};

struct FSIn {
  @location(1) uv: vec2f,
  @location(0) diffuse: vec4f,
};

@vertex fn foo(...) -> VSOut { ... }
@fragment fn bar(moo: FSIn) ... 
```

Arriba, el vertex shader `foo` pasa `color` como `vec4f` en `location(0)` y `texcoords` como un `vec2f` en `location(1)`.
El fragment shader (shader de fragmentos) `bar` los recibe como `uv` y `diffuse` porque sus ubicaciones coinciden.

#### salidas del fragment shader

Para los fragment shaders, `@location` especifica en qué `GPURenderPassDescriptor.colorAttachment` se debe almacenar el resultado.

```wgsl
struct FSOut {
  @location(0) albedo: vec4f;
  @location(1) normal: vec4f;
}
@fragment fn bar(...) -> FSOut { ... }
```

### `@builtin(nombre)`

El atributo `@builtin` se utiliza para especificar que el valor de una variable en particular proviene
de una característica integrada (built-in) de WebGPU.

```wgsl
@vertex fn vs1(@builtin(vertex_index) foo: u32, @builtin(instance_index) bar: u32) ... {
  ...
}
```

Arriba, `foo` obtiene su valor del builtin `vertex_index` y `bar` obtiene su valor del builtin `instance_index`.

```wgsl
struct Foo {
  @builtin(vertex_index) vNdx: u32,
  @builtin(instance_index) iNdx: u32,
}
@vertex fn vs1(blap: Foo) ... {
  ...
}
```

Arriba, `blap.vNdx` obtiene su valor del builtin `vertex_index` and `blap.iNdx` obtiene su valor del builtin `instance_index`.

<div class="webgpu_center center data-table builtins" style="max-width: 900px;">
<h1>Builtins de Compute Shader</h1>
<table class="data">
  <thead>
    <tr>
      <th>Nombre del Builtin</th>
      <th>E/S</th>
      <th>Tipo</th>
      <th>Descripción </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_id">local_invocation_id</dfn> </td>
      <td>entrada </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">El ID de invocación local de la invocación actual, es decir, su posición en la cuadrícula del workgroup. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-local_invocation_index">local_invocation_index</dfn> </td>
      <td>entrada </td>
      <td>u32 </td>
      <td style="width:50%">El índice de invocación local de la invocación actual, un índice linealizado de la posición de la invocación dentro de la cuadrícula del workgroup. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-global_invocation_id">global_invocation_id</dfn> </td>
      <td>entrada </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">El ID de invocación global de la invocación actual, es decir, su posición en la cuadrícula del compute shader. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-workgroup_id">workgroup_id</dfn> </td>
      <td>entrada </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">El ID de workgroup de la invocación actual, es decir, la posición del workgroup en la cuadrícula del compute shader. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-num_workgroups">num_workgroups</dfn> </td>
      <td>entrada </td>
      <td>vec3&lt;u32&gt; </td>
      <td style="width:50%">El tamaño de despacho (dispatch size), <code>vec&lt;u32&gt;(group_count_x, group_count_y, group_count_z)</code>, del compute shader enviado (dispatched) por la API. </td>
    </tr>
  </tbody>
  </table>
<h1>Builtins de Fragment Shader</h1>
<table class="data">
  <thead>
    <tr>
      <th>Nombre del Builtin</th>
      <th>E/S</th>
      <th>Tipo</th>
      <th>Descripción </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>entrada </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">Posición en el framebuffer del fragmento actual en el espacio del framebuffer. (Los componentes <em>x</em>, <em>y</em>, y <em>z</em> ya han sido escalados de modo que <em>w</em> ahora es 1). Consulta <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-front_facing">front_facing</dfn> </td>
      <td>entrada </td>
      <td>bool </td>
      <td style="width:50%">True cuando el fragmento actual está en una primitiva que mira hacia adelante (<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#front-facing" id="ref-for-front-facing">front-facing</a>). False en caso contrario. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-frag_depth">frag_depth</dfn> </td>
      <td>salida </td>
      <td>f32 </td>
      <td style="width:50%">Profundidad actualizada del fragmento, en el rango de profundidad del viewport. Consulta <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_index">sample_index</dfn> </td>
      <td>entrada </td>
      <td>u32 </td>
      <td style="width:50%">Índice de muestra (sample index) para el fragmento actual. El valor es como mínimo 0 y como máximo <code>sampleCount</code>-1, donde <code>sampleCount</code> es el conteo de muestras MSAA especificado para el pipeline de renderizado de la GPU. <br>Consulta <a href="https://www.w3.org/TR/webgpu/#gpurenderpipeline"><cite>WebGPU</cite> § 10.3 GPURenderPipeline</a>. </td>
    </tr>
    <tr>
      <td rowspan="2"><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-sample_mask">sample_mask</dfn> </td>
      <td>entrada </td>
      <td>u32 </td>
      <td style="width:50%">Máscara de cobertura de muestras (sample coverage mask) para el fragmento actual. Contiene una máscara de bits que indica qué muestras en este fragmento están cubiertas por la primitiva que se está renderizando. <br>Consulta <a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
    <tr>
      <td>salida </td>
      <td>u32 </td>
      <td style="width:50%">Control de máscara de cobertura de muestras para el fragmento actual. El último valor escrito en esta variable se convierte en la máscara de salida del shader (<a data-link-type="dfn" href="https://gpuweb.github.io/gpuweb/#shader-output-mask" id="ref-for-shader-output-mask">shader-output mask</a>). Los bits en cero en el valor escrito harán que se descarten las muestras correspondientes en los color attachments. <br>Consulta <a href="https://www.w3.org/TR/webgpu/#sample-masking"><cite>WebGPU</cite> § 23.3.11 Sample Masking</a>. </td>
    </tr>
  </tbody>
</table>
<h1>Builtins de Vertex Shader</h1>
<table class="data">
  <thead>
    <tr>
      <th>Nombre del Builtin</th>
      <th>E/S</th>
      <th>Tipo</th>
      <th>Descripción </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-vertex_index">vertex_index</dfn> </td>
      <td>entrada </td>
      <td>u32 </td>
      <td style="width:50%">
       Índice del vértice actual dentro del comando de dibujo actual a nivel de API, independiente del instanciado (draw instancing). 
       <p>Para un dibujo no indexado, el primer vértice tiene un índice igual al argumento <code>firstVertex</code> del dibujo, ya sea proporcionado directa o indirectamente.
         El índice se incrementa en uno por cada vértice adicional en la instancia de dibujo.</p>
       <p>Para un dibujo indexado, el índice es igual a la entrada del buffer de índices para el vértice, más el argumento <code>baseVertex</code> del dibujo, ya sea proporcionado directa o indirectamente.</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-instance_index">instance_index</dfn> </td>
      <td>entrada </td>
      <td>u32 </td>
      <td style="width:50%">
       Índice de instancia del vértice actual dentro del comando de dibujo actual a nivel de API. 
       <p>La primera instancia tiene un índice igual al argumento <code>firstInstance</code> del dibujo, ya sea proporcionado directa o indirectamente.
         El índice se incrementa en uno por cada instancia adicional en el dibujo.</p></td>
    </tr>
    <tr>
      <td><dfn class="dfn-paneled" data-dfn-for="built-in values" data-dfn-type="dfn" data-noexport="" id="built-in-values-position">position</dfn> </td>
      <td>salida </td>
      <td>vec4&lt;f32&gt; </td>
      <td style="width:50%">Posición de salida del vértice actual, utilizando coordenadas homogéneas. Después de la normalización homogénea (donde cada uno de los componentes <em>x</em>, <em>y</em>, y <em>z</em> se divide por el componente <em>w</em>), la posición se encuentra en el espacio de coordenadas de dispositivo normalizadas (normalized device coordinate space) de WebGPU. Consulta <a href="https://www.w3.org/TR/webgpu/#coordinate-systems"><cite>WebGPU</cite> § 3.3 Coordinate Systems</a>. </td>
    </tr>
  </tbody>
  </table>
</div>

Es importante notar aquí que no hay un solo builtin llamado `position`. Hay 2 builtins, una salida llamada `position` utilizada
en los vertex shaders, y una entrada llamada `position` utilizada en los fragment shaders. Esto no es diferente a tener 2 funciones en JavaScript:

```js
/**
 * función que tiene position como salida
 * @param \{{array: number[], index: number, position: Float32Array}} params
 */
function getVertex(params) {
  const { array, index, position } = params;
  position[0] = array[index];
  position[1] = array[index + 1];
  position[2] = array[index + 2];
}

/**
 * función que tiene position como entrada
 * @param \{{position: Float32Array}} params
 */
function printValue(params) {
  const { position } = params;
  return [...position].map(v => v.toString()).join(', ');
}
```

Arriba hay 2 funciones que tienen un parámetro llamado `position`. No tienen relación entre sí.
Lo mismo ocurre con `@builtin(position)` en un vertex shader y `@builtin(position)` en un fragment shader.
Ambos no tienen relación entre sí. La confusión suele venir del hecho de que se puede usar una única declaración de struct
en un mismo módulo de shader.

```wgsl
struct VOut {
  @builtin(position) p: vec4f;
};

@vertex fn vs() -> VOut {
  // esto está configurando el @builtin(position) del vertex shader
  return VOut(vec4f(0, 0, 0, 1));
}

@fragment fn fs(v: VOut) {
  // esto está leyendo el @builtin(position) del fragment shader
  return v.p;
}
```

Desde el punto de vista de WGSL, `VOut` se declara dos veces. Una vez cuando se usa en `vs` y otra en `fs`.

Para ver esto más claramente, podrías declarar estos shaders en módulos separados.

```wgsl
struct VOut {
  @builtin(position) p: vec4f;
};

@vertex fn vs() -> VOut {
  // esto está configurando el @builtin(position) del vertex shader
  return VOut(vec4f(0, 0, 0, 1));
}
```

```wgsl
struct VIn {
  @builtin(position) fragPosition: vec4f;
};

@fragment fn fs(v: VIn) {
  // esto está leyendo el @builtin(position) del fragment shader
  return v.fragPosition;
}
```

Estos 2 módulos de shader, combinados en un render pipeline, son equivalentes al
anterior declarado en un solo módulo.

La ventaja de que ambos se llamen `position` es que permite usarlos en el mismo
módulo de shader. Si no fuera así, estarías obligado a declarar un struct diferente
para la salida del vertex shader y para la entrada del fragment shader.

## control de flujo

Como la mayoría de los lenguajes informáticos, WGSL tiene sentencias de control de flujo.

### for

```wgsl
  for (var i = 0; i < 10; i++) { ... }
```

### if

```wgsl
    if (i < 5) {
      ...
    } else if (i > 7) {
      ..
    } else {
      ...
    }
```

### while

```wgsl
  var j = 0;
  while (j < 5) {
    ...
    j++;
  }
```

### loop

```wgsl
  var k = 0;
  loop {
    k++;
    if (k >= 5) {
      break;
    }
  }
```

### break

```wgsl
  var k = 0;
  loop {
    k++;
    if (k >= 5) {
      break;
    }
  }
```

### break if

```wgsl
  var k = 0;
  loop {
    k++;
    break if (k >= 5);
  }
```

### continue

```wgsl
  for (var i = 0; i < 10; ++i) {
    if (i % 2 == 1) {
      continue;
    }
    ...
  }
```

### continuing

```wgsl
  for (var i = 0; i < 10; ++i) {
    if (i % 2 == 1) {
      continue;
    }
    ...

    continuing {
      // aquí va el continue
      ...
    }
  }
```

### discard

```wgsl
    if (v < 0.5) {
      discard;
    }
```

`discard` sale del shader. Solo se puede usar en un fragment shader.

### switch

```wgsl
var a : i32;
let x : i32 = generateValue();
switch x {
  case 0: {      // Los dos puntos son opcionales
    a = 1;
  }
  default {      // El default no tiene por qué aparecer al final
    a = 2;
  }
  case 1, 2, {   // Se pueden usar múltiples valores de selección
    a = 3;
  }
  case 3, {      // La coma final es opcional
    a = 4;
  }
  case 4 {
    a = 5;
  }
}
```

`switch` solo funciona con `u32` o `i32` y los casos deben ser constantes.

## Operadores

<div class="webgpu_center center data-table">
<table class="data">
  <thead>
    <tr>
      <th>Nombre </th>
      <th>Operadores </th>
      <th>Asociatividad </th>
      <th>Prioridad (Binding) </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Paréntesis </td>
      <td><code>(...)</code> </td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Primarios </td>
      <td><code>a()</code>, <code>a[]</code>, <code>a.b</code> </td>
      <td>Izquierda a derecha </td>
      <td></td>
    </tr>
    <tr>
      <td>Unarios </td>
      <td><code>-a</code>, <code>!a</code>, <code>~a</code>, <code>*a</code>, <code>&amp;a</code> </td>
      <td>Derecha a izquierda </td>
      <td>Todos los anteriores </td>
    </tr>
    <tr>
      <td>Multiplicativos </td>
      <td><code>a * b</code>, <code>a / b</code>, <code>a % b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Todos los anteriores </td>
    </tr>
    <tr>
      <td>Aditivos </td>
      <td><code>a + b</code>, <code>a - b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Todos los anteriores </td>
    </tr>
    <tr>
      <td>Desplazamiento </td>
      <td><code>a &lt;&lt; b</code>, <code>a &gt;&gt; b</code> </td>
      <td>Requiere paréntesis </td>
      <td>Unarios </td>
    </tr>
    <tr>
      <td>Relacionales </td>
      <td><code>a &lt; b</code>, <code>a &gt; b</code>, <code>a &lt;= b</code>, <code>a &gt;= b</code>, <code>a == b</code>, <code>a != b</code> </td>
      <td>Requiere paréntesis </td>
      <td>Todos los anteriores </td>
    </tr>
    <tr>
      <td>AND binario </td>
      <td><code>a &amp; b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Unarios </td>
    </tr>
    <tr>
      <td>XOR binario </td>
      <td><code>a ^ b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Unarios </td>
    </tr>
    <tr>
      <td>OR binario </td>
      <td><code>a | b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Unarios </td>
    </tr>
    <tr>
      <td>AND de cortocircuito </td>
      <td><code>a &amp;&amp; b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Relacionales </td>
    </tr>
    <tr>
      <td>OR de cortocircuito </td>
      <td><code>a || b</code> </td>
      <td>Izquierda a derecha </td>
      <td>Relacionales </td>
    </tr>
  </tbody>
</table>
</div>

## funciones integradas (builtin)

Consulta la [referencia de funciones de WGSL](webgpu-wgsl-function-reference.html).

## Diferencias con otros lenguajes

### las expresiones `if`, `while`, `switch`, `break-if` no necesitan paréntesis.

```wgsl
if a < 5 {
  doTheThing();
}
```

### no hay operador ternario

Muchos lenguajes tienen un operador ternario `condicion ? expresionVerdadera : expresionFalsa`.
WGSL no lo tiene. Pero WGSL tiene `select`.

```wgsl
  let a = select(expresionFalsa, expresionVerdadera, condicion);
```

### `++` y `--` son sentencias, no expresiones.

Muchos lenguajes tienen operadores de *pre-incremento* y *post-incremento*.

```js
// JavaScript
let a = 5;
let b = a++;  // b = 5, a = 6  (post-incremento)
let c = ++a;  // c = 7, a = 7  (pre-incremento)
```

WGSL no tiene ninguno de los dos. Solo tiene las sentencias de incremento y decremento.

```wgsl
// WGSL
var a = 5;
a++;          // ahora es 6
*++a;          // ERROR: no existe el pre-incremento
*let b = a++;  // ERROR: a++ no es una expresión, es una sentencia
```

## `+=`, `-=` no son expresiones, son sentencias de asignación

```js
// JavaScript
let a = 5;
a += 2;          // a = 7
let b = a += 2;  // a = 9, b = 9
```

```wgsl
// WGSL
var a = 5;
a += 2;           // a es 7
*let b = a += 2;  // ERROR: a += 2 no es una expresión
```

## Los swizzles no pueden aparecer a la izquierda

Esto ocurre en algunos lenguajes, pero no en WGSL.

```
var color = vec4f(0.25, 0.5, 0.75, 1);
*color.rgb = color.bgr; // ERROR
color = vec4(color.bgr, color.a);  // Ok
```

Nota: hay una propuesta para añadir esta característica.

## Asignación falsa (phony assignment) a `_`

`_` es una variable especial a la que puedes asignar algo para que parezca usado, pero sin usarlo realmente.

```wgsl
@group(0) @binding(0) var<uniforms> uni1: vec4f;
@group(0) @binding(1) var<uniforms> uni2: mat4x4f;

@vertex fn vs1(): @builtin(position) vec4f {
  return vec4f(0);
}

@vertex fn vs2(): @builtin(position) vec4f {
  _ = uni1;
  _ = uni2;
  return vec4f(0);
}
```

Arriba, ni `uni1` ni `uni2` son accedidos por `vs1`, por lo que no aparecerán como
bindings requeridos si usas `vs1` en un pipeline. `vs2` sí referencia tanto a `uni1` como a `uni2`,
por lo que ambos aparecerán como bindings requeridos al usar `vs2` en un pipeline.

<p class="copyright" data-fill-with="copyright">  <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>

<!-- keep this at the bottom of the article -->
<link href="webgpu-wgsl.css" rel="stylesheet">
