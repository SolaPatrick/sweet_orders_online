<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Allergen_model extends Model
{
    protected $table = 'allergens';

    private $list = null;

    public function all(): array
    {
        if ($this->list === null) {
            $this->list = array_map(function ($a) {
                return ['id' => (int) $a['id'], 'name' => $a['name'], 'slug' => $a['slug']];
            }, $this->db->table($this->table)->order_by('sort_order')->order_by('id')->get_all());
        }
        return $this->list;
    }

    public function clean_ids($ids): array
    {
        $valid = array_column($this->all(), 'id');
        $ids = array_map('intval', is_array($ids) ? $ids : explode(',', (string) $ids));
        return array_values(array_intersect($valid, array_unique($ids)));
    }

    public function pick(array $ids): array
    {
        return array_values(array_filter($this->all(), function ($a) use ($ids) {
            return in_array($a['id'], $ids, true);
        }));
    }

    public function for_products(array $ids): array
    {
        return $this->link_map('product_allergens', 'product_id', $ids);
    }

    public function for_options(array $ids): array
    {
        return $this->link_map('option_allergens', 'product_option_id', $ids);
    }

    public function products_with(array $allergen_ids): array
    {
        if (!$allergen_ids) {
            return [];
        }
        return array_map('intval', $this->db->table('product_allergens')
            ->select('product_id')
            ->in('allergen_id', $allergen_ids)
            ->get_all(PDO::FETCH_COLUMN));
    }

    public function set_for_product(int $product_id, array $ids): void
    {
        $this->replace_links('product_allergens', 'product_id', $product_id, $ids);
    }

    public function set_for_option(int $option_id, array $ids): void
    {
        $this->replace_links('option_allergens', 'product_option_id', $option_id, $ids);
    }

    private function link_map(string $table, string $key, array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) {
            return [];
        }
        $map = [];
        foreach ($this->db->table($table)->select("{$key} AS owner, allergen_id")->in($key, $ids)->get_all() as $row) {
            $map[(int) $row['owner']][] = (int) $row['allergen_id'];
        }
        return $map;
    }

    private function replace_links(string $table, string $key, int $owner, array $ids): void
    {
        $this->db->table($table)->where($key, $owner)->delete();
        $rows = array_map(function ($id) use ($key, $owner) {
            return [$key => $owner, 'allergen_id' => (int) $id];
        }, $this->clean_ids($ids));
        if ($rows) {
            $this->db->table($table)->bulk_insert($rows);
        }
    }
}
