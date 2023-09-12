Title: WebGPU 基础
Description: WebGPU 的基础知识
TOC: Fundamentals

本文将向您介绍 WebGPU 的基础知识。
This article will try to teach you the very fundamentals of WebGPU.

<div class="warn">
希望你在阅读本文之前已经了解 JavaScript。本文将大量使用
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map">数组映射</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment">解构赋值</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax">展开语法</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function">async/await 函数</a>,
<a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules">es6 模块</a>,
等概念。
</div>

<div class="warn">如果您已经了解 WebGL, <a href="webgpu-from-webgl.html">请阅读此文</a>.</div>

WebGPU 是一个应用程序接口，可让您做两件基本的事情。

1. [绘制三角形/点/线到纹理上](#a-drawing-triangles-to-textures)

2. [在 GPU 上进行计算](#a-run-computations-on-the-gpu)

就是这样！
之后有关 WebGPU 的一切都取决于您。这就像学习 JavaScript、Rust 或 C++ 等计算机语言一样。首先要学习基础知识，然后才能创造性地使用这些基础知识来解决问题。

WebGPU 是一个极其低层次的 API. 虽然您可以制作一些小型示例，但对于许多应用程序来说，这可能需要大量代码和大量数据。 举例来说，支持 WebGPU 的 [three.js](https://threejs.org) 包含约 600k 的 JavaScript，这还只是它的基础库。这还不包括加载器、控件、后处理和许多其他功能。 同样的, [带有 WebGPU 后端的 TensorFlow](https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-webgpu)也需要大约 500K 的 JavaScript 压缩包。

重点是，如果你只想在屏幕上显示一些东西，那么选择一个能提供大量基础代码的库会好得多。

另一方面，也许你有一个自定义用例，也许你想修改一个现有库，也许你只是好奇它是如何工作的。在这种情况下，请继续阅读！

# 起步

很难决定从哪里开始。从某种程度上说，WebGPU 是一个非常简单的系统。它所做的就是在 GPU 上运行 3 种功能：顶点着色器、片段着色器和计算着色器。

顶点着色器负责计算顶点。着色器会返回顶点位置。对于每组 3 个顶点，它会返回在这 3 个位置之间绘制的三角形 [^primitives]

[^primitives]: There are actually 5 modes.

    -   `'point-list'`: 对于每个顶点，绘制一个点
    -   `'line-list'`: 每 2 个点绘制一条线
    -   `'line-strip'`: 绘制最新点与前一点的连接线
    -   `'triangle-list'`: 每 3 个点绘制一个三角形 (**默认**)
    -   `'triangle-strip'`: 对于每个新位置，从它和最后 2 个位置中画出一个三角形

片段着色器负责计算颜色 [^fragment-output]。 在绘制三角形时，GPU 会为每个要绘制的像素调用片段着色器。片段着色器会返回一种颜色。

[^fragment-output]:
    Fragment shaders indirectly write data to textures. That data does not
    have to be colors. For example, it's common to output the direction of the surface that
    pixel represents.

而计算着色器则更加的通用。它实际上只是一个函数，你调用它，然后说 "执行这个函数 N 次"。GPU 每次调用你的函数时都会传递迭代次数，因此你可以在每次迭代时使用该次数做一些独特的事情。

如果你仔细观察，就会发现这些函数类似于传递给
[`array.forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
或
[`array.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) 函数。
在 GPU 上运行的函数只是函数，就像 JavaScript 函数一样。不同之处在于它们是在 GPU 上运行的，因此要运行它们，您需要以缓冲区和纹理的形式将您希望它们访问的所有数据复制到 GPU 上，而且它们只能输出到这些缓冲区和纹理。您需要在函数中指定函数将在哪些绑定或位置查找数据。回到 JavaScript 中，你需要将保存数据的缓冲区和纹理绑定到这些绑定或位置。一旦完成这些后，您就可以告诉 GPU 执行函数了。

<a id="a-draw-diagram"></a>也许下面的图片会有所帮助。以下是使用顶点着色器和片段着色器绘制三角形的 WebGPU 设置简图

<div class="webgpu_center"><img src="resources/webgpu-draw-diagram.svg" style="width: 960px;"></div>

上图的注意事项：

-   **管道(Pipeline)**. 它包含 GPU 将运行的顶点着色器和片段着色器。您也可以在管道(Pipeline)中加入计算着色器。

-   着色器通过**绑定组(Bind Groups)**间接引用资源（缓冲区(buffer)、纹理(texture)、采样器(sampler)）。

-   管道定义了通过内部状态间接引用缓冲区的属性

-   属性从缓冲区中提取数据，并将数据输入顶点着色器

-   顶点着色器可将数据输入片段着色器

-   片段着色器通过 render pass description 间接写入纹理

要在 GPU 上执行着色器，需要创建所有这些资源并设置状态。创建资源相对简单。有趣的是，大多数 WebGPU 资源在创建后都无法更改。您可以更改它们的内容，但是无法更改它们的大小、用途、格式等等。如果要更改这些内容，需要创建一个新资源并销毁旧资源。

有些状态是通过创建和执行命令缓冲区来设置的。命令缓冲区顾名思义。它们是一个命令缓冲区。你可以创建编码器。编码器将命令编码到命令缓冲区。编码器*完成*(_finish_)编码后，就会向你提供它创建的命令缓冲区。然后，您就可以*提交*(_submit_)该命令缓冲区，让 WebGPU 执行命令。

下面是一些对命令缓冲区进行编码的伪代码，以及所创建的命令缓冲区的表示方法。

<div class="webgpu_center side-by-side"><div style="min-width: 300px; max-width: 400px; flex: 1 1;"><pre class="prettyprint lang-javascript"><code>{{#escapehtml}}
encoder = device.createCommandEncoder()
// draw something
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
// draw something else
{
  pass = encoder.beginRenderPass(...)
  pass.setPipeline(...)
  pass.setVertexBuffer(0, …)
  pass.setBindGroup(0, …)
  pass.draw(...)
  pass.end()
}
// compute something
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

创建命令缓冲区后，就可以*提交*(_submit_)执行了

```js
device.queue.submit([commandBuffer]);
```

上图表示命令缓冲区中某个绘制命令时的状态。执行命令会设置*内部状态*(_internal state_)，然后*绘制*(_draw_)命令会告诉 GPU 执行顶点着色器（并间接执行片段着色器）。`dispatchWorkgroup` 命令将告诉 GPU 执行计算着色器。

我希望这能让你对需要设置的状态有一些心理上的印象。如上所述，WebGPU 有两个基本功能：

1. [绘制三角形/点/线到纹理上](#a-drawing-triangles-to-textures)

2. [在 GPU 上进行计算](#a-run-computations-on-the-gpu)

我们将以一个小例子逐一说明。其他文章将介绍向这些设备提供数据的各种方法。请注意，这将是非常基础的内容。我们需要为这些基础知识打下基础。稍后我们将展示如何使用它们来完成人们通常使用 GPU 完成的工作，如 2D 图形、3D 图形等。

# <a id="a-drawing-triangles-to-textures"></a>绘制三角形到纹理上

WebGPU 能够绘制三角形到 [纹理](webgpu-textures.html). 在本文中，纹理是指像素组成的 2D 矩形区域.[^textures] `<canvas>` 元素表示了网页上的纹理。在 WebGPU 中，我们可以向画布请求纹理并将结果渲染到纹理（画布）上。

[^textures]:
    Textures can also be 3d rectangles of pixels, cube maps (6 squares of pixels
    that form a cube), and a few other things but the most common textures are 2d rectangles of pixels.

要使用 WebGPU 绘制三角形，我们必须提供 2 个 "着色器"。再说一次，着色器就是在 GPU 上运行的函数。这两个着色器是

1. 顶点着色器

    Vertex shaders are functions that compute vertex positions for drawing
    triangles/lines/points

2. 片元着色器

    Fragment shaders are functions that compute the color (or other data)
    for each pixel to be drawn/rasterized when drawing triangles/lines/points

Let's start with a very small WebGPU program to draw a triangle.

We need a canvas to display our triangle

```html
<canvas></canvas>
```

Then we need a `<script>` tag to hold our JavaScript.

```html
<canvas></canvas> +
<script type="module">

    ... javascript goes here ...

    +
</script>
```

All of the JavaScript below will go inside this script tag

WebGPU is an asynchronous API so it's easiest to use in an async function. We
start off by requesting an adaptor, and then requesting a device from the adapter.

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

The code above is fairly self explanatory. First we request an adapter by using the
[`?.` optional chaining operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining).
so that if `navigator.gpu` does not exist then `adapter` will be undefined.
If it does exist then we'll call `requestAdapter`. It returns its results asynchronously
so we need `await`. The adapter represents a specific GPU. Some devices
have multiple GPUs.

From the adapter we request the device but again use `?.` so that if adapter happens
to be undefined then device will also be undefined.

If the `device` not set it's likely the user has an old browser.

Next up we look up the canvas and create a `webgpu` context for it. This will
let us get a texture to render to. That texture will be used to display the canvas in the
webpage.

```js
// Get a WebGPU context from the canvas and configure it
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format: presentationFormat,
});
```

Again the code above is pretty self explanatory. We get a `"webgpu"` context
from the canvas. We ask the system what the preferred canvas format is. This
will be either `"rgba8unorm"` or `"bgra8unorm"`. It's not really that important
what it is but by querying it it will make things fastest for the user's system.

We pass that as `format` into the webgpu canvas context by calling `configure`.
We also pass in the `device` which associates this canvas with the device we just
created.

Next we create a shader module. A shader module contains one or more shader
functions. In our case we'll make 1 vertex shader function and 1 fragment shader
function.

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

Shaders are written in a language called
[WebGPU Shading Language (WGSL)](https://gpuweb.github.io/gpuweb/wgsl/) which is
often pronounced wig-sil. WGSL is a strongly typed language
which we'll try to go over more details in [another article](webgpu-wgsl.html).
For now I'm hoping with a little explanation you can infer some basics.

Above we see a function called `vs` is declared with the `@vertex` attribute.
This designates it as a vertex shader function.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
         ...
```

It accepts one parameter we named `vertexIndex`. `vertexIndex` is a `u32` which
means a _32bit unsigned integer_. It gets its value from the builtin called
`vertex_index`. `vertex_index` is the like an iteration number, similar to `index` in
JavaScript's `Array.map(function(value, index) { ... })`. If we tell the GPU to
execute this function 10 times by calling `draw`, the first time `vertex_index` would be `0`, the
2nd time it would be `1`, the 3rd time it would be `2`, etc...[^indices]

[^indices]:
    We can also use an index buffer to specify `vertex_index`.
    This is covered in [the article on vertex-buffers](webgpu-vertex-buffers.html#a-index-buffers).

Our `vs` function is declared as returning a `vec4f` which is vector of four
32bit floating point values. Think of it as an array of 4 values or an object
with 4 properties like `{x: 0, y: 0, z: 0, w: 0}`. This returned value will be
assigned to the `position` builtin. In "triangle-list" mode, every 3 times the
vertex shader is executed a triangle will be drawn connecting the 3 `position`
values we return.

Positions in WebGPU need to be returned in _clip space_ where X goes from -1.0
on the left to +1.0 on the right, Y goes from -1.0 at the bottom to +1.0 at the
top. This is true regardless of the size of the texture we are drawing to.

<div class="webgpu_center"><img src="resources/clipspace.svg" style="width: 500px"></div>

The `vs` function declares an array of 3 `vec2f`s. Each `vec2f` consists of two
32bit floating point values.

```wgsl
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
```

Finally it uses `vertexIndex` to return one of the 3 values from the array.
Since the function requires 4 floating point values for its return type, and
since `pos` is an array of `vec2f`, the code supplies `0.0` and `1.0` for
the remaining 2 values.

```wgsl
        return vec4f(pos[vertexIndex], 0.0, 1.0);
```

The shader module also declares a function called `fs` that is declared with
`@fragment` attribute making it a fragment shader function.

```wgsl
      @fragment fn fs() -> @location(0) vec4f {
```

This function takes no parameters and returns a `vec4f` at `location(0)`.
This means it will write to the first render target. We'll make the first
render target our canvas texture later.

```wgsl
        return vec4f(1, 0, 0, 1);
```

The code returns `1, 0, 0, 1` which is red. Colors in WebGPU are usually
specified as floating point values from `0.0` to `1.0` where the 4 values above
correspond to red, green, blue, and alpha respectively.

When the GPU rasterizes the triangle (draws it with pixels), it will call
the fragment shader to find out what color to make each pixel. In our case
we're just returning red.

One more thing to note is the `label`. Nearly every object you can create with
WebGPU can take a `label`. Labels are entirely optional but it's considered
_best practice_ to label everything you make. The reason is, when you get an
error, most WebGPU implementations will print an error message that includes the
labels of the things related to the error.

In a normal app you'd have 100s or 1000s of buffers, textures, shader modules,
pipelines, etc... If you get an error like `"WGSL syntax error in shaderModule
at line 10"`, if you have 100 shader modules, which one got the error? If you
label the module then you'll get an error more like `"WGSL syntax error in
shaderModule('our hardcoded red triangle shaders') at line 10` which is a way
more useful error message and will save you a ton of time tracking down the
issue.

Now that we've created a shader module, we next need to make a render pipeline

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

In this case there isn't much to see. We set `layout` to `'auto'` which means
to ask WebGPU to derive the layout of data from the shaders. We're not using
any data though.

We then tell the render pipeline to use the `vs` function from our shader module
for a vertex shader and the `fs` function for our fragment shader. Otherwise we
tell it the format of the first render target. "render target" means the texture
we will render to. We create a pipeline
we have to specify the format for the texture(s) we'll use this pipeline to
eventually render to.

Element 0 for the `targets` array corresponds to location 0 as we specified for
the fragment shader's return value. Later, well set that target to be a texture
for the canvas.

Next up we prepare a `GPURenderPassDescriptor` which describes which textures
we want to draw to and how to use them.

```js
const renderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
        {
            // view: <- to be filled out when we render
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: 'clear',
            storeOp: 'store',
        },
    ],
};
```

A `GPURenderPassDescriptor` has an array for `colorAttachments` which lists
the textures we will render to and how to treat them.
We'll wait to fill in which texture we actually want to render to. For now,
we setup a clear value of semi-dark gray, and a `loadOp` and `storeOp`.
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
    const encoder = device.createCommandEncoder({ label: 'our encoder' });

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

First we call `context.getCurrentTexture()` to get a texture that will appear in the
canvas. Calling `createView` gets a view into a specific part of a texture but
with no parameters it will return the default part which is what we want in this
case. For now our only `colorAttachment` is a texture view from our
canvas which we get via the context we created at the start. Again, element 0 of
the `colorAttachments` array corresponds to `@location(0)` as we specified for
the return value of the fragment shader.

Next we create a command encoder. A command encoder is used to create a command
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
command buffer that represents the steps we just specified. Finally we submit
the command buffer to be executed.

When the `draw` command is executed, this will be our state

<div class="webgpu_center"><img src="resources/webgpu-simple-triangle-diagram.svg" style="width: 723px;"></div>

We've got no textures, no buffers, no bindGroups but we do have a pipeline, a
vertex and fragment shader, and a render pass descriptor that tells our shader
to render to the the canvas texture.

The result

{{{example url="../webgpu-simple-triangle.html"}}}

It's important to emphasize that all of these functions we called
like `setPipeline`, and `draw` only add commands to a command buffer.
They don't actually execute the commands. The commands are executed
when we submit the command buffer to the device queue.

<a id="a-rasterization"></a>WebGPU takes every 3 vertices we return from our vertex shader uses
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

-   WebGPU just runs shaders. Its up to you to fill them with code to do useful things
-   Shaders are specified in a shader module and then turned into a pipeline
-   WebGPU can draw triangles
-   WebGPU draws to textures (we happened to get a texture from the canvas)
-   WebGPU works by encoding commands and then submitting them.

# <a id="a-run-computations-on-the-gpu"></a>Run computations on the GPU

Let's write a basic example for doing some computation on the GPU

We start off with the same code to get a WebGPU device

```js
async function main() {
  const adapter = await gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    fail('need a browser that supports WebGPU');
    return;
  }
```

When we create a shader module

```js
const module = device.createShaderModule({
    label: 'doubling compute module',
    code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3<u32>
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
});
```

First we declare a variable called `data` of type `storage` that we want to be
able to both read from and write to.

```wgsl
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;
```

We declare its type as `array<f32>` which means an array of 32bit floating point
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
later. For now we'll just set it to 1 with the attribute `@workgroup_size(1)`.
We declare it to have one parameter `id` which uses a `vec3u`. A `vec3u` is
three unsigned 32 integer values. Like our vertex shader above, this is the
iteration number. It's different in that compute shader iteration numbers are 3
dimensional (have 3 values). We declare `id` to get its value from the built-in
`global_invocation_id`.

You can _kind of_ think of a compute shaders as running like this. This is an over
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
    const { x: width, y: height, z: depth } = workgroup.size;
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

Since we set `@workgroup_size(1)`, effectively the pseudo code above becomes

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

Finally we use the `x` property of `id` to index `data` and multiply each value
by 2

```wgsl
        let i = id.x;
        data[i] = data[i] * 2.0;
```

Above, `i` is just the first of the 3 iteration numbers.

Now that we've created the shader we need to create a pipeline

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

Here we just tell it we're using a `compute` stage from the shader `module` we
created and we want to call the `computeSomething` function. `layout` is
`'auto'` again, telling WebGPU to figure out the layout from the shaders. [^layout-auto]

[^layout-auto]:
    `layout: 'auto'` is convenient but, it's impossible to share bind groups
    across pipelines using `layout: 'auto'`. Most of the examples on this site
    never use a bind group with multiple pipelines. We'll cover explicit layouts in [another article](webgpu-drawing-multiple-things.html).

Next we need some data

```js
const input = new Float32Array([1, 3, 5]);
```

That data only exists in JavaScript. For WebGPU to use it we need to make a
buffer that exists on the GPU and copy the data to the buffer.

```js
// create a buffer on the GPU to hold our computation
// input and output
const workBuffer = device.createBuffer({
    label: 'work buffer',
    size: input.byteLength,
    usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
});
// Copy our input data to that buffer
device.queue.writeBuffer(workBuffer, 0, input);
```

Above we call `device.createBuffer` to create a buffer. `size` is the size in
bytes, in this case it will be 12 because size in bytes of a `Float32Array` of 3
values is 12. If you're not familiar with `Float32Array` and typed arrays then
see [this article](webgpu-memory-layout.html).

Every WebGPU buffer we create has to specify a `usage`. There are a bunch of
flags we can pass for usage but not all of them can be used together. Here we
say we want this buffer to be usable as `storage` by passing
`GPUBufferUsage.STORAGE`. This makes it compatible with `var<storage,...>` from
the shader. Further, we want to able to copy data to this buffer so we include
the `GPUBufferUsage.COPY_DST` flag. And finally we want to be able to copy data
from the buffer so we include `GPUBufferUsage.COPY_SRC`.

Note that you can not directly read the contents of a WebGPU buffer from
JavaScript. Instead you have to "map" it which is another way of requesting
access to the buffer from WebGPU because the buffer might be in use and because
it might only exist on the GPU.

WebGPU buffers that can be mapped in JavaScript can't be used for much else. In
other words, we can not map the buffer we just created above and if we try to add
the flag to make it mappable we'll get an error that that is not compatible with
usage `STORAGE`.

So, in order to see the result of our computation, we'll need another buffer.
After running the computation, we'll copy the buffer above to this result buffer
and set its flags so we can map it.

```js
// create a buffer on the GPU to get a copy of the results
const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});
```

`MAP_READ` means we want to be able to map this buffer for reading data.

In order to tell our shader about the buffer we want it to work on we need to
create a bindGroup

```js
// Setup a bindGroup to tell the shader which
// buffer to use for the computation
const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: workBuffer } }],
});
```

We get the layout for the bindGroup from the pipeline. Then we setup bindGroup
entries. The 0 in `pipeline.getBindGroupLayout(0)` corresponds to the
`@group(0)` in the shader. The `{binding: 0 ...` of the `entries` corresponds to
the `@group(0) @binding(0)` in the shader.

Now we can start encoding commands

```js
// Encode commands to do the computation
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

We create a command encoder. We start a compute pass. We set the pipeline, then
we set the bindGroup. Here, the `0` in `pass.setBindGroup(0, bindGroup)`
corresponds to `@group(0)` in the shader. We then call `dispatchWorkgroups` and in
this case we pass it `input.length` which is `3` telling WebGPU to run the
compute shader 3 times. We then end the pass.

Here's what the situation will be when `dispatchWorkgroups` is executed

<div class="webgpu_center"><img src="resources/webgpu-simple-compute-diagram.svg" style="width: 553px;"></div>

After the computation is finished we ask WebGPU to copy from `workBuffer` to
`resultBuffer`

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

We then map the results buffer and get a copy of the data

```js
// Read the results
await resultBuffer.mapAsync(GPUMapMode.READ);
const result = new Float32Array(resultBuffer.getMappedRange());

console.log('input', input);
console.log('result', result);

resultBuffer.unmap();
```

To map the results buffer we call `mapAsync` and have to `await` for it to
finish. Once mapped, we can call `resultBuffer.getMappedRange()` which with no
parameters will return an `ArrayBuffer` of the entire buffer. We put that in a
`Float32Array` typed array view and then we can look at the values. One
important detail, the `ArrayBuffer` returned by `getMappedRange` is only valid
until we call `unmap`. After `unmap` its length with be set to 0 and its data
no longer accessible.

Running that we can see we got the result back, all the numbers have been
doubled.

{{{example url="../webgpu-simple-compute.html"}}}

We'll cover how to really use compute shaders in other articles. For now, you
hopefully have gleaned some understanding of what WebGPU does. EVERYTHING ELSE
IS UP TO YOU! Think of WebGPU as similar to other programming languages. It
provides a few basic features, and leaves the rest to your creativity.

What makes WebGPU programming special is these functions, vertex shaders,
fragment shaders, and compute shaders, run on your GPU. A GPU could have over
10000 processors which means they can potentially do more than 10000
calculations in parallel which is likely 3 or more orders of magnitude than your
CPU can do in parallel.

## Simple Canvas Resizing

Before we move on, let's go back to our triangle drawing example and add some
basic support for resizing a canvas. Sizing a canvas is actually a topic that
can have many subtleties so [there is an entire article on it](webgpu-resizing-the-canvas.html).
For now though let's just add some basic support

First we'll add some CSS to make our canvas fill the page

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
the resolution of the canvas itself so you might notice if you make the example below
large, like if you click the full screen button, you'll see the edges of the triangle
are blocky.

{{{example url="../webgpu-simple-triangle-with-canvas-css.html"}}}

`<canvas>` tags, by default, have a resolution of 300x150 pixels. We'd like to
adjust the canvas resolution of the canvas to match the size it is displayed.
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

In the code above we go over all the entries but there should only ever be one
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

In the following articles we'll cover various ways to pass data into shaders.

-   [inter-stage variables](webgpu-inter-stage-variables.html)
-   [uniforms](webgpu-uniforms.html)
-   [storage buffers](webgpu-storage-buffers.html)
-   [vertex buffers](webgpu-vertex-buffers.html)
-   [textures](webgpu-textures.html)
-   [constants](webgpu-constants.html)

Then we'll cover [the basics of WGSL](webgpu-wgsl.html).

This order is from the simplest to the most complex. Inter-stage variables
require no external setup to explain. We can see how to use them using nothing
but changes to the WGSL we used above. Uniforms are effectively global variables
and as such are used in all 3 kinds of shaders (vertex, fragment, and compute).
Going from uniform buffers to storage buffers is trivial as shown at the top of
the article on storage buffers. Vertex buffers are only used in vertex shaders.
They are more complex because they require describing the data layout to WebGPU.
Textures are most complex as they have tons of types and options.

I'm a little bit worried these article will be boring at first. Feel free to
jump around if you'd like. Just remember if you don't understand something you
probably need to read or review these basics. Once we get the basics down we'll
start going over actual techniques.

One other thing. All of the example programs can be edited live in the webpage.
Further, they can all easily be exported to [jsfiddle](https://jsfiddle.net) and [codepen](https://codepen.io)
and even [stackoverflow](https://stackoverflow.com). Just click "Export".

<div class="webgpu_bottombar">
<p>
The code above gets a WebGPU device in very terse way. A more verbose
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
