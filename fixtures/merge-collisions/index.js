import { shared as sharedA, helperA } from './a.js';
import { shared as sharedB, helperB } from './b.js';
import { useShared, meta } from './c.js';

console.log(sharedA(), sharedB(), helperA(), helperB(), useShared(), meta);
