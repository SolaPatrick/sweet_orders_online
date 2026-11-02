<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Email_verification_model extends Model
{
    protected $table = 'email_verifications';
    protected $fillable = ['user_id', 'token_hash', 'expires_at', 'used_at'];

    public function issue(int $user_id, int $hours): string
    {
        $now = date('Y-m-d H:i:s');
        $this->db->table($this->table)->where('user_id', $user_id)->where_null('used_at')->update(['used_at' => $now]);
        $this->db->table($this->table)->where('expires_at', '<', date('Y-m-d H:i:s', strtotime('-7 days')))->delete();
        $token = bin2hex(random_bytes(32));
        $this->insert([
            'user_id'    => $user_id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => date('Y-m-d H:i:s', time() + $hours * 3600),
        ]);
        return $token;
    }

    public function find_valid(string $token)
    {
        return $this->db->table($this->table)
            ->where('token_hash', hash('sha256', $token))
            ->where_null('used_at')
            ->where('expires_at', '>', date('Y-m-d H:i:s'))
            ->limit(1)
            ->get();
    }

    public function mark_used(int $id): int
    {
        return $this->db->table($this->table)->where('id', $id)->where_null('used_at')->update(['used_at' => date('Y-m-d H:i:s')]);
    }
}
