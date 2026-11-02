<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Psgc
{
    private $_lava;

    public function __construct()
    {
        $this->_lava = lava_instance();
        $this->_lava->call->library('cache');
    }

    public function cities(string $q = '', int $limit = 30): array
    {
        $all = $this->cached('psgc_cities', function () {
            $provinces = [];
            foreach ($this->get_json('/provinces.json') as $p) {
                $provinces[$p['code']] = $p['name'];
            }
            $districts = [];
            foreach ($this->get_json('/districts.json') as $d) {
                $districts[$d['code']] = 'Metro Manila';
            }
            $cities = [];
            foreach ($this->get_json('/cities-municipalities.json') as $c) {
                $cities[] = [
                    'code'     => (string) $c['code'],
                    'name'     => $c['name'],
                    'province' => $provinces[$c['provinceCode'] ?? ''] ?? ($districts[$c['districtCode'] ?? ''] ?? null),
                    'is_city'  => (bool) ($c['isCity'] ?? false),
                ];
            }
            usort($cities, function ($a, $b) {
                return strnatcasecmp($a['name'], $b['name']);
            });
            return $cities;
        });

        $q = mb_strtolower(trim($q));
        if ($q === '') {
            return $this->by_name(array_slice($all, 0, $limit));
        }
        $starts = [];
        $contains = [];
        foreach ($all as $c) {
            $haystack = mb_strtolower($c['name'] . ' ' . $c['province']);
            $pos = mb_strpos($haystack, $q);
            if ($pos === 0 || mb_strpos(mb_strtolower(preg_replace('/^City of /i', '', $c['name'])), $q) === 0) {
                $starts[] = $c;
            } elseif ($pos !== false) {
                $contains[] = $c;
            }
        }
        return $this->by_name(array_slice(array_merge($starts, $contains), 0, $limit));
    }

    private function by_name(array $rows): array
    {
        usort($rows, function ($a, $b) {
            return place_compare($a['name'], $b['name']) ?: place_compare((string) ($a['province'] ?? ''), (string) ($b['province'] ?? ''));
        });
        return $rows;
    }

    public function city(string $code)
    {
        foreach ($this->cities('', PHP_INT_MAX) as $c) {
            if ($c['code'] === $code) {
                return $c;
            }
        }
        return null;
    }

    public function barangays(string $code): array
    {
        return $this->by_name($this->cached('psgc_barangays_' . preg_replace('/\D/', '', $code), function () use ($code) {
            return array_map(function ($b) {
                return ['code' => (string) $b['code'], 'name' => $b['name']];
            }, $this->get_json('/cities-municipalities/' . rawurlencode($code) . '/barangays.json'));
        }));
    }

    private function cached(string $key, callable $load): array
    {
        $hit = $this->_lava->cache->get($key);
        if (is_array($hit)) {
            return $hit;
        }
        $data = $load();
        $this->_lava->cache->write($data, $key, config_item('psgc_cache_seconds'));
        return $data;
    }

    private function get_json(string $path): array
    {
        [$code, $body] = $this->http_get(config_item('psgc_api_url') . $path);
        if ($code === 404) {
            throw new RuntimeException('The address list does not have that city or municipality.', 404);
        }
        if ($code >= 300) {
            throw new RuntimeException("The PSGC address service answered with error {$code}.");
        }
        $json = json_decode($body, true);
        if (!is_array($json)) {
            throw new RuntimeException('The PSGC address service sent data we could not read.');
        }
        return $json;
    }

    private function http_get(string $url): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPGET        => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            throw new RuntimeException('HTTP request failed: ' . $error);
        }
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return [$code, (string) $response];
    }
}
