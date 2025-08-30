<!-- frontend/src/views/AuthView.vue -->
<template>
    <section class="card">
        <h1>{{ t('auth.title') }}</h1>
        <form @submit.prevent="go" class="row" aria-describedby="auth-help">
            <label class="label" :for="id">{{ t('auth.name') }}</label>
            <input :id="id" class="input" v-model="name" required autocomplete="name" />
            <p id="auth-help" class="label">{{ t('auth.go') }} → {{ t('nav.tutorial') }}</p>
            <div class="row" style="justify-content:flex-end">
                <button class="btn primary">{{ t('auth.signin') }}</button>
                <button class="btn">{{ t('auth.signup') }}</button>
            </div>
        </form>
    </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useStore } from '../store'
import { Api } from '../api/client'
const { t } = useI18n(); const router = useRouter(); const { setToken } = useStore()
const id = 'name-input'
const name = ref('')
async function go() {
    const res = await Api.signIn(name.value)
    setToken(res.token); router.push('/tutorial')
}
</script>
