-- backend/src/main/resources/db/seed/R__dev_seed_data.sql
INSERT INTO evaluation (id, name, team, appreciation, equality, workload, collegiality, transparency, created_at, updated_at)
VALUES
 ('1','Alex','Team 1',4,5,3,4,4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('2','Bianca','Team 1',3,4,4,3,3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING; -- H2: ignoriert; MySQL: kein Effekt (safe, repeatable)
