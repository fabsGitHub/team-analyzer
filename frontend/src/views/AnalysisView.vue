<!-- frontend/src/views/AnalysisView.vue -->
<template>
    <section class="row">
        <div class="card" style="width: 100%">
            <label class="label" for="teams">{{ t('analysis.pick') }}</label>
            <select id="teams" class="select" multiple size="3" v-model="selected">
                <option v-for="t in state.teams" :key="t" :value="t" @click="openDetails(t)">
                    {{ t }}
                </option>
            </select>
            <p class="label">
                Max 3 Teams. <span class="kbd">Strg/Cmd</span> oder
                <span class="kbd">Shift</span> für Mehrfachauswahl.
            </p>
        </div>

        <RadarChart :title="t('analysis.compare')" :series="series" @select="openDetails" />

        <DialogModal :open="detailOpen" @close="detailOpen = false" :confirmText="'OK'" :cancelText="t('form.cancel')"
            @confirm="detailOpen = false">
            <template #title>{{
                t('analysis.details', { team: currentTeam || '' })
            }}</template>
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Team</th>
                        <th>W</th>
                        <th>G</th>
                        <th>A</th>
                        <th>U</th>
                        <th>T</th>
                        <th>{{ t('table.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="e in detailRows" :key="String(e.id)">
                        <td>{{ e.name }}</td>
                        <td>
                            <span class="badge">{{ e.team }}</span>
                        </td>
                        <td>{{ e.appreciation }}</td>
                        <td>{{ e.equality }}</td>
                        <td>{{ e.workload }}</td>
                        <td>{{ e.collegiality }}</td>
                        <td>{{ e.transparency }}</td>
                        <td>
                            <button class="btn danger" @click="del(String(e.id))">
                                {{ t('table.del') }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </DialogModal>
    </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RadarChart from '../components/RadarChart.vue'
import { useStore } from '../store'

const { t } = useI18n()
const { state, fetchAggregates, deleteEvaluation } = useStore()

const selected = ref<string[]>([])

watch(selected, (v) => {
    if (v.length > 3) selected.value = v.slice(0, 3)
})

watch(() => state.evalVersion, () => {
    void fetchAggregates()
})

const series = computed(() => {
    const a = state.aggregatesCache || []
    // Map backend DTO → { label, values }
    return a
        .filter((row: any) => selected.value.includes(row.team))
        .map((row: any) => ({
            label: row.team,
            values: {
                appreciation: row.appreciation,
                equality: row.equality,
                workload: row.workload,
                collegiality: row.collegiality,
                transparency: row.transparency
            }
        }))
})


const detailOpen = ref(false)

const currentTeam = ref<string | undefined>(undefined)

const detailRows = computed(() =>
    state.evaluations.filter((e) => e.team === currentTeam.value),
)

function openDetails(label: string) {
    currentTeam.value = label
    detailOpen.value = true
}
function del(id: string) {
    deleteEvaluation(id)
}
</script>
