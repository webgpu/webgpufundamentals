/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

// eslint-disable-next-line strict
'use strict';

const refs = require('./external-refs.js');

async function check() {
  for (const [name, url] of Object.entries(refs)) {
    const res = await fetch(url);
    console.log(res.status, name, url);
  }
}

check();