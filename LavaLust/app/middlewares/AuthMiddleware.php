<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AuthMiddleware
{
    public $user = null;

    public function handle(Closure $next)
    {
        $lava = lava_instance();
        $lava->call->database();
        $api = $lava->call->library('api');

        $payload = $api->require_jwt();

        $lava->call->model('User_model');
        $user = $lava->User_model->find((int) $payload['sub']);
        if (!$user || !(int) $user['is_active']) {
            $api->respond_error('Please log in to continue.', 401);
        }

        $this->user = $user;
        return $next();
    }
}
