Title: WGSL Function Reference
Description: How to use Buffers
TOC: WGSL Function Reference

<div id="func-toc"></div>

<div class="webgpu_center data-table">
{{{include "webgpu/lessons/webgpu-wgsl-function-reference.inc.html"}}}
</div>

<div class="webgpu_bottombar">
<h3>Be aware of undefined behavior in WGSL</h3>
<p>
Several functions in WGSL are undefined for certain values.
Trying to raise a negative number to a power with <code>pow</code> is one
example since the result would be an imaginary number. We went
over another example above with <code>smoothstep</code>.</p>
<p>
You need to try to be aware of these or else your shaders will
get different results on different machines.</p>
<p>Here's a list of undefined some behaviors. Note <code>T</code> means <code>float</code>, <code>vec2f</code>, <code>vec3f</code>, or <code>vec4f</code>.</p>
<pre class="prettyprint"><code>fn asin(x: T) -> T</code></pre><p>Arc sine. Returns an angle whose sine is x. The range
of values returned by this function is [−π/2, π/2]
Results are undefined if ∣x∣ > 1.</p>
<pre class="prettyprint"><code>fn acos(x: T) -> T</code></pre><p>Arc cosine. Returns an angle whose cosine is x. The
range of values returned by this function is [0, π].
Results are undefined if ∣x∣ > 1.</p>
<pre class="prettyprint"><code>fn atan(y: T, x: T) -> T</code></pre><p>Arc tangent. Returns an angle whose tangent is y/x. The
signs of x and y are used to determine what quadrant the
angle is in. The range of values returned by this
function is [−π,π]. Results are undefined if x and y
are both 0.</p>
<pre class="prettyprint"><code>fn acosh(x: T) -> T</code></pre><p>Arc hyperbolic cosine; returns the non-negative inverse
of cosh. Results are undefined if x < 1.</p>
<pre class="prettyprint"><code>fn atanh(x: T) -> T</code></pre><p>Arc hyperbolic tangent; returns the inverse of tanh.
Results are undefined if ∣x∣≥1.</p>
<pre class="prettyprint"><code>fn pow(x: T, y: T) -> T</code></pre><p>Returns x raised to the y power, i.e., x<sup>y</sup>.
Results are undefined if x < 0.
Results are undefined if x = 0 and y <= 0.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>Returns the natural log of x.
Results are undefined if x < 0.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>Returns the base-2 logarithm of x.
Results are undefined if x < 0.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>Returns the natural logarithm of x, i.e., returns the value
y which satisfies the equation x = e<sup>y</sup>.
Results are undefined if x <= 0.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>Returns the base 2 logarithm of x, i.e., returns the value
y which satisfies the equation x=2<sup>y</sup>.
Results are undefined if x <= 0.</p>
<pre class="prettyprint"><code>fn sqrt(T: x) -> T</code></pre><p>Returns √x .
Results are undefined if x < 0.</p>
<pre class="prettyprint"><code>fn inverseSqrt(x: T) -> T</code></pre><p>
Returns 1/√x.
Results are undefined if x <= 0.</p>
<pre class="prettyprint"><code>fn clamp(x: T, minVal: T, maxVal: T) -> T</code></pre><p>
Returns min(max(x, minVal), maxVal).
Results are undefined if minVal > maxVal</p>
<pre class="prettyprint"><code>fn smoothstep(edge0: T, edge1: T, x: T) -> T</code></pre><p>
Returns 0.0 if x <= edge0 and 1.0 if x >= edge1 and
performs smooth Hermite interpolation between 0 and 1
when edge0 < x < edge1.
Results are undefined if edge0 >= edge1.
</div>

<p class="copyright" data-fill-with="copyright"><a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">liability</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">trademark</a> and <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">permissive document license</a> rules apply. </p>

<!-- keep this at the bottom of the article -->
<link href="webgpu-wgsl-function-reference.css" rel="stylesheet">
<script type="module" src="webgpu-wgsl-function-reference.js"></script>
