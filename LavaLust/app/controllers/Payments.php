<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Payments extends MY_Api_Controller
{
    public function webhook()
    {
        $this->api->require_method('POST');
        $raw = $this->request->raw_body();
        $event = $this->request->json();
        if ($raw === '' || !is_array($event)) {
            $this->api->respond_error('Invalid JSON body', 400);
        }

        $attributes = $event['data']['attributes'] ?? [];
        $type = $attributes['type'] ?? ($event['data']['type'] ?? '');
        $livemode = (bool) ($attributes['livemode'] ?? false);
        $resource = $attributes['data'] ?? ($event['data']['data'] ?? []);

        $this->call->library('paymongo');
        $header = (string) $this->request->header('Paymongo-Signature');
        if (!$this->paymongo->verify_signature($raw, $header, $livemode)) {
            $this->api->respond_error('Invalid signature', 401);
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

        $this->api->respond(['received' => true, 'type' => $type]);
    }
}
