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
use App\Services\Sampling\NakerVerificationService;
use Illuminate\Support\Facades\DB;

class SamplingTargetEngineService
{
    public const DEFAULT_TARGET_PER_QA = 280;
    public const DEFAULT_MANDATORY_PER_CSO = 1; // 1x Wajib
    public const OPTIONAL_MAX_PER_CSO = 2;      // 2x Opsional, 3x Dilarang

    /**
     * Get default required sub-category targets (Kategori Wajib Sampling min 5 per QA).
     */
    public static function getDefaultRequiredSubCategoryTargets(): array
    {
        return [
            ['key' => 'INFORMASI_UBAH_DATA',      'label' => 'Informasi Ubah Data',      'category' => 'INFORMASI', 'min_target' => 5, 'keywords' => ['UBAH DATA'], 'enabled' => true],
            ['key' => 'INFORMASI_UPGRADE',        'label' => 'Informasi Upgrade',        'category' => 'INFORMASI', 'min_target' => 5, 'keywords' => ['UPGRADE'], 'enabled' => true],
            ['key' => 'INFORMASI_DOWNGRADE',      'label' => 'Informasi Downgrade',      'category' => 'INFORMASI', 'min_target' => 5, 'keywords' => ['DOWNGRADE'], 'enabled' => true],
            ['key' => 'INFORMASI_GANTI_PASSWORD', 'label' => 'Informasi Ganti Password', 'category' => 'INFORMASI', 'min_target' => 5, 'keywords' => ['GANTI PASSWORD', 'PASSWORD'], 'enabled' => true],
            ['key' => 'INFORMASI_GANTI_SSID',     'label' => 'Informasi Ganti Nama SSID','category' => 'INFORMASI', 'min_target' => 5, 'keywords' => ['GANTI NAMA SSID', 'NAMA SSID', 'SSID'], 'enabled' => true],
            ['key' => 'KELUHAN_BILLING',          'label' => 'Keluhan Billing',          'category' => 'KELUHAN',   'min_target' => 5, 'keywords' => ['BILLING', 'TAGIHAN'], 'enabled' => true],
            ['key' => 'KELUHAN_ISOLIR',           'label' => 'Keluhan Isolir',           'category' => 'KELUHAN',   'min_target' => 5, 'keywords' => ['ISOLIR'], 'enabled' => true],
            ['key' => 'KELUHAN_LAIN_LAIN',        'label' => 'Keluhan Lain-lain',        'category' => 'KELUHAN',   'min_target' => 5, 'keywords' => ['KELUHAN - LAIN', 'KELUHAN LAIN'], 'enabled' => true],
        ];
    }

    /**
     * Get active week key (w1..w5) for a given date.
     */
    public static function getActiveWeekKey(\Carbon\Carbon $date): string
    {
        $day = (int)$date->day;
        if ($day <= 7) return 'w1';
        if ($day <= 14) return 'w2';
        if ($day <= 21) return 'w3';
        if ($day <= 28) return 'w4';
        return 'w5';
    }

    /**
     * Get or build proportional Kluster A, B, C, D from Master NAKER CSOs and weekly rotation for QAs.
     */
    public static function getOrBuildCsoClusters(SamplingPeriod $period, bool $forceRebuild = false): array
    {
        $existing = $period->cso_clusters;
        if (!$forceRebuild && is_array($existing) && !empty($existing['clusters']) && !empty($existing['rotation'])) {
            return $existing;
        }

        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function ($q) {
                $q->where('name', 'not like', '%.01%')
                  ->where('name', 'not like', '%CSO.01%')
                  ->where('name', 'not like', '%OB.01%')
                  ->where('name', 'not like', '%AS.01%');
            })
            ->orderBy('channel', 'asc')
            ->orderBy('name', 'asc')
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::orderBy('channel', 'asc')->orderBy('name', 'asc')->get();
        }

        // Distribute CSOs proportionally (round-robin across sorted channel list) into Clusters A, B, C, D
        $clusterNames = ['A', 'B', 'C', 'D'];
        $clusters = [
            'A' => [],
            'B' => [],
            'C' => [],
            'D' => [],
        ];
        $agentClusterMap = [];

        foreach ($activeAgents->values() as $idx => $ag) {
            $cName = $clusterNames[$idx % 4];
            $clusters[$cName][] = [
                'agent_id' => (int)$ag->id,
                'name' => $ag->name,
                'nik' => $ag->nik,
                'channel' => $ag->channel ?: 'Inbound',
                'sub_channel' => $ag->sub_channel ?: '-',
            ];
            $agentClusterMap[(int)$ag->id] = $cName;
        }

        $qaUsers = User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->orderBy('id', 'asc')
            ->pluck('name')
            ->toArray();

        if (empty($qaUsers)) {
            $qaUsers = SamplingTarget::where('sampling_period_id', $period->id)
                ->where('type', 'QA')
                ->pluck('evaluator_name')
                ->toArray();
        }

        // 4-Week Rolling Rotation: pair QAs so each week each pair handles a different cluster
        $rotation = [
            'w1' => [],
            'w2' => [],
            'w3' => [],
            'w4' => [],
            'w5' => [],
        ];

        $totalQas = max(1, count($qaUsers));
        $groupSize = max(1, (int)ceil($totalQas / 4));
        foreach ($qaUsers as $qaIdx => $qaName) {
            $baseGroup = intdiv($qaIdx, $groupSize) % 4;
            $rotation['w1'][$qaName] = $clusterNames[$baseGroup];
            $rotation['w2'][$qaName] = $clusterNames[($baseGroup + 1) % 4];
            $rotation['w3'][$qaName] = $clusterNames[($baseGroup + 2) % 4];
            $rotation['w4'][$qaName] = $clusterNames[($baseGroup + 3) % 4];
            $rotation['w5'][$qaName] = $clusterNames[$baseGroup]; // W5 continuation / catch-up
        }

        $clusterPayload = [
            'total_cso' => $activeAgents->count(),
            'clusters' => $clusters,
            'agent_cluster_map' => $agentClusterMap,
            'rotation' => $rotation,
            'generated_at' => now()->toIso8601String(),
        ];

        $period->update(['cso_clusters' => $clusterPayload]);

        return $clusterPayload;
    }

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
                'daily_category_composition' => [
                    'INFORMASI' => 5,
                    'GANGGUAN' => 0,
                    'KELUHAN' => 5,
                    'PERMOHONAN' => 0,
                ],
                'daily_service_composition' => [
                    'INBOUND' => 2,
                    'EMAIL' => 1,
                    'DIGI DM' => 2,
                    'SOSMED' => 1,
                    'MYICON' => 2,
                    'OUTBOND' => 1,
                    'BACK OFFICE' => 1,
                ],
                'weekly_quota_targets' => [
                    'w1' => 70,
                    'w2' => 75,
                    'w3' => 75,
                    'w4' => 60,
                    'w5' => 0,
                    'total' => 280,
                    'cso_modes' => ['w1' => 1, 'w2' => 1, 'w3' => 2, 'w4' => 2, 'w5' => 2],
                ],
                'cso_sampling_policy' => [
                    'target_per_qa' => self::DEFAULT_TARGET_PER_QA,
                    'mandatory_per_cso' => self::DEFAULT_MANDATORY_PER_CSO,
                    'optional_max_per_cso' => self::OPTIONAL_MAX_PER_CSO,
                    'forbid_third' => true,
                ],
                'required_sub_category_targets' => self::getDefaultRequiredSubCategoryTargets(),
            ]
        );
    }

    /**
     * Generate hierarchical targets for all QAs and Trainers for a given period.
     * Target: Dynamic (default 280 per evaluator: ~170 mandatory 1x CSO + ~110 remaining thematic/optional 2x).
     */
    public static function generatePeriodTargets(string $periodCode = '2026-08'): array
    {
        $period = self::getOrCreatePeriod($periodCode);
        
        // Fetch strictly verified Human CSO Agents from Master NAKER
        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::all();
        }

        $csoCount = $activeAgents->count();

        $csoPolicy = $period->cso_sampling_policy ?: [];
        $weeklyTargets = $period->weekly_quota_targets ?: [];

        $mandatoryPerCso = max(1, min(2, (int)($csoPolicy['mandatory_per_cso'] ?? self::DEFAULT_MANDATORY_PER_CSO)));
        $targetTotal = (int)($weeklyTargets['total'] ?? ($csoPolicy['target_per_qa'] ?? self::DEFAULT_TARGET_PER_QA));
        if ($targetTotal <= 0) $targetTotal = self::DEFAULT_TARGET_PER_QA;

        $mandatoryTotal = $csoCount * $mandatoryPerCso;
        $additionalTarget = max(0, $targetTotal - $mandatoryTotal);

        // 1. QA Evaluators (from User table where role = quality_assurance)
        $qaUsers = User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->orderBy('id', 'asc')
            ->get();
        $qaEvaluators = $qaUsers->pluck('name')->toArray();

        // 2. Trainer QA (from trainers table)
        $trainers = Trainer::where('is_active', true)->where('name', '!=', 'TRN Umum')->get();
        $trainerNames = $trainers->pluck('name')->toArray();

        $generatedTargets = [];

        DB::beginTransaction();
        try {
            // Delete any obsolete QA targets not in active QA list
            if (empty($qaEvaluators)) {
                SamplingTarget::where('sampling_period_id', $period->id)
                    ->where('type', 'QA')
                    ->delete();
            } else {
                SamplingTarget::where('sampling_period_id', $period->id)
                    ->where('type', 'QA')
                    ->whereNotIn('evaluator_name', $qaEvaluators)
                    ->delete();
            }

            if (empty($trainerNames)) {
                SamplingTarget::where('sampling_period_id', $period->id)
                    ->where('type', 'Trainer')
                    ->delete();
            } else {
                SamplingTarget::where('sampling_period_id', $period->id)
                    ->where('type', 'Trainer')
                    ->whereNotIn('evaluator_name', $trainerNames)
                    ->delete();
            }

            $qaTarget = $targetTotal; // Dynamic Standard (Default: 280 Sessions per QA Evaluator per month)

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

                // Ensure Target Matrix per CSO reflects mandatory_per_cso (1x wajib, 2x opsional, 3x dilarang)
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
                } else {
                    SamplingTargetCso::where('sampling_target_id', $target->id)
                        ->update(['target_sampling' => $mandatoryPerCso]);
                }

                $generatedTargets[] = $target;
            }

            // Ensure clusters are initialized from Master NAKER
            self::getOrBuildCsoClusters($period);

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
                        'mandatory_total' => min($targetTotal, $mandatoryTotal),
                        'additional_target' => max(0, $targetTotal - min($targetTotal, $mandatoryTotal)),
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
            'mandatory_per_cso' => $mandatoryPerCso,
            'optional_max_per_cso' => self::OPTIONAL_MAX_PER_CSO,
            'mandatory_total' => min($targetTotal, $mandatoryTotal),
            'additional_total' => max(0, $targetTotal - min($targetTotal, $mandatoryTotal)),
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
                $avgScore = $avgScore ? round((float)$avgScore, 2) : 0.0;
            }

            $achPct = $t->target_total > 0 ? round(($actual / $t->target_total) * 100, 2) : 0.0;
            $onTrackThreshold = max(1, (int)round($t->target_total * 0.8));
            $status = ($actual >= $t->target_total) ? 'Achieved' : (($actual >= $onTrackThreshold) ? 'On Track' : 'In Progress');

            $t->update([
                'actual_completed' => $actual,
                'achievement_pct' => $achPct,
                'avg_score' => round($avgScore, 2),
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

        $verifiedAgentsQuery = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true);
        $csoCount = $verifiedAgentsQuery->count();
        if ($csoCount === 0) {
            $csoCount = Agent::count();
        }

        $qaCount = $qaTargets->count();
        $trainerCount = $trainerTargets->count();
        $totalEvaluators = $qaCount + $trainerCount;

        $csoPolicy = $period->cso_sampling_policy ?: [];
        $weeklyTargets = $period->weekly_quota_targets ?: [];

        $targetPerEvaluator = (int)($qaTargets->first()?->target_total ?? ($weeklyTargets['total'] ?? ($csoPolicy['target_per_qa'] ?? self::DEFAULT_TARGET_PER_QA)));
        if ($targetPerEvaluator <= 0) $targetPerEvaluator = self::DEFAULT_TARGET_PER_QA;

        $mandatoryPerCso = (int)($qaTargets->first()?->mandatory_per_cso ?? ($csoPolicy['mandatory_per_cso'] ?? self::DEFAULT_MANDATORY_PER_CSO));
        if ($mandatoryPerCso <= 0) $mandatoryPerCso = self::DEFAULT_MANDATORY_PER_CSO;

        $mandatoryPerQa = min($targetPerEvaluator, $csoCount * $mandatoryPerCso);
        $additionalPerQa = max(0, $targetPerEvaluator - $mandatoryPerQa);

        $totalSiteQuota = $totalEvaluators * $targetPerEvaluator;
        $totalQaQuota = $qaCount * $targetPerEvaluator;
        $totalQaMandatory = $qaCount * $mandatoryPerQa;
        $totalQaAdditional = max(0, $totalQaQuota - $totalQaMandatory);

        $actualQaCompleted = (int)$qaTargets->sum('actual_completed');
        $actualSiteCompleted = (int)$targets->sum('actual_completed');

        $siteAchievement = $totalSiteQuota > 0 ? round(($actualSiteCompleted / $totalSiteQuota) * 100, 2) : 0.0;

        $clusterData = self::getOrBuildCsoClusters($period);

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
            'target_per_evaluator' => $targetPerEvaluator,
            'mandatory_per_cso' => $mandatoryPerCso,
            'optional_max_per_cso' => self::OPTIONAL_MAX_PER_CSO,
            'forbid_third' => true,
            'sampling_density_per_cso' => $qaCount * $mandatoryPerCso,
            'mandatory_per_qa' => $mandatoryPerQa,
            'additional_per_qa' => $additionalPerQa,
            'total_site_quota' => $totalSiteQuota,
            'total_qa_quota' => $totalQaQuota,
            'total_qa_mandatory' => $totalQaMandatory,
            'total_qa_additional' => $totalQaAdditional,
            'actual_qa_completed' => $actualQaCompleted,
            'actual_site_completed' => $actualSiteCompleted,
            'site_achievement_pct' => $siteAchievement,
            'qa_evaluators' => $qaTargets->values(),
            'trainer_evaluators' => $trainerTargets->values(),
            'cso_sampling_policy' => [
                'target_per_qa' => $targetPerEvaluator,
                'mandatory_per_cso' => $mandatoryPerCso,
                'optional_max_per_cso' => self::OPTIONAL_MAX_PER_CSO,
                'forbid_third' => true,
            ],
            'weekly_quota_targets' => $weeklyTargets,
            'selected_sub_categories' => $period->selected_sub_categories ?: [],
            'required_sub_category_targets' => $period->required_sub_category_targets ?: self::getDefaultRequiredSubCategoryTargets(),
            'qa_custom_category_rules' => $period->qa_custom_category_rules ?: [],
            'cluster_summary' => [
                'A' => count($clusterData['clusters']['A'] ?? []),
                'B' => count($clusterData['clusters']['B'] ?? []),
                'C' => count($clusterData['clusters']['C'] ?? []),
                'D' => count($clusterData['clusters']['D'] ?? []),
            ],
        ];
    }
}
