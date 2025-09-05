<!-- frontend/src/components/FooterModal.vue -->
<template>
    <div class="footer">
        <button class="link" @click="open = true">Info & Rechtliches</button>
    </div>

    <DialogModal :open="open" @close="open = false" :confirmText="'OK'">
        <template #title>Info & Rechtliches</template>
        <ul class="links">
            <li><a href="#" rel="nofollow">{{ t('footer.imprint') || 'Impressum' }}</a></li>
            <li><a href="#" rel="nofollow">{{ t('footer.privacy') || 'Datenschutz' }}</a></li>
            <li><a href="#" rel="nofollow">{{ t('footer.help') || 'Hilfe' }}</a></li>
            <li><a href="#" rel="nofollow">{{ t('footer.shortcuts') || 'Tastenkürzel' }}</a></li>
            <li><a href="#" rel="nofollow">{{ t('footer.about') || 'Über Team Radar' }}</a></li>
        </ul>
    </DialogModal>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogModal from './DialogModal.vue'
const { t } = useI18n()
const open = ref(false)
</script>
<style scoped>
.footer {
    max-width: 52rem;
    margin: .75rem auto 2rem;
    padding: 0 1rem;
    text-align: right;
    color: var(--muted);
}

.link {
    background: none;
    border: 0;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
}

.links {
    display: grid;
    gap: .35rem;
    padding-left: 1rem;
}
</style>
