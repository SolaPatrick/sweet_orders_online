<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Health extends MY_Api_Controller
{
    protected $uses_database = false;

    const TABLES = ['users', 'refresh_tokens', 'categories', 'products', 'product_options', 'delivery_slots',
                    'orders', 'order_items', 'order_item_options', 'payments', 'notifications_log'];

    public function index()
    {
        $this->api->require_method('GET');
        $database = 'not configured';
        $tables = null;
        $db_name = database_config()['main']['database'] ?? '';
        if ($db_name) {
            try {
                $this->call->database();
                $tables = (int) $this->db->table('information_schema.tables')
                    ->select_count('*', 'n')
                    ->where('table_schema', $db_name)
                    ->in('table_name', self::TABLES)
                    ->get()['n'];
                $database = 'connected';
            } catch (Throwable $e) {
                $database = 'error';
            }
        }
        $this->call->library('notifier');
        $this->api->respond([
            'status'       => 'ok',
            'app'          => "Sweet Orders Online API",
            'database'     => $database,
            'tables_found' => $tables === null ? null : "{$tables} of 11",
            'integrations' => [
                'auth_secrets' => config_item('jwt_secret') && config_item('refresh_token_key') ? 'set' : 'missing',
                'payments'     => config_item('paymongo_secret_key') ? 'paymongo' : 'simulate (no PayMongo key)',
                'webhook'      => config_item('paymongo_webhook_secret') ? 'set' : 'missing',
                'email'        => config_item('smtp_host') ? 'smtp' : 'log only (no SMTP)',
                'sms'          => Notifier::sms_provider() ?: 'log only (no SMS key)',
            ],
            'time'         => date('c'),
        ]);
    }
}
