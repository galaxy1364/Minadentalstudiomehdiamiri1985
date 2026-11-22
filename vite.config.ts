import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BINARY_PACKAGE_HEADERS: Record<
  string,
  { contentType: string; filename: string }
> = {
  '/MinaDental-v27.5.0.apk': {
    contentType: 'application/vnd.android.package-archive',
    filename: 'MinaDental-v27.5.0.apk',
  },
  '/MinaDental-v27.5.0.ipa': {
    contentType: 'application/octet-stream',
    filename: 'MinaDental-v27.5.0.ipa',
  },
  '/MinaDental-iOS27.mobileconfig': {
    contentType: 'application/x-apple-aspen-config',
    filename: 'MinaDental-iOS27.mobileconfig',
  },
  '/minadental-source-full.zip': {
    contentType: 'application/zip',
    filename: 'minadental-source-full.zip',
  },
};

function minadentalBinaryDownloadPlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use((req: any, res: any, next: any) => {
      if (!req.url) return next();
      const cleanPath = req.url.split('?')[0];
      const pkgMeta = BINARY_PACKAGE_HEADERS[cleanPath];
      if (!pkgMeta) return next();

      const filePath = path.resolve(
        import.meta.dirname,
        'public',
        cleanPath.replace(/^\//, '')
      );
      if (!fs.existsSync(filePath)) return next();

      const stat = fs.statSync(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', pkgMeta.contentType);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${pkgMeta.filename}"`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  };

  return {
    name: 'minadental-binary-download-headers',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

function minadentalPwaDevHmrGuardPlugin(): Plugin {
  const DEV_SW_VIRTUAL = '/@vite-plugin-pwa/pwa-entry-point-loaded';
  const RESOLVED_GUARD = '\0minadental:pwa-dev-sw-guard';
  return {
    name: 'minadental-pwa-dev-hmr-guard',
    apply: 'serve',
    enforce: 'pre',
    resolveId(id) {
      if (id === DEV_SW_VIRTUAL) {
        return RESOLVED_GUARD;
      }
    },
    load(id) {
      if (id === RESOLVED_GUARD) {
        return 'export default function registerDevSW() {}';
      }
    },
  };
}

function minadentalPwaHtmlStripPlugin(): Plugin {
  return {
    name: 'minadental-pwa-dev-html-strip',
    apply: 'serve',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<script\s+id=["']vite-plugin-pwa:register-dev-sw["'][^>]*>[\s\S]*?<\/script>\s*/gi,
          ''
        );
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      minadentalBinaryDownloadPlugin(),
      minadentalPwaDevHmrGuardPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: [
          'logo.png',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'مینادنتال - مدیریت یکپارچه دندانپزشکی',
          short_name: 'مینادنتال',
          lang: 'fa',
          dir: 'rtl',
          description:
            'سامانه فوق استاندارد مدیریت کلینیک دندانپزشکی مینادنتال با چارت پالمر، لابراتوار، ایمپلنت، چک صیادی و آپدیت خودکار OTA',
          theme_color: '#8b5cf6',
          background_color: '#faf5ff',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          prefer_related_applications: false,
          start_url: '/',
          scope: '/',
          orientation: 'any',
          categories: ['medical', 'productivity', 'business'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
          shortcuts: [
            {
              name: 'پذیرش و پرونده بیماران',
              short_name: 'بیماران',
              url: '/?view=patients',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'نوبت‌دهی و تقویم ایرانی',
              short_name: 'نوبت‌دهی',
              url: '/?view=appointments',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'مالی، چک صیادی و اقساط',
              short_name: 'مالی',
              url: '/?view=financial',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: [
            '**/*.apk',
            '**/*.ipa',
            '**/*.zip',
            '**/*.mobileconfig',
            '**/assets/aistudio/**',
          ],
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/src\//,
            /^\/@/,
            /^\/node_modules\//,
            /\.tsx?(\?.*)?$/,
            /\.(apk|ipa|zip|mobileconfig)$/i,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => url.pathname.endsWith('/version.json'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallbackAllowlist: [/^\/$/],
        },
      }),
      minadentalPwaHtmlStripPlugin(),
    ],
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('/d3') || id.includes('/recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('/@zxing') || id.includes('/jsqr') || id.includes('/qrcode')) {
              return 'vendor-scanner';
            }
            if (id.includes('/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('/zod')) {
              return 'vendor-zod';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
