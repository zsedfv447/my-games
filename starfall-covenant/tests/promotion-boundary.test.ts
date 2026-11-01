import { expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pinned from './fixtures/promotion/protected-baseline.json';
const root = process.cwd();
const files = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const preferencePath = 'src/battle/assistant/preferences.ts';
// The original pin stays immutable. This one approved addition must occur exactly once,
// at its reviewed location; every other byte is still checked against the original SHA.
const approvedGreekBlock = Buffer.from(`  const rawGreek = object(source.greek);
  if (rawGreek) {
    const greek: NonNullable<AssistantRequest['greek']> = {};
    for (const key of ['reserve', 'setup'] as const) if (typeof rawGreek[key] === 'boolean') greek[key] = rawGreek[key];
    if (Object.keys(greek).length) request.greek = greek;
  }
`, 'utf8');
const prefix = Buffer.from('  if (index(source.starIndex)) request.starIndex = source.starIndex;\n');
const suffix = Buffer.from('  const rawConstraints = object(source.constraints);');
function protectedSha(path: string, bytes: Buffer): string | undefined {
  if (path === preferencePath) {
    const at = bytes.indexOf(approvedGreekBlock);
    if (at < prefix.length || bytes.indexOf(approvedGreekBlock, at + approvedGreekBlock.length) !== -1
      || !bytes.subarray(at - prefix.length, at).equals(prefix)
      || !bytes.subarray(at + approvedGreekBlock.length, at + approvedGreekBlock.length + suffix.length).equals(suffix)) return undefined;
    bytes = Buffer.concat([bytes.subarray(0, at), bytes.subarray(at + approvedGreekBlock.length)]);
  }
  return createHash('sha256').update(bytes).digest('hex');
}
it('protected formal save/parser/PWA/build and every baseline asset remain byte-exact', () => {
  for (const [path, sha] of Object.entries(pinned.files)) {
    expect(protectedSha(path, readFileSync(join(root, path))), path).toBe(sha);
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

it('the one preference exception rejects extra bytes, changed values, missing/duplicate/moved or malformed approved block', () => {
  const current = readFileSync(join(root, preferencePath));
  const text = current.toString('utf8'), block = approvedGreekBlock.toString('utf8');
  const pin = pinned.files[preferencePath];
  expect(protectedSha(preferencePath, current)).toBe(pin);
  const mutations = {
    extraLine: text + '\n// unauthorized extra line\n',
    changedValue: text.replace("const STORAGE_KEY = 'starfall-covenant.orb-assistant.request.v1';", "const STORAGE_KEY = 'other-key';"),
    changedApprovedValue: text.replace("typeof rawGreek[key] === 'boolean'", "typeof rawGreek[key] === 'string'"),
    missingBlock: text.replace(block, ''),
    duplicateBlock: text.replace(block, block + block),
    movedBlock: text.replace(block, '') + block,
    extraInsideBlock: text.replace('  if (rawGreek) {', '  if (rawGreek) {\n    // extra'),
  };
  for (const [name, value] of Object.entries(mutations)) {
    expect(value, name).not.toBe(text); // No vacuous negative fixture.
    expect(protectedSha(preferencePath, Buffer.from(value)), name).not.toBe(pin);
  }
  // Other protected paths get no removal allowance, even when these exact bytes appear.
  const other = 'src/pwa/register.ts';
  const original = readFileSync(join(root, other));
  expect(protectedSha(other, Buffer.concat([original, approvedGreekBlock]))).not.toBe(pinned.files[other]);
});
