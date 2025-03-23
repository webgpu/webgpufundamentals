Title: Буфери вершин в WebGPU
Description: Передача даних вершин в шейдери
TOC: Буфери вершин

В [попередній статті](webgpu-storage-buffers.html) ми помістили дані
вершин в буфер зберігання і проіндексували їх з допомогою вбудованої
змінної `vertex_index`. Не зважаючи на те, що ця техніка набуває
популярності, більш традиційним підходом вважається передача даних
вершин у шейдер з допомогою буферів вершин та атрибутів.

Буфери вершин є схожими на будь-які інші буфери в WebGPU - вони
зберігають дані. Основна різниця полягає в тому, що ми не маємо
до них прямого доступу з вершинного шейдера. Натомість, ми вказуємо
WebGPU на тип даних, який ми помістили в цей буфер і на те, як
вони розміщенні. Після цього WebGPU автоматично дістає ці дані
з буфера і надає їх нам.

Візьмемо для прикладу наш код з 
[попередньої статті](webgpu-storage-buffers.html)
і змінимо в ньому використання буфера зберігання на використання
буфера вершин.

Спершу нам потрібно змінити шейдер таким чином, щоб він отримував
інформацію про вершини з буфера вершин.

```wgsl
struct OurStruct {
  color: vec4f,
  offset: vec2f,
};

struct OtherStruct {
  scale: vec2f,
};

struct Vertex {
-  position: vec2f,
+  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;
-@group(0) @binding(2) var<storage, read> pos: array<Vertex>;

@vertex fn vs(
-  @builtin(vertex_index) vertexIndex : u32,
+  vert: Vertex,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let otherStruct = otherStructs[instanceIndex];
  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
  vsOut.position = vec4f(
-      pos[vertexIndex].position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
+      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
  vsOut.color = ourStruct.color;
  return vsOut;
}

...
```

Як ви можете бачити, це невеликі зміни. Важливим тут є декларування
поля `position` з атрибутом `@location(0)`.

Далі ми миємо вказати WebGPU, як отримати дані для `@location(0)` - 
для цього ми можемо використати пайплайн рендерингу:

```js
  const pipeline = device.createRenderPipeline({
    label: 'vertex buffer pipeline',
    layout: 'auto',
    vertex: {
      module,
+      buffers: [
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          attributes: [
+            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+          ],
+        },
+      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

До поля [`vertex`](GPUVertexState) 
[дескриптора пайплайну](GPURenderPipelineDescriptor) ми додали
масив `buffers`, який використовується для опису отримання даних
з одного чи більше буферів вершин. Для нашого першого і єдиного 
буфера ми встановлюємо значення `arrayStride` як кількість байтів.
we added a `buffers` array which is used to describe how to pull data out of 1 or more vertex buffers. *stride* або ж *крок* в цьому випадку
визначає як багато байтів потрібно взяти з набору даних для однієї
вершини з нашого буфера.

<div class="webgpu_center"><img src="resources/vertex-buffer-one.svg" style="width: 1024px;"></div>

Оскільки наші дані мають тип `vec2f`, що по суті є двома `float32`
числами, ми встановлюємо в значення `arrayStride` число 8. 

Далі ми оголошуємо масив атрибутів. Ми маємо тільки один атрибут.
`shaderLocation: 0` відповідає атрибуту `location(0)` в нашій 
структурі `Vertex`. `offset: 0` позначає, що дані для цього
атрибуту починаються з нульового байту в буфері вершин. І нарешті
`format: 'float32x2'` позначає те, що ми просимо WebGPU витягнути
дані з буфера у форматі двох 32-бітних чисел з рухомою комою. (Нотатка: властивість `attributes` показана на 
[спрощеній діаграмі малювання](webgpu-fundamentals.html#a-draw-diagram) з першої статті).

Тепер ми маємо змінити тип використання буфера, який міститиме 
вершини з `STORAGE` на `VERTEX` і видалити його з групи прив’язки.

```js
-  const vertexStorageBuffer = device.createBuffer({
-    label: 'storage buffer vertices',
-    size: vertexData.byteLength,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
-  });
+  const vertexBuffer = device.createBuffer({
+    label: 'vertex buffer vertices',
+    size: vertexData.byteLength,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const bindGroup = device.createBindGroup({
    label: 'bind group for objects',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: staticStorageBuffer }},
      { binding: 1, resource: { buffer: changingStorageBuffer }},
-      { binding: 2, resource: { buffer: vertexStorageBuffer }},
    ],
  });
```

І після цього, в момент перед малюванням, ми повинні вказати
WebGPU на той буфер вершин, який він має використати.

```js
    pass.setPipeline(pipeline);
+    pass.setVertexBuffer(0, vertexBuffer);
```

Значення `0` тут відповідає першому елементу з пайплайну рендерингу `buffers`, який ми визначили вище.

З усім цим, ми перейшли з використання буферу зберігання на буфер
вершин.

{{{example url="../webgpu-vertex-buffers.html"}}}

Стан системи після того, коли команда `draw` виконана, буде виглядати так:

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram-vertex-buffer.svg" style="width: 960px;"></div>

Поле атрибуту `format` може мати один із цих типів:

<div class="webgpu_center data-table">
  <style>
    .vertex-type {
      text-align: center;
    }
  </style>
  <div>
  <table class="vertex-type">
    <thead>
     <tr>
      <th>Vertex format</th>
      <th>Data type</th>
      <th>Components</th>
      <th>Byte size</th>
      <th>Example WGSL type</th>
     </tr>
    </thead>
    <tbody>
      <tr><td><code>"uint8x2"</code></td><td>unsigned int </td><td>2 </td><td>2 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint8x4"</code></td><td>unsigned int </td><td>4 </td><td>4 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint8x2"</code></td><td>signed int </td><td>2 </td><td>2 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint8x4"</code></td><td>signed int </td><td>4 </td><td>4 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm8x2"</code></td><td>unsigned normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm8x4"</code></td><td>unsigned normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm8x2"</code></td><td>signed normalized </td><td>2 </td><td>2 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm8x4"</code></td><td>signed normalized </td><td>4 </td><td>4 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint16x2"</code></td><td>unsigned int </td><td>2 </td><td>4 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint16x4"</code></td><td>unsigned int </td><td>4 </td><td>8 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint16x2"</code></td><td>signed int </td><td>2 </td><td>4 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint16x4"</code></td><td>signed int </td><td>4 </td><td>8 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
      <tr><td><code>"unorm16x2"</code></td><td>unsigned normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"unorm16x4"</code></td><td>unsigned normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"snorm16x2"</code></td><td>signed normalized </td><td>2 </td><td>4 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"snorm16x4"</code></td><td>signed normalized </td><td>4 </td><td>8 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"float16x2"</code></td><td>float </td><td>2 </td><td>4 </td><td><code>vec2&lt;f16&gt;</code>, <code>vec2h</code></td></tr>
      <tr><td><code>"float16x4"</code></td><td>float </td><td>4 </td><td>8 </td><td><code>vec4&lt;f16&gt;</code>, <code>vec4h</code></td></tr>
      <tr><td><code>"float32"</code></td><td>float </td><td>1 </td><td>4 </td><td><code>f32</code></td></tr>
      <tr><td><code>"float32x2"</code></td><td>float </td><td>2 </td><td>8 </td><td><code>vec2&lt;f32&gt;</code>, <code>vec2f</code></td></tr>
      <tr><td><code>"float32x3"</code></td><td>float </td><td>3 </td><td>12 </td><td><code>vec3&lt;f32&gt;</code>, <code>vec3f</code></td></tr>
      <tr><td><code>"float32x4"</code></td><td>float </td><td>4 </td><td>16 </td><td><code>vec4&lt;f32&gt;</code>, <code>vec4f</code></td></tr>
      <tr><td><code>"uint32"</code></td><td>unsigned int </td><td>1 </td><td>4 </td><td><code>u32</code></td></tr>
      <tr><td><code>"uint32x2"</code></td><td>unsigned int </td><td>2 </td><td>8 </td><td><code>vec2&lt;u32&gt;</code>, <code>vec2u</code></td></tr>
      <tr><td><code>"uint32x3"</code></td><td>unsigned int </td><td>3 </td><td>12 </td><td><code>vec3&lt;u32&gt;</code>, <code>vec3u</code></td></tr>
      <tr><td><code>"uint32x4"</code></td><td>unsigned int </td><td>4 </td><td>16 </td><td><code>vec4&lt;u32&gt;</code>, <code>vec4u</code></td></tr>
      <tr><td><code>"sint32"</code></td><td>signed int </td><td>1 </td><td>4 </td><td><code>i32</code></td></tr>
      <tr><td><code>"sint32x2"</code></td><td>signed int </td><td>2 </td><td>8 </td><td><code>vec2&lt;i32&gt;</code>, <code>vec2i</code></td></tr>
      <tr><td><code>"sint32x3"</code></td><td>signed int </td><td>3 </td><td>12 </td><td><code>vec3&lt;i32&gt;</code>, <code>vec3i</code></td></tr>
      <tr><td><code>"sint32x4"</code></td><td>signed int </td><td>4 </td><td>16 </td><td><code>vec4&lt;i32&gt;</code>, <code>vec4i</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

## <a id="a-instancing"></a>Створення екземплярів з допомогою буферів вершин

Атрибути можуть передаватись як для кожної вершини так і для кожного екземпляру.
Передавання для кожного екземпляру це практично те ж, що ми і робимо, коли
індексуємо `otherStructs[instanceIndex]` та `ourStructs[instanceIndex]`, де
`instanceIndex` отримує своє значення з `@builtin(instance_index)`.

Давайте позбавимось від буферів зберігання і використаємо буфери вершин для
отримання того ж результату. Спершу давайте змінимо шейдер так, щоб використовувати
атрибути вершин замість буферів зберігання.

```wgsl
-struct OurStruct {
-  color: vec4f,
-  offset: vec2f,
-};
-
-struct OtherStruct {
-  scale: vec2f,
-};

struct Vertex {
  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

-@group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
-@group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

@vertex fn vs(
  vert: Vertex,
-  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
-  let otherStruct = otherStructs[instanceIndex];
-  let ourStruct = ourStructs[instanceIndex];

  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * otherStruct.scale + ourStruct.offset, 0.0, 1.0);
-  vsOut.color = ourStruct.color;
+  vsOut.position = vec4f(
+      vert.position * vert.scale + vert.offset, 0.0, 1.0);
+  vsOut.color = vert.color;
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

Тепер ми повинні оновити наш пайплайн рендерингу для того, щоб
вказати на те, як ми хочемо надавати дані для цих атрибутів.
Для того, щоб зберегти кількість змін в коді мінімальною,
ми використаємо дані, які ми створили для буферів зберігання.
Ми використаємо два буфери: один буде зберігати значення `color` та
`offset` для кожного екземпляра, а інший буде зберігати значення
`scale`.

```js
  const pipeline = device.createRenderPipeline({
    label: 'flat colors',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
          ],
        },
+        {
+          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
+            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+          ],
+        },
+        {
+          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          stepMode: 'instance',
+          attributes: [
+            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
+          ],
+        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

Вище ми додали 2 нових записи в масив `buffers` в нашому описі пайплайну тож
ми отримали 3 записи в буфері. Це означає, що ми вказуємо WebGPU на те, що 
ми передаватимемо дані в 3 буферах.

Для двох нових записів ви встановили значення `stepMode` як `instance`. Це
означає, що атрибут буде оновлюватись до наступного значення раз на кожен
екземпляр. За замовчуванням `stepMode` має значення `vertex`, що вказує на
те, що оновлювати атрибут потрібно для кожної вершини (і починати заново 
для кожного екземпляра). 


Ми маємо 2 буфера. Один містить в собі лише значення `scale`. Як і наш
перший буфер, який містить значення `position`, він являє собою
два 32-бітних числа з рухомою комою на кожну вершину.

Два наступних буфери містять в собі значення `color` і `offset` та будуть
переплетені в таку на вигляд структуру даних:

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x4-f32x2.svg" style="width: 1024px;"></div>


Вище ми вказуємо на те, що значення `arrayStride`, яке позначає відстань
між наборами даних, дорівнює `6 * 4`, або ж 6 32-бітових чисел з рухомою
комою по 4 байти кожен (24 байти разом). Значення `color` має зміщення
0, коли значення `offset` починається після 16 байту.

Далі, ми можемо змінити код та створити ці буфери.

```js
  // create 2 storage buffers
  const staticUnitSize =
    4 * 4 + // color is 4 32bit floats (4bytes each)
-    2 * 4 + // offset is 2 32bit floats (4bytes each)
-    2 * 4;  // padding
+    2 * 4;  // offset is 2 32bit floats (4bytes each)

  const changingUnitSize =
    2 * 4;  // scale is 2 32bit floats (4bytes each)
*  const staticVertexBufferSize = staticUnitSize * kNumObjects;
*  const changingVertexBufferSize = changingUnitSize * kNumObjects;

*  const staticVertexBuffer = device.createBuffer({
*    label: 'static vertex for objects',
*    size: staticVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

*  const changingVertexBuffer = device.createBuffer({
*    label: 'changing vertex for objects',
*    size: changingVertexBufferSize,
-    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
+    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

```

Атрибути вершин не мають такі самі обмеження по вирівнюванню, як структури
в буферах зберігання, тому нам більше не потрібні ці вирівнювання. Все, що
ми тут зробили це зміна значення `usage` з `STORAGE` на `VERTEX` (ну і ми
також змінили назви змінних з "storage" на "vertex").

Оскільки ми більше не використовуємо буфери зберігання, нам більше не
потрібна група прив'язки:

```js
-  const bindGroup = device.createBindGroup({
-    label: 'bind group for objects',
-    layout: pipeline.getBindGroupLayout(0),
-    entries: [
-      { binding: 0, resource: { buffer: staticStorageBuffer }},
-      { binding: 1, resource: { buffer: changingStorageBuffer }},
-    ],
-  });
```

На сам кінець, ми не потребуємо встановлення групи прив'язки, але
потрібно встановити буфери вершин:

```js
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
+    pass.setVertexBuffer(1, staticVertexBuffer);
+    pass.setVertexBuffer(2, changingVertexBuffer);

    ...
-    pass.setBindGroup(0, bindGroup);
    pass.draw(numVertices, kNumObjects);

    pass.end();
```

Перший параметр в `setVertexBuffer` відповідає запису в масиві `buffers` в
пайплайні, який ми створили вище.

З усім цим ми отримали той самий результат, який ми і мали раніше, але
з використанням буферів вершин замість буферів зберігання.

{{{example url="../webgpu-vertex-buffers-instanced-colors"}}}

Давайте, суто для розваги, додамо ще один атрибут для кольору кожної вершини.
Спершу давайте змінимо шейдер: 

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color;
+  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}

@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  return vsOut.color;
}
```

Далі нам потрібно оновити пайплайн для того, щоб описати, як ми 
будемо надавати ці дані. Ми збираємось переплести дані `perVertexColor` з
даними `position` так, як на малюнку: 

<div class="webgpu_center"><img src="resources/vertex-buffer-mixed.svg" style="width: 1024px;"></div>

Тому, значення кроку `arrayStride` повинне бути змінене для відображення нашої
нової структури даних. Нові дані починаються після двох 32-бітних чисел
з рухомою комою, тому їхнє зміщення `offset` буде дорівнювати 8 байтам.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 2 * 4, // 2 floats, 4 bytes each
+          arrayStride: 5 * 4, // 5 floats, 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
+            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
          ],
        },
        {
          arrayStride: 6 * 4, // 6 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

Ми оновимо код генерації вершин кола для надання темних кольорів
для вершин на зовнішньому боці кола і світлих кольорів на внутрішньому
боці.

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // 2 triangles per subdivision, 3 verts per tri, 5 values (xyrgb) each.
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * 2);
+  const vertexData = new Float32Array(numVertices * (2 + 3));

  let offset = 0;
-  const addVertex = (x, y) => {
+  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
+    vertexData[offset++] = r;
+    vertexData[offset++] = g;
+    vertexData[offset++] = b;
  };

+  const innerColor = [1, 1, 1];
+  const outerColor = [0.1, 0.1, 0.1];

  // 2 triangles per subdivision
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; ++i) {
    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;

    const c1 = Math.cos(angle1);
    const s1 = Math.sin(angle1);
    const c2 = Math.cos(angle2);
    const s2 = Math.sin(angle2);

    // first triangle
-    addVertex(c1 * radius, s1 * radius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c1 * innerRadius, s1 * innerRadius);
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);

    // second triangle
-    addVertex(c1 * innerRadius, s1 * innerRadius);
-    addVertex(c2 * radius, s2 * radius);
-    addVertex(c2 * innerRadius, s2 * innerRadius);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+    addVertex(c2 * radius, s2 * radius, ...outerColor);
+    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
  }

  return {
    vertexData,
    numVertices,
  };
}
```

І з усім цим ми отримуємо затемненні кола:

{{{example url="../webgpu-vertex-buffers-per-vertex-colors.html"}}}

## <a id="a-default-values"></a>Атрибути в WGSL не зобов'язані повторювати атрибути в JavaScript

Вище ми задекларували значення атрибуту `perVertexColor` в WGSL як `vec3f`:

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
*  @location(4) perVertexColor: vec3f,
};
```

І використали його таким чином:

```wgsl
@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
*  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
  return vsOut;
}
```

Ми також могли б задекларувати його як `vec4f` і використати таким чином:

```wgsl
struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
-  @location(4) perVertexColor: vec3f,
+  @location(4) perVertexColor: vec4f,
};

...

@vertex fn vs(
  vert: Vertex,
) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = vec4f(
      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.color = vert.color * vert.perVertexColor;
  return vsOut;
}
```

І більше нічого не змінювати. В JavaScript ми б могли досі передавати
дані як три 32-бітних числа з рухомою комою на кожну вершину.

```js
    {
      arrayStride: 5 * 4, // 5 floats, 4 bytes each
      attributes: [
        {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
*        {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
      ],
    },
```

Це працює тому, що атрибути завжди мають 4 значення доступних в шейдері.
Їхні типові значення `0, 0, 0, 1`, тому кожне значення, яке ми не передали
отримує одне з типових значень.

{{{example url="../webgpu-vertex-buffers-per-vertex-colors-3-in-4-out.html"}}}

## <a id="a-normalized-attributes"></a>Використання нормалізованих значень для зберігання даних

Ми використовуємо 32-бітні числа з рухомою комою для кольорів. Кожен 
`perVertexColor` містить 3 значення загальним розміром 12 байт для кожного
кольору кожної вершини. Кожен `color` має 4 значення, які в сумі дають
16 байт для кожного кольору кожного екземпляру.

Ми б могли оптимізувати це використовуючи 8-бітні значення і вказуючи 
WebGPU, щоб він нормалізував ці значення з 0 ↔ 255 до 0.0 ↔ 1.0.

Переглянувши список валідних форматів атрибутів, ми не знайдемо 3-значного 
8-бітного формату, але ми маємо `'unorm8x4'`. Тому давайте використаємо його.

Спершу давайте змінимо код, який генерує вершини для зберігання кольорів, як
8-бітні значення, які будуть нормалізовані:

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 2 triangles per subdivision, 3 verts per tri, 5 values (xyrgb) each.
+  // 2 triangles per subdivision, 3 verts per tri
  const numVertices = numSubdivisions * 3 * 2;
-  const vertexData = new Float32Array(numVertices * (2 + 3));
+  // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb_)
+  // The 32-bit color value will be written/read as 4 8-bit values
+  const vertexData = new Float32Array(numVertices * (2 + 1));
+  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
+  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
-    vertexData[offset++] = r;
-    vertexData[offset++] = g;
-    vertexData[offset++] = b;
+    offset += 1;  // skip the color
+    colorData[colorOffset++] = r * 255;
+    colorData[colorOffset++] = g * 255;
+    colorData[colorOffset++] = b * 255;
+    colorOffset += 9;  // skip extra byte and the position
  };
```
Вище ми робимо `colorData`, яке є `Uint8Array` відображенням тих самих
даних як і `vertexData`. Перегляньте [статтю про схему розміщення даних](webgpu-memory-layout.html#multiple-views-of-the-same-arraybuffer) якшо це не до кінця зрозуміло.

Далі ми використовуємо `colorData` для отримання кольорів, перетворюючи
їх з 0 ↔ 1 до 0 ↔ 255.

Розміщення даних в пам'яті (для кожної вершини) виглядає так:

<div class="webgpu_center"><img src="resources/vertex-buffer-f32x2-u8x4.svg" style="width: 1024px;"></div>

Нам потрібно також оновити дані для кожного екземпляру.

```js
  const kNumObjects = 100;
  const objectInfos = [];

  // create 2 vertex buffers
  const staticUnitSize =
-    4 * 4 + // color is 4 32bit floats (4bytes each)
+    4 +     // color is 4 bytes
    2 * 4;  // offset is 2 32bit floats (4bytes each)
  const changingUnitSize =
    2 * 4;  // scale is 2 32bit floats (4bytes each)
  const staticVertexBufferSize = staticUnitSize * kNumObjects;
  const changingVertexBufferSize = changingUnitSize * kNumObjects;

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const changingVertexBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // offsets to the various uniform values in float32 indices
  const kColorOffset = 0;
  const kOffsetOffset = 1;

  const kScaleOffset = 0;

  {
-    const staticVertexValues = new Float32Array(staticVertexBufferSize / 4);
+    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
+    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer);
    for (let i = 0; i < kNumObjects; ++i) {
-      const staticOffset = i * (staticUnitSize / 4);
+      const staticOffsetU8 = i * staticUnitSize;
+      const staticOffsetF32 = staticOffsetU8 / 4;

      // These are only set once so set them now
-      staticVertexValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset);        // set the color
-      staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset);      // set the offset
+      staticVertexValuesU8.set(        // set the color
+          [rand() * 255, rand() * 255, rand() * 255, 255],
+          staticOffsetU8 + kColorOffset);
+
+      staticVertexValuesF32.set(      // set the offset
+          [rand(-0.9, 0.9), rand(-0.9, 0.9)],
+          staticOffsetF32 + kOffsetOffset);

      objectInfos.push({
        scale: rand(0.2, 0.5),
      });
    }
    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32);
  }
```

Розміщення даних в пам'яті для кожного екземпляру виглядає так:

<div class="webgpu_center"><img src="resources/vertex-buffer-u8x4-f32x2.svg" style="width: 1024px;"></div>

Далі нам потрібно змінити пайплайн для отримання даних у вигляді 8-бітних
беззнакових значень для нормалізації їх назад у вигляд 0 ↔ 1, оновити зміщення
та оновити крок для нового значення розміру.

```js
  const pipeline = device.createRenderPipeline({
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: 5 * 4, // 5 floats, 4 bytes each
+          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x2'},  // position
-            {shaderLocation: 4, offset: 8, format: 'float32x3'},  // perVertexColor
+            {shaderLocation: 4, offset: 8, format: 'unorm8x4'},   // perVertexColor
          ],
        },
        {
-          arrayStride: 6 * 4, // 6 floats, 4 bytes each
+          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
-            {shaderLocation: 1, offset:  0, format: 'float32x4'},  // color
-            {shaderLocation: 2, offset: 16, format: 'float32x2'},  // offset
+            {shaderLocation: 1, offset: 0, format: 'unorm8x4'},   // color
+            {shaderLocation: 2, offset: 4, format: 'float32x2'},  // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 3, offset: 0, format: 'float32x2'},   // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });
```

З усім цим ми зберегли трохи пам'яті. Ми використовували 20 байт на
кожну вершину раніше, а тепер лише 12 байт, на 40% менше. Також ми використовували 24 байти на кожен екземпляр, а тепер це 12 байт, шо дає
50% економії.

{{{example url="../webgpu-vertex-buffers-8bit-colors.html"}}}

Зауважте, що ми не мусимо використовувати структури. Це працюватиме також:

```WGSL
@vertex fn vs(
-  vert: Vertex,
+  @location(0) position: vec2f,
+  @location(1) color: vec4f,
+  @location(2) offset: vec2f,
+  @location(3) scale: vec2f,
+  @location(4) perVertexColor: vec3f,
) -> VSOutput {
  var vsOut: VSOutput;
-  vsOut.position = vec4f(
-      vert.position * vert.scale + vert.offset, 0.0, 1.0);
-  vsOut.color = vert.color * vec4f(vert.perVertexColor, 1);
+  vsOut.position = vec4f(
+      position * scale + offset, 0.0, 1.0);
+  vsOut.color = color * vec4f(perVertexColor, 1);
  return vsOut;
}
```

І знову ж таки, усе про що переймається WebGPU, це те чи ми
оголосили `locations` в шейдері і чи передали дані для цих локацій
через API.

## <a id="a-index-buffers"></a>Буфери індексів

Ще одна річ, про яку варто тут поговорити це буфери індексів.
Буфери індексів описують порядок обробки і використання вершин.

Можна вважать, що команда `draw` проходиться по вершинах в
такому порядку:

```
0, 1, 2, 3, 4, 5, .....
```

З допомогою буфера індексів ми можемо змінити цей порядок.

Ми створюємо 6 вершин для частини кола попри те, що дві з цих вершин
ідентичні.

<div class="webgpu_center"><img src="resources/vertices-non-indexed.svg" style="width: 400px"></div>  

Натомість тепер ми будемо створювати тільки 4 вершини і 
використаємо індекси для того, щоб використати їх 6 разів
вказуючи WebGPU на такий порядок використання цих вершин:

```
0, 1, 2, 2, 1, 3, ...
```

<div class="webgpu_center"><img src="resources/vertices-indexed.svg" style="width: 400px"></div>

```js
function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
-  // 2 triangles per subdivision, 3 verts per tri
-  const numVertices = numSubdivisions * 3 * 2;
+  // 2 vertices at each subdivision, + 1 to wrap around the circle.
+  const numVertices = (numSubdivisions + 1) * 2;
  // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb)
  // The 32-bit color value will be written/read as 4 8-bit values
  const vertexData = new Float32Array(numVertices * (2 + 1));
  const colorData = new Uint8Array(vertexData.buffer);

  let offset = 0;
  let colorOffset = 8;
  const addVertex = (x, y, r, g, b) => {
    vertexData[offset++] = x;
    vertexData[offset++] = y;
    offset += 1;  // skip the color
    colorData[colorOffset++] = r * 255;
    colorData[colorOffset++] = g * 255;
    colorData[colorOffset++] = b * 255;
    colorOffset += 9;  // skip extra byte and the position
  };
  const innerColor = [1, 1, 1];
  const outerColor = [0.1, 0.1, 0.1];

-  // 2 triangles per subdivision
-  //
-  // 0--1 4
-  // | / /|
-  // |/ / |
-  // 2 3--5
-  for (let i = 0; i < numSubdivisions; ++i) {
-    const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
-    const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;
-
-    const c1 = Math.cos(angle1);
-    const s1 = Math.sin(angle1);
-    const c2 = Math.cos(angle2);
-    const s2 = Math.sin(angle2);
-
-    // first triangle
-    addVertex(c1 * radius, s1 * radius, ...outerColor);
-    addVertex(c2 * radius, s2 * radius, ...outerColor);
-    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
-
-    // second triangle
-    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
-    addVertex(c2 * radius, s2 * radius, ...outerColor);
-    addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
-  }
+  // 2 triangles per subdivision
+  //
+  // 0  2  4  6  8 ...
+  //
+  // 1  3  5  7  9 ...
+  for (let i = 0; i <= numSubdivisions; ++i) {
+    const angle = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
+
+    const c1 = Math.cos(angle);
+    const s1 = Math.sin(angle);
+
+    addVertex(c1 * radius, s1 * radius, ...outerColor);
+    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
+  }

+  const indexData = new Uint32Array(numSubdivisions * 6);
+  let ndx = 0;
+
+  // 1st tri  2nd tri  3rd tri  4th tri
+  // 0 1 2    2 1 3    2 3 4    4 3 5
+  //
+  // 0--2        2     2--4        4  .....
+  // | /        /|     | /        /|
+  // |/        / |     |/        / |
+  // 1        1--3     3        3--5  .....
+  for (let i = 0; i < numSubdivisions; ++i) {
+    const ndxOffset = i * 2;
+
+    // first triangle
+    indexData[ndx++] = ndxOffset;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 2;
+
+    // second triangle
+    indexData[ndx++] = ndxOffset + 2;
+    indexData[ndx++] = ndxOffset + 1;
+    indexData[ndx++] = ndxOffset + 3;
+  }

  return {
    vertexData,
+    indexData,
-    numVertices,
+    numVertices: indexData.length,
  };
}
```

Тепер нам потрібно створити буфер індексів:

```js
-  const { vertexData, numVertices } = createCircleVertices({
+  const { vertexData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  });
  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
+  const indexBuffer = device.createBuffer({
+    label: 'index buffer',
+    size: indexData.byteLength,
+    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
+  });
+  device.queue.writeBuffer(indexBuffer, 0, indexData);
```

Зверніть увагу, що поле `usage` має значення `INDEX`.

І нарешті нам потрібно задати цей буфер для команди `draw`:

```js
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, staticVertexBuffer);
    pass.setVertexBuffer(2, changingVertexBuffer);
+    pass.setIndexBuffer(indexBuffer, 'uint32');
```

Через те, що наш буфер містить 32-бітні беззнакові цілі числа
для позначення індексів, ми маємо передати в функцію `'uint32'`.
Ми б могли також використати 16-бітні числа і тоді ми б мали
передати тут значення `'uint16'`.

Також нам потрібно викликати метод `drawIndexed` замість `draw`:

```js
-    pass.draw(numVertices, kNumObjects);
+    pass.drawIndexed(numVertices, kNumObjects);
```

З усім цим ми зекономили трішки пам'яті і потенційно 
таку ж кількість процесорного часу під час обробки вершин
у шейдері, оскільки можливо, що GPU може повторно використовувати
вершини, які він уже обчислив.

{{{example url="../webgpu-vertex-buffers-index-buffer.html"}}}

Зверніть увагу, що ми могли б так само використати буфери
індексів у прикладі з буферами зберігання [в попередній статті](webgpu-storage-buffers.html). В цьому випадку значення 
`@builtin(vertex_index)` відповідає індексу з буфера індексів.

Далі ми розглянемо [текстури](webgpu-textures.html).


