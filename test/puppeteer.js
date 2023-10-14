#!/usr/bin/env node

import puppeteer from  'puppeteer';
import path from  'path';
import express from 'express';
import url from 'url';
const app = express();
const port = 3000;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));  // eslint-disable-line

app.use(express.static(path.dirname(__dirname)));
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
  test(port);
});

function makePromiseInfo() {
  const info = {};
  const promise = new Promise((resolve, reject) => {
    Object.assign(info, {resolve, reject});
  });
  info.promise = promise;
  return info;
}


async function test(port) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features',
      '--use-angle=swiftshader',
      '--user-agent=puppeteer',
    ],
  });
  const page = await browser.newPage();

  page.on('console', async e => {
    const args = await Promise.all(e.args().map(a => a.jsonValue()));
    console.log(...args);
  });

  let totalFailures = 0;
  let waitingPromiseInfo;

  // Get the "viewport" of the page, as reported by the page.
  page.on('domcontentloaded', async () => {
    const failures = await page.evaluate(() => {
      return window.testsPromiseInfo.promise;
    });

    totalFailures += failures;

    waitingPromiseInfo.resolve();
  });

  const urls = [
    `http://localhost:${port}/test/index.html?reporter=spec`,
  ];

  for (const url of urls) {
    waitingPromiseInfo = makePromiseInfo();
    await page.goto(url);
    await waitingPromiseInfo.promise;
  }

  await browser.close();
  server.close();

  process.exit(totalFailures ? 1 : 0);  // eslint-disable-line
}
