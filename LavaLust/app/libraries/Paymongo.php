<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * PayMongo payment gateway (FR5): hosted checkout sessions and webhooks.
 *
 * With PAYMONGO_SECRET_KEY set (a sk_test_ key for sandbox), customers are
 * sent to PayMongo to pay with GCash or card. Without a key the API runs
 * in "simulate" mode: the order is marked paid right away so the whole
 * ordering flow can still be demonstrated.
 */
class Paymongo
{
    private const API = 'https://api.paymongo.com/v1';

    public function mode(): string
    {
        return getenv('PAYMONGO_SECRET_KEY') ? 'paymongo' : 'simulate';
    }

    /** Payment method types offered on the PayMongo page, e.g. "gcash,card". */
    public function methods(): array
    {
        $list = array_filter(array_map('trim', explode(',', getenv('PAYMONGO_METHODS') ?: 'gcash,card')));
        return array_values($list);
    }

    /**
     * Creates a checkout session for an order (amounts in centavos).
     * Returns ['id' => cs_..., 'checkout_url' => ...].
     */
    public function create_checkout(array $order, string $success_url, string $cancel_url, ?string $method = null): array
    {
        // The customer picked GCash or Card at checkout: offer only that one.
        $methods = $method && in_array($method, $this->methods(), true) ? [$method] : $this->methods();
        $line_items = [];
        foreach ($order['items'] as $item) {
            $line_items[] = [
                'name'     => mb_substr($item['product_name'], 0, 100),
                'amount'   => (int) round($item['unit_price'] * 100),
                'currency' => 'PHP',
                'quantity' => (int) $item['quantity'],
            ];
        }
        if ($order['delivery_fee'] > 0) {
            $line_items[] = [
                'name'     => 'Delivery fee',
                'amount'   => (int) round($order['delivery_fee'] * 100),
                'currency' => 'PHP',
                'quantity' => 1,
            ];
        }

        $billing = array_filter([
            'name'  => $order['customer_name'] ?? null,
            'email' => $order['customer_email'] ?? null,
            'phone' => $order['contact_phone'] ?: ($order['customer_phone'] ?? null),
        ]);

        $attributes = [
            'line_items'           => $line_items,
            'payment_method_types' => $methods,
            'success_url'          => $success_url,
            'cancel_url'           => $cancel_url,
            'reference_number'     => $order['order_number'],
            'description'          => "Clayanna's Café order " . $order['order_number'],
            'send_email_receipt'   => false,
            'show_description'     => true,
            'show_line_items'      => true,
            'metadata'             => ['order_id' => (string) $order['id'], 'order_number' => $order['order_number']],
        ];
        if (!empty($billing['name']) && !empty($billing['email'])) {
            $attributes['billing'] = $billing;
        }

        $res = $this->request('POST', '/checkout_sessions', ['data' => ['attributes' => $attributes]]);
        return [
            'id'           => $res['data']['id'],
            'checkout_url' => $res['data']['attributes']['checkout_url'],
        ];
    }

    /** Reads a checkout session back. Returns the paid payment or null. */
    public function paid_payment(string $session_id)
    {
        $res = $this->request('GET', '/checkout_sessions/' . rawurlencode($session_id));
        return $this->find_paid_payment($res['data'] ?? []);
    }

    /** From a checkout_session object, the first payment with status "paid". */
    public function find_paid_payment(array $session)
    {
        foreach ($session['attributes']['payments'] ?? [] as $payment) {
            if (($payment['attributes']['status'] ?? '') === 'paid') {
                return [
                    'reference' => $payment['id'] ?? null,
                    'method'    => $payment['attributes']['source']['type'] ?? null,
                    'amount'    => isset($payment['attributes']['amount']) ? $payment['attributes']['amount'] / 100 : null,
                    'paid_at'   => isset($payment['attributes']['paid_at']) ? date('Y-m-d H:i:s', (int) $payment['attributes']['paid_at']) : date('Y-m-d H:i:s'),
                ];
            }
        }
        return null;
    }

    /**
     * Checks the Paymongo-Signature header: "t=<time>,te=<test sig>,li=<live sig>".
     * The signature is HMAC-SHA256 of "<t>.<raw body>" with the webhook secret.
     */
    public function verify_signature(string $raw_body, string $header, bool $livemode): bool
    {
        $secret = getenv('PAYMONGO_WEBHOOK_SECRET');
        if (!$secret || $header === '') {
            return false;
        }
        $parts = [];
        foreach (explode(',', $header) as $piece) {
            [$k, $v] = array_pad(explode('=', trim($piece), 2), 2, '');
            $parts[$k] = $v;
        }
        if (empty($parts['t'])) {
            return false;
        }
        $expected = hash_hmac('sha256', $parts['t'] . '.' . $raw_body, $secret);
        $given = $livemode ? ($parts['li'] ?? '') : ($parts['te'] ?? '');
        return $given !== '' && hash_equals($expected, $given);
    }

    private function request(string $method, string $path, ?array $body = null): array
    {
        $ch = curl_init(self::API . $path);
        $opts = [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_USERPWD        => getenv('PAYMONGO_SECRET_KEY') . ':',
            CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Content-Type: application/json'],
        ];
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        curl_setopt_array($ch, $opts);
        $response = curl_exec($ch);
        if ($response === false) {
            throw new RuntimeException('PayMongo request failed: ' . curl_error($ch));
        }
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $json = json_decode((string) $response, true);
        if ($code >= 300 || !is_array($json)) {
            $detail = $json['errors'][0]['detail'] ?? mb_substr((string) $response, 0, 300);
            throw new RuntimeException("PayMongo error ({$code}): {$detail}");
        }
        return $json;
    }
}
