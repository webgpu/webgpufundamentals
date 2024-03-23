Title: WebGPU Основы
Description: Основы WebGPU
TOC: Основы

Эта статья обучит вас основам WebGPU.

<div class="warn">
Рекомендую читателю ознакомится с JavaScript перед прочтением этой статьи. Особенно важно понимать эти темы:
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map">mapping arrays</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment">destructuring assignment</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax">spreading values</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules">es6 modules</a>,
Многие другие концепции также будут часто использоваться. Если вы не знакомы с JavaScript, то ознакомится с ним можно тут:
<a href="https://javascript.info/">JavaScript.info</a>, <a href="https://eloquentjavascript.net/">Eloquent JavaScript</a>,
и/или <a href="https://www.codecademy.com/learn/introduction-to-javascript">CodeCademy</a>.
</div>

<div class="warn">Если вы уже знакомы с WebGL <a href="webgpu-from-webgl.html">читайте это</a>.</div>

WebGPU это API которая поможет вам с этими задачами:

1. [Отрисовка треугольников/точек/линий в текстуры](#a-drawing-triangles-to-textures)

2. [Отрисовывать это все с помощью GPU ( видеокарты )](#a-run-computations-on-the-gpu)

Вот и все!

Все остальное об WebGPU после этой информации обязательно будет понято правильно. Это как учить язык программирования по типу JavaScript, Rust или C++. Сначала вы изучите самые основы и после сможете использовать эти знания для решения ваших проблем.

WebGPU это крайне низкоуровневое ( low-level ) API. Пока вы делаете простые задачи это не заметно, но с ростом требований кодовая база будет расширяться и количество информации для нее. Для примера, [three.js](https://threejs.org) который поддерживает WebGPU содержит около 600 тысяч строк кода на JavaScript и это просто базовая библиотека, которая не включает в себя загрузчики ( loaders ), контроль ( controls ), пост-процессинг ( post-processing ) и многих других фишек. Еще, [TensorFlow с WebGPU backend ( поддержкой )](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-webgpu)
Содержит около полумиллиона строчек кода на JavaScript.

Для начала, если вы просто хотите отрисовать что-то на вашем экране, то не стоит выбирать подобные библиотеки где придется писать все самостоятельно.

В ином случае у вас есть конкретная цель. Возможно вам нужен собственный рендеринг или вы хотите изменить уже существующую библиотеку или... Вам интересно как оно работает изнутри. В таком случае - бегом читать!

# Начало

Сложно точно сказать с чего нужно начинать. С одной стороны, WebGPU это очень простая система. Все работает на трех функциях вашей видеокарты ( GPU ). Vertex Shaders, Fragment Shaders, Compute Shaders.

От переводчика:
Vertex переводится как "вершина" и правильно перевести слово-сочетание Vertex Shader сложно. Возможно подходит вариант шейдер вершин, но при разработке вы будете часто встречать название vertex и лучше понимать, что vertex и вершина - одно и тоже.

Vertex Shader расчитывает вершины. Этот шейдер возвращает расположение вершин. Для каждых трех вершин шейдер возвращает треугольник нарисованный по этим трем точкам. [^primitives]

[^primitives]: Есть пять режимом отрисовки.

    * `'point-list'`: для каждой позиции, рисует точку
    * `'line-list'`: для каждых двух позиций, рисует линию
    * `'line-strip'`: рисует линии соединяя следующую точку с предыдущей
    * `'triangle-list'`: Для каждых трех позиций, рисует треугольник (**по умолчанию**)
    * `'triangle-strip'`: Для каждой новой позиции, рисует треугольник соединяя последние две позиции

Fragment Shader, в свою очередь, расчитывает цвет [^fragment-output]. Когда треугольник отрисован для каждого пикселя видеокарта вызовет fragment shader. Он возвращает цвет.

[^fragment-output]: Fragment shaders косвенно записывает данные в текстуру. Эти данные не имеют информации о цвете. Например, обычно шейдер возвращает цвет пикселя какой-либо поверхности.

Compute Shader является более универсальным. Это просто функция, которую вы вызываете и говорите: "вызови эту функцию N-ное количество раз". Видеокарта вызывает этот шейдер и возвращает число, чтобы делать что-то каждую итерацию.

Если вы прищурились, то можете подумать об этом как о функциях в JavaScript:
[`array.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
или
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map).
Когда вы вызываете функцию на своей видеокарте - это те же самые функции как, например, в JavaScript. Безусловно, это отличается, так как требует много данных, чтобы получить доступ к видеокарте, такие как информация о буфере ( buffers ) и текстурах ( textures ) и это только самые основные вещи. Вам нужна информация, которая содержит биндинги ( bindings ) или информация о функции из которая вам нужна информация. И, вернемся в JavaScript, вам нужно связать буфер и текстуры, которые будут делится данными связки или расположением этих связей. Как только вы это сделаете вы можете запустить нужную функцию на вашей видеокарте.

<a id="a-draw-diagram"></a>Возможно это поможет понять. Здесь *упрощенная* диаграмма о работе WebGPU для отрисовки треугольников с помощью vertex shader и fragment shader

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram.svg" style="width: 960px;"></div>

Обратите внимание на:

* **Pipeline**. Который хранит в себе vertex shader и fragment shader, которые будет запускать видеокарта. Вы также можете создать pipeline с compute shader.

* Ссылки на ресурсы для шейдеров (buffers, textures, samplers) косвенно через **Bind Groups**

* Pipeline определяет атрибуты которые косвенно ссылкаются на buffers через внутреннее состояние

* Атрибуты возвращают данные из buffers и устанавливает их для vertex shader'a

* Vertex shader может устанавливать данные в fragment shader

* Fragment shader записывает данные в текстуры косвенно через **описание рендер паса** ( переводчик: я понимаю это как глобальные данные для каждого кадра рендеринга ) или в оригинале **render pass description**

Чтобы запустить шейдеры на видеокарте вам нужно создать все ресурсы и установить их для состояния. Создания ресурсов это относительно простой процесс. Одна интересная фишка в WebGPU заключается в том, что ресурсы не могут быть изменены после создания. Вы можете изменить их наполнение, но не их размер ( size ), usage ( не знаю что это и как перевести ), формат ( format ) и другое... Если вы хотите изменить, то нужно создать новый ресурс и удалить старый.

Некоторые из этих состояний устанавливаются их созданием и вызовом команд буферов ( buffers ).
Соманды буферов это буквально то как они названы. Они называются буфером команд ( buffers of commands ). Вы создаете шаблоны команд ( в оригинале command encoders ). Шаблоны превращают команду шаблона в команду буфера.
После вы *завершаете* шаблон и передаете его команде буфера. После чего вы можете *подтвердить* эту команду буфера и тогда WebGPU вызовет команды.

Здесь немного псевдо-кода для создания шаблона из которого создается командный буфер.

<div class="webgpu_center side-by-side"><div style="min-width: 300px; max-width: 400px; flex: 1 1;"><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
encoder = device.createCommandEncoder()
// отрисовать что-то
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setVertexBuffer(1, …)
  pass.setIndexBuffer(...)
  pass.setBindGroup(0, …)
  pass.setBindGroup(1, …)
  pass.draw(...)
  pass.end()
}
// отрисовать что-то еще
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// расчитать что-то
{
  pass = encoder.beginComputePass(...)
  pass.beginComputePass(...)
  pass.setBindGroup(0, …)
  pass.setPipeline(...)
  pass.dispatchWorkgroups(...)
  pass.end();
}
commandBuffer = encoder.finish();
{{/escapehtml}}</code></pre></div>
<div><img src="resources/webgpu-command-buffer.svg" style="width: 300px;"></div>
</div>

После создания командного буфера вы можете *подтвердить* и вызвать его.

```js
device.queue.submit([commandBuffer]);
```

Диаграма показывает несколько команд для `отрисовки` в командном буфере. Вызов команд будет устанавливать *внутренее состояние* и после команду *отрисовки* которая будет говорить видеокарте вызвать vertex shader ( и косвенно fragment shader ). `dispatchWorkgroup` команда говорит видеокарте вызвать compute shader.

Я надеюсь это дало вам представление о том как работает состояния. Как говорилось ранее у WebGPU есть две основные вещи которые он может делать.

1. [Рисовать треугольники/точки/линии в текстуры](#a-drawing-triangles-to-textures)

2. [Запускать отрисовку на видеокарте](#a-run-computations-on-the-gpu)

Мы рассмотрим подробнее как работает каждый из этих примеров. Другие статьи покажут разные пути передачи данных в эти штуки. Хочу сказать, что это будет очень просто. Нам нужно сначала изучить их основы. Позже я покажу как использовать их для разных реальных задач, такие как 2д графика, 3д графика и многое другое...

# <a id="a-drawing-triangles-to-textures"></a>Отрисовка треугольников с текстурами

WebGPU может магическим образом ( отрисовкой ) превращать треугольники в [текстуры](webgpu-textures.html). Для примера - пиксельная текстура 2д прямоугольника ( правильнее сказать модель прямоугольника, но я перевожу довольно прямо ). [^текстуры] как `<canvas>` элемент представляет текстуру на странице в браузере ( webpage ). В WebGPU мы можем спросить canvas об текстуре и после отрендерить ее.

[^текстуры]: Текстуры также могут быть трехмерными прямоугольниками пикселей, cube maps ( 6 квадратов пикселей ) и несколькими другими вещами, но в большинстве случаев текстуры - это прямоугольники пикселей.

Для рисования треугольников с помощью WebGPU нам нужно два "шейдера". Повторюсь, шейдеры - это функции, которые запускаются на видеокарте. Два вида шейдеров:

1. Vertex Shaders

   Vertex shaders - это функции для расчета позиций вершин для отрисовки треугольников/линий/точек

2. Fragment Shaders

   Fragment shaders - это функции для расчета цветов ( или других данных ) для каждого пикселя, чтобы отрисовать/растеризовать ( rasterized ) их в треугольники/линии/точки

Давайте начнем с самых простых примеров WebGPU для отрисовки треугольников.

Нам нужен canvas для того чтобы увидеть их.

```html
<canvas></canvas>
```

Теперь нам нужен `<script>` тег, чтобы добавить JavaScript.

```html
<canvas></canvas>
+<script type="module">

... javascript выполняется здесь ...

+</script>
```

Весь JavaScript ниже будет выполнен в этом месте

WebGPU - это асинхронный API, поэтому легче использовать асинхронные функции. Мы начнем с получения адаптера ( adapter ) и получения девайса ( device ) из адаптера

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
}
main();
```

Приведенный ниже код достаточно простой. Сначала мы получаем адаптер используя
[`?.` оператор проверки на null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining).
Если `navigator.gpu` отсутствует, тогда `adapter` будет равен undefined ( не присвоен ).
Если он существует, тогда мы вызываем `requestAdapter`. Этот метод возвращает результат асинхронно, поэтому нам нужно добавить оператор `await`. Адаптер представляет собой видеокарту. Некоторые устройства имеют несколько видеокарт.

Из адаптера мы получаем девайс, но снова используем оператор `?.`, так как если что-то случиться с адаптером, то лучше, если девайс тоже будет undefined.

Если `device` не назначен, то, скорее всего, у пользователя старый браузер.

Далее, мы получаем канвас и создаем `webgpu` контекст для него. Это также позволит нам получить текстуру для отрисовки. Эта текстура будет использоватся для отрисовки на канвасе на странице в браузере.

```js
  // Получаем WebGPU контекст из канваса и настраиваем его
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
```

Опять же, этот код максимально простой. Мы получаем `"webgpu"` контекст из canvas. Мы спрашиваем систему какой формат он использует/предпочитает. Это будет либо `"rgba8unorm"` либо `"bgra8unorm"`. Не сказать что это важно, но от этого зависит производительность на системе пользователя.

Мы устанавливаем `format` в webgpu canvas контекст с помощью вызова `configure`.
Мы также устанавливаем `device` который связывает canvas с созданым девайсом.

Далее, мы создаем модуль шейдера. Шейдер модуль содержит один или больше функций шейдеров. В нашем случае, мы создадим одну функцию в vertex shader и одну функцию в fragment shader.

```js
  const module = device.createShaderModule({
    label: 'our hardcoded red triangle shaders',
    code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });
```

Шейдер написан на языке, который называется
[WebGPU Shading Language (WGSL)](https://gpuweb.github.io/gpuweb/wgsl/) который часто произносится как wig-sil. WGSL это строго-типированный язык, который мы будем изучать более глубоко в [другой статье](webgpu-wgsl.html).
А сейчас, я надеюсь небольшое погружение поможет вам понять основы.

Выше мы видим функцию `vs` она обьявляется с атрибутом `@vertex`.
Вот так выглядит обьявление функции в vertex shader.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
         ...
```

Функция принимает один параметр с именем `vertexIndex`. `vertexIndex` это переменная `u32` которая представляет собой *32-битное целое число со знаком*. Он получает его значение, когда builtin вызовет
`vertex_index`. `vertex_index` это что-то вроде целого числа, схожее с `index` в
JavaScript'те `Array.map(function(value, index) { ... })`. Если мы говорим видеокарте вызвать функцию десять раз с помощью функции `draw`, в первый раз `vertex_index` должен быть `0`, во второй раз он должен быть `1`, в третий раз уже `2` и так далее...[^indices]

[^indices]: Мы также используем index buffer, чтобы указать `vertex_index`.
Это написано в [статье об vertex-buffers](webgpu-vertex-buffers.html#a-index-buffers).

Наш `vs` функция будет возвращать `vec4f`. Эта переменная является четырехмерным вектором с 32-битными числами с плавающей запятой ( не целыми ). Это можно представить как массив с четырьмя значениями или обьект с четырьмя свойствами по типу `{x: 0, y: 0, z: 0, w: 0}`. Получение значение будет названо `position` в builtin. В "triangle-list" режиме, каждые три раза vertex shader будет вызван и отрисует три `position` которые будут возвращены из шейдера.

Позиции в WebGPU возвращаются в *clip space*, где X может быть от -1.0
в лево и до +1.0 в право. Y от -1.0 вниз и до +1.0 вверх. Это будет является точным размером текстуры для отрисовки.

<div class="webgpu_center"><img src="resources/clipspace.svg" style="width: 500px"></div>

`vs` функция возвращает массив их трех `vec2f`. Каждый `vec2f` содержит два 32-битных чисел с плавающей запятой ( не целое ).

```wgsl
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
```

Это будет использовать `vertexIndex`, чтобы вернуть одно из трех значений в массиве.
Функция требует четырех чисел с плавающей запятой для работы и `pos` это массив `vec2f`, этот код вернет `0.0` до `1.0` для этих значений.

```wgsl
        return vec4f(pos[vertexIndex], 0.0, 1.0);
```

Модуль шейдера также содержит функцию, которая называется `fs` которая обозначена атрибутом `@fragment` который делает из этой функции **функцию fragment shader'a**

```wgsl
      @fragment fn fs() -> @location(0) vec4f {
```

Эта функция не принимает параметров и возвращает `vec4f` в `location(0)`.
Это значит, что значение будет записано как первая цель для отрисовки. Мы сделаем первую цель для отрисовки для нашего canvas текстуры позже.

```wgsl
        return vec4f(1, 0, 0, 1);
```

Код возвращает `1, 0, 0, 1`, то есть красный. Цвета в WebGPU часто представленны как числа с плавающей запятой ( напоминаю, не целые ) от `0.0` до `1.0` где четыре числа выше запишутся как красный, зеленый, синий и альфа канал.

Когда видеокарта будет растрирует треугольник ( нарисует из него пиксели ), вызовется fragment shader, чтобы найти цвет для каждого пикселя. В нашем случае, мы просто вернем красный.

Еще одна фишка - это `label` или `название` на русском. Для каждого обьекта созданого WebGPU может быть назначен `label`. Назначать названия для сущностей не обязательно, но принято как *хороший тон* называть все что ты создаешь. Это поможет, когда вы получите ошибку. В большинстве случаев WebGPU напишет ошибку, которая будет содержать название того, где произошла ошибка.

В большом приложении может быть сто или тысячи буферов, текстур, модулей шейдеров, pipelines и другого... Если вы получите ошибку 
`"WGSL syntax error in shaderModule at line 10"` и у вас сто модулей шейдеров, то возникнет вопрос: "А в каком из них конкретно ошибка?". Если вы дадите название модулю, то при получении ошибки это будет выглядеть как 
`"WGSL syntax error in shaderModule('our hardcoded red triangle shaders') at line 10` где будет указано название модуля и поможет вам сохранить тонны времени, которые уйдут на отладку.

Теперь, мы создали модуль шейдера и дальше нужно создать render pipeline.

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded red triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });
```

Тут особо не на что смотреть. Мы устанавливаем `layout` в режим `'auto'` и вернем макет данных ( layout of data ) из шейдера. Сейчас мы ни где не используем эти данные.

Далее мы говорим render pipeline'у использовать `vs` функцию из нашего модуля шейдера для vertex shader и `fs` функцию для нашего fragment shader. В противном случае, мы скажем ему формат для первой цели отрисовки. "цель отрисовки" или как в оригинале "render target" значит, что мы будем рендерить эту текстуру. Далее мы создаем pipeline и необходимо указать формат текстуры/текстур. Мы будем использовать этот pipeline для рендеринга.

Элемент ноль для `целей` массива соотвутствует локации ноль, которую мы возвращаем в fragment shader'е. Далее мы будем устанавливать эту цель как текстуру для канваса.

Далее нужно подготовить `GPURenderPassDescriptor` который описывает какие текстуры мы хотим отрендерить и как будем использовать их.

```js
  const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        // view: <- Чтобы текстура была заполнена внутри
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };  
```

`GPURenderPassDescriptor` хранит массив для `colorAttachments`, то есть листы текстур для отрисовки и как хранить их.
Мы хотим дождаться обработки той текстуры, которую хотим отрендерить. Сейчас мы устанавливаем значение полу-темного серого в `loadOp` и `storeOp`.
`loadOp: 'clear'` устанавливается, чтобы очистить текстуру для следующей отрисовки. Другой вариант - `'load'` который значит загрузку существующего контента текстуры в видокарты, короче, мы можем рендерить заного уже то что отрендерено.
`storeOp: 'store'` чначит что мы будет хранить результат того, что хотим отрисовывать. Мы также могли установить `'discard'`
который не будет хранить то что мы хотим отрисовать. Мы обсудим это в [другой статье](webgpu-multisampling.html).

Теперь время рендеринга.

```js
  function render() {
    // Получаем текущую текстуру из canvas context и устанавливаем ее как текстуру для рендеринга
    renderPassDescriptor.colorAttachments[0].view =
        context.getCurrentTexture().createView();

    // создаем шаблон команды, чтобы запускать их
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

    // создаем render pass encoder для установке нашего шаблона
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3);  // вызываем наш vertex shader три раза
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  render();
```

Сначала мы вызываем `context.getCurrentTexture()` для получение текстуры, которая будет отрисовываться на canvas'е. Вызываем `createView` и получаем представление об определенной части текстур, но без параметров, он будет возвращать стандартную часть которая нам нужна. Сейчас есть только `colorAttachment` - это представление текстуры из нашего canvas'а, которую мы получаем в контексте, который был создан вначале. Повторюсь, элемент ноль из `colorAttachments` массива, который соответствует `@location(0)`, который соответствует возвращаемому значение из fragment shader'а.

Далее, мы создаем шаблон команды. Шаблон команды используется, чтобы создать команду буфера. Мы используем это, чтобы создать команду и после "подтвердить" команду буфера и вызвать ее.

Далее мы используем шаблон команды, чтобы создать render pass encoder с помощью вызова `beginRenderPass`. Render pass encoder служит для создания команд рендеринга.
Мы передаем его в `renderPassDescriptor`, чтобы сказать какую текстуру мы хотим отрендерить.

Мы создаем команду и используем `setPipeline`, чтобы назначить наш pipeline и далее вызвать vertex shader три раза с помощью функции `draw` со значением три. По умолчанию каждые три раза наш vertex shader расчитает треугольник, который будет отрисован по трем вершинам.

Мы завершаем render pass и тогда завершаем команду. Это дает нам команду буфера что предтавляет собой шаги для рендеринга треугольника. Теперь мы подтверждаем команду буфера и вызываем ее.

Когда мы вызываем команду `draw` - это будет нашим стейтом ( state ).

<div class="webgpu_center"><img src="resources/webgpu-simple-triangle-diagram.svg" style="width: 723px;"></div>

У нас нет ни текстур ни буфером ни bindGroups, но у нас есть pipeline, vertex shader, fragment shader и render pass descriptor, который говорит нашим шейдерам рендерить на канвасе текстуру.

Результат:

{{{example url="../webgpu-simple-triangle.html"}}}

Подчеркну, что все эти функции как `setPipeline` и `draw` только добавляют команду в буфер.
Они не вызывают команды. Команды вызываются, когда мы подтверждаем их с помощью command buffer в списке девайсов.

<a id="a-rasterization"></a>WebGPU принимает каждые три вершины и возвращает из нашего vertex shader и используется им для растеризации треугольника. Это делается с помощью определения какие пиксели находятся внутри треугольника. Далее это вызывает наш fragment shader для каждого пикселя, чтобы сказать какого цвета они будут.

Представьте текстуру, которую мы рендерим размером 15 на 11 пикселей. Это пиксели, которые мы хотим отрисовать.

<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; max-width: 500px; width: 100%"></div>
  <div>drag the vertices</div>
</div>

Штош, теперь мы можем видеть простой пример работы WebGPU. Это показывает всю сложность написание и это все выглядит не очень гибко. Нам нужны пути, чтобы добавить данные и мы изучим это в следующих статьях. На что стоит обратить внимание в коде выше:

* WebGPU просто запускает шейдеры. Вы должны обрабатывать результат, чтобы делать функциональные вещи
* Шейдеры указаны в модуле шейдера и далее указываются в pipeline'е
* WebGPU может рендерить треугольники
* WebGPU отрисовывает треугольники НА текстуре ( мы получаем текстуру из canvas'а )
* WebGPU работает с помощью шаблонов команд, их вызова и подтверждения.

# <a id="a-run-computations-on-the-gpu"></a>Запуск на видеокарте

Давайте напишем простой пример отрисовки на видеокарте.

Мы начинаем с того же самого кода для получения девайса

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

Далее создаем модуль шейдера

```js
  const module = device.createShaderModule({
    label: 'doubling compute module',
    code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });
```

Сначала, мы создаем переменную с названием `data` типа `storage` из которой мы можем читать и записывать информацию.

```wgsl
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

Мы создаем его как тип `array<f32>` который означает массив 32-битных чисел с плавающей запятой. Мы указываем, что массив должен находиться в binding location 0 (the
`binding(0)`) в bindGroup 0 (the `@group(0)`).

Далее мы создаем функцию с названием `computeSomething` с атрибутом `@compute` который делает из этой функции compute shader. 

```wgsl
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        ...
```

Compute shader нужен для назначения размера "рабочий группы" ( в оригинале workgroup ) о которой мы поговорим позже. А сейчас, мы просто устанавливаем один атрибут `@workgroup_size(1)`.
Мы добавляем его, чтобы иметь параметр `id`, который использует `vec3u`. `vec3u` - это три 32 битные целые числа без знака. Как наш vertex shader выше - это число итераций. Это работает по другому в compute shader. Число итераций тут - это три числа. Мы создаем `id`, чтобы получить значение из built-in
`global_invocation_id`.

Вы можете сделать *что-то вроде* этого для расчета шейдеров. Это супер упрощенная версия, но оно работает.

```js
// псевдо-код
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  // из @workgroup_size в WGSL
  const workgroup_size = shaderCode.workgroup_size;
  const {x: width, y: height, z: depth} = workgroup_size;
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const local_invocation_id = {x, y, z};
        const global_invocation_id =
            workgroup_id * workgroup_size + local_invocation_id;
        computeShader(global_invocation_id)
      }
    }
  }
}
```

С того момента как мы установили `@workgroup_size(1)`, псевдо-код превратился в

```js
// псевдо-код
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = {x, y, z};
        dispatchWorkgroup(workgroup_id)
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  const global_invocation_id = workgroup_id;
  computeShader(global_invocation_id)
}
```

Наконец-то мы используем `x` как свойство `id` для индекса `data` и умножаем все значения на два.

```wgsl
        let i = id.x;
        data[i] = data[i] * 2.0;
```

Выше, `i` это просто первое из трех чисел.

Теперь мы создали шейдер и нам нужно создать pipeline.

```js
  const pipeline = device.createComputePipeline({
    label: 'doubling compute pipeline',
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'computeSomething',
    },
  });
```

Здесь мы просто указываем что используем `compute` часть из шейдера. Мы создали `module`
и там есть только один `@compute` как точка входа и поэтому WebGPU понимает, что мы хотим вызвать его. `layout` поставлен на режим
`'auto'` снова, чтобы WebGPU возвращал обработанный макет из шейдера. [^layout-auto]

[^layout-auto]: `layout: 'auto'` - это удобно, но не дает возможности поделиться bind groups с другими pipeline'ами. В большинстве примеров тут мы никогда не будем использовать bind group для множества pipeline'ов. Мы будет использовать явные макеты в [другой статье](webgpu-drawing-multiple-things.html).

Далее, нам нужно немного данных.

```js
  const input = new Float32Array([1, 3, 5]);
```

Эти данные существуют только в JavaScript. Для WebGPU нам нужен создать буфер, который будет на видеокарте и будет копировать данные в этот буфер.

```js
  // Создает буфер на видеокарте, чтобы перенести наши вычисления
  // входные и выходные
  const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  // Копирует наши данные в буфер
  device.queue.writeBuffer(workBuffer, 0, input);
```

Выше мы вызываем метод `device.createBuffer` чтобы создать буфер. `size` - это размер в байтах. 
В нашем случае указано 12, так как мы храним в байтах тип `Float32Array` трех float значений а их размер будет равен двенадцати байтам.
Если вы не знакомы с `Float32Array` и строго-типизированными массивами, то читайте [эту статью](webgpu-memory-layout.html).

Каждый WebGPU буфер, который мы создаем имеет `usage` или `для чего используется`. Есть довольно большой список типов, которые мы можем указать для использования, но не все из них совместимы для совместного использования. Здесь мы указываем, что этот буфер будет использовать `storage` или `хранилище` с помощью флага
`GPUBufferUsage.STORAGE`. Это добавляет возможность использовать `var<storage,...>` из шейдера. 
Дальше, мы хотим копировать данные из буфера, поэтому добавляем флаг `GPUBufferUsage.COPY_DST`. И последнее, мы хотим добавить возможность копировать данные из буфера, поэтому добавляем флаг `GPUBufferUsage.COPY_SRC`.

Также хочу добавить, что вы не можете напрямую читать информацию из WebGPU буфера в JavaScript. 
Вместо этого, у вас есть "карта" ( в оригинале "map" ) с помощью которой вы можете отправлять запросы к доступу к буферу из WebGPU, потому что буфер существует только на видеокарте.

Такой доступ к WebGPU буфере есть только в JavaScript. Другими словами, мы не можем сопоставить буфер, который мы только что создали выше, и если мы попытаемся добавить флаг, чтобы сделать его отображаемым, мы получим ошибку, с которой он несовместим использование `STORAGE`.

Таким образом, чтобы получить результат наших вычислений нам нужен другой буфер.
После запуска вычислений мы копируем буфер выше в этот буфер с результатом и указываем флаг и мы можем отправлять запросы к нему.

```js
  // Создает буфер на видеокарте и копирует результат
  const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });
```

`MAP_READ` значит, что мы хотим иметь доступ к чтению данных.

Чтобы сказать шейдеру о нашем буфере нам нужно создать bindGroup.

```js
  // Устанавливаем bindGroup, чтобы указать шейдеру
  // буфер, который будем использовать
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workBuffer } },
    ],
  });
```

Мы получаем макет для bindGroup из pipeline'a. Далее, мы устанавливаем bindGroup. 
Ноль в `pipeline.getBindGroupLayout(0)` соотвествует `@group(0)` в шейдере. 
`{binding: 0 ...` с `entries` соответствует `@group(0) @binding(0)` в шейдере.

Далее мы можем создавать команды

```js
  // Создает команды, чтобы делать расчеты
  const encoder = device.createCommandEncoder({
    label: 'doubling encoder',
  });
  const pass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
  pass.end();
```

Мы создаем команду. Начинаем вычисления. Мы создаем pipeline и устанавливаем bindGroup. Здесь, `0` в `pass.setBindGroup(0, bindGroup)`
соответствует `@group(0)` в шейдере. Далее мы вызываем `dispatchWorkgroups`
И в нашем случае мы указываем в `input.length` число `3` говоря WebGPU запустить compute shader три раза и завершить расчет.

Такое произойдет, когда `dispatchWorkgroups` будет вызван.

<div class="webgpu_center"><img src="resources/webgpu-simple-compute-diagram.svg" style="width: 553px;"></div>

После расчетов мы говорим копировать данные из `workBuffer` ( который занимается расчетом ) в `resultBuffer` ( который копирует результат ).

```js
  // Пишем команду, чтобы скопировать результат в буфер
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
```

Теперь мы можем `finish` ( завершить ) команду, чтобы получить команду буфера и подтвердить ее.

```js
  // Завершает команду и подтверждает ее
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

Далее мы получаем результат и копируем данные.

```js
  // Читаем результат
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log('input', input);
  console.log('result', result);

  resultBuffer.unmap();
```

Чтобы получить результат буфера мы вызываем `mapAsync` и указываем `await`. 
После этого мы вызываем `resultBuffer.getMappedRange()`, который без параметров вернет `ArrayBuffer` данных всего буфера.
Мы сохраняем результат в `Float32Array`. Строго-типизированный массив и после мы можем прочитать значения. 
Важно подметить, что `ArrayBuffer` возвращаемый с помощью `getMappedRange` действительный, только до момента вызова `unmap`. 
После `unmap` данные исчезнут.

Запускаем и получаем результат. Видим что все числа были умножены на два.

{{{example url="../webgpu-simple-compute.html"}}}

Мы будем изучать как использовать compute shader в других статьях. 
Сейчас вам нужно только понять как работает WebGPU. ВСЕ ОСТАЛЬНОЕ ВЫ УЗНАЕТЕ ДАЛЬШЕ!.
WebGPU похож на другие языки программирования. Он дает возможность делать базовые вещи и дает возможность воссоздать все ваши идеи.

Особенным WebGPU делают эти функции, vertex shader, fragment shader и compute shader запускаемыми на вашей видеокарте.
У видеокарты есть более 10 000 процессоров, которые потенциально могут делать более 10 000 параллельных вычислений, которые невозможно делать на процессоре.

## <a id="a-resizing"></a> Изменение размера Canvas'a

Чтобы продвинуться дальше, давайте вернемся к отрисовке треугольника и добавим возможность изменения размера окна ( в данном случае canvas'a ).
Изменения размера имеет много мелочей, поэтому более подробно это описано [здесь](webgpu-resizing-the-canvas.html).
Сейчас давайте добавим самую простую поддержку.

Сначала нам нужно добавить CSS, чтобы заполнить страницу.

```html
<style>
html, body {
  margin: 0;       /* убирает смещение ( margin ) по умолчанию */
  height: 100%;    /* позволяет html полностью заполнить страницу */
}
canvas {
  display: block;  /* указывает тип канваса как block */
  width: 100%;     /* позволяет canvas'y заполнять страницу */
  height: 100%;
}
</style>
```

Этот CSS код позволит canvas'y полностью заполнить страницу, но при этом не менять разрешение. Если вы сделаете окно примера выеш больше, например нажав на кнопку полноэкранного режима, то вы увидете что углы треугольника "блочные" ( я сама не знаю как точно перевести слово blocky. Если вы знаете, то сделайте свой pull request в гите ).

{{{example url="../webgpu-simple-triangle-with-canvas-css.html"}}}

`<canvas>` тег по умолчанию имеет разрешение 300 на 150 пикселей. Мы хотим регулировать разрешение canvas'a, чтобы изменять размер отображаемого изображения.
Одно из решений будет узазать `ResizeObserver`. Вы создаете `ResizeObserver` и даете его функции, чтобы вызвать его для любого элемента и изменить их размер. Вы говорите за какими элементами нужно наблюдать.

```js
    ...
-    render();

+    const observer = new ResizeObserver(entries => {
+      for (const entry of entries) {
+        const canvas = entry.target;
+        const width = entry.contentBoxSize[0].inlineSize;
+        const height = entry.contentBoxSize[0].blockSize;
+        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
+        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
+        // заного отрисовать
+        render();
+      }
+    });
+    observer.observe(canvas);
```

В коде выше мы проходимся по всем элементам, но пройдемся только по одному так как у нас есть только canvas. Нам нужно установить размер нашего canvas'a, чтобы получить максимальный размер поддерживаем устройством, чтобы WebGPU не начал генерировать ошибки, потому что мы пытаем создать текстуру, которая слишком большая. Нам также нужно удостовериться, что это значение не будет равно нуль или мы снова будем получать ошибки. 
[Вот огроменная статья со всеми фишками](webgpu-resizing-the-canvas.html).

Мы вызываем `render`, чтобы заного отрисовать треугольник в новом разрешении. 
Мы удаляем старый вызов `render`, потому что он нам больше не нужен. 
`ResizeObserver` будет вызывается каждый раз, когда размер элементов будет меняться.

Новый размер текстуры будет создаваться, когда мы вызываем `context.getCurrentTexture()` 
внутри `render`, поэтому нам не нужно ничего делать более.

{{{example url="../webgpu-simple-triangle-with-canvas-resize.html"}}}

В этих статьях мы рассмотрим разные варианты как указать данные в шейдер.

* [inter-stage variables](webgpu-inter-stage-variables.html)
* [uniforms](webgpu-uniforms.html)
* [storage buffers](webgpu-storage-buffers.html)
* [vertex buffers](webgpu-vertex-buffers.html)
* [textures](webgpu-textures.html)
* [constants](webgpu-constants.html)

Далее мы изучим [основы WGSL](webgpu-wgsl.html).

Здесь будут самые основы до самых сложных вещей. Inter-stage varibles не требует дополнительных знаний для понимания. 
Мы можем увидеть как мы используем их ничего не используя, но меня WGSL выше. Uniforms - это эффективные глобальные переменные, которые используют все три вида шейдеров (vertex, fragment и compute).
Использовать uniform buffers, чтобы хранить буферы тривиально, как показано выше в статье о хранении буферов. 
Vertex buffers используются только для vertex shader'ов.
Они более гибкие, так как требуют только указания данных в макет в WebGPU.
Текстуры являются самыми гибкими и у них есть тонны типов и вариантов.

Я немного обеспокоен, что эта статья будет скучноватой для начала, но изучайте дальше, если вам это нравится. Просто помните, что если вы что-то не понимаете, то вам нужно прочитать эти основы. Когда мы изучим их, то сможем перейти к более актуальным задачам.

Еще хотелось бы сказать, что все показанные примеры могут быть изменены прямо на странице в браузере.
Далее мы можете экспортировать все примеры в [jsfiddle](https://jsfiddle.net) и [codepen](https://codepen.io)
и еще [stackoverflow](https://stackoverflow.com). Просто нажмите кнопку "Export".

<div class="webgpu_bottombar">
<p>
Код для получения устройства WebGPU здесь максимально простой. Для более сложного варианта вам нужно делать как-то так
</p>
<pre class="prettyprint showmods">{{#escapehtml}}
async function start() {
  if (!navigator.gpu) {
    fail('this browser does not support WebGPU');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('this browser supports webgpu but it appears disabled');
    return;
  }

  const device = await adapter?.requestDevice();
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);

    // Если 'reason' ( причина ) будет 'destroyed' ( уничтожен, отключен ), если мы намеренно отключим устройство.
    if (info.reason !== 'destroyed') {
      // Попробовать снова
      start();
    }
  });
  
  main(device);
}
start();

function main(device) {
  ... do webgpu ...
}
{{/escapehtml}}</pre>
<p>
<code>device.lost</code> - это promise ( обещание ), которые начинается как невыполненное. Оно выполнится, когда устройство будет потеряно. Устройство может быть потеряно по множеству причин. Может быть пользователь запустил очень требовательное приложение и это убило его видеокарту. Может быть, пользователь обновил драйвера. Может пользователь использует удаленную видеокарту и отключил ее. Может быть другая страница в браузере использует слишком много ресурсов видеокарты и ваша страница находится на зданем плане и теряет устройство из-за нехватки памяти. Это стоит делать, чтобы перехватывать потерю устройства.
</p>
<p>
Хочу подметить, что <code>requestDevice</code> всегда возвращает устройство. Может только случится потеря в процессе выполнения.
WebGPU спроектирован так, что в большинстве случаев устройство будет работать в зависимости от версии API. Вызов для создания вещей и использования их может быть успешно выполненно, но никто не обещает. Это поможет вам перехватить потерю девайса с помощью promise.
</p>
</div>

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-fundamentals.js"></script>