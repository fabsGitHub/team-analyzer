<template>
    <section class="card">
        <h1>Survey erstellen</h1>

        <form @submit.prevent="create">
            <input v-model="title" class="input" placeholder="Titel" required />
            <div>Teamauswahl:</div>
            <select v-model="teamId" class="select" required>
                <option v-for="t in myTeams" :key="t.id" :value="t.id" class="option">{{ t.name }}</option>
            </select>

            <div v-for="i in 5" :key="i">
                <input v-model="questions[i - 1]" class="input" :placeholder="`Frage ${i}`" required />
            </div>

            <button class="btn primary">Anlegen</button>
        </form>

        <div v-if="surveyId" class="mt-4">
            <h2>Tokens erzeugen</h2>
            <button class="btn" @click="issueTeam">Für Team erzeugen</button>

            <div class="form-row">
                <input v-model.number="tokenCount" type="number" min="1" class="input" />
                <button class="btn" @click="issue">Erzeugen</button>
            </div>
            <ul>
                <li v-for="t in tokens" :key="t">
                    <code>{{ inviteLink(t) }}</code>
                </li>
            </ul>
        </div>

        <!-- NEU: Liste existierender Surveys -->
        <div class="mt-4">
            <h2>Meine Surveys</h2>
            <ul>
                <li v-for="s in surveys" :key="s.id">
                    <strong>{{ s.title }}</strong>
                    <span v-if="s.teamName">({{ s.teamName }})</span>
                    <RouterLink :to="`/surveys/${s.id}`">Details</RouterLink>
                    <RouterLink :to="`/surveys/${s.id}/results`" class="btn" style="margin-left:1em">
                        Ergebnisse
                    </RouterLink>

                    <!-- optional: add a JSON download button that uses axios -->
                    <button class="btn" style="margin-left:.5em" @click="downloadJson(s.id)">
                        JSON export
                    </button>
                </li>
            </ul>
        </div>
    </section>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import { Api } from "@/api/client";
import type { TeamLite, SurveyDto } from "@/types";
import { RouterLink } from "vue-router";
import { useStore } from "@/store";


const title = ref("");
const teamId = ref<string>("");
const myTeams = ref<TeamLite[]>([]);
const questions = ref<string[]>(["", "", "", "", ""]);

const surveyId = ref<string>("");
const tokenCount = ref(10);
const tokens = ref<string[]>([]);

const surveys = ref<(SurveyDto & { teamName?: string })[]>([]);

const state = useStore();

onMounted(async () => {
    const teams = await Api.myTeams();
    myTeams.value = teams;
    await nextTick();
    teamId.value = teams[0]?.id ?? "";

    // NEU: Surveys laden, bei denen der User Leader ist
    surveys.value = await Api.listMySurveys();
});

async function create() {
    const dto = await Api.createSurvey({
        teamId: teamId.value,
        createdBy: state.state.user?.id || "-1", // wird vom Backend gesetzt
        title: title.value.trim(),
        questions: [
            questions.value[0].trim(),
            questions.value[1].trim(),
            questions.value[2].trim(),
            questions.value[3].trim(),
            questions.value[4].trim()
        ]
    });
    surveyId.value = dto.id;
    // Nach dem Erstellen neu laden
    issueTeam();
    surveys.value = await Api.listMySurveys();
}

async function issue() {
    if (!surveyId.value) return;
    tokens.value = await Api.issueSurveyTokens(surveyId.value, tokenCount.value);
}

function inviteLink(tok: string): string {
    return Api.buildSurveyInviteLink(surveyId.value, tok);
}

async function downloadJson(id: string) {
    const data = await Api.getSurveyResults(id); // goes through axios + auth
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-${id}-results.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function issueTeam() {
    if (!surveyId.value) return
    const { created } = await Api.ensureTokensForTeam(surveyId.value)
    alert(`${created} neue Tokens für Teammitglieder erstellt.`)
}

</script>

<style scoped>
.form-row {
    display: flex;
    gap: .5rem;
    align-items: center;
    margin: .5rem 0;
}

.mt-4 {
    margin-top: 1rem;
}

.select {
    padding: 0.5em;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 1em;
    min-width: 8em;
    margin-bottom: 1em;
}

.input {
    display: block;
    width: 100%;
    padding: 0.5em;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 1em;
    margin-bottom: 1em;
}
</style>
