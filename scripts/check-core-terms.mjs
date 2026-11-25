// Falla si el núcleo reutilizable menciona términos propios de un nicho.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  'apps/api/src',
  'apps/web/app',
  'apps/web/features',
  'apps/web/lib',
  'packages/core',
  'packages/contracts',
  'packages/ui',
];
const TERMS = /\b(gamer|gaming|playstation|xbox|nintendo|videojuegos?|consolas?)\b/i;
const SKIP = new Set(['node_modules', 'dist', '.next']);

function* walk(path) {
  for (const name of readdirSync(path)) {
    if (SKIP.has(name)) continue;
    const full = join(path, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?|mjs|css)$/.test(name)) yield full;
  }
}

const hits = [];
for (const root of ROOTS.filter((path) => existsSync(path))) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (TERMS.test(line)) hits.push(`${file}:${index + 1}: ${line.trim()}`);
      });
  }
}

if (hits.length > 0) {
  console.error(`Términos de nicho dentro del núcleo:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('Núcleo libre de términos de nicho.');
