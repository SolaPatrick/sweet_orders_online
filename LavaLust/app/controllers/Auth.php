<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Accounts and roles (FR1). Pages: C8 Login, C9 Register, C12 Profile. */
class Auth extends MY_Api_Controller
{
    /** POST /api/auth/register */
    public function register()
    {
        $this->api()->rate_limit('register:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 10, 600);
        $in = $this->input();
        $this->validate($in, [
            'name'             => 'required|max:100',
            'email'            => 'required|email|max:255',
            'phone'            => 'required|phone',
            'password'         => 'required|min:8|max:72',
            'password_confirm' => 'required',
        ], ['password_confirm' => 'Confirm password', 'phone' => 'Mobile number']);

        if ($in['password'] !== $in['password_confirm']) {
            $this->error('Please fix the highlighted fields.', 422, ['password_confirm' => 'Passwords do not match.']);
        }
        $this->call->model('User_model');
        if ($this->User_model->find_by_email($in['email'])) {
            $this->error('Please fix the highlighted fields.', 422, ['email' => 'An account with this email already exists.']);
        }

        $id = $this->User_model->create([
            'name'     => $in['name'],
            'email'    => $in['email'],
            'phone'    => $this->normalize_phone($in['phone']),
            'password' => $in['password'],
            'role'     => 'customer',
        ]);
        $user = $this->User_model->find($id);
        $tokens = $this->api()->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        $this->json(['message' => 'Account created.', 'user' => $this->User_model->public_fields($user), 'tokens' => $tokens], 201);
    }

    /** POST /api/auth/login */
    public function login()
    {
        $this->api()->rate_limit('login:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 10, 300);
        $in = $this->input();
        $this->validate($in, ['email' => 'required|email', 'password' => 'required']);

        $this->call->model('User_model');
        $user = $this->User_model->find_by_email($in['email']);
        if (!$user || !password_verify($in['password'], $user['password'])) {
            $this->error('Wrong email or password.', 401);
        }
        if (!(int) $user['is_active']) {
            $this->error('This account is disabled. Please contact the café.', 403);
        }
        $tokens = $this->api()->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        $this->json(['message' => 'Logged in.', 'user' => $this->User_model->public_fields($user), 'tokens' => $tokens]);
    }

    /** POST /api/auth/refresh  body: {refresh_token} */
    public function refresh()
    {
        $in = $this->input();
        $this->validate($in, ['refresh_token' => 'required']);
        $this->api()->refresh_access_token($in['refresh_token']); // answers with new tokens
    }

    /** POST /api/auth/logout  body: {refresh_token} */
    public function logout()
    {
        $in = $this->input();
        if (!empty($in['refresh_token'])) {
            $this->api()->revoke_refresh_token($in['refresh_token']);
        }
        $this->json(['message' => 'Logged out.']);
    }

    /** GET /api/auth/me */
    public function me()
    {
        $user = $this->require_user();
        $this->json(['user' => $this->User_model->public_fields($user)]);
    }

    /** PUT /api/auth/me  Update name and phone, or change the password. */
    public function update_me()
    {
        $user = $this->require_user();
        $in = $this->input();

        if (isset($in['new_password']) || isset($in['current_password'])) {
            $this->validate($in, [
                'current_password'     => 'required',
                'new_password'         => 'required|min:8|max:72',
                'new_password_confirm' => 'required',
            ], ['new_password_confirm' => 'Confirm new password']);
            if (!password_verify($in['current_password'], $user['password'])) {
                $this->error('Please fix the highlighted fields.', 422, ['current_password' => 'Current password is wrong.']);
            }
            if ($in['new_password'] !== $in['new_password_confirm']) {
                $this->error('Please fix the highlighted fields.', 422, ['new_password_confirm' => 'Passwords do not match.']);
            }
            $this->User_model->update($user['id'], ['password' => password_hash($in['new_password'], PASSWORD_DEFAULT)]);
            $this->json(['message' => 'Password updated.']);
        }

        $this->validate($in, ['name' => 'required|max:100', 'phone' => 'required|phone'], ['phone' => 'Mobile number']);
        $this->User_model->update($user['id'], [
            'name'  => $in['name'],
            'phone' => $this->normalize_phone($in['phone']),
        ]);
        $this->json(['message' => 'Profile saved.', 'user' => $this->User_model->public_fields($this->User_model->find($user['id']))]);
    }
}
