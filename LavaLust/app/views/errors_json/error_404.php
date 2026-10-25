<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
 * JSON error response. Sweet Orders is an API-only backend, so every
 * framework error (404, PHP error, exception, database error) is returned
 * as JSON instead of an HTML page. Details are shown only in development.
 */
while (ob_get_level() > 0) {
    ob_end_clean();
}
$__dev = strtolower((string) config_item('environment')) === 'development';
$__status = http_response_code();
if (!is_int($__status) || $__status < 400) {
    $__status = 500;
}
$__body = ['error' => $__status === 404 ? 'Not found' : 'Server error', 'status' => $__status];
if (isset($heading) && isset($message) && !isset($severity) && !isset($query) && !isset($exception)) {
    $__body['error'] = strip_tags((string) $message);
}
if ($__dev) {
    if (isset($exception) && $exception instanceof Throwable) {
        $__body['debug'] = ['message' => $exception->getMessage(), 'file' => $exception->getFile(), 'line' => $exception->getLine()];
    } elseif (isset($severity)) {
        $__body['debug'] = ['severity' => $severity, 'message' => $message ?? '', 'file' => $filepath ?? '', 'line' => $line ?? 0];
    }
    if (isset($query)) {
        $__body['debug']['message'] = $exception_message ?? '';
        $__body['debug']['query'] = $query;
    }
}
if (!headers_sent()) {
    http_response_code($__status);
    header('Content-Type: application/json; charset=utf-8');
}
echo json_encode($__body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
