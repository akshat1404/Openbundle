/**
 * Built-in sample project shown by default, before any upload.
 * Same files verified against real Rollup output during design;
 * later stages test the engine against this exact set.
 */
export interface SampleFile {
  path: string;
  contents: string;
}

export const SAMPLE_PROJECT: SampleFile[] = [
  {
    path: "index.js",
    contents: `import { funcA } from './utilsA.js';
import { funcB } from './utilsB.js';

console.log(funcB('x'), funcA(5));

async function loadA() { const { runFeatureA } = await import('./featureA.js'); return runFeatureA(); }
async function loadB() { const { runFeatureB } = await import('./featureB.js'); return runFeatureB(); }
`,
  },
  {
    path: "config.js",
    contents: `export const SOME_VALUE = 10;
export const OTHER_VALUE = "hello";
export const UNUSED_FLAG = true;
`,
  },
  {
    path: "utilsA.js",
    contents: `import { SOME_VALUE } from './config.js';

function format(n) {
  return n.toFixed(2);
}

export function funcA(x) {
  return format(x + SOME_VALUE);
}
`,
  },
  {
    path: "utilsB.js",
    contents: `import { OTHER_VALUE } from './config.js';

function format(name) {
  return \`\${OTHER_VALUE}: \${name}\`;
}

export function funcB(name) {
  return format(name);
}
`,
  },
  {
    path: "sharedHelper.js",
    contents: `export function helper(x) {
  return \`processed(\${x})\`;
}
`,
  },
  {
    path: "featureA.js",
    contents: `import { helper } from './sharedHelper.js';

export function runFeatureA() {
  return helper('A');
}
`,
  },
  {
    path: "featureB.js",
    contents: `import { helper } from './sharedHelper.js';

export function runFeatureB() {
  return helper('B');
}
`,
  },
];
