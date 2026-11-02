SET NAMES utf8mb4;

ALTER TABLE orders
    ADD COLUMN contact_email      VARCHAR(255) NULL AFTER contact_phone,
    ADD COLUMN policy_version     VARCHAR(20)  NULL AFTER allergy_note,
    ADD COLUMN policy_accepted_at DATETIME     NULL AFTER policy_version;
