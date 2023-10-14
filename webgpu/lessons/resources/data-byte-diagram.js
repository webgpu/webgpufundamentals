import {
  makeStructuredView,
} from '/3rdparty/webgpu-utils.module.js';
import typeInfo from './wgsl-data-types.js';
import {
  createElem as el,
} from './elem.js';
import {
  classNames,
} from './classnames.js';


function align(v, align) {
  return Math.ceil(v / align) * align;
}
const roundUpToMultipleOf = align;

function assert(cond, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}

const lch = (l, c, h) => `lch(${l * 100} ${c * 250 - 125} ${h * 360})`;
const px = v => `${v}px`;

const kGridSize = window.innerWidth < 400
  ? 16
  : window.innerWidth < 500
    ? 20
    : 30;

class GridBuilder {
  currentHeading;
  currentRow;
  currentCol = 0;
  numAdditions = 0;
  colorNdx = 0;
  byteOffset = 0;

  constructor(numColumns) {
    this.numColumns = numColumns;
    this.tbodyElem = el('tbody');
    this.tableElem = el('table', {}, [this.tbodyElem]);
  }

  getColor() {
    return this.colorNdx;
  }

  addPadding(num) {
    assert(num >= 0);
    while (num) {
      this._prepRow();
      const paddingAvailableForRow = this.numColumns - this.currentCol;
      const paddingToAdd = Math.min(num, paddingAvailableForRow);
      this._addPaddingToRow(paddingToAdd);
      num -= paddingToAdd;
      assert(num >= 0);
    }
  }

  _addPaddingToRow(num) {
    if (num === 0) {
      return;
    }
    this.byteOffset += num;
    this.currentHeading.appendChild(el('td', {colSpan: num, textContent: '-pad-'}));
    for (let i = 0; i < num; ++i) {
      this.currentRow.appendChild(el('td', {
        style: {
          width: px(kGridSize),
          height: px(kGridSize),
        },
      }));
    }
    this.currentCol += num;
    assert(this.currentCol <= this.numColumns);
    if (this.currentCol === this.numColumns) {
      this.currentRow = undefined;
      this.currentHeading = undefined;
      this.currentCol = 0;
    }
  }

  addElements(name, type, color) {
    const info = typeInfo[type];
    const {
      size,
      align: alignment,
    } = info;
    let numElements = info.numElements;
    const elementSize = size / numElements;
    const [units, pad] = info.pad || [numElements, 0];

    const localColor = getColor(this, color);
    const hue = localColor  * 0.47 * 0.5 % 1;
    if (localColor === this.colorNdx) {
      this.colorNdx++;
    }

    const headBackgroundColor = lch(...colorScheme.headBgLC, hue);
    const memBackgroundColor = lch(...colorScheme.memBgLC, hue);

    const elementsPerUnit = units + pad;

    const aligned = align(this.currentCol, alignment);
    this.addPadding(aligned - this.currentCol);
    while (numElements > 0) {
      this._prepRow();
      const slotsAvailableInRow = this.numColumns - this.currentCol;
      assert(slotsAvailableInRow >= 0);

      const elementsAvailableInRow = Math.floor(slotsAvailableInRow / elementSize);
      assert(elementsAvailableInRow >= 0);
      const elementsInRow = Math.min(numElements, elementsAvailableInRow);
      assert(elementsInRow > 0);
      numElements -= elementsInRow;

      const bytesInRow = elementsInRow * elementSize;
      this.currentHeading.appendChild(el('td', {
          colSpan: bytesInRow,
          style: {
            backgroundColor: headBackgroundColor,
          },
        }, [
          el('div', {className: 'name', textContent: name, style: { width: px(bytesInRow * kGridSize)}}),
      ]));
      for (let e = 0; e < elementsInRow; ++e) {
        const u = e % elementsPerUnit;
        const backgroundColor = u < units ? memBackgroundColor : colorScheme.unusedCellBg;
        for (let i = 0; i < elementSize; ++i) {
          const innerClass = {};
          if (u < units) {
            innerClass[`${info.type}-${i}`] = true;
          }
          ++this.byteOffset;
          this.currentRow.appendChild(el('td', {
            className: classNames('byte', {
              'elem-start': i === 0,
              'elem-end': i === elementSize - 1,
              ...innerClass,
            }),
            style: {
              width: px(kGridSize),
              height: px(kGridSize),
              backgroundColor,
            },
          }));
        }
      }
      this.currentCol += elementsInRow * elementSize;
    }
  }

  _prepRow() {
    if (!this.currentRow || this.currentCol === this.numColumns) {
      this.currentHeading = el('tr', { className: 'field-names'}, [el('td', {textContent: this.tbodyElem.children.length ? '' : 'offset'})]);
      this.currentRow = el('tr', {}, [el('td', {class: 'offset', textContent: this.tbodyElem.children.length / 2 * 16})]);
      this.tbodyElem.appendChild(this.currentHeading);
      this.tbodyElem.appendChild(this.currentRow);
      this.currentCol = 0;
    }
  }
}

const darkColors = {
  headBgLC: [0.2, 0.8],
  memBgLC: [0.4, 0.7],
  unusedCellBg: '#333',
};
const lightColors = {
  headBgLC: [1, 0.8],
  memBgLC: [0.7, 0.7],
  unusedCellBg: '#CCC',
};
const darkMatcher = window.matchMedia('(prefers-color-scheme: dark)');
const isDarkMode = darkMatcher.matches;
const colorScheme = isDarkMode ? darkColors : lightColors;

function getColor(grid, color) {
  return color === undefined ? grid.getColor() : color;
}

function isIntrinsic(typeDef/*: TypeDefinition*/) {
    return !(typeDef/* as StructDefinition*/).fields &&
           !(typeDef/* as ArrayDefinition*/).elementType;
}

function getSizeOfTypeDef(typeDef/*: TypeDefinition*/)/*: number*/ {
  const asArrayDef = typeDef/* as ArrayDefinition*/;
  const elementType = asArrayDef.elementType;
  if (elementType) {
    if (isIntrinsic(elementType)) {
        const asIntrinsicDef = elementType/* as IntrinsicDefinition*/;
        const { align } = typeInfo[asIntrinsicDef.type];
        return roundUpToMultipleOf(elementType.size, align) * asArrayDef.numElements;
    } else {
        return asArrayDef.numElements * getSizeOfTypeDef(elementType);
    }
  } else {
    const asStructDef = typeDef/* as StructDefinition*/;
    const numElements = asArrayDef.numElements || 1;
    if (asStructDef.fields) {
        return typeDef.size * numElements;
    } else {
        const asIntrinsicDef = typeDef/* as IntrinsicDefinition*/;
        const { align } = typeInfo[asIntrinsicDef.type];
        return numElements > 1
           ? roundUpToMultipleOf(typeDef.size, align) * numElements
           : typeDef.size;
    }
  }
}


function addGridType(grid, typeDef, baseOffset, name, color) {
  grid.addPadding(baseOffset - grid.byteOffset);

  if (typeDef.fields) {
    for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
      addGridType(grid, fieldDef.type, baseOffset + fieldDef.offset, `${name}.${fieldName}`);
    }
  } else if (typeDef.elementType) {
    const { elementType } = typeDef;
    const elemColor = getColor(grid, color);
    const elementSize = typeDef.size / typeDef.numElements;
    for (let i = 0; i < typeDef.numElements; ++i) {
      addGridType(grid, elementType, baseOffset + i * elementSize, `${name}[${i}]`, elemColor);
    }
  //} else if (typeDef.numElements) {
  //  const elemColor = getColor(grid, color);
  //  const t = {...typeDef};
  //  delete t.numElements;
  //  delete t.size;
  //  delete t.offset;
  //  // Not sure this is the correct place for this.
  //  // This is an array of base types (array<baseType>)
  //  // addGridType adds base types and assumes baseType alignment rules
  //  // but array<> has different rules
  //  for (let i = 0; i < typeDef.numElements; ++i) {
  //    addGridType(grid, t, `${name}[${i}]`, elemColor);
  //  }
  } else {
    // name, numElements, elementSize, alignment
    grid.addElements(name, typeDef.type, color);
  }

  //if (startOffset !== undefined) {
  //  grid.addPadding(getSizeOfTypeDef(typeDef) - (grid.byteOffset - startOffset));
  //}
}

const kNumBytesPerRow = 16;

function addTypeToGrid(name, typeDef) {
  const grid = new GridBuilder(kNumBytesPerRow);
  addGridType(grid, typeDef, 0, '', );
  const size = getSizeOfTypeDef(typeDef);
  grid.addPadding(size - grid.byteOffset);
  return grid.tableElem;
}

// ----

function showTypes(view, arrayBufferName, template, indent = '') {
  if (Array.isArray(view)) {
    const lines = view.map(elem => addPrefixSuffix(showTypes(elem, arrayBufferName, template, indent + '  '), indent + '  ', '')).flat();
    return [
      '[',
      ...lines,
      `${indent}]`,
    ];
  } else if (view.buffer instanceof ArrayBuffer) {
    const isWholeBuffer = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength;
    return [
      isWholeBuffer
         ? template.wholeBuffer(view)
         : template.buffer(view),
    ];
  } else {
    return [
      '{',
      ...showViews(view, arrayBufferName, template, indent),
      `${indent}}`,
    ];
  }
}

function showViews(views, arrayBufferName, template, indent = '') {
  indent += '  ';
  return Object.entries(views).map(([name, view]) => {
    const lines = showTypes(view, arrayBufferName, template, indent);
    return addPrefixSuffix(lines, `${indent}${name}: `, ',');
  }).flat();
}

function addPrefixSuffix(lines, prefix, suffix) {
  lines[0] = `${prefix}${lines[0]}`;
  lines[lines.length - 1] = `${lines[lines.length - 1]}${suffix}`;
  return lines;
}

function showView(values, name, arrayBufferName, template) {
  const lines = showTypes(values.views, arrayBufferName, template);
  const [prefix, suffix] = values.views.buffer instanceof ArrayBuffer
     ? template.typedArray(name, lines)
     : template.nonTypedArray(name, lines);
  return addPrefixSuffix(lines, prefix, suffix);
}

export function getCodeForUniform(name, uniform, mode = 'views') {
  const values = makeStructuredView(uniform);
  const arrayBufferName = mode === 'views' ? `${name}Values` : `${name}`;

  const template = mode === 'views'
    ? {
      decl: (name, size) => `const ${name} = new ArrayBuffer(${size});`,
      typedArray: (name, lines) => [`const ${name}view: ${lines[0]}`, ','],
      nonTypedArray: (name) => [`const ${name}Views = `, ';'],
      wholeBuffer: (view) => `new ${Object.getPrototypeOf(view).constructor.name}(${arrayBufferName}})`,
      buffer: (view) => `new ${Object.getPrototypeOf(view).constructor.name}(${arrayBufferName}, ${view.byteOffset}, ${view.length})`,
    }
    : {
      decl: (name, size) => `const ${name}Size = ${size}`,
      typedArray: (name, lines) => [`const ${name}view: ${lines[0]}`, ','],
      nonTypedArray: (name) => [`const ${name}Info = `, ';'],
      wholeBuffer: (view) => `{ type: ${Object.getPrototypeOf(view).constructor.name} }`,
      buffer: (view) => `{ type: ${Object.getPrototypeOf(view).constructor.name}, byteOffset: ${view.byteOffset}, length: ${view.length} }`,
    };

  const lines = [
    template.decl(arrayBufferName, values.arrayBuffer.byteLength),
    ...showView(values, name, arrayBufferName, template),
  ];

  return lines.join('\n');
}

export function createByteDiagramForType(name, typeDef) {
  return el('div', {className: 'byte-diagram'}, [addTypeToGrid(name, typeDef)]);
}
