<!-- frontend/src/views/TutorialView.vue -->
<template>
    <section class="card">
        <h1>Quickstart</h1>
        <ol>
            <li><strong>{{ t('nav.evaluate') }}</strong>: <span>Plus-Taste → Person, Team, 5 Kategorien (1–5) →
                    Speichern.</span></li>
            <li><strong>{{ t('nav.analysis') }}</strong>: Teams wählen (max. 3) → Radar zeigt Durchschnitt → Klick auf
                Team-Badge für Details.</li>
            <li>Alles lokal & ohne Backend. Es werden „leere“ REST-Aufrufe geloggt.</li>
        </ol>
        <div class="row" style="justify-content:flex-end">
            <router-link to="/evaluate" class="btn primary">Los geht’s</router-link>
        </div>
    </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
