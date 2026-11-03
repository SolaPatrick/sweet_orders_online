<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Auth extends MY_Api_Controller
{
    public function register()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('register:' . $this->client_ip(), 10, 600);
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
        $this->send_verification($user);
        $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
        $this->api->respond(['message' => 'Account created.', 'user' => $this->User_model->public_fields($user), 'tokens' => $tokens], 201);
    }

    public function verify_email()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('verify:' . $this->client_ip(), 20, 600);
        $in = $this->api->body();
        $this->validate($in, ['token|Link' => 'required|max_length[100]']);
        $this->call->model(['Email_verification_model', 'User_model']);
        $row = $this->Email_verification_model->find_valid((string) $in['token']);
        if (!$row) {
            $this->api->respond_error('This link is invalid, already used or expired. Log in and send a new one from your profile.', 400);
        }
        $this->db->transaction();
        $this->Email_verification_model->mark_used((int) $row['id']);
        $this->db->table('users')->where('id', (int) $row['user_id'])->where_null('email_verified_at')->update(['email_verified_at' => date('Y-m-d H:i:s')]);
        $this->db->commit();
        $this->api->respond(['message' => 'Your email is verified. You can now pay at the counter for pickup orders.', 'user' => $this->User_model->public_fields($this->User_model->find((int) $row['user_id']))]);
    }

    public function resend_verification()
    {
        $this->api->require_method('POST');
        $user = $this->user();
        $this->api->rate_limit('verify-resend:' . $user['id'], 3, 900);
        if (!empty($user['email_verified_at'])) {
            $this->api->respond(['message' => 'Your email is already verified.']);
        }
        $this->send_verification($user);
        $hours = (int) config_item('verify_token_hours');
        $this->api->respond(['message' => "We sent a new link to {$user['email']}. It works for {$hours} hours."]);
    }

    private function send_verification(array $user): void
    {
        try {
            $hours = (int) config_item('verify_token_hours');
            $this->call->model('Email_verification_model');
            $token = $this->Email_verification_model->issue((int) $user['id'], $hours);
            $body = "Hi {$user['name']},\n\nPlease confirm your email for Sweet Orders Online by opening this link:\n\n%s\n\n"
                  . "You need this only to pay in cash at the counter for pickup orders. The link works once and expires in {$hours} hours.\n\nClayanna's Café · Sweet Orders Online";
            $this->call->library('notifier');
            $this->notifier->email($user['email'], 'Confirm your email for Sweet Orders', sprintf($body, $this->frontend_url('/verify-email?token=' . $token)), 'verify_email', null, (int) $user['id'],
                sprintf($body, $this->frontend_url('/verify-email?token=[hidden]')));
        } catch (Throwable $e) {
            $this->logger->log('error', 'Notification', 'Verification email failed: ' . $e->getMessage(), $e->getFile(), $e->getLine());
        }
    }

    public function login()
    {
        $this->api->require_method('POST');
        $ip = $this->client_ip();
        $this->api->rate_limit('login:' . $ip, 10, 300);
        $in = $this->api->body();
        $this->validate($in, ['email|Email' => 'required|valid_email|max_length[255]', 'password|Password' => 'required|max_length[200]']);

        $this->call->model(['User_model', 'Login_attempt_model']);
        $email = strtolower(trim((string) $in['email']));
        $agent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $user = $this->User_model->find_by_email($email);
        $locked = $this->Login_attempt_model->locked_until($email);
        if ($locked) {
            $this->Login_attempt_model->record($email, $user['id'] ?? null, false, 'locked', $ip, $agent);
            $minutes = max(1, (int) ceil(($locked - time()) / 60));
            $this->api->respond_error("Too many wrong passwords for this account. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's') . ', or reset your password.', 429);
        }
        if (!$user || !password_verify((string) $in['password'], $user['password'])) {
            $this->Login_attempt_model->record($email, $user['id'] ?? null, false, $user ? 'wrong_password' : 'unknown_email', $ip, $agent);
            $this->api->respond_error('Wrong email or password.', 401);
        }
        if (!(int) $user['is_active']) {
            $this->Login_attempt_model->record($email, $user['id'], false, 'disabled', $ip, $agent);
            $this->api->respond_error('This account is disabled. Please contact the café.', 403);
        }
        $this->Login_attempt_model->record($email, $user['id'], true, 'ok', $ip, $agent);
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

    public function forgot()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('forgot:' . $this->client_ip(), 5, 900);
        $in = $this->api->body();
        $this->validate($in, ['email|Email' => 'required|valid_email|max_length[255]']);
        $minutes = (int) config_item('reset_token_minutes');

        $this->call->model(['User_model', 'Password_reset_model']);
        $user = $this->User_model->find_by_email($in['email']);
        if ($user && (int) $user['is_active']) {
            $token = $this->Password_reset_model->issue((int) $user['id'], $minutes);
            $link = $this->frontend_url('/reset-password?token=' . $token);
            $body = "Hi {$user['name']},\n\nWe got a request to reset the password for your Sweet Orders account. Open this link to choose a new password:\n\n%s\n\n"
                  . "The link works once and expires in {$minutes} minutes. If you did not ask for this, you can ignore this email.\n\nClayanna's Café · Sweet Orders Online";
            $this->call->library('notifier');
            $this->notifier->email($user['email'], 'Reset your Sweet Orders password', sprintf($body, $link), 'password_reset', null, (int) $user['id'],
                sprintf($body, $this->frontend_url('/reset-password?token=[hidden]')));
        }
        $this->api->respond(['message' => "If an account uses that email, we sent a link to reset the password. It works for {$minutes} minutes."]);
    }

    public function reset()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('reset:' . $this->client_ip(), 10, 900);
        $in = $this->api->body();
        $this->validate($in, [
            'token|Reset link'                          => 'required|max_length[128]',
            'new_password|New password'                 => 'required|min_length[8]|max_length[72]',
            'new_password_confirm|Confirm new password' => 'required|matches[new_password]',
        ]);
        $this->call->model(['User_model', 'Password_reset_model']);
        $reset = $this->Password_reset_model->find_valid((string) $in['token']);
        $user = $reset ? $this->User_model->find((int) $reset['user_id']) : null;
        if (!$reset || !$user || !(int) $user['is_active']) {
            $this->api->respond_error('This reset link is invalid or has expired. Please ask for a new one.', 400);
        }
        $this->db->transaction();
        if (!$this->Password_reset_model->mark_used((int) $reset['id'])) {
            $this->db->roll_back();
            $this->api->respond_error('This reset link was already used. Please ask for a new one.', 400);
        }
        $this->User_model->update($user['id'], ['password' => password_hash($in['new_password'], PASSWORD_DEFAULT)]);
        $this->db->table('refresh_tokens')->where('user_id', (int) $user['id'])->delete();
        $this->db->commit();
        $this->api->respond(['message' => 'Your password was changed. Please log in with the new password.']);
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
            $this->db->transaction();
            $this->User_model->update($user['id'], ['password' => password_hash($in['new_password'], PASSWORD_DEFAULT)]);
            $this->db->table('refresh_tokens')->where('user_id', (int) $user['id'])->delete();
            $this->db->commit();
            $tokens = $this->api->issue_tokens(['id' => $user['id'], 'role' => $user['role']]);
            $this->api->respond(['message' => 'Password updated. Other devices were signed out.', 'tokens' => $tokens]);
        }

        $this->validate($in, [
            'name|Name'           => 'required|max_length[100]',
            'phone|Mobile number' => ['required', self::MOBILE_PATTERN],
            'allergies|Allergies' => 'pattern[array]',
        ]);
        $data = [
            'name'  => $in['name'],
            'phone' => normalize_phone($in['phone']),
        ];
        if (array_key_exists('allergies', $in)) {
            $this->call->model('Allergen_model');
            $ids = $this->Allergen_model->clean_ids((array) $in['allergies']);
            $data['allergies'] = $ids ? implode(',', $ids) : null;
        }
        $this->User_model->update($user['id'], $data);
        $this->api->respond(['message' => 'Profile saved.', 'user' => $this->User_model->public_fields($this->User_model->find($user['id']))]);
    }
}
