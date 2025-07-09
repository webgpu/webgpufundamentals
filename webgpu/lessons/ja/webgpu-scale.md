Title: WebGPU スケール
Description: オブジェクトのスケーリング
TOC: スケール

この記事は、3D数学について学ぶことを目的とした一連の記事の3番目です。各記事は前のレッスンを基にしているので、順番に読むと最も理解しやすいかもしれません。

1. [平行移動](webgpu-translation.html)
2. [回転](webgpu-rotation.html)
3. [スケーリング](webgpu-scale.html) ⬅ ここです
4. [行列演算](webgpu-matrix-math.html)
5. [正射影](webgpu-orthographic-projection.html)
6. [透視投影](webgpu-perspective-projection.html)
7. [カメラ](webgpu-cameras.html)
8. [行列スタック](webgpu-matrix-stacks.html)
9. [シーングラフ](webgpu-scene-graphs.html)

スケーリングは、[平行移動](webgpu-translation.html)と同じくらい簡単です。

頂点位置に目的のスケールを乗算します。[前の例](webgpu-rotation.html)のシェーダーへの変更は次のとおりです。

```wgsl
struct Uniforms {
  color: vec4f,
  resolution: vec2f,
  translation: vec2f,
  rotation: vec2f,
  scale: vec2f,
};

struct Vertex {
  @location(0) position: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;

+  // 位置をスケーリングします
+  let scaledPosition = vert.position * uni.scale;

  // 位置を回転させます
  let rotatedPosition = vec2f(
-    vert.position.x * uni.rotation.y - vert.position.y * uni.rotation.x,
-    vert.position.x * uni.rotation.x + vert.position.y * uni.rotation.y
+    scaledPosition.x * uni.rotation.y - scaledPosition.y * uni.rotation.x,
+    scaledPosition.x * uni.rotation.x + scaledPosition.y * uni.rotation.y
  );

  // 平行移動を追加します
  let position = rotatedPosition + uni.translation;

  // 位置をピクセルから0.0から1.0の値に変換します
  let zeroToOne = position / uni.resolution;

  // 0 <-> 1から0 <-> 2に変換します
  let zeroToTwo = zeroToOne * 2.0;

  // 0 <-> 2から-1 <-> +1（クリップ空間）に変換します
  let flippedClipSpace = zeroToTwo - 1.0;

  // Yを反転させます
  let clipSpace = flippedClipSpace * vec2f(1, -1);

  vsOut.position = vec4f(clipSpace, 0.0, 1.0);
  return vsOut;
}
```

そして、以前と同様に、スケール値のためのスペースを確保するためにユニフォームバッファを更新する必要があります。

```js
-  // 色、解像度、平行移動、回転、パディング
-  const uniformBufferSize = (4 + 2 + 2 + 2) * 4 + 8;
+  // 色、解像度、平行移動、回転、スケール
+  const uniformBufferSize = (4 + 2 + 2 + 2 + 2) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kColorOffset = 0;
  const kResolutionOffset = 4;
  const kTranslationOffset = 6;
  const kRotationOffset = 8;
+  const kScaleOffset = 10;

  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const resolutionValue = uniformValues.subarray(kResolutionOffset, kResolutionOffset + 2);
  const translationValue = uniformValues.subarray(kTranslationOffset, kTranslationOffset + 2);
  const rotationValue = uniformValues.subarray(kRotationOffset, kRotationOffset + 2);
+  const scaleValue = uniformValues.subarray(kScaleOffset, kScaleOffset + 2);
```

そして、レンダリング時にスケールを更新する必要があります。

```js
  const settings = {
    translation: [150, 100],
    rotation: degToRad(30),
+    scale: [1, 1],
  };

  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  const gui = new GUI();
  gui.onChange(render);
  gui.add(settings.translation, '0', 0, 1000).name('translation.x');
  gui.add(settings.translation, '1', 0, 1000).name('translation.y');
  gui.add(settings, 'rotation', radToDegOptions);
+  gui.add(settings.scale, '0', -5, 5).name('scale.x');
+  gui.add(settings.scale, '1', -5, 5).name('scale.y');

  function render() {
    ...

    // JavaScript側のFloat32Arrayでユニフォーム値を設定します
    resolutionValue.set([canvas.width, canvas.height]);
    translationValue.set(settings.translation);
    rotationValue.set([
        Math.cos(settings.rotation),
        Math.sin(settings.rotation),
    ]);
+    scaleValue.set(settings.scale);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

そして、スケールができました。スライダーをドラッグしてください。

{{{example url="../webgpu-scale.html" }}}

注意すべき点の1つは、負の値でスケーリングするとジオメトリが反転することです。

もう1つ注意すべき点は、0、0からスケーリングすることです。これは、Fの場合は左上隅です。位置をスケールで乗算しているため、0、0から離れて移動するのは理にかなっています。おそらく、それを修正する方法を想像できるでしょう。たとえば、スケーリングする前に別の平行移動、*プレスケール*平行移動を追加できます。別の解決策は、実際のFの位置データを変更することです。すぐに別の方法について説明します。

これらの最後の3つの投稿が、[平行移動](webgpu-translation.html)、[回転](webgpu-rotation.html)、およびスケールの理解に役立ったことを願っています。次に、[行列の魔法](webgpu-matrix-math.html)について説明します。これら3つすべてを**はるかに単純**で、多くの場合より便利な形式に組み合わせます。