<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Page: C14 Contact. The message is emailed to the café and logged. */
class Contact extends MY_Api_Controller
{
    /** POST /api/contact  {name, email, phone, message} */
    public function send()
    {
        $this->api()->rate_limit('contact:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 5, 600);
        $in = $this->input();
        $this->validate($in, [
            'name'    => 'required|max:100',
            'email'   => 'required|email|max:255',
            'phone'   => 'phone',
            'message' => 'required|min:5|max:2000',
        ], ['phone' => 'Mobile number']);

        $this->call->library('notifier');
        $to = getenv('CAFE_EMAIL') ?: (getenv('MAIL_FROM') ?: 'cafe@localhost');
        $body = "New message from the Sweet Orders contact form\n\n"
              . "Name: {$in['name']}\nEmail: {$in['email']}\nMobile: " . ($in['phone'] ?? '-') . "\n\n{$in['message']}";
        $user = $this->current_user();
        $this->notifier->email($to, 'Contact form: ' . $in['name'], $body, 'contact', null, $user['id'] ?? null);
        $this->json(['message' => 'Thanks! Your message was sent. We will reply by email.'], 201);
    }
}
