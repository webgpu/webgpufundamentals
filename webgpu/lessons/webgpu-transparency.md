Title: WebGPU Transparency and Blending
Description: Blending Pixels in WebGPU
TOC: Transparency and Blending

The basic solution to transparency in WebGPU is called "blending".
When you create a render pipeline, for each colorAttachment, you can blending
settings.

The full list of default settings are

```
blend: {
  color: {
    operation: "add",
    srcFactor: "one",
    dstFactor: "zero",
  },
  alpha: {
    operation: "add",
    srcFactor: "one",
    dstFactor: "zero",
  },
}
```

Where `color` is what happens to the `rgb` portion of a color and `alpha` is
what happens to the `a` (alpha) portion.

`operation` can be one of

  * "add"
  * "subtract"
  * "reverse-subtract"
  * "min"
  * "max"

`srcFactor` and `dstFactor` and each be one of

  * "zero"
  * "one"
  * "src"
  * "one-minus-src"
  * "src-alpha"
  * "one-minus-src-alpha"
  * "dst"
  * "one-minus-dst"
  * "dst-alpha"
  * "one-minus-dst-alpha"
  * "src-alpha-saturated"
  * "constant"
  * "one-minus-constant"

Most of them are relatively straight forward to understand. Think of it as

```
   result = (src * srcFactor) operation (dst * dstFactor)
```

So consider the default where `operation` is `'add'`, `srcFactor` is `'one'` and
`dstFactor` is `'zero'`. This give us

```
   result = (src * 1) add (dst * 0)
   result = src * 1 + dst * 0
   result = src
```

As you can set the default result ends up being just `src`.

Probably the most common setting for blending is

```
{
  operation: 'add',
  srcFactor: 'one',
  dstFactor: 'one-minus-src-alpha'
}
```

This mode is used most often with "premultiplied alpha" meaning it expects
that the "src" has already had it's RGB colors "premultiplied" by the alpha value.

Let's say our color is 1, 0.5, 0.25 which is orange and we want it to be 33%
transparent so our alpha is 0.33. Then our "premultiplied color" would be

```
                      premultiplied
   ---------------------------------
   r = 1    * 0.33   = 0.33
   g = 0.5  * 0.33   = 0.165
   g = 0.25 * 0.33   = 0.0825
   a = 0.33          = 0.33
```

How you get a pre-multiplied color is up to you. If you have un-premultiplied
colors then in the shader you could just

```wgsl
   return vec4f(color.rgb * color.a, color.a)`;
```

Otherwise, the functions we covered in [the article on importing textures](webgpu-importing-textures.html) take a `premultipliedAlpha: true` option.

Let's make an example that shows these options. With 5 operations, 13 options
for srcFactor and 13 for dstFactor and all doubled for alpha that's 714025
combinations so maybe it's better to limit the list to commonly used
ones.


