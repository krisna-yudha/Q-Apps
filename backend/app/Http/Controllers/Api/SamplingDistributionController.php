<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CaAssessment;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingReassignmentLog;
use App\Models\SamplingTarget;
use App\Models\SamplingQaAttendance;
use App\Services\Sampling\AutoDistributionEngineService;
use App\Services\Sampling\SamplingTargetEngineService;
use App\Services\Sampling\SamplingWorkflowService;
use App\Services\Sampling\SamplingQaAttendanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SamplingDistributionController extends Controller
{

    /**
     * Run Auto Distribution Engine for a period.
     * POST /api/sampling/periods/{period}/distribute
     */
    public function distribute(string $period)
    {
        $result = AutoDistributionEngineService::runDistribution($period);

        \App\Services\NotificationService::send([
            'title'      => "Distribusi Selesai",
            'message'    => "Tiket sampling periode {$period} berhasil dibagikan.",
            'type'       => 'sampling',
            'action_url' => '/lembar-sampling-qa',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Distribusi sampling periode {$period} berhasil.",
            'data' => $result,
        ]);
    }

    /**
     * Run Daily Auto Distribution Engine for a period (20 tickets/day: 6 Informasi, 7 Gangguan, 6 Keluhan, 1 Permohonan).
     * POST /api/sampling/periods/{period}/distribute-daily
     */
    public function distributeDaily(Request $request, string $period)
    {
        $targetDate = $request->input('target_date', now()->format('Y-m-d'));
        $evaluators = $request->input('evaluators', []);
        $clearExisting = (bool)$request->input('clear_existing', false);
        $categoryTargets = (array)$request->input('category_targets', $request->input('composition', []));

        try {
            $result = AutoDistributionEngineService::runDailyDistribution($period, $targetDate, $evaluators, $clearExisting, $categoryTargets);

            $totalPerQa = $result['rules']['total_per_qa'] ?? 20;
            $assignedQasCount = count($result['evaluators'] ?? []);

            \App\Services\NotificationService::send([
                'title'      => "Distribusi Harian Selesai",
                'message'    => "{$totalPerQa} tiket/QA dibagikan ke {$assignedQasCount} QA ON DUTY.",
                'type'       => 'sampling',
                'action_url' => '/lembar-sampling-qa',
            ]);

            return response()->json([
                'success' => true,
                'message' => "Distribusi harian ({$totalPerQa} tiket/QA) tanggal {$targetDate} berhasil.",
                'data' => $result,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get ticket list in QA work bucket with filters.
     * GET /api/sampling/bucket/tickets
     */
    public function bucketTickets(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $evaluator = $request->query('evaluator');
        $status = $request->query('status', 'all');
        $type = $request->query('type', 'all'); // 'MANDATORY', 'ADDITIONAL', 'all'
        $channel = $request->query('channel');
        $search = $request->query('search');
        $teamLeaderId = $request->query('team_leader_id');
        $perPage = (int)$request->query('per_page', 50);

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        // Auto-expire assignments older than 7 days that are not completed (Rule: SLA 7 Hari / 1 Minggu)
        AutoDistributionEngineService::autoExpireStaleAssignments($period->id);

        $query = SamplingAssignment::with([
            'agent',
            'service',
            'assessment.category',
            'assessment.subCategory',
            'assessment.platform',
            'assessment.site',
            'assessment.employee',
        ])->where('sampling_period_id', $period->id);

        if ($teamLeaderId && $teamLeaderId !== 'all') {
            $query->whereHas('agent', function ($aQ) use ($teamLeaderId) {
                $aQ->where('team_leader_id', $teamLeaderId);
            });
        }

        if ($evaluator && $evaluator !== 'all') {
            $evalClean = str_replace(' ', '.', strtoupper(trim($evaluator)));
            $evalWithSpace = str_replace('.', ' ', strtoupper(trim($evaluator)));
            $evalLower = strtolower(trim($evaluator));
            $query->where(function($q) use ($evaluator, $evalClean, $evalWithSpace, $evalLower) {
                $q->where('evaluator_name', $evaluator)
                  ->orWhere('evaluator_name', $evalClean)
                  ->orWhere('evaluator_name', $evalWithSpace)
                  ->orWhere('evaluator_name', $evalLower)
                  ->orWhere('evaluator_name', 'like', "%{$evalClean}%")
                  ->orWhere('evaluator_name', 'like', "%{$evalWithSpace}%");
            });
        }

        if ($status && $status !== 'all') {
            $sLower = strtolower($status);
            $today = now()->startOfDay();
            if ($sLower === 'checked' || $sLower === 'sudah_dicek' || $sLower === 'completed') {
                $query->where('status', 'COMPLETED');
            } elseif ($sLower === 'unchecked' || $sLower === 'belum_dicek') {
                $query->whereNotIn('status', ['COMPLETED', 'CANCELLED']);
            } elseif ($sLower === 'on_cek' || $sLower === 'in_progress') {
                $query->where('status', 'IN_PROGRESS');
            } elseif ($sLower === 'pending') {
                $query->where('status', 'PENDING');
            } elseif ($sLower === 'abandoned') {
                $query->whereIn('status', ['ABANDONED', 'SKIPPED']);
            } elseif ($sLower === 'cancelled' || $sLower === 'dibatalkan') {
                $query->where('status', 'CANCELLED');
            } elseif ($sLower === 'backlog' || $sLower === 'backlog_only' || $sLower === 'menumpuk') {
                $query->whereDate('assigned_at', '<', $today)
                      ->whereNotIn('status', ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED']);
            } elseif ($sLower === 'today' || $sLower === 'hari_ini') {
                $query->whereDate('assigned_at', $today);
            } else {
                $query->where('status', strtoupper($status));
            }
        } else {
            // By default, exclude CANCELLED tickets from the active work bucket
            $query->where('status', '!=', 'CANCELLED');
        }

        if ($type && $type !== 'all') {
            $query->where('assignment_type', strtoupper($type));
        }

        if ($channel && $channel !== 'all') {
            $query->where(function ($q) use ($channel) {
                $q->where('channel', $channel)
                  ->orWhereHas('service', function ($sQ) use ($channel) {
                      $sQ->where('name', $channel);
                  });
            });
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_id', 'like', "%{$search}%")
                  ->orWhere('evaluator_name', 'like', "%{$search}%")
                  ->orWhereHas('agent', function ($aQ) use ($search) {
                      $aQ->where('name', 'like', "%{$search}%")
                         ->orWhere('nik', 'like', "%{$search}%");
                  });
            });
        }

        $paginated = $query->orderByRaw("FIELD(status, 'IN_PROGRESS', 'ASSIGNED', 'PENDING', 'COMPLETED', 'ABANDONED', 'SKIPPED', 'REASSIGNED')")
            ->orderBy('id', 'asc')
            ->paginate($perPage);

        // Stats summary for the bucket (excluding CANCELLED from active counts)
        $statsQuery = SamplingAssignment::where('sampling_period_id', $period->id)->where('status', '!=', 'CANCELLED');
        if ($teamLeaderId && $teamLeaderId !== 'all') {
            $statsQuery->whereHas('agent', function ($aQ) use ($teamLeaderId) {
                $aQ->where('team_leader_id', $teamLeaderId);
            });
        }
        if ($evaluator && $evaluator !== 'all') {
            $evalClean = str_replace(' ', '.', strtoupper(trim($evaluator)));
            $evalWithSpace = str_replace('.', ' ', strtoupper(trim($evaluator)));
            $evalLower = strtolower(trim($evaluator));
            $statsQuery->where(function($q) use ($evaluator, $evalClean, $evalWithSpace, $evalLower) {
                $q->where('evaluator_name', $evaluator)
                  ->orWhere('evaluator_name', $evalClean)
                  ->orWhere('evaluator_name', $evalWithSpace)
                  ->orWhere('evaluator_name', $evalLower)
                  ->orWhere('evaluator_name', 'like', "%{$evalClean}%")
                  ->orWhere('evaluator_name', 'like', "%{$evalWithSpace}%");
            });
        }

        $today = now()->startOfDay();
        $totalBucket = (clone $statsQuery)->count();
        $mandatoryCount = (clone $statsQuery)->where('assignment_type', 'MANDATORY')->count();
        $additionalCount = (clone $statsQuery)->where('assignment_type', 'ADDITIONAL')->count();
        $completedCount = (clone $statsQuery)->where('status', 'COMPLETED')->count();
        $inProgressCount = (clone $statsQuery)->where('status', 'IN_PROGRESS')->count();
        $pendingCount = (clone $statsQuery)->where('status', 'PENDING')->count();
        $assignedCount = (clone $statsQuery)->where('status', 'ASSIGNED')->count();
        $skippedCount = (clone $statsQuery)->where('status', 'SKIPPED')->count();
        $abandonedCount = (clone $statsQuery)->where('status', 'ABANDONED')->count();
        $reassignedCount = (clone $statsQuery)->where('status', 'REASSIGNED')->count();
        $extraQuotaCount = (clone $statsQuery)->where('is_extra_quota', true)->count();
        $cancelledCount = SamplingAssignment::where('sampling_period_id', $period->id)->where('status', 'CANCELLED')->count();

        // Daily Distribution & Backlog / Carry-Over Stacking Metrics
        $todayAssignedCount = (clone $statsQuery)->whereDate('assigned_at', $today)->count();
        $todayCompletedCount = (clone $statsQuery)->whereDate('completed_at', $today)->where('status', 'COMPLETED')->count();
        $backlogCount = (clone $statsQuery)
            ->whereDate('assigned_at', '<', $today)
            ->whereNotIn('status', ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED'])
            ->count();

        $formatted = collect($paginated->items())->map(function ($item) use ($today) {
            $rawAgentName = $item->agent ? $item->agent->name : ($item->assessment?->agent_name ?: 'Unknown');
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $asm = $item->assessment;

            $now = now();
            $validUntil = $item->valid_until ?: ($item->assigned_at ? $item->assigned_at->copy()->addDays(7)->endOfDay() : null);
            $isExpired = $validUntil && $validUntil->isPast();
            $daysRemaining = $validUntil ? max(0, (int)$now->diffInDays($validUntil, false)) : 7;
            $canReopen = in_array($item->status, ['PENDING', 'ABANDONED', 'ASSIGNED']) || ($isExpired && $item->status !== 'COMPLETED' && $item->status !== 'CANCELLED');

            $isAssignedToday = $item->assigned_at ? $item->assigned_at->isToday() : false;
            $isBacklog = $item->assigned_at && $item->assigned_at->lt($today) && !in_array($item->status, ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED']);
            $backlogDays = ($item->assigned_at && $item->assigned_at->lt($today)) ? abs((int)$today->diffInDays($item->assigned_at->copy()->startOfDay(), false)) : 0;

            return [
                'id' => $item->id,
                'ticket_id' => $item->ticket_id,
                'idca' => $asm?->idca ?: ('CA-' . $item->ticket_id),
                'assessment_id' => $item->assessment_id,
                'agent_id' => $item->agent_id,
                'agent_name' => $cleanAgentName,
                'raw_agent_name' => $rawAgentName,
                'agent_nik' => $item->agent ? $item->agent->nik : ($asm?->employee?->sip_id ?: '-'),
                'site_id' => $item->site_id ?: ($asm?->site_id ?: 1),
                'site_code' => $asm?->site?->code ?: 'SMG',
                'site_name' => $asm?->site?->name ?: 'SEMARANG',
                'cso_classification' => $item->cso_classification ?: ($asm?->cso_classification ?: ($item->agent?->cso_classification ?: 'VERIFIED_NAKER')),
                'is_naker_verified' => $item->is_naker_verified !== null ? (bool)$item->is_naker_verified : ($asm?->is_naker_verified !== null ? (bool)$asm->is_naker_verified : true),
                'evaluator_name' => $item->evaluator_name,
                'channel' => $item->channel ?: ($item->service ? $item->service->name : ($asm?->service?->name ?: 'Inbound')),
                
                // Detail Tiket Lengkap
                'category_name' => $asm?->category?->name ?: ($item->category_name ?: 'GANGGUAN'),
                'sub_category_name' => $asm?->subCategory?->name ?: '-',
                'platform_name' => $asm?->platform?->name ?: ($item->channel ?: 'Digilive'),
                'customer_name' => $asm?->customer_name ?: 'Pelanggan',
                'customer_phone' => $asm?->customer_phone ?: '-',
                'transaction_at' => $asm?->transaction_at ? $asm->transaction_at->format('Y-m-d H:i:s') : ($item->assigned_at ? $item->assigned_at->format('Y-m-d H:i:s') : null),
                'measurement_at' => $asm?->measurement_at ? $asm->measurement_at->format('Y-m-d H:i:s') : null,
                'transaction_duration_seconds' => $asm?->transaction_duration_seconds,
                'sampling_duration_seconds' => $asm?->sampling_duration_seconds,
                'hashtag' => $asm?->hashtag,
                'ever_changed' => $asm?->ever_changed ? 'Ya' : 'Tidak',
                'source_ca' => $asm?->source_ca,
                'source_layanan' => $asm?->source_layanan,
                'summary' => $asm?->summary,
                'recommendation' => $asm?->recommendation,
                'recommendation_note' => $asm?->recommendation_note,
                'fcr_note' => $asm?->fcr_note,
                'score_ca_original' => $asm?->score_ca,
                'fcr_original' => $asm?->fcr,

                // Status Distribusi, Siklus Hidup, Harian & Penumpukan
                'assignment_type' => $item->assignment_type,
                'is_extra_quota' => (bool)$item->is_extra_quota,
                'valid_until' => $validUntil ? $validUntil->format('Y-m-d H:i:s') : null,
                'days_remaining' => $daysRemaining,
                'can_reopen' => $canReopen,
                'is_expired' => $isExpired,
                'is_expired_7d' => $isExpired,
                'is_today' => $isAssignedToday,
                'is_backlog' => $isBacklog,
                'backlog_days' => $backlogDays,
                'assigned_date_formatted' => $item->assigned_at ? $item->assigned_at->format('d/m/Y') : '-',
                'status' => $item->status,
                'status_label' => match($item->status) {
                    'IN_PROGRESS' => 'On Cek',
                    'PENDING'     => 'Pending',
                    'ABANDONED'   => 'Abandoned',
                    'SKIPPED'     => 'Dilewati',
                    'COMPLETED'   => 'Sudah Dicek',
                    'CANCELLED'   => 'Dibatalkan/Arsip',
                    default       => 'Antrean Siap',
                },
                'is_checked' => ($item->status === 'COMPLETED'),
                'skip_reason' => $item->skip_reason,
                'reassigned_from' => $item->reassigned_from,
                'score_ca' => $item->score_ca !== null ? (float)$item->score_ca : ($asm?->score_ca !== null ? (float)$asm->score_ca : null),
                'fcr' => $item->fcr ?: ($asm?->fcr ?: 'YA'),
                'notes' => $item->notes,
                'assigned_at' => $item->assigned_at ? $item->assigned_at->format('Y-m-d H:i:s') : null,
                'started_at' => $item->started_at ? $item->started_at->format('Y-m-d H:i:s') : null,
                'hold_at' => $item->hold_at ? $item->hold_at->format('Y-m-d H:i:s') : null,
                'abandoned_at' => $item->abandoned_at ? $item->abandoned_at->format('Y-m-d H:i:s') : null,
                'completed_at' => $item->completed_at ? $item->completed_at->format('Y-m-d H:i:s') : null,
            ];
        });

        $targetQuota = 370;
        $dailyComp = $period->daily_category_composition ?: \App\Services\Sampling\AutoDistributionEngineService::DAILY_CATEGORY_TARGETS;
        $singleDailyTarget = array_sum($dailyComp) ?: 20;

        $evaluatorDutyInfo = null;
        if ($evaluator && $evaluator !== 'all') {
            $evalClean = str_replace(' ', '.', strtoupper(trim($evaluator)));
            $evalWithSpace = str_replace('.', ' ', strtoupper(trim($evaluator)));
            $tgt = SamplingTarget::where('sampling_period_id', $period->id)
                ->where(function($q) use ($evaluator, $evalClean, $evalWithSpace) {
                    $q->where('evaluator_name', $evaluator)
                      ->orWhere('evaluator_name', $evalClean)
                      ->orWhere('evaluator_name', $evalWithSpace);
                })
                ->first();
            $targetQuota = $tgt ? (int)$tgt->target_total : 370;
            $dailyTarget = $singleDailyTarget;

            $att = SamplingQaAttendance::where('work_date', $today->format('Y-m-d'))
                ->where(function($q) use ($evaluator, $evalClean, $evalWithSpace) {
                    $q->where('evaluator_name', $evaluator)
                      ->orWhere('evaluator_name', $evalClean)
                      ->orWhere('evaluator_name', $evalWithSpace);
                })
                ->first();

            $isOnDuty = $att ? ((bool)$att->is_ready && $att->status === 'ON_DUTY' && !empty($att->ready_at)) : false;
            $cleanStatus = $att ? (($att->status === 'ON_DUTY' && empty($att->ready_at)) ? 'STANDBY' : $att->status) : 'STANDBY';

            $evaluatorDutyInfo = [
                'evaluator_name'   => $evaluator,
                'date'             => $today->format('Y-m-d'),
                'is_on_duty'       => $isOnDuty,
                'status'           => $cleanStatus,
                'shift'            => $att ? ($att->shift ?: 'Normal') : 'Normal',
                'notes'            => $att ? $att->notes : null,
                'login_at'         => $att?->login_at ? $att->login_at->toIso8601String() : null,
                'ready_at'         => $att?->ready_at ? $att->ready_at->toIso8601String() : null,
                'end_shift_at'     => $att?->end_shift_at ? $att->end_shift_at->toIso8601String() : null,
                'login_time'       => $att?->login_at ? $att->login_at->format('H:i') : null,
                'ready_time'       => $att?->ready_at ? $att->ready_at->format('H:i') : null,
                'end_shift_time'   => $att?->end_shift_at ? $att->end_shift_at->format('H:i') : null,
                'today_assigned'   => $todayAssignedCount,
                'today_completed'  => $todayCompletedCount,
                'remaining_quota'  => max(0, $dailyTarget - $todayAssignedCount),
            ];
        } else {
            $activeQaCount = \App\Models\User::where('role', 'quality_assurance')
                ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
                ->count();
            if ($activeQaCount === 0) {
                $activeQaCount = SamplingTarget::where('sampling_period_id', $period->id)->where('type', 'QA')->count();
            }
            $targetQuota = $activeQaCount * 370;
            $dailyTarget = $activeQaCount * $singleDailyTarget;
        }

        $achPct = $targetQuota > 0 ? round(($completedCount / $targetQuota) * 100, 1) : 0.0;

        // Raw CRM Imported Tickets Pool vs Assigned to QA Sampling Buckets
        $totalRawImported = CaAssessment::where(function($q) use ($periodCode) {
            $q->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $periodCode)
              ->orWhere('source_file', 'LIKE', "%{$periodCode}%");
        })->count();

        $totalAssignedPeriod = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereNotIn('status', ['CANCELLED'])
            ->count();

        $rawBufferRemaining = max(0, $totalRawImported - $totalAssignedPeriod);
        $activeQaCountForDaily = \App\Models\User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->count();
        if ($activeQaCountForDaily === 0) {
            $activeQaCountForDaily = SamplingTarget::where('sampling_period_id', $period->id)->where('type', 'QA')->count();
        }
        $dailyNeededTotal = $activeQaCountForDaily * $singleDailyTarget;

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'evaluator' => $evaluator ?: 'all',
            'qa_duty_status' => $evaluatorDutyInfo,
            'stats' => [
                'target_quota' => $targetQuota,
                'daily_target' => $dailyTarget,
                'daily_needed_total' => $dailyNeededTotal,
                'raw_total_imported' => $totalRawImported,
                'raw_assigned_total' => $totalAssignedPeriod,
                'raw_buffer_remaining' => $rawBufferRemaining,
                'today_assigned' => $todayAssignedCount,
                'today_completed' => $todayCompletedCount,
                'today_achievement_pct' => $dailyTarget > 0 ? round(($todayCompletedCount / $dailyTarget) * 100, 1) : 0.0,
                'backlog_count' => $backlogCount,
                'total_bucket' => $totalBucket,
                'checked_count' => $completedCount,
                'unchecked_count' => max(0, $totalBucket - $completedCount),
                'on_cek_count' => $inProgressCount,
                'pending_count' => $pendingCount,
                'abandoned_count' => $abandonedCount + $skippedCount,
                'mandatory' => $mandatoryCount,
                'additional' => $additionalCount,
                'completed' => $completedCount,
                'in_progress' => $inProgressCount,
                'pending' => $pendingCount,
                'assigned' => $assignedCount,
                'skipped' => $skippedCount,
                'abandoned' => $abandonedCount,
                'reassigned' => $reassignedCount,
                'extra_quota_count' => $extraQuotaCount,
                'achievement_pct' => $achPct,
            ],
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'daily_composition' => $dailyComp,
            'data' => $formatted,
        ]);
    }

    /**
     * Start assessment on an assigned ticket (Status: On Cek).
     * POST /api/sampling/assignments/{id}/start
     */
    public function start(int $id)
    {
        $assignment = SamplingWorkflowService::startAssessment($id);

        \App\Services\NotificationService::triggerSync('assessment_start', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Tiket {$assignment->ticket_id} sedang dikerjakan (On Cek).",
            'data' => $assignment,
        ]);
    }

    /**
     * Hold / Postpone assessment on a ticket (Status: Pending).
     * POST /api/sampling/assignments/{id}/hold
     */
    public function hold(int $id)
    {
        $assignment = SamplingWorkflowService::holdAssessment($id);

        \App\Services\NotificationService::triggerSync('assessment_hold', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Penilaian tiket {$assignment->ticket_id} berhasil ditunda (Pending). Anda dapat mengerjakan tiket lain.",
            'data' => $assignment,
        ]);
    }

    /**
     * Abandon an assessment on a ticket (Status: Abandoned).
     * POST /api/sampling/assignments/{id}/abandon
     */
    public function abandon(Request $request, int $id)
    {
        $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        $assignment = SamplingWorkflowService::abandonAssessment($id, $request->reason);

        \App\Services\NotificationService::triggerSync('assessment_abandon', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Tiket {$assignment->ticket_id} telah ditandai DITINGGALKAN / ABANDONED (Riwayat tersimpan).",
            'data' => $assignment,
        ]);
    }

    /**
     * Complete / Check assessment on a ticket (Status: Sudah Dicek).
     * POST /api/sampling/assignments/{id}/complete
     */
    public function complete(Request $request, int $id)
    {
        $request->validate([
            'score_ca' => 'nullable|numeric|min:0|max:100',
            'fcr' => 'nullable|in:YA,TIDAK,ya,tidak',
            'notes' => 'nullable|string',
        ]);

        $scoreCa = $request->input('score_ca') !== null ? (float)$request->input('score_ca') : 90.0;
        $fcr = $request->input('fcr') ? strtoupper($request->input('fcr')) : 'YA';

        $assignment = SamplingWorkflowService::completeAssessment($id, [
            'score_ca' => $scoreCa,
            'fcr' => $fcr,
            'notes' => $request->notes,
        ]);

        \App\Services\NotificationService::triggerSync('assessment_complete', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
            'score_ca'      => $assignment->score_ca
        ]);

        return response()->json([
            'success' => true,
            'message' => "Tiket {$assignment->ticket_id} berhasil ditandai SUDAH DICEK.",
            'data' => $assignment,
        ]);
    }

    /**
     * Uncomplete / Uncheck assessment on a ticket (revert back to On Cek / Belum Dicek).
     * POST /api/sampling/assignments/{id}/uncomplete
     */
    public function uncomplete(int $id)
    {
        $assignment = SamplingWorkflowService::uncompleteAssessment($id);

        \App\Services\NotificationService::triggerSync('assessment_uncomplete', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Status tiket {$assignment->ticket_id} telah diubah kembali menjadi BELUM DICEK.",
            'data' => $assignment,
        ]);
    }

    /**
     * Skip an assigned ticket.
     * POST /api/sampling/assignments/{id}/skip
     */
    public function skip(Request $request, int $id)
    {
        $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        $assignment = SamplingWorkflowService::skipAssessment($id, $request->reason);

        \App\Services\NotificationService::triggerSync('assessment_skip', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Tiket {$assignment->ticket_id} telah dilewati (SKIPPED).",
            'data' => $assignment,
        ]);
    }

    /**
     * Get QA Quota requests list.
     * GET /api/sampling/quota-requests
     */
    public function quotaRequests(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $evaluator = $request->query('evaluator');
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        $query = \App\Models\SamplingQuotaRequest::where('sampling_period_id', $period->id)
            ->orderBy('id', 'desc');

        if ($evaluator && $evaluator !== 'all') {
            $query->where('evaluator_name', $evaluator);
        }

        $requests = $query->take(50)->get();

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'data' => $requests,
        ]);
    }

    /**
     * QA submits request for extra quota.
     * POST /api/sampling/quota-requests
     */
    public function storeQuotaRequest(Request $request)
    {
        $request->validate([
            'period' => 'required|string',
            'evaluator_name' => 'required|string',
            'requested_count' => 'nullable|integer|min:1|max:50',
            'reason' => 'nullable|string',
        ]);

        $period = SamplingTargetEngineService::getOrCreatePeriod($request->period);

        $quotaReq = \App\Models\SamplingQuotaRequest::create([
            'sampling_period_id' => $period->id,
            'evaluator_name'     => $request->evaluator_name,
            'requested_count'    => (int)($request->requested_count ?: 10),
            'reason'             => $request->reason ?: 'Permintaan tambahan kuota sampling dari QA',
            'status'             => 'PENDING',
        ]);

        \App\Services\NotificationService::send([
            'title'       => "Pengajuan Tambahan Kuota QA",
            'message'     => "QA {$request->evaluator_name} mengajukan tambahan {$quotaReq->requested_count} tiket sampling.",
            'type'        => 'sampling',
            'action_url'  => '/auto-distribution?open_quota_modal=1',
            'target_role' => 'supervisor',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Pengajuan penambahan kuota berhasil dikirimkan ke Supervisor.",
            'data' => $quotaReq,
        ]);
    }

    /**
     * Supervisor grants extra quota tickets to QA with 1-day (24-hour) expiration.
     * POST /api/sampling/extra-quota/grant
     */
    public function grantExtraQuota(Request $request)
    {
        $request->validate([
            'period'           => 'required|string',
            'evaluator_name'   => 'required|string',
            'extra_count'      => 'required|integer|min:1|max:50',
            'reason'           => 'nullable|string',
            'request_id'       => 'nullable|integer',
            'quota_request_id' => 'nullable|integer',
        ]);

        $requestId = $request->input('request_id') ?: $request->input('quota_request_id');

        $result = AutoDistributionEngineService::grantExtraQuota(
            $request->period,
            $request->evaluator_name,
            (int)$request->extra_count,
            $request->reason,
            $requestId ? (int)$requestId : null
        );

        \App\Services\NotificationService::send([
            'title'       => "Kuota Tambahan QA Disetujui",
            'message'     => "Supervisor menyetujui +{$request->extra_count} tiket sampling untuk {$request->evaluator_name} (Masa berlaku 1 hari).",
            'type'        => 'sampling',
            'action_url'  => '/lembar-sampling-qa',
            'target_role' => 'quality_assurance',
        ]);

        return response()->json($result);
    }

    /**
     * Reassign ticket to another QA (Supervisor action).
     * POST /api/sampling/assignments/{id}/reassign
     */
    public function reassign(Request $request, int $id)
    {
        $request->validate([
            'to_evaluator' => 'required|string|max:150',
            'reason' => 'required|string',
            'reassigned_by' => 'nullable|string|max:150',
        ]);

        $assignment = SamplingWorkflowService::reassignAssessment(
            $id,
            $request->to_evaluator,
            $request->reason,
            $request->reassigned_by ?: 'Supervisor QA'
        );

        \App\Services\NotificationService::send([
            'title'       => "Tiket Sampling Dipindahkan",
            'message'     => "Tiket {$assignment->ticket_id} dialihkan ke evaluator {$assignment->evaluator_name}.",
            'type'        => 'sampling',
            'action_url'  => '/lembar-sampling-qa',
            'target_role' => 'quality_assurance',
        ]);

        \App\Services\NotificationService::triggerSync('assessment_reassign', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Tiket {$assignment->ticket_id} berhasil dipindahkan ke {$assignment->evaluator_name}.",
            'data' => $assignment,
        ]);
    }

    /**
     * Get reassignment audit logs.
     * GET /api/sampling/reassignment-logs?period=2026-08
     */
    public function reassignmentLogs(Request $request)
    {
        $logs = SamplingReassignmentLog::with('assignment')
            ->orderBy('id', 'desc')
            ->take(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    /**
     * Delete a single sampling assignment ticket.
     * DELETE /api/sampling/assignments/{id}
     */
    public function destroyAssignment(int $id)
    {
        $assignment = SamplingAssignment::findOrFail($id);
        $ticketId = $assignment->ticket_id;
        $evaluator = $assignment->evaluator_name;

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        SamplingReassignmentLog::where('assignment_id', $id)->delete();
        $assignment->delete();
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => "Tiket #{$ticketId} (Evaluator: {$evaluator}) berhasil ditarik / dihapus dari antrean sampling.",
        ]);
    }

    /**
     * Bulk delete sampling assignments by IDs.
     * POST /api/sampling/assignments/bulk-delete
     */
    public function bulkDeleteAssignments(Request $request)
    {
        $ids = $request->input('ids', []);
        if (empty($ids) || !is_array($ids)) {
            return response()->json([
                'success' => false,
                'message' => 'Pilih setidaknya satu tiket untuk ditarik.',
            ], 400);
        }

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        SamplingReassignmentLog::whereIn('assignment_id', $ids)->delete();
        $count = SamplingAssignment::whereIn('id', $ids)->delete();
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => "Sebanyak {$count} tiket sampling terpilih berhasil ditarik / dihapus.",
            'deleted_count' => $count,
        ]);
    }

    /**
     * Recall / Rollback sampling tickets for a period with specific modes.
     * POST /api/sampling/bucket/recall
     */
    public function recallTickets(Request $request)
    {
        $periodCode = $request->input('period', now()->format('Y-m'));
        $mode = $request->input('mode', 'assigned_only'); // 'assigned_only', 'all_sampling', 'wipe_imported_data'
        $evaluator = $request->input('evaluator');
        $channel = $request->input('channel');

        $period = SamplingPeriod::where('period_code', $periodCode)->first();
        if (!$period) {
            $period = \App\Services\Sampling\SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        }

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

        try {
            $query = SamplingAssignment::where('sampling_period_id', $period->id);

            if ($evaluator && $evaluator !== 'all') {
                $query->where('evaluator_name', $evaluator);
            }

            if ($channel && $channel !== 'all') {
                $query->where('channel', $channel);
            }

            $deletedCount = 0;

            if ($mode === 'assigned_only') {
                // Hanya tarik tiket yang belum dinilai (status ASSIGNED atau IN_PROGRESS)
                $query->whereIn('status', ['ASSIGNED', 'IN_PROGRESS', 'PENDING']);
                $targetIds = (clone $query)->pluck('id')->toArray();
                if (!empty($targetIds)) {
                    SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
                }
                $deletedCount = $query->delete();
                $msg = "Sebanyak {$deletedCount} tiket yang belum dinilai berhasil ditarik kembali dari antrean QA Evaluator.";
            } elseif ($mode === 'all_sampling') {
                // Tarik seluruh antrean tiket pada periode ini
                $targetIds = (clone $query)->pluck('id')->toArray();
                if (!empty($targetIds)) {
                    SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
                }
                $deletedCount = $query->delete();
                $msg = "Seluruh antrean tiket sampling ({$deletedCount} tiket) pada periode {$periodCode} berhasil dikosongkan.";
            } elseif ($mode === 'wipe_imported_data') {
                // Tarik antrean + hapus seluruh raw assessment yang diimpor pada periode ini
                $targetIds = (clone $query)->pluck('id')->toArray();
                if (!empty($targetIds)) {
                    SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
                }
                $deletedCount = $query->delete();

                // Wipe assessments for this period
                $assessments = \App\Models\CaAssessment::where(function ($q) use ($periodCode) {
                    $q->where('transaction_at', 'like', $periodCode . '%')
                      ->orWhere('measurement_at', 'like', $periodCode . '%')
                      ->orWhere('imported_at', 'like', $periodCode . '%')
                      ->orWhere('created_at', 'like', $periodCode . '%')
                      ->orWhere('source_file', 'like', "%{$periodCode}%");
                })->get();

                $asmIds = $assessments->pluck('id')->toArray();
                if (!empty($asmIds)) {
                    \App\Models\CaAssessmentScore::whereIn('assessment_id', $asmIds)->delete();
                    \App\Models\CaAssessment::whereIn('id', $asmIds)->delete();
                }

                // Update SipImport & ImportBatch for this period to rolled_back
                try {
                    \App\Models\SipImport::where(function($q) use ($periodCode) {
                        $q->where('file_name', 'like', "%{$periodCode}%")
                          ->orWhereDate('created_at', now()->toDateString());
                    })->update(['status' => 'rolled_back']);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('SipImport rollback status update note: ' . $e->getMessage());
                }

                try {
                    \App\Models\ImportBatch::where(function($q) use ($periodCode) {
                        $q->where('original_filename', 'like', "%{$periodCode}%")
                          ->orWhereDate('created_at', now()->toDateString());
                    })->update(['status' => 'rolled_back']);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('ImportBatch rollback status update note: ' . $e->getMessage());
                }

                $msg = "Seluruh antrean sampling ({$deletedCount} tiket) dan data tarikan asesmen impor periode {$periodCode} berhasil dihapus.";
            }

            \App\Services\Sampling\SamplingTargetEngineService::syncActuals($periodCode);
            \App\Services\NotificationService::triggerSync('sampling_data_recalled', [
                'period'        => $periodCode,
                'mode'          => $mode,
                'deleted_count' => $deletedCount,
            ]);

            return response()->json([
                'success' => true,
                'message' => $msg,
                'deleted_count' => $deletedCount,
                'mode' => $mode,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('recallTickets error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menarik data antrean: ' . $e->getMessage(),
            ], 500);
        } finally {
            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
        }
    }

    /**
     * Clear all active uncompleted sampling assignments for a period without deleting historical audit trails.
     * POST /api/sampling/bucket/clear
     */
    public function clearBucket(Request $request)
    {
        $periodCode = $request->input('period', now()->format('Y-m'));
        $period = SamplingPeriod::where('period_code', $periodCode)->first();

        if (!$period) {
            $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        }

        $now = now();
        $formattedDate = $now->format('d M Y H:i');

        // Cancel all active uncompleted assignments (preserve COMPLETED and retain in history)
        $count = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereNotIn('status', ['COMPLETED', 'CANCELLED'])
            ->update([
                'status'       => 'CANCELLED',
                'notes'        => \Illuminate\Support\Facades\DB::raw("CONCAT(COALESCE(notes, ''), ' | Dikosongkan oleh Supervisor ({$formattedDate})')"),
                'abandoned_at' => $now,
                'updated_at'   => $now,
            ]);

        // Sync actuals & target engine
        SamplingTargetEngineService::syncActuals($periodCode);
        \App\Services\NotificationService::triggerSync('sampling_data_recalled', [
            'period'        => $periodCode,
            'mode'          => 'clear_bucket',
            'cleared_count' => $count,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Seluruh antrean aktif sampling periode {$periodCode} ({$count} tiket) berhasil dikosongkan dan diarsipkan ke histori.",
            'cleared_count' => $count,
            'deleted_count' => $count,
        ]);
    }

    /**
     * Reopen an assessment ticket (QA Evaluator or Supervisor action).
     * POST /api/sampling/ticket/{id}/reopen
     */
    public function reopenTicket(Request $request, $id)
    {
        $reason = $request->input('reason', 'Reopen pengerjaan tiket oleh QA/SPV');
        try {
            $assignment = \App\Services\Sampling\SamplingWorkflowService::reopenAssessment((int)$id, $reason);
            return response()->json([
                'success' => true,
                'message' => "Tiket #{$assignment->ticket_id} berhasil di-reopen dan siap dinilai kembali.",
                'data' => $assignment,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal me-reopen tiket: ' . $e->getMessage(),
            ], 422);
        }
    }


    /**
     * Get list of import batches for rollback / recall.
     * GET /api/sampling/import-batches
     */
    public function importBatches(Request $request)
    {
        $batches = \App\Models\ImportBatch::with(['uploader', 'profile', 'rows'])
            ->orderBy('id', 'desc')
            ->take(30)
            ->get()
            ->map(function ($b) {
                $ticketIds = [];
                foreach ($b->rows as $row) {
                    $raw = $row->raw_data;
                    if (is_array($raw)) {
                        $tid = $raw['idtiket'] ?? $raw['id_tiket'] ?? $raw['ticket_id'] ?? $raw['ID Tiket'] ?? $raw['ID_TIKET'] ?? null;
                        if ($tid) $ticketIds[] = (string)$tid;
                    }
                }
                $assessmentCount = !empty($ticketIds) 
                    ? \App\Models\CaAssessment::whereIn('ticket_id', $ticketIds)->count()
                    : $b->success_rows;

                return [
                    'id' => $b->id,
                    'batch_id' => $b->id,
                    'file_name' => $b->original_filename ?: "Batch-{$b->id}",
                    'channel' => $b->profile ? $b->profile->channel : 'Inbound',
                    'total_rows' => $b->total_rows,
                    'success_rows' => $b->success_rows,
                    'failed_rows' => $b->failed_rows,
                    'status' => $b->status,
                    'created_at' => $b->created_at ? $b->created_at->format('Y-m-d H:i:s') : null,
                    'uploader_name' => $b->uploader ? $b->uploader->name : 'Supervisor',
                    'assessment_count' => $assessmentCount,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $batches,
        ]);
    }

    /**
     * Rollback a specific import batch & its distributed tickets.
     * POST /api/sampling/batches/{batchId}/rollback
     */
    public function rollbackBatch(Request $request, int $batchId)
    {
        $batch = \App\Models\ImportBatch::with('rows')->findOrFail($batchId);
        $fileName = $batch->original_filename ?: "Batch-{$batchId}";

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

        try {
            // Extract ticket IDs from rows
            $ticketIds = [];
            foreach ($batch->rows as $row) {
                $raw = $row->raw_data;
                if (is_array($raw)) {
                    $tid = $raw['idtiket'] ?? $raw['id_tiket'] ?? $raw['ticket_id'] ?? $raw['ID Tiket'] ?? $raw['ID_TIKET'] ?? null;
                    if ($tid) $ticketIds[] = (string)$tid;
                }
            }

            $deletedAssignments = 0;

            if (!empty($ticketIds)) {
                $assessments = \App\Models\CaAssessment::whereIn('ticket_id', $ticketIds)->get();
                $asmIds = $assessments->pluck('id')->toArray();

                $assignQuery = SamplingAssignment::where(function ($q) use ($asmIds, $ticketIds) {
                    if (!empty($asmIds)) $q->whereIn('assessment_id', $asmIds);
                    $q->orWhereIn('ticket_id', $ticketIds);
                });
                $assignIds = $assignQuery->pluck('id')->toArray();
                if (!empty($assignIds)) {
                    SamplingReassignmentLog::whereIn('assignment_id', $assignIds)->delete();
                    $deletedAssignments = $assignQuery->delete();
                }

                if (!empty($asmIds)) {
                    \App\Models\CaAssessmentScore::whereIn('assessment_id', $asmIds)->delete();
                    \App\Models\CaAssessment::whereIn('id', $asmIds)->delete();
                }
            }

            // Delete import rows & batch record
            \App\Models\ImportRow::where('import_batch_id', $batchId)->delete();
            $batch->delete();

            \App\Services\Sampling\SamplingTargetEngineService::syncActuals(now()->format('Y-m'));
            \App\Services\NotificationService::triggerSync('sampling_data_recalled', [
                'batch_id'            => $batchId,
                'deleted_assignments' => $deletedAssignments,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Berkas import \"{$fileName}\" dan seluruh data tiket sampling terkait ({$deletedAssignments} penugasan) berhasil ditarik & dihapus.",
                'deleted_assignments' => $deletedAssignments,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('rollbackBatch error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal me-rollback berkas: ' . $e->getMessage(),
            ], 500);
        } finally {
            \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
        }
    }

    /**
     * Reset and clear all assessment & sampling data.
     * POST /api/sampling/reset-all
     */
    public function resetAllData(Request $request)
    {
        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        SamplingReassignmentLog::truncate();
        SamplingAssignment::truncate();
        if ($request->input('wipe_assessments', false)) {
            \App\Models\CaAssessment::truncate();
            \App\Models\CaAssessmentScore::truncate();
        }
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => "Data sampling & antrian kerja berhasil di-reset sepenuhnya.",
        ]);
    }

    /**
     * Get real-time QA handling & auto-distribution monitoring for Supervisor.
     * GET /api/sampling/monitoring/qa-handling?period=2026-08
     */
    public function monitoringQaHandling(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        // Sync actuals so target records are updated
        SamplingTargetEngineService::syncActuals($periodCode);

        // Dynamic QA list strictly from registered quality_assurance users
        $qaUsersList = \App\Models\User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->pluck('name')
            ->toArray();

        // If no QA users exist in users table, purge any old orphan targets / attendances
        if (empty($qaUsersList)) {
            SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->delete();
            SamplingQaAttendance::where('sampling_period_id', $period->id)
                ->delete();
            $allQaNames = collect([]);
        } else {
            SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->whereNotIn('evaluator_name', $qaUsersList)
                ->delete();
            SamplingQaAttendance::where('sampling_period_id', $period->id)
                ->whereNotIn('evaluator_name', $qaUsersList)
                ->delete();
            $allQaNames = collect($qaUsersList);
        }

        // 1. Get QA Targets for this period
        $qaTargets = SamplingTarget::where('sampling_period_id', $period->id)
            ->where('type', 'QA')
            ->get()
            ->keyBy('evaluator_name');

        // 2. Fetch all assignments for this period with relationships
        $allAssignments = SamplingAssignment::with(['agent', 'service'])
            ->where('sampling_period_id', $period->id)
            ->get();

        // 2b. Fetch attendance roster for today / this period
        $todayDateStr = now()->format('Y-m-d');
        $allAttendances = \App\Models\SamplingQaAttendance::where('sampling_period_id', $period->id)->get();

        $assignmentsByQa = $allAssignments->groupBy(function($item) {
            return strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
        });

        // 2c. Fetch QA Users for real-time online/offline presence tracking
        $qaUsers = \App\Models\User::where('role', 'quality_assurance')->get();
        $usersByQaName = $qaUsers->keyBy(function($u) {
            return strtoupper(trim(str_replace('.', ' ', $u->name)));
        });

        $evaluatorList = [];
        $totalDistributed = $allAssignments->count();
        $totalCompleted = 0;
        $totalInProgress = 0;
        $totalAssigned = 0;
        $totalSkipped = 0;
        $totalAbandoned = 0;
        $activeEvaluatingQas = 0;
        $activeDutyQasCount = 0;
        $onlineQasCount = 0;

        foreach ($allQaNames as $qaName) {
            $normalizedName = strtoupper(trim(str_replace('.', ' ', $qaName)));
            $qaAssignments = $assignmentsByQa->get($normalizedName, collect());

            // If not found by normalized name, try finding with like or dot
            if ($qaAssignments->isEmpty()) {
                $qaAssignments = $allAssignments->filter(function($item) use ($qaName, $normalizedName) {
                    $eval = strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
                    return $eval === $normalizedName || str_contains($eval, $normalizedName);
                });
            }

            $targetObj = $qaTargets->get($qaName);
            $targetQuota = $targetObj ? $targetObj->target_total : 370;
            if ($targetQuota <= 0) $targetQuota = 370;

            $completed = $qaAssignments->where('status', 'COMPLETED');
            $inProgress = $qaAssignments->where('status', 'IN_PROGRESS');
            $assigned = $qaAssignments->where('status', 'ASSIGNED');
            $skipped = $qaAssignments->where('status', 'SKIPPED');
            $abandoned = $qaAssignments->where('status', 'ABANDONED');
            $reassigned = $qaAssignments->where('status', 'REASSIGNED');

            $completedCount = $completed->count();
            $inProgressCount = $inProgress->count();
            $assignedCount = $assigned->count();
            $skippedCount = $skipped->count();
            $abandonedCount = $abandoned->count();
            $reassignedCount = $reassigned->count();
            $totalBucket = $qaAssignments->count();

            // Daily & Backlog Metrics for QA
            $today = now()->startOfDay();
            $evalTodayAssigned = $qaAssignments->filter(fn($a) => $a->assigned_at && $a->assigned_at->isToday())->count();
            $evalTodayCompleted = $completed->filter(fn($a) => $a->completed_at && $a->completed_at->isToday())->count();
            $evalBacklog = $qaAssignments->filter(fn($a) => $a->assigned_at && $a->assigned_at->lt($today) && !in_array($a->status, ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED']))->count();
            $evalDailyTarget = array_sum($period->daily_category_composition ?: \App\Services\Sampling\AutoDistributionEngineService::DAILY_CATEGORY_TARGETS) ?: 20;

            $totalCompleted += $completedCount;
            $totalInProgress += $inProgressCount;
            $totalAssigned += $assignedCount;
            $totalSkipped += $skippedCount;
            $totalAbandoned += $abandonedCount;
            if ($inProgressCount > 0) {
                $activeEvaluatingQas++;
            }

            $avgScore = $completed->whereNotNull('score_ca')->avg('score_ca');
            $avgScore = $avgScore !== null ? round((float)$avgScore, 1) : ($targetObj ? (float)$targetObj->avg_score : null);

            $fcrCount = $completed->filter(fn($c) => strtoupper($c->fcr ?? '') === 'YA')->count();
            $fcrPct = $completedCount > 0 ? round(($fcrCount / $completedCount) * 100, 1) : null;

            $achievementPct = $targetQuota > 0 ? round(($completedCount / $targetQuota) * 100, 1) : 0.0;
            $abandonRatePct = $totalBucket > 0 ? round(($abandonedCount / $totalBucket) * 100, 1) : 0.0;

            // Determine status
            $currentStatus = 'IDLE';
            $statusLabel = 'Menunggu Antrean';
            if ($inProgressCount > 0) {
                $currentStatus = 'SEDANG_MENILAI';
                $statusLabel = 'Sedang Menilai';
            } elseif ($completedCount >= $targetQuota && $targetQuota > 0) {
                $currentStatus = 'SELESAI_KUOTA';
                $statusLabel = 'Kuota Tercapai';
            } elseif ($assignedCount > 0) {
                $currentStatus = 'ANTREAN_SIAP';
                $statusLabel = 'Antrean Siap';
            }

            // Extract active tickets currently being handled
            $activeTickets = $inProgress->map(function ($item) {
                $rawAgentName = $item->agent ? $item->agent->name : 'CSO Agent';
                $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
                return [
                    'id' => $item->id,
                    'ticket_id' => $item->ticket_id,
                    'agent_name' => $cleanAgentName,
                    'agent_nik' => $item->agent ? $item->agent->nik : '-',
                    'channel' => $item->channel ?: ($item->service ? $item->service->name : 'Inbound'),
                    'category_name' => $item->category_name ?: 'REGULER',
                    'assignment_type' => $item->assignment_type,
                    'started_at' => $item->updated_at ? $item->updated_at->format('Y-m-d H:i:s') : null,
                    'time_display' => $item->updated_at ? $item->updated_at->format('H:i') : null,
                ];
            })->values();

            // Extract last completed ticket
            $lastCompleted = $completed->sortByDesc('completed_at')->first();
            $lastCompletedData = null;
            if ($lastCompleted) {
                $rawAgentName = $lastCompleted->agent ? $lastCompleted->agent->name : 'CSO Agent';
                $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
                $lastCompletedData = [
                    'id' => $lastCompleted->id,
                    'ticket_id' => $lastCompleted->ticket_id,
                    'agent_name' => $cleanAgentName,
                    'channel' => $lastCompleted->channel ?: 'Inbound',
                    'score_ca' => $lastCompleted->score_ca,
                    'fcr' => $lastCompleted->fcr,
                    'completed_at' => $lastCompleted->completed_at ? $lastCompleted->completed_at->format('H:i:s') : ($lastCompleted->updated_at ? $lastCompleted->updated_at->format('H:i') : null),
                ];
            }

            // Attendance & Duty Status for today
            $qaAtts = $allAttendances->filter(function($a) use ($qaName, $normalizedName) {
                $eval = strtoupper(trim(str_replace('.', ' ', $a->evaluator_name)));
                return $eval === $normalizedName || str_contains($eval, $normalizedName) || str_contains($normalizedName, $eval);
            });
            $todayAtt = $qaAtts->first(function($a) use ($todayDateStr) {
                return Carbon::parse($a->work_date)->format('Y-m-d') === $todayDateStr;
            });
            $isOnDuty = $todayAtt ? ((bool)$todayAtt->is_ready && $todayAtt->status === \App\Services\Sampling\SamplingQaAttendanceService::STATUS_ON_DUTY && !empty($todayAtt->ready_at)) : false;
            $dutyStatus = $todayAtt ? (($todayAtt->status === 'ON_DUTY' && empty($todayAtt->ready_at)) ? 'STANDBY' : $todayAtt->status) : 'STANDBY';
            $workDaysCount = $qaAtts->where('status', 'ON_DUTY')->where('is_ready', true)->whereNotNull('ready_at')->count();
            $offDaysCount = max(0, $qaAtts->count() - $workDaysCount);

            if ($isOnDuty) {
                $activeDutyQasCount++;
            }

            $dutyStatusLabel = match ($dutyStatus) {
                'ON_DUTY'   => 'On Duty',
                'STANDBY'   => 'Standby',
                'END_SHIFT' => 'End Shift',
                'OFF_DAY'   => 'Off Day (Libur)',
                'LEAVE'     => 'Cuti / Izin',
                'SICK'      => 'Sakit',
                'TRAINING'  => 'Training',
                default     => 'Standby',
            };

            // Online / Offline presence status
            $matchedUser = $usersByQaName->get($normalizedName);
            if (!$matchedUser) {
                $matchedUser = $qaUsers->first(function($u) use ($normalizedName) {
                    $un = strtoupper(trim(str_replace('.', ' ', $u->name)));
                    return $un === $normalizedName || str_contains($un, $normalizedName) || str_contains($normalizedName, $un);
                });
            }
            $isOnline = $matchedUser ? $matchedUser->is_online : false;
            $lastSeenAt = $matchedUser && $matchedUser->last_seen_at ? $matchedUser->last_seen_at->toIso8601String() : null;
            $lastSeenText = $matchedUser ? $matchedUser->last_seen_text : 'Offline';

            if ($isOnline) {
                $onlineQasCount++;
            }

            $evaluatorList[] = [
                'evaluator_name' => $qaName,
                'user_id' => $matchedUser ? $matchedUser->id : null,
                'target_quota' => $targetQuota,
                'daily_target' => $evalDailyTarget,
                'today_assigned' => $evalTodayAssigned,
                'today_completed' => $evalTodayCompleted,
                'today_achievement_pct' => $evalDailyTarget > 0 ? round(($evalTodayCompleted / $evalDailyTarget) * 100, 1) : 0.0,
                'backlog_count' => $evalBacklog,
                'total_bucket' => $totalBucket,
                'mandatory_count' => $qaAssignments->where('assignment_type', 'MANDATORY')->count(),
                'additional_count' => $qaAssignments->where('assignment_type', 'ADDITIONAL')->count(),
                'completed_count' => $completedCount,
                'in_progress_count' => $inProgressCount,
                'assigned_count' => $assignedCount,
                'skipped_count' => $skippedCount,
                'abandoned_count' => $abandonedCount,
                'abandon_rate_pct' => $abandonRatePct,
                'reassigned_count' => $reassignedCount,
                'achievement_pct' => $achievementPct,
                'avg_score' => $avgScore,
                'fcr_pct' => $fcrPct,
                'is_on_duty' => $isOnDuty,
                'duty_status' => $dutyStatus,
                'duty_status_label' => $dutyStatusLabel,
                'is_online' => $isOnline,
                'last_seen_at' => $lastSeenAt,
                'last_seen_text' => $lastSeenText,
                'work_days_count' => $workDaysCount,
                'off_days_count' => $offDaysCount,
                'current_status' => $currentStatus,
                'status_label' => $statusLabel,
                'active_tickets' => $activeTickets,
                'active_ticket_primary' => $activeTickets->first(),
                'last_completed' => $lastCompletedData,
            ];
        }

        $totalSiteTarget = count($evaluatorList) * 370;
        $teamAchievement = $totalSiteTarget > 0 ? round(($totalCompleted / $totalSiteTarget) * 100, 1) : 0.0;
        $teamCompletedAssignments = $allAssignments->where('status', 'COMPLETED')->whereNotNull('score_ca');
        $teamAvgScore = $teamCompletedAssignments->count() > 0 
            ? round((float)$teamCompletedAssignments->avg('score_ca'), 1) 
            : 0.0;

        $totalTodayAssigned = $allAssignments->filter(fn($a) => $a->assigned_at && $a->assigned_at->isToday())->count();
        $totalTodayCompleted = $allAssignments->filter(fn($a) => $a->completed_at && $a->completed_at->isToday() && $a->status === 'COMPLETED')->count();
        $totalBacklog = $allAssignments->filter(fn($a) => $a->assigned_at && $a->assigned_at->lt(now()->startOfDay()) && !in_array($a->status, ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED']))->count();
        $totalDailyTarget = count($evaluatorList) * (array_sum($period->daily_category_composition ?: \App\Services\Sampling\AutoDistributionEngineService::DAILY_CATEGORY_TARGETS) ?: 20);

        // Skipped tickets list
        $skippedAssignments = $allAssignments->where('status', 'SKIPPED');
        $skippedTickets = $skippedAssignments->map(function($sa) {
            $rawAgentName = $sa->agent ? $sa->agent->name : ($sa->assessment?->agent_name ?: 'CSO Agent');
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $skippedTime = $sa->completed_at ?: $sa->updated_at;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => is_object($sa->agent?->site) ? ($sa->agent->site->name ?? $sa->agent->site->code ?? 'Semarang') : (is_string($sa->agent?->site) ? $sa->agent->site : 'Semarang'),
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: '-',
                'skip_reason' => $sa->skip_reason ?: ($sa->notes ?: 'Recording Kosong / Silent Call'),
                'notes' => $sa->notes,
                'skipped_at' => $skippedTime ? $skippedTime->format('Y-m-d H:i:s') : null,
                'skipped_time_display' => $skippedTime ? $skippedTime->format('d M Y, H:i') : '-',
            ];
        })->values();

        // Abandoned tickets list (> 7 Hari SLA timeout atau ditinggalkan)
        $abandonedAssignments = $allAssignments->where('status', 'ABANDONED');
        $abandonedTickets = $abandonedAssignments->map(function($sa) {
            $rawAgentName = $sa->agent ? $sa->agent->name : ($sa->assessment?->agent_name ?: 'CSO Agent');
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $abandonedTime = $sa->abandoned_at ?: $sa->updated_at;
            $assignedAt = $sa->assigned_at;
            $daysElapsed = $assignedAt ? max(7, (int)now()->diffInDays($assignedAt, false)) : 7;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => is_object($sa->agent?->site) ? ($sa->agent->site->name ?? $sa->agent->site->code ?? 'Semarang') : (is_string($sa->agent?->site) ? $sa->agent->site : 'Semarang'),
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: 'GANGGUAN',
                'assignment_type' => $sa->assignment_type,
                'skip_reason' => $sa->skip_reason ?: 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari',
                'notes' => $sa->notes,
                'assigned_at' => $assignedAt ? $assignedAt->format('Y-m-d H:i:s') : null,
                'assigned_date_formatted' => $assignedAt ? $assignedAt->format('d/m/Y') : '-',
                'abandoned_at' => $abandonedTime ? $abandonedTime->format('Y-m-d H:i:s') : null,
                'abandoned_time_display' => $abandonedTime ? $abandonedTime->format('d M Y, H:i') : '-',
                'days_unhandled' => $daysElapsed,
                'can_reopen' => true,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'summary' => [
                'total_qa_evaluators' => count($evaluatorList),
                'active_duty_qas_count' => $activeDutyQasCount,
                'online_qas_count' => $onlineQasCount,
                'active_evaluating_qas' => $activeEvaluatingQas,
                'idle_qas' => count($evaluatorList) - $activeDutyQasCount,
                'total_distributed_tickets' => $totalDistributed,
                'total_completed_tickets' => $totalCompleted,
                'total_in_progress_tickets' => $totalInProgress,
                'total_assigned_tickets' => $totalAssigned,
                'total_skipped_tickets' => $totalSkipped,
                'total_abandoned_tickets' => $totalAbandoned,
                'abandon_rate_pct' => $totalDistributed > 0 ? round(($totalAbandoned / $totalDistributed) * 100, 1) : 0.0,
                'total_site_target' => $totalSiteTarget ?: (count($evaluatorList) * 370),
                'site_achievement_pct' => $teamAchievement,
                'team_avg_score' => $teamAvgScore,
                'daily_target' => $totalDailyTarget,
                'today_assigned' => $totalTodayAssigned,
                'today_completed' => $totalTodayCompleted,
                'today_achievement_pct' => $totalDailyTarget > 0 ? round(($totalTodayCompleted / $totalDailyTarget) * 100, 1) : 0.0,
                'backlog_count' => $totalBacklog,
            ],
            'evaluators' => $evaluatorList,
            'skipped_tickets' => $skippedTickets,
            'abandoned_tickets' => $abandonedTickets,
        ]);
    }

    /**
     * Get QA performance audit & tracking by date / week (Segment 2-C/2-D Audit).
     * GET /api/sampling/monitoring/audit-performance?period=2026-08
     */
    public function auditQaPerformance(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::syncActuals($periodCode);

        // Dynamic QA list strictly from registered quality_assurance users
        $qaUsersList = \App\Models\User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->pluck('name')
            ->toArray();

        // If no QA users exist in users table, purge any old orphan targets / attendances
        if (empty($qaUsersList)) {
            SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->delete();
            SamplingQaAttendance::where('sampling_period_id', $period->id)
                ->delete();
            $allQaNames = collect([]);
        } else {
            SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->whereNotIn('evaluator_name', $qaUsersList)
                ->delete();
            SamplingQaAttendance::where('sampling_period_id', $period->id)
                ->whereNotIn('evaluator_name', $qaUsersList)
                ->delete();
            $allQaNames = collect($qaUsersList);
        }

        // 1. Get all QA Targets for this period
        $qaTargets = SamplingTarget::where('sampling_period_id', $period->id)
            ->where('type', 'QA')
            ->get()
            ->keyBy('evaluator_name');

        // 2. Fetch all assignments with relations
        $allAssignments = SamplingAssignment::with(['agent', 'service'])
            ->where('sampling_period_id', $period->id)
            ->get();

        // 2b. Fetch attendances for work day tracking
        $allAttendances = \App\Models\SamplingQaAttendance::where('sampling_period_id', $period->id)->get();
        $todayDateStr = now()->format('Y-m-d');

        // 2c. Fetch QA Users for online presence
        $qaUsers = \App\Models\User::where('role', 'quality_assurance')->get();
        $usersByQaName = $qaUsers->keyBy(function($u) {
            return strtoupper(trim(str_replace('.', ' ', $u->name)));
        });

        $assignmentsByQa = $allAssignments->groupBy(function($item) {
            return strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
        });

        // 3. Define Weeks of the Month (e.g. August 2026: 31 days)
        $parts = explode('-', $periodCode);
        $year = (int)($parts[0] ?? 2026);
        $month = (int)($parts[1] ?? 8);
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);

        $weeksDefinition = [
            'W1' => ['label' => 'Minggu 1 (Tgl 1-7)', 'start' => 1, 'end' => 7],
            'W2' => ['label' => 'Minggu 2 (Tgl 8-14)', 'start' => 8, 'end' => 14],
            'W3' => ['label' => 'Minggu 3 (Tgl 15-21)', 'start' => 15, 'end' => 21],
            'W4' => ['label' => 'Minggu 4 (Tgl 22-28)', 'start' => 22, 'end' => 28],
            'W5' => ['label' => "Minggu 5 (Tgl 29-{$daysInMonth})", 'start' => 29, 'end' => $daysInMonth],
        ];

        // 4. Stalled / Abandoned Threshold (e.g. > 30 minutes in IN_PROGRESS)
        $now = now();
        $totalStalledCount = 0;
        $qasWithStalledCount = 0;
        $totalStagnantDaysCount = 0;

        $qaAuditCards = [];
        $weeklyMatrix = [];

        // Pre-build daily dates list
        $allDates = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
            $allDates[] = $dateStr;
        }

        foreach ($allQaNames as $qaName) {
            $normalizedName = strtoupper(trim(str_replace('.', ' ', $qaName)));
            $qaAssignments = $assignmentsByQa->get($normalizedName, collect());

            if ($qaAssignments->isEmpty()) {
                $qaAssignments = $allAssignments->filter(function($item) use ($normalizedName) {
                    $eval = strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
                    return $eval === $normalizedName || str_contains($eval, $normalizedName);
                });
            }

            $targetObj = $qaTargets->get($qaName);
            $targetQuota = $targetObj ? (int)$targetObj->target_total : 370;
            if ($targetQuota <= 0) $targetQuota = 370;
            $weeklyTargetIdeal = round($targetQuota / 4, 1);

            $completed = $qaAssignments->where('status', 'COMPLETED');
            $inProgress = $qaAssignments->where('status', 'IN_PROGRESS');
            $assigned = $qaAssignments->where('status', 'ASSIGNED');
            $skipped = $qaAssignments->where('status', 'SKIPPED');
            $abandoned = $qaAssignments->where('status', 'ABANDONED');

            // 4a. Detect Stalled / Abandoned Tickets
            $stalledTickets = [];
            foreach ($inProgress as $ip) {
                $startTime = $ip->started_at ?: $ip->updated_at;
                $diffMinutes = $startTime ? $startTime->diffInMinutes($now) : 0;
                $diffHours = $startTime ? round($diffMinutes / 60, 1) : 0;
                
                // If in_progress for > 30 minutes, or started on earlier date, consider stalled
                $isStalled = ($diffMinutes >= 30) || ($startTime && $startTime->format('Y-m-d') < $now->format('Y-m-d'));
                
                $rawAgentName = $ip->agent ? $ip->agent->name : 'CSO Agent';
                $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);

                $durationText = '';
                if ($diffMinutes < 60) {
                    $durationText = "{$diffMinutes} menit";
                } elseif ($diffHours < 24) {
                    $durationText = "{$diffHours} jam";
                } else {
                    $days = floor($diffMinutes / 1440);
                    $remHours = floor(($diffMinutes % 1440) / 60);
                    $durationText = "{$days} hari {$remHours} jam";
                }

                $severity = 'WARNING'; // 30-120 mins
                if ($diffMinutes > 120 || ($startTime && $startTime->format('Y-m-d') < $now->format('Y-m-d'))) {
                    $severity = 'CRITICAL'; // > 2 hours or previous day
                }

                $ticketInfo = [
                    'id' => $ip->id,
                    'ticket_id' => $ip->ticket_id,
                    'agent_name' => $cleanAgentName,
                    'agent_nik' => $ip->agent ? $ip->agent->nik : '-',
                    'channel' => $ip->channel ?: ($ip->service ? $ip->service->name : 'Inbound'),
                    'started_at' => $startTime ? $startTime->format('Y-m-d H:i:s') : null,
                    'started_time_display' => $startTime ? $startTime->format('d M H:i') : '-',
                    'stalled_minutes' => $diffMinutes,
                    'duration_text' => $durationText,
                    'is_stalled' => $isStalled,
                    'severity' => $severity,
                ];

                if ($isStalled) {
                    $stalledTickets[] = $ticketInfo;
                }
            }

            if (!empty($stalledTickets)) {
                $qasWithStalledCount++;
                $totalStalledCount += count($stalledTickets);
            }

            // 4b. Weekly Breakdown Calculation (W1 - W5)
            $weeklyProgress = [];
            foreach ($weeksDefinition as $wKey => $wDef) {
                $wCompleted = $completed->filter(function($c) use ($wDef, $year, $month) {
                    $date = $c->completed_at ?: $c->updated_at;
                    if (!$date) return false;
                    $d = (int)$date->format('j');
                    $m = (int)$date->format('n');
                    $y = (int)$date->format('Y');
                    return ($y === $year && $m === $month && $d >= $wDef['start'] && $d <= $wDef['end']);
                })->count();

                $weeklyProgress[$wKey] = [
                    'week' => $wKey,
                    'label' => $wDef['label'],
                    'target' => $wKey === 'W5' ? round($targetQuota * 0.1, 1) : $weeklyTargetIdeal,
                    'completed' => $wCompleted,
                    'status' => $wCompleted >= $weeklyTargetIdeal ? 'ON_TRACK' : ($wCompleted > 0 ? 'IN_PROGRESS' : 'PENDING'),
                ];
            }

            // 4c. Daily Breakdown Calculation
            $dailyActivity = [];
            $stagnantDates = [];
            $activeDaysCount = 0;

            foreach ($allDates as $dateStr) {
                $dayCompleted = $completed->filter(function($c) use ($dateStr) {
                    $date = $c->completed_at ?: $c->updated_at;
                    return $date && $date->format('Y-m-d') === $dateStr;
                })->count();

                $dailyActivity[$dateStr] = $dayCompleted;

                // Check if stagnant: date is in the past (before today), QA had pending tickets, but 0 completed
                $isPastDate = $dateStr <= $now->format('Y-m-d');
                if ($isPastDate && $dayCompleted === 0 && $qaAssignments->count() > 0 && $completed->count() < $targetQuota) {
                    // Check if it's a weekday (Monday-Friday)
                    $dayOfWeek = date('N', strtotime($dateStr));
                    if ($dayOfWeek <= 5) {
                        $stagnantDates[] = $dateStr;
                    }
                }

                if ($dayCompleted > 0) {
                    $activeDaysCount++;
                }
            }

            $stagnantDaysCount = count($stagnantDates);
            $totalStagnantDaysCount += $stagnantDaysCount;

            // 4d. Discipline & Audit Score Calculation (0 - 100%)
            $abandonedCount = $abandoned->count();
            $penalty = (count($stalledTickets) * 15) + ($abandonedCount * 10) + (min(5, $stagnantDaysCount) * 5);
            if ($completed->count() === 0 && $assigned->count() > 0 && $now->day > 10) {
                $penalty += 20;
            }
            $auditScore = max(10, min(100, 100 - $penalty));

            $disciplineStatus = 'DISIPLIN_TINGGI';
            $disciplineLabel = 'Disiplin Tinggi';
            if (!empty($stalledTickets) || $abandonedCount > 0 || $auditScore < 70) {
                $disciplineStatus = 'SERING_MENINGGALKAN_PEKERJAAN';
                $disciplineLabel = 'Sering Meninggalkan Pekerjaan';
            } elseif ($auditScore < 85 || $stagnantDaysCount > 2) {
                $disciplineStatus = 'PERLU_PERHATIAN';
                $disciplineLabel = 'Perlu Perhatian';
            }

            // Attendance & Duty Status
            $qaAtts = $allAttendances->filter(function($a) use ($qaName, $normalizedName) {
                $eval = strtoupper(trim(str_replace('.', ' ', $a->evaluator_name)));
                return $eval === $normalizedName || str_contains($eval, $normalizedName) || str_contains($normalizedName, $eval);
            });
            $todayAtt = $qaAtts->first(function($a) use ($todayDateStr) {
                return Carbon::parse($a->work_date)->format('Y-m-d') === $todayDateStr;
            });
            $isOnDuty = $todayAtt ? ((bool)$todayAtt->is_ready && $todayAtt->status === \App\Services\Sampling\SamplingQaAttendanceService::STATUS_ON_DUTY && !empty($todayAtt->ready_at)) : false;
            $dutyStatus = $todayAtt ? (($todayAtt->status === 'ON_DUTY' && empty($todayAtt->ready_at)) ? 'STANDBY' : $todayAtt->status) : 'STANDBY';
            $workDaysCount = $qaAtts->where('status', 'ON_DUTY')->where('is_ready', true)->whereNotNull('ready_at')->count();
            $offDaysCount = max(0, $qaAtts->count() - $workDaysCount);

            $dutyStatusLabel = match ($dutyStatus) {
                'ON_DUTY'   => 'On Duty',
                'STANDBY'   => 'Standby',
                'END_SHIFT' => 'End Shift',
                'OFF_DAY'   => 'Off Day (Libur)',
                'LEAVE'     => 'Cuti / Izin',
                'SICK'      => 'Sakit',
                'TRAINING'  => 'Training',
                default     => 'Standby',
            };

            // Online status lookup
            $matchedUser = $usersByQaName->get($normalizedName);
            if (!$matchedUser) {
                $matchedUser = $qaUsers->first(function($u) use ($normalizedName) {
                    $un = strtoupper(trim(str_replace('.', ' ', $u->name)));
                    return $un === $normalizedName || str_contains($un, $normalizedName) || str_contains($normalizedName, $un);
                });
            }
            $isOnline = $matchedUser ? $matchedUser->is_online : false;
            $lastSeenAt = $matchedUser && $matchedUser->last_seen_at ? $matchedUser->last_seen_at->toIso8601String() : null;
            $lastSeenText = $matchedUser ? $matchedUser->last_seen_text : 'Offline';

            $qaCard = [
                'evaluator_name' => $qaName,
                'user_id' => $matchedUser ? $matchedUser->id : null,
                'target_quota' => $targetQuota,
                'total_bucket' => $qaAssignments->count(),
                'completed_count' => $completed->count(),
                'in_progress_count' => $inProgress->count(),
                'assigned_count' => $assigned->count(),
                'skipped_count' => $skipped->count(),
                'abandoned_count' => $abandonedCount,
                'achievement_pct' => $targetQuota > 0 ? round(($completed->count() / $targetQuota) * 100, 1) : 0,
                'avg_score' => $completed->whereNotNull('score_ca')->avg('score_ca') ? round((float)$completed->whereNotNull('score_ca')->avg('score_ca'), 1) : 0,
                'audit_score' => $auditScore,
                'discipline_status' => $disciplineStatus,
                'discipline_label' => $disciplineLabel,
                'is_on_duty' => $isOnDuty,
                'duty_status' => $dutyStatus,
                'duty_status_label' => $dutyStatusLabel,
                'is_online' => $isOnline,
                'last_seen_at' => $lastSeenAt,
                'last_seen_text' => $lastSeenText,
                'work_days_count' => $workDaysCount,
                'off_days_count' => $offDaysCount,
                'stalled_tickets_count' => count($stalledTickets),
                'stalled_tickets' => $stalledTickets,
                'stagnant_days_count' => $stagnantDaysCount,
                'stagnant_dates' => array_slice($stagnantDates, -7),
                'active_days_count' => $activeDaysCount,
                'weekly_progress' => $weeklyProgress,
                'daily_activity' => $dailyActivity,
            ];

            $qaAuditCards[] = $qaCard;

            // Add to weekly matrix
            $weeklyMatrix[] = [
                'evaluator_name' => $qaName,
                'target_quota' => $targetQuota,
                'completed_total' => $completed->count(),
                'achievement_pct' => $qaCard['achievement_pct'],
                'audit_score' => $auditScore,
                'discipline_status' => $disciplineStatus,
                'discipline_label' => $disciplineLabel,
                'is_on_duty' => $isOnDuty,
                'duty_status' => $dutyStatus,
                'duty_status_label' => $dutyStatusLabel,
                'work_days_count' => $workDaysCount,
                'off_days_count' => $offDaysCount,
                'stalled_count' => count($stalledTickets),
                'abandoned_count' => $abandonedCount,
                'w1' => $weeklyProgress['W1']['completed'],
                'w2' => $weeklyProgress['W2']['completed'],
                'w3' => $weeklyProgress['W3']['completed'],
                'w4' => $weeklyProgress['W4']['completed'],
                'w5' => $weeklyProgress['W5']['completed'],
            ];
        }

        // Team rollup
        $teamAuditScore = count($qaAuditCards) > 0 ? round(collect($qaAuditCards)->avg('audit_score'), 1) : 100;

        // Extract Skipped Tickets for Supervisor Audit
        $skippedAssignments = $allAssignments->where('status', 'SKIPPED');
        $skippedTickets = $skippedAssignments->map(function($sa) {
            $rawAgentName = $sa->agent ? $sa->agent->name : ($sa->assessment?->agent_name ?: 'CSO Agent');
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $skippedTime = $sa->completed_at ?: $sa->updated_at;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => is_object($sa->agent?->site) ? ($sa->agent->site->name ?? $sa->agent->site->code ?? 'Semarang') : (is_string($sa->agent?->site) ? $sa->agent->site : 'Semarang'),
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: '-',
                'skip_reason' => $sa->skip_reason ?: ($sa->notes ?: 'Recording Kosong / Silent Call'),
                'notes' => $sa->notes,
                'skipped_at' => $skippedTime ? $skippedTime->format('Y-m-d H:i:s') : null,
                'skipped_time_display' => $skippedTime ? $skippedTime->format('d M Y, H:i') : '-',
            ];
        })->values();

        // Extract Abandoned Tickets for Supervisor Audit
        $abandonedAssignments = $allAssignments->where('status', 'ABANDONED');
        $abandonedTickets = $abandonedAssignments->map(function($sa) {
            $rawAgentName = $sa->agent ? $sa->agent->name : ($sa->assessment?->agent_name ?: 'CSO Agent');
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $abandonedTime = $sa->abandoned_at ?: $sa->updated_at;
            $assignedAt = $sa->assigned_at;
            $daysElapsed = $assignedAt ? max(7, (int)now()->diffInDays($assignedAt, false)) : 7;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => is_object($sa->agent?->site) ? ($sa->agent->site->name ?? $sa->agent->site->code ?? 'Semarang') : (is_string($sa->agent?->site) ? $sa->agent->site : 'Semarang'),
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: 'GANGGUAN',
                'assignment_type' => $sa->assignment_type,
                'skip_reason' => $sa->skip_reason ?: 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari',
                'notes' => $sa->notes,
                'assigned_at' => $assignedAt ? $assignedAt->format('Y-m-d H:i:s') : null,
                'assigned_date_formatted' => $assignedAt ? $assignedAt->format('d/m/Y') : '-',
                'abandoned_at' => $abandonedTime ? $abandonedTime->format('Y-m-d H:i:s') : null,
                'abandoned_time_display' => $abandonedTime ? $abandonedTime->format('d M Y, H:i') : '-',
                'days_unhandled' => $daysElapsed,
                'can_reopen' => true,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'days_in_month' => $daysInMonth,
            'summary' => [
                'total_qa_evaluators' => count($qaAuditCards),
                'total_stalled_tickets' => $totalStalledCount,
                'total_skipped_tickets' => $skippedTickets->count(),
                'total_abandoned_tickets' => $abandonedTickets->count(),
                'qas_with_stalled_tickets' => $qasWithStalledCount,
                'total_stagnant_days' => $totalStagnantDaysCount,
                'team_audit_score' => $teamAuditScore,
                'weeks_definition' => $weeksDefinition,
            ],
            'evaluators' => $qaAuditCards,
            'weekly_matrix' => $weeklyMatrix,
            'dates_list' => $allDates,
            'skipped_tickets' => $skippedTickets,
            'abandoned_tickets' => $abandonedTickets,
        ]);
    }

    /**
     * Simulate ticket abandonment due to SLA timeout (> 7 days unhandled).
     * POST /api/sampling/simulate/expire-stale
     */
    public function simulateExpireStale(Request $request)
    {
        $periodCode = $request->input('period', now()->format('Y-m'));
        $period = SamplingPeriod::where('period_code', $periodCode)->first();
        if (!$period) {
            $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        }

        // If force_simulate is true, mock older assigned_at dates for active uncompleted tickets
        if ($request->input('force_simulate', true)) {
            $daysAgo = (int)$request->input('days_ago', 8);
            $limit = (int)$request->input('limit', 20);
            $evaluator = $request->input('evaluator');

            $mockQuery = SamplingAssignment::where('sampling_period_id', $period->id)
                ->whereIn('status', ['ASSIGNED', 'IN_PROGRESS', 'PENDING']);

            if ($evaluator && $evaluator !== 'all') {
                $mockQuery->where('evaluator_name', $evaluator);
            }

            $mockIds = $mockQuery->limit($limit)->pluck('id');
            if ($mockIds->isNotEmpty()) {
                $pastDate = now()->subDays($daysAgo);
                SamplingAssignment::whereIn('id', $mockIds)->update([
                    'assigned_at' => $pastDate,
                    'valid_until' => $pastDate->copy()->addDays(7)->endOfDay(),
                ]);
            }
        }

        $expiredCount = AutoDistributionEngineService::autoExpireStaleAssignments($period->id);
        SamplingTargetEngineService::syncActuals($periodCode);

        \App\Services\NotificationService::send([
            'title'       => "Audit SLA: {$expiredCount} Tiket Abandoned (> 7 Hari)",
            'message'     => "Sistem mendeteksi {$expiredCount} tiket tidak di-handle lebih dari 7 hari dan otomatis dialihkan ke status ABANDONED.",
            'type'        => 'sampling',
            'action_url'  => '/auto-distribution?tab=audit_abandoned',
            'target_role' => 'supervisor',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Simulasi SLA 7 Hari berhasil dijalankan. Sebanyak {$expiredCount} tiket kadaluwarsa telah beralih status ke ABANDONED dan tercatat di histori serta monitoring supervisor.",
            'expired_count' => $expiredCount,
        ]);
    }

    /**
     * Get QA work readiness & attendance roster for a period / date (Rule 2).
     * GET /api/sampling/roster?period=2026-09&date=2026-09-12
     */
    public function getQaRoster(Request $request)
    {
        $period = $request->query('period', now()->format('Y-m'));
        $date = $request->query('date', now()->format('Y-m-d'));

        $data = \App\Services\Sampling\SamplingQaAttendanceService::getPeriodRoster($period, $date);

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }

    /**
     * Toggle or update single QA readiness / duty status for a date.
     * POST /api/sampling/roster/readiness
     */
    public function setQaReadiness(Request $request)
    {
        $request->validate([
            'evaluator_name'     => 'required|string',
            'date'               => 'required|date_format:Y-m-d',
            'status'             => 'nullable|string',
            'is_ready'           => 'nullable|boolean',
            'shift'              => 'nullable|string',
            'notes'              => 'nullable|string',
            'period'             => 'nullable|string',
            'auto_pull_tickets'  => 'nullable|boolean',
        ]);

        $period = $request->input('period', now()->format('Y-m'));
        $evaluatorName = $request->input('evaluator_name');
        $dateStr = $request->input('date');
        $status = $request->input('status', 'ON_DUTY');
        $isReady = $request->input('is_ready');
        $shift = $request->input('shift', 'Normal');
        $notes = $request->input('notes');
        $autoPullTickets = $request->has('auto_pull_tickets') ? (bool)$request->input('auto_pull_tickets') : true;

        $result = \App\Services\Sampling\SamplingQaAttendanceService::setQaReadiness(
            $period,
            $evaluatorName,
            $dateStr,
            $status,
            $isReady,
            $shift,
            $notes,
            $autoPullTickets
        );

        return response()->json($result);
    }

    /**
     * Execute Shift Cutoff Sweep for a date.
     * POST /api/sampling/roster/cutoff-sweep
     */
    public function cutoffSweep(Request $request)
    {
        $request->validate([
            'period'        => 'nullable|string',
            'date'          => 'required|date_format:Y-m-d',
            'cutoff_status' => 'nullable|string|in:OFF_DAY,LEAVE,SICK,TRAINING',
            'shift'         => 'nullable|string',
            'reason'        => 'nullable|string',
        ]);

        $period = $request->input('period', now()->format('Y-m'));
        $dateStr = $request->input('date');
        $cutoffStatus = $request->input('cutoff_status', 'OFF_DAY');
        $shift = $request->input('shift');
        $reason = $request->input('reason');

        $result = \App\Services\Sampling\SamplingQaAttendanceService::executeCutoffSweep(
            $period,
            $dateStr,
            $cutoffStatus,
            $shift,
            $reason
        );

        return response()->json($result);
    }

    /**
     * Bulk update roster for multiple QA / dates.
     * POST /api/sampling/roster/bulk-update
     */
    public function bulkUpdateQaRoster(Request $request)
    {
        $period = $request->input('period', now()->format('Y-m'));
        $entries = (array)$request->input('entries', []);

        $result = \App\Services\Sampling\SamplingQaAttendanceService::bulkUpdateRoster($period, $entries);

        return response()->json($result);
    }

    /**
     * Get QA's own duty status and today's quota details (Rule: QA Menentukan Kerja Sendiri).
     * GET /api/sampling/my-status?evaluator_name=...&period=2026-09&date=2026-09-12
     */
    public function getMyReadiness(Request $request)
    {
        $evaluatorName = $request->query('evaluator_name', $request->user()?->name ?: '');
        $period = $request->query('period', now()->format('Y-m'));
        $dateStr = $request->query('date', now()->format('Y-m-d'));

        if (empty($evaluatorName)) {
            return response()->json([
                'success' => true,
                'data'    => [
                    'evaluator_name' => '',
                    'is_on_duty' => false,
                    'status' => 'OFF_DAY',
                    'shift' => 'Normal',
                    'today_assigned_count' => 0,
                    'today_completed_count' => 0,
                    'remaining_daily_quota' => 0,
                    'is_ready' => false,
                ],
            ]);
        }

        $data = \App\Services\Sampling\SamplingQaAttendanceService::getQaReadiness($period, $evaluatorName, $dateStr);

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }

    /**
     * QA Evaluator Self-Service: Activate ON_DUTY / OFF_DAY and pull daily quota.
     * POST /api/sampling/my-readiness
     */
    public function setMyReadiness(Request $request)
    {
        $request->validate([
            'evaluator_name' => 'nullable|string',
            'status'         => 'required|string|in:ON_DUTY,OFF_DAY,CUTI,LEAVE,SAKIT,SICK,IJIN,TRAINING,STANDBY,END_SHIFT',
            'is_ready'       => 'nullable|boolean',
            'shift'          => 'nullable|string',
            'notes'          => 'nullable|string',
            'period'         => 'nullable|string',
            'date'           => 'nullable|date_format:Y-m-d',
            'pull_tickets'   => 'nullable|boolean',
        ]);

        $evaluatorName = $request->input('evaluator_name', $request->user()?->name ?: '');
        if (empty($evaluatorName)) {
            return response()->json([
                'success' => false,
                'message' => 'Nama evaluator tidak valid atau belum ditentukan.',
            ], 422);
        }
        $period = $request->input('period', now()->format('Y-m'));
        $dateStr = $request->input('date', now()->format('Y-m-d'));
        $status = strtoupper($request->input('status', 'ON_DUTY'));
        if ($status === 'CUTI' || $status === 'IJIN') $status = 'LEAVE';
        if ($status === 'SAKIT') $status = 'SICK';

        $isReady = $request->has('is_ready') ? (bool)$request->input('is_ready') : ($status === 'ON_DUTY');
        $shift = $request->input('shift', 'Normal');
        $notes = $request->input('notes');
        $pullTickets = $request->has('pull_tickets') ? (bool)$request->input('pull_tickets') : true;

        // Update attendance record with integrated JIT Auto-Pull & Safe Release
        $result = \App\Services\Sampling\SamplingQaAttendanceService::setQaReadiness(
            $period,
            $evaluatorName,
            $dateStr,
            $status,
            $isReady,
            $shift,
            $notes,
            $pullTickets
        );

        $pulledCount = $result['pulled_count'] ?? 0;
        $releasedCount = $result['released_count'] ?? 0;

        if ($status === 'ON_DUTY') {
            \App\Services\NotificationService::send([
                'title'       => "QA Bertugas: {$evaluatorName} [ON DUTY - {$shift}]",
                'message'     => "QA {$evaluatorName} mengaktifkan status ON DUTY tanggal {$dateStr} ({$shift})." . ($pulledCount > 0 ? " ({$pulledCount} tiket dialokasikan JIT)." : ""),
                'type'        => 'sampling',
                'action_url'  => '/lembar-sampling-qa',
                'target_role' => 'supervisor',
            ]);
        } elseif ($status === 'END_SHIFT') {
            \App\Services\NotificationService::send([
                'title'       => "QA End Shift: {$evaluatorName} [Selesai Shift]",
                'message'     => "QA {$evaluatorName} telah mengakhiri shift pengerjaan tiket sampling tanggal {$dateStr}." . ($releasedCount > 0 ? " ({$releasedCount} tiket antrean yang belum dikerjakan telah dilepas kembali ke pool)." : ""),
                'type'        => 'sampling',
                'action_url'  => '/lembar-sampling-qa',
                'target_role' => 'supervisor',
            ]);
        } else {
            \App\Services\NotificationService::send([
                'title'       => "QA {$status}: {$evaluatorName}",
                'message'     => "QA {$evaluatorName} beralih ke status {$status} tanggal {$dateStr}." . ($releasedCount > 0 ? " ({$releasedCount} tiket antrean diamankan kembali ke pool)." : ""),
                'type'        => 'sampling',
                'action_url'  => '/lembar-sampling-qa',
                'target_role' => 'supervisor',
            ]);
        }

        // Refresh attendance details with updated ticket count
        $updatedData = \App\Services\Sampling\SamplingQaAttendanceService::getQaReadiness($period, $evaluatorName, $dateStr);

        return response()->json([
            'success'        => true,
            'message'        => $result['message'] ?? ($status === 'ON_DUTY'
                ? "Status Anda sekarang ON DUTY ({$shift})!"
                : ($status === 'END_SHIFT'
                    ? "Shift hari ini telah berhasil diakhiri (End Shift)."
                    : "Status Anda telah diatur ke {$status}.")),
            'status'         => $status,
            'is_on_duty'     => $isReady,
            'shift'          => $shift,
            'pulled_count'   => $pulledCount,
            'released_count' => $releasedCount,
            'data'           => $updatedData,
        ]);
    }

    /**
     * Get Supervisor Daily Import & Distribution Readiness Status.
     * GET /api/sampling/import-readiness-status
     */
    public function getImportReadinessStatus(Request $request)
    {
        $today = now()->format('Y-m-d');
        $periodCode = $request->query('period', now()->format('Y-m'));
        $currentHour = (int)now()->format('H');
        $isBefore7Am = $currentHour < 7;

        $periodModel = \App\Services\Sampling\SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        // 1. Raw CRM Imported Tickets Pool vs Assigned to QA Sampling Buckets
        $totalRawImported = CaAssessment::where(function($q) use ($periodCode) {
            $q->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $periodCode)
              ->orWhere('source_file', 'LIKE', "%{$periodCode}%");
        })->count();

        $totalAssignedPeriod = SamplingAssignment::where('sampling_period_id', $periodModel->id)
            ->whereNotIn('status', ['CANCELLED'])
            ->count();

        $rawBufferRemaining = max(0, $totalRawImported - $totalAssignedPeriod);

        $todayAssignedCount = \App\Models\SamplingAssignment::where('sampling_period_id', $periodModel->id)
            ->whereDate('assigned_at', $today)
            ->where('status', '!=', 'CANCELLED')
            ->count();

        // Count raw records created/imported today specifically if any, or total active raw pool
        $todayRawCreatedCount = CaAssessment::where(function($q) use ($periodCode) {
            $q->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $periodCode)
              ->orWhere('source_file', 'LIKE', "%{$periodCode}%");
        })->whereDate('created_at', $today)->count();

        $todayImportedCount = $todayRawCreatedCount > 0 ? $todayRawCreatedCount : $totalRawImported;
        $importedToday = ($totalRawImported > 0) && ($rawBufferRemaining > 0 || $todayAssignedCount > 0);

        $lastImport = \App\Models\ImportBatch::where('status', 'completed')->orderBy('id', 'desc')->first()
            ?? \App\Models\SipImport::where('status', 'completed')->orderBy('id', 'desc')->first();

        // 2. Check today's QA roster & readiness
        $roster = \App\Services\Sampling\SamplingQaAttendanceService::getPeriodRoster($periodCode, $today);
        $readyQaNames = $roster['summary']['ready_qa_names'] ?? [];
        $readyCount = count($readyQaNames);

        // 3. Count how many tickets have been assigned to Ready QAs today
        $unassignedReadyQas = [];
        foreach ($readyQaNames as $qaName) {
            $assignedToQa = \App\Models\SamplingAssignment::where('sampling_period_id', $periodModel->id)
                ->whereDate('assigned_at', $today)
                ->where(function($q) use ($qaName) {
                    $clean = str_replace(' ', '.', strtoupper(trim($qaName)));
                    $withSpace = str_replace('.', ' ', strtoupper(trim($qaName)));
                    $q->where('evaluator_name', $qaName)
                      ->orWhere('evaluator_name', $clean)
                      ->orWhere('evaluator_name', $withSpace);
                })
                ->where('status', '!=', 'CANCELLED')
                ->count();
            
            if ($assignedToQa < 20) {
                $unassignedReadyQas[] = [
                    'name'     => $qaName,
                    'assigned' => $assignedToQa,
                    'deficit'  => max(0, 20 - $assignedToQa),
                ];
            }
        }

        // 4. Determine status & reminder message for Supervisor
        $reminderLevel = 'info';
        $reminderTitle = '';
        $reminderMessage = '';

        if (!$importedToday || $totalRawImported === 0) {
            $importedToday = false;
            $todayImportedCount = 0;
            $rawBufferRemaining = 0;
            $reminderLevel = $isBefore7Am ? 'urgent' : 'warning';
            $reminderTitle = "Pengingat Tarikan Transaksi CRM";
            if ($isBefore7Am) {
                $reminderMessage = "Upload file transaksi mentah CRM (Excel 62 kolom) sebelum pukul 07:00 WIB untuk auto-distribusi {$readyCount} QA Ready On Duty.";
            } else {
                $reminderMessage = "File transaksi mentah CRM hari ini belum diunggah. Sebanyak " . count($unassignedReadyQas) . " QA On Duty masih menunggu alokasi tiket baru.";
            }
        } else {
            if (empty($unassignedReadyQas)) {
                $reminderLevel = 'success';
                $reminderTitle = "Tarikan Transaksi Hari Ini Siap & Terdistribusi";
                $reminderMessage = "Tarikan data hari ini telah di-upload ({$todayImportedCount} baris). Seluruh QA On Duty ({$readyCount} QA) telah menerima alokasi kuota harian.";
            } else {
                $reminderLevel = 'info';
                $reminderTitle = "Tarikan Transaksi Siap — QA Ready";
                $reminderMessage = "Tarikan data hari ini telah di-upload ({$todayImportedCount} baris). Sebanyak " . count($unassignedReadyQas) . " QA Ready dapat langsung mengambil tiket sampling.";
            }
        }

        $activeQaCountForDaily = \App\Models\User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->count();
        $dailyNeededTotal = $readyCount > 0 ? ($readyCount * 20) : ($activeQaCountForDaily * 20);

        return response()->json([
            'success'                => true,
            'date'                   => $today,
            'formatted_date'         => \Carbon\Carbon::parse($today)->locale('id')->isoFormat('dddd, D MMMM Y'),
            'server_time'            => now()->format('H:i:s'),
            'current_hour'           => $currentHour,
            'is_before_7am'          => $isBefore7Am,
            'imported_today'         => $importedToday,
            'today_imported_count'   => $todayImportedCount,
            'daily_needed_total'     => $dailyNeededTotal,
            'raw_buffer_remaining'   => $rawBufferRemaining,
            'last_import'            => ($importedToday && $lastImport) ? [
                'file_name'    => $lastImport->file_name ?? $lastImport->original_filename ?? 'Batch Import',
                'created_at'   => $lastImport->created_at?->toIso8601String(),
                'success_rows' => $lastImport->success_rows,
                'status'       => $lastImport->status,
            ] : null,
            'ready_qas_count'        => $readyCount,
            'ready_qa_names'         => $readyQaNames,
            'today_assigned_count'   => $todayAssignedCount,
            'unassigned_ready_count' => count($unassignedReadyQas),
            'unassigned_ready_qas'   => $unassignedReadyQas,
            'reminder'               => [
                'level'       => $reminderLevel,
                'title'       => $reminderTitle,
                'message'     => $reminderMessage,
                'action_label'=> 'Upload Tarikan CRM',
                'action_url'  => '/auto-distribution',
            ],
        ]);
    }
}


