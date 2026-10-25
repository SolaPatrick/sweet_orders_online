<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * GET /api/health: shows that the API runs, can reach MySQL, and which
 * integrations have credentials (without showing the credentials).
 */
class Health extends MY_Api_Controller
{
    protected $uses_database = false;

    public function index()
    {
        $database = 'not configured';
        $tables = null;
        if (getenv('DB_NAME')) {
            try {
                $this->call->database();
                $database = $this->db->raw('SELECT 1')->fetchColumn() ? 'connected' : 'error';
                $tables = (int) $this->db->raw(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
                     AND table_name IN ('users','refresh_tokens','categories','products','product_options','delivery_slots',
                                        'orders','order_items','order_item_options','payments','notifications_log')"
                )->fetchColumn();
            } catch (Throwable $e) {
                $database = 'error';
            }
        }
        $this->call->library('notifier');
        $sms_provider = Notifier::sms_provider();
        $this->json([
            'status'       => 'ok',
            'app'          => "Sweet Orders Online API",
            'database'     => $database,
            'tables_found' => $tables === null ? null : "{$tables} of 11",
            'integrations' => [
                'auth_secrets' => getenv('JWT_SECRET') && getenv('REFRESH_TOKEN_KEY') ? 'set' : 'missing',
                'payments'     => getenv('PAYMONGO_SECRET_KEY') ? 'paymongo' : 'simulate (no PayMongo key)',
                'webhook'      => getenv('PAYMONGO_WEBHOOK_SECRET') ? 'set' : 'missing',
                'email'        => getenv('SMTP_HOST') ? 'smtp' : 'log only (no SMTP)',
                'sms'          => $sms_provider ?: 'log only (no SMS key)',
            ],
            'time'         => date('c'),
        ]);
    }
}
