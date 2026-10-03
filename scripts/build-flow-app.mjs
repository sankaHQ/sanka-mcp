import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL('packages/flow-app/app.ts', root))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
});
const source = await readFile(new URL('packages/flow-app/index.html', root), 'utf8');
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
await writeFile(
  new URL('packages/mcp-server/src/flow-app.html', root),
  source.replace('<!-- APP_SCRIPT -->', () => `<script>${script}</script>`),
);
