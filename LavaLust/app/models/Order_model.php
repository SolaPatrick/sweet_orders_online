<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** orders, order_items and order_item_options tables. */
class Order_model extends Model
{
    protected $table = 'orders';
    protected $fillable = [
        'order_number', 'user_id', 'slot_id', 'fulfillment', 'delivery_address', 'contact_phone',
        'subtotal', 'delivery_fee', 'total', 'status', 'payment_status', 'notes',
    ];

    /** Status changes staff may make from each status (A3 Order details). */
    public const NEXT_STATUS = [
        'pending_payment'  => ['cancelled'],
        'paid'             => ['preparing', 'cancelled'],
        'preparing'        => ['ready', 'out_for_delivery', 'cancelled'],
        'ready'            => ['completed', 'out_for_delivery'],
        'out_for_delivery' => ['completed'],
        'completed'        => [],
        'cancelled'        => [],
    ];

    /** SO-YYYYMMDD-NNNN, numbered per day. */
    public function next_order_number(): string
    {
        $prefix = 'SO-' . date('Ymd') . '-';
        $last = $this->db->raw(
            'SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1',
            [$prefix . '%']
        )->fetchColumn();
        $n = $last ? (int) substr($last, -4) + 1 : 1;
        return $prefix . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Saves the order and its lines. Call inside a transaction.
     * $lines: [{product_id, product_name, unit_price, quantity, line_total, cake_message, notes, options: [...]}]
     */
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

    private function base_select(): string
    {
        return 'SELECT o.*, s.slot_date, s.start_time, s.end_time,
                       u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                       (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                       (SELECT p.method FROM payments p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS payment_method
                FROM orders o
                JOIN delivery_slots s ON s.id = o.slot_id
                JOIN users u ON u.id = o.user_id';
    }

    public function for_user(int $user_id, string $scope = 'all'): array
    {
        $sql = $this->base_select() . ' WHERE o.user_id = ?';
        if ($scope === 'active') {
            $sql .= " AND o.status NOT IN ('completed', 'cancelled')";
        } elseif ($scope === 'past') {
            $sql .= " AND o.status IN ('completed', 'cancelled')";
        }
        $sql .= ' ORDER BY o.created_at DESC, o.id DESC';
        return array_map([$this, 'cast'], $this->db->raw($sql, [$user_id])->fetchAll());
    }

    /** A2 Orders: filter by status, slot date, type and search text. Returns [rows, total]. */
    public function admin_search(array $f, int $limit, int $offset): array
    {
        $where = ['1 = 1'];
        $args = [];
        if (!empty($f['status'])) {
            $where[] = 'o.status = ?';
            $args[] = $f['status'];
        }
        if (!empty($f['date'])) {
            $where[] = 's.slot_date = ?';
            $args[] = $f['date'];
        }
        if (!empty($f['fulfillment'])) {
            $where[] = 'o.fulfillment = ?';
            $args[] = $f['fulfillment'];
        }
        if (!empty($f['q'])) {
            $where[] = '(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.contact_phone LIKE ?)';
            $like = '%' . $f['q'] . '%';
            array_push($args, $like, $like, $like, $like);
        }
        $w = implode(' AND ', $where);
        $total = (int) $this->db->raw(
            "SELECT COUNT(*) FROM orders o JOIN delivery_slots s ON s.id = o.slot_id JOIN users u ON u.id = o.user_id WHERE {$w}",
            $args
        )->fetchColumn();
        $rows = $this->db->raw(
            $this->base_select() . " WHERE {$w} ORDER BY o.created_at DESC, o.id DESC LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $args
        )->fetchAll();
        return [array_map([$this, 'cast'], $rows), $total];
    }

    public function status_counts(): array
    {
        $rows = $this->db->raw('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')->fetchAll();
        $out = ['all' => 0];
        foreach ($rows as $r) {
            $out[$r['status']] = (int) $r['n'];
            $out['all'] += (int) $r['n'];
        }
        return $out;
    }

    /** Full order with lines, options, payments and (optionally) notifications. */
    public function detail(int $id, bool $with_notifications = false)
    {
        $order = $this->db->raw($this->base_select() . ' WHERE o.id = ? LIMIT 1', [$id])->fetch();
        if (!$order) return null;
        $order = $this->cast($order);

        $items = $this->db->raw('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [$id])->fetchAll();
        $item_ids = array_column($items, 'id');
        $options = [];
        if ($item_ids) {
            $marks = implode(',', array_fill(0, count($item_ids), '?'));
            foreach ($this->db->raw(
                "SELECT * FROM order_item_options WHERE order_item_id IN ({$marks})
                 ORDER BY FIELD(option_group, 'size', 'flavor', 'frosting'), id",
                $item_ids
            )->fetchAll() as $o) {
                $options[$o['order_item_id']][] = [
                    'option_group' => $o['option_group'],
                    'option_name'  => $o['option_name'],
                    'price_add'    => (float) $o['price_add'],
                ];
            }
        }
        $order['items'] = array_map(function ($i) use ($options) {
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
            ];
        }, $items);

        $order['payments'] = array_map(function ($p) {
            $p['id'] = (int) $p['id'];
            $p['order_id'] = (int) $p['order_id'];
            $p['amount'] = (float) $p['amount'];
            return $p;
        }, $this->db->raw('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC', [$id])->fetchAll());

        if ($with_notifications) {
            $order['notifications'] = $this->db->raw(
                'SELECT id, channel, event, recipient, subject, status, error, created_at
                 FROM notifications_log WHERE order_id = ? ORDER BY id',
                [$id]
            )->fetchAll();
        }
        $order['next_statuses'] = self::NEXT_STATUS[$order['status']] ?? [];
        $order['hold_expires_at'] = $order['status'] === 'pending_payment'
            ? date('Y-m-d H:i:s', strtotime($order['created_at']) + order_hold_minutes() * 60)
            : null;
        return $order;
    }

    public function set_status(int $id, string $status, ?string $payment_status = null): void
    {
        $data = ['status' => $status];
        if ($payment_status) {
            $data['payment_status'] = $payment_status;
        }
        $this->db->table('orders')->where('id', $id)->update($data);
    }

    public function cast(array $o): array
    {
        foreach (['id', 'user_id', 'slot_id', 'item_count'] as $k) {
            if (isset($o[$k])) $o[$k] = (int) $o[$k];
        }
        foreach (['subtotal', 'delivery_fee', 'total'] as $k) {
            $o[$k] = (float) $o[$k];
        }
        if (isset($o['start_time'])) {
            $o['start_time'] = substr($o['start_time'], 0, 5);
            $o['end_time'] = substr($o['end_time'], 0, 5);
        }
        return $o;
    }
}
