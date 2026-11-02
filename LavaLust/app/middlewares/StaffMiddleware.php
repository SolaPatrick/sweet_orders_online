<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class StaffMiddleware
{
    public function handle(Closure $next)
    {
        $user = load_class('AuthMiddleware', 'middlewares')->user;
        if (!$user || !in_array($user['role'], ['staff', 'admin'], true)) {
            lava_instance()->call->library('api')->respond_error('This page is for café staff only.', 403);
        }
        return $next();
    }
}
