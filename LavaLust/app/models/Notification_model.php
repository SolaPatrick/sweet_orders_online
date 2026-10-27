<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Notification_model extends Model
{
    protected $table = 'notifications_log';
    protected $fillable = ['order_id', 'user_id', 'channel', 'event', 'recipient', 'subject', 'message', 'status', 'error'];

    public function admin_count(array $f): int
    {
        $this->db->table('notifications_log n')->select_count('*', 'n');
        $this->filters($f);
        return (int) $this->db->get()['n'];
    }

    public function admin_search(array $f, int $limit, int $offset): array
    {
        $this->db->table('notifications_log n')
            ->select('n.id, n.order_id, n.user_id, n.channel, n.event, n.recipient, n.subject, n.message, n.status, n.error, n.created_at, o.order_number')
            ->left_join('orders o', 'o.id = n.order_id');
        $this->filters($f);
        return $this->db->order_by('CONCAT(n.created_at, 1000000000 + n.id)', 'DESC')->limit($limit, $offset)->get_all();
    }

    private function filters(array $f): void
    {
        foreach (['channel', 'status', 'event'] as $k) {
            if (!empty($f[$k])) {
                $this->db->where("n.{$k}", $f[$k]);
            }
        }
        if (!empty($f['order_id'])) {
            $this->db->where('n.order_id', (int) $f['order_id']);
        }
    }
}
