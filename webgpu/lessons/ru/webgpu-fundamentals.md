Title: Основы WebGPU
Description: Основы WebGPU
TOC: Основы

Эта статья - попытка научить вас самым основам WebGPU.

<div class="warn">
Предполагается, что вы уже знаете JavaScript
перед тем, как начать прочтение этой статьи.
Такие концепции, как
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map">итерация по массивам</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment">деструктурирующее присваивание</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax">спред-синтаксис</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules">es6 модули</a>,
и не только будут активно использоваться. Если вы еще не знаете JavaScript и хотели бы его изучить, смотрите
<a href="https://javascript.info/">JavaScript.info</a>, <a href="https://eloquentjavascript.net/">Выразительный Javascript</a>,
и/или <a href="https://www.codecademy.com/learn/introduction-to-javascript">CodeCademy</a>.
</div>

<div class="warn">Если вы уже знаете WebGL, <a href="webgpu-from-webgl.html">прочтите это</a>.</div>

WebGPU это API, которое дает вам возможность делать 2 базовых операции.

1. [Рисовать треугольники/точки/линии на текстурах](#a-drawing-triangles-to-textures)

2. [Выполнять вычисления на GPU](#a-run-computations-on-the-gpu)

Это всё!

После этого всё, что касается WebGPU, зависит от вас. Это как изучать JavaScript, или Rust, или C++. Первое, что вы учите основы, а далее зависит от вас, как вы креативно будете использовать эти основы для решения вашей проблемы.

WebGPU это чрезвычайно низкоуровневый API. В том время, как вы можете делать
небольшие примеры, для многих приложений это вероятно потребует большого количества кода и некоторая серьезная организация данных. К примеру, [three.js](https://threejs.org) который поддерживает WebGPU состоит из около 600 тысяч строк минифицированного JavaScript, и это только
базовая библиотека. Она не содержит загрузчиков, контролов, пост-обработки и других фич. Аналогично, [TensorFlow с WebGPU бекенд](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-webgpu)
это около 500 тысяч строк JavaScript.

Дело в том, что, если вы только хотите получить что-то на экране, вам лучше избегать выбора библиотеки, которая предоставляет большой объем кода, который вы
собираетесь написать сами.

С другой стороны, возможно у вас свой случай или возможно вы хотите изменить
существующую библиотеку или возможно вы просто заинтересованы, как всё это работает. В этих случаях читайте дальше!

# Начало

Трудно решить, куда двигаться дальше. На определенном уровне, WebGPU это очень
простая система. Всё, что она делает это выполняет 3 типа функций на GPU.
Вершинные шейдеры, фрагментные шейдеры, вычислительные шейдеры.

Вершинный шейдер вычисляет вершины. Шейдер возвращает позиции вершин. Для каждой группы из 3 вершин срабатывает функция вершинного шейдера, треугольник, который рисуется между этими 3 позициями. [^primitives]

[^primitives]: Существует 5 режимов.

    - `'point-list'`: для каждой позиции, нарисовать точку
    - `'line-list'`: для каждых 2 позиций, нарисовать линию
    - `'line-strip'`: рисовать линии, соединяющие новую точку с предыдущей точкой
    - `'triangle-list'`: для каждых 3 позиций, рисовать треугольник (**по умолчанию**)
    - `'triangle-strip'`: для каждой новой позиции, рисовать треугольник по этой позиции и по 2 последним позициям

Фрагментный шейдер вычисляет цвета [^fragment-output].
Когда происходит отрисовка треугольника, для каждого пикселя, который отрисовывается, GPU вызывает ваш фрагментный шейдер.
Далее фрагментный шейдер возвращает цвет.

[^fragment-output]:
    Фрагментный шейдер пишет данные в текстуры не напрямую.
    Эти данные не обязательно должны быть цветами.
    Например, более распространенный случай - вывести направление поверхности, представленную пикселем.

Вычислительный шейдер - более универсальный.
Фактически, это просто функция, которую вы вызываете и говорите "выполни эту функцию N раз".
GPU передает номер итерации каждый раз, когда вызывается ваша функция, таким образом вы можете использовать этот номер, чтобы сделать что-нибудь уникальное на каждой итерации.

Если вы внимательно присмотритесь, то вы можете увидеть схожесть этих функций с
[`array.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
или
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map).
Функции, которые вы запускаете на GPU - просто функции, как и JavaScript функции.
Отличие лишь в том, что они запускаются на GPU, и перед запуском вам нужно скопировать все данные, которые вы хотите использовать для доступа к GPU в форму буферов и текстур, и данные выводятся только в эти буферы и текстуры. В функциях вам нужно указать привязки и локации, которые будут использованы для поиска данных. И затем в JavaScript, вам необходимо привязать буферы и текстуры, указав ваши данные в привязках и локациях. Как только вы это сделаете, GPU будет готов выполнить функцию.

<a id="a-draw-diagram"></a>Возможно этот снимок разъяснит происходящее. Это _упрощенная_ диаграмма настройки WebGPU для отрисовки треугольников с использованием вершинного и фрагментного шейдера

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram.svg" style="width: 960px;"></div>

Что следует отметить в этой диаграмме

- Это - **Pipeline (Конвейер)**. Он содержит вершинный и фрагментный шейдер, который GPU будет запускать. У вас также может быть конвейер для вычислительного шейдера.

- Шейдеры ссылаются на ресурсы (буферы, текстуры, сэмплеры) косвенно через **Группы привязки (Bind Groups)**

- Конвейер определяет аттрибуты, которые ссылаются на буферы косвенно через внутренее состояние

- Атрибуты извлекают данные из буферов и передают их в вершинный шейдер

- Вершинный шейдер может передавать данные во фрагментный шейдер

- Фрагментный шейдер записывает данные в текстуры косвенно через описание прохода рендера (render pass description)

Для выполнениея шейдеров на GPU, вам нужно создать все эти ресурсы и установить их состояние. Создать ресурсы относительно просто. Одна из отличительных особенностей заключается в том, что в большинстве WebGPU ресурсы не могут быть изменены после создания. Вы можете изменить их содержимое, но не размер, использование, формат и т.д... Если вы хотите изменить что-то из этого, вы создаете новый ресурс и уничтожаете старый.

Часть состояния устанавливается путем создания и затем последующего выполнения командных буферов.
Командные буферы буквально соответствуют их названию. Это буферы команд. Вы создаете кодировщики команд. Кодировщики кодируют команды в командные буферы. Затем вы _финишируете_ кодировщик и он дает вам командный буфер, который вы создали.
Затем вы можете _утвердить_ этот командный буфер, чтобы дать WebGPU выполнить команды.

Вот некоторый псевдокод для кодирования командного буфера, за которым следует представление созданного командного буфера.

<div class="webgpu_center side-by-side"><div style="min-width: 300px; max-width: 400px; flex: 1 1;"><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
encoder = device.createCommandEncoder()
// нарисовать что-то
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
// нарисовать что-то еще
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// вычислить что-то
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

Как только вы создаете командный буфер, вы можете _утвердить_ его на выполнение

```js
device.queue.submit([commandBuffer]);
```

Диаграмма выше представляет состояние для некоторой `draw` команды в командном буфере.
Выполнение команд установит _внутренее состояние_ и затем _draw_ команда скажет GPU выполнить вершинный шейдер (и косвенно фрагментному шейдеру).
`dispatchWorkgroup` команда скажет GPU выполнить вычислительный шейдер.

Я надеюсь, что это дало вам некоторое ментальное представление состояния, которое вам необходимо установить. Как упоминалось выше, у WebGPU есть 2 базовых операции, которые он может делать

1. [Рисовать треугольники/точки/линии на текстурах](#a-drawing-triangles-to-textures)

2. [Выполнять вычисления на GPU](#a-run-computations-on-the-gpu)

Мы еще рассмотрим небольшой пример выполнения каждой из этих операций.
Другие статьи будут показывать различные пути предоставления данных этим операциям.
Учтите, что это будет показано на очень базовом уровне.
Нам необходимо заложить фундамент этих основ.
Познее мы покажем, как их использовать для того, что люди обычно делают с GPU, например 2D графику, 3D графику, и т.д.

# <a id="a-drawing-triangles-to-textures"></a>Рисование треугольников на текстурах

WebGPU может рисовать триугольники на [текстурах](webgpu-textures.html). Для задачи этой статьи, текстура - это 2D прямоугольник пикселей.[^textures] `<canvas>` елемент представляет текстуру веб страницы. В WebGPU мы можем запросить у canvas текстуру и затем отрисовать на этой текстуре.

[^textures]: Текстурами могут быть 3D прямоугольники пикселей, кубы (6 квадратов пикселей, которые формируют куб), и затем некоторые другие примитивы, но самые популярные текстуры - 2D прямоугольники пикселей.

Для отрисовки треугольников с помощью WebGPU мы должны поддержать 2 "шейдера". Опять, Шейдеры - это функции, которые запускаются на GPU. Есть 2 шейдера:

1. Вершинные Шейдеры

   Вершинные Шейдеры - это функции, которые вычисляют позиции вершин для рисования треугольников/линий/точек

2. Фрагментные Шейдеры

   Фрагментные шейдеры - это функции, которые вычисляют цвет (или другие данные) для каждого пикселя, который должен быть отрисован/растеризован при отрисовке треугольников/линий/точек

Давайте начнем с очень маленькой WebGPU программы по отрисовке треугольника.

Нам необходим canvas для отрисовки нашего треугольника

```html
<canvas></canvas>
```

Затем нам нужен `<script>` тег для нашего кода на JavaScript.

```html
<canvas></canvas> +
<script type="module">

  ... javascript будет здесь ...

  +
</script>
```

Весь код JavaScript ниже будет находиться внутри этого script тега

WebGPU - это асинхронный API, таким образом проще всего использовать его в **async** функциях. Мы начинаем с запроса адаптера, а затем запроса устройства из адаптера.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail("необходим браузер с поддержкой WebGPU");

    return;
  }
}
main();
```

Приведенный выше код достаточно понятен. Во-первых, мы запрашиваем адаптер, используя
[`?.` оператор опциональной последовательности](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining).
Таким образом, если `navigator.gpu` не существует, то `adapter` будет равен undefined. Если он существует, то мы вызываем `requestAdapter`. Результаты возвращаются асинхронно, поэтому нам нужен `await`. Адаптер представляет собой конкретный GPU. У некоторых устройств может быть несколько GPU.

У адаптера, мы запрашиваем устройство, но опять используем `?.`, таким образом, если адаптер не определен, то утройство тоже будет не определено.

Если `device` не установлен, то это значит, что у пользователя старый браузер.

Далее, мы берем canvas и создаем `webgpu` контекст для него. Это позволит нам получить текстуру для отрисовки. Эта текстура будет использована для отображения в canvas на веб странице.

```js
// Получение WebGPU контекста из canvas и его конфигурирование
const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: presentationFormat,
});
```

Еще раз, приведенный код выше говорит сам за себя. Мы получаем `"webgpu"` контекст из canvas. Мы запрашиваем систему, какой формат canvas предпочтительнее. Это будет или `"rgba8unorm"` или `"bgra8unorm"`. Сейчас это не так важно, что это, но запрос предпочитаемого формата ускорит работу системы пользователя.

Мы передаем это, как `format` в webgpu canvas контекст, вызывая `configure`.
Мы также передаем `device`, который связывает этот canvas с устройством, которое мы только что создали.

Далее, мы создаем модуль шейдера. Модуль шейдера содержит одну или более функций шейдера. В нашем случае, у нас будет 1 функция вершинного шейдера и 1 функция фрагментного шейдера.

```js
const module = device.createShaderModule({
  label: "our hardcoded red triangle shaders",
  code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // верх центр
          vec2f(-0.5, -0.5),  // низ лево
          vec2f( 0.5, -0.5)   // низ право
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
});
```

Шейдеры написаны на языке, который называется
[WebGPU Shading Language (WGSL)](https://gpuweb.github.io/gpuweb/wgsl/), и который часто произносится, как `wig-sil`. WGSL - это строго типизированный язык, который мы постараемся рассмотреть более подробно в [другой статье](webgpu-wgsl.html).
А пока я надеюсь, что с помощью небольшого объяснения вы сможете понять некоторые основы.

Выше мы видим, что функция под названием `vs` объявлена с `@vertex` атрибутом обозначая ее, как функцию вершинного шейдера.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
         ...
```

Функция принимает один параметр, который мы назвали, как `vertexIndex`. `vertexIndex` - это `u32`, который значит _32-битное беззнаковое целое_. Значение получается из уже встроенного `vertex_index`. `vertex_index` - это, как номер итерации, похожий на `index` в
JavaScript's `Array.map(function(value, index) { ... })`. Если мы говорим GPU выполнить эту функцию 10 раз, вызывая `draw`, первый раз `vertex_index` будет равен `0`, второй раз будет равен `1`, третий раз будет равен `2`, и т.д...[^indices]

[^indices]:
    Мы также можем использовать индексный буфер для указания `vertex_index`.
    Это обсуждается в [статье про вершинные буферы](webgpu-vertex-buffers.html#a-index-buffers).

Наша `vs` функция объявлена, как возвращающая значение `vec4f`, которое является вектором из четырех 32-битных с плавающей точкой значений. Думайте об возвращаемом значении, как об массиве из 4 значений или объекте с 4 свойствами, как `{x: 0, y: 0, z: 0, w: 0}`. Это возвращаемое значение будет присвоено встроенному `position`. В "triangle-list" режиме, когда каждые 3 раза вершинный шейдер выполняется, будет рисоваться треугольник, соединяющий 3 `position` значения, которые мы возвращаем.

Позиции в WebGPU
Positions in WebGPU должны быть возвращены в _ограниченном пространстве_, где X считается от -1.0 слева до +1.0 вправо, и Y считается от -1.0 снизу до +1.0 вверх. Это верно в независимости от размера текстуры, которую мы рисуем.

<div class="webgpu_center"><img src="resources/clipspace.svg" style="width: 500px"></div>

`vs` функция декларирует массив из 3 значений `vec2f`. Каждые `vec2f` состоят из двух 32-битных значений с плавающей точкой.

```wgsl
        let pos = array(
          vec2f( 0.0,  0.5),  // верх центо
          vec2f(-0.5, -0.5),  // низ лево
          vec2f( 0.5, -0.5)   // низ право
        );
```

В итоге используется `vertexIndex` для возврата одного из 3 значений из массива.
Поскольку функция требует 4 значения с плавающей точкой для возвращаемого типа, и поскольку `pos` это массив из `vec2f`, добавляем `0.0` и `1.0` для оставшихся 2 значений.

```wgsl
        return vec4f(pos[vertexIndex], 0.0, 1.0);
```

Модуль шейдера также декларирует функцию с названием `fs`, которая отмечена `@fragment` атрибутом, отмечая ее, как функцию фрагментного шейдера.

```wgsl
      @fragment fn fs() -> @location(0) vec4f {
```

Функция не принимает параметров и возвращает `vec4f` в `location(0)`.

This means it will write to the first render target. We'll make the first
render target our canvas texture later.

```wgsl
        return vec4f(1, 0, 0, 1);
```

The code returns `1, 0, 0, 1` which is red. Colors in WebGPU are usually
specified as floating point values from `0.0` to `1.0` where the 4 values above
correspond to red, green, blue, and alpha respectively.

When the GPU rasterizes the triangle (draws it with pixels), it will call
the fragment shader to find out what color to make each pixel. In our case,
we're just returning red.

One more thing to note is the `label`. Nearly every object you can create with
WebGPU can take a `label`. Labels are entirely optional but it's considered
_best practice_ to label everything you make. The reason is that when you get an
error, most WebGPU implementations will print an error message that includes the
labels of the things related to the error.

In a normal app, you'd have 100s or 1000s of buffers, textures, shader modules,
pipelines, etc... If you get an error like `"WGSL syntax error in shaderModule
at line 10"`, if you have 100 shader modules, which one got the error? If you
label the module then you'll get an error more like `"WGSL syntax error in
shaderModule('our hardcoded red triangle shaders') at line 10` which is a way
more useful error message and will save you a ton of time tracking down the
issue.

Now that we've created a shader module, we next need to make a render pipeline

```js
const pipeline = device.createRenderPipeline({
  label: "our hardcoded red triangle pipeline",
  layout: "auto",
  vertex: {
    module,
    entryPoint: "vs",
  },
  fragment: {
    module,
    entryPoint: "fs",
    targets: [{ format: presentationFormat }],
  },
});
```

In this case, there isn't much to see. We set `layout` to `'auto'` which means
to ask WebGPU to derive the layout of data from the shaders. We're not using
any data though.

We then tell the render pipeline to use the `vs` function from our shader module
for a vertex shader and the `fs` function for our fragment shader. Otherwise, we
tell it the format of the first render target. "render target" means the texture
we will render to. When we create a pipeline
we have to specify the format for the texture(s) we'll use this pipeline to
eventually render to.

Element 0 for the `targets` array corresponds to location 0 as we specified for
the fragment shader's return value. Later, we'll set that target to be a texture
for the canvas.

Next up we prepare a `GPURenderPassDescriptor` which describes which textures
we want to draw to and how to use them.

```js
const renderPassDescriptor = {
  label: "our basic canvas renderPass",
  colorAttachments: [
    {
      // view: <- to be filled out when we render
      clearValue: [0.3, 0.3, 0.3, 1],
      loadOp: "clear",
      storeOp: "store",
    },
  ],
};
```

A `GPURenderPassDescriptor` has an array for `colorAttachments` which lists
the textures we will render to and how to treat them.
We'll wait to fill in which texture we actually want to render to. For now,
we set up a clear value of semi-dark gray, and a `loadOp` and `storeOp`.
`loadOp: 'clear'` specifies to clear the texture to the clear value before
drawing. The other option is `'load'` which means load the existing contents of
the texture into the GPU so we can draw over what's already there.
`storeOp: 'store'` means store the result of what we draw. We could also pass `'discard'`
which would throw away what we draw. We'll cover why we might want to do that in
[another article](webgpu-multisampling.html).

Now it's time to render.

```js
function render() {
  // Get the current texture from the canvas context and
  // set it as the texture to render to.
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  // make a command encoder to start encoding commands
  const encoder = device.createCommandEncoder({ label: "our encoder" });

  // make a render pass encoder to encode render specific commands
  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  pass.draw(3); // call our vertex shader 3 times
  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}

render();
```

First, we call `context.getCurrentTexture()` to get a texture that will appear in the
canvas. Calling `createView` gets a view into a specific part of a texture but
with no parameters, it will return the default part which is what we want in this
case. For now, our only `colorAttachment` is a texture view from our
canvas which we get via the context we created at the start. Again, element 0 of
the `colorAttachments` array corresponds to `@location(0)` as we specified for
the return value of the fragment shader.

Next, we create a command encoder. A command encoder is used to create a command
buffer. We use it to encode commands and then "submit" the command buffer it
created to have the commands executed.

We then use the command encoder to create a render pass encoder by calling `beginRenderPass`. A render
pass encoder is a specific encoder for creating commands related to rendering.
We pass it our `renderPassDescriptor` to tell it which texture we want to
render to.

We encode the command, `setPipeline`, to set our pipeline and then tell it to
execute our vertex shader 3 times by calling `draw` with 3. By default, every 3
times our vertex shader is executed a triangle will be drawn by connecting the 3
values just returned from the vertex shader.

We end the render pass, and then finish the encoder. This gives us a
command buffer that represents the steps we just specified. Finally, we submit
the command buffer to be executed.

When the `draw` command is executed, this will be our state.

<div class="webgpu_center"><img src="resources/webgpu-simple-triangle-diagram.svg" style="width: 723px;"></div>

We've got no textures, no buffers, no bindGroups but we do have a pipeline, a
vertex and fragment shader, and a render pass descriptor that tells our shader
to render to the canvas texture.

The result.

{{{example url="../webgpu-simple-triangle.html"}}}

It's important to emphasize that all of these functions we called
like `setPipeline`, and `draw` only add commands to a command buffer.
They don't actually execute the commands. The commands are executed
when we submit the command buffer to the device queue.

<a id="a-rasterization"></a>WebGPU takes every 3 vertices we return from our vertex shader and uses
them to rasterize a triangle. It does this by determining which pixels'
centers are inside the triangle. It then calls our fragment shader for
each pixel to ask what color to make it.

Imagine the texture we are rendering
to was 15x11 pixels. These are the pixels that would be drawn to

<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; max-width: 500px; width: 100%"></div>
  <div>drag the vertices</div>
</div>

So, now we've seen a very small working WebGPU example. It should be pretty
obvious that hard coding a triangle inside a shader is not very flexible. We
need ways to provide data and we'll cover those in the following articles. The
points to take away from the code above,

- WebGPU just runs shaders. It's up to you to fill them with code to do useful things
- Shaders are specified in a shader module and then turned into a pipeline
- WebGPU can draw triangles
- WebGPU draws to textures (we happened to get a texture from the canvas)
- WebGPU works by encoding commands and then submitting them.

# <a id="a-run-computations-on-the-gpu"></a>Run computations on the GPU

Let's write a basic example for doing some computation on the GPU.

We start off with the same code to get a WebGPU device.

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

Then we create a shader module.

```js
const module = device.createShaderModule({
  label: "doubling compute module",
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

First, we declare a variable called `data` of type `storage` that we want to be
able to both read from and write to.

```wgsl
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

We declare its type as `array<f32>` which means an array of 32-bit floating point
values. We tell it we're going to specify this array on binding location 0 (the
`binding(0)`) in bindGroup 0 (the `@group(0)`).

Then we declare a function called `computeSomething` with the `@compute`
attribute which makes it a compute shader.

```wgsl
      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        ...
```

Compute shaders are required to declare a workgroup size which we will cover
later. For now, we'll just set it to 1 with the attribute `@workgroup_size(1)`.
We declare it to have one parameter `id` which uses a `vec3u`. A `vec3u` is
three unsigned 32-bit integer values. Like our vertex shader above, this is the
iteration number. It's different in that compute shader iteration numbers are 3
dimensional (have 3 values). We declare `id` to get its value from the built-in
`global_invocation_id`.

You can _kind of_ think of compute shaders as running like this. This is an over
simplification but it will do for now.

```js
// pseudo code
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = { x, y, z };
        dispatchWorkgroup(workgroup_id);
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  // from @workgroup_size in WGSL
  const workgroup_size = shaderCode.workgroup_size;
  const { x: width, y: height, z: depth } = workgroup_size;
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const local_invocation_id = { x, y, z };
        const global_invocation_id =
          workgroup_id * workgroup_size + local_invocation_id;
        computeShader(global_invocation_id);
      }
    }
  }
}
```

Since we set `@workgroup_size(1)`, effectively the pseudo-code above becomes

```js
// pseudo code
function dispatchWorkgroups(width, height, depth) {
  for (z = 0; z < depth; ++z) {
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        const workgroup_id = { x, y, z };
        dispatchWorkgroup(workgroup_id);
      }
    }
  }
}

function dispatchWorkgroup(workgroup_id) {
  const global_invocation_id = workgroup_id;
  computeShader(global_invocation_id);
}
```

Finally, we use the `x` property of `id` to index `data` and multiply each value
by 2.

```wgsl
        let i = id.x;
        data[i] = data[i] * 2.0;
```

Above, `i` is just the first of the 3 iteration numbers.

Now that we've created the shader, we need to create a pipeline.

```js
const pipeline = device.createComputePipeline({
  label: "doubling compute pipeline",
  layout: "auto",
  compute: {
    module,
    entryPoint: "computeSomething",
  },
});
```

Here we just tell it we're using a `compute` stage from the shader `module` we
created and since there is only one `@compute` entry point WebGPU knows we want to call it. `layout` is
`'auto'` again, telling WebGPU to figure out the layout from the shaders. [^layout-auto]

[^layout-auto]:
    `layout: 'auto'` is convenient but it's impossible to share bind groups
    across pipelines using `layout: 'auto'`. Most of the examples on this site
    never use a bind group with multiple pipelines. We'll cover explicit layouts in [another article](webgpu-drawing-multiple-things.html).

Next, we need some data.

```js
const input = new Float32Array([1, 3, 5]);
```

That data only exists in JavaScript. For WebGPU to use it, we need to make a
buffer that exists on the GPU and copy the data to the buffer.

```js
// create a buffer on the GPU to hold our computation
// input and output
const workBuffer = device.createBuffer({
  label: "work buffer",
  size: input.byteLength,
  usage:
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
});
// Copy our input data to that buffer
device.queue.writeBuffer(workBuffer, 0, input);
```

Above, we call `device.createBuffer` to create a buffer. `size` is the size in
bytes. In this case, it will be 12 because the size in bytes of a `Float32Array` of 3
values is 12. If you're not familiar with `Float32Array` and typed arrays then
see [this article](webgpu-memory-layout.html).

Every WebGPU buffer we create has to specify a `usage`. There are a bunch of
flags we can pass for usage but not all of them can be used together. Here we
say we want this buffer to be usable as `storage` by passing
`GPUBufferUsage.STORAGE`. This makes it compatible with `var<storage,...>` from
the shader. Further, we want to be able to copy data to this buffer so we include
the `GPUBufferUsage.COPY_DST` flag. And finally, we want to be able to copy data
from the buffer so we include `GPUBufferUsage.COPY_SRC`.

Note that you can not directly read the contents of a WebGPU buffer from
JavaScript. Instead, you have to "map" it which is another way of requesting
access to the buffer from WebGPU because the buffer might be in use and because
it might only exist on the GPU.

WebGPU buffers that can be mapped in JavaScript can't be used for much else. In
other words, we can not map the buffer we just created above and if we try to add
the flag to make it mappable, we'll get an error that it is not compatible with
usage `STORAGE`.

So, in order to see the result of our computation, we'll need another buffer.
After running the computation, we'll copy the buffer above to this result buffer
and set its flags so we can map it.

```js
// create a buffer on the GPU to get a copy of the results
const resultBuffer = device.createBuffer({
  label: "result buffer",
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});
```

`MAP_READ` means we want to be able to map this buffer for reading data.

In order to tell our shader about the buffer we want it to work on, we need to
create a bindGroup.

```js
// Setup a bindGroup to tell the shader which
// buffer to use for the computation
const bindGroup = device.createBindGroup({
  label: "bindGroup for work buffer",
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: workBuffer } }],
});
```

We get the layout for the bindGroup from the pipeline. Then we set up bindGroup
entries. The 0 in `pipeline.getBindGroupLayout(0)` corresponds to the
`@group(0)` in the shader. The `{binding: 0 ...` of the `entries` corresponds to
the `@group(0) @binding(0)` in the shader.

Now we can start encoding commands.

```js
// Encode commands to do the computation
const encoder = device.createCommandEncoder({
  label: "doubling encoder",
});
const pass = encoder.beginComputePass({
  label: "doubling compute pass",
});
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(input.length);
pass.end();
```

We create a command encoder. We start a compute pass. We set the pipeline, then
we set the bindGroup. Here, the `0` in `pass.setBindGroup(0, bindGroup)`
corresponds to `@group(0)` in the shader. We then call `dispatchWorkgroups` and in
this case, we pass it `input.length` which is `3` telling WebGPU to run the
compute shader 3 times. We then end the pass.

Here's what the situation will be when `dispatchWorkgroups` is executed.

<div class="webgpu_center"><img src="resources/webgpu-simple-compute-diagram.svg" style="width: 553px;"></div>

After the computation is finished we ask WebGPU to copy from `workBuffer` to
`resultBuffer`.

```js
// Encode a command to copy the results to a mappable buffer.
encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);
```

Now we can `finish` the encoder to get a command buffer and then submit that
command buffer.

```js
// Finish encoding and submit the commands
const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);
```

We then map the results buffer and get a copy of the data.

```js
// Read the results
await resultBuffer.mapAsync(GPUMapMode.READ);
const result = new Float32Array(resultBuffer.getMappedRange());

console.log("input", input);
console.log("result", result);

resultBuffer.unmap();
```

To map the results buffer, we call `mapAsync` and have to `await` for it to
finish. Once mapped, we can call `resultBuffer.getMappedRange()` which with no
parameters will return an `ArrayBuffer` of the entire buffer. We put that in a
`Float32Array` typed array view and then we can look at the values. One
important detail, the `ArrayBuffer` returned by `getMappedRange` is only valid
until we call `unmap`. After `unmap`, its length will be set to 0 and its data
no longer accessible.

Running that we can see we got the result back, all the numbers have been
doubled.

{{{example url="../webgpu-simple-compute.html"}}}

We'll cover how to really use compute shaders in other articles. For now, you
hopefully have gleaned some understanding of what WebGPU does. EVERYTHING ELSE
IS UP TO YOU! Think of WebGPU as similar to other programming languages. It
provides a few basic features and leaves the rest to your creativity.

What makes WebGPU programming special is these functions, vertex shaders,
fragment shaders, and compute shaders, run on your GPU. A GPU could have over
10000 processors which means they can potentially do more than 10000
calculations in parallel which is likely 3 or more orders of magnitude than your
CPU can do in parallel.

## <a id="a-resizing"></a> Simple Canvas Resizing

Before we move on, let's go back to our triangle drawing example and add some
basic support for resizing a canvas. Sizing a canvas is actually a topic that
can have many subtleties so [there is an entire article on it](webgpu-resizing-the-canvas.html).
For now though let's just add some basic support.

First, we'll add some CSS to make our canvas fill the page.

```html
<style>
  html,
  body {
    margin: 0; /* remove the default margin          */
    height: 100%; /* make the html,body fill the page   */
  }
  canvas {
    display: block; /* make the canvas act like a block   */
    width: 100%; /* make the canvas fill its container */
    height: 100%;
  }
</style>
```

That CSS alone will make the canvas get displayed to cover the page but it won't change
the resolution of the canvas itself so you might notice, if you make the example below
large, like if you click the full-screen button, you'll see the edges of the triangle
are blocky.

{{{example url="../webgpu-simple-triangle-with-canvas-css.html"}}}

`<canvas>` tags, by default, have a resolution of 300x150 pixels. We'd like to
adjust the resolution of the canvas to match the size it is displayed.
One good way to do this is with a `ResizeObserver`. You create a
`ResizeObserver` and give it a function to call whenever the elements you've
asked it to observe change their size. You then tell it which elements to
observe.

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
+        // re-render
+        render();
+      }
+    });
+    observer.observe(canvas);
```

In the code above, we go over all the entries but there should only ever be one
because we're only observing our canvas. We need to limit the size of the canvas
to the largest size our device supports otherwise WebGPU will start generating
errors that we tried to make a texture that is too large. We also need to make
sure it doesn't go to zero or again we'll get errors.
[See the longer article for details](webgpu-resizing-the-canvas.html).

We call `render` to re-render the
triangle at the new resolution. We removed the old call to `render` because
it's not needed. A `ResizeObserver` will always call its callback at least once
to report the size of the elements when they started being observed.

The new size texture is created when we call `context.getCurrentTexture()`
inside `render` so there's nothing left to do.

{{{example url="../webgpu-simple-triangle-with-canvas-resize.html"}}}

In the following articles, we'll cover various ways to pass data into shaders.

- [inter-stage variables](webgpu-inter-stage-variables.html)
- [uniforms](webgpu-uniforms.html)
- [storage buffers](webgpu-storage-buffers.html)
- [vertex buffers](webgpu-vertex-buffers.html)
- [textures](webgpu-textures.html)
- [constants](webgpu-constants.html)

Then we'll cover [the basics of WGSL](webgpu-wgsl.html).

This order is from the simplest to the most complex. Inter-stage variables
require no external setup to explain. We can see how to use them using nothing
but changes to the WGSL we used above. Uniforms are effectively global variables
and as such are used in all 3 kinds of shaders (vertex, fragment, and compute).
Going from uniform buffers to storage buffers is trivial as shown at the top of
the article on storage buffers. Vertex buffers are only used in vertex shaders.
They are more complex because they require describing the data layout to WebGPU.
Textures are the most complex as they have tons of types and options.

I'm a little bit worried these articles will be boring at first. Feel free to
jump around if you'd like. Just remember if you don't understand something you
probably need to read or review these basics. Once we get the basics down, we'll
start going over actual techniques.

One other thing. All of the example programs can be edited live in the webpage.
Further, they can all easily be exported to [jsfiddle](https://jsfiddle.net) and [codepen](https://codepen.io)
and even [stackoverflow](https://stackoverflow.com). Just click "Export".

<div class="webgpu_bottombar">
<p>
The code above gets a WebGPU device in a very terse way. A more verbose
way would be something like
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

    // 'reason' will be 'destroyed' if we intentionally destroy the device.
    if (info.reason !== 'destroyed') {
      // try again
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
<code>device.lost</code> is a promise that starts off unresolved. It will resolve if and when the
device is lost. A device can be lost for many reasons. Maybe the user ran a really intensive
app and it crashed their GPU. Maybe the user updated their drivers. Maybe the user has
an external GPU and unplugged it. Maybe another page used a lot of GPU, your
tab was in the background and the browser decided to free up some memory by
losing the device for background tabs. The point to take away is that for any serious
apps you probably want to handle losing the device.
</p>
<p>
Note that <code>requestDevice</code> always returns a device. It just might start lost.
WebGPU is designed so that, for the most part, the device will appear to work,
at least from an API level. Calls to create things and use them will appear
to succeed but they won't actually function. It's up to you to take action
when the <code>lost</code> promise resolves.
</p>
</div>

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-fundamentals.js"></script>

f
