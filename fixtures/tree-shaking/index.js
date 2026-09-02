import { runA } from './chain.js';
import { ONLY_USED_BY_DEAD_CODE } from './config.js';

function unusedHelper() {
  return 'never called';
}

function sideEffect() {
  console.log('side effect ran');
}

console.log('result:', runA());

5 + 3;
sideEffect();

ONLY_USED_BY_DEAD_CODE * 2;
