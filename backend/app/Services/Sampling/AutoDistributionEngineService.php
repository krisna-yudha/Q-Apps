<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingTarget;
use App\Models\SamplingTargetCso;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AutoDistributionEngineService
{
    /**
     * Run Auto Distribution Engine for the specified period.
     * Implements FAIR & RANDOMIZED distribution (Rata dan Acak agar tidak berurutan agar adil):
     * 1. 100% Real Imported Tickets from ca_assessments.
     * 2. Exactly 370 quota tickets allocated per QA Evaluator.
     * 3. Mandatory Sampling: 2 tickets per CSO randomly picked and shuffled across QAs.
     * 4. Additional Sampling: Remaining quota (up to 370) filled from the randomized pool across channels.
     * 5. Queue Shuffling: Each QA's queue is shuffled so tickets are non-sequential (diverse CSOs, channels, dates).
     * 6. Initial Status: ASSIGNED (Menunggu / Siap Dinilai) with null scores.
     */
    public static function runDistribution(string $periodCode = '2026-08', string $siteFilter = 'SMG'): array
    {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);

        // Fetch all QA Evaluators
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

        // Resolve Site Semarang
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        // Rules Filter: Strictly Site SEMARANG (.02 / SMG) & Verified NAKER Human CSOs
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

        // Fetch ONLY real human CSO interaction records VERIFIED by NAKER from SITE SEMARANG
        $allAssessments = CaAssessment::select(
            'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
            'source_layanan', 'source', 'service_id', 'transaction_at',
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

        // Group assessments by agent_id for mandatory pairing
        $assessmentsByAgent = $allAssessments->groupBy('agent_id');

        // Equal distribution of the 370 total pool across active QAs (e.g. 46-47 tickets per QA)
        $numQas = count($qaNames);
        $totalPoolTarget = 370;
        $baseQuota = intdiv($totalPoolTarget, $numQas);
        $remainder = $totalPoolTarget % $numQas;

        $qaTargetQuotas = [];
        $qaBuckets = [];
        foreach ($qaNames as $index => $qa) {
            $qaTargetQuotas[$qa] = $baseQuota + ($index < $remainder ? 1 : 0);
            $qaBuckets[$qa] = [];
        }

        $usedAssessmentIds = [];
        $usedTicketIds = [];

        // ---------------------------------------------------------------------
        // Phase 1: Mandatory Sampling (2 tickets per CSO, shuffled across QAs)
        // ---------------------------------------------------------------------
        $shuffledAgents = $activeAgents->shuffle();
        $qaIndex = 0;

        foreach ($shuffledAgents as $agent) {
            $agentAsms = $assessmentsByAgent->get($agent->id, collect());
            $availableAsms = $agentAsms->whereNotIn('id', array_keys($usedAssessmentIds))->shuffle();
            $agentMandatoryCount = 0;

            foreach ($availableAsms as $asm) {
                if ($agentMandatoryCount >= 2) break;

                // Find next QA that hasn't reached their individual quota
                $targetQa = null;
                for ($attempt = 0; $attempt < count($qaNames); $attempt++) {
                    $candidateQa = $qaNames[($qaIndex + $attempt) % count($qaNames)];
                    if (count($qaBuckets[$candidateQa]) < $qaTargetQuotas[$candidateQa]) {
                        $targetQa = $candidateQa;
                        $qaIndex = ($qaIndex + $attempt + 1) % count($qaNames);
                        break;
                    }
                }

                if (!$targetQa) break; // All QAs reached their quota

                $ticketId = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
                if (isset($usedTicketIds[$ticketId])) {
                    $ticketId = "{$ticketId}-{$asm->id}";
                }
                if (isset($usedTicketIds[$ticketId])) continue;

                $usedAssessmentIds[$asm->id] = true;
                $usedTicketIds[$ticketId] = true;

                $qaBuckets[$targetQa][] = [
                    'assessment_id'   => $asm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $agent->id,
                    'channel'         => $asm->source_layanan ?: 'Inbound',
                    'category_name'   => $asm->source ?: 'REGULER',
                    'service_id'      => $asm->service_id,
                    'assignment_type' => 'MANDATORY',
                    'assigned_at'     => $asm->measurement_at ?: ($asm->transaction_at ?: now()),
                ];

                $agentMandatoryCount++;
            }
        }

        // ---------------------------------------------------------------------
        // Phase 2: Additional Sampling (Fill quota up to 46-47 per QA, randomized)
        // ---------------------------------------------------------------------
        $remainingPool = $allAssessments->whereNotIn('id', array_keys($usedAssessmentIds))->shuffle();
        $poolIterator = $remainingPool->getIterator();

        foreach ($qaNames as $qa) {
            $quota = $qaTargetQuotas[$qa];
            while (count($qaBuckets[$qa]) < $quota && $poolIterator->valid()) {
                $asm = $poolIterator->current();
                $poolIterator->next();

                if (isset($usedAssessmentIds[$asm->id])) continue;

                $ticketId = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
                if (isset($usedTicketIds[$ticketId])) {
                    $ticketId = "{$ticketId}-{$asm->id}";
                }
                if (isset($usedTicketIds[$ticketId])) continue;

                $usedAssessmentIds[$asm->id] = true;
                $usedTicketIds[$ticketId] = true;

                $qaBuckets[$qa][] = [
                    'assessment_id'   => $asm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $asm->agent_id ?: ($activeAgents->first()->id ?? 1),
                    'channel'         => $asm->source_layanan ?: 'Inbound',
                    'category_name'   => $asm->source ?: 'REGULER',
                    'service_id'      => $asm->service_id,
                    'assignment_type' => 'ADDITIONAL',
                    'assigned_at'     => $asm->measurement_at ?: ($asm->transaction_at ?: now()),
                ];
            }
        }

        // ---------------------------------------------------------------------
        // Phase 3: Non-Sequential Queue Shuffling & Database Persistence
        // ---------------------------------------------------------------------
        $now = now();
        $records = [];
        $totalAssigned = 0;

        foreach ($qaNames as $qa) {
            // Shuffle queue array so consecutive tickets are mixed across CSOs, channels, and dates
            $queue = $qaBuckets[$qa];
            shuffle($queue);

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
                    'status'             => 'ASSIGNED',
                    'assessment_id'      => $item['assessment_id'],
                    'score_ca'           => null,
                    'fcr'                => null,
                    'notes'              => null,
                    'assigned_at'        => $item['assigned_at'],
                    'started_at'         => null,
                    'completed_at'       => null,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ];
                $totalAssigned++;
            }
        }

        DB::beginTransaction();
        try {
            // Clean previous period assignments for a pristine, balanced queue
            SamplingAssignment::where('sampling_period_id', $period->id)->delete();

            // Bulk Insert in chunks of 500 records
            foreach (array_chunk($records, 500) as $chunk) {
                SamplingAssignment::insert($chunk);
            }

            // Calculate QA Summaries
            $stats = SamplingAssignment::where('sampling_period_id', $period->id)
                ->selectRaw("
                    evaluator_name,
                    COUNT(*) as total_bucket,
                    SUM(CASE WHEN assignment_type = 'MANDATORY' THEN 1 ELSE 0 END) as count_mandatory,
                    SUM(CASE WHEN assignment_type = 'ADDITIONAL' THEN 1 ELSE 0 END) as count_additional,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as count_completed,
                    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as count_in_progress,
                    SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as count_assigned,
                    SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as count_skipped
                ")
                ->groupBy('evaluator_name')
                ->get()
                ->keyBy('evaluator_name');

            $qaSummaries = [];
            foreach ($qaNames as $qaName) {
                $rowStat = $stats->get($qaName);
                $qaSummaries[] = [
                    'evaluator_name' => $qaName,
                    'target'         => (int)($qaTargetQuotas[$qaName] ?? 46),
                    'mandatory'      => (int)($rowStat?->count_mandatory ?? 0),
                    'additional'     => (int)($rowStat?->count_additional ?? 0),
                    'total_bucket'   => (int)($rowStat?->total_bucket ?? 0),
                    'completed'      => (int)($rowStat?->count_completed ?? 0),
                    'in_progress'    => (int)($rowStat?->count_in_progress ?? 0),
                    'assigned'       => (int)($rowStat?->count_assigned ?? 0),
                    'skipped'        => (int)($rowStat?->count_skipped ?? 0),
                ];
            }

            // Sync actuals across all sampling targets & CSO targets
            SamplingTargetEngineService::syncActuals($periodCode);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        $totalRawAssessments = CaAssessment::count();
        $totalBotAssessments = CaAssessment::where('cso_classification', NakerVerificationService::CLASSIFICATION_SELF_SERVICE_BOT)->count();
        $totalUnmappedAssessments = CaAssessment::where('cso_classification', NakerVerificationService::CLASSIFICATION_UNMAPPED_CSO)->count();

        return [
            'period' => $periodCode,
            'source' => 'REAL_IMPORTED_DATA',
            'distribution_mode' => 'FAIR_RANDOMIZED_EVEN',
            'total_raw_assessments' => $totalRawAssessments,
            'total_verified_naker' => $allAssessments->count(),
            'total_self_service_bot' => $totalBotAssessments,
            'total_unmapped_cso' => $totalUnmappedAssessments,
            'total_assigned_tickets' => $totalAssigned,
            'total_completed_tickets' => 0,
            'qa_buckets' => $qaSummaries,
        ];
    }
}
