<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Orders extends MY_Api_Controller
{
    public function create()
    {
        $this->api->require_method('POST');
        $user = $this->user();
        $this->api->rate_limit('order:' . $user['id'], config_item('order_rate_requests'), config_item('order_rate_seconds'));
        $in = $this->api->body();
        $this->validate($in, [
            'fulfillment|Fulfillment'         => 'required|in_list["pickup,delivery"]',
            'slot_id|Time slot'               => 'required|pattern[int]',
            'contact_phone|Mobile number'     => ['required', self::MOBILE_PATTERN],
            'notes|Notes'                     => 'max_length[1000]',
            'items|Cart'                      => 'required|pattern[array]',
            'recipient_name|Recipient name'   => 'max_length[100]',
            'recipient_phone|Recipient mobile' => ['', self::MOBILE_PATTERN],
            'occasion|Occasion'               => 'in_list["' . implode(',', config_item('occasions')) . '"]',
            'pickup_name|Pickup name'         => 'max_length[100]',
            'pickup_phone|Pickup mobile'      => ['', self::MOBILE_PATTERN],
            'allergy_note|Allergy note'       => 'max_length[500]',
            'contact_email|Email for updates' => 'valid_email|max_length[255]',
        ]);
        if (!in_array($in['accept_policies'] ?? null, [true, 1, '1', 'true'], true)) {
            $this->fail_validation(['accept_policies' => 'Please agree to the Terms, Cancellation policy and Privacy notice to place your order.'], 'Please agree to our policies to place your order.');
        }
        $cash = ($in['payment_method'] ?? '') === 'cash';
        if ($cash && $in['fulfillment'] !== 'pickup') {
            $this->fail_validation(['payment_method' => 'Cash at the counter is only for pickup orders.'], 'Cash at the counter is only for pickup orders.');
        }
        if ($cash && empty($user['email_verified_at'])) {
            $this->fail_validation(['payment_method' => 'Please verify your email first. Open the link we emailed you, or send a new one.'], 'Verify your email to pay at the counter.');
        }
        if (count($in['items']) > 30) {
            $this->api->respond_error('Your cart has too many lines.', 422);
        }

        $this->call->model(['Product_model', 'Slot_model', 'Order_model', 'Zone_model', 'Addon_model', 'Design_upload_model']);
        $addon_list = $this->Addon_model->active_by_id();
        $zone = null;
        $delivery_fee = 0.0;
        $address = [];
        if ($in['fulfillment'] === 'delivery') {
            if ($this->Zone_model->count_all() > 0) {
                $this->validate($in, [
                    'zone_id|Delivery area'       => 'required|pattern[int]',
                    'address_street|Street'       => 'required|min_length[5]|max_length[255]',
                    'address_landmark|Landmark'   => 'max_length[255]',
                ]);
                $zone = $this->Zone_model->find((int) $in['zone_id']);
                if (!$zone || !(int) $zone['is_active']) {
                    $this->fail_validation(['zone_id' => "We don't deliver to this area yet."], "We don't deliver to this area yet.");
                }
                $landmark = trim((string) ($in['address_landmark'] ?? ''));
                $address = [
                    'address_street'   => $in['address_street'],
                    'address_barangay' => $zone['name'],
                    'address_city'     => $zone['city'],
                    'address_landmark' => $landmark !== '' ? $landmark : null,
                    'zone_id'          => (int) $zone['id'],
                ];
                $address['delivery_address'] = implode(', ', [$in['address_street'], $zone['name'], $zone['city']])
                    . ($landmark !== '' ? " (Landmark: {$landmark})" : '');
                $delivery_fee = round((float) $zone['fee'], 2);
            } else {
                $this->validate($in, ['delivery_address|Delivery address' => 'required|min_length[10]|max_length[500]']);
                $address = ['delivery_address' => $in['delivery_address']];
                $delivery_fee = config_item('delivery_fee');
            }
        }

        $this->Slot_model->release_expired_holds();
        $limit = (int) config_item('max_unpaid_orders');
        if ($this->Order_model->count_unpaid_for_user((int) $user['id']) >= $limit) {
            $this->api->respond_error("You already have {$limit} unpaid orders. Please pay for or cancel one of them in My orders before placing a new order.", 409);
        }

        $lines = [];
        $errors = [];
        $subtotal = 0.0;
        $lead_hours = 0;
        $wanted = [];
        foreach (array_values($in['items']) as $i => $item) {
            $qty = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
            $product = isset($item['product_id']) ? $this->Product_model->detail((int) $item['product_id']) : null;
            if (!$product || $product['is_archived']) {
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
            $wanted_addons = (array) ($item['addons'] ?? []);
            $design_id = (int) ($item['design_upload_id'] ?? 0);
            if ($product['product_type'] === 'ready_made' && ((array) ($item['option_ids'] ?? []) || $message !== '' || $wanted_addons || $design_id)) {
                $errors["items.{$i}"] = "{$product['name']} is ready-made, so options, a cake message, add-ons or a design photo can't be added. Please remove it and add it again.";
                continue;
            }
            if (($wanted_addons || $design_id) && !$product['is_customizable']) {
                $errors["items.{$i}"] = "Add-ons and design photos are only for custom cakes, not {$product['name']}.";
                continue;
            }
            $addons = [];
            foreach ($wanted_addons as $a) {
                $aid = (int) (is_array($a) ? ($a['id'] ?? 0) : $a);
                if (!isset($addon_list[$aid])) {
                    $errors["items.{$i}"] = "An add-on chosen for {$product['name']} is not available any more.";
                    continue 2;
                }
                $text = $addon_list[$aid]['has_text'] && is_array($a) ? trim((string) ($a['text'] ?? '')) : '';
                if (mb_strlen($text) > 150) {
                    $errors["items.{$i}"] = "The {$addon_list[$aid]['name']} message is limited to 150 characters.";
                    continue 2;
                }
                $addons[$aid] = [
                    'addon_id'   => $aid,
                    'addon_name' => $addon_list[$aid]['name'],
                    'price'      => $addon_list[$aid]['price'],
                    'text'       => $text !== '' ? $text : null,
                ];
            }
            $design_url = null;
            if ($design_id) {
                $upload = $this->Design_upload_model->owned($design_id, (int) $user['id']);
                if (!$upload) {
                    $errors["items.{$i}"] = "The design photo for {$product['name']} could not be found. Please upload it again.";
                    continue;
                }
                $design_url = $upload['url'];
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

            $unit = $product['base_price'] + array_sum(array_column($chosen, 'price_add')) + array_sum(array_column($addons, 'price'));
            $line_total = round($unit * $qty, 2);
            $subtotal += $line_total;
            $lead_hours = max($lead_hours, $product['lead_time_hours']);
            $wanted[$product['id']] = [
                'product' => $product,
                'index'   => $wanted[$product['id']]['index'] ?? $i,
                'qty'     => ($wanted[$product['id']]['qty'] ?? 0) + $qty,
            ];
            $lines[] = [
                'product_id'   => $product['id'],
                'product_name' => $product['name'],
                'unit_price'   => round($unit, 2),
                'quantity'     => $qty,
                'line_total'   => $line_total,
                'cake_message' => $product['is_customizable'] && $message !== '' ? $message : null,
                'notes'        => $notes !== '' ? $notes : null,
                'design_photo_url' => $design_url,
                'options'      => array_values($chosen),
                'addons'       => array_values($addons),
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

        $day = date('D, M j', strtotime($slot['slot_date']));
        foreach ($wanted as $product_id => $w) {
            $p = $w['product'];
            if ($p['product_type'] === 'ready_made') {
                if ($w['qty'] > $p['stock_qty']) {
                    $errors["items.{$w['index']}"] = $p['stock_qty'] > 0
                        ? "Only {$p['stock_qty']} {$p['name']} left."
                        : "{$p['name']} is sold out today.";
                }
                continue;
            }
            if ($p['sold_out_date'] === $slot['slot_date']) {
                $errors["items.{$w['index']}"] = "{$p['name']} is sold out for {$day}.";
                continue;
            }
            if ($p['daily_limit'] !== null) {
                $left = max(0, $p['daily_limit'] - $this->Product_model->sold_on((int) $product_id, $slot['slot_date']));
                if ($w['qty'] > $left) {
                    $errors["items.{$w['index']}"] = $left > 0
                        ? "Only {$left} {$p['name']} left for {$day}."
                        : "{$p['name']} is sold out for {$day}.";
                }
            }
        }
        if ($errors) {
            $this->fail_validation($errors, 'Some items in your cart need attention.');
        }

        $subtotal = round($subtotal, 2);
        $is_pickup = $in['fulfillment'] === 'pickup';
        $contact_phone = normalize_phone($in['contact_phone']);
        $text = function ($key) use ($in) {
            $value = trim((string) ($in[$key] ?? ''));
            return $value !== '' ? $value : null;
        };

        $this->db->transaction();
        $this->db->raw('SELECT id FROM users WHERE id = ? FOR UPDATE', [(int) $user['id']]);
        if (!$this->Slot_model->book_one((int) $slot['id'])) {
            $this->db->roll_back();
            $this->response->send_json_error('That time slot just filled up or was closed. Please pick another one.', 409, ['errors' => ['slot_id' => 'This slot is full or closed.']]);
            exit;
        }
        $limited = [];
        foreach ($wanted as $product_id => $w) {
            if ($w['product']['product_type'] !== 'ready_made' && $w['product']['daily_limit'] !== null) {
                $limited[(int) $product_id] = $w;
            }
        }
        ksort($limited);
        foreach (array_keys($limited) as $product_id) {
            $this->db->raw('SELECT id FROM products WHERE id = ? FOR UPDATE', [$product_id]);
        }
        if ($this->Order_model->count_unpaid_for_user((int) $user['id']) >= $limit) {
            $this->db->roll_back();
            $this->api->respond_error("You already have {$limit} unpaid orders. Please pay for or cancel one of them in My orders before placing a new order.", 409);
        }
        foreach ($limited as $product_id => $w) {
            $left = max(0, $w['product']['daily_limit'] - $this->Product_model->sold_on($product_id, $slot['slot_date']));
            if ($w['qty'] > $left) {
                $errors["items.{$w['index']}"] = $left > 0
                    ? "Only {$left} {$w['product']['name']} left for {$day}."
                    : "{$w['product']['name']} is sold out for {$day}.";
            }
        }
        if ($errors) {
            $this->db->roll_back();
            $this->fail_validation($errors, 'Some items in your cart need attention.');
        }
        $order_id = $this->Order_model->create_with_items(array_merge([
            'user_id'          => $user['id'],
            'slot_id'          => $slot['id'],
            'fulfillment'      => $in['fulfillment'],
            'delivery_address' => null,
            'contact_phone'    => $contact_phone,
            'contact_email'    => strtolower($text('contact_email') ?? $user['email']),
            'recipient_name'   => $text('recipient_name'),
            'recipient_phone'  => $text('recipient_phone') ? normalize_phone($in['recipient_phone']) : null,
            'occasion'         => $text('occasion'),
            'pickup_name'      => $is_pickup ? ($text('pickup_name') ?? $user['name']) : null,
            'pickup_phone'     => $is_pickup ? ($text('pickup_phone') ? normalize_phone($in['pickup_phone']) : $contact_phone) : null,
            'claim_code'       => $is_pickup ? sprintf('%04d', random_int(0, 9999)) : null,
            'subtotal'         => $subtotal,
            'delivery_fee'     => $delivery_fee,
            'total'            => round($subtotal + $delivery_fee, 2),
            'status'           => $cash ? 'awaiting_cash' : 'pending_payment',
            'payment_status'   => 'unpaid',
            'notes'            => !empty($in['notes']) ? $in['notes'] : null,
            'allergy_note'     => $text('allergy_note'),
            'policy_version'   => config_item('policy_version'),
            'policy_accepted_at' => date('Y-m-d H:i:s'),
        ], $address), $lines);
        $this->Order_model->add_history($order_id, null, $cash ? 'awaiting_cash' : 'pending_payment', $user['id'], $cash ? 'Order placed, pay in cash at the counter' : 'Order placed');
        $short = $this->Product_model->take_stock($order_id);
        if ($short) {
            $this->db->roll_back();
            $this->fail_validation(['items' => implode(', ', $short) . ' just sold out. Please update your cart.'], 'Some items just sold out.');
        }
        if ($cash) {
            $this->db->table('payments')->insert([
                'order_id' => $order_id,
                'provider' => 'cash',
                'method'   => 'cash',
                'amount'   => round($subtotal + $delivery_fee, 2),
                'status'   => 'pending',
            ]);
        }
        $this->db->commit();

        if ($zone) {
            $this->call->model('User_model');
            $this->User_model->update($user['id'], [
                'last_zone_id'          => $address['zone_id'],
                'last_address_street'   => $address['address_street'],
                'last_address_landmark' => $address['address_landmark'],
            ]);
        }

        $this->notify_order($order_id, $cash ? 'order_placed_cash' : 'order_placed');
        $payment = $cash
            ? ['mode' => 'cash', 'checkout_url' => $this->frontend_url('/order-confirmed/' . $order_id)]
            : $this->start_payment($order_id, $in['payment_method'] ?? null);
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
        if ($order['status'] === 'awaiting_cash') {
            $this->api->respond_error('This order is paid in cash at the counter when you pick it up.', 409);
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
        $in = $this->api->body();
        $this->validate($in, ['reason|Reason' => 'max_length[200]']);
        $unpaid_online = $order['status'] === 'pending_payment' && $order['payment_status'] !== 'paid';
        if (!$unpaid_online && !$order['can_self_cancel']) {
            $this->api->respond_error($this->change_closed_message($order), 409);
        }
        $refund = $order['payment_status'] === 'paid';
        $reason = trim((string) ($in['reason'] ?? ''));
        $note = 'Cancelled by the customer' . ($reason !== '' ? ": {$reason}" : '') . ($refund ? ' (refund to send)' : '');

        $this->call->model(['Slot_model', 'Payment_model', 'Product_model']);
        $this->db->transaction();
        $locked = $this->db->raw('SELECT status, slot_id FROM orders WHERE id = ? FOR UPDATE', [(int) $id])->fetch();
        if ($locked['status'] !== $order['status'] || (int) $locked['slot_id'] !== $order['slot_id']) {
            $this->db->roll_back();
            $this->api->respond_error('This order was just updated. Please refresh the page and try again.', 409);
        }
        $this->Order_model->change_status($order, 'cancelled', $this->user()['id'], $note);
        $this->Slot_model->release_one((int) $order['slot_id']);
        $this->Payment_model->expire_pending((int) $id);
        $this->Product_model->return_stock((int) $id);
        $this->db->commit();

        $this->notify_order((int) $id, 'cancelled');
        if (!$unpaid_online) {
            $this->alert_cafe_change((int) $id, 'cancelled', $refund
                ? 'The customer cancelled this paid order online. Please send the refund through the original payment method, then record it on the order page.'
                : 'The customer cancelled this order online. No payment was made, so no refund is needed.');
        }
        $this->api->respond([
            'message' => $refund
                ? 'Order cancelled. The café will send your refund of PHP ' . number_format($order['total'], 2) . ' back through your original payment method.'
                : 'Order cancelled.',
            'data'    => $this->Order_model->detail((int) $id),
        ]);
    }

    public function reschedule($id)
    {
        $this->api->require_method('POST');
        $order = $this->own_order((int) $id);
        $in = $this->api->body();
        $this->validate($in, ['slot_id|Time slot' => 'required|pattern[int]']);
        if (!$order['can_self_reschedule']) {
            $this->api->respond_error($this->change_closed_message($order), 409);
        }

        $this->call->model(['Slot_model', 'Product_model']);
        $slot = $this->Slot_model->find((int) $in['slot_id']);
        if (!$slot || $slot['fulfillment'] !== $order['fulfillment'] || (int) $slot['is_blocked']) {
            $this->fail_validation(['slot_id' => 'Please choose an open ' . $order['fulfillment'] . ' time slot.']);
        }
        if ((int) $slot['id'] === $order['slot_id']) {
            $this->fail_validation(['slot_id' => 'That is already your time slot.']);
        }
        $qty = [];
        foreach ($order['items'] as $item) {
            if ($item['product_id'] !== null) {
                $qty[$item['product_id']] = ($qty[$item['product_id']] ?? 0) + $item['quantity'];
            }
        }
        $slowest = $this->Product_model->slowest(array_keys($qty));
        $lead = (int) ($slowest['lead_time_hours'] ?? 0);
        if (strtotime($slot['slot_date'] . ' ' . $slot['start_time']) < time() + $lead * 3600) {
            $this->fail_validation(['slot_id' => "That time is too soon. Your {$slowest['name']} needs {$lead} hours."]);
        }
        $day = date('D, M j', strtotime($slot['slot_date']));
        foreach ($qty as $product_id => $n) {
            $p = $this->Product_model->detail((int) $product_id);
            if (!$p || $p['product_type'] === 'ready_made') {
                continue;
            }
            if ($p['sold_out_date'] === $slot['slot_date']) {
                $this->fail_validation(['slot_id' => "{$p['name']} is sold out for {$day}. Please choose another day."]);
            }
            if ($p['daily_limit'] !== null) {
                $own = $order['slot_date'] === $slot['slot_date'] ? $n : 0;
                $left = $p['daily_limit'] - $this->Product_model->sold_on((int) $product_id, $slot['slot_date']) + $own;
                if ($n > $left) {
                    $this->fail_validation(['slot_id' => "Not enough {$p['name']} left for {$day}. Please choose another day."]);
                }
            }
        }

        $from = date('D M j, g:i A', strtotime($order['slot_date'] . ' ' . $order['start_time']));
        $to = date('D M j, g:i A', strtotime($slot['slot_date'] . ' ' . $slot['start_time']));
        $this->db->transaction();
        $locked = $this->db->raw('SELECT status, slot_id, reschedule_count FROM orders WHERE id = ? FOR UPDATE', [(int) $id])->fetch();
        if ($locked['status'] !== $order['status'] || (int) $locked['slot_id'] !== $order['slot_id'] || (int) $locked['reschedule_count'] >= Order_model::MAX_RESCHEDULES) {
            $this->db->roll_back();
            $this->api->respond_error('This order was just updated. Please refresh the page and try again.', 409);
        }
        if (!$this->Slot_model->book_one((int) $slot['id'])) {
            $this->db->roll_back();
            $this->response->send_json_error('That time slot just filled up or was closed. Please pick another one.', 409, ['errors' => ['slot_id' => 'This slot is full or closed.']]);
            exit;
        }
        $this->Slot_model->release_one($order['slot_id']);
        $this->db->table('orders')->where('id', (int) $id)->update([
            'slot_id'          => (int) $slot['id'],
            'reschedule_count' => (int) $locked['reschedule_count'] + 1,
        ]);
        $this->Order_model->add_history((int) $id, $order['status'], $order['status'], $this->user()['id'], "Rescheduled by the customer from {$from} to {$to}");
        $this->db->commit();

        $this->notify_order((int) $id, 'rescheduled');
        $this->alert_cafe_change((int) $id, 'moved', "The customer moved this order from {$from} to {$to}.");
        $this->api->respond(['message' => "Your order is now set for {$to}.", 'data' => $this->Order_model->detail((int) $id)]);
    }

    private function change_closed_message(array $order): string
    {
        $contact = 'Please contact the café.';
        if (in_array($order['status'], ['preparing', 'ready', 'out_for_delivery'], true)) {
            return "This order is already being prepared, so it can't be changed online. {$contact}";
        }
        if (in_array($order['status'], ['completed', 'cancelled'], true)) {
            return 'This order is already ' . $order['status'] . '.';
        }
        if ($order['needs_new_slot']) {
            return "This order needs a new time from the café. {$contact}";
        }
        if (time() > strtotime($order['change_deadline'])) {
            return 'Free changes ended on ' . date('D, M j, g:i A', strtotime($order['change_deadline'])) . ". {$contact}";
        }
        if ($order['reschedule_count'] >= Order_model::MAX_RESCHEDULES) {
            return "This order was already moved once. {$contact}";
        }
        return "This order can't be changed online. {$contact}";
    }

    private function alert_cafe_change(int $order_id, string $what, string $text): void
    {
        try {
            $this->call->library('notifier');
            $order = $this->Order_model->detail($order_id);
            $body = "Order {$order['order_number']} ({$order['customer_name']}, {$order['contact_phone']}) was {$what} by the customer.\n\n{$text}\n\n"
                  . 'Open the order: ' . $this->frontend_url('/admin/orders/' . $order_id);
            $this->notifier->email(config_item('cafe_email'), "Order {$order['order_number']} was {$what} by the customer", $body, 'customer_change', $order_id, null);
        } catch (Throwable $e) {
            $this->logger->log('error', 'Notification', 'Cafe alert failed: ' . $e->getMessage(), $e->getFile(), $e->getLine());
        }
    }

    private function own_order(int $id): array
    {
        $user = $this->user();
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $order = $this->Order_model->detail($id);
        if (!$order || $order['user_id'] !== (int) $user['id']) {
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
