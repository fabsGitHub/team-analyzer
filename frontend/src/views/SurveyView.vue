<template>
  <section class="admin-page">
    <article class="card stack" style="--space: var(--s-5)">
      <header class="cluster between center">
        <h1 class="h1">{{ survey?.title ?? 'Survey' }}</h1>
      </header>

      <div v-if="survey" class="stack" style="--space: var(--s-4)">
        <ol class="q-list stack" style="--space: var(--s-4)">
          <li v-for="(q, i) in survey.questions" :key="q.id" class="q stack" style="--space: var(--s-2)">
            <div class="cluster center" style="gap: var(--s-3)">
              <span class="meta index">{{ i + 1 }}.</span>
              <p class="label">{{ q.text }}</p>
            </div>
            <LikertScale :name="'q' + i" v-model="answers[i]" />
          </li>
        </ol>

        <div class="stack" style="--space: var(--s-2)">
          <label class="label" for="token">Teilnahmetoken</label>
          <input id="token" v-model="token" class="input" type="text" placeholder="Token aus dem Einladungslink"
            required />
          <small class="meta">Der Token ist im Einladungslink enthalten.</small>
        </div>

        <div class="cluster between wrap">
          <span class="meta">{{ answersFilled }}/5 beantwortet</span>
          <button class="btn primary" type="submit" :disabled="!valid" @click.prevent="submit">
            Absenden
          </button>
        </div>
      </div>

      <p v-else class="meta">Survey wird geladen…</p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Api } from "@/api/client";
import type { SurveyDto } from "@/types";
import LikertScale from "@/components/LikertScale.vue";

const route = useRoute();
const router = useRouter();

const survey = ref<SurveyDto | null>(null);
const answers = ref<number[]>([0, 0, 0, 0, 0]);
const token = ref<string>("");

onMounted(async () => {
  token.value = (route.query.token as string) ?? "";
  const id = route.params.id as string;
  survey.value = await Api.getSurvey(id);
});

const valid = computed(
  () => answers.value.every(v => v >= 1 && v <= 5) && token.value.trim().length > 0
);

const answersFilled = computed(() => answers.value.filter(v => v >= 1 && v <= 5).length);

async function submit() {
  const id = route.params.id as string;
  const [q1, q2, q3, q4, q5] = answers.value;
  await Api.submitSurveyResponses(id, { token: token.value.trim(), q1, q2, q3, q4, q5 });
  router.replace({ name: "MyToken", query: { submitted: "1" } });
}
</script>

<style scoped>
/* ---- Scale & utilities ---- */
:root,
.admin-page {
  --s-1: .25rem;
  --s-2: .5rem;
  --s-3: .75rem;
  --s-4: 1rem;
  --s-5: 1.25rem;
  --s-6: 1.5rem;
  --s-8: 2rem;
}

.h1 {
  font-size: 1.375rem;
  line-height: 1.2;
  margin: 0
}

.meta {
  color: #6b7280;
  font-size: .9rem
}

.stack>*+* {
  margin-top: var(--space, var(--s-4))
}

.cluster {
  display: flex;
  gap: var(--s-2)
}

.cluster.center {
  align-items: center
}

.cluster.between {
  justify-content: space-between
}

.cluster.wrap {
  flex-wrap: wrap
}

/* ---- Card & inputs ---- */
.admin-page {
  display: grid;
  gap: var(--s-6)
}

.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: var(--s-6);
  background: #fff
}

.input {
  width: 100%;
  padding: .5rem .65rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff
}

.label {
  font-weight: 600;
  margin: 0
}

.btn {
  padding: .45rem .8rem;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  cursor: pointer
}

.btn:hover {
  background: #f3f4f6
}

.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff
}

.btn[disabled] {
  opacity: .6;
  cursor: not-allowed
}

/* ---- Questions ---- */
.q-list {
  list-style: none;
  margin: 0;
  padding: 0
}

.index {
  min-width: 2ch
}
</style>
