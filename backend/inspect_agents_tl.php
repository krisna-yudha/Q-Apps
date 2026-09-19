<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Agent;
use App\Models\Employee;

echo "Total agents: " . Agent::count() . "\n";
echo "Total employees: " . Employee::count() . "\n";

$agents = Agent::where('name', 'like', '%NIA%')
    ->orWhere('name', 'like', '%WANDANI%')
    ->orWhere('name', 'like', '%NURIL%')
    ->orWhere('name', 'like', '%PUTRI%')
    ->orWhere('name', 'like', '%DINDA%')
    ->orWhere('name', 'like', '%DYAH%')
    ->get();

foreach ($agents as $a) {
    echo "Agent: [{$a->id}] {$a->name} | NIK: {$a->nik} | Channel: {$a->channel} | TL_ID: {$a->team_leader_id} | TRN_ID: {$a->trainer_id}\n";
    $tl = $a->teamLeader ? $a->teamLeader->name : 'NULL';
    $trn = $a->trainer ? $a->trainer->name : 'NULL';
    echo "  -> Relations: TL: $tl | TRN: $trn\n";
    
    // Check Employee
    $emp = Employee::where('name', 'like', '%' . trim(explode(' ', $a->name)[0]) . '%')
        ->with(['currentAssignment.teamLeader', 'currentAssignment.trainer'])
        ->first();
    if ($emp) {
        $empTl = $emp->currentAssignment?->teamLeader?->name ?? 'NULL';
        $empTrn = $emp->currentAssignment?->trainer?->name ?? 'NULL';
        echo "  -> Matching Employee (Master NAKER): [{$emp->id}] {$emp->name} | SIP: {$emp->sip_id} | TL: $empTl | TRN: $empTrn\n";
    } else {
        echo "  -> No matching Employee in Master NAKER\n";
    }
}
