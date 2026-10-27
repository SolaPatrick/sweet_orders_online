<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Cloudinary
{
    private const API = 'https://api.cloudinary.com/v1_1/';
    private const FOLDER = 'sweet-orders/products';

    private function config(): ?array
    {
        $url = (string) config_item('cloudinary_url');
        if (!preg_match('#^cloudinary://([^:]+):([^@]+)@([^/?\s]+)#', $url, $m)) {
            return null;
        }
        return [$m[3], $m[1], $m[2]];
    }

    public function enabled(): bool
    {
        return $this->config() !== null;
    }

    public function upload(string $path): string
    {
        [$cloud, $key, $secret] = $this->config();
        $params = ['folder' => self::FOLDER, 'timestamp' => (string) time()];
        $result = $this->post($cloud . '/image/upload', $params + [
            'file'      => new CURLFile($path),
            'api_key'   => $key,
            'signature' => $this->sign($params, $secret),
        ]);
        if (empty($result['secure_url'])) {
            throw new RuntimeException($result['error']['message'] ?? 'Cloudinary did not return a photo URL.');
        }
        return $result['secure_url'];
    }

    public function delete(string $url): void
    {
        $public_id = self::public_id($url);
        if ($public_id === null || !$this->enabled()) {
            return;
        }
        [$cloud, $key, $secret] = $this->config();
        $params = ['public_id' => $public_id, 'timestamp' => (string) time()];
        try {
            $this->post($cloud . '/image/destroy', $params + [
                'api_key'   => $key,
                'signature' => $this->sign($params, $secret),
            ]);
        } catch (RuntimeException $e) {
        }
    }

    public static function public_id(string $url): ?string
    {
        if (!preg_match('#^https://res\.cloudinary\.com/[^/]+/image/upload/(?:v\d+/)?(.+)\.[a-z0-9]+$#i', $url, $m)) {
            return null;
        }
        return rawurldecode($m[1]);
    }

    private function sign(array $params, string $secret): string
    {
        ksort($params);
        $pairs = [];
        foreach ($params as $name => $value) {
            $pairs[] = $name . '=' . $value;
        }
        return sha1(implode('&', $pairs) . $secret);
    }

    private function post(string $endpoint, array $fields): array
    {
        $ch = curl_init(self::API . $endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $fields,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
        ]);
        $response = curl_exec($ch);
        if ($response === false) {
            throw new RuntimeException('Could not reach Cloudinary: ' . curl_error($ch));
        }
        $data = json_decode((string) $response, true);
        if (!is_array($data)) {
            throw new RuntimeException('Cloudinary sent an unexpected reply.');
        }
        return $data;
    }
}
