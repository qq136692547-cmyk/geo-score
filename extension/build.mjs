/**
 * GeoScore Chrome Extension MV3 - Multi-Entry Vite Build Script
 *
 * Produces a production-ready, 100% CSP-compliant MV3 extension package in extension/dist/:
 * 1. background.js: ESM service worker bundle (single entry)
 * 2. content.js: IIFE content script bundle (single chunk, no dynamic code-splitting)
 * 3. sidepanel/index.html: Vite HTML entry with bundled CSS and JS
 * 4. Static assets: manifest.json, _locales/, icons/
 */

import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, cpSync, rmSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const extDir = dirname(__filename);
const projectRoot = resolve(extDir, '..');
const srcDir = resolve(extDir, 'src');
const distDir = resolve(extDir, 'dist');

async function runBuild() {
  console.log('=== Building GeoScore Chrome MV3 Extension ===');
  const startTime = Date.now();

  // Validate prerequisites
  const swEntry = existsSync(resolve(srcDir, 'background/service-worker.js'))
    ? resolve(srcDir, 'background/service-worker.js')
    : resolve(srcDir, 'service-worker.js');
  const contentEntry = existsSync(resolve(srcDir, 'content/content.js'))
    ? resolve(srcDir, 'content/content.js')
    : resolve(srcDir, 'content.js');
  const sidepanelHtml = resolve(srcDir, 'sidepanel/index.html');
  const manifestPath = resolve(extDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json at ${manifestPath}`);
  }
  if (!existsSync(sidepanelHtml)) {
    throw new Error(`Missing sidepanel entry at ${sidepanelHtml}`);
  }

  // 1. Clean distDir
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 2. Build Service Worker (Single ESM file -> dist/background.js)
  if (existsSync(swEntry)) {
    console.log('\n[1/3] Bundling Background Service Worker (ESM)...');
    await build({
      configFile: false,
      publicDir: false,
      build: {
        emptyOutDir: false,
        outDir: distDir,
        target: 'esnext',
        minify: false,
        lib: {
          entry: swEntry,
          formats: ['es'],
          fileName: () => 'background.js',
        },
        rollupOptions: {
          output: {
            entryFileNames: 'background.js',
            inlineDynamicImports: true,
          },
        },
      },
    });
    console.log('✓ dist/background.js built successfully');
  } else {
    console.warn(`[1/3] Warning: ${swEntry} does not exist yet. Skipping background.js build.`);
  }

  // 3. Build Content Script (Single IIFE file -> dist/content.js)
  if (existsSync(contentEntry)) {
    console.log('\n[2/3] Bundling Content Script (IIFE)...');
    await build({
      configFile: false,
      publicDir: false,
      build: {
        emptyOutDir: false,
        outDir: distDir,
        target: 'esnext',
        minify: false,
        lib: {
          entry: contentEntry,
          formats: ['iife'],
          name: 'GeoScoreContent',
          fileName: () => 'content.js',
        },
        rollupOptions: {
          output: {
            entryFileNames: 'content.js',
            inlineDynamicImports: true,
          },
        },
      },
    });
    console.log('✓ dist/content.js built successfully');
  } else {
    console.warn(`[2/3] Warning: ${contentEntry} does not exist yet. Skipping content.js build.`);
  }

  // 4. Build Side Panel (HTML + CSS + JS -> dist/sidepanel/)
  console.log('\n[3/3] Bundling Side Panel UI (HTML/CSS/JS)...');
  await build({
    configFile: false,
    publicDir: false,
    root: resolve(srcDir, 'sidepanel'),
    base: './',
    plugins: [tailwindcss()],
    build: {
      emptyOutDir: false,
      outDir: resolve(distDir, 'sidepanel'),
      target: 'esnext',
      rollupOptions: {
        input: sidepanelHtml,
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
  });
  console.log('✓ dist/sidepanel/ built successfully');

  // 5. Copy Manifest, Locales, and Icons
  console.log('\n[Assets] Copying static assets to dist/...');
  cpSync(manifestPath, resolve(distDir, 'manifest.json'));

  const iconsDir = resolve(extDir, 'icons');
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, resolve(distDir, 'icons'), { recursive: true });
  }

  const localesDir = resolve(extDir, '_locales');
  if (existsSync(localesDir)) {
    cpSync(localesDir, resolve(distDir, '_locales'), { recursive: true });
  }

  // 6. Verification and Integrity Gate
  console.log('\n=== Validating MV3 Build Integrity ===');
  const manifestRaw = JSON.parse(readFileSync(resolve(distDir, 'manifest.json'), 'utf-8'));
  const sidePanelPath = manifestRaw.side_panel?.default_path;
  const expectedSidePanelFile = resolve(distDir, sidePanelPath || 'sidepanel/index.html');

  if (!existsSync(expectedSidePanelFile)) {
    throw new Error(`CRITICAL: side_panel.default_path (${sidePanelPath}) does not exist in dist!`);
  }

  // Verify CSP compliance on built HTML
  const builtHtml = readFileSync(expectedSidePanelFile, 'utf-8');
  if (builtHtml.includes('onclick=') || builtHtml.includes('onload=') || builtHtml.includes('onerror=')) {
    throw new Error('CRITICAL: Built sidepanel HTML contains inline event handlers violating MV3 CSP!');
  }
  // Check that any script tag is an external module, not inline JS code
  const inlineScriptMatch = builtHtml.match(/<script(?![^>]*src=)[^>]*>([\s\S]+?)<\/script>/i);
  if (inlineScriptMatch && inlineScriptMatch[1].trim().length > 0) {
    throw new Error('CRITICAL: Built sidepanel HTML contains inline script code violating MV3 CSP!');
  }

  // Check icons
  for (const size of ['16', '32', '48', '128']) {
    const iconFile = resolve(distDir, `icons/icon-${size}.png`);
    if (!existsSync(iconFile)) {
      console.warn(`Warning: Missing ${iconFile}`);
    }
  }

  // Check _locales
  if (!existsSync(resolve(distDir, '_locales/en/messages.json'))) {
    console.warn('Warning: Missing dist/_locales/en/messages.json');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Build completed in ${duration}s!`);
}

runBuild().catch((err) => {
  console.error('\n❌ Build failed:', err);
  process.exit(1);
});
