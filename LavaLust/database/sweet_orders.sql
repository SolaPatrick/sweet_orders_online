SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications_log;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_item_options;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS delivery_slots;
DROP TABLE IF EXISTS product_options;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(20)  NULL,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    token       TEXT         NOT NULL,
    jti         TEXT         NOT NULL,
    expires_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_refresh_tokens_user (user_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(120) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    category_id      INT UNSIGNED  NOT NULL,
    name             VARCHAR(150)  NOT NULL,
    slug             VARCHAR(170)  NOT NULL,
    description      TEXT          NULL,
    base_price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    image            VARCHAR(255)  NULL,
    lead_time_hours  INT           NOT NULL DEFAULT 0,
    is_customizable  TINYINT(1)    NOT NULL DEFAULT 0,
    is_available     TINYINT(1)    NOT NULL DEFAULT 1,
    is_featured      TINYINT(1)    NOT NULL DEFAULT 0,
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_category (category_id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_options (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    product_id    INT UNSIGNED  NOT NULL,
    option_group  ENUM('size','flavor','frosting') NOT NULL,
    name          VARCHAR(100)  NOT NULL,
    price_add     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sort_order    INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_product_options_product (product_id),
    CONSTRAINT fk_product_options_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_slots (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slot_date     DATE         NOT NULL,
    start_time    TIME         NOT NULL,
    end_time      TIME         NOT NULL,
    fulfillment   ENUM('pickup','delivery') NOT NULL,
    capacity      INT          NOT NULL DEFAULT 0,
    booked_count  INT          NOT NULL DEFAULT 0,
    is_blocked    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_slots (slot_date, start_time, fulfillment),
    KEY idx_delivery_slots_date (slot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
    id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_number      VARCHAR(20)   NOT NULL,
    user_id           INT UNSIGNED  NOT NULL,
    slot_id           INT UNSIGNED  NOT NULL,
    fulfillment       ENUM('pickup','delivery') NOT NULL,
    delivery_address  TEXT          NULL,
    contact_phone     VARCHAR(20)   NULL,
    subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    delivery_fee      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status            ENUM('pending_payment','paid','preparing','ready',
                           'out_for_delivery','completed','cancelled')
                      NOT NULL DEFAULT 'pending_payment',
    payment_status    ENUM('unpaid','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
    notes             TEXT          NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_number (order_number),
    KEY idx_orders_user (user_id),
    KEY idx_orders_slot (slot_id),
    KEY idx_orders_status (status),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_slot FOREIGN KEY (slot_id)
        REFERENCES delivery_slots (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_id      INT UNSIGNED  NOT NULL,
    product_id    INT UNSIGNED  NULL,
    product_name  VARCHAR(150)  NOT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    quantity      INT           NOT NULL DEFAULT 1,
    line_total    DECIMAL(10,2) NOT NULL,
    cake_message  VARCHAR(100)  NULL,
    notes         VARCHAR(255)  NULL,
    PRIMARY KEY (id),
    KEY idx_order_items_order (order_id),
    KEY idx_order_items_product (product_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_item_options (
    id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_item_id      INT UNSIGNED  NOT NULL,
    product_option_id  INT UNSIGNED  NULL,
    option_group       VARCHAR(20)   NOT NULL,
    option_name        VARCHAR(100)  NOT NULL,
    price_add          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    KEY idx_order_item_options_item (order_item_id),
    KEY idx_order_item_options_option (product_option_id),
    CONSTRAINT fk_order_item_options_item FOREIGN KEY (order_item_id)
        REFERENCES order_items (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_item_options_option FOREIGN KEY (product_option_id)
        REFERENCES product_options (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    order_id             INT UNSIGNED  NOT NULL,
    provider             VARCHAR(20)   NOT NULL DEFAULT 'paymongo',
    checkout_session_id  VARCHAR(100)  NULL,
    reference            VARCHAR(100)  NULL,
    method               VARCHAR(20)   NULL,
    amount               DECIMAL(10,2) NOT NULL,
    status               ENUM('pending','paid','failed','expired') NOT NULL DEFAULT 'pending',
    paid_at              DATETIME      NULL,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payments_order (order_id),
    KEY idx_payments_checkout_session (checkout_session_id),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications_log (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id    INT UNSIGNED NULL,
    user_id     INT UNSIGNED NULL,
    channel     ENUM('email','sms') NOT NULL,
    event       VARCHAR(40)  NOT NULL,
    recipient   VARCHAR(255) NOT NULL,
    subject     VARCHAR(255) NULL,
    message     TEXT         NOT NULL,
    status      ENUM('sent','failed','logged') NOT NULL DEFAULT 'logged',
    error       TEXT         NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_log_order (order_id),
    KEY idx_notifications_log_user (user_id),
    CONSTRAINT fk_notifications_log_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_notifications_log_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (id, name, slug, sort_order) VALUES
(1, 'Custom cakes', 'custom-cakes', 1),
(2, 'Cupcakes',     'cupcakes',     2),
(3, 'Pastries',     'pastries',     3),
(4, 'Breads',       'breads',       4),
(5, 'Cookies',      'cookies',      5);

INSERT INTO products (id, category_id, name, slug, description, base_price, lead_time_hours, is_customizable, is_available, is_featured) VALUES
(1, 1, 'Chocolate Dream Cake', 'chocolate-dream-cake', 'Moist chocolate layers with ganache. Needs 48 hours of preparation.', 1450.00, 48, 1, 1, 1),
(2, 1, 'Ube Cheesecake',       'ube-cheesecake',       'Creamy cheesecake swirled with ube halaya on a graham crust.',        950.00, 48, 1, 1, 1),
(3, 1, 'Mango Chiffon',        'mango-chiffon',        'Light chiffon layers with fresh Guimaras mango and cream.',           880.00, 48, 1, 1, 0),
(4, 1, 'Carrot Cake',          'carrot-cake',          'Spiced carrot cake with walnuts and cream cheese frosting.',          1050.00, 48, 1, 1, 0),
(5, 2, 'Red Velvet Cupcakes (6)', 'red-velvet-cupcakes-6', 'Box of 6 red velvet cupcakes with cream cheese frosting.',         420.00, 24, 0, 1, 1),
(6, 3, 'Ensaymada Box',        'ensaymada-box',        'Box of 6 soft ensaymada topped with butter, sugar and cheese.',       360.00,  4, 0, 1, 1),
(7, 3, 'Butter Croissant',     'butter-croissant',     'Flaky, all-butter croissant baked every morning.',                     85.00,  2, 0, 1, 0),
(8, 4, 'Pandesal (20)',        'pandesal-20',          'Twenty classic pandesal, best eaten warm.',                           120.00,  2, 0, 0, 0),
(9, 5, 'Choco Chip Cookies (12)', 'choco-chip-cookies-12', 'A dozen chewy chocolate chip cookies.',                           300.00,  4, 0, 1, 0);

INSERT INTO product_options (product_id, option_group, name, price_add, sort_order)
SELECT p.id, o.option_group, o.name, o.price_add, o.sort_order
FROM products p
JOIN (
    SELECT 'size' AS option_group, '6 inch' AS name, 0.00 AS price_add, 1 AS sort_order
    UNION ALL SELECT 'size',     '8 inch',       400.00, 2
    UNION ALL SELECT 'size',     '10 inch',      800.00, 3
    UNION ALL SELECT 'flavor',   'Chocolate',      0.00, 1
    UNION ALL SELECT 'flavor',   'Mocha',         50.00, 2
    UNION ALL SELECT 'flavor',   'Ube',           80.00, 3
    UNION ALL SELECT 'frosting', 'Ganache',        0.00, 1
    UNION ALL SELECT 'frosting', 'Buttercream',    0.00, 2
    UNION ALL SELECT 'frosting', 'Cream cheese', 100.00, 3
) o
WHERE p.is_customizable = 1;

INSERT INTO delivery_slots (slot_date, start_time, end_time, fulfillment, capacity)
SELECT d.slot_date, t.start_time, t.end_time, t.fulfillment, t.capacity
FROM (
    SELECT DATE_ADD(CURDATE(), INTERVAL n.n DAY) AS slot_date
    FROM (
        SELECT a.d + b.d * 10 AS n
        FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
              UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
        CROSS JOIN (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2) b
    ) n
    WHERE n.n < 21
) d
CROSS JOIN (
    SELECT '09:00:00' AS start_time, '10:00:00' AS end_time, 'pickup' AS fulfillment, 5 AS capacity
    UNION ALL SELECT '10:00:00', '11:00:00', 'pickup',   5
    UNION ALL SELECT '11:00:00', '12:00:00', 'pickup',   5
    UNION ALL SELECT '13:00:00', '14:00:00', 'pickup',   5
    UNION ALL SELECT '14:00:00', '15:00:00', 'pickup',   5
    UNION ALL SELECT '15:00:00', '16:00:00', 'pickup',   5
    UNION ALL SELECT '16:00:00', '17:00:00', 'pickup',   5
    UNION ALL SELECT '10:00:00', '12:00:00', 'delivery', 3
    UNION ALL SELECT '13:00:00', '15:00:00', 'delivery', 3
    UNION ALL SELECT '15:00:00', '17:00:00', 'delivery', 3
    UNION ALL SELECT '17:00:00', '19:00:00', 'delivery', 3
) t
WHERE DAYOFWEEK(d.slot_date) <> 2;
