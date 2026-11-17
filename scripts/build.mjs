// Builds the static site into dist/:
//   1. bundles src/client.jsx (React + the app) into dist/app.js
//   2. compiles Tailwind (src/styles.css + tailwind.config.js) into dist/styles.css
//   3. pre-renders <App /> to HTML so visitors and search engines get the full
//      page text immediately; the browser then hydrates it
//   4. copies assets/ and static/ (robots.txt, sitemap.xml, privacy page)
//
// Run with `npm run build`. Vercel runs it on every deploy (see vercel.json).

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(root, ...p);
const dist = r('dist');
const buildId = Date.now().toString(36);
const define = {
  'process.env.NODE_ENV': '"production"',
  BUILD_YEAR: String(new Date().getFullYear()),
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Client bundle
await build({
  entryPoints: [r('src/client.jsx')],
  outfile: path.join(dist, 'app.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  jsx: 'transform',
  define,
  logLevel: 'warning',
});

// 2. Tailwind CSS
const require = createRequire(import.meta.url);
const tailwindBin = path.join(path.dirname(require.resolve('tailwindcss/package.json')), 'lib/cli.js');
execFileSync(process.execPath, [
  tailwindBin, '-c', r('tailwind.config.js'), '-i', r('src/styles.css'), '-o', path.join(dist, 'styles.css'), '--minify',
], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

// 3. Pre-render
const ssrFile = r('node_modules/.cache/unison-ssr.mjs');
await build({
  entryPoints: [r('src/App.jsx')],
  outfile: ssrFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'transform',
  define,
  external: ['react', 'react-dom'],
  logLevel: 'warning',
});
const { default: App } = await import(pathToFileURL(ssrFile).href + `?v=${buildId}`);
const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');
const appHtml = renderToString(React.createElement(App));

const template = readFileSync(r('src/index.html'), 'utf8');
if (!template.includes('<!--app-->')) throw new Error('src/index.html is missing the <!--app--> placeholder');
writeFileSync(
  path.join(dist, 'index.html'),
  template.replace('<!--app-->', appHtml).replaceAll('__BUILD_ID__', buildId),
);

// 4. Static files
cpSync(r('assets'), path.join(dist, 'assets'), { recursive: true });
cpSync(r('static'), dist, { recursive: true });

console.log(`Built dist/ (${buildId}): ${Math.round(appHtml.length / 1024)} KB of pre-rendered HTML`);
