// frontend/src/i18n.ts
import { createI18n } from 'vue-i18n'
const de = {
  app: 'Team Radar',
  auth: { title:'Anmelden', signin:'Einloggen', signup:'Registrieren', name:'Name', go:'Weiter', password: 'Passwort', email: 'E-Mail', exists: "Diese E-Mail ist bereits registriert. Bitte anmelden oder Passwort zurücksetzen.", reset: "Passwort vergessen?", reset_sent: "Falls registriert, wurde eine E-Mail zum Zurücksetzen gesendet.", enter_email: "Bitte E-Mail-Adresse eingeben." },
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
  categoryLabels: {
    appreciation: '@:categories.appreciation',
    equality: '@:categories.equality',
    workload: '@:categories.workload',
    collegiality: '@:categories.collegiality',
    transparency: '@:categories.transparency'
  },
  table: { actions:'Aktionen', edit:'Bearbeiten', del:'Löschen', empty:'Noch keine Bewertungen.', name: 'Name' },
  analysis: { pick:'Teams auswählen (max. 3)', details:'Details für 5 Kategorien (1–5) ein und speichere.', compare:'Team-Vergleich', avg:'Durchschnitt', selected: 'ausgewählt', entries: 'Einträge', tip: 'Tipp: Auf eine Team-Badge klicken, um Details zu öffnen.', desc: 'Radar-Diagramm mit Durchschnittswerten für 5 Kategorien.' },
  toast: { saved:'Gespeichert', deleted:'Gelöscht', updated:'Aktualisiert' },
  footer: {
    info: 'Info & Rechtliches',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
    help: 'Hilfe',
    shortcuts: 'Tastenkürzel',
    about: 'Über Team Radar'
  },
  user: {
    account: 'Konto',
    logout: 'Abmelden',
    email: 'E-Mail',
  },
  tutorial: {
    quickstart: "Schnellstart",
    step1: "Gib eine Person, ein Team und Bewertungen für 5 Kategorien (1–5) ein und speichere.",
    step2: "Wähle bis zu 3 Teams aus, vergleiche sie im Radar-Diagramm und klicke auf ein Badge für Details.",
    tip: "Tipp",
    step3: "Mit Strg/Cmd oder Shift kannst du mehrere Teams auswählen.",
  },
  misc: {
    maxTeams: 'Max 3 Teams.',
    ctrl: 'Strg/Cmd',
    shift: 'Shift',
    noData: 'Keine Daten/Teams ausgewählt.',
  },
}
const en = {
  app: 'Team Radar',
  auth: { title:'Sign in', signin:'Sign in', signup:'Sign up', name:'Name', go:'Continue', exists: "This email is already registered. Please sign in or reset your password.", reset: "Forgot password?", reset_sent: "If registered, a reset email has been sent.", enter_email: "Please enter your email address." },
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
  categoryLabels: {
    appreciation: '@:categories.appreciation',
    equality: '@:categories.equality',
    workload: '@:categories.workload',
    collegiality: '@:categories.collegiality',
    transparency: '@:categories.transparency'
  },
  table: { actions:'Actions', edit:'Edit', del:'Delete', empty:'No evaluations yet.', name: 'Name', password: 'Password', email: 'E-Mail' },
  analysis: { pick:'Select teams (max. 3)', details:'Details for 5 categories (1–5), then save.', compare:'Team comparison', avg:'Average', selected: 'selected', entries: 'entries', desc: 'Radar chart with average values for 5 categories.', tip: 'Tip: Click on a team badge to view details.' },
  toast: { saved:'Saved', deleted:'Deleted', updated:'Updated' },
  footer: {
    info: 'Info & Legal',
    imprint: 'Imprint',
    privacy: 'Privacy',
    help: 'Help',
    shortcuts: 'Shortcuts',
    about: 'About Team Radar'
  },
  user: {
    account: 'Account',
    logout: 'Logout',
    email: 'E-Mail',
  },
  tutorial: {
    quickstart: "Quickstart",
    step1: "Enter a person, a team, and ratings for 5 categories (1–5), then save.",
    step2: "Select up to 3 teams, compare them in the radar chart, and click a badge for details.",
    tip: "Tip",
    step3: "Use Ctrl/Cmd or Shift to select multiple teams.",
  },
  misc: {
    maxTeams: 'Max 3 Teams.',
    ctrl: 'Ctrl/Cmd',
    shift: 'Shift',
    noData: 'No data/teams selected.',
  },
}
export const i18n = createI18n({ legacy:false, locale: 'de', fallbackLocale:'en', messages: { de, en } })
