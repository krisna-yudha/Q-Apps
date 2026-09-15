<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\EvaluatorSampling;
use App\Models\MonthlyTrend;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Helper terpadu untuk pencocokan saluran (7 channel resmi QSF) dengan alias & relasi service
     */
    public static function applyChannelFilter($query, string $channel, string $serviceCol = 's.name', string $layananCol = 'a.source_layanan')
    {
        if (!$channel || $channel === 'all') return $query;

        $ch = strtolower(trim($channel));
        return $query->where(function ($q) use ($ch, $channel, $serviceCol, $layananCol) {
            if ($ch === 'inbound' || str_contains($ch, 'inbound call')) {
                $q->whereIn($serviceCol, ['Inbound', 'INBOUND', 'Inbound Call'])
                  ->orWhereIn($layananCol, ['Inbound', 'INBOUND', 'Inbound Call', 'Voice', 'Phone']);
            } elseif ($ch === 'digilive' || str_contains($ch, 'chat')) {
                $q->whereIn($serviceCol, ['Digilive', 'DIGILIVE'])
                  ->orWhereIn($layananCol, ['Digilive', 'DIGILIVE', 'Live Chat', 'Chat', 'Chatbot', 'MY ICON+']);
            } elseif ($ch === 'socmed' || str_contains($ch, 'social')) {
                $q->whereIn($serviceCol, ['Socmed', 'SOCMED'])
                  ->orWhereIn($layananCol, ['Socmed', 'SOCMED', 'Social Media', 'Sosmed', 'Instagram', 'WhatsApp', 'Twitter', 'Facebook']);
            } elseif ($ch === 'email' || $ch === 'email inbound') {
                $q->whereIn($serviceCol, ['Email Inbound', 'Email', 'EMAIL_INBOUND'])
                  ->orWhereIn($layananCol, ['Email', 'Email Inbound', 'Email_Inbound']);
            } elseif ($ch === 'email outbound' || $ch === 'email outbond') {
                $q->whereIn($serviceCol, ['Email Outbound', 'Email Outbond', 'EMAIL_OUTBOUND'])
                  ->orWhereIn($layananCol, ['Email Outbound', 'Email Outbond', 'Email_Outbound', 'Email_Outbond']);
            } elseif ($ch === 'outbound call' || $ch === 'outbond call' || $ch === 'outbound') {
                $q->whereIn($serviceCol, ['Outbound Call', 'Outbond Call', 'OUTBOUND_CALL'])
                  ->orWhereIn($layananCol, ['Outbound Call', 'Outbond Call', 'Outbound_Call', 'Outbound Reguler', 'Outbond Reguler', 'Outbound']);
            } elseif ($ch === 'back office' || $ch === 'bo' || $ch === 'backoffice') {
                $q->whereIn($serviceCol, ['Back Office', 'BackOffice', 'BACK_OFFICE'])
                  ->orWhereIn($layananCol, ['Back Office', 'BackOffice', 'Ketepatan Eskalasi BO', 'BO', 'Eskalasi BO']);
            } else {
                $q->where($serviceCol, $channel)
                  ->orWhere($layananCol, $channel);
            }
        });
    }

    /**
     * Helper pencocokan periode (YYYY-MM) resmi untuk data matang
     */
    public static function applyPeriodFilter($query, string $period, string $txCol = 'a.transaction_at', string $msCol = 'a.measurement_at')
    {
        return $query->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE($msCol, $txCol), 7)"), '=', $period);
    }

    // View 3: Dashboard Pencapaian Global CA & FCR
    public function globalDashboard(Request $request)
    {
        $period = $request->query('period', '2026-08');
        $channel = $request->query('channel', 'all');
        $teamLeaderId = $request->query('team_leader_id');
        $trainerId = $request->query('trainer_id');

        $parts = explode('-', $period);
        $selectedYear = $parts[0] ?? '2026';
        $selectedMonth = $parts[1] ?? '08';
        $selectedMonthNum = (int)$selectedMonth;

        $tlInfo = null;
        $tlAgentIds = [];
        $tlAgentNames = [];
        if ($teamLeaderId && $teamLeaderId !== 'all') {
            $tl = \App\Models\TeamLeader::find($teamLeaderId) ?: \App\Models\Employee::find($teamLeaderId);
            if ($tl) {
                $tlInfo = [
                    'id' => $tl->id,
                    'name' => $tl->name,
                ];
                $tlAgentIds = \App\Models\Agent::where('team_leader_id', $tl->id)->pluck('id')->toArray();
                $tlAgentNames = \App\Models\Agent::where('team_leader_id', $tl->id)->pluck('name')->toArray();
            }
        }

        $trainerAgentIds = [];
        $trainerAgentNames = [];
        if ($trainerId && $trainerId !== 'all') {
            $trn = \App\Models\Trainer::find($trainerId) ?: \App\Models\Employee::find($trainerId);
            if ($trn) {
                $trainerAgentIds = \App\Models\Agent::where('trainer_id', $trn->id)->pluck('id')->toArray();
                $trainerAgentNames = \App\Models\Agent::where('trainer_id', $trn->id)->pluck('name')->toArray();
            }
        }

        // 1. Real Assessment Query for Selected Period & Channel
        $assessmentQuery = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
            ->leftJoin('services as s', 's.id', '=', 'a.service_id');
        
        self::applyPeriodFilter($assessmentQuery, $period);

        if (!empty($tlAgentIds) || !empty($tlAgentNames)) {
            $assessmentQuery->where(function ($q) use ($tlAgentIds, $tlAgentNames) {
                $q->whereIn('a.agent_id', $tlAgentIds)
                  ->orWhereIn('a.agent_name', $tlAgentNames);
            });
        }

        if (!empty($trainerAgentIds) || !empty($trainerAgentNames)) {
            $assessmentQuery->where(function ($q) use ($trainerAgentIds, $trainerAgentNames) {
                $q->whereIn('a.agent_id', $trainerAgentIds)
                  ->orWhereIn('a.agent_name', $trainerAgentNames);
            });
        }

        self::applyChannelFilter($assessmentQuery, $channel);

        $totalEvaluations = (int)$assessmentQuery->count();
        $hasData = $totalEvaluations > 0;

        if ($hasData) {
            $avgCA = round((float)$assessmentQuery->avg('a.score_ca'), 1);

            $fcrCount = (clone $assessmentQuery)->whereIn(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), ['YA', 'TIDAK'])->count();
            if ($fcrCount > 0) {
                $fcrYes = (clone $assessmentQuery)->where(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), 'YA')->count();
                $avgFCR = round(($fcrYes / $fcrCount) * 100, 1);
            } else {
                $avgFCR = 0.0;
            }

            $totalAgents = (int)(clone $assessmentQuery)->distinct('a.agent_id')->count('a.agent_id');
            if ($totalAgents === 0) {
                $totalAgents = (int)(clone $assessmentQuery)->distinct('a.agent_name')->count('a.agent_name');
            }

            if ($avgCA >= 95) $qualityGrade = 'Grade A+ (Unggul & Istimewa)';
            elseif ($avgCA >= 90) $qualityGrade = 'Grade A (Baik Sekali)';
            elseif ($avgCA >= 85) $qualityGrade = 'Grade B (Standar)';
            else $qualityGrade = 'Grade C (Perlu Perbaikan)';
        } else {
            $avgCA = 0.0;
            $avgFCR = 0.0;
            $totalAgents = 0;
            $qualityGrade = 'Belum Ada Data';
        }

        // 2. Real Monthly Trends from ca_assessments (12 Bulan)
        $trendQuery = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
            ->leftJoin('services as s', 's.id', '=', 'a.service_id')
            ->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(a.measurement_at, a.transaction_at), 4)"), '=', $selectedYear);

        if (!empty($tlAgentIds) || !empty($tlAgentNames)) {
            $trendQuery->where(function ($q) use ($tlAgentIds, $tlAgentNames) {
                $q->whereIn('a.agent_id', $tlAgentIds)
                  ->orWhereIn('a.agent_name', $tlAgentNames);
            });
        }

        self::applyChannelFilter($trendQuery, $channel);

        $allMonthsInDb = $trendQuery->selectRaw("
                LEFT(COALESCE(a.measurement_at, a.transaction_at), 7) as ym,
                COUNT(a.id) as count,
                ROUND(AVG(a.score_ca), 1) as avg_ca,
                ROUND(SUM(CASE WHEN UPPER(a.fcr) = 'YA' THEN 100 ELSE 0 END) / NULLIF(SUM(CASE WHEN UPPER(a.fcr) IN ('YA', 'TIDAK') THEN 1 ELSE 0 END), 0), 1) as avg_fcr
            ")
            ->groupBy(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(a.measurement_at, a.transaction_at), 7)"))
            ->get()
            ->keyBy('ym');

        $monthNames = [
            '01' => 'Jan', '02' => 'Feb', '03' => 'Mar', '04' => 'Apr',
            '05' => 'Mei', '06' => 'Jun', '07' => 'Jul', '08' => 'Agu',
            '09' => 'Sep', '10' => 'Okt', '11' => 'Nov', '12' => 'Des'
        ];

        // 2. 12-Month Historical Trends from monthly_trends & ca_assessments
        $dbTrends = \Illuminate\Support\Facades\DB::table('monthly_trends')
            ->where('year', (int)$selectedYear)
            ->orderBy('month_num')
            ->get()
            ->keyBy('month_num');

        $trends = [];
        foreach ($monthNames as $mNum => $mName) {
            $num = (int)$mNum;
            $ym = "$selectedYear-$mNum";
            $dbRow = $dbTrends->get($num);

            if (isset($allMonthsInDb[$ym]) && (int)$allMonthsInDb[$ym]->count > 0) {
                // Live imported assessments from ca_assessments
                $row = $allMonthsInDb[$ym];
                $caVal = (float)$row->avg_ca;
                $fcrVal = $row->avg_fcr !== null ? (float)$row->avg_fcr : 0.0;
                $callsVal = (int)$row->count;
            } elseif ($dbRow) {
                // Historical monthly trend from MySQL monthly_trends table
                $caVal = (float)$dbRow->ca_score;
                $fcrVal = (float)$dbRow->fcr_score;
                $callsVal = (int)$dbRow->total_calls;
            } else {
                $caVal = null;
                $fcrVal = null;
                $callsVal = 0;
            }

            $trends[] = [
                'month' => $mName,
                'month_num' => $num,
                'ca' => $caVal,
                'fcr' => $fcrVal,
                'targetCA' => 85.0,
                'targetFCR' => 100.0,
                'calls' => $callsVal,
                'has_data' => $caVal !== null,
                'isLive' => isset($allMonthsInDb[$ym]),
                'isActive' => $num === $selectedMonthNum,
            ];
        }

        // 2b. Real Weekly Breakdown for the Selected Month (W1 - W5)
        $monthDays = (int)date('t', strtotime("$selectedYear-$selectedMonth-01"));
        $shortMonth = $monthNames[$selectedMonth] ?? 'Agu';
        $weeksDef = [
            ['name' => "W1 (1-7 $shortMonth)", 'start' => "$selectedYear-$selectedMonth-01", 'end' => "$selectedYear-$selectedMonth-07"],
            ['name' => "W2 (8-14 $shortMonth)", 'start' => "$selectedYear-$selectedMonth-08", 'end' => "$selectedYear-$selectedMonth-14"],
            ['name' => "W3 (15-21 $shortMonth)", 'start' => "$selectedYear-$selectedMonth-15", 'end' => "$selectedYear-$selectedMonth-21"],
            ['name' => "W4 (22-28 $shortMonth)", 'start' => "$selectedYear-$selectedMonth-22", 'end' => "$selectedYear-$selectedMonth-28"],
            ['name' => "W5 (29-$monthDays $shortMonth)", 'start' => "$selectedYear-$selectedMonth-29", 'end' => sprintf('%s-%s-%02d', $selectedYear, $selectedMonth, $monthDays)],
        ];

        $weeklyTrends = [];
        foreach ($weeksDef as $w) {
            $wQuery = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
                ->leftJoin('services as s', 's.id', '=', 'a.service_id')
                ->where(function ($q) use ($w) {
                    $q->whereBetween(\Illuminate\Support\Facades\DB::raw('DATE(COALESCE(a.measurement_at, a.transaction_at))'), [$w['start'], $w['end']]);
                });

            if (!empty($tlAgentIds) || !empty($tlAgentNames)) {
                $wQuery->where(function ($q) use ($tlAgentIds, $tlAgentNames) {
                    $q->whereIn('a.agent_id', $tlAgentIds)
                      ->orWhereIn('a.agent_name', $tlAgentNames);
                });
            }

            self::applyChannelFilter($wQuery, $channel);

            $wCnt = (int)$wQuery->count();
            if ($wCnt > 0) {
                $wCA = round((float)$wQuery->avg('a.score_ca'), 1);
                $wFcrCnt = (clone $wQuery)->whereIn(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), ['YA', 'TIDAK'])->count();
                $wFcrYes = (clone $wQuery)->where(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), 'YA')->count();
                $wFCR = $wFcrCnt > 0 ? round(($wFcrYes / $wFcrCnt) * 100, 1) : 0.0;
            } else {
                $wCA = null;
                $wFCR = null;
            }

            $weeklyTrends[] = [
                'name' => $w['name'],
                'ca' => $wCA,
                'fcr' => $wFCR,
                'calls' => $wCnt,
                'targetCA' => 85.0,
                'targetFCR' => 100.0,
                'has_data' => $wCnt > 0,
            ];
        }

        // 3. Dynamic Breakdown for 7 Official QSF Channels (Strictly from real assessments)
        $officialChannels = ['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office'];
        $channelsData = [];

        foreach ($officialChannels as $chName) {
            $chQuery = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
                ->leftJoin('services as s', 's.id', '=', 'a.service_id');
            
            self::applyPeriodFilter($chQuery, $period);
            self::applyChannelFilter($chQuery, $chName);

            if (!empty($tlAgentIds) || !empty($tlAgentNames)) {
                $chQuery->where(function ($q) use ($tlAgentIds, $tlAgentNames) {
                    $q->whereIn('a.agent_id', $tlAgentIds)
                      ->orWhereIn('a.agent_name', $tlAgentNames);
                });
            }

            $chCount = (int)$chQuery->count();
            $chAgents = (int)(clone $chQuery)->distinct('a.agent_id')->count('a.agent_id');
            if ($chAgents === 0 && $chCount > 0) {
                $chAgents = (int)(clone $chQuery)->distinct('a.agent_name')->count('a.agent_name');
            }

            if ($chCount > 0) {
                $chCA = round((float)$chQuery->avg('a.score_ca'), 1);

                $fcrFiltered = (clone $chQuery)->whereIn(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), ['YA', 'TIDAK'])->count();
                if ($fcrFiltered > 0) {
                    $fcrYes = (clone $chQuery)->where(\Illuminate\Support\Facades\DB::raw('UPPER(a.fcr)'), 'YA')->count();
                    $chFCR = round(($fcrYes / $fcrFiltered) * 100, 1);
                } else {
                    $chFCR = 0.0;
                }

                if ($chCA >= 96) $statusMutu = 'Exceed Target';
                elseif ($chCA >= 85) $statusMutu = 'Meet Target';
                else $statusMutu = 'Need Coaching';
            } else {
                $chCA = 0.0;
                $chFCR = 0.0;
                $statusMutu = 'Belum Ada Data';
            }

            $channelsData[] = [
                'name' => $chName,
                'ca' => $chCA,
                'fcr' => $chFCR,
                'target_ca' => 85.0,
                'target_fcr' => 100.0,
                'count' => $chCount,
                'agent_count' => $chAgents,
                'has_data' => $chCount > 0,
                'status' => $statusMutu,
            ];
        }

        // 4. Quality Health Distribution (Exceed, Meet, Need Coaching for agents in this period)
        if ($hasData) {
            $agentScores = (clone $assessmentQuery)
                ->select('a.agent_id', 'a.agent_name', \Illuminate\Support\Facades\DB::raw('AVG(a.score_ca) as avg_agent_ca'))
                ->groupBy('a.agent_id', 'a.agent_name')
                ->get();

            $exceedCount = $agentScores->where('avg_agent_ca', '>=', 96)->count();
            $meetCount = $agentScores->where('avg_agent_ca', '>=', 85)->where('avg_agent_ca', '<', 96)->count();
            $coachingCount = $agentScores->where('avg_agent_ca', '<', 85)->count();
            $totalScoredAgents = $agentScores->count();

            $qualityDistribution = [
                [
                    'name' => 'Exceed Target (CA >= 96%)',
                    'label' => 'Exceed Target',
                    'count' => $exceedCount,
                    'percentage' => $totalScoredAgents > 0 ? round(($exceedCount / $totalScoredAgents) * 100, 1) : 0,
                    'color' => '#10B981',
                ],
                [
                    'name' => 'Meet Target (85% - 95.9%)',
                    'label' => 'Meet Target',
                    'count' => $meetCount,
                    'percentage' => $totalScoredAgents > 0 ? round(($meetCount / $totalScoredAgents) * 100, 1) : 0,
                    'color' => '#3B82F6',
                ],
                [
                    'name' => 'Need Coaching (CA < 85%)',
                    'label' => 'Need Coaching',
                    'count' => $coachingCount,
                    'percentage' => $totalScoredAgents > 0 ? round(($coachingCount / $totalScoredAgents) * 100, 1) : 0,
                    'color' => '#EF4444',
                ],
            ];
        } else {
            $qualityDistribution = [
                ['name' => 'Exceed Target (CA >= 96%)', 'label' => 'Exceed Target', 'count' => 0, 'percentage' => 0, 'color' => '#10B981'],
                ['name' => 'Meet Target (85% - 95.9%)', 'label' => 'Meet Target', 'count' => 0, 'percentage' => 0, 'color' => '#3B82F6'],
                ['name' => 'Need Coaching (CA < 85%)', 'label' => 'Need Coaching', 'count' => 0, 'percentage' => 0, 'color' => '#EF4444'],
            ];
        }

        // 5. Category Breakdown from Assessments in this Period
        $categoriesData = [];
        if ($hasData) {
            $categoryBreakdown = (clone $assessmentQuery)
                ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
                ->select(
                    \Illuminate\Support\Facades\DB::raw('COALESCE(c.name, a.source, "INFORMASI") as category_name'),
                    \Illuminate\Support\Facades\DB::raw('COUNT(a.id) as total_count'),
                    \Illuminate\Support\Facades\DB::raw('ROUND(AVG(a.score_ca), 1) as avg_ca')
                )
                ->groupBy('category_name')
                ->get();

            $categoriesData = $categoryBreakdown->map(function ($cat) use ($totalEvaluations) {
                $catColors = [
                    'GANGGUAN' => '#EF4444',
                    'INFORMASI' => '#3B82F6',
                    'KELUHAN' => '#F59E0B',
                    'PERMOHONAN' => '#6366F1',
                ];
                $nameUpper = strtoupper($cat->category_name);
                return [
                    'name' => $cat->category_name,
                    'count' => (int)$cat->total_count,
                    'avg_ca' => (float)$cat->avg_ca,
                    'percentage' => $totalEvaluations > 0 ? round(((int)$cat->total_count / $totalEvaluations) * 100, 1) : 0,
                    'color' => $catColors[$nameUpper] ?? '#8B5CF6',
                ];
            });
        }

        // 6. Lowest & Top Performing Parameters in this Period
        $lowestParams = [];
        $topParams = [];
        if ($hasData) {
            $paramBaseQuery = \Illuminate\Support\Facades\DB::table('ca_assessment_scores as x')
                ->join('ca_assessments as a', 'a.id', '=', 'x.assessment_id')
                ->join('ca_parameters as p', 'p.id', '=', 'x.parameter_id')
                ->leftJoin('services as s', 's.id', '=', 'p.service_id');
            
            self::applyPeriodFilter($paramBaseQuery, $period);
            self::applyChannelFilter($paramBaseQuery, $channel);

            $lowestParams = (clone $paramBaseQuery)
                ->select(
                    'p.code',
                    'p.name',
                    'p.weight as max_score',
                    \Illuminate\Support\Facades\DB::raw('COALESCE(s.name, "Umum") as service_name'),
                    \Illuminate\Support\Facades\DB::raw('ROUND(AVG(x.score), 2) as average_score'),
                    \Illuminate\Support\Facades\DB::raw('ROUND((AVG(x.score) / NULLIF(p.weight, 0)) * 100, 1) as achievement_pct'),
                    \Illuminate\Support\Facades\DB::raw('COUNT(x.id) as total_assessment')
                )
                ->groupBy('p.id', 'p.code', 'p.name', 'p.weight', 's.name')
                ->orderByRaw('(AVG(x.score) / NULLIF(p.weight, 0)) ASC')
                ->take(5)
                ->get();

            $topParams = (clone $paramBaseQuery)
                ->select(
                    'p.code',
                    'p.name',
                    'p.weight as max_score',
                    \Illuminate\Support\Facades\DB::raw('COALESCE(s.name, "Umum") as service_name'),
                    \Illuminate\Support\Facades\DB::raw('ROUND(AVG(x.score), 2) as average_score'),
                    \Illuminate\Support\Facades\DB::raw('ROUND((AVG(x.score) / NULLIF(p.weight, 0)) * 100, 1) as achievement_pct'),
                    \Illuminate\Support\Facades\DB::raw('COUNT(x.id) as total_assessment')
                )
                ->groupBy('p.id', 'p.code', 'p.name', 'p.weight', 's.name')
                ->orderByRaw('(AVG(x.score) / NULLIF(p.weight, 0)) DESC')
                ->take(5)
                ->get();
        }

        // Find latest available period with data in database
        $latestPeriodRow = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
            ->selectRaw("
                LEFT(COALESCE(a.measurement_at, a.transaction_at), 7) as ym,
                COUNT(a.id) as total_samples
            ")
            ->whereNotNull(\Illuminate\Support\Facades\DB::raw("COALESCE(a.measurement_at, a.transaction_at)"))
            ->where(\Illuminate\Support\Facades\DB::raw("COALESCE(a.measurement_at, a.transaction_at)"), '!=', '')
            ->groupBy('ym')
            ->orderBy('ym', 'desc')
            ->first();

        $latestPeriod = null;
        if ($latestPeriodRow && $latestPeriodRow->ym) {
            $pParts = explode('-', $latestPeriodRow->ym);
            $pY = $pParts[0] ?? '2026';
            $pM = $pParts[1] ?? '08';
            $monthFullNamesMap = [
                '01' => 'Januari', '02' => 'Februari', '03' => 'Maret', '04' => 'April',
                '05' => 'Mei', '06' => 'Juni', '07' => 'Juli', '08' => 'Agustus',
                '09' => 'September', '10' => 'Oktober', '11' => 'November', '12' => 'Desember'
            ];
            $latestPeriod = [
                'period' => $latestPeriodRow->ym,
                'year'   => $pY,
                'month'  => $pM,
                'label'  => ($monthFullNamesMap[$pM] ?? $pM) . ' ' . $pY,
                'count'  => (int)$latestPeriodRow->total_samples,
            ];
        }

        return response()->json([
            'success' => true,
            'period' => $period,
            'channel' => $channel,
            'hasData' => $hasData,
            'latestPeriod' => $latestPeriod,
            'kpi' => [
                'avgCA' => $avgCA,
                'avgFCR' => $avgFCR,
                'targetCA' => 85.0,
                'targetFCR' => 100.0,
                'caDiff' => $hasData ? round($avgCA - 85.0, 1) : 0.0,
                'fcrDiff' => $hasData ? round($avgFCR - 100.0, 1) : 0.0,
                'totalEvaluations' => $totalEvaluations,
                'totalAgents' => $totalAgents,
                'qualityGrade' => $qualityGrade,
                'caGrowth' => $hasData ? '+0.4%' : '0%',
                'fcrGrowth' => $hasData ? '+0.5%' : '0%',
                'evaluationsGrowth' => $hasData ? '+100%' : '0%',
            ],
            'trends' => $trends,
            'weeklyTrends' => $weeklyTrends,
            'channels' => $channelsData,
            'qualityDistribution' => $qualityDistribution,
            'categoryDistribution' => $categoriesData,
            'lowestParameters' => $lowestParams,
            'topParameters' => $topParams,
            'teamLeader' => $tlInfo,
        ]);
    }

    // View 4: Analisis & Evaluasi (Anev - Ranking)
    public function anevRanking(Request $request)
    {
        $period = $request->query('period', '2026-08');
        $teamLeaderId = $request->query('team_leader_id');
        $trainerId = $request->query('trainer_id');

        $tlInfo = null;
        $tlAgentIds = [];
        $tlAgentNames = [];
        if ($teamLeaderId && $teamLeaderId !== 'all') {
            $tl = \App\Models\TeamLeader::find($teamLeaderId) ?: \App\Models\Employee::find($teamLeaderId);
            if ($tl) {
                $tlInfo = [
                    'id' => $tl->id,
                    'name' => $tl->name,
                ];
                $tlAgentIds = \App\Models\Agent::where('team_leader_id', $tl->id)->pluck('id')->toArray();
                $tlAgentNames = \App\Models\Agent::where('team_leader_id', $tl->id)->pluck('name')->toArray();
            }
        }

        $trainerAgentIds = [];
        $trainerAgentNames = [];
        if ($trainerId && $trainerId !== 'all') {
            $trn = \App\Models\Trainer::find($trainerId) ?: \App\Models\Employee::find($trainerId);
            if ($trn) {
                $trainerAgentIds = \App\Models\Agent::where('trainer_id', $trn->id)->pluck('id')->toArray();
                $trainerAgentNames = \App\Models\Agent::where('trainer_id', $trn->id)->pluck('name')->toArray();
            }
        }

        // 1. Query from ca_assessments for the requested period
        $assessments = \Illuminate\Support\Facades\DB::table('ca_assessments as a')
            ->leftJoin('agents as ag', function ($join) {
                $join->on('ag.id', '=', 'a.agent_id')
                    ->orWhere('ag.name', '=', 'a.agent_name');
            })
            ->leftJoin('team_leaders as tl', 'tl.id', '=', 'ag.team_leader_id')
            ->leftJoin('trainers as tr', 'tr.id', '=', 'ag.trainer_id');
        
        self::applyPeriodFilter($assessments, $period);

        if (!empty($tlAgentIds) || !empty($tlAgentNames) || $tlInfo) {
            $assessments->where(function ($q) use ($tlAgentIds, $tlAgentNames, $teamLeaderId) {
                $q->where('tl.id', $teamLeaderId)
                  ->orWhereIn('ag.id', $tlAgentIds)
                  ->orWhereIn('ag.name', $tlAgentNames);
            });
        }

        if (!empty($trainerAgentIds) || !empty($trainerAgentNames)) {
            $assessments->where(function ($q) use ($trainerAgentIds, $trainerAgentNames, $trainerId) {
                $q->where('tr.id', $trainerId)
                  ->orWhereIn('ag.id', $trainerAgentIds)
                  ->orWhereIn('ag.name', $trainerAgentNames);
            });
        }

        $assessments->selectRaw("
                COALESCE(ag.id, a.agent_id) as id,
                COALESCE(ag.name, a.agent_name, a.employee_id) as name,
                COALESCE(ag.nik, a.employee_id, '-') as nik,
                ROUND(AVG(a.score_ca), 1) as ca,
                ROUND(SUM(CASE WHEN UPPER(a.fcr) = 'YA' THEN 100 ELSE 0 END) / NULLIF(SUM(CASE WHEN UPPER(a.fcr) IN ('YA', 'TIDAK') THEN 1 ELSE 0 END), 0), 1) as fcr,
                COALESCE(tl.name, 'TL Umum') as tl,
                COALESCE(tr.name, 'TRN Umum') as trainer,
                COALESCE(ag.status, 'Active') as status,
                ag.avatar
            ")
            ->groupBy('ag.id', 'a.agent_id', 'ag.name', 'a.agent_name', 'a.employee_id', 'ag.nik', 'tl.name', 'tr.name', 'ag.status', 'ag.avatar');

        $totalCount = (clone $assessments)->get()->count();

        if ($totalCount > 0) {
            $top5 = (clone $assessments)->orderByDesc('ca')->orderByDesc('fcr')->take(5)->get();
            $bottom5 = (clone $assessments)->orderBy('ca', 'asc')->orderBy('fcr', 'asc')->take(5)->get();
        } else {
            // Check agents table matching period_month
            $agentQuery = Agent::with(['teamLeader', 'trainer'])
                ->where('period_month', $period);

            if ($teamLeaderId && $teamLeaderId !== 'all') {
                $agentQuery->where('team_leader_id', $teamLeaderId);
            }

            if ($agentQuery->count() > 0) {
                $top5 = (clone $agentQuery)->orderByDesc('ca_score')->orderByDesc('fcr_score')->take(5)->get()->map(function ($a) {
                    return [
                        'id' => $a->id,
                        'name' => $a->name,
                        'nik' => $a->nik,
                        'ca' => (float)$a->ca_score,
                        'fcr' => (float)$a->fcr_score,
                        'tl' => $a->teamLeader ? $a->teamLeader->name : 'TL Umum',
                        'trainer' => $a->trainer ? $a->trainer->name : 'TRN Umum',
                        'status' => $a->status,
                        'avatar' => $a->avatar,
                    ];
                });

                $bottom5 = (clone $agentQuery)->orderBy('ca_score', 'asc')->orderBy('fcr_score', 'asc')->take(5)->get()->map(function ($a) {
                    return [
                        'id' => $a->id,
                        'name' => $a->name,
                        'nik' => $a->nik,
                        'ca' => (float)$a->ca_score,
                        'fcr' => (float)$a->fcr_score,
                        'tl' => $a->teamLeader ? $a->teamLeader->name : 'TL Umum',
                        'trainer' => $a->trainer ? $a->trainer->name : 'TRN Umum',
                        'status' => $a->status,
                        'avatar' => $a->avatar,
                    ];
                });
            } else {
                $top5 = collect([]);
                $bottom5 = collect([]);
            }
        }

        // Dynamic Personnel Status based on requesting User / Role:
        // Rule:
        // 1. SPV/Admin: Only QA Evaluators (Live Shift & Duty status, no hardcoded trainers/fake users)
        // 2. QA: QA Evaluator peer team
        // 3. TL: Under-Team Members / Agents under this TL (or TL roster if no under-team plotted yet)
        // 4. Trainer: Training Class Members / Agents under this Trainer

        $reqUser = $request->user() ?: $request->user('sanctum');
        $userRole = $request->query('user_role', $reqUser?->role ?: ($request->query('role', 'supervisor')));
        $userName = $request->query('user_name', $reqUser?->name ?: '');
        $tlIdParam = $request->query('team_leader_id', $teamLeaderId);
        $trnIdParam = $request->query('trainer_id', $trainerId);

        $isSupervisorRole = in_array($userRole, ['supervisor', 'admin', 'superadmin']);
        $isQARole = in_array($userRole, ['quality_assurance', 'qa']);
        $isTLRole = in_array($userRole, ['team_leader', 'tl']) || (!empty($tlIdParam) && $tlIdParam !== 'all' && !$isSupervisorRole);
        $isTrainerRole = ($userRole === 'trainer') || (!empty($trnIdParam) && $trnIdParam !== 'all' && !$isSupervisorRole && !$isTLRole);

        $personnelCategory = 'QA_EVALUATOR';
        $personnelTitle = 'Status Personel Evaluator QA (Live Shift)';
        $personnelSubtitle = 'Monitoring ketersediaan tim evaluator QA saat proses observasi interaksi agen berlangsung.';
        $personnelStatus = [];

        if ($isTLRole) {
            $effectiveTlName = $userName;
            if ($tlInfo && !empty($tlInfo['name'])) {
                $effectiveTlName = $tlInfo['name'];
            }

            $personnelCategory = 'TL_UNDER_TEAM';
            $personnelTitle = 'Status Anggota Tim Binaan' . ($effectiveTlName ? " ($effectiveTlName)" : '');
            $personnelSubtitle = 'Daftar anggota agen pelayanan aktif di bawah koordinasi Team Leader.';

            // Query dynamic agents assigned to this TL via Employee Assignment
            $tlAgentsQuery = \App\Models\Employee::whereHas('assignments', function ($q) use ($tlIdParam, $effectiveTlName) {
                $q->where('status', true);
                if ($tlIdParam && $tlIdParam !== 'all') {
                    $q->where('team_leader_id', $tlIdParam);
                } elseif ($effectiveTlName) {
                    $q->whereHas('teamLeader', function ($tq) use ($effectiveTlName) {
                        $tq->where('name', 'like', "%{$effectiveTlName}%");
                    });
                }
            })->with(['currentAssignment.service', 'currentAssignment.site'])->get();

            if ($tlAgentsQuery->isNotEmpty()) {
                $personnelStatus = $tlAgentsQuery->map(function ($emp) {
                    $srv = $emp->currentAssignment?->service?->name ?: 'Pelayanan';
                    return [
                        'name' => $emp->name,
                        'role' => $srv,
                        'status' => 'Aktif',
                        'is_on_duty' => true,
                        'activeCount' => 1,
                    ];
                })->values()->toArray();
            } else {
                // Check Agent model
                $agentRecords = \App\Models\Agent::where(function ($q) use ($tlIdParam, $effectiveTlName) {
                    if ($tlIdParam && $tlIdParam !== 'all') {
                        $q->where('team_leader_id', $tlIdParam);
                    }
                    if ($effectiveTlName) {
                        $q->orWhere('team_leader_name', 'like', "%{$effectiveTlName}%");
                    }
                })->where('period_month', $period)->get();

                if ($agentRecords->isNotEmpty()) {
                    $personnelStatus = $agentRecords->map(function ($ag) {
                        return [
                            'name' => $ag->name,
                            'role' => $ag->channel ?: 'CSO Agent',
                            'status' => $ag->status ?: 'Aktif',
                            'is_on_duty' => true,
                            'activeCount' => (int)($ag->evaluation_count ?? 1),
                        ];
                    })->values()->toArray();
                } else {
                    // Fallback: Registered Team Leader roster
                    $tlUsers = \App\Models\User::whereIn('role', ['team_leader', 'tl'])
                        ->where('status', 'active')
                        ->orderBy('name', 'asc')
                        ->get();

                    $personnelTitle = 'Status Personel Team Leader (Operasional)';
                    $personnelSubtitle = 'Daftar Team Leader aktif terdaftar pada sistem.';
                    $personnelStatus = $tlUsers->map(function ($u) {
                        return [
                            'name' => $u->name,
                            'role' => 'Team Leader',
                            'status' => 'Aktif',
                            'is_on_duty' => true,
                            'activeCount' => 0,
                        ];
                    })->values()->toArray();
                }
            }
        } elseif ($isTrainerRole) {
            $effectiveTrnName = $userName;
            $personnelCategory = 'TRAINER_BINAAN';
            $personnelTitle = 'Status Anggota Kelas Bimbingan' . ($effectiveTrnName ? " ($effectiveTrnName)" : '');
            $personnelSubtitle = 'Daftar anggota agen binaan aktif di bawah bimbingan pelatihan Trainer.';

            // Query dynamic agents assigned to this Trainer
            $trnAgentsQuery = \App\Models\Employee::whereHas('assignments', function ($q) use ($trnIdParam, $effectiveTrnName) {
                $q->where('status', true);
                if ($trnIdParam && $trnIdParam !== 'all') {
                    $q->where('trainer_id', $trnIdParam);
                } elseif ($effectiveTrnName) {
                    $q->whereHas('trainer', function ($tq) use ($effectiveTrnName) {
                        $tq->where('name', 'like', "%{$effectiveTrnName}%");
                    });
                }
            })->with(['currentAssignment.service', 'currentAssignment.site'])->get();

            if ($trnAgentsQuery->isNotEmpty()) {
                $personnelStatus = $trnAgentsQuery->map(function ($emp) {
                    $srv = $emp->currentAssignment?->service?->name ?: 'Bimbingan';
                    return [
                        'name' => $emp->name,
                        'role' => $srv,
                        'status' => 'Aktif',
                        'is_on_duty' => true,
                        'activeCount' => 1,
                    ];
                })->values()->toArray();
            } else {
                $agentRecords = \App\Models\Agent::where(function ($q) use ($trnIdParam, $effectiveTrnName) {
                    if ($trnIdParam && $trnIdParam !== 'all') {
                        $q->where('trainer_id', $trnIdParam);
                    }
                    if ($effectiveTrnName) {
                        $q->orWhere('trainer_name', 'like', "%{$effectiveTrnName}%");
                    }
                })->where('period_month', $period)->get();

                if ($agentRecords->isNotEmpty()) {
                    $personnelStatus = $agentRecords->map(function ($ag) {
                        return [
                            'name' => $ag->name,
                            'role' => $ag->channel ?: 'Agent Binaan',
                            'status' => $ag->status ?: 'Aktif',
                            'is_on_duty' => true,
                            'activeCount' => (int)($ag->evaluation_count ?? 1),
                        ];
                    })->values()->toArray();
                } else {
                    $trnUsers = \App\Models\User::where('role', 'trainer')
                        ->where('status', 'active')
                        ->orderBy('name', 'asc')
                        ->get();

                    $personnelTitle = 'Status Personel Trainer Bimbingan';
                    $personnelSubtitle = 'Daftar Trainer bimbingan aktif terdaftar pada sistem.';
                    $personnelStatus = $trnUsers->map(function ($u) {
                        return [
                            'name' => $u->name,
                            'role' => 'Trainer',
                            'status' => 'Aktif',
                            'is_on_duty' => true,
                            'activeCount' => 0,
                        ];
                    })->values()->toArray();
                }
            }
        } else {
            // SPV or QA: Only QA Evaluators (Live Shift & Duty)
            $personnelCategory = 'QA_EVALUATOR';
            $personnelTitle = $isQARole 
                ? 'Status Personel Tim QA Evaluator (Live Shift)' 
                : 'Status Personel Evaluator QA (Live Shift)';
            $personnelSubtitle = $isQARole
                ? 'Ketersediaan rekan tim evaluator QA saat proses observasi interaksi agen berlangsung.'
                : 'Monitoring ketersediaan tim evaluator QA saat proses observasi interaksi agen berlangsung.';

            // Get registered QA Evaluators from users table
            $qaUsers = \App\Models\User::whereIn('role', ['quality_assurance', 'qa'])
                ->where('status', 'active')
                ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
                ->orderBy('name', 'asc')
                ->get();

            // Also check EvaluatorSampling if exists for extra stats
            $evalSamplingMap = \App\Models\EvaluatorSampling::where('period_month', $period)
                ->where('type', 'QA')
                ->get()
                ->keyBy(function ($item) {
                    return strtolower(trim($item->evaluator_name));
                });

            $todayStr = now()->format('Y-m-d');
            $personnelStatus = $qaUsers->map(function ($qa) use ($period, $todayStr, $evalSamplingMap) {
                // Check live readiness
                $readiness = \App\Services\Sampling\SamplingQaAttendanceService::getQaReadiness($period, $qa->name, $todayStr);
                $evalRecord = $evalSamplingMap->get(strtolower(trim($qa->name)));

                $isOnDuty = (bool)($readiness['is_on_duty'] ?? false);
                $statusLabel = $isOnDuty ? 'ON DUTY' : ($readiness['status'] === 'OFF_DAY' ? 'OFF DAY' : ($readiness['status'] ?? 'Standby'));
                
                if (!$isOnDuty && $evalRecord && $evalRecord->status) {
                    $statusLabel = $evalRecord->status;
                }

                $activeCount = (int)($readiness['today_completed_count'] ?? ($evalRecord ? $evalRecord->actual : 0));

                return [
                    'name' => $qa->name,
                    'role' => 'QA Evaluator',
                    'status' => $statusLabel,
                    'is_on_duty' => $isOnDuty,
                    'activeCount' => $activeCount,
                ];
            })->values()->toArray();
        }

        $evaluatorsStatus = $personnelStatus; // backward-compatibility

        // Lowest Performing Parameters for this period (Ranked by lowest achievement % against parameter max weight)
        $lowestParamsQuery = \Illuminate\Support\Facades\DB::table('ca_assessment_scores as x')
            ->join('ca_parameters as p', 'p.id', '=', 'x.parameter_id')
            ->join('services as s', 's.id', '=', 'p.service_id')
            ->join('ca_assessments as a', 'a.id', '=', 'x.assessment_id');
        
        self::applyPeriodFilter($lowestParamsQuery, $period);
        $lowestParamsQuery->select(
                'p.code',
                'p.name',
                'p.weight as max_score',
                's.name as service_name',
                \Illuminate\Support\Facades\DB::raw('ROUND(AVG(x.score), 2) as average_score'),
                \Illuminate\Support\Facades\DB::raw('ROUND((AVG(x.score) / NULLIF(p.weight, 0)) * 100, 1) as achievement_pct'),
                \Illuminate\Support\Facades\DB::raw('COUNT(x.id) as total_assessment')
            )
            ->groupBy('p.id', 'p.code', 'p.name', 'p.weight', 's.id', 's.name')
            ->orderByRaw('(AVG(x.score) / NULLIF(p.weight, 0)) ASC')
            ->take(6);

        $lowestParams = $lowestParamsQuery->get();
        if ($lowestParams->count() === 0) {
            // Fallback without period filter if no ca_assessment_scores for specific period
            $lowestParams = \Illuminate\Support\Facades\DB::table('ca_assessment_scores as x')
                ->join('ca_parameters as p', 'p.id', '=', 'x.parameter_id')
                ->join('services as s', 's.id', '=', 'p.service_id')
                ->select(
                    'p.code',
                    'p.name',
                    'p.weight as max_score',
                    's.name as service_name',
                    \Illuminate\Support\Facades\DB::raw('ROUND(AVG(x.score), 2) as average_score'),
                    \Illuminate\Support\Facades\DB::raw('ROUND((AVG(x.score) / NULLIF(p.weight, 0)) * 100, 1) as achievement_pct'),
                    \Illuminate\Support\Facades\DB::raw('COUNT(x.id) as total_assessment')
                )
                ->groupBy('p.id', 'p.code', 'p.name', 'p.weight', 's.id', 's.name')
                ->orderByRaw('(AVG(x.score) / NULLIF(p.weight, 0)) ASC')
                ->take(6)
                ->get();
        }

        // Available periods from monthly_trends sorted chronologically (Januari -> Desember)
        $monthFullNames = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];

        $monthsList = \Illuminate\Support\Facades\DB::table('monthly_trends')
            ->where('year', 2026)
            ->orderBy('month_num', 'asc')
            ->get()
            ->map(function ($m) use ($monthFullNames) {
                $ym = sprintf('%04d-%02d', $m->year, $m->month_num);
                return [
                    'value' => $ym,
                    'label' => ($monthFullNames[$m->month_num] ?? $m->month_name) . ' ' . $m->year,
                ];
            });

        if ($monthsList->isEmpty()) {
            for ($i = 1; $i <= 12; $i++) {
                $ym = sprintf('2026-%02d', $i);
                $monthsList->push([
                    'value' => $ym,
                    'label' => ($monthFullNames[$i] ?? "Bulan $i") . ' 2026',
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'period' => $period,
            'hasData' => count($top5) > 0,
            'top5' => $top5,
            'bottom5' => $bottom5,
            'personnelCategory' => $personnelCategory,
            'personnelTitle' => $personnelTitle,
            'personnelSubtitle' => $personnelSubtitle,
            'personnelStatus' => $personnelStatus,
            'evaluatorsStatus' => $evaluatorsStatus,
            'lowestParameters' => $lowestParams,
            'periods' => $monthsList,
            'teamLeader' => $tlInfo,
        ]);
    }

    // Roadmap Section 35: Full Parameter Failure Analysis
    public function parameterFailures(Request $request)
    {
        $serviceCode = $request->query('service');
        $query = \Illuminate\Support\Facades\DB::table('ca_assessment_scores as x')
            ->join('ca_parameters as p', 'p.id', '=', 'x.parameter_id')
            ->join('services as s', 's.id', '=', 'p.service_id')
            ->select(
                'p.code',
                'p.name',
                'p.weight as max_score',
                's.code as service_code',
                's.name as service_name',
                \Illuminate\Support\Facades\DB::raw('ROUND(AVG(x.score), 2) as average_score'),
                \Illuminate\Support\Facades\DB::raw('ROUND((AVG(x.score) / NULLIF(p.weight, 0)) * 100, 1) as achievement_pct'),
                \Illuminate\Support\Facades\DB::raw('COUNT(x.id) as total_assessment')
            )
            ->groupBy('p.id', 'p.code', 'p.name', 'p.weight', 's.id', 's.name', 's.code');

        if ($serviceCode && $serviceCode !== 'all') {
            $query->where('s.code', strtoupper($serviceCode));
        }

        $results = $query->orderByRaw('(AVG(x.score) / NULLIF(p.weight, 0)) ASC')->get();

        return response()->json([
            'success' => true,
            'data' => $results
        ]);
    }
}
