<?php

namespace App\Services\Sampling;

use App\Models\EvaluatorSampling;
use App\Models\SamplingAssignment;
use App\Models\SamplingReassignmentLog;
use Illuminate\Support\Facades\DB;

class SamplingWorkflowService
{
    /**
     * Start evaluation on an assigned ticket (Status: On Cek / IN_PROGRESS).
     */
    public static function startAssessment(int $assignmentId): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        if ($assignment->status === 'ASSIGNED' || $assignment->status === 'PENDING' || $assignment->status === 'ABANDONED') {
            $assignment->update([
                'status' => 'IN_PROGRESS',
                'started_at' => now(),
            ]);
        }

        return $assignment->fresh();
    }

    /**
     * Hold / Postpone evaluation on an active ticket (Status: Pending / PENDING).
     */
    public static function holdAssessment(int $assignmentId, ?string $reason = null): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        $assignment->update([
            'status' => 'PENDING',
            'hold_at' => now(),
            'started_at' => null, // Reset started_at so it does not trigger stalled audit alert
            'notes' => $reason ?: $assignment->notes,
        ]);

        return $assignment->fresh();
    }

    /**
     * Abandon an active or pending ticket (Status: Abandoned / ABANDONED).
     */
    public static function abandonAssessment(int $assignmentId, string $reason): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        $assignment->update([
            'status' => 'ABANDONED',
            'skip_reason' => $reason,
            'notes' => $reason,
            'abandoned_at' => now(),
        ]);

        return $assignment->fresh();
    }

    /**
     * Complete evaluation with CA Score & FCR (Status: Sudah Dicek / COMPLETED).
     */
    public static function completeAssessment(int $assignmentId, array $data): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        DB::beginTransaction();
        try {
            $assignment->update([
                'status' => 'COMPLETED',
                'score_ca' => isset($data['score_ca']) ? (float)$data['score_ca'] : 90.0,
                'fcr' => isset($data['fcr']) ? strtoupper($data['fcr']) : 'YA',
                'notes' => $data['notes'] ?? null,
                'completed_at' => now(),
            ]);

            // Sync evaluator actuals
            $period = $assignment->period;
            if ($period) {
                SamplingTargetEngineService::syncActuals($period->period_code);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $assignment->fresh();
    }

    /**
     * Revert assessment status back to IN_PROGRESS (Belum Dicek / On Cek).
     */
    public static function uncompleteAssessment(int $assignmentId): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        DB::beginTransaction();
        try {
            $assignment->update([
                'status' => 'IN_PROGRESS',
                'completed_at' => null,
            ]);

            // Sync evaluator actuals
            $period = $assignment->period;
            if ($period) {
                SamplingTargetEngineService::syncActuals($period->period_code);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $assignment->fresh();
    }

    /**
     * Skip an assigned ticket with valid operational reason.
     */
    public static function skipAssessment(int $assignmentId, string $reason): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        $assignment->update([
            'status' => 'SKIPPED',
            'skip_reason' => $reason,
            'completed_at' => now(),
            'abandoned_at' => now(),
        ]);

        return $assignment->fresh();
    }

    /**
     * Reassign ticket from one evaluator to another (Supervisor action).
     */
    public static function reassignAssessment(
        int $assignmentId,
        string $toEvaluator,
        string $reason,
        string $reassignedBy = 'Supervisor'
    ): SamplingAssignment {
        $assignment = SamplingAssignment::findOrFail($assignmentId);
        $fromEvaluator = $assignment->evaluator_name;

        DB::beginTransaction();
        try {
            // Log reassignment
            SamplingReassignmentLog::create([
                'assignment_id' => $assignment->id,
                'from_evaluator' => $fromEvaluator,
                'to_evaluator' => $toEvaluator,
                'reassigned_by' => $reassignedBy,
                'reason' => $reason,
                'created_at' => now(),
            ]);

            // Update assignment
            $assignment->update([
                'evaluator_name' => $toEvaluator,
                'reassigned_from' => $fromEvaluator,
                'status' => 'ASSIGNED',
                'started_at' => null,
                'completed_at' => null,
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $assignment->fresh();
    }

    /**
     * Reopen an active, pending, or abandoned ticket for evaluation within validity or SPV authorization.
     */
    public static function reopenAssessment(int $assignmentId, ?string $reason = null): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        DB::beginTransaction();
        try {
            $notes = $assignment->notes;
            if ($reason) {
                $notes = $notes ? "{$notes} | Reopen: {$reason}" : "Reopen: {$reason}";
            }

            $assignment->update([
                'status' => 'IN_PROGRESS',
                'started_at' => now(),
                'hold_at' => null,
                'abandoned_at' => null,
                'skip_reason' => null,
                'valid_until' => now()->addDays(7)->endOfDay(),
                'notes' => $notes,
            ]);

            // Sync evaluator actuals if needed
            $period = $assignment->period;
            if ($period) {
                SamplingTargetEngineService::syncActuals($period->period_code);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $assignment->fresh();
    }
}

