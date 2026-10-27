<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Slot_model extends Model
{
    protected $table = 'delivery_slots';
    protected $fillable = ['slot_date', 'start_time', 'end_time', 'fulfillment', 'capacity', 'booked_count', 'is_blocked'];

    public function release_expired_holds(): int
    {
        $cutoff = date('Y-m-d H:i:s', time() - order_hold_minutes() * 60);
        $expired = $this->db->table('orders')
            ->select('id, slot_id')
            ->where('status', 'pending_payment')
            ->where('payment_status', '<>', 'paid')
            ->where('created_at', '<', $cutoff)
            ->get_all();

        foreach ($expired as $order) {
            $this->db->transaction();
            $changed = $this->db->table('orders')
                ->where('id', $order['id'])
                ->where('status', 'pending_payment')
                ->update(['status' => 'cancelled']);
            if ($changed) {
                $this->release_one((int) $order['slot_id']);
                $this->db->table('payments')->where('order_id', $order['id'])->where('status', 'pending')->update(['status' => 'expired']);
            }
            $this->db->commit();
        }
        return count($expired);
    }

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
        $this->db->table($this->table)->where('id', $slot_id)->where('booked_count', '>', 0)->decrement('booked_count');
    }

    public function for_date(string $date, ?string $fulfillment = null): array
    {
        $this->db->table($this->table)->where('slot_date', $date);
        if ($fulfillment) {
            $this->db->where('fulfillment', $fulfillment);
        }
        return $this->sorted($this->db->get_all());
    }

    public function between(string $from, string $to, ?string $fulfillment = null): array
    {
        $this->db->table($this->table)->between('slot_date', $from, $to);
        if ($fulfillment) {
            $this->db->where('fulfillment', $fulfillment);
        }
        return $this->sorted($this->db->get_all());
    }

    public function date_summary(string $from, string $to, ?string $fulfillment = null): array
    {
        $this->db->table($this->table)
            ->select('slot_date, capacity, booked_count, is_blocked')
            ->between('slot_date', $from, $to);
        if ($fulfillment) {
            $this->db->where('fulfillment', $fulfillment);
        }
        $days = [];
        foreach ($this->db->get_all() as $s) {
            $d = &$days[$s['slot_date']];
            $d = $d ?? ['date' => $s['slot_date'], 'slots' => 0, 'open_slots' => 0, 'places_left' => 0, 'blocked' => true];
            $open = !(int) $s['is_blocked'];
            $d['slots']++;
            $d['open_slots'] += (int) ($open && $s['booked_count'] < $s['capacity']);
            $d['places_left'] += $open ? max((int) $s['capacity'] - (int) $s['booked_count'], 0) : 0;
            $d['blocked'] = $d['blocked'] && !$open;
            unset($d);
        }
        ksort($days);
        return array_values($days);
    }

    public function blocked_dates(string $from): array
    {
        return $this->db->table($this->table)
            ->select('slot_date')
            ->where('slot_date', '>=', $from)
            ->group_by('slot_date')
            ->having('MIN(is_blocked)', '=', 1)
            ->order_by('slot_date')
            ->get_all(PDO::FETCH_COLUMN);
    }

    public function set_date_blocked(string $date, int $blocked): int
    {
        return $this->db->table($this->table)->where('slot_date', $date)->update(['is_blocked' => $blocked]);
    }

    public function count_on_date(string $date): int
    {
        return (int) $this->db->table($this->table)->where('slot_date', $date)->count();
    }

    public function day_totals(string $date): array
    {
        $booked = $this->db->table($this->table)->select_sum('booked_count', 'n')->where('slot_date', $date)->get();
        $capacity = $this->db->table($this->table)->select_sum('capacity', 'n')->where('slot_date', $date)->where('is_blocked', 0)->get();
        return ['booked' => (int) ($booked['n'] ?? 0), 'capacity' => (int) ($capacity['n'] ?? 0)];
    }

    public function generate(string $from, string $to, array $windows, array $types, int $capacity, array $skip_weekdays = []): int
    {
        $taken = [];
        foreach ($this->db->table($this->table)->select('slot_date, start_time, fulfillment')->between('slot_date', $from, $to)->get_all() as $s) {
            $taken[$s['slot_date'] . ' ' . $s['start_time'] . ' ' . $s['fulfillment']] = true;
        }

        $rows = [];
        $date = new DateTime($from);
        $end = new DateTime($to);
        while ($date <= $end) {
            if (!in_array((int) $date->format('w'), $skip_weekdays, true)) {
                foreach ($windows as $w) {
                    foreach ($types as $type) {
                        $key = $date->format('Y-m-d') . ' ' . $w['start'] . ' ' . $type;
                        if (isset($taken[$key])) {
                            continue;
                        }
                        $taken[$key] = true;
                        $rows[] = [
                            'slot_date'   => $date->format('Y-m-d'),
                            'start_time'  => $w['start'],
                            'end_time'    => $w['end'],
                            'fulfillment' => $type,
                            'capacity'    => $capacity,
                        ];
                    }
                }
            }
            $date->modify('+1 day');
        }
        if ($rows) {
            $this->db->table($this->table)->bulk_insert($rows);
        }
        return count($rows);
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

    private function sorted(array $rows): array
    {
        $type_order = ['pickup' => 1, 'delivery' => 2];
        usort($rows, function ($a, $b) use ($type_order) {
            return [$a['slot_date'], $a['start_time'], $type_order[$a['fulfillment']] ?? 3]
               <=> [$b['slot_date'], $b['start_time'], $type_order[$b['fulfillment']] ?? 3];
        });
        return array_map([$this, 'cast'], $rows);
    }
}
