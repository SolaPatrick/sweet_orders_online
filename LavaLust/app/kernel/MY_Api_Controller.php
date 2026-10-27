<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
class MY_Api_Controller extends Controller
{
    protected $uses_database = true;

    private $validation_data = [];

    const MOBILE_PATTERN = '(\+639|09)\d{9}';

    const TIME_PATTERN = '([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?';

    const DATE_PATTERN = '\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])';

    private const PATTERN_MESSAGES = [
        self::MOBILE_PATTERN => '%s must be a mobile number like 0917 123 4567.',
        self::TIME_PATTERN   => '%s must be a time (HH:MM).',
        self::DATE_PATTERN   => '%s must be a date (YYYY-MM-DD).',
    ];

    public function before_action()
    {
        $this->security_headers->apply_api();
        $this->call->library('api');
        if ($this->uses_database) {
            $this->call->database();
            $this->db->raw("SET time_zone = '+08:00'");
        }
    }

    protected function user(): array
    {
        return load_class('AuthMiddleware', 'middlewares')->user;
    }

    protected function optional_user_id()
    {
        $token = $this->api->get_bearer_token();
        $payload = $token ? $this->api->validate_jwt($token) : null;
        if (!$payload) {
            return null;
        }
        $this->call->model('User_model');
        $user = $this->User_model->find((int) $payload['sub']);
        return $user && (int) $user['is_active'] ? (int) $user['id'] : null;
    }

    protected function validate(array $data, array $rules, array $messages = []): void
    {
        $fv = $this->form_validation($data, $rules);
        $errors = [];
        foreach ($rules as $key => $spec) {
            [$field, $label] = array_pad(explode('|', $key, 2), 2, null);
            $label = $label ?? ucfirst(str_replace('_', ' ', $field));
            [$rule_string, $pattern] = array_pad((array) $spec, 2, null);

            $value = $this->validation_data[$field] ?? null;
            if ($value === null || $value === '' || $value === []) {
                if (!in_array('required', explode('|', $rule_string), true)) {
                    continue;
                }
                $rule_string = 'required';
                $pattern = null;
            }

            $custom = array_merge($this->rule_messages($rule_string, $label), $messages[$field] ?? []);
            $fv->validate([$field . '|' . $label => $rule_string], [$field => $custom]);
            if ($pattern !== null && $fv->run()) {
                $fv->name($field)->custom_pattern($pattern, sprintf(self::PATTERN_MESSAGES[$pattern], $label));
            }
            if (!$fv->run()) {
                $errors[$field] = $fv->get_errors()[0];
            }
        }
        if ($errors) {
            $this->fail_validation($errors);
        }
    }

    protected function fail_validation(array $errors, string $message = 'Please fix the highlighted fields.'): void
    {
        $this->response->send_json_validation($errors, $message);
        exit;
    }

    private function form_validation(array $data, array $rules)
    {
        if (!isset($this->properties['form_validation'])) {
            $mobile_fields = [];
            foreach ($rules as $key => $spec) {
                if ((((array) $spec)[1] ?? null) === self::MOBILE_PATTERN) {
                    $mobile_fields[] = explode('|', $key)[0];
                }
            }
            foreach ($data as $field => $value) {
                if (is_bool($value)) {
                    $value = $value ? '1' : '0';
                } elseif (is_int($value) || is_float($value)) {
                    $value = (string) $value;
                }
                if (in_array($field, $mobile_fields, true) && is_string($value)) {
                    $value = preg_replace('/[\s-]/', '', $value);
                }
                $data[$field] = $value;
            }
            $this->validation_data = $data;
            $_POST = $data;
        }
        return $this->call->library('form_validation');
    }

    private function rule_messages(string $rule_string, string $label): array
    {
        $out = [];
        foreach (explode('|', $rule_string) as $rule) {
            preg_match('/^(\w+)(?:\[(.*)\])?$/s', $rule, $m);
            $param = trim($m[2] ?? '', '"');
            switch ($m[1] ?? '') {
                case 'required':              $out['required'] = "{$label} is required."; break;
                case 'valid_email':           $out['valid_email'] = "{$label} must be a valid email address."; break;
                case 'min_length':            $out['min_length'] = "{$label} must be at least {$param} characters."; break;
                case 'max_length':            $out['max_length'] = "{$label} must be {$param} characters or fewer."; break;
                case 'numeric':               $out['numeric'] = "{$label} must be a number."; break;
                case 'greater_than_equal_to': $out['greater_than_equal_to'] = "{$label} must be {$param} or more."; break;
                case 'matches':               $out['matches'] = 'Passwords do not match.'; break;
                case 'in_list':
                    $out['in_list'] = $param === '0,1,true,false'
                        ? "{$label} must be true or false."
                        : "{$label} must be one of: " . str_replace(',', ', ', $param) . '.';
                    break;
                case 'pattern':
                    $out['pattern'] = [
                        'int'      => "{$label} must be a whole number.",
                        'date_ymd' => "{$label} must be a date (YYYY-MM-DD).",
                        'array'    => "{$label} must be a list.",
                    ][$param] ?? "{$label} does not match the required format.";
                    break;
            }
        }
        return $out;
    }

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
            $this->logger->log('error', 'Notification', 'Notification failed: ' . $e->getMessage(), $e->getFile(), $e->getLine());
        }
    }

    protected function mark_order_paid(int $payment_id, array $info = []): bool
    {
        $payment = $this->db->table('payments')->where('id', $payment_id)->get();
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
            $this->call->model('Slot_model');
            $this->Slot_model->book_one((int) $order['slot_id']);
        }
        $this->db->table('orders')->where('id', $order['id'])->update(
            in_array($order['status'], ['pending_payment', 'cancelled'], true)
                ? ['status' => 'paid', 'payment_status' => 'paid']
                : ['payment_status' => 'paid']
        );
        $this->db->commit();
        $this->notify_order((int) $order['id'], 'payment_confirmed');
        return true;
    }

    protected function frontend_url(string $path = ''): string
    {
        return config_item('frontend_url') . $path;
    }

    protected function paginate(int $total, int $default_per_page): array
    {
        $per_page = min(100, max(1, (int) ($this->request->query('per_page') ?: $default_per_page)));
        $this->call->library('pagination');
        $page = $this->pagination->initialize($total, $per_page, (int) $this->request->query('page', 1), $this->request->path());
        $page['per_page'] = $per_page;
        return $page;
    }

    protected function page_meta(array $page): array
    {
        return ['page' => $page['current'], 'per_page' => $page['per_page'], 'total' => $page['total_rows']];
    }
}
