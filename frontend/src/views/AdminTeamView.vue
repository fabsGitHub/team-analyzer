<template>
  <section class="card">
    <h1>Teamverwaltung</h1>

    <!-- Neues Team anlegen -->
    <form class="mb-4" @submit.prevent="createTeam">
      <h2>Neues Team erstellen</h2>
      <div class="form-row">
        <input v-model="newTeamName" class="input" placeholder="Team-Name" required />
        <input v-model="newLeaderId" class="input" placeholder="Leader-UserId (UUID)" required />
        <button class="btn primary">Anlegen</button>
      </div>
    </form>

    <!-- Bestehende Teams -->
    <div v-for="team in teams" :key="team.id" class="team-card">
      <header class="team-header">
        <h2>{{ team.name }}</h2>
        <button class="btn danger" @click="removeTeam(team.id)">Team löschen</button>
      </header>

      <table class="table responsive">
        <thead>
          <tr>
            <th>User ID</th>
            <th>Leader</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in team.members" :key="m.userId">
            <td><code>{{ m.userId }}</code></td>
            <td>
              <span v-if="m.leader" class="badge">Leader</span>
            </td>
            <td class="actions actions-wrap">
              <button class="btn" @click="toggleLeader(team.id, m.userId, !m.leader)">
                {{ m.leader ? 'Leader entziehen' : 'Leader machen' }}
              </button>
              <button class="btn danger" @click="removeMember(team.id, m.userId)">Entfernen</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mitglied hinzufügen -->
      <form class="form-row mt-2" @submit.prevent="addMember(team.id)">
        <input v-model="memberUserId" class="input" placeholder="UserId (UUID)" required />
        <label>
          <input type="checkbox" v-model="memberLeader" />
          Leader?
        </label>
        <button class="btn">Hinzufügen</button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Api } from "@/api/client";
import type { TeamAdminDto } from "@/types";

const teams = ref<TeamAdminDto[]>([]);
const newTeamName = ref("");
const newLeaderId = ref("");

// state fürs Hinzufügen (einfach global; kann später pro Team lokalisiert werden)
const memberUserId = ref("");
const memberLeader = ref(false);

async function loadTeams() {
  teams.value = await Api.listTeamsAdmin();
}

async function createTeam() {
  await Api.createTeamAdmin(newTeamName.value.trim(), newLeaderId.value.trim());
  newTeamName.value = "";
  newLeaderId.value = "";
  await loadTeams();
}

async function addMember(teamId: string) {
  await Api.addMemberAdmin(teamId, memberUserId.value.trim(), memberLeader.value);
  memberUserId.value = "";
  memberLeader.value = false;
  await loadTeams();
}

async function toggleLeader(teamId: string, userId: string, leader: boolean) {
  await Api.setLeaderAdmin(teamId, userId, leader);
  await loadTeams();
}

async function removeMember(teamId: string, userId: string) {
  await Api.removeMemberAdmin(teamId, userId);
  await loadTeams();
}

// NEU: Team löschen (inkl. Mitglieder)
async function removeTeam(teamId: string) {
  if (confirm("Soll das Team wirklich gelöscht werden? Alle Mitglieder werden entfernt!")) {
    await Api.deleteTeamAdmin(teamId);
    await loadTeams();
  }
}

onMounted(loadTeams);
</script>

<style scoped>
.team-card {
  border: 1px solid #ddd;
  border-radius: .5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-row {
  display: flex;
  gap: .5rem;
  align-items: center;
}

.badge {
  background: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
}
</style>
