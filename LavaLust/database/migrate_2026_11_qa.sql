SET NAMES utf8mb4;

CREATE TABLE delivery_zones (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100)  NOT NULL,
    city        VARCHAR(100)  NOT NULL,
    psgc_code   VARCHAR(20)   NULL,
    fee         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_zones_name_city (name, city),
    KEY idx_delivery_zones_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
    MODIFY COLUMN role ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer',
    ADD COLUMN last_zone_id          INT UNSIGNED NULL AFTER is_active,
    ADD COLUMN last_address_street   VARCHAR(255) NULL AFTER last_zone_id,
    ADD COLUMN last_address_landmark VARCHAR(255) NULL AFTER last_address_street,
    ADD KEY idx_users_last_zone (last_zone_id),
    ADD CONSTRAINT fk_users_last_zone FOREIGN KEY (last_zone_id)
        REFERENCES delivery_zones (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE products
    ADD COLUMN daily_limit   INT        NULL AFTER is_featured,
    ADD COLUMN sold_out_date DATE       NULL AFTER daily_limit,
    ADD COLUMN is_archived   TINYINT(1) NOT NULL DEFAULT 0 AFTER sold_out_date,
    ADD KEY idx_products_archived (is_archived);

ALTER TABLE orders
    ADD COLUMN address_street    VARCHAR(255)  NULL AFTER delivery_address,
    ADD COLUMN address_barangay  VARCHAR(100)  NULL AFTER address_street,
    ADD COLUMN address_city      VARCHAR(100)  NULL AFTER address_barangay,
    ADD COLUMN address_landmark  VARCHAR(255)  NULL AFTER address_city,
    ADD COLUMN zone_id           INT UNSIGNED  NULL AFTER address_landmark,
    ADD COLUMN recipient_name    VARCHAR(100)  NULL AFTER contact_phone,
    ADD COLUMN recipient_phone   VARCHAR(20)   NULL AFTER recipient_name,
    ADD COLUMN occasion          VARCHAR(40)   NULL AFTER recipient_phone,
    ADD COLUMN pickup_name       VARCHAR(100)  NULL AFTER occasion,
    ADD COLUMN pickup_phone      VARCHAR(20)   NULL AFTER pickup_name,
    ADD COLUMN claim_code        CHAR(4)       NULL AFTER pickup_phone,
    ADD COLUMN prepared_by       INT UNSIGNED  NULL AFTER notes,
    ADD COLUMN prepared_at       DATETIME      NULL AFTER prepared_by,
    ADD COLUMN cancel_reason     VARCHAR(255)  NULL AFTER prepared_at,
    ADD COLUMN refund_amount     DECIMAL(10,2) NULL AFTER cancel_reason,
    ADD COLUMN refund_reference  VARCHAR(100)  NULL AFTER refund_amount,
    ADD COLUMN refunded_at       DATETIME      NULL AFTER refund_reference,
    ADD KEY idx_orders_zone (zone_id),
    ADD KEY idx_orders_prepared_by (prepared_by),
    ADD CONSTRAINT fk_orders_zone FOREIGN KEY (zone_id)
        REFERENCES delivery_zones (id) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT fk_orders_prepared_by FOREIGN KEY (prepared_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE order_status_history (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id     INT UNSIGNED NOT NULL,
    from_status  ENUM('pending_payment','paid','preparing','ready',
                      'out_for_delivery','completed','cancelled') NULL,
    to_status    ENUM('pending_payment','paid','preparing','ready',
                      'out_for_delivery','completed','cancelled') NOT NULL,
    changed_by   INT UNSIGNED NULL,
    note         VARCHAR(255) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_status_history_order (order_id),
    KEY idx_order_status_history_changed_by (changed_by),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_status_history_changed_by FOREIGN KEY (changed_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    product_id  INT UNSIGNED     NOT NULL,
    order_id    INT UNSIGNED     NOT NULL,
    user_id     INT UNSIGNED     NOT NULL,
    rating      TINYINT UNSIGNED NOT NULL,
    comment     VARCHAR(1000)    NULL,
    is_visible  TINYINT(1)       NOT NULL DEFAULT 1,
    created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME         NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_order_product (order_id, product_id),
    KEY idx_reviews_product (product_id),
    KEY idx_reviews_user (user_id),
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reviews_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    token_hash  CHAR(64)     NOT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_resets_token (token_hash),
    KEY idx_password_resets_user (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
