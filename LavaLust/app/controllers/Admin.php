<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Admin extends MY_Api_Controller
{

    public function dashboard()
    {
        $this->api->require_method('GET');
        $this->call->model(['Slot_model', 'Order_model', 'Payment_model', 'Product_model']);
        $this->Slot_model->release_expired_holds();
        $today = date('Y-m-d');
        $week_start = date('Y-m-d', strtotime('monday this week'));

        $slots_today = $this->Slot_model->day_totals($today);
        $stats = [
            'orders_today'         => $this->Order_model->count_created_on($today),
            'waiting_payment'      => $this->Order_model->count_with_status(['pending_payment']),
            'sales_today'          => $this->Payment_model->paid_total($today, $today),
            'sales_week'           => $this->Payment_model->paid_total($week_start),
            'to_prepare'           => $this->Order_model->count_with_status(['paid', 'preparing']),
            'slots_booked_today'   => $slots_today['booked'],
            'slots_capacity_today' => $slots_today['capacity'],
        ];

        $sales = $this->Payment_model->paid_by_day(date('Y-m-d', strtotime('-6 days')));
        $last7 = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $last7[] = ['date' => $d, 'total' => (float) ($sales[$d] ?? 0)];
        }

        $due_today = $this->Order_model->admin_search(['date' => $today], 50, 0);
        $due_today = array_values(array_filter($due_today, function ($o) { return $o['status'] !== 'cancelled'; }));
        usort($due_today, function ($a, $b) { return strcmp($a['start_time'], $b['start_time']); });
        $recent = $this->Order_model->admin_search([], 8, 0);

        $this->api->respond([
            'stats'             => $stats,
            'sales_last_7_days' => $last7,
            'due_today'         => $due_today,
            'recent_orders'     => $recent,
            'needs_new_slot'    => $this->Order_model->needing_new_slot(),
            'needs_stock'       => $this->Order_model->needing_stock(),
            'ready_made'        => array_map(function ($p) {
                return ['id' => $p['id'], 'name' => $p['name'], 'stock_qty' => $p['stock_qty'], 'is_available' => $p['is_available']];
            }, $this->Product_model->search(['type' => 'ready_made', 'sort' => 'name'])),
        ]);
    }

    public function orders()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $filters = [
            'status'      => $q['status'] ?? null,
            'q'           => $q['q'] ?? null,
            'date'        => $q['date'] ?? null,
            'fulfillment' => $q['fulfillment'] ?? null,
        ];
        $this->call->model(['Slot_model', 'Order_model']);
        $this->Slot_model->release_expired_holds();
        $page = $this->paginate($this->Order_model->admin_count($filters), 20);
        $this->api->respond([
            'data'   => $this->Order_model->admin_search($filters, $page['per_page'], $page['offset']),
            'meta'   => $this->page_meta($page),
            'counts' => $this->Order_model->status_counts(),
        ]);
    }

    public function order($id)
    {
        $this->api->require_method('GET');
        $this->call->model('Order_model');
        $order = $this->Order_model->detail((int) $id, true);
        if (!$order) {
            $this->api->respond_error('Order not found.', 404);
        }
        $this->api->respond(['data' => $order]);
    }

    public function order_status($id)
    {
        $this->api->require_method('PUT');
        $in = $this->api->body();
        $this->validate($in, [
            'status|Status'               => 'required|in_list["paid,preparing,ready,out_for_delivery,completed,cancelled"]',
            'note|Note'                   => 'max_length[255]',
            'cancel_reason|Cancel reason' => 'max_length[255]',
            'claim_code|Claim code'       => 'max_length[4]',
            'override|Override'           => 'in_list["0,1,true,false"]',
        ]);
        $this->call->model(['Order_model', 'Slot_model', 'Payment_model', 'Product_model']);
        $order = $this->Order_model->detail((int) $id);
        if (!$order) {
            $this->api->respond_error('Order not found.', 404);
        }
        $actor = $this->user();
        $allowed = Order_model::NEXT_STATUS[$order['status']] ?? [];
        if (!in_array($in['status'], $allowed, true)) {
            $this->api->respond_error("An order that is " . str_replace('_', ' ', $order['status']) . " cannot be changed to " . str_replace('_', ' ', $in['status']) . '.', 422);
        }
        if ($in['status'] === 'ready' && $order['fulfillment'] === 'delivery') {
            $this->api->respond_error('Delivery orders go to Out for delivery instead of Ready for pickup.', 422);
        }
        if ($in['status'] === 'out_for_delivery' && $order['fulfillment'] === 'pickup') {
            $this->api->respond_error('Pickup orders go to Ready for pickup instead of Out for delivery.', 422);
        }

        $note = trim((string) ($in['note'] ?? ''));
        $extra = [];
        if ($in['status'] === 'cancelled') {
            $reason = trim((string) ($in['cancel_reason'] ?? ''));
            if ($order['payment_status'] === 'paid' && $reason === '') {
                $this->fail_validation(['cancel_reason' => 'Please give a reason for cancelling a paid order.']);
            }
            if ($reason !== '') {
                $extra['cancel_reason'] = $reason;
                $note = $note !== '' ? $note : $reason;
            }
        }
        if ($in['status'] === 'preparing') {
            $extra['prepared_by'] = (int) $actor['id'];
            $extra['prepared_at'] = date('Y-m-d H:i:s');
        }
        if ($in['status'] === 'completed' && $order['fulfillment'] === 'pickup' && $order['claim_code']) {
            $code = trim((string) ($in['claim_code'] ?? ''));
            if ($code !== $order['claim_code']) {
                if ($actor['role'] === 'admin' && $this->request->boolean('override')) {
                    if ($note === '') {
                        $this->fail_validation(['note' => 'Please write why the claim code was skipped.']);
                    }
                    $note = 'Claim code skipped by admin: ' . $note;
                } else {
                    $this->fail_validation(['claim_code' => $code === '' ? 'Enter the 4-digit claim code from the customer.' : 'The claim code does not match.']);
                }
            } else {
                $note = $note !== '' ? $note : 'Claim code checked';
            }
        }

        $this->db->transaction();
        $this->Order_model->change_status($order, $in['status'], $actor['id'], $note !== '' ? $note : null, $extra);
        if ($in['status'] === 'cancelled') {
            if (!$order['needs_new_slot']) {
                $this->Slot_model->release_one((int) $order['slot_id']);
            }
            $this->Payment_model->expire_pending((int) $id);
            if ($this->Product_model->return_stock((int) $id)) {
                $this->Order_model->add_history((int) $id, 'cancelled', 'cancelled', $actor['id'], 'Ready-made stock put back');
            }
        }
        $this->db->commit();

        $this->notify_order((int) $id, $in['status']);
        $this->api->respond(['message' => 'Status updated and the customer was notified.', 'data' => $this->Order_model->detail((int) $id, true)]);
    }

    public function order_preparer($id)
    {
        $this->api->require_method('PUT');
        $in = $this->api->body();
        $this->validate($in, ['prepared_by|Preparer' => 'required|pattern[int]']);
        $this->call->model(['Order_model', 'User_model']);
        $order = $this->Order_model->detail((int) $id);
        if (!$order) {
            $this->api->respond_error('Order not found.', 404);
        }
        $preparer = $this->User_model->find((int) $in['prepared_by']);
        if (!$preparer || !(int) $preparer['is_active'] || !in_array($preparer['role'], ['staff', 'admin'], true)) {
            $this->fail_validation(['prepared_by' => 'Choose an active staff member or admin.']);
        }
        $this->db->transaction();
        $this->db->table('orders')->where('id', (int) $id)->update([
            'prepared_by' => (int) $preparer['id'],
            'prepared_at' => $order['prepared_at'] ?: date('Y-m-d H:i:s'),
        ]);
        $this->Order_model->add_history((int) $id, $order['status'], $order['status'], $this->user()['id'], "Preparer set to {$preparer['name']}");
        $this->db->commit();
        $this->api->respond(['message' => "Preparer set to {$preparer['name']}.", 'data' => $this->Order_model->detail((int) $id, true)]);
    }

    public function order_refund($id)
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        $this->validate($in, [
            'refund_amount|Refund amount'       => 'required|numeric|greater_than_equal_to[0.01]',
            'refund_reference|Refund reference' => 'required|max_length[100]',
        ]);
        $this->call->model('Order_model');
        $order = $this->Order_model->detail((int) $id);
        if (!$order) {
            $this->api->respond_error('Order not found.', 404);
        }
        if ($order['status'] !== 'cancelled' || $order['payment_status'] !== 'paid') {
            $this->api->respond_error('Only a cancelled order that was paid can be refunded.', 409);
        }
        $amount = round((float) $in['refund_amount'], 2);
        if ($amount > $order['total']) {
            $this->fail_validation(['refund_amount' => 'The refund cannot be more than the order total of PHP ' . number_format($order['total'], 2) . '.']);
        }
        $this->db->transaction();
        $this->db->table('orders')->where('id', (int) $id)->update([
            'payment_status'   => 'refunded',
            'refund_amount'    => $amount,
            'refund_reference' => $in['refund_reference'],
            'refunded_at'      => date('Y-m-d H:i:s'),
        ]);
        $this->Order_model->add_history((int) $id, 'cancelled', 'cancelled', $this->user()['id'], 'Refunded PHP ' . number_format($amount, 2) . " (ref {$in['refund_reference']})");
        $this->call->model('Product_model');
        if ($this->Product_model->return_stock((int) $id)) {
            $this->Order_model->add_history((int) $id, 'cancelled', 'cancelled', $this->user()['id'], 'Ready-made stock put back');
        }
        $this->db->commit();
        $this->notify_order((int) $id, 'refunded');
        $this->api->respond(['message' => 'Refund recorded and the customer was notified.', 'data' => $this->Order_model->detail((int) $id, true)]);
    }

    public function products()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $this->call->model('Product_model');
        $rows = $this->Product_model->search([
            'q'        => $q['q'] ?? null,
            'category' => $q['category'] ?? null,
            'archived' => $this->request->boolean('archived'),
            'sort'     => 'name',
        ]);
        $page = $this->paginate(count($rows), 50);
        $this->api->respond(['data' => array_slice($rows, $page['offset'], $page['per_page']), 'meta' => $this->page_meta($page)]);
    }

    public function product($id)
    {
        $this->api->require_method('GET');
        $this->call->model('Product_model');
        $product = $this->Product_model->detail((int) $id);
        if (!$product) {
            $this->api->respond_error('Product not found.', 404);
        }
        $this->api->respond(['data' => $product]);
    }

    public function product_create()
    {
        $this->api->require_method('POST');
        $this->call->model('Product_model');
        [$data, $options, , $allergens] = $this->product_input();
        $this->db->transaction();
        $id = $this->Product_model->insert($data);
        $this->save_allergens((int) $id, $options, $this->Product_model->replace_options((int) $id, $options), $allergens ?? []);
        $this->db->commit();
        $this->api->respond(['message' => 'Product added.', 'data' => $this->Product_model->detail((int) $id)], 201);
    }

    public function product_update($id)
    {
        $this->api->require_method('PUT');
        $this->call->model('Product_model');
        if (!$this->Product_model->find((int) $id)) {
            $this->api->respond_error('Product not found.', 404);
        }
        [$data, $options, $has_options, $allergens] = $this->product_input((int) $id);
        $this->db->transaction();
        $this->Product_model->update((int) $id, $data);
        $option_ids = $has_options ? $this->Product_model->replace_options((int) $id, $options) : [];
        $this->save_allergens((int) $id, $has_options ? $options : [], $option_ids, $allergens);
        $this->db->commit();
        $this->api->respond(['message' => 'Product saved.', 'data' => $this->Product_model->detail((int) $id)]);
    }

    private function save_allergens(int $product_id, array $options, array $option_ids, ?array $allergens): void
    {
        $this->call->model('Allergen_model');
        if ($allergens !== null) {
            $this->Allergen_model->set_for_product($product_id, $allergens);
        }
        foreach ($options as $i => $o) {
            if (isset($option_ids[$i]) && is_array($o['allergen_ids'] ?? null)) {
                $this->Allergen_model->set_for_option((int) $option_ids[$i], $o['allergen_ids']);
            }
        }
    }

    public function product_stock($id)
    {
        $this->api->require_method('PUT');
        $in = $this->api->body();
        $this->validate($in, ['stock_qty|Stock' => 'required|greater_than_equal_to[0]|pattern[int]']);
        if ((int) $in['stock_qty'] > 100000) {
            $this->fail_validation(['stock_qty' => 'Stock looks too high.']);
        }
        $this->call->model('Product_model');
        $product = $this->Product_model->detail((int) $id);
        if (!$product || $product['is_archived']) {
            $this->api->respond_error('Product not found.', 404);
        }
        if ($product['product_type'] !== 'ready_made') {
            $this->api->respond_error("{$product['name']} is made to order, so it has no stock count. Switch it to ready-made in the product form first.", 422);
        }
        $this->Product_model->set_stock((int) $id, (int) $in['stock_qty']);
        $this->api->respond(['message' => "{$product['name']} stock set to {$in['stock_qty']}.", 'data' => $this->Product_model->detail((int) $id)]);
    }

    public function product_delete($id)
    {
        $this->api->require_method('DELETE');
        $this->call->model('Product_model');
        $product = $this->Product_model->find((int) $id);
        if (!$product) {
            $this->api->respond_error('Product not found.', 404);
        }
        if ($this->Product_model->has_orders((int) $id)) {
            $this->Product_model->update((int) $id, ['is_archived' => 1]);
            $this->api->respond(['message' => "{$product['name']} has past orders, so it was archived and hidden from the menu instead of deleted.", 'archived' => true]);
        }
        $this->Product_model->delete((int) $id);
        if ($product['image']) {
            $this->remove_photo($product['image']);
        }
        $this->api->respond(['message' => "{$product['name']} was deleted.", 'archived' => false]);
    }

    public function product_image($id)
    {
        $this->api->require_method('POST');
        $this->call->model('Product_model');
        $product = $this->Product_model->find((int) $id);
        if (!$product) {
            $this->api->respond_error('Product not found.', 404);
        }
        if (!$this->request->has_file('image')) {
            $this->fail_validation(['image' => 'Please choose a photo to upload.']);
        }
        $file = $this->request->file('image');
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            $this->fail_validation(['image' => 'The photo must be 2 MB or smaller.']);
        }

        $this->call->library('cloudinary');
        $to_cloud = $this->cloudinary->enabled();
        $this->call->library('upload', $file);
        $this->upload
            ->set_dir($to_cloud ? ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'uploads' : $this->upload_dir())
            ->allowed_extensions(['jpg', 'jpeg', 'png', 'webp'])
            ->allowed_mimes(['image/jpeg', 'image/png', 'image/webp'])
            ->max_size(2)
            ->is_image()
            ->encrypt_name();
        if (!$this->upload->do_upload()) {
            $this->fail_validation(['image' => implode(' ', $this->upload->get_errors())]);
        }

        $image = $this->upload->get_filename();
        if ($to_cloud) {
            $tmp = ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $image;
            try {
                $image = $this->cloudinary->upload($tmp);
            } catch (RuntimeException $e) {
                $this->api->respond_error('The photo could not be saved: ' . $e->getMessage(), 502);
            } finally {
                @unlink($tmp);
            }
        }
        if ($product['image']) {
            $this->remove_photo($product['image']);
        }
        $this->Product_model->update((int) $id, ['image' => $image]);
        $this->api->respond(['message' => 'Photo uploaded.', 'data' => $this->Product_model->detail((int) $id)]);
    }

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

    private function product_input(?int $id = null): array
    {
        $in = $this->api->body();
        $current = $id ? $this->Product_model->find($id) : null;
        $type = $in['product_type'] ?? ($current['product_type'] ?? 'made_to_order');
        $ready = $type === 'ready_made';
        $this->validate($in, [
            'name|Name'                    => 'required|max_length[150]',
            'category_id|Category'         => 'required|pattern[int]',
            'base_price|Base price'        => 'required|numeric|greater_than_equal_to[0]',
            'product_type|Product type'    => 'in_list["ready_made,made_to_order"]',
            'stock_qty|Stock'              => 'greater_than_equal_to[0]|pattern[int]',
            'lead_time_hours|Lead time'    => ($ready ? '' : 'required|') . 'greater_than_equal_to[0]|pattern[int]',
            'description|Description'      => 'max_length[2000]',
            'ingredients|Ingredients'      => 'max_length[2000]',
            'allergen_ids|Allergens'       => 'pattern[array]',
            'is_available|Is available'    => 'in_list["0,1,true,false"]',
            'is_featured|Is featured'      => 'in_list["0,1,true,false"]',
            'is_customizable|Is customizable' => 'in_list["0,1,true,false"]',
            'options|Options'              => 'pattern[array]',
            'daily_limit|Daily limit'      => 'greater_than_equal_to[1]|pattern[int]',
            'sold_out_today|Sold out today' => 'in_list["0,1,true,false"]',
            'is_archived|Is archived'      => 'in_list["0,1,true,false"]',
        ]);

        if ((float) $in['base_price'] > 100000) {
            $this->fail_validation(['base_price' => 'Base price looks too high.']);
        }
        $this->call->model('Category_model');
        if (!$this->Category_model->find((int) $in['category_id'])) {
            $this->fail_validation(['category_id' => 'Please choose a category.']);
        }

        $slug = slugify($in['name']);
        $base = $slug;
        for ($n = 2; $this->Product_model->slug_taken($slug, $id); $n++) {
            $slug = $base . '-' . $n;
        }

        if ($ready) {
            $has_stock = isset($in['stock_qty']) && $in['stock_qty'] !== '';
            if (!$has_stock && ($current['stock_qty'] ?? null) === null) {
                $this->fail_validation(['stock_qty' => 'Enter how many are in stock (0 or more).']);
            }
            if ($has_stock && (int) $in['stock_qty'] > 100000) {
                $this->fail_validation(['stock_qty' => 'Stock looks too high.']);
            }
            if (!empty($in['options'])) {
                $this->fail_validation(['options' => 'Ready-made products have no options. Remove them or switch to made to order.']);
            }
        }

        $options = [];
        foreach ((array) ($in['options'] ?? []) as $i => $o) {
            $group = $o['option_group'] ?? '';
            $name = trim((string) ($o['name'] ?? ''));
            $add = $o['price_add'] ?? 0;
            if (!in_array($group, ['size', 'flavor', 'frosting'], true) || $name === '' || mb_strlen($name) > 100 || !is_numeric($add) || $add < 0) {
                $this->fail_validation(["options.{$i}" => 'Each option needs a group (size, flavor or frosting), a name and a price add of 0 or more.']);
            }
            $options[] = [
                'id'           => $o['id'] ?? null,
                'option_group' => $group,
                'name'         => $name,
                'price_add'    => (float) $add,
                'sort_order'   => $i + 1,
                'allergen_ids' => array_key_exists('allergen_ids', $o) ? (array) $o['allergen_ids'] : null,
            ];
        }

        $data = [
            'category_id'     => (int) $in['category_id'],
            'name'            => $in['name'],
            'slug'            => $slug,
            'description'     => ($in['description'] ?? '') !== '' ? $in['description'] : null,
            'base_price'      => round((float) $in['base_price'], 2),
            'product_type'    => $type,
            'lead_time_hours' => $ready ? Product_model::READY_MADE_LEAD_HOURS : (int) $in['lead_time_hours'],
            'is_available'    => (int) $this->request->boolean('is_available', true),
            'is_featured'     => (int) $this->request->boolean('is_featured'),
            'is_customizable' => $ready ? 0 : (int) $this->request->boolean('is_customizable'),
        ];
        if (!$ready) {
            $data['stock_qty'] = null;
        } elseif (isset($in['stock_qty']) && $in['stock_qty'] !== '') {
            $data['stock_qty'] = (int) $in['stock_qty'];
        }
        if (array_key_exists('daily_limit', $in)) {
            $data['daily_limit'] = $in['daily_limit'] !== null && $in['daily_limit'] !== '' ? (int) $in['daily_limit'] : null;
        }
        if (array_key_exists('sold_out_today', $in)) {
            $data['sold_out_date'] = $this->request->boolean('sold_out_today') ? date('Y-m-d') : null;
        }
        if (array_key_exists('is_archived', $in)) {
            $data['is_archived'] = (int) $this->request->boolean('is_archived');
        }
        if (array_key_exists('ingredients', $in)) {
            $ingredients = trim((string) $in['ingredients']);
            $data['ingredients'] = $ingredients !== '' ? $ingredients : null;
        }
        $allergens = array_key_exists('allergen_ids', $in) ? (array) $in['allergen_ids'] : null;
        return [$data, $options, $ready || array_key_exists('options', $in), $allergens];
    }

    public function categories()
    {
        $this->api->require_method('GET');
        $this->call->model('Category_model');
        $this->api->respond(['data' => $this->Category_model->all_with_counts()]);
    }

    public function category_create()
    {
        $this->api->require_method('POST');
        $this->call->model('Category_model');
        $data = $this->category_input();
        $id = $this->Category_model->insert($data);
        $this->api->respond(['message' => 'Category added.', 'data' => $this->Category_model->find((int) $id)], 201);
    }

    public function category_update($id)
    {
        $this->api->require_method('PUT');
        $this->call->model('Category_model');
        if (!$this->Category_model->find((int) $id)) {
            $this->api->respond_error('Category not found.', 404);
        }
        $this->Category_model->update((int) $id, $this->category_input((int) $id));
        $this->api->respond(['message' => 'Category saved.', 'data' => $this->Category_model->find((int) $id)]);
    }

    public function category_delete($id)
    {
        $this->api->require_method('DELETE');
        $this->call->model(['Category_model', 'Product_model']);
        $category = $this->Category_model->find((int) $id);
        if (!$category) {
            $this->api->respond_error('Category not found.', 404);
        }
        $count = $this->Product_model->count_in_category((int) $id);
        if ($count > 0) {
            $this->api->respond_error("{$category['name']} still has {$count} product(s). Move or delete them first.", 409);
        }
        $this->Category_model->delete((int) $id);
        $this->api->respond(['message' => "{$category['name']} was deleted."]);
    }

    private function category_input(?int $id = null): array
    {
        $in = $this->api->body();
        $this->validate($in, [
            'name|Name'                => 'required|max_length[100]',
            'sort_order|Display order' => 'greater_than_equal_to[0]|pattern[int]',
        ]);
        $slug = slugify($in['name']);
        if ($this->Category_model->slug_taken($slug, $id)) {
            $this->fail_validation(['name' => 'A category with this name already exists.']);
        }
        return ['name' => $in['name'], 'slug' => $slug, 'sort_order' => (int) ($in['sort_order'] ?? 0)];
    }

    public function slots()
    {
        $this->api->require_method('GET');
        $in = array_merge([
            'from' => date('Y-m-d'),
            'to'   => date('Y-m-d', strtotime('+6 days')),
        ], array_filter($this->api->get_query_params(), function ($v) { return $v !== ''; }));
        $this->validate($in, [
            'from|From'               => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'to|To'                   => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'fulfillment|Fulfillment' => 'in_list["pickup,delivery"]',
        ]);
        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $this->api->respond([
            'data'          => $this->Slot_model->between($in['from'], $in['to'], ($in['fulfillment'] ?? '') ?: null),
            'blocked_dates' => $this->Slot_model->blocked_dates(date('Y-m-d')),
        ]);
    }

    public function slots_generate()
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        $this->validate($in, [
            'from|From'                    => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'to|To'                        => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'times|Time windows'           => 'required|pattern[array]',
            'duration_minutes|Slot length' => 'required|greater_than_equal_to[15]|pattern[int]',
            'capacity|Capacity'            => 'required|greater_than_equal_to[1]|pattern[int]',
            'fulfillment|Fulfillment'      => 'required|in_list["pickup,delivery,both"]',
            'skip_weekdays|Skip weekdays'  => 'pattern[array]',
        ]);
        if ($in['to'] < $in['from']) {
            $this->fail_validation(['to' => 'End date must be on or after the start date.']);
        }
        if ((strtotime($in['to']) - strtotime($in['from'])) / 86400 > 92) {
            $this->fail_validation(['to' => 'Create at most 3 months of slots at a time.']);
        }
        $windows = [];
        foreach ($in['times'] as $t) {
            if (!is_string($t) || !preg_match('/^' . self::TIME_PATTERN . '$/', $t) || strlen($t) !== 5) {
                $this->fail_validation(['times' => '"' . (is_scalar($t) ? $t : '') . '" is not a time like 09:00.']);
            }
            $start = strtotime("2000-01-01 {$t}");
            $end = $start + (int) $in['duration_minutes'] * 60;
            if (date('Y-m-d', $end) !== '2000-01-01') {
                $this->fail_validation(['times' => "A slot starting at {$t} would end after midnight."]);
            }
            $windows[] = ['start' => date('H:i:s', $start), 'end' => date('H:i:s', $end)];
        }
        $types = $in['fulfillment'] === 'both' ? ['pickup', 'delivery'] : [$in['fulfillment']];
        $skip = array_map('intval', (array) ($in['skip_weekdays'] ?? []));

        $this->call->model('Slot_model');
        $created = $this->Slot_model->generate($in['from'], $in['to'], $windows, $types, (int) $in['capacity'], $skip);
        $this->api->respond(['message' => "{$created} slot(s) created. Existing slots were kept.", 'created' => $created], 201);
    }

    public function slot_update($id)
    {
        $this->api->require_method('PUT');
        $this->call->model('Slot_model');
        $slot = $this->Slot_model->find((int) $id);
        if (!$slot) {
            $this->api->respond_error('Slot not found.', 404);
        }
        $in = $this->api->body();
        $this->validate($in, [
            'capacity|Capacity'     => 'greater_than_equal_to[0]|pattern[int]',
            'is_blocked|Is blocked' => 'in_list["0,1,true,false"]',
            'start_time|Start time' => ['', self::TIME_PATTERN],
            'end_time|End time'     => ['', self::TIME_PATTERN],
        ]);
        $data = [];
        if (isset($in['capacity'])) {
            if ((int) $in['capacity'] < (int) $slot['booked_count']) {
                $this->fail_validation(['capacity' => "This slot already has {$slot['booked_count']} booking(s); capacity cannot be lower."]);
            }
            $data['capacity'] = (int) $in['capacity'];
        }
        if (isset($in['is_blocked'])) {
            $data['is_blocked'] = (int) $this->request->boolean('is_blocked');
        }
        if (!empty($in['start_time']) || !empty($in['end_time'])) {
            $start = $in['start_time'] ?? substr($slot['start_time'], 0, 5);
            $end = $in['end_time'] ?? substr($slot['end_time'], 0, 5);
            if ($end <= $start) {
                $this->fail_validation(['end_time' => 'End time must be after the start time.']);
            }
            $data['start_time'] = $start;
            $data['end_time'] = $end;
        }
        if (!$data) {
            $this->api->respond_error('Nothing to change.', 422);
        }
        try {
            $this->Slot_model->update((int) $id, $data);
        } catch (PDOException $e) {
            $this->api->respond_error('Another slot already starts at that time on this date.', 409);
        }
        $this->api->respond(['message' => 'Slot saved.', 'data' => $this->Slot_model->cast($this->Slot_model->find((int) $id))]);
    }

    public function slot_delete($id)
    {
        $this->api->require_method('DELETE');
        $this->call->model(['Slot_model', 'Order_model']);
        $slot = $this->Slot_model->find((int) $id);
        if (!$slot) {
            $this->api->respond_error('Slot not found.', 404);
        }
        if ($this->Order_model->count_for_slot((int) $id) > 0) {
            $this->api->respond_error('This slot has orders, so it cannot be deleted. Block it instead.', 409);
        }
        $this->Slot_model->delete((int) $id);
        $this->api->respond(['message' => 'Slot deleted.']);
    }

    public function block_date()
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        $this->validate($in, [
            'date|Date'       => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'blocked|Blocked' => 'required|in_list["0,1,true,false"]',
        ]);
        $this->call->model('Slot_model');
        $blocked = (int) $this->request->boolean('blocked');
        $changed = $this->Slot_model->set_date_blocked($in['date'], $blocked);
        if (!$this->Slot_model->count_on_date($in['date'])) {
            $this->api->respond_error('There are no slots on that date to block. Create slots first.', 422);
        }
        $this->api->respond([
            'message'       => $blocked ? "{$in['date']} is now closed." : "{$in['date']} is open again.",
            'changed'       => $changed,
            'blocked_dates' => $this->Slot_model->blocked_dates(date('Y-m-d')),
        ]);
    }

    public function payments()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $filters = ['status' => $q['status'] ?? null, 'method' => $q['method'] ?? null, 'q' => $q['q'] ?? null];
        $this->call->model('Payment_model');
        $page = $this->paginate($this->Payment_model->admin_count($filters), 20);
        $this->api->respond([
            'data'    => $this->Payment_model->admin_search($filters, $page['per_page'], $page['offset']),
            'meta'    => $this->page_meta($page),
            'summary' => $this->Payment_model->summary(),
        ]);
    }

    public function notifications()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $filters = [
            'channel'  => $q['channel'] ?? null,
            'status'   => $q['status'] ?? null,
            'event'    => $q['event'] ?? null,
            'order_id' => $q['order_id'] ?? null,
        ];
        $this->call->model('Notification_model');
        $page = $this->paginate($this->Notification_model->admin_count($filters), 30);
        $this->api->respond([
            'data' => $this->Notification_model->admin_search($filters, $page['per_page'], $page['offset']),
            'meta' => $this->page_meta($page),
        ]);
    }

    public function notification_resend($id)
    {
        $this->api->require_method('POST');
        $this->call->model('Notification_model');
        $row = $this->Notification_model->find((int) $id);
        if (!$row) {
            $this->api->respond_error('Message not found.', 404);
        }
        if ($row['event'] === 'password_reset') {
            $this->api->respond_error('Password reset links cannot be sent again. Ask the customer to use Forgot password.', 409);
        }
        $this->call->library('notifier');
        $result = $this->notifier->resend($row);
        $messages = [
            'failed' => 'Sending failed again: ' . $result['error'],
            'logged' => 'Logged again (test mode: no email or SMS account is set up).',
            'sent'   => 'Message sent again.',
        ];
        $this->api->respond(['message' => $messages[$result['status']], 'data' => $result]);
    }
}
