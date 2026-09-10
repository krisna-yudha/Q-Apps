<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('qapps:sync-fcr', function () {
    $this->info('Starting FCR Synchronization for Back Office and All Channels...');

    // 1. Update Back Office assessments FCR (SLA & escalation resolution: CA >= 85%)
    $boService = \App\Models\Service::where('code', 'BACK_OFFICE')->first();
    $boUpdated = \App\Models\CaAssessment::where(function ($q) use ($boService) {
            $q->where('source_layanan', 'Back Office')
              ->orWhere('source_layanan', 'BACK_OFFICE');
            if ($boService) {
                $q->orWhere('service_id', $boService->id);
            }
        })
        ->where('score_ca', '>=', 85)
        ->update(['fcr' => 'YA']);

    $this->info("Updated {$boUpdated} Back Office assessments with FCR = YA.");

    // 2. Recalculate Agent Rollup Scores for all agents
    $agents = \App\Models\Agent::all();
    $recalculatedCount = 0;
    foreach ($agents as $ag) {
        $agAssessments = \App\Models\CaAssessment::where('agent_id', $ag->id)->get();
        if ($agAssessments->count() > 0) {
            $avgCa = (float)$agAssessments->avg('score_ca');
            $fcrYesCount = $agAssessments->where('fcr', 'YA')->count();
            $avgFcr = ($fcrYesCount / $agAssessments->count()) * 100;

            $status = 'Meet Target';
            if ($avgCa >= 96) $status = 'Exceed Target';
            elseif ($avgCa < 85) $status = 'Need Coaching';

            $ag->update([
                'ca_score' => round($avgCa, 1),
                'fcr_score' => round($avgFcr, 1),
                'evaluation_count' => $agAssessments->count(),
                'status' => $status
            ]);
            $recalculatedCount++;
        }
    }

    $this->info("Recalculated rollup scores for {$recalculatedCount} agents.");

    // 3. Recalculate Monthly Trend and Update Standard Targets (CA: 85%, FCR: 100%)
    \App\Models\MonthlyTrend::query()->update([
        'target_ca' => 85.0,
        'target_fcr' => 100.0,
    ]);

    $globalAvgCa = \App\Models\CaAssessment::avg('score_ca') ?: 0;
    $globalFcrCount = \App\Models\CaAssessment::where('fcr', 'YA')->count();
    $globalTotal = \App\Models\CaAssessment::count() ?: 1;
    $globalAvgFcr = ($globalFcrCount / $globalTotal) * 100;

    \App\Models\MonthlyTrend::where('month_num', 8)->where('year', 2026)->update([
        'ca_score' => round($globalAvgCa, 1),
        'fcr_score' => round($globalAvgFcr, 1),
        'total_calls' => \App\Models\CaAssessment::count()
    ]);

    $this->info("Updated August 2026 Monthly Trend: CA " . round($globalAvgCa, 1) . "% | FCR " . round($globalAvgFcr, 1) . "% (Target CA: 85%, Target FCR: 100%)");
    $this->info('FCR & Target Synchronization Completed Successfully!');
})->purpose('Synchronize Back Office FCR resolution and recalculate agent rollup scores');

Artisan::command('sampling:generate-target {period=2026-08}', function ($period) {
    $this->info("Generating Segment 2-D hierarchical targets for period {$period}...");
    $res = \App\Services\Sampling\SamplingTargetEngineService::generatePeriodTargets($period);
    $this->info("Target generated successfully: {$res['total_evaluators']} Evaluators x {$res['target_total_per_evaluator']} = {$res['site_total_quota']} total site quota (CSO: {$res['cso_count']}).");
})->purpose('Generate Segment 2-D hierarchical sampling targets for a period');

Artisan::command('sampling:distribute {period=2026-08}', function ($period) {
    $this->info("Running Segment 2-C Auto Distribution Ticket Engine for period {$period}...");
    $res = \App\Services\Sampling\AutoDistributionEngineService::runDistribution($period);
    $this->info("Distribution completed: {$res['total_assigned_tickets']} tickets assigned (Completed: {$res['total_completed_tickets']}) across " . count($res['qa_buckets']) . " QA buckets.");
})->purpose('Run Segment 2-C Auto Distribution Ticket Engine for continuous sampling');


