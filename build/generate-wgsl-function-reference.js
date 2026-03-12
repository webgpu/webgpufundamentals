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
    const table = el('table', {id: `functions-${bf.id}`}, [thead, tbody]);
    outer.appendChild(table);

    const subFunctions = div.querySelectorAll(selector);
    for (const sf of subFunctions) {
      const id = sf.id;

      // For non-builtin tables, we buffer rows until we find the description
      // (description comes after the table in a "Returns:" section)
      let pendingRows = [];
      let pendingDesc = '';
      let collectingDesc = false;
      let pendingFromPre = false;
      // Description collected from P/UL elements before a table or PRE
      let prePendingDesc = '';

      const flushPendingRows = () => {
        if (pendingRows.length) {
          if (pendingFromPre) {
            // PRE-based rows (e.g. atomics): inline description in the single row
            const rowData = pendingRows[0];
            tbody.appendChild(el('tr', {id: `builtin-${id}`}, [
              el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(rowData.overload)})]),
              el('td', {textContent: rowData.params}),
              el('td', {id, innerHTML: pendingDesc}),
            ]));
          } else {
            // TABLE-based rows (e.g. textures): shared description header row before overloads
            const name = sf.querySelector('.content')?.textContent.trim() || '';
            const nameElem = name ? [el('code', { class: 'builtin', 'data-name': name, textContent: name })] : [];
            if (pendingDesc || nameElem.length) {
              tbody.appendChild(el('tr', {id: `builtin-${id}`}, [
                el('td', {className: 'full-description', colSpan: 3, id}, [
                  ...nameElem,
                  el('div', {innerHTML: pendingDesc}),
                ]),
              ]));
            }
            for (const rowData of pendingRows) {
              tbody.appendChild(el('tr', {}, [
                el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(rowData.overload)})]),
                el('td', {textContent: rowData.params}),
                el('td', {}),
              ]));
            }
          }
          pendingRows = [];
          pendingDesc = '';
          collectingDesc = false;
          pendingFromPre = false;
        }
      };

      let curr = sf;
      for (;;) {
        const next = curr.nextElementSibling;
        curr = next;
        if (!next || next.nodeName === 'H3') {
          flushPendingRows();
          break;
        }
        if (next.nodeName === 'H4' || next.nodeName === 'H5') {
          flushPendingRows();
          break;
        }
        if (next.classList.contains('data') && next.nodeName === 'TABLE') {
          if (collectingDesc) {
            // Include parameter description tables (after the algorithm table) in the pending description
            pendingDesc += next.outerHTML;
          } else if (next.classList.contains('builtin')) {
            flushPendingRows();
            prePendingDesc = '';
            // Identify rows by their label cell (cells[0]) instead of hardcoded indices
            let overload = '';
            let params = '';
            let descContent = '';
            let domainContent = '';

            for (const row of next.rows) {
              if (row.cells.length < 2) {
                continue;
              }
              const label = (row.cells[0].textContent || '').trim().toLowerCase();
              const contentCell = row.cells[1];
              switch (label) {
                case 'overload':
                  overload = contentCell.textContent;
                  break;
                case 'parameterization':
                  params = getTextWithBreaks(contentCell);
                  break;
                case 'description':
                  descContent = contentCell.innerHTML;
                  break;
                case 'domain':
                case 'scalar domain':
                  domainContent = contentCell.innerHTML;
                  break;
              }
            }

            if (overload) {
              const desc = descContent + (domainContent ? '\n' + domainContent : '');
              tbody.appendChild(el('tr', {id: `builtin-${id}`}, [
                el('td', {}, [el('pre', {className: 'tableprettyprint lang-wgsl', textContent: stripPrefix(overload)})]),
                el('td', {textContent: params}),
                el('td', {id, innerHTML: desc}),
              ]));
            }
          } else {
            flushPendingRows();
            // Buffer rows - description typically comes after the table
            pendingDesc = prePendingDesc;
            prePendingDesc = '';
            for (const row of next.rows) {
              if (row.classList.contains('algorithm')) {
                const overload = (row.cells[1] || row.cells[0]).textContent;
                const params = getTextWithBreaks(row.cells.length > 1 ? row.cells[0] : null);
                if (overload) {
                  pendingRows.push({overload, params});
                }
              }
            }
            collectingDesc = true;
          }
        } else if (next.nodeName === 'PRE') {
          flushPendingRows();
          const overload = next.textContent;
          // Buffer PRE row - description typically comes in the P after the PRE
          pendingRows.push({overload, params: ''});
          pendingDesc = prePendingDesc;
          prePendingDesc = '';
          collectingDesc = true;
          pendingFromPre = true;
        } else if (next.nodeName === 'P' || next.nodeName === 'UL') {
          if (collectingDesc) {
            // Collecting description after a non-builtin table (includes Parameters: and Returns: sections)
            pendingDesc += next.outerHTML;
          } else {
            // Before any table/PRE: collect as potential description
            prePendingDesc += next.outerHTML;
          }
        }
        // Skip DIV blocks (examples, etc.) and other elements
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

/**
 * Get text content of an element, replacing <br> tags with newlines
 * so that multi-constraint parameterization cells display correctly.
 */
function getTextWithBreaks(elem) {
  if (!elem) {
    return '';
  }
  const clone = elem.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => {
    br.parentNode.replaceChild(document.createTextNode('\n'), br);
  });
  return clone.textContent.trim();
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

function formatSignature(s) {
  const parenIdx = s.indexOf('(');
  if (parenIdx === -1) {
    return s;
  }
  //          111111111122222222223333
  // 123456789012345678901234567890123
  // textureSampleBaseLevelClampToEdge
  const hanging = parenIdx > 35;
  const indent = hanging ? '    ' : ' '.repeat(parenIdx);
  let result = '';
  let angleDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') {
      parenDepth++;
      result += c;
      if (hanging) {
        result += '\n' + indent;
      }
    } else if (c === ')') {
      parenDepth--;
      if (hanging && parenDepth === 0) {
        result += '\n)';
      } else {
        result += c;
      }
    } else if (c === '<') {
      angleDepth++;
      result += c;
    } else if (c === '>') {
      angleDepth--;
      result += c;
    } else if (c === ',' && angleDepth === 0 && parenDepth === 1) {
      result += ',\n' + indent;
    } else {
      result += c;
    }
  }
  return result;
}

function stripPrefix(s) {
  const ss = s
    .replaceAll('@const', '')
    .replaceAll('@must_use', '')
    .replaceAll(/\s+/g, ' ');
  return `{{#escapehtml}}${formatSignature(ss)}{{/escapehtml}}`;
}
