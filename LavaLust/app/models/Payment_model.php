<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** payments table: one row per PayMongo checkout attempt. */
class Payment_model extends Model
{
    protected $table = 'payments';
    protected $fillable = ['order_id', 'provider', 'checkout_session_id', 'reference', 'method', 'amount', 'status', 'paid_at'];

    public function find_by_session(string $session_id)
    {
        return $this->db->table($this->table)->where('checkout_session_id', $session_id)->get();
    }

    public function latest_for_order(int $order_id)
    {
        return $this->db->raw('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [$order_id])->fetch();
    }

    /** A8 Payments list. Returns [rows, total]. */
    public function admin_search(array $f, int $limit, int $offset): array
    {
        $where = ['1 = 1'];
        $args = [];
        if (!empty($f['status'])) {
            $where[] = 'p.status = ?';
            $args[] = $f['status'];
        }
        if (!empty($f['method'])) {
            $where[] = 'p.method = ?';
            $args[] = $f['method'];
        }
        if (!empty($f['q'])) {
            $where[] = '(o.order_number LIKE ? OR p.reference LIKE ? OR p.checkout_session_id LIKE ? OR u.name LIKE ?)';
            $like = '%' . $f['q'] . '%';
            array_push($args, $like, $like, $like, $like);
        }
        $w = implode(' AND ', $where);
        $from = 'FROM payments p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = o.user_id';
        $total = (int) $this->db->raw("SELECT COUNT(*) {$from} WHERE {$w}", $args)->fetchColumn();
        $rows = $this->db->raw(
            "SELECT p.*, o.order_number, u.name AS customer_name {$from} WHERE {$w}
             ORDER BY p.created_at DESC, p.id DESC LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $args
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['order_id'] = (int) $r['order_id'];
            $r['amount'] = (float) $r['amount'];
        }
        return [$rows, $total];
    }

    public function summary(): array
    {
        $counts = $this->db->raw('SELECT status, COUNT(*) AS n FROM payments GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
        $week = (float) $this->db->raw(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)"
        )->fetchColumn();
        return [
            'collected_this_week' => $week,
            'paid'    => (int) ($counts['paid'] ?? 0),
            'pending' => (int) ($counts['pending'] ?? 0),
            'failed'  => (int) ($counts['failed'] ?? 0),
            'expired' => (int) ($counts['expired'] ?? 0),
        ];
    }
}
