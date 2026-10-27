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
        $lead = max(0, (int) $this->request->query('lead_hours', 0));

        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $earliest = time() + $lead * 3600;
        $slots = array_map(function ($s) use ($earliest) {
            $s['too_soon'] = strtotime($s['slot_date'] . ' ' . $s['start_time']) < $earliest;
            $s['available'] = !$s['is_blocked'] && !$s['is_full'] && !$s['too_soon'];
            return $s;
        }, $this->Slot_model->for_date($in['date'], $in['fulfillment']));

        $this->api->respond(['data' => $slots, 'meta' => ['earliest' => date('Y-m-d H:i:s', $earliest)]]);
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
        $this->api->respond([
            'data'          => $this->Slot_model->date_summary($from, $to, $fulfillment ?: null),
            'blocked_dates' => $this->Slot_model->blocked_dates($from),
            'delivery_fee'  => config_item('delivery_fee'),
        ]);
    }
}
