Title: WebGPU Inter-stage Переменные
Description: Взаимодействие данных из vertex shader'a в fragment shader
TOC: Inter-stage Переменные

В [предыдущей статье](webgpu-fundamentals.html), мы изучили немного самых базовых вещей об WebGPU. 
В этой статье мы изучим *основы* inter-stage переменных.
Слово inter-stage правильнее всего перевести как *межэтапные*

Inter-stage переменные работают вместе с vertex shader'ми и fragment shader´ми.

Vertex shader выдает три позиции для растеризации треугольника. Также он может выдавать дополнительные данные для каждой из этих точек. Эти значения будут интерполированны между этими тремя точками. Интерполяция - нахождение средних значений между двумя точками.

Давайте сделаем небольшой пример. Мы начнем с шейдера треугольника из предыдущий статьи. Все что нам нужно сделать - изменить шейдер.

```js
  const module = device.createShaderModule({
-    label: 'our hardcoded red triangle shaders',
+    label: 'our hardcoded rgb triangle shaders',
    code: `
+      struct OurVertexShaderOutput {
+        @builtin(position) position: vec4f,
+        @location(0) color: vec4f,
+      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
+        var color = array<vec4f, 3>(
+          vec4f(1, 0, 0, 1), // red
+          vec4f(0, 1, 0, 1), // green
+          vec4f(0, 0, 1, 1), // blue
+        );

-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
      }

-      @fragment fn fs() -> @location(0) vec4f {
-        return vec4f(1, 0, 0, 1);
+      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+        return fsInput.color;
      }
    `,
  });
```

Сначала мы создаем `struct`. Это простой способ создания inter-stage переменных между vertex shader'ом и fragment shader'ом.

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

Далее мы говорим vertex shader'у вернуть эту структуру.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

Мы создаем массив с тремя цветами.

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // red
          vec4f(0, 1, 0, 1), // green
          vec4f(0, 0, 1, 1), // blue
        );
```

И далее вместо того, чтобы вернуть просто `vec4f` для позиции мы возвращаем экземпляр этой структуры с заполненными данными.

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

В fragment shader'е мы говорим взять одну из этих структур в качестве аргумента для функции.

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

И просто возвращаем цвет.

Если мы запустим проект, то увидим, что каждый раз, когда видеокарта вызывает наш fragment shader, то треугольник окрашивается, которые интерполированны между этими тремя точками.

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

Inter-stage переменные - это самый частый способ интерполировать координаты текстуры через треугольник. Мы изучим это в [статье о текстурах](webgpu-textures.html).
Также интерполяцию используют для создания карты нормалей ( interpolating normals ) через треугольник. Мы изучим это в [первой статье об освещении](webgpu-lighting-directional.html).

## Inter-stage переменные работают через `location`

Важно понимать, что почти все в WebGPU работает через vertex shader и fragment shader через индексы. Для inter-stage переменный они соединяются по location индексу.

Чтобы обьяснить это давайте поменяем fragment shader и поставим `vec4f` параметр в `location(0)` вместо этой структуры.

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

Запускаем и видим, что все работает.

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## <a id="a-builtin-position"></a> `@builtin(position)`

Это отмечает одну особенность. Наш шейдер, который использует те же самые структуры в обоих шейдерах имеет поле, которое называется `position`, но у него нету location, потому что он возвращает его через `@builtin(position)`.

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

Это поле **НЕ** является inter-stage переменной. Переменная находится в `builtin`. Это показывает, что `@builtin(position)` имеет другое представление в vertex shader'е и fragment shader'е.

В vertex shader'e `@builtin(position)` это значит, что видеокарте надо нарисовать треугольники/линии/точки.

В fragment shader'e `@builtin(position)` является параметром. Данный параметр - координата пикселя для которой будут происходить расчеты цвета.

Координаты пикселя являются уникальными для каждой точки. Эти значение передаются в fragment shader как координаты центра пикселя.

Если бы текстура, которую мы рисовали имела бы размер 3 на 2 пикселя, то эти точки были бы координатами.

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

Мы можем поменять наш шейдер, чтобы использовать эти позиции. Для примера, давайте нарисуем шахматную доску.

```js
  const module = device.createShaderModule({
    label: 'our hardcoded checkerboard triangle shaders',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
-        @location(0) color: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
-        var color = array<vec4f, 3>(
-          vec4f(1, 0, 0, 1), // red
-          vec4f(0, 1, 0, 1), // green
-          vec4f(0, 0, 1, 1), // blue
-        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-        return fsInput.color;
+        let red = vec4f(1, 0, 0, 1);
+        let cyan = vec4f(0, 1, 1, 1);
+
+        let grid = vec2u(fsInput.position.xy) / 8;
+        let checker = (grid.x + grid.y) % 2 == 1;
+
+        return select(red, cyan, checker);
      }
    `,
  });
```

Код выше получает `fsInput.position`, которая является `@builtin(position)` и конвертирует `xy` координаты в `vec2u`, которые являются двумя целочисленными числами со знаком. Он может делить их на восемь и отдавать нам увеличенное значение каждых восьми пикселей. 
Также это добавляет `x` и `y` сетку координат вместе, которые расчитываются в модуле 2 и сравнивает результаты с единицей. 
Это будет нам возвращать булевую переменную, которая будет либо true либо false для каждого числа. 
Наконец-то, мы используем WGSL функцию `select`, которая берет два значение и выбирает одно. которое соответствует условию. 
В JavaScript'e `select` функцию мы пишем так

```js
// Если условие равно false - вернется `a`, а в ином случае вернется `b`
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

Но если вы не используете `@builtin(position)` в fragment shader'e, то есть становится удобнее, так как это значит, что мы можем использовать одну и ту же структуры для обоих шейдеров. Важно подметить, что `position` в структуре в каждом шейдере не связаны. Это абсолютно разные переменные.

Хотя как выше указано - в inter-stage переменных все завязано на `@location(?)`.
Получается, что это довольно непривычно создавать разные структуры для обоих шейдеров.

Для того, чтобы улучшить это нужно понимать, что оба шейдера находиться в одном файле ( если отталкиваться от примера, то правильнее сказать *в одной строке* ) и это сделанно ради удобства.
В будущем мы разобьем их на разные модули

```js
-  const module = device.createShaderModule({
-    label: 'hardcoded checkerboard triangle shaders',
+  const vsModule = device.createShaderModule({
+    label: 'hardcoded triangle',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        return vsOutput;
      }
+    `,
+  });
+
+  const fsModule = device.createShaderModule({
+    label: 'checkerboard',
+    code: `
-      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+      @fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);

-        let grid = vec2u(fsInput.position.xy) / 8;
+        let grid = vec2u(pixelPosition.xy) / 8;
        let checker = (grid.x + grid.y) % 2 == 1;

        return select(red, cyan, checker);
      }
    `,
  });
```

И нам нужно обновить наше создание pipeline для того, чтобы использовать это

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
    },
    fragment: {
-      module,
+      module: fsModule,
      targets: [{ format: presentationFormat }],
    },
  });

```

И это будет работать

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

Следует подчеркнуть, что оба шейдера находятся в одной строке, но для большинства примеров WebGPU это сделано чисто для удобства. 
В реальных проектах WebGPU парсит WGSL, чтобы удоствореться в правильности написания шейдера. Далее, WebGPU ищет `entryPoint`
в шейдере. Здесь, он ищет части где entryPoint ссылается на что-либо и ничего другого. Это удобно, потому-что тебе не нужно указывать типы как структуры или биндинги или группы locations дважды. Если два или более шейдеров деляться своими биндингами или структурами или константами или функциями. Но с точки зрения WebGPU он запомнит их только один раз.

Подмечу: Это не стандартный способ создавать шахматную доску с использованием
`@builtin(position)`. Шахматные доски или другие паттерны чаще всего создаются с помощью [текстур](webgpu-textures.html). Но вы увидете проблему если измените размер окна. Потому-что шахматная доска основана на координатах пикселей нашего canvas'a. Это относится к canvas'y, но не относится к треугольнику.

## <a id="a-interpolate"></a>Настройки интерполяции

Мы видим выше inter-stage переменные, вывод из vertex shader, который интерполируется в fragment shader'e. Там есть две настройки для интерполяции. Обычно, эти значение не меняются и это используется для очень необычных случаев, которые будут описаны в других статьях.

Типы интерполяции:

* `perspective`: Значение интерполируются в зависимости от перспективы (**по умолчанию**)
* `linear`: Значение интерполируется линейно, без перспективы
* `flat`: Значение не интерполируются

Виды функции интерполяции:

* `center`: Интерполяция выполняется от центра пикселя (**по умолчанию**)
* `centroid`: Интерполяция выполняется в точке, лежащей внутри всех выборок, охватываемых фрагментом внутри текущего примитива. Это значение одинаково для всех выборок в примитиве.
* `sample`:  Интерполяция выполняется для каждой выборки. Fragment shader вызывается один раз для каждой выборки при применении этого атрибута.

Вы указываете эти аттрибуты. Для примера

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

Подмечу, что если inter-stage переменные являются целым числом - вам нужно установить интерполяцию на режим `flat`. 

Если вы устанавливаете интерполяцию на `flat`, то значение, которое будет проходить через фрагментный шейдер является inter-stage переменной для первой вершины этого треугольника.

В [следующей статье мы изучим что такое uniforms](webgpu-uniforms.html) как другой путь отсылки данных в шейдер.
