<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const status = ref<'idle' | 'ok' | 'missing' | 'error'>('idle')

onMounted(async () => {
    const token = (route.query.token as string | undefined) ?? ''
    if (!token) { status.value = 'missing'; return }

    try {
        const res = await fetch('/api/auth/verify?token=' + encodeURIComponent(token), {
            method: 'GET',
            credentials: 'include',
        })
        if (res.status === 204 || res.ok) {
            status.value = 'ok'
            router.replace('/auth?verified=1') // zurück zur Login-Seite
        } else {
            status.value = 'error'
        }
    } catch {
        status.value = 'error'
    }
})
</script>

<template>
    <div class="p-8">
        <h1 class="text-xl font-semibold mb-4">E-Mail bestätigen</h1>
        <p v-if="status === 'idle'">Bestätige…</p>
        <p v-else-if="status === 'missing'">Kein Token in der URL gefunden.</p>
        <p v-else-if="status === 'error'">Bestätigung fehlgeschlagen. Bitte Link erneut öffnen.</p>
        <p v-else>Bestätigt — weiterleiten…</p>
    </div>
</template>
