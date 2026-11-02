<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Catalog extends MY_Api_Controller
{
    public function categories()
    {
        $this->api->require_method('GET');
        $this->call->model('Category_model');
        $this->api->respond(['data' => $this->Category_model->all_with_counts()]);
    }

    public function addons()
    {
        $this->api->require_method('GET');
        $this->call->model('Addon_model');
        $this->api->respond(['data' => array_map(function ($a) {
            return ['id' => $a['id'], 'name' => $a['name'], 'price' => $a['price'], 'has_text' => $a['has_text']];
        }, $this->Addon_model->listing(true))]);
    }

    public function allergens()
    {
        $this->api->require_method('GET');
        $this->call->model('Allergen_model');
        $this->api->respond(['data' => $this->Allergen_model->all()]);
    }

    public function products()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $this->call->model('Product_model');
        $rows = $this->Product_model->search([
            'category'  => $q['category'] ?? null,
            'q'         => $q['q'] ?? null,
            'min'       => $q['min'] ?? null,
            'max'       => $q['max'] ?? null,
            'available' => $this->request->boolean('available'),
            'featured'  => $this->request->boolean('featured'),
            'type'      => $q['type'] ?? null,
            'exclude_allergens' => $q['exclude_allergens'] ?? null,
            'sort'      => $q['sort'] ?? 'featured',
        ]);
        $page = $this->paginate(count($rows), 24);
        $this->api->respond([
            'data' => array_slice($rows, $page['offset'], $page['per_page']),
            'meta' => $this->page_meta($page),
        ]);
    }

    public function product($id)
    {
        $this->api->require_method('GET');
        $this->call->model('Product_model');
        $product = $this->Product_model->detail((int) $id);
        if (!$product || $product['is_archived']) {
            $this->api->respond_error('Product not found.', 404);
        }
        $this->api->respond(['data' => $product]);
    }
}
