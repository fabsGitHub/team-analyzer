-- Beispiel: View für aktuelle (nicht widerrufene) Tokens
CREATE OR REPLACE VIEW v_active_refresh_tokens AS
SELECT * FROM refresh_tokens WHERE revoked = FALSE AND expires_at > NOW();
