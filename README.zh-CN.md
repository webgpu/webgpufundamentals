# WebGPU 基础原理

<!-- 基于2026年1月10日 -->
<!-- 64c1b61313d375343b9e4e3f587afd2881cc877d -->

这是[一系列关于 WebGPU 的课程或教程](https://webgpufundamentals.org/webgpu/lessons/zh_cn/)。

这项工作仍在进行中。欢迎贡献，特别是本地化翻译。

## 贡献指南

当然，错误修复总是受欢迎的。

如果你想撰写一篇新文章，请尽量确保每次只讲解一个步骤。避免在单个步骤中同时介绍两件或更多的事情。尽可能用最简单的术语解释任何新的数学概念，理想情况下最好配有图示。另外，最好先确认一下是否已经有其他人在撰写类似主题的文章，这样可以避免重复工作。

### 翻译

每份翻译文件应放置在`webgpu/lessons/<country-code>`目录下的对应文件夹中。

必需的文件包括：

    langinfo.hanson
    index.md
    toc.html

#### `langinfo.hanson`

定义各种特定于语言的选项。

[Hanson](https://github.com/timjansen/hanson) 是一种类似 JSON 的格式，但允许注释。

当前字段包括：

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

这是每种语言主页的模板。

#### `toc.html`

这是该语言目录的模板。它同时包含在首页和每篇文章中。唯一非自动生成的部分是结尾的链接，你可以根据需要翻译这些链接。构建系统会为每一种没有对应语言文章的英文文章创建一个占位符。该占位符将使用上方的`missing`消息来填充。

#### `lang.css`

当且仅当该文件存在时，它才会被包含进来。我强烈希望不必使用它。具体来说，我不希望人们就字体问题展开争论，但基本上，这是一种按语言选择字体的方式。你只应设置那些绝对需要的变量。例如：

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

请注意，有两项设置未被更改。在我看来，代码部分不太可能需要针对不同语言使用不同的字体。

PS：顺便提一下，我个人很喜欢带有连字的代码字体，但对于教程网站来说，这可能不是一个好主意，因为连字效果会隐藏实际需要的字符。所以，请不要在这里要求或使用带有连字的代码字体。

#### 翻译说明

构建过程会为每一篇在`webgpu/lessons`目录下有英文 .md 文件，但尚未有对应语言 .md 文件的文章创建一个占位符 HTML 文件。这样做是为了便于在一篇文章中包含指向另一篇文章的链接，即使那篇文章尚未翻译。这样，你就不必回头去修改已经翻译好的文章。一次只需翻译一篇文章，并保持链接不变。这些链接会指向占位符，直到缺失的文章被翻译完成。

文章顶部包含前言元数据。

```
Title: Localized Title of article
Description: Localized description of article (used in RSS and social media tags)
TOC: Localized text for Table of Contents
```

**请勿更改链接**：例如，指向本地资源的链接可能看起来像这样：

    [text](link)

或者

    <img src="somelink">

虽然你可以添加查询参数（见下文），但不要试图通过添加 "../" 来使链接相对于 .md 文件。链接应保持原样，就像文章与原始英文版本位于同一位置一样。

### 构建

网站构建输出到`out`文件夹。

步骤：

    git clone https://github.com/webgpu/webgpufundamentals.git
    npm ci
    npm run build
    npm run serve

现在在浏览器中打开`http://localhost:8080`。

### 持续构建

你可以运行`npm run start`来启用持续构建功能。该命令仅支持在运行时已存在的文章 .md 文件以及通常会被复制的文件。目录、模板和索引页面不会被监听变化。

### 开发

如果你正在使用`npm link`更新依赖项，可以使用`npm run build-ci`或者`npm run watch-no-check`来跳过依赖项检查。

## 构建 WGSL 函数参考

[WGSL function reference](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html)目前是通过对规范 HTML 进行粗略扫描而自动生成的英文版本。"粗略"意味着它很可能出错，但目前它大体上还能工作，或者至少能提供一些还算有用的内容。

要重新扫描最新规范，请使用`npm run generate-wgsl-function-reference`命令，然后检查它是否正常工作（构建并查看页面）。需要特别注意的是，检查像`vec4<f32>`这样的尖括号是否出现在它们应该出现的位置，同时也要检查`textureGather`等函数中的`<pre>`代码块部分是否格式正确。

对于其他语言，你可能需要复制英文文件并进行翻译。
