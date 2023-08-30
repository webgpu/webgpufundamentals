Title: WebGPU Optional Features and Limits
Description: Optional Features
TOC: Optional Features and Limits

WebGPU has a bunch of optional features and limits. Let's go over how to check them
and request them.

When you request an adapter with

```js
const adapter = await navigator.gpu?.requestAdapter();
```

The adapter will have a list of limits on `adapter.limits` and array of feature names
on `adapter.features`.  For example

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.limits.maxColorAttachments);
```

Might print `8` to the console

Here is a list of all the limits, including the limits of your default adapter
and the the minimum limits.

<div class="webgpu_center data-table limits" data-diagram="limits"></div>

The minimum limits are the limits you can count on all devices that support WebGPU
to have.

There is also a list of optional features. For example, you could view them
like this

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.features);
```

which might print something like `["texture-compression-astc", "texture-compression-bc"]` telling
you those features are available if you request them.

Here is the list of features available on your default adapter.

<div class="webgpu_center data-table features" data-diagram="features"></div>

> Note: You can check all of your system's adapter's features and limits at [webgpureport.org](https://webgpureport.org).

## Requesting limits and features

Given the available limits and features, you request them when you call `requestDefault` by
passing the limits as `requiredLimits` and the features as `requiredFeatures`. For example

```js
const k1Gig = 1024 * 1024 * 1024;
const adapter = await navigator.gpu?.requestAdapter();
const device = adapter?.requestDevice({
  requiredLimits: { maxBufferSize: k1Gig },
  requiredFeatures: [ 'float32-filterable' ],
});
```

Above we're requesting to be able to use buffers of up to 1gig and to be able to use filterable float32
textures (for example `'rgba32float'` with minFilter set to `'linear'` which by default can only be used with `'nearest'`)

If either of those requests can not be met `requestDevice` will fail (reject the promise).

## Don't request everything

It might be temping to ask for all the limits and features and then check for the ones you need.

Example:

```js
function objLikeToObj(src) {
  const dst = {};
  for (const key in src) {
    dst[key] = src[key];
  }
  return dst;
}

//
// BAD!!! ?
//
async function main() {
  const adapter = await navigator?.gpu.requestAdapter();
  const device = await adapter?.requestDevice({
    requiredLimits: objLikeToObj(adapter.limits),
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

This seems like a tempting, simple, and clear way to check for limits and features. The
problem with this pattern is you might be accidentally exceeding limits and not
know it. For example lets say you created an `'rgba32float'` texture and filtered it
with `'linear'` filtering.
It would magically just work on your desktop machine because you happened to have
enabled it.

On the user's phone, your program fails mysteriously because the `'float32-filterable'`
feature didn't exist and you happened to be using it without realizing that it's
an optional feature.

Or you might allocate a buffer larger the the minimum `maxBufferSize` and again
not be aware you went over the limit. You ship and a bunch of users can't run
your page.

## Requesting Features and Limits

The recommended way to use features and limits is to decide on what you absolutely
must have and only request those limits.

For example

```js
  const adapter = await navigator?.gpu.requestAdapter();

  const canUse128KUniformsBuffers = adapter?.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = adapter?.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = adapter?.features.has('indirect-first-instance');

  // if we absolutely need these one or more of these features then fail now if they are not
  // available
  if (!canUse128kUniformBuffers) {
    alert('Sorry, your device is probably too old or underpowered');
    return;
  }

  // Request the available features and limits we need
  const device = adapter?.requestDevice({
    requiredFeatures: [
      ...(canStorageBGRA8Unorm ? ['bgra8unorm'] : []),
      ...(canIndirectFirstInstance) ? ['indirect-first-instance']),
    ],
    requiredLimits: [
      maxUniformBufferBindingSize: 128 * 1024,
    ]
  });
```

Doing it this way, if you happen to ask for a Uniform buffer larger than 128k you'll get an error.
Similarly if you happen to try to use a feature you didn't request you'll get an error.
You can then make a conscience decision if you want to increase your required limits (and therefore
refuse to run on more devices) or if you want to keep the limits, or if you want to structure
your code to do different things if the features or limits are available.

<!-- keep this at the bottom of the article -->
<link rel="stylesheet" href="webgpu-limits-and-features.css">
<script type="module" src="webgpu-limits-and-features.js"></script>



