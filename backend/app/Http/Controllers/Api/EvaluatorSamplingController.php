<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\EvaluatorSampling;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EvaluatorSamplingController extends Controller
{
    /**
     * Modul 4: Pencapaian Tim QA & Trainer (Sampling Progress)
     * Isolasi data matang evaluasi sampling QA (370 sesi per Evaluator / Trainer)
     */
    public function index(Request $request)
    {
        $period = $request->query('period', '2026-08');
        $type = $request->query('type', 'QA'); // Default to QA Evaluator view

        // Clean up any old invalid records
        EvaluatorSampling::whereIn('evaluator_name', ['QA.INBOUND', 'QA Lead 1'])->delete();
        EvaluatorSampling::where('evaluator_name', 'like', '%Siti%')->delete();

        // Detect available periods with processed QSF data (strictly excluding CRM_RAW)
        $assessmentPeriods = CaAssessment::where('source', '!=', 'CRM_RAW')
            ->whereNotNull('score_ca')
            ->select(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7) as period"))
            ->distinct()
            ->whereNotNull(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"))
            ->pluck('period')
            ->filter()
            ->toArray();

        $agentPeriods = Agent::where('evaluation_count', '>', 0)
            ->distinct()
            ->whereNotNull('period_month')
            ->pluck('period_month')
            ->filter()
            ->toArray();

        // Strictly evaluate periods from matang assessments and agents with evaluations
        $availablePeriods = array_values(array_unique(array_filter(array_merge(['2026-08', '2026-09'], $assessmentPeriods, $agentPeriods))));
        sort($availablePeriods);
        $latestActivePeriod = !empty($assessmentPeriods) ? max($assessmentPeriods) : (!empty($agentPeriods) ? max($agentPeriods) : '2026-08');

        // 1. Process QA Evaluator Metrics from Matang ca_assessments for this period (370 Sesi per QA Evaluator)
        $qaResultList = [];
        
        $qaUsers = User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->pluck('name')
            ->toArray();
        
        // Purge orphan QA records if QA user no longer exists
        if (empty($qaUsers)) {
            EvaluatorSampling::where('period_month', $period)->where('type', 'QA')->delete();
        } else {
            EvaluatorSampling::where('period_month', $period)->where('type', 'QA')->whereNotIn('evaluator_name', $qaUsers)->delete();
        }

        $activeQaNames = collect($qaUsers)->unique()->values();
        $totalQaQuota = $activeQaNames->count() * 370;
        $totalQaActual = 0;

        foreach ($activeQaNames as $canonicalName) {
            $quota = 370;
            $aliases = [
                $canonicalName,
                str_replace(' ', '.', $canonicalName),
                strtoupper($canonicalName),
                str_replace('.', ' ', $canonicalName),
                strtolower($canonicalName)
            ];

            // Query actual completed matang evaluations for this QA evaluator (strictly excluding CRM_RAW)
            $caRow = CaAssessment::whereIn('qa_name', $aliases)
                ->where(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $period)
                ->where('source', '!=', 'CRM_RAW')
                ->whereNotNull('score_ca')
                ->where('score_ca', '>', 0)
                ->select(
                    DB::raw('COUNT(*) as actual_samples'),
                    DB::raw('ROUND(AVG(score_ca), 2) as average_score')
                )
                ->first();

            $actual = $caRow ? (int)$caRow->actual_samples : 0;
            $avgScore = ($caRow && $caRow->average_score !== null) ? (float)$caRow->average_score : 0.00;

            $status = ($actual >= $quota) ? 'Achieved' : (($actual >= 300) ? 'On Track' : (($actual > 0) ? 'Need Boost' : 'Belum Mulai'));

            $totalQaActual += $actual;

            // Sync to table
            $evalRec = EvaluatorSampling::updateOrCreate(
                [
                    'evaluator_name' => $canonicalName,
                    'type'           => 'QA',
                    'period_month'   => $period,
                ],
                [
                    'quota'          => $quota,
                    'actual'         => $actual,
                    'avg_score'      => $avgScore,
                    'status'         => $status,
                ]
            );

            $qaResultList[] = [
                'id'             => $evalRec->id,
                'name'           => $canonicalName,
                'type'           => 'QA',
                'quota'          => $quota,
                'actual'         => $actual,
                'avgScore'       => round($avgScore, 2),
                'status'         => $status,
                'completionRate' => $quota > 0 ? round(($actual / $quota) * 100, 2) : 0.0,
            ];
        }

        // 2. Process Trainer Coaching Cohort Metrics (370 Sesi per Trainer)
        $trainers = Trainer::where('is_active', true)
            ->where('name', '!=', 'TRN Umum')
            ->where('name', 'not like', '%Siti%')
            ->get();

        $activeTrainerNames = $trainers->pluck('name')->toArray();
        if (empty($activeTrainerNames)) {
            EvaluatorSampling::where('period_month', $period)->where('type', 'Trainer')->delete();
        } else {
            EvaluatorSampling::where('period_month', $period)->where('type', 'Trainer')->whereNotIn('evaluator_name', $activeTrainerNames)->delete();
        }

        $trainerResultList = [];
        $totalTrainerQuota = $trainers->count() * 370;
        $totalTrainerEvals = 0;

        foreach ($trainers as $trn) {
            $trnQuota = 370;
            $aliases = [
                $trn->name,
                str_replace(' ', '.', $trn->name),
                strtoupper($trn->name),
                str_replace('.', ' ', $trn->name),
                strtolower($trn->name)
            ];

            // Get agents assigned to this trainer for this period with real evaluations
            $trainerAgents = Agent::where('trainer_id', $trn->id)
                ->where('period_month', $period)
                ->where('evaluation_count', '>', 0)
                ->get();
            
            // Fallback to all agents for this trainer if period_month is not yet populated
            if ($trainerAgents->isEmpty()) {
                $trainerAgents = Agent::where('trainer_id', $trn->id)->where('evaluation_count', '>', 0)->get();
            }

            $agentCount = $trainerAgents->count();
            $trainerAgentIds = $trainerAgents->pluck('id')->toArray();

            // Direct assessment count for this trainer's mentored cohort in this period
            $caQuery = CaAssessment::where(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $period)
                ->where('source', '!=', 'CRM_RAW')
                ->whereNotNull('score_ca')
                ->where('score_ca', '>', 0)
                ->where(function ($q) use ($trainerAgentIds, $aliases) {
                    if (!empty($trainerAgentIds)) {
                        $q->whereIn('agent_id', $trainerAgentIds);
                    }
                    $q->orWhereIn('qa_name', $aliases);
                });

            $caActual = (int)$caQuery->count();
            $caAvg = $caActual > 0 ? (float)$caQuery->avg('score_ca') : null;

            $actual = $caActual;
            
            // If no individual assessments directly found, check sum of active agents for this period
            if ($actual === 0 && $trainerAgents->isNotEmpty()) {
                $periodSum = (int)$trainerAgents->where('period_month', $period)->sum('evaluation_count');
                if ($periodSum > 0) {
                    $actual = $periodSum;
                }
            }

            $avgScore = $actual > 0 
                ? ($caAvg !== null ? round($caAvg, 2) : ($trainerAgents->avg('ca_score') ? round((float)$trainerAgents->avg('ca_score'), 2) : 0.0))
                : ($trainerAgents->avg('ca_score') ? round((float)$trainerAgents->avg('ca_score'), 2) : 0.0);

            $status = ($actual >= $trnQuota) ? 'Achieved' : (($actual >= 300) ? 'On Track' : (($actual > 0) ? 'Active Coaching' : 'No Activity'));
            $totalTrainerEvals += $actual;

            $evalRec = EvaluatorSampling::updateOrCreate(
                [
                    'evaluator_name' => $trn->name,
                    'type'           => 'Trainer',
                    'period_month'   => $period,
                ],
                [
                    'quota'          => $trnQuota,
                    'actual'         => $actual,
                    'avg_score'      => $avgScore,
                    'status'         => $status,
                ]
            );

            $trainerResultList[] = [
                'id'             => $evalRec->id,
                'name'           => $trn->name,
                'type'           => 'Trainer',
                'quota'          => $trnQuota,
                'actual'         => $actual,
                'avgScore'       => round($avgScore, 2),
                'status'         => $status,
                'completionRate' => $trnQuota > 0 ? round(($actual / $trnQuota) * 100, 2) : 0.0,
                'agentCount'     => $agentCount,
            ];
        }

        // 3. Assemble Response based on requested type
        if ($type === 'Trainer') {
            $evaluators = collect($trainerResultList)->sortByDesc('actual')->values();
            $count = $evaluators->count();
            $totalQuota = $totalTrainerQuota;
            $totalActual = $totalTrainerEvals;
            $overallCompletion = $totalQuota > 0 ? round(($totalActual / $totalQuota) * 100, 2) : 0.0;
            $activeWithScore = $evaluators->where('actual', '>', 0)->filter(fn($e) => $e['avgScore'] > 0);
            $avgScore = $activeWithScore->count() > 0 ? round((float)$activeWithScore->avg('avgScore'), 2) : 0.0;
        } else {
            // Default: 'QA' presents the QA Evaluators
            $evaluators = collect($qaResultList)->sortByDesc('actual')->values();
            $count = $evaluators->count();
            $totalQuota = $totalQaQuota;
            $totalActual = $totalQaActual;
            $overallCompletion = $totalQuota > 0 ? round(($totalActual / $totalQuota) * 100, 2) : 0.0;
            $activeWithScore = $evaluators->where('actual', '>', 0)->filter(fn($e) => $e['avgScore'] > 0);
            $avgScore = $activeWithScore->count() > 0 ? round((float)$activeWithScore->avg('avgScore'), 2) : 0.0;
        }

        return response()->json([
            'success' => true,
            'hasData' => $count > 0,
            'summary' => [
                'totalQuota'         => $totalQuota,
                'totalActual'        => $totalActual,
                'overallCompletion'  => $overallCompletion,
                'avgTeamScore'       => $avgScore,
                'evaluatorCount'     => $count,
                'viewType'           => $type,
                'selectedPeriod'     => $period,
                'latestActivePeriod' => $latestActivePeriod,
            ],
            'availablePeriods' => $availablePeriods,
            'evaluators' => $evaluators
        ]);
    }
}


