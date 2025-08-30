// frontend/src/i18n.ts
import { createI18n } from 'vue-i18n'
const de = {
  app: 'Team Radar',
  auth: { title:'Anmelden', signin:'Einloggen', signup:'Registrieren', name:'Name', go:'Weiter' },
  nav: { evaluate:'Bewerten', analysis:'Analyse', tutorial:'Tutorial' },
  form: {
    add:'Neue Bewertung',
    edit:'Bewertung bearbeiten',
    name:'Name der Person',
    team:'Team',
    save:'Speichern',
    cancel:'Abbrechen'
  },
  categories: {
    appreciation:'Wertschätzung',
    equality:'Gleichwertigkeit',
    workload:'Arbeitsbelastung',
    collegiality:'Umgang',
    transparency:'Transparenz'
  },
  table: { actions:'Aktionen', edit:'Bearbeiten', del:'Löschen', empty:'Noch keine Bewertungen.' },
  analysis: { pick:'Teams auswählen (max. 3)', details:'Details für {team}', compare:'Team-Vergleich', avg:'Durchschnitt' },
  toast: { saved:'Gespeichert', deleted:'Gelöscht', updated:'Aktualisiert' }
}
const en = {
  app: 'Team Radar',
  auth: { title:'Sign in', signin:'Sign in', signup:'Sign up', name:'Name', go:'Continue' },
  nav: { evaluate:'Evaluate', analysis:'Analysis', tutorial:'Tutorial' },
  form: {
    add:'New Evaluation',
    edit:'Edit Evaluation',
    name:'Person name',
    team:'Team',
    save:'Save',
    cancel:'Cancel'
  },
  categories: {
    appreciation:'Appreciation',
    equality:'Equality',
    workload:'Workload',
    collegiality:'Collegiality',
    transparency:'Transparency'
  },
  table: { actions:'Actions', edit:'Edit', del:'Delete', empty:'No evaluations yet.' },
  analysis: { pick:'Select teams (max. 3)', details:'Details for {team}', compare:'Team comparison', avg:'Average' },
  toast: { saved:'Saved', deleted:'Deleted', updated:'Updated' }
}
export const i18n = createI18n({ legacy:false, locale: 'de', fallbackLocale:'en', messages: { de, en } })
