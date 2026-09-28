import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:preview` makes a single self-contained HTML file for the
// clickable sample-data preview. `npm run build` is the normal Netlify build.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
}));
