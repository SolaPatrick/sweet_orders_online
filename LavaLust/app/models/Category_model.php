<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** categories table, with how many products each one holds. */
class Category_model extends Model
{
    protected $table = 'categories';
    protected $fillable = ['name', 'slug', 'sort_order'];

    public function all_with_counts()
    {
        return $this->db->raw(
            'SELECT c.*, COUNT(p.id) AS product_count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.id
             GROUP BY c.id
             ORDER BY c.sort_order, c.name'
        )->fetchAll();
    }

    public function slug_taken(string $slug, $except_id = null): bool
    {
        $row = $this->db->raw(
            'SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1',
            [$slug, (int) $except_id]
        )->fetch();
        return (bool) $row;
    }

    public function product_count(int $id): int
    {
        return (int) $this->db->raw('SELECT COUNT(*) FROM products WHERE category_id = ?', [$id])->fetchColumn();
    }
}
