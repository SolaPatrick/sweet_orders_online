<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AdminMiddleware
{
    public function handle(Closure $next)
    {
        $user = load_class('AuthMiddleware', 'middlewares')->user;
        if (!$user || $user['role'] !== 'admin') {
            lava_instance()->call->library('api')->respond_error('This page is for café staff only.', 403);
        }
        return $next();
    }
}
