<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Slots extends MY_Api_Controller
{
    public function index()
    {
        $this->api->require_method('GET');
        $in = $this->api->get_query_params();
        $this->validate($in, [
            'date|Date'               => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'fulfillment|Fulfillment' => 'required|in_list["pickup,delivery"]',
        ]);
        $lead = $this->lead_time();

        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $earliest = time() + $lead['hours'] * 3600;
        $slots = array_map(function ($s) use ($earliest) {
            $s['too_soon'] = strtotime($s['slot_date'] . ' ' . $s['start_time']) < $earliest;
            $s['available'] = !$s['is_blocked'] && !$s['is_full'] && !$s['too_soon'];
            return $s;
        }, $this->Slot_model->for_date($in['date'], $in['fulfillment']));

        $this->api->respond(['data' => $slots, 'meta' => [
            'earliest'   => date('Y-m-d H:i:s', $earliest),
            'lead_hours' => $lead['hours'],
            'lead_item'  => $lead['item'],
        ]]);
    }

    public function dates()
    {
        $this->api->require_method('GET');
        $in = $this->api->get_query_params();
        $this->validate($in, ['fulfillment|Fulfillment' => 'in_list["pickup,delivery"]'], [
            'fulfillment' => ['in_list' => 'Fulfillment must be pickup or delivery.'],
        ]);
        $fulfillment = $in['fulfillment'] ?? null;
        $days = min(60, max(1, (int) $this->request->query('days', 14)));
        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $from = date('Y-m-d');
        $to = date('Y-m-d', strtotime("+{$days} days"));
        $lead = $this->lead_time();
        $earliest = time() + $lead['hours'] * 3600;
        $calendar = $this->Slot_model->calendar($from, $to, $fulfillment ?: null, $earliest);
        $status = array_column($calendar, 'status', 'date');
        $data = array_map(function ($d) use ($status) {
            $d['status'] = $status[$d['date']] ?? 'closed';
            return $d;
        }, $this->Slot_model->date_summary($from, $to, $fulfillment ?: null));
        $first = array_values(array_filter($calendar, function ($d) {
            return $d['status'] === 'open';
        }))[0]['date'] ?? null;

        $this->api->respond([
            'data'          => $data,
            'days'          => $calendar,
            'blocked_dates' => $this->Slot_model->blocked_dates($from),
            'delivery_fee'  => config_item('delivery_fee'),
            'meta'          => [
                'today'         => $from,
                'earliest'      => date('Y-m-d H:i:s', $earliest),
                'earliest_date' => $first,
                'lead_hours'    => $lead['hours'],
                'lead_item'     => $lead['item'],
            ],
        ]);
    }

    private function lead_time(): array
    {
        $hours = max(0, (int) $this->request->query('lead_hours', 0));
        $ids = array_filter(array_map('intval', explode(',', (string) $this->request->query('product_ids', ''))));
        $item = null;
        if ($ids) {
            $this->call->model('Product_model');
            $item = $this->Product_model->slowest(array_slice($ids, 0, 50));
            $hours = max($hours, $item['lead_time_hours'] ?? 0);
        }
        return ['hours' => min($hours, 1440), 'item' => $item];
    }
}
