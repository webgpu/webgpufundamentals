Title: WebGPU 셰이더 상수(Constants)
Description: WebGPU 기초
TOC: 상수(Constants)

이 내용이 셰이더 입력의 한 종류로 간주될 수 있는지는 잘 모르겠습니다. 
하지만 어떤 면에서는 그렇게 볼 수도 있으니 한번 이야기 해 보겠습니다.

상수(Constants), 좀더 정확히는 *파이프라인에서 오버라이딩 가능한 상수(pipeline-overridable constants)*는 셰이더에서 선언이 가능하고, 
그 셰이더를 파이프라인을 만들기 위해 사용하는 시점에 값을 변경할 수 있는 상수입니다.

간단한 예제는 아래와 같습니다.

```wgsl
override red = 0.0;
override green = 0.0;
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

이 프래그먼트 셰이더와 [기초](webgpu-fundamentals.html)에서의 정점 셰이더를 사용해 보겠습니다.

```wgsl
@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.5, -0.5),  // bottom left
    vec2f( 0.5, -0.5)   // bottom right
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
```

그러면 결과로 아래와 같은 검은색 삼각형이 그려집니다.

{{{example url="../webgpu-constants.html"}}}

하지만 저 상수들의 값을 바꿀 수 있습니다. 
또는 "오버라이드"할 수 있다고도 하는데, 파이프라인에 명시하는 시점에서 할 수 있습니다.

```js
  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
+      constants: {
+        red: 1,
+        green: 0.5,
+        blue: 1,
+      },
    },
  });
```

이제 핑크색으로 그려집니다.

{{{example url="../webgpu-constants-override.html"}}}

파이프라인에서 오버라이딩 가능한 상수는 스칼라(scalar) 값만 가능하므로, 
불리언(true/false), 정수, 부동소수점만 사용할 수 있습니다. 
벡터 또는 행렬은 불가능합니다.

셰이더에서 값을 명시하지 않으면 **반드시** 파이프라인에서 값을 제공해야 합니다. 
또한 숫자 ID를 부여하고 ID를 기반으로 참조하는 것도 가능합니다.

예시:

```wgsl
override red: f32;             // Must be specified in the pipeline
@id(123) override green = 0.0; // May be specified by 'green' or by 123
override blue = 0.0;

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
```

이게 왜 필요한지 의문이 드실겁니다. 
WGSL을 만들 때 단순히 아래와 같이 할 수도 있습니다.

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
const red = ${red};
const green = ${green};
const blue = ${blue};

@fragment fn fs() -> @location(0) vec4f {
  return vec4f(red, green, blue, 1.0);
}
`;
```

또는 보다 직접적으로 아래와 같이 할 수도 있죠.

```js
const red = 0.5;
const blue = 0.7;
const green = 1.0;

const code = `
@fragment fn fs() -> @location(0) vec4f {
  return vec4f(${red}, ${green}, ${blue}, 1.0);
}
`;
```

차이점은, 파이프라인에서 오버라이딩가능한 상수는 셰이더 모듈이 생성된 "다음에" 적용되기 때문에 값을 적용한 후 새로운 셰이더 모듈을 적용하는 것보다 더 빠릅니다. 
하지만 파이프라인을 만드는 것 자체가 빠른 연산이 아니기 때문에 이러한 기능을 전체적인 파이프라인 생성 과정을 얼마나 단축시킬 수 있는지는 명확하지 않습니다. 
아마도 셰이더가 복잡해질수록 단축되는 시간이 더 커질 것입니다.

어쨌든 이 기능은 셰이더에 적은 양의 데이터를 전달하는 방법 중 하나입니다.

색상값을 전달하기 위해 파이프라인에서 오버라이딩가능한 상수를 사용하는 것은 흔한 일이 **아닙니다**. 
위 예시는 그저 이해하기 쉽고 결과를 보여주기 좋기 때문에 만든 것입니다. 
대신에 반복 횟수를 명시하거나 배열의 크기(예를 들어 조명의 개수 등)를 명시하는 데 보다 유용합니다.
