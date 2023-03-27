export function createElem(tag, attrs = {}, children = []) {
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

const c = (tag, children = [], textContent = '') => {
  return createElem(tag, {textContent}, children);
};

export function makeTable(parent, ...args) {
  const makeRow = arr => c('tr', arr.map(v => c('td', [], v)));

  const tbody = c('tbody');
  parent.appendChild(c('table', [
    c('thead', [makeRow(args)]),
    tbody,
  ]));
  return function(...args) {
    tbody.appendChild(makeRow(args));
  };
}

/*
const addRow = makeTable(parent, 'name', 'location');
addRow('Gregg', 'SF');
addRow('Tami', 'Glendora');
addRow('Mom', 'Temecula');
*/