Title: Referencia de Funciones WGSL
Description: Referencia de funciones integradas de WGSL
TOC: Referencia de Funciones WGSL

<div id="func-toc"></div>

<div class="webgpu_center data-table">
{{{include "webgpu/lessons/webgpu-wgsl-function-reference.inc.html"}}}
</div>

<div class="webgpu_bottombar">
<h3>Ten en cuenta el comportamiento indefinido en WGSL</h3>
<p>
Varias funciones en WGSL están indefinidas para ciertos valores.
Intentar elevar un número negativo a una potencia con <code>pow</code> es un
ejemplo, ya que el resultado sería un número imaginario. Ya vimos
otro ejemplo arriba con <code>smoothstep</code>.</p>
<p>
Debes tratar de ser consciente de estos casos o de lo contrario tus shaders
obtendrán resultados diferentes en diferentes máquinas.</p>
<p>Aquí hay una lista de algunos comportamientos indefinidos. Ten en cuenta que <code>T</code> significa <code>float</code> (punto flotante), <code>vec2f</code>, <code>vec3f</code> o <code>vec4f</code>.</p>
<pre class="prettyprint"><code>fn asin(x: T) -> T</code></pre><p>Arco seno. Devuelve un ángulo cuyo seno es x. El rango
de valores devueltos por esta función es [−π/2, π/2].
Los resultados son indefinidos si ∣x∣ > 1.</p>
<pre class="prettyprint"><code>fn acos(x: T) -> T</code></pre><p>Arco coseno. Devuelve un ángulo cuyo coseno es x. El
rango de valores devueltos por esta función es [0, π].
Los resultados son indefinidos si ∣x∣ > 1.</p>
<pre class="prettyprint"><code>fn atan(y: T, x: T) -> T</code></pre><p>Arco tangente. Devuelve un ángulo cuya tangente es y/x. Los
signos de x e y se utilizan para determinar en qué cuadrante se
encuentra el ángulo. El rango de valores devueltos por esta
función es [−π, π]. Los resultados son indefinidos si tanto x como y
son 0.</p>
<pre class="prettyprint"><code>fn acosh(x: T) -> T</code></pre><p>Arco coseno hiperbólico; devuelve la inversa no negativa
de cosh. Los resultados son indefinidos si x < 1.</p>
<pre class="prettyprint"><code>fn atanh(x: T) -> T</code></pre><p>Arco tangente hiperbólica; devuelve la inversa de tanh.
Los resultados son indefinidos si ∣x∣ ≥ 1.</p>
<pre class="prettyprint"><code>fn pow(x: T, y: T) -> T</code></pre><p>Devuelve x elevado a la potencia y, es decir, x<sup>y</sup>.
Los resultados son indefinidos si x < 0.
Los resultados son indefinidos si x = 0 e y ≤ 0.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>Devuelve el logaritmo natural de x.
Los resultados son indefinidos si x < 0.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>Devuelve el logaritmo en base 2 de x.
Los resultados son indefinidos si x < 0.</p>
<pre class="prettyprint"><code>fn log(x: T) -> T</code></pre><p>Devuelve el logaritmo natural de x, es decir, devuelve el valor
y que satisface la ecuación x = e<sup>y</sup>.
Los resultados son indefinidos si x ≤ 0.</p>
<pre class="prettyprint"><code>fn log2(x: T) -> T</code></pre><p>Devuelve el logaritmo en base 2 de x, es decir, devuelve el valor
y que satisface la ecuación x = 2<sup>y</sup>.
Los resultados son indefinidos si x ≤ 0.</p>
<pre class="prettyprint"><code>fn sqrt(x: T) -> T</code></pre><p>Devuelve √x.
Los resultados son indefinidos si x < 0.</p>
<pre class="prettyprint"><code>fn inverseSqrt(x: T) -> T</code></pre><p>
Devuelve 1/√x.
Los resultados son indefinidos si x ≤ 0.</p>
<pre class="prettyprint"><code>fn clamp(x: T, minVal: T, maxVal: T) -> T</code></pre><p>
Devuelve min(max(x, minVal), maxVal).
Los resultados son indefinidos si minVal > maxVal.</p>
<pre class="prettyprint"><code>fn smoothstep(edge0: T, edge1: T, x: T) -> T</code></pre><p>
Devuelve 0.0 si x ≤ edge0 y 1.0 si x ≥ edge1 y
realiza una interpolación de Hermite suave entre 0 y 1
cuando edge0 < x < edge1.
Los resultados son indefinidos si edge0 ≥ edge1.
</div>

<p class="copyright" data-fill-with="copyright"><a href="https://www.w3.org/Consortium/Legal/ipr-notice#Copyright">Copyright</a> © 2023 <a href="https://www.w3.org/">World Wide Web Consortium</a>. <abbr title="World Wide Web Consortium">W3C</abbr><sup>®</sup> Se aplican las reglas de <a href="https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer">responsabilidad</a>, <a href="https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks">marca comercial</a> y <a href="https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document" rel="license">licencia de documento permisiva</a> del <abbr title="World Wide Web Consortium">W3C</abbr>. </p>

<!-- mantén esto al final del artículo -->
<link href="webgpu-wgsl-function-reference.css" rel="stylesheet">
<script type="module" src="webgpu-wgsl-function-reference.js"></script>
