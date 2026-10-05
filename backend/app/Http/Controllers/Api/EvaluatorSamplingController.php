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
        // 1. Detect all active periods with processed QSF data (strictly excluding CRM_RAW)
        $assessmentPeriodData = CaAssessment::where('source', '!=', 'CRM_RAW')
            ->whereNotNull('score_ca')
            ->where('score_ca', '>', 0)
            ->select(
                DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7) as period"),
                DB::raw("COUNT(*) as total_samples"),
                DB::raw("COUNT(DISTINCT qa_name) as total_evaluators"),
                DB::raw("ROUND(AVG(score_ca), 2) as avg_score")
            )
            ->groupBy('period')
            ->havingRaw("period IS NOT NULL AND period != ''")
            ->orderBy('period', 'desc')
            ->get()
            ->keyBy('period');

        $agentPeriods = Agent::where('evaluation_count', '>', 0)
            ->distinct()
            ->whereNotNull('period_month')
            ->pluck('period_month')
            ->filter()
            ->toArray();

        $rawPeriods = array_values(array_unique(array_filter(array_merge(
            $assessmentPeriodData->keys()->toArray(),
            $agentPeriods
        ))));
        rsort($rawPeriods);

        // Determine latest active period with real data
        $latestActivePeriod = !empty($rawPeriods) ? $rawPeriods[0] : '2026-09';
        if (!$assessmentPeriodData->has($latestActivePeriod) && $assessmentPeriodData->isNotEmpty()) {
            $latestActivePeriod = $assessmentPeriodData->keys()->first();
        }

        $period = $request->query('period', $latestActivePeriod);
        $type = $request->query('type', 'QA'); // Default to QA Evaluator view

        // Clean up any old invalid records
        EvaluatorSampling::whereIn('evaluator_name', ['QA.INBOUND', 'QA Lead 1'])->delete();
        EvaluatorSampling::where('evaluator_name', 'like', '%Siti%')->delete();

        // Month Names Mapping for Dynamic Period Options
        $monthNames = [
            '01' => 'Januari', '02' => 'Februari', '03' => 'Maret', '04' => 'April',
            '05' => 'Mei', '06' => 'Juni', '07' => 'Juli', '08' => 'Agustus',
            '09' => 'September', '10' => 'Oktober', '11' => 'November', '12' => 'Desember'
        ];

        $year = '2026';
        if (str_contains($period, '-')) {
            $year = explode('-', $period)[0];
        }

        $periodOptions = [];
        for ($m = 1; $m <= 12; $m++) {
            $mStr = str_pad($m, 2, '0', STR_PAD_LEFT);
            $pCode = "{$year}-{$mStr}";
            $mName = $monthNames[$mStr] ?? "Bulan {$m}";
            $hasData = $assessmentPeriodData->has($pCode);
            $samples = $hasData ? (int)$assessmentPeriodData[$pCode]->total_samples : 0;

            $periodOptions[] = [
                'value'       => $pCode,
                'label'       => $hasData ? "{$mName} {$year} ({$samples} Sampel)" : "{$mName} {$year}",
                'monthName'   => "{$mName} {$year}",
                'hasData'     => $hasData,
                'sampleCount' => $samples,
                'isLatest'    => ($pCode === $latestActivePeriod),
            ];
        }

        // 2. Process QA Evaluator Metrics from Registered QA Users and Matang Assessments
        $allEmployees = \App\Models\Employee::all();

        $qaUsers = User::whereIn('role', ['quality_assurance', 'qa', 'Quality Assurance'])
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND', 'TRN Umum'])
            ->orderBy('id', 'asc')
            ->get();

        // Also include any QA evaluator that exists in ca_assessments for this period
        $assessedQAs = CaAssessment::where(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $period)
            ->where('source', '!=', 'CRM_RAW')
            ->whereNotNull('score_ca')
            ->whereNotIn('qa_name', ['QA Lead 1', 'QA.INBOUND', 'TRN Umum'])
            ->distinct()
            ->pluck('qa_name')
            ->filter()
            ->toArray();

        $rawQaNames = collect(array_merge($qaUsers->pluck('name')->toArray(), $assessedQAs))
            ->map(fn($n) => trim($n))
            ->filter()
            ->unique()
            ->values();

        // Purge orphan QA records if QA user no longer exists
        if ($rawQaNames->isEmpty()) {
            EvaluatorSampling::where('period_month', $period)->where('type', 'QA')->delete();
        } else {
            EvaluatorSampling::where('period_month', $period)->where('type', 'QA')->whereNotIn('evaluator_name', $rawQaNames->toArray())->delete();
        }

        $qaResultList = [];
        $totalQaQuota = $rawQaNames->count() * 370;
        $totalQaActual = 0;

        foreach ($rawQaNames as $canonicalName) {
            $quota = 370;
            
            // Try to find matching employee from Master NAKER
            $cleanCanonical = strtolower(str_replace([' ', '.'], '', $canonicalName));
            $emp = $allEmployees->first(function($e) use ($cleanCanonical) {
                $eSip = strtolower(str_replace([' ', '.'], '', $e->sip_id));
                $eName = strtolower(str_replace([' ', '.'], '', $e->name));
                return $eSip === $cleanCanonical || $eName === $cleanCanonical;
            });

            $aliasCol = collect([
                $canonicalName,
                str_replace(' ', '.', $canonicalName),
                str_replace('.', ' ', $canonicalName),
                strtoupper($canonicalName),
                strtolower($canonicalName),
            ]);

            if ($emp) {
                $aliasCol->push($emp->name);
                $aliasCol->push($emp->sip_id);
                $aliasCol->push(strtoupper($emp->name));
                $aliasCol->push(strtolower($emp->name));
                $aliasCol->push(strtoupper($emp->sip_id));
                $aliasCol->push(strtolower($emp->sip_id));
                $aliasCol->push(str_replace(' ', '.', $emp->name));
                $aliasCol->push(str_replace('.', ' ', $emp->sip_id));

                // Token combinations (e.g. First + Last name)
                $tokens = explode(' ', trim($emp->name));
                if (count($tokens) > 2) {
                    $firstLast = $tokens[0] . '.' . end($tokens);
                    $firstLastSpace = $tokens[0] . ' ' . end($tokens);
                    $aliasCol->push($firstLast);
                    $aliasCol->push(strtoupper($firstLast));
                    $aliasCol->push(strtolower($firstLast));
                    $aliasCol->push($firstLastSpace);
                    $aliasCol->push(strtoupper($firstLastSpace));
                    $aliasCol->push(strtolower($firstLastSpace));
                }
            }

            $aliases = $aliasCol->map(fn($a) => trim($a))->filter()->unique()->values()->toArray();

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

            // Clean display name (use Master NAKER full name if available, or title case)
            $displayName = $emp 
                ? $emp->name 
                : (str_contains($canonicalName, '.') && !str_contains($canonicalName, ' ')
                    ? ucwords(strtolower(str_replace('.', ' ', $canonicalName)))
                    : $canonicalName);

            $qaResultList[] = [
                'id'             => $evalRec->id,
                'name'           => $canonicalName,
                'displayName'    => $displayName,
                'type'           => 'QA',
                'quota'          => $quota,
                'actual'         => $actual,
                'avgScore'       => round($avgScore, 2),
                'status'         => $status,
                'completionRate' => $quota > 0 ? round(($actual / $quota) * 100, 2) : 0.0,
            ];
        }

        // 3. Process Trainer Coaching Cohort Metrics (370 Sesi per Trainer)
        $trainers = Trainer::where('is_active', true)
            ->where('name', '!=', 'TRN Umum')
            ->where('name', 'not like', '%Siti%')
            ->orderBy('id', 'asc')
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
                'displayName'    => $trn->name,
                'type'           => 'Trainer',
                'quota'          => $trnQuota,
                'actual'         => $actual,
                'avgScore'       => round($avgScore, 2),
                'status'         => $status,
                'completionRate' => $trnQuota > 0 ? round(($actual / $trnQuota) * 100, 2) : 0.0,
                'agentCount'     => $agentCount,
            ];
        }

        // 4. Assemble Dynamic Response based on requested type
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
            'hasData' => $totalActual > 0,
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
            'availablePeriods' => $rawPeriods,
            'periodOptions'    => $periodOptions,
            'evaluators'       => $evaluators
        ]);
    }
}


