<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingQuotaRequest;
use App\Models\SamplingTarget;
use App\Models\SamplingTargetCso;
use App\Models\Site;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AutoDistributionEngineService
{
    /**
     * Daily Category Allocation Target per QA Evaluator
     * Informasi = 6, Gangguan = 7, Keluhan = 6, Permohonan = 1 (Total = 20 Tiket/QA/Hari)
     */
    public const DAILY_CATEGORY_TARGETS = [
        'INFORMASI'  => 6,
        'GANGGUAN'   => 7,
        'KELUHAN'    => 6,
        'PERMOHONAN' => 1,
    ];

    public const DAILY_TOTAL_PER_QA = 20;
    public const MAX_PER_AGENT_PER_QA_MONTHLY = 2; // Mandatory: max 2 tickets per agent per QA in 30 days

    /**
     * Helper to resolve standardized category name from raw assessment
     */
    public static function resolveCategoryName($asm): string
    {
        $catName = strtoupper(trim((string)($asm->category?->name ?? '')));
        $subCatName = strtoupper(trim((string)($asm->subCategory?->name ?? '')));
        $source = strtoupper(trim((string)($asm->source ?? '')));
        $sourceCa = strtoupper(trim((string)($asm->source_ca ?? '')));
        $sourceFile = strtoupper(trim((string)($asm->source_file ?? '')));
        $combined = "{$catName} {$subCatName} {$source} {$sourceCa} {$sourceFile}";

        if (str_contains($combined, 'PERMOHONAN') || str_contains($combined, 'PASANG BARU') || str_contains($combined, 'MUTASI') || str_contains($combined, 'REQUEST') || str_contains($combined, 'REGISTRASI')) {
            return 'PERMOHONAN';
        }
        if (str_contains($combined, 'KELUHAN') || str_contains($combined, 'KOMPLAIN') || str_contains($combined, 'COMPLAINT') || str_contains($combined, 'KLH')) {
            return 'KELUHAN';
        }
        if (str_contains($combined, 'GANGGUAN') || str_contains($combined, 'GGN') || str_contains($combined, 'TROUBLE') || str_contains($combined, 'INCIDENT') || str_contains($combined, 'RUSAK') || str_contains($combined, 'DOWN') || str_contains($combined, 'LOS')) {
            return 'GANGGUAN';
        }

        return 'INFORMASI';
    }

    /**
     * Helper to resolve channel string
     */
    public static function resolveChannel($raw): string
    {
        $u = strtoupper(trim((string)$raw));
        if ($u === 'PHONE' || str_contains($u, 'INBOUND') || str_contains($u, 'VOICE') || str_contains($u, 'CALL')) return 'Inbound';
        if (str_contains($u, 'LIVE') || str_contains($u, 'CHAT') || str_contains($u, 'DIGILIVE') || str_contains($u, 'PORTAL') || str_contains($u, 'BOT') || str_contains($u, 'NGAOSS') || str_contains($u, 'PLN')) return 'Digilive';
        if (str_contains($u, 'SOCMED') || str_contains($u, 'SOSMED') || str_contains($u, 'INSTAGRAM') || str_contains($u, 'WHATSAPP') || str_contains($u, 'FACEBOOK') || str_contains($u, 'TWITTER')) return 'Socmed';
        if (str_contains($u, 'EMAIL')) return 'Email';
        if (str_contains($u, 'BACK OFFICE') || str_contains($u, 'ESKALASI') || str_contains($u, 'INTERNAL') || str_contains($u, 'SALES') || str_contains($u, 'BO') || str_contains($u, 'SBU')) return 'Back Office';
        return 'Inbound';
    }

    /**
     * Get active QA evaluator names
     */
    public static function getActiveQaNames(SamplingPeriod $period): array
    {
        $qaTargets = SamplingTarget::where('sampling_period_id', $period->id)
            ->where('type', 'QA')
            ->get();

        $qaNames = $qaTargets->pluck('evaluator_name')->toArray();
        if (empty($qaNames) || count($qaNames) < 8) {
            $qaNames = [
                'ALMIRA PARAMITHA',
                'DEWI RIKA IRAWATI',
                'DHITA KHARISMA',
                'DIAN WAHYU WIBOWO',
                'FINA ANDRIYANI',
                'HANI DWI SURYO',
                'IIN SUGIARTI',
                'TIARA RAMADHANI'
            ];
        }
        return $qaNames;
    }

    /**
     * Run Daily Auto Distribution (20 Tickets per QA: 6 Informasi, 7 Gangguan, 6 Keluhan, 1 Permohonan)
     * Enforces:
     * 1. 20 tickets / QA / day: Informasi = 6, Gangguan = 7, Keluhan = 6, Permohonan = 1.
     * 2. Mandatory Max 2 tickets per agent per QA in a 30-day period.
     * 3. Cap on CSOs that already completed their monthly sampling target.
     * 4. Anti-duplicate ticket per period.
     */
    public static function runDailyDistribution(
        string $periodCode = '2026-08',
        ?string $dateStr = null,
        array $customQaList = [],
        bool $clearExistingForDay = false,
        array $customCategoryTargets = []
    ): array {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);

        // Resolve category composition targets (priority: passed custom targets -> saved period composition -> default static)
        $categoryTargets = self::DAILY_CATEGORY_TARGETS;
        if (!empty($customCategoryTargets)) {
            $cleaned = [];
            foreach ($customCategoryTargets as $k => $v) {
                $cleaned[strtoupper(trim((string)$k))] = max(0, (int)$v);
            }
            $categoryTargets = array_merge($categoryTargets, $cleaned);
            // Save as persistent period preference
            $period->update(['daily_category_composition' => $categoryTargets]);
        } elseif (!empty($period->daily_category_composition) && is_array($period->daily_category_composition)) {
            $categoryTargets = array_merge($categoryTargets, $period->daily_category_composition);
        }

        $dailyTotalPerQa = array_sum($categoryTargets);
        if ($dailyTotalPerQa <= 0) {
            $categoryTargets = self::DAILY_CATEGORY_TARGETS;
            $dailyTotalPerQa = self::DAILY_TOTAL_PER_QA;
        }

        $qaNames = !empty($customQaList) ? $customQaList : self::getActiveQaNames($period);
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        $targetDate = $dateStr ? Carbon::parse($dateStr) : now();
        $targetDateString = $targetDate->format('Y-m-d');

        // 1. Fetch Verified Human CSO Agents (Site Semarang)
        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('name', 'not like', '%.01%')
                  ->where('name', 'not like', '%CSO.01%')
                  ->where('name', 'not like', '%OB.01%')
                  ->where('name', 'not like', '%AS.01%');
            })
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::whereNotIn('name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])->get();
        }
        $agentMap = $activeAgents->keyBy('id');

        // 2. Fetch already assigned tickets in this period to enforce anti-duplicate & count per agent per QA
        $existingAssignments = SamplingAssignment::where('sampling_period_id', $period->id)->get();
        $assignedTicketIds = $existingAssignments->pluck('ticket_id')->flip()->toArray();
        $assignedAssessmentIds = $existingAssignments->whereNotNull('assessment_id')->pluck('assessment_id')->flip()->toArray();

        // Agent assignment count per QA in this period: [ qaName => [ agentId => count ] ]
        $agentCountPerQa = [];
        // CSO overall completed count in this period
        $csoOverallCount = [];

        foreach ($existingAssignments as $ea) {
            $qa = $ea->evaluator_name;
            $agId = $ea->agent_id;
            if (!isset($agentCountPerQa[$qa])) {
                $agentCountPerQa[$qa] = [];
            }
            $agentCountPerQa[$qa][$agId] = ($agentCountPerQa[$qa][$agId] ?? 0) + 1;

            if ($ea->status === 'COMPLETED') {
                $csoOverallCount[$agId] = ($csoOverallCount[$agId] ?? 0) + 1;
            }
        }

        // 3. Query all eligible assessments from DB
        $allAssessments = CaAssessment::with(['category', 'subCategory'])
            ->select(
                'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
                'source_layanan', 'source', 'source_ca', 'source_file', 'service_id', 'category_id', 'sub_category_id', 'transaction_at',
                'measurement_at', 'created_at', 'cso_classification', 'is_naker_verified'
            )
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('agent_name', 'not like', '%.01%')
                  ->where('agent_name', 'not like', '%CSO.01%')
                  ->where('agent_name', 'not like', '%OB.01%')
                  ->where('agent_name', 'not like', '%AS.01%');
            })
            ->get();

        if ($allAssessments->isEmpty()) {
            throw new \Exception('Tidak ada data tiket human CSO Site Semarang yang terverifikasi di Master Data NAKER untuk didistribusikan.');
        }

        // Categorize available pools
        $categorizedPool = [
            'INFORMASI'  => collect(),
            'GANGGUAN'   => collect(),
            'KELUHAN'    => collect(),
            'PERMOHONAN' => collect(),
        ];

        foreach ($allAssessments as $asm) {
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$asm->id])) {
                continue; // Skip already assigned in this period
            }
            $cat = self::resolveCategoryName($asm);
            $categorizedPool[$cat]->push($asm);
        }

        // Shuffle each category pool for fairness
        foreach ($categorizedPool as $k => $c) {
            $categorizedPool[$k] = $c->shuffle();
        }

        $now = now();
        $recordsToInsert = [];
        $allocatedPerQa = [];

        foreach ($qaNames as $qaName) {
            $allocatedPerQa[$qaName] = [
                'TOTAL'      => 0,
            ];
            foreach ($categoryTargets as $catKey => $count) {
                $allocatedPerQa[$qaName][$catKey] = 0;
            }

            if (!isset($agentCountPerQa[$qaName])) {
                $agentCountPerQa[$qaName] = [];
            }

            // Loop through the configured category targets
            foreach ($categoryTargets as $catName => $targetCount) {
                $needed = $targetCount;
                if ($needed <= 0) continue;
                $catPool = $categorizedPool[$catName] ?? collect();

                $pickedCount = 0;
                $skippedCandidates = [];

                while ($needed > 0 && $catPool->isNotEmpty()) {
                    $candidate = $catPool->shift();
                    $tid = trim((string)$candidate->ticket_id) ?: (trim((string)$candidate->idca) ?: "TCK-{$candidate->id}");
                    $agId = $candidate->agent_id ?: ($activeAgents->first()->id ?? 1);

                    // Check Rule 2: Max 2 tickets per agent per QA in 30 days
                    $currentQaAgentCount = $agentCountPerQa[$qaName][$agId] ?? 0;
                    if ($currentQaAgentCount >= self::MAX_PER_AGENT_PER_QA_MONTHLY) {
                        // Agent already appeared 2x for this QA, hold for other QAs
                        $skippedCandidates[] = $candidate;
                        continue;
                    }

                    // Check Rule 3: CSO target cap
                    $csoDone = $csoOverallCount[$agId] ?? 0;
                    if ($csoDone >= (count($qaNames) * self::MAX_PER_AGENT_PER_QA_MONTHLY)) {
                        $skippedCandidates[] = $candidate;
                        continue;
                    }

                    // Assign candidate
                    $assignedTicketIds[$tid] = true;
                    $assignedAssessmentIds[$candidate->id] = true;
                    $agentCountPerQa[$qaName][$agId] = $currentQaAgentCount + 1;

                    $channel = self::resolveChannel($candidate->source_layanan ?: $candidate->source_ca);

                    $validUntil = $targetDate->copy()->addDays(7)->endOfDay();

                    $recordsToInsert[] = [
                        'sampling_period_id' => $period->id,
                        'ticket_id'          => $tid,
                        'agent_id'           => $agId,
                        'evaluator_name'     => $qaName,
                        'service_id'         => $candidate->service_id,
                        'site_id'            => $smgSiteId,
                        'channel'            => $channel,
                        'category_name'      => $catName,
                        'cso_classification' => 'VERIFIED_NAKER',
                        'is_naker_verified'  => true,
                        'assignment_type'    => 'MANDATORY',
                        'is_extra_quota'     => false,
                        'valid_until'        => $validUntil,
                        'status'             => 'ASSIGNED',
                        'assessment_id'      => $candidate->id,
                        'score_ca'           => null,
                        'fcr'                => null,
                        'notes'              => null,
                        'assigned_at'        => $targetDate,
                        'started_at'         => null,
                        'completed_at'       => null,
                        'hold_at'            => null,
                        'abandoned_at'       => null,
                        'quota_request_id'   => null,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ];

                    $allocatedPerQa[$qaName][$catName]++;
                    $allocatedPerQa[$qaName]['TOTAL']++;
                    $needed--;
                }

                // Put back skipped candidates for other QAs
                foreach ($skippedCandidates as $sk) {
                    $catPool->push($sk);
                }
                $categorizedPool[$catName] = $catPool;
            }

            // Fallback: If some specific category was scarce, fill remaining slots up to $dailyTotalPerQa from other available categories
            while ($allocatedPerQa[$qaName]['TOTAL'] < $dailyTotalPerQa) {
                $fallbackCandidate = null;
                $fallbackCat = 'INFORMASI';

                foreach (['GANGGUAN', 'KELUHAN', 'INFORMASI', 'PERMOHONAN'] as $fCat) {
                    if (($categorizedPool[$fCat] ?? collect())->isNotEmpty()) {
                        $fallbackCandidate = $categorizedPool[$fCat]->shift();
                        $fallbackCat = $fCat;
                        break;
                    }
                }

                if (!$fallbackCandidate) break; // Exhausted

                $tid = trim((string)$fallbackCandidate->ticket_id) ?: (trim((string)$fallbackCandidate->idca) ?: "TCK-{$fallbackCandidate->id}");
                $agId = $fallbackCandidate->agent_id ?: ($activeAgents->first()->id ?? 1);

                $currentQaAgentCount = $agentCountPerQa[$qaName][$agId] ?? 0;
                if ($currentQaAgentCount >= self::MAX_PER_AGENT_PER_QA_MONTHLY) {
                    continue;
                }

                $assignedTicketIds[$tid] = true;
                $assignedAssessmentIds[$fallbackCandidate->id] = true;
                $agentCountPerQa[$qaName][$agId] = $currentQaAgentCount + 1;
                $channel = self::resolveChannel($fallbackCandidate->source_layanan ?: $fallbackCandidate->source_ca);

                $validUntil = $targetDate->copy()->addDays(7)->endOfDay();

                $recordsToInsert[] = [
                    'sampling_period_id' => $period->id,
                    'ticket_id'          => $tid,
                    'agent_id'           => $agId,
                    'evaluator_name'     => $qaName,
                    'service_id'         => $fallbackCandidate->service_id,
                    'site_id'            => $smgSiteId,
                    'channel'            => $channel,
                    'category_name'      => $fallbackCat,
                    'cso_classification' => 'VERIFIED_NAKER',
                    'is_naker_verified'  => true,
                    'assignment_type'    => 'MANDATORY',
                    'is_extra_quota'     => false,
                    'valid_until'        => $validUntil,
                    'status'             => 'ASSIGNED',
                    'assessment_id'      => $fallbackCandidate->id,
                    'score_ca'           => null,
                    'fcr'                => null,
                    'notes'              => null,
                    'assigned_at'        => $targetDate,
                    'started_at'         => null,
                    'completed_at'       => null,
                    'hold_at'            => null,
                    'abandoned_at'       => null,
                    'quota_request_id'   => null,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ];

                if (!isset($allocatedPerQa[$qaName][$fallbackCat])) {
                    $allocatedPerQa[$qaName][$fallbackCat] = 0;
                }
                $allocatedPerQa[$qaName][$fallbackCat]++;
                $allocatedPerQa[$qaName]['TOTAL']++;
            }
        }

        DB::beginTransaction();
        try {
            if ($clearExistingForDay) {
                SamplingAssignment::where('sampling_period_id', $period->id)
                    ->whereDate('assigned_at', $targetDateString)
                    ->where('status', 'ASSIGNED')
                    ->delete();
            }

            foreach (array_chunk($recordsToInsert, 500) as $chunk) {
                SamplingAssignment::insert($chunk);
            }

            SamplingTargetEngineService::syncActuals($periodCode);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'period'                => $periodCode,
            'distribution_mode'     => 'CUSTOM_DAILY_CATEGORY_QUOTA',
            'target_date'           => $targetDateString,
            'rules' => [
                'composition'       => $categoryTargets,
                'total_per_qa'      => $dailyTotalPerQa,
                'max_agent_per_qa'  => self::MAX_PER_AGENT_PER_QA_MONTHLY,
            ],
            'total_inserted'        => count($recordsToInsert),
            'qa_allocations'        => $allocatedPerQa,
        ];
    }

    /**
     * SPV Extra Quota Grant (Rule 1):
     * Grants $extraCount additional tickets to $evaluatorName with 1-day (24-hour) expiration.
     */
    public static function grantExtraQuota(
        string $periodCode,
        string $evaluatorName,
        int $extraCount = 5,
        ?string $reason = null,
        ?int $requestId = null
    ): array {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        $validUntil = now()->addHours(24);
        $now = now();

        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->get();
        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::all();
        }

        // Fetch already assigned tickets in this period
        $assignedTicketIds = SamplingAssignment::where('sampling_period_id', $period->id)->pluck('ticket_id')->flip()->toArray();
        $assignedAssessmentIds = SamplingAssignment::where('sampling_period_id', $period->id)->whereNotNull('assessment_id')->pluck('assessment_id')->flip()->toArray();

        // Get unassigned assessments
        $candidateQuery = CaAssessment::with(['category', 'subCategory'])
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true);

        $candidates = $candidateQuery->get()->shuffle();
        $availableCandidates = $candidates->filter(function($asm) use ($assignedTicketIds, $assignedAssessmentIds) {
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            return !isset($assignedTicketIds[$tid]) && !isset($assignedAssessmentIds[$asm->id]);
        });

        if ($availableCandidates->isEmpty()) {
            throw new \Exception('Tidak ada sisa tiket yang tersedia di database untuk penambahan kuota ekstra.');
        }

        $recordsToInsert = [];
        $granted = 0;

        foreach ($availableCandidates as $asm) {
            if ($granted >= $extraCount) break;

            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            $catName = self::resolveCategoryName($asm);
            $channel = self::resolveChannel($asm->source_layanan ?: $asm->source_ca);

            $recordsToInsert[] = [
                'sampling_period_id' => $period->id,
                'ticket_id'          => $tid,
                'agent_id'           => $asm->agent_id ?: ($activeAgents->first()->id ?? 1),
                'evaluator_name'     => $evaluatorName,
                'service_id'         => $asm->service_id,
                'site_id'            => $smgSiteId,
                'channel'            => $channel,
                'category_name'      => $catName,
                'cso_classification' => 'VERIFIED_NAKER',
                'is_naker_verified'  => true,
                'assignment_type'    => 'ADDITIONAL',
                'is_extra_quota'     => true,
                'valid_until'        => $validUntil,
                'status'             => 'ASSIGNED',
                'assessment_id'      => $asm->id,
                'score_ca'           => null,
                'fcr'                => null,
                'notes'              => $reason ? "Kuota Tambahan SPV (1 Hari): {$reason}" : "Kuota Tambahan SPV (1 Hari)",
                'assigned_at'        => $now,
                'started_at'         => null,
                'completed_at'       => null,
                'hold_at'            => null,
                'abandoned_at'       => null,
                'quota_request_id'   => $requestId,
                'created_at'         => $now,
                'updated_at'         => $now,
            ];

            $assignedTicketIds[$tid] = true;
            $assignedAssessmentIds[$asm->id] = true;
            $granted++;
        }

        DB::beginTransaction();
        try {
            SamplingAssignment::insert($recordsToInsert);

            // Update Quota Request record if provided
            if ($requestId) {
                $req = SamplingQuotaRequest::find($requestId);
                if ($req) {
                    $req->update([
                        'status'         => 'APPROVED',
                        'approved_by'    => auth()->user()?->name ?? 'Supervisor QA',
                        'approved_count' => $granted,
                        'valid_until'    => $validUntil,
                    ]);
                }
            }

            // Sync targets
            $target = SamplingTarget::where('sampling_period_id', $period->id)
                ->where('evaluator_name', $evaluatorName)
                ->first();
            if ($target) {
                $target->increment('target_total', $granted);
                $target->increment('additional_target', $granted);
            }

            SamplingTargetEngineService::syncActuals($periodCode);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'success'          => true,
            'evaluator_name'   => $evaluatorName,
            'granted_count'    => $granted,
            'valid_until'      => $validUntil->toIso8601String(),
            'valid_hours'      => 24,
            'message'          => "Berhasil menambahkan {$granted} tiket ekstra untuk {$evaluatorName} (Masa berlaku 24 jam / 1 hari).",
        ];
    }

    /**
     * Run Full Monthly Auto Distribution Engine (Mandatory 2/CSO/QA + Additional)
     */
    public static function runDistribution(string $periodCode = '2026-08', string $siteFilter = 'SMG'): array
    {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);

        $qaNames = self::getActiveQaNames($period);
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('name', 'not like', '%.01%')
                  ->where('name', 'not like', '%CSO.01%')
                  ->where('name', 'not like', '%OB.01%')
                  ->where('name', 'not like', '%AS.01%');
            })
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::whereNotIn('name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])->get();
        }

        $allAssessments = CaAssessment::with(['category', 'subCategory'])
            ->select(
                'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
                'source_layanan', 'source', 'source_ca', 'source_file', 'service_id', 'category_id', 'sub_category_id', 'transaction_at',
                'measurement_at', 'created_at', 'cso_classification', 'is_naker_verified'
            )
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('agent_name', 'not like', '%.01%')
                  ->where('agent_name', 'not like', '%CSO.01%')
                  ->where('agent_name', 'not like', '%OB.01%')
                  ->where('agent_name', 'not like', '%AS.01%');
            })
            ->get();

        if ($allAssessments->isEmpty()) {
            throw new \Exception('Tidak ada data tiket human CSO Site Semarang yang terverifikasi di Master Data NAKER untuk didistribusikan.');
        }

        $assessmentsByAgent = $allAssessments->groupBy('agent_id');
        $numQas = count($qaNames);
        $totalPoolTarget = 370;
        $baseQuota = intdiv($totalPoolTarget, $numQas);
        $remainder = $totalPoolTarget % $numQas;

        $qaTargetQuotas = [];
        $qaBuckets = [];
        $qaAgentCounts = []; // Enforce max 2 per agent per QA
        foreach ($qaNames as $index => $qa) {
            $qaTargetQuotas[$qa] = $baseQuota + ($index < $remainder ? 1 : 0);
            $qaBuckets[$qa] = [];
            $qaAgentCounts[$qa] = [];
        }

        $usedAssessmentIds = [];
        $usedTicketIds = [];

        // ---------------------------------------------------------------------
        // Phase 1: Mandatory Sampling (2 tickets per CSO, strict <= 2 per QA)
        // ---------------------------------------------------------------------
        $shuffledAgents = $activeAgents->shuffle();
        $agentPicks = [];

        foreach ($shuffledAgents as $agent) {
            $agentAsms = $assessmentsByAgent->get($agent->id, collect());
            $availableAsms = $agentAsms->whereNotIn('id', array_keys($usedAssessmentIds));
            if ($availableAsms->isEmpty()) continue;

            $gAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'GANGGUAN')->shuffle();
            $kAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'KELUHAN')->shuffle();
            $iAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'INFORMASI')->shuffle();
            $pAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'PERMOHONAN')->shuffle();

            $picks = collect();
            if ($pAsms->isNotEmpty()) {
                $picks->push($pAsms->first());
            } elseif ($kAsms->isNotEmpty()) {
                $picks->push($kAsms->first());
            } elseif ($gAsms->isNotEmpty()) {
                $picks->push($gAsms->first());
            } elseif ($iAsms->isNotEmpty()) {
                $picks->push($iAsms->first());
            }

            $rem = $availableAsms->whereNotIn('id', $picks->pluck('id')->toArray());
            if ($rem->isNotEmpty()) {
                $p1Cat = self::resolveCategoryName($picks->first());
                $diffCat = $rem->filter(fn($a) => self::resolveCategoryName($a) !== $p1Cat)->shuffle();
                if ($diffCat->isNotEmpty()) {
                    $picks->push($diffCat->first());
                } else {
                    $picks->push($rem->first());
                }
            }

            foreach ($picks as $asm) {
                if (!$asm) continue;
                $ticketId = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
                if (isset($usedTicketIds[$ticketId])) continue;

                $usedAssessmentIds[$asm->id] = true;
                $usedTicketIds[$ticketId] = true;

                $agentPicks[] = [
                    'assessment_id'   => $asm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $agent->id,
                    'channel'         => self::resolveChannel($asm->source_layanan ?: $asm->source_ca),
                    'category_name'   => self::resolveCategoryName($asm),
                    'service_id'      => $asm->service_id,
                    'assignment_type' => 'MANDATORY',
                    'assigned_at'     => $asm->measurement_at ?: ($asm->transaction_at ?: now()),
                ];
            }
        }

        // Equitable distribution of mandatory picks across QAs
        $shuffledPicks = collect($agentPicks)->shuffle();
        foreach ($shuffledPicks as $item) {
            $agId = $item['agent_id'];
            $availQas = collect($qaNames)->filter(function($q) use ($qaBuckets, $qaTargetQuotas, $qaAgentCounts, $agId) {
                $quotaOk = count($qaBuckets[$q]) < $qaTargetQuotas[$q];
                $agentOk = ($qaAgentCounts[$q][$agId] ?? 0) < self::MAX_PER_AGENT_PER_QA_MONTHLY;
                return $quotaOk && $agentOk;
            });

            if ($availQas->isEmpty()) {
                // Fallback: relax quota slightly if needed
                $availQas = collect($qaNames)->filter(function($q) use ($qaAgentCounts, $agId) {
                    return ($qaAgentCounts[$q][$agId] ?? 0) < self::MAX_PER_AGENT_PER_QA_MONTHLY;
                });
            }

            if ($availQas->isNotEmpty()) {
                $minCount = $availQas->map(fn($q) => count($qaBuckets[$q]))->min();
                $targetQa = $availQas->first(fn($q) => count($qaBuckets[$q]) === $minCount);
                $qaBuckets[$targetQa][] = $item;
                $qaAgentCounts[$targetQa][$agId] = ($qaAgentCounts[$targetQa][$agId] ?? 0) + 1;
            }
        }

        // ---------------------------------------------------------------------
        // Phase 2: Additional Sampling to fill remaining quota up to 370
        // ---------------------------------------------------------------------
        $remainingPool = $allAssessments->whereNotIn('id', array_keys($usedAssessmentIds))->shuffle()->values();
        $remIdx = 0;

        foreach ($qaNames as $qa) {
            $quota = $qaTargetQuotas[$qa];
            while (count($qaBuckets[$qa]) < $quota && $remIdx < $remainingPool->count()) {
                $candidateAsm = $remainingPool[$remIdx++];
                $ticketId = trim((string)$candidateAsm->ticket_id) ?: (trim((string)$candidateAsm->idca) ?: "TCK-{$candidateAsm->id}");
                if (isset($usedTicketIds[$ticketId])) continue;

                $agId = $candidateAsm->agent_id ?: ($activeAgents->first()->id ?? 1);
                if (($qaAgentCounts[$qa][$agId] ?? 0) >= self::MAX_PER_AGENT_PER_QA_MONTHLY) {
                    continue;
                }

                $usedAssessmentIds[$candidateAsm->id] = true;
                $usedTicketIds[$ticketId] = true;
                $qaAgentCounts[$qa][$agId] = ($qaAgentCounts[$qa][$agId] ?? 0) + 1;

                $catName = self::resolveCategoryName($candidateAsm);
                $channel = self::resolveChannel($candidateAsm->source_layanan ?: $candidateAsm->source_ca);

                $qaBuckets[$qa][] = [
                    'assessment_id'   => $candidateAsm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $agId,
                    'channel'         => $channel,
                    'category_name'   => $catName,
                    'service_id'      => $candidateAsm->service_id,
                    'assignment_type' => 'ADDITIONAL',
                    'assigned_at'     => $candidateAsm->measurement_at ?: ($candidateAsm->transaction_at ?: now()),
                ];
            }
        }

        $now = now();
        $records = [];
        $totalAssigned = 0;

        foreach ($qaNames as $qa) {
            $queue = collect($qaBuckets[$qa])->shuffle();
            foreach ($queue as $item) {
                $records[] = [
                    'sampling_period_id' => $period->id,
                    'ticket_id'          => $item['ticket_id'],
                    'agent_id'           => $item['agent_id'],
                    'evaluator_name'     => $qa,
                    'service_id'         => $item['service_id'],
                    'site_id'            => $smgSiteId,
                    'channel'            => $item['channel'],
                    'category_name'      => $item['category_name'],
                    'cso_classification' => 'VERIFIED_NAKER',
                    'is_naker_verified'  => true,
                    'assignment_type'    => $item['assignment_type'],
                    'is_extra_quota'     => false,
                    'valid_until'        => Carbon::parse($item['assigned_at'] ?: now())->addDays(7)->endOfDay(),
                    'status'             => 'ASSIGNED',
                    'assessment_id'      => $item['assessment_id'],
                    'score_ca'           => null,
                    'fcr'                => null,
                    'notes'              => null,
                    'assigned_at'        => $item['assigned_at'],
                    'started_at'         => null,
                    'completed_at'       => null,
                    'hold_at'            => null,
                    'abandoned_at'       => null,
                    'quota_request_id'   => null,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ];
                $totalAssigned++;
            }
        }

        DB::beginTransaction();
        try {
            SamplingAssignment::where('sampling_period_id', $period->id)->delete();

            foreach (array_chunk($records, 500) as $chunk) {
                SamplingAssignment::insert($chunk);
            }

            SamplingTargetEngineService::syncActuals($periodCode);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'period'                 => $periodCode,
            'source'                 => 'REAL_IMPORTED_DATA',
            'distribution_mode'      => 'FAIR_RANDOMIZED_EVEN_WITH_MANDATORY_2_LIMIT',
            'total_assigned_tickets' => $totalAssigned,
            'total_completed_tickets' => 0,
        ];
    }

    /**
     * Automatically mark tickets older than 7 days (1 week) that are still uncompleted as ABANDONED.
     * Enforces SLA lifecycle:
     * - Day 1 to Day 7: Valid & can be reopened / worked on.
     * - After Day 7 (> 7 days): Automatically becomes ABANDONED, logged to QA history, and counted towards supervisor audit/penalties.
     */
    public static function autoExpireStaleAssignments(?int $periodId = null): int
    {
        $cutoff = now()->subDays(7);

        $query = SamplingAssignment::whereNotIn('status', ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED'])
            ->where(function ($q) use ($cutoff) {
                $q->where(function ($sub) {
                    $sub->whereNotNull('valid_until')
                        ->where('valid_until', '<', now());
                })->orWhere(function ($sub) use ($cutoff) {
                    $sub->whereNull('valid_until')
                        ->whereNotNull('assigned_at')
                        ->where('assigned_at', '<', $cutoff);
                });
            });

        if ($periodId) {
            $query->where('sampling_period_id', $periodId);
        }

        $staleAssignments = $query->get();
        $expiredCount = 0;

        foreach ($staleAssignments as $asm) {
            $asm->update([
                'status'       => 'ABANDONED',
                'abandoned_at' => now(),
                'skip_reason'  => 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari (1 minggu)',
                'notes'        => $asm->notes ? ($asm->notes . ' | Otomatis Abandoned: Melewati batas waktu 7 hari') : 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari (1 minggu)',
            ]);
            $expiredCount++;
        }

        return $expiredCount;
    }
}

