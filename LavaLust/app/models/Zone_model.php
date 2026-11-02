<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Zone_model extends Model
{
    protected $table = 'delivery_zones';
    protected $fillable = ['name', 'city', 'psgc_code', 'fee', 'is_active', 'sort_order'];

    public function count_all(): int
    {
        return (int) $this->db->table($this->table)->count();
    }

    public function listing(bool $active_only = false): array
    {
        $this->db->table($this->table);
        if ($active_only) {
            $this->db->where('is_active', 1);
        }
        $rows = array_map([$this, 'cast'], $this->db->get_all());
        usort($rows, function ($a, $b) {
            return place_compare($a['city'], $b['city']) ?: place_compare($a['name'], $b['name']) ?: $a['id'] <=> $b['id'];
        });
        return $rows;
    }

    public function find_by_name(string $name, string $city, $except_id = null)
    {
        return $this->db->table($this->table)
            ->where('name', $name)
            ->where('city', $city)
            ->where('id', '<>', (int) $except_id)
            ->limit(1)
            ->get();
    }

    public function cast(array $z): array
    {
        foreach (['id', 'is_active', 'sort_order'] as $k) {
            $z[$k] = (int) $z[$k];
        }
        $z['fee'] = (float) $z['fee'];
        return $z;
    }
}
