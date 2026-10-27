<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

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
        return $this->db->table($this->table)->where('order_id', $order_id)->order_by('id', 'DESC')->limit(1)->get();
    }

    public function expire_pending(int $order_id): void
    {
        $this->db->table($this->table)->where('order_id', $order_id)->where('status', 'pending')->update(['status' => 'expired']);
    }

    public function paid_total(string $from, ?string $to = null): float
    {
        $this->db->table($this->table)->select_sum('amount', 'total')
            ->where('status', 'paid')
            ->where('paid_at', '>=', $from . ' 00:00:00');
        if ($to !== null) {
            $this->db->where('paid_at', '<', date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00');
        }
        return (float) ($this->db->get()['total'] ?? 0);
    }

    public function paid_by_day(string $from): array
    {
        return $this->db->table($this->table)
            ->select('DATE(paid_at) AS day')
            ->select_sum('amount', 'total')
            ->where('status', 'paid')
            ->where('paid_at', '>=', $from . ' 00:00:00')
            ->group_by('DATE(paid_at)')
            ->get_all(PDO::FETCH_KEY_PAIR);
    }

    public function admin_count(array $f): int
    {
        $this->from_joined()->select_count('*', 'n');
        $this->filters($f);
        return (int) $this->db->get()['n'];
    }

    public function admin_search(array $f, int $limit, int $offset): array
    {
        $this->from_joined()->select('p.id, p.order_id, p.provider, p.checkout_session_id, p.reference, p.method, p.amount, p.status, p.paid_at, p.created_at, p.updated_at, o.order_number, u.name AS customer_name');
        $this->filters($f);
        $rows = $this->db->order_by('CONCAT(p.created_at, 1000000000 + p.id)', 'DESC')->limit($limit, $offset)->get_all();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['order_id'] = (int) $r['order_id'];
            $r['amount'] = (float) $r['amount'];
        }
        return $rows;
    }

    public function summary(): array
    {
        $counts = $this->db->table($this->table)->select('status')->select_count('*', 'n')->group_by('status')->get_all(PDO::FETCH_KEY_PAIR);
        return [
            'collected_this_week' => $this->paid_total(date('Y-m-d', strtotime('monday this week'))),
            'paid'    => (int) ($counts['paid'] ?? 0),
            'pending' => (int) ($counts['pending'] ?? 0),
            'failed'  => (int) ($counts['failed'] ?? 0),
            'expired' => (int) ($counts['expired'] ?? 0),
        ];
    }

    private function from_joined()
    {
        return $this->db->table('payments p')
            ->inner_join('orders o', 'o.id = p.order_id')
            ->inner_join('users u', 'u.id = o.user_id');
    }

    private function filters(array $f): void
    {
        if (!empty($f['status'])) {
            $this->db->where('p.status', $f['status']);
        }
        if (!empty($f['method'])) {
            $this->db->where('p.method', $f['method']);
        }
        if (!empty($f['q'])) {
            $like = '%' . $f['q'] . '%';
            $this->db->grouped(function ($db) use ($like) {
                $db->like('o.order_number', $like)->or_like('p.reference', $like)
                   ->or_like('p.checkout_session_id', $like)->or_like('u.name', $like);
            });
        }
    }
}
