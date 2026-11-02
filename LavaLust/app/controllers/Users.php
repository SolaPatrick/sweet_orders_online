<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Users extends MY_Api_Controller
{
    public function index()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $this->validate($q, [
            'role|Role'     => 'in_list["customer,staff,admin,team"]',
            'active|Active' => 'in_list["0,1"]',
        ]);
        $filters = [
            'q'      => $q['q'] ?? null,
            'role'   => $q['role'] ?? null,
            'active' => $q['active'] ?? null,
        ];
        $this->call->model('User_model');
        $page = $this->paginate($this->User_model->admin_count($filters), 20);
        $this->api->respond([
            'data'   => $this->User_model->admin_search($filters, $page['per_page'], $page['offset']),
            'meta'   => $this->page_meta($page),
            'counts' => $this->User_model->role_counts(),
            'team'   => $this->User_model->team(),
        ]);
    }

    public function update($id)
    {
        $this->api->require_method('PUT');
        $in = $this->api->body();
        $this->validate($in, [
            'role|Role'           => 'in_list["customer,staff,admin"]',
            'is_active|Is active' => 'in_list["0,1,true,false"]',
        ]);
        $this->call->model('User_model');
        $user = $this->User_model->find((int) $id);
        if (!$user) {
            $this->api->respond_error('User not found.', 404);
        }
        $data = [];
        if (!empty($in['role'])) {
            $data['role'] = $in['role'];
        }
        if (array_key_exists('is_active', $in)) {
            $data['is_active'] = (int) $this->request->boolean('is_active');
        }
        if (!$data) {
            $this->api->respond_error('Nothing to change.', 422);
        }
        if ((int) $user['id'] === (int) $this->user()['id']) {
            if (($data['role'] ?? 'admin') !== 'admin') {
                $this->fail_validation(['role' => 'You cannot remove your own admin role.']);
            }
            if (($data['is_active'] ?? 1) === 0) {
                $this->fail_validation(['is_active' => 'You cannot disable your own account.']);
            }
        }
        $this->User_model->update((int) $id, $data);
        if (($data['is_active'] ?? 1) === 0) {
            $this->db->table('refresh_tokens')->where('user_id', (int) $id)->delete();
        }
        $this->api->respond([
            'message' => "{$user['name']} was updated.",
            'data'    => $this->User_model->public_fields($this->User_model->find((int) $id)),
        ]);
    }
}
