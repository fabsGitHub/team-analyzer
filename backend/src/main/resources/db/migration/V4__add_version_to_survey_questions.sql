ALTER TABLE `survey_questions`
  ADD COLUMN `version` BIGINT NOT NULL DEFAULT 0 AFTER `updated_at`;
