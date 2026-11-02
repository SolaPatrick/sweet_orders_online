<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Order_model extends Model
{
    protected $table = 'orders';
    protected $fillable = [
        'order_number', 'user_id', 'slot_id', 'fulfillment', 'delivery_address', 'contact_phone',
        'subtotal', 'delivery_fee', 'total', 'status', 'payment_status', 'notes', 'allergy_note',
        'address_street', 'address_barangay', 'address_city', 'address_landmark', 'zone_id',
        'recipient_name', 'recipient_phone', 'occasion', 'pickup_name', 'pickup_phone', 'claim_code',
        'prepared_by', 'prepared_at', 'cancel_reason', 'refund_amount', 'refund_reference', 'refunded_at',
    ];

    public const LATE_PAYMENT_NOTE = 'Paid after hold expired; slot was full, needs a new slot';

    public const STOCK_SHORT_NOTE = 'Paid but ready-made stock ran out';

    public const NEXT_STATUS = [
        'pending_payment'  => ['cancelled'],
        'paid'             => ['preparing', 'cancelled'],
        'preparing'        => ['ready', 'out_for_delivery', 'cancelled'],
        'ready'            => ['completed', 'out_for_delivery'],
        'out_for_delivery' => ['completed'],
        'completed'        => [],
        'cancelled'        => [],
    ];

    public function next_order_number(): string
    {
        $prefix = 'SO-' . date('Ymd') . '-';
        $last = $this->db->table('orders')
            ->select('order_number')
            ->like('order_number', $prefix . '%')
            ->order_by('order_number', 'DESC')
            ->limit(1)
            ->get();
        $n = $last ? (int) substr($last['order_number'], -4) + 1 : 1;
        return $prefix . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    public function create_with_items(array $order, array $lines): int
    {
        $order_id = null;
        for ($try = 0; $try < 5 && !$order_id; $try++) {
            $order['order_number'] = $this->next_order_number();
            try {
                $this->db->table('orders')->insert($order);
                $order_id = (int) $this->db->last_id();
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'uq_orders_number') === false && strpos($e->getMessage(), 'Duplicate') === false) {
                    throw $e;
                }
            }
        }
        if (!$order_id) {
            throw new RuntimeException('Could not create an order number.');
        }

        foreach ($lines as $line) {
            $options = $line['options'];
            unset($line['options']);
            $line['order_id'] = $order_id;
            $this->db->table('order_items')->insert($line);
            $item_id = (int) $this->db->last_id();
            foreach ($options as $opt) {
                $this->db->table('order_item_options')->insert([
                    'order_item_id'     => $item_id,
                    'product_option_id' => $opt['id'],
                    'option_group'      => $opt['option_group'],
                    'option_name'       => $opt['name'],
                    'price_add'         => $opt['price_add'],
                ]);
            }
        }
        return $order_id;
    }

    private function base_query()
    {
        return $this->db->table('orders o')
            ->select('o.id, o.order_number, o.user_id, o.slot_id, o.fulfillment, o.delivery_address, o.contact_phone,
                      o.subtotal, o.delivery_fee, o.total, o.status, o.payment_status, o.stock_taken, o.notes, o.allergy_note, o.created_at, o.updated_at,
                      o.address_street, o.address_barangay, o.address_city, o.address_landmark, o.zone_id,
                      o.recipient_name, o.recipient_phone, o.occasion, o.pickup_name, o.pickup_phone, o.claim_code,
                      o.prepared_by, o.prepared_at, o.cancel_reason, o.refund_amount, o.refund_reference, o.refunded_at,
                      s.slot_date, s.start_time, s.end_time,
                      u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                      pu.name AS prepared_by_name')
            ->inner_join('delivery_slots s', 's.id = o.slot_id')
            ->inner_join('users u', 'u.id = o.user_id')
            ->left_join('users pu', 'pu.id = o.prepared_by');
    }

    private function list_rows(?int $limit = null, int $offset = 0): array
    {
        $this->db->order_by('CONCAT(o.created_at, 1000000000 + o.id)', 'DESC');
        if ($limit !== null) {
            $this->db->limit($limit, $offset);
        }
        $rows = $this->db->get_all();
        if (!$rows) {
            return [];
        }
        $ids = array_column($rows, 'id');
        $counts = $this->db->table('order_items')
            ->select('order_id')
            ->select_sum('quantity', 'n')
            ->in('order_id', $ids)
            ->group_by('order_id')
            ->get_all(PDO::FETCH_KEY_PAIR);
        $methods = [];
        foreach ($this->db->table('payments')->select('order_id, method')->in('order_id', $ids)->order_by('id', 'DESC')->get_all() as $p) {
            if (!array_key_exists($p['order_id'], $methods)) {
                $methods[$p['order_id']] = $p['method'];
            }
        }
        $flagged = [];
        $short = [];
        foreach ($this->db->table('order_status_history')
            ->select('order_id, note')
            ->in('order_id', $ids)
            ->in('note', [self::LATE_PAYMENT_NOTE, self::STOCK_SHORT_NOTE])
            ->get_all() as $h) {
            if ($h['note'] === self::LATE_PAYMENT_NOTE) {
                $flagged[] = $h['order_id'];
            } else {
                $short[] = $h['order_id'];
            }
        }
        return array_map(function ($o) use ($counts, $methods, $flagged, $short) {
            $open = !in_array($o['status'], ['completed', 'cancelled'], true);
            $o['item_count'] = (int) ($counts[$o['id']] ?? 0);
            $o['payment_method'] = $methods[$o['id']] ?? null;
            $o['needs_new_slot'] = in_array($o['id'], $flagged) && $open;
            $o['stock_short'] = in_array($o['id'], $short) && $open;
            return $this->cast($o);
        }, $rows);
    }

    public function needing_new_slot(): array
    {
        return $this->flagged_open(self::LATE_PAYMENT_NOTE);
    }

    public function needing_stock(): array
    {
        return $this->flagged_open(self::STOCK_SHORT_NOTE);
    }

    private function flagged_open(string $note): array
    {
        $ids = $this->db->table('order_status_history h')
            ->select('h.order_id')
            ->inner_join('orders o', 'o.id = h.order_id')
            ->where('h.note', $note)
            ->not_in('o.status', ['completed', 'cancelled'])
            ->get_all(PDO::FETCH_COLUMN);
        if (!$ids) {
            return [];
        }
        $this->base_query()->in('o.id', array_values(array_unique($ids)));
        return $this->list_rows();
    }

    public function count_unpaid_for_user(int $user_id): int
    {
        return (int) $this->db->table('orders')
            ->where('user_id', $user_id)
            ->where('status', 'pending_payment')
            ->where('payment_status', '<>', 'paid')
            ->count();
    }

    public function add_history(int $order_id, ?string $from, string $to, $changed_by = null, ?string $note = null): void
    {
        $this->db->table('order_status_history')->insert([
            'order_id'    => $order_id,
            'from_status' => $from,
            'to_status'   => $to,
            'changed_by'  => $changed_by ? (int) $changed_by : null,
            'note'        => $note !== null && $note !== '' ? mb_substr($note, 0, 255) : null,
        ]);
    }

    public function history(int $order_id): array
    {
        $rows = $this->db->table('order_status_history h')
            ->select('h.id, h.from_status, h.to_status, h.changed_by, h.note, h.created_at, u.name AS changed_by_name, u.role AS changed_by_role')
            ->left_join('users u', 'u.id = h.changed_by')
            ->where('h.order_id', $order_id)
            ->order_by('h.id')
            ->get_all();
        return array_map(function ($h) {
            $h['id'] = (int) $h['id'];
            $h['changed_by'] = $h['changed_by'] !== null ? (int) $h['changed_by'] : null;
            return $h;
        }, $rows);
    }

    public function for_user(int $user_id, string $scope = 'all'): array
    {
        $this->base_query()->where('o.user_id', $user_id);
        if ($scope === 'active') {
            $this->db->not_in('o.status', ['completed', 'cancelled']);
        } elseif ($scope === 'past') {
            $this->db->in('o.status', ['completed', 'cancelled']);
        }
        return $this->list_rows();
    }

    public function admin_count(array $f): int
    {
        $this->db->table('orders o')
            ->select_count('*', 'n')
            ->inner_join('delivery_slots s', 's.id = o.slot_id')
            ->inner_join('users u', 'u.id = o.user_id');
        $this->admin_filters($f);
        return (int) $this->db->get()['n'];
    }

    public function admin_search(array $f, int $limit, int $offset): array
    {
        $this->base_query();
        $this->admin_filters($f);
        return $this->list_rows($limit, $offset);
    }

    private function admin_filters(array $f): void
    {
        if (!empty($f['status'])) {
            $this->db->where('o.status', $f['status']);
        }
        if (!empty($f['date'])) {
            $this->db->where('s.slot_date', $f['date']);
        }
        if (!empty($f['fulfillment'])) {
            $this->db->where('o.fulfillment', $f['fulfillment']);
        }
        if (!empty($f['q'])) {
            $like = '%' . $f['q'] . '%';
            $this->db->grouped(function ($db) use ($like) {
                $db->like('o.order_number', $like)->or_like('u.name', $like)
                   ->or_like('u.email', $like)->or_like('o.contact_phone', $like);
            });
        }
    }

    public function status_counts(): array
    {
        $rows = $this->db->table('orders')->select('status')->select_count('*', 'n')->group_by('status')->get_all();
        $out = ['all' => 0];
        foreach ($rows as $r) {
            $out[$r['status']] = (int) $r['n'];
            $out['all'] += (int) $r['n'];
        }
        return $out;
    }

    public function count_created_on(string $date): int
    {
        return (int) $this->db->table('orders')->where('DATE(created_at)', $date)->count();
    }

    public function count_with_status(array $statuses): int
    {
        return (int) $this->db->table('orders')->in('status', $statuses)->count();
    }

    public function count_for_slot(int $slot_id): int
    {
        return (int) $this->db->table('orders')->where('slot_id', $slot_id)->count();
    }

    public function detail(int $id, bool $with_notifications = false)
    {
        $this->base_query()->where('o.id', $id);
        $order = $this->list_rows(1)[0] ?? null;
        if (!$order) return null;

        $items = $this->db->table('order_items')->where('order_id', $id)->order_by('id')->get_all();
        $item_ids = array_column($items, 'id');
        $options = [];
        if ($item_ids) {
            $rows = $this->db->table('order_item_options')->in('order_item_id', $item_ids)->get_all();
            $group_order = ['size' => 1, 'flavor' => 2, 'frosting' => 3];
            usort($rows, function ($a, $b) use ($group_order) {
                return [$group_order[$a['option_group']] ?? 0, (int) $a['id']] <=> [$group_order[$b['option_group']] ?? 0, (int) $b['id']];
            });
            foreach ($rows as $o) {
                $options[$o['order_item_id']][] = [
                    'option_group' => $o['option_group'],
                    'option_name'  => $o['option_name'],
                    'price_add'    => (float) $o['price_add'],
                ];
            }
        }
        $option_ids = [];
        foreach ($rows ?? [] as $o) {
            if ($o['product_option_id'] !== null) {
                $option_ids[$o['order_item_id']][] = (int) $o['product_option_id'];
            }
        }
        $this->call->model('Allergen_model');
        $by_product = $this->Allergen_model->for_products(array_column($items, 'product_id'));
        $by_option = $this->Allergen_model->for_options(array_merge([], ...array_values($option_ids)));
        $line_allergens = function ($i) use ($by_product, $by_option, $option_ids) {
            $ids = $by_product[(int) $i['product_id']] ?? [];
            foreach ($option_ids[$i['id']] ?? [] as $oid) {
                $ids = array_merge($ids, $by_option[$oid] ?? []);
            }
            return $this->Allergen_model->pick(array_values(array_unique($ids)));
        };
        $order['items'] = array_map(function ($i) use ($options, $line_allergens) {
            return [
                'id'           => (int) $i['id'],
                'product_id'   => $i['product_id'] !== null ? (int) $i['product_id'] : null,
                'product_name' => $i['product_name'],
                'unit_price'   => (float) $i['unit_price'],
                'quantity'     => (int) $i['quantity'],
                'line_total'   => (float) $i['line_total'],
                'cake_message' => $i['cake_message'],
                'notes'        => $i['notes'],
                'options'      => $options[$i['id']] ?? [],
                'allergens'    => $line_allergens($i),
            ];
        }, $items);

        $order['payments'] = array_map(function ($p) {
            $p['id'] = (int) $p['id'];
            $p['order_id'] = (int) $p['order_id'];
            $p['amount'] = (float) $p['amount'];
            return $p;
        }, $this->db->table('payments')->where('order_id', $id)->order_by('id', 'DESC')->get_all());

        if ($with_notifications) {
            $order['notifications'] = $this->db->table('notifications_log')
                ->select('id, channel, event, recipient, subject, status, error, created_at')
                ->where('order_id', $id)
                ->order_by('id')
                ->get_all();
        }
        $order['history'] = $this->history($id);
        $order['reviews'] = array_map(function ($r) {
            foreach (['id', 'product_id', 'rating', 'is_visible'] as $k) {
                $r[$k] = (int) $r[$k];
            }
            return $r;
        }, $this->db->table('reviews')
            ->select('id, product_id, rating, comment, is_visible, created_at, updated_at')
            ->where('order_id', $id)
            ->order_by('id')
            ->get_all());
        $order['next_statuses'] = self::NEXT_STATUS[$order['status']] ?? [];
        $order['hold_expires_at'] = $order['status'] === 'pending_payment'
            ? date('Y-m-d H:i:s', strtotime($order['created_at']) + order_hold_minutes() * 60)
            : null;
        return $order;
    }

    public function set_status(int $id, string $status, ?string $payment_status = null, array $extra = []): void
    {
        $data = array_merge(['status' => $status], $extra);
        if ($payment_status) {
            $data['payment_status'] = $payment_status;
        }
        $this->db->table('orders')->where('id', $id)->update($data);
    }

    public function change_status(array $order, string $status, $changed_by = null, ?string $note = null, array $extra = []): void
    {
        $this->set_status((int) $order['id'], $status, null, $extra);
        $this->add_history((int) $order['id'], $order['status'], $status, $changed_by, $note);
    }

    public function cast(array $o): array
    {
        foreach (['id', 'user_id', 'slot_id', 'item_count', 'zone_id', 'prepared_by', 'stock_taken'] as $k) {
            if (isset($o[$k])) $o[$k] = (int) $o[$k];
        }
        foreach (['subtotal', 'delivery_fee', 'total'] as $k) {
            $o[$k] = (float) $o[$k];
        }
        if (isset($o['refund_amount'])) {
            $o['refund_amount'] = (float) $o['refund_amount'];
        }
        if (isset($o['start_time'])) {
            $o['start_time'] = substr($o['start_time'], 0, 5);
            $o['end_time'] = substr($o['end_time'], 0, 5);
        }
        return $o;
    }
}
