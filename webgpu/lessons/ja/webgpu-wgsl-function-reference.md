Title: WGSL 関数リファレンス
Description: バッファの使用方法
TOC: WGSL 関数リファレンス

<div class="warn">この記事はGemini Code Assistによって自動翻訳されました。翻訳に問題がある場合は、お手数ですが<a href="https://github.com/webgpu/webgpufundamentals/pulls">こちら</a>からPull Requestを送信してください。</div>

<div id="func-toc"></div>

<div class="webgpu_center data-table">
{{{include "webgpu/lessons/webgpu-wgsl-function-reference.inc.html"}}}
</div>

<div class="webgpu_bottombar">
<h3>WGSLの未定義の動作に注意してください</h3>
<p>
WGSLのいくつかの関数は、特定の値に対して未定義です。
<code>pow</code>で負の数をべき乗しようとすると、結果が虚数になるため、その一例です。上記で<code>smoothstep</code>の別の例を説明しました。</p>
<p>
これらに注意しないと、シェーダーはマシンによって異なる結果になります。</p>
<p>いくつかの未定義の動作のリストを次に示します。注：<code>T</code>は<code>float</code>、<code>vec2f</code>、<code>vec3f</code>、または<code>vec4f</code>を意味します。</p>
<pre class="prettyprint"><code>fn asin(x: T) -> T</code></pre><p>アークサイン。サインがxである角度を返します。この関数によって返される値の範囲は[−π/2, π/2]です。
∣x∣ > 1の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn acos(x: T) -> T</code></pre><p>アークコサイン。コサインがxである角度を返します。この関数によって返される値の範囲は[0, π]です。
∣x∣ > 1の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn atan(y: T, x: T) -> T</code></pre><p>アークタンジェント。タンジェントがy/xである角度を返します。xとyの符号は、角度がどの象限にあるかを決定するために使用されます。この関数によって返される値の範囲は[−π,π]です。xとyが両方とも0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn acosh(x: T) -> T</code></pre><p>アークハイパボリックコサイン。coshの非負の逆関数を返します。x < 1の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn atanh(x: T) -> T</code></pre><p>アークハイパボリックタンジェント。tanhの逆関数を返します。∣x∣≥1の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn pow(x: T, y: T) -> T</code></pre><p>xのy乗、つまりx<sup>y</sup>を返します。
x < 0の場合、結果は未定義です。
x = 0かつy <= 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>xの自然対数を返します。
x < 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>xの底2の対数を返します。
x < 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>xの自然対数を返します。つまり、方程式x = e<sup>y</sup>を満たす値yを返します。
x <= 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>xの底2の対数を返します。つまり、方程式x=2<sup>y</sup>を満たす値yを返します。
x <= 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn sqrt(T: x) -> T</code></pre><p>√xを返します。
x < 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn inverseSqrt(x: T) -> T</code></pre><p>
1/√xを返します。
x <= 0の場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn clamp(x: T, minVal: T, maxVal: T) -> T</code></pre><p>
min(max(x, minVal), maxVal)を返します。
minVal > maxValの場合、結果は未定義です。</p>
<pre class="prettyprint"><code>fn smoothstep(edge0: T, edge1: T, x: T) -> T</code></pre><p>
x <= edge0の場合は0.0、x >= edge1の場合は1.0を返し、edge0 < x < edge1の場合は0と1の間で滑らかなエルミート補間を実行します。
edge0 >= edge1の場合、結果は未定義です。
</div>

<p class="copyright" data-fill-with="copyright"><a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>

<!-- この記事の最後にこれを保持してください -->
<link href="webgpu-wgsl-function-reference.css" rel="stylesheet">
<script type="module" src="webgpu-wgsl-function-reference.js"></script>
