<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Product_model extends Model
{
    protected $table = 'products';
    protected $fillable = [
        'category_id', 'name', 'slug', 'description', 'ingredients', 'base_price', 'image',
        'lead_time_hours', 'is_customizable', 'is_available', 'is_featured',
        'daily_limit', 'sold_out_date', 'is_archived', 'product_type', 'stock_qty',
    ];

    private const COLUMNS = 'p.id, p.category_id, p.name, p.slug, p.description, p.ingredients, p.base_price, p.image, p.product_type, p.stock_qty, p.lead_time_hours,
        p.is_customizable, p.is_available, p.is_featured, p.daily_limit, p.sold_out_date, p.is_archived, p.created_at, p.updated_at,
        c.name AS category_name, c.slug AS category_slug';

    private const GROUP_ORDER = ['size' => 1, 'flavor' => 2, 'frosting' => 3];

    public const READY_MADE_LEAD_HOURS = 1;

    public function search(array $f): array
    {
        $exclude = [];
        if (!empty($f['exclude_allergens'])) {
            $this->call->model('Allergen_model');
            $exclude = $this->Allergen_model->products_with($this->Allergen_model->clean_ids($f['exclude_allergens']));
        }
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
        if (!empty($f['type']) && in_array($f['type'], ['ready_made', 'made_to_order'], true)) {
            $this->db->where('p.product_type', $f['type']);
        }
        if ($exclude) {
            $this->db->not_in('p.id', array_values(array_unique($exclude)));
        }
        $this->db->where('p.is_archived', !empty($f['archived']) ? 1 : 0);
        $rows = array_map([$this, 'cast'], $this->db->get_all());
        $ratings = $this->ratings(array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['rating_avg'] = $ratings[$row['id']]['avg'] ?? null;
            $row['rating_count'] = $ratings[$row['id']]['count'] ?? 0;
        }
        unset($row);
        $rows = $this->with_allergens($rows);

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
        $rating = $this->ratings([$id])[$id] ?? null;
        $row['rating_avg'] = $rating['avg'] ?? null;
        $row['rating_count'] = $rating['count'] ?? 0;
        $row['options'] = $row['product_type'] === 'ready_made' ? [] : $this->options($id);
        return $this->with_allergens([$row])[0];
    }

    public function with_allergens(array $rows): array
    {
        $this->call->model('Allergen_model');
        $map = $this->Allergen_model->for_products(array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['allergens'] = $this->Allergen_model->pick($map[$row['id']] ?? []);
        }
        unset($row);
        return $rows;
    }

    public function slowest(array $ids)
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (!$ids) return null;
        $best = null;
        foreach ($this->db->table($this->table)->select('id, name, product_type, lead_time_hours')->in('id', $ids)->get_all() as $row) {
            $hours = $row['product_type'] === 'ready_made' ? self::READY_MADE_LEAD_HOURS : (int) $row['lead_time_hours'];
            if (!$best || $hours > $best['lead_time_hours']) {
                $best = ['id' => (int) $row['id'], 'name' => $row['name'], 'lead_time_hours' => $hours];
            }
        }
        return $best;
    }

    public function ready_made_lines(int $order_id): array
    {
        return $this->db->table('order_items i')
            ->select('i.product_id, p.name')
            ->select_sum('i.quantity', 'qty')
            ->inner_join('products p', 'p.id = i.product_id')
            ->where('i.order_id', $order_id)
            ->where('p.product_type', 'ready_made')
            ->group_by(['i.product_id', 'p.name'])
            ->order_by('i.product_id')
            ->get_all();
    }

    public function take_stock(int $order_id): array
    {
        $lines = $this->ready_made_lines($order_id);
        $short = [];
        foreach ($lines as $l) {
            $row = $this->db->raw('SELECT stock_qty FROM products WHERE id = ? FOR UPDATE', [$l['product_id']])->fetch();
            if ((int) ($row['stock_qty'] ?? 0) < (int) $l['qty']) {
                $short[] = $l['name'];
            }
        }
        if ($short || !$lines) {
            return $short;
        }
        $done = [];
        foreach ($lines as $l) {
            $ok = $this->db->raw(
                'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?',
                [(int) $l['qty'], $l['product_id'], (int) $l['qty']]
            )->rowCount() === 1;
            if (!$ok) {
                foreach ($done as $d) {
                    $this->db->raw('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [(int) $d['qty'], $d['product_id']]);
                }
                return [$l['name']];
            }
            $done[] = $l;
        }
        $this->db->table('orders')->where('id', $order_id)->update(['stock_taken' => 1]);
        return [];
    }

    public function return_stock(int $order_id): bool
    {
        if ($this->db->raw('UPDATE orders SET stock_taken = 0 WHERE id = ? AND stock_taken = 1', [$order_id])->rowCount() !== 1) {
            return false;
        }
        foreach ($this->ready_made_lines($order_id) as $l) {
            $this->db->raw('UPDATE products SET stock_qty = COALESCE(stock_qty, 0) + ? WHERE id = ?', [(int) $l['qty'], $l['product_id']]);
        }
        return true;
    }

    public function set_stock(int $id, int $qty): void
    {
        $this->db->table($this->table)->where('id', $id)->update(['stock_qty' => $qty]);
    }

    public function ratings(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $rows = $this->db->table('reviews')
            ->select('product_id')
            ->select_avg('rating', 'avg_rating')
            ->select_count('*', 'n')
            ->in('product_id', $ids)
            ->where('is_visible', 1)
            ->group_by('product_id')
            ->get_all();
        $out = [];
        foreach ($rows as $r) {
            $out[(int) $r['product_id']] = ['avg' => round((float) $r['avg_rating'], 1), 'count' => (int) $r['n']];
        }
        return $out;
    }

    public function sold_on(int $product_id, string $date): int
    {
        $row = $this->db->table('order_items i')
            ->select_sum('i.quantity', 'n')
            ->inner_join('orders o', 'o.id = i.order_id')
            ->inner_join('delivery_slots s', 's.id = o.slot_id')
            ->where('i.product_id', $product_id)
            ->where('s.slot_date', $date)
            ->where('o.status', '<>', 'cancelled')
            ->get();
        return (int) ($row['n'] ?? 0);
    }

    public function has_orders(int $product_id): bool
    {
        return (bool) $this->db->table('order_items')->select('id')->where('product_id', $product_id)->limit(1)->get();
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
        $this->call->model('Allergen_model');
        $map = $this->Allergen_model->for_options(array_column($rows, 'id'));
        foreach ($rows as &$row) {
            $row['allergens'] = $this->Allergen_model->pick($map[$row['id']] ?? []);
        }
        unset($row);
        return $rows;
    }

    public function replace_options(int $product_id, array $options): array
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
        return $keep;
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
        foreach (['id', 'category_id', 'lead_time_hours', 'is_customizable', 'is_available', 'is_featured', 'is_archived', 'category_sort'] as $k) {
            if (isset($p[$k])) $p[$k] = (int) $p[$k];
        }
        $p['base_price'] = (float) $p['base_price'];
        $p['daily_limit'] = isset($p['daily_limit']) ? (int) $p['daily_limit'] : null;
        $p['sold_out_date'] = $p['sold_out_date'] ?? null;
        $p['sold_out_today'] = $p['sold_out_date'] === date('Y-m-d');
        $p['product_type'] = $p['product_type'] ?? 'made_to_order';
        $p['stock_qty'] = isset($p['stock_qty']) ? (int) $p['stock_qty'] : null;
        if ($p['product_type'] === 'ready_made') {
            $p['lead_time_hours'] = self::READY_MADE_LEAD_HOURS;
            $p['is_customizable'] = 0;
            $p['stock_qty'] = max(0, (int) $p['stock_qty']);
            $p['sold_out_today'] = $p['stock_qty'] === 0;
        }
        $p['image_url'] = $p['image'] ? product_image_url($p['image']) : null;
        return $p;
    }
}
