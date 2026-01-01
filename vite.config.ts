import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte({
      // Inject CSS into JS instead of emitting separate CSS files
      // This avoids the PostCSS parsing issue with WebKitGTK
      emitCss: false,
    })
  ],

  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
    },
  },

  css: {
    devSourcemap: true,
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari15'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
