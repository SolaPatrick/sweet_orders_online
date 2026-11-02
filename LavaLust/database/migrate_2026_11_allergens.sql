SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS allergens (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    slug        VARCHAR(50)  NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_allergens_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO allergens (id, name, slug, sort_order) VALUES
(1, 'Milk/dairy',   'dairy',     1),
(2, 'Egg',          'egg',       2),
(3, 'Wheat/gluten', 'wheat',     3),
(4, 'Peanuts',      'peanuts',   4),
(5, 'Tree nuts',    'tree-nuts', 5),
(6, 'Soy',          'soy',       6),
(7, 'Sesame',       'sesame',    7);

CREATE TABLE IF NOT EXISTS product_allergens (
    product_id   INT UNSIGNED NOT NULL,
    allergen_id  INT UNSIGNED NOT NULL,
    PRIMARY KEY (product_id, allergen_id),
    KEY idx_product_allergens_allergen (allergen_id),
    CONSTRAINT fk_product_allergens_product FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_allergens_allergen FOREIGN KEY (allergen_id)
        REFERENCES allergens (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS option_allergens (
    product_option_id  INT UNSIGNED NOT NULL,
    allergen_id        INT UNSIGNED NOT NULL,
    PRIMARY KEY (product_option_id, allergen_id),
    KEY idx_option_allergens_allergen (allergen_id),
    CONSTRAINT fk_option_allergens_option FOREIGN KEY (product_option_id)
        REFERENCES product_options (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_option_allergens_allergen FOREIGN KEY (allergen_id)
        REFERENCES allergens (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE products
    ADD COLUMN ingredients TEXT NULL AFTER description;

ALTER TABLE users
    ADD COLUMN allergies VARCHAR(100) NULL AFTER last_address_landmark;

ALTER TABLE orders
    ADD COLUMN allergy_note VARCHAR(500) NULL AFTER notes;
