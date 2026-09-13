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

Artisan::command('sampling:distribute-daily {period?} {date?}', function ($period = null, $date = null) {
    $targetPeriod = $period ?: now()->format('Y-m');
    $targetDate = $date ?: now()->format('Y-m-d');
    $this->info("Running Daily Auto Distribution for period {$targetPeriod} and date {$targetDate}...");

    $readyQas = \App\Services\Sampling\SamplingQaAttendanceService::getReadyQaNamesForDate($targetPeriod, $targetDate);
    $this->info("Found " . count($readyQas) . " Ready QA Evaluator(s): " . implode(', ', $readyQas));

    if (empty($readyQas)) {
        $this->warn("No QA evaluators are ON_DUTY / Ready on {$targetDate}. Distribution aborted.");
        return;
    }

    try {
        $res = \App\Services\Sampling\AutoDistributionEngineService::runDailyDistribution($targetPeriod, $targetDate, $readyQas, false);
        $assignedCount = $res['assigned_today_count'] ?? 0;
        $this->info("Daily distribution completed! Assigned {$assignedCount} tickets to " . count($readyQas) . " QA Evaluators.");
    } catch (\Throwable $e) {
        $this->error("Daily distribution error: " . $e->getMessage());
    }
})->purpose('Run daily sampling auto-distribution for active Ready QAs');

Artisan::command('sampling:check-daily-import', function () {
    $today = now()->format('Y-m-d');
    $period = now()->format('Y-m');
    $currentHour = (int)now()->format('H');

    $this->info("Checking Daily Import & Distribution Status for {$today} (Current Hour: {$currentHour}:00)...");

    $importedToday = \App\Models\SipImport::whereDate('created_at', $today)->where('status', 'completed')->exists()
        || \App\Models\CaAssessment::whereDate('created_at', $today)->exists();

    $readyQas = \App\Services\Sampling\SamplingQaAttendanceService::getReadyQaNamesForDate($period, $today);
    $readyCount = count($readyQas);

    if (!$importedToday) {
        $this->warn("[ALERT] Tarikan data sampling hari ini ({$today}) belum di-import!");
        
        \App\Services\NotificationService::send([
            'title'       => "⏰ Pengingat: Tarikan Data Harian Belum Di-import",
            'message'     => "Tarikan data sampling hari ini ({$today}) belum di-import. Harap lakukan upload sebelum jam 07:00 WIB agar tiket terdistribusi otomatis ke {$readyCount} QA Ready.",
            'type'        => 'import',
            'action_url'  => '/input-supervisor',
            'target_role' => 'supervisor',
        ]);
        
        $this->info("Broadcasted reminder notification to Supervisors.");
    } else {
        $this->info("[OK] Tarikan data hari ini telah di-import.");
        if ($readyCount > 0) {
            $this->info("Checking distribution for {$readyCount} Ready QA Evaluators...");
            try {
                $distRes = \App\Services\Sampling\AutoDistributionEngineService::runDailyDistribution($period, $today, $readyQas, false);
                $this->info("Auto-distribution completed: {$distRes['assigned_today_count']} tickets assigned.");
            } catch (\Throwable $e) {
                $this->warn("Distribution note: " . $e->getMessage());
            }
        }
    }
})->purpose('Check if daily raw tickets are imported before 07:00 AM and remind Supervisor');

// =========================================================================
// PRODUCTION AUTOMATED SCHEDULER (Laravel Schedule)
// =========================================================================
use Illuminate\Support\Facades\Schedule;

// 1. Pengingat Import Supervisor sebelum jam 07:00 (Pukul 06:30 WIB)
Schedule::command('sampling:check-daily-import')->dailyAt('06:30');

// 2. Pre-Distribution Harian untuk QA Ready sebelum shift operasional (Pukul 06:45 WIB)
Schedule::command('sampling:distribute-daily')->dailyAt('06:45');




