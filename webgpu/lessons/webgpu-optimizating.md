Title: WebGPU Speed and Optimization
Description: How to go faster in WebGPU
TOC: Speed and Optimization

Most of the examples on this site are written to be as understandable
as possible. That means they work, and they're correct, but they don't
necessarily show the most efficient way to do something in WebGPU.
Further, depending on what you need to do, there are a myriad of possible
optimizations.

In this article will cover some of the most basic optimizations and
discuss a few others.

The basics: The less work you do, and the less work you ask WebGPU to do
the faster things will go.

In pretty much all of the examples to date, if we draw multiple shapes
we've done the following steps

```
* At Init time:
   * for each thing we want to draw
      * create a uniform buffer
      * create a bindGroup that references that buffer

* At Render time:
   * for each thing we want to draw
      * update a typed array with our uniform values for this object
      * copy the typed array to the uniform buffer for this object
      * bind the bindGroup for this object
      * draw
```



Let's make an example we can optimize

* Pack your vertices
* Use mappedOnCreation for initial data
* Split uniform buffer (shared, material, per model)

* Texture Atlas or 2D-array
* GPU Occlusion culling
* GPU Scene graph matrix calculation
* GPU Frustum culling
* Indirect Drawing
* Render Bundles
