-- USERS
CREATE TABLE users (
  id                BINARY(16)   NOT NULL,
  email             VARCHAR(254) NOT NULL,
  password_hash     VARCHAR(100) NOT NULL,
  enabled           BOOLEAN      NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP    NULL,
  reset_token       VARCHAR(100) NULL,
  reset_token_created DATETIME(3) NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version           BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE INDEX idx_users_reset_token ON users (reset_token);

-- USER ROLES
CREATE TABLE user_roles (
  user_id BINARY(16) NOT NULL,
  role    VARCHAR(64) NOT NULL,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_roles UNIQUE (user_id, role)
);
CREATE INDEX ix_user_roles_role ON user_roles(role);

-- REFRESH TOKENS
CREATE TABLE refresh_tokens (
  id           BINARY(16) NOT NULL,
  user_id      BINARY(16) NOT NULL,
  token_hash   VARCHAR(64)  NOT NULL,
  expires_at   TIMESTAMP   NOT NULL,
  user_agent   VARCHAR(512) NULL,
  ip           VARCHAR(45)  NULL,
  revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
  CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_rt_user_revoked ON refresh_tokens(user_id, revoked);
CREATE INDEX ix_rt_expires_at  ON refresh_tokens(expires_at);
CREATE INDEX ix_rt_revoked_exp ON refresh_tokens(revoked, expires_at);

-- TEAMS
CREATE TABLE teams (
  id           BINARY(16)   NOT NULL,
  name         VARCHAR(120) NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version      BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT pk_teams PRIMARY KEY (id),
  CONSTRAINT uq_team_name UNIQUE (name)
);

-- TEAM MEMBERS (Many-to-Many mit Leader-Flag)
CREATE TABLE team_members (
  user_id   BINARY(16) NOT NULL,
  team_id   BINARY(16) NOT NULL,
  leader    BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_team_members PRIMARY KEY (user_id, team_id),
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
CREATE INDEX ix_tm_team   ON team_members(team_id);
CREATE INDEX ix_tm_leader ON team_members(team_id, leader);

-- SURVEYS
CREATE TABLE surveys (
  id           BINARY(16)   NOT NULL,
  team_id      BINARY(16)   NOT NULL,
  title        VARCHAR(160) NOT NULL,
  created_by   BINARY(16)   NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version      BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT pk_surveys PRIMARY KEY (id),
  CONSTRAINT fk_survey_team    FOREIGN KEY (team_id)    REFERENCES teams(id)  ON DELETE CASCADE,
  CONSTRAINT fk_survey_creator FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE RESTRICT
);
CREATE INDEX ix_survey_team    ON surveys(team_id);
CREATE INDEX ix_survey_created ON surveys(created_at);

-- SURVEY QUESTIONS (fix 1..5; per Survey konfigurierbar)
CREATE TABLE survey_questions (
  id        BINARY(16) NOT NULL,
  survey_id BINARY(16) NOT NULL,
  idx       SMALLINT UNSIGNED NOT NULL,       -- 1..5
  text      VARCHAR(500) NOT NULL,
  CONSTRAINT pk_survey_questions PRIMARY KEY (id),
  CONSTRAINT uq_sq_idx UNIQUE (survey_id, idx),
  CONSTRAINT fk_sq_survey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- SURVEY TOKENS (anonymous, one-time)
CREATE TABLE survey_tokens (
  id          BINARY(16) NOT NULL,
  survey_id   BINARY(16) NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_to_email VARCHAR(254) NULL,
  token_hash  VARBINARY(64)   NOT NULL,           -- SHA-256 hex
  redeemed    BOOLEAN    NOT NULL DEFAULT FALSE,
  redeemed_at TIMESTAMP  NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMP  NULL,
  created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version     BIGINT     NOT NULL DEFAULT 0,
  CONSTRAINT pk_survey_tokens PRIMARY KEY (id),
  CONSTRAINT uq_survey_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_st_survey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX ix_token_survey_redeemed ON survey_tokens(survey_id, redeemed);

-- SURVEY RESPONSES (anonymous; schützt über Token-Referenz vor Doppelabgabe)
CREATE TABLE survey_responses (
  id         BINARY(16) NOT NULL,
  survey_id  BINARY(16) NOT NULL,
  token_id   BINARY(16) NOT NULL,
  q1 SMALLINT UNSIGNED NOT NULL,
  q2 SMALLINT UNSIGNED NOT NULL,
  q3 SMALLINT UNSIGNED NOT NULL,
  q4 SMALLINT UNSIGNED NOT NULL,
  q5 SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version    BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_survey_responses PRIMARY KEY (id),
  CONSTRAINT fk_sr_survey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
  CONSTRAINT fk_sr_token  FOREIGN KEY (token_id)  REFERENCES survey_tokens(id),
  CONSTRAINT uq_sr_token UNIQUE (token_id),
  CONSTRAINT ck_sr_scores CHECK (
    q1 BETWEEN 1 AND 5 AND q2 BETWEEN 1 AND 5 AND q3 BETWEEN 1 AND 5
    AND q4 BETWEEN 1 AND 5 AND q5 BETWEEN 1 AND 5
  )
);
CREATE INDEX ix_sr_survey ON survey_responses(survey_id, created_at);

-- VIEW (optional, bequemes Monitoring)
CREATE OR REPLACE VIEW v_active_refresh_tokens AS
SELECT * FROM refresh_tokens
WHERE revoked = FALSE AND expires_at > NOW();
