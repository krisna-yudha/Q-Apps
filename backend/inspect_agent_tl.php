<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Agent;
use App\Models\Employee;
use App\Models\EmployeeAssignment;

echo "=== LOCAL DB STATS ===" . PHP_EOL;
echo "Total Employees: " . Employee::count() . PHP_EOL;
echo "Total EmployeeAssignments: " . EmployeeAssignment::count() . PHP_EOL;
echo "Total Agents: " . Agent::count() . PHP_EOL;

echo PHP_EOL . "=== SEARCH EMPLOYEES BY SIMILAR NAMES ===" . PHP_EOL;
$searchList = ['NIA', 'RAHMAWATI', 'WANDANI', 'SIREGAR', 'NURIL', 'AKBAR', 'PUTRI', 'EKAWATI', 'DINDA', 'APRILYANA'];
foreach ($searchList as $s) {
    $found = Employee::where('name', 'like', "%{$s}%")->with(['currentAssignment.teamLeader', 'currentAssignment.trainer'])->get();
    echo "Query '{$s}': found " . $found->count() . PHP_EOL;
    foreach ($found as $f) {
        $tl = $f->currentAssignment?->teamLeader?->name ?? 'None';
        $trn = $f->currentAssignment?->trainer?->name ?? 'None';
        echo "  - {$f->name} (SIP: {$f->sip_id}) => TL: {$tl} | TRN: {$trn}" . PHP_EOL;
    }
}
