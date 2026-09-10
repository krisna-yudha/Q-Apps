<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingReassignmentLog;
use App\Models\SamplingTarget;
use App\Services\Sampling\AutoDistributionEngineService;
use App\Services\Sampling\SamplingTargetEngineService;
use App\Services\Sampling\SamplingWorkflowService;
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
            'title'      => "Distribusi Sampling [{$period}] Selesai",
            'message'    => "Engine V2 berhasil membagi tiket antrean sampling ke 8 QA Evaluator.",
            'type'       => 'sampling',
            'action_url' => '/lembar-sampling-qa',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Auto Distribution tiket sampling periode {$period} berhasil dijalankan.",
            'data' => $result,
        ]);
    }

    /**
     * Get ticket list in QA work bucket with filters.
     * GET /api/sampling/bucket/tickets
     */
    public function bucketTickets(Request $request)
    {
        $periodCode = $request->query('period', '2026-08');
        $evaluator = $request->query('evaluator');
        $status = $request->query('status', 'all');
        $type = $request->query('type', 'all'); // 'MANDATORY', 'ADDITIONAL', 'all'
        $channel = $request->query('channel');
        $search = $request->query('search');
        $teamLeaderId = $request->query('team_leader_id');
        $perPage = (int)$request->query('per_page', 50);

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        $query = SamplingAssignment::with(['agent', 'service'])
            ->where('sampling_period_id', $period->id);

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
            $query->where('status', strtoupper($status));
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

        $paginated = $query->orderByRaw("FIELD(status, 'IN_PROGRESS', 'ASSIGNED', 'PENDING', 'COMPLETED', 'SKIPPED', 'REASSIGNED')")
            ->orderBy('id', 'asc')
            ->paginate($perPage);

        // Stats summary for the bucket
        $statsQuery = SamplingAssignment::where('sampling_period_id', $period->id);
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

        $totalBucket = (clone $statsQuery)->count();
        $mandatoryCount = (clone $statsQuery)->where('assignment_type', 'MANDATORY')->count();
        $additionalCount = (clone $statsQuery)->where('assignment_type', 'ADDITIONAL')->count();
        $completedCount = (clone $statsQuery)->where('status', 'COMPLETED')->count();
        $inProgressCount = (clone $statsQuery)->where('status', 'IN_PROGRESS')->count();
        $pendingCount = (clone $statsQuery)->where('status', 'PENDING')->count();
        $assignedCount = (clone $statsQuery)->where('status', 'ASSIGNED')->count();
        $skippedCount = (clone $statsQuery)->where('status', 'SKIPPED')->count();
        $reassignedCount = (clone $statsQuery)->where('status', 'REASSIGNED')->count();

        $formatted = collect($paginated->items())->map(function ($item) {
            $rawAgentName = $item->agent ? $item->agent->name : 'Unknown';
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);

            return [
                'id' => $item->id,
                'ticket_id' => $item->ticket_id,
                'agent_id' => $item->agent_id,
                'agent_name' => $cleanAgentName,
                'raw_agent_name' => $rawAgentName,
                'agent_nik' => $item->agent ? $item->agent->nik : '-',
                'site_id' => $item->site_id ?: 1,
                'site_code' => 'SMG',
                'site_name' => 'SEMARANG',
                'cso_classification' => $item->cso_classification ?: ($item->agent?->cso_classification ?: 'VERIFIED_NAKER'),
                'is_naker_verified' => $item->is_naker_verified !== null ? (bool)$item->is_naker_verified : true,
                'evaluator_name' => $item->evaluator_name,
                'channel' => $item->channel ?: ($item->service ? $item->service->name : 'Inbound'),
                'category_name' => $item->category_name ?: 'REGULER',
                'assignment_type' => $item->assignment_type,
                'status' => $item->status,
                'skip_reason' => $item->skip_reason,
                'reassigned_from' => $item->reassigned_from,
                'score_ca' => $item->score_ca !== null ? (float)$item->score_ca : null,
                'fcr' => $item->fcr,
                'assigned_at' => $item->assigned_at ? $item->assigned_at->format('Y-m-d H:i:s') : null,
                'completed_at' => $item->completed_at ? $item->completed_at->format('Y-m-d H:i:s') : null,
            ];
        });

        $targetQuota = 46;
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
            $targetQuota = $tgt ? $tgt->target_total : ($totalBucket ?: 46);
        } else {
            $targetQuota = 370;
        }

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'evaluator' => $evaluator ?: 'all',
            'stats' => [
                'target_quota' => $targetQuota,
                'total_bucket' => $totalBucket,
                'mandatory' => $mandatoryCount,
                'additional' => $additionalCount,
                'completed' => $completedCount,
                'in_progress' => $inProgressCount,
                'pending' => $pendingCount,
                'assigned' => $assignedCount,
                'skipped' => $skippedCount,
                'reassigned' => $reassignedCount,
                'achievement_pct' => $targetQuota > 0 ? round(($completedCount / $targetQuota) * 100, 1) : 0.0,
            ],
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'data' => $formatted,
        ]);
    }

    /**
     * Start assessment on an assigned ticket.
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
            'message' => "Tiket {$assignment->ticket_id} status diubah menjadi IN_PROGRESS.",
            'data' => $assignment,
        ]);
    }

    /**
     * Hold / Postpone assessment on a ticket.
     * POST /api/sampling/assignments/{id}/hold
     */
    public function hold(Request $request, int $id)
    {
        $reason = $request->input('reason', 'Penilaian Ditunda Sementara');
        $assignment = SamplingWorkflowService::holdAssessment($id, $reason);

        \App\Services\NotificationService::triggerSync('assessment_hold', [
            'assignment_id' => $assignment->id,
            'ticket_id'     => $assignment->ticket_id,
            'evaluator'     => $assignment->evaluator_name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Penilaian tiket {$assignment->ticket_id} berhasil ditunda (PENDING). Anda dapat mengerjakan tiket lain.",
            'data' => $assignment,
        ]);
    }

    /**
     * Complete assessment on a ticket.
     * POST /api/sampling/assignments/{id}/complete
     */
    public function complete(Request $request, int $id)
    {
        $request->validate([
            'score_ca' => 'required|numeric|min:0|max:100',
            'fcr' => 'required|in:YA,TIDAK,ya,tidak',
            'notes' => 'nullable|string',
        ]);

        $assignment = SamplingWorkflowService::completeAssessment($id, [
            'score_ca' => (float)$request->score_ca,
            'fcr' => strtoupper($request->fcr),
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
            'message' => "Penilaian tiket {$assignment->ticket_id} berhasil diselesaikan.",
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
        $periodCode = $request->input('period', '2026-08');
        $mode = $request->input('mode', 'assigned_only'); // 'assigned_only', 'all_sampling', 'wipe_imported_data'
        $evaluator = $request->input('evaluator');
        $channel = $request->input('channel');

        $period = SamplingPeriod::where('period_code', $periodCode)->first();
        if (!$period) {
            $period = \App\Services\Sampling\SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        }

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();

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
            SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
            $deletedCount = $query->delete();
            $msg = "Sebanyak {$deletedCount} tiket yang belum dinilai berhasil ditarik kembali dari antrean QA Evaluator.";
        } elseif ($mode === 'all_sampling') {
            // Tarik seluruh antrean tiket pada periode ini
            $targetIds = (clone $query)->pluck('id')->toArray();
            SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
            $deletedCount = $query->delete();
            $msg = "Seluruh antrean tiket sampling ({$deletedCount} tiket) pada periode {$periodCode} berhasil dikosongkan.";
        } elseif ($mode === 'wipe_imported_data') {
            // Tarik antrean + hapus seluruh raw assessment yang diimpor pada periode ini
            $targetIds = (clone $query)->pluck('id')->toArray();
            SamplingReassignmentLog::whereIn('assignment_id', $targetIds)->delete();
            $deletedCount = $query->delete();

            // Wipe assessments for this period
            $assessments = \App\Models\CaAssessment::where(function ($q) use ($periodCode) {
                $q->where('transaction_at', 'like', $periodCode . '%')
                  ->orWhere('measurement_at', 'like', $periodCode . '%')
                  ->orWhere('imported_at', 'like', $periodCode . '%')
                  ->orWhere('created_at', 'like', $periodCode . '%');
            })->get();

            $asmIds = $assessments->pluck('id')->toArray();
            if (!empty($asmIds)) {
                \App\Models\CaAssessmentScore::whereIn('assessment_id', $asmIds)->delete();
                \App\Models\CaAssessment::whereIn('id', $asmIds)->delete();
            }

            $msg = "Seluruh antrean sampling ({$deletedCount} tiket) dan data tarikan asesmen impor periode {$periodCode} berhasil dihapus.";
        }

        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => $msg,
            'deleted_count' => $deletedCount,
            'mode' => $mode,
        ]);
    }

    /**
     * Clear all sampling assignments for a period.
     * POST /api/sampling/bucket/clear
     */
    public function clearBucket(Request $request)
    {
        $periodCode = $request->input('period', '2026-08');
        $period = SamplingPeriod::where('period_code', $periodCode)->first();

        \Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
        if ($period) {
            SamplingReassignmentLog::whereHas('assignment', function ($q) use ($period) {
                $q->where('sampling_period_id', $period->id);
            })->delete();
            $count = SamplingAssignment::where('sampling_period_id', $period->id)->delete();
        } else {
            SamplingReassignmentLog::truncate();
            $count = SamplingAssignment::count();
            SamplingAssignment::truncate();
        }
        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => "Seluruh antrian tiket sampling periode {$periodCode} ({$count} tiket) berhasil dikosongkan.",
            'deleted_count' => $count,
        ]);
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

        \Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();

        return response()->json([
            'success' => true,
            'message' => "Berkas import \"{$fileName}\" dan seluruh data tiket sampling terkait ({$deletedAssignments} penugasan) berhasil ditarik & dihapus.",
            'deleted_assignments' => $deletedAssignments,
        ]);
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
        $periodCode = $request->query('period', '2026-08');
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        // Sync actuals so target records are updated
        SamplingTargetEngineService::syncActuals($periodCode);

        // 1. Get QA Targets for this period
        $qaTargets = SamplingTarget::where('sampling_period_id', $period->id)
            ->where('type', 'QA')
            ->get()
            ->keyBy('evaluator_name');

        // Known standard QA list if targets not generated yet
        $standardQas = [
            'ALMIRA PARAMITHA', 'DEWI RIKA IRAWATI', 'DHITA KHARISMA', 'DIAN WAHYU WIBOWO',
            'FINA ANDRIYANI', 'HANI DWI SURYO', 'IIN SUGIARTI', 'TIARA RAMADHANI'
        ];

        // Also find any distinct evaluator_names in SamplingAssignment
        $assignedEvaluators = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereNotNull('evaluator_name')
            ->distinct()
            ->pluck('evaluator_name')
            ->toArray();

        $allQaNames = collect(array_merge($qaTargets->keys()->toArray(), $standardQas, $assignedEvaluators))
            ->unique()
            ->filter(fn($n) => !in_array($n, ['QA Lead 1', 'QA.INBOUND', 'TRN Umum']))
            ->values();

        // 2. Fetch all assignments for this period with relationships
        $allAssignments = SamplingAssignment::with(['agent', 'service'])
            ->where('sampling_period_id', $period->id)
            ->get();

        $assignmentsByQa = $allAssignments->groupBy(function($item) {
            return strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
        });

        $evaluatorList = [];
        $totalDistributed = $allAssignments->count();
        $totalCompleted = 0;
        $totalInProgress = 0;
        $totalAssigned = 0;
        $totalSkipped = 0;
        $activeEvaluatingQas = 0;

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
            $targetQuota = $targetObj ? $targetObj->target_total : 46;
            if ($targetQuota <= 0) $targetQuota = 46;

            $completed = $qaAssignments->where('status', 'COMPLETED');
            $inProgress = $qaAssignments->where('status', 'IN_PROGRESS');
            $assigned = $qaAssignments->where('status', 'ASSIGNED');
            $skipped = $qaAssignments->where('status', 'SKIPPED');
            $reassigned = $qaAssignments->where('status', 'REASSIGNED');

            $completedCount = $completed->count();
            $inProgressCount = $inProgress->count();
            $assignedCount = $assigned->count();
            $skippedCount = $skipped->count();
            $reassignedCount = $reassigned->count();
            $totalBucket = $qaAssignments->count();

            $totalCompleted += $completedCount;
            $totalInProgress += $inProgressCount;
            $totalAssigned += $assignedCount;
            $totalSkipped += $skippedCount;
            if ($inProgressCount > 0) {
                $activeEvaluatingQas++;
            }

            $avgScore = $completed->whereNotNull('score_ca')->avg('score_ca');
            $avgScore = $avgScore !== null ? round((float)$avgScore, 1) : ($targetObj ? (float)$targetObj->avg_score : null);

            $fcrCount = $completed->filter(fn($c) => strtoupper($c->fcr ?? '') === 'YA')->count();
            $fcrPct = $completedCount > 0 ? round(($fcrCount / $completedCount) * 100, 1) : null;

            $achievementPct = $targetQuota > 0 ? round(($completedCount / $targetQuota) * 100, 1) : 0.0;

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

            $evaluatorList[] = [
                'evaluator_name' => $qaName,
                'target_quota' => $targetQuota,
                'total_bucket' => $totalBucket,
                'mandatory_count' => $qaAssignments->where('assignment_type', 'MANDATORY')->count(),
                'additional_count' => $qaAssignments->where('assignment_type', 'ADDITIONAL')->count(),
                'completed_count' => $completedCount,
                'in_progress_count' => $inProgressCount,
                'assigned_count' => $assignedCount,
                'skipped_count' => $skippedCount,
                'reassigned_count' => $reassignedCount,
                'achievement_pct' => $achievementPct,
                'avg_score' => $avgScore,
                'fcr_pct' => $fcrPct,
                'current_status' => $currentStatus,
                'status_label' => $statusLabel,
                'active_tickets' => $activeTickets,
                'active_ticket_primary' => $activeTickets->first(),
                'last_completed' => $lastCompletedData,
            ];
        }

        $totalSiteTarget = count($evaluatorList) * 46;
        $teamAchievement = $totalSiteTarget > 0 ? round(($totalCompleted / $totalSiteTarget) * 100, 1) : 0.0;
        $teamCompletedAssignments = $allAssignments->where('status', 'COMPLETED')->whereNotNull('score_ca');
        $teamAvgScore = $teamCompletedAssignments->count() > 0 
            ? round((float)$teamCompletedAssignments->avg('score_ca'), 1) 
            : 0.0;

        // Skipped tickets list
        $skippedAssignments = $allAssignments->where('status', 'SKIPPED');
        $skippedTickets = $skippedAssignments->map(function($sa) {
            $rawAgentName = $sa->agent ? $sa->agent->name : 'CSO Agent';
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $skippedTime = $sa->completed_at ?: $sa->updated_at;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => $sa->agent ? ($sa->agent->site ?: 'Semarang') : 'Semarang',
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: '-',
                'skip_reason' => $sa->skip_reason ?: ($sa->notes ?: 'Recording Kosong / Silent Call'),
                'notes' => $sa->notes,
                'skipped_at' => $skippedTime ? $skippedTime->format('Y-m-d H:i:s') : null,
                'skipped_time_display' => $skippedTime ? $skippedTime->format('d M Y, H:i') : '-',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'summary' => [
                'total_qa_evaluators' => count($evaluatorList),
                'active_evaluating_qas' => $activeEvaluatingQas,
                'idle_qas' => count($evaluatorList) - $activeEvaluatingQas,
                'total_distributed_tickets' => $totalDistributed,
                'total_completed_tickets' => $totalCompleted,
                'total_in_progress_tickets' => $totalInProgress,
                'total_assigned_tickets' => $totalAssigned,
                'total_skipped_tickets' => $totalSkipped,
                'total_site_target' => $totalSiteTarget ?: 370,
                'site_achievement_pct' => $teamAchievement,
                'team_avg_score' => $teamAvgScore,
            ],
            'evaluators' => $evaluatorList,
            'skipped_tickets' => $skippedTickets,
        ]);
    }

    /**
     * Get QA performance audit & tracking by date / week (Segment 2-C/2-D Audit).
     * GET /api/sampling/monitoring/audit-performance?period=2026-08
     */
    public function auditQaPerformance(Request $request)
    {
        $periodCode = $request->query('period', '2026-08');
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::syncActuals($periodCode);

        // 1. Get all QA Evaluators
        $qaTargets = SamplingTarget::where('sampling_period_id', $period->id)
            ->where('type', 'QA')
            ->get()
            ->keyBy('evaluator_name');

        $standardQas = [
            'ALMIRA PARAMITHA', 'DEWI RIKA IRAWATI', 'DHITA KHARISMA', 'DIAN WAHYU WIBOWO',
            'FINA ANDRIYANI', 'HANI DWI SURYO', 'IIN SUGIARTI', 'TIARA RAMADHANI'
        ];

        $assignedEvaluators = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereNotNull('evaluator_name')
            ->distinct()
            ->pluck('evaluator_name')
            ->toArray();

        $allQaNames = collect(array_merge($qaTargets->keys()->toArray(), $standardQas, $assignedEvaluators))
            ->unique()
            ->filter(fn($n) => !in_array($n, ['QA Lead 1', 'QA.INBOUND', 'TRN Umum']))
            ->values();

        // 2. Fetch all assignments with relations
        $allAssignments = SamplingAssignment::with(['agent', 'service'])
            ->where('sampling_period_id', $period->id)
            ->get();

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
            $targetQuota = $targetObj ? $targetObj->target_total : 46;
            if ($targetQuota <= 0) $targetQuota = 46;
            $weeklyTargetIdeal = round($targetQuota / 4, 1);

            $completed = $qaAssignments->where('status', 'COMPLETED');
            $inProgress = $qaAssignments->where('status', 'IN_PROGRESS');
            $assigned = $qaAssignments->where('status', 'ASSIGNED');
            $skipped = $qaAssignments->where('status', 'SKIPPED');

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
            $penalty = (count($stalledTickets) * 15) + (min(5, $stagnantDaysCount) * 5);
            if ($completed->count() === 0 && $assigned->count() > 0 && $now->day > 10) {
                $penalty += 20;
            }
            $auditScore = max(10, min(100, 100 - $penalty));

            $disciplineStatus = 'DISIPLIN_TINGGI';
            $disciplineLabel = 'Disiplin Tinggi';
            if (!empty($stalledTickets) || $auditScore < 70) {
                $disciplineStatus = 'SERING_MENINGGALKAN_PEKERJAAN';
                $disciplineLabel = 'Sering Meninggalkan Pekerjaan';
            } elseif ($auditScore < 85 || $stagnantDaysCount > 2) {
                $disciplineStatus = 'PERLU_PERHATIAN';
                $disciplineLabel = 'Perlu Perhatian';
            }

            $qaCard = [
                'evaluator_name' => $qaName,
                'target_quota' => $targetQuota,
                'total_bucket' => $qaAssignments->count(),
                'completed_count' => $completed->count(),
                'in_progress_count' => $inProgress->count(),
                'assigned_count' => $assigned->count(),
                'skipped_count' => $skipped->count(),
                'achievement_pct' => $targetQuota > 0 ? round(($completed->count() / $targetQuota) * 100, 1) : 0,
                'avg_score' => $completed->whereNotNull('score_ca')->avg('score_ca') ? round((float)$completed->whereNotNull('score_ca')->avg('score_ca'), 1) : 0,
                'audit_score' => $auditScore,
                'discipline_status' => $disciplineStatus,
                'discipline_label' => $disciplineLabel,
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
                'stalled_count' => count($stalledTickets),
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
            $rawAgentName = $sa->agent ? $sa->agent->name : 'CSO Agent';
            $cleanAgentName = \App\Services\Sampling\NakerVerificationService::cleanCsoName($rawAgentName);
            $skippedTime = $sa->completed_at ?: $sa->updated_at;

            return [
                'id' => $sa->id,
                'ticket_id' => $sa->ticket_id,
                'evaluator_name' => $sa->evaluator_name,
                'agent_name' => $cleanAgentName,
                'agent_nik' => $sa->agent ? $sa->agent->nik : '-',
                'agent_site' => $sa->agent ? ($sa->agent->site ?: 'Semarang') : 'Semarang',
                'channel' => $sa->channel ?: ($sa->service ? $sa->service->name : 'Inbound'),
                'category_name' => $sa->category_name ?: '-',
                'skip_reason' => $sa->skip_reason ?: ($sa->notes ?: 'Recording Kosong / Silent Call'),
                'notes' => $sa->notes,
                'skipped_at' => $skippedTime ? $skippedTime->format('Y-m-d H:i:s') : null,
                'skipped_time_display' => $skippedTime ? $skippedTime->format('d M Y, H:i') : '-',
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
                'qas_with_stalled_tickets' => $qasWithStalledCount,
                'total_stagnant_days' => $totalStagnantDaysCount,
                'team_audit_score' => $teamAuditScore,
                'weeks_definition' => $weeksDefinition,
            ],
            'evaluators' => $qaAuditCards,
            'weekly_matrix' => $weeklyMatrix,
            'dates_list' => $allDates,
            'skipped_tickets' => $skippedTickets,
        ]);
    }
}

