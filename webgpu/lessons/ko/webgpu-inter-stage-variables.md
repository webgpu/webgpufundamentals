Title: WebGPU 스테이지간 변수(Inter-stage Variables)
Description: 정점 셰이더에서 프래그먼트 셰이더로의 데이터 전달
TOC: 스테이지간 변수(Inter-stage Variables)

[이전 글](webgpu-fundamentals.html)에서, WebGPU에 대한 아주 기초적인 내용을 알아 보았습니다.
이 글에서는 스테이지간 변수(inter-stage variable)에 대한 *기초*를 다룰 것입니다.

스테이지간 변수는 정점 셰이더와 프래그먼트 셰이더 사이에서 역할을 하게 됩니다.

정점 셰이더가 세 개의 위치값을 출력하면 삼각형이 래스터화됩니다. 
정섬 셰이더에서 이러한 각 위치값에 추가적인 값을 더해서 출력할 수 있는데,
이러한 값은 기본적으로 그 세 점 사이에서 보간됩니다.

짧은 예제를 만들어 봅시다. 이전 글에서의 삼각형을 그리는 프로그램에서,
셰이더를 수정할 것입니다.

```js
  const module = device.createShaderModule({
-    label: 'our hardcoded red triangle shaders',
+    label: 'our hardcoded rgb triangle shaders',
    code: `
+      struct OurVertexShaderOutput {
+        @builtin(position) position: vec4f,
+        @location(0) color: vec4f,
+      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
+        var color = array<vec4f, 3>(
+          vec4f(1, 0, 0, 1), // red
+          vec4f(0, 1, 0, 1), // green
+          vec4f(0, 0, 1, 1), // blue
+        );

-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
      }

-      @fragment fn fs() -> @location(0) vec4f {
-        return vec4f(1, 0, 0, 1);
+      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+        return fsInput.color;
      }
    `,
  });
```

먼저 `struct`를 선언했습니다. 구조체(struct)를 만들면 정점 셰이더와 프래그먼트 셰이더 사이의 
스테이지간 변수를 조정하기 쉬워집니다.

```wgsl
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

그리고 이러한 타입의 구조체를 정점 셰이더가 반환하도록 선언합니다.

```wgsl
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
-      ) -> @builtin(position) vec4f {
+      ) -> OurVertexShaderOutput {
```

세 개의 색상값을 갖는 배열을 만들었는데요,

```wgsl
        var color = array<vec4f, 3>(
          vec4f(1, 0, 0, 1), // red
          vec4f(0, 1, 0, 1), // green
          vec4f(0, 0, 1, 1), // blue
        );
```

그리고 나서 위치값인 `vec4f`만을 반환하는 대신 구조체 인스턴스를 선언하고,
값을 채운 뒤 반환하도록 했습니다.

```wgsl
-        return vec4f(pos[vertexIndex], 0.0, 1.0);
+        var vsOutput: OurVertexShaderOutput;
+        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
+        vsOutput.color = color[vertexIndex];
+        return vsOutput;
```

프래그먼트 셰이더 안에서는 이러한 구조체를 함수의 인자로 받도록 선언합니다.

```wgsl
      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
```

그리고 색상값을 반환합니다.

실행하게 되면, GPU가 프래그먼트 셰이더를 호출할 때마다 색생값이 넘어오는데,
넘어오는 값은 세 개 위치 사이에서 보간된 값인 것을 보실 수 있습니다.

{{{example url="../webgpu-inter-stage-variables-triangle.html"}}}

스테이지간 변수는 삼각형 내에서 텍스처 좌표(texture coordinate)를 보간하는 데 자주 사용됩니다.
이러한 내용은 [텍스처에 관한 글](webgpu-textures.html)에서 다룰 것입니다.
다른 사용 예로는 삼각형 내의 노멀(normal)값의 보간으로, 
[라이팅(lighting)에 관한 첫 번째 글](webgpu-lighting-directional.html)에서 다룹니다.

## `location`으로 연결된 스테이지간 변수

중요한 점은 다른 거의 모든 WebGPU의 요소들과 같이, 정점 셰이더와 프래그먼트 셰이더는 인덱스를 기반으로 연결된다는 점입니다.
스테이지간 변수의 경우 로케이션(location) 인덱스를 기반으로 연결됩니다.

이게 무슨 말인지 확인하기 위해 프래그먼트 셰이더를 수정해서 구조체 대신에 `location(0)`의 `vec4f`를 받도록 수정해 보겠습니다.

```wgsl
      @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
        return color;
      }
```

실행해 보면 여전히 잘 동작하는 것을 볼 수 있습니다.

{{{example url="../webgpu-inter-stage-variables-triangle-by-fn-param.html"}}}

## `@builtin(position)`

또다른 특이한 기술을 살펴 봅시다. 원래 우리 셰이더에서는 `position` 필드를 포함하는 동일한 구조체를 
정점 셰이더와 프래그먼트 세이더에서 모두 사용했지만, 로케이션은 없었습니다.
그 대신에 `@builtin(position)`이 선언되어 있었습니다.

```wgsl
      struct OurVertexShaderOutput {
*        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      };
```

이 필드는 스테이지간 변수가 **아닙니다**. 대신 이것은 `builtin`이라고 합니다.
`@builtin(position)`이 정점 셰이더와 프래그먼트 셰이더에서 서로 다른 의미를 가지고 있었습니다.

정점 셰이더에서 `@builtin(position)`은 GPU가 삼각형/선/점을 그리는 그 출력값을 의미합니다.

프래그먼트 셰이더에서 `@builtin(position)`는 입력값을 의미합니다.
프래그먼트 셰이더가 현재 색상을 계산해야 하는 그 픽셀의 좌표값입니다.

픽셀 좌표는 픽셀의 모서리(edge)를 기준으로 명시됩니다.
프래그먼트 셰이더에 넘어오는 값은 픽셀의 중심점이 넘어옵니다.

우리가 그리는 텍스처가 3x2 픽셀 크기였다면 아래와 같은 좌표가 됩니다.

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

We can change our shader to use this position. For example let's draw a
checkerboard.

```js
  const module = device.createShaderModule({
    label: 'our hardcoded checkerboard triangle shaders',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
-        @location(0) color: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
-        var color = array<vec4f, 3>(
-          vec4f(1, 0, 0, 1), // red
-          vec4f(0, 1, 0, 1), // green
-          vec4f(0, 0, 1, 1), // blue
-        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
-        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
-        return fsInput.color;
+        let red = vec4f(1, 0, 0, 1);
+        let cyan = vec4f(0, 1, 1, 1);
+
+        let grid = vec2u(fsInput.position.xy) / 8;
+        let checker = (grid.x + grid.y) % 2 == 1;
+
+        return select(red, cyan, checker);
      }
    `,
  });
```

The code above takes `fsInput.position`, which was declared as
`@builtin(position)`, and converts its `xy` coordinates to a `vec2u` which is 2
unsigned integers. It then divides them by 8 giving us a count that increases
every 8 pixels. It then adds the `x` and `y` grid coordinates together, computes
module 2, and compares the result to 1. This will give us a boolean that is true
or false every other integer. Finally it uses the WGSL function `select` which
given 2 values, selects one or the other based on a boolean condition. In
JavaScript `select` would be written like this

```js
// If condition is false return `a`, otherwise return `b`
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

Even if you don't use `@builtin(position)` in a fragment shader, it's convenient
that it's there because it means we can use the same struct for both a vertex
shader and a fragment shader. What was important to takeaway is that the `position` struct
field in the vertex shader vs the fragment shader is entirely unrelated. They're
completely different variables.

As pointed out above though, for inter-stage variables, all that matters is the
`@location(?)`. So, it's not uncommon to declare different structs for a vertex
shader's output vs a fragment shaders input.

To hopefully make this more clear, the fact that the vertex shader and
fragment shader are in the same string in our examples it just a convenience.
We could also split them into separate modules

```js
-  const module = device.createShaderModule({
-    label: 'hardcoded checkerboard triangle shaders',
+  const vsModule = device.createShaderModule({
+    label: 'hardcoded triangle',
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        return vsOutput;
      }
+    `,
+  });
+
+  const fsModule = device.createShaderModule({
+    label: 'checkerboard',
+    code: `
-      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
+      @fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);

-        let grid = vec2u(fsInput.position.xy) / 8;
+        let grid = vec2u(pixelPosition.xy) / 8;
        let checker = (grid.x + grid.y) % 2 == 1;

        return select(red, cyan, checker);
      }
    `,
  });
```

And we'd have to update our pipeline creation to use these

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
      entryPoint: 'vs',
    },
    fragment: {
-      module,
+      module: fsModule,
      entryPoint: 'fs',
      targets: [{ format: presentationFormat }],
    },
  });

```

And this would also work

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

The point is, the fact that both shaders are in the same string in most WebGPU
examples is just a convenience. In reality, first WebGPU parses the WGSL to make
sure it's syntactically correct. Then, WebGPU looks at the `entryPoint`
you specify. From that it goes and looks at the parts that entryPoint references
and nothing else for that entryPoint. It's useful because you don't have to type
things like structures or binding and group locations twice if two or more shaders
share bindings or structures or constants or functions. But, from the POV of WebGPU,
it's as though you did duplicate all of them, once for each entryPoint.

Note: It is not that common to generate a checkerboard using the
`@builtin(position)`. Checkerboards or other patterns are far more commonly
implemented [using textures](webgpu-textures.html). In fact you'll see an issue
if you size the window. Because the checkerboard is based on the pixel coordinates
of the canvas it's relative to the canvas, not relative to the triangle.

## <a id="a-interpolate"></a>Interpolation Settings

We saw above that inter-stage variables, the outputs from a vertex shader, are
interpolated when passed to the fragment shader. There are 2 sets of settings
that can be changed for how the interpolation happens. Setting them to anything
other than the defaults is not extremely common but there are use cases which
will be covered in other articles.

Interpolation type:

* `perspective`: Values are interpolated in a perspective correct manner (**default**)
* `linear`: Values are interpolated in a linear, non-perspective correct manner.
* `flat`: Values are not interpolated. Interpolation sampling is not used with flat interpolated

Interpolation sampling:

* `center`: Interpolation is performed at the center of the pixel (**default**)
* `centroid`: Interpolation is performed at a point that lies within all the samples covered by the fragment within the current primitive. This value is the same for all samples in the primitive.
* `sample`:  Interpolation is performed per sample. The fragment shader is invoked once per sample when this attribute is applied.

You specify these as attributes. For example

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

Note that if the inter-stage variable is an integer type then you must set its
interpolation to `flat`. 

If you set the interpolation type to `flat`, the value passed to the fragment shader
is the value of the inter-stage variable for the first vertex in that triangle.

In the [next article we'll cover uniforms](webgpu-uniforms.html) as another way to
pass data into shaders.