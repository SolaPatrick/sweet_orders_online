<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Design_upload_model extends Model
{
    protected $table = 'design_uploads';
    protected $fillable = ['user_id', 'url'];

    public function owned(int $id, int $user_id)
    {
        return $this->db->table($this->table)
            ->where('id', $id)
            ->where('user_id', $user_id)
            ->where('created_at', '>', date('Y-m-d H:i:s', strtotime('-30 days')))
            ->limit(1)
            ->get();
    }
}
