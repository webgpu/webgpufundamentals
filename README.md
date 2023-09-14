WebGPU Fundamentals
=====================

This is [a series of lessons or tutorials about webgpu](http://webgpufundamentals.org/).

This is work in progress. Feel free to contribute, especially localizations

## Contributing

Of course bug fixes are always welcome.

If you'd like to write a new article please try to always take
one step at a time. Don't do 2 or more things in a single step.
Explain any new math in the simplest terms possible. Ideally
with diagrams where possible. Also it's probably best to
ask to make sure someone else isn't already working on a similar
article.

### Translating

Each translation goes in a folder under `webgpu/lessons/<country-code>`.

Required files are

    langinfo.hanson
    index.md
    toc.html

#### `langinfo.hanson`

Defines various language specific options.
[Hanson](https://github.com/timjansen/hanson) is a JSON like format but allows comments.

Current fields are

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
      commentSectionHeader: '<div>Questions? <a href="http://stackoverflow.com/questions/tagged/webgpu">Ask on stackoverflow</a>.</div>\n        <div>Issue/Bug? <a href="http://github.com/gfxfundamentals/webgpufundamentals/issues">Create an issue on github</a>.</div>',

      // markdown that appears for untranslated articles
      missing: "Sorry this article has not been translated yet. [Translations Welcome](https://github.com/gfxfundamentals/webgpufundamentals)! 😄\n\n[Here's the original English article for now]({{{origLink}}}).",

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

This is the template for the main page for each language

#### `toc.html`

This is template for the table of contents for the language.
It is included on both the index and on each article. The only
parts not auto-generated are the ending links which
you can translate if you want to.
The build system will create a placeholder for every English article for which there is no corresponding article in that language. 
It will be filled with the `missing` message from above.

#### Translation notes

The build process will make a placeholder html file for each article has an english .md file in
`webgpu/lessons` but no corresponding .md file for the language. This is to make it easy to include
links in one article that links to another article but that other article has not yet been translated.
This way you don't have to go back and fix already translated articles. Just translate one article
at a time and leave the links as is. They'll link to placeholders until someone translates the missing
articles.

Articles have front matter at the top

```
Title: Localized Title of article
Description: Localized description of article (used in RSS and social media tags)
TOC: Localized text for Table of Contents
```

**DO NOT CHANGE LINKS** : For example a link to a local resources might look like

    [text](link)

or

    <img src="somelink">

While you can add query parameters (see below) do not add "../" to try to make the link relative to the
.md file. Links should stay as though the article exists at the same location as the original English.

### To build

The site is built into the `out` folder

Steps

    git clone https://github.com/gfxfundamentals/webgpufundamentals.git
    npm ci
    npm run build
    npm start

now open your browser to `http://localhost:8080`

### Continuous build

You can run `npm run watch` to get continuous building.
Only the article .md files and files that are normally copied are supported.
The table of contents, templates, and index pages are not watched.

### Development

If you are working on updating dependencies with `npm link` you can use
`npm run build-ci` and/or `npm run watch-no-check` to skip the dependency check.

## Building the WGSL Function Reference

The [WGSL function reference](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html)
is currently auto-generated for English by hackily scanning the spec HTML.
Hackily means it's likely to break but it mostly works or at least seem to
provide something kind of useful, for now.

To scan the latest spec again use `npm run generate-wgsl-function-reference` then check that it
worked (build and look at the page). Of particular note, check that angle brackets like
`vec4<f32>` exist where where they should and also check that `<pre>` sections like in
`textureGather` are correctly formatted.

For other languages you'll likely need to copy the English file and translate.

