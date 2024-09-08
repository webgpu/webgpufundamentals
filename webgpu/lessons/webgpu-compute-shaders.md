Title: WebGPU Compute Shader Basics
Description: How to use compute shaders in WebGPU
TOC: Compute Shader Basics

This article continues from [the article on fundamentals](webgpu-fundamentals.html).
We're going to start with some basic of compute shaders and then hopefully move on
to examples of solving real world problems.

In the [previous article](webgpu-fundamentals.html) we made an extremely simple
compute shader that doubled numbers in place.

Here's the shader

```wgsl
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(1) fn computeSomething(
  @builtin(global_invocation_id) id: vec3<u32>
) {
  let i = id.x;
  data[i] = data[i] * 2.0;
}
```

We then effectively ran the compute shader like this

```js
  ...
  pass.dispatchWorkgroups(count);
```

We need to go over the definition of workgroup.

You can think of a workgroup as small collection of threads. Each thread
runs in parallel. You define the size of workgroup statically in WGSL.
Workgroup sizes are defined in 3 dimensions but default to 1 so
our `@workgroup_size(1)` is equivalent to `@workgroup_size(1, 1, 1)`.

<a id="a-local-invocation-id"></a>If we define a workgroup as say `@workgroup_size(3, 4, 2)` then we're
defining 3 * 4 * 2 threads or another way put it, we're defining a 24 thread workgroup.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup.svg" style="width: 500px;">
  <div><code>local_invocation_id</code> of threads in a workgroup</div>
</div>

<a id="a-workgroup-id"></a>If we then call `pass.dispatchWorkgroups(4, 3, 2)` we're saying, execute a workgroup of 24 threads,
4 * 3 * 2 times (24) for a total of 576 threads.

<div class="webgpu_center">
  <img src="resources/gpu-workgroup-dispatch.svg" style="width: 500px;">
  <div><code>workgroup_id</code> of dispatched workgroups</div>
</div>

Inside each "invocation" of our compute shader the following builtin variables
are available.

* `local_invocation_id`: The id of this thread within a workgroup

  [See the diagram above](#a-local-invocation-id).

* `workgroup_id`: The id of the workgroup.

  Every thread within a workgroup will have the same workgroup id.
  [See the diagram above](#a-workgroup-id).

* `global_invocation_id`: A unique id for each thread

  You can think of this as

  ```
  global_invocation_id = workgroup_id * workgroup_size + local_invocation_id
  ```

* `num_workgroups`: What you passed to `pass.dispatchWorkgroups`

* `local_invocation_index`: The id of this thread linearized

  You can think of this as

  ```
  rowSize = workgroup_size.x
  sliceSize = rowWidth * workgroup_size.y
  local_invocation_index =
        local_invocation_id.x +
        local_invocation_id.y * rowSize +
        local_invocation_id.z * sliceSize
  ```

Let's make a sample to use these values. We'll just write the values
from each invocation to buffers and then print out the values

Here's the shader

```js
const dispatchCount = [4, 3, 2];
const workgroupSize = [2, 3, 4];

// multiply all elements of an array
const arrayProd = arr => arr.reduce((a, b) => a * b);

const numThreadsPerWorkgroup = arrayProd(workgroupSize);

const code = `
// NOTE!: vec3u is padded to by 4 bytes
@group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
@group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
@group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

@compute @workgroup_size(${workgroupSize}) fn computeSomething(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
    @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  // workgroup_index is similar to local_invocation_index except for
  // workgroups, not threads inside a workgroup.
  // It is not a builtin so we compute it ourselves.

  let workgroup_index =  
     workgroup_id.x +
     workgroup_id.y * num_workgroups.x +
     workgroup_id.z * num_workgroups.x * num_workgroups.y;

  // global_invocation_index is like local_invocation_index
  // except linear across all invocations across all dispatched
  // workgroups. It is not a builtin so we compute it ourselves.

  let global_invocation_index =
     workgroup_index * ${numThreadsPerWorkgroup} +
     local_invocation_index;

  // now we can write each of these builtins to our buffers.
  workgroupResult[global_invocation_index] = workgroup_id;
  localResult[global_invocation_index] = local_invocation_id;
  globalResult[global_invocation_index] = global_invocation_id;
`;
```

We used a JavaScript template literal so we can set the workgroup size
from the JavaScript variable `workgroupSize`. This ends up being
hard coded into the shader.

Now that we have the shader we can make 3 buffers to store these results.

```js
  const numWorkgroups = arrayProd(dispatchCount);
  const numResults = numWorkgroups * numThreadsPerWorkgroup;
  const size = numResults * 4 * 4;  // vec3f * u32

  let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
  const workgroupBuffer = device.createBuffer({size, usage});
  const localBuffer = device.createBuffer({size, usage});
  const globalBuffer = device.createBuffer({size, usage});
```

As we pointed out before, we can not map storage buffers into
JavaScript so we need some buffers to we can map. We'll copy
the results from the storage buffers to these mappable result
buffers and then read the results.

```js
  usage = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
  const workgroupReadBuffer = device.createBuffer({size, usage});
  const localReadBuffer = device.createBuffer({size, usage});
  const globalReadBuffer = device.createBuffer({size, usage});
```

We make a bindgroup to bind all our storage buffers

```js
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: workgroupBuffer }},
      { binding: 1, resource: { buffer: localBuffer }},
      { binding: 2, resource: { buffer: globalBuffer }},
    ],
  });
```

We start an encoder and a compute pass encoder, the same as our previous
example, then add the commands to run the compute shader.

```js
  // Encode commands to do the computation
  const encoder = device.createCommandEncoder({ label: 'compute builtin encoder' });
  const pass = encoder.beginComputePass({ label: 'compute builtin pass' });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(...dispatchCount);
  pass.end();
```

We need to copy the results from the storage buffers to the mappable 
result buffers.

```js
  encoder.copyBufferToBuffer(workgroupBuffer, 0, workgroupReadBuffer, 0, size);
  encoder.copyBufferToBuffer(localBuffer, 0, localReadBuffer, 0, size);
  encoder.copyBufferToBuffer(globalBuffer, 0, globalReadBuffer, 0, size);
```

And then end the encoder and submit the command buffer.

```js
  // Finish encoding and submit the commands
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
```

Like before, to read the results we map the buffers and once they are
ready we get typed array views of their contents.

```js
  // Read the results
   await Promise.all([
    workgroupReadBuffer.mapAsync(GPUMapMode.READ),
    localReadBuffer.mapAsync(GPUMapMode.READ),
    globalReadBuffer.mapAsync(GPUMapMode.READ),
  ]);

  const workgroup = new Uint32Array(workgroupReadBuffer.getMappedRange());
  const local = new Uint32Array(localReadBuffer.getMappedRange());
  const global = new Uint32Array(globalReadBuffer.getMappedRange());
```

> Important: We mapped 3 buffers here and used `await Promise.all` to wait
> for them all to be ready to use. You can **NOT* just wait on the last
> buffer. You must wait on all 3 buffers.

Finally we can print them out

```js
  const get3 = (arr, i) => {
    const off = i * 4;
    return `${arr[off]}, ${arr[off + 1]}, ${arr[off + 2]}`;
  };

  for (let i = 0; i < numResults; ++i) {
    if (i % numThreadsPerWorkgroup === 0) {
      log(`\
 ---------------------------------------
 global                 local     global   dispatch: ${i / numThreadsPerWorkgroup}
 invoc.    workgroup    invoc.    invoc.
 index     id           id        id
 ---------------------------------------`);
    }
    log(` ${i.toString().padStart(3)}:      ${get3(workgroup, i)}      ${get3(local, i)}   ${get3(global, i)}`)
  }
}

function log(...args) {
  const elem = document.createElement('pre');
  elem.textContent = args.join(' ');
  document.body.appendChild(elem);
}
```

Here's the result

{{{example url="../webgpu-compute-shaders-builtins.html"}}}

These builtins are generally the only inputs that change
per thread of a compute shader for one call to `pass.dispatchWorkgroups`
so to be effective you need to figure out how to use them to design
a compute shader function to do what you want, given these `..._id`
builtins as input.

## Workgroup Size

What size should you make a workgroup? The question often comes up,
why not just always use `@workgroup_size(1, 1, 1)` and then it would
be more trivial to decide how many iterations to run by only the
parameters to `pass.dispatchWorkgroups`.

The reason is multiple threads within a workgroup are faster than
individual dispatches.

For one, threads in a workgroup often run in lockstep so running
16 of them is just as fast as running 1.

The default limits for WebGPU are as follows

* `maxComputeInvocationsPerWorkgroup`: 256
* `maxComputeWorkgroupSizeX`: 256
* `maxComputeWorkgroupSizeY`:	256
* `maxComputeWorkgroupSizeZ`:	64

As you can see, the first limit `maxComputeInvocationsPerWorkgroup` means the 3 parameters
to `@workgroup_size` can not multiply to a number larger than 256. In other words

```
   @workgroup_size(256, 1, 1)   // ok
   @workgroup_size(128, 2, 1)   // ok
   @workgroup_size(16, 16, 1)   // ok
   @workgroup_size(16, 16, 2)   // bad 16 * 16 * 2 = 512
```

Unfortunately, the perfect size is GPU dependent and WebGPU can not provide that info.
**The general advice for WebGPU is to choose a workgroup size of 64** unless you have
some specific reason to choose another size. Apparently most GPUs can efficiently
run 64 things in lockstep. If you choose a higher number and the GPU can't do it
as a fast path it will chose a slower path. If on the other hand you chose a number
below what the GPU can do then you may not get the maximum performance.

## <a href="a-race-conditions"></a>Races in Compute Shaders

A common mistake in WebGPU is not handling race conditions. A race
condition is where multiple threads are running at the same time and
effectively they are in a race for who comes in first or last.

Let's say you had this compute shader

```wgsl
@group(0) @binding(0) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(32) fn computeSomething(
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
) {
  result[0] = local_invocation_id.x;
`;
```

If that's hard to read, here's kind of the same JavaScript

```js
const result = [];
for (let i = 0; i < 32; ++i) {
  result[0] = i;
}
```

In the JavaScript case, after the code runs, `result[0]` is clearly 31. In the compute shader case though,
all 32 iterations of the shader are running in parallel. Which ever one finishes
last is the one who's value will be in `result[0]`. Which one runs last is undefined.

From the spec:

> WebGPU provides no guarantees about:
>
> * Whether invocations from different workgroups execute concurrently. That is,
>   you cannot assume more than one workgroup executes at a time.
>
> * Whether, once invocations from a workgroup begin executing, that other
>   workgroups are blocked from execution. That is, you cannot assume that only
>   one workgroup executes at a time. While a workgroup is executing, the
>   implementation may choose to concurrently execute other workgroups as well,
>   or other queued but unblocked work.
>
> * Whether invocations from one particular workgroup begin executing before the
>   invocations of another workgroup. That is, you cannot assume that workgroups
>   are launched in a particular order.

We'll go over some of the ways to deal with this issue in future examples. For now, our
two examples have no race conditions as each iteration of the compute shader does something
unaffected by the other iterations.

Next up: [Example Compute Shaders - Image Histogram](webgpu-compute-shaders-histogram.html)
