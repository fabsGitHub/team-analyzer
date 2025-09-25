<template>
    <section class="admin-page">
        <!-- Erstellen -->
        <article class="card stack" style="--space: var(--s-6)">
            <header class="cluster between center">
                <h1 class="h1">Survey erstellen</h1>
            </header>

            <form class="stack" style="--space: var(--s-4)" @submit.prevent="create">
                <h2 class="h2">Stammdaten</h2>

                <!-- Titel + Team + Anlegen -->
                <div class="grid">
                    <input v-model="title" class="input" placeholder="Titel" required aria-label="Titel" />
                    <select v-model="teamId" class="input select" required aria-label="Team auswählen">
                        <option v-for="t in myTeams" :key="t.id" :value="t.id">
                            {{ t.name }}
                        </option>
                    </select>
                    <button class="btn primary" aria-label="Survey anlegen">Anlegen</button>
                </div>

                <!-- Fragen -->
                <div class="stack" style="--space: var(--s-3)">
                    <h2 class="h2">Fragen (5)</h2>
                    <div class="stack" style="--space: var(--s-2)">
                        <label v-for="i in 5" :key="i" class="cluster center" style="gap: var(--s-3)">
                            <span class="meta w-0" style="min-width: 3ch;">{{ i }}.</span>
                            <input v-model="questions[i - 1]" class="input" :placeholder="`Frage ${i}`" required
                                :aria-label="`Frage ${i}`" />
                        </label>
                    </div>
                </div>
            </form>
        </article>

        <!-- Meine Surveys -->
        <article class="card stack" style="--space: var(--s-4)">
            <header class="cluster between center">
                <h2 class="h2">Meine Surveys</h2>
                <span class="meta">{{ surveys.length }} Einträge</span>
            </header>

            <div v-if="surveys.length" class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Titel</th>
                            <th>Team</th>
                            <th class="w-0">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="s in surveys" :key="s.id">
                            <td>{{ s.title }}</td>
                            <td>{{ s.teamName || '—' }}</td>
                            <td class="w-0">
                                <div class="cluster wrap">
                                    <RouterLink class="btn" :to="`/surveys/${s.id}`">Details</RouterLink>
                                    <RouterLink class="btn" :to="`/surveys/${s.id}/results`">Ergebnisse</RouterLink>
                                    <button class="btn" @click="downloadJson(s.id)">JSON export</button>
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
import { useStore } from '@/store'

const state = useStore()

const title = ref('')
const teamId = ref<string>('')
const myTeams = ref<TeamLite[]>([])
const questions = ref<string[]>(['', '', '', '', ''])

const surveyId = ref<string>('')
const surveys = ref<(SurveyDto & { teamName?: string })[]>([])

onMounted(async () => {
    const teams = await Api.myTeams()
    myTeams.value = teams
    await nextTick()
    teamId.value = teams[0]?.id ?? ''
    surveys.value = await Api.listMySurveys()
})

async function create() {
    const createdBy = state.state.user?.id || 'unknown-user'
    const dto = await Api.createSurvey({
        teamId: teamId.value,
        title: title.value.trim(),
        createdBy,
        questions: [
            questions.value[0].trim(),
            questions.value[1].trim(),
            questions.value[2].trim(),
            questions.value[3].trim(),
            questions.value[4].trim(),
        ],
    })
    surveyId.value = dto.id

    // Tokens für alle Teammitglieder erzeugen
    await issueTeam()

    // Formular zurücksetzen & Liste aktualisieren
    title.value = ''
    questions.value = ['', '', '', '', '']
    surveys.value = await Api.listMySurveys()
}

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

async function issueTeam() {
    if (!surveyId.value) return
    const { created } = await Api.ensureTokensForTeam(surveyId.value)
    alert(`${created} neue Tokens für Teammitglieder erstellt.`)
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
