<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Product_model extends Model
{
    protected $table = 'products';
    protected $fillable = [
        'category_id', 'name', 'slug', 'description', 'base_price', 'image',
        'lead_time_hours', 'is_customizable', 'is_available', 'is_featured',
    ];

    private const COLUMNS = 'p.id, p.category_id, p.name, p.slug, p.description, p.base_price, p.image, p.lead_time_hours,
        p.is_customizable, p.is_available, p.is_featured, p.created_at, p.updated_at,
        c.name AS category_name, c.slug AS category_slug';

    private const GROUP_ORDER = ['size' => 1, 'flavor' => 2, 'frosting' => 3];

    public function search(array $f): array
    {
        $this->db->table('products p')
            ->select(self::COLUMNS . ', c.sort_order AS category_sort')
            ->inner_join('categories c', 'c.id = p.category_id');

        if (!empty($f['category'])) {
            ctype_digit((string) $f['category'])
                ? $this->db->where('p.category_id', (int) $f['category'])
                : $this->db->where('c.slug', $f['category']);
        }
        if (!empty($f['q'])) {
            $like = '%' . $f['q'] . '%';
            $this->db->grouped(function ($db) use ($like) {
                $db->like('p.name', $like)->or_like('p.description', $like);
            });
        }
        if (isset($f['min']) && $f['min'] !== '' && is_numeric($f['min'])) {
            $this->db->where('p.base_price', '>=', $f['min']);
        }
        if (isset($f['max']) && $f['max'] !== '' && is_numeric($f['max'])) {
            $this->db->where('p.base_price', '<=', $f['max']);
        }
        if (!empty($f['available'])) {
            $this->db->where('p.is_available', 1);
        }
        if (!empty($f['featured'])) {
            $this->db->where('p.is_featured', 1);
        }
        $rows = array_map([$this, 'cast'], $this->db->get_all());

        $sorts = [
            'featured'   => function ($a, $b) { return [$b['is_featured'], $a['category_sort']] <=> [$a['is_featured'], $b['category_sort']] ?: strcasecmp($a['name'], $b['name']); },
            'price_asc'  => function ($a, $b) { return $a['base_price'] <=> $b['base_price'] ?: strcasecmp($a['name'], $b['name']); },
            'price_desc' => function ($a, $b) { return $b['base_price'] <=> $a['base_price'] ?: strcasecmp($a['name'], $b['name']); },
            'newest'     => function ($a, $b) { return [$b['created_at'], $b['id']] <=> [$a['created_at'], $a['id']]; },
            'name'       => function ($a, $b) { return strcasecmp($a['name'], $b['name']); },
        ];
        usort($rows, $sorts[$f['sort'] ?? 'featured'] ?? $sorts['featured']);

        return array_map(function ($p) {
            unset($p['category_sort']);
            return $p;
        }, $rows);
    }

    public function detail(int $id)
    {
        $row = $this->db->table('products p')
            ->select(self::COLUMNS)
            ->inner_join('categories c', 'c.id = p.category_id')
            ->where('p.id', $id)
            ->limit(1)
            ->get();
        if (!$row) return null;
        $row = $this->cast($row);
        $row['options'] = $this->options($id);
        return $row;
    }

    public function options(int $product_id): array
    {
        $rows = array_map(function ($o) {
            $o['id'] = (int) $o['id'];
            $o['product_id'] = (int) $o['product_id'];
            $o['price_add'] = (float) $o['price_add'];
            $o['sort_order'] = (int) $o['sort_order'];
            return $o;
        }, $this->db->table('product_options')->where('product_id', $product_id)->get_all());
        usort($rows, function ($a, $b) {
            return [self::GROUP_ORDER[$a['option_group']] ?? 0, $a['sort_order'], $a['id']]
               <=> [self::GROUP_ORDER[$b['option_group']] ?? 0, $b['sort_order'], $b['id']];
        });
        return $rows;
    }

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
        $this->db->table('product_options')->where('product_id', $product_id);
        if ($keep) {
            $this->db->not_in('id', $keep);
        }
        $this->db->delete();
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

    public function count_in_category(int $category_id): int
    {
        return (int) $this->db->table($this->table)->where('category_id', $category_id)->count();
    }

    public function cast(array $p): array
    {
        foreach (['id', 'category_id', 'lead_time_hours', 'is_customizable', 'is_available', 'is_featured', 'category_sort'] as $k) {
            if (isset($p[$k])) $p[$k] = (int) $p[$k];
        }
        $p['base_price'] = (float) $p['base_price'];
        $p['image_url'] = $p['image'] ? product_image_url($p['image']) : null;
        return $p;
    }
}
