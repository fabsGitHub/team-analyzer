<!-- frontend/src/App.vue -->
<template>
  <div class="app">
    <HeaderNav/>
    <main id="main" class="container" tabindex="-1">
      <router-view/>
    </main>
    <Toast/>
  </div>
</template>

<script setup lang="ts">
import HeaderNav from './components/HeaderNav.vue'
import Toast from './components/Toast.vue'
</script>

<style>
.app { min-height: 100vh; display:flex; flex-direction:column; }
.container { width:min(52rem, 100%); margin-inline:auto; padding:1rem; }
</style>
