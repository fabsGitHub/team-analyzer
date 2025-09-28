-- 1) Spalte anlegen (zunächst NULL erlauben)
ALTER TABLE `survey_answers`
  ADD COLUMN `answer_order` INT NULL;

-- 2) Bestehende Zeilen nach Frage-Index (q.idx) durchnummerieren (0-basiert)
UPDATE `survey_answers` sa
JOIN (
    SELECT sa2.id,
           ROW_NUMBER() OVER (PARTITION BY sa2.response_id ORDER BY q.idx, sa2.id) - 1 AS rn
    FROM `survey_answers` sa2
    JOIN `survey_questions` q ON q.id = sa2.question_id
) x ON x.id = sa.id
SET sa.`answer_order` = x.rn;

-- Fallback: falls einzelne Zeilen keine Frage-Referenz haben sollten
UPDATE `survey_answers` sa
JOIN (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY response_id ORDER BY id) - 1 AS rn
    FROM `survey_answers`
    WHERE `answer_order` IS NULL
) y ON y.id = sa.id
SET sa.`answer_order` = y.rn;

-- 3) Eindeutigkeit je Response sicherstellen (optional, aber sinnvoll)
ALTER TABLE `survey_answers`
  ADD CONSTRAINT `uq_response_answer_order`
  UNIQUE (`response_id`, `answer_order`);

-- 4) Nicht NULL erzwingen
ALTER TABLE `survey_answers`
  MODIFY `answer_order` INT NOT NULL;
