// frontend/vite.config.ts
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'
import vue from '@vitejs/plugin-vue'
// lightweight inline plugin to avoid extra dep
function vuePlugin() {
  return (vue as any).default ? (vue as any).default() : (vue as any)()
}
export default defineConfig({
  plugins: [vueDevTools(), createHtmlPlugin({}), vuePlugin()],
  base: '/', // bei Deployment unter /app/ -> base: '/app/'
  server: {
    port: 5173,
    proxy: {
      // nur nötig, wenn du in .env.development `VITE_API_BASE=/api` setzen willst
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
