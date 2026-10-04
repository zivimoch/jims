<?php

return [
    'default' => 'reverb',
    'servers' => ['reverb' => ['host' => '0.0.0.0', 'port' => 8081, 'hostname' => env('REVERB_HOST'), 'options' => ['tls' => []], 'max_request_size' => 10000, 'scaling' => ['enabled' => false], 'pulse_ingest_interval' => 15, 'telescope_ingest_interval' => 15]],
    'apps' => ['provider' => 'config', 'apps' => [['key' => env('REVERB_APP_KEY'), 'secret' => env('REVERB_APP_SECRET'), 'app_id' => env('REVERB_APP_ID'), 'options' => ['host' => env('REVERB_HOST', 'reverb'), 'port' => 8081, 'scheme' => 'http', 'useTLS' => false], 'allowed_origins' => explode(',', env('REVERB_ALLOWED_ORIGINS', 'localhost,127.0.0.1')), 'ping_interval' => 30, 'activity_timeout' => 60, 'max_connections' => null, 'max_message_size' => 10000]]],
];
