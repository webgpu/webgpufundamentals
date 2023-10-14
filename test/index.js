/* global mocha */
import './tests/data-byte-diagram-tests.js';

const settings = typeof window === 'undefined' ? {} : Object.fromEntries(new URLSearchParams(window.location.search).entries());
if (settings.reporter) {
  mocha.reporter(settings.reporter);
}
if (settings.grep) {
  mocha.grep(new RegExp(settings.grep, 'i'), false);
}

mocha.run((failures) => {
  window.testsPromiseInfo.resolve(failures);
});
