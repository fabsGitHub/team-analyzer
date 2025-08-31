<!-- frontend/src/views/AuthView.vue -->
<template>
  <section class="card">
    <h1>{{ t('auth.title') }}</h1>

    <form @submit.prevent="onSignIn" class="row" aria-describedby="auth-help">
      <label class="label" :for="idEmail">{{ t('auth.email') }}</label>
      <input :id="idEmail" class="input" v-model="email" required autocomplete="email" />

      <label class="label" :for="idPwd">{{ t('auth.password') }}</label>
      <input :id="idPwd" class="input" v-model="password" type="password" required autocomplete="current-password" minlength="10" />

      <p id="auth-help" class="label">{{ t('auth.go') }} → {{ t('nav.tutorial') }}</p>

      <div class="row" style="justify-content:flex-end; gap:.5rem;">
        <button class="btn primary" :disabled="busy">{{ busy ? t('auth.signingin') : t('auth.signin') }}</button>
        <button class="btn" type="button" :disabled="busy" @click="onSignUp">{{ t('auth.signup') }}</button>
      </div>

      <p v-if="err" class="label" style="color:var(--red)">{{ err }}</p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { useStore } from "../store"

const { t } = useI18n()
const router = useRouter()
const { login, register } = useStore()

const idEmail = "email-input"
const idPwd = "password-input"
const email = ref("")
const password = ref("")
const busy = ref(false)
const err = ref("")

async function onSignIn() {
  err.value = ""
  busy.value = true
  try {
    await login(email.value, password.value)
    router.push("/tutorial")
  } catch (e: any) {
    err.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    busy.value = false
  }
}

async function onSignUp() {
  err.value = ""
  busy.value = true
  try {
    await register(email.value, password.value)
    // Falls E-Mail-Verification aktiv: nur Hinweis anzeigen
    // Optional: nach erfolgreicher Registrierung direkt einloggen:
    // await login(email.value, password.value)
  } catch (e: any) {
    err.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    busy.value = false
  }
}
</script>
