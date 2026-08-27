import { SOME_VALUE } from './config.js';

function format(n) {
  return n.toFixed(2);
}

export function funcA(x) {
  return format(x + SOME_VALUE);
}
