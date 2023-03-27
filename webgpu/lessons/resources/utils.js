// yea, gross
export const range = (n, fn) => new Array(n).fill(0).map((_, i) => fn(i));

const kebabRE = /-([a-z])/g;
export function kebabCaseToCamelCase(s) {
  return s.replace(kebabRE, (_, m1) => m1.toUpperCase());
}