<!-- frontend/src/components/Toast.vue -->
<template>
    <div class="toasts" aria-live="polite" aria-atomic="true">
        <div v-for="t in state.toasts" :key="t.id" class="card" style="position:relative">
            {{ t.text }}
            <button class="btn ghost" style="position:absolute; top:.3rem; right:.3rem" @click="dismiss(t.id)"
                aria-label="Schließen">×</button>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useStore } from '../store'
const { state, dismiss } = useStore()
</script>
<style scoped>
.toasts {
    position: fixed;
    bottom: .75rem;
    left: 0;
    right: 0;
    display: grid;
    place-items: center;
    gap: .5rem;
}
</style>
