ALTER TABLE users
  ADD COLUMN reset_token VARCHAR(100) NULL,
  ADD COLUMN reset_token_created DATETIME(3) NULL;

CREATE INDEX idx_users_reset_token ON users (reset_token);
