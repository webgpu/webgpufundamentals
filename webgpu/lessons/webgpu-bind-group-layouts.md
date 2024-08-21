Title: WebGPU Bind Group Layouts
Description: Explicit Bind Group Layouts
TOC: Bind Group Layouts

Bind Group Layouts are used to make it easy and efficient
for WebGPU to match Bind Groups to Compute and Render Pipelines.

How it works: 

A Pipeline, like a `GPUComputePipeline` or `GPURenderPipeline`
uses a `GPUPipelineLayout` which defines 0 or more
`GPUBindGroupLayout`s. Each `GPUBindGroupLayout` is assigned
to a specific group index.

Bind Groups are created with a specific `GPUBindGroupLayout`
as well.

When you go to `draw` or to `dispatchWorkgroups`, WebGPU only
needs to check, does the `GPUBindGroupLayout` for each group index
on the current pipeline's `GPUPipelineLayout` match the
currently bound bind groups, the ones set with `setBindGroup`.
This check is trivially simple. Most of the detailed checking
happens when you create the bind group. That way, when you're
actually drawing or computing, there's almost nothing left to
check.

Pipelines with generate their own `GPUPipelineLayout` and
populate it with `GPUBindGroupLayouts` automatically if you
create the pipeline with `layout: 'auto'` which is what
most of the samples on this website do.

There are 2 main reasons to **NOT** use `layout: 'auto'`.

1. **You want to use a bind group with more than 1 pipeline**

   You can not use a bind group made with from a bindGroupLayout
   that was made from a pipeline with `layout: 'auto'` with a
   different pipeline.

2. **You want a layout that's different than the default `'auto'` layout**

## Using a bind group with more than 1 pipeline

--- need a good example - problem is, drawing twice in 2 different locations
--- requires 2 different uniform buffers which means it requires 2 bind groups
--- which means sharing doesn't matter.

Let's made a toy example. We'll make 2 render pipelines and try
to draw a cube with both pipelines.




