import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Standalone single-file build: inlines JS, CSS, and fonts (as data URIs) into
// one self-contained index.html you can download and open or host anywhere —
// no asset folder, no server. Output goes to dist-single/.
//
// The normal `npm run build` keeps its strict same-origin CSP (separate files).
// A single file can only carry its script inline, which that CSP's `script-src
// 'self'` forbids, so here (and ONLY here) we relax the meta CSP to allow the
// inlined script and data-URI fonts.
function relaxCspForSingleFile() {
  return {
    name: 'relax-csp-single-file',
    transformIndexHtml(html: string) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("font-src 'self'", "font-src 'self' data:");
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), relaxCspForSingleFile(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100_000_000, // inline every asset (fonts) as a data URI
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
  },
});
