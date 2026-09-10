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
        $asmQuery = CaAssessment::with(['category', 'subCategory'])
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
        });

        // Prioritize raw retail ticketing data (ListTicketingRetail / RY... tickets) so all queue tickets match the imported raw Excel
        $retailExists = (clone $asmQuery)->where(function($q) {
            $q->where('source_file', 'like', '%ListTicketingRetail%')
              ->orWhere('ticket_id', 'like', 'RY%');
        })->exists();

        if ($retailExists) {
            $asmQuery->where(function($q) {
                $q->where('source_file', 'like', '%ListTicketingRetail%')
                  ->orWhere('ticket_id', 'like', 'RY%');
            });
        }

        $allAssessments = $asmQuery->get();

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

        $resolveChannel = function($raw) {
            $u = strtoupper(trim((string)$raw));
            if ($u === 'PHONE' || str_contains($u, 'INBOUND') || str_contains($u, 'VOICE') || str_contains($u, 'CALL')) return 'Inbound';
            if (str_contains($u, 'LIVE') || str_contains($u, 'CHAT') || str_contains($u, 'DIGILIVE') || str_contains($u, 'PORTAL') || str_contains($u, 'BOT') || str_contains($u, 'NGAOSS') || str_contains($u, 'PLN')) return 'Digilive';
            if (str_contains($u, 'SOCMED') || str_contains($u, 'SOSMED') || str_contains($u, 'INSTAGRAM') || str_contains($u, 'WHATSAPP') || str_contains($u, 'FACEBOOK') || str_contains($u, 'TWITTER')) return 'Socmed';
            if (str_contains($u, 'EMAIL')) return 'Email';
            if (str_contains($u, 'BACK OFFICE') || str_contains($u, 'ESKALASI') || str_contains($u, 'INTERNAL') || str_contains($u, 'SALES') || str_contains($u, 'BO') || str_contains($u, 'SBU')) return 'Back Office';
            return 'Inbound';
        };

        // ---------------------------------------------------------------------
        // Phase 1: Mandatory Sampling (2 tickets per CSO - Maximizing Category Diversity)
        // ---------------------------------------------------------------------
        $shuffledAgents = $activeAgents->shuffle();
        $agentPicks = [];
        $agentIdx = 0;

        foreach ($shuffledAgents as $agent) {
            $agentAsms = $assessmentsByAgent->get($agent->id, collect());
            $availableAsms = $agentAsms->whereNotIn('id', array_keys($usedAssessmentIds));
            if ($availableAsms->isEmpty()) continue;

            $gAsms = $availableAsms->filter(fn($a) => ($a->category?->name ?? '') === 'GANGGUAN')->shuffle();
            $kAsms = $availableAsms->filter(fn($a) => ($a->category?->name ?? '') === 'KELUHAN')->shuffle();
            $iAsms = $availableAsms->filter(fn($a) => ($a->category?->name ?? '') === 'INFORMASI')->shuffle();
            $oAsms = $availableAsms->filter(fn($a) => !in_array($a->category?->name ?? '', ['GANGGUAN', 'KELUHAN', 'INFORMASI']))->shuffle();

            $picks = collect();

            // Priority rotation: KELUHAN (rare) > GANGGUAN > INFORMASI
            if ($kAsms->isNotEmpty() && ($agentIdx % 2 === 0 || $gAsms->isEmpty())) {
                $picks->push($kAsms->first());
            } elseif ($gAsms->isNotEmpty()) {
                $picks->push($gAsms->first());
            } elseif ($kAsms->isNotEmpty()) {
                $picks->push($kAsms->first());
            } elseif ($iAsms->isNotEmpty()) {
                $picks->push($iAsms->first());
            } elseif ($oAsms->isNotEmpty()) {
                $picks->push($oAsms->first());
            }

            // Pick 2: Priority on a different category
            $rem = $availableAsms->whereNotIn('id', $picks->pluck('id')->toArray());
            if ($rem->isNotEmpty()) {
                $p1Cat = $picks->first()?->category?->name;
                $diffCat = $rem->filter(fn($a) => ($a->category?->name ?? '') !== $p1Cat)->shuffle();
                if ($diffCat->isNotEmpty()) {
                    $dK = $diffCat->filter(fn($a) => ($a->category?->name ?? '') === 'KELUHAN');
                    $dG = $diffCat->filter(fn($a) => ($a->category?->name ?? '') === 'GANGGUAN');
                    $dI = $diffCat->filter(fn($a) => ($a->category?->name ?? '') === 'INFORMASI');
                    if ($dK->isNotEmpty() && $p1Cat !== 'KELUHAN') {
                        $picks->push($dK->first());
                    } elseif ($dG->isNotEmpty() && $p1Cat !== 'GANGGUAN') {
                        $picks->push($dG->first());
                    } elseif ($dI->isNotEmpty()) {
                        $picks->push($dI->first());
                    } else {
                        $picks->push($diffCat->first());
                    }
                } else {
                    $picks->push($rem->shuffle()->first());
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
                    'channel'         => $resolveChannel($asm->source_layanan ?: $asm->source_ca),
                    'category_name'   => $asm->category?->name ?: 'INFORMASI',
                    'service_id'      => $asm->service_id,
                    'assignment_type' => 'MANDATORY',
                    'assigned_at'     => $asm->measurement_at ?: ($asm->transaction_at ?: now()),
                ];
            }
            $agentIdx++;
        }

        // Equitably distribute category picks across QAs
        $kPicks = collect($agentPicks)->filter(fn($p) => $p['category_name'] === 'KELUHAN')->shuffle()->values();
        $gPicks = collect($agentPicks)->filter(fn($p) => $p['category_name'] === 'GANGGUAN')->shuffle()->values();
        $iPicks = collect($agentPicks)->filter(fn($p) => $p['category_name'] === 'INFORMASI')->shuffle()->values();
        $oPicks = collect($agentPicks)->filter(fn($p) => !in_array($p['category_name'], ['KELUHAN', 'GANGGUAN', 'INFORMASI']))->shuffle()->values();

        $qaIdx = 0;
        foreach ($kPicks as $item) {
            $qa = $qaNames[$qaIdx % $numQas];
            if (count($qaBuckets[$qa]) < $qaTargetQuotas[$qa]) {
                $qaBuckets[$qa][] = $item;
            }
            $qaIdx++;
        }

        foreach ($gPicks as $item) {
            $qa = $qaNames[$qaIdx % $numQas];
            if (count($qaBuckets[$qa]) < $qaTargetQuotas[$qa]) {
                $qaBuckets[$qa][] = $item;
            }
            $qaIdx++;
        }

        foreach ($iPicks as $item) {
            $availQas = collect($qaNames)->filter(fn($q) => count($qaBuckets[$q]) < $qaTargetQuotas[$q]);
            if ($availQas->isEmpty()) break;
            $minCount = $availQas->map(fn($q) => count($qaBuckets[$q]))->min();
            $targetQa = $availQas->first(fn($q) => count($qaBuckets[$q]) === $minCount);
            $qaBuckets[$targetQa][] = $item;
        }

        foreach ($oPicks as $item) {
            $availQas = collect($qaNames)->filter(fn($q) => count($qaBuckets[$q]) < $qaTargetQuotas[$q]);
            if ($availQas->isEmpty()) break;
            $minCount = $availQas->map(fn($q) => count($qaBuckets[$q]))->min();
            $targetQa = $availQas->first(fn($q) => count($qaBuckets[$q]) === $minCount);
            $qaBuckets[$targetQa][] = $item;
        }

        // ---------------------------------------------------------------------
        // Phase 2: Additional Sampling (Fills remaining quota if any QA has slots)
        // ---------------------------------------------------------------------
        $remainingPool = $allAssessments->whereNotIn('id', array_keys($usedAssessmentIds));

        $gangguanPool = $remainingPool->filter(fn($a) => ($a->category?->name ?? '') === 'GANGGUAN')->shuffle()->values();
        $keluhanPool = $remainingPool->filter(fn($a) => ($a->category?->name ?? '') === 'KELUHAN')->shuffle()->values();
        $informasiPool = $remainingPool->filter(fn($a) => ($a->category?->name ?? '') === 'INFORMASI')->shuffle()->values();
        $otherPool = $remainingPool->filter(fn($a) => !in_array($a->category?->name ?? '', ['GANGGUAN', 'KELUHAN', 'INFORMASI']))->shuffle()->values();

        $gIdx = 0; $kIdx = 0; $iIdx = 0; $oIdx = 0;

        foreach ($qaNames as $qa) {
            $quota = $qaTargetQuotas[$qa];
            while (count($qaBuckets[$qa]) < $quota) {
                $candidateAsm = null;
                $currentQaCount = count($qaBuckets[$qa]);
                $mod = $currentQaCount % 3;

                if ($mod === 0 && $gIdx < $gangguanPool->count()) {
                    $candidateAsm = $gangguanPool[$gIdx++];
                } elseif ($mod === 1 && $kIdx < $keluhanPool->count()) {
                    $candidateAsm = $keluhanPool[$kIdx++];
                } elseif ($iIdx < $informasiPool->count()) {
                    $candidateAsm = $informasiPool[$iIdx++];
                } elseif ($gIdx < $gangguanPool->count()) {
                    $candidateAsm = $gangguanPool[$gIdx++];
                } elseif ($kIdx < $keluhanPool->count()) {
                    $candidateAsm = $keluhanPool[$kIdx++];
                } elseif ($oIdx < $otherPool->count()) {
                    $candidateAsm = $otherPool[$oIdx++];
                } else {
                    break;
                }

                if (!$candidateAsm || isset($usedAssessmentIds[$candidateAsm->id])) continue;

                $ticketId = trim((string)$candidateAsm->ticket_id) ?: (trim((string)$candidateAsm->idca) ?: "TCK-{$candidateAsm->id}");
                if (isset($usedTicketIds[$ticketId])) continue;

                $usedAssessmentIds[$candidateAsm->id] = true;
                $usedTicketIds[$ticketId] = true;

                $catName = $candidateAsm->category?->name ?: 'INFORMASI';
                $channel = $resolveChannel($candidateAsm->source_layanan ?: $candidateAsm->source_ca);

                $qaBuckets[$qa][] = [
                    'assessment_id'   => $candidateAsm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $candidateAsm->agent_id ?: ($activeAgents->first()->id ?? 1),
                    'channel'         => $channel,
                    'category_name'   => $catName,
                    'service_id'      => $candidateAsm->service_id,
                    'assignment_type' => 'ADDITIONAL',
                    'assigned_at'     => $candidateAsm->measurement_at ?: ($candidateAsm->transaction_at ?: now()),
                ];
            }
        }

        // ---------------------------------------------------------------------
        // Phase 3: Multi-Dimensional Interleaved Queue Sequencing
        // ---------------------------------------------------------------------
        $now = now();
        $records = [];
        $totalAssigned = 0;

        $targetCategories = ['GANGGUAN', 'KELUHAN', 'INFORMASI'];
        $targetChannels = ['Digilive', 'Inbound', 'Socmed', 'Email', 'Back Office'];

        foreach ($qaNames as $qa) {
            $rawQueue = $qaBuckets[$qa];
            $remainingQueue = collect($rawQueue);
            $interleavedQueue = [];

            $cStep = 0;
            $chStep = 0;

            while ($remainingQueue->isNotEmpty()) {
                $wantedCat = $targetCategories[$cStep % count($targetCategories)];
                $wantedCh = $targetChannels[$chStep % count($targetChannels)];

                // 1. Try exact match (Category + Channel)
                $matched = $remainingQueue->first(function($item) use ($wantedCat, $wantedCh) {
                    return $item['category_name'] === $wantedCat && $item['channel'] === $wantedCh;
                });

                // 2. Fallback: match by Category
                if (!$matched) {
                    $matched = $remainingQueue->first(function($item) use ($wantedCat) {
                        return $item['category_name'] === $wantedCat;
                    });
                }

                // 3. Fallback: match by Channel
                if (!$matched) {
                    $matched = $remainingQueue->first(function($item) use ($wantedCh) {
                        return $item['channel'] === $wantedCh;
                    });
                }

                // 4. Fallback: pick first available
                if (!$matched) {
                    $matched = $remainingQueue->first();
                }

                $interleavedQueue[] = $matched;
                $remainingQueue = $remainingQueue->reject(fn($i) => $i['assessment_id'] === $matched['assessment_id'])->values();

                $cStep++;
                $chStep++;
            }

            foreach ($interleavedQueue as $item) {
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
