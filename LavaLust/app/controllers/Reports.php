<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Reports extends MY_Api_Controller
{
    const MAX_DAYS = 366;

    public function sales()
    {
        $this->api->require_method('GET');
        $in = array_merge(
            ['from' => date('Y-m-01'), 'to' => date('Y-m-d')],
            array_filter($this->api->get_query_params(), function ($v) { return $v !== ''; })
        );
        $this->validate($in, [
            'from|From' => ['required|pattern[date_ymd]', self::DATE_PATTERN],
            'to|To'     => ['required|pattern[date_ymd]', self::DATE_PATTERN],
        ]);
        foreach (['from' => 'From', 'to' => 'To'] as $field => $label) {
            [$y, $m, $d] = array_map('intval', explode('-', $in[$field]));
            if (!checkdate($m, $d, $y)) {
                $this->fail_validation([$field => "{$label} is not a real calendar date."]);
            }
        }
        if ($in['to'] < $in['from']) {
            $message = 'The end date cannot be before the start date.';
            $this->fail_validation(['to' => $message], $message);
        }
        $days = (int) round((strtotime($in['to']) - strtotime($in['from'])) / 86400) + 1;
        if ($days > self::MAX_DAYS) {
            $message = 'Please pick a range of ' . self::MAX_DAYS . ' days or fewer.';
            $this->fail_validation(['to' => $message], $message);
        }
        $this->call->model('Report_model');
        $this->api->respond($this->Report_model->sales($in['from'], $in['to']));
    }
}
