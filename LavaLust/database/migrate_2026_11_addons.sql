SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS addons (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name        VARCHAR(60)   NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    has_text    TINYINT(1)    NOT NULL DEFAULT 0,
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_addons_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS design_uploads (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    url         VARCHAR(500) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_design_uploads_user (user_id),
    CONSTRAINT fk_design_uploads_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item_addons (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_item_id  INT UNSIGNED  NOT NULL,
    addon_id       INT UNSIGNED  NULL,
    addon_name     VARCHAR(60)   NOT NULL,
    price          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    text           VARCHAR(150)  NULL,
    PRIMARY KEY (id),
    KEY idx_order_item_addons_item (order_item_id),
    KEY idx_order_item_addons_addon (addon_id),
    CONSTRAINT fk_order_item_addons_item FOREIGN KEY (order_item_id)
        REFERENCES order_items (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_item_addons_addon FOREIGN KEY (addon_id)
        REFERENCES addons (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO addons (name, price, has_text, is_active, sort_order) VALUES
('Candles',       50.00, 0, 1, 1),
('Cake topper',  150.00, 0, 1, 2),
('Greeting card', 40.00, 1, 1, 3);

ALTER TABLE order_items
    ADD COLUMN design_photo_url VARCHAR(500) NULL AFTER notes;
