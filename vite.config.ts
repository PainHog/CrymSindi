/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' emits relative asset URLs so the static build works from any
// subdirectory (itch.io, GitHub Pages project sites, your own /games/ folder).
export default defineConfig({
  base: './',
  plugins: [react()],
  // The Phaser scene layer is a deliberately lazy chunk (~1.5MB, fetched only
  // when the animated map mounts), so the default 500kB warning is just noise.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
