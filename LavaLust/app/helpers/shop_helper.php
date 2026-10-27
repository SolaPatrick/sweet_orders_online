<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/**
 * Small shop helpers shared by models and controllers.
 * Autoloaded in app/config/autoload.php.
 */

if (!function_exists('product_image_url')) {
    /** Public URL of an uploaded product photo. */
    function product_image_url(string $file): string
    {
        // Photos stored on Cloudinary are saved as their full URL
        if (preg_match('#^https?://#i', $file)) {
            return $file;
        }
        $base = rtrim(getenv('APP_URL') ?: '', '/');
        return $base . '/uploads/products/' . rawurlencode($file);
    }
}

if (!function_exists('order_hold_minutes')) {
    /** Minutes an unpaid order keeps its slot (ORDER_HOLD_MINUTES, at least 5). */
    function order_hold_minutes(): int
    {
        return max(5, (int) (getenv('ORDER_HOLD_MINUTES') ?: 60));
    }
}
