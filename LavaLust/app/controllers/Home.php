<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Home extends MY_Api_Controller
{
    protected $uses_database = false;

    public function index()
    {
        $this->api->require_method('GET');
        $this->api->respond([
            'app'      => "Sweet Orders Online API for Clayanna's Café",
            'frontend' => config_item('frontend_url'),
            'health'   => base_url('api/health'),
            'modules'  => ['auth', 'catalog', 'slots', 'orders', 'payments', 'contact', 'admin'],
        ]);
    }
}
