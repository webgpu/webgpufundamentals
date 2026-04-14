# WebGPU 기초

<!-- 2026년 4월 14일 기준 -->
<!-- 0672d7310d23028f30b052ecc3f534ddaa3d9bd5 -->

이 저장소는 [WebGPU에 대한 일련의 강의 및 튜토리얼](https://webgpufundamentals.org/webgpu/lessons/ko/)입니다.

아직 진행 중인 작업입니다. 기여는 언제든 환영하며, 특히 현지화(번역) 기여를 환영합니다.

## 기여하기

버그 수정은 언제나 환영입니다.

새 글을 작성하고 싶다면, 가급적 한 번에 한 단계씩만 설명하도록 해 주세요. 한 단계에서 두 가지 이상을 동시에 다루지 않도록 합니다. 새롭게 등장하는 수학은 가능한 한 가장 단순한 용어로 설명하고, 가능하면 도식을 함께 제공하는 것이 이상적입니다. 또한, 이미 다른 사람이 비슷한 주제의 글을 작성하고 있지는 않은지 먼저 확인하는 것이 좋습니다.

### 번역하기

각 번역은 `webgpu/lessons/<country-code>` 아래의 폴더에 위치해야 합니다.

필수 파일은 다음과 같습니다.

    langinfo.hanson
    index.md
    toc.html

#### `langinfo.hanson`

언어별 설정 옵션을 정의합니다.
[Hanson](https://github.com/timjansen/hanson)은 JSON과 유사한 포맷이지만 주석을 허용합니다.

현재 필드는 다음과 같습니다.

    {
      // The language (will show up in the language selection menu)
      language: 'English',

      // Phrase that appears under examples
      defaultExampleCaption: "click here to open in a separate window",

      // Title that appears on each page
      title: 'WebGPU Fundamentals',

      // Basic description that appears on each page
      description: 'Learn WebGPU',

      // Link to the language root.
      link: 'http://webgpufundamentals.org/webgpu/lessons/ja',  // replace `ja` with country code

      // html that appears after the article and before the comments
      commentSectionHeader: '<div>Questions? <a href="http://stackoverflow.com/questions/tagged/webgpu">Ask on stackoverflow</a>.</div>\n        <div>Issue/Bug? <a href="http://github.com/webgpu/webgpufundamentals/issues">Create an issue on github</a>.</div>',

      // markdown that appears for untranslated articles
      missing: "Sorry this article has not been translated yet. [Translations Welcome](https://github.com/webgpu/webgpufundamentals)! 😄\n\n[Here's the original English article for now]({{{origLink}}}).",

      // the phrase "Table of Contents"
      toc: "Table of Contents",

      // translation of categories
      categoryMapping: {
        'basics': 'Basics',
        'solutions:' 'Solutions',
        'webvr': 'WebVR',
        'optimization': 'Optimization',
        'tips': 'Tips',
        'fundamentals': 'Fundamentals',
        'reference': 'Reference',
      },

    }

#### `index.md`

각 언어의 메인 페이지 템플릿입니다.

#### `toc.html`

해당 언어의 목차 템플릿입니다. 인덱스 페이지와 각 글에 모두 포함됩니다. 자동으로 생성되지 않는 부분은 마지막에 위치한 링크들뿐이며, 이 링크들은 필요에 따라 번역할 수 있습니다.
빌드 시스템은 해당 언어로 번역되지 않은 영문 글마다 자리표시자(placeholder)를 생성하며, 위에서 정의한 `missing` 메시지로 채워집니다.

#### `lang.css`

이 파일은 존재할 때에만 포함됩니다. 가능하면 사용하지 않기를 강력히 권장합니다. 특히 폰트 선택을 둘러싼 논쟁이 일어나지 않기를 바랍니다만, 이 파일은 기본적으로 언어별 폰트를 지정하는 방법입니다. 꼭 필요한 변수만 설정하세요. 예시:

```css
/* lessons/ko/lang.css */

/* Only comment in overrides as absolutely necessary! */
:root {
  --article-font-family: "best font for korean article text";
  --headline-font-family: "best font for korean headlines";
  /* a block of code */
  /* --code-block-font-family: "Lucida Console", Monaco, monospace; */
  /* a word in a sentence */
  /* --code-font-family: monospace; */
}
```

위 예시에서 두 가지 설정은 변경하지 않은 점에 주목하세요. 코드 부분에서는 언어마다 다른 폰트가 필요할 가능성이 낮아 보입니다.

참고로, 저는 개인적으로 리거처(ligature)가 있는 코드 폰트를 매우 좋아하지만, 튜토리얼 사이트에는 적합하지 않다고 생각합니다. 리거처가 실제로 필요한 문자를 가려 버리기 때문입니다. 그러니 이곳에서는 리거처 코드 폰트를 요청하거나 사용하지 말아 주세요.

#### 번역 관련 참고 사항

빌드 과정은 `webgpu/lessons`에 영문 .md 파일이 존재하지만 해당 언어의 .md 파일이 아직 없는 모든 글에 대해 자리표시자 HTML 파일을 생성합니다. 이는 한 글에서 다른 글로 링크를 포함할 수 있도록 하기 위한 것으로, 링크된 글이 아직 번역되지 않았더라도 문제없이 작동하도록 합니다. 덕분에 이미 번역한 글을 나중에 다시 수정할 필요가 없습니다. 한 번에 한 글씩 번역하고, 링크는 그대로 두세요. 해당 링크는 누군가 그 글을 번역하기 전까지는 자리표시자를 가리키게 됩니다.

글 상단에는 다음과 같은 프론트매터(front matter)가 있습니다.

```
Title: Localized Title of article
Description: Localized description of article (used in RSS and social media tags)
TOC: Localized text for Table of Contents
```

**링크는 변경하지 마세요**: 예를 들어 로컬 리소스에 대한 링크는 다음과 같은 형태일 수 있습니다.

    [text](link)

또는

    <img src="somelink">

쿼리 파라미터를 추가하는 것은 가능하지만(아래 참고), `.md` 파일을 기준으로 상대 경로를 만들기 위해 "../"를 추가하지는 마세요. 링크는 글이 원본 영문과 동일한 위치에 있다고 가정한 상태 그대로 유지되어야 합니다.

### 빌드 방법

사이트는 `out` 폴더로 빌드됩니다.

단계는 다음과 같습니다.

    git clone https://github.com/webgpu/webgpufundamentals.git
    npm ci
    npm run build
    npm run serve

이제 브라우저에서 `http://localhost:8080`을 엽니다.

### 연속 빌드

`npm run start`를 실행하면 연속 빌드가 가능합니다.
이 명령을 실행한 시점에 존재하는 글 .md 파일과 일반적으로 복사되는 파일만 지원됩니다.
목차, 템플릿, 인덱스 페이지는 변경을 감지하지 않습니다.

### 개발

`npm link`로 의존성을 업데이트하며 작업하는 경우, `npm run build-ci` 또는 `npm run watch-no-check`를 사용하여 의존성 검사를 건너뛸 수 있습니다.

## WGSL 함수 레퍼런스 빌드

[WGSL 함수 레퍼런스](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html)는 현재 스펙(spec) HTML을 어설프게 스캔해 영문 버전만 자동 생성하고 있습니다. "어설프게"라는 표현 그대로 깨지기 쉽지만, 대부분은 동작하며 어느 정도 유용한 결과물을 제공합니다.

최신 스펙을 다시 스캔하려면 `npm run generate-wgsl-function-reference`를 실행한 뒤, 정상적으로 동작했는지 확인하세요(빌드 후 해당 페이지를 직접 확인). 특히 `vec4<f32>`처럼 꺾쇠 괄호가 올바른 자리에 존재하는지, 그리고 `textureGather`와 같이 `<pre>` 섹션이 포함된 부분이 올바르게 포맷되었는지 확인해야 합니다.

다른 언어의 경우에는 영문 파일을 복사해서 번역해야 할 가능성이 높습니다.
