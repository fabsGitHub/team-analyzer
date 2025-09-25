<template>
  <section class="admin-page">
    <div class="card stack" style="--space: var(--s-6)">
      <header class="cluster between center">
        <h1 class="h1">{{ t('admin.teams.title') }}</h1>
      </header>

      <!-- Neues Team anlegen -->
      <form class="stack" style="--space: var(--s-3)" @submit.prevent="createTeam">
        <h2 class="h2">{{ t('admin.teams.newTitle') }}</h2>
        <div class="grid cols-3">
          <input v-model="newTeamName" class="input" :placeholder="t('admin.teams.namePlaceholder')" required
            :aria-label="t('admin.teams.namePlaceholder')" />
          <input v-model="newLeaderId" class="input" :placeholder="t('admin.teams.leaderIdPlaceholder')" required
            :aria-label="t('admin.teams.leaderIdPlaceholder')" />
          <button class="btn primary" :aria-label="t('admin.teams.createBtn')">
            {{ t('admin.teams.createBtn') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Bestehende Teams -->
    <div v-if="teams.length" class="stack" style="--space: var(--s-6)">
      <article v-for="team in teams" :key="team.id" class="card stack" style="--space: var(--s-4)">
        <header class="cluster between center">
          <div class="cluster center" style="gap: var(--s-3)">
            <h2 class="h2">{{ team.name }}</h2>
            <span class="meta">{{ t('admin.teams.membersCount', { n: team.members.length }) }}</span>
            <span class="meta">{{ t('admin.teams.leadersCount', { n: leaderCount(team) }) }}</span>
          </div>
          <button class="btn danger ghost" @click="openDeleteDialog(team.id)">
            {{ t('admin.teams.deleteTeam') }}
          </button>
        </header>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ t('admin.teams.userId') }}</th>
                <th class="w-0">{{ t('admin.teams.leader') }}</th>
                <th class="w-0">{{ t('admin.teams.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in team.members" :key="m.userId">
                <td><code class="mono">{{ m.userId }}</code></td>
                <td class="w-0">
                  <span v-if="m.leader" class="badge">{{ t('admin.teams.leader') }}</span>
                </td>
                <td class="w-0">
                  <div class="cluster between wrap">
                    <button class="btn" @click="toggleLeader(team.id, m.userId, !m.leader)">
                      {{ m.leader ? t('admin.teams.removeLeader') : t('admin.teams.makeLeader') }}
                    </button>
                    <button class="btn danger" @click="openRemoveMemberDialog(team.id, m.userId)">
                      {{ t('admin.teams.removeMember') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!team.members.length">
                <td colspan="3" class="empty">{{ t('admin.teams.noneTeams') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mitglied hinzufügen (pro Team eigener Eingabestatus) -->
        <form class="grid" @submit.prevent="addMember(team.id)">
          <input v-model="memberInputs[team.id].userId" class="input"
            :placeholder="t('admin.teams.addMember.userIdPlaceholder')" required
            :aria-label="t('admin.teams.addMember.userIdPlaceholder')" />
          <label class="cluster center" style="gap: var(--s-2)">
            <input type="checkbox" v-model="memberInputs[team.id].leader" />
            {{ t('admin.teams.addMember.isLeader') }}
          </label>
          <button class="btn">{{ t('admin.teams.addMember.addBtn') }}</button>
        </form>
      </article>
    </div>

    <div v-else class="card empty-state">
      {{ t('admin.teams.noneMembers') }}
    </div>

    <!-- Dialog für Team-Löschen -->
    <DialogModal :open="deleteDialog.open" :danger="true" :cancelText="t('form.cancel')"
      :confirmText="t('admin.teams.deleteTeam')" @close="deleteDialog.open = false" @confirm="confirmDeleteTeam">
      <template #title>{{ t('admin.teams.deleteTeam') }}</template>
      <div>
        {{ deleteDialog.teamName
          ? t('admin.teams.confirmDeleteTeamWithName', { team: deleteDialog.teamName })
          : t('admin.teams.confirmDelete') }}
      </div>
    </DialogModal>

    <!-- Dialog für Mitglied entfernen -->
    <DialogModal :open="removeMemberDialog.open" :danger="true" :cancelText="t('form.cancel')"
      :confirmText="t('admin.teams.removeMember')" @close="removeMemberDialog.open = false"
      @confirm="confirmRemoveMember">
      <template #title>{{ t('admin.teams.removeMemberTitle') }}</template>
      <div>
        {{ t('admin.teams.confirmRemoveMember', {
          userId: removeMemberDialog.userId ?? '',
          team: removeMemberDialog.teamName ?? ''
        }) }}
      </div>
    </DialogModal>

  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Api } from '@/api/client'
import type { TeamAdminDto } from '@/types'
import DialogModal from '@/components/DialogModal.vue'

const { t } = useI18n()
const teams = ref<TeamAdminDto[]>([])
const newTeamName = ref('')
const newLeaderId = ref('')
const memberInputs = reactive<Record<string, { userId: string; leader: boolean }>>({})

// Dialog-Status
const deleteDialog = reactive<{ open: boolean; teamId: string | null; teamName: string | null }>({
  open: false, teamId: null, teamName: null
})

function openDeleteDialog(teamId: string) {
  const team = teams.value.find(t => t.id === teamId) || null
  deleteDialog.teamId = teamId
  deleteDialog.teamName = team?.name ?? null
  deleteDialog.open = true
}


async function confirmDeleteTeam() {
  if (deleteDialog.teamId) {
    await Api.deleteTeamAdmin(deleteDialog.teamId)
    await loadTeams()
  }
  deleteDialog.open = false
  deleteDialog.teamId = null
}

const removeMemberDialog = reactive<{ open: boolean; teamId: string | null; userId: string | null; teamName: string | null }>({
  open: false, teamId: null, userId: null, teamName: null
})

function openRemoveMemberDialog(teamId: string, userId: string) {
  const team = teams.value.find(t => t.id === teamId) || null
  removeMemberDialog.teamId = teamId
  removeMemberDialog.userId = userId
  removeMemberDialog.teamName = team?.name ?? null
  removeMemberDialog.open = true
}

async function confirmRemoveMember() {
  if (removeMemberDialog.teamId && removeMemberDialog.userId) {
    await Api.removeMemberAdmin(removeMemberDialog.teamId, removeMemberDialog.userId)
    await loadTeams()
  }
  removeMemberDialog.open = false
  removeMemberDialog.teamId = null
  removeMemberDialog.userId = null
  removeMemberDialog.teamName = null
}


function ensureMemberInput(teamId: string) {
  if (!memberInputs[teamId]) memberInputs[teamId] = { userId: '', leader: false }
  return memberInputs[teamId]
}

function leaderCount(team: TeamAdminDto) {
  return team.members.filter((m) => m.leader).length
}

async function loadTeams() {
  teams.value = await Api.listTeamsAdmin()
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
