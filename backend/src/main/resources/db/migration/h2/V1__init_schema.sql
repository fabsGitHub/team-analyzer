-- backend/src/main/resources/db/migration/h2/V1__init_schema.sql
CREATE TABLE IF NOT EXISTS evaluation (
  id            VARCHAR(36)  NOT NULL,
  name          VARCHAR(255),
  team          VARCHAR(255),
  appreciation  INT          NOT NULL,
  equality      INT          NOT NULL,
  workload      INT          NOT NULL,
  collegiality  INT          NOT NULL,
  transparency  INT          NOT NULL,
  created_at    TIMESTAMP(6),
  updated_at    TIMESTAMP(6),
  PRIMARY KEY (id)
);
