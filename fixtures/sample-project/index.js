import { funcA } from './utilsA.js';
import { funcB } from './utilsB.js';

console.log(funcB('x'), funcA(5));

async function loadA() { const { runFeatureA } = await import('./featureA.js'); return runFeatureA(); }
async function loadB() { const { runFeatureB } = await import('./featureB.js'); return runFeatureB(); }

document.getElementById('a')?.addEventListener('click', loadA);
document.getElementById('b')?.addEventListener('click', loadB);
