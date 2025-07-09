Title: WebGPU - 指向性ライティング
Description: WebGPUで指向性ライティングを実装する方法
TOC: 指向性ライティング


この記事は、[カメラに関する記事](webgpu-cameras.html)を読んでいることを前提としています。

ライティングを実装する方法はたくさんあります。おそらく最も単純なのは*指向性ライティング*です。

指向性ライティングは、光が一方向から均一に来ていると仮定します。晴れた日の太陽は、しばしば指向性ライトと見なされます。それは非常に遠くにあるため、その光線はオブジェクトの表面にすべて平行に当たっていると見なすことができます。

指向性ライティングの計算は、実際には非常に簡単です。光がどの方向に進んでいるか、オブジェクトの表面がどの方向を向いているかがわかっていれば、2つの方向の*ドット積*を取ることができ、これにより2つの方向間の角度のコサインが得られます。

例を次に示します。

{{{diagram url="resources/dot-product.html" caption="点をドラッグ" width="700" height="400"}}}

点をドラッグすると、互いに正反対になるとドット積が-1になることがわかります。まったく同じ場所にある場合、ドット積は1です。

これはどのように役立ちますか？まあ、3Dオブジェクトの表面がどの方向を向いているか、光がどの方向に照らされているかがわかっていれば、それらのドット積を取るだけで、光が表面に直接当たっている場合は1、正反対を向いている場合は-1の数値が得られます。

{{{diagram url="resources/directional-lighting.html" caption="方向を回転" width="700" height="400"}}}

そのドット積の値で色を乗算すれば、出来上がりです！光です！

1つの問題は、3Dオブジェクトの表面がどの方向を向いているかをどうやって知るかです。

## 法線の紹介

なぜ*法線*と呼ばれるのかはわかりませんが、少なくとも3Dグラフィックスでは、法線は表面が向いている方向を表す単位ベクトルの単語です。

キューブと球の法線をいくつか示します。

{{{diagram url="resources/normals.html" width="700" height="400"}}}

オブジェクトから突き出ている線は、各頂点の法線を表します。

キューブの各コーナーに3つの法線があることに注意してください。これは、キューブの各面が向いている方向を表すために3つの異なる法線が必要だからです。

ここでは、法線も方向に基づいて色付けされており、正のxは<span style="color: red;">赤</span>、上は<span style="color: green;">緑</span>、正のzは<span style="color: blue;">青</span>です。

では、[前の例](webgpu-cameras.html)の`F`に法線を追加して、照らすことができるようにしましょう。`F`は非常に箱型で、その面はx、y、またはz軸に整列しているため、非常に簡単です。前を向いているものは法線`0, 0, 1`（正のZ）を持ちます。後ろを向いているものは`0, 0, -1`です。（負のZ）。左を向いているのは`-1, 0, 0`（負のX）、右を向いているのは`1, 0, 0`（正のX）です。上は`0, 1, 0`（正のY）、下は`0, -1, 0`（負のY）です。ついでに、頂点の色はライティングを見るのを難しくするので、削除します。

```js
function createFVertices() {
  const positions = [
    // 左列
     -50,  75,  15,
     -20,  75,  15,
     -50, -75,  15,
     -20, -75,  15,

    // 上の横木
     -20,  75,  15,
      50,  75,  15,
     -20,  45,  15,
      50,  45,  15,

    // 中間の横木
     -20,  15,  15,
      20,  15,  15,
     -20, -15,  15,
      20, -15,  15,

    // 左列の裏
     -50,  75, -15,
     -20,  75, -15,
     -50, -75, -15,
     -20, -75, -15,

    // 上の横木の裏
     -20,  75, -15,
      50,  75, -15,
     -20,  45, -15,
      50,  45, -15,

    // 中間の横木の裏
     -20,  15, -15,
      20,  15, -15,
     -20, -15, -15,
      20, -15, -15,
  ];

  const indices = [
     0,  2,  1,    2,  3,  1,   // 左列
     4,  6,  5,    6,  7,  5,   // 上の横木
     8, 10,  9,   10, 11,  9,   // 中間の横木

    12, 13, 14,   14, 13, 15,   // 左列の裏
    16, 17, 18,   18, 17, 19,   // 上の横木の裏
    20, 21, 22,   22, 21, 23,   // 中間の横木の裏

     0,  5, 12,   12,  5, 17,   // 上
     5,  7, 17,   17,  7, 19,   // 上の横木の右
     6, 18,  7,   18, 19,  7,   // 上の横木の下
     6,  8, 18,   18,  8, 20,   // 上と中間の横木の間
     8,  9, 20,   20,  9, 21,   // 中間の横木の上
     9, 11, 21,   21, 11, 23,   // 中間の横木の右
    10, 22, 11,   22, 23, 11,   // 中間の横木の下
    10,  3, 22,   22,  3, 15,   // 幹の右
     2, 14,  3,   14, 15,  3,   // 下
     0, 12,  2,   12, 14,  2,   // 左
  ];

-  const quadColors = [
-      200,  70, 120,  // 左列の前面
-      200,  70, 120,  // 上の横木の前面
-      200,  70, 120,  // 中間の横木の前面
-
-       80,  70, 200,  // 左列の裏面
-       80,  70, 200,  // 上の横木の裏面
-       80,  70, 200,  // 中間の横木の裏面
-
-       70, 200, 210,  // 上
-      160, 160, 220,  // 上の横木の右
-       90, 130, 110,  // 上の横木の下
-      200, 200,  70,  // 上と中間の横木の間
-      210, 100,  70,  // 中間の横木の上
-      210, 160,  70,  // 中間の横木の右
-       70, 180, 210,  // 中間の横木の下
-      100,  70, 210,  // 幹の右
-       76, 210, 100,  // 下
-      140, 210,  80,  // 左
+  const normals = [
+        0,   0,   1,  // 左列の前面
+        0,   0,   1,  // 上の横木の前面
+        0,   0,   1,  // 中間の横木の前面
+
+        0,   0,  -1,  // 左列の裏面
+        0,   0,  -1,  // 上の横木の裏面
+        0,   0,  -1,  // 中間の横木の裏面
+
+        0,   1,   0,  // 上
+        1,   0,   0,  // 上の横木の右
+        0,  -1,   0,  // 上の横木の下
+        1,   0,   0,  // 上と中間の横木の間
+        0,   1,   0,  // 中間の横木の上
+        1,   0,   0,  // 中間の横木の右
+        0,  -1,   0,  // 中間の横木の下
+        1,   0,   0,  // 幹の右
+        0,  -1,   0,  // 下
+       -1,   0,   0,  // 左
  ];

  const numVertices = indices.length;
-  const vertexData = new Float32Array(numVertices * 4); // xyz + color
  const vertexData = new Float32Array(numVertices * 6); // xyz + normal
-  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < indices.length; ++i) {
    const positionNdx = indices[i] * 3;
    const position = positions.slice(positionNdx, positionNdx + 3);
    vertexData.set(position, i * 6);

    const quadNdx = (i / 6 | 0) * 3;
-    const color = quadColors.slice(quadNdx, quadNdx + 3);
-    colorData.set(color, i * 16 + 12);
-    colorData[i * 16 + 15] = 255;
+    const normal = normals.slice(quadNdx, quadNdx + 3);
+    vertexData.set(normal, i * 6 + 3);
  }

  return {
    vertexData,
    numVertices,
  };
}
```

パイプラインを変更して、色の代わりにこれらの法線を使用する必要があります。

```js
  const pipeline = device.createRenderPipeline({
    label: '2 attributes',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
-          arrayStride: (4) * 4, // (3) floats 4 bytes each + one 4 byte color
+          arrayStride: (3 + 3) * 4, // (3+3) floats 4 bytes each
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3'},  // position
-            {shaderLocation: 1, offset: 12, format: 'unorm8x4'},  // color
+            {shaderLocation: 1, offset: 12, format: 'float32x3'},  // normal
          ],
        },
      ],
    },

    ...
```

次に、シェーダーを法線を使用するように変更する必要があります。

頂点シェーダーでは、法線をフラグメントシェーダーに渡すだけです。

```wgsl
struct Uniforms {
  matrix: mat4x4f,
+  color: vec4f,
+  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
-  @location(1) color: vec4f,
+  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
-  @location(0) color: vec4f,
+  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.matrix * vert.position;
-  vsOut.color = vert.color;
+  vsOut.normal = vert.normal;
  return vsOut;
}
```

フラグメントシェーダーでは、光の逆方向と法線のドット積を使用して計算を行います。

```
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
-  return vsOut.color;
+  // vsOut.normalはステージ間変数であるため、
+  // 補間されるため、単位ベクトルにはなりません。
+  // 正規化すると、再び単位ベクトルになります。
+  let normal = normalize(vsOut.normal);
+
+  // 法線と光の逆方向のドット積を
+  // 取ることで光を計算します。
+  let light = dot(normal, -uni.lightDirection);
+
+  // 色の部分（アルファではない）のみを
+  // 光で乗算しましょう。
+  let color = uni.color.rgb * light;
+  return vec4f(color, uni.color.a);
}
```

色と光の方向のためにユニフォームバッファにスペースを追加し、それらを設定するためのビューを作成する必要があります。

```js
-  // 行列
-  const uniformBufferSize = (16) * 4;
+  // 行列 + 色 + 光の方向
+  const uniformBufferSize = (16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
  const kMatrixOffset = 0;
+  const kColorOffset = 16;
+  const kLightDirectionOffset = 20;

  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
+  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

そして、それらを設定する必要があります。

```js
  const settings = {
    rotation: degToRad(0),
  };

  ...

  function render() {
    ...


    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projection = mat4.perspective(
        degToRad(60),
        aspect,
        1,      // zNear
        2000,   // zFar
    );

    const eye = [100, 150, 200];
    const target = [0, 35, 0];
    const up = [0, 1, 0];

    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

    mat4.rotateY(viewProjectionMatrix, settings.rotation, matrixValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // green
    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));

    // ユニフォーム値をユニフォームバッファにアップロードします
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
```

カメラ/目はz = 200にあり、Z = 0を見ています。つまり、負のZ方向を見ています。

`normalize`は、前に説明したように、そこに入力した値を単位ベクトルにします。サンプルの光の特定の値は、`x = -0.5`（負の`x`）ですが、負のZを見ているため、光は右側から左側を向いています。`y = -0.7`（負の`y`）は、光が上から下を向いていることを意味します。下は負です。`z = -1`（負の`z`）は、光がカメラと同じ方向を向いていることを意味します。相対的な値は、方向が主にシーンに向かっており、右よりも下を向いていることを意味します。

そして、これがそれです。

{{{example url="../webgpu-lighting-directional.html" }}}

Fを回転させると、何かに気づくかもしれません。Fは回転していますが、ライティングは変化していません。Fが回転するにつれて、光の方向を向いている部分が最も明るくなるようにしたいです。

これを修正するには、オブジェクトが再方向付けされるときに法線を再方向付けする必要があります。位置で行ったように、法線を何らかの行列で乗算できます。最も明白な行列は`world`行列です。現在のところ、1つの行列しか渡していません。それを2つの行列を渡すように変更しましょう。1つは`world`と呼ばれ、ワールド行列になります。もう1つは`worldViewProjection`と呼ばれ、現在`matrix`として渡しているものになります。

```wgsl
struct Uniforms {
-  matrix: mat4x4f,
+  world: mat4x4f,
+  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;
-  vsOut.normal = vert.normal;

+  // 法線を方向付け、フラグメントシェーダーに渡します
+  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;

  return vsOut;
}

...
```

法線を`uni.world`で乗算するときにWに0を渡していることに注意してください。これは、法線が方向であるため、平行移動は気にしないためです。`w`を0に設定すると、すべての平行移動がゼロで乗算されます[^matrix-math]。

[^matrix-math]: [行列演算に関する記事](webgpu-matrix-math.html)を参照してください。

ユニフォームバッファと値のビューを更新する必要があります。

```js
-  const uniformBufferSize = (16 + 4 + 4) * 4;
+  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
-  const kMatrixOffset = 0;
-  const kColorOffset = 16;
-  const kLightDirectionOffset = 20;
+  const kWorldOffset = 0;
+  const kWorldViewProjectionOffset = 16;
+  const kColorOffset = 32;
+  const kLightDirectionOffset = 36;

-  const matrixValue = uniformValues.subarray(kMatrixOffset, kMatrixOffset + 16);
+  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

そして、それらを更新するコードを変更する必要があります。

```js
    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    // ワールド行列をworldValueに直接計算します
-    mat4.rotationY(viewProjectionMatrix, settings.rotation, matrixValue);
+    mat4.rotationY(settings.rotation, worldValue);
+
+    // ビュー射影行列とワールド行列を組み合わせます
+    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);

    colorValue.set([0.2, 1, 0.2, 1]);  // green
    lightDirectionValue.set(vec3.normalize([-0.5, -0.7, -1]));
```

そして、それがこれです。

{{{example url="../webgpu-lighting-directional-world.html" }}}

Fを回転させると、光の方向を向いている側が照らされることに注意してください。

1つ問題があります。直接示す方法がわからないので、図で示します。法線を再方向付けするために、`normal`を`world`行列で乗算しています。ワールド行列をスケーリングするとどうなりますか？間違った法線が得られることがわかります。

{{{diagram url="resources/normals-scaled.html" caption="法線を切り替えるにはクリック" width="700" height="400" }}}

解決策を理解しようとしたことはありませんが、ワールド行列の逆行列を取得し、それを転置（列を行に交換）して代わりに使用すると、正しい答えが得られることがわかります。

上の図では、<span style="color: #F0F;">紫</span>の球はスケーリングされていません。左側の<span style="color: #F00;">赤</span>の球はスケーリングされており、法線はワールド行列で乗算されています。何かが間違っていることがわかります。右側の<span style="color: #00F;">青</span>の球は、ワールド逆転置行列を使用しています。

図をクリックして、さまざまな表現を切り替えます。スケールが極端な場合、左側（ワールド）の法線が球の表面に垂直に留まっていないのに対し、右側（ワールド逆転置）の法線は球に垂直に留まっていることが非常に簡単にわかります。最後のモードでは、すべてが赤でシェーディングされます。2つの外側の球のライティングは、使用される行列に基づいて非常に異なることがわかります。どちらが正しいかを判断するのは難しいですが、他の視覚化に基づくと、ワールド逆転置を使用するのが正しいことは明らかです。

この例でこれを実装するには、次のようにコードを変更しましょう。まず、シェーダーを更新します。技術的には、`world`の値を更新するだけで済みますが、実際に何であるかを名前に付けるのが最善です。そうしないと、混乱します。`worldInverseTranspose`と呼ぶこともできますが、`normalMatrix`と呼ぶのが一般的であり、法線をどのように方向付けるかだけを気にしているので、実際には3x3行列しか必要ありません。

```wgsl
struct Uniforms {
-  world: mat4x4f,
+  normalMatrix: mat3x3f,
  worldViewProjection: mat4x4f,
  color: vec4f,
  lightDirection: vec3f,
};

struct Vertex {
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex fn vs(vert: Vertex) -> VSOutput {
  var vsOut: VSOutput;
  vsOut.position = uni.worldViewProjection * vert.position;

  // 法線を方向付け、フラグメントシェーダーに渡します
-  vsOut.normal = (uni.world * vec4f(vert.normal, 0)).xyz;
+  vsOut.normal = uni.normalMatrix * vert.normal;

  return vsOut;
}
```

3x3行列を使用しているため、法線の計算がわずかに簡単になりました。

そしてもちろん、ユニフォームの新しい形状に合わせてJavaScriptを更新する必要があります。

```js
-  const uniformBufferSize = (16 + 16 + 4 + 4) * 4;
+  const uniformBufferSize = (12 + 16 + 4 + 4) * 4;
  const uniformBuffer = device.createBuffer({
    label: 'uniforms',
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  // float32インデックスでのさまざまなユニフォーム値へのオフセット
-  const kWorldOffset = 0;
-  const kWorldViewProjectionOffset = 16;
-  const kColorOffset = 32;
-  const kLightDirectionOffset = 36;
+  const kNormalMatrixOffset = 0;
+  const kWorldViewProjectionOffset = 12;
+  const kColorOffset = 28;
+  const kLightDirectionOffset = 32;

-  const worldValue = uniformValues.subarray(kWorldOffset, kWorldOffset + 16);
+  const normalMatrixValue = uniformValues.subarray(
+      kNormalMatrixOffset, kNormalMatrixOffset + 12);
  const worldViewProjectionValue = uniformValues.subarray(
      kWorldViewProjectionOffset, kWorldViewProjectionOffset + 16);
  const colorValue = uniformValues.subarray(kColorOffset, kColorOffset + 4);
  const lightDirectionValue =
      uniformValues.subarray(kLightDirectionOffset, kLightDirectionOffset + 3);
```

法線行列を計算する前に、行列を転置する関数が必要です。

```js
const mat4 = {
  ....
  transpose(m, dst) {
    dst = dst || new Float32Array(16);

    dst[ 0] = m[ 0];  dst[ 1] = m[ 4];  dst[ 2] = m[ 8];  dst[ 3] = m[12];
    dst[ 4] = m[ 1];  dst[ 5] = m[ 5];  dst[ 6] = m[ 9];  dst[ 7] = m[13];
    dst[ 8] = m[ 2];  dst[ 9] = m[ 6];  dst[10] = m[10];  dst[11] = m[14];
    dst[12] = m[ 3];  dst[13] = m[ 7];  dst[14] = m[11];  dst[15] = m[15];

    return dst;
  },
  ...
```

そして、4x4行列から3x3行列を取得する関数が必要です。

```js
const mat3 = {
  fromMat4(m, dst) {
    dst = dst || new Float32Array(12);

    dst[0] = m[0]; dst[1] = m[1];  dst[ 2] = m[ 2];
    dst[4] = m[4]; dst[5] = m[5];  dst[ 6] = m[ 6];
    dst[8] = m[8]; dst[9] = m[9];  dst[10] = m[10];

    return dst;
  },
};

```

WebGPUの3x3行列は、各列がパディングされていることに注意してください。これについては、[メモリレイアウトに関する記事](webgpu-memory-layout.html)で説明しました。

これらの2つの関数ができたので、法線行列を計算して設定できます。

```js
    // ビュー行列を計算します
    const viewMatrix = mat4.lookAt(eye, target, up);

    // ビュー行列と射影行列を組み合わせます
    const viewProjectionMatrix = mat4.multiply(projection, viewMatrix);

-    // ワールド行列をworldValueに直接計算します
-    mat4.rotationY(settings.rotation, worldValue);
-
-    // ビュー射影行列とワールド行列を組み合わせます
-    mat4.multiply(viewProjectionMatrix, worldValue, worldViewProjectionValue);
+    // ワールド行列を計算します
+    const world = mat4.rotationY(settings.rotation);
+
+    // ビュー射影行列とワールド行列を組み合わせます
+    mat4.multiply(viewProjectionMatrix, world, worldViewProjectionValue);
+
+    // 逆行列と転置行列をnormalMatrix値に変換します
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

効果は微妙であり、何もスケーリングしていないため、目立った違いはありませんが、少なくともこれで準備ができました。

{{{example url="../webgpu-lighting-directional-worldinversetranspose.html" }}}

ライティングへのこの最初のステップが明確であったことを願っています。次は[点光源](webgpu-lighting-point.html)です。