import {defineConfig} from 'vitest/config';
export default defineConfig({root:new URL('../..',import.meta.url).pathname,cacheDir:'.cache/e16-audit',test:{include:['audit/e16/*.test.ts'],environment:'happy-dom',testTimeout:20000}});
