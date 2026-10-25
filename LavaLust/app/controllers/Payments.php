<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Payment gateway (FR5). Pages: C6 Order confirmed, C7 Payment failed. */
class Payments extends MY_Api_Controller
{
    /**
     * POST /api/payments/webhook
     * Register this URL in PayMongo (Developers > Webhooks) for the event
     * checkout_session.payment.paid, and put its secret (whsk_...) in
     * PAYMONGO_WEBHOOK_SECRET.
     */
    public function webhook()
    {
        $raw = (string) file_get_contents('php://input');
        $event = json_decode($raw, true);
        if (!is_array($event)) {
            $this->error('Invalid JSON body', 400);
        }

        $attributes = $event['data']['attributes'] ?? [];
        $type = $attributes['type'] ?? ($event['data']['type'] ?? '');
        $livemode = (bool) ($attributes['livemode'] ?? false);
        $resource = $attributes['data'] ?? ($event['data']['data'] ?? []);

        $this->call->library('paymongo');
        $header = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';
        if (!$this->paymongo->verify_signature($raw, $header, $livemode)) {
            $this->error('Invalid signature', 401);
        }

        if ($type === 'checkout_session.payment.paid') {
            $this->call->model('Payment_model');
            $payment = $this->Payment_model->find_by_session((string) ($resource['id'] ?? ''));
            if (!$payment) {
                $order_id = (int) ($resource['attributes']['metadata']['order_id'] ?? 0);
                $payment = $order_id ? $this->Payment_model->latest_for_order($order_id) : null;
            }
            if ($payment) {
                $paid = $this->paymongo->find_paid_payment($resource) ?: [];
                $this->mark_order_paid((int) $payment['id'], $paid);
            }
        }

        // Always answer 200 so PayMongo does not retry an event we have seen.
        $this->json(['received' => true, 'type' => $type]);
    }
}
