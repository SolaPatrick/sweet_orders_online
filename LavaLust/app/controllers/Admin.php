<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Admin panel (FR8). Pages: A1 to A9. Every route needs the admin role. */
class Admin extends MY_Api_Controller
{
    public function before_action()
    {
        parent::before_action();
        $this->require_admin();
    }

    // ==============================================================
    // A1 Dashboard
    // ==============================================================

    /** GET /api/admin/dashboard */
    public function dashboard()
    {
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $today = date('Y-m-d');
        $one = function ($sql, $args = []) { return $this->db->raw($sql, $args)->fetchColumn(); };

        $stats = [
            'orders_today'      => (int) $one('SELECT COUNT(*) FROM orders WHERE DATE(created_at) = ?', [$today]),
            'waiting_payment'   => (int) $one("SELECT COUNT(*) FROM orders WHERE status = 'pending_payment'"),
            'sales_today'       => (float) $one("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND DATE(paid_at) = ?", [$today]),
            'sales_week'        => (float) $one("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)"),
            'to_prepare'        => (int) $one("SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'preparing')"),
            'slots_booked_today'=> (int) $one('SELECT COALESCE(SUM(booked_count), 0) FROM delivery_slots WHERE slot_date = ?', [$today]),
            'slots_capacity_today' => (int) $one('SELECT COALESCE(SUM(capacity), 0) FROM delivery_slots WHERE slot_date = ? AND is_blocked = 0', [$today]),
        ];

        $sales = $this->db->raw(
            "SELECT DATE(paid_at) AS day, SUM(amount) AS total FROM payments
             WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             GROUP BY DATE(paid_at)"
        )->fetchAll(PDO::FETCH_KEY_PAIR);
        $last7 = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $last7[] = ['date' => $d, 'total' => (float) ($sales[$d] ?? 0)];
        }

        [$due_today] = $this->Order_model->admin_search(['date' => $today], 50, 0);
        $due_today = array_values(array_filter($due_today, function ($o) { return $o['status'] !== 'cancelled'; }));
        usort($due_today, function ($a, $b) { return strcmp($a['start_time'], $b['start_time']); });
        [$recent] = $this->Order_model->admin_search([], 8, 0);

        $this->json(['stats' => $stats, 'sales_last_7_days' => $last7, 'due_today' => $due_today, 'recent_orders' => $recent]);
    }

    // ==============================================================
    // A2 / A3 Orders
    // ==============================================================

    /** GET /api/admin/orders?status=&q=&date=&fulfillment=&page= */
    public function orders()
    {
        [$page, $per_page, $offset] = $this->pagination_params(20);
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        [$rows, $total] = $this->Order_model->admin_search([
            'status'      => $this->query('status'),
            'q'           => $this->query('q'),
            'date'        => $this->query('date'),
            'fulfillment' => $this->query('fulfillment'),
        ], $per_page, $offset);
        $this->json([
            'data'   => $rows,
            'meta'   => ['page' => $page, 'per_page' => $per_page, 'total' => $total],
            'counts' => $this->Order_model->status_counts(),
        ]);
    }

    /** GET /api/admin/orders/{id} */
    public function order($id)
    {
        $this->call->model('Order_model');
        $order = $this->Order_model->detail((int) $id, true);
        if (!$order) {
            $this->error('Order not found.', 404);
        }
        $this->json(['data' => $order]);
    }

    /** PUT /api/admin/orders/{id}/status  {status}  Sends email + SMS to the customer. */
    public function order_status($id)
    {
        $in = $this->input();
        $this->validate($in, ['status' => 'required|in:paid,preparing,ready,out_for_delivery,completed,cancelled']);
        $this->call->model(['Order_model', 'Slot_model']);
        $order = $this->Order_model->detail((int) $id);
        if (!$order) {
            $this->error('Order not found.', 404);
        }
        $allowed = Order_model::NEXT_STATUS[$order['status']] ?? [];
        if (!in_array($in['status'], $allowed, true)) {
            $this->error("An order that is " . str_replace('_', ' ', $order['status']) . " cannot be changed to " . str_replace('_', ' ', $in['status']) . '.', 422);
        }
        if ($in['status'] === 'ready' && $order['fulfillment'] === 'delivery') {
            $this->error('Delivery orders go to Out for delivery instead of Ready for pickup.', 422);
        }
        if ($in['status'] === 'out_for_delivery' && $order['fulfillment'] === 'pickup') {
            $this->error('Pickup orders go to Ready for pickup instead of Out for delivery.', 422);
        }

        $this->db->transaction();
        $this->Order_model->set_status((int) $id, $in['status']);
        if ($in['status'] === 'cancelled') {
            $this->Slot_model->release_one((int) $order['slot_id']);
            $this->db->raw("UPDATE payments SET status = 'expired' WHERE order_id = ? AND status = 'pending'", [(int) $id]);
        }
        $this->db->commit();

        $this->notify_order((int) $id, $in['status']);
        $this->json(['message' => 'Status updated and the customer was notified.', 'data' => $this->Order_model->detail((int) $id, true)]);
    }

    // ==============================================================
    // A4 / A5 Products (CRUD)
    // ==============================================================

    /** GET /api/admin/products?q=&category= */
    public function products()
    {
        [$page, $per_page, $offset] = $this->pagination_params(50);
        $this->call->model('Product_model');
        [$rows, $total] = $this->Product_model->search([
            'q'        => $this->query('q'),
            'category' => $this->query('category'),
            'sort'     => 'name',
        ], $per_page, $offset);
        $this->json(['data' => $rows, 'meta' => ['page' => $page, 'per_page' => $per_page, 'total' => $total]]);
    }

    /** GET /api/admin/products/{id} */
    public function product($id)
    {
        $this->call->model('Product_model');
        $product = $this->Product_model->detail((int) $id);
        if (!$product) {
            $this->error('Product not found.', 404);
        }
        $this->json(['data' => $product]);
    }

    /** POST /api/admin/products */
    public function product_create()
    {
        $this->call->model('Product_model');
        [$data, $options] = $this->product_input();
        $this->db->transaction();
        $id = $this->Product_model->insert($data);
        $this->Product_model->replace_options((int) $id, $options);
        $this->db->commit();
        $this->json(['message' => 'Product added.', 'data' => $this->Product_model->detail((int) $id)], 201);
    }

    /** PUT /api/admin/products/{id} */
    public function product_update($id)
    {
        $this->call->model('Product_model');
        if (!$this->Product_model->find((int) $id)) {
            $this->error('Product not found.', 404);
        }
        [$data, $options, $has_options] = $this->product_input((int) $id);
        $this->db->transaction();
        $this->Product_model->update((int) $id, $data);
        if ($has_options) {
            $this->Product_model->replace_options((int) $id, $options);
        }
        $this->db->commit();
        $this->json(['message' => 'Product saved.', 'data' => $this->Product_model->detail((int) $id)]);
    }

    /** DELETE /api/admin/products/{id}  Past orders keep their copy of the name and price. */
    public function product_delete($id)
    {
        $this->call->model('Product_model');
        $product = $this->Product_model->find((int) $id);
        if (!$product) {
            $this->error('Product not found.', 404);
        }
        $this->Product_model->delete((int) $id);
        if ($product['image']) {
            $this->remove_photo($product['image']);
        }
        $this->json(['message' => "{$product['name']} was deleted."]);
    }

    /** POST /api/admin/products/{id}/image  multipart field "image" (JPG, PNG or WEBP, up to 2 MB). */
    public function product_image($id)
    {
        $this->call->model('Product_model');
        $product = $this->Product_model->find((int) $id);
        if (!$product) {
            $this->error('Product not found.', 404);
        }
        if (empty($_FILES['image'])) {
            $this->error('Please fix the highlighted fields.', 422, ['image' => 'Please choose a photo to upload.']);
        }
        $code = (int) ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE);
        if (in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || ($_FILES['image']['size'] ?? 0) > 2 * 1024 * 1024) {
            $this->error('Please fix the highlighted fields.', 422, ['image' => 'The photo must be 2 MB or smaller.']);
        }
        if ($code !== UPLOAD_ERR_OK) {
            $this->error('Please fix the highlighted fields.', 422, ['image' => 'The photo could not be uploaded. Please try again.']);
        }
        // Reject non-images before the Upload library reads them.
        set_error_handler(function () { return true; });
        $info = is_uploaded_file($_FILES['image']['tmp_name'] ?? '') ? getimagesize($_FILES['image']['tmp_name']) : false;
        restore_error_handler();
        if (!$info) {
            $this->error('Please fix the highlighted fields.', 422, ['image' => 'The file is not a valid JPG, PNG or WEBP image.']);
        }
        // On Render the photo goes to Cloudinary, since its disk is wiped on restart.
        $this->call->library('cloudinary');
        if ($this->cloudinary->enabled()) {
            try {
                $url = $this->cloudinary->upload($_FILES['image']['tmp_name']);
            } catch (RuntimeException $e) {
                $this->error('The photo could not be saved: ' . $e->getMessage(), 502);
            }
            if ($product['image']) {
                $this->remove_photo($product['image']);
            }
            $this->Product_model->update((int) $id, ['image' => $url]);
            $this->json(['message' => 'Photo uploaded.', 'data' => $this->Product_model->detail((int) $id)]);
        }
        $dir = $this->upload_dir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $this->call->library('upload', $_FILES['image']);
        $this->upload->set_dir($dir);
        $this->upload->allowed_extensions(['jpg', 'jpeg', 'png', 'webp']);
        $this->upload->allowed_mimes(['image/jpeg', 'image/png', 'image/webp']);
        $this->upload->max_size(2);
        $this->upload->is_image();
        $this->upload->encrypt_name();
        if (!$this->upload->do_upload()) {
            $this->error('Please fix the highlighted fields.', 422, ['image' => implode(' ', $this->upload->get_errors())]);
        }
        if ($product['image']) {
            $this->remove_photo($product['image']);
        }
        $this->Product_model->update((int) $id, ['image' => $this->upload->get_filename()]);
        $this->json(['message' => 'Photo uploaded.', 'data' => $this->Product_model->detail((int) $id)]);
    }

    /** Deletes a product photo: a Cloudinary URL or a file in public/uploads/products. */
    private function remove_photo(string $image): void
    {
        if (preg_match('#^https?://#i', $image)) {
            $this->call->library('cloudinary');
            $this->cloudinary->delete($image);
            return;
        }
        $file = $this->upload_dir() . basename($image);
        if (is_file($file)) {
            @unlink($file);
        }
    }

    private function upload_dir(): string
    {
        return ROOT_DIR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'products' . DIRECTORY_SEPARATOR;
    }

    /** Validates the product form. Returns [row, options, options_sent]. */
    private function product_input(?int $id = null): array
    {
        $in = $this->input();
        $this->validate($in, [
            'name'            => 'required|max:150',
            'category_id'     => 'required|integer',
            'base_price'      => 'required|numeric|gte:0',
            'lead_time_hours' => 'required|integer|gte:0',
            'description'     => 'max:2000',
            'is_available'    => 'bool',
            'is_featured'     => 'bool',
            'is_customizable' => 'bool',
            'options'         => 'array',
        ], ['category_id' => 'Category', 'base_price' => 'Base price', 'lead_time_hours' => 'Lead time']);

        if ((float) $in['base_price'] > 100000) {
            $this->error('Please fix the highlighted fields.', 422, ['base_price' => 'Base price looks too high.']);
        }
        $this->call->model('Category_model');
        if (!$this->Category_model->find((int) $in['category_id'])) {
            $this->error('Please fix the highlighted fields.', 422, ['category_id' => 'Please choose a category.']);
        }

        $slug = $this->slugify($in['name']);
        $base = $slug;
        for ($n = 2; $this->Product_model->slug_taken($slug, $id); $n++) {
            $slug = $base . '-' . $n;
        }

        $options = [];
        foreach ((array) ($in['options'] ?? []) as $i => $o) {
            $group = $o['option_group'] ?? '';
            $name = trim((string) ($o['name'] ?? ''));
            $add = $o['price_add'] ?? 0;
            if (!in_array($group, ['size', 'flavor', 'frosting'], true) || $name === '' || mb_strlen($name) > 100 || !is_numeric($add) || $add < 0) {
                $this->error('Please fix the highlighted fields.', 422, ["options.{$i}" => 'Each option needs a group (size, flavor or frosting), a name and a price add of 0 or more.']);
            }
            $options[] = ['id' => $o['id'] ?? null, 'option_group' => $group, 'name' => $name, 'price_add' => (float) $add, 'sort_order' => $i + 1];
        }

        $data = [
            'category_id'     => (int) $in['category_id'],
            'name'            => $in['name'],
            'slug'            => $slug,
            'description'     => ($in['description'] ?? '') !== '' ? $in['description'] : null,
            'base_price'      => round((float) $in['base_price'], 2),
            'lead_time_hours' => (int) $in['lead_time_hours'],
            'is_available'    => $this->to_bool($in['is_available'] ?? 1),
            'is_featured'     => $this->to_bool($in['is_featured'] ?? 0),
            'is_customizable' => $this->to_bool($in['is_customizable'] ?? 0),
        ];
        return [$data, $options, array_key_exists('options', $in)];
    }

    // ==============================================================
    // A6 Categories (CRUD)
    // ==============================================================

    /** GET /api/admin/categories */
    public function categories()
    {
        $this->call->model('Category_model');
        $this->json(['data' => array_map(function ($c) {
            return ['id' => (int) $c['id'], 'name' => $c['name'], 'slug' => $c['slug'], 'sort_order' => (int) $c['sort_order'], 'product_count' => (int) $c['product_count']];
        }, $this->Category_model->all_with_counts())]);
    }

    /** POST /api/admin/categories  {name, sort_order} */
    public function category_create()
    {
        $this->call->model('Category_model');
        $data = $this->category_input();
        $id = $this->Category_model->insert($data);
        $this->json(['message' => 'Category added.', 'data' => $this->Category_model->find((int) $id)], 201);
    }

    /** PUT /api/admin/categories/{id} */
    public function category_update($id)
    {
        $this->call->model('Category_model');
        if (!$this->Category_model->find((int) $id)) {
            $this->error('Category not found.', 404);
        }
        $this->Category_model->update((int) $id, $this->category_input((int) $id));
        $this->json(['message' => 'Category saved.', 'data' => $this->Category_model->find((int) $id)]);
    }

    /** DELETE /api/admin/categories/{id}  Refused while the category still has products. */
    public function category_delete($id)
    {
        $this->call->model('Category_model');
        $category = $this->Category_model->find((int) $id);
        if (!$category) {
            $this->error('Category not found.', 404);
        }
        $count = $this->Category_model->product_count((int) $id);
        if ($count > 0) {
            $this->error("{$category['name']} still has {$count} product(s). Move or delete them first.", 409);
        }
        $this->Category_model->delete((int) $id);
        $this->json(['message' => "{$category['name']} was deleted."]);
    }

    private function category_input(?int $id = null): array
    {
        $in = $this->input();
        $this->validate($in, ['name' => 'required|max:100', 'sort_order' => 'integer|gte:0'], ['sort_order' => 'Display order']);
        $slug = $this->slugify($in['name']);
        if ($this->Category_model->slug_taken($slug, $id)) {
            $this->error('Please fix the highlighted fields.', 422, ['name' => 'A category with this name already exists.']);
        }
        return ['name' => $in['name'], 'slug' => $slug, 'sort_order' => (int) ($in['sort_order'] ?? 0)];
    }

    // ==============================================================
    // A7 Time slots and blocked dates
    // ==============================================================

    /** GET /api/admin/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&fulfillment= */
    public function slots()
    {
        $in = [
            'from'        => $this->query('from', date('Y-m-d')),
            'to'          => $this->query('to', date('Y-m-d', strtotime('+6 days'))),
            'fulfillment' => $this->query('fulfillment'),
        ];
        $this->validate($in, ['from' => 'required|date', 'to' => 'required|date', 'fulfillment' => 'in:pickup,delivery']);
        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $this->json([
            'data'          => $this->Slot_model->between($in['from'], $in['to'], $in['fulfillment'] ?: null),
            'blocked_dates' => $this->Slot_model->blocked_dates(date('Y-m-d')),
        ]);
    }

    /**
     * POST /api/admin/slots/generate
     * {from, to, times: ["09:00", ...], duration_minutes: 60, capacity: 5, fulfillment: pickup|delivery|both, skip_weekdays: [1]}
     */
    public function slots_generate()
    {
        $in = $this->input();
        $this->validate($in, [
            'from'             => 'required|date',
            'to'               => 'required|date',
            'times'            => 'required|array',
            'duration_minutes' => 'required|integer|gte:15',
            'capacity'         => 'required|integer|gte:1',
            'fulfillment'      => 'required|in:pickup,delivery,both',
            'skip_weekdays'    => 'array',
        ], ['duration_minutes' => 'Slot length', 'times' => 'Time windows']);
        if ($in['to'] < $in['from']) {
            $this->error('Please fix the highlighted fields.', 422, ['to' => 'End date must be on or after the start date.']);
        }
        if ((strtotime($in['to']) - strtotime($in['from'])) / 86400 > 92) {
            $this->error('Please fix the highlighted fields.', 422, ['to' => 'Create at most 3 months of slots at a time.']);
        }
        $windows = [];
        foreach ($in['times'] as $t) {
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) $t)) {
                $this->error('Please fix the highlighted fields.', 422, ['times' => "\"{$t}\" is not a time like 09:00."]);
            }
            $start = strtotime("2000-01-01 {$t}");
            $end = $start + (int) $in['duration_minutes'] * 60;
            if (date('Y-m-d', $end) !== '2000-01-01') {
                $this->error('Please fix the highlighted fields.', 422, ['times' => "A slot starting at {$t} would end after midnight."]);
            }
            $windows[] = ['start' => date('H:i:s', $start), 'end' => date('H:i:s', $end)];
        }
        $types = $in['fulfillment'] === 'both' ? ['pickup', 'delivery'] : [$in['fulfillment']];
        $skip = array_map('intval', (array) ($in['skip_weekdays'] ?? []));

        $this->call->model('Slot_model');
        $created = $this->Slot_model->generate($in['from'], $in['to'], $windows, $types, (int) $in['capacity'], $skip);
        $this->json(['message' => "{$created} slot(s) created. Existing slots were kept.", 'created' => $created], 201);
    }

    /** PUT /api/admin/slots/{id}  {capacity, is_blocked, start_time, end_time} */
    public function slot_update($id)
    {
        $this->call->model('Slot_model');
        $slot = $this->Slot_model->find((int) $id);
        if (!$slot) {
            $this->error('Slot not found.', 404);
        }
        $in = $this->input();
        $this->validate($in, [
            'capacity'   => 'integer|gte:0',
            'is_blocked' => 'bool',
            'start_time' => 'time',
            'end_time'   => 'time',
        ]);
        $data = [];
        if (isset($in['capacity'])) {
            if ((int) $in['capacity'] < (int) $slot['booked_count']) {
                $this->error('Please fix the highlighted fields.', 422, ['capacity' => "This slot already has {$slot['booked_count']} booking(s); capacity cannot be lower."]);
            }
            $data['capacity'] = (int) $in['capacity'];
        }
        if (isset($in['is_blocked'])) {
            $data['is_blocked'] = $this->to_bool($in['is_blocked']);
        }
        if (!empty($in['start_time']) || !empty($in['end_time'])) {
            $start = $in['start_time'] ?? substr($slot['start_time'], 0, 5);
            $end = $in['end_time'] ?? substr($slot['end_time'], 0, 5);
            if ($end <= $start) {
                $this->error('Please fix the highlighted fields.', 422, ['end_time' => 'End time must be after the start time.']);
            }
            $data['start_time'] = $start;
            $data['end_time'] = $end;
        }
        if (!$data) {
            $this->error('Nothing to change.', 422);
        }
        try {
            $this->Slot_model->update((int) $id, $data);
        } catch (PDOException $e) {
            $this->error('Another slot already starts at that time on this date.', 409);
        }
        $this->json(['message' => 'Slot saved.', 'data' => $this->Slot_model->cast($this->Slot_model->find((int) $id))]);
    }

    /** DELETE /api/admin/slots/{id}  A slot with orders can be blocked but not deleted. */
    public function slot_delete($id)
    {
        $this->call->model('Slot_model');
        $slot = $this->Slot_model->find((int) $id);
        if (!$slot) {
            $this->error('Slot not found.', 404);
        }
        $orders = (int) $this->db->raw('SELECT COUNT(*) FROM orders WHERE slot_id = ?', [(int) $id])->fetchColumn();
        if ($orders > 0) {
            $this->error('This slot has orders, so it cannot be deleted. Block it instead.', 409);
        }
        $this->Slot_model->delete((int) $id);
        $this->json(['message' => 'Slot deleted.']);
    }

    /** POST /api/admin/slots/block-date  {date, blocked: true|false} */
    public function block_date()
    {
        $in = $this->input();
        $this->validate($in, ['date' => 'required|date', 'blocked' => 'required|bool']);
        $this->call->model('Slot_model');
        $blocked = $this->to_bool($in['blocked']);
        $changed = $this->Slot_model->set_date_blocked($in['date'], $blocked);
        $exists = (int) $this->db->raw('SELECT COUNT(*) FROM delivery_slots WHERE slot_date = ?', [$in['date']])->fetchColumn();
        if (!$exists) {
            $this->error('There are no slots on that date to block. Create slots first.', 422);
        }
        $this->json([
            'message'       => $blocked ? "{$in['date']} is now closed." : "{$in['date']} is open again.",
            'changed'       => $changed,
            'blocked_dates' => $this->Slot_model->blocked_dates(date('Y-m-d')),
        ]);
    }

    // ==============================================================
    // A8 Payments, A9 Notification log
    // ==============================================================

    /** GET /api/admin/payments?status=&method=&q= */
    public function payments()
    {
        [$page, $per_page, $offset] = $this->pagination_params(20);
        $this->call->model('Payment_model');
        [$rows, $total] = $this->Payment_model->admin_search([
            'status' => $this->query('status'),
            'method' => $this->query('method'),
            'q'      => $this->query('q'),
        ], $per_page, $offset);
        $this->json(['data' => $rows, 'meta' => ['page' => $page, 'per_page' => $per_page, 'total' => $total], 'summary' => $this->Payment_model->summary()]);
    }

    /** GET /api/admin/notifications?channel=&status=&event=&order_id= */
    public function notifications()
    {
        [$page, $per_page, $offset] = $this->pagination_params(30);
        $this->call->model('Notification_model');
        [$rows, $total] = $this->Notification_model->admin_search([
            'channel'  => $this->query('channel'),
            'status'   => $this->query('status'),
            'event'    => $this->query('event'),
            'order_id' => $this->query('order_id'),
        ], $per_page, $offset);
        $this->json(['data' => $rows, 'meta' => ['page' => $page, 'per_page' => $per_page, 'total' => $total]]);
    }

    /** POST /api/admin/notifications/{id}/resend */
    public function notification_resend($id)
    {
        $this->call->model('Notification_model');
        $row = $this->Notification_model->find((int) $id);
        if (!$row) {
            $this->error('Message not found.', 404);
        }
        $this->call->library('notifier');
        $result = $this->notifier->resend($row);
        $messages = [
            'failed' => 'Sending failed again: ' . $result['error'],
            'logged' => 'Logged again (test mode: no email or SMS account is set up).',
            'sent'   => 'Message sent again.',
        ];
        $this->json(['message' => $messages[$result['status']], 'data' => $result]);
    }
}
