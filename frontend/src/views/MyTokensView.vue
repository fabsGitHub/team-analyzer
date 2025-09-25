<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Api } from '@/api/client'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
type MyOpenToken = Awaited<ReturnType<typeof Api.listMyOpenTokens>>[number]

const tokens = ref<MyOpenToken[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load() {
    loading.value = true
    error.value = null
    try {
        tokens.value = await Api.listMyOpenTokens()
    } catch (e: any) {
        error.value = e?.response?.data?.message || e?.message || 'Fehler beim Laden'
    } finally {
        loading.value = false
    }
}

async function goToSurvey(t: MyOpenToken) {
    busyId.value = t.surveyId
    try {
        // 1) versuchen: bestehenden Link liefern lassen
        let { inviteLink } = await Api.myTokenForSurvey(t.surveyId)

        // 2) falls kein Link (weil bereits ein offenes Token existiert), erneuern
        if (!inviteLink) {
            const renewed = await Api.renewMyToken(t.surveyId)
            inviteLink = renewed.inviteLink
        }

        if (!inviteLink) {
            throw new Error('Kein Invite-Link verfügbar')
        }

        // 3) hart zum Link navigieren (enthält Plain-Token im Query)
        window.location.href = inviteLink
    } catch (e: any) {
        error.value = e?.response?.data?.message || e?.message || 'Fehler beim Öffnen der Umfrage'
    } finally {
        busyId.value = null
    }
}

onMounted(load)
</script>

<template>
    <section class="card">
        <h1>{{ t('tokens.title') }}</h1>

        <div v-if="loading" class="muted">{{ t('tokens.loading') }}</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else>
            <div v-if="tokens.length === 0" class="muted">{{ t('tokens.none') }}</div>
            <ul class="list">
                <li v-for="token in tokens" :key="token.tokenId" class="row">
                    <div>
                        <strong>{{ token.surveyTitle }}</strong>
                        <div class="muted">{{ t('tokens.issuedAt') }} {{ new Date(token.issuedAt).toLocaleString() }}
                        </div>
                    </div>
                    <div class="actions">
                        <button class="btn" @click="goToSurvey(token)" :disabled="busyId === token.surveyId">
                            {{ t('tokens.openSurvey') }}
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </section>
</template>
