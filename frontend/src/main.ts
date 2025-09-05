import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useStore } from './store'
import './styles.css'

// Try to resolve session & initial data before mount (prevents demo flicker)
const store = useStore()
await store.init()

createApp(App).use(router).use(i18n).mount('#app')
