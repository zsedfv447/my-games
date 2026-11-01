import { expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pinned from './fixtures/promotion/protected-baseline.json';
const root = process.cwd();
const files = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
it('protected formal save/parser/PWA/build and every baseline asset remain byte-exact', () => {
  for (const [path, sha] of Object.entries(pinned.files)) {
    expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex'), path).toBe(sha);
  }
  const assets = Object.keys(pinned.files).filter(p => p.startsWith('assets/')).sort();
  expect(assets).toHaveLength(456);
  expect(files('assets').sort()).toEqual(assets);
});
it('shipped runtime has no experimental isolation/guide coupling; production worker build remains enabled', () => {
  expect(existsSync(join(root, 'src/experiment.ts'))).toBe(false);
  expect(existsSync(join(root, 'src/ui/screens/experiment-review.ts'))).toBe(false);
  for (const path of files('src')) {
    const text = readFileSync(join(root, path), 'utf8');
    expect(text, path).not.toMatch(/starfall\.experiment\.e00-e01\.|STARFALL-EXPERIMENT:E00-E01:|experiment-review|experiment-badge|EXPERIMENT_NOTICE|EXPERIMENT_LABEL|experimentKey/);
  }
  expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).toContain('pwaPlugin(__dirname)');
  expect(readFileSync(join(root, 'src/pwa/register.ts'), 'utf8')).toContain('navigator.serviceWorker.register');
  // No dist dependency: director separately checks actual Pages-base build/sw output.
});
