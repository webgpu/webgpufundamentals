Title: WebGPU 동작 방식
Description: WebGPU는 어떻게 동작하는가
TOC: 동작 방식

WebGPU를 설명하기 위해 GPU가 정점 셰이더와 프래그먼트 셰이더로 하는 작업들을 자바스크립트로 구현하여 설명해 보겠습니다. 
이를 통해 어떤 일이 일어나는지 보다 직관적으로 이해하시기를 바랍니다.

[Array.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)에 익숙하시고 많이 사용해 보셨다면 이 두 개의 셰이더 함수가 어떻게 동작하는지 이해하실 수 있습니다. 
`Array.map`에서 여러분은 값을 변환하기 위한 함수를 전달합니다.

예시:

```js
const shader = v => v * 2;  // double the input
const input = [1, 2, 3, 4];
const output = input.map(shader);   // result [2, 4, 6, 8]
```

위에서 array.map에 사용하는 "shader"는 주어진 값의 두 배를 반환하는 함수입니다. 
이것이 아마도 "shader"가 무엇인지를 자바스크립트로 비유하는 가장 좋은 방법인 것 같습니다. 
값을 반환하거나 생성하는 함수인 것이죠. 그리고 직접 호출하지 않습니다. 
대신, 명시해 놓으면 시스템이 대신해서 호출해 줍니다.

GPU에서의 정점 셰이더에서는 여러분이 입력 배열에 대해 map을 하지는 않습니다. 
대신 해당 함수가 몇 번이나 호출되어야 하는지를 명시합니다.

```js
function draw(count, vertexShaderFn) {
  const internalBuffer = [];
  for (let i = 0; i < count; ++i) {
    internalBuffer[i] = vertexShaderFn(i);
  }
  console.log(JSON.stringify(internalBuffer));
}
```

이로 인해서 `Array.map`와는 다르게 소스 배열이 불필요해집니다.

```js
const shader = v => v * 2;
const count = 4;
draw(count, shader);
// outputs [0, 2, 4, 6]
```

GPU로 작업하는 것이 복잡해지는 이유는 이러한 함수가 여러분 컴퓨터 내의 GPU라는 별도의 시스템에서 동작하기 때문입니다. 
즉 여러분이 만들고 참조한 모든 데이터는 어떻게든 GPU로 보내져야 하고 셰이더와 소통해서 그 데이터가 어디에 있고 어떻게 접근해야 하는지 알려줘야 합니다.

정점과 프래그먼트 셰이더는 여섯 가지 방법으로 데이터를 받을 수 있습니다. 
uniform, 어트리뷰트, 버퍼, 텍스처, 스테이지간 변수, 상수 입니다.

1. Uniforms

   uniform은 셰이더의 각 반복에서 모두 값이 동일합니다. 
   상수 전역 변수로 생각하시면 됩니다. 
   셰이더가 실행되기 전에는 값을 설정할 수 있지만, 셰이더가 사용되는 도중에는 값이 변할 수 없습니다. 
   다시 말해 *일정한(uniform)* 상태를 유지합니다.
   
   `draw`를 수정해 uniform을 셰이더에 전달해 보겠습니다. 
   이를 위해서 `binding`이라는 배열을 만들고 이를 uniform을 전달하기 위해 사용합니다.
   
   ```js
   *function draw(count, vertexShaderFn, bindings) {
     const internalBuffer = [];
     for (let i = 0; i < count; ++i) {
   *    internalBuffer[i] = vertexShaderFn(i, bindings);
     }
     console.log(JSON.stringify(internalBuffer));
   }
   ```

   그리고 셰이더를 uniform을 사용하는 방식으로 수정해 보겠습니다.

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
   // outputs [0, 3, 6, 9]
   draw(count, vertexShader, bindings2);
   // outputs [0, 5, 10, 15]
   ```

   따라서 uniform의 개념은 상당히 직관적입니다. 
   `bindings`을 중간에 두어 간접적으로 값을 전달한 것은 WebGPU의 동작 방식이 이와 "유사"하기 떄문입니다. 
   이전에 이야기한 것처럼 무언가(이 경우엔 uniform)에 접근하기 위해서는 location/인덱스를 바탕으로 접근합니다. 
   위 예제에서는 `bindings[0]`가 되겠죠.

2. 어트리뷰트 (정점 셰이더만 해당)

   어트리뷰트는 셰이더 반복별로 다른 데이터를 전달합니다. 
   위 `Array.map`에서 `v`값은 `input`으로부터 얻어와서 자동으로 함수에 전달됩니다. 
   이는 셰이더의 어트리뷰트와 매우 유사합니다.
   
   차이점은, 우리는 입력값을 직접 맵핑하는 것이 아니라 반복 횟수만을 사용하기 때문에, 
   WebGPU에게 입력이 무엇이고 데이터를 어떻게 가져와야 하는지 알려줘야 한다는 것입니다. 
   
   `draw`가 아래와 같이 수정되었다고 해 봅시다.

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

   그러면 아래와 같이 호출할 수 있습니다.

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
   // outputs [11, 110, 297, 572]
   ```

   위에서 볼 수 있는 것처럼, `getAttribs`는 `offset`과 `stride`를 사용해서 인덱스를 계산하고, 대응되는 `source` 버퍼로부터 값을 가져옵니다. 
   가져온 값은 셰이더로 전달되는데, 각 반복마다 `attribs`는 달라집니다.
   
   ```
    iteration |  attribs
    ----------+-------------
        0     | [0, 1, 11]
        1     | [2, 3, 22]
        2     | [4, 5, 33]
        3     | [6, 7, 44]
   ```

3. Raw 버퍼

   버퍼는 근본적으로 배열인데, 이번에는 버퍼를 사용하는 `draw`를 만들어 봅시다. 
   버퍼는 이전에 uniform에서처럼 `bindings`를 통해 전달할 것입니다.
   
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
   // outputs [11, 110, 297, 572]
   ```

   이전 어트리뷰트와 동일한 결과를 얻었지만 이번에는 시스템이 버퍼에서 값을 가져오는 대신, 우리가 바인딩된 버퍼의 인덱스를 직접 계산했습니다. 
   이러한 방식이 배열의 요소들에 직접 접근 가능하기 때문에 어트리뷰트보다 유연합니다. 
   하지만 그 이유 때문에 더 느릴 가능성도 생깁니다. 
   어트리뷰트의 동작 방식 때문에 GPU는 접근해야 할 값의 순서를 알고 최적화 할 수 있습니다. 
   예를 들어 순차적 접근은 일반적으로 캐시(cache) 친화적입니다. 
   우리가 직접 인덱스를 계산할 때에는, 버퍼의 어떤 부분에 접근할지를, 실제로 접근을 시도하기 전까지는 GPU가 알 수 없습니다.

4. 텍스처

   텍스처는 데이터의 1차원, 2차원, 3차원 배열입니다. 
   물론 버퍼를 사용해 우리가 스스로 2차원, 3차원 배열을 구현해도 됩니다. 
   텍스처의 특별한 점은 샘플링기 가능하다는 것입니다. 
   샘플링은 GPU에게 우리가 입력한 값 사이의 값을 계산하도록 하는 것입니다. 
   이것의 의미는 [텍스처에 관한 글](webgpu-textures.html)에 설명해 두었습니다. 
   지금은, 자바스크립트 비유를 계속 가져가 봅시다.

   먼저 배열의 사이값을 *샘플링*하는 `textureSample`함수를 만듭니다.
   
   ```js
   function textureSample(texture, ndx) {
     const startNdx = ndx | 0;  // round down to an int
     const fraction = ndx % 1;  // get the fractional part between indices
     const start = texture[startNdx];
     const end = texture[startNdx + 1];
     return start + (end - start) * fraction;  // compute value between start and end
   }
   ```

   이와 같은 함수가 이미 GPU에는 구현되어 있습니다.

   이 함수를 셰이더에서 사용해 봅시다.

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
   // outputs [10, 27.5, 45, 62.5]
   ```

   `ndx`가 `3`일때 `textureSample`에 `3 * 1.75`, 즉 `5.25`가 전달됩니다. 
   이를 통해 `startNdx`는 `5`가 되고 `5`와 `6` 인덱스의 값인 `60`과 `70`이 얻어집니다. 
   `fraction`은 `0.25`가 되므로 `60 + (70 - 60) * 0.25`를 통해 `62.5`가 계산됩니다.

   위 코드를 보면 셰이더의 함수로 우리가 `textureSample`을 직접 작성할 수 있어 보입니다. 
   두 개의 값을 가져와 사이값을 보간하면 됩니다. 
   GPU가 이러한 특수한 함수를 가지고 있는 이유는 동일한 계산을 매우 빠르게 계산할 수도 있고, 설정에 따라서는 16개의 4개 float 값(*역주: 텍스처 색상 vec4f*)을 가져와 4개 float을 계산해야 할 수도 있기 때문입니다. 
   후자의 경우 직접 구현하려고 하면 많은 작업이 필요할 것입니다.

5. 스테이지간 변수 (프래그먼트 셰이더만 해당)

   스테이지간 변수는 정점 셰이더에서 프래그먼트 셰이더로 보내지는 출력값입니다. 
   위에서 언급한 것처럼 정점 셰이더의 출력 위치값은 점, 선, 삼각형을 그리기/래스터화 하기 위해 사용됩니다.
   
   선을 그리려고 한다고 가정해 봅시다. 
   정점 셰이더가 두 번 실행되는데, 첫 번째에서는 `5,0`을, 두 번째에서는 `25,4`를 출력한다고 해 봅시다. 
   이 두 점의 위치로부터 GPU는 `5,0`에서 `25,4`를 잇는 선을 그릴 것입니다. 
   이를 위해서 프래그먼트 셰이더를 20번 호출할 것인데, 각 호출은 그 선 위의 픽셀 하나당 한 번씩을 의미합니다. 
   프래그먼트 셰이더를 호출할 때마다 어떤 색상을 반환할 것인지는 우리에게 달려 있습니다.
   
   두 개의 점을 잇는 선을 그리는 두 개의 함수가 있다고 해 봅시다. 
   첫 번째 함수는 몇 개의 픽셀을 그려야 하는지와 그리기 위해 필요한 정보들을 계산해주는 함수입니다. 
   두 번째 함수는 그 정보들과 픽셀 숫자를 받아서 픽셀 위치를 알려줍니다. 예시는 아래와 같습니다.
   
   ```js
   const line = calcLine([10, 10], [13, 13]);
   for (let i = 0; i < line.numPixels; ++i) {
     const p = calcLinePoint(line, i);
     console.log(p);
   }
   // prints
   // 10,10
   // 11,11
   // 12,12
   ```
   
   참고: `calcLine`과 `calcLinePoint`가 실제로 어떻게 동작하는지는 중요하지 않습니다. 
   중요한 것은 이들이 잘 동작하고 위 반복문이 선을 그리기 위한 픽셀 위치들을 알려준다는 사실입니다. 
   **그래도 궁금하시다면, 이 글의 마지막에 있는 코드 예제를 살펴 보세요**.
   
   이제 정점 셰이더를 수정해서 반복마다 두 개의 값을 출력하도록 하겠습니다. 
   다양한 방법으로 할 수 있는데, 아래는 한 가지 예시를 보여줍니다.

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
   // outputs [[5, 0], [25, 4]]
   ```

   이제 한번에 점 두 개씩을 순회하면서 선을 래스터화하는 `rasterizeLines`를 작성합니다.
   
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

   위와 같은 코드를 사용하도록 `draw`를 수정합니다.

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

   이제 `internalBuffer`가 실제로 사용되는군요 😃!
   
   `draw`를 호출하는 코드도 수정합니다.

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

   `0`을 `.`으로 표현하여 `pixels` 사각형을 출력해 보면 아래와 같습니다.

   ```
   .....666......................
   ........66666.................
   .............66666............
   ..................66666.......
   .......................66.....
   ```

   안타깝게도 프래그먼트 셰이더는 각 반복마다 변하는 입력이 없기 때문에 각 픽셀별로 다른 값을 출력할 방법이 없습니다. 
   이를 위해 스테이지간 변수를 사용할 수 있습니다. 
   첫 번째 셰이더를 수정해서 추가적인 값을 출력하도록 수정해 봅시다.
   
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

   다른 부분을 수정하지 않는다면 `draw` 내의 반복이 끝나면 `internalBuffer`는 아래와 같은 값을 갖게 됩니다.
   
   ```js
    [ 
      [[ 5, 0], [9]],
      [[25, 4], [3]],
    ]
   ```

   선을 따라 얼마나 떨어져 있는지를 0.0과 1.0 사이의 값으로 계산하는 코드는 쉽게 작성이 가능합니다. 
   이 값을 사용해 방금 추가한 값을 보간할 수 있습니다.
   
   ```js
   function rasterizeLines(dest, destWidth, inputs, fragShaderFn, bindings) {
     for(let ndx = 0; ndx < inputs.length - 1; ndx += 2) {
   -    const p0 = inputs[ndx    ];
   -    const p1 = inputs[ndx + 1];
   +    const p0 = inputs[ndx    ][0];
   +    const p1 = inputs[ndx + 1][0];
   +    const v0 = inputs[ndx    ].slice(1);  // everything but the first value
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

   이제 스테이지간 변수를 프래그먼트 셰이더에서 사용 가능합니다.

   ```js
   -const fragShader = (bindings) => 6;
   +const fragShader = (bindings, interStageVariables) => 
   +    interStageVariables[0] | 0; // convert to int
   ```

   실행하면 결과는 아래와 같습니다.

   ```
   .....988......................
   ........87776.................
   .............66655............
   ..................54443.......
   .......................33.....
   ```

   정점 셰이더의 첫 번째 반복에서는 `[[5,0], [9]]`가, 두 번째 반복에서는 `[[25,4], [3]]`가 출력되며 프래그먼트 셰이더가 호출되면서 위 출력의 두 번째 값들 사이에 보간이 이루어졌습니다.
   
   세 개의 점을 통해 삼각형을 래스터화하는 `mapTriangle` 함수를 만들고 프래그먼트 셰이더 함수를 각 삼각형 내 점들에 대해 호출하도록 할 수도 있을 겁니다. 
   이러한 경우 스테이지간 변수는 두 개 점이 아닌 세 개 점 사이의 값을 보간하게 됩니다.
   
이해를 돕기 위해 수정이 가능하도록 위의 모든 예제에 대한 실행 코드를 아래 제공해 드립니다.

{{{example url="../webgpu-javascript-analogies.html"}}}

위에서 설명한 자바스크립트는 비유입니다. 
실제 WebGPU에서 스테이지간 변수가 어떻게 보간되는지, 선이 어떻게 그려지는지, 버퍼에 어떻게 접근하는지, 텍스처 샘플링이 어떻게 이루어지는지, uniform과 어트리뷰트는 어떻게 명시되는지 등등에 대한 세부 동작은 다릅니다. 
하지만 개념 자체는 매우 유사하기 때문에 이러한 자바스크립트 비유가 무슨 일이 일어나는지에 대한 개념 이해에 도움이 될 것으로 기대합니다.

왜 이런 방식으로 동작하냐고요? 
음, `draw`와 `rasterizeLines`를 보시면 각 반복이 완전히 독립적으로 이루어지는 것을 알 수 있을겁니다. 
다른 방식으로 설명해보자면 각 반복은 어떤 순서로 진행되어도 상관이 없습니다. 
0,1,2,3,4 순서 대신 3,1,4,0,2 순서로 반복해도 결과는 같습니다. 
반복이 독립적이라는 뜻은 이들이 별도의 처리장치에서 병렬적으로 실행될 수 있다는 뜻입니다. 
2021년 기준 최상급 GPU는 10,000개 이상의 처리장치가 내장되어 있습니다. 
즉 10,000개의 연산이 병렬적으로 이루어 질 수 있다는 뜻입니다. 
이것이 GPU의 능력의 원천입니다. 이러한 패턴을 따름으로써 시스템은 병렬적으로 작업을 수행할 수 있습니다.

한계점은 아래와 같습니다:

1. 한 셰이더 함수는 그 입력값 (어트리뷰트, 버퍼, 텍스처, uniform, 스테이지간 변수)만 참조할 수 있음

2. 셰이더는 메모리를 할당할 수 없음

3. 셰이더가 값을 쓰는/값을 생성하는 그 값을 참조하는 경우에 주의해야 함

   생각해 보면 당연합니다. 위에서 `fragShader`가 `dest`를 직접 참조하려 한다고 해 봅시다. 
   그러면 병렬화가 불가능해지게 됩니다. 
   어떤 반복이 먼저 실행될까요? 
   만일 세 번째 반복에서 `dest[0]`를 참조하려 하면 먼저 0번째 반복이 실행되었어야만 하는데 만일 0번째 반복에서 `dest[3]`를 참조하는 경우에는 다시 세 번째 반복이 먼저 실행되었어야만 합니다.
   
   이러한 한계점을 해결하는 방안은 CPU에서의 멀티쓰레드나 멀티프로세스에서도 필요하긴 하지만 GPU의 세계에서는 10,000개나 되는 프로세서가 한 번에 연산을 하기 때문에 보다 특별한 주의가 필요합니다. 
   관련된 기술 중의 일부를 다른 글에서 설명하도록 할 예정입니다.
