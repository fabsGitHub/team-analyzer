# Team Analyzer — README

Ein kleines Full-Stack-Demo-Projekt zum Erstellen, Einladen und Auswerten von Team-Umfragen. Der Fokus liegt auf einer klaren Architektur (Spring Boot + Vue 3), reproduzierbaren Dev-Setups via Docker sowie nachvollziehbaren Auth-Flows (JWT + Refresh-Cookie, optionaler Auto-Login, öffentliche Teilnahme per Token-Link).

---

## Inhalt

- [Features](#features)
- [Technologie-Stack](#technologie-stack)
- [Schnellstart (Docker)](#schnellstart-docker)
- [Standard-URLs & Zugangsdaten](#standard-urls--zugangsdaten)
- [Environment Variables (.env)](#environment-variables-env)
- [E-Mail-Verifizierung (ohne Mailserver)](#e-mail-verifizierung-ohne-mailserver)
- [Beispiel-Accounts (Demo-Daten)](#beispiel-accounts-demo-daten)
- [Konfiguration (`applicationyml`)](#konfiguration-applicationyml)
- [Projektstruktur](#projektstruktur)
- [Typische Workflows](#typische-workflows)
- [Troubleshooting](#troubleshooting)
- [Sicherheitshinweise](#sicherheitshinweise)
- [Lizenz](#lizenz)

---

## Features

- **Umfragen** anlegen, verwalten und auswerten (Leader/Admin).
- **Teilnahme** per **Token-Link** – ohne Zwangslogin.
- **Automatischer Login (best effort)**, wenn ein gültiges Refresh-Cookie vorhanden ist. Ansonsten bleibt die Umfrage weiterhin öffentlich einsehbar/teilnehmbar.
- **Ergebnis-Export** (JSON, signierter Download-Link).
- **Rollen**: Admin, Leader, Member.
- **Dockerized**: DB, Backend, Frontend, phpMyAdmin in einem Rutsch startbar.

---

## Technologie-Stack

- **Backend**: Java 21, Spring Boot 3, Spring Security 6, Hibernate/JPA, Flyway  
- **Datenbank**: MySQL (Compose-Profil `mysql`) / H2 (Dev)  
- **Frontend**: Vue 3 + TypeScript, Vite  
- **Infra**: Docker Compose, Nginx (für Build/Prod), phpMyAdmin (Dev/Inspect)

---

## Schnellstart (Docker)

> Voraussetzungen: Docker & Docker Compose installiert. FILE IST NICHT FÜR WINDOWS AUSGELEGT

```bash
# aus dem Repository-Root:
docker compose -f docker/docker-compose.yml up --build
```

Was wird gestartet?

- **MySQL** Datenbank
- **Backend** (Spring Boot, Port 8080)
- **Frontend** (Vite Dev Server, Port 5173)
- **phpMyAdmin** (Port 8082)

Alle relevanten Settings stehen in `backend/src/main/resources/application.yml`.

**App Entry Point:**  
http://localhost:5173/

---

## Standard-URLs & Zugangsdaten

- **Frontend**: http://localhost:5173/  
- **Backend API**: http://localhost:8080/  
- **phpMyAdmin**: http://localhost:8082/index.php?route=/&db=teambase  
  **User:** `teambase` — **Passwort:** `teambase` *(temporär, nur Demo!)*

---

## Environment Variables (.env)

> ⚠️ **Nur für lokale Demo-Zwecke.** Diese Secrets niemals in produktiven Umgebungen verwenden. In Production eigene Werte setzen (Rotation + sichere Secret-Quelle).

### Backend (Spring Boot)

Das Backend liest die folgenden Variablen (siehe `application.yml` → `app.jwt.secret`, `app.auth.hmac-secret`, `app.download-token-secret`):

```bash
# .env (im Repo-Root) ODER in deiner Shell exportieren
APP_JWT_SECRET_BASE64=GUazaMGlX5kFeJPltshiEnyAMBZtqB19bmn4dnIvLG0
EMAIL_VERIFY_HMAC_SECRET=lMqhRJDE6qhZCJgKjzV6kdCLG7EHqLuGTxOWqIZgPYxEMhBNFpw2JrO2s75EP5+LIuRe1K2X/RKWriUFiIuyBw
DOWNLOAD_TOKEN_HMAC_SECRET=Z3VhcmQtc2VjcmV0LWRvd25sb2FkLXRva2Vu
```

Diese Werte werden u. a. verwendet für:
- **JWT-Signierung** (`APP_JWT_SECRET_BASE64`)
- **E-Mail-Verifizierungs-Token** (`EMAIL_VERIFY_HMAC_SECRET`)
- **Signierte Download-Links** für Ergebnisse (`DOWNLOAD_TOKEN_HMAC_SECRET`)

> Docker Compose lädt in der Regel eine `.env.production` im Projekt-Root automatisch und injiziert die Variablen in Container (siehe `docker/docker-compose.yml`).

### Frontend (Vite)

Das Frontend spricht standardmäßig die API relativ zur App an. Für lokale/dev Setups:

```bash
# frontend/.env.development (oder Repo-Root .env falls dein Build-Setup es übernimmt)
VITE_API_BASE=/api
```

Der Wert wird in `frontend/src/api/client.ts` als `baseURL` verwendet.

---

## E-Mail-Verifizierung (ohne Mailserver)

Beim Registrieren wird **theoretisch** eine Verifizierungs-Mail mit Link versendet. Da im Demo-Setup **kein SMTP** angebunden ist, passiert kein Versand – **der Verifizierungs-Link wird aber dennoch erzeugt** und im **Backend-Container-Log** ausgegeben.

Vorgehen:

1. **Registrieren** in der App (Frontend).  
2. Im **Docker-Log** des Backends den generierten **Verifizierungs-Link** kopieren.  
3. Link im Browser öffnen → es erscheint die Login-Seite.  
4. **Erneut einloggen** → der Account ist verifiziert.

> Alternativ kannst du die vorhandenen **Testaccounts** nutzen (siehe unten). **Admin-Rechte** werden derzeit ausschließlich **direkt in der Datenbank** vergeben.

---

## Beispiel-Accounts (Demo-Daten)

> ⚠️ Diese Zugangsdaten sind **nur für die lokale Demo** gedacht. Bitte nicht in produktiven Umgebungen verwenden.

**Admin**

- **E-Mail:** `fabianhensel@live.de`  
  **Passwort:** `&R26#dbda$@sG^eNDN*@kUrfL#%4PaZ%`  
  **UserId:** `fced652a-b8d3-4274-9f32-d365c68f74d7`

**Weitere Testnutzer**

- **E-Mail:** `test@gmail.de` — **Passwort:** `1234567890` — **UserId:** `6af3e324-fd99-406d-96b3-4f8a2c8c947f`
- **E-Mail:** `test1@gmail.de` — **Passwort:** `1234567890` — **UserId:** `49423aa7-cd16-4610-9951-c079cf4c5a0c`
- **E-Mail:** `test2@gmail.de` — **Passwort:** `1234567890` — **UserId:** `6db27fbf-33a5-40e5-a659-5248d4ded270`

---

## Konfiguration (`application.yml`)

Wichtige Auszüge (vereinfacht):

```yaml
spring:
  profiles:
    active: dev
  jpa:
    open-in-view: false
    hibernate.ddl-auto: validate
    show-sql: true
    properties:
      hibernate.format_sql: true
      hibernate.jdbc.time_zone: UTC
  flyway:
    enabled: true
    locations: classpath:db/migration
server:
  port: 8080

app:
  auth:
    issuer: "teamanalyzer"
    email-verify-exp-min: 60
    hmac-secret: "${EMAIL_VERIFY_HMAC_SECRET}"
  frontend-base-url: "http://localhost:5173"
  verify-endpoint-path: "/verify"
  download-token-secret: "${DOWNLOAD_TOKEN_HMAC_SECRET}"
  jwt:
    secret: ${APP_JWT_SECRET_BASE64}

---
# Profil: dev (H2 In-Memory + Seeds)
spring:
  datasource:
    url: jdbc:h2:mem:teambase;DB_CLOSE_DELAY=-1;MODE=MySQL
    driverClassName: org.h2.Driver
    username: sa
  flyway:
    locations: classpath:db/migration/h2,classpath:db/seed

---
# Profil: prod (MySQL)
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/teambase?useSSL=true&serverTimezone=UTC
    username: ${MYSQL_USER}
    password: ${MYSQL_PASSWORD}
  flyway:
    locations: classpath:db/migration/mysql

---
# Profil: mysql (Compose)
spring:
  datasource:
    url: jdbc:mysql://db:3306/teambase?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: ${MYSQL_USER:teambase}
    password: ${MYSQL_PASSWORD:teambase}
  flyway:
    locations: classpath:db/migration/mysql

app:
  mail:
    enabled: false
  cookies:
    enabled: false

server:
  forward-headers-strategy: framework

logging:
  level:
    org.springframework.security: DEBUG
    com.teamanalyzer: DEBUG
```

---

## Projektstruktur

Back- und Frontend sind getrennt; Docker-Artefakte liegen in `docker/`.

```
backend/
  src/main/java/com/teamanalyzer/teamanalyzer/
    config/        (CORS, Security)
    domain/        (JPA Entities: User, Team, Survey, Tokens, ...)
    filter/        (JwtAuthFilter)
    repo/          (Spring Data Repos)
    security/      (AuthUser)
    service/       (Mail/Verify/JWT/Survey/Team/Token Services)
    web/           (Controller + DTOs)
  src/main/resources/
    application.yml
    db/migration/(h2|mysql)  (Flyway)
    db/seed                  (Dev Seeds)

frontend/
  src/
    api/ (Axios Client)
    components/ (UI)
    views/ (Auth, Survey, Results, Admin, Leader, Tokens, Tutorial, Verify)
    router.ts  (Guards: öffentl. Survey per Token, Auto-Login best effort)
    store.ts   (State, Auto-Refresh, Cancel-Gruppen)
    i18n.ts
docker/
  docker-compose.yml
  Dockerfile.backend
  Dockerfile.frontend
  nginx.conf
```

---

## Typische Workflows

### 1) Umfrage als Teilnehmer öffnen

- Link-Format: `http://localhost:5173/surveys/<SURVEY_ID>?token=<TOKEN>`
- **Kein Login nötig.**
- Der Router versucht parallel einen **Auto-Login** (falls ein Refresh-Cookie vorhanden ist). Scheitert das, bleibt die Survey trotzdem voll nutzbar.

### 2) Leader: Token für Mitglieder verwalten

- Login (Demo-Account) → `My Tokens` / `Leader`-Bereiche.
- Token erzeugen/erneuern → Teilnehmer-Link öffnet direkt die Umfrage (siehe oben).

### 3) Ergebnisse exportieren

- Leader → „Meine Umfragen“ → Ergebnis-Ansicht.
- Download-Endpunkt: `/api/surveys/[id]/results` (JSON, über signierten Link).

---

## Troubleshooting

- **`MissingRequestCookieException: refresh_token`**  
  Bedeutet: Es ist **kein** Refresh-Cookie vorhanden.  
  - Für **öffentliche Surveys mit Token** ist das egal – die Seite muss **ohne Login** funktionieren (Router gibt sofort frei).  
  - Für **geschützte Routen** (Leader/Admin) ist ein Login notwendig. Entweder neu einloggen oder einen Demo-Account verwenden.

- **Flyway Warnung: „MySQL 8.4 … latest supported 8.1“**  
  Informativ im Demo-Betrieb. Für Produktion ggf. Flyway/DB-Version matchen.

- **phpMyAdmin Login**  
  Zugangsdaten siehe oben. DB-Host innerhalb Compose ist `db`.

---

## Sicherheitshinweise

- **Demo-Passwörter** und **Zugangsdaten** sind **nur für lokale Tests**. In produktiven Setups **unbedingt**:
  - Secrets über Umgebungsvariablen setzen (`APP_JWT_SECRET_BASE64`, `EMAIL_VERIFY_HMAC_SECRET`, `DOWNLOAD_TOKEN_HMAC_SECRET`, `MYSQL_*`).  
  - Demo-Accounts entfernen bzw. Passwörter rotieren.  
  - `logging.level` auf INFO/ERROR reduzieren.  
  - `app.cookies.enabled`, Mail-Versand und CORS gemäß Umgebung konfigurieren.  
  - Flyway/DB-Versionen pinnen.

---

## Lizenz

Dieses Projekt ist ein öffentlich einsehbares Demo-Projekt. Bitte ergänze hier die gewünschte Lizenz (z. B. MIT, Apache-2.0) in der Datei `LICENSE`.

---

### Hinweise für Maintainer

- **Router-Logik** (Frontend):
  - **Survey mit Token** ist **immer public**.
  - **Auto-Login (best effort)**: `Api.prewarmSession()` + optional `Api.me()` – **niemals blockierend** für die Survey.
  - **Rollenpflicht** (Leader/Admin) via `meta.requiresRole` und Guard in `router.ts`.

- **Backoffice**: Admin-Rechte aktuell nur per Datenbank (Flag/Role in Tabelle `user`/`role`) – siehe Flyway-Migrationen und Repos.

Viel Spaß beim Ausprobieren! 🚀
