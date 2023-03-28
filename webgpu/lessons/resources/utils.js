// yea, gross
export const range = (n, fn) => new Array(n).fill(0).map((_, i) => fn(i));

const kebabRE = /-([a-z])/g;
export function kebabCaseToCamelCase(s) {
  return s.replace(kebabRE, (_, m1) => m1.toUpperCase());
}

export function convertHexToBytes(text) {
  const array = [];
  for (let i = 0; i < text.length; i += 2) {
    const tmpHex = text.substring(i, i + 2);
    array.push(parseInt(tmpHex, 16));
  }
  return array;
}

export function convertBytesToHex(byteArray) {
  let hex = '';
  const il = byteArray.length;
  for (let i = 0; i < il; i++) {
    if (byteArray[i] < 0) {
      byteArray[i] = byteArray[i] + 256;
    }
    let tmpHex = byteArray[i].toString(16);
    // add leading zero
    if (tmpHex.length === 1) {
      tmpHex = '0' + tmpHex;
    }
    hex += tmpHex;
  }
  return hex;
}
