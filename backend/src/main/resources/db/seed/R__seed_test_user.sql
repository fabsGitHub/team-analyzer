/* =========================
SEEDED USERS & ROLES
========================= */
-- Admin  (fabianhensel@live.de / bcrypt hash)
INSERT INTO
  users (
    id,
    email,
    password_hash,
    enabled,
    email_verified_at
  )
SELECT
  UNHEX (
    REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
  ),
  'fabianhensel@live.de',
  '$2b$12$YBow9jBR9Nin24AitwBAXOfj4yJvFnJTaWY4cKJLgzEaJjRoN5BRC',
  TRUE,
  NOW()
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      users
    WHERE
      id = UNHEX (
        REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
      )
  );

-- test@gmail.de / 1234567890 (bcrypt)
INSERT INTO
  users (
    id,
    email,
    password_hash,
    enabled,
    email_verified_at
  )
SELECT
  UNHEX (
    REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
  ),
  'test@gmail.de',
  '$2b$12$YBow9jBR9Nin24AitwBAXOcDnqydqjmDlAF3oKMlM3EBLf3S45/i2',
  TRUE,
  NOW()
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      users
    WHERE
      id = UNHEX (
        REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
      )
  );

-- test1@gmail.de / 1234567890
INSERT INTO
  users (
    id,
    email,
    password_hash,
    enabled,
    email_verified_at
  )
SELECT
  UNHEX (
    REPLACE ('49423aa7-cd16-4610-9951-c079cf4c5a0c', '-', '')
  ),
  'test1@gmail.de',
  '$2b$12$YBow9jBR9Nin24AitwBAXOcDnqydqjmDlAF3oKMlM3EBLf3S45/i2',
  TRUE,
  NOW()
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      users
    WHERE
      id = UNHEX (
        REPLACE ('49423aa7-cd16-4610-9951-c079cf4c5a0c', '-', '')
      )
  );

-- test2@gmail.de / 1234567890
INSERT INTO
  users (
    id,
    email,
    password_hash,
    enabled,
    email_verified_at
  )
SELECT
  UNHEX (
    REPLACE ('6db27fbf-33a5-40e5-a659-5248d4ded270', '-', '')
  ),
  'test2@gmail.de',
  '$2b$12$YBow9jBR9Nin24AitwBAXOcDnqydqjmDlAF3oKMlM3EBLf3S45/i2',
  TRUE,
  NOW()
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      users
    WHERE
      id = UNHEX (
        REPLACE ('6db27fbf-33a5-40e5-a659-5248d4ded270', '-', '')
      )
  );

-- Rollen
INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
  ),
  'ADMIN'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
      )
      AND role = 'ADMIN'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
  ),
  'LEADER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
      )
      AND role = 'LEADER'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
  ),
  'USER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('fced652a-b8d3-4274-9f32-d365c68f74d7', '-', '')
      )
      AND role = 'USER'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
  ),
  'LEADER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
      )
      AND role = 'LEADER'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
  ),
  'USER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('6af3e324-fd99-406d-96b3-4f8a2c8c947f', '-', '')
      )
      AND role = 'USER'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('49423aa7-cd16-4610-9951-c079cf4c5a0c', '-', '')
  ),
  'USER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('49423aa7-cd16-4610-9951-c079cf4c5a0c', '-', '')
      )
      AND role = 'USER'
  );

INSERT INTO
  user_roles (user_id, role)
SELECT
  UNHEX (
    REPLACE ('6db27fbf-33a5-40e5-a659-5248d4ded270', '-', '')
  ),
  'USER'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      user_roles
    WHERE
      user_id = UNHEX (
        REPLACE ('6db27fbf-33a5-40e5-a659-5248d4ded270', '-', '')
      )
      AND role = 'USER'
  );