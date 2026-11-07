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

Artisan::command('backup:system {period=daily}', function ($period = 'daily') {
    $this->info("Starting DigiQA System Backup for period/type: {$period}...");
    try {
        $configService = app(\App\Services\GoogleDriveConfigService::class);
        $job = new \App\Jobs\ProcessSystemBackup($period);
        $job->handle($configService);
        $this->info("System backup for {$period} completed successfully!");
    } catch (\Throwable $e) {
        $this->error("Backup failed: " . $e->getMessage());
    }
})->purpose('Execute on-demand system backup to Google Drive (period: daily, weekly, monthly, db, master, all)');

Artisan::command('backup:test-gdrive', function () {
    $this->info("Testing Google Drive connection probe...");
    try {
        $configService = app(\App\Services\GoogleDriveConfigService::class);
        $res = $configService->testConnection();
        $this->info("SUCCESS: " . $res['message']);
    } catch (\Throwable $e) {
        $this->error("FAILED: " . $e->getMessage());
    }
})->purpose('Test dynamic Google Drive connection and permissions');

// =========================================================================
// PRODUCTION AUTOMATED SCHEDULER (Laravel Schedule)
// =========================================================================
use Illuminate\Support\Facades\Schedule;
use App\Jobs\ProcessSystemBackup;

// 1. Pengingat Import Supervisor sebelum jam 07:00 (Pukul 06:30 WIB)
Schedule::command('sampling:check-daily-import')->dailyAt('06:30');

// 2. Pre-Distribution Harian untuk QA Ready sebelum shift operasional (Pukul 06:45 WIB)
Schedule::command('sampling:distribute-daily')->dailyAt('06:45');

// 3. Dynamic Backup Engine Integration (V1.3 Google Drive)
// - Harian jam 01:00 (Hanya jika jadwal aktif dan frekuensi daily)
Schedule::call(function () {
    $setting = \App\Models\BackupSetting::where('is_active', true)->where('schedule_enabled', true)->latest()->first();
    if ($setting && ($setting->schedule_frequency === 'daily' || empty($setting->schedule_frequency))) {
        \App\Jobs\ProcessSystemBackup::dispatch('daily', $setting->backup_items, 'scheduler');
    }
})->dailyAt('01:00');

// - Mingguan tiap Senin jam 02:00 (Hanya jika jadwal aktif dan frekuensi weekly)
Schedule::call(function () {
    $setting = \App\Models\BackupSetting::where('is_active', true)->where('schedule_enabled', true)->latest()->first();
    if ($setting && $setting->schedule_frequency === 'weekly') {
        \App\Jobs\ProcessSystemBackup::dispatch('weekly', $setting->backup_items, 'scheduler');
    }
})->weeklyOn(1, '02:00');

// - Bulanan tiap tanggal 1 jam 03:00 (Hanya jika jadwal aktif dan frekuensi monthly)
Schedule::call(function () {
    $setting = \App\Models\BackupSetting::where('is_active', true)->where('schedule_enabled', true)->latest()->first();
    if ($setting && $setting->schedule_frequency === 'monthly') {
        \App\Jobs\ProcessSystemBackup::dispatch('monthly', $setting->backup_items, 'scheduler');
    }
})->monthlyOn(1, '03:00');

// - Spatie Backup Retention Cleanup tiap hari jam 04:00
Schedule::command('backup:clean')->dailyAt('04:00');

Artisan::command('sampling:repair-digilive-icrm {period?} {--dry-run}', function ($period = null) {
    $dryRun = $this->option('dry-run');
    $this->info("Scanning Digilive (iChat/Omni) sampling tickets for missing Ref Tiket iCRM...");

    $q = \App\Models\SamplingAssignment::with('assessment');
    if ($period) {
        $p = \App\Models\SamplingPeriod::where('period_code', $period)->first();
        if ($p) $q->where('sampling_period_id', $p->id);
    }
    $assignments = $q->where(function($query) {
        $query->where('channel', 'Digilive')
              ->orWhere('ticket_id', 'REGEXP', '^[0-9]+$')
              ->orWhere('notes', 'like', '%iChat%')
              ->orWhere('notes', 'like', '%MYICON%')
              ->orWhere('notes', 'like', '%Omni%');
    })->get();

    $this->info("Found " . $assignments->count() . " candidate Digilive assignments.");

    $repairedCount = 0;
    foreach ($assignments as $a) {
        $asm = $a->assessment;
        $hashtag = (string)($asm?->hashtag ?? '');
        $notes = (string)($a->notes ?? '');

        // Extract existing iCRM if any
        $icrmId = null;
        if (preg_match('/#ICRM:([^\s#]+)/i', $hashtag, $m) && !empty(trim($m[1]))) {
            $icrmId = trim($m[1]);
        }
        if (!$icrmId && preg_match('/Ref\s+iCRM:\s*([A-Za-z0-9_\-]+)/i', $notes, $m)) {
            $icrmId = trim($m[1]);
        }

        // Clean up any false numeric Ref iCRM (e.g. #140579 or #141555) from previous faulty runs
        if ($icrmId && !\App\Services\Sampling\AutoDistributionEngineService::isValidIcrmTicketId($icrmId)) {
            $this->warn("  -> Ticket #{$a->ticket_id} had false numeric Ref iCRM #{$icrmId}. Stripping false reference...");
            $icrmId = null;
            $cleanedHashtag = preg_replace('/#ICRM:\d+/i', '', $hashtag);
            $cleanedNotes = preg_replace('/Ref\s+iCRM:\s*\d+/i', '', $notes);
            if (!$dryRun) {
                if ($asm && $cleanedHashtag !== $hashtag) {
                    $asm->update(['hashtag' => trim($cleanedHashtag)]);
                    $hashtag = trim($cleanedHashtag);
                }
                if ($cleanedNotes !== $notes) {
                    $a->update(['notes' => trim($cleanedNotes)]);
                    $notes = trim($cleanedNotes);
                }
            }
        }

        // If not found, try to look up matching iCRM ticket (MUST be valid alphanumeric with letters)
        if (!$icrmId) {
            $ichatId = null;
            if (preg_match('/#ICHAT:([^\s#]+)/i', $hashtag, $m)) {
                $ichatId = trim($m[1]);
            } elseif (is_numeric($a->ticket_id)) {
                $ichatId = $a->ticket_id;
            }

            if ($ichatId) {
                // Search by transaction / ichat ID in ca_assessments
                $match = \App\Models\CaAssessment::where(function($sq) use ($ichatId) {
                    $sq->where('source_ca', $ichatId)
                       ->orWhere('source_ca', 'ICHAT_' . $ichatId)
                       ->orWhere('hashtag', 'like', "%#ICHAT:{$ichatId}%");
                })
                ->where('ticket_id', '!=', $ichatId)
                ->whereNotNull('ticket_id')
                ->where('ticket_id', 'not like', 'CA-%')
                ->where('ticket_id', 'not like', 'TCK-%')
                ->first();

                if ($match && \App\Services\Sampling\AutoDistributionEngineService::isValidIcrmTicketId($match->ticket_id)) {
                    $icrmId = $match->ticket_id;
                }
            }

            // Also check Omni ID
            if (!$icrmId) {
                $omniId = null;
                if (preg_match('/#OMNI:([^\s#]+)/i', $hashtag, $m)) {
                    $omniId = trim($m[1]);
                }
                if ($omniId) {
                    $match = \App\Models\CaAssessment::where(function($sq) use ($omniId) {
                        $sq->where('source_ca', $omniId)
                           ->orWhere('hashtag', 'like', "%#OMNI:{$omniId}%");
                    })
                    ->where('ticket_id', '!=', $omniId)
                    ->whereNotNull('ticket_id')
                    ->where('ticket_id', 'not like', 'CA-%')
                    ->where('ticket_id', 'not like', 'TCK-%')
                    ->first();

                    if ($match && \App\Services\Sampling\AutoDistributionEngineService::isValidIcrmTicketId($match->ticket_id)) {
                        $icrmId = $match->ticket_id;
                    }
                }
            }

            // Fallback 3: If still not found, check if there is an iCRM record with same IDPEL + same Date
            if (!$icrmId && $asm) {
                $idpel = null;
                if (preg_match('/#PELANGGAN:([^\s#]+)/i', $hashtag, $m)) {
                    $idpel = trim($m[1]);
                } elseif (!empty($asm->customer_idpel)) {
                    $idpel = trim((string)$asm->customer_idpel);
                }

                if ($idpel && !empty($asm->transaction_at)) {
                    $txDate = substr((string)$asm->transaction_at, 0, 10);
                    $match = \App\Models\CaAssessment::where(function($sq) use ($idpel) {
                        $sq->where('hashtag', 'like', "%#PELANGGAN:{$idpel}%")
                           ->orWhere('source_ca', 'like', "%{$idpel}%");
                    })
                    ->whereDate('transaction_at', $txDate)
                    ->where('ticket_id', '!=', $a->ticket_id)
                    ->whereNotNull('ticket_id')
                    ->where('ticket_id', 'not like', 'CA-%')
                    ->where('ticket_id', 'not like', 'TCK-%')
                    ->first();

                    if ($match && \App\Services\Sampling\AutoDistributionEngineService::isValidIcrmTicketId($match->ticket_id)) {
                        $icrmId = $match->ticket_id;
                    }
                }
            }
        }

        if ($icrmId && \App\Services\Sampling\AutoDistributionEngineService::isValidIcrmTicketId($icrmId) && $icrmId !== $a->ticket_id) {
            $needsUpdate = false;
            $newHashtag = $hashtag;
            $newNotes = $notes;

            // Sync into hashtag
            if ($asm && !str_contains($hashtag, "#ICRM:{$icrmId}")) {
                $cleanedHashtag = preg_replace('/#ICRM:[^\s#]*/i', '', $hashtag);
                $newHashtag = trim("{$cleanedHashtag} #ICRM:{$icrmId}");
                $needsUpdate = true;
            }

            // Sync into notes
            if (!str_contains($notes, "Ref iCRM: {$icrmId}")) {
                $cleanedNotes = preg_replace('/Ref\s+iCRM:\s*[^\s•|]+/i', '', $notes);
                $newNotes = trim($cleanedNotes . " Ref iCRM: {$icrmId}");
                $needsUpdate = true;
            }

            if ($needsUpdate) {
                $this->line("  -> Ticket #{$a->ticket_id} matched iCRM #{$icrmId}");
                if (!$dryRun) {
                    if ($asm && $newHashtag !== $hashtag) {
                        $asm->update(['hashtag' => $newHashtag]);
                    }
                    if ($newNotes !== $notes) {
                        $a->update(['notes' => $newNotes]);
                    }
                }
                $repairedCount++;
            }
        }
    }

    $this->info("Repair completed! " . ($dryRun ? "[DRY-RUN] Would repair " : "Repaired ") . "{$repairedCount} tickets.");
})->purpose('Repair and sync missing Ref Tiket iCRM on Digilive tickets');

Artisan::command('sampling:clean-lampau-tickets {period?} {date?} {--dry-run}', function ($period = null, $date = null) {
    $dryRun = $this->option('dry-run');
    $targetPeriodCode = $period ?: now()->format('Y-m');
    $targetDateStr = $date ?: now()->format('Y-m-d');
    $targetCarbon = \Carbon\Carbon::parse($targetDateStr);

    $allowedMaxPastDays = ($targetCarbon->dayOfWeek === \Carbon\Carbon::MONDAY) ? 3 : 1;
    $earliestAllowedDate = $targetCarbon->copy()->subDays($allowedMaxPastDays)->startOfDay()->format('Y-m-d H:i:s');
    $latestAllowedDate = $targetCarbon->copy()->subDay()->endOfDay()->format('Y-m-d H:i:s');

    $this->info("=== Audit & Pembersihan Tiket Lampau Antrean QA ===");
    $this->info("Periode       : {$targetPeriodCode}");
    $this->info("Target Date   : {$targetDateStr} (" . $targetCarbon->isoFormat('dddd') . ")");
    $this->info("Batas Hari    : Maksimal H-{$allowedMaxPastDays} (" . ($targetCarbon->dayOfWeek === \Carbon\Carbon::MONDAY ? "Toleransi Weekend 3 Hari" : "Strict H-1") . ")");
    $this->info("Rentang Valid : {$earliestAllowedDate} s/d {$latestAllowedDate}");

    $periodModel = \App\Models\SamplingPeriod::where('period_code', $targetPeriodCode)->first();
    if (!$periodModel) {
        $this->error("SamplingPeriod '{$targetPeriodCode}' tidak ditemukan.");
        return;
    }

    $lampauAssignments = \App\Models\SamplingAssignment::where('sampling_period_id', $periodModel->id)
        ->where('status', 'ASSIGNED')
        ->whereNotNull('assessment_id')
        ->whereHas('assessment', function($q) use ($earliestAllowedDate, $latestAllowedDate) {
            $q->where(function($sq) use ($earliestAllowedDate, $latestAllowedDate) {
                $sq->where('transaction_at', '<', $earliestAllowedDate)
                   ->orWhere('transaction_at', '>', $latestAllowedDate);
            });
        })
        ->with('assessment')
        ->get();

    $this->info("Ditemukan {$lampauAssignments->count()} tiket ASSIGNED yang melanggar aturan tanggal transaksi lampau.");

    foreach ($lampauAssignments as $la) {
        $asm = $la->assessment;
        $tx = $asm?->transaction_at ?: $asm?->measurement_at ?: '-';
        $this->line("  [LAMPAU] QA: {$la->evaluator_name} | Tiket: #{$la->ticket_id} | Tanggal Transaksi: {$tx}");
    }

    if ($lampauAssignments->count() > 0) {
        if ($dryRun) {
            $this->warn("[DRY-RUN] Tidak ada data yang dihapus.");
        } else {
            $deleted = \App\Models\SamplingAssignment::whereIn('id', $lampauAssignments->pluck('id'))->delete();
            $this->info("Berhasil membersihkan {$deleted} tiket lampau dari antrean QA. Antrean kini bersih dan sesuai SOP H-1.");
        }
    } else {
        $this->info("Semua tiket ASSIGNED dalam antrean QA sudah sesuai aturan tanggal transaksi.");
    }
})->purpose('Audit dan bersihkan tiket ASSIGNED yang melanggar aturan tanggal transaksi lampau (Strict H-1)');







