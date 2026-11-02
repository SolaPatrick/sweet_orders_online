<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Review_model extends Model
{
    protected $table = 'reviews';
    protected $fillable = ['product_id', 'order_id', 'user_id', 'rating', 'comment', 'is_visible'];

    public function count_for_product(int $product_id): int
    {
        return (int) $this->db->table($this->table)->where('product_id', $product_id)->where('is_visible', 1)->count();
    }

    public function for_product(int $product_id, int $limit, int $offset): array
    {
        $rows = $this->db->table('reviews r')
            ->select('r.id, r.rating, r.comment, r.created_at, r.updated_at, u.name AS user_name')
            ->inner_join('users u', 'u.id = r.user_id')
            ->where('r.product_id', $product_id)
            ->where('r.is_visible', 1)
            ->order_by('CONCAT(r.created_at, 1000000000 + r.id)', 'DESC')
            ->limit($limit, $offset)
            ->get_all();
        return array_map(function ($r) {
            $r['id'] = (int) $r['id'];
            $r['rating'] = (int) $r['rating'];
            $r['author'] = $this->short_name($r['user_name']);
            unset($r['user_name']);
            return $r;
        }, $rows);
    }

    public function exists_for(int $order_id, int $product_id): bool
    {
        return (bool) $this->db->table($this->table)->select('id')->where('order_id', $order_id)->where('product_id', $product_id)->limit(1)->get();
    }

    public function admin_count(array $f): int
    {
        $this->db->table('reviews r')
            ->select_count('*', 'n')
            ->inner_join('products p', 'p.id = r.product_id')
            ->inner_join('users u', 'u.id = r.user_id')
            ->inner_join('orders o', 'o.id = r.order_id');
        $this->filters($f);
        return (int) $this->db->get()['n'];
    }

    public function admin_search(array $f, int $limit, int $offset): array
    {
        $this->db->table('reviews r')
            ->select('r.id, r.product_id, r.order_id, r.user_id, r.rating, r.comment, r.is_visible, r.created_at, r.updated_at,
                      p.name AS product_name, u.name AS customer_name, u.email AS customer_email, o.order_number')
            ->inner_join('products p', 'p.id = r.product_id')
            ->inner_join('users u', 'u.id = r.user_id')
            ->inner_join('orders o', 'o.id = r.order_id');
        $this->filters($f);
        $rows = $this->db->order_by('CONCAT(r.created_at, 1000000000 + r.id)', 'DESC')->limit($limit, $offset)->get_all();
        return array_map([$this, 'cast'], $rows);
    }

    public function cast(array $r): array
    {
        foreach (['id', 'product_id', 'order_id', 'user_id', 'rating', 'is_visible'] as $k) {
            if (isset($r[$k])) $r[$k] = (int) $r[$k];
        }
        return $r;
    }

    private function filters(array $f): void
    {
        if (!empty($f['rating'])) {
            $this->db->where('r.rating', (int) $f['rating']);
        }
        if (isset($f['visible']) && $f['visible'] !== '' && $f['visible'] !== null) {
            $this->db->where('r.is_visible', (int) $f['visible']);
        }
        if (!empty($f['q'])) {
            $like = '%' . $f['q'] . '%';
            $this->db->grouped(function ($db) use ($like) {
                $db->like('p.name', $like)->or_like('u.name', $like)->or_like('r.comment', $like)->or_like('o.order_number', $like);
            });
        }
    }

    private function short_name(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        $first = array_shift($parts);
        $last = $parts ? mb_substr(end($parts), 0, 1) . '.' : '';
        return trim($first . ' ' . $last);
    }
}
