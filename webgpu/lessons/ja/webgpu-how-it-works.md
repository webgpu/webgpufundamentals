Title: WebGPUの仕組み
Description: WebGPUの仕組み
TOC: 仕組み

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

GPUが頂点シェーダーとフラグメントシェーダーで行うことと似たものをJavaScriptで実装することで、WebGPUを説明しようとします。これにより、実際に何が起こっているのか直感的に理解できることを願っています。

[Array.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)に精通している場合は、目を凝らすと、これら2種類のシェーダー関数がどのように機能するかについてある程度のアイデアを得ることができます。`Array.map`では、値を変換する関数を提供します。

例：

```js
const shader = v => v * 2;  // 入力を2倍にする
const input = [1, 2, 3, 4];
const output = input.map(shader);   // 結果 [2, 4, 6, 8]
```

上記のarray.mapの「シェーダー」は、数値を指定するとその2倍を返す関数にすぎません。これはおそらく、JavaScriptで「シェーダー」が意味するものに最も近い類推です。値を返すか生成する関数です。直接呼び出すのではなく、指定するとシステムが呼び出してくれます。

GPU頂点シェーダーの場合、入力配列をマップするのではなく、関数を何回呼び出したいかを指定するだけです。

```js
function draw(count, vertexShaderFn) {
  const internalBuffer = [];
  for (let i = 0; i < count; ++i) {
    internalBuffer[i] = vertexShaderFn(i);
  }
  console.log(JSON.stringify(internalBuffer));
}
```

1つの結果として、`Array.map`とは異なり、何かを行うためにソース配列はもう必要ありません。

```js
const shader = v => v * 2;
const count = 4;
draw(count, shader);
// 出力 [0, 2, 4, 6]
```

GPUの作業を複雑にするのは、これらの関数がコンピューター内の別のシステムであるGPUで実行されることです。つまり、作成して参照するすべてのデータを何らかの方法でGPUに送信し、そのデータをどこに置いたか、どのようにアクセスするかをシェーダーに伝える必要があります。

頂点シェーダーとフラグメントシェーダーは、ユニフォーム、属性、バッファ、テクスチャ、ステージ間変数、定数の6つの方法でデータを受け取ることができます。

1. ユニフォーム

   ユニフォームは、シェーダーの各反復で同じ値です。定数グローバル変数と考えてください。シェーダーが実行される前に設定できますが、シェーダーが使用されている間は一定のまま、つまり*一様*のままです。

   `draw`を変更して、シェーダーにユニフォームを渡すようにしましょう。これを行うには、`bindings`という配列を作成し、それを使用してユニフォームを渡します。

   ```js
   *function draw(count, vertexShaderFn, bindings) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
   *    internalBuffer[i] = vertexShaderFn(i, bindings);
     }
     console.log(JSON.stringify(internalBuffer));
   }
   ```

   そして、シェーダーを変更してユニフォームを使用するようにしましょう。

   ```js
   const vertexShader = (v, bindings) => {
     const uniforms = bindings[0];
     return v * uniforms.multiplier;
   };
   const count = 4;
   const uniforms1 = {multiplier: 3};
   const uniforms2 = {multiplier: 5};
   const bindings1 = [uniforms1];
   const bindings2 = [uniforms2];
   draw(count, vertexShader, bindings1);
   // 出力 [0, 3, 6, 9]
   draw(count, vertexShader, bindings2);
   // 出力 [0, 5, 10, 15]
   ```

   したがって、ユニフォームの概念はかなり単純に見えることを願っています。`bindings`を介した間接参照は、WebGPUで物事が行われる方法と「似ている」ためです。上記のように、この場合、ユニフォームは場所/インデックスでアクセスします。ここでは、`bindings[0]`にあります。

2. 属性（頂点シェーダーのみ）

   属性は、シェーダーの反復ごとにデータを提供します。上記の`Array.map`では、値`v`が`input`から取得され、関数に自動的に提供されました。これは、シェーダーの属性と非常によく似ています。

   違いは、入力をマップするのではなく、単にカウントしているため、WebGPUにこれらの入力とそれらからデータを取得する方法を伝える必要があることです。

   `draw`を次のように更新したと想像してください。

   ```js
   *function draw(count, vertexShaderFn, bindings, attribsSpec) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
   *    const attribs = getAttribs(attribsSpec, i);
   *    internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
     console.log(JSON.stringify(internalBuffer));
   }

   +function getAttribs(attribs, ndx) {
   +  return attribs.map(({source, offset, stride}) => source[ndx * stride + offset]);
   +}
   ```

   次に、次のように呼び出すことができます。

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [
     { source: buffer1, offset: 0, stride: 2, },
     { source: buffer1, offset: 1, stride: 2, },
     { source: buffer2, offset: 0, stride: 1, },
   ];
   const vertexShader = (v, bindings, attribs) => (attribs[0] + attribs[1]) * attribs[2];
   const bindings = [];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // 出力 [11, 110, 297, 572]
   ```

   上記のように、`getAttribs`は`offset`と`stride`を使用して、対応する`source`バッファへのインデックスを計算し、値を取得します。取得された値はシェーダーに送信されます。各反復で`attribs`は異なります。

   ```
    反復 |  属性
    ----------+-------------
        0     | [0, 1, 11]
        1     | [2, 3, 22]
        2     | [4, 5, 33]
        3     | [6, 7, 44]
   ```

3. 生のバッファ

   バッファは事実上配列です。もう一度、類推のために、バッファを使用する`draw`のバージョンを作成しましょう。ユニフォームで行ったように、これらのバッファを`bindings`を介して渡します。

   ```js
   const buffer1 = [0, 1, 2, 3, 4, 5, 6, 7];
   const buffer2 = [11, 22, 33, 44];
   const attribsSpec = [];
   const bindings = [
     buffer1,
     buffer2,
   ];
   const vertexShader = (ndx, bindings, attribs) => 
       (bindings[0][ndx * 2] + bindings[0][ndx * 2 + 1]) * bindings[1][ndx];
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // 出力 [11, 110, 297, 572]
   ```

   ここでは、属性で行ったのと同じ結果が得られましたが、今回は、システムがバッファから値を取得する代わりに、バインドされたバッファへの独自のインデックスを計算しました。これは、基本的に配列へのランダムアクセスがあるため、属性よりも柔軟です。しかし、同じ理由で、潜在的に遅くなる可能性があります。属性が機能する方法を考えると、GPUは値が順番にアクセスされることを知っており、それを使用して最適化できます。たとえば、順番アクセスは通常、キャッシュフレンドリーです。独自のインデックスを計算する場合、GPUは、実際にアクセスしようとするまで、バッファのどの部分にアクセスするかわかりません。

4. テクスチャ

   テクスチャは、1D、2D、または3Dのデータ配列です。もちろん、バッファを使用して独自の2Dまたは3D配列を実装することもできます。テクスチャの特別な点は、サンプリングできることです。サンプリングとは、提供する値の間で値を計算するようにGPUに依頼できることを意味します。これが何を意味するかについては、[テクスチャに関する記事](webgpu-textures.html)で説明します。今のところ、JavaScriptの類推をもう一度作成しましょう。

   まず、値の間で配列を*サンプリング*する関数`textureSample`を作成します。

   ```js
   function textureSample(texture, ndx) {
     const startNdx = ndx | 0;  // 整数に切り捨てます
     const fraction = ndx % 1;  // インデックス間の小数部分を取得します
     const start = texture[startNdx];
     const end = texture[startNdx + 1];
     return start + (end - start) * fraction;  // startとendの間の値を計算します
   }
   ```

   このような関数はすでにGPUに存在します。

   次に、それをシェーダーで使用しましょう。

   ```js
   const texture = [10, 20, 30, 40, 50, 60, 70, 80];
   const attribsSpec = [];
   const bindings = [
     texture,
   ];
   const vertexShader = (ndx, bindings, attribs) =>
       textureSample(bindings[0], ndx * 1.75);
   const count = 4;
   draw(count, vertexShader, bindings, attribsSpec);
   // 出力 [10, 27.5, 45, 62.5]
   ```

   `ndx`が`3`の場合、`3 * 1.75`または`5.25`を`textureSample`に渡します。これにより、`startNdx`が`5`と計算されます。したがって、インデックス`5`と`6`（`60`と`70`）を取得します。`fraction`は`0.25`になるため、`60 + (70 - 60) * 0.25`（`62.5`）が得られます。

   上記のコードを見ると、シェーダー関数で`textureSample`を自分で記述できます。2つの値を手動で取得し、それらの間を補間できます。GPUにこの特別な機能がある理由は、はるかに高速に実行できるためであり、設定によっては、1つの4浮動小数点値に対して最大16個の4浮動小数点値を読み取って、1つの4浮動小数点値を生成する場合があります。これは手動で行うには多くの作業になります。

5. ステージ間変数（フラグメントシェーダーのみ）

   ステージ間変数は、頂点シェーダーからフラグメントシェーダーへの出力です。上記のように、頂点シェーダーは、点、線、三角形を描画/ラスタライズするために使用される位置を出力します。
   
   線を描画していると想像してみましょう。頂点シェーダーが2回実行され、1回目は`5,0`に相当するものを出力し、2回目は`25,4`に相当するものを出力したとします。これら2つの点が与えられると、GPUは`5,0`から`25,4`（排他的）までの線を描画します。これを行うには、フラグメントシェーダーを20回呼び出します。その線の各ピクセルに1回ずつです。フラグメントシェーダーを呼び出すたびに、どの色を返すかを決定するのは私たち次第です。

   2つの点の間に線を描画するのに役立つ一対の関数があると仮定しましょう。最初の関数は、描画する必要のあるピクセル数と、それらを描画するのに役立ついくつかの値を計算します。2番目の関数は、その情報とピクセル番号を受け取り、ピクセル位置を返します。例：

   ```js
   const line = calcLine([10, 10], [13, 13]);
   for (let i = 0; i < line.numPixels; ++i) {
     const p = calcLinePoint(line, i);
     console.log(p);
   }
   // 出力
   // 10,10
   // 11,11
   // 12,12
   ```
   
   注：`calcLine`と`calcLinePoint`がどのように機能するかは重要ではありません。重要なのは、それらが機能し、上記のループが線のピクセル位置を提供できるようにすることです。**ただし、興味がある場合は、記事の下部近くのライブコード例を参照してください。**

   では、頂点シェーダーを変更して、反復ごとに2つの値を出力するようにしましょう。これには多くの方法があります。1つは次のとおりです。

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;
   draw(count, vertexShader, bindings, attribsSpec);
   // 出力 [[5, 0], [25, 4]]
   ```

   次に、一度に2つの点をループし、`rasterizeLines`を呼び出して線をラスタライズするコードを記述しましょう。

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for (let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
       const p0 = inputs[ndx    ];
       const p1 = inputs[ndx + 1];
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
         const offset = p[1] * destWidth + p[0];  // y * width + x
         dest[offset] = fragShaderFn(bindings);
       }
     }
   }
   ```

   `draw`を更新して、次のようにそのコードを使用できます。

   ```js
   -function draw(count, vertexShaderFn, bindings, attribsSpec) {
   +function draw(dest, destWidth,
   +              count, vertexShaderFn, fragmentShaderFn,
   +              bindings, attribsSpec,
   +) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
       const attribs = getAttribs(attribsSpec, i);
       internalBuffer[i] = vertexShaderFn(i, bindings, attribs);
     }
   -  console.log(JSON.stringify(internalBuffer));
   +  rasterizeLines(dest, destWidth, internalBuffer,
   +                 fragmentShaderFn, bindings);
   }
   ```

   これで、実際に`internalBuffer`を使用しています😃！
   
   `draw`を呼び出すコードを更新しましょう。

   ```js
   const buffer1 = [5, 0, 25, 4];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   ];
   const bindings = [];
   const vertexShader = (ndx, bindings, attribs) => [attribs[0], attribs[1]];
   const count = 2;
   -draw(count, vertexShader, bindings, attribsSpec);

   +const width = 30;
   +const height = 5;
   +const pixels = new Array(width * height).fill(0);
   +const fragShader = (bindings) => 6;

   *draw(
   *   pixels, width,
   *   count, vertexShader, fragShader,
   *   bindings, attribsSpec);
   ```

   `pixels`を`0`が`.`になる長方形として出力すると、次のようになります。

   ```
   .....666......................
   ........66666.................
   .............66666............
   ..................66666.......
   .......................66.....
   ```

   残念ながら、フラグメントシェーダーは各反復で変化する入力を受け取らないため、各ピクセルに異なるものを出力する方法はありません。ここで、ステージ間変数が登場します。最初のシェーダーを変更して、余分な値を出力するようにしましょう。

   ```js
   const buffer1 = [5, 0, 25, 4];
   +const buffer2 = [9, 3];
   const attribsSpec = [
     {source: buffer1, offset: 0, stride: 2},
     {source: buffer1, offset: 1, stride: 2},
   +  {source: buffer2, offset: 0, stride: 1},
   ];
   const bindings = [];
   const dest = new Array(2);
   const vertexShader = (ndx, bindings, attribs) => 
   -    [attribs[0], attribs[1]];
   +    [[attribs[0], attribs[1]], [attribs[2]]];

   ...
   ```

   他に何も変更しなかった場合、`draw`内のループの後、`internalBuffer`には次の値が含まれます。

   ```js
    [ 
      [[ 5, 0], [9]],
      [[25, 4], [3]],
    ]
   ```

   線のどのくらい進んだかを表す0.0から1.0までの値を簡単に計算できます。これを使用して、追加したばかりの余分な値を補間できます。

   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for(let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
   -    const p0 = inputs[ndx    ];
   -    const p1 = inputs[ndx + 1];
   +    const p0 = inputs[ndx    ][0];
   +    const p1 = inputs[ndx + 1][0];
   +    const v0 = inputs[ndx    ].slice(1);  // 最初の値以外のすべて
   +    const v1 = inputs[ndx + 1].slice(1);
       const line = calcLine(p0, p1);
       for (let i = 0; i < line.numPixels; ++i) {
         const p = calcLinePoint(line, i);
   +      const t = i / line.numPixels;
   +      const interStageVariables = interpolateArrays(v0, v1, t);
         const offset = p[1] * destWidth + p[0];  // y * width + x
   -      dest[offset] = fragShaderFn(bindings);
   +      dest[offset] = fragShaderFn(bindings, interStageVariables);
       }
     }
   }

   +// interpolateArrays([[1,2]], [[3,4]], 0.25) => [[1.5, 2.5]]
   +function interpolateArrays(v0, v1, t) {
   +  return v0.map((array0, ndx) => {
   +    const array1 = v1[ndx];
   +    return interpolateValues(array0, array1, t);
   +  });
   +}

   +// interpolateValues([1,2], [3,4], 0.25) => [1.5, 2.5]
   +function interpolateValues(array0, array1, t) {
   +  return array0.map((a, ndx) => {
   +    const b = array1[ndx];
   +    return a + (b - a) * t;
   +  });
   +}
   ```

   これで、フラグメントシェーダーでそれらのステージ間変数を使用できます。

   ```js
   -const fragShader = (bindings) => 6;
   +const fragShader = (bindings, interStageVariables) => 
   +    interStageVariables[0] | 0; // 整数に変換します
   ```

   今実行すると、次のような結果が表示されます。

   ```
   .....988......................
   ........87776.................
   .............66655............
   ..................54443.......
   .......................33.....
   ```

   頂点シェーダーの最初の反復は`[[5,0], [9]]`を出力し、2番目の反復は`[[25,4], [3]]`を出力しました。フラグメントシェーダーが呼び出されると、それらのそれぞれの2番目の値が2つの値の間で補間されたことがわかります。

   3つの点が与えられた場合に三角形をラスタライズし、三角形内の各点に対してフラグメントシェーダー関数を呼び出す別の関数`mapTriangle`を作成できます。2つではなく3つの点からステージ間変数を補間します。

上記のすべての例をライブで実行して、理解を深めるために試してみてください。

{{{example url="../webgpu-javascript-analogies.html"}}}

上記のJavaScriptで起こることは類推です。ステージ間変数が実際にどのように補間されるか、線がどのように描画されるか、バッファにどのようにアクセスされるか、テクスチャがどのようにサンプリングされるか、ユニフォーム、属性がどのように指定されるかなどの詳細は、WebGPUでは異なりますが、概念は非常に似ているため、このJavaScriptの類推が、何が起こっているのかのメンタルモデルを得るのに役立つことを願っています。

なぜこのようになっているのでしょうか？まあ、`draw`と`rasterizeLines`を見ると、各反復が他の反復から完全に独立していることに気づくかもしれません。別の言い方をすれば、各反復を任意の順序で処理できます。0、1、2、3、4の代わりに、3、1、4、0、2で処理しても、まったく同じ結果が得られます。それらが独立しているという事実は、各反復を異なるプロセッサで並行して実行できることを意味します。最新の2021年のハイエンドGPUには10000以上のプロセッサがあります。つまり、最大10000のものを並行して実行できます。これがGPUを使用する力の源です。これらのパターンに従うことで、システムは作業を大幅に並列化できます。

最大の制限は次のとおりです。

1. シェーダー関数は、その入力（属性、バッファ、テクスチャ、ユニフォーム、ステージ間変数）のみを参照できます。

2. シェーダーはメモリを割り当てることができません。

3. シェーダーは、書き込むものを参照する場合、つまり値を生成しているものを参照する場合に注意する必要があります。

   考えてみれば、これは理にかなっています。上記の`fragShader`が`dest`を直接参照しようとしたと想像してみてください。つまり、物事を並列化しようとすると、調整が不可能になります。どの反復が最初になりますか？3番目の反復が`dest[0]`を参照した場合、0番目の反復が最初に実行される必要がありますが、0番目の反復が`dest[3]`を参照した場合、3番目の反復が最初に実行される必要があります。

   この制限を回避する設計は、CPUや複数のスレッドまたはプロセスでも発生しますが、GPUランドでは、最大10000のプロセッサが一度に実行されるため、特別な調整が必要です。他の記事でいくつかのテクニックについて説明しようとします。