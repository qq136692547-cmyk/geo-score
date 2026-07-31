import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: 'https://geoscore.help',
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['chart.js']
    }
  }
});
