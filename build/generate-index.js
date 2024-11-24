/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

const fs = require('fs');
const path = require('path');

const shortSize = (function() {
  const suffixes = ['b', 'k', 'mb', 'gb', 'tb', 'pb'];
  return function(size) {
    const suffixNdx = Math.log2(Math.abs(size)) / 10 | 0;
    const suffix = suffixes[Math.min(suffixNdx, suffixes.length - 1)];
    const base = 2 ** (suffixNdx * 10);
    return `${(size / base).toFixed(0)}${suffix}`;
  };
})();

const pad2 = v => v.toString().padStart(2, '0');

// I get this is unsafe as a bad filename will generate bad HTML
// but I don't care because I control the filenames.
module.exports = function generateIndex(folder) {
  const files = fs.readdirSync(folder, { withFileTypes: true });
  const html = `\
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <style>
    :root {
      color-scheme: light dark;
      --cell-border: #ddd;
      --odd-bg-color: rgba(0, 0, 0, 0.05);
      --hover-bg-color: rgba(0, 0, 255, 0.1);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --cell-border: #333;
        --odd-bg-color: rgba(255, 255, 255, 0.05);
        --hover-bg-color: rgba(192, 192, 255, 0.2);
      }
    }

    html {
      box-sizing: border-box;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    html, body {
      font-family: monospace;
    }
    body {
      display: flex;
      justify-content: center;
    }
    a {
      text-decoration: none;
      width: 100%;
      display: block;
    }
    table {
      max-width: 900px;
      border-collapse: collapse;
    }
    td {
      border: 1px solid var(--cell-border);
      padding-left: 0.5em;
      padding-right: 0.5em;
    }
    tbody td:nth-child(2) {
      text-align: right;
      width: 1%;
    }
    tbody td:nth-child(3) {
      text-align: center;
      white-space: pre;
      width: 1%;
    }
    tr:nth-child(even) {
      background-color: var(--odd-bg-color);
    }
    tr:hover {
      background-color: var(--hover-bg-color);
    }

    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr><th>filename</th><th>size</th><th>date</th></tr>
      </thead>
      <tbody>
${files
  .filter(f => f.isFile())
  .map(({name}) => {
    const s = fs.statSync(path.join(folder, name));
    const size = shortSize(s.size);
    // TODO: dates should come from git
    const d = new Date(s.ctimeMs);
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDay() + 1)}`;
    const cells = [name, size, date].map(v => `<td><a href="${name}">${v}</a></td>`);
    return `<tr>${cells.join('')}</tr>`;
  })
  .join('\n')
}
      </tbody>
    </table>
  </body>
</html>
`;
  const filename = path.join(folder, 'index.html');
  console.log('writing:', filename);
  fs.writeFileSync(filename, html);
};
