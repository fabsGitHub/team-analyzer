// frontend/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// lightweight inline plugin to avoid extra dep
function vuePlugin() {
  return (vue as any).default ? (vue as any).default() : (vue as any)()
}
export default defineConfig({
  plugins: [vuePlugin()],
  server: { port: 5173 },
})
