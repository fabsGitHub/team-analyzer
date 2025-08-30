<!-- frontend/src/components/HeaderNav.vue -->
<template>
    <header class="nav" role="banner">
        <div class="navwrap">
            <div class="brand" aria-label="App">{{ t('app') }}</div>
            <nav aria-label="Hauptnavigation" class="tabs">
                <RouterLink class="tab" :aria-current="$route.path === '/evaluate' ? 'page' : undefined" to="/evaluate">{{
                    t('nav.evaluate') }}</RouterLink>
                <RouterLink class="tab" :aria-current="$route.path === '/analysis' ? 'page' : undefined" to="/analysis">{{
                    t('nav.analysis') }}</RouterLink>
                <RouterLink class="tab" :aria-current="$route.path === '/tutorial' ? 'page' : undefined" to="/tutorial">{{
                    t('nav.tutorial') }}</RouterLink>
            </nav>
            <div class="lang">
                <label class="sr-only" for="lang">Language</label>
                <select id="lang" class="select" @change="onLang" :value="locale">
                    <option value="de">DE</option>
                    <option value="en">EN</option>
                </select>
            </div>
        </div>
    </header>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
const { t, locale } = useI18n()
useRoute()
function onLang(e: Event) { locale.value = (e.target as HTMLSelectElement).value }
</script>
