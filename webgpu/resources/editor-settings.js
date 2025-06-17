(function() {  // eslint-disable-line strict
'use strict';  // eslint-disable-line strict

function dirname(path) {
  const ndx = path.lastIndexOf('/');
  return path.substring(0, ndx + 1);
}

function getPrefix(url) {
  const u = new URL(url, window.location.href);
  const prefix = u.origin + dirname(u.pathname);
  return prefix;
}

function getRootPrefix(url) {
  const u = new URL(url, window.location.href);
  return u.origin;
}

const lessonHelperScriptRE = /<script type="module" src="[^"]+lessons-helper\.js"><\/script>/;

function fixHTMLForCodeSite(html) {
  html = html.replace(lessonHelperScriptRE, '');
  return html;
}

function removeDotDotSlash(url) {
  // assumes a well formed URL. In other words: 'https://..//foo.html" is a bad URL and this code would fail.
  const parts = url.split('/');
  for (;;) {
    const dotDotNdx = parts.indexOf('..');
    if (dotDotNdx < 0) {
      break;
    }
    parts.splice(dotDotNdx - 1, 2);
  }
  const newUrl = parts.join('/');
  return newUrl;
}

async function getText(url) {
  const req = await fetch(url);
  return await req.text();
}

async function initEditor() {
  /* global monaco */
  if (typeof monaco !== 'undefined') {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
      moduleDetection: 3,
    });
    // inject the WebGPU types
    const basePath = '/types/webgpu/dist/index.d.ts';
    const originalText = await getText(basePath);
    // Because of moduleDetection: 3 above, we need to force these types to be global. 🤷‍♂️
    const wrappedText = `declare global { ${originalText} }`;
    monaco.languages.typescript.javascriptDefaults.addExtraLib(wrappedText, '');
  }


}

/**
 * Fix any local URLs into fully qualified urls.
 *
 * Examples:
 *    resources/image.jpg ->  https://domain.org/webgpu/resouces/image.jpg
 *    /3rdparty/lib.js    ->  https://domain.org/3rdparty/lib.js
 *
 * The reason is (a) we're running the code as via blobUrl and nothing is relative to a blob.
 * (b) we can upload to jsfiddle/codepen and so need to link back to the files.
 *
 * This is all kind of hacky in that it's just a bunch of regular expressions looking
 * for matches.
 *
 * @param {string} url The URL of the file source.
 * @param {string} source An HTML file or JavaScript file
 * @returns {string} the source after having urls fixed.
 */
function fixSourceLinks(url, source) {
  const srcRE = /(src=)(")(.*?)(")/g;
  const linkRE = /(href=)(")(.*?)(")/g;
  const imageSrcRE = /((?:image|img)\.src = )(")(.*?)(")/g;
  const loadImageRE = /(loadImageAndCreateTextureInfo)\(('|")(.*?)('|")/g;
  const loadImagesRE = /loadImages(\s*)\((\s*)\[([^]*?)\](\s*),/g;
  const loadGLTFRE = /(loadGLTF\(')(.*?)(')/g;
  const webgpufundamentalsUrlRE = /(.*?)('|")([^"']*?)('|")([^'"]*?)(\/\*\s+webgpufundamentals:\s+url\s+\*\/)/ig;
  const urlPropRE = /(url:\s*)('|")(.*?)('|")/g;
  const quoteRE = /"(.*?)"/g;
  const workerRE = /(new\s+Worker\s*\(\s*)('|")(.*?)('|")/g;
  const importScriptsRE = /(importScripts\s*\(\s*)('|")(.*?)('|")/g;
  // import 'url'
  // import foo from 'url'
  // import * as foo from 'url'
  // import {a} from 'url'
  // import {a,b,..} from 'url'
  // import a, {b,b} from 'url'
  const moduleRE = /(import.*?)('|")(.*?)('|")/g;
  const moduleRE2 = /(import\s+{[^}]*?}\s+from\s+)('|")(.*?)('|")/g;
  const prefix = getPrefix(url);
  const rootPrefix = getRootPrefix(url);

  function addCorrectPrefix(url) {
    return (url.startsWith('/'))
       ? `${rootPrefix}${url}`
       : removeDotDotSlash((prefix + url).replace(/\/.\//g, '/'));
  }

  function addPrefix(url) {
    return url.indexOf('://') < 0 && !url.startsWith('data:') && url[0] !== '?'
        ? removeDotDotSlash(addCorrectPrefix(url))
        : url;
  }
  function makeLinkFQedQuote(match, p1, url, p2) {
    return `${p1}${addPrefix(url)}${p2}`;
  }
  function makeLinkFDedQuotes(match, fn, q1, url, q2) {
    return fn + q1 + addPrefix(url) + q2;
  }
  function makeTaggedFDedQuotes(match, start, q1, url, q2, suffix) {
    return start + q1 + addPrefix(url) + q2 + suffix;
  }
  function makeFDedQuotes(match, start, q1, url, q2) {
    return start + q1 + addPrefix(url) + q2;
  }
  function makeLinkFDedQuotesModule(match, start, q1, url, q2) {
    // modules require relative paths or fully qualified, otherwise they are module names
    return `${start}${q1}${url.startsWith('.') ? addPrefix(url) : url}${q2}`;
  }
  source = source.replace(srcRE, makeLinkFDedQuotes);
  source = source.replace(linkRE, makeLinkFDedQuotes);
  source = source.replace(imageSrcRE, makeLinkFDedQuotes);
  source = source.replace(urlPropRE, makeLinkFDedQuotes);
  source = source.replace(workerRE, makeLinkFDedQuotes);
  source = source.replace(importScriptsRE, makeLinkFDedQuotesModule);
  source = source.replace(loadImageRE, function(match, fn, q1, url, q2) {
    return fn + '(' + q1 + addPrefix(url) + q2;
  });
  source = source.replace(loadImagesRE, function(match, p1, p2, p3, p4) {
      p3 = p3.replace(quoteRE, function(match, p1) {
          return '"' + addPrefix(p1) + '"';
      });
      return `loadImages${p1}(${p2}[${p3}]${p4},`;
  });
  source = source.replace(loadGLTFRE, makeLinkFQedQuote);
  source = source.replace(webgpufundamentalsUrlRE, makeTaggedFDedQuotes);
  source = source.replace(moduleRE, makeFDedQuotes);
  source = source.replace(moduleRE2, makeFDedQuotes);
  return source;
}

/**
 * Called after parsing to give a change to update htmlParts
 * @param {string} html The main page html turned into a template with the <style>, <script> and <body> parts extracted
 * @param {Object<string, HTMLPart>} htmlParts All the extracted parts
 * @return {string} The modified html template
 */
function extraHTMLParsing(html, htmlParts) {
  const hasCanvasInCSSRE = /canvas/;
  const hasCanvasStyleInHTMLRE = /<canvas[^>]+?style[^>]+?>/;

  // add css if there is none
  if (!hasCanvasInCSSRE.test(htmlParts.css.sources[0].source) && !hasCanvasStyleInHTMLRE.test(htmlParts.html.sources[0].source)) {
    htmlParts.css.sources[0].source = htmlParts.css.sources[0].source;
  }

  return html;
}

/**
 * Change JavaScript before uploading code to JSFiddle/Codepen
 *
 * @param {string} js JavaScript source
 * @returns {string} The JavaScript source with any fixes applied.
 */
function fixJSForCodeSite(js) {
  if (/requestCORS/.test(js)) {
    return js;
  }

  let found = false;
  js = js.replace(/^( +)(img|image|video)(\.src = )(.*?);.*?$/mg, function(match, indent, variable, code, url) {
    found = true;
    return `${indent}requestCORSIfNotSameOrigin(${variable}, ${url})
${indent}${variable}${code}${url};`;
  });
  if (found) {
    js += `

// This is needed if the images are not on the same domain
// NOTE: The server providing the images must give CORS permissions
// in order to be able to use the image with WebGPU. Most sites
// do NOT give permission.
// See: https://webgpufundamentals.org/webgpu/lessons/webgpu-cors-permission.html
function requestCORSIfNotSameOrigin(img, url) {
  if ((new URL(url, window.location.href)).origin !== window.location.origin) {
    img.crossOrigin = "";
  }
}
`;
  }
  return js;
}

function prepHTML(source, prefix) {
  source = source.replace('<head>', `<head>
  <link rel="stylesheet" href="${prefix}/resources/lesson-helper.css" type="text/css">
  <script match="false">self.lessonSettings = ${JSON.stringify(lessonSettings)}</script>`);

  source = source.replace('</head>', `<script type="module" src="${prefix}/resources/lessons-helper.js"></script>
  </head>`);
  return source;
}

function getWorkerPreamble(scriptInfo) {
  return `self.lessonSettings = ${JSON.stringify(lessonSettings)};
import '${dirname(scriptInfo.fqURL)}/resources/lessons-worker-helper.js';`;
}

const lessonSettings = {
  webgpuDebug: true,
};

window.lessonEditorSettings = {
  extraHTMLParsing,
  fixSourceLinks,
  fixJSForCodeSite,
  fixHTMLForCodeSite,
  runOnResize: true,
  lessonSettings,
  prepHTML,
  getWorkerPreamble,
  initEditor,
  tags: ['webgpu', 'webgpufundamentals.org'],
  name: 'WebGPUFundamentals',
  icon: '/webgpu/lessons/resources/webgpufundamentals-icon-256.png',
};

}());