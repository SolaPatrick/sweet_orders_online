SET NAMES utf8mb4;

ALTER TABLE orders
    MODIFY COLUMN status ENUM('pending_payment','awaiting_cash','paid','preparing','ready',
                              'out_for_delivery','completed','cancelled')
                         NOT NULL DEFAULT 'pending_payment';

ALTER TABLE payments
    ADD COLUMN received_by INT UNSIGNED NULL AFTER paid_at;

ALTER TABLE users
    ADD COLUMN email_verified_at DATETIME NULL AFTER allergies;

CREATE TABLE IF NOT EXISTS email_verifications (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    token_hash  CHAR(64)     NOT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email_verifications_token (token_hash),
    KEY idx_email_verifications_user (user_id),
    CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
