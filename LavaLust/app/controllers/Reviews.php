<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Reviews extends MY_Api_Controller
{
    public function create($id)
    {
        $this->api->require_method('POST');
        $user = $this->user();
        $this->api->rate_limit('review:' . $user['id'], 20, 600);
        $in = $this->api->body();
        $items = array_key_exists('reviews', $in) ? $in['reviews'] : $in;
        if (!is_array($items) || !$items || array_keys($items) !== range(0, count($items) - 1)) {
            $this->fail_validation(['reviews' => 'Send a list of reviews: product, rating from 1 to 5 and an optional comment.']);
        }

        $this->call->model(['Order_model', 'Review_model']);
        $order = $this->Order_model->detail((int) $id);
        if (!$order || $order['user_id'] !== (int) $user['id']) {
            $this->api->respond_error('Order not found.', 404);
        }
        if ($order['status'] !== 'completed') {
            $this->api->respond_error('You can rate an order once it is completed.', 409);
        }

        $in_order = array_filter(array_column($order['items'], 'product_id'));
        $rows = [];
        $errors = [];
        foreach ($items as $i => $r) {
            $product_id = filter_var($r['product_id'] ?? null, FILTER_VALIDATE_INT);
            $rating = filter_var($r['rating'] ?? null, FILTER_VALIDATE_INT);
            $comment = trim((string) ($r['comment'] ?? ''));
            if ($product_id === false || !in_array($product_id, $in_order, true)) {
                $errors["reviews.{$i}"] = 'This product is not part of the order.';
            } elseif ($rating === false || $rating < 1 || $rating > 5) {
                $errors["reviews.{$i}"] = 'Choose a rating from 1 to 5 stars.';
            } elseif (mb_strlen($comment) > 1000) {
                $errors["reviews.{$i}"] = 'Comments are limited to 1000 characters.';
            } elseif (isset($rows[$product_id]) || $this->Review_model->exists_for((int) $id, $product_id)) {
                $errors["reviews.{$i}"] = 'You already rated this product for this order. Edit your review instead.';
            } else {
                $rows[$product_id] = [
                    'product_id' => $product_id,
                    'order_id'   => (int) $id,
                    'user_id'    => (int) $user['id'],
                    'rating'     => $rating,
                    'comment'    => $comment !== '' ? $comment : null,
                ];
            }
        }
        if ($errors) {
            $this->fail_validation($errors, 'Some reviews need attention.');
        }

        $this->db->transaction();
        foreach ($rows as $row) {
            $this->Review_model->insert($row);
        }
        $this->db->commit();
        $this->api->respond([
            'message' => count($rows) === 1 ? 'Thanks for your review!' : 'Thanks for your reviews!',
            'data'    => $this->Order_model->detail((int) $id)['reviews'],
        ], 201);
    }

    public function update($id)
    {
        $this->api->require_method('PUT');
        $user = $this->user();
        $in = $this->api->body();
        $this->validate($in, [
            'rating|Rating'   => 'required|pattern[int]|greater_than_equal_to[1]',
            'comment|Comment' => 'max_length[1000]',
        ]);
        if ((int) $in['rating'] > 5) {
            $this->fail_validation(['rating' => 'Choose a rating from 1 to 5 stars.']);
        }
        $this->call->model('Review_model');
        $review = $this->Review_model->find((int) $id);
        if (!$review || (int) $review['user_id'] !== (int) $user['id']) {
            $this->api->respond_error('Review not found.', 404);
        }
        $days = (int) config_item('review_edit_days');
        if (strtotime($review['created_at']) < time() - $days * 86400) {
            $this->api->respond_error("Reviews can only be edited within {$days} days.", 409);
        }
        $comment = trim((string) ($in['comment'] ?? ''));
        $this->Review_model->update((int) $id, ['rating' => (int) $in['rating'], 'comment' => $comment !== '' ? $comment : null]);
        $this->api->respond(['message' => 'Your review was updated.', 'data' => $this->Review_model->cast($this->Review_model->find((int) $id))]);
    }

    public function for_product($id)
    {
        $this->api->require_method('GET');
        $this->call->model(['Product_model', 'Review_model']);
        $product = $this->Product_model->detail((int) $id);
        if (!$product || $product['is_archived']) {
            $this->api->respond_error('Product not found.', 404);
        }
        $page = $this->paginate($this->Review_model->count_for_product((int) $id), 10);
        $this->api->respond([
            'data'    => $this->Review_model->for_product((int) $id, $page['per_page'], $page['offset']),
            'meta'    => $this->page_meta($page),
            'summary' => ['rating_avg' => $product['rating_avg'], 'rating_count' => $product['rating_count']],
        ]);
    }

    public function admin_index()
    {
        $this->api->require_method('GET');
        $q = $this->api->get_query_params();
        $this->validate($q, [
            'rating|Rating'   => 'in_list["1,2,3,4,5"]',
            'visible|Visible' => 'in_list["0,1"]',
        ]);
        $filters = ['q' => $q['q'] ?? null, 'rating' => $q['rating'] ?? null, 'visible' => $q['visible'] ?? null];
        $this->call->model('Review_model');
        $page = $this->paginate($this->Review_model->admin_count($filters), 20);
        $this->api->respond([
            'data' => $this->Review_model->admin_search($filters, $page['per_page'], $page['offset']),
            'meta' => $this->page_meta($page),
        ]);
    }

    public function admin_update($id)
    {
        $this->api->require_method('PUT');
        $in = $this->api->body();
        $this->validate($in, ['is_visible|Visible' => 'required|in_list["0,1,true,false"]']);
        $this->call->model('Review_model');
        if (!$this->Review_model->find((int) $id)) {
            $this->api->respond_error('Review not found.', 404);
        }
        $visible = (int) $this->request->boolean('is_visible');
        $this->Review_model->update((int) $id, ['is_visible' => $visible]);
        $this->api->respond([
            'message' => $visible ? 'The review is visible again.' : 'The review is now hidden from the menu.',
            'data'    => $this->Review_model->cast($this->Review_model->find((int) $id)),
        ]);
    }
}
