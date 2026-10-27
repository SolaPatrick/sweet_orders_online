<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Orders extends MY_Api_Controller
{
    public function create()
    {
        $this->api->require_method('POST');
        $user = $this->user();
        $in = $this->api->body();
        $this->validate($in, [
            'fulfillment|Fulfillment'     => 'required|in_list["pickup,delivery"]',
            'slot_id|Time slot'           => 'required|pattern[int]',
            'contact_phone|Mobile number' => ['required', self::MOBILE_PATTERN],
            'notes|Notes'                 => 'max_length[1000]',
            'items|Cart'                  => 'required|pattern[array]',
        ]);
        if ($in['fulfillment'] === 'delivery') {
            $this->validate($in, ['delivery_address|Delivery address' => 'required|min_length[10]|max_length[500]']);
        }
        if (count($in['items']) > 30) {
            $this->api->respond_error('Your cart has too many lines.', 422);
        }

        $this->call->model(['Product_model', 'Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();

        $lines = [];
        $errors = [];
        $subtotal = 0.0;
        $lead_hours = 0;
        foreach (array_values($in['items']) as $i => $item) {
            $qty = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
            $product = isset($item['product_id']) ? $this->Product_model->detail((int) $item['product_id']) : null;
            if (!$product) {
                $errors["items.{$i}"] = 'This product no longer exists.';
                continue;
            }
            if (!$product['is_available']) {
                $errors["items.{$i}"] = "{$product['name']} is sold out.";
                continue;
            }
            if ($qty === false || $qty < 1 || $qty > 50) {
                $errors["items.{$i}"] = "Quantity for {$product['name']} must be 1 to 50.";
                continue;
            }
            $message = trim((string) ($item['cake_message'] ?? ''));
            $notes = trim((string) ($item['notes'] ?? ''));
            if (mb_strlen($message) > 100 || mb_strlen($notes) > 255) {
                $errors["items.{$i}"] = 'Cake message is limited to 100 characters and notes to 255.';
                continue;
            }

            $chosen = [];
            $by_id = array_column($product['options'], null, 'id');
            foreach ((array) ($item['option_ids'] ?? []) as $oid) {
                if (!isset($by_id[(int) $oid])) {
                    $errors["items.{$i}"] = "An option chosen for {$product['name']} is not available.";
                    continue 2;
                }
                $opt = $by_id[(int) $oid];
                $chosen[$opt['option_group']] = $opt;
            }
            foreach (array_unique(array_column($product['options'], 'option_group')) as $group) {
                if (!isset($chosen[$group])) {
                    $errors["items.{$i}"] = "Please choose a {$group} for {$product['name']}.";
                    continue 2;
                }
            }

            $unit = $product['base_price'] + array_sum(array_column($chosen, 'price_add'));
            $line_total = round($unit * $qty, 2);
            $subtotal += $line_total;
            $lead_hours = max($lead_hours, $product['lead_time_hours']);
            $lines[] = [
                'product_id'   => $product['id'],
                'product_name' => $product['name'],
                'unit_price'   => round($unit, 2),
                'quantity'     => $qty,
                'line_total'   => $line_total,
                'cake_message' => $product['is_customizable'] && $message !== '' ? $message : null,
                'notes'        => $notes !== '' ? $notes : null,
                'options'      => array_values($chosen),
            ];
        }
        if ($errors) {
            $this->fail_validation($errors, 'Some items in your cart need attention.');
        }

        $slot = $this->Slot_model->find((int) $in['slot_id']);
        if (!$slot || $slot['fulfillment'] !== $in['fulfillment']) {
            $this->fail_validation(['slot_id' => 'Please choose a time slot for ' . $in['fulfillment'] . '.']);
        }
        if (strtotime($slot['slot_date'] . ' ' . $slot['start_time']) < time() + $lead_hours * 3600) {
            $this->fail_validation(['slot_id' => "This slot is too soon. Your cart needs {$lead_hours} hours of preparation."]);
        }

        $delivery_fee = $in['fulfillment'] === 'delivery' ? config_item('delivery_fee') : 0.0;
        $subtotal = round($subtotal, 2);

        $this->db->transaction();
        if (!$this->Slot_model->book_one((int) $slot['id'])) {
            $this->db->roll_back();
            $this->response->send_json_error('That time slot just filled up or was closed. Please pick another one.', 409, ['errors' => ['slot_id' => 'This slot is full or closed.']]);
            exit;
        }
        $order_id = $this->Order_model->create_with_items([
            'user_id'          => $user['id'],
            'slot_id'          => $slot['id'],
            'fulfillment'      => $in['fulfillment'],
            'delivery_address' => $in['fulfillment'] === 'delivery' ? $in['delivery_address'] : null,
            'contact_phone'    => normalize_phone($in['contact_phone']),
            'subtotal'         => $subtotal,
            'delivery_fee'     => $delivery_fee,
            'total'            => round($subtotal + $delivery_fee, 2),
            'status'           => 'pending_payment',
            'payment_status'   => 'unpaid',
            'notes'            => !empty($in['notes']) ? $in['notes'] : null,
        ], $lines);
        $this->db->commit();

        $this->notify_order($order_id, 'order_placed');
        $payment = $this->start_payment($order_id, $in['payment_method'] ?? null);
        $this->api->respond([
            'message' => 'Order placed.',
            'order'   => $this->Order_model->detail($order_id),
            'payment' => $payment,
        ], 201);
    }

    public function index()
    {
        $this->api->require_method('GET');
        $user = $this->user();
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $scope = $this->api->get_query_params()['scope'] ?? 'all';
        $scope = in_array($scope, ['active', 'past'], true) ? $scope : 'all';
        $all = $this->Order_model->for_user((int) $user['id']);
        $active = array_filter($all, function ($o) { return !in_array($o['status'], ['completed', 'cancelled'], true); });
        $rows = $scope === 'all' ? $all : ($scope === 'active' ? array_values($active) : array_values(array_diff_key($all, $active)));
        $this->api->respond([
            'data'   => $rows,
            'counts' => ['all' => count($all), 'active' => count($active), 'past' => count($all) - count($active)],
        ]);
    }

    public function show($id)
    {
        $this->api->require_method('GET');
        $order = $this->own_order((int) $id);
        if ($order['payment_status'] !== 'paid') {
            $this->sync_payment($order);
            $order = $this->Order_model->detail((int) $id);
        }
        $this->api->respond(['data' => $order]);
    }

    public function pay($id)
    {
        $this->api->require_method('POST');
        $order = $this->own_order((int) $id);
        if ($order['payment_status'] === 'paid') {
            $this->api->respond_error('This order is already paid.', 409);
        }
        if ($order['status'] !== 'pending_payment') {
            $this->api->respond_error('This order can no longer be paid. Its time slot hold has ended; please place a new order.', 409);
        }
        $this->api->respond(['payment' => $this->start_payment((int) $id, $this->api->body()['payment_method'] ?? null)]);
    }

    public function cancel($id)
    {
        $this->api->require_method('POST');
        $order = $this->own_order((int) $id);
        if ($order['status'] !== 'pending_payment' || $order['payment_status'] === 'paid') {
            $this->api->respond_error('Only unpaid orders can be cancelled here. Please contact the café.', 409);
        }
        $this->call->model(['Slot_model', 'Payment_model']);
        $this->db->transaction();
        $this->Order_model->set_status((int) $id, 'cancelled');
        $this->Slot_model->release_one((int) $order['slot_id']);
        $this->Payment_model->expire_pending((int) $id);
        $this->db->commit();
        $this->notify_order((int) $id, 'cancelled');
        $this->api->respond(['message' => 'Order cancelled.', 'data' => $this->Order_model->detail((int) $id)]);
    }

    private function own_order(int $id): array
    {
        $user = $this->user();
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $order = $this->Order_model->detail($id);
        if (!$order || ($order['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin')) {
            $this->api->respond_error('Order not found.', 404);
        }
        return $order;
    }

    private function start_payment(int $order_id, $method = null): array
    {
        $this->call->library('paymongo');
        $this->call->model('Payment_model');
        $order = $this->Order_model->detail($order_id);

        $this->Payment_model->expire_pending($order_id);
        $this->db->table('payments')->insert([
            'order_id' => $order_id,
            'provider' => $this->paymongo->mode() === 'paymongo' ? 'paymongo' : 'simulated',
            'amount'   => $order['total'],
            'status'   => 'pending',
        ]);
        $payment_id = (int) $this->db->last_id();

        $success = $this->frontend_url('/order-confirmed/' . $order_id);
        $failed = $this->frontend_url('/payment-failed/' . $order_id);

        if ($this->paymongo->mode() === 'simulate') {
            $this->mark_order_paid($payment_id, ['method' => 'simulated', 'reference' => 'SIM-' . $payment_id]);
            return ['mode' => 'simulate', 'checkout_url' => $success];
        }

        try {
            $session = $this->paymongo->create_checkout($order, $success, $failed, is_string($method) ? $method : null);
        } catch (Throwable $e) {
            $this->db->table('payments')->where('id', $payment_id)->update(['status' => 'failed']);
            $this->db->table('orders')->where('id', $order_id)->where('payment_status', 'unpaid')->update(['payment_status' => 'failed']);
            return ['mode' => 'paymongo', 'checkout_url' => $failed, 'error' => 'The payment page could not be opened. Please try again.'];
        }
        $this->db->table('payments')->where('id', $payment_id)->update(['checkout_session_id' => $session['id']]);
        return ['mode' => 'paymongo', 'checkout_url' => $session['checkout_url']];
    }

    private function sync_payment(array $order): void
    {
        $this->call->library('paymongo');
        if ($this->paymongo->mode() !== 'paymongo') {
            return;
        }
        foreach ($order['payments'] as $p) {
            if ($p['status'] === 'pending' && $p['checkout_session_id']) {
                try {
                    $paid = $this->paymongo->paid_payment($p['checkout_session_id']);
                } catch (Throwable $e) {
                    return;
                }
                if ($paid) {
                    $this->mark_order_paid($p['id'], $paid);
                }
                return;
            }
        }
    }
}
