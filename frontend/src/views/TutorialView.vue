<!-- frontend/src/views/TutorialView.vue -->
<template>
  <section class="card tutorial">
    <h1 class="h1">Quickstart</h1>
    <ol class="steps">
      <li><strong>{{ t('nav.evaluate') }}</strong>: Person + Team + 5 Kategorien (1–5) → Speichern.</li>
      <li><strong>{{ t('nav.analysis') }}</strong>: max. 3 Teams wählen → Radar vergleichen → Badge klicken für Details.</li>
      <li>Alles lokal. Keine echten Serverdaten.</li>
    </ol>
    <div class="row" style="justify-content:flex-end">
      <RouterLink to="/evaluate" class="btn primary">{{ t('form.add') }}</RouterLink>
    </div>
  </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
const { t } = useI18n()
</script>
<style scoped>
.tutorial { max-width: 820px; margin-inline:auto; }
.h1 { margin: 0 0 .25rem; font-size: 1.6rem; }
.steps { margin: .25rem 0 1rem; padding-left: 1.1rem; line-height: 1.5; }
</style>
