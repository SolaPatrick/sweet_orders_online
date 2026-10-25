<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Email and SMS notifications (FR6).
 *
 * Email goes out over SMTP (Brevo, Mailtrap, ...) and SMS through textbee
 * (free, sends from an Android phone), Semaphore or Twilio. When a channel
 * has no credentials in .env the message is still written to notifications_log with status "logged"
 * (test mode), so the flow can be demonstrated without real accounts.
 */
class Notifier
{
    private $_lava;

    /** Event => [email subject, message]. {placeholders} come from the order. */
    private const TEMPLATES = [
        'order_placed'      => ['Order {number} received', "Hi {name}, we received your order {number} for {schedule}. Total: {total}. Please complete payment to confirm it."],
        'payment_confirmed' => ['Payment received for {number}', "Hi {name}, we received your payment of {total} for order {number}. We will start preparing it for {schedule}."],
        'preparing'         => ['Order {number} is being prepared', "Hi {name}, your order {number} is now being prepared."],
        'ready'             => ['Order {number} is ready for pickup', "Hi {name}, your order {number} is ready for pickup at Clayanna's Café ({schedule})."],
        'out_for_delivery'  => ['Order {number} is on the way', "Hi {name}, your order {number} is out for delivery and will arrive {schedule}."],
        'completed'         => ['Order {number} completed', "Hi {name}, your order {number} is complete. Thank you for ordering from Clayanna's Café!"],
        'cancelled'         => ['Order {number} cancelled', "Hi {name}, your order {number} has been cancelled. Contact us if you have questions."],
    ];

    public function __construct()
    {
        $this->_lava = lava_instance();
    }

    /** Sends the email and SMS for an order event and logs both. */
    public function order_event(array $order, string $event): void
    {
        if (!isset(self::TEMPLATES[$event])) {
            return;
        }
        [$subject, $message] = self::TEMPLATES[$event];
        $vars = [
            '{name}'     => $order['customer_name'] ?? 'there',
            '{number}'   => $order['order_number'],
            '{total}'    => 'PHP ' . number_format((float) $order['total'], 2),
            '{schedule}' => ucfirst($order['fulfillment']) . ' on ' . date('D M j', strtotime($order['slot_date']))
                            . ', ' . date('g:i A', strtotime($order['start_time'])),
        ];
        $subject = strtr($subject, $vars);
        $message = strtr($message, $vars);

        if (!empty($order['customer_email'])) {
            $this->email($order['customer_email'], $subject, $message . "\n\nClayanna's Café · Sweet Orders Online", $event, (int) $order['id'], (int) $order['user_id']);
        }
        $phone = $order['contact_phone'] ?: ($order['customer_phone'] ?? null);
        if ($phone) {
            $this->sms($phone, $message, $event, (int) $order['id'], (int) $order['user_id']);
        }
    }

    public function email(string $to, string $subject, string $body, string $event, $order_id = null, $user_id = null): array
    {
        if (!getenv('SMTP_HOST')) {
            return $this->log('email', $event, $to, $subject, $body, 'logged', null, $order_id, $user_id);
        }
        try {
            $this->smtp_send($to, $subject, $body);
            return $this->log('email', $event, $to, $subject, $body, 'sent', null, $order_id, $user_id);
        } catch (Throwable $e) {
            return $this->log('email', $event, $to, $subject, $body, 'failed', $e->getMessage(), $order_id, $user_id);
        }
    }

    /** The SMS provider named in SMS_PROVIDER if its keys are filled in, else null (log only). */
    public static function sms_provider(): ?string
    {
        $provider = strtolower(getenv('SMS_PROVIDER') ?: 'textbee');
        $configured = [
            'textbee'   => getenv('TEXTBEE_API_KEY') && getenv('TEXTBEE_DEVICE_ID'),
            'twilio'    => getenv('TWILIO_SID') && getenv('TWILIO_TOKEN') && getenv('TWILIO_FROM'),
            'semaphore' => (bool) getenv('SEMAPHORE_API_KEY'),
        ];
        return !empty($configured[$provider]) ? $provider : null;
    }

    public function sms(string $to, string $message, string $event, $order_id = null, $user_id = null): array
    {
        $provider = self::sms_provider();
        if (!$provider) {
            return $this->log('sms', $event, $to, null, $message, 'logged', null, $order_id, $user_id);
        }
        try {
            if ($provider === 'textbee') {
                $this->textbee_send($to, $message);
            } elseif ($provider === 'twilio') {
                $this->twilio_send($to, $message);
            } else {
                $this->semaphore_send($to, $message);
            }
            return $this->log('sms', $event, $to, null, $message, 'sent', null, $order_id, $user_id);
        } catch (Throwable $e) {
            return $this->log('sms', $event, $to, null, $message, 'failed', $e->getMessage(), $order_id, $user_id);
        }
    }

    /** Sends a logged message again (A9 Resend). */
    public function resend(array $row): array
    {
        return $row['channel'] === 'email'
            ? $this->email($row['recipient'], (string) $row['subject'], $row['message'], $row['event'], $row['order_id'], $row['user_id'])
            : $this->sms($row['recipient'], $row['message'], $row['event'], $row['order_id'], $row['user_id']);
    }

    private function log($channel, $event, $recipient, $subject, $message, $status, $error, $order_id, $user_id): array
    {
        $row = [
            'order_id'  => $order_id ?: null,
            'user_id'   => $user_id ?: null,
            'channel'   => $channel,
            'event'     => $event,
            'recipient' => $recipient,
            'subject'   => $subject,
            'message'   => $message,
            'status'    => $status,
            'error'     => $error ? mb_substr($error, 0, 1000) : null,
        ];
        $this->_lava->db->table('notifications_log')->insert($row);
        $row['id'] = (int) $this->_lava->db->last_id();
        return $row;
    }

    // --------------------------------------------------------------
    // SMTP (no Composer needed)
    // --------------------------------------------------------------

    private function smtp_send(string $to, string $subject, string $body): void
    {
        $host   = getenv('SMTP_HOST');
        $port   = (int) (getenv('SMTP_PORT') ?: 587);
        $secure = strtolower(getenv('SMTP_SECURE') ?: ($port === 465 ? 'ssl' : 'tls'));
        $user   = getenv('SMTP_USER');
        $pass   = getenv('SMTP_PASSWORD');
        $from   = getenv('MAIL_FROM') ?: $user;
        $from_name = getenv('MAIL_FROM_NAME') ?: "Clayanna's Café";

        $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, stream_context_create());
        if (!$socket) {
            throw new RuntimeException("SMTP connect failed: {$errstr}");
        }
        stream_set_timeout($socket, 15);

        $this->smtp_expect($socket, 220);
        $this->smtp_cmd($socket, 'EHLO sweet-orders', 250);
        if ($secure === 'tls') {
            $this->smtp_cmd($socket, 'STARTTLS', 220);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('SMTP STARTTLS failed');
            }
            $this->smtp_cmd($socket, 'EHLO sweet-orders', 250);
        }
        if ($user) {
            $this->smtp_cmd($socket, 'AUTH LOGIN', 334);
            $this->smtp_cmd($socket, base64_encode($user), 334);
            $this->smtp_cmd($socket, base64_encode((string) $pass), 235);
        }
        $this->smtp_cmd($socket, "MAIL FROM:<{$from}>", 250);
        $this->smtp_cmd($socket, "RCPT TO:<{$to}>", [250, 251]);
        $this->smtp_cmd($socket, 'DATA', 354);

        $headers = [
            'Date: ' . date('r'),
            'From: =?UTF-8?B?' . base64_encode($from_name) . "?= <{$from}>",
            "To: <{$to}>",
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $data = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n.", "\n..", str_replace("\r\n", "\n", $body));
        $data = str_replace("\n", "\r\n", $data);
        $this->smtp_cmd($socket, $data . "\r\n.", 250);
        $this->smtp_cmd($socket, 'QUIT', 221);
        fclose($socket);
    }

    private function smtp_cmd($socket, string $command, $expect): string
    {
        fwrite($socket, $command . "\r\n");
        return $this->smtp_expect($socket, $expect);
    }

    private function smtp_expect($socket, $expect): string
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, (array) $expect, true)) {
            throw new RuntimeException('SMTP error: ' . trim($response));
        }
        return $response;
    }

    // --------------------------------------------------------------
    // SMS providers
    // --------------------------------------------------------------

    private function semaphore_send(string $to, string $message): void
    {
        $fields = [
            'apikey'  => getenv('SEMAPHORE_API_KEY'),
            'number'  => preg_replace('/\D/', '', $to),
            'message' => $message,
        ];
        if (getenv('SEMAPHORE_SENDER_NAME')) {
            $fields['sendername'] = getenv('SEMAPHORE_SENDER_NAME');
        }
        [$code, $body] = $this->http_post('https://api.semaphore.co/api/v4/messages', http_build_query($fields));
        $json = json_decode($body, true);
        if ($code >= 300 || !is_array($json) || isset($json['error']) || (isset($json[0]['status']) && strtolower($json[0]['status']) === 'failed')) {
            throw new RuntimeException("Semaphore error ({$code}): " . mb_substr($body, 0, 300));
        }
    }

    /**
     * textbee.dev (free plan): the SMS is sent by the textbee app on an Android
     * phone, from that phone's own SIM.
     */
    private function textbee_send(string $to, string $message): void
    {
        $digits = preg_replace('/\D/', '', $to);
        $e164 = strpos($digits, '0') === 0 ? '+63' . substr($digits, 1) : '+' . $digits;
        [$code, $body] = $this->http_post(
            'https://api.textbee.dev/api/v1/gateway/send-sms',
            json_encode(['recipients' => [$e164], 'message' => $message, 'deviceId' => getenv('TEXTBEE_DEVICE_ID')], JSON_UNESCAPED_UNICODE),
            null,
            ['Content-Type: application/json', 'x-api-key: ' . getenv('TEXTBEE_API_KEY')]
        );
        if ($code >= 300) {
            throw new RuntimeException("textbee error ({$code}): " . mb_substr($body, 0, 300));
        }
    }

    private function twilio_send(string $to, string $message): void
    {
        $digits = preg_replace('/\D/', '', $to);
        $e164 = strpos($digits, '0') === 0 ? '+63' . substr($digits, 1) : '+' . $digits;
        $sid = getenv('TWILIO_SID');
        [$code, $body] = $this->http_post(
            "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json",
            http_build_query(['To' => $e164, 'From' => getenv('TWILIO_FROM'), 'Body' => $message]),
            $sid . ':' . getenv('TWILIO_TOKEN')
        );
        if ($code >= 300) {
            throw new RuntimeException("Twilio error ({$code}): " . mb_substr($body, 0, 300));
        }
    }

    private function http_post(string $url, string $body, ?string $userpwd = null, ?array $headers = null): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => $headers ?: ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        if ($userpwd) {
            curl_setopt($ch, CURLOPT_USERPWD, $userpwd);
        }
        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            throw new RuntimeException('HTTP request failed: ' . $error);
        }
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return [$code, (string) $response];
    }
}
