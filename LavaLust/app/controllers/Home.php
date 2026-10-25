<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Home extends MY_Api_Controller
{
    protected $uses_database = false;

    public function index()
    {
        $this->json([
            'app'      => "Sweet Orders Online API for Clayanna's Café",
            'frontend' => getenv('FRONTEND_URL') ?: 'http://localhost:5173',
            'health'   => rtrim(getenv('APP_URL') ?: 'http://localhost:3000', '/') . '/api/health',
            'modules'  => ['auth', 'catalog', 'slots', 'orders', 'payments', 'contact', 'admin'],
        ]);
    }
}
