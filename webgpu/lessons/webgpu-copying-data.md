Title: WebGPU Copying Data
Description: Copying Data to/from buffers and textures
TOC: Copying Data

In most of the articles to date, we've used the functions
`writeBuffer` to put data in a buffer and `writeTexture`
to put data in a texture. There are several ways to put
data into a buffer or a texture.

## `writeBuffer`

`writeBuffer` copies data from a `TypedArray` or `ArrayBuffer` in JavaScript to a buffer.
This is arguably the most straight forward way to get data into a buffer.

`writeBuffer` follows this format

```js
device.queue.writeBuffer(
  destBuffer,  // the buffer to write to
  destOffset,  // where in the destination buffer to start writing
  srcData,     // a typedArray or arrayBuffer
  srcOffset?,  // offset in **elements** in srcData to start copying
  size?,       // size in **elements** of srcData to copy
)
```

If `srcOffset` is not passed it's `0`. If `size` is not passed
it's the size of `srcData`.

> Important: `srcOffset` and `size` are in elements of `srcData`
>
> In other words,
>
> ```js
> device.queue.writeBuffer(
>   someBuffer,
>   someOffset,
>   someFloat32Array,
>   6,
>   7,
> )
> ``` 
>
> the code above will copy from float32 #6, 7 float32s of data.
> To put it another way it will copy 28 bytes starting at byte 24
> from the portion of the arrayBuffer that `someFloat32Array` is
> a view of.

## `writeTexture`

`writeTexture` copies data from a `TypedArray` or `ArrayBuffer` in JavaScript to a texture.
  
`writeTexture` has this signature

```js
device.writeTexture(
  // details of the destination
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // the source data
  srcData,

  // details of the source data
  { offset: 0, bytesPerRow, rowsPerImage },

  // size:
  [ width, height, depthOrArrayLayers ]
)
```

Things to note:

* `texture` must have a usage of `GPUTextureUsage.COPY_DST`

* `mipLevel`, `origin`, and `aspect` all have defaults so they often do not need to be specified

* `bytesPerRow`: This is how many bytes to advance to get to the next *block row* of data.

   This is required if you are copying more than 1 *block row*. It is almost
   always true that you're copying more than 1 *block row* so it is therefore
   almost always required.

* `rowsPerImage`: This is the number of *block rows* to advance to get from the
   the start of one image to the next image.

   This is required if you are copying more than 1 layer. In other words,
   if `depthOrArrayLayers` in the size argument is > 1 then you need to supply
   this value.

You can think of the copy as working like this

```js
   // pseudo code
   const [x, y, z] = origin || [0, 0, 0];
   const [blockWidth, blockHeight] = getBlockSizeForTextureFormat(texture.format);

   const blocksAcross = width / blockWidth;
   const blocksDown = height / blockHeight;

   for (layer = 0; layer < depthOrArrayLayers; layer) {
      for (row = 0; row < blocksDown; ++row) {
        const start = offset + (layer * rowsPerImage + row) * bytesPerRow;
        copyRowToTexture(
            texture,               // texture to copy to
            x, y + row, z + layer, // where in texture to copy to
            srcDataAsBytes + start,
            bytesPerRow);
      }
   }
```

### <a id="a-block-rows"></a>**block row**

Textures are organized into blocks. For most *regular* textures the block width
and block height are both 1. For compressed textures that changes. For example
the format, `bc1-rgba-unorm` as a block width of 4 and a block height of 4.
That means if you set the width to 8, and the height to 12, only 6 blocks will be copied.
2 blocks for the first row, 2 for the 2nd row, 3 for the 3rd.

For compressed textures, size and origin must be aligned to blocks sizes.

> Important: Anywhere in the WebGPU that takes size (defined as a `GPUExtent3D`)
> can either be an array of 1 to 3 numbers, or it can be an object with 1 to
> 3 properties. `height` and `depthOrArrayLayers` default to 1 so
>
> * `[2]` a size where width = 2, height = 1, depthOrArrayLayers = 1
> * `[2, 3]` a size where width = 2, height = 3, depthOrArrayLayers = 1
> * `[2, 3, 4]` a size where width = 2, height = 3, depthOrArrayLayers = 4
> * `{ width: 2 }` a size where width = 1, height = 1, depthOrArrayLayers = 1
> * `{ width: 2, height: 3 }` a size where width = 2, height = 3, depthOrArrayLayers = 1
> * `{ width: 2, height: 3, depthOrArrayLayers: 4 }` a size where width = 2, height = 3, depthOrArrayLayers = 4

> In the same way, Anywhere an origin appears (default aa a `GPUOrigin3D`), you can either have an array
> of 3 numbers, or a object with `x`, `y`, `z` properties. All of them default to
> 0 so
>
> * `[5]` an origin where x = 5, y = 0, z = 0
> * `[5, 6]` an origin where x = 5, y = 6, z = 0
> * `[5, 6, 7]` an origin where x = 5, y = 6, z = 7
> * `{ x: 5 }` an origin where x = 5, y = 0, z = 0
> * `{ x: 5, y: 6 }` an origin where x = 5, y = 6, z = 0
> * `{ x: 5, y: 6, z: 7 }` an origin where x = 5, y = 0, z = 0

* `aspect` really only comes into play when copying data to a depth-stencil format.
  You can only copy to one aspect at a time, either the `depth-only` or the `stencil-only`.

## `copyBufferToBuffer`

`copyBufferToBuffer`, like the name suggests, copies data from one buffer to another.

signature:

```js
encoder.copyBufferToBuffer(
  source,       // buffer to copy from
  sourceOffset, // where to start copying from
  dest,         // buffer to copy to
  destOffset,   // where to start copying to
  size,         // how many bytes to copy
)
```

* `source` must have a usage of `GPUBufferUsage.COPY_SRC`
* `dest` must have a usage of `GPUBufferUsage.COPY_DST`
* `size` must be a multiple of 4

## `copyBufferToTexture`

`copyBufferToTexture`, like the name suggests, copies data from a buffer to a texture.

signature:

```js
encode.copyBufferToTexture(
  // details of the destination texture
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // details of the source buffer
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // size:
  [ width, height, depthOrArrayLayers ]
)
```

This has almost exactly the same parameters as `writeTexture`.
The biggest difference is that `bytesPerRow` **must be
a multiple of 256!!**

* `texture` must have a usage of `GPUTextureUsage.COPY_DST`
* `buffer` must have a usage of `GPUBufferUsage.COPY_SRC`

## `copyTextureToBuffer`

`copyTextureToBuffer` like the name suggests, copies data from a texture to a buffer.

signature:

```js
encode.copyTextureToBuffer(
  // details of the source texture
  { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // details of the destination buffer
  { buffer, offset: 0, bytesPerRow, rowsPerImage },

  // size:
  [ width, height, depthOrArrayLayers ]
)
```

This has exactly the same parameters as `copyBufferToTexture`,
It's texture becomes the source and the buffer becomes the
destination. Like `copyTextureToBuffer`, `bytesPerRow` **must be
a multiple of 256!!**

* `texture` must have a usage of `GPUTextureUsage.COPY_SRC`
* `buffer` must have a usage of `GPUBufferUsage.COPY_DST`

## `copyTextureToTexture`

`copyTextureToTexture` copies a portion of one texture to another. 

The two textures must be must either be the same format, or they
must only differ by the suffix `'-srgb'`.

signature:

```js
encode.copyTextureToBuffer(
  // details of the source texture
  src: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // details of the destination texture
  dst: { texture, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },

  // size:
  [ width, height, depthOrArrayLayers ]
);
```

* src.`texture` must have a usage of `GPUTextureUsage.COPY_SRC`
* dst.`texture` must have a usage of `GPUTextureUsage.COPY_DST`
* `width` must be a multiple of block width
* `height` must be a multiple of block height
* src.`origin[0]` or `.x` must be a multiple block width
* src.`origin[1]` or `.y` must be a multiple block height
* dst.`origin[0]` or `.x` must be a multiple block width
* dst.`origin[1]` or `.y` must be a multiple block height

## Shaders

Shaders can write to storage buffers, storage textures,
and indirectly they can render to textures. Those are all ways
of getting data into buffers and textures. In other words
you can write shaders to generate data.

## Mapping Buffers

You can map a buffer. Mapping a buffer means making it
available to read or write from JavaScript. 
At least in version 1 of WebGPU,
mappable buffers have severe restrictions, namely, a
mappable buffer can can only be used as a temporary place
to copy from to. A mappable buffer can not be used as any
other type of buffer (like a Uniform buffer, vertex buffer,
index buffer, storage buffer, etc...) [^mappedAtCreation]

[^mappedAtCreation]: The exception is if you set `mappedAtCreation: true`
See [mappedAtCreation](#a-mapped-at-creation).

You can create a mappable buffer with 2 combinations
of usage flags.

* `GPUBufferUsage.MAP_READ | GPU_BufferUsage.COPY_DST`

  This is a buffer you can use the copy commands above to copy
  data to from a another buffer or a texture, then map it to
  read the values in JavaScript

* `GPUBufferUsage.MAP_WRITE | GPU_BufferUsage.COPY_SRC`

  This is a buffer you can map in JavaScript, you can then put
  data in it from JavaScript, and finally unmap it and use the 
  and the copy commands above to copy its contents to another
  buffer or texture.

The process of mapping a buffer is asynchronous. You call
`buffer.mapAsync(mode, offset = 0, size?)` where `offset`
and `size` are in bytes. If `size` is not specified it's
the size of the entire buffer. `mode` must be either
`GPUMapMode.READ` or `GPUMapMode.WRITE` and must of course
match the `MAP_` usage flag you passed in when you created
the buffer.

 `mapAsync` returns a Promise.
When the promise resolves the buffer is mappable. You can then
view some or all of the buffer by calling `buffer.getMappedRange(offset = 0, size?)`
where `offset` a byte offset into the portion of the buffer you
mapped. `getMappedRange` returns an `ArrayBuffer` so generally, to
be of any use, you'd use that to construct TypedArray.

Here's one example of mapping a buffer

```js
const buffer = device.createBuffer({
  size: 1024,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// map the entire buffer
await buffer.mapAsync(GPUMapMode.READ);

// get the entire buffer
const f32 = new Float32Array(buffer.getMappedRange())

...

buffer.unmap();
```

Note: Once mapped, the buffer is not usable by WebGPU until you call `unmap`.
The moment `unmap` is called the buffer disappears from JavaScript. In other words,
take the example above

```js
const f32 = new Float32Array(buffer.getMappedRange())

f32[0] = 123;
console.log(f32[0]); // prints 123

buffer.unmap();

console.log(f32[0]); // prints undefined
```

We've already seen examples of mapping a buffer for read.
Once in [the first article](webgpu-fundamentals.html#a-run-computations-on-the-gpu) where we doubled some numbers
in a storage buffer and the copied the results to a mappable buffer and mapped it to read out the results

Another is the article on [compute shader basics](webgpu-compute-shaders.md)
where we output the various `@builtin` compute shader values to a storage buffer.
We then copied those results to a mappable buffer and mapped it read out the results.


## <a id="a-mapped-at-creation"></a>mappedAtCreation

`mappedAtCreation: true` is a flag you can add when you
create a buffer. In this case, the buffer does not need
the usage flags `GPUBufferUsage.COPY_DST` nor `GPUBufferUsage.MAP_WRITE`.

This is a special flag solely to let you put data in the
buffer on creation. You add the flat `mappedAtCreation: true` when you create the
buffer. The buffer is created, already mapped for writing. Example:

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 const arrayBuffer = buffer.getMappedRange(0, buffer.size);
 const f32 = new Float32Array(arrayBuffer);
 f32.set([1, 2, 3, 4]);
 buffer.unmap();
```

Or, more tersely

```js
 const buffer = device.createBuffer({
   size: 16,
   usage: GPUBufferUsage.UNIFORM,
   mappedAtCreation: true,
 });
 new Float32Array(buffer.getMappedRange(0, buffer.size)).set([1, 2, 3, 4]);
 buffer.unmap();
```

## <a id="a-efficient"></a>Efficiently using mappable buffers

Above we saw that mapping a buffer is asynchronous. This means there's
an indeterminate amount of time from the point we ask for the buffer
to be mapped by calling `mapAsync`, until the time it's mapped and we can call `getMappedRange`.

A common way to workaround this is to keep a set of buffers always mapped.
Since they are already mapped they are ready to use immediately. As soon
as you use one and unmap it, and as soon as you've submitted whatever
commands use the buffer, you ask for to to be mapped again. When it promise
resolves you put it back in a pool of already mapped buffers. If you ever
need a mapped buffer and none are available you create a new one and add
it to the pool.

TBD: Example

