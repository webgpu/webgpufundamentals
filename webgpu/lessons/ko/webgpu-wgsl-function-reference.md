Title: WGSL 함수 레퍼런스
Description: WGSL 내장 함수와 정의되지 않은 동작
TOC: WGSL 함수 레퍼런스

<div id="func-toc"></div>

<div class="webgpu_center data-table">
{{{include "webgpu/lessons/webgpu-wgsl-function-reference.inc.html"}}}
</div>

<div class="webgpu_bottombar">
<h3>WGSL에서 정의되지 않은 동작에 주의하세요</h3>
<p>
WGSL 내장 함수에는 결과가 정의되지 않는 입력이 있습니다.
예를 들어 <code>pow</code>의 밑이 음수이면 결과가 정의되지 않습니다.
앞의 표에서는 또 다른 예로 <code>smoothstep</code>을 살펴봤습니다.</p>
<p>
이런 입력에 주의해야 합니다. 그렇지 않으면 같은 셰이더가 기기마다 다른 결과를 낼 수 있습니다.</p>
<p>다음은 동작이 정의되지 않는 몇 가지 경우입니다. <code>T</code>는 <code>float</code>, <code>vec2f</code>, <code>vec3f</code>, <code>vec4f</code> 중 하나입니다.</p>
<pre class="prettyprint"><code>fn asin(x: T) -> T</code></pre><p>아크사인입니다. 사인이 x인 각을 반환합니다.
반환값의 범위는 [−π/2, π/2]입니다.
∣x∣ > 1이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn acos(x: T) -> T</code></pre><p>아크코사인입니다. 코사인이 x인 각을 반환합니다.
반환값의 범위는 [0, π]입니다.
∣x∣ > 1이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn atan(y: T, x: T) -> T</code></pre><p>아크탄젠트입니다. 탄젠트가 y/x인 각을 반환합니다.
x와 y의 부호로 각이 속하는 사분면을 결정합니다.
반환값의 범위는 [−π,π]입니다. x와 y가 모두 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn acosh(x: T) -> T</code></pre><p>역쌍곡코사인입니다. cosh의 역함수에서 음이 아닌 값을 반환합니다.
x < 1이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn atanh(x: T) -> T</code></pre><p>역쌍곡탄젠트입니다. tanh의 역함수 값을 반환합니다.
∣x∣≥1이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn pow(x: T, y: T) -> T</code></pre><p>x의 y제곱, 즉 x<sup>y</sup>를 반환합니다.
x < 0이면 결과가 정의되지 않습니다.
x = 0이고 y <= 0이어도 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>x의 자연로그를 반환합니다.
x < 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>x의 밑이 2인 로그를 반환합니다.
x < 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>x의 자연로그, 즉 x = e<sup>y</sup>를 만족하는 y를 반환합니다.
x <= 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>x의 밑이 2인 로그, 즉 x=2<sup>y</sup>를 만족하는 y를 반환합니다.
x <= 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn sqrt(T: x) -> T</code></pre><p>√x를 반환합니다.
x < 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn inverseSqrt(x: T) -> T</code></pre><p>
1/√x를 반환합니다.
x <= 0이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn clamp(x: T, minVal: T, maxVal: T) -> T</code></pre><p>
min(max(x, minVal), maxVal)을 반환합니다.
minVal > maxVal이면 결과가 정의되지 않습니다.</p>
<pre class="prettyprint"><code>fn smoothstep(edge0: T, edge1: T, x: T) -> T</code></pre><p>
x <= edge0이면 0.0을, x >= edge1이면 1.0을 반환합니다.
edge0 < x < edge1이면 0과 1 사이를 부드럽게 에르미트 보간합니다.
edge0 >= edge1이면 결과가 정의되지 않습니다.
</div>

<p class="copyright" data-fill-with="copyright"><a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">저작권</a> © 2023 <a href="https://www.w3.org/">월드 와이드 웹 컨소시엄</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup>의 <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">책임</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">상표</a> 및 <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">허용적 문서 라이선스</a> 규정이 적용됩니다. </p>

<!-- 이 부분은 글의 맨 아래에 유지하세요 -->
<link href="webgpu-wgsl-function-reference.css" rel="stylesheet">
<script type="module" src="webgpu-wgsl-function-reference.js"></script>
