<template>
  <section class="admin-page">
    <div class="card stack" style="--space: var(--s-6)">
      <header class="cluster between center">
        <h1 class="h1">Teamverwaltung</h1>
      </header>

      <!-- Neues Team anlegen -->
      <form class="stack" style="--space: var(--s-3)" @submit.prevent="createTeam">
        <h2 class="h2">Neues Team erstellen</h2>

        <div class="grid cols-3">
          <input v-model="newTeamName" class="input" placeholder="Team-Name" required aria-label="Team-Name" />
          <input v-model="newLeaderId" class="input" placeholder="Leader-UserId (UUID)" required
            aria-label="Leader-UserId" />
          <button class="btn primary" aria-label="Team anlegen">Anlegen</button>
        </div>
      </form>
    </div>

    <!-- Bestehende Teams -->
    <div v-if="teams.length" class="stack" style="--space: var(--s-6)">
      <article v-for="team in teams" :key="team.id" class="card stack" style="--space: var(--s-4)">
        <header class="cluster between center">
          <div class="cluster center" style="gap: var(--s-3)">
            <h2 class="h2">{{ team.name }}</h2>
            <span class="meta">Mitglieder: {{ team.members.length }}</span>
            <span class="meta">Leader: {{ leaderCount(team) }}</span>
          </div>
          <button class="btn danger ghost" @click="removeTeam(team.id)">Team löschen</button>
        </header>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th class="w-0">Leader</th>
                <th class="w-0">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in team.members" :key="m.userId">
                <td><code class="mono">{{ m.userId }}</code></td>
                <td class="w-0">
                  <span v-if="m.leader" class="badge">Leader</span>
                </td>
                <td class="w-0">
                  <div class="cluster between wrap">
                    <button class="btn" @click="toggleLeader(team.id, m.userId, !m.leader)">
                      {{ m.leader ? 'Leader entziehen' : 'Leader machen' }}
                    </button>
                    <button class="btn danger" @click="removeMember(team.id, m.userId)">Entfernen</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!team.members.length">
                <td colspan="3" class="empty">Noch keine Mitglieder</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mitglied hinzufügen (pro Team eigener Eingabestatus) -->
        <form class="grid" @submit.prevent="addMember(team.id)">
          <input v-model="memberInputs[team.id].userId" class="input" :placeholder="`UserId (UUID)`" required
            :aria-label="`UserId für ${team.name}`" />
          <label class="cluster center" style="gap: var(--s-2)">
            <input type="checkbox" v-model="memberInputs[team.id].leader" />
            Leader?
          </label>
          <button class="btn">Hinzufügen</button>
        </form>
      </article>
    </div>

    <div v-else class="card empty-state">
      Noch keine Teams angelegt. Lege oben ein Team an.
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Api } from '@/api/client'
import type { TeamAdminDto } from '@/types'

const teams = ref<TeamAdminDto[]>([])

const newTeamName = ref('')
const newLeaderId = ref('')

// pro Team eigene Eingaben: { [teamId]: { userId, leader } }
const memberInputs = reactive<Record<string, { userId: string; leader: boolean }>>({})

function ensureMemberInput(teamId: string) {
  if (!memberInputs[teamId]) memberInputs[teamId] = { userId: '', leader: false }
  return memberInputs[teamId]
}

function leaderCount(team: TeamAdminDto) {
  return team.members.filter((m) => m.leader).length
}

async function loadTeams() {
  teams.value = await Api.listTeamsAdmin()
  // Eingabestatus sicherstellen
  teams.value.forEach((t) => ensureMemberInput(t.id))
}

async function createTeam() {
  await Api.createTeamAdmin(newTeamName.value.trim(), newLeaderId.value.trim())
  newTeamName.value = ''
  newLeaderId.value = ''
  await loadTeams()
}

async function addMember(teamId: string) {
  const input = ensureMemberInput(teamId)
  await Api.addMemberAdmin(teamId, input.userId.trim(), input.leader)
  input.userId = ''
  input.leader = false
  await loadTeams()
}

async function toggleLeader(teamId: string, userId: string, leader: boolean) {
  await Api.setLeaderAdmin(teamId, userId, leader)
  await loadTeams()
}

async function removeMember(teamId: string, userId: string) {
  await Api.removeMemberAdmin(teamId, userId)
  await loadTeams()
}

async function removeTeam(teamId: string) {
  if (confirm('Soll das Team wirklich gelöscht werden? Alle Mitglieder werden entfernt!')) {
    await Api.deleteTeamAdmin(teamId)
    await loadTeams()
  }
}

onMounted(loadTeams)
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

.empty-state {
  text-align: center;
  color: #6b7280;
}

.input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
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

.btn.danger {
  border-color: #ef4444;
  color: #ef4444;
  background: #fff;
}

.btn.danger:hover {
  background: #fef2f2;
}

.btn.ghost {
  background: transparent;
}

/* -------- Table -------- */
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

.empty {
  color: #9ca3af;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 0.8rem;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
