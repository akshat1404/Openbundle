import { OTHER_VALUE } from './config.js';

function format(name) {
  return `${OTHER_VALUE}: ${name}`;
}

export function funcB(name) {
  return format(name);
}
