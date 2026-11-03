SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email       VARCHAR(255) NOT NULL,
    user_id     INT UNSIGNED NULL,
    success     TINYINT(1)   NOT NULL DEFAULT 0,
    reason      VARCHAR(20)  NOT NULL DEFAULT 'wrong_password',
    ip          VARCHAR(45)  NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_login_attempts_email_time (email, created_at),
    KEY idx_login_attempts_success_time (success, created_at),
    KEY idx_login_attempts_user (user_id),
    CONSTRAINT fk_login_attempts_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
