<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Auth extends MY_Api_Controller
{
    public function register()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('register:' . $this->request->ip_address(), 10, 600);
        $in = $this->api->body();
        $this->validate($in, [
            'name|Name'                     => 'required|max_length[100]',
            'email|Email'                   => 'required|valid_email|max_length[255]|is_unique[users,email,{email}]',
            'phone|Mobile number'           => ['required', self::MOBILE_PATTERN],
            'password|Password'             => 'required|min_length[8]|max_length[72]',
            'password_confirm|Confirm password' => 'required|matches[password]',
        ], ['email' => ['is_unique' => 'An account with this email already exists.']]);

        $this->call->model('User_model');
        $id = $this->User_model->create([
            'name'     => $in['name'],
            'email'    => $in['email'],
            'phone'    => normalize_phone($in['phone']),
            'password' => $in['password'],
            'role'     => 'customer',
        ]);
        $user = $this->User_model->find($id);
        $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        $this->api->respond(['message' => 'Account created.', 'user' => $this->User_model->public_fields($user), 'tokens' => $tokens], 201);
    }

    public function login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('login:' . $this->request->ip_address(), 10, 300);
        $in = $this->api->body();
        $this->validate($in, ['email|Email' => 'required|valid_email', 'password|Password' => 'required']);

        $this->call->model('User_model');
        $user = $this->User_model->find_by_email($in['email']);
        if (!$user || !password_verify($in['password'], $user['password'])) {
            $this->api->respond_error('Wrong email or password.', 401);
        }
        if (!(int) $user['is_active']) {
            $this->api->respond_error('This account is disabled. Please contact the café.', 403);
        }
        $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        $this->api->respond(['message' => 'Logged in.', 'user' => $this->User_model->public_fields($user), 'tokens' => $tokens]);
    }

    public function refresh()
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        $this->validate($in, ['refresh_token|Refresh token' => 'required']);
        $this->api->refresh_access_token($in['refresh_token']);
    }

    public function logout()
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        if (!empty($in['refresh_token'])) {
            $this->api->revoke_refresh_token($in['refresh_token']);
        }
        $this->api->respond(['message' => 'Logged out.']);
    }

    public function me()
    {
        $this->api->require_method('GET');
        $this->call->model('User_model');
        $this->api->respond(['user' => $this->User_model->public_fields($this->user())]);
    }

    public function update_me()
    {
        $this->api->require_method('PUT');
        $user = $this->user();
        $in = $this->api->body();
        $this->call->model('User_model');

        if (isset($in['new_password']) || isset($in['current_password'])) {
            $this->validate($in, [
                'current_password|Current password'         => 'required',
                'new_password|New password'                 => 'required|min_length[8]|max_length[72]',
                'new_password_confirm|Confirm new password' => 'required|matches[new_password]',
            ]);
            if (!password_verify($in['current_password'], $user['password'])) {
                $this->fail_validation(['current_password' => 'Current password is wrong.']);
            }
            $this->User_model->update($user['id'], ['password' => password_hash($in['new_password'], PASSWORD_DEFAULT)]);
            $this->api->respond(['message' => 'Password updated.']);
        }

        $this->validate($in, ['name|Name' => 'required|max_length[100]', 'phone|Mobile number' => ['required', self::MOBILE_PATTERN]]);
        $this->User_model->update($user['id'], [
            'name'  => $in['name'],
            'phone' => normalize_phone($in['phone']),
        ]);
        $this->api->respond(['message' => 'Profile saved.', 'user' => $this->User_model->public_fields($this->User_model->find($user['id']))]);
    }
}
