// Genera los modelos 3D de ejemplo y sus imágenes con un navegador sin ventana.
// Uso: node tools/sample-models/generate.mjs [nombre,nombre]   (CHROME_PATH si no está en la ruta habitual)
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const HERE = import.meta.dirname;
const THREE_DIR = path.join(HERE, '../../apps/web/node_modules/three');
const OUT = path.join(HERE, '../../packages/verticals/assets/gamer');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/src/render.js"></script>`;

await mkdir(OUT, { recursive: true });
const finished = Promise.withResolvers();

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Archivo dentro de la carpeta indicada; nunca fuera de ella. */
const inside = (base, name) => {
  const full = path.resolve(base, name);
  if (!full.startsWith(path.resolve(base) + path.sep)) throw new Error('ruta no permitida');
  return full;
};

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && pathname === '/out/done') {
      finished.resolve((await body(req)).toString());
    } else if (req.method === 'POST' && pathname.startsWith('/out/')) {
      const data = await body(req);
      await writeFile(inside(OUT, pathname.slice(5)), data);
      console.log(pathname.slice(5), `${Math.round(data.length / 1024)} KB`);
    } else if (pathname === '/') {
      res.setHeader('content-type', 'text/html');
      return res.end(PAGE);
    } else if (/^\/(three|src)\//.test(pathname)) {
      const base = pathname.startsWith('/three/') ? THREE_DIR : HERE;
      res.setHeader('content-type', 'text/javascript');
      return res.end(await readFile(inside(base, pathname.split('/').slice(2).join('/'))));
    } else {
      res.statusCode = 404;
    }
    res.end();
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const profile = await mkdtemp(path.join(tmpdir(), 'sample-models-'));
const only = process.argv[2] ? `?only=${encodeURIComponent(process.argv[2])}` : '';
const chrome = spawn(CHROME, [
  '--headless=new',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--no-first-run',
  `--user-data-dir=${profile}`,
  `http://127.0.0.1:${server.address().port}/${only}`,
]);
const timer = setTimeout(() => finished.resolve('tiempo agotado'), 540_000);
const result = await finished.promise;
clearTimeout(timer);
chrome.kill();
server.close();
server.closeAllConnections();
await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {});
if (result !== 'ok') {
  console.error(result);
  process.exit(1);
}
