Title: WebGPU Optional Features and Limits
Description: Optional Features
TOC: Optional Features and Limits

TBD - Work In Progress

It might be temping to ask for all the limits and features and then check for the ones you need.

Example:

```js
//
// BAD!!! ?
//
async function styleB() {
  const adapter = await navigator?.gpu.requestAdapter();
  const device = await adapter?.requestDevice({
    requiredLimits: adapter.limits,
    requiredFeatures: adapter.features,
  });
  if (!device) {
    fail('need webgpu');
    return;
  }

  const canUse128KUniformsBuffers = device.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = device.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = device.features.has('indirect-first-instance');
}
```

This seems nice like the tersest and not really unclear, way to check for limits. The
problem with this pattern is you might be accidentally exceeding limits and not
know it. For example lets say you created an `rgba32float` texture and filtered it.
It would magically just work on your desktop machine because you happened to have
enabled it.

On the user's phone, your program fails mysteriously because the `'float32-filterable'`
feature didn't exist and you happened to be using it without realized that it's
an optional feature.



