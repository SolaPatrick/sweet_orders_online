<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Online ordering and tracking (FR3, FR7). Pages: C4 Cart, C5 Checkout, C10 My Orders, C11 Order details. */
class Orders extends MY_Api_Controller
{
    /**
     * POST /api/orders
     * {fulfillment, slot_id, delivery_address, contact_phone, notes, payment_method: gcash|card,
     *  items: [{product_id, quantity, option_ids: [], cake_message, notes}]}
     * Prices, lead time and slot capacity are all checked here on the server.
     */
    public function create()
    {
        $user = $this->require_user();
        $in = $this->input();
        $this->validate($in, [
            'fulfillment'      => 'required|in:pickup,delivery',
            'slot_id'          => 'required|integer',
            'contact_phone'    => 'required|phone',
            'notes'            => 'max:1000',
            'items'            => 'required|array',
        ], ['slot_id' => 'Time slot', 'contact_phone' => 'Mobile number', 'items' => 'Cart']);
        if ($in['fulfillment'] === 'delivery') {
            $this->validate($in, ['delivery_address' => 'required|min:10|max:500'], ['delivery_address' => 'Delivery address']);
        }
        if (count($in['items']) > 30) {
            $this->error('Your cart has too many lines.', 422);
        }

        $this->call->model(['Product_model', 'Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();

        // Build each line from database prices, never from the browser.
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

            // One choice per option group the product offers.
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
            $this->error('Some items in your cart need attention.', 422, $errors);
        }

        // Slot checks: right type, not blocked, not full, outside the lead time.
        $slot = $this->Slot_model->find((int) $in['slot_id']);
        if (!$slot || $slot['fulfillment'] !== $in['fulfillment']) {
            $this->error('Please fix the highlighted fields.', 422, ['slot_id' => 'Please choose a time slot for ' . $in['fulfillment'] . '.']);
        }
        if (strtotime($slot['slot_date'] . ' ' . $slot['start_time']) < time() + $lead_hours * 3600) {
            $this->error('Please fix the highlighted fields.', 422, ['slot_id' => "This slot is too soon. Your cart needs {$lead_hours} hours of preparation."]);
        }

        $delivery_fee = $in['fulfillment'] === 'delivery' ? round((float) (getenv('DELIVERY_FEE') ?: 100), 2) : 0.0;
        $subtotal = round($subtotal, 2);

        $this->db->transaction();
        if (!$this->Slot_model->book_one((int) $slot['id'])) {
            $this->db->roll_back();
            $this->error('That time slot just filled up or was closed. Please pick another one.', 409, ['slot_id' => 'This slot is full or closed.']);
        }
        $order_id = $this->Order_model->create_with_items([
            'user_id'          => $user['id'],
            'slot_id'          => $slot['id'],
            'fulfillment'      => $in['fulfillment'],
            'delivery_address' => $in['fulfillment'] === 'delivery' ? $in['delivery_address'] : null,
            'contact_phone'    => $this->normalize_phone($in['contact_phone']),
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
        $this->json([
            'message' => 'Order placed.',
            'order'   => $this->Order_model->detail($order_id),
            'payment' => $payment,
        ], 201);
    }

    /** GET /api/orders?scope=all|active|past */
    public function index()
    {
        $user = $this->require_user();
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $scope = in_array($this->query('scope'), ['active', 'past'], true) ? $this->query('scope') : 'all';
        $all = $this->Order_model->for_user((int) $user['id']);
        $active = array_filter($all, function ($o) { return !in_array($o['status'], ['completed', 'cancelled'], true); });
        $rows = $scope === 'all' ? $all : ($scope === 'active' ? array_values($active) : array_values(array_diff_key($all, $active)));
        $this->json([
            'data'   => $rows,
            'counts' => ['all' => count($all), 'active' => count($active), 'past' => count($all) - count($active)],
        ]);
    }

    /** GET /api/orders/{id} */
    public function show($id)
    {
        $order = $this->own_order((int) $id);
        // Back from PayMongo before the webhook arrived (or on localhost, where
        // webhooks cannot reach): ask PayMongo directly.
        if ($order['payment_status'] !== 'paid') {
            $this->sync_payment($order);
            $order = $this->Order_model->detail((int) $id);
        }
        $this->json(['data' => $order]);
    }

    /** POST /api/orders/{id}/pay  Opens a new payment page for an unpaid order. */
    public function pay($id)
    {
        $order = $this->own_order((int) $id);
        if ($order['payment_status'] === 'paid') {
            $this->error('This order is already paid.', 409);
        }
        if ($order['status'] !== 'pending_payment') {
            $this->error('This order can no longer be paid. Its time slot hold has ended; please place a new order.', 409);
        }
        $this->json(['payment' => $this->start_payment((int) $id, $this->input()['payment_method'] ?? null)]);
    }

    /** POST /api/orders/{id}/cancel  Customers can cancel only unpaid orders. */
    public function cancel($id)
    {
        $order = $this->own_order((int) $id);
        if ($order['status'] !== 'pending_payment' || $order['payment_status'] === 'paid') {
            $this->error('Only unpaid orders can be cancelled here. Please contact the café.', 409);
        }
        $this->call->model('Slot_model');
        $this->db->transaction();
        $this->Order_model->set_status((int) $id, 'cancelled');
        $this->Slot_model->release_one((int) $order['slot_id']);
        $this->db->raw("UPDATE payments SET status = 'expired' WHERE order_id = ? AND status = 'pending'", [(int) $id]);
        $this->db->commit();
        $this->notify_order((int) $id, 'cancelled');
        $this->json(['message' => 'Order cancelled.', 'data' => $this->Order_model->detail((int) $id)]);
    }

    // --------------------------------------------------------------

    private function own_order(int $id): array
    {
        $user = $this->require_user();
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $order = $this->Order_model->detail($id);
        if (!$order || ($order['user_id'] !== (int) $user['id'] && $user['role'] !== 'admin')) {
            $this->error('Order not found.', 404);
        }
        return $order;
    }

    /**
     * Creates a payment row and, with PayMongo keys, a hosted checkout.
     * Simulate mode (no keys): marks the order paid straight away.
     */
    private function start_payment(int $order_id, $method = null): array
    {
        $this->call->library('paymongo');
        $order = $this->Order_model->detail($order_id);

        $this->db->raw("UPDATE payments SET status = 'expired' WHERE order_id = ? AND status = 'pending'", [$order_id]);
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
            $this->db->raw("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'unpaid'", [$order_id]);
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
