<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/**
 * Base controller for every /api route.
 *
 * Sends the API security and CORS headers so the React app (Vite on
 * http://localhost:5173) can call the API, connects to MySQL, and gives
 * every controller the same JSON, auth and validation helpers.
 */
class MY_Api_Controller extends Controller
{
    /** Set to false in a controller that must answer without MySQL. */
    protected $uses_database = true;

    /** Logged-in user row, filled by require_user() / current_user(). */
    protected $auth_user = null;

    public function before_action()
    {
        $this->security_headers->apply_api();
        if ($this->uses_database) {
            $this->call->database();
            // Keep MySQL NOW() on Philippine time, same as PHP (Aiven runs on UTC).
            $this->db->raw("SET time_zone = '+08:00'");
        }
    }

    protected function json($data, int $code = 200)
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    protected function error(string $message, int $code = 400, array $errors = [])
    {
        $body = ['error' => $message, 'status' => $code];
        if ($errors) {
            $body['errors'] = $errors;
        }
        $this->json($body, $code);
    }

    /** The LavaLust Api library (JWT, tokens, rate limit). Loaded only when needed. */
    protected function api()
    {
        return $this->call->library('api');
    }

    /** Request body as an array: JSON, form or multipart. */
    protected function input(): array
    {
        static $body = null;
        if ($body === null) {
            $body = $this->api()->body();
        }
        return is_array($body) ? $body : [];
    }

    protected function query(string $key, $default = null)
    {
        $value = $_GET[$key] ?? $default;
        return is_string($value) ? trim($value) : $value;
    }

    // --------------------------------------------------------------
    // Auth
    // --------------------------------------------------------------

    /** Returns the logged-in user or null, without failing. */
    protected function current_user()
    {
        if ($this->auth_user !== null) {
            return $this->auth_user;
        }
        $token = $this->api()->get_bearer_token();
        if (!$token) {
            return null;
        }
        $payload = $this->api()->validate_jwt($token);
        if (!$payload) {
            return null;
        }
        $this->call->model('User_model');
        $user = $this->User_model->find((int) $payload['sub']);
        if (!$user || !(int) $user['is_active']) {
            return null;
        }
        return $this->auth_user = $user;
    }

    protected function require_user()
    {
        $user = $this->current_user();
        if (!$user) {
            $this->error('Please log in to continue.', 401);
        }
        return $user;
    }

    protected function require_admin()
    {
        $user = $this->require_user();
        if ($user['role'] !== 'admin') {
            $this->error('This page is for café staff only.', 403);
        }
        return $user;
    }

    // --------------------------------------------------------------
    // Validation
    // --------------------------------------------------------------

    /**
     * Server-side validation. Rules per field, separated by "|":
     * required, email, phone, min:n, max:n, numeric, integer, gte:n,
     * in:a,b,c, date, time, bool, array.
     * Answers 422 with a message for each invalid field.
     */
    protected function validate(array $data, array $rules, array $labels = [])
    {
        $errors = [];
        foreach ($rules as $field => $rule_string) {
            $label = $labels[$field] ?? ucfirst(str_replace('_', ' ', $field));
            $value = $data[$field] ?? null;
            $is_empty = $value === null || $value === '' || (is_array($value) && !$value);

            foreach (explode('|', $rule_string) as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);

                if ($name === 'required') {
                    if ($is_empty) { $errors[$field] = "{$label} is required."; break; }
                    continue;
                }
                if ($is_empty) {
                    break;
                }
                $message = null;
                switch ($name) {
                    case 'email':
                        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) $message = "{$label} must be a valid email address.";
                        break;
                    case 'phone':
                        if (!preg_match('/^(\+639|09)\d{9}$/', preg_replace('/[\s-]/', '', (string) $value))) {
                            $message = "{$label} must be a mobile number like 0917 123 4567.";
                        }
                        break;
                    case 'min':
                        if (mb_strlen((string) $value) < (int) $arg) $message = "{$label} must be at least {$arg} characters.";
                        break;
                    case 'max':
                        if (mb_strlen((string) $value) > (int) $arg) $message = "{$label} must be {$arg} characters or fewer.";
                        break;
                    case 'numeric':
                        if (!is_numeric($value)) $message = "{$label} must be a number.";
                        break;
                    case 'integer':
                        if (filter_var($value, FILTER_VALIDATE_INT) === false) $message = "{$label} must be a whole number.";
                        break;
                    case 'gte':
                        if (!is_numeric($value) || $value < (float) $arg) $message = "{$label} must be {$arg} or more.";
                        break;
                    case 'in':
                        if (!in_array((string) $value, explode(',', $arg), true)) $message = "{$label} must be one of: " . str_replace(',', ', ', $arg) . '.';
                        break;
                    case 'date':
                        $d = DateTime::createFromFormat('Y-m-d', (string) $value);
                        if (!$d || $d->format('Y-m-d') !== $value) $message = "{$label} must be a date (YYYY-MM-DD).";
                        break;
                    case 'time':
                        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', (string) $value)) $message = "{$label} must be a time (HH:MM).";
                        break;
                    case 'bool':
                        if (!in_array($value, [true, false, 0, 1, '0', '1', 'true', 'false'], true)) $message = "{$label} must be true or false.";
                        break;
                    case 'array':
                        if (!is_array($value)) $message = "{$label} must be a list.";
                        break;
                }
                if ($message) {
                    $errors[$field] = $message;
                    break;
                }
            }
        }
        if ($errors) {
            $this->error('Please fix the highlighted fields.', 422, $errors);
        }
    }

    protected function to_bool($value): int
    {
        return in_array($value, [true, 1, '1', 'true', 'on'], true) ? 1 : 0;
    }

    protected function normalize_phone($phone)
    {
        $phone = preg_replace('/[\s-]/', '', (string) $phone);
        if ($phone === '') return null;
        return strpos($phone, '+63') === 0 ? '0' . substr($phone, 3) : $phone;
    }

    protected function slugify(string $text): string
    {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $text), '-'));
        return $slug !== '' ? $slug : 'item-' . time();
    }

    // --------------------------------------------------------------
    // Order helpers shared by Orders, Payments and Admin
    // --------------------------------------------------------------

    /** Sends the email + SMS for an order event (FR6). Never breaks the request. */
    protected function notify_order(int $order_id, string $event): void
    {
        try {
            $this->call->model('Order_model');
            $this->call->library('notifier');
            $order = $this->Order_model->detail($order_id);
            if ($order) {
                $this->notifier->order_event($order, $event);
            }
        } catch (Throwable $e) {
            error_log('Notification failed: ' . $e->getMessage());
        }
    }

    /**
     * Marks a payment and its order as paid (webhook, return check or
     * simulate mode). Safe to call twice.
     */
    protected function mark_order_paid(int $payment_id, array $info = []): bool
    {
        $payment = $this->db->raw('SELECT * FROM payments WHERE id = ? LIMIT 1', [$payment_id])->fetch();
        if (!$payment || $payment['status'] === 'paid') {
            return false;
        }
        $this->db->transaction();
        $this->db->table('payments')->where('id', $payment_id)->update([
            'status'    => 'paid',
            'reference' => $info['reference'] ?? $payment['reference'],
            'method'    => $info['method'] ?? $payment['method'],
            'paid_at'   => $info['paid_at'] ?? date('Y-m-d H:i:s'),
        ]);
        $order = $this->db->raw('SELECT id, status, slot_id FROM orders WHERE id = ? FOR UPDATE', [$payment['order_id']])->fetch();
        if ($order['status'] === 'cancelled') {
            // Paid after the hold ran out: take the slot back if it still has room.
            $this->call->model('Slot_model');
            $this->Slot_model->book_one((int) $order['slot_id']);
        }
        if (in_array($order['status'], ['pending_payment', 'cancelled'], true)) {
            $this->db->raw("UPDATE orders SET status = 'paid', payment_status = 'paid' WHERE id = ?", [$order['id']]);
        } else {
            $this->db->raw("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [$order['id']]);
        }
        $this->db->commit();
        $this->notify_order((int) $order['id'], 'payment_confirmed');
        return true;
    }

    protected function frontend_url(string $path = ''): string
    {
        return rtrim(getenv('FRONTEND_URL') ?: 'http://localhost:5173', '/') . $path;
    }

    protected function pagination_params(int $default_per_page = 20): array
    {
        $page = max(1, (int) ($this->query('page') ?: 1));
        $per_page = min(100, max(1, (int) ($this->query('per_page') ?: $default_per_page)));
        return [$page, $per_page, ($page - 1) * $per_page];
    }
}
