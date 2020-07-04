// Licensed under a BSD license. See license.html for license
'use strict';  // eslint-disable-line

/* global jQuery */

(function($){
function getQueryParams() {
  const params = {};
  if (window.location.search) {
    window.location.search.substring(1).split('&').forEach(function(pair) {
      const keyValue = pair.split('=').map(function(kv) {
        return decodeURIComponent(kv);
      });
      params[keyValue[0]] = keyValue[1];
    });
  }
  return params;
}

$(document).ready(function($){
  const supportedLangs = {
    'en': true,
    'zh': true,
  };

  function insertLang(codeKeywordLinks) {
    const lang = document.documentElement.lang.substr(0, 2).toLowerCase();
    const langPart = `#api/${supportedLangs[lang] ? lang : 'en'}/`;
    const langAddedLinks = {};
    for (const [keyword, url] of Object.entries(codeKeywordLinks)) {
      langAddedLinks[keyword] = url.replace('#api/', langPart);
    }
    return langAddedLinks;
  }

  const codeKeywordLinks = insertLang({
  });

  function getKeywordLink(keyword) {
    const dotNdx = keyword.indexOf('.');
    if (dotNdx) {
      const before = keyword.substring(0, dotNdx);
      const link = codeKeywordLinks[before];
      if (link) {
        return `${link}.${keyword.substr(dotNdx + 1)}`;
      }
    }
    return keyword.startsWith('webgpu.')
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

  const linkImgs = function(bigHref) {
    return function() {
      const a = document.createElement('a');
      a.href = bigHref;
      a.title = this.alt;
      a.className = this.className;
      a.setAttribute('align', this.align);
      this.setAttribute('align', '');
      this.className = '';
      this.style.border = '0px';
      return a;
    };
  };
  const linkSmallImgs = function(ext) {
    return function() {
      const src = this.src;
      return linkImgs(src.substr(0, src.length - 7) + ext);
    };
  };
  const linkBigImgs = function() {
    const src = $(this).attr('big');
    return linkImgs(src);
  };
  $('img[big$=".jpg"]').wrap(linkBigImgs);
  $('img[src$="-sm.jpg"]').wrap(linkSmallImgs('.jpg'));
  $('img[src$="-sm.gif"]').wrap(linkSmallImgs('.gif'));
  $('img[src$="-sm.png"]').wrap(linkSmallImgs('.png'));
  $('pre>code')
    .unwrap()
    .replaceWith(function() {
      return $('<pre class="prettyprint showlinemods">' + this.innerHTML + '</pre>');
    });
  if (window.prettyPrint) {
    window.prettyPrint();
  }

  const params = getQueryParams();
  if (params.doubleSpace || params.doublespace) {
    document.body.className = document.body.className + ' doubleSpace';
  }

  $('.language').on('change', function() {
    window.location.href = this.value;
  });

  if (window.webgpuLessonUtils) {
    window.webgpuLessonUtils.afterPrettify();
  }
});
}(jQuery));

// ios needs this to allow touch events in an iframe
window.addEventListener('touchstart', {});