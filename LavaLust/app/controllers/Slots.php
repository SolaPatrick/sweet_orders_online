<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/** Pickup and delivery scheduling (FR4). Page: C5 Checkout. */
class Slots extends MY_Api_Controller
{
    /**
     * GET /api/slots?date=YYYY-MM-DD&fulfillment=pickup|delivery&lead_hours=48
     * Slots for one date. Slots inside the lead time are marked too_soon.
     */
    public function index()
    {
        $in = ['date' => $this->query('date'), 'fulfillment' => $this->query('fulfillment')];
        $this->validate($in, ['date' => 'required|date', 'fulfillment' => 'required|in:pickup,delivery']);
        $lead = max(0, (int) $this->query('lead_hours', 0));

        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $earliest = time() + $lead * 3600;
        $slots = array_map(function ($s) use ($earliest) {
            $s['too_soon'] = strtotime($s['slot_date'] . ' ' . $s['start_time']) < $earliest;
            $s['available'] = !$s['is_blocked'] && !$s['is_full'] && !$s['too_soon'];
            return $s;
        }, $this->Slot_model->for_date($in['date'], $in['fulfillment']));

        $this->json(['data' => $slots, 'meta' => ['earliest' => date('Y-m-d H:i:s', $earliest)]]);
    }

    /** GET /api/slots/dates?fulfillment=pickup&days=14  Dates with open places, and blocked dates. */
    public function dates()
    {
        $fulfillment = $this->query('fulfillment');
        if ($fulfillment && !in_array($fulfillment, ['pickup', 'delivery'], true)) {
            $this->error('Please fix the highlighted fields.', 422, ['fulfillment' => 'Fulfillment must be pickup or delivery.']);
        }
        $days = min(60, max(1, (int) $this->query('days', 14)));
        $this->call->model('Slot_model');
        $this->Slot_model->release_expired_holds();
        $from = date('Y-m-d');
        $to = date('Y-m-d', strtotime("+{$days} days"));
        $this->json([
            'data'          => $this->Slot_model->date_summary($from, $to, $fulfillment ?: null),
            'blocked_dates' => $this->Slot_model->blocked_dates($from),
            'delivery_fee'  => round((float) (getenv('DELIVERY_FEE') ?: 100), 2),
        ]);
    }
}
