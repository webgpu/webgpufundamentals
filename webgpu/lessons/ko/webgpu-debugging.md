Title: WebGPU 디버깅과 에러
Description: WebGPU 디버깅을 위한 팁
TOC: 디버깅과 에러

WebGPU 디버깅과 에러 처리에 대한 몇 가지 팁입니다.

## JavaScript 콘솔을 열어두고 WebGPU 에러 확인하기

대부분의 브라우저에는 JavaScript 콘솔이 있습니다. 콘솔을 열어두세요. WebGPU는
일반적으로 그곳에 에러를 출력합니다.

## 캡처되지 않은 에러 로깅 고려하기

캡처되지 않은 WebGPU 에러를 잡아서 직접 로깅하도록 이벤트를 설정할 수 있습니다.
예를 들어:

```js
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', event => alert(event.error.message));
```

개인적으로 저는 일반적으로 `alert`를 사용하지 않지만, 메시지를 로깅하거나 요소에
넣거나 어떤 방식으로든 보이게 만들 수 있습니다. 저는 종종 위의 조언, 즉 JavaScript
콘솔을 여는 것을 잊어버려서 에러를 보지 못하기 때문에 이것이 유용하다고 생각합니다. 😅

WebGPU 자체에서 발생하는 에러는 JavaScript 콘솔로 가지만, 캡처한 에러는
여러분이 지정한 곳으로 갑니다.

## WebGPU가 에러를 보고하도록 돕기

WebGPU의 에러는 비동기적으로 보고됩니다. 이는 WebGPU를 빠르고 효율적으로
유지하기 위한 것입니다. 하지만 이는 때때로 예상한 시점에 에러를 받지 못하거나
전혀 받지 못할 수 있다는 것을 의미하며, WebGPU를 도와주지 않으면 그렇습니다.

다음은 위의 조언을 사용하여 캡처되지 않은 에러를 표시하는 이벤트를 추가한 코드입니다.
그런 다음 에러가 발생해야 하는 셰이더 모듈을 컴파일합니다.

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

아래의 라이브 예제에서, 적어도 Chrome 129에서는 아마도 에러를 받지 못할 것입니다.

{{{example url="../webgpu-debugging-help-webgpu-report-errors.html"}}}

이유는 이 경우 Chrome의 WebGPU가 특정 함수를 호출할 때까지 특정 에러를 처리하지
않기 때문입니다. 그러한 함수 중 하나가 `submit`입니다.

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

+  // WebGPU 펌핑
+  device.queue.submit([]);

  log('--done--');
}
```

이제 에러가 표시될 것입니다.

{{{example url="../webgpu-debugging-help-webgpu-report-errors-fixed.html"}}}

이 문제는 `submit`을 호출하지 않으면 실제로 WebGPU를 아직 사용하지 않는 것이기
때문에 거의 발생하지 않습니다. 하지만 기술 지원 질문이나 버그 보고서를 위한 최소한의
완전하고 검증 가능한 예제를 만들 때와 같은 특수한 상황에서 발생할 수 있습니다.
또는 코드를 단계별로 실행하면서 에러를 발생시켜야 한다고 알고 있는 줄을 지나쳤는데
아직 에러가 나타나지 않은 경우에도 발생할 수 있습니다.

참고: 에러가 JavaScript 콘솔에도 가지 않도록 하려면 `event.preventDefault()`를
호출할 수 있습니다.

## 수동으로 에러 캡처하기

위에서 "캡처되지 않은 에러"에 대한 메시지를 보여주었는데, 이는 "캡처된 에러"라는
것이 있다는 것을 의미합니다. 에러를 캡처하기 위해 한 쌍의 함수가 있습니다.
`device.pushErrorScope`와 `device.popErrorScope`입니다.

에러 스코프를 푸시합니다. 명령을 제출한 다음 에러 스코프를 팝하여 푸시한 시점과
팝한 시점 사이에 에러가 있었는지 확인합니다.

예제:

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

`device.pushErrorScope`는 세 가지 필터 중 하나를 받습니다.

* `'validation'`

  API를 잘못 사용하는 것과 관련된 에러

* `'out-of-memory'`

  너무 많은 메모리를 할당하려고 시도하는 것과 관련된 에러

* `'internal'`

  여러분이 잘못한 것이 없지만 드라이버가 불평하는 에러입니다.
  예를 들어, 셰이더가 너무 복잡한 경우 발생할 수 있습니다.

{{{example url="../webgpu-debugging-push-pop-error-scope.html"}}}

`popErrorScope`는 에러가 있으면 에러를, 없으면 null을 가진 프로미스를 반환합니다.
위에서는 `await`를 사용하여 프로미스를 기다리지만, 이는 프로그램을 멈춥니다.
다음과 같이 `then`을 사용하는 것이 더 일반적일 것입니다:

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

이렇게 하면 프로그램이 일시 중지되지 않고 GPU가 에러가 있었는지 여부를 알려줄 때까지
기다리지 않습니다.

## 다양한 종류의 에러

WebGPU의 일부 에러는 함수를 호출할 때 확인됩니다. 다른 에러는 나중에 확인됩니다.
WebGPU는 타임라인을 지정합니다. 그 중 두 가지는 "콘텐츠 타임라인"과 "디바이스
타임라인"입니다. "콘텐츠 타임라인"은 JavaScript 자체와 동일한 타임라인입니다.
디바이스 타임라인은 별도이며 일반적으로 별도의 프로세스에서 실행됩니다.
그 밖의 에러들은 JavaScript 자체의 규칙에 의해 확인됩니다.

* JavaScript 에러의 예: 잘못된 타입 전달

  ```js
  device.queue.writeBuffer(someTexture, ...);
  ```

  위의 코드는 `writeBuffer`의 첫 번째 인수가 JavaScript 자체에서 강제하는
  `GPUBuffer`여야 하기 때문에 즉시 에러가 발생합니다.

* "콘텐츠 타임라인" 에러의 예

  ```js
  device.createTexture({
    size: [],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  ```

  위에서 제공된 `size`는 에러입니다. 최소한 1개의 요소가 있어야 합니다.

* 디바이스 에러의 예

  이 문서의 시작 부분의 예제는 디바이스 에러입니다. 디바이스 에러는
  `pushErrorScope`, `popErrorScope`, 그리고 캡처되지 않은 에러 이벤트가
  처리하는 것들입니다.

에러가 발생하는 위치는 [스펙 문서](https://www.w3.org/TR/webgpu/)에 자세히 설명되어
있지만, JavaScript 에러와 콘텐츠 타임라인 에러는 즉시 발생하고 예외를 던지는 반면
디바이스 타임라인 에러는 비동기적으로 발생한다는 것을 아는 것이 중요합니다.

## WGSL 에러

셰이더 모듈을 컴파일할 때 에러가 발생하면 `getCompilationInfo`를 호출하여 더
자세한 정보를 요청할 수 있습니다.

예제:

```js
  device.pushErrorScope('validation');
  const code = `
      // This function
      // calls a function
      // that does not
      // exist.

      fn foo() -> vec3f {
        return someFunction(1, 2);
      }
    `;
  const module = device.createShaderModule({ code });
  device.popErrorScope().then(async error => {
    if (error) {
      const info = await module.getCompilationInfo();

      // 코드를 줄로 분할
      const lines = code.split('\n');

      // 메시지를 줄 번호의 역순으로 정렬
      // 메시지를 삽입할 때 줄 번호에 영향을 주지 않도록
      const msgs = [...info.messages].sort((a, b) => b.lineNum - a.lineNum);

      // 줄 사이에 에러 메시지 삽입
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

위의 코드는 효과적으로 모든 에러 메시지를 전체 셰이더 코드에 끼워 넣습니다.

{{{example url="../webgpu-debugging-get-compilation-info.html"}}}

`getCompilationInfo`는 `GPUCompilationMessage` 배열을 포함하는 객체를 반환하며,
각각은 다음 필드를 가지고 있습니다:

* `message`: 문자열 에러 메시지
* `type`: `'error'` 또는 `'warning'` 또는 `'info'`
* `lineNum`: 에러의 줄 번호, 1부터 시작
* `linePos`: 줄에서 에러의 위치, 1부터 시작
* `offset`: 문자열에서 에러의 위치, 0부터 시작
  (이것은 효과적으로 linePos, lineNum과 동일한 정보입니다)
* `length`: 강조할 길이

## WebGPU-Dev-Extension

[WebGPU-Dev-Extension](https://github.com/greggman/webgpu-dev-extension)은 디버깅에 도움이 되는 기능을 제공합니다.

할 수 있는 몇 가지 작업:

* 에러가 발생한 위치의 스택 추적 표시

  위에서 보여준 것처럼, WebGPU의 에러는 비동기적으로 발생합니다. 첫 번째 예제에서
  `uncapturederror` 이벤트를 사용하여 WebGPU 에러가 발생했음을 확인했지만
  JavaScript에서 해당 에러가 발생한 위치에 대한 정보는 없었습니다.

  webgpu-dev-extension은 에러를 생성하는 모든 WebGPU 함수 주위에
  `pushErrorScope`와 `popErrorScope` 호출을 추가하려고 시도하여 이 정보를
  제공합니다. 내부적으로 스택 추적을 보유하는 `Error` 객체를 생성합니다.
  에러가 발생하면 해당 `Error` 객체를 출력할 수 있으며 에러가 원래 생성된 위치의
  에러 스택을 볼 수 있습니다.

* 커맨드 인코더에 대한 에러 표시

  WebGPU에서 `GPUCommandEncoder`, `GPURenderPassEncoder`,
  `GPUComputePassEncoder`, `GPURenderBundleEncoder`와 같은 커맨드 인코더는
  디바이스 타임라인 에러를 생성하지 않습니다. 대신 에러는 `encoder.finish`를
  호출할 때까지 저장됩니다.

  예를 들어:

  ```js
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass(renderPassDesc);
  pass.setPipeline(somePipeline);
  pass.setBindGroup(0, someBindGroupIncompatibleWithSomePipeline); // 이런!
  pass.setVertexBuffer(0, positionBuffer);
  pass.setVertexBuffer(1, normalBuffer);
  pass.setIndexBuffer(indexBuffer, 'uint16');
  pass.drawIndexed(4);
  pass.end();
  const cb = encoder.finish();  // 위의 에러가 여기서 생성됨
  ```

  여기서 문제는 기껏해야 그룹 0에 바인딩된 바인드 그룹이 파이프라인과 호환되지
  않는다는 에러 메시지를 받게 되지만 어느 줄에서 에러가 발생했는지 알 수 없다는
  것입니다. 이와 같은 작은 예제에서는 꽤 명확해야 하지만 대규모 앱에서는 어떤
  특정 줄이 에러를 일으켰는지 추적하기 어려울 수 있습니다.

  webgpu-dev-extension은 에러를 일으킨 줄에서 에러를 던지려고 시도할 수 있습니다.

* WGSL 에러를 전체 셰이더 소스와 함께 표시

  위의 예제처럼, webgpu-dev-extension에는 간결한 에러 메시지(기본값) 대신
  소스 WGSL과 함께 에러를 끼워 넣어 표시하는 옵션이 있습니다.

## WebGPU-Inspector

[WebGPU-Inspector](https://github.com/brendan-duncan/webgpu_inspector)는
모든 WebGPU 명령을 캡처하려고 시도하며 버퍼, 텍스처, 호출을 검사하고 일반적으로
WebGPU 코드에서 무슨 일이 일어나고 있는지 확인할 수 있게 해줍니다.

<div class="webgpu_center"><img src="https://github.com/brendan-duncan/webgpu_inspector/raw/main/docs/images/frame_capture_commands.png"></div>

## 셰이더 디버깅을 위한 팁

### 단순화:

가능한 한 많이 잘라내어 셰이더를 작동 상태로 만드세요.
작동하면 조금씩 다시 추가하세요.

### 단색 표시

렌더 패스의 경우, 제가 자주 하는 첫 번째 작업은 단색을 표시하는 것입니다.

다음은 [스포트라이트에 대한 문서](webgpu-lighitng-spot.html)의 마지막 셰이더입니다.

```wgsl
@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
  // vsOut.normal은 인터 스테이지 변수이므로
  // 보간되어 단위 벡터가 아닙니다.
  // 정규화하면 다시 단위 벡터가 됩니다
  let normal = normalize(vsOut.normal);

  let surfaceToLightDirection = normalize(vsOut.surfaceToLight);
  let surfaceToViewDirection = normalize(vsOut.surfaceToView);
  let halfVector = normalize(
    surfaceToLightDirection + surfaceToViewDirection);

  let dotFromDirection = dot(surfaceToLightDirection, -uni.lightDirection);
  let inLight = smoothstep(uni.outerLimit, uni.innerLimit, dotFromDirection);

  // 노멀과 빛 방향의 내적을 취하여
  // 빛을 계산합니다
  let light = inLight * dot(normal, surfaceToLightDirection);

  var specular = dot(normal, halfVector);
  specular = inLight * select(
      0.0,                           // 조건이 거짓일 때의 값
      pow(specular, uni.shininess),  // 조건이 참일 때의 값
      specular > 0.0);               // 조건

  // 색상 부분만 곱합니다 (알파는 제외)
  // 빛으로
  let color = uni.color.rgb * light + specular;
  return vec4f(color, uni.color.a);
}
```

예제는 스포트라이트로 비춰진 작은 부분이 있는 녹색 F를 렌더링해야 합니다.
다음은 버그가 있는 버전입니다. 디버깅해 봅시다.

{{{example url="../webgpu-debugging-spot-light-01.html"}}}

실행했는데 화면에 아무것도 나타나지 않았고 WebGPU 에러도 없었습니다.
제가 할 수 있는 첫 번째 작업은 단색 빨강을 반환하도록 변경하는 것입니다.

```wgsl
  let color = uni.color.rgb * light + specular;
-  return vec4f(color, uni.color.a);
+  //return vec4f(color, uni.color.a);
+  return vec4f(1, 0, 0, 1);  // 단색 빨강
```

빨간색 F가 보이면 F를 만드는 삼각형을 그리기에 충분한 버텍스 셰이더가 올바르기
때문에 프래그먼트 셰이더를 살펴봐야 한다는 것을 알 수 있습니다.
빨간색 F가 보이지 않으면 버텍스 셰이더를 살펴봐야 합니다.

시도해 보면:

{{{example url="../webgpu-debugging-spot-light-02.html"}}}

빨간색 F가 보입니다. 좋습니다. 이제 노멀을 시각화해 봅시다.
그렇게 하려면 프래그먼트 셰이더의 끝을 다음과 같이 변경하세요:

```wgsl
  let color = uni.color.rgb * light + specular;
  //return vec4f(color, uni.color.a);
-   return vec4f(1, 0, 0, 1);  // 단색 빨강
+   //return vec4f(1, 0, 0, 1);  // 단색 빨강
+   return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 노멀
```

노멀은 -1.0에서 +1.0까지이지만 색상은 0.0에서 1.0까지이므로 0.5를 곱하고 0.5를
더하여 노멀을 색상으로 시각화할 수 있는 것으로 변환합니다.

시도해 보면:

{{{example url="../webgpu-debugging-spot-light-03.html"}}}

흠, 뭔가 잘못된 것 같습니다. 모든 노멀이 0,0,0인 것처럼 보입니다.
분명히 프래그먼트 셰이더의 노멀에 문제가 있습니다. 이러한 노멀은 `normalMatrix`로
곱해진 후 버텍스 셰이더에서 나옵니다. `normalMatrix`로 곱하지 않고 노멀을 바로
전달해 봅시다. F가 나타나면 버그가 `normalMatrix`에 있다는 것을 알 수 있습니다.
F가 나타나지 않으면 버그가 버텍스 셰이더에 제공되는 데이터에 있습니다.

```wgsl
  // 노멀을 방향 지정하고 프래그먼트 셰이더로 전달
-  vsOut.normal = uni.normalMatrix * vert.normal;
+  //vsOut.normal = uni.normalMatrix * vert.normal;
+  vsOut.normal = vert.normal;
```

실행하면:

{{{example url="../webgpu-debugging-spot-light-04.html"}}}

좀 나아졌군요. 따라서 분명히 `normalMatrix`에 문제가 있습니다.

코드를 확인해 보니 주석 처리되어 있어서 행렬이 모두 0이 되었습니다.
누군가 뭔가를 확인하다가 주석을 해제하는 것을 잊어버린 것 같습니다.😅

```js
    // 역행렬의 전치행렬을 worldInverseTranspose 값에 넣습니다
-    //mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
+    mat3.fromMat4(mat4.transpose(mat4.inverse(world)), normalMatrixValue);
```

주석을 해제합시다. 그런 다음 버텍스 셰이더를 원래대로 되돌립시다.

```wgsl
  // 노멀을 방향 지정하고 프래그먼트 셰이더로 전달
-  //vsOut.normal = uni.normalMatrix * vert.normal;
-  vsOut.normal = vert.normal;
+  vsOut.normal = uni.normalMatrix * vert.normal;
```

그러면 다음과 같이 됩니다:

{{{example url="../webgpu-debugging-spot-light-05.html"}}}

F를 회전하면 색상이 변경되는 것을 볼 수 있습니다. 이는 노멀이 `normalMatrix`에
의해 방향이 바뀌고 있음을 보여줍니다. 회전해도 색상이 변경되지 않는 위의 것과 비교하세요.

이것으로 마침내 프래그먼트 셰이더를 복원할 수 있습니다.

```wgsl
  let color = uni.color.rgb * light + specular;
-  //return vec4f(color, uni.color.a);
-  //return vec4f(1, 0, 0, 1);  // 단색 빨강
-  return vec4f(vsOut.normal * 0.5 + 0.5, 1);  // 노멀
+  return vec4f(color, uni.color.a);
```

그리고 의도한 대로 작동합니다.

{{{example url="../webgpu-debugging-spot-light-06.html"}}}

데이터를 시각화하는 방법을 찾는 것은 데이터를 확인하는 좋은 방법입니다.
예를 들어, [텍스처 좌표](webpgu-textures.html)를 확인하려면 다음과 같이 할 수
있습니다:

```wgsl
   return vec4f(fract(textureCoord), 0, 1);
```

텍스처 좌표는 일반적으로 0.0에서 1.0까지이지만 텍스처를 반복하는 경우 더 높아질 수
있으므로 `fract`가 이를 처리합니다.

텍스처 좌표가 어떻게 생겼는지 알려주기 위해 텍스처 좌표가 시각화된 몇 가지 객체가
있습니다.

<div class="webgpu_center">
   <div data-diagram="texcoords" style="width: 1024px; height: 400px;"></div>
   <div class="caption">텍스처 좌표 시각화</div>
</div>

텍스처 좌표는 일반적으로 일부 표면에서 부드럽습니다.

다음은 버그가 있는 동일한 텍스처 좌표를 시각화한 것입니다.

<div class="webgpu_center">
   <div data-diagram="texcoords-bad"  style="width: 1024px; height: 400px;"></div>
   <div class="caption">잘못된 텍스처 좌표</div>
</div>

더 이상 부드럽지 않으므로 뭔가 어긋나있을 것입니다.

위와 동일한 절차를 따르면 버텍스 셰이더로 들어오는 데이터가 잘못되었다는 결론을
내릴 것입니다. 실제로 이 예제는 버텍스 데이터를 `float32x3` 값으로 업로드하지만
렌더 파이프라인 디스크립터에서 실수로 `float16x2`로 지정했습니다.

<!-- keep this at the bottom of the article -->
<link href="webgpu-debugging.css" rel="stylesheet">
<script type="module" src="webgpu-debugging.js"></script>
