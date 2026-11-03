SET NAMES utf8mb4;

ALTER TABLE orders
    ADD COLUMN reschedule_count TINYINT NOT NULL DEFAULT 0 AFTER stock_taken;
