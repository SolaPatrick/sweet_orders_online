<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

if (!function_exists('product_image_url')) {
    function product_image_url(string $file): string
    {
        if (preg_match('#^https?://#i', $file)) {
            return $file;
        }
        return base_url('uploads/products/' . $file);
    }
}

if (!function_exists('order_hold_minutes')) {
    function order_hold_minutes(): int
    {
        return (int) config_item('order_hold_minutes');
    }
}

if (!function_exists('normalize_phone')) {
    function normalize_phone($phone)
    {
        $phone = preg_replace('/[\s-]/', '', (string) $phone);
        if ($phone === '') return null;
        return strpos($phone, '+63') === 0 ? '0' . substr($phone, 3) : $phone;
    }
}

if (!function_exists('slugify')) {
    function slugify(string $text): string
    {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $text), '-'));
        return $slug !== '' ? $slug : 'item-' . time();
    }
}
