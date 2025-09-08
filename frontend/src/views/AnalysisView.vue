<!-- frontend/src/views/AnalysisView.vue -->
<template>
    <section class="analysis-layout" aria-label="Team analysis">
        <div>
            <div class="card compact">
                <label class="label" for="teams">{{ t('analysis.pick') }}</label>
                <select id="teams" class="select" multiple size="3" v-model="selected">
                    <option v-for="t in state.teams" :key="t" :value="t" @click="openDetails(t)">{{ t }}</option>
                </select>
                <p class="label hint">Max 3 Teams. <span class="kbd">Strg/Cmd</span> / <span class="kbd">Shift</span>.
                </p>
            </div>

            <DialogModal :open="detailOpen" @close="detailOpen = false" :confirmText="'OK'"
                :cancelText="t('form.cancel')" @confirm="detailOpen = false">
                <template #title>{{ t('analysis.details') }}</template>

                <div class="details-wrap">
                    <!-- eine Sektion pro Team -->
                    <section v-for="team in teamsInDialog" :key="team" class="team-section">
                        <header class="team-header">
                            <span class="badge big">{{ team }}</span>
                            <span class="muted ">{{ rowsFor(team).length }} Einträge</span>
                        </header>

                        <table class="table details-table responsive">
                            <!-- feste, sinnvolle Spaltenbreiten -->
                            <colgroup>
                                <col /> <!-- Name (auto) -->
                                <col class="col-num" span="5" /> <!-- W,G,A,U,T -->
                                <col class="col-actions" /> <!-- Aktionen -->
                            </colgroup>

                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>W</th>
                                    <th>G</th>
                                    <th>A</th>
                                    <th>U</th>
                                    <th>T</th>
                                    <th>{{ t('table.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="e in rowsFor(team)" :key="String(e.id)">
                                    <td data-label="Name">{{ e.name }}</td>
                                    <td data-label="W" class="num">{{ e.appreciation }}</td>
                                    <td data-label="G" class="num">{{ e.equality }}</td>
                                    <td data-label="A" class="num">{{ e.workload }}</td>
                                    <td data-label="U" class="num">{{ e.collegiality }}</td>
                                    <td data-label="T" class="num">{{ e.transparency }}</td>
                                    <td class="actions">
                                        <button class="btn danger" @click="del(String(e.id))"
                                            :aria-label="t('table.del')">
                                            <span v-html="trashIcon"></span>
                                            <span class="sr-only">{{ t('table.del') }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </section>
                </div>
            </DialogModal>

        </div>


        <div class="card chart-wrap">
            <div class="chart-box">
                <RadarChart :title="t('analysis.compare')" :series="series" :radius-scale="1.25" :center-x="0.5" :center-y="0.5"
                    :angle-start-deg="-70" :label-offset="12" :padding="18" :size-px="520"
                    :categories="['workload', 'collegiality', 'transparency', 'appreciation', 'equality']"
                    @select="openDetails" />
            </div>
        </div>


    </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RadarChart from '../components/RadarChart.vue'
import { useStore } from '../store'
import { Trash } from '../components/Icons'

const { t } = useI18n()
const { state, fetchAggregates, deleteEvaluation } = useStore()

const trashIcon = Trash()

const selected = ref<string[]>([])
watch(selected, v => { if (v.length > 3) selected.value = v.slice(0, 3) })
watch(() => state.evalVersion, () => { void fetchAggregates() })

// welche Teams sollen im Dialog angezeigt werden?
const teamsInDialog = computed(() => {
    // wenn über Legende/Select ein bestimmtes Team geöffnet wurde:
    if (selected.value.length > 0) {
        return selected.value.filter(team => state.evaluations.some(e => e.team === team))
    }

    return []
    // sonst alle aktuell ausgewählten Teams mit vorhandenen Zeilen


})

function rowsFor(team: string) {
    return state.evaluations.filter(e => e.team === team)
}

const series = computed(() => {
    const a = state.aggregatesCache || []
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
function openDetails(label: string) { currentTeam.value = label; detailOpen.value = true }
function del(id: string) { deleteEvaluation(id) }
</script>

<style scoped>
.analysis-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(300px, 1fr));
    gap: 1rem;
    align-items: start;
    padding-block: .5rem;
}

@media (max-width: 720px) {
    .analysis-layout {
        grid-template-columns: 1fr;
    }
}

.team-header {
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.compact {
    padding: .75rem;
}

.hint {
    margin-top: .4rem;
}

.chart-wrap {
    padding: .25rem;
    min-width: 0;
}

.chart-box {
    max-width: 100%;
    margin-inline: auto;
}

/* zentriert & breiter */
.details-wrap {
    max-width: 900px;
    /* Breite, die auf Desktop gut wirkt */
    margin-inline: auto;
    /* zentrieren */
}

.details-table th,
.details-table td {
    vertical-align: middle;
}

.details-table .col-team {
    width: 9rem;
}

.details-table .col-num {
    width: 3.25rem;
    text-align: center;
}

.details-table .col-actions {
    width: 7.5rem;
}

.details-table .num {
    text-align: center;
}

.btn.danger {
    display: inline-flex;
    align-items: center;
    gap: .25rem;
}

.btn.danger>span:first-child svg {
    width: 16px;
    height: 16px;
}

</style>
