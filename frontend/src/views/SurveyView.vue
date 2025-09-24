<template>
  <section class="card">
    <h1>{{ survey?.title }}</h1>

    <form v-if="survey" @submit.prevent="submit">
      <div v-for="(q, i) in survey.questions" :key="q.id" class="q">
        <p class="label">{{ q.text }}</p>
        <LikertScale :name="'q' + i" v-model="answers[i]" />
      </div>

      <div class="token-wrap">
        <input v-model="token" class="input" type="text" placeholder="Participation token" required />
        <small>Der Token ist im Einladungslink enthalten.</small>
      </div>

      <button class="btn primary" type="submit" :disabled="!valid">Absenden</button>
    </form>

    <p v-else>Survey wird geladen…</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Api } from "@/api/client";
import type { SurveyDto } from "@/types";
import LikertScale from "@/components/LikertScale.vue";

const route = useRoute();
const survey = ref<SurveyDto | null>(null);
const answers = ref<number[]>([0, 0, 0, 0, 0]);
const token = ref<string>("");

// Token aus Query (?token=...) auto-vorbefüllen
onMounted(async () => {
  token.value = (route.query.token as string) ?? "";
  const id = route.params.id as string;
  survey.value = await Api.getSurvey(id);
});

const valid = computed(
  () => answers.value.every(v => v >= 1 && v <= 5) && token.value.trim().length > 0
);

async function submit() {
  const id = route.params.id as string;
  const [q1, q2, q3, q4, q5] = answers.value;
  await Api.submitSurveyResponses(id, { token: token.value.trim(), q1, q2, q3, q4, q5 });
  alert("Danke für die Teilnahme! Dein Token wurde verbraucht.");
}
</script>

<style scoped>
.q {
  margin-bottom: 1rem;
}

.label {
  margin-bottom: .25rem;
  font-weight: 600;
}

.token-wrap {
  margin: 1rem 0;
  display: flex;
  gap: .5rem;
  flex-direction: column;
}
</style>
