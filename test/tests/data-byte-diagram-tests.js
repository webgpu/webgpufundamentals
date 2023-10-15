import { describe, it } from '../mocha-support.js';
import {
    makeShaderDataDefinitions,
} from '/3rdparty/webgpu-utils.module.js';
import { assertEqual } from '../assert.js';
import { getCodeForUniform } from '../../webgpu/lessons/resources/data-byte-diagram.js';

// normalize whitespace. Keep lines except for first and last so it's easier to read
function trimCode(s) {
  return s.trim().replace(/ +/g, ' ').replace(/\n +/g, '\n');
}

// Compare 2 strings as code, white space insignificant.
function assertCodeEqual(a, b) {
  const _a = trimCode(a);
  const _b = trimCode(b);
  assertEqual(_a, _b);
}

describe('data-byte-diagram-tests', () => {

    it('generates struct views', () => {
        const shader = `
          struct Uniforms {
              foo: u32,
              bar: f32,
              moo: array<i32, 6>,
          };
          @group(4) @binding(1) var<uniform> uni1: Uniforms;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition);
        assertCodeEqual(code, `
          const fooValues = new ArrayBuffer(32);
          const fooViews = {
            foo: new Uint32Array(fooValues, 0, 1),
            bar: new Float32Array(fooValues, 4, 1),
            moo: new Int32Array(fooValues, 8, 6),
          };
        `);
    });

    it('generates struct offsets', () => {
        const shader = `
          struct Uniforms {
              foo: u32,
              bar: f32,
              moo: array<i32, 6>,
          };
          @group(4) @binding(1) var<uniform> uni1: Uniforms;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition, 'offsets');
        assertCodeEqual(code, `
          const fooSize = 32;
          const fooInfo = {
              foo: { type: Uint32Array, byteOffset: 0, length: 1 },
              bar: { type: Float32Array, byteOffset: 4, length: 1 },
              moo: { type: Int32Array, byteOffset: 8, length: 6 },
          };
        `);
    });

    it('generates intrinsic views', () => {
        const shader = `
          @group(4) @binding(1) var<uniform> uni1: vec3f;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition);
        assertCodeEqual(code, `
          const fooValues = new ArrayBuffer(12);
          const fooView = new Float32Array(fooValues);
        `);
    });

    it('generates intrinsic view array', () => {
        const shader = `
          @group(4) @binding(1) var<uniform> uni1: array<vec3f, 3>;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition);
        assertCodeEqual(code, `
          const fooValues = new ArrayBuffer(48);
          const fooView = new Float32Array(fooValues);
        `);
    });

    it('generates intrinsic view array of array', () => {
        const shader = `
          @group(4) @binding(1) var<uniform> uni1: array<array<vec3f, 3>, 3>;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition);
        assertCodeEqual(code, `
          const fooValues = new ArrayBuffer(144);
          const fooViews = [
            new Float32Array(fooValues, 0, 12),
            new Float32Array(fooValues, 48, 12),
            new Float32Array(fooValues, 96, 12),
          ];
        `);
    });

    it('generates correct types', () => {
        const shader = `
          struct Uni {
              uni1: vec2i,
              uni2: vec2u,
              uni3: vec2f,
              uni4: vec2h,
              uni5: vec2<i32>,
              uni6: vec2<u32>,
              uni7: vec2<f32>,
              uni8: vec2<f16>,
          };
          @group(0) @binding(0) var<uniform> uni1: Uni;
        `;
        const d = makeShaderDataDefinitions(shader);
        const code = getCodeForUniform('foo', d.uniforms.uni1.typeDefinition);
        assertCodeEqual(code, `
          const fooValues = new ArrayBuffer(64);
          const fooViews = {
            uni1: new Int32Array(fooValues, 0, 2),
            uni2: new Uint32Array(fooValues, 8, 2),
            uni3: new Float32Array(fooValues, 16, 2),
            uni4: new Uint16Array(fooValues, 24, 2),
            uni5: new Float32Array(fooValues, 32, 2),
            uni6: new Int32Array(fooValues, 40, 2),
            uni7: new Uint32Array(fooValues, 48, 2),
            uni8: new Uint16Array(fooValues, 56, 4),
          };
        `);

    });

});

