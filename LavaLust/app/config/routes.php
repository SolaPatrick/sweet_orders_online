<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/*
| -------------------------------------------------------------------
| URI ROUTING
| -------------------------------------------------------------------
| Here is where you can register web routes for your application.
|
|
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
    $router->post('/auth/forgot', 'Auth::forgot');
    $router->post('/auth/reset', 'Auth::reset');
    $router->post('/auth/verify-email', 'Auth::verify_email');

    $router->group(['middleware' => 'auth'], function ($router) {
        $router->get('/auth/me', 'Auth::me');
        $router->put('/auth/me', 'Auth::update_me');
        $router->post('/auth/verify-email/resend', 'Auth::resend_verification');
        $router->post('/uploads/design', 'Uploads::design');

        $router->post('/orders', 'Orders::create');
        $router->get('/orders', 'Orders::index');
        $router->get('/orders/{id}', 'Orders::show')->where_number('id');
        $router->post('/orders/{id}/pay', 'Orders::pay')->where_number('id');
        $router->post('/orders/{id}/cancel', 'Orders::cancel')->where_number('id');
        $router->post('/orders/{id}/reviews', 'Reviews::create')->where_number('id');
        $router->put('/reviews/{id}', 'Reviews::update')->where_number('id');
    });

    $router->get('/categories', 'Catalog::categories');
    $router->get('/allergens', 'Catalog::allergens');
    $router->get('/addons', 'Catalog::addons');
    $router->get('/products', 'Catalog::products');
    $router->get('/products/{id}', 'Catalog::product')->where_number('id');
    $router->get('/products/{id}/reviews', 'Reviews::for_product')->where_number('id');

    $router->get('/delivery-zones', 'Zones::index');

    $router->get('/slots', 'Slots::index');
    $router->get('/slots/dates', 'Slots::dates');

    $router->post('/payments/webhook', 'Payments::webhook');

    $router->post('/contact', 'Contact::send');

    $router->group(['prefix' => '/admin', 'middleware' => ['auth', 'staff']], function ($router) {
        $router->get('/dashboard', 'Admin::dashboard');

        $router->get('/orders', 'Admin::orders');
        $router->get('/orders/{id}', 'Admin::order')->where_number('id');
        $router->put('/orders/{id}/status', 'Admin::order_status')->where_number('id');
        $router->post('/orders/{id}/cash', 'Admin::order_cash')->where_number('id');
        $router->put('/products/{id}/stock', 'Admin::product_stock')->where_number('id');
    });

    $router->group(['prefix' => '/admin', 'middleware' => ['auth', 'admin']], function ($router) {
        $router->put('/orders/{id}/preparer', 'Admin::order_preparer')->where_number('id');
        $router->post('/orders/{id}/refund', 'Admin::order_refund')->where_number('id');

        $router->get('/users', 'Users::index');
        $router->put('/users/{id}', 'Users::update')->where_number('id');

        $router->get('/delivery-zones', 'Zones::admin_index');
        $router->get('/addons', 'Admin::addons');
        $router->post('/addons', 'Admin::addon_create');
        $router->put('/addons/{id}', 'Admin::addon_update')->where_number('id');
        $router->post('/delivery-zones', 'Zones::create');
        $router->post('/delivery-zones/bulk', 'Zones::bulk');
        $router->put('/delivery-zones/{id}', 'Zones::update')->where_number('id');
        $router->delete('/delivery-zones/{id}', 'Zones::delete')->where_number('id');
        $router->get('/psgc/cities', 'Zones::psgc_cities');
        $router->get('/psgc/cities/{code}/barangays', 'Zones::psgc_barangays')->where_number('code');

        $router->get('/reviews', 'Reviews::admin_index');
        $router->put('/reviews/{id}', 'Reviews::admin_update')->where_number('id');

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
