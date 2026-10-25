<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** users table: customers and café staff. */
class User_model extends Model
{
    protected $table = 'users';
    protected $fillable = ['name', 'email', 'phone', 'password', 'role', 'is_active'];

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

    /** User row without the password hash, safe to send to the browser. */
    public function public_fields($user)
    {
        if (!$user) return null;
        unset($user['password']);
        $user['id'] = (int) $user['id'];
        $user['is_active'] = (int) $user['is_active'];
        return $user;
    }
}
