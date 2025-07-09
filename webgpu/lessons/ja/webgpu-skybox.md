Title: WebGPU スカイボックス
Description: スカイボックスで空を表示しよう！
TOC: スカイボックス


この記事は、[環境マップに関する記事](webgpu-environment-maps.html)の続きです。

*スカイボックス*は、すべての方向の空、またはむしろ地平線を含む非常に遠くにあるもののように見えるようにテクスチャが貼られた箱です。部屋に立っていて、各壁に何らかの景色のフルサイズのポスターがあり、天井を覆う空を示すポスターと、地面を示す床用のポスターを追加すると、それがスカイボックスです。

多くの3Dゲームは、単にキューブを作成し、それを非常に大きくし、空のテクスチャを貼ることでこれを行います。

これは機能しますが、問題があります。1つの問題は、複数の方向、つまりカメラが向いているあらゆる方向で表示する必要があるキューブがあることです。すべてを遠くに描画したいのですが、キューブの角がクリッピング平面の外に出ないようにしたいです。その問題を複雑にしているのは、パフォーマンス上の理由から、遠くのものより近くのものを描画したいということです。なぜなら、GPUは[深度テクスチャ](webgpu-orthographic.html)を使用して、テストに失敗することがわかっているピクセルの描画をスキップできるからです。したがって、理想的には、深度テストをオンにしてスカイボックスを最後に描画する必要がありますが、実際にボックスを使用すると、カメラがさまざまな方向を向くと、ボックスの角が側面よりも遠くなり、問題が発生します。

<div class="webgpu_center"><img src="resources/skybox-issues.svg" style="width: 500px"></div>

上記のように、キューブの最も遠い点が錐台の内側にあることを確認する必要がありますが、そのため、キューブの一部のエッジが、覆いたくないオブジェクトを覆ってしまう可能性があります。

一般的な解決策は、深度テストをオフにして最初にスカイボックスを描画することですが、そうすると、後でシーン内のもので覆うピクセルを描画しない深度テストによるパフォーマンス上の利点が得られません。

キューブを使用する代わりに、[キャンバス全体を覆う三角形を描画](webgpu-large-triangle-to-cover-clip-space.html)し、[キューブマップ](webgpu-cube-maps.html)を使用しましょう。通常、ビュー射影行列を使用して3D空間にジオメトリを射影します。この場合、逆のことを行います。ビュー射影行列の逆行列を使用して逆方向に作業し、描画される各ピクセルに対してカメラが見ている方向を取得します。これにより、キューブマップを調べる方向が得られます。

[環境マップの例](webgpu-environment-maps.html)から始めます。これは、すでにキューブマップを読み込み、そのためのミップを生成するためです。ハードコードされた三角形を使用しましょう。これがシェーダーです。

```wgsl
struct Uniforms {
  viewDirectionProjectionInverse: mat4x4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) pos: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
  let pos = array(
    vec2f(-1, 3),
    vec2f(-1,-1),
    vec2f( 3,-1),
  );
  var vsOut: VSOutput;
  vsOut.position = vec4f(pos[vNdx], 1, 1);
  vsOut.pos = vsOut.position;
  return vsOut;
}
```

上記のように、まず、`vsOut.position`を介して`@builtin(position)`を頂点位置に設定し、zを明示的に1に設定して、クワッドが最も遠いz値で描画されるようにします。また、頂点位置をフラグメントシェーダーに渡します。

フラグメントシェーダーでは、位置を逆ビュー射影行列で乗算し、wで除算して4D空間から3D空間に移動します。これは、頂点シェーダーの`@builtin(position)`で発生するのと同じ除算ですが、ここでは自分で行っています。

```glsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  let t = uni.viewDirectionProjectionInverse * vsOut.pos;
  return textureSample(ourTexture, ourSampler, normalize(t.xyz / t.w) * vec3f(1, 1, -1));
}
```

注：[前の記事で説明した理由](webgpu-environment-maps.html#a-flipped)により、z方向を-1で乗算します。

パイプラインには、頂点ステージにバッファがありません。

```js
  const pipeline = device.createRenderPipeline({
    label: 'no attributes',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less-equal',
      format: 'depth24plus',
    },
  });
```

深度テクスチャを1.0にクリアし、1.0でレンダリングしているため、`depthCompare`を`less`ではなく`less-equal`に設定したことに注意してください。1.0は1.0より小さくないため、これを`less-equal`に変更しないと何もレンダリングされません。

繰り返しになりますが、ユニフォームバッファを設定する必要があります。

```js
  // viewDirectionProjectionInverse
  const uniformBufferSize = (16) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kViewDirectionProjectionInverseOffset = 0;

  const viewDirectionProjectionInverseValue = uniformValues.subarray(
      kViewDirectionProjectionInverseOffset,
      kViewDirectionProjectionInverseOffset + 16);
```

そして、レンダリング時に設定します。

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
    );
    // 原点から原点を見つめる円を描くカメラ
    const cameraPosition = [Math.cos(time * .1), 0, Math.sin(time * .1)];
    const view = mat4.lookAt(
      cameraPosition,
      [0, 0, 0],  // target
      [0, 1, 0],  // up
    );
    // 方向のみを気にするので、平行移動を削除します
    view[12] = 0;
    view[13] = 0;
    view[14] = 0;

    const viewProjection = mat4.multiply(projection, view);
    mat4.inverse(viewProjection, viewDirectionProjectionInverseValue);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

上記では、`cameraPosition`を計算する原点を中心にカメラを回転させていることに注意してください。次に、`view`行列を作成した後、カメラがどこにあるかではなく、どの方向を向いているかだけを気にするため、平行移動をゼロにします。

そこから、射影行列で乗算し、逆行列を取り、行列を設定します。

{{{example url="../webgpu-skybox.html" }}}

環境マップされたキューブをこのサンプルに戻しましょう。まず、多数の変数の名前を変更しましょう。

スカイボックスの例から

```
module -> skyBoxModule
pipeline -> skyBoxPipeline
uniformBuffer -> skyBoxUniformBuffer
uniformValues -> skyBoxUniformValues
bindGroup -> skyBoxBindGroup
```

同様に、環境マップの例から

```
module -> envMapModule
pipeline -> envMapPipeline
uniformBuffer -> envMapUniformBuffer
uniformValues -> envMapUniformValues
bindGroup -> envMapBindGroup
```

これらの名前を変更したら、レンダリングコードを更新するだけです。まず、両方のユニフォーム値を更新します。

```js
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(
        60 * Math.PI / 180,
        aspect,
        0.1,      // zNear
        10,      // zFar
        projectionValue,
    );
    // 原点から原点を見つめる円を描くカメラ
    cameraPositionValue.set([Math.cos(time * .1) * 5, 0, Math.sin(time * .1) * 5]);
    const view = mat4.lookAt(
      cameraPositionValue,
      [0, 0, 0],  // target
      [0, 1, 0],  // up
    );
    // ビューの平行移動をゼロにするので、ビューをviewValueにコピーします
    viewValue.set(view);

    // 方向のみを気にするので、平行移動を削除します
    view[12] = 0;
    view[13] = 0;
    view[14] = 0;
    const viewProjection = mat4.multiply(projectionValue, view);
    mat4.inverse(viewProjection, viewDirectionProjectionInverseValue);

    // キューブを回転させます
    mat4.identity(worldValue);
    mat4.rotateX(worldValue, time * -0.1, worldValue);
    mat4.rotateY(worldValue, time * -0.2, worldValue);

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(envMapUniformBuffer, 0, envMapUniformValues);
    device.queue.writeBuffer(skyBoxUniformBuffer, 0, skyBoxUniformValues);
```

次に、両方をレンダリングします。環境マップされたキューブを最初に、スカイボックスを2番目にレンダリングして、2番目に描画しても機能することを示します。

```js
    // キューブを描画します
    pass.setPipeline(envMapPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint16');
    pass.setBindGroup(0, envMapBindGroup);
    pass.drawIndexed(numVertices);

    // スカイボックスを描画します
    pass.setPipeline(skyBoxPipeline);
    pass.setBindGroup(0, skyBoxBindGroup);
    pass.draw(3);
```

{{{example url="../webgpu-skybox-plus-environment-map.html" }}}

これらの最後の2つの記事が、キューブマップの使用方法についてある程度のアイデアを与えてくれたことを願っています。たとえば、[ライティングの計算](webgpu-lighting-spot.html)のコードを取得し、その結果を環境マップからの結果と組み合わせて、車のボンネットや磨かれた床のようなマテリアルを作成するのが一般的です。