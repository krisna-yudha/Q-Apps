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

    // 3. Recalculate Monthly Trend
    $globalAvgCa = \App\Models\CaAssessment::avg('score_ca') ?: 0;
    $globalFcrCount = \App\Models\CaAssessment::where('fcr', 'YA')->count();
    $globalTotal = \App\Models\CaAssessment::count() ?: 1;
    $globalAvgFcr = ($globalFcrCount / $globalTotal) * 100;

    \App\Models\MonthlyTrend::where('month_num', 8)->where('year', 2026)->update([
        'ca_score' => round($globalAvgCa, 1),
        'fcr_score' => round($globalAvgFcr, 1),
        'total_calls' => \App\Models\CaAssessment::count()
    ]);

    $this->info("Updated August 2026 Monthly Trend: CA " . round($globalAvgCa, 1) . "% | FCR " . round($globalAvgFcr, 1) . "%");
    $this->info('FCR Synchronization Completed Successfully!');
})->purpose('Synchronize Back Office FCR resolution and recalculate agent rollup scores');

