<template>
    <section class="admin-page">

        <!-- Meine Surveys -->
        <article class="card stack" style="--space: var(--s-4)">
            <header class="cluster between center">
                <h2 class="h2">{{ t('surveys.mine.title') }}</h2>
                <span class="meta">{{ t('surveys.mine.entries', { n: surveys.length }) }}</span>
            </header>

            <div v-if="surveys.length" class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>{{ t('surveys.create.fields.title') }}</th>
                            <th>{{ t('form.team') }}</th>
                            <th class="w-0">{{ t('admin.teams.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="s in surveys" :key="s.id">
                            <td>{{ s.title }}</td>
                            <td>{{ s.teamName || t('surveys.mine.teamFallback') }}</td>
                            <td class="w-0">
                                <div class="cluster wrap">
                                    <RouterLink class="btn" :to="`/surveys/${s.id}`">
                                        {{ t('surveys.mine.actions.details') }}
                                    </RouterLink>
                                    <RouterLink class="btn" :to="`/surveys/${s.id}/results`">
                                        {{ t('surveys.mine.actions.results') }}
                                    </RouterLink>
                                    <button class="btn" @click="downloadJson(s.id)">
                                        {{ t('surveys.mine.actions.jsonExport') }}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p v-else class="empty">Noch keine Surveys vorhanden.</p>
        </article>
    </section>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { Api } from '@/api/client'
import type { TeamLite, SurveyDto } from '@/types'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const teamId = ref<string>('')
const myTeams = ref<TeamLite[]>([])

const surveys = ref<(SurveyDto & { teamName?: string })[]>([])

onMounted(async () => {
    const teams = await Api.myTeams()
    myTeams.value = teams
    await nextTick()
    teamId.value = teams[0]?.id ?? ''
    surveys.value = await Api.listMySurveys()
})


async function downloadJson(id: string) {
    const data = await Api.getSurveyResults(id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `survey-${id}-results.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

</script>

<style scoped>
/* -------- Spacing- & Typo-Scale (4-px Grid) -------- */
:root,
.admin-page {
    --s-1: 0.25rem;
    /* 4 */
    --s-2: 0.5rem;
    /* 8 */
    --s-3: 0.75rem;
    /* 12 */
    --s-4: 1rem;
    /* 16 */
    --s-5: 1.25rem;
    /* 20 */
    --s-6: 1.5rem;
    /* 24 */
    --s-8: 2rem;
    /* 32 */
}

.h1 {
    font-size: 1.375rem;
    line-height: 1.2;
    margin: 0;
}

.h2 {
    font-size: 1.125rem;
    line-height: 1.25;
    margin: 0;
}

.meta {
    color: #6b7280;
    font-size: .9rem;
}

/* -------- Layout-Utilities -------- */
.stack>*+* {
    margin-top: var(--space, var(--s-4));
}

.cluster {
    display: flex;
    gap: var(--s-2);
}

.cluster.center {
    align-items: center;
}

.cluster.between {
    justify-content: space-between;
}

.cluster.wrap {
    flex-wrap: wrap;
}

.grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--s-2);
}

@media (max-width: 720px) {
    .grid {
        grid-template-columns: 1fr;
    }
}

/* -------- Cards & Basics -------- */
.admin-page {
    display: grid;
    gap: var(--s-6);
}

.card {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: var(--s-6);
    background: #fff;
}

.input,
.select {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    font-size: 1rem;
}

.btn {
    padding: 0.45rem 0.8rem;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    cursor: pointer;
}

.btn:hover {
    background: #f3f4f6;
}

.btn.primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
}

.btn.primary:hover {
    filter: brightness(0.95);
}

.empty {
    color: #9ca3af;
    text-align: center;
}

.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* -------- Tabelle -------- */
.table-wrap {
    overflow-x: auto;
}

.table {
    width: 100%;
    border-collapse: collapse;
}

.table th,
.table td {
    text-align: left;
    padding: 0.6rem 0.5rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
}

.table thead th {
    font-weight: 600;
    color: #6b7280;
    background: #fafafa;
}

.w-0 {
    white-space: nowrap;
}
</style>
