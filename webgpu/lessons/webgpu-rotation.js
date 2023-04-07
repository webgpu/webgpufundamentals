import {
  renderDiagrams
} from './resources/diagrams.js';
import {
  createElem as el,
} from './resources/elem.js';
import UnitCircle from '../resources/js/unit-circle.js';

renderDiagrams({
  'unit-circle': (elem) => {
    const div = el('div');
    elem.appendChild(div);
    const circle = new UnitCircle();
    div.appendChild(circle.domElement);
  },
});