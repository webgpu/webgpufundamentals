Title: WebGPU 선택적 기능(optional feature)과 제한(limit)
Description: 선택적 기능
TOC: 선택적 기능(optional feature)과 제한(limit)

WebGPU에는 다양한 선택적 기능(optional feature)과 제한(limit)이 있습니다. 
이들을 확인하고 요청하는 방법을 알아보겠습니다.

아래 코드로 어댑터를 요청할 때,

```js
const adapter = await navigator.gpu?.requestAdapter();
```

어댑터는 `adapter.limits`에 제한의 목록을, `adapter.features`에 기능 이름의 배열을 가지고 있습니다. 
예를 들어 아래와 같은 코드는,

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.limits.maxColorAttachments);
```

`8`을 콘솔에 출력할텐데 즉 어댑터가 최대 8개의 컬러 어태치먼트를 지원한다는 뜻입니다.

아래는 제한의 전체 목록입니다. 
여러분의 기본 어댑터의 제한과 최소 요구사항 제한이 모두 포함되어 있습니다.

<div class="webgpu_center data-table limits" data-diagram="limits"></div>

최소 요구사항은 WebGPU를 지원하는 모든 장치에서 보장된 최소 사양입니다.

선택적 기능의 목록도 있습니다. 
예를 들어 아래와 같은 코드로 모두 살펴볼 수 있습니다.

```js
const adapter = await navigator.gpu?.requestAdapter();
console.log(adapter.features);
```

이렇게 하면 `["texture-compression-astc", "texture-compression-bc"]`와 같이 출력되는데, 이러한 기능들은 여러분이 요청하면 사용 가능하다는 뜻입니다.

여러분의 기본 어댑터에서 사용 가능한 기능들은 아래와 같습니다.

<div class="webgpu_center data-table features" data-diagram="features"></div>

> 참고: 여러분 시스템의 어댑터의 모든 기능과 제한사항은 [webgpureport.org](https://webgpureport.org)에서 확인할 수 있습니다.

## 제한과 기능 요청하기

기본적으로 여러분이 장치를 요청할 때 최소 제한(위 표에서 오른쪽 열)을 얻을 수 있고 선택적 기능은 없는 상태입니다. 
여러분이 이러한 최소 제한 하에서 개발을 하면, 여러분의 앱은 WebGPU를 지원하는 모든 장치에서 동작하게 될 겁니다.

하지만 어댑터에 대한 가능한 제한과 기능 목록에 기반하여 `requestDevice`를 호출할 때 필요로 하는 최소 사양을 `requiredLimits`에, 선택적 기능을 `requiredFeatures`에 넘겨줄 수 있습니다.
예를 들어,

```js
const k1Gig = 1024 * 1024 * 1024;
const adapter = await navigator.gpu?.requestAdapter();
const device = adapter?.requestDevice({
  requiredLimits: { maxBufferSize: k1Gig },
  requiredFeatures: [ 'float32-filterable' ],
});
```

위에서 우리는 1GB의 버퍼가 사용 가능해야 하고 필터링 가능한 float32 텍스처가 사용 가능해야 한다는 요구사항을 명시하고 있습니다. 
(예를들어 `'rgba32float'`에 대해 minFilter가 `'linear'`로 설정 가능해야 한다는 뜻입니다. 기본적으로는 `'nearest'`밖에 사용하지 못합니다.)

둘 중 어떤 요구사항이라도 만족되지 않으면 `requestDevice`는 실패합니다(프라미스를 reject합니다).

## 모든 것을 요구하지 마세요

모든 제한과 기능을 요청해서 만족하는지 확인하고 싶어하실 수도 있습니다.

예를 들어:

```js
function objLikeToObj(src) {
  const dst = {};
  for (const key in src) {
    dst[key] = src[key];
  }
  return dst;
}

//
// 나쁨!!! ?
//
async function main() {
  const adapter = await navigator?.gpu.requestAdapter();
  const device = await adapter?.requestDevice({
    requiredLimits: objLikeToObj(adapter.limits),
    requiredFeatures: adapter.features,
  });
  if (!device) {
    fail('need webgpu');
    return;
  }

  const canUse128KUniformsBuffers = device.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = device.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = device.features.has('indirect-first-instance');
}
```

이는 제한과 기능을 확인하는 간단하고 명료한 방법처럼 보입니다[^objliketoobj].
이러한 패턴의 문제는, 의도치 않게 기본 제한을 초과해도 이를 인지하지 못할 수 있다는 점입니다. 
예를 들어 `'rgba32float'` 텍스처를 만들고 `'linear'`로 필터링했다고 해봅시다. 
여러분의 데스크탑에서는 이 기능이 활성화되어 있었기 때문에 마법처럼 작동할겁니다.

[^objliketoobj]: `objLikeToObj`는 뭐고 왜 사용한 것일까요? 
그 이유는 난해한 Web 명세 때문입니다. 
명세에는 `requiredLimits`를 `record<DOMString, GPUSize64>`로 목록화하고 있습니다.  
Web IDL 명세에서는 객체를 `record<DOMString, GPUSize64>`로 변환할 때, 객체가 실제로 *소유한(own)* 속성만을 복사하도록 명시하고 있습니다. 
어댑터의 `limits` 객체는 `interface`의 목록입니다. 
객체의 속성처럼 보이는 것은 실제로는 속성이 아니고 객체의 프로토타입(prototype)에 있는 getter입니다. 
따라서 이들은 실제로는 객체가 소유한 속성이 아닙니다. 
따라서 `record<DOMString, GPUSize64>`로 변환할 때 복사되지 않고 우리가 직접 복사해 주어야 합니다.

유저의 핸드폰에서는 `'float32-filterable'` 기능이 존재하지 않는데도 이를 사용했기 때문에 프로그램이 원인 불명의 오류로 실패합니다.
이 기능이 선택 사항이라는 사실을 인지하지 못한 채 사용한 것입니다.

또는 최소 maxBufferSize보다 큰 버퍼를 할당했을 때도 한계를 초과했다는 사실을 인지하지 못할 수 있습니다. 출시 후 수많은 사용자가 페이지를 실행하지 못하게 됩니다.

## 기능과 제한 요청에 대한 추천하는 방법

기능과 제한을 요청하는 추천하는 방법은 반드시 필요한 것을 결정하고 그것들만 요청하는 것입니다.

예를 들어 아래와 같습니다.

```js
  const adapter = await navigator?.gpu.requestAdapter();

  const canUse128KUniformsBuffers = adapter?.limits.maxUniformBufferBindingSize >= 128 * 1024;
  const canStoreToBGRA8Unorm = adapter?.features.has('bgra8unorm-storage');
  const canIndirectFirstInstance = adapter?.features.has('indirect-first-instance');

  // 이러한 기능 중 하나 이상이 반드시 필요하다면, 해당 기능이 제공되지 않을 경우 즉시 실패 처리합니다.
  if (!canUse128kUniformBuffers) {
    alert('Sorry, your device is probably too old or underpowered');
    return;
  }

  // 필요한 사용 가능한 기능 및 제한을 요청합니다
  const device = adapter?.requestDevice({
    requiredFeatures: [
      ...(canStorageBGRA8Unorm ? ['bgra8unorm'] : []),
      ...(canIndirectFirstInstance) ? ['indirect-first-instance']),
    ],
    requiredLimits: [
      maxUniformBufferBindingSize: 128 * 1024,
    ]
  });
```

이렇게 하면, 128k보다 큰 uniform 버퍼를 요청하면 오류가 발생합니다. 
마찬가지로 요청하지 않은 기능을 사용하려 할 경우에도 오류가 발생하게 됩니다. 
이렇게 하면 확실하게 제한 요구사항을 올릴지 (그래서 더 다양한 장치에서 사용은 못하더라도), 아니면 제한을 유지할 지, 아니면 기능이나 제한이 만족되지 않는 경우에 대해 다른 방식으로 동작하도록 할 지를 의식적으로 결정할 수 있게 됩니다.

<!-- keep this at the bottom of the article -->
<link rel="stylesheet" href="webgpu-limits-and-features.css">
<script type="module" src="webgpu-limits-and-features.js"></script>



