<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');
/*
| -------------------------------------------------------------------
| URI ROUTING: Sweet Orders Online API
| -------------------------------------------------------------------
| The React app (sweet_orders_frontend) owns the 24 pages in the site
| map. These are the API routes those pages call, grouped by module.
| {id} only matches numbers.
*/
/** @var object $router **/

$router->get('/', 'Home::index');

$router->group(['prefix' => '/api'], function ($router) {
    $router->get('/', 'Home::index');
    $router->get('/health', 'Health::index');

    $router->post('/auth/register', 'Auth::register');
    $router->post('/auth/login', 'Auth::login');
    $router->post('/auth/refresh', 'Auth::refresh');
    $router->post('/auth/logout', 'Auth::logout');
    $router->get('/auth/me', 'Auth::me');
    $router->put('/auth/me', 'Auth::update_me');

    $router->get('/categories', 'Catalog::categories');
    $router->get('/products', 'Catalog::products');
    $router->get('/products/{id}', 'Catalog::product')->where_number('id');

    $router->get('/slots', 'Slots::index');
    $router->get('/slots/dates', 'Slots::dates');

    $router->post('/orders', 'Orders::create');
    $router->get('/orders', 'Orders::index');
    $router->get('/orders/{id}', 'Orders::show')->where_number('id');
    $router->post('/orders/{id}/pay', 'Orders::pay')->where_number('id');
    $router->post('/orders/{id}/cancel', 'Orders::cancel')->where_number('id');

    $router->post('/payments/webhook', 'Payments::webhook');

    $router->post('/contact', 'Contact::send');

    $router->group(['prefix' => '/admin'], function ($router) {
        $router->get('/dashboard', 'Admin::dashboard');

        $router->get('/orders', 'Admin::orders');
        $router->get('/orders/{id}', 'Admin::order')->where_number('id');
        $router->put('/orders/{id}/status', 'Admin::order_status')->where_number('id');

        $router->get('/products', 'Admin::products');
        $router->post('/products', 'Admin::product_create');
        $router->get('/products/{id}', 'Admin::product')->where_number('id');
        $router->put('/products/{id}', 'Admin::product_update')->where_number('id');
        $router->delete('/products/{id}', 'Admin::product_delete')->where_number('id');
        $router->post('/products/{id}/image', 'Admin::product_image')->where_number('id');

        $router->get('/categories', 'Admin::categories');
        $router->post('/categories', 'Admin::category_create');
        $router->put('/categories/{id}', 'Admin::category_update')->where_number('id');
        $router->delete('/categories/{id}', 'Admin::category_delete')->where_number('id');

        $router->get('/slots', 'Admin::slots');
        $router->post('/slots/generate', 'Admin::slots_generate');
        $router->put('/slots/{id}', 'Admin::slot_update')->where_number('id');
        $router->delete('/slots/{id}', 'Admin::slot_delete')->where_number('id');
        $router->post('/slots/block-date', 'Admin::block_date');

        $router->get('/payments', 'Admin::payments');
        $router->get('/notifications', 'Admin::notifications');
        $router->post('/notifications/{id}/resend', 'Admin::notification_resend')->where_number('id');
    });
});
