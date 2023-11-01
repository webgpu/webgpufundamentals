/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

// eslint-disable-next-line strict
'use strict';

/*
Copyright 2018, Greggman.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.

    * Neither the name of Greggman. nor the names of their
      contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const fs = require('fs');
const path = require('path');

function mkdir(dirPath) {
  if (!fileExists(dirPath)) {
    fs.mkdirSync(dirPath);
  }
}

function getDataDirPath(dirName) {
  if (process.platform.toLowerCase() === 'darwin') {
    return path.join(process.env.HOME, 'Library', 'Application Support', dirName);
  } else if (process.platform.substring(0, 3).toLowerCase() === 'win') {
    return path.join(process.env.LOCALAPPDATA || process.env.APPDATA, dirName);
  } else {
    //const configDir = path.join(process.env.HOME, '.config');
    return path.join(process.env.HOME, dirName);
  }
}

function fileExists(filename) {
  try {
    const stat = fs.statSync(filename);
    return !!stat;
  } catch (e) {
    return false;
  }
}

function getDataDir(dirName) {
  const dataDir = getDataDirPath(dirName);
  mkdir(dataDir);
  return dataDir;
}

module.exports = getDataDir;
