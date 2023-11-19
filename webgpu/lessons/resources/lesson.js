/* global Diff Diff2HtmlUI */
import '/webgpu/lessons/resources/data-tables.js';
import entities from '/3rdparty/entities.js';

{
  const decEntityRE = /&#(\d+);/;
  const hexEntityRE = /&#x([a-z0-9]+);/;
  function decodeNumericEntity(s) {
    // &#8212; or &#x2014;
    {
      const m = decEntityRE.exec(s);
      if (m) {
        return String.fromCodePoint(parseInt(m[1]));
      }
    }
    {
      const m = hexEntityRE.exec(s);
      if (m) {
        return String.fromCodePoint(parseInt(m[1], 16));
      }
    }
    return s;
  }

  function decodeEntity(s) {
    return entities[s] || decodeNumericEntity(s);
  }

  const unescapeHTMLRE = /&\w+;/g;
  function unescapeHTML(escapedHTML) {
    return escapedHTML.replace(unescapeHTMLRE, (m) => decodeEntity(m));
  }

  function applyDiff(elem) {
    const parts = [...elem.querySelectorAll('pre')].map(elem =>
      unescapeHTML(elem/*.querySelector('code')*/.textContent));
    //parts.forEach((part, i) => {
    //  console.log(i, part);
    //});
    const diff = Diff.createPatch('unnamed', parts[0], parts[1], '', '');
    const div = document.createElement('div');

    Object.assign(div.style, {
    'width': '100%',
    'margin': '0 0 0 0',
    'max-width': '100%',
    'line-height': '1.3',
    });

    elem.parentElement.appendChild(div);
    const diffUI = new Diff2HtmlUI(div, diff, {
        drawFileList: false,
        fileListToggle: false,
        fileListStartVisible: false,
        fileContentToggle: false,
      colorScheme: 'auto',
      outputFormat: 'side-by-side',
    });
    diffUI.draw();
  }

  document.querySelectorAll('[data-diff]').forEach(applyDiff);

}

// Licensed under a BSD license. See license.html for license
/* eslint-disable strict */
/* global settings, contributors, jQuery */
(function($){

function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

//
function replaceParams(str, subs) {
  return str.replace(/\${(\w+)}/g, function(m, key) {
    return subs[key];
  });
}

function showContributors() {
  // contribTemplate: 'Thank you
  // <a href="${html_url}">
  // <img src="${avatar_url}">${login}<a/>
  //  for <a href="https://github.com/${owner}/${repo}/commits?author=${login}">${contributions} contributions</a>',
  try {
    const subs = {...settings, ...contributors[Math.random() * contributors.length | 0]};
    const template = settings.contribTemplate;
    const html = replaceParams(template, subs);
    const parent = document.querySelector('#forkongithub>div');
    const div = document.createElement('div');
    div.className = 'contributors';
    div.innerHTML = html;
    parent.appendChild(div);
  } catch (e) {
    console.error(e);
  }
}
showContributors();

$(document).ready(function($) {
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
      return $('<pre class="prettyprint showlinemods notranslate" translate="no">' + this.innerHTML + '</pre>');
    });
  if (window.prettyPrint) {
    window.prettyPrint();
    // Firefox doesn't support the has() css selector as of 2023-09-09
    try {
      document.querySelectorAll('pre:has(.linedeleted)').forEach(e => {
        const b = $('<button>').text('hide deleted').addClass('linedeleted-button').attr('type', 'button').on('click', () => {
          const hide = e.classList.toggle('hide-linedeleted');
          b.text(hide ? 'show deleted' : 'hide deleted');
        });
        $(e).append(b);
      });
    } catch (e) {
      console.error(e);
    }
  }
  $('span[class=com]')
    .addClass('translate yestranslate')
    .attr('translate', 'yes');

  const params = getQueryParams();
  if (params.doubleSpace || params.doublespace) {
    document.body.className = document.body.className + ' doubleSpace';
  }

  $('.language').on('change', function() {
    window.location.href = this.value;
  });

  $('a[data-href]').on('click', function() {
    window.location.href = this.dataset.href;
  });

  $('[data-table]').html();
});
}(jQuery));

// ios needs this to allow touch events in an iframe
window.addEventListener('touchstart', {});
