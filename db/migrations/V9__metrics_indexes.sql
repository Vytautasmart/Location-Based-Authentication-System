-- Indexes to keep admin metrics queries fast as auth_logs grows.

CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_timestamp ON auth_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_granted_timestamp ON auth_logs(access_granted, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts(username, attempt_time DESC);
