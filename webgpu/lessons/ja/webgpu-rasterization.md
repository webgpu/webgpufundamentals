Title: WebGPU ラスタライズ
Description: WebGPUがどのようにものを描画するか
TOC: ラスタライズ

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

この記事では、WebGPUが点、線、三角形をどのように描画するかについて詳しく説明します。レンダーパイプラインは通常、点、線、または三角形をレンダリングします。コンピュートパイプラインは、テクスチャまたはバッファを直接更新でき、事実上「ソフトウェアラスタライズ」を実行します。この記事は、前者、つまり「ハードウェアラスタライズ」と呼ばれるものについてです。



<div class="webgpu_center">
  <div data-diagram="clip-space-to-texels" style="display: inline-block; width: 500px;"></div>
</div>


<!-- この記事の最後にこれを保持してください -->
<link href="webgpu-rasterization.css" ref="stylesheet">
<script type="module" src="webgpu-rasterization.js"></script>
