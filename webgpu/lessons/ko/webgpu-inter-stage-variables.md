Title: WebGPU 스테이지간 변수(Inter-stage Variables)
Description: 정점 셰이더에서 프래그먼트 셰이더로의 데이터 전달
TOC: 스테이지간 변수(Inter-stage Variables)

[이전 글](webgpu-fundamentals.html)에서, WebGPU에 대한 아주 기초적인 내용을 알아 보았습니다.
이 글에서는 스테이지간 변수(inter-stage variable)에 대한 *기초*를 다룰 것입니다.

스테이지간 변수는 정점 셰이더와 프래그먼트 셰이더 사이에서 역할을 하게 됩니다.

정점 셰이더가 세 개의 위치값을 출력하면 삼각형이 래스터화됩니다. 
정점 셰이더에서 이러한 각 위치값에 추가적인 값을 더해서 출력할 수 있는데,
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
사실 더 나은 이해 방법은 정점 셰이더와 프래그먼트 셰이더를
같은 이름의 매개변수를 가진 서로 다른 2개의 함수로 생각하는 것입니다.

2개의 JavaScript 함수가 있다고 상상해봅시다

```js
// Draw a circle size radius, at position: [x, y]
function drawCircle({ ctx, position, radius }) {
  // from CanvasRenderingContext2D
  ctx.beginPath();
  ctx.arc(...position, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Return the index of an element in an array starting at position
function findIndex({ array, position, value }) {
  return array.indexOf(value, position);
}
```

위의 두 함수 모두 `position`이라는 매개변수를 가지고 있습니다. 일반적으로
둘 사이에 혼동은 없습니다. 정점 셰이더와 프래그먼트 셰이더도 비슷합니다.
그들의 builtin들은 서로 다르고 관련이 없으며, 각각 우연히 `position`이라는
이름의 `@builtin`을 가지고 있을 뿐입니다. 각 셰이더 진입점을 컴파일할 때는
해당 진입점에 대한 WGSL 코드만 읽습니다.

정점 셰이더에서 `@builtin(position)`은 GPU가 삼각형/선/점을 그리는 그 출력값을 의미합니다.

프래그먼트 셰이더에서 `@builtin(position)`는 입력값을 의미합니다.
프래그먼트 셰이더가 현재 색상을 계산해야 하는 그 픽셀의 좌표값입니다.

픽셀 좌표는 픽셀의 모서리(edge)를 기준으로 명시됩니다.
프래그먼트 셰이더에 넘어오는 값은 픽셀의 중심점이 넘어옵니다.

우리가 그리는 텍스처가 3x2 픽셀 크기였다면 아래와 같은 좌표가 됩니다.

<div class="webgpu_center"><img src="resources/webgpu-pixels.svg" style="width: 500px;"></div>

셰이더에서 이 위치값을 사용하도록 수정합니다.
예를들어, 체커보드(checkerboard)를 그려 봅시다.

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

위 코드는 `fsInput.position`를 받는데 이는 `@builtin(position)`에 선언되었고,
`xy` 좌표를 두 개의 부호없는 정수인 `vec2u`로 좌표를 변환합니다.
그리고 나서 이를 8로 나누어 8개의 픽셀마다 값이 증가되도록 합니다.
그리고 `x`와 `y` 그리드 좌표를 더하고 2로 나눈 나머지를 계산하여 그 결과를 1과 비교합니다.
그 결과 모든 정수에 대해 1 또는 0 값을 반환합니다.
마지막으로 불리언(boolean) 값에 따라 두 개의 값 중 하나를 반환하는 WGSL의 `select` 함수를 사용합니다.
자바스크립트로, `select` 함수는 다음과 같습니다.

```js
// condition이 false면 `a`를, 아니면 `b`를 반환함
select = (a, b, condition) => condition ? b : a;
```

{{{example url="../webgpu-fragment-shader-builtin-position.html"}}}

프래그먼트 셰이더에서 `@builtin(position)`를 사용하지 않더라도, 같은 구조체를 정점 셰이더와 프래그먼트 셰이더에서 사용 가능하니 편리합니다.
중요한 것은 정점 셰이더와 프래그먼트 셰이더에서, 구조체의 `position`이 전혀 관련이 없다는 점입니다.
그 둘은 완전히 별개의 변수입니다.

위에서 언급했듯이 스테이지별 변수에서 중요한 것은 `@location(?)`뿐입니다.
그러니 정점 셰이더의 출력과 프래그먼트 셰이더의 입력에서 다른 구조체를 사용하는 경우도 흔하게 볼 수 있습니다.

좀 더 명확히 하기 위해, 우리 예제에서 정점 셰이더와 프래그먼트 셰이더를 같은 문자열에 넣은 것은 그냥 사용상의 편의 때문이라는 것을 알아 두세요.
이 둘을 별도의 모듈로 구분할 수도 있습니다.

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

이를 사용하기 위해서는 파이프라인 생성 부분도 수정해야 합니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'hardcoded checkerboard triangle pipeline',
    layout: 'auto',
    vertex: {
-      module,
+      module: vsModule,
    },
    fragment: {
-      module,
+      module: fsModule,
      targets: [{ format: presentationFormat }],
    },
  });

```

이 코드 역시 제대로 동작합니다.

{{{example url="../webgpu-fragment-shader-builtin-position-separate-modules.html"}}}

중요한 점은 대부분의 WebGPU 예제에서 두 셰이더가 하나의 문자열에 들어가 있는 것은 단지 편의성 때문이라는 것입니다.
실제로는 우선 WebGPU는 WGSL을 파싱(parse)해서 문법적으로 문제가 없는지 확인합니다.
그리고 나서 여러분이 명시한 `entryPoint`를 찾아봅니다.
거기서부터는 진입점(entryPoint)이 참조하는 부분을 찾을 뿐입니다.
그렇게 함으로써 두 셰이더가 바인딩, 구조체, 상수, 함수 등을 공유할 떄 그것들을 두 번씩 타이핑할 필요가 없어지기 때문에 편리합니다.
하지만, WebGPU의 입장에서는 여러분이 마치 그 두 개를 진입점마다 두 번씩 타이핑한것처럼 취급합니다.

주의: `@builtin(position)`를 사용해 체커보드를 생성하는 것은 흔한 일은 아닙니다.
체커보드나 다른 패턴은 [텍스처](webgpu-textures.html)를 사용해 구현하는 것이 일반적입니다.
사실 윈도우 크기를 조정하면 쉽게 문제가 보일 겁니다.
체커보드가 캔버스의 픽셀 좌표계에 기반하여 계산되기 때문에 삼각형이 아닌 캔버스에 상대적으로 그려지기 떄문입니다.

## <a id="a-interpolate"></a>보간(Interpolation) 설정

위에서 스테이지별 변수를 살펴보았는데 이는 정점 셰이더의 출력이고 프래그먼트 셰이더에 전달되는 과정에서 보간 되었습니다.
보간이 어떻게 수행될지에 대한 두 가지 설정이 있습니다.
기본값이 아닌 것으로 설정하는 것이 흔하지는 않지만 다른 글에서 살펴보겠지만 이를 사용하는 경우도 있습니다.

보간의 타입은:

* `perspective`: 원근 보정(perspective correct) 방식으로 값이 보간됨 (**기본값**)
* `linear`: 원근 보정이 아닌 선형(linear)으로 보간됨
* `flat`: 값이 보간되지 않음. 이 값으로 설정하면 보간 샘플링(sampling)이 사용되지 않음

보간 샘플링:

* `center`: 보간이 픽셀의 중앙에서 수행됨 (**기본값**)
* `centroid`: 현재 프리미티브(primitive)가 차지하는 모든 프래그먼트의 모든 샘플 내에 존재하는 점에 대해 보간이 수행됨. 값은 프래그먼트 내의 모든 샘플에 대해 같은 값임
* `sample`:  샘플 별로 보간이 수행됨. 이 값이 적용되는 경우 프래그먼트 셰이더는 모든 샘플별로 한 번씩 실행됨
* `first`: 타입이 `flat` 일때만 사용됨. (**기본값**) 그려지는 프리미티브의 첫 번째 정점에서 값을 가져옴
* `either`: 타입이 `flat` 일때만 사용됨. 그려지는 프리미티브의 첫 번째 또는 마지막 정점에서 값을 가져옴. webgpu 구현체에 따라 달라질수 있음.

이러한 속성은 다음과 같이 명시됩니다.

```wgsl
  @location(2) @interpolate(linear, center) myVariableFoo: vec4f;
  @location(3) @interpolate(flat) myVariableBar: vec4f;
```

스테이지별 변수가 정수형이라면 보간 타입은 `flat`으로 설정해야 합니다.

보간 타입을 `flat`으로 설정했으면 프래그먼트 셰이더에 전달되는 값은 삼각형의 첫 번째 정점에 대한 스테이지별 변수 값입니다. `flat` 을 사용하는 대부분의 경우 `either` 를 사용하세요. 그 이유는 [다른 글](webgpu-compatibility-mode.html#flat) 에서 다룹니다.

다음 글에서는 셰이더에 데이터를 전달하는 또 다른 방법인 [uniform](webgpu-uniforms.html)에 대해 알아보겠습니다.
