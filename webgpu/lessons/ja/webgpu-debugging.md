Title: WebGPUのデバッグとエラー
Description: WebGPUのデバッグのヒント
TOC: デバッグとエラー

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

WebGPUのデバッグとエラー処理に関するいくつかのヒントです。

## JavaScriptコンソールを開いてWebGPUエラーを確認する

ほとんどのブラウザにはJavaScriptコンソールがあります。開いたままにしておいてください。WebGPUは通常、そこにエラーを出力します。

## 未捕捉のエラーをログに記録することを検討する

未捕捉のWebGPUエラーをキャッチするイベントを設定し、自分でログに記録できます。たとえば、

```js
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', event => alert(event.error.message));
```

個人的には、通常`alert`は使用しませんが、メッセージをログに記録したり、要素に入れたり、何らかの方法で表示したりできます。これは、上記のJavaScriptコンソールを開くというアドバイスを忘れがちで、エラーが表示されないことが多いため、便利だと思います。😅

WebGPU自体が発行するエラーはJavaScriptコンソールに送られますが、キャプチャしたエラーは指定した場所に送られます。

## WebGPUがエラーを報告するのを助ける

WebGPUのエラーは非同期に報告されます。これは、WebGPUを高速かつ効率的に保つためです。しかし、これは、WebGPUを助けない限り、期待したときに、またはまったくエラーが発生しない可能性があることを意味します。

これは、上記のアドバイスを使用したコードで、未捕捉のエラーを表示するイベントを追加しています。次に、エラーが発生するはずのシェーダーモジュールをコンパイルします。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
    log(event.error.message);
  });

  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });

  log('--done--');
}
```

以下のライブサンプルでは、少なくともChrome 129では、おそらくエラーは発生しません。

{{{example url="../webgpu-debugging-help-webgpu-report-errors.html"}}}

その理由は、この場合、WebGPUのChromeは、特定の関数を呼び出すまで特定のエラーを処理しないためです。そのような関数の1つが`submit`です。

```js
async function main() {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
    log(event.error.message);
  });

  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });

+  // WebGPUをポンプする
+  device.queue.submit([]);

  log('--done--');
}
```

これでエラーが表示されるはずです。

{{{example url="../webgpu-debugging-help-webgpu-report-errors-fixed.html"}}}

この問題は、`submit`を呼び出さない場合は、まだWebGPUを実際には使用していないため、めったに発生しません。しかし、技術サポートの質問やバグレポートのために最小限の完全な検証可能な例を作成しようとしている場合や、コードをステップ実行していて、エラーを引き起こすはずの行を通過したのに、まだエラーが表示されていない場合など、特別な状況で発生する可能性があります。

注：エラーをJavaScriptコンソールにも表示したくない場合は、`event.preventDefault()`を呼び出すことができます。

## 手動でエラーをキャッチする

上記では、「未捕捉のエラー」のメッセージを表示しましたが、これは「捕捉されたエラー」というものがあることを意味します。エラーを捕捉するには、一対の関数があります。`device.pushErrorScope`と`device.popErrorScope`です。

エラースコープをプッシュします。コマンドを送信し、エラースコープをポップして、プッシュしたときとポップしたときの間にエラーがあったかどうかを確認します。

例：

```js
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();

  device.addEventListener('uncapturederror', event => {
*    log('uncaptured error:', event.error.message);
  });

+  device.pushErrorScope('validation');
  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });
+  const error = await device.popErrorScope();
+  if (error) {
+    log('captured error:', error.message);
+  }

+  device.createShaderModule({
+    code: /* wgsl */ `
+      also, this shader won't compile
+    `,
+  });

  device.queue.submit([]);

  log('--done--');
```

`device.pushErrorScope`は、3つのフィルターのいずれかを取ります。

* `'validation'`

  APIの誤った使用に関連するエラー

* `'out-of-memory'`

  メモリを割り当てすぎようとしたことに関連するエラー

* `'internal'`

  何も間違っていないのにドライバーが文句を言ったエラー。たとえば、シェーダーが複雑すぎる場合に発生する可能性があります。

{{{example url="../webgpu-debugging-push-pop-error-scope.html"}}}

`popErrorScope`は、エラーがあった場合はエラーまたはnullを含むプロミスを返します。上記では`await`を使用してプロミスを待機しましたが、これによりプログラムが停止します。次のように`then`を使用する方が一般的です。

```js
  device.pushErrorScope('validation');
  device.createShaderModule({
    code: /* wgsl */ `
      this shader won't compile
    `,
  });
+  device.popErrorScope().then(error => {
+    if (error) {
+      log('captured error:', error.message);
+    }
+  });
```

こうすることで、プログラムは一時停止せず、エラーがあったかどうかについてGPUが応答するのを待ちます。

## さまざまな種類のエラー

WebGPUの一部のエラーは、関数を呼び出すときにチェックされます。その他は後でチェックされます。WebGPUはタイムラインを指定します。そのうちの2つは「コンテンツタイムライン」と「デバイスタイムライン」です。「コンテンツタイムライン」はJavaScript自体と同じタイムラインです。デバイスタイムラインは別個であり、通常は別のプロセスで実行されます。さらに他のエラーは、JavaScript自体のルールによってチェックされます。

* JavaScriptエラーの例：間違った型を渡す

  ```js
  device.queue.writeBuffer(someTexture, ...);
  ```

  上記のコードは、`writeBuffer`の最初の引数が`GPUBuffer`でなければならないため、すぐにエラーになります。これはJavaScript自体が強制します。

* 「コンテンツタイムライン」エラーの例

  ```js
  device.createTexture({
    size: [],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  ```

  上記で提供されている`size`はエラーであり、少なくとも1つの要素が必要です。

* デバイスエラーの例

  ページの冒頭の例はデバイスエラーです。デバイスエラーは、`pushErrorScope`、`popErrorScope`、および未捕捉のエラーイベントが処理するものです。

エラーが発生する場所は[仕様](https://www.w3.org/TR/webgpu/)に詳述されていますが、JavaScriptエラーとコンテンツタイムラインエラーはすぐに発生して例外をスローするのに対し、デバイスタイムラインエラーは非同期に発生することを知っておくことが重要です。

## WGSLエラー

シェーダーモジュールのコンパイルでエラーが発生した場合は、`getComplicationInfo`を呼び出すことで、より詳細な情報を要求できます。

例：

```js
  device.pushErrorScope('validation');
  const code = `
      // この関数は
      // 存在しない
      // 関数を呼び出します。

      fn foo() -> vec3f {
        return someFunction(1, 2);
      }
    `;
  const module = device.createShaderModule({ code });
  device.popErrorScope().then(async error => {
    if (error) {
      const info = await module.getCompilationInfo();

      // コードを行に分割します
      const lines = code.split('\n');

      // メッセージを行番号の逆順で並べ替えます
      // これにより、メッセージを挿入しても
      // 行番号に影響しません。
      const msgs = [...info.messages].sort((a, b) => b.lineNum - a.lineNum);

      // エラーメッセージを行の間に挿入します
      for (const msg of msgs) {
        lines.splice(msg.lineNum, 0,
          `${''.padEnd(msg.linePos - 1)}${''.padEnd(msg.length, '^')}`,
          msg.message,
        );
      }

      log(lines.join('\n'));
    }
  });
```

上記のコードは、エラーメッセージを完全なシェーダーコードに効果的にインターリーブします。

{{{example url="../webgpu-debugging-get-compilation-info.html"}}}

`getCompilationInfo`は、`GPUCompilationMessage`の配列を含むオブジェクトを返します。各メッセージには次のフィールドがあります。

* `message`: 文字列のエラーメッセージ
* `type`: `'error'`、`'warning'`、または`'info'`
* `lineNum`: エラーの行番号、1から始まる
* `linePos`: エラーの行内の位置、1から始まる
* `offset`: エラーの文字列内の位置、0から始まる。（これは事実上、linePos、lineNumと同じ情報です）
* `length`: ハイライトする長さ

## WebGPU-Dev-Extension

[WebGPU-Dev-Extension](https://github.com/greggman/webgpu-dev-extension)は、デバッグに役立つ機能を提供します。

できることのいくつか：

* エラーが発生した場所のスタックトレースを表示します。

  上記で示したように、WebGPUのエラーは非同期に発生します。最初の例では、`uncapturederror`イベントを使用してWebGPUエラーが発生したことを確認しましたが、そのエラーがJavaScriptのどこで発生したかについての情報はありませんでした。

  webgpu-dev-extensionは、エラーを生成するすべてのWebGPU関数の周りに`pushErrorScope`と`popErrorScope`への呼び出しを追加しようとすることで、この情報を提供します。内部では、スタックトレースを保持する`Error`オブジェクトを作成します。エラーが発生した場合、その`Error`オブジェクトを出力でき、エラーが最初に生成された場所のエラースタックが表示されます。

* コマンドエンコーダーのエラーを表示します。

  WebGPUでは、`GPUCommandEncoder`、`GPURenderPassEncoder`、`GPUComputePassEncoder`、`GPURenderBundleEncoder`などのコマンドエンコーダーは、デバイスタイムラインエラーを生成しません。代わりに、エラーは`encoder.finish`を呼び出すまで保存されます。

  例：

  ```js
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass(renderPassDesc);
  pass.setPipeline(somePipeline);
  pass.setBindGroup(0, someBindGroupIncompatibleWithSomePipeline); // おっと！
  pass.setVertexBuffer(0, positionBuffer);
  pass.setVertexBuffer(1, normalBuffer);
  pass.setIndexBuffer(indexBuffer, 'uint16');
  pass.drawIndexed(4);
  pass.end();
  const cb = encoder.finish();  // 上記のエラーはここで生成されます
  ```

  ここでの問題は、せいぜい、グループ0にバインドされたバインドグループがパイプラインと互換性がないというエラーメッセージが表示されるだけで、エラーが発生した行がわからないことです。このような小さな例では、かなり明白なはずですが、大きなアプリでは、エラーの原因となった特定の行を追跡するのが難しい場合があります。

  webgpu-dev-extensionは、エラーの原因となった行でエラーをスローしようとすることができます。

* WGSLエラーを完全なシェーダーソースとインターリーブして表示します。

  上記の例のように、webgpu-dev-extensionには、単なる簡潔なエラーメッセージ（デフォルト）ではなく、ソースWGSLとインターリーブされたエラーを表示するオプションがあります。

## WebGPU-Inspector

[WebGPU-Inspector](https://github.com/brendan-duncan/webgpu_inspector)は、すべてのWebGPUコマンドをキャプチャしようとし、バッファ、テクスチャ、呼び出しを検査し、一般的にWebGPUコードで何が起こっているかを確認できるようにします。

<div class="webgpu_center"><img src="resources/images/frame_capture_commands.jpg"style="width: 1200px;"></div>

## シェーダーのデバッグのヒント

### 単純化する：

できるだけ多くを切り取って、シェーダーを動作状態にします。動作したら、少しずつ元に戻します。

### 単色を表示する

レンダーパスの場合、私がよく行う最初のことは、単色を表示することです。

これは、[スポットライトに関する記事](webgpu-lighitng-spot.html)の最後のシェーダーです。

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // vsOut.normalはステージ間変数であるため、
  // 補間されるため、単位ベクトルにはなりません。
  // 正規化すると、再び単位ベクトルになります。
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);

  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
  let inLight = smoothstep(uni.outerLimit, uni.innerLimit, dotFromDirection);

  // 法線と光への方向のドット積を
  // 取ることで光を計算します。
  let light = inLight * dot(normal, surfaceToLightDirection);

  var specular = dot(normal, halfVector);
  specular = inLight * select(
      0.0,                           // 条件がfalseの場合の値
      pow(specular, uni.shininess),  // 条件がtrueの場合の値
      specular > 0.0);               // 条件

  // 色の部分（アルファではない）のみを
  // 光で乗算しましょう。
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

この例は、スポットライトで照らされた小さな部分を持つ緑色のFをレンダリングすることになっています。バグのあるバージョンを次に示します。デバッグしましょう。

{{{example url="../webgpu-debugging-spot-light-01.html"}}}

実行しましたが、画面に何も表示されず、WebGPUエラーもありませんでした。私が最初に行うことは、単色の赤を返すように変更することです。

```wgsl
  let color = uni.color.rgb * light + specular;
-  return vec4f(color, uni.color.a);
+  //return vec4f(color, uni.color.a);
+  return vec4f(1, 0, 0, 1);  // 単色の赤
```

赤いFが表示された場合は、Fを構成する三角形を描画するのに十分な頂点シェーダーが正しかったことが明らかなので、フラグメントシェーダーを調べ始める必要があります。赤いFが表示されない場合は、頂点シェーダーを調べ始める必要があります。

試してみます：

{{{example url="../webgpu-debugging-spot-light-02.html"}}}

赤いFが表示されます。では、法線を視覚化してみましょう。そのためには、フラグメントシェーダーの末尾を次のように変更します。

```wgsl
  let color = uni.color.rgb * light + specular;
  //return vec4f(color, uni.color.a);
-   return vec4f(1, 0, 0, 1);  // 単色の赤
+   //return vec4f(1, 0, 0, 1);  // 単色の赤
+   return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 法線
```

法線は-1.0から+1.0までですが、色は0.0から1.0までなので、0.5を掛けて0.5を足すことで、法線を色で視覚化できるものに変換します。

試してみます：

{{{example url="../webgpu-debugging-spot-light-03.html"}}}

うーん、これは正しくありません。すべての法線が0,0,0であるように見えます。明らかに、フラグメントシェーダーの法線に何か問題があります。これらの法線は、`normalMatrix`で乗算された後、頂点シェーダーから来ています。`normalMatrix`で乗算せずに、法線を直接渡してみましょう。Fが表示されれば、バグは`normalMatrix`にあることがわかります。Fが表示されない場合は、頂点シェーダーに供給されるデータにバグがあります。

```wgsl
  // 法線を方向付け、フラグメントシェーダーに渡します
-  vsOut.normal = uni.normalMatrix * vert.normal;
+  //vsOut.normal = uni.normalMatrix * vert.normal;
+  vsOut.normal = vert.normal;
```

実行すると：

{{{example url="../webgpu-debugging-spot-light-04.html"}}}

その方がそれらしく見えます。どうやら`normalMatrix`に何か問題があるようです。

コードを確認すると、コメントアウトされていたため、行列がすべてゼロになっていました。誰かが何かを確認していて、コメントアウトを解除するのを忘れたに違いありません。😅

```js
    // 逆行列と転置行列をworldInverseTranspose値に変換します
-    //mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

コメントアウトを解除しましょう。次に、頂点シェーダーを元の状態に戻しましょう。

```wgsl
  // 法線を方向付け、フラグメントシェーダーに渡します
-  //vsOut.normal = uni.normalMatrix * vert.normal;
-  vsOut.normal = vert.normal;
+  vsOut.normal = uni.normalMatrix * vert.normal;
```

これにより、次のようになります。

{{{example url="../webgpu-debugging-spot-light-05.html"}}}

Fを回転させると、色が変化し、法線が`normalMatrix`によって再方向付けされていることがわかります。回転しても色が変わらない上のものと比較してください。

これで、最終的にフラグメントシェーダーを復元できます。

```wgsl
  let color = uni.color.rgb * light + specular;
-  //return vec4f(color, uni.color.a);
-  //return vec4f(1, 0, 0, 1);  // 単色の赤
-  return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 法線
+  return vec4f(color, uni.color.a);
```

そして、意図したとおりに機能しています。

{{{example url="../webgpu-debugging-spot-light-06.html"}}}

データを視覚化する方法を見つけることは、それをチェックする良い方法です。たとえば、[テクスチャ座標](webpgu-textures.html)をチェックするには、次のようにします。

```wgsl
   return vec4f(fract(textureCoord), 0, 1);
```

テクスチャ座標は通常0.0から1.0までですが、テクスチャを繰り返している場合はそれより高くなる可能性があるため、`fract`がそれをカバーします。

テクスチャ座標がどのように見えるかを示すために、テクスチャ座標を視覚化したオブジェクトをいくつか示します。

<div class="webgpu_center">
   <div data-diagram="texcoords" style="width: 1024px; height: 400px;"></div>
   <div class="caption">視覚化されたテクスチャ座標</div>
</div>

テクスチャ座標は、通常、ある表面上で滑らかです。

バグのある同じテクスチャ座標を視覚化したものを次に示します。

<div class="webgpu_center">
   <div data-diagram="texcoords-bad"  style="width: 1024px; height: 400px;"></div>
   <div class="caption">不正なテクスチャ座標</div>
</div>

それらはもはや滑らかではないので、何かがおかしい可能性があります。

上記と同じ手順に従うと、頂点シェーダーに入力されるデータが不正であると結論付けることができます。そして実際、この例では、頂点データを`float32x3`値としてアップロードしていますが、レンダーパイプライン記述子で誤って`float16x2`として指定しています。

<!-- この記事の最後にこれを保持してください -->
<link href="webgpu-debugging.css" rel="stylesheet">
<script type="module" src="webgpu-debugging.js"></script>
