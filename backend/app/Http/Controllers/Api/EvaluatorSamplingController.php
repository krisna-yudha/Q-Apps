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
    // View 6: Pencapaian Tim QA & Trainer (Sampling Progress)
    public function index(Request $request)
    {
        $period = $request->query('period', '2026-08');
        $type = $request->query('type'); // QA, Trainer, or all

        // 1. Auto-Aggregate QA Evaluators directly from QSF ca_assessments for this period
        $qaEvaluations = CaAssessment::select(
            'qa_name',
            DB::raw('COUNT(*) as actual_samples'),
            DB::raw('ROUND(AVG(score_ca), 1) as average_score')
        )
            ->whereNotNull('qa_name')
            ->where('qa_name', '!=', '')
            ->where(function ($q) use ($period) {
                $q->where('transaction_at', 'like', $period . '%')
                    ->orWhere('measurement_at', 'like', $period . '%');
            })
            ->groupBy('qa_name')
            ->get();

        foreach ($qaEvaluations as $qa) {
            $quota = 360; // Standard monthly QA quota
            $actual = (int)$qa->actual_samples;
            $avg = (float)$qa->average_score;
            $status = ($actual >= $quota) ? 'Achieved' : (($actual >= 300) ? 'On Track' : 'Need Boost');

            EvaluatorSampling::updateOrCreate(
                [
                    'evaluator_name' => $qa->qa_name,
                    'type' => 'QA',
                    'period_month' => $period,
                ],
                [
                    'quota' => $quota,
                    'actual' => $actual,
                    'avg_score' => $avg,
                    'status' => $status,
                ]
            );
        }

        // 2. Auto-Aggregate Trainers from NAKER and Agent evaluations
        $trainers = Trainer::where('is_active', true)
            ->where('name', '!=', 'TRN Umum')
            ->get();

        foreach ($trainers as $trn) {
            $trainerAgents = Agent::where('trainer_id', $trn->id)->get();
            $agentCount = $trainerAgents->count();
            $actual = (int)$trainerAgents->sum('evaluation_count');
            $avg = $agentCount > 0 ? round((float)$trainerAgents->avg('ca_score'), 1) : 0.0;
            $quota = 400; // Standard monthly Trainer coaching quota
            $status = ($actual >= $quota) ? 'Achieved' : (($actual >= 200) ? 'On Track' : 'In Progress');

            EvaluatorSampling::updateOrCreate(
                [
                    'evaluator_name' => $trn->name,
                    'type' => 'Trainer',
                    'period_month' => $period,
                ],
                [
                    'quota' => $quota,
                    'actual' => $actual,
                    'avg_score' => $avg,
                    'status' => $status,
                ]
            );
        }

        // 3. Query filtered evaluator samplings
        $query = EvaluatorSampling::query();

        if ($period) {
            $query->where('period_month', $period);
        }

        if ($type && $type !== 'all') {
            $query->where('type', $type);
        }

        $evaluators = $query->orderByDesc('actual')->get();
        $count = $evaluators->count();

        $totalQuota = $count > 0 ? (int)$evaluators->sum('quota') : 0;
        $totalActual = $count > 0 ? (int)$evaluators->sum('actual') : 0;
        $overallCompletion = $totalQuota > 0 ? round(($totalActual / $totalQuota) * 100, 1) : 0.0;
        $avgScore = $count > 0 ? round((float)$evaluators->avg('avg_score'), 1) : 0.0;

        return response()->json([
            'success' => true,
            'hasData' => $count > 0,
            'summary' => [
                'totalQuota' => $totalQuota,
                'totalActual' => $totalActual,
                'overallCompletion' => $overallCompletion,
                'avgTeamScore' => $avgScore,
                'evaluatorCount' => $count,
            ],
            'evaluators' => $evaluators->map(function ($e) {
                return [
                    'id' => $e->id,
                    'name' => $e->evaluator_name,
                    'type' => $e->type,
                    'quota' => (int)$e->quota,
                    'actual' => (int)$e->actual,
                    'avgScore' => (float)$e->avg_score,
                    'status' => $e->status,
                    'completionRate' => $e->quota > 0 ? round(($e->actual / $e->quota) * 100, 1) : 0,
                ];
            })
        ]);
    }
}

