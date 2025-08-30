<!-- frontend/src/components/DialogModal.vue -->
<template>
    <div v-if="open" class="modal" role="dialog" aria-modal="true" :aria-labelledby="titleId"
        @keydown.esc.prevent="close">
        <div class="backdrop" @click="close"></div>
        <div class="sheet card" ref="panel" tabindex="-1">
            <h2 :id="titleId">
                <slot name="title" />
            </h2>
            <div class="content">
                <slot />
            </div>
            <div class="row" style="justify-content:flex-end">
                <button class="btn" @click="close">{{ cancelText }}</button>
                <button class="btn danger" v-if="danger" @click="$emit('confirm')">{{ confirmText }}</button>
                <button class="btn primary" v-else @click="$emit('confirm')">{{ confirmText }}</button>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
const props = defineProps<{ open: boolean; danger?: boolean; cancelText?: string; confirmText?: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>()
const panel = ref<HTMLDivElement | null>(null)
const titleId = `dialog-${Math.random().toString(36).slice(2)}`
function close() { emit('close') }
watch(() => props.open, (v) => { if (v) setTimeout(() => panel.value?.focus(), 0) })
onMounted(() => { if (props.open) panel.value?.focus() })
</script>
<style scoped>
.modal {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
}

.backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, .35)
}

.sheet {
    position: relative;
    max-width: 34rem;
    width: calc(100% - 2rem);
}
</style>
