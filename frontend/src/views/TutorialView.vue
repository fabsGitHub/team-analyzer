<template>
  <section class="admin-page">
    <article class="card stack" style="--space: var(--s-5)">
      <header class="cluster between center">
        <h1 class="h1">{{ t('tutorial.quickstart') }}</h1>
      </header>

      <ol class="steps stack" style="--space: var(--s-3)">
        <li>
          <strong>{{ t('tutorial.guide.adminTitle') }}</strong>:
          {{ t('tutorial.guide.admin') }}
        </li>
        <li>
          <strong>{{ t('tutorial.guide.leaderTitle') }}</strong>:
          {{ t('tutorial.guide.leader') }}
        </li>
        <li>
          <strong>{{ t('tutorial.guide.memberTitle') }}</strong>:
          {{ t('tutorial.guide.member') }}
        </li>
        <li>
          <strong>{{ t('tutorial.guide.anonTitle') }}</strong>:
          {{ t('tutorial.guide.anon') }}
        </li>
      </ol>

      <div class="cluster between">
        <span></span>
        <RouterLink to="/my/tokens" class="btn primary">{{ t('form.mySurveyTokens') }}</RouterLink>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
const { t } = useI18n()
</script>

<style scoped>
:root,
.admin-page {
  --s-2: .5rem;
  --s-3: .75rem;
  --s-4: 1rem;
  --s-5: 1.25rem;
  --s-6: 1.5rem
}

.h1 {
  margin: 0;
  font-size: 1.6rem
}

.stack>*+* {
  margin-top: var(--space, var(--s-4))
}

.cluster {
  display: flex;
  gap: var(--s-2)
}

.cluster.between {
  justify-content: space-between
}

.admin-page {
  display: grid;
  gap: var(--s-6)
}

.card {
  max-width: 820px;
  margin-inline: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: var(--s-6);
  background: #fff
}

.steps {
  padding-left: 1.1rem;
  line-height: 1.5;
  margin: 0
}

.btn {
  padding: .45rem .8rem;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  background: #f9fafb
}

.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff
}
</style>
