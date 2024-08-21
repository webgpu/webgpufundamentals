Title: Схема розміщення даних в пам’яті
Description: Як підготувати та розмістити дані в WebGPU
TOC: Схема розміщення даних в пам’яті

Працюючи з WebGPU, ви повинні розмітити майже усі дані, які ви йому надаєте. 
Це потрібно для того щоб вони збігались з структурами, які ви описали
в шейдерах. Це велика відмінність від того як працюють JavaScript
та TypeScript, де проблеми з розміщенням даних виникають рідко. 

Коли ви пишете свій шейдер на WGSL, то зазвичай описуєте якісь структури.
Структури (`struct`) схожі на JavaScript об’єкти. Ви оголошуєте
поле структури схожим чином до того, як оголошується властивість
об’єкта в JavaScript. Але, окрім надання усім властивостям імен,
ви також повинні вказати їхній тип. Передаючи певні дані в WebGPU,
**ви відповідаєте** за те, щоб вирахувати конкретне місце кожного
поля вашої структури в буфері, який ви передасте.

В [WGSL](webgpu-wgsl.html) версії v1, є чотири базових типи:

* `f32` (32-бітне число з рухомою комою)
* `i32` (32-бітне ціле число)
* `u32` (32-бітне беззнакове ціле число)
* `f16` (16-бітне число з рухомою комою) [^f16-optional]

[^f16-optional]: підтримка типу `f16` це [опціональна можливість](webgpu-limits-and-features.html)

Один байт це 8 бітів, тому 32-бітне значення займе 4 байти, а 16-бітне -
2 байти.

Якщо ми оголосимо таку структуру:

```wgsl
struct OurStruct {
  velocity: f32,
  acceleration: f32,
  frameCount: u32,
};
```

То візуальне представлення цієї структури може виглядати приблизно так:

<div class="webgpu_center" data-diagram="ourStructV1"></div>

Кожен квадратний блок тут це один байт. Ви можете побачити, що наші
дані займають 12 байт. Поле `velocity` займає перших 4 байти, поле 
`acceleration` - наступних 4 байти, а поле `frameCount` - останніх 
4 байти.

Для того, щоб передати дані в наш шейдер нам потрібно розмітити їх
таким чином, щоб вони збігались з розміщенням даних в структурі
`OurStruct`. Для того щоб зробити це, нам потрібно створити 
`ArrayBuffer` розміром в 12 байт. Далі налаштувати відображення
у вигляді `TypedArray` правильного типу, щоб можна було заповнити
його даними.

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const ourStructValuesAsF32 = new Float32Array(ourStructData);
const ourStructValuesAsU32 = new Uint32Array(ourStructData);
```

Вище, значення `ourStructData` дорівнює об’єкту `ArrayBuffer`, що 
є шматком пам’яті. Для того, щоб мати змогу переглядати вміст цієї
пам’яті, ми створюємо відображення цього об’єкту. `ourStructValuesAsF32`
це відображення цієї пам’яті у вигляді масиву 32-бітних чисел з
рухомою комою. `ourStructValuesAsU32` це відображення **тієї самої**
пам’яті у вигляді 32-бітних беззнакових цілих чисел.

Тепер, коли у нас є буфер і два його відображення, ми можемо передати
дані в нашу структуру.

```js
const kVelocityOffset = 0;
const kAccelerationOffset = 1;
const kFrameCountOffset = 2;

ourStructValuesAsF32[kVelocityOffset] = 1.2;
ourStructValuesAsF32[kAccelerationOffset] = 3.4;
ourStructValuesAsU32[kFrameCountOffset] = 56;    // an integer value
```

## <a id="a-typed-arrays"></a> `TypedArrays`

Зверніть увагу, що, як і багато речей в програмуванні, ми можемо зробити це
різними способами. `TypedArray` має конструктор, який набуває різних форм.
Для прикладу:

* `new Float32Array(12)`

   Ця версія створює **новий** `ArrayBuffer` розміром 12 * 4 байти. Після цього створює
   масив `Float32Array` для відображення цього буфера.

* `new Float32Array([4, 5, 6])`

   Ця версія створює **новий** `ArrayBuffer` розміром 3 * 4 байти. Після цього створює
   масив `Float32Array` для відображення цього буфера і встановлює початкові значення 
   цього масиву (4, 5, 6).

   Зверніть увагу, що ви можете передати сюди інший `TypedArray`. Для прикладу

   `new Float32Array(someUint8ArrayOf6Values)` створить **новий** `ArrayBuffer` розміром 6 * 4
   байти, далі створить `Float32Array` для його відображення і після цього скопіює значення
   з переданого відображення в новий масив `Float32Array`. Значення копіюються як числа, а не
   у вигляді бінарних значень. Іншими словами це відбувається якось так

   ```js
   srcArray.forEach((v, i) => dstArray[i] = v);
   ```

   Що саме означає "скопійовані за значенням"? Розгляньте цей приклад:

   ```js
   const f32s = new Float32Array([0.8, 0.9, 1.0, 1.1, 1.2]);
   const u32s = new Uint32Array(f32s); 
   console.log(u32s);   // produces 0, 0, 1, 1, 1
   ```

   Причина полягає в тому, що ми не можемо помістити такі числа як 0.8 чи 1.2 в 
   масив беззнакових цілих чисел `Uint32Array`.

* `new Float32Array(someArrayBuffer)`

   Це той випадок, який ми використали раніше. Нове `Float32Array` відображення
   створюється для **буфера, який уже існує**.

* `new Float32Array(someArrayBuffer, byteOffset)`

   Цей приклад створює нове `Float32Array` відображення для **буфера, який уже існує**,
   але початок цього відображення бере з відступом у розмірі `byteOffset`.

* `new Float32Array(someArrayBuffer, byteOffset, length)`

   Цей приклад створює нове `Float32Array` відображення для **буфера, який уже існує**. 
   Відображення починається з відступу у розмірі `byteOffset`, а довжина цього
   відображення буде розміром `length` елементів. Тобто, якщо ми передамо сюди значення
   довжини як 3, то відображення міститиме 3 32-бітних числа (12 байт).

Використовуючи останній приклад, ми можемо наш попередній код на цей:

```js
const kOurStructSizeBytes =
  4 + // velocity
  4 + // acceleration
  4 ; // frameCount
const ourStructData = new ArrayBuffer(kOurStructSizeBytes);
const velocityView = new Float32Array(ourStructData, 0, 1);
const accelerationView = new Float32Array(ourStructData, 4, 1);
const frameCountView = new Uint32Array(ourStructData, 8, 1);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

Надалі, кожен масив `TypedArray` матиме такі властивості:

* `length`: кількість елементів
* `byteLength`: розмір в байтах
* `byteOffset`: зміщення від початку батьківського буфера `ArrayBuffer`
* `buffer`: батьківський буфер `ArrayBuffer` 

Масиви `TypedArray` мають також багато різних методів, більшість з яких
схожі до методів звичайних масивів типу `Array`. Один із тих, які не схожі
це метод `subarray`. Він створює новий `TypedArray` такого є типу.
Він приймає два параметри `subarray(begin, end)`, де `end` не включає себе
в проміжок. Тож `someTypedArray.subarray(5, 10)` створює нове відображення
`TypedArray` **того ж самого буфера `ArrayBuffer`** включаючи елементи
масиву `someTypedArray` починаючи 5 та закінчуючи 9.

Тому ми можемо змінити наш код на цей:

```js
const kOurStructSizeFloat32Units =
  1 + // velocity
  1 + // acceleration
  1 ; // frameCount
const ourStructDataAsF32 = new Float32Array(kOurStructSizeFloat32Units);
const ourStructDataAsU32 = new Uint32Array(ourStructDataAsF32.buffer);
const velocityView = ourStructDataAsF32.subarray(0, 1);
const accelerationView = ourStructDataAsF32.subarray(1, 2);
const frameCountView = ourStructDataAsU32.subarray(2, 3);

velocityView[0] = 1.2;
accelerationView[0] = 3.4;
frameCountView[0] = 56;
```

## Декілька відображень одного й того ж буфера `ArrayBuffer`

Маючи відображення **одного й того ж буфера** означає, що ми маємо доступ до
нього з різних точок. Для прикладу:

```js
const v1 = new Float32Array(5);
const v2 = v1.subarray(3, 5);  // view the last 2 floats of v1
v2[0] = 123;
v2[1] = 456;
console.log(v1);  // shows 0, 0, 0, 123, 456
```

Схожим чином це працює для відображень різного типу:

```js
const f32 = new Float32Array([1, 1000, -1000])
const u32 = new Uint32Array(f32.buffer);

console.log(Array.from(u32).map(v => v.toString(16).padStart(8, '0')));
// shows '3f800000', '447a0000', 'c47a0000' 
```

Значення вище виведені у вигляді шістнадцяткового представлення для чисел 1, 1000,
-1000 з рухомою комою.

## Особливості методу `map`

Будьте обачні з методом `map`, оскільки для об’єктів типу `TypedArray` він створює
новий типізований масив з тим самим типом!

```js
const f32a = new Float32Array(1, 2, 3);
const f32b = f32a.map(v => v * 2);                    // Ok
const f32c = f32a.map(v => `${v} doubled = ${v *2}`); // BAD!
                    //  ви не можете помістити текст в масив з числами
```

Якщо вам потрібно відобразити типізований масив в інший тип, то вам потрібно або
пройтись циклом по цьому масиву, або перетворити його в звичайний масив, що можна
зробити з допомогою `Array.from`. Це буде виглядати таким чином:

```js
const f32d = Array.from(f32a).map(v => `${v} doubled = ${v *2}`); // Ok
```

## Типи vec та mat

[WGSL](webgpu-wgsl.html) має також типи, які складаються з 4 основних типів.
Ось їхній перелік:

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>type</th><th>description</th><th>short name</th><tr>
    </thead>
    <tbody>
      <tr><td><code>vec2&lt;f32&gt;</code></td><td>a type with 2  <code>f32</code>s</td><td><code>vec2f</code></td></tr>
      <tr><td><code>vec2&lt;u32&gt;</code></td><td>a type with 2  <code>u32</code>s</td><td><code>vec2u</code></td></tr>
      <tr><td><code>vec2&lt;i32&gt;</code></td><td>a type with 2  <code>i32</code>s</td><td><code>vec2i</code></td></tr>
      <tr><td><code>vec2&lt;f16&gt;</code></td><td>a type with 2  <code>f16</code>s</td><td><code>vec2h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec3&lt;f32&gt;</code></td><td>a type with 3  <code>f32</code>s</td><td><code>vec3f</code></td></tr>
      <tr><td><code>vec3&lt;u32&gt;</code></td><td>a type with 3  <code>u32</code>s</td><td><code>vec3u</code></td></tr>
      <tr><td><code>vec3&lt;i32&gt;</code></td><td>a type with 3  <code>i32</code>s</td><td><code>vec3i</code></td></tr>
      <tr><td><code>vec3&lt;f16&gt;</code></td><td>a type with 3  <code>f16</code>s</td><td><code>vec3h</code></td></tr>
      <tr></tr>
      <tr><td><code>vec4&lt;f32&gt;</code></td><td>a type with 4  <code>f32</code>s</td><td><code>vec4f</code></td></tr>
      <tr><td><code>vec4&lt;u32&gt;</code></td><td>a type with 4  <code>u32</code>s</td><td><code>vec4u</code></td></tr>
      <tr><td><code>vec4&lt;i32&gt;</code></td><td>a type with 4  <code>i32</code>s</td><td><code>vec4i</code></td></tr>
      <tr><td><code>vec4&lt;f16&gt;</code></td><td>a type with 4  <code>f16</code>s</td><td><code>vec4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x2&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat2x2f</code></td></tr>
      <tr><td><code>mat2x2&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat2x2u</code></td></tr>
      <tr><td><code>mat2x2&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat2x2i</code></td></tr>
      <tr><td><code>mat2x2&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat2x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x3&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat2x3f</code></td></tr>
      <tr><td><code>mat2x3&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat2x3u</code></td></tr>
      <tr><td><code>mat2x3&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat2x3i</code></td></tr>
      <tr><td><code>mat2x3&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat2x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat2x4&lt;f32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat2x4f</code></td></tr>
      <tr><td><code>mat2x4&lt;u32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat2x4u</code></td></tr>
      <tr><td><code>mat2x4&lt;i32&gt;</code></td><td>a matrix of 2 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat2x4i</code></td></tr>
      <tr><td><code>mat2x4&lt;f16&gt;</code></td><td>a matrix of 2 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat2x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x2&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat3x2f</code></td></tr>
      <tr><td><code>mat3x2&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat3x2u</code></td></tr>
      <tr><td><code>mat3x2&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat3x2i</code></td></tr>
      <tr><td><code>mat3x2&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat3x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x3&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat3x3f</code></td></tr>
      <tr><td><code>mat3x3&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat3x3u</code></td></tr>
      <tr><td><code>mat3x3&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat3x3i</code></td></tr>
      <tr><td><code>mat3x3&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat3x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat3x4&lt;f32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat3x4f</code></td></tr>
      <tr><td><code>mat3x4&lt;u32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat3x4u</code></td></tr>
      <tr><td><code>mat3x4&lt;i32&gt;</code></td><td>a matrix of 3 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat3x4i</code></td></tr>
      <tr><td><code>mat3x4&lt;f16&gt;</code></td><td>a matrix of 3 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat3x4h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x2&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;f32&gt;</code>s</td><td><code>mat4x2f</code></td></tr>
      <tr><td><code>mat4x2&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;u32&gt;</code>s</td><td><code>mat4x2u</code></td></tr>
      <tr><td><code>mat4x2&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec2&lt;i32&gt;</code>s</td><td><code>mat4x2i</code></td></tr>
      <tr><td><code>mat4x2&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec2&lt;f16&gt;</code>s</td><td><code>mat4x2h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x3&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;f32&gt;</code>s</td><td><code>mat4x3f</code></td></tr>
      <tr><td><code>mat4x3&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;u32&gt;</code>s</td><td><code>mat4x3u</code></td></tr>
      <tr><td><code>mat4x3&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec3&lt;i32&gt;</code>s</td><td><code>mat4x3i</code></td></tr>
      <tr><td><code>mat4x3&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec3&lt;f16&gt;</code>s</td><td><code>mat4x3h</code></td></tr>
      <tr></tr>
      <tr><td><code>mat4x4&lt;f32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;f32&gt;</code>s</td><td><code>mat4x4f</code></td></tr>
      <tr><td><code>mat4x4&lt;u32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;u32&gt;</code>s</td><td><code>mat4x4u</code></td></tr>
      <tr><td><code>mat4x4&lt;i32&gt;</code></td><td>a matrix of 4 <code>vec4&lt;i32&gt;</code>s</td><td><code>mat4x4i</code></td></tr>
      <tr><td><code>mat4x4&lt;f16&gt;</code></td><td>a matrix of 4 <code>vec4&lt;f16&gt;</code>s</td><td><code>mat4x4h</code></td></tr>
    </tbody>
  </table>
  </div>
</div>

Враховуючи, що `vec3f` це тип з трьома числами `f32`, а тип `mat4x4f` -
це матриця чисел типу `f32` розміром 4х4, як ви гадаєте, якою буде розмітка
пам’яті для цієї структури?

```wgsl
struct Ex2 {
  scale: f32,
  offset: vec3f,
  projection: mat4x4f,
};
```

Готові?

<div class="webgpu_center" data-diagram="ourStructEx2"></div>

Що тут взагалі відбувається? Виявляється, що кожен тип має вимоги вирівнювання.
Кожен тип має бути вирівняний в пам’яті до певного числа байтів.

Ось значення цих величин для різних типів даних:

<div class="webgpu_center data-table" data-diagram="wgslTypeTable" style="width: 95%; columns: 14em;"></div>

Але це ще не все!

Як на вашу думку має виглядати розмітка даних для цієї структури?

```wgsl
struct Ex3 {
  transform: mat3x3f,
  directions: array<vec3f, 4>,
};
```
Конструкція `array<type, count>` описує масив даних з типом `type` і
кількістю цих елементів `count`.

Приблизно ось так...

<div class="webgpu_center" data-diagram="ourStructEx3"></div>

Якщо ви заглянете в таблицю вирівнювань, ви побачите, що `vec3<f32>`
має значення вирівнювання 16 байт. Це означає, що кожен `vec3<f32>`,
незалежно від того чи він в матриці чи в масиві, буде закінчуватись 
пустим місцем.

Ось ще один приклад.

```wgsl
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
```

<div class="webgpu_center" data-diagram="ourStructEx4"></div>

Чому `size` вмістився у відступ на позиції 12 байта, одразу після `orientation`, а
поля `scale` та `friction` перемістились вниз на позиції 32 та 64 байтів?

Все через те, що масиви та структури мають свої особливі правила вирівнювання.
Тому, навіть коли масив чи структура це лише одиничний `vec3f`, вони вирівнюються
за іншими правилами. 

<div class="webgpu_center data-table">
  <div>
  <style>
    .wgsl-types tr:nth-child(5n) { height: 1em };
  </style>
  <table class="wgsl-types">
    <thead>
      <tr><th>type</th><th>align</th><th>size</th><tr>
    </thead>
    <tbody>
      <tr><td><code>struct</code> S with members M<sub>1</sub>...M<sub>N</sub></td><td>max(AlignOfMember(S,1), ... , AlignOfMember(S,N))</td><td>roundUp(AlignOf(S), justPastLastMember)

where justPastLastMember = OffsetOfMember(S,N) + SizeOfMember(S,N)</td></tr>
      <tr><td><code>array&lt;E, N&gt;</code></td><td>AlignOf(E)</td><td>N × roundUp(AlignOf(E), SizeOf(E))</td></tr>
    </tbody>
  </table>
  </div>
</div>

Ви можете прочитати про ці правила більш детально на 
[цій сторінці WGSL специфікації](https://www.w3.org/TR/WGSL/#alignment-and-size). 

# Обчислення відступів та розмірів це суцільний клопіт.

Обчислення розмірів та відступів даних в WGSL - це мабуть найболючіша точка в
WebGPU. Ви повинні вирахувати ці відступи самостійно і постійно оновлювати їх.
Якщо ви додасте нове поле десь в середині вашої структури, то вам прийдеться 
повернутись в JavaScript і оновити усі відступи. Помилитесь в якомусь одному байті
і всі ваші дані, які ви передасть в шейдер, будуть хибними. Ви не отримаєте 
жодних помилок, але ваш шейдер імовірно буде робити не те, що б вам хотілось,
бо він отримав хибні дані. Ваша модель не буде відмальована, або ваші
обчислення будуть продукувати хибні результати. 

На наше щастя, існують бібліотеки, які допомагають справитись з цим.

Ось одна з них: [webgpu-utils](https://github.com/greggman/webgpu-utils)

Ви передаєте їй ваш WGSL код, а вона надає вам API для усіх цих речей.
Таким чином, ви зможете змінювати ваші структури і, в більшості випадків,
усе працюватиме як слід.

Для прикладу, ми можемо передати наш попередній код до `webgpu-utils` таким 
чином:

```
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from 'https://greggman.github.io/webgpu-utils/dist/0.x/webgpu-utils-1.x.module.js';

const code = `
struct Ex4a {
  velocity: vec3f,
};

struct Ex4 {
  orientation: vec3f,
  size: f32,
  direction: array<vec3f, 1>,
  scale: f32,
  info: Ex4a,
  friction: f32,
};
@group(0) @binding(0) var<uniform> myUniforms: Ex4;

...
`;

const defs = makeShaderDataDefinitions(code);
const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);

// встановлюємо дані методом set
myUniformValues.set({
  orientation: [1, 0, -1],
  size: 2,
  direction: [0, 1, 0],
  scale: 1.5,
  info: {
    velocity: [2, 3, 4],
  },
  friction: 0.1,
});

// тепер ми можемо передати myUniformValues.arrayBuffer до WebGPU
```

Чи використовувати цю або іншу бібліотеку це тільки ваш вибір.
Як на мене, то я краще використаю одну з таких бібліотек ніж
витрачатиму від 20 до 60 хвилин на пошук проблеми в моїх
ручних розрахунках відступів.

Якщо ви все таки хочете робити це вручну, то
[ось сторінка, яка допоможе вам вирахувати усі ці відступи](resources/wgsl-offset-computer.html)

<!-- keep this at the bottom of the article -->
<script type="module" src="webgpu-memory-layout.js"></script>
