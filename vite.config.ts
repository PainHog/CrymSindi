/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' emits relative asset URLs so the static build works from any
// subdirectory (itch.io, GitHub Pages project sites, your own /games/ folder).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
