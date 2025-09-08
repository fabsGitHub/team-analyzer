<!-- frontend/src/views/AuthView.vue -->
<template>
  <section class="card">
    <h1>{{ t('auth.title') }}</h1>

    <form @submit.prevent="onSignIn" class="row" aria-describedby="auth-help">
      <label class="label" :for="idEmail">{{ t('auth.email') }}</label>
      <input :id="idEmail" class="input" v-model="email" required autocomplete="email" />

      <label class="label" :for="idPwd">{{ t('auth.password') }}</label>
      <input :id="idPwd" class="input" v-model="password" type="password" required autocomplete="current-password"
        minlength="10" />

      <div class="row" style="justify-content:flex-end; gap:.5rem;">
        <button class="btn primary" :disabled="busy">{{ busy ? t('auth.signingin') : t('auth.signin') }}</button>
        <button class="btn" type="button" :disabled="busy" @click="onSignUp">{{ t('auth.signup') }}</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="onReset">{{ t('auth.reset') }}</button>
      </div>

      <p v-if="msg" class="label">{{ msg }}</p>
      <p v-if="err" class="label" style="color:var(--red)">{{ err }}</p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter, useRoute } from "vue-router"
import { useStore } from "../store"

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { login, register, resetPassword } = useStore()

const idEmail = "email-input"
const idPwd = "password-input"
const email = ref("")
const password = ref("")
const busy = ref(false)
const err = ref("")
const msg = ref("")

// Auto-Verify, wenn ?token=... in der URL ist; oder Hinweis, wenn ?verified=1
onMounted(async () => {
  const token = (route.query.token as string | undefined) ?? ""
  if (token) {
    busy.value = true
    try {
      const res = await fetch("/api/auth/verify?token=" + encodeURIComponent(token), {
        method: "GET",
        credentials: "include",
      })
      if (res.status === 204 || res.ok) {
        msg.value = t("auth.verified_ok") || "E-Mail bestätigt – bitte anmelden."
        // URL aufräumen, optional mit Marker
        router.replace({ path: "/auth", query: { verified: "1" } })
        return
      } else {
        err.value = t("auth.verified_failed") || "Verifizierungslink ist ungültig oder abgelaufen."
      }
    } catch (e: any) {
      err.value = e?.message || String(e)
    } finally {
      busy.value = false
    }
  } else if (route.query.verified === "1") {
    msg.value = t("auth.verified_ok") || "E-Mail bestätigt – bitte anmelden."
  }
})

async function onSignIn() {
  err.value = ""
  msg.value = ""
  busy.value = true
  try {
    // E-Mail immer normalisieren
    await login(email.value.trim().toLowerCase(), password.value)
    router.push("/tutorial")
  } catch (e: any) {
    err.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    busy.value = false
  }
}

async function onSignUp() {
  err.value = ""
  msg.value = ""
  busy.value = true
  try {
    await register(email.value.trim().toLowerCase(), password.value)
    msg.value = t("auth.check_inbox") || "Registriert. Bitte E-Mail öffnen und den Bestätigungslink klicken."
  } catch (e: any) {
    if (e?.response?.status === 409) {
      err.value = t("auth.exists") || "Diese E-Mail ist bereits registriert. Bitte anmelden oder Passwort zurücksetzen."
    } else {
      err.value = e?.response?.data?.message || e?.message || String(e)
    }
  } finally {
    busy.value = false
  }
}

async function onReset() {
  err.value = ""
  msg.value = ""
  if (!email.value) {
    err.value = t("auth.enter_email") || "Bitte E-Mail-Adresse eingeben."
    return
  }
  busy.value = true
  try {
    await resetPassword(email.value.trim().toLowerCase())
    msg.value = t("auth.reset_sent") || "Falls registriert, wurde eine E-Mail zum Zurücksetzen gesendet."
  } catch (e: any) {
    err.value = e?.response?.data?.message || e?.message || String(e)
  } finally {
    busy.value = false
  }
}
</script>
