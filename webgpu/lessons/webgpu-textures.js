import {
  renderDiagrams
} from './resources/diagrams.js';
import { SVG as svg } from '/3rdparty/svg.esm.js';
import {
  rgba8unormFromCSS,
  hsl,
  clamp,
  clamp01,
  euclideanModulo,
} from './resources/utils.js';
import {
  createElem as el, radio,
} from './resources/elem.js';

const rgba8unorm = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a / 255})`;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpArray = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

renderDiagrams({
  'linear-interpolation': (elem) => {
    const diagramDiv = el('div');
    const uiDiv = el('div');
    const div = el('div', {}, [diagramDiv, uiDiv]);
    elem.appendChild(div);
    const texelSize = 100;
    const tw = 4;
    const th = 4;
    const hSize = texelSize / 2;
    const w = tw * texelSize;
    const h = th * texelSize;
    const totalWidth = w + 100;
    const totalHeight = h + 180;
    const pixelsOffX = 50;
    const draw = svg().addTo(diagramDiv).viewbox(0, 0, totalWidth, totalHeight);
    draw.css({cursor: 'pointer'});
    const repeat = [false, false];

    const marker = draw.marker(20, 8, function(add) {
      add.polygon([0, 0, 10, 4, 0, 8]).fill('#000').attr({orient: 'auto'});
    });
    const marker2 = draw.marker(40, 16, function(add) {
      add.polygon([0, 0, 20, 8, 0, 16]).addClass('svg-main-text-color-fill').attr({orient: 'auto'});
    });

    const makeText = (parent, t) => {
      return parent.text(t)
        .font({
          family: 'monospace',
          weight: 'bold',
          size: '14',
        })
        .css({
          filter: `
            drop-shadow( 1px  0px 0px #fff) 
            drop-shadow( 0px  1px 0px #fff) 
            drop-shadow(-1px  0px 0px #fff) 
            drop-shadow( 0px -1px 0px #fff) 
          `,
        });
    };

    const colors = [];
    const numHues = tw * (th - 1);
    for (let h = 0; h < numHues; ++h) {
      colors.push(rgba8unormFromCSS(hsl(h / numHues, 1, 0.5)));
    }
    for (let v = 0; v < tw; ++v) {
      colors.push(rgba8unormFromCSS(hsl(0, 0, v / (tw - 1))));
    }

    const mask = draw.rect(w, h).move(pixelsOffX, 0).fill('#fff');

    const bg = draw.group();
    colors.forEach((color, i) => {
      const x = (i % tw) * texelSize;
      const y = (i / tw | 0) * texelSize;
      bg.rect(texelSize, texelSize).fill(rgba8unorm(...color)).move(x, y);
      bg.circle(5).fill('#fff').center(x + hSize, y + hSize).css({'mix-blend-mode': 'difference'});
    });
    bg.move(pixelsOffX, 0);

    const point = draw.group();
    //point.line([-10, 0, 10, 0]).stroke({color: '#000', width: '2'});
    //point.line([0, -10, 0, 10]).stroke({color: '#000', width: '2'});
    const texCoordGroup = point.group();
    const texCoord = makeText(texCoordGroup, 'aa');

    const sampleSize = 32;
    const samplesTop = th * texelSize + 20;

    const makeMix = function() {
      const spacing = 5;
      const mg = draw.group();
      mg.text('= mix(').move(0, 0).attr({
        'dominant-baseline': 'middle',
      }).addClass('svg-main-text-color-fill');
      const inColor0 = mg.rect(sampleSize, sampleSize).fill('#000').stroke('#000');
      inColor0.move(mg.bbox().width + spacing);
      mg.text(',').move(mg.bbox().width + spacing, 0).attr({
        'dominant-baseline': 'middle',
      }).addClass('svg-main-text-color-fill');
      const inColor1 = mg.rect(sampleSize, sampleSize).fill('#000').stroke('#000');
      inColor1.move(mg.bbox().width + spacing);
      const mixAmount = mg.text(', t1(0))').move(mg.bbox().width + spacing, 0).attr({
        'dominant-baseline': 'middle',
      }).addClass('svg-main-text-color-fill');
      return {
        group: mg,
        inColor0,
        inColor1,
        mixAmount,
      };
    };

    const mixXOff = 240;
    const mix0 = makeMix();
    mix0.group.move(mixXOff, samplesTop);
    const mix1 = makeMix();
    mix1.group.move(mixXOff, samplesTop + 40);
    const texels = [mix0.inColor0, mix0.inColor1, mix1.inColor0, mix1.inColor1];

    const resultY = samplesTop + 100;
    draw.text('result').move(0, resultY).attr({
      'dominant-baseline': 'middle',
    }).addClass('svg-main-text-color-fill');
    const result = draw.rect(sampleSize, sampleSize).fill('#000').stroke('#000');
    result.move(50, resultY);
    const mixF = makeMix();
    mixF.group.move(result.bbox().x2 + 5, resultY);

    const makeArrow = (a, b) => {
      const b0 = a.bbox();
      const b1 = b.bbox();
      const arrow = draw.path(`M${b0.x - 5},${b0.cy} C${b1.cx},${b0.cy} ${b1.cx},${b0.cy},${b1.cx},${b1.y}}`)
        .fill('none')
        .addClass('svg-main-text-color-stroke');
      arrow.marker('end', marker2);
      return arrow;
    };

    makeArrow(mix0.group, mixF.inColor0);
    makeArrow(mix1.group, mixF.inColor1);

    const numPoints = 4;
    const infos = [];
    const boxes = [];
    for (let i = 0; i < numPoints; ++i) {
      const texel = texels[i];
      const line = draw
        .line(10, 10 + i * 10, texel.cx(), texel.cy())
        .stroke({color: '#000', width: 1})
        .css({
          opacity: 0.25,
          filter: `
            drop-shadow(-0.5px  0px 0px #fff) 
            drop-shadow( 0.5px  0px 0px #fff) 
            drop-shadow( 0px -0.5px 0px #fff)
            drop-shadow( 0px  0.5px 0px #fff)
          `,});
      line.marker('end', marker);

      infos.push({ line, texel });

      boxes.push(
        bg.rect(texelSize, texelSize)
          .fill('none')
          .stroke({color: '#ffffff80', width: 1})
          .css({'mix-blend-mode': 'difference'})
      );
    }

    const t1Line = bg.group();
    t1Line.line(0, 0, 0, texelSize).stroke('#000').css({
      filter: `
        drop-shadow(-1px  0px 0px #fff)
        drop-shadow( 1px  0px 0px #fff)
      `,
    });
    const t1Text = makeText(draw, 't1').font({anchor: 'middle'});
    const t2Line = bg.group();
    t2Line.line(0, 0, texelSize, 0).stroke('#000').css({
      filter: `
        drop-shadow( 0px -1px 0px #fff)
        drop-shadow( 0px  1px 0px #fff)
      `,
    });
    const t2Text = makeText(draw, 't2');

    bg.clipWith(mask);

    const f2 = v => v.toFixed(2);
    const setTranslation = (e, x, y) => e.attr({transform: `translate(${x}, ${y})`});
    const size = [tw, th];
    const clampOrRepeat = (ndx, v) => {
      const s = size[ndx];
      return repeat[ndx] ? v : clamp(v, 0.5 / s, 1 - 0.5 / s);
    };

    uiDiv.appendChild(el('div', {}, [
      radio('addressModeU', ['repeat', 'clamp-to-edge'], 'repeat', v => {
        repeat[0] = v === 'repeat';
        update();
      }),
      radio('addressModeV', ['repeat', 'clamp-to-edge'], 'repeat', v => {
        repeat[1] = v === 'repeat';
        update();
      }),
    ]));

    let mouseX = texelSize * 1.3;
    let mouseY = texelSize * 1.4;

    function onMove(e) {
      e.preventDefault();

      mouseX = e.offsetX * totalWidth / draw.node.clientWidth - 50;
      mouseY = e.offsetY * totalHeight / draw.node.clientHeight;

      update();
    }

    function update() {
      const u = clampOrRepeat(0, clamp01(mouseX / (texelSize * tw)));
      const v = clampOrRepeat(1, clamp01(mouseY / (texelSize * th)));

      setTranslation(point, pixelsOffX + u * texelSize * tw, v * texelSize * th);

      const t1 = euclideanModulo(u * tw + 0.5, 1);
      const t2 = euclideanModulo(v * th + 0.5, 1);
      mix0.mixAmount.text(`, t1(${f2(t1)}))`);
      mix1.mixAmount.text(`, t1(${f2(t1)}))`);
      mixF.mixAmount.text(`, t2(${f2(t2)}))`);

      texCoord.text(`uv:${f2(u)},${f2(v)}`);
      setTranslation(
        texCoord,
        u < 0.75 ? 10 : (-texCoord.bbox().width - 10),
        v < 0.25 ? 50 : -10,
      );
      t1Text.text(`t1:${f2(t1)}`);
      t2Text.text(`t2:${f2(t2)}`);

      const tx = euclideanModulo(u * tw - 0.5, tw) | 0;
      const ty = euclideanModulo(v * th - 0.5, th) | 0;

      const sampledTexels = [];
      for (let i = 0; i < numPoints; ++i) {
        const {line, texel} = infos[i];
        const ox = i % 2;
        const oy = i / 2 | 0;
        const px = (tx + ox) % tw;
        const py = (ty + oy) % th;
        line.plot(px * texelSize + hSize + pixelsOffX, py * texelSize + hSize);
        const c = colors[px + py * tw];
        const cl = rgba8unorm(...c);
        texel.fill(cl);
        sampledTexels.push(c);
      }

      const c0 = lerpArray(sampledTexels[0], sampledTexels[1], t1);
      const c1 = lerpArray(sampledTexels[2], sampledTexels[3], t1);
      const fc = lerpArray(c0, c1, t2);

      mixF.inColor0.fill(rgba8unorm(...c0));
      mixF.inColor1.fill(rgba8unorm(...c1));
      result.fill(rgba8unorm(...fc));

      const offScreen = 100000;
      const offX = tx === tw - 1;
      const offY = ty === th - 1;
      setTranslation(boxes[0], pixelsOffX + tx * texelSize + hSize, ty * texelSize + hSize);
      setTranslation(boxes[1], pixelsOffX + (offX ? -hSize : offScreen), ty * texelSize + hSize);
      setTranslation(boxes[2], pixelsOffX + tx * texelSize + hSize, offY ? -hSize : offScreen);
      setTranslation(boxes[3], ...(offX && offY ? [pixelsOffX + -hSize, -hSize] : [offScreen, offScreen]));

      const tXOff = offX && t1 >= 0.5 ? -tw : 0;
      const tYOff = offY && t2 >= 0.5 ? -th : 0;
      const t1x = pixelsOffX + (tx + t1 + tXOff) * texelSize + hSize;
      const t1y = (ty + tYOff) * texelSize + hSize;
      const t2x = pixelsOffX + (tx + tXOff) * texelSize + hSize;
      const t2y = (ty + t2 + tYOff) * texelSize + hSize;
      setTranslation(t1Line, t1x, t1y);
      setTranslation(t2Line, t2x, t2y);

      setTranslation(t1Text, t1x, t1y + (tYOff ? texelSize + 20 : -10));
      setTranslation(t2Text, t2x + (tXOff ? texelSize + 10 : -70), t2y);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    draw.on('pointerdown', function(e) {
      window.addEventListener('pointermove', onMove, {passive: false});
      window.addEventListener('pointerup', onUp);
      onMove(e);
    });

    update();
  },
});
