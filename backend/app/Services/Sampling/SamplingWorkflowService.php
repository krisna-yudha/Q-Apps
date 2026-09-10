<?php

namespace App\Services\Sampling;

use App\Models\EvaluatorSampling;
use App\Models\SamplingAssignment;
use App\Models\SamplingReassignmentLog;
use Illuminate\Support\Facades\DB;

class SamplingWorkflowService
{
    /**
     * Start evaluation on an assigned ticket.
     */
    public static function startAssessment(int $assignmentId): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        if ($assignment->status === 'ASSIGNED' || $assignment->status === 'PENDING') {
            $assignment->update([
                'status' => 'IN_PROGRESS',
                'started_at' => now(),
            ]);
        }

        return $assignment->fresh();
    }

    /**
     * Hold / Postpone evaluation on an active ticket.
     */
    public static function holdAssessment(int $assignmentId, ?string $reason = null): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        $assignment->update([
            'status' => 'PENDING',
            'started_at' => null, // Reset started_at so it does not trigger stalled audit alert
        ]);

        return $assignment->fresh();
    }

    /**
     * Complete evaluation with CA Score & FCR.
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
     * Skip an assigned ticket with valid operational reason.
     */
    public static function skipAssessment(int $assignmentId, string $reason): SamplingAssignment
    {
        $assignment = SamplingAssignment::findOrFail($assignmentId);

        $assignment->update([
            'status' => 'SKIPPED',
            'skip_reason' => $reason,
            'completed_at' => now(),
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
}
