<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Product catalog (FR2). Pages: C1 Home, C2 Menu, C3 Product details. */
class Catalog extends MY_Api_Controller
{
    /** GET /api/categories */
    public function categories()
    {
        $this->call->model('Category_model');
        $rows = array_map(function ($c) {
            return [
                'id'            => (int) $c['id'],
                'name'          => $c['name'],
                'slug'          => $c['slug'],
                'sort_order'    => (int) $c['sort_order'],
                'product_count' => (int) $c['product_count'],
            ];
        }, $this->Category_model->all_with_counts());
        $this->json(['data' => $rows]);
    }

    /** GET /api/products?category=&q=&min=&max=&available=1&featured=1&sort=&page=&per_page= */
    public function products()
    {
        [$page, $per_page, $offset] = $this->pagination_params(24);
        $this->call->model('Product_model');
        [$rows, $total] = $this->Product_model->search([
            'category'  => $this->query('category'),
            'q'         => $this->query('q'),
            'min'       => $this->query('min'),
            'max'       => $this->query('max'),
            'available' => $this->query('available'),
            'featured'  => $this->query('featured'),
            'sort'      => $this->query('sort', 'featured'),
        ], $per_page, $offset);
        $this->json(['data' => $rows, 'meta' => ['page' => $page, 'per_page' => $per_page, 'total' => $total]]);
    }

    /** GET /api/products/{id} */
    public function product($id)
    {
        $this->call->model('Product_model');
        $product = $this->Product_model->detail((int) $id);
        if (!$product) {
            $this->error('Product not found.', 404);
        }
        $this->json(['data' => $product]);
    }
}
