<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Contact extends MY_Api_Controller
{
    public function send()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit('contact:' . $this->request->ip_address(), 5, 600);
        $in = $this->api->body();
        $this->validate($in, [
            'name|Name'           => 'required|max_length[100]',
            'email|Email'         => 'required|valid_email|max_length[255]',
            'phone|Mobile number' => ['', self::MOBILE_PATTERN],
            'message|Message'     => 'required|min_length[5]|max_length[2000]',
        ]);

        $this->call->library('notifier');
        $body = "New message from the Sweet Orders contact form\n\n"
              . "Name: {$in['name']}\nEmail: {$in['email']}\nMobile: " . ($in['phone'] ?? '-') . "\n\n{$in['message']}";
        $this->notifier->email(config_item('cafe_email'), 'Contact form: ' . $in['name'], $body, 'contact', null, $this->optional_user_id());
        $this->api->respond(['message' => 'Thanks! Your message was sent. We will reply by email.'], 201);
    }
}
