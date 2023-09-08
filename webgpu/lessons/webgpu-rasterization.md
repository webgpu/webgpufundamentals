Title: WebGPU Rasterization
Description: How WebGPU draws things
TOC: Rasterization

This article provides some details into how WebGPU draws
points, lines, and triangles. Render pipelines generally
render points, lines, or triangles. Compute pipelines
can update textures or buffers directly, effectively doing
"software rasterization". This article is about the former,
sometimes called "hardware rasterization".



<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; width: 500px;"></div>
</div>


<!-- keep this at the bottom of the article -->
<link href="webgpu-rasterization.css" ref="stylesheet">
<script type="module" src="webgpu-rasterization.js"></script>
