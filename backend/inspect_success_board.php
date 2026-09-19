<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== EVALUATOR SAMPLING DATA ===" . PHP_EOL;
$evalSamplings = App\Models\EvaluatorSampling::all();
echo "Total rows in evaluator_samplings: " . $evalSamplings->count() . PHP_EOL;
foreach ($evalSamplings as $es) {
    echo " - Period: {$es->period_month} | Type: {$es->type} | Evaluator: {$es->evaluator_name} | Quota: {$es->quota} | Actual: {$es->actual} | Status: {$es->status}" . PHP_EOL;
}

echo PHP_EOL . "=== CA ASSESSMENTS BY PERIOD & QA ===" . PHP_EOL;
$assessmentsByQa = App\Models\CaAssessment::select(
    Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7) as period"),
    'qa_name',
    Illuminate\Support\Facades\DB::raw("COUNT(*) as total_samples")
)->groupBy('period', 'qa_name')->get();

foreach ($assessmentsByQa as $a) {
    echo " - Period: {$a->period} | QA: {$a->qa_name} | Total: {$a->total_samples}" . PHP_EOL;
}

App\Models\Trainer::where('name', 'like', '%Siti%')->delete();

echo PHP_EOL . "=== TRAINERS IN DB ===" . PHP_EOL;
foreach (App\Models\Trainer::all() as $t) {
    $agCount = App\Models\Agent::where('trainer_id', $t->id)->count();
    $empCount = App\Models\EmployeeAssignment::where('trainer_id', $t->id)->count();
    echo "ID: {$t->id} | Name: {$t->name} | is_active: {$t->is_active} | Agents: {$agCount} | EmployeeAssignments: {$empCount}" . PHP_EOL;
}

