Title: WebGPU シェーダー定数
Description: WebGPUの基礎
TOC: 定数

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

このトピックがシェーダーへの入力と見なされるに値するかどうかはわかりません。しかし、ある観点からはそうなので、説明しましょう。

定数、より正式には*パイプラインオーバーライド可能な定数*は、シェーダーで宣言する定数の一種ですが、そのシェーダーを使用してパイプラインを作成するときに変更できます。

簡単な例は次のようになります。

```wgsl
override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

このフラグメントシェーダーを[基礎に関する記事](webgpu-fundamentals.html)の頂点シェーダーと一緒に使用します。

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // 上中央
    vec2f(-0.5, -0.5),  // 左下
    vec2f( 0.5, -0.5)   // 右下
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
```

このシェーダーをそのまま使用すると、黒い三角形が表示されます。

{{{example url="../webgpu-constants.html"}}}

しかし、パイプラインを指定するときに、これらの定数を変更、つまり「オーバーライド」できます。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
+      constants: {
+        red: 1,
+        green: 0.5,
+        blue: 1,
+      },
    },
  });
```

そして今、ピンクがかった色になります。

{{{example url="../webgpu-constants-override.html"}}}

パイプラインオーバーライド可能な定数は、スカラー値のみにすることができます。つまり、ブール値（true/false）、整数、浮動小数点数です。ベクトルや行列にすることはできません。

シェーダーで値を指定しない場合は、パイプラインで**必ず**指定する必要があります。数値IDを付けて、IDで参照することもできます。

例：

```wgsl
override red: f32;             // パイプラインで指定する必要があります
@id(123) override green = 0.0; // 'green'または123で指定できます
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

何の意味があるのか、と尋ねるかもしれません。WGSLを作成するときに、同じように簡単にこれを行うことができます。たとえば、

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
const red = ${red};
const green = ${green};
const blue = ${blue};

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
`;
```

あるいは、もっと直接的に

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(${red}, ${green}, ${blue}, 1.0);
}
`;
```

違いは、パイプラインオーバーライド可能な定数は、シェーダーモジュールが作成された**後**に適用できるため、新しいシェーダーモジュールを作成するよりも技術的に高速に適用できることです。ただし、パイプラインの作成は高速な操作ではないため、パイプライン作成の全体的なプロセスでどれだけの時間が節約されるかは明らかではありません。ただし、WebGPU実装が、特定の定数でパイプラインを初めて作成したときの情報を使用して、次回異なる定数で作成するときにはるかに少ない作業で済む可能性があります。

いずれにせよ、シェーダーに少量のデータを渡す1つの方法です。

## エントリポイントは独立して評価されます

[ステージ間変数に関する記事](webgpu-inter-stage-variables.html#a-builtin-position)で部分的に説明したように、エントリポイントは分離して評価されることを覚えておくことも重要です。

`createShaderModule`に渡されたコードが、現在のエントリポイントに関連しないすべてのものから取り除かれたかのようです。パイプラインオーバーライド定数が適用され、次に、そのエントリポイントのシェーダーが作成されます。

上記の例を拡張しましょう。頂点ステージとフラグメントステージの両方が定数を使用するようにシェーダーを変更します。頂点ステージの値をフラグメントステージに渡します。次に、50ピクセルごとに垂直ストリップを一方または他方の値で描画します。

```wgsl
+struct VOut {
+  @builtin(position) pos: vec4f,
+  @location(0) color: vec4f,
+}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
-) -> @builtin(position) vec4f {
+) -> VOut {
  let pos = array(
    vec2f( 0.0,  0.5),  // 上中央
    vec2f(-0.5, -0.5),  // 左下
    vec2f( 0.5, -0.5)   // 右下
  );

-  return vec4f(pos[vertexIndex], 0.0, 1.0);
+  return VOut(
+    vec4f(pos[vertexIndex], 0.0, 1.0),
+    vec4f(red, green, blue, 1),
+  );
}

override red = 0.0;
override green = 0.0;
override blue = 0.0;

-@fragment fn fs() -> @location(0) vec4f {
-  return vec4f(red, green, blue, 1.0);
+@fragment fn fs(v: VOut) -> @location(0) vec4f {
+  let colorFromVertexShader = v.color;
+  let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
+  // 50ピクセルごとに一方または他方の色を選択します
+  return select(
+    colorFromVertexShader,
+    colorFromFragmentShader,
+    v.pos.x % 100.0 > 50.0);
}
```

次に、各エントリポイントに異なる定数を渡します。

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
+      constants: {
+        red: 1,
+        green: 1,
+        blue: 0,
+      },
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

結果は、各ステージで定数が異なっていたことを示しています。

{{{example url="../webgpu-constants-override-set-entry-points.html"}}}

繰り返しになりますが、機能的には、1つのWGSL `code`を持つ1つのシェーダーモジュールを使用したという事実は、単なる便宜上のものです。上記のコードは、機能的には次のものと同じです。

```js
  const vertexModule = device.createShaderModule({
    code: `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VOut {
        let pos = array(
          vec2f( 0.0,  0.5),  // 上中央
          vec2f(-0.5, -0.5),  // 左下
          vec2f( 0.5, -0.5)   // 右下
        );

        return VOut(
          vec4f(pos[vertexIndex], 0.0, 1.0),
          vec4f(red, green, blue, 1),
        );
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;
    `,
  });

  const fragmentModule = device.createShaderModule({
    code: `
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
      }

      override red = 0.0;
      override green = 0.0;
      override blue = 0.0;

      @fragment fn fs(v: VOut) -> @location(0) vec4f {
        let colorFromVertexShader = v.color;
        let colorFromFragmentShader = vec4f(red, green, blue, 1.0);
        // 50ピクセルごとに一方または他方の色を選択します
        return select(
          colorFromVertexShader,
          colorFromFragmentShader,
          v.pos.x % 100.0 > 50.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
*      module: vertexModule,
      constants: {
        red: 1,
        green: 1,
        blue: 0,
      },
    },
    fragment: {
*      module: fragmentModule,
      targets: [{ format: presentationFormat }],
      constants: {
        red: 1,
        green: 0.5,
        blue: 1,
      },
    },
  });
```

{{{example url="../webgpu-constants-override-separate-modules.html"}}}

注：パイプラインオーバーライド可能な定数を使用して色を渡すことは一般的では**ありません**。結果を理解しやすく、表示しやすくするために色を使用しました。