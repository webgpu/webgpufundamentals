Title: WebGPU Post Processing - Image Adjustments
Description: Image Adjustments
TOC: Image Adjustments

In previous article we covered how to do [post processing](webgpu-post-processing.html). Some common operations to
want to do are often called, image adjustments as seen in
image editing programs like Photoshop, gIMP, Affinity Photo, etc...

In preparation, lets make an example that load an image and has
a post processing step. This wil be effectively the first part
of [the previous article](webgpu-post-processing.html) merged
with our example of loading an image from
[the article on loading images into textures](webgpu-importing-textures.html).







{{{example url="../webgpu-post-processing-3d-lookup-table(lut).html"}}}


<!-- keep this at the bottom of the article -->
<link href="webgpu-image-adjustments.css" rel="stylesheet">
<script type="module" src="webgpu-image-adjustments.js"></script>
