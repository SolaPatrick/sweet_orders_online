<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Addon_model extends Model
{
    protected $table = 'addons';
    protected $fillable = ['name', 'price', 'has_text', 'is_active', 'sort_order'];

    public function listing(bool $active_only = false): array
    {
        $this->db->table($this->table);
        if ($active_only) {
            $this->db->where('is_active', 1);
        }
        $rows = array_map([$this, 'cast'], $this->db->order_by('sort_order')->order_by('id')->get_all());
        return $rows;
    }

    public function active_by_id(): array
    {
        return array_column($this->listing(true), null, 'id');
    }

    public function name_taken(string $name, $except_id = null): bool
    {
        return (bool) $this->db->table($this->table)
            ->select('id')
            ->where('name', $name)
            ->where('id', '<>', (int) $except_id)
            ->limit(1)
            ->get();
    }

    public function cast(array $a): array
    {
        foreach (['id', 'has_text', 'is_active', 'sort_order'] as $k) {
            $a[$k] = (int) $a[$k];
        }
        $a['price'] = (float) $a['price'];
        return $a;
    }
}
