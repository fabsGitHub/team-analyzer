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
            method: 'GET', credentials: 'include',
        })
        if (res.status === 204 || res.ok) {
            status.value = 'ok'
            router.replace('/auth?verified=1')
        } else {
            status.value = 'error'
        }
    } catch { status.value = 'error' }
})
</script>

<template>
    <section class="admin-page">
        <article class="card stack" style="--space: var(--s-3)">
            <h1 class="h1">E-Mail bestätigen</h1>
            <p v-if="status === 'idle'" class="meta">Bestätige…</p>
            <p v-else-if="status === 'missing'" class="meta">Kein Token in der URL gefunden.</p>
            <p v-else-if="status === 'error'" class="meta">Bestätigung fehlgeschlagen. Bitte Link erneut öffnen.</p>
            <p v-else class="meta">Bestätigt — weiterleiten…</p>
        </article>
    </section>
</template>

<style scoped>
:root,
.admin-page {
    --s-3: .75rem;
    --s-4: 1rem;
    --s-6: 1.5rem
}

.h1 {
    margin: 0 0 .25rem;
    font-size: 1.25rem
}

.meta {
    color: #6b7280
}

.stack>*+* {
    margin-top: var(--space, var(--s-3))
}

.admin-page {
    display: grid;
    gap: var(--s-6)
}

.card {
    max-width: 600px;
    margin-inline: auto;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: var(--s-6);
    background: #fff
}
</style>
