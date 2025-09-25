ALTER TABLE survey_tokens
  ADD COLUMN issued_to_user_id BINARY(16) NULL AFTER issued_to_email,
  ADD CONSTRAINT fk_st_user FOREIGN KEY (issued_to_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX ix_token_survey_user ON survey_tokens(survey_id, issued_to_user_id);
