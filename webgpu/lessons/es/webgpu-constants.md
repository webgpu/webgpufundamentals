Title: Constantes de Shader en WebGPU
Description: Los fundamentos de WebGPU
TOC: Constantes

No estoy seguro de si este tema merece ser considerado una entrada para el shader.
Pero, desde cierto punto de vista lo es, así que vamos a cubrirlo.

Las constantes, o más formalmente, las *constantes de pipeline modificables* (pipeline-overridable constants) son un tipo de constante que declaras en tu shader pero que puedes cambiar cuando usas ese shader para crear un pipeline.

Un ejemplo sencillo sería algo como esto:

```wgsl
override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

Usando este fragment shader (shader de fragmentos) con el vertex shader (shader de vértices) del [artículo sobre los conceptos básicos](webgpu-fundamentals.html):

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // centro arriba
    vec2f(-0.5, -0.5),  // abajo izquierda
    vec2f( 0.5, -0.5)   // abajo derecha
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
```

Ahora, si usamos este shader tal cual, obtendremos un triángulo negro:

{{{example url="../webgpu-constants.html"}}}

Pero podemos cambiar esas constantes, o "modificarlas" (override), cuando especificamos el pipeline.

```js
  const pipeline = device.createRenderPipeline({
    label: 'nuestro pipeline de triángulo hardcodeado',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
+      constants: {
+        red: 1,
+        green: 0.5,
+        blue: 1,
+      },
    },
  });
```

Y ahora obtenemos un color rosado.

{{{example url="../webgpu-constants-override.html"}}}

Las constantes de pipeline modificables solo pueden ser valores escalares, es decir, booleanos (true/false), enteros o números de punto flotante. No pueden ser vectores ni matrices.

Si no especificas un valor en el shader, entonces **debes** proporcionar uno en el pipeline. También puedes asignarles un ID numérico y luego referirte a ellas por su ID.

Ejemplo:

```wgsl
override red: f32;             // Debe especificarse en el pipeline
@id(123) override green = 0.0; // Puede especificarse por 'green' o por 123
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

Quizás te preguntes, ¿cuál es el punto? Podría hacer esto con la misma facilidad cuando creo el WGSL. Por ejemplo:

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
const red = ${red};
const green = ${green};
const blue = ${blue};

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
`;
```

Or incluso más directamente:

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(${red}, ${green}, ${blue}, 1.0);
}
`;
```

La diferencia es que las constantes de pipeline modificables se pueden aplicar DESPUÉS de que se haya creado el shader module (módulo de shader), lo que las hace técnicamente más rápidas de aplicar que crear un nuevo módulo de shader. Sin embargo, crear un pipeline no es una operación rápida, por lo que no está claro cuánto tiempo ahorra esto en el proceso general de creación de un pipeline. No obstante, es posible que la implementación de WebGPU pueda usar información de la primera vez que creaste un pipeline con ciertas constantes para que, la próxima vez que lo crees con constantes diferentes, se realice mucho menos trabajo.

En cualquier caso, es una forma de introducir una pequeña cantidad de datos en un shader.

## Los entry points se evalúan de forma independiente

También es importante recordar que los entry points (puntos de entrada) se evalúan de forma aislada, como se cubrió parcialmente en [el artículo sobre variables entre etapas](webgpu-inter-stage-variables.html#a-builtin-position).

Es como si el código pasado a `createShaderModule` fuera despojado de todo lo que no sea relevante para el punto de entrada actual. Se aplican las constantes de modificación del pipeline y, luego, se crea el shader para ese punto de entrada.

Ampliemos nuestro ejemplo anterior. Cambiaremos el shader para que tanto la etapa de vértice (vertex stage) como la de fragmento (fragment stage) usen las constantes. Pasaremos el valor de la etapa de vértice a la etapa de fragmento. Luego, dibujaremos cada otra franja vertical de 50 píxeles con un valor u otro.

```wgsl
+struct VOut {
+  @builtin(position) pos: vec4f,
+  @location(0) color: vec4f,
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
-) -> @builtin(position) vec4f {
+) -> VOut {
  let pos = array(
    vec2f( 0.0,  0.5),  // centro arriba
    vec2f(-0.5, -0.5),  // abajo izquierda
    vec2f( 0.5, -0.5)   // abajo derecha
  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return VOut(
+    vec4f(pos[vertexIndex], 0.0, 1.0),
+    vec4f(red, green, blue, 1),
+  );
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;

-@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(red, green, blue, 1.0);
+@fragment fn fs(v: VOut) -> @location(0) vec4f {
+  let colorFromVertexShader = v.color;
+  let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
+  // seleccionamos un color u otro cada 50 píxeles
+  return select(
+    colorFromVertexShader,
+    colorFromFragmentShader,
+    v.pos.x % 100.0 > 50.0);
}
```

Ahora pasaremos constantes diferentes a cada punto de entrada:

```js
  const pipeline = device.createRenderPipeline({
    label: 'nuestro pipeline de triángulo hardcodeado',
    layout: 'auto',
    vertex: {
      module,
+      constants: {
+        red: 1,
+        green: 1,
+        blue: 0,
+      },
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

El resultado muestra que las constantes fueron diferentes en cada etapa:

{{{example url="../webgpu-constants-override-set-entry-points.html"}}}

Nuevamente, funcionalmente, el hecho de que hayamos usado un módulo de shader con un único `code` WGSL es solo una conveniencia. El código anterior es funcionalmente equivalente a:

```js
  const vertexModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VOut {
        let pos = array(
          vec2f( 0.0,  0.5),  // centro arriba
          vec2f(-0.5, -0.5),  // abajo izquierda
          vec2f( 0.5, -0.5)   // abajo derecha
        );

        return VOut(
          vec4f(pos[vertexIndex], 0.0, 1.0),
          vec4f(red, green, blue, 1),
        );
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;
    `,
  });

  const fragmentModule = device.createShaderModule({
    code: /* wgsl */ `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;

      @fragment fn fs(v: VOut) -> @location(0) vec4f {
        let colorFromVertexShader = v.color;
        let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
        // seleccionamos un color u otro cada 50 píxeles
        return select(
          colorFromVertexShader,
          colorFromFragmentShader,
          v.pos.x % 100.0 > 50.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'nuestro pipeline de triángulo hardcodeado',
    layout: 'auto',
    vertex: {
*      module: vertexModule,
      constants: {
        red: 1,
        green: 1,
        blue: 0,
      },
    },
    fragment: {
*      module: fragmentModule,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

{{{example url="../webgpu-constants-override-separate-modules.html"}}}

Nota: **No** es común usar constantes de pipeline modificables para pasar un color. Usamos un color porque es fácil de entender y para mostrar los resultados.
