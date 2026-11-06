<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class User_model extends Model
{
    public const WALK_IN_EMAIL = 'walkin@sweet-orders.invalid';

    protected $table = 'users';
    protected $fillable = [
        'name', 'email', 'phone', 'password', 'role', 'is_active',
        'last_zone_id', 'last_address_street', 'last_address_landmark', 'allergies', 'email_verified_at',
    ];

    public function find_by_email(string $email)
    {
        return $this->db->table($this->table)->where('email', strtolower($email))->get();
    }

    public function create(array $data)
    {
        $data['email'] = strtolower($data['email']);
        $data['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
        return $this->insert($data);
    }

    public function public_fields($user)
    {
        if (!$user) return null;
        unset($user['password']);
        $user['id'] = (int) $user['id'];
        $user['is_active'] = (int) $user['is_active'];
        $user['email_verified'] = !empty($user['email_verified_at']);
        $user['allergies'] = array_values(array_filter(array_map('intval', explode(',', (string) ($user['allergies'] ?? '')))));
        if (array_key_exists('last_zone_id', $user)) {
            $user['last_zone_id'] = $user['last_zone_id'] !== null ? (int) $user['last_zone_id'] : null;
        }
        return $user;
    }

    public function admin_count(array $f): int
    {
        $this->db->table('users')->select_count('*', 'n');
        $this->admin_filters($f);
        return (int) $this->db->get()['n'];
    }

    public function admin_search(array $f, int $limit, int $offset): array
    {
        $this->db->table('users u')
            ->select('u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at')
            ->select_count('o.id', 'order_count')
            ->left_join('orders o', 'o.user_id = u.id')
            ->group_by(['u.id', 'u.name', 'u.email', 'u.phone', 'u.role', 'u.is_active', 'u.created_at']);
        $this->admin_filters($f, 'u.');
        $rows = $this->db->order_by('u.name')->limit($limit, $offset)->get_all();
        return array_map(function ($u) {
            $u['id'] = (int) $u['id'];
            $u['is_active'] = (int) $u['is_active'];
            $u['order_count'] = (int) $u['order_count'];
            return $u;
        }, $rows);
    }

    public function role_counts(): array
    {
        $rows = $this->db->table('users')->select('role')->select_count('*', 'n')->where('email', '<>', self::WALK_IN_EMAIL)->group_by('role')->get_all(PDO::FETCH_KEY_PAIR);
        $out = ['all' => 0, 'customer' => 0, 'staff' => 0, 'admin' => 0];
        foreach ($rows as $role => $n) {
            $out[$role] = (int) $n;
            $out['all'] += (int) $n;
        }
        return $out;
    }

    public function team(): array
    {
        return array_map(function ($u) {
            $u['id'] = (int) $u['id'];
            return $u;
        }, $this->db->table('users')
            ->select('id, name, role')
            ->in('role', ['staff', 'admin'])
            ->where('is_active', 1)
            ->order_by('name')
            ->get_all());
    }

    private function admin_filters(array $f, string $p = ''): void
    {
        $this->db->where("{$p}email", '<>', self::WALK_IN_EMAIL);
        if (!empty($f['role'])) {
            $f['role'] === 'team'
                ? $this->db->in("{$p}role", ['staff', 'admin'])
                : $this->db->where("{$p}role", $f['role']);
        }
        if (isset($f['active']) && $f['active'] !== '' && $f['active'] !== null) {
            $this->db->where("{$p}is_active", (int) $f['active']);
        }
        if (!empty($f['q'])) {
            $like = '%' . $f['q'] . '%';
            $this->db->grouped(function ($db) use ($like, $p) {
                $db->like("{$p}name", $like)->or_like("{$p}email", $like)->or_like("{$p}phone", $like);
            });
        }
    }
}
