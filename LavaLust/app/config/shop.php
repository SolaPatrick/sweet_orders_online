<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

$config['frontend_url']       = rtrim(getenv('FRONTEND_URL') ?: 'http://localhost:5173', '/');
$config['delivery_fee']       = round((float) (getenv('DELIVERY_FEE') ?: 100), 2);
$config['order_hold_minutes'] = max(5, (int) (getenv('ORDER_HOLD_MINUTES') ?: 60));
$config['cafe_email']         = getenv('CAFE_EMAIL') ?: (getenv('MAIL_FROM') ?: 'cafe@localhost');

$config['paymongo_secret_key']     = getenv('PAYMONGO_SECRET_KEY') ?: '';
$config['paymongo_webhook_secret'] = getenv('PAYMONGO_WEBHOOK_SECRET') ?: '';
$config['paymongo_methods']        = getenv('PAYMONGO_METHODS') ?: 'gcash,card';

$config['smtp_host']      = getenv('SMTP_HOST') ?: '';
$config['smtp_port']      = (int) (getenv('SMTP_PORT') ?: 587);
$config['smtp_secure']    = strtolower(getenv('SMTP_SECURE') ?: ($config['smtp_port'] === 465 ? 'ssl' : 'tls'));
$config['smtp_user']      = getenv('SMTP_USER') ?: '';
$config['smtp_password']  = getenv('SMTP_PASSWORD') ?: '';
$config['mail_from']      = trim((string) getenv('MAIL_FROM')) ?: $config['smtp_user'];
$config['mail_from_name'] = trim((string) getenv('MAIL_FROM_NAME'), " \"'") ?: "Clayanna's Café";

$config['sms_provider']      = strtolower(getenv('SMS_PROVIDER') ?: 'textbee');
$config['textbee_api_key']   = getenv('TEXTBEE_API_KEY') ?: '';
$config['textbee_device_id'] = getenv('TEXTBEE_DEVICE_ID') ?: '';
$config['vonage_api_key']    = getenv('VONAGE_API_KEY') ?: '';
$config['vonage_api_secret'] = getenv('VONAGE_API_SECRET') ?: '';
$config['vonage_from']       = getenv('VONAGE_FROM') ?: 'Clayanna';

$config['cloudinary_url'] = trim((string) getenv('CLOUDINARY_URL'), " \"'");
