<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** products and product_options tables. */
class Product_model extends Model
{
    protected $table = 'products';
    protected $fillable = [
        'category_id', 'name', 'slug', 'description', 'base_price', 'image',
        'lead_time_hours', 'is_customizable', 'is_available', 'is_featured',
    ];

    /**
     * Product list with search, category, price and availability filters.
     * Returns [rows, total].
     */
    public function search(array $f, int $limit, int $offset): array
    {
        $where = ['1 = 1'];
        $args = [];

        if (!empty($f['category'])) {
            if (ctype_digit((string) $f['category'])) {
                $where[] = 'p.category_id = ?';
            } else {
                $where[] = 'c.slug = ?';
            }
            $args[] = $f['category'];
        }
        if (!empty($f['q'])) {
            $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
            $args[] = '%' . $f['q'] . '%';
            $args[] = '%' . $f['q'] . '%';
        }
        if (isset($f['min']) && $f['min'] !== '' && is_numeric($f['min'])) {
            $where[] = 'p.base_price >= ?';
            $args[] = $f['min'];
        }
        if (isset($f['max']) && $f['max'] !== '' && is_numeric($f['max'])) {
            $where[] = 'p.base_price <= ?';
            $args[] = $f['max'];
        }
        if (!empty($f['available'])) {
            $where[] = 'p.is_available = 1';
        }
        if (!empty($f['featured'])) {
            $where[] = 'p.is_featured = 1';
        }

        $sorts = [
            'featured'   => 'p.is_featured DESC, c.sort_order, p.name',
            'price_asc'  => 'p.base_price ASC, p.name',
            'price_desc' => 'p.base_price DESC, p.name',
            'newest'     => 'p.created_at DESC, p.id DESC',
            'name'       => 'p.name ASC',
        ];
        $order = $sorts[$f['sort'] ?? 'featured'] ?? $sorts['featured'];
        $sql_where = implode(' AND ', $where);

        $total = (int) $this->db->raw(
            "SELECT COUNT(*) FROM products p JOIN categories c ON c.id = p.category_id WHERE {$sql_where}",
            $args
        )->fetchColumn();

        $rows = $this->db->raw(
            "SELECT p.*, c.name AS category_name, c.slug AS category_slug
             FROM products p JOIN categories c ON c.id = p.category_id
             WHERE {$sql_where}
             ORDER BY {$order}
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $args
        )->fetchAll();

        return [array_map([$this, 'cast'], $rows), $total];
    }

    public function detail(int $id)
    {
        $row = $this->db->raw(
            'SELECT p.*, c.name AS category_name, c.slug AS category_slug
             FROM products p JOIN categories c ON c.id = p.category_id
             WHERE p.id = ? LIMIT 1',
            [$id]
        )->fetch();
        if (!$row) return null;
        $row = $this->cast($row);
        $row['options'] = $this->options($id);
        return $row;
    }

    public function options(int $product_id): array
    {
        $rows = $this->db->raw(
            "SELECT * FROM product_options WHERE product_id = ?
             ORDER BY FIELD(option_group, 'size', 'flavor', 'frosting'), sort_order, id",
            [$product_id]
        )->fetchAll();
        return array_map(function ($o) {
            $o['id'] = (int) $o['id'];
            $o['product_id'] = (int) $o['product_id'];
            $o['price_add'] = (float) $o['price_add'];
            $o['sort_order'] = (int) $o['sort_order'];
            return $o;
        }, $rows);
    }

    /** Replace a product's options with the given list. */
    public function replace_options(int $product_id, array $options): void
    {
        $keep = [];
        foreach ($options as $i => $o) {
            $data = [
                'product_id'   => $product_id,
                'option_group' => $o['option_group'],
                'name'         => $o['name'],
                'price_add'    => round((float) ($o['price_add'] ?? 0), 2),
                'sort_order'   => (int) ($o['sort_order'] ?? $i + 1),
            ];
            if (!empty($o['id'])) {
                $this->db->table('product_options')
                    ->where('id', (int) $o['id'])
                    ->where('product_id', $product_id)
                    ->update($data);
                $keep[] = (int) $o['id'];
            } else {
                $this->db->table('product_options')->insert($data);
                $keep[] = (int) $this->db->last_id();
            }
        }
        if ($keep) {
            $marks = implode(',', array_fill(0, count($keep), '?'));
            $this->db->raw("DELETE FROM product_options WHERE product_id = ? AND id NOT IN ({$marks})", array_merge([$product_id], $keep));
        } else {
            $this->db->raw('DELETE FROM product_options WHERE product_id = ?', [$product_id]);
        }
    }

    public function slug_taken(string $slug, $except_id = null): bool
    {
        return (bool) $this->db->raw(
            'SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1',
            [$slug, (int) $except_id]
        )->fetch();
    }

    public function cast(array $p): array
    {
        foreach (['id', 'category_id', 'lead_time_hours', 'is_customizable', 'is_available', 'is_featured'] as $k) {
            if (isset($p[$k])) $p[$k] = (int) $p[$k];
        }
        $p['base_price'] = (float) $p['base_price'];
        $p['image_url'] = $p['image'] ? product_image_url($p['image']) : null;
        return $p;
    }
}
