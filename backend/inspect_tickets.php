<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== SAMPLING ASSIGNMENTS ===" . PHP_EOL;
$assignments = App\Models\SamplingAssignment::select(
    'evaluator_id',
    'status',
    Illuminate\Support\Facades\DB::raw('COUNT(*) as count')
)->groupBy('evaluator_id', 'status')->get();

foreach ($assignments as $a) {
    $evalUser = App\Models\User::find($a->evaluator_id);
    echo " - Evaluator: " . ($evalUser?->name ?? $a->evaluator_id) . " | Status: {$a->status} | Count: {$a->count}" . PHP_EOL;
}

echo PHP_EOL . "=== CA ASSESSMENTS BY QA & PERIOD ===" . PHP_EOL;
$assessmentsByQa = App\Models\CaAssessment::select(
    Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7) as period"),
    'qa_name',
    Illuminate\Support\Facades\DB::raw("COUNT(*) as total_samples")
)->groupBy('period', 'qa_name')->get();

foreach ($assessmentsByQa as $a) {
    echo " - Period: {$a->period} | QA: {$a->qa_name} | Total: {$a->total_samples}" . PHP_EOL;
}
