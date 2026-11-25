// Carga lo compilado con Node: detecta importaciones que solo fallan al ejecutar, no al compilar.
import { pathToFileURL } from 'node:url';

const ENTRIES = ['packages/core/dist/index.js', 'packages/verticals/dist/index.js', 'apps/api/dist/app.js'];

for (const entry of ENTRIES) {
  await import(pathToFileURL(entry).href);
}
console.log('Lo compilado se puede ejecutar.');
