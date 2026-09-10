<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$nakerBatch = DB::table('import_batches')->latest('id')->first();
if ($nakerBatch) {
    echo "Latest batch ID: {$nakerBatch->id}, file: {$nakerBatch->original_filename}\n";
    $rows = DB::table('import_rows')->where('import_batch_id', $nakerBatch->id)->get();
    echo "Total rows: " . $rows->count() . "\n";
    $layananSet = [];
    foreach ($rows as $r) {
        $data = json_decode($r->raw_data, true);
        $lay = $data['LAYANAN'] ?? ($data['Layanan'] ?? ($data['Channel'] ?? ''));
        if ($lay) $layananSet[$lay] = ($layananSet[$lay] ?? 0) + 1;
    }
    echo "Distinct LAYANAN in batch:\n";
    foreach ($layananSet as $k => $v) {
        echo "  - $k: $v\n";
    }
} else {
    echo "No import batches found.\n";
}

echo "Current services:\n";
foreach (DB::table('services')->get() as $s) {
    echo "  ID {$s->id}: code={$s->code}, name={$s->name}\n";
}
