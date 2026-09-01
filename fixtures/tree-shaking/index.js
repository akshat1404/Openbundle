import { runA } from './chain.js';

function unusedHelper() {
  return 'never called';
}

function sideEffect() {
  console.log('side effect ran');
}

console.log('result:', runA());

5 + 3;
sideEffect();
