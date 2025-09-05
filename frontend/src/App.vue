<!-- frontend/src/App.vue -->
<template>
  <div class="app">
    <HeaderNav />
    <main id="main" class="container" tabindex="-1">
      <router-view />
    </main>
    <Toast />
    <FooterModal />
  </div>
</template>

<script setup lang="ts">
import HeaderNav from './components/HeaderNav.vue'
import Toast from './components/Toast.vue'

import { onMounted } from 'vue'
import { useStore } from './store'
import FooterModal from './components/FooterModal.vue'

const { init } = useStore()
onMounted(() => { init() })

</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  width: min(52rem, 100%);
  margin-inline: auto;
  padding: 1rem;
}
</style>
