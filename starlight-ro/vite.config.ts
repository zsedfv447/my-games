import {defineConfig} from 'vite';
export default defineConfig({base:process.env.PAGES_BASE??'./',server:{host:'127.0.0.1',hmr:false},build:{chunkSizeWarningLimit:1800,rollupOptions:{input:{main:'index.html',characters:'characters.html'},output:{manualChunks:{phaser:['phaser']}}}}});
