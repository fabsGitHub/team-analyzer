-- USERS
CREATE TABLE users (
  id              BINARY(16)  NOT NULL,
  email           VARCHAR(254) NOT NULL,
  password_hash   VARCHAR(100) NOT NULL,
  enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version         BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email)
);

-- USER ROLES (ElementCollection)
CREATE TABLE user_roles (
  user_id BINARY(16) NOT NULL,
  role    VARCHAR(64) NOT NULL,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_roles UNIQUE (user_id, role)
);
CREATE INDEX ix_user_roles_role ON user_roles(role);

-- EVALUATIONS (aus deiner Entity)
CREATE TABLE evaluations (
  id BINARY(16) NOT NULL,
  name VARCHAR(120) NOT NULL,
  team VARCHAR(64)  NOT NULL,
  appreciation  TINYINT UNSIGNED NOT NULL,
  equality      TINYINT UNSIGNED NOT NULL,
  workload      TINYINT UNSIGNED NOT NULL,
  collegiality  TINYINT UNSIGNED NOT NULL,
  transparency  TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT pk_evaluations PRIMARY KEY (id),
  CONSTRAINT ck_eval_scores CHECK (
    appreciation BETWEEN 1 AND 5 AND equality BETWEEN 1 AND 5 AND
    workload BETWEEN 1 AND 5 AND collegiality BETWEEN 1 AND 5 AND transparency BETWEEN 1 AND 5
  )
);
CREATE INDEX ix_eval_team_created ON evaluations(team, created_at);
CREATE INDEX ix_eval_created ON evaluations(created_at);

CREATE TABLE refresh_tokens (
  id           BINARY(16) NOT NULL,
  user_id      BINARY(16) NOT NULL,
  token_hash   VARCHAR(64)  NOT NULL,        -- empfohlen: binär speichern
  expires_at   TIMESTAMP   NOT NULL,
  user_agent   VARCHAR(512) NULL,
  ip           VARCHAR(45) NULL,
  revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
  CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indizes für typische Queries / Housekeeping
CREATE INDEX ix_rt_user_revoked     ON refresh_tokens(user_id, revoked);
CREATE INDEX ix_rt_expires_at       ON refresh_tokens(expires_at);
CREATE INDEX ix_rt_revoked_expires  ON refresh_tokens(revoked, expires_at);
