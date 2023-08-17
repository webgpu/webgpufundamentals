/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

// eslint-disable-next-line strict
'use strict';

const jsdom = require('jsdom');
const {JSDOM} = jsdom;
const refs = require('./external-refs.js');

// make a fake window because jquery sucks
const dom = new JSDOM('');
global.window = dom.window;
global.document = global.window.document;
const jquery = require('jquery');

module.exports = function fixLinks(html) {
  global.document.open('text/html', 'replace');
  global.document.write(html);
  global.document.close();
  const $ = jquery;

  function insertLang(codeKeywordLinks) {
    const lang = document.documentElement.lang.substring(0, 2).toLowerCase();
    const langPart = `developer.mozilla.org/${lang || 'en-US'}/`;
    const langAddedLinks = {};
    for (const [keyword, url] of Object.entries(codeKeywordLinks)) {
      langAddedLinks[keyword] = url.replace('developer.mozilla.org/es-US/', langPart);
    }
    return langAddedLinks;
  }

  const codeKeywordLinks = insertLang(refs);

  // TODO:
  //   Figure out how to check for device.fn, encoder.fn, pass.fn
  function getKeywordLink(keyword) {
    const dotNdx = keyword.indexOf('.');
    if (dotNdx) {
      if (keyword.startsWith('GPU')) {
        return undefined;
      }
      const before = keyword.substring(0, dotNdx);
      const link = codeKeywordLinks[before];
      if (link) {
        return `${link}.${keyword.substr(dotNdx + 1)}`;
      }
    }
    return keyword.startsWith('device.')
      ? codeKeywordLinks[keyword.substring(6)]
      : codeKeywordLinks[keyword];
  }

  $('code').filter(function() {
    return getKeywordLink(this.textContent) &&
           this.parentElement.nodeName !== 'A';
  }).wrap(function() {
    const a = document.createElement('a');
    a.href = getKeywordLink(this.textContent);
    return a;
  });

  const methodPropertyRE = /^(\w+)\.(\w+)$/;
  const classRE = /^(\w+)$/;
  $('a').each(function() {
    const href = this.getAttribute('href');
    if (!href) {
      return;
    }
    const m = methodPropertyRE.exec(href);
    if (m) {
      const codeKeywordLink = getKeywordLink(m[1]);
      if (codeKeywordLink) {
        this.setAttribute('href', `${codeKeywordLink}#${m[2]}`);
      }
    } else if (classRE.test(href)) {
      const codeKeywordLink = getKeywordLink(href);
      if (codeKeywordLink) {
        this.setAttribute('href', codeKeywordLink);
      }
    }
  });

  $('pre>code')
    .unwrap()
    .replaceWith(function() {
      return $(`<pre class="prettyprint showlinemods notranslate ${this.className || ''}" translate="no">${this.innerHTML}</pre>`);
    });

  return dom.serialize();
};
