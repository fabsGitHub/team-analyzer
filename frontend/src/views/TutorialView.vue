<!-- frontend/src/views/TutorialView.vue -->
<template>
  <section class="card tutorial">
    <h1 class="h1">{{ t('tutorial.quickstart') }}</h1>
    <ol class="steps">
      <li>
        <strong>{{ t('nav.evaluate') }}</strong>:
        {{ t('tutorial.step1') }}
      </li>
      <li>
        <strong>{{ t('nav.analysis') }}</strong>:
        {{ t('tutorial.step2') }}
      </li>
      <li>
        <strong>{{ t('tutorial.tip') }}</strong>:
        {{ t('tutorial.step3') }}
      </li>
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
