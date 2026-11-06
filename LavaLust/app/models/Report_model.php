<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Report_model extends Model
{
    const TOP_PRODUCTS = 10;

    public function sales(string $from, string $to): array
    {
        $start = $from . ' 00:00:00';
        $end = date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00';

        $payments = $this->db->table('payments')
            ->select('order_id, method, amount, paid_at')
            ->where('status', 'paid')
            ->where('paid_at', '>=', $start)
            ->where('paid_at', '<', $end)
            ->order_by('paid_at')
            ->get_all();
        $refunds = $this->db->table('orders')
            ->select('id, refund_amount, refunded_at')
            ->where('payment_status', 'refunded')
            ->where('refunded_at', '>=', $start)
            ->where('refunded_at', '<', $end)
            ->get_all();

        $paid_ids = array_values(array_unique(array_map('intval', array_column($payments, 'order_id'))));
        $refund_ids = array_map('intval', array_column($refunds, 'id'));
        $orders = $this->orders(array_values(array_unique(array_merge($paid_ids, $refund_ids))));
        $lines = $this->lines(array_keys($orders));

        $days = [];
        for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) {
            $days[$d] = ['date' => $d, 'gross' => 0.0, 'refunds' => 0.0, 'net' => 0.0, 'order_ids' => []];
        }
        $methods = [];
        $fulfillment = [
            'pickup'   => ['fulfillment' => 'pickup', 'order_ids' => [], 'total' => 0.0],
            'delivery' => ['fulfillment' => 'delivery', 'order_ids' => [], 'total' => 0.0],
        ];
        $sources = [];
        foreach (['online', 'walk_in', 'phone'] as $s) {
            $sources[$s] = ['source' => $s, 'order_ids' => [], 'total' => 0.0];
        }
        $paid_in_period = [];
        foreach ($payments as $p) {
            $id = (int) $p['order_id'];
            $amount = (float) $p['amount'];
            $paid_in_period[$id] = ($paid_in_period[$id] ?? 0) + $amount;
            $day = substr($p['paid_at'], 0, 10);
            $days[$day]['gross'] += $amount;
            $days[$day]['order_ids'][$id] = true;
            $method = $p['method'] ?: 'other';
            $methods[$method] = $methods[$method] ?? ['method' => $method, 'payments' => 0, 'total' => 0.0];
            $methods[$method]['payments']++;
            $methods[$method]['total'] += $amount;
            $type = $orders[$id]['fulfillment'];
            $fulfillment[$type]['order_ids'][$id] = true;
            $fulfillment[$type]['total'] += $amount;
            $source = $orders[$id]['source'];
            $sources[$source]['order_ids'][$id] = true;
            $sources[$source]['total'] += $amount;
        }
        $refunded_in_period = [];
        foreach ($refunds as $r) {
            $amount = (float) $r['refund_amount'];
            $refunded_in_period[(int) $r['id']] = $amount;
            $days[substr($r['refunded_at'], 0, 10)]['refunds'] += $amount;
        }

        $gross = array_sum($paid_in_period);
        $refunded = array_sum($refunded_in_period);
        $delivery_fees = 0.0;
        $addons_total = 0.0;
        $items_sold = 0;
        $products = [];
        foreach ($paid_ids as $id) {
            $delivery_fees += (float) $orders[$id]['delivery_fee'];
            $addons_total += $lines['addons'][$id] ?? 0;
            $items_sold += $lines['quantity'][$id] ?? 0;
            foreach ($lines['products'][$id] ?? [] as $key => $line) {
                $products[$key] = $products[$key] ?? ['name' => $line['name'], 'quantity' => 0, 'revenue' => 0.0];
                $products[$key]['quantity'] += $line['quantity'];
                $products[$key]['revenue'] += $line['revenue'];
            }
        }

        $rows = [];
        foreach ($orders as $id => $o) {
            $rows[] = [
                'id'                 => $id,
                'order_number'       => $o['order_number'],
                'paid_at'            => $o['paid_at'],
                'customer_name'      => $o['guest_name'] ?? $o['customer_name'],
                'source'             => $o['source'],
                'entered_by'         => $o['entered_by'],
                'fulfillment'        => $o['fulfillment'],
                'items_count'        => $lines['quantity'][$id] ?? 0,
                'subtotal'           => (float) $o['subtotal'],
                'addons_total'       => round($lines['addons'][$id] ?? 0, 2),
                'delivery_fee'       => (float) $o['delivery_fee'],
                'total'              => (float) $o['total'],
                'payment_method'     => $o['payment_method'],
                'reference'          => $o['reference'],
                'status'             => $o['status'],
                'payment_status'     => $o['payment_status'],
                'refund_amount'      => (float) $o['refund_amount'],
                'refunded_at'        => $o['refunded_at'],
                'paid_in_period'     => round($paid_in_period[$id] ?? 0, 2),
                'refunded_in_period' => round($refunded_in_period[$id] ?? 0, 2),
            ];
        }
        usort($rows, function ($a, $b) {
            return strcmp((string) $b['paid_at'], (string) $a['paid_at']) ?: $b['id'] - $a['id'];
        });

        usort($methods, function ($a, $b) { return $b['total'] <=> $a['total']; });

        return [
            'from'   => $from,
            'to'     => $to,
            'totals' => [
                'gross_paid'          => round($gross, 2),
                'refunds'             => round($refunded, 2),
                'net'                 => round($gross - $refunded, 2),
                'paid_orders'         => count($paid_ids),
                'average_order_value' => $paid_ids ? round($gross / count($paid_ids), 2) : 0.0,
                'delivery_fees'       => round($delivery_fees, 2),
                'addons_total'        => round($addons_total, 2),
                'items_sold'          => $items_sold,
            ],
            'by_method' => array_map(function ($m) {
                $m['total'] = round($m['total'], 2);
                return $m;
            }, array_values($methods)),
            'by_fulfillment' => array_map(function ($f) {
                return ['fulfillment' => $f['fulfillment'], 'orders' => count($f['order_ids']), 'total' => round($f['total'], 2)];
            }, array_values($fulfillment)),
            'by_source' => array_map(function ($s) {
                return ['source' => $s['source'], 'orders' => count($s['order_ids']), 'total' => round($s['total'], 2)];
            }, array_values($sources)),
            'days' => array_map(function ($d) {
                return [
                    'date'    => $d['date'],
                    'gross'   => round($d['gross'], 2),
                    'refunds' => round($d['refunds'], 2),
                    'net'     => round($d['gross'] - $d['refunds'], 2),
                    'orders'  => count($d['order_ids']),
                ];
            }, array_values($days)),
            'top_by_quantity' => $this->top($products, 'quantity', 'revenue'),
            'top_by_revenue'  => $this->top($products, 'revenue', 'quantity'),
            'orders'          => $rows,
        ];
    }

    private function top(array $products, string $first, string $second): array
    {
        usort($products, function ($a, $b) use ($first, $second) {
            return ($b[$first] <=> $a[$first]) ?: ($b[$second] <=> $a[$second]) ?: strcmp($a['name'], $b['name']);
        });
        return array_map(function ($p) {
            $p['revenue'] = round($p['revenue'], 2);
            return $p;
        }, array_slice($products, 0, self::TOP_PRODUCTS));
    }

    private function orders(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $rows = $this->db->table('orders o')
            ->select('o.id, o.order_number, o.fulfillment, o.subtotal, o.delivery_fee, o.total, o.status, o.payment_status, o.refund_amount, o.refunded_at, o.source, o.guest_name, u.name AS customer_name, cb.name AS entered_by')
            ->inner_join('users u', 'u.id = o.user_id')
            ->left_join('users cb', 'cb.id = o.created_by')
            ->in('o.id', $ids)
            ->get_all();
        $orders = [];
        foreach ($rows as $o) {
            $o += ['paid_at' => null, 'payment_method' => null, 'reference' => null];
            $orders[(int) $o['id']] = $o;
        }
        $paid = $this->db->table('payments')
            ->select('order_id, method, reference, paid_at')
            ->where('status', 'paid')
            ->in('order_id', $ids)
            ->order_by('paid_at')
            ->get_all();
        foreach ($paid as $p) {
            $id = (int) $p['order_id'];
            $orders[$id]['paid_at'] = $p['paid_at'];
            $orders[$id]['payment_method'] = $p['method'];
            $orders[$id]['reference'] = $p['reference'];
        }
        return $orders;
    }

    private function lines(array $order_ids): array
    {
        $out = ['quantity' => [], 'addons' => [], 'products' => []];
        if (!$order_ids) {
            return $out;
        }
        $items = $this->db->table('order_items')
            ->select('order_id, product_id, product_name, quantity, line_total')
            ->in('order_id', $order_ids)
            ->get_all();
        foreach ($items as $i) {
            $id = (int) $i['order_id'];
            $quantity = (int) $i['quantity'];
            $key = $i['product_id'] !== null ? 'id:' . $i['product_id'] : 'name:' . $i['product_name'];
            $out['quantity'][$id] = ($out['quantity'][$id] ?? 0) + $quantity;
            $out['products'][$id][$key] = $out['products'][$id][$key] ?? ['name' => $i['product_name'], 'quantity' => 0, 'revenue' => 0.0];
            $out['products'][$id][$key]['quantity'] += $quantity;
            $out['products'][$id][$key]['revenue'] += (float) $i['line_total'];
        }
        $addons = $this->db->table('order_item_addons a')
            ->select('i.order_id, a.price, i.quantity')
            ->inner_join('order_items i', 'i.id = a.order_item_id')
            ->in('i.order_id', $order_ids)
            ->get_all();
        foreach ($addons as $a) {
            $id = (int) $a['order_id'];
            $out['addons'][$id] = ($out['addons'][$id] ?? 0) + (float) $a['price'] * (int) $a['quantity'];
        }
        return $out;
    }
}
