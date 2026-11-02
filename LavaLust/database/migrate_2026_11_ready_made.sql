SET NAMES utf8mb4;

ALTER TABLE products
    ADD COLUMN product_type ENUM('ready_made','made_to_order') NOT NULL DEFAULT 'made_to_order' AFTER image,
    ADD COLUMN stock_qty    INT NULL AFTER product_type;

ALTER TABLE orders
    ADD COLUMN stock_taken TINYINT(1) NOT NULL DEFAULT 0 AFTER payment_status;
