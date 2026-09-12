<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\EvaluatorSampling;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingTarget;
use App\Models\SamplingTargetCso;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SamplingTargetEngineService
{
    /**
     * Get or create a sampling period record.
     */
    public static function getOrCreatePeriod(string $periodCode = '2026-08'): SamplingPeriod
    {
        $parts = explode('-', $periodCode);
        $year = isset($parts[0]) ? (int)$parts[0] : 2026;
        $month = isset($parts[1]) ? (int)$parts[1] : 8;

        $monthNames = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];
        $monthName = ($monthNames[$month] ?? "Bulan $month") . " $year";

        return SamplingPeriod::firstOrCreate(
            ['period_code' => $periodCode],
            [
                'year' => $year,
                'month' => $month,
                'name' => $monthName,
                'target_ca' => 85.00,
                'target_fcr' => 100.00,
                'status' => 'OPEN',
            ]
        );
    }

    /**
     * Generate hierarchical targets for all QAs and Trainers for a given period.
     * Target: 370 per evaluator (346 mandatory + 24 additional).
     */
    public static function generatePeriodTargets(string $periodCode = '2026-08'): array
    {
        $period = self::getOrCreatePeriod($periodCode);
        $activeAgents = Agent::all();
        $csoCount = $activeAgents->count() > 0 ? $activeAgents->count() : 173;

        $mandatoryPerCso = 2;
        $mandatoryTotal = $csoCount * $mandatoryPerCso; // 173 * 2 = 346
        $targetTotal = 370;
        $additionalTarget = max(0, $targetTotal - $mandatoryTotal); // 24

        // 1. QA Evaluators (from User table where role = quality_assurance)
        $qaUsers = User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->orderBy('id', 'asc')
            ->get();
        $qaEvaluators = $qaUsers->pluck('name')->toArray();
        if (empty($qaEvaluators) || count($qaEvaluators) < 8) {
            $qaEvaluators = [
                'ALMIRA PARAMITHA', 'DEWI RIKA IRAWATI', 'DHITA KHARISMA', 'DIAN WAHYU WIBOWO',
                'FINA ANDRIYANI', 'HANI DWI SURYO', 'IIN SUGIARTI', 'TIARA RAMADHANI'
            ];
        }

        // 2. Trainer QA (from trainers table or predefined 8 Trainers)
        $trainers = Trainer::where('is_active', true)->where('name', '!=', 'TRN Umum')->get();
        $trainerNames = $trainers->pluck('name')->toArray();
        if (empty($trainerNames)) {
            $trainerNames = [
                'ADELA SUVY AHKAM', 'WIAN ANGGONO', 'OKTAVIA JESSICA SARI',
                'DENDY WAHYU PRADANA', 'SHANIA SADHANA PUJA', 'CATUR WIDJAYANTI',
                'BAGAS ALVIAN SYAH', 'TRAINER PENDAMPING'
            ];
        }

        $generatedTargets = [];

        DB::beginTransaction();
        try {
            // Delete any obsolete QA targets not in active 8 QA list
            SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->whereNotIn('evaluator_name', $qaEvaluators)
                ->delete();

            $qaTarget = 370; // Official Standard: 370 Sessions per QA Evaluator per month

            // Process QAs
            foreach ($qaEvaluators as $index => $qaName) {
                $target = SamplingTarget::updateOrCreate(
                    [
                        'sampling_period_id' => $period->id,
                        'evaluator_name' => $qaName,
                        'type' => 'QA',
                    ],
                    [
                        'target_total' => $qaTarget,
                        'mandatory_per_cso' => $mandatoryPerCso,
                        'cso_count' => $csoCount,
                        'mandatory_total' => min($qaTarget, $mandatoryTotal),
                        'additional_target' => max(0, $qaTarget - min($qaTarget, $mandatoryTotal)),
                    ]
                );

                // Create Target Matrix per CSO
                if ($target->wasRecentlyCreated || SamplingTargetCso::where('sampling_target_id', $target->id)->count() === 0) {
                    foreach ($activeAgents as $ag) {
                        SamplingTargetCso::updateOrCreate(
                            [
                                'sampling_target_id' => $target->id,
                                'agent_id' => $ag->id,
                            ],
                            [
                                'target_sampling' => $mandatoryPerCso,
                            ]
                        );
                    }
                }

                $generatedTargets[] = $target;
            }

            // Process Trainers
            foreach ($trainerNames as $trnName) {
                $target = SamplingTarget::updateOrCreate(
                    [
                        'sampling_period_id' => $period->id,
                        'evaluator_name' => $trnName,
                        'type' => 'Trainer',
                    ],
                    [
                        'target_total' => $targetTotal,
                        'mandatory_per_cso' => $mandatoryPerCso,
                        'cso_count' => $csoCount,
                        'mandatory_total' => $mandatoryTotal,
                        'additional_target' => $additionalTarget,
                    ]
                );
                $generatedTargets[] = $target;
            }

            // Sync actuals from assessments and evaluator_samplings
            self::syncActuals($periodCode);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'period' => $periodCode,
            'cso_count' => $csoCount,
            'target_total_per_evaluator' => $targetTotal,
            'mandatory_total' => $mandatoryTotal,
            'additional_total' => $additionalTarget,
            'total_evaluators' => count($generatedTargets),
            'site_total_quota' => count($generatedTargets) * $targetTotal,
        ];
    }

    /**
     * Sync actual completed samplings and calculate achievement.
     */
    public static function syncActuals(string $periodCode = '2026-08'): void
    {
        $period = SamplingPeriod::where('period_code', $periodCode)->first();
        if (!$period) return;

        $targets = SamplingTarget::where('sampling_period_id', $period->id)->get();

        foreach ($targets as $t) {
            // Count completed real assignments from database
            $assignmentCount = SamplingAssignment::where('sampling_period_id', $period->id)
                ->where('evaluator_name', $t->evaluator_name)
                ->where('status', 'COMPLETED')
                ->count();

            $avgScore = SamplingAssignment::where('sampling_period_id', $period->id)
                ->where('evaluator_name', $t->evaluator_name)
                ->where('status', 'COMPLETED')
                ->whereNotNull('score_ca')
                ->avg('score_ca');

            if ($assignmentCount === 0) {
                $evalSampling = EvaluatorSampling::where('period_month', $periodCode)
                    ->where('evaluator_name', $t->evaluator_name)
                    ->first();
                $actual = $evalSampling ? (int)$evalSampling->actual : 0;
                $avgScore = $evalSampling ? (float)$evalSampling->avg_score : 0.0;
            } else {
                $actual = $assignmentCount;
                $avgScore = $avgScore ? round((float)$avgScore, 1) : 0.0;
            }

            $achPct = $t->target_total > 0 ? round(($actual / $t->target_total) * 100, 1) : 0.0;
            $status = ($actual >= $t->target_total) ? 'Achieved' : (($actual >= 300) ? 'On Track' : 'In Progress');

            $t->update([
                'actual_completed' => $actual,
                'achievement_pct' => $achPct,
                'avg_score' => $avgScore,
                'status' => $status,
            ]);

            // Sync CSO matrix actuals
            $csoTargets = SamplingTargetCso::where('sampling_target_id', $t->id)->get();
            foreach ($csoTargets as $csoT) {
                $csoCompleted = SamplingAssignment::where('sampling_period_id', $period->id)
                    ->where('evaluator_name', $t->evaluator_name)
                    ->where('agent_id', $csoT->agent_id)
                    ->where('status', 'COMPLETED')
                    ->count();

                $csoT->update([
                    'actual_sampling' => $csoCompleted,
                ]);
            }
        }
    }

    /**
     * Get macro site summary metrics (Segment 2-D Site Overview).
     */
    public static function getSiteSummary(string $periodCode = '2026-08'): array
    {
        $period = self::getOrCreatePeriod($periodCode);
        self::syncActuals($periodCode);

        $targets = SamplingTarget::where('sampling_period_id', $period->id)->get();
        if ($targets->isEmpty()) {
            self::generatePeriodTargets($periodCode);
            $targets = SamplingTarget::where('sampling_period_id', $period->id)->get();
        }

        $qaTargets = $targets->where('type', 'QA');
        $trainerTargets = $targets->where('type', 'Trainer');

        $activeCso = Agent::count();
        $csoCount = $activeCso > 0 ? $activeCso : 173;

        $qaCount = $qaTargets->count() > 0 ? $qaTargets->count() : 8;
        $trainerCount = $trainerTargets->count() > 0 ? $trainerTargets->count() : 8;
        $totalEvaluators = $qaCount + $trainerCount;

        $totalSiteQuota = $totalEvaluators * 370;
        $totalQaQuota = $qaCount * 370;
        $totalQaMandatory = $qaCount * ($csoCount * 2);
        $totalQaAdditional = $totalQaQuota - $totalQaMandatory;

        $actualQaCompleted = (int)$qaTargets->sum('actual_completed');
        $actualSiteCompleted = (int)$targets->sum('actual_completed');

        $siteAchievement = $totalSiteQuota > 0 ? round(($actualSiteCompleted / $totalSiteQuota) * 100, 1) : 0.0;

        return [
            'period' => $periodCode,
            'period_name' => $period->name,
            'site_name' => 'SEMARANG (SMG)',
            'target_ca' => (float)$period->target_ca,
            'target_fcr' => (float)$period->target_fcr,
            'total_qa' => $qaCount,
            'total_trainer' => $trainerCount,
            'total_evaluators' => $totalEvaluators,
            'total_cso' => $csoCount,
            'target_per_evaluator' => 370,
            'mandatory_per_cso' => 2,
            'sampling_density_per_cso' => $qaCount * 2, // 16 sampling / CSO / month
            'mandatory_per_qa' => $csoCount * 2, // 346
            'additional_per_qa' => max(0, 370 - ($csoCount * 2)), // 24
            'total_site_quota' => $totalSiteQuota, // 5,920
            'total_qa_quota' => $totalQaQuota, // 2,960
            'total_qa_mandatory' => $totalQaMandatory, // 2,768
            'total_qa_additional' => $totalQaAdditional, // 192
            'actual_qa_completed' => $actualQaCompleted,
            'actual_site_completed' => $actualSiteCompleted,
            'site_achievement_pct' => $siteAchievement,
            'qa_evaluators' => $qaTargets->values(),
            'trainer_evaluators' => $trainerTargets->values(),
        ];
    }
}
