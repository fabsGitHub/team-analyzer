-- einmalige Migration
ALTER TABLE survey_responses
  MODIFY token_id BINARY(16) NULL;

-- vorhandenen FK droppen, Name ggf. anpassen
ALTER TABLE survey_responses DROP FOREIGN KEY fk_sr_token;

-- neu anlegen: ON DELETE SET NULL
ALTER TABLE survey_responses
  ADD CONSTRAINT fk_sr_token
  FOREIGN KEY (token_id) REFERENCES survey_tokens(id)
  ON DELETE SET NULL;
