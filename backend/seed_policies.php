<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\PolicyDiscussion;

// Clear any old/dummy policy records
PolicyDiscussion::truncate();

echo "Policy repository table policy_discussions has been cleared." . PHP_EOL;
