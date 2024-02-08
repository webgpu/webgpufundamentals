Title: Міжетапні змінні у WebGPU
Description: Передаємо дані з вершинного шейдера в фрагментний шейдер
TOC: Міжетапні змінні

В [попередній статті](webgpu-fundamentals.html) ми розглянули основи
роботи з WebGPU. В цій статті ми пройдемось по *основам* роботи з міжетапними
змінними.  

Міжетапні змінні вступають у гру між вершинним та фрагментним шейдером.

Вершинний шейдер повертаючи 3 точки дає змогу нам намалювати трикутник між ними.
Проте, вершинний шейдер може також повернути додаткові дані для кожної з цих точок, 
які, відповідно до стандартної поведінки, будуть інтерпольовані між цими точками.

Наведемо невеликий приклад. Ми розпочнемо з шейдерного модуля з попередньої статті.
Все, що ми збираємось зробити, це внести певні змінити в ці шейдери.

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

Перш за все ми оголошуємо структуру (`struct`). Це один із простих способів
координації міжетапних змінних між вершинним та фрагментним шейдерами.

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

Далі ми оголошуємо, що наш вершинний шейдер повертатиме структуру цього типу.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

Створюємо масив з 3 кольорів.

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // червоний
          vec4f(0, 1, 0, 1), // зелений
          vec4f(0, 0, 1, 1), // синій
        );
```

Після цього, замість того, щоб просто повертати `vec4f` для позиції, ми оголошуємо
екземпляр нашої структури, заповнюємо його даними і повертаємо.

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

В оголошенні фрагментного шейдера ми вказуємо, що він прийматиме цю нашу структуру,
як параметр функції.

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

Далі, просто повертаємо колір з отриманої структури.

Якщо ми запустимо цей приклад, то побачимо, що кожного разу, коли графічний процесор
запускає наш фрагментний шейдер, то передає туди значення кольору, яке було
інтерпольоване між нашими 3 точками.

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

Міжетапні змінні зазвичай використовуються для інтерполяції координат текстури
вздовж трикутника, що ми розглянемо в [цій статті про текстури](webgpu-textures.html).
Інший поширений спосіб використання цих змінних це інтерполяція нормалів вздовж
трикутника, яку ми розглянемо в [першій статті про освітлення](webgpu-lighting-directional.html).

## Міжетапні змінні з’єднанні з допомогою `location`

Важливо зазначити, що, як і майже все в WebGPU, зв’язок між вершинним та 
фрагментним шейдерами здійснюється за індексом. Для міжетапних змінних, цей зв’язок
працює через індекс локації.

Щоб побачити, що я маю на увазі, давайте змінимо фрагментний шейдер таким чином, щоб
заміст структури він приймав параметр `vec4f` з позначкою локації `location(0)`.

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

Запустивши цей код, ми побачимо, що він досі працює.

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## <a id="a-builtin-position"></a> `@builtin(position)`

Це допомагає нам звернути увагу на ще одну особливість. Наш початковий шейдерний модуль, 
який використовував одну і ту ж структуру для вершинного та фрагментного шейдерів,
мав поле `position`, але воно не мало своєї локації. Натомість, воно було оголошене як
`@builtin(position)`.

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

Це поле **НЕ** є міжетапною змінною. Натомість, це вбудоване змінна (`builtin`).
Так трапилось, що `@builtin(position)` має різне значення для вершинного та для
фрагментного шейдера.

В вершинному шейдері, `@builtin(position)` - це вихідні дані, які потрібні графічному
процесору, щоб той намалював трикутник/лінію/точку.

В фрагментному шейдері, `@builtin(position)` - це вхідні дані. Це піксельні координати того 
пікселя, про колір якого ми попросили дізнатися у нашого фрагментного шейдера.

Піксельні координати визначаються краями пікселя. Значення, яке передається в 
фрагментний шейдер це координати центру пікселя.

Якщо б текстура, на якій ми малюємо була б розміром 3x2 пікселя, то координати
були б такими як на малюнку.

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

Ми можемо змінити наш шейдер так, щоб він використовував ці позиції. Для прикладу,
давайте намалюємо шахову дошку.

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

Код, вказаний вище, бере змінну `fsInput.position`, яка була оголошена як 
`@builtin(position)`, і конвертує поле `xy` з координатами в значення типу `vec2u`
з 2 беззнаковими числами. Далі ми ділимо цих два числа на 8, що дає нам число, яке
збільшується кожних 8 пікселів. Далі ми додаємо `x` та `y` цього вектора, обчислюємо
остачу від ділення на 2 і порівнює результат з 1. Це дозволить нам отримати булеве
значення, яке буде правдивим чи хибним в залежності від нашого числа. В кінці, 
ми використовуємо WGSL функцію `select`, яка отримує два значення та обирає з них одне
залежно від булева умова. В JavaScript функція `select` виглядала б так:

```js
// якщо condition хибне - повертаємо `a`, в іншому випадку - `b`
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

Навіть, якщо ви не використовуєте `@builtin(position)` в фрагментному шейдері,
зручно мати його в коді, оскільки ми зможемо використовувати одну і ту ж структуру
в вершинному та фрагментному шейдері. Важливо запам’ятати, що значення поля `position`
нашої структури відрізняються в вершинному і фрагментному шейдері і зовсім не
пов’язані між собою. Це абсолютно різні змінні.

Як зазначалося вище, для міжетапних змінних має значення лише `@location(?)`. 
Тому оголошення різних структур для вихідних даних вершинного шейдера 
та вхідних даних фрагментного шейдера.

Для того щоб прояснити це все, той факт, що вершинний шейдер та фрагментний шейдер
ми тримаємо в одній і тій самій текстовій змінній це лише заради зручності. Насправді
ми також можемо розділити їх на різні модулі.

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

Та оновити створення нашого пайплайну, щоб використати ці модулі

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
      entryPoint: 'vs',
    },
    fragment: {
-      module,
+      module: fsModule,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });

```

І все це буде працювати так само

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

Справа в тому, що той факт, що обидва шейдери знаходяться в одному текстовому рядку 
в більшості прикладів є лише зручністю. Насправді спочатку WebGPU аналізує WGSL, 
щоб переконатися, що він синтаксично правильний. Потім WebGPU дивиться на вказану вами 
точку входу. Звідти він переходить і переглядає частини, на які посилається entryPoint, і
нічого більше окрім цієї entryPoint. Це все зручно, тому що вам не потрібно двічі 
описувати такі речі, як структури, прив’язки та розташування груп, якщо два або 
більше шейдерів спільно використовують їх. Але з точки зору WebGPU це працює так, наче 
ви створили їх усі, по одному разу для кожної точки входу.

Примітка: Генерування шахового патерну з допомогою `@builtin(position)` не є
дуже поширеною практикою. Шаховий та інші патерни зазвичай реалізовують з
допомогою [текстур](webgpu-textures.html). Фактично, ви можете побачити поточну
проблему з цим підходом змінивши розмір вікна. Через те, що цей шаховий патерн
залежить від координат полотна, то він бути обчислюватись відносно полотна, а
не відносно трикутника.

## <a id="a-interpolate"></a>Налаштування інтерполяції

Ми побачили вище, що міжетапні змінні, які повертаються з вершинного шейдера,
інтерполюються в момент, коли передаються в фрагментний шейдер. Є два набори 
налаштувань для зміни способу інтерполяції. Зміна стандартних значень цих
налаштувань не є дуже поширеною практикою, але є випадки коли це потрібно.
Ми розглянемо такі випадки в інших статтях. 

Тип інтерполяції:

* `perspective`: Значення інтерполюються у перспективно правильний спосіб (**стандартне значення**)
* `linear`: Значення інтерполюються лінійно, не перспективно правильним способом.
* `flat`: Значення не інтерполюються. Вибірка інтерполяції не використовується з цим типом.

Вибірка інтерполяції:

* `center`: Інтерполяція виконується в центрі пікселя (**стандартне значення**)
* `centroid`: Інтерполяція виконується в точці, яка лежить у межах усіх вибірок, охоплених фрагментом у поточному примітиві. Це значення однакове для всіх зразків у примітиві.
* `sample`:  Інтерполяція виконується для вибірки. Фрагментний шейдер викликається один раз на вибірку, коли застосовано цей атрибут.

Ви зазначаєте їх, як атрибути. Наприклад

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

Зверніть увагу, що якшо ваша міжетапна змінна має тип `integer`, то ви маєте
використати тип інтерполяції `flat`.

Якщо ви застосуєте тип `flat`, то значення передане в фрагментний шейдер буде 
значенням міжетапної змінної в першій вершині переданого трикутника.

В [наступній статті ми розглянемо юніформи](webgpu-uniforms.html), як ще один 
спосіб передачі даних в шейдери.
