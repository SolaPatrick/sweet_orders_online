<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Zones extends MY_Api_Controller
{
    public function index()
    {
        $this->api->require_method('GET');
        $this->call->model('Zone_model');
        $zones = array_map(function ($z) {
            return ['id' => $z['id'], 'name' => $z['name'], 'city' => $z['city'], 'fee' => $z['fee']];
        }, $this->Zone_model->listing(true));
        $this->api->respond(['data' => $zones, 'fallback_fee' => $zones ? null : config_item('delivery_fee')]);
    }

    public function admin_index()
    {
        $this->api->require_method('GET');
        $this->call->model('Zone_model');
        $this->api->respond(['data' => $this->Zone_model->listing()]);
    }

    public function create()
    {
        $this->api->require_method('POST');
        $this->call->model('Zone_model');
        $data = $this->zone_input();
        $id = $this->Zone_model->insert($data);
        $this->api->respond(['message' => "{$data['name']}, {$data['city']} added.", 'data' => $this->Zone_model->cast($this->Zone_model->find((int) $id))], 201);
    }

    public function update($id)
    {
        $this->api->require_method('PUT');
        $this->call->model('Zone_model');
        $zone = $this->Zone_model->find((int) $id);
        if (!$zone) {
            $this->api->respond_error('Delivery area not found.', 404);
        }
        $this->Zone_model->update((int) $id, $this->zone_input((int) $id, $zone));
        $this->api->respond(['message' => 'Delivery area saved.', 'data' => $this->Zone_model->cast($this->Zone_model->find((int) $id))]);
    }

    public function delete($id)
    {
        $this->api->require_method('DELETE');
        $this->call->model('Zone_model');
        $zone = $this->Zone_model->find((int) $id);
        if (!$zone) {
            $this->api->respond_error('Delivery area not found.', 404);
        }
        $this->Zone_model->delete((int) $id);
        $this->api->respond(['message' => "{$zone['name']}, {$zone['city']} was removed. Past orders keep their address."]);
    }

    public function bulk()
    {
        $this->api->require_method('POST');
        $in = $this->api->body();
        $this->validate($in, [
            'city|City or municipality' => 'required|max_length[100]',
            'zones|Barangays'           => 'required|pattern[array]',
        ]);
        if (count($in['zones']) > 500) {
            $this->fail_validation(['zones' => 'Add at most 500 barangays at a time.']);
        }
        $rows = [];
        foreach (array_values($in['zones']) as $i => $z) {
            $name = trim((string) ($z['name'] ?? ''));
            $fee = $z['fee'] ?? null;
            if ($name === '' || mb_strlen($name) > 100 || !is_numeric($fee) || $fee < 0 || $fee > 10000) {
                $this->fail_validation(["zones.{$i}" => 'Each barangay needs a name and a fee from 0 to 10,000.']);
            }
            $code = trim((string) ($z['psgc_code'] ?? ''));
            $rows[] = ['name' => $name, 'psgc_code' => $code !== '' ? mb_substr($code, 0, 20) : null, 'fee' => round((float) $fee, 2)];
        }

        $this->call->model('Zone_model');
        $city = $in['city'];
        $created = 0;
        $updated = 0;
        $this->db->transaction();
        foreach ($rows as $i => $row) {
            $existing = $this->Zone_model->find_by_name($row['name'], $city);
            if ($existing) {
                $this->Zone_model->update((int) $existing['id'], ['fee' => $row['fee'], 'psgc_code' => $row['psgc_code'] ?? $existing['psgc_code'], 'is_active' => 1]);
                $updated++;
            } else {
                $this->Zone_model->insert(array_merge($row, ['city' => $city, 'is_active' => 1, 'sort_order' => $i + 1]));
                $created++;
            }
        }
        $this->db->commit();
        $this->api->respond([
            'message' => "{$created} delivery area(s) added and {$updated} updated for {$city}.",
            'data'    => $this->Zone_model->listing(),
        ], 201);
    }

    public function psgc_cities()
    {
        $this->api->require_method('GET');
        $q = (string) ($this->api->get_query_params()['q'] ?? '');
        $this->call->library('psgc');
        try {
            $this->api->respond(['data' => $this->psgc->cities($q)]);
        } catch (RuntimeException $e) {
            $this->psgc_down($e);
        }
    }

    public function psgc_barangays($code)
    {
        $this->api->require_method('GET');
        $this->call->library('psgc');
        try {
            $this->api->respond(['city' => $this->psgc->city((string) $code), 'data' => $this->psgc->barangays((string) $code)]);
        } catch (RuntimeException $e) {
            $this->psgc_down($e);
        }
    }

    private function psgc_down(RuntimeException $e): void
    {
        if ($e->getCode() === 404) {
            $this->api->respond_error($e->getMessage(), 404);
        }
        $this->logger->log('error', 'PSGC', $e->getMessage(), $e->getFile(), $e->getLine());
        $this->api->respond_error('The Philippine address list (PSGC) cannot be reached right now. You can still add delivery areas by hand.', 502);
    }

    private function zone_input(?int $id = null, ?array $current = null): array
    {
        $in = $this->api->body();
        $this->validate($in, [
            'name|Barangay or town'       => 'required|max_length[100]',
            'city|City or municipality'   => 'required|max_length[100]',
            'fee|Delivery fee'            => 'required|numeric|greater_than_equal_to[0]',
            'is_active|Active'            => 'in_list["0,1,true,false"]',
            'sort_order|Display order'    => 'greater_than_equal_to[0]|pattern[int]',
            'psgc_code|PSGC code'         => 'max_length[20]',
        ]);
        if ((float) $in['fee'] > 10000) {
            $this->fail_validation(['fee' => 'Delivery fee looks too high.']);
        }
        if ($this->Zone_model->find_by_name($in['name'], $in['city'], $id)) {
            $this->fail_validation(['name' => 'This barangay is already listed for that city.']);
        }
        return [
            'name'       => $in['name'],
            'city'       => $in['city'],
            'fee'        => round((float) $in['fee'], 2),
            'is_active'  => array_key_exists('is_active', $in) ? (int) $this->request->boolean('is_active') : (int) ($current['is_active'] ?? 1),
            'sort_order' => isset($in['sort_order']) && $in['sort_order'] !== '' ? (int) $in['sort_order'] : (int) ($current['sort_order'] ?? 0),
            'psgc_code'  => ($in['psgc_code'] ?? '') !== '' ? $in['psgc_code'] : ($current['psgc_code'] ?? null),
        ];
    }
}
