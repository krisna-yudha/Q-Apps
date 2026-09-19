<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\EvaluatorSampling;
use App\Models\Trainer;
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

        // Detect available periods with data
        $assessmentPeriods = CaAssessment::select(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7) as period"))
            ->distinct()
            ->whereNotNull(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"))
            ->pluck('period')
            ->filter()
            ->toArray();

        $availablePeriods = array_values(array_unique(array_filter(array_merge(['2026-08', '2026-09'], $assessmentPeriods))));
        sort($availablePeriods);
        $latestActivePeriod = !empty($assessmentPeriods) ? max($assessmentPeriods) : '2026-08';

        // 1. Process QA Evaluator Metrics from Matang ca_assessments for this period
        $qaResultList = [];
        
        $qaUsers = \App\Models\User::where('role', 'quality_assurance')
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

            // Query actual completed matang evaluations for this QA evaluator
            $row = CaAssessment::whereIn('qa_name', $aliases)
                ->where(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $period)
                ->select(
                    DB::raw('COUNT(*) as actual_samples'),
                    DB::raw('ROUND(AVG(score_ca), 1) as average_score')
                )
                ->first();

            $actual = $row ? (int)$row->actual_samples : 0;
            $avgScore = ($row && $row->average_score !== null) ? (float)$row->average_score : 90.0;
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
                'avgScore'       => $avgScore,
                'status'         => $status,
                'completionRate' => round(($actual / $quota) * 100, 1),
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
            $trainerAgents = Agent::where('trainer_id', $trn->id)->get();
            $agentCount = $trainerAgents->count();
            
            // Count actual evaluations for this trainer's cohort in this period
            // If assessments have trainer link or agent evaluation_count
            $actual = (int)$trainerAgents->sum('evaluation_count');
            $avg = $agentCount > 0 ? round((float)$trainerAgents->avg('ca_score'), 1) : 0.0;
            $totalTrainerEvals += $actual;

            // Standard Trainer target quota: 370 Sessions (matching DigiQA SOP Standard)
            $trnQuota = 370;

            $status = ($actual >= $trnQuota) ? 'Achieved' : (($actual >= 300) ? 'On Track' : (($actual > 0) ? 'Active Coaching' : 'No Activity'));

            $evalRec = EvaluatorSampling::updateOrCreate(
                [
                    'evaluator_name' => $trn->name,
                    'type'           => 'Trainer',
                    'period_month'   => $period,
                ],
                [
                    'quota'          => $trnQuota,
                    'actual'         => $actual,
                    'avg_score'      => $avg,
                    'status'         => $status,
                ]
            );

            $trainerResultList[] = [
                'id'             => $evalRec->id,
                'name'           => $trn->name,
                'type'           => 'Trainer',
                'quota'          => $trnQuota,
                'actual'         => $actual,
                'avgScore'       => $avg,
                'status'         => $status,
                'completionRate' => $trnQuota > 0 ? round(($actual / $trnQuota) * 100, 1) : 0,
                'agentCount'     => $agentCount,
            ];
        }

        // 3. Assemble Response based on requested type
        if ($type === 'Trainer') {
            $evaluators = collect($trainerResultList)->sortByDesc('actual')->values();
            $count = $evaluators->count();
            $totalQuota = $totalTrainerQuota;
            $totalActual = $totalTrainerEvals;
            $overallCompletion = $totalQuota > 0 ? round(($totalActual / $totalQuota) * 100, 1) : 0.0;
            $avgScore = $count > 0 ? round((float)$evaluators->avg('avgScore'), 1) : 0.0;
        } else {
            // Default: 'QA' presents the 8 QA Evaluators
            $evaluators = collect($qaResultList)->sortByDesc('actual')->values();
            $count = $evaluators->count();
            $totalQuota = $totalQaQuota;
            $totalActual = $totalQaActual;
            $overallCompletion = $totalQuota > 0 ? round(($totalActual / $totalQuota) * 100, 1) : 0.0;
            $avgScore = $count > 0 ? round((float)$evaluators->avg('avgScore'), 1) : 0.0;
        }

        return response()->json([
            'success' => true,
            'hasData' => $count > 0,
            'summary' => [
                'totalQuota'        => $totalQuota,
                'totalActual'       => $totalActual,
                'overallCompletion' => $overallCompletion,
                'avgTeamScore'      => $avgScore,
                'evaluatorCount'    => $count,
                'viewType'          => $type,
                'selectedPeriod'    => $period,
                'latestActivePeriod' => $latestActivePeriod,
            ],
            'availablePeriods' => $availablePeriods,
            'evaluators' => $evaluators
        ]);
    }
}

