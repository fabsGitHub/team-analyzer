<!-- frontend/src/views/EvaluateView.vue -->
<template>
    <section class="card" role="region" aria-labelledby="title-eval">
        <div class="bar">
            <h1 id="title-eval">{{ t('form.add') }}</h1>
            <button class="btn primary" @click="openNew">+ {{ t('form.add') }}</button>
        </div>

        <!-- Tabelle (Desktop), Karten (Mobil) -->
        <table class="table responsive" aria-describedby="tbl-caption">
            <caption id="tbl-caption" class="label">
                {{ state.evaluations.length ? '' : t('table.empty') }}
            </caption>
            <thead>
                <tr>
                    <th>{{ t('form.name') }}</th>
                    <th>{{ t('form.team') }}</th>
                    <th>W</th>
                    <th>G</th>
                    <th>A</th>
                    <th>U</th>
                    <th>T</th>
                    <th>{{ t('table.actions') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="e in state.evaluations" :key="String(e.id)">
                    <td data-label="Name">{{ e.name }}</td>
                    <td data-label="Team"><span class="badge">{{ e.team }}</span></td>
                    <td data-label="W">{{ e.appreciation }}</td>
                    <td data-label="G">{{ e.equality }}</td>
                    <td data-label="A">{{ e.workload }}</td>
                    <td data-label="U">{{ e.collegiality }}</td>
                    <td data-label="T">{{ e.transparency }}</td>
                    <td class="actions actions-wrap">
                        <button class="btn" @click="startEdit(e)">{{ t('table.edit') }}</button>
                        <button class="btn danger" @click="askDelete(e)">{{ t('table.del') }}</button>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Dialog: Formular unverändert übernommen -->
        <DialogModal :open="isOpen" @close="close" :confirmText="t('form.save')" :cancelText="t('form.cancel')"
            @confirm="confirm">
            <template #title>{{ editing ? t('form.edit') : t('form.add') }}</template>
            <form class="row" @submit.prevent>
                <label class="label" for="name">{{ t('form.name') }}</label>
                <input id="name" class="input" v-model="form.name" required />

                <label class="label" for="team">{{ t('form.team') }}</label>
                <select id="team" class="select" v-model="form.team" required>
                    <option v-for="t in state.teams" :key="t" :value="t">{{ t }}</option>
                </select>

                <fieldset>
                    <legend class="label">Kategorien</legend>
                    <div class="row">
                        <div v-for="k in keys" :key="k">
                            <label class="label" :for="k">{{ labels[k] }}</label>
                            <input type="range" min="1" max="5" :id="k" v-model.number="(form as any)[k]" />
                            <div aria-live="polite">{{ (form as any)[k] }}</div>
                        </div>
                    </div>
                </fieldset>
            </form>
        </DialogModal>

        <DialogModal :open="confirmDel != null" danger :confirmText="t('table.del')" :cancelText="t('form.cancel')"
            @close="confirmDel = null" @confirm="doDelete">
            <template #title>Löschen bestätigen</template>
            <p>Möchtest du diese Bewertung wirklich löschen?</p>
        </DialogModal>
    </section>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogModal from '../components/DialogModal.vue'
import { useStore } from '../store'
import { CATEGORY_KEYS, type CategoryKey, type Evaluation } from '../types'

const { t } = useI18n()
const { state, addEvaluation, updateEvaluation, deleteEvaluation } = useStore()

const keys = CATEGORY_KEYS
const labels: Record<CategoryKey, string> = {
    appreciation: t('categories.appreciation'),
    equality: t('categories.equality'),
    workload: t('categories.workload'),
    collegiality: t('categories.collegiality'),
    transparency: t('categories.transparency')
}

const empty = () => ({
    name: '',
    team: state.teams[0] ?? 'Team 1',
    appreciation: 3,
    equality: 3,
    workload: 3,
    collegiality: 3,
    transparency: 3
})

const form = reactive<any>(empty())
const isOpen = ref(false)
const editing = ref(false)
let editId: string | undefined = undefined

function openNew() { Object.assign(form, empty()); editing.value = false; isOpen.value = true }
function close() { isOpen.value = false }
function confirm() {
    if (editing.value && editId) {
        updateEvaluation(editId, { ...form, name: form.name, team: form.team })
    } else {
        addEvaluation({ ...form })
    }
    close()
}
function startEdit(e: Evaluation) {
    Object.assign(form, {
        name: e.name,
        team: e.team,
        appreciation: e.appreciation,
        equality: e.equality,
        workload: e.workload,
        collegiality: e.collegiality,
        transparency: e.transparency
    })
    editing.value = true; editId = String(e.id); isOpen.value = true
}
const confirmDel = ref<Evaluation | null>(null)
function askDelete(e: Evaluation) { confirmDel.value = e }
function doDelete() { if (confirmDel.value) deleteEvaluation(String(confirmDel.value.id)); confirmDel.value = null }
</script>

<style scoped>
.bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: .5rem;
}

.table th,
.table td {
    vertical-align: middle;
}

.table td.actions {
  text-align: center;          /* wenn du beide rechts willst */
  vertical-align: middle;
}

.table td.actions .btn  + .btn {
  margin-left: 1rem;        /* <- dein “space” */
}


</style>
