/* muigui@0.0.3, license MIT */
const css = `
.muigui {
  --width: 250px;
  --label-width: 45%;
  --number-width: 40%;

  --bg-color: #222222;
  --color: #dddddd;
  --value-color: #43e5f7;
  --value-bg-color: #444444;
  --disabled-color: #666666;
  --menu-bg-color: #000000;
  --menu-sep-color: #444444;
  --hover-bg-color: #666666;
  --focus-color: #88AAFF;
  --range-color: #888888;
  --invalid-color: #FF6666;
  --selected-color: rgba(255, 255, 255, 0.3);

  --button-bg-color: var(--value-bg-color);

  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  --font-size: 11px;
  --font-family-mono: Menlo, Monaco, Consolas, "Droid Sans Mono", monospace;
  --font-size-mono: 11px;

  --range-left-color: var(--value-color);
  --range-right-color: var(--value-bg-color);
  --range-right-hover-color: var(--hover-bg-color);
  --line-height: 1.7em;
  --border-radius: 0px;

  width: var(--width);
  color: var(--color);
  background-color: var(--bg-color);
  font-family: var(--font-family);
  font-size: var(--font-size);
  box-sizing: border-box;
}
.muigui * {
  box-sizing: inherit;
}

.muigui-invalid-value {
  background-color: red !important;
  color: white !important;
}

.muigui-grid {
  display: grid;
}
.muigui-rows {
  display: flex;
  flex-direction: column;

  min-height: 20px;
  border: 2px solid red;
}
.muigui-columns {
  display: flex;
  flex-direction: row;

  height: 20px;
  border: 2px solid green;
}
.muigui-rows>*,
.muigui-columns>* {
  flex: 1 1 auto;
  align-items: stretch;
  min-height: 0;
  min-width: 0;
}

.muigui-row {
  border: 2px solid yellow;
  min-height: 10px
}
.muigui-column {
  border: 2px solid lightgreen;
}

/* -------- */

.muigui-show { /* */ }
.muigui-hide { 
  display: none !important;
}
.muigui-disabled {
  pointer-events: none;
  --color: var(--disabled-color) !important;
  --value-color: var(--disabled-color) !important;
  --range-left-color: var(--disabled-color) !important;
}

.muigui canvas,
.muigui svg {
  display: block;
  border-radius: var(--border-radius);
}
.muigui canvas {
  background-color: var(--value-bg-color);
}

.muigui-controller {
  min-width: 0;
  min-height: var(--line-height);
}
.muigui-root,
.muigui-menu {
  display: flex;
  flex-direction: column;
  position: relative;
  user-select: none;
  height: fit-content;
  margin: 0;
  padding-bottom: 0.1em;
  border-radius: var(--border-radius);
}
.muigui-menu {
  border-bottom: 1px solid var(--menu-sep-color);
}

.muigui-root>button:nth-child(1),
.muigui-menu>button:nth-child(1) {
  border-top: 1px solid var(--menu-sep-color);
  border-bottom: 1px solid var(--menu-sep-color);
  position: relative;
  text-align: left;
  color: var(--color);
  background-color: var(--menu-bg-color);
  min-height: var(--line-height);
  padding-top: 0.2em;
  padding-bottom: 0.2em;
  cursor: pointer;
  border-radius: var(--border-radius);
}
.muigui-root>div:nth-child(2),
.muigui-menu>div:nth-child(2) {
  flex: 1 1 auto;
}

.muigui-controller {
  margin-left: 0.2em;
  margin-right: 0.2em;
}
.muigui-root.muigui-controller,
.muigui-menu.muigui-controller {
  margin-left: 0;
  margin-right: 0;
}
.muigui-controller>*:nth-child(1) {
  flex: 1 0 var(--label-width);
  min-width: 0;
  white-space: pre;
}
.muigui-controller>label:nth-child(1) {
  place-content: center start;
  display: inline-grid;
  overflow: hidden;
}
.muigui-controller>*:nth-child(2) {
  flex: 1 1 75%;
  min-width: 0;
}

/* -----------------------------------------
  a label controller is  [[label][value]]
*/

.muigui-label-controller {
  display: flex;
  margin: 0.4em 0 0.4em 0;
  word-wrap: initial;
  align-items: stretch;
}

.muigui-value {
  display: flex;
  align-items: stretch;
}
.muigui-value>* {
  flex: 1 1 auto;
  min-width: 0;
}
.muigui-value>*:nth-child(1) {
  flex: 1 1 calc(100% - var(--number-width));
}
.muigui-value>*:nth-child(2) {
  flex: 1 1 var(--number-width);
  margin-left: 0.2em;
}

/* fix! */
.muigui-open>button>label::before,
.muigui-closed>button>label::before {
  width: 1.25em;
  height: var(--line-height);
  display: inline-grid;
  place-content: center start;
  pointer-events: none;
}
.muigui-open>button>label::before {
  content: "ⓧ"; /*"▼";*/
}
.muigui-closed>button>label::before {
  content: "⨁"; /*"▶";*/
}
.muigui-open>*:nth-child(2) {
  transition: max-height 0.2s ease-out,
              opacity 0.5s ease-out;
  max-height: 100vh;
  overflow: auto;
  opacity: 1;
}

.muigui-closed>*:nth-child(2) {
  transition: max-height 0.2s ease-out,
              opacity 1s;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

/* ---- popdown ---- */

.muigui-pop-down-top {
  display: flex;
}
/* fix? */
.muigui-value>*:nth-child(1).muigui-pop-down-top {
  flex: 0;
}
.muigui-pop-down-bottom {

}

.muigui-pop-down-values {
  min-width: 0;
  display: flex;
}
.muigui-pop-down-values>* {
  flex: 1 1 auto;
  min-width: 0;
}

.muigui-value.muigui-pop-down-controller {
  flex-direction: column;
}

.muigui-pop-down-top input[type=checkbox] {
  -webkit-appearance: none;
  appearance: none;
  width: auto;
  color: var(--value-color);
  background-color: var(--value-bg-color);
  cursor: pointer;

  display: grid;
  place-content: center;
  margin: 0;
  font: inherit;
  color: currentColor;
  width: 1.7em;
  height: 1.7em;
  transform: translateY(-0.075em);
}

.muigui-pop-down-top input[type=checkbox]::before {
  content: "+";
  display: grid;
  place-content: center;
  border-radius: calc(var(--border-radius) + 2px);
  border-left: 1px solid rgba(255,255,255,0.3);
  border-top: 1px solid rgba(255,255,255,0.3);
  border-bottom: 1px solid rgba(0,0,0,0.2);
  border-right: 1px solid rgba(0,0,0,0.2);
  background-color: var(--range-color);
  color: var(--value-bg-color);
  width: calc(var(--line-height) - 4px);
  height: calc(var(--line-height) - 4px);
}

.muigui-pop-down-top input[type=checkbox]:checked::before {
  content: "Ｘ";
}


/* ---- select ---- */

.muigui select,
.muigui option,
.muigui input,
.muigui button {
  color: var(--value-color);
  background-color: var(--value-bg-color);
  font-family: var(--font-family);
  font-size: var(--font-size);
  border: none;
  margin: 0;
  border-radius: var(--border-radius);
}
.muigui select {
  appearance: none;
  margin: 0;
  margin-left: 0; /*?*/
  overflow: hidden; /* Safari */
}

.muigui select:focus,
.muigui input:focus,
.muigui button:focus {
  outline: 1px solid var(--focus-color);
}

.muigui select:hover,
.muigui option:hover,
.muigui input:hover,
.muigui button:hover {
  background-color: var(--hover-bg-color);  
}

/* ------ [ label ] ------ */

.muigui-label {
  border-top: 1px solid var(--menu-sep-color);
  border-bottom: 1px solid var(--menu-sep-color);
  padding-top: 0.4em;
  padding-bottom: 0.3em;
  place-content: center start;
  background-color: var(--menu-bg-color);
  white-space: pre;
  border-radius: var(--border-radius);
}

/* ------ [ divider] ------ */

.muigui-divider {
    min-height: 6px;
    border-top: 2px solid var(--menu-sep-color);
    margin-top: 6px;
}

/* ------ [ button ] ------ */

.muigui-button {
  display: grid;

}
.muigui-button button {
  border: none;
  color: var(--value-color);
  background-color: var(--button-bg-color);
  cursor: pointer;
  place-content: center center;
}

/* ------ [ color ] ------ */

.muigui-color>div {
  overflow: hidden;
  position: relative;
  margin-left: 0;
  margin-right: 0; /* why? */
  max-width: var(--line-height);
  border-radius: var(--border-radius);
}

.muigui-color>div:focus-within {
  outline: 1px solid var(--focus-color);
}

.muigui-color input[type=color] {
  border: none;
  padding: 0;
  background: inherit;
  cursor: pointer;
  position: absolute;
  width: 200%;
  left: -10px;
  top: -10px;
  height: 200%;
}
.muigui-disabled canvas,
.muigui-disabled svg,
.muigui-disabled img,
.muigui-disabled .muigui-color input[type=color] {
  opacity: 0.2;
}

/* ------ [ checkbox ] ------ */

.muigui-checkbox>label:nth-child(2) {
  display: grid;
  place-content: center start;
  margin: 0;
}

.muigui-checkbox input[type=checkbox] {
  -webkit-appearance: none;
  appearance: none;
  width: auto;
  color: var(--value-color);
  background-color: var(--value-bg-color);
  cursor: pointer;

  display: grid;
  place-content: center;
  margin: 0;
  font: inherit;
  color: currentColor;
  width: 1.7em;
  height: 1.7em;
  transform: translateY(-0.075em);
}

.muigui-checkbox input[type=checkbox]::before {
  content: "";
  color: var(--value-color);
  display: grid;
  place-content: center;
}

.muigui-checkbox input[type=checkbox]:checked::before {
  content: "✔";
}

.muigui input[type=number]::-webkit-inner-spin-button, 
.muigui input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none;
  appearance: none;
  margin: 0; 
}
.muigui input[type=number] {
  -moz-appearance: textfield;
}

/* ------ [ radio grid ] ------ */

.muigui-radio-grid>div {
  display: grid;
  gap: 2px;
}

.muigui-radio-grid input {
  appearance: none;
  display: none;
}

.muigui-radio-grid button {
  color: var(--color);
  width: 100%;
  text-align: left;
}

.muigui-radio-grid input:checked + button {
  color: var(--value-color);
  background-color: var(--selected-color);
}

/* ------ [ color-chooser ] ------ */

.muigui-color-chooser-cursor {
  stroke-width: 1px;
  stroke: white;
  fill: none;
}
.muigui-color-chooser-circle {
  stroke-width: 1px;
  stroke: white;
  fill: none;
}


/* ------ [ vec2 ] ------ */

.muigui-vec2 svg {
  background-color: var(--value-bg-color);
}

.muigui-vec2-axis {
  stroke: 1px;
  stroke: var(--focus-color);
}

.muigui-vec2-line {
  stroke-width: 1px;
  stroke: var(--value-color);
  fill: var(--value-color);
}

/* ------ [ direction ] ------ */

.muigui-direction svg {
  background-color: rgba(0,0,0,0.2);
}

.muigui-direction:focus-within svg {
  outline: none;
}
.muigui-direction-range {
  fill: var(--value-bg-color);
}
.muigui-direction svg:focus {
  outline: none;
}
.muigui-direction svg:focus .muigui-direction-range {
  stroke-width: 0.5px;
  stroke: var(--focus-color);
}

.muigui-direction-arrow {
  fill: var(--value-color);
}

/* ------ [ slider ] ------ */

.muigui-slider>div {
  display: flex;
  align-items: stretch;
  height: var(--line-height);
}
.muigui-slider svg {
  flex: 1 1 auto;
}
.muigui-slider .muigui-slider-up #muigui-orientation {
  transform: scale(1, -1) translateY(-100%);
}

.muigui-slider .muigui-slider-up #muigui-number-orientation {
  transform: scale(1,-1);
}

.muigui-ticks {
  stroke: var(--range-color);
}
.muigui-thicks {
  stroke: var(--color);
  stroke-width: 2px;
}
.muigui-svg-text {
  fill: var(--color);
  font-size: 7px;
}
.muigui-mark {
  fill: var(--value-color);
}

/* ------ [ range ] ------ */


.muigui-range input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  background-color: transparent;
}

.muigui-range input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  border-radius: calc(var(--border-radius) + 2px);
  border-left: 1px solid rgba(255,255,255,0.3);
  border-top: 1px solid rgba(255,255,255,0.3);
  border-bottom: 1px solid rgba(0,0,0,0.2);
  border-right: 1px solid rgba(0,0,0,0.2);
  background-color: var(--range-color);
  margin-top: calc((var(--line-height) - 2px) / -2);
  width: calc(var(--line-height) - 2px);
  height: calc(var(--line-height) - 2px);
}

.muigui-range input[type=range]::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--menu-sep-color);
  height: 2px;
}


/* dat.gui style - doesn't work on Safari iOS */

/*
.muigui-range input[type=range] {
  cursor: ew-resize;
  overflow: hidden;
}

.muigui-range input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  background-color: var(--range-right-color);
  margin: 0;
}
.muigui-range input[type=range]:hover {
  background-color: var(--range-right-hover-color);
}

.muigui-range input[type=range]::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  appearance: none;
  height: max-content;
  color: var(--range-left-color);
  margin-top: -1px;
}

.muigui-range input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0px;
  height: max-content;
  box-shadow: -1000px 0 0 1000px var(--range-left-color);
}
*/

/* FF */
/*
.muigui-range input[type=range]::-moz-slider-progress {
  background-color: var(--range-left-color); 
}
.muigui-range input[type=range]::-moz-slider-thumb {
  height: max-content;
  width: 0;
  border: none;
  box-shadow: -1000px 0 0 1000px var(--range-left-color);
  box-sizing: border-box;
}
*/

/* ---------------------------------------------------------- */

/* needs to be at bottom to take precedence */
.muigui-auto-place {
  max-height: 100%;
  position: fixed;
  top: 0;
  right: 15px;
  z-index: 100001;
}

`;

function setElemProps(elem, attrs, children) {
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

function createElem(tag, attrs = {}, children = []) {
  const elem = document.createElement(tag);
  setElemProps(elem, attrs, children);
  return elem;
}

function removeArrayElem(array, value) {
  const ndx = array.indexOf(value);
  if (ndx) {
    array.splice(ndx, 1);
  }
  return array;
}

function clamp$1(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const isTypedArray = typeof SharedArrayBuffer !== 'undefined'
  ? function isArrayBufferOrSharedArrayBuffer(a) {
    return a && a.buffer && (a.buffer instanceof ArrayBuffer || a.buffer instanceof SharedArrayBuffer);
  }
  : function isArrayBuffer(a) {
    return a && a.buffer && a.buffer instanceof ArrayBuffer;
  };

// Yea, I know this should be `Math.round(v / step) * step
// but try step = 0.1, newV = 19.95
//
// I get
//     Math.round(19.95 / 0.1) * 0.1
//     19.900000000000002
// vs
//     Math.round(19.95 / 0.1) / (1 / 0.1)
//     19.9
//
const stepify = (v, from, step) => Math.round(from(v) / step) / (1 / step);
function copyExistingProperties(dst, src) {
  for (const key in src) {
    if (key in dst) {
      dst[key] = src[key];
    }
  }
  return dst;
}

class View {
  #childDestElem;
  #views = [];

  constructor(elem) {
    this.domElement = elem;
    this.#childDestElem = elem;
  }
  addElem(elem) {
    this.#childDestElem.appendChild(elem);
    return elem;
  }
  removeElem(elem) {
    this.#childDestElem.removeChild(elem);
    return elem;
  }
  pushSubElem(elem) {
    this.#childDestElem.appendChild(elem);
    this.#childDestElem = elem;
  }
  popSubElem() {
    this.#childDestElem = this.#childDestElem.parentElement;
  }
  add(view) {
    this.#views.push(view);
    this.addElem(view.domElement);
    return view;
  }
  remove(view) {
    this.removeElem(view.domElement);
    removeArrayElem(this.#views, view);
    return view;
  }
  pushSubView(view) {
    this.pushSubElem(view.domElement);
  }
  popSubView() {
    this.popSubElem();
  }
  setOptions(options) {
    for (const view of this.#views) {
      view.setOptions(options);
    }
  }
  updateDisplayIfNeeded(newV, ignoreCache) {
    for (const view of this.#views) {
      view.updateDisplayIfNeeded(newV, ignoreCache);
    }
    return this;
  }
  $(selector) {
    return this.domElement.querySelector(selector);
  }
}

class Controller extends View {
  #changeFns;
  #finishChangeFns;
  #parent;

  constructor(className) {
    super(createElem('div', {className: 'muigui-controller'}));
    this.#changeFns = [];
    this.#finishChangeFns = [];
    // we need the specialization to come last so it takes precedence.
    if (className) {
      this.domElement.classList.add(className);
    }
  }
  get parent() {
    return this.#parent;
  }
  setParent(parent) {
    this.#parent = parent;
    this.enable(!this.disabled());
  }
  show(show = true) {
    this.domElement.classList.toggle('muigui-hide', !show);
    this.domElement.classList.toggle('muigui-show', show);
    return this;
  }
  hide() {
    return this.show(false);
  }
  disabled() {
    return !!this.domElement.closest('.muigui-disabled');
  }

  enable(enable = true) {
    this.domElement.classList.toggle('muigui-disabled', !enable);

    // If disabled we need to set the attribute 'disabled=true' to all
    // input/select/button/textarea's below
    //
    // If enabled we need to set the attribute 'disabled=false' to all below
    // until we hit a disabled controller.
    //
    // ATM the problem is we can find the input/select/button/textarea elements
    // but we can't easily find which controller they belong do.
    // But we don't need to? We can just check up if it or parent has
    // '.muigui-disabled'
    ['input', 'button', 'select', 'textarea'].forEach(tag => {
      this.domElement.querySelectorAll(tag).forEach(elem => {
        const disabled = !!elem.closest('.muigui-disabled');
        elem.disabled = disabled;
      });
    });

    return this;
  }
  disable(disable = true) {
    return this.enable(!disable);
  }
  onChange(fn) {
    this.removeChange(fn);
    this.#changeFns.push(fn);
    return this;
  }
  removeChange(fn) {
    removeArrayElem(this.#changeFns, fn);
    return this;
  }
  onFinishChange(fn) {
    this.removeFinishChange(fn);
    this.#finishChangeFns.push(fn);
    return this;
  }
  removeFinishChange(fn) {
    removeArrayElem(this.#finishChangeFns, fn);
    return this;
  }
  #callListeners(fns, newV) {
    for (const fn of fns) {
      fn.call(this, newV);
    }
  }
  emitChange(value, object, property) {
    this.#callListeners(this.#changeFns, value);
    if (this.#parent) {
      if (object === undefined) {
        this.#parent.emitChange(value);
      } else {
        this.#parent.emitChange({
          object,
          property,
          value,
          controller: this,
        });
      }
    }
  }
  emitFinalChange(value, object, property) {
    this.#callListeners(this.#finishChangeFns, value);
    if (this.#parent) {
      if (object === undefined) {
        this.#parent.emitChange(value);
      } else {
        this.#parent.emitFinalChange({
          object,
          property,
          value,
          controller: this,
        });
      }
    }
  }
  getColors() {
    const toCamelCase = s => s.replace(/-([a-z])/g, (m, m1) => m1.toUpperCase());
    const keys = [
      'color',
      'bg-color',
      'value-color',
      'value-bg-color',
      'hover-bg-color',
      'menu-bg-color',
      'menu-sep-color',
      'disabled-color',
    ];
    const div = createElem('div');
    this.domElement.appendChild(div);
    const colors = Object.fromEntries(keys.map(key => {
      div.style.color = `var(--${key})`;
      const s = getComputedStyle(div);
      return [toCamelCase(key), s.color];
    }));
    div.remove();
    return colors;
  }
}

class Button extends Controller {
  #object;
  #property;
  #buttonElem;
  #options = {
    name: '',
  };

  constructor(object, property, options = {}) {
    super('muigui-button', '');
    this.#object = object;
    this.#property = property;

    this.#buttonElem = this.addElem(
        createElem('button', {
          type: 'button',
          onClick: () => {
            this.#object[this.#property](this);
          },
        }));
    this.setOptions({name: property, ...options});
  }
  setOptions(options) {
    copyExistingProperties(this.#options, options);
    const {name} = this.#options;
    this.#buttonElem.textContent = name;
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function copyArrayElementsFromTo(src, dst) {
  dst.length = src.length;
  for (let i = 0; i < src.length; ++i) {
    dst[i] = src[i];
  }
}

class EditView extends View {
  #oldV;
  #updateCheck;

  #checkArrayNeedsUpdate(newV) {
    // It's an array, we need to compare all elements
    // Example, vec2, [r,g,b], ...
    const needUpdate = !arraysEqual(newV, this.#oldV);
    if (needUpdate) {
      copyArrayElementsFromTo(newV, this.#oldV);
    }
    return needUpdate;
  }

  #checkTypedArrayNeedsUpdate() {
    let once = true;
    return function checkTypedArrayNeedsUpdateImpl(newV) {
      // It's a typedarray, we need to compare all elements
      // Example: Float32Array([r, g, b])
      let needUpdate = once;
      once = false;
      if (!needUpdate) {
        needUpdate = !arraysEqual(newV, this.#oldV);
      }
      return needUpdate;
    };
  }

  #checkObjectNeedsUpdate(newV) {
    let needUpdate = false;
    for (const key in newV) {
      if (newV[key] !== this.#oldV[key]) {
        needUpdate = true;
        this.#oldV[key] = newV[key];
      }
    }
    return needUpdate;
  }

  #checkValueNeedsUpdate(newV) {
    const needUpdate = newV !== this.#oldV;
    this.#oldV = newV;
    return needUpdate;
  }

  #getUpdateCheckForType(newV) {
    if (Array.isArray(newV)) {
      this.#oldV = [];
      return this.#checkArrayNeedsUpdate.bind(this);
    } else if (isTypedArray(newV)) {
      this.#oldV = new newV.constructor(newV);
      return this.#checkTypedArrayNeedsUpdate(this);
    } else if (typeof newV === 'object') {
      this.#oldV = {};
      return this.#checkObjectNeedsUpdate.bind(this);
    } else {
      return this.#checkValueNeedsUpdate.bind(this);
    }
  }

  // The point of this is updating DOM elements
  // is slow but if we've called `listen` then
  // every frame we're going to try to update
  // things with the current value so if nothing
  // has changed then skip it.
  updateDisplayIfNeeded(newV, ignoreCache) {
    this.#updateCheck = this.#updateCheck || this.#getUpdateCheckForType(newV);
    // Note: We call #updateCheck first because it updates
    // the cache
    if (this.#updateCheck(newV) || ignoreCache) {
      this.updateDisplay(newV);
    }
  }
  setOptions(/*options*/) {
    // override this
    return this;
  }
}

class CheckboxView extends EditView {
  constructor(setter, id) {
    const checkboxElem = createElem('input', {
      type: 'checkbox',
      id,
      onInput: () => {
        setter.setValue(this.domElement.checked);
      },
      onChange: () => {
        setter.setFinalValue(this.domElement.checked);
      },
    });
    super(createElem('label', {}, [checkboxElem]));
  }
  updateDisplay(v) {
    this.domElement.checked = v;
  }
}

const tasks = [];
const tasksToRemove = new Set();

let requestId;
let processing;

function removeTasks() {
  if (!tasksToRemove.size) {
    return;
  }

  if (processing) {
    queueProcessing();
    return;
  }

  tasksToRemove.forEach(task => {
    removeArrayElem(tasks, task);
  });
  tasksToRemove.clear();
}

function processTasks() {
  requestId = undefined;
  processing = true;
  for (const task of tasks) {
    if (!tasksToRemove.has(task)) {
      task();
    }
  }
  processing = false;
  removeTasks();
  queueProcessing();
}

function queueProcessing() {
  if (!requestId && tasks.length) {
    requestId = requestAnimationFrame(processTasks);
  }
}

function addTask(fn) {
  tasks.push(fn);
  queueProcessing();
}

function removeTask(fn) {
  tasksToRemove.set(fn);

  const ndx = tasks.indexOf(fn);
  if (ndx >= 0) {
    tasks.splice(ndx, 1);
  }
}

let id = 0;

function makeId() {
  return `muigui-${++id}`;
}

class ValueView extends View {
  constructor(className = '') {
    super(createElem('div', {className: 'muigui-value'}));
    if (className) {
      this.domElement.classList.add(className);
    }
  }
}

class LabelController extends Controller {
  #id;
  #nameElem;

  constructor(className = '', name = '') {
    super('muigui-label-controller');
    this.#id = makeId();
    this.#nameElem = createElem('label', {for: this.#id});
    this.domElement.appendChild(this.#nameElem);
    this.pushSubView(new ValueView(className));
    this.name(name);
  }
  get id() {
    return this.#id;
  }
  name(name) {
    if (this.#nameElem.title === this.#nameElem.textContent) {
      this.#nameElem.title = name;
    }
    this.#nameElem.textContent = name;
    return this;
  }
  tooltip(tip) {
    this.#nameElem.title = tip;
  }
}

class ValueController extends LabelController {
  #object;
  #property;
  #initialValue;
  #listening;
  #views;
  #updateFn;

  constructor(object, property, className = '') {
    super(className, property);
    this.#object = object;
    this.#property = property;
    this.#initialValue = this.getValue();
    this.#listening = false;
    this.#views = [];
  }
  get initialValue() {
    return this.#initialValue;
  }
  get object() {
    return this.#object;
  }
  get property() {
    return this.#property;
  }
  add(view) {
    this.#views.push(view);
    super.add(view);
    this.updateDisplay();
    return view;
  }
  #setValueImpl(v, ignoreCache) {
    if (typeof v === 'object') {
      const dst = this.#object[this.#property];
      // don't replace objects, just their values.
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; ++i) {
          dst[i] = v[i];
        }
      } else if (isTypedArray(v)) {
        dst.set(v);
      } else {
        Object.assign(dst, v);
      }
    } else {
      this.#object[this.#property] = v;
    }
    this.updateDisplay(ignoreCache);
    this.emitChange(this.getValue(), this.#object, this.#property);
    return this;
  }
  setValue(v) {
    this.#setValueImpl(v);
  }
  setFinalValue(v) {
    this.#setValueImpl(v, true);
    this.emitFinalChange(this.getValue(), this.#object, this.#property);
    return this;
  }
  updateDisplay(ignoreCache) {
    const newV = this.getValue();
    for (const view of this.#views) {
      view.updateDisplayIfNeeded(newV, ignoreCache);
    }
    return this;
  }
  setOptions(options) {
    for (const view of this.#views) {
      view.setOptions(options);
    }
    this.updateDisplay();
    return this;
  }
  getValue() {
    return this.#object[this.#property];
  }
  value(v) {
    this.setValue(v);
    return this;
  }
  reset() {
    this.setValue(this.#initialValue);
    return this;
  }
  listen(listen = true) {
    if (!this.#updateFn) {
      this.#updateFn = this.updateDisplay.bind(this);
    }
    if (listen) {
      if (!this.#listening) {
        this.#listening = true;
        addTask(this.#updateFn);
      }
    } else {
      if (this.#listening) {
        this.#listening = false;
        removeTask(this.#updateFn);
      }
    }
    return this;
  }
}

class Checkbox extends ValueController {
  constructor(object, property) {
    super(object, property, 'muigui-checkbox');
    const id = this.id;
    this.add(new CheckboxView(this, id));
    this.updateDisplay();
  }
}

const identity = {
  to: v => v,
  from: v => [true, v],
};

// from: from string to value
// to: from value to string
const strToNumber = {
  to: v => v.toString(),
  from: v => {
    const newV = parseFloat(v);
    return [!Number.isNaN(newV), newV];
  },
};

function createWheelHelper() {
  let wheelAccum = 0;
  return function(e, step, wheelScale = 5) {
    wheelAccum -= e.deltaY * step / wheelScale;
    const wheelSteps = Math.floor(Math.abs(wheelAccum) / step) * Math.sign(wheelAccum);
    const delta = wheelSteps * step;
    wheelAccum -= delta;
    return delta;
  };
}

class NumberView extends EditView {
  #to;
  #from;
  #step;
  #skipUpdate;
  #options = {
    step: 0.01,
    converters: strToNumber,
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
  };

  constructor(setter, options) {
    const setValue = setter.setValue.bind(setter);
    const setFinalValue = setter.setFinalValue.bind(setter);
    const wheelHelper = createWheelHelper();
    super(createElem('input', {
      type: 'number',
      onInput: () => this.#handleInput(setValue, true),
      onChange: () => this.#handleInput(setFinalValue, false),
      onWheel: e => {
        e.preventDefault();
        const {min, max, step} = this.#options;
        const delta = wheelHelper(e, step);
        const v = parseFloat(this.domElement.value);
        const newV = clamp$1(stepify(v + delta, v => v, step), min, max);
        setter.setValue(newV);
      },
    }));
    this.setOptions(options);
  }
  #handleInput(setFn, skipUpdate) {
    const v = parseFloat(this.domElement.value);
    const [valid, newV] = this.#from(v);
    let inRange;
    if (valid && !Number.isNaN(v)) {
      const {min, max} = this.#options;
      inRange = newV >= min && newV <= max;
      this.#skipUpdate = skipUpdate;
      setFn(clamp$1(newV, min, max));
    }
    this.domElement.classList.toggle('muigui-invalid-value', !valid || !inRange);
  }
  updateDisplay(v) {
    if (!this.#skipUpdate) {
      this.domElement.value = stepify(v, this.#to, this.#step);
    }
    this.#skipUpdate = false;
  }
  setOptions(options) {
    copyExistingProperties(this.#options, options);
    const {
      step,
      converters: {to, from},
    } = this.#options;
    this.#to = to;
    this.#from = from;
    this.#step = step;
    return this;
  }
}

// Wanted to name this `Number` but it conflicts with
// JavaScript `Number`. It most likely wouldn't be
// an issue? But users might `import {Number} ...` and
// things would break.
class TextNumber extends ValueController {
  #textView;
  #step;

  constructor(object, property, options = {}) {
    super(object, property, 'muigui-checkbox');
    this.#textView = this.add(new NumberView(this, options));
    this.updateDisplay();
  }
}

class SelectView extends EditView {
  #values;

  constructor(setter, keyValues) {
    const values = [];
    super(createElem('select', {
      onChange: () => {
        setter.setFinalValue(this.#values[this.domElement.selectedIndex]);
      },
    }, keyValues.map(([key, value]) => {
      values.push(value);
      return createElem('option', {textContent: key});
    })));
    this.#values = values;
  }
  updateDisplay(v) {
    const ndx = this.#values.indexOf(v);
    this.domElement.selectedIndex = ndx;
  }
}

// 4 cases
//   (a) keyValues is array of arrays, each sub array is key value
//   (b) keyValues is array and value is number then keys = array contents, value = index
//   (c) keyValues is array and value is not number, key = array contents, value = array contents
//   (d) keyValues is object then key->value
function convertToKeyValues(keyValues, valueIsNumber) {
  if (Array.isArray(keyValues)) {
    if (Array.isArray(keyValues[0])) {
      // (a) keyValues is array of arrays, each sub array is key value
      return keyValues;
    } else {
      if (valueIsNumber) {
        // (b) keyValues is array and value is number then keys = array contents, value = index
        return keyValues.map((v, ndx) => [v, ndx]);
      } else {
        // (c) keyValues is array and value is not number, key = array contents, value = array contents
        return keyValues.map(v => [v, v]);
      }
    }
  } else {
    // (d)
    return [...Object.entries(keyValues)];
  }
}

class Select extends ValueController {
  constructor(object, property, options) {
    super(object, property, 'muigui-select');
    const valueIsNumber = typeof this.getValue() === 'number';
    const {keyValues: keyValuesInput} = options;
    const keyValues = convertToKeyValues(keyValuesInput, valueIsNumber);
    this.add(new SelectView(this, keyValues));
    this.updateDisplay();
  }
}

class RangeView extends EditView {
  #to;
  #from;
  #step;
  #skipUpdate;
  #options = {
    step: 0.01,
    min: 0,
    max: 1,
    converters: identity,
  };

  constructor(setter, options) {
    const wheelHelper = createWheelHelper();
    super(createElem('input', {
      type: 'range',
      onInput: () => {
        this.#skipUpdate = true;
        const [valid, v] = this.#from(parseFloat(this.domElement.value));
        if (valid) {
          setter.setValue(v);
        }
      },
      onChange: () => {
        this.#skipUpdate = true;
        const [valid, v] = this.#from(parseFloat(this.domElement.value));
        if (valid) {
          setter.setFinalValue(v);
        }
      },
      onWheel: e => {
        e.preventDefault();
        const [valid, v] = this.#from(parseFloat(this.domElement.value));
        if (!valid) {
          return;
        }
        const {min, max, step} = this.#options;
        const delta = wheelHelper(e, step);
        const newV = clamp$1(stepify(v + delta, v => v, step), min, max);
        setter.setValue(newV);
      },
    }));
    this.setOptions(options);
  }
  updateDisplay(v) {
    if (!this.#skipUpdate) {
      this.domElement.value = stepify(v, this.#to, this.#step);
    }
    this.#skipUpdate = false;
  }
  setOptions(options) {
    copyExistingProperties(this.#options, options);
    const {
      step,
      min,
      max,
      converters: {to, from},
    } = this.#options;
    this.#to = to;
    this.#from = from;
    this.#step = step;
    this.domElement.step = step;
    this.domElement.min = min;
    this.domElement.max = max;
    return this;
  }
}

class Range extends ValueController {
  constructor(object, property, options) {
    super(object, property, 'muigui-range');
    this.add(new RangeView(this, options));
    this.add(new NumberView(this, options));
  }
}

class TextView extends EditView {
  #to;
  #from;
  #skipUpdate;
  #options = {
    converters: identity,
  };

  constructor(setter, options) {
    const setValue = setter.setValue.bind(setter);
    const setFinalValue = setter.setFinalValue.bind(setter);
    super(createElem('input', {
      type: 'text',
      onInput: () => this.#handleInput(setValue, true),
      onChange: () => this.#handleInput(setFinalValue, false),
    }));
    this.setOptions(options);
  }
  #handleInput(setFn, skipUpdate) {
    const [valid, newV] = this.#from(this.domElement.value);
    if (valid) {
      this.#skipUpdate = skipUpdate;
      setFn(newV);
    }
    this.domElement.style.color = valid ? '' : 'var(--invalid-color)';

  }
  updateDisplay(v) {
    if (!this.#skipUpdate) {
      this.domElement.value = this.#to(v);
      this.domElement.style.color = '';
    }
    this.#skipUpdate = false;
  }
  setOptions(options) {
    copyExistingProperties(this.#options, options);
    const {
      converters: {to, from},
    } = this.#options;
    this.#to = to;
    this.#from = from;
    return this;
  }
}

class Text extends ValueController {
  constructor(object, property) {
    super(object, property, 'muigui-checkbox');
    this.add(new TextView(this));
    this.updateDisplay();
  }
}

// const isConversion = o => typeof o.to === 'function' && typeof o.from === 'function';

/**
 * possible inputs
 *    add(o, p, min: number, max: number)
 *    add(o, p, min: number, max: number, step: number)
 *    add(o, p, array: [value])
 *    add(o, p, array: [[key, value]])
 *
 * @param {*} object
 * @param {string} property
 * @param  {...any} args
 * @returns {Controller}
 */
function createController(object, property, ...args) {
  const [arg1] = args;
  if (Array.isArray(arg1)) {
    return new Select(object, property, {keyValues: arg1});
  }

  const t = typeof object[property];
  switch (t) {
    case 'number':
      if (typeof args[0] === 'number' && typeof args[1] === 'number') {
        const min = args[0];
        const max = args[1];
        const step = args[2];
        return new Range(object, property, {min, max, ...(step && {step})});
      }
      return args.length === 0
          ? new TextNumber(object, property, ...args)
          : new Range(object, property, ...args);
    case 'boolean':
      return new Checkbox(object, property, ...args);
    case 'function':
      return new Button(object, property, ...args);
    case 'string':
      return new Text(object, property, ...args);
    default:
      throw new Error(`unhandled type ${t} for property ${property}`);
  }
}

class ElementView extends View {
  constructor(tag, className) {
    super(createElem(tag, {className}));
  }
}

// TODO: remove this? Should just be user side
class Canvas extends LabelController {
  #canvasElem;

  constructor() {
    super('muigui-canvas');
    this.#canvasElem = this.add(
      new ElementView('canvas', 'muigui-canvas'),
    ).domElement;
  }
  get canvas() {
    return this.#canvasElem;
  }
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = v => v >= 0 ? v % 1 : 1 - (v % 1);

const f0 = v => +v.toFixed(0);  // converts to string (eg 1.2 => "1"), then converts back to number (eg, "1.200" => 1.2)
const f3 = v => +v.toFixed(3);  // converts to string (eg 1.2 => "1.200"), then converts back to number (eg, "1.200" => 1.2)

const hexToUint32RGB = v => (parseInt(v.substring(1, 3), 16) << 16) |
                            (parseInt(v.substring(3, 5), 16) << 8 ) |
                            (parseInt(v.substring(5, 7), 16)      );
const uint32RGBToHex = v => `#${(Math.round(v)).toString(16).padStart(6, '0')}`;

const hexToUint8RGB = v => [
    parseInt(v.substring(1, 3), 16),
    parseInt(v.substring(3, 5), 16),
    parseInt(v.substring(5, 7), 16),
];
const uint8RGBToHex = v => `#${Array.from(v).map(v => v.toString(16).padStart(2, '0')).join('')}`;

const hexToFloatRGB = v => hexToUint8RGB(v).map(v => f3(v / 255));
const floatRGBToHex = v => uint8RGBToHex(Array.from(v).map(v => Math.round(clamp(v * 255, 0, 255))));

const hexToObjectRGB = v => ({
  r: parseInt(v.substring(1, 3), 16) / 255,
  g: parseInt(v.substring(3, 5), 16) / 255,
  b: parseInt(v.substring(5, 7), 16) / 255,
});
const scaleAndClamp = v => clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, '0');
const objectRGBToHex = v => `#${scaleAndClamp(v.r)}${scaleAndClamp(v.g)}${scaleAndClamp(v.b)}`;

const hexToCssRGB = v => `rgb(${hexToUint8RGB(v).join(', ')})`;
const cssRGBRegex = /^\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/;
const cssRGBToHex = v => {
  const m = cssRGBRegex.exec(v);
  return uint8RGBToHex([m[1], m[2], m[3]].map(v => parseInt(v)));
};

const hexToCssHSL = v => {
  const hsl = rgbUint8ToHsl(hexToUint8RGB(v)).map(v => f0(v));
  return `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
};
const cssHSLRegex = /^\s*hsl\(\s*(\d+)(?:deg|)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)\s*$/;

const hex3DigitTo6Digit = v => `${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
const cssHSLToHex = v => {
  const m = cssHSLRegex.exec(v);
  const rgb = hslToRgbUint8([m[1], m[2], m[3]].map(v => parseFloat(v)));
  return uint8RGBToHex(rgb);
};

const euclideanModulo = (v, n) => ((v % n) + n) % n;

function hslToRgbUint8([h, s, l]) {
  h = euclideanModulo(h, 360);
  s = clamp(s / 100, 0, 1);
  l = clamp(l / 100, 0, 1);

  const a = s * Math.min(l, 1 - l);

  function f(n) {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  }

  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}

function rgbFloatToHsl01([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (min + max) * 0.5;
  const d = max - min;
  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = (l === 0 || l === 1)
        ? 0
        : (max - l) / Math.min(l, 1 - l);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4;
    }
  }

  return [h / 6, s, l];
}

const rgbUint8ToHsl = (rgb) => {
  const [h, s, l] = rgbFloatToHsl01(rgb.map(v => v / 255));
  return [h * 360, s * 100, l * 100];
};

function hsv01ToRGBFloat([hue, sat, val]) {
  sat = clamp(sat, 0, 1);
  val = clamp(val, 0, 1);
  return [hue, hue + 2 / 3, hue + 1 / 3].map(
      v => lerp(1, clamp(Math.abs(fract(v) * 6 - 3.0) - 1, 0, 1), sat) * val
  );
}

const round3 = v => Math.round(v * 1000) / 1000;

function rgbFloatToHSV01([r, g, b]) {
  const p = b > g
      ? [b, g, -1, 2 / 3]
      : [g, b, 0, -1 / 3];
  const q = p[0] > r
      ? [p[0], p[1], p[3], r]
      : [r, p[1], p[2], p[0]];
  const d = q[0] - Math.min(q[3], q[1]);
  return [
    Math.abs(q[2] + (q[3] - q[1]) / (6 * d + Number.EPSILON)),
    d / (q[0] + Number.EPSILON),
    q[0],
  ].map(round3);
}

window.hsv01ToRGBFloat = hsv01ToRGBFloat;
window.rgbFloatToHSV01 = rgbFloatToHSV01;

const cssStringFormats = [
  { re: /^#(?:[0-9a-f]){6}$/i, format: 'hex6' },
  { re: /^(?:[0-9a-f]){6}$/i, format: 'hex6-no-hash' },
  { re: /^#(?:[0-9a-f]){3}$/i, format: 'hex3' },
  { re: /^(?:[0-9a-f]){3}$/i, format: 'hex3-no-hash' },
  { re: cssRGBRegex, format: 'css-rgb' },
  { re: cssHSLRegex, format: 'css-hsl' },
];

function guessStringColorFormat(v) {
  for (const formatInfo of cssStringFormats) {
    if (formatInfo.re.test(v)) {
      return formatInfo;
    }
  }
  return undefined;
}

function guessFormat(v) {
  switch (typeof v) {
    case 'number':
      return 'uint32-rgb';
    case 'string': {
      const formatInfo = guessStringColorFormat(v.trim());
      if (formatInfo) {
        return formatInfo.format;
      }
      break;
    }
    case 'object':
      if (v instanceof Uint8Array || v instanceof Uint8ClampedArray) {
        if (v.length === 3) {
          return 'uint8-rgb';
        }
      } else if (v instanceof Float32Array) {
        if (v.length === 3) {
          return 'float-rgb';
        }
      } else if (Array.isArray(v)) {
        if (v.length === 3) {
          return 'float-rgb';
        }
      } else {
        if ('r' in v && 'g' in v && 'b' in v) {
          return 'object-rgb';
        }
      }
  }
  throw new Error(`unknown color format: ${v}`);
}

function fixHex6(v) {
  return v.trim(v);
  //const formatInfo = guessStringColorFormat(v.trim());
  //const fix = formatInfo ? formatInfo.fix : v => v;
  //return fix(v.trim());
}

function hex6ToHex3(hex6) {
  return (hex6[1] === hex6[2] &&
          hex6[3] === hex6[4] &&
          hex6[5] === hex6[6])
      ? `#${hex6[1]}${hex6[3]}${hex6[5]}`
      : hex6;
}

const hex3RE = /^(#|)([0-9a-f]{3})$/i;
function hex3ToHex6(hex3) {
  const m = hex3RE.exec(hex3);
  if (m) {
    const [, , m2] = m;
    return `#${hex3DigitTo6Digit(m2)}`;
  }
  return hex3;
}

function fixHex3(v) {
  return hex6ToHex3(fixHex6(v));
}

const strToRGBObject = (s) => {
  try {
    const json = s.replace(/([a-z])/g, '"$1"');
    const rgb = JSON.parse(json);
    if (Number.isNaN(rgb.r) || Number.isNaN(rgb.g) || Number.isNaN(rgb.b)) {
      throw new Error('not {r, g, b}');
    }
    return [true, rgb];
  } catch (e) {
    return [false];
  }
};

const strToCssRGB = s => {
  const m = cssRGBRegex.exec(s);
  if (!m) {
    return [false];
  }
  const v = [m[1], m[2], m[3]].map(v => parseInt(v));
  const outOfRange = v.find(v => v > 255);
  return [!outOfRange, `rgb(${v.join(', ')})`];
};

const strToCssHSL = s => {
  const m = cssHSLRegex.exec(s);
  if (!m) {
    return [false];
  }
  const v = [m[1], m[2], m[3]].map(v => parseFloat(v));
  const outOfRange = v.find(v => Number.isNaN(v));
  return [!outOfRange, `hsl(${v[0]}, ${v[1]}%, ${v[2]}%)`];
};

const rgbObjectToStr = rgb => {
  return `{r:${f3(rgb.r)}, g:${f3(rgb.g)}, b:${f3(rgb.b)}}`;
};

const strTo3IntsRE = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/;
const strTo3Ints = s => {
  const m = strTo3IntsRE.exec(s);
  if (!m) {
    return [false];
  }
  const v = [m[1], m[2], m[3]].map(v => parseInt(v));
  const outOfRange = v.find(v => v > 255);
  return [!outOfRange, v];
};

const strTo3Floats = s => {
  const numbers = s.split(',').map(s => s.trim());
  const v = numbers.map(v => parseFloat(v));
  if (v.length !== 3) {
    return [false];
  }
  // Note: using isNaN not Number.isNaN
  const badNdx = numbers.findIndex(v => isNaN(v));
  return [badNdx < 0, v.map(v => f3(v))];
};

const strToUint32RGBRegex = /^\s*(?:0x){0,1}([0-9a-z]{1,6})\s*$/i;
const strToUint32RGB = s => {
  const m = strToUint32RGBRegex.exec(s);
  if (!m) {
    return [false];
  }
  return [true, parseInt(m[1], 16)];
};

const hexRE = /^\s*#[a-f0-9]{6}\s*$|^\s*#[a-f0-9]{3}\s*$/i;
const hexNoHashRE = /^\s*[a-f0-9]{6}\s*$/i;

// For each format converter
//
// fromHex/toHex convert from/to '#RRGGBB'
//
//  fromHex converts from the string '#RRBBGG' to the format
//     (eg: for uint32-rgb, '#123456' becomes 0x123456)
//
//  toHex converts from the format to '#RRGGBB'
//     (eg: for uint8-rgb, [16, 33, 50] becomes '#102132')
//
//
// fromStr/toStr convert from/to what's in the input[type=text] element
//
//  toStr converts from the format to its string representation
//     (eg, for object-rgb, {r: 1, g: 0.5, b:0} becomes "{r: 1, g: 0.5, b:0}")
//                           ^object                     ^string
//
//  fromStr converts its string representation to its format
//     (eg, for object-rgb) "{r: 1, g: 0.5, b:0}" becomes {r: 1, g: 0.5, b:0})
//                           ^string                      ^object
//     fromString returns an array which is [valid, v]
//     where valid is true if the string was a valid and v is the converted
//     format if v is true.
//
// Note: toStr should convert to "ideal" form (whatever that is).
//    (eg, for css-rgb
//    "{   r:  0.10000, g: 001, b:    0}" becomes "{r: 0.1, g: 1, b: 0}"
//    notice that css-rgb is a string to a string
//    )
const colorFormatConverters = {
  'hex6': {
    color: {
      from: v => [true, v],
      to: fixHex6,
    },
    text: {
      from: v => [hexRE.test(v), v.trim()],
      to: v => v,
    },
  },
  'hex3': {
    color: {
      from: v => [true, fixHex3(v)],
      to: hex3ToHex6,
    },
    text: {
      from: v => [hexRE.test(v), hex6ToHex3(v.trim())],
      to: v => v,
    },
  },
  'hex6-no-hash': {
    color: {
      from: v => [true, v.substring(1)],
      to: v => `#${fixHex6(v)}`,
    },
    text: {
      from: v => [hexNoHashRE.test(v), v.trim()],
      to: v => v,
    },
  },
  'hex3-no-hash': {
    color: {
      from: v => [true, fixHex3(v).substring(1)],
      to: hex3ToHex6,
    },
    text: {
      from: v => [hexNoHashRE.test(v), hex6ToHex3(v.trim())],
      to: v => v,
    },
  },
  'uint32-rgb': {
    color: {
      from: v => [true, hexToUint32RGB(v)],
      to: uint32RGBToHex,
    },
    text: {
      from: v => strToUint32RGB(v),
      to: v => `0x${v.toString(16).padStart(6, '0')}`,
    },
  },
  'uint8-rgb': {
    color: {
      from: v => [true, hexToUint8RGB(v)],
      to: uint8RGBToHex,
    },
    text: {
      from: strTo3Ints,
      to: v => v.join(', '),
    },
  },
  'float-rgb': {
    color: {
      from: v => [true, hexToFloatRGB(v)],
      to: floatRGBToHex,
    },
    text: {
      from: strTo3Floats,
      // need Array.from because map of Float32Array makes a Float32Array
      to: v => Array.from(v).map(v => f3(v)).join(', '),
    },
  },
  'object-rgb': {
    color: {
      from: v => [true, hexToObjectRGB(v)],
      to: objectRGBToHex,
    },
    text: {
      from: strToRGBObject,
      to: rgbObjectToStr,
    },
  },
  'css-rgb': {
    color: {
      from: v => [true, hexToCssRGB(v)],
      to: cssRGBToHex,
    },
    text: {
      from: strToCssRGB,
      to: v => strToCssRGB(v)[1],
    },
  },
  'css-hsl': {
    color: {
      from: v => [true, hexToCssHSL(v)],
      to: cssHSLToHex,
    },
    text: {
      from: strToCssHSL,
      to: v => strToCssHSL(v)[1],
    },
  },
};

class ColorView extends EditView {
  #to;
  #from;
  #colorElem;
  #skipUpdate;
  #options = {
    converters: identity,
  };

  constructor(setter, options) {
    const colorElem = createElem('input', {
      type: 'color',
      onInput: () => {
        const [valid, newV] = this.#from(colorElem.value);
        if (valid) {
          this.#skipUpdate = true;
          setter.setValue(newV);
        }
      },
      onChange: () => {
        const [valid, newV] = this.#from(colorElem.value);
        if (valid) {
          this.#skipUpdate = true;
          setter.setFinalValue(newV);
        }
      },
    });
    super(createElem('div', {}, [colorElem]));
    this.setOptions(options);
    this.#colorElem = colorElem;
  }
  updateDisplay(v) {
    if (!this.#skipUpdate) {
      this.#colorElem.value = this.#to(v);
    }
    this.#skipUpdate = false;
  }
  setOptions(options) {
    copyExistingProperties(this.#options, options);
    const {converters: {to, from}} = this.#options;
    this.#to = to;
    this.#from = from;
    return this;
  }
}

class Color extends ValueController {
  #colorView;
  #textView;

  constructor(object, property, options = {}) {
    super(object, property, 'muigui-color');
    const format = options.format || guessFormat(this.getValue());
    const {color, text} = colorFormatConverters[format];
    this.#colorView = this.add(new ColorView(this, {converters: color}));
    this.#textView = this.add(new TextView(this, {converters: text}));
    this.updateDisplay();
  }
  setOptions(options) {
    const {format} = options;
    if (format) {
      const {color, text} = colorFormatConverters[format];
      this.#colorView.setOptions({converters: color});
      this.#textView.setOptions({converters: text});
    }
    super.setOptions(options);
    return this;
  }
}

// This feels like it should be something else like
// gui.addController({className: 'muigui-divider')};
class Divider extends Controller {
  constructor() {
    super('muigui-divider');
  }
}

class Container extends Controller {
  #controllers;
  #childDestController;

  constructor(className) {
    super(className);
    this.#controllers = [];
    this.#childDestController = this;
  }
  get children() {
    return this.#controllers; // should we return a copy?
  }
  get controllers() {
    return this.#controllers.filter(c => !(c instanceof Container));
  }
  get folders() {
    return this.#controllers.filter(c => c instanceof Container);
  }
  reset(recursive = true) {
    for (const controller of this.#controllers) {
      if (!(controller instanceof Container) || recursive) {
        controller.reset(recursive);
      }
    }
    return this;
  }
  remove(controller) {
    const ndx = this.#controllers.indexOf(controller);
    if (ndx >= 0) {
      const c = this.#controllers.splice(ndx, 1);
      const c0 = c[0];
      const elem = c0.domElement;
      elem.remove();
      c0.setParent(null);
    }
    return this;
  }
  _addControllerImpl(controller) {
    this.domElement.appendChild(controller.domElement);
    this.#controllers.push(controller);
    controller.setParent(this);
    return controller;
  }
  addController(controller) {
    return this.#childDestController._addControllerImpl(controller);
  }
  pushContainer(container) {
    this.addController(container);
    this.#childDestController = container;
    return container;
  }
  popContainer() {
    this.#childDestController = this.#childDestController.parent;
    return this;
  }
}

class Folder extends Container {
  #labelElem;

  constructor(name = 'Controls', className = 'muigui-menu') {
    super(className);
    this.#labelElem = createElem('label');
    this.addElem(createElem('button', {
      type: 'button',
      onClick: () => this.toggleOpen(),
    }, [this.#labelElem]));
    this.pushContainer(new Container());
    this.name(name);
    this.open();
  }
  open(open = true) {
    this.domElement.classList.toggle('muigui-closed', !open);
    this.domElement.classList.toggle('muigui-open', open);
    return this;
  }
  close() {
    return this.open(false);
  }
  name(name) {
    this.#labelElem.textContent = name;
    return this;
  }
  title(title) {
    return this.name(title);
  }
  toggleOpen() {
    this.open(!this.domElement.classList.contains('muigui-open'));
    return this;
  }
}

// This feels like it should be something else like
// gui.addDividing = new Controller()
class Label extends Controller {
  constructor(text) {
    super('muigui-label');
    this.text(text);
  }
  text(text) {
    this.domElement.textContent = text;
    return this;
  }
}

let stylesInjected = false;
const styleElem = createElem('style');

class GUIFolder extends Folder {
  add(object, property, ...args) {
    const controller = object instanceof Controller
        ? object
        : createController(object, property, ...args);
    return this.addController(controller);
  }
  addCanvas(name) {
    return this.addController(new Canvas(name));
  }
  addColor(object, property, ...args) {
    return this.addController(new Color(object, property, ...args));
  }
  addDivider() {
    return this.addController(new Divider());
  }
  addFolder(name) {
    return this.addController(new GUIFolder(name));
  }
  addLabel(text) {
    return this.addController(new Label(text));
  }
}

class GUI extends GUIFolder {
  constructor(options = {}) {
    super('Controls', 'muigui-root');
    if (options instanceof HTMLElement) {
      options = {parent: options};
    }
    const {
      autoPlace = true,
      width,
      title = 'Controls',
      injectStyles = true,
    } = options;
    let {
      parent,
    } = options;
    if (injectStyles && !stylesInjected) {
      stylesInjected = true;
      (document.head || document.documentElement).appendChild(styleElem);
      styleElem.textContent = css;
    }
    if (width) {
      this.domElement.style.width = /^\d+$/.test(width) ? `${width}px` : width;
    }
    if (parent === undefined && autoPlace) {
      parent = document.body;
      this.domElement.classList.add('muigui-auto-place');
    }
    if (parent) {
      parent.appendChild(this.domElement);
    }
    if (title) {
      this.title(title);
    }
    this.domElement.classList.add('muigui');
  }
}

export { GUI as default };
