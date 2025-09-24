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
    </section>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from "vue";
import { Api } from "@/api/client";
import type { TeamLite } from "@/types";

const title = ref("");
const teamId = ref<string>("");
const myTeams = ref<TeamLite[]>([]);
const questions = ref<string[]>(["", "", "", "", ""]);

const surveyId = ref<string>("");
const tokenCount = ref(10);
const tokens = ref<string[]>([]);

onMounted(async () => {
    const teams = await Api.myTeams();
    myTeams.value = teams;
    await nextTick();                 // DOM/Options sind da
    teamId.value = teams[0]?.id ?? ""; // jetzt selektieren
});


async function create() {
    const dto = await Api.createSurvey({
        teamId: teamId.value,
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
}

async function issue() {
    if (!surveyId.value) return;
    tokens.value = await Api.issueSurveyTokens(surveyId.value, tokenCount.value);
}

function inviteLink(tok: string): string {
    return Api.buildSurveyInviteLink(surveyId.value, tok);
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
