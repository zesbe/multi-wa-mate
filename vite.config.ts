import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  
  // ✨ BUILD OPTIMIZATION
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan vendor React agar di-cache terpisah
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Pisahkan Supabase karena ukurannya besar
          'supabase': ['@supabase/supabase-js'],
          // Pisahkan UI components kalau pakai library besar
          // 'ui-vendor': ['lucide-react', '@radix-ui/react-dialog'] // sesuaikan dengan library yang kamu pakai
        }
      }
    },
    // Tingkatkan limit warning chunk size
    chunkSizeWarningLimit: 1000,
    // Minify dengan terser untuk hasil optimal
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // hapus console.log di production
        drop_debugger: mode === 'production'
      }
    },
    // Enable source map untuk development, disable untuk production
    sourcemap: mode === 'development'
  },
  
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'WAPANELS - WhatsApp Multi-Device Management Platform',
        short_name: 'WAPANELS',
        description: 'Kelola multiple WhatsApp devices, broadcast messages, chatbot automation, dan lebih banyak lagi dalam satu platform profesional',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        categories: ['business', 'productivity', 'social'],
        lang: 'id-ID',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
