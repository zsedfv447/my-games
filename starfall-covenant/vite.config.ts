import { defineConfig } from 'vitest/config';
import { pwaPlugin } from './tools/pwa-plugin';

// PAGES_BASE 由 GitHub Pages 部署流程設定；本機開發用相對路徑
export default defineConfig({
  base: process.env.PAGES_BASE ?? './',
  plugins: [pwaPlugin(__dirname)],
  test: { include: ['tests/**/*.test.ts'] },
});
