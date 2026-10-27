<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Category_model extends Model
{
    protected $table = 'categories';
    protected $fillable = ['name', 'slug', 'sort_order'];

    public function all_with_counts(): array
    {
        $rows = $this->db->table('categories c')
            ->select('c.id, c.name, c.slug, c.sort_order')
            ->select_count('p.id', 'product_count')
            ->left_join('products p', 'p.category_id = c.id')
            ->group_by(['c.id', 'c.name', 'c.slug', 'c.sort_order'])
            ->get_all();
        $rows = array_map(function ($c) {
            return [
                'id'            => (int) $c['id'],
                'name'          => $c['name'],
                'slug'          => $c['slug'],
                'sort_order'    => (int) $c['sort_order'],
                'product_count' => (int) $c['product_count'],
            ];
        }, $rows);
        usort($rows, function ($a, $b) {
            return [$a['sort_order'], $a['name']] <=> [$b['sort_order'], $b['name']];
        });
        return $rows;
    }

    public function slug_taken(string $slug, $except_id = null): bool
    {
        return (bool) $this->db->table($this->table)
            ->select('id')
            ->where('slug', $slug)
            ->where('id', '<>', (int) $except_id)
            ->limit(1)
            ->get();
    }
}
