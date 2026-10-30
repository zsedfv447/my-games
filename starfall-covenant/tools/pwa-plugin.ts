// 建置時產生 dist/sw.js：把 src/pwa/sw.ts 打包，填入這次建置的檔案清單與版本
// 檔案路徑一律相對於網站根目錄（不含 PAGES_BASE），service worker 以自己的 scope 解析，所以子路徑部署也能用。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { buildVersion } from '../src/pwa/strategy';

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name.startsWith('.')) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split('\\').join('/'));
    }
  };
  try { walk(dir); } catch { /* 沒有 public/ */ }
  return out;
}

export function pwaPlugin(root: string): Plugin {
  return {
    name: 'starfall-pwa',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_opts, bundle) {
      const publicDir = join(root, 'public');
      const publicFiles = listFiles(publicDir);
      const files = [...Object.keys(bundle), ...publicFiles].filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      // 沒有雜湊的檔案（index.html、manifest、圖示）用內容當鹽，內容一變就換版本
      const html = bundle['index.html'];
      const salt = (html && html.type === 'asset' ? String(html.source) : '')
        + publicFiles.map((f) => readFileSync(join(publicDir, f)).toString('base64')).join('');
      const version = buildVersion(files, salt);
      const out = await build({
        entryPoints: [join(root, 'src/pwa/sw.ts')],
        bundle: true,
        write: false,
        format: 'iife',
        minify: true,
        target: 'es2020',
        define: { __SW_VERSION__: JSON.stringify(version), __SW_FILES__: JSON.stringify(files) },
      });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: out.outputFiles[0].text });
    },
  };
}
