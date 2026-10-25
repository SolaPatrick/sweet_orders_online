<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** delivery_slots table: pickup and delivery time slots with capacity. */
class Slot_model extends Model
{
    protected $table = 'delivery_slots';
    protected $fillable = ['slot_date', 'start_time', 'end_time', 'fulfillment', 'capacity', 'booked_count', 'is_blocked'];

    /**
     * Cancels unpaid orders whose hold ran out and gives their slot back.
     * Runs before any slot or order list is read.
     */
    public function release_expired_holds(): int
    {
        $expired = $this->db->raw(
            "SELECT id, slot_id FROM orders
             WHERE status = 'pending_payment' AND payment_status <> 'paid'
               AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
            [order_hold_minutes()]
        )->fetchAll();

        foreach ($expired as $order) {
            $this->db->transaction();
            $changed = $this->db->raw(
                "UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending_payment'",
                [$order['id']]
            )->rowCount();
            if ($changed) {
                $this->release_one((int) $order['slot_id']);
                $this->db->raw("UPDATE payments SET status = 'expired' WHERE order_id = ? AND status = 'pending'", [$order['id']]);
            }
            $this->db->commit();
        }
        return count($expired);
    }

    /** Takes one place in a slot. False when the slot is full, blocked or missing. */
    public function book_one(int $slot_id): bool
    {
        return $this->db->raw(
            'UPDATE delivery_slots SET booked_count = booked_count + 1
             WHERE id = ? AND is_blocked = 0 AND booked_count < capacity',
            [$slot_id]
        )->rowCount() === 1;
    }

    public function release_one(int $slot_id): void
    {
        $this->db->raw(
            'UPDATE delivery_slots SET booked_count = GREATEST(booked_count - 1, 0) WHERE id = ?',
            [$slot_id]
        );
    }

    /** Slots for one date and type, with how many places are left. */
    public function for_date(string $date, ?string $fulfillment = null): array
    {
        $sql = 'SELECT * FROM delivery_slots WHERE slot_date = ?';
        $args = [$date];
        if ($fulfillment) {
            $sql .= ' AND fulfillment = ?';
            $args[] = $fulfillment;
        }
        $sql .= ' ORDER BY start_time, fulfillment';
        return array_map([$this, 'cast'], $this->db->raw($sql, $args)->fetchAll());
    }

    public function between(string $from, string $to, ?string $fulfillment = null): array
    {
        $sql = 'SELECT * FROM delivery_slots WHERE slot_date BETWEEN ? AND ?';
        $args = [$from, $to];
        if ($fulfillment) {
            $sql .= ' AND fulfillment = ?';
            $args[] = $fulfillment;
        }
        $sql .= ' ORDER BY slot_date, start_time, fulfillment';
        return array_map([$this, 'cast'], $this->db->raw($sql, $args)->fetchAll());
    }

    /**
     * Per-date summary from today on: open places, and whether the whole
     * date is blocked.
     */
    public function date_summary(string $from, string $to, ?string $fulfillment = null): array
    {
        $sql = 'SELECT slot_date,
                       COUNT(*) AS slots,
                       SUM(is_blocked = 0 AND booked_count < capacity) AS open_slots,
                       SUM(CASE WHEN is_blocked = 0 THEN GREATEST(capacity - booked_count, 0) ELSE 0 END) AS places_left,
                       MIN(is_blocked) AS all_blocked
                FROM delivery_slots
                WHERE slot_date BETWEEN ? AND ?';
        $args = [$from, $to];
        if ($fulfillment) {
            $sql .= ' AND fulfillment = ?';
            $args[] = $fulfillment;
        }
        $sql .= ' GROUP BY slot_date ORDER BY slot_date';
        return array_map(function ($r) {
            return [
                'date'        => $r['slot_date'],
                'slots'       => (int) $r['slots'],
                'open_slots'  => (int) $r['open_slots'],
                'places_left' => (int) $r['places_left'],
                'blocked'     => (bool) (int) $r['all_blocked'],
            ];
        }, $this->db->raw($sql, $args)->fetchAll());
    }

    public function blocked_dates(string $from): array
    {
        return $this->db->raw(
            'SELECT slot_date FROM delivery_slots WHERE slot_date >= ?
             GROUP BY slot_date HAVING MIN(is_blocked) = 1 ORDER BY slot_date',
            [$from]
        )->fetchAll(PDO::FETCH_COLUMN);
    }

    public function set_date_blocked(string $date, int $blocked): int
    {
        return $this->db->raw('UPDATE delivery_slots SET is_blocked = ? WHERE slot_date = ?', [$blocked, $date])->rowCount();
    }

    /** Creates slots for every date in range; skips ones that already exist. */
    public function generate(string $from, string $to, array $windows, array $types, int $capacity, array $skip_weekdays = []): int
    {
        $created = 0;
        $date = new DateTime($from);
        $end = new DateTime($to);
        while ($date <= $end) {
            if (!in_array((int) $date->format('w'), $skip_weekdays, true)) {
                foreach ($windows as $w) {
                    foreach ($types as $type) {
                        $created += $this->db->raw(
                            'INSERT IGNORE INTO delivery_slots (slot_date, start_time, end_time, fulfillment, capacity)
                             VALUES (?, ?, ?, ?, ?)',
                            [$date->format('Y-m-d'), $w['start'], $w['end'], $type, $capacity]
                        )->rowCount();
                    }
                }
            }
            $date->modify('+1 day');
        }
        return $created;
    }

    public function cast(array $s): array
    {
        foreach (['id', 'capacity', 'booked_count', 'is_blocked'] as $k) {
            $s[$k] = (int) $s[$k];
        }
        $s['start_time'] = substr($s['start_time'], 0, 5);
        $s['end_time'] = substr($s['end_time'], 0, 5);
        $s['places_left'] = max(0, $s['capacity'] - $s['booked_count']);
        $s['is_full'] = $s['places_left'] === 0;
        return $s;
    }
}
