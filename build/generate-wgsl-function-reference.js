/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

// eslint-disable-next-line strict
'use strict';

const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const {JSDOM} = jsdom;

const dom = new JSDOM('');
global.window = dom.window;
global.document = global.window.document;

class DOMParser {
  parseFromString(s, contentType = 'text/html') {
    return new JSDOM(s, {contentType}).window.document;
  }
}

let fetch = function() {
  // we'll replace this later, below.
  debugger;  // eslint-disable-line no-debugger
};

// Yes, this is super hacky. The correct way is probably to run
// bikeshed but I didn't want to add dependencies or deal with
// python and other tool chains
//
// Note: To see what will really be parse turn off JavaScript
// in your browser and then go to to https://www.w3.org/TR/WGSL/

const baseURL = 'https://www.w3.org/TR/WGSL/';

(async() => {
  const fetchModule = await import('node-fetch');
  fetch = fetchModule.default;

  const res = await fetch(baseURL);
  const text = await res.text();
  const bodyWithScripts = /<body[^>]*?>([\s\S]*?)$/.exec(text)[1];
  const body = bodyWithScripts.replaceAll(/<script/g, '<gscript').replaceAll(/script>/g, 'gscript>');
  const div = document.createElement('div');
  div.innerHTML = body;

  const data = [];
  function getLevel(levels) {
    let currentLevel = data;
    for (const level of levels) {
      const nextLevel = currentLevel[level] || [];
      currentLevel[level] = nextLevel;
      currentLevel = nextLevel;
    }
    return currentLevel;
  }

  div.querySelectorAll('[id$=-builtin]').forEach(f => {
    const level = f.dataset.level;
    if (level) {
      const levels = level.split('.').map(v => parseInt(v));
      getLevel(levels).push(f);
    }
  });


  const outer = el('div');
  //document.body.appendChild(outer);

  div.querySelectorAll('[id$=-builtin-functions]').forEach(bf => {
    const desc = bf.querySelector('.content').textContent;
    const selector = `[data-level^="${bf.dataset.level}."]`;

    outer.appendChild(
      el('h2', {id: bf.id, textContent: desc}),
    );

    const thead = el('thead', {}, [
      el('th', {textContent: 'Function'}),
      el('th', {textContent: 'Parameter Types'}),
      el('th', {textContent: 'Description'}),
    ]);
    const tbody = el('tbody');
    const table = el('table', {}, [thead, tbody]);
    outer.appendChild(table);

    const subFunctions = div.querySelectorAll(selector);
    for (const sf of subFunctions) {
      // const desc = sf.querySelector('.content').textContent;
      const id = sf.id;
      //const link = id ? [el('a', {href: `${baseURL}#${id}`})] : [];
      let collect = false;
      const collectedHTML = [];

      const insertCollectedHTML = () => {
        if (collectedHTML.length) {
          const innerHTML = collectedHTML.map(e => e.outerHTML).join('\n');
          tbody.appendChild(el('tr', {}, [
            fixPre(el('td', {colSpan: 3, innerHTML})),
          ]));
          collectedHTML.length = 0;
        }
        collect = false;
      };

      let curr = sf;
      for (;;) {
        const next = curr.nextElementSibling;
        curr = next;
        if (!next || next.nodeName === 'H3') {
          break;
        }
        if (next.nodeName === 'P' && next.textContent.trim() === 'Returns:') {
          collect = true;
        }
        if (!collect && (next.nodeName === 'P' ||
                         next.nodeName === 'UL')) {
          continue;
        }
        if (next.nodeName === 'H4') {
          insertCollectedHTML();
          break;
        }
        if (next.classList.contains('data') &&
            next.nodeName === 'TABLE') {
          insertCollectedHTML();
          const table = next;
          if (next.classList.contains('builtin')) {
            const overload = table.rows[0].cells[1].textContent;
            const desc = table.rows[table.rows.length - 1].cells[1].innerHTML;
            const params = table.rows.length > 2
              ? table.rows[1].cells[1].textContent
              : '';
            tbody.appendChild(el('tr', {}, [
              el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(overload)})]),
              el('td', {textContent: params}),
              el('td', {id, innerHTML: desc}),
            ]));
          } else {
            for (const row of table.rows) {
              if (row.classList.contains('algorithm')) {
                const overload = row.cells[1].textContent;
                const params = row.cells[0].textContent;
                const desc = '';
                tbody.appendChild(el('tr', {}, [
                  el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(overload)})]),
                  el('td', {textContent: params}),
                  el('td', {id, innerHTML: desc}),
                ]));
              }
            }
          }
        } else if (next.nodeName === 'PRE') {
          const overload = next.textContent;
          const params = '';
          const desc = '';
          tbody.appendChild(el('tr', {}, [
            el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(overload)})]),
            el('td', {textContent: params}),
            el('td', {id, innerHTML: desc}),
          ]));
        } else {
          if (collect) {
            collectedHTML.push(next);
          } else {
            insertCollectedHTML();
            break;
          }
        }
      }
    }

    fixLinks(tbody);

  });

  {
    const html = outer.outerHTML;
    // extract the <pre> tags so we can remove \n\s*\n
    const preIdToContentMap = new Map();
    const noPreHTML = html.replace(/<pre(.*?)>([\s\S]*?)<\/pre>/g, function(m, g1, g2) {
      const id = `__pre_id_${preIdToContentMap.size}__`;
      preIdToContentMap.set(id, [g1, g2]);
      return id;
    });
    const noEmptyLinesHTML = noPreHTML.replace(/\n\s*\n/g, '\n');
    // restore the pre but convert html entities to normal text
    // since we are escaping them with {{#escapehtml}}
    const fixed = noEmptyLinesHTML.replace(/__pre_id_\d+__/g, function(id) {
      const [g1, g2] = preIdToContentMap.get(id);
      return `<pre${g1}>${htmlDecode(g2)}</pre>`;
    });

    const outPath = path.join(__dirname, '..', 'webgpu', 'lessons', 'webgpu-wgsl-function-reference.inc.html');
    fs.writeFileSync(outPath, fixed);
    console.log('wrote:', outPath);
  }

})();

const isTextNode = n => n && n.nodeType === 3;

function htmlDecode(s) {
  const d = new DOMParser().parseFromString(s, 'text/html');
  return d.documentElement.textContent;
}

function fixPre(elem) {
  elem.querySelectorAll('pre').forEach(pre => {
    pre.textContent = pre.textContent;
    if (pre.classList.contains('highlight')) {
      pre.classList.add('prettyprint');
      pre.textContent = `{{#escapehtml}}${pre.textContent}{{/escapehtml}}`;
    }
  });
  return elem;
}

function fixLinks(elem) {
  const links = [...elem.querySelectorAll('a')];
  for (const link of links) {
    // let's assume there are not 2 spans in the origin;
    const next = link.nextSibling;
    const prev = link.previousSibling;
    if (isTextNode(prev)) {
      if (isTextNode(next)) {
        prev.textContent = prev.textContent + link.textContent + next.textContent;
        next.remove();
      } else {
        prev.textContent = prev.textContent + link.textContent;
      }
    } else if (isTextNode(next)) {
      next.textContent = link.textContent + next.textContent;
    } else {
      const node = document.createTextNode(link.textContent);
      link.parentNode.insertBefore(node, link);
    }
    link.remove();
  }
  elem.querySelectorAll('td[id]').forEach(td => {
    td.insertBefore(
      el('a', {
        href: `${baseURL}#${td.id}`,
        target: '_blank',
      }),
      td.firstChild);
  });
}

function el(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function' && key.startsWith('on')) {
      const eventName = key.substring(2).toLowerCase();
      elem.addEventListener(eventName, value, {passive: false});
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        elem[key][k] = v;
      }
    } else if (elem[key] === undefined) {
      elem.setAttribute(key, value);
    } else {
      elem[key] = value;
    }
  }
  for (const child of children) {
    elem.appendChild(child);
  }
  return elem;
}

function stripPrefix(s) {
  const ss = s
    .replaceAll('@const', '')
    .replaceAll('@must_use', '')
    .replaceAll(/\s+/g, ' ');
  return `{{#escapehtml}}${ss}{{/escapehtml}}`;
}