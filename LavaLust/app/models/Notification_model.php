<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** notifications_log table: every email and SMS the system sends. */
class Notification_model extends Model
{
    protected $table = 'notifications_log';
    protected $fillable = ['order_id', 'user_id', 'channel', 'event', 'recipient', 'subject', 'message', 'status', 'error'];

    /** A9 Notification log. Returns [rows, total]. */
    public function admin_search(array $f, int $limit, int $offset): array
    {
        $where = ['1 = 1'];
        $args = [];
        foreach (['channel', 'status', 'event'] as $k) {
            if (!empty($f[$k])) {
                $where[] = "n.{$k} = ?";
                $args[] = $f[$k];
            }
        }
        if (!empty($f['order_id'])) {
            $where[] = 'n.order_id = ?';
            $args[] = (int) $f['order_id'];
        }
        $w = implode(' AND ', $where);
        $from = 'FROM notifications_log n LEFT JOIN orders o ON o.id = n.order_id';
        $total = (int) $this->db->raw("SELECT COUNT(*) {$from} WHERE {$w}", $args)->fetchColumn();
        $rows = $this->db->raw(
            "SELECT n.*, o.order_number {$from} WHERE {$w}
             ORDER BY n.created_at DESC, n.id DESC LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $args
        )->fetchAll();
        return [$rows, $total];
    }
}
