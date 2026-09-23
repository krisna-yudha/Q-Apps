<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\MonthlyTrend;
use App\Models\Notification;
use App\Models\TeamLeader;
use App\Models\Trainer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AgentRecapController extends Controller
{
    // View 5: Rekap Rata-Rata Nilai Per Agent
    public function index(Request $request)
    {
        $period = $request->query('period');
        $search = $request->query('search');
        $channel = $request->query('channel');
        $tlId = $request->query('team_leader_id');
        $trainerId = $request->query('trainer_id');
        $sortBy = $request->query('sort_by', 'ca_score');
        $sortOrder = $request->query('sort_order', 'asc');

        $query = Agent::with(['teamLeader', 'trainer']);

        if ($period && $period !== 'all') {
            $query->where('period_month', $period);
        }

        if ($search) {
            $cleanSearch = trim($search);
            $query->where(function ($q) use ($cleanSearch) {
                $q->where('name', 'like', "%{$cleanSearch}%")
                    ->orWhere('nik', 'like', "%{$cleanSearch}%")
                    ->orWhere('channel', 'like', "%{$cleanSearch}%")
                    ->orWhere('status', 'like', "%{$cleanSearch}%")
                    ->orWhereHas('teamLeader', function ($tlQ) use ($cleanSearch) {
                        $tlQ->where('name', 'like', "%{$cleanSearch}%");
                    })
                    ->orWhereHas('trainer', function ($trnQ) use ($cleanSearch) {
                        $trnQ->where('name', 'like', "%{$cleanSearch}%");
                    });

                if (is_numeric($cleanSearch)) {
                    $numVal = (float)$cleanSearch;
                    $q->orWhereBetween('ca_score', [$numVal - 0.5, $numVal + 0.5])
                      ->orWhereBetween('fcr_score', [$numVal - 0.5, $numVal + 0.5]);
                }
            });
        }

        if ($channel && $channel !== 'all') {
            if ($channel === 'Email') {
                $query->where(function ($q) {
                    $q->where('channel', 'Email')->orWhere('channel', 'Email Inbound');
                });
            } elseif ($channel === 'Outbound Call') {
                $query->where(function ($q) {
                    $q->where('channel', 'Outbound Call')->orWhere('channel', 'Outbond Call');
                });
            } else {
                $query->where('channel', $channel);
            }
        }

        if ($tlId) {
            $query->where('team_leader_id', $tlId);
        }

        if ($trainerId) {
            $query->where('trainer_id', $trainerId);
        }

        if ($sortBy === 'name') {
            $query->orderBy('name', $sortOrder);
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        $agents = $query->get();

        // Preload active Master NAKER assignments for instant live resolution
        $employeesWithAssignments = \App\Models\Employee::with(['currentAssignment.teamLeader', 'currentAssignment.trainer'])->get();
        $empByNameMap = [];
        $empBySipMap = [];
        foreach ($employeesWithAssignments as $emp) {
            $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', $emp->name));
            $empByNameMap[$norm] = $emp;
            if ($emp->sip_id) {
                $empBySipMap[strtolower(trim($emp->sip_id))] = $emp;
            }
        }

        $formatted = $agents->map(function ($agent) use ($empByNameMap, $empBySipMap) {
            $tlName = ($agent->teamLeader && !in_array($agent->teamLeader->name, ['TL Umum', 'None', '-']))
                ? $agent->teamLeader->name
                : null;

            $trnName = ($agent->trainer && !in_array($agent->trainer->name, ['TRN Umum', 'None', '-']))
                ? $agent->trainer->name
                : null;

            // Live fallback resolution to Master NAKER if TL or Trainer is not yet assigned
            if (!$tlName || !$trnName) {
                $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', $agent->name));
                $nikKey = strtolower(trim((string)$agent->nik));
                $emp = $empByNameMap[$norm] ?? ($empBySipMap[$nikKey] ?? null);

                if ($emp && $emp->currentAssignment) {
                    if (!$tlName && $emp->currentAssignment->teamLeader && !in_array($emp->currentAssignment->teamLeader->name, ['TL Umum', 'None', '-'])) {
                        $tlName = $emp->currentAssignment->teamLeader->name;
                    }
                    if (!$trnName && $emp->currentAssignment->trainer && !in_array($emp->currentAssignment->trainer->name, ['TRN Umum', 'None', '-'])) {
                        $trnName = $emp->currentAssignment->trainer->name;
                    }
                }
            }

            return [
                'id' => $agent->id,
                'name' => $agent->name,
                'nik' => $agent->nik,
                'ca' => (float)$agent->ca_score,
                'fcr' => (float)$agent->fcr_score,
                'channel' => ($agent->channel === 'Email Inbound') ? 'Email' : ($agent->channel ?? 'Inbound'),
                'period_month' => $agent->period_month ?? '2026-08',
                'tl' => $tlName ?: 'TL Umum',
                'trainer' => $trnName ?: 'TRN Umum',
                'status' => $agent->status,
                'evaluations' => $agent->evaluation_count,
                'source_role' => $agent->source_role ?? 'supervisor',
                'imported_by' => $agent->imported_by ?? 'Supervisor',
                'avatar' => $agent->avatar,
            ];
        });

        // 1. Collect all distinct Team Leaders from active Master NAKER & actual Agent assessments
        $activeTlNames = \App\Models\Employee::where('status', 'active')
            ->where(function ($q) {
                $q->whereHas('currentAssignment.service', function ($sq) {
                    $sq->where('code', 'TEAM_LEADER');
                })->orWhere('sip_id', 'like', 'TL-%');
            })
            ->pluck('name');

        $teamLeaders = TeamLeader::where('is_active', true)
            ->where('name', '!=', 'TL Umum')
            ->where(function ($q) use ($activeTlNames) {
                $q->whereIn('name', $activeTlNames)
                  ->orWhereHas('agents');
            })
            ->orderBy('name')
            ->get()
            ->map(function ($tl) use ($period) {
                $q = Agent::where('team_leader_id', $tl->id);
                if ($period && $period !== 'all') {
                    $q->where('period_month', $period);
                }
                $agentCount = $q->count();
                return [
                    'id' => $tl->id,
                    'name' => $tl->name,
                    'agent_count' => $agentCount,
                ];
            })
            ->filter(function ($tl) {
                return $tl['agent_count'] > 0;
            })
            ->values();

        // 2. Collect all distinct Trainers from active Master NAKER & actual Agent assessments
        $activeTrnNames = \App\Models\Employee::where('status', 'active')
            ->where(function ($q) {
                $q->whereHas('currentAssignment.service', function ($sq) {
                    $sq->where('code', 'TRAINER');
                })->orWhere('sip_id', 'like', 'TRN-%');
            })
            ->pluck('name');

        $trainers = Trainer::where('is_active', true)
            ->where('name', '!=', 'TRN Umum')
            ->where(function ($q) use ($activeTrnNames) {
                $q->whereIn('name', $activeTrnNames)
                  ->orWhereHas('agents');
            })
            ->orderBy('name')
            ->get()
            ->map(function ($trn) use ($period) {
                $q = Agent::where('trainer_id', $trn->id);
                if ($period && $period !== 'all') {
                    $q->where('period_month', $period);
                }
                $agentCount = $q->count();
                return [
                    'id' => $trn->id,
                    'name' => $trn->name,
                    'agent_count' => $agentCount,
                ];
            })
            ->filter(function ($trn) {
                return $trn['agent_count'] > 0;
            })
            ->values();

        // 3. Distinct periods available in agents
        $monthFullNames = [
            '01' => 'Januari', '02' => 'Februari', '03' => 'Maret', '04' => 'April',
            '05' => 'Mei', '06' => 'Juni', '07' => 'Juli', '08' => 'Agustus',
            '09' => 'September', '10' => 'Oktober', '11' => 'November', '12' => 'Desember'
        ];

        $distinctPeriods = Agent::distinct()->orderByDesc('period_month')->pluck('period_month')->filter()->values();
        $periods = $distinctPeriods->map(function ($p) use ($monthFullNames) {
            $parts = explode('-', $p);
            $m = $parts[1] ?? '08';
            $y = $parts[0] ?? '2026';
            return [
                'value' => $p,
                'label' => ($monthFullNames[$m] ?? $m) . ' ' . $y
            ];
        });

        if ($periods->isEmpty()) {
            $periods = collect([
                ['value' => '2026-08', 'label' => 'Agustus 2026']
            ]);
        }

        // 4. Distinct channels dynamically from Agent data
        $channels = Agent::distinct()->pluck('channel')->filter()->values();
        if ($channels->isEmpty()) {
            $channels = collect(['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office']);
        }

        return response()->json([
            'success' => true,
            'period' => $period,
            'periods' => $periods,
            'data' => $formatted,
            'total' => $formatted->count(),
            'teamLeaders' => $teamLeaders,
            'trainers' => $trainers,
            'channels' => $channels,
        ]);
    }

    /**
     * Preview & Audit Redundansi Data Excel (Dry-Run Sebelum Inject) menggunakan QsfImportService
     */
    public function previewExcel(Request $request)
    {
        $rows = $request->input('data', []);
        $channel = $request->input('channel', 'Inbound');
        $fileName = $request->input('file_name', 'Report.xlsx');

        if (empty($rows)) {
            return response()->json([
                'success' => false,
                'message' => 'Data baris Excel kosong atau tidak dapat dibaca.'
            ], 422);
        }

        $importer = new \App\Services\QsfImportService();
        $result = $importer->preview($rows, $channel, $fileName);

        return response()->json($result);
    }

    /**
     * Injeksi Data ke Database Relasional menggunakan QsfImportService
     */
    public function importExcel(Request $request)
    {
        $rows = $request->input('data', []);
        $channel = $request->input('channel', 'Inbound');
        $fileName = $request->input('file_name', 'Report.xlsx');
        $importMode = $request->input('import_mode', 'upsert');

        if (empty($rows)) {
            return response()->json([
                'success' => false,
                'message' => 'Data baris Excel kosong atau format tidak sesuai.'
            ], 422);
        }

        $importer = new \App\Services\QsfImportService();
        $result = $importer->import($rows, $channel, $fileName, $importMode, auth()->id());

        return response()->json($result);
    }

    /**
     * Detail Nilai Parameter untuk 1 Transaksi Assessment Tertentu
     */
    public function assessmentScores($id)
    {
        $assessment = \App\Models\CaAssessment::with([
            'site',
            'service',
            'category',
            'subCategory',
            'platform',
            'agent',
            'qa',
            'scores.parameter'
        ])->find($id);

        if (!$assessment) {
            return response()->json(['success' => false, 'message' => 'Assessment tidak ditemukan'], 404);
        }

        return response()->json([
            'success' => true,
            'assessment' => $assessment,
            'scores' => $assessment->scores->map(function ($s) {
                return [
                    'parameter_code' => $s->parameter ? $s->parameter->code : '-',
                    'parameter_name' => $s->parameter ? $s->parameter->name : '-',
                    'sequence' => $s->parameter ? $s->parameter->sequence : 1,
                    'score' => (float)$s->score,
                    'note' => $s->note
                ];
            })->sortBy('sequence')->values()
        ]);
    }

    /**
     * Daftar Parameter Master Berdasarkan Service
     */
    public function getServicesParameters(Request $request)
    {
        $serviceCode = $request->query('service');
        $query = \App\Models\Service::with(['parameters' => function ($q) {
            $q->orderBy('sequence');
        }]);

        if ($serviceCode && $serviceCode !== 'all') {
            $query->where('code', strtoupper($serviceCode));
        }

        $services = $query->get();

        return response()->json([
            'success' => true,
            'data' => $services
        ]);
    }

    /**
     * Input Manual Satu Per Satu dari Supervisor
     */
    public function storeManual(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'nik' => 'required|string|max:100',
            'ca_score' => 'required|numeric|min:0|max:100',
            'fcr_score' => 'nullable|numeric|min:0|max:100',
            'fcr' => 'nullable|string', // 'YA' | 'TIDAK'
            'channel' => 'required|string',
            'team_leader_name' => 'nullable|string',
            'trainer_name' => 'nullable|string',
            'evaluation_count' => 'nullable|integer|min:1',
            'is_bad_rating' => 'nullable|boolean',
            'csat_rating' => 'nullable|integer|min:1|max:5',
            'bad_rating_reason' => 'nullable|string|max:255',
            'ticket_id' => 'nullable|string|max:150',
            'summary' => 'nullable|string',
            'recommendation' => 'nullable|string',
            'qa_name' => 'nullable|string',
        ]);

        $tlName = $request->input('team_leader_name') ?: 'TL Umum';
        $trnName = $request->input('trainer_name') ?: 'TRN Umum';
        $periodMonth = $request->input('period_month', '2026-08');

        $tl = TeamLeader::firstOrCreate(
            ['name' => trim((string)$tlName)],
            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
        );

        $trn = Trainer::firstOrCreate(
            ['name' => trim((string)$trnName)],
            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
        );

        $ca = floatval($request->ca_score);
        $fcr = $request->input('fcr_score') !== null ? floatval($request->fcr_score) : ($request->input('fcr') === 'YA' ? 100.0 : 0.0);
        $fcrString = $request->input('fcr') ?: ($fcr >= 100 ? 'YA' : 'TIDAK');
        $isBadRating = $request->boolean('is_bad_rating', false);
        $csatRating = $request->input('csat_rating') ? (int)$request->input('csat_rating') : null;
        $badRatingReason = $request->input('bad_rating_reason');

        $status = 'Meet Target';
        if ($ca >= 96) {
            $status = 'Exceed Target';
        } elseif ($ca < 85) {
            $status = 'Need Coaching';
        }

        $agent = Agent::updateOrCreate(
            ['nik' => trim($request->nik)],
            [
                'name' => trim($request->name),
                'ca_score' => $ca,
                'fcr_score' => $fcr,
                'channel' => $request->channel,
                'period_month' => $periodMonth,
                'team_leader_id' => $tl->id,
                'trainer_id' => $trn->id,
                'status' => $status,
                'evaluation_count' => intval($request->evaluation_count) ?: 1,
                'source_role' => 'supervisor',
                'imported_by' => $request->input('imported_by', 'Supervisor'),
            ]
        );

        // Find or create canonical Service
        $service = \App\Services\QsfImportService::detectService($request->channel);
        $site = \App\Models\Site::where('code', 'SMG')->first();
        $employee = \App\Models\Employee::where('sip_id', $agent->nik)->orWhere('name', $agent->name)->first();

        // Also inject into ca_assessments for deep dashboard & parameter linkage
        $ticketId = $request->input('ticket_id') ?: ('M-MANUAL-' . strtoupper(Str::random(8)));
        $idca = 'IDCA-' . strtoupper(Str::random(8));

        \App\Models\CaAssessment::create([
            'idca' => $idca,
            'ticket_id' => $ticketId,
            'agent_id' => $agent->id,
            'agent_name' => $agent->name,
            'employee_id' => $employee?->id,
            'service_id' => $service->id,
            'site_id' => $site?->id,
            'source_ca' => $service->name,
            'source_layanan' => $service->name,
            'score_ca' => $ca,
            'fcr' => $fcrString,
            'fcr_note' => $request->input('fcr_note'),
            'is_bad_rating' => $isBadRating,
            'csat_rating' => $csatRating,
            'bad_rating_reason' => $badRatingReason,
            'summary' => $request->input('summary'),
            'recommendation' => $request->input('recommendation'),
            'qa_name' => $request->input('qa_name', $request->user()?->name ?: 'Supervisor'),
            'transaction_at' => $request->input('transaction_at') ?: now(),
            'measurement_at' => $request->input('measurement_at') ?: now(),
            'source' => 'MANUAL_INPUT',
            'source_system' => 'MANUAL'
        ]);

        // Recalculate Monthly Trend for the month
        $monthNum = (int)date('n', strtotime($periodMonth . '-01'));
        $avgCA = Agent::where('period_month', $periodMonth)->avg('ca_score') ?: $ca;
        $avgFCR = Agent::where('period_month', $periodMonth)->avg('fcr_score') ?: $fcr;
        $totalCalls = Agent::where('period_month', $periodMonth)->sum('evaluation_count') ?: 1;

        MonthlyTrend::where('month_num', $monthNum)->update([
            'ca_score' => round($avgCA, 1),
            'fcr_score' => round($avgFCR, 1),
            'total_calls' => $totalCalls,
        ]);

        \App\Services\NotificationService::send([
            'title'      => 'Input Manual Evaluasi Disimpan',
            'message'    => "Penilaian CA ({$ca}%) & FCR ({$fcrString})" . ($isBadRating ? " [BAD RATING CSAT {$csatRating}]" : "") . " untuk agen {$agent->name} berhasil disimpan.",
            'type'       => 'system',
            'action_url' => '/rekap-agent',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Data evaluasi agen {$agent->name} berhasil disimpan!",
            'data' => $agent
        ]);
    }

    /**
     * Get 7 Channel QSF Summary Cards
     */
    public function getChannelSummary(Request $request)
    {
        $period = $request->query('period');
        $channels = ['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office'];
        $summary = [];

        foreach ($channels as $ch) {
            // 1. Service resolution
            $serviceIds = \App\Models\Service::where(function ($q) use ($ch) {
                $q->where('name', $ch);
                if ($ch === 'Email') {
                    $q->orWhereIn('name', ['Email Inbound', 'Email_Inbound']);
                } elseif ($ch === 'Email Outbound') {
                    $q->orWhereIn('name', ['Email_Outbound', 'Outbound Reguler']);
                } elseif ($ch === 'Outbound Call') {
                    $q->orWhereIn('name', ['Outbond Call', 'Outbound Reguler']);
                } elseif ($ch === 'Back Office') {
                    $q->orWhereIn('name', ['Ketepatan Eskalasi BO', 'Backoffice', 'Back Office']);
                }
            })->pluck('id');

            // 2. Agents query
            $agentsQ = Agent::where(function ($q) use ($ch) {
                $q->where('channel', $ch);
                if ($ch === 'Email') {
                    $q->orWhereIn('channel', ['Email Inbound', 'Email_Inbound']);
                } elseif ($ch === 'Email Outbound') {
                    $q->orWhereIn('channel', ['Email_Outbound', 'Outbound Reguler']);
                } elseif ($ch === 'Outbound Call') {
                    $q->orWhereIn('channel', ['Outbond Call', 'Outbound Reguler']);
                } elseif ($ch === 'Back Office') {
                    $q->orWhereIn('channel', ['Ketepatan Eskalasi BO', 'Back Office']);
                }
            });

            if ($period && $period !== 'all') {
                $agentsQ->where('period_month', $period);
            }

            $agents = $agentsQ->get();
            $agentCount = $agents->count();

            // 3. Assessments query
            $assessmentsQ = \App\Models\CaAssessment::whereIn('service_id', $serviceIds);
            if ($period && $period !== 'all') {
                $assessmentsQ->where(function ($q) use ($period) {
                    $q->whereRaw("LEFT(COALESCE(measurement_at, transaction_at), 7) = ?", [$period]);
                });
            }

            $assessmentCount = (clone $assessmentsQ)->count();
            $distinctAssessAgents = (clone $assessmentsQ)->distinct('agent_id')->whereNotNull('agent_id')->count('agent_id');

            $finalCount = max($agentCount, $distinctAssessAgents);
            $avgCa = $assessmentCount > 0 
                ? round((float)$assessmentsQ->avg('score_ca'), 1) 
                : ($agentCount > 0 ? round((float)$agents->avg('ca_score'), 1) : 0.0);
            $avgFcr = $agentCount > 0 ? round((float)$agents->avg('fcr_score'), 1) : 0.0;
            $totalEvals = max($assessmentCount, (int)$agents->sum('evaluation_count'));

            $hasData = ($finalCount > 0 || $assessmentCount > 0);

            $summary[] = [
                'channel' => $ch,
                'agent_count' => $finalCount,
                'assessment_count' => $assessmentCount,
                'avg_ca' => $avgCa,
                'avg_fcr' => $avgFcr,
                'total_evaluations' => $totalEvals,
                'has_data' => $hasData,
                'status' => $hasData ? 'Tersedia' : 'Belum Ada Data'
            ];
        }

        $totalAgentsQuery = Agent::query();
        if ($period && $period !== 'all') {
            $totalAgentsQuery->where('period_month', $period);
        }

        return response()->json([
            'success' => true,
            'period' => $period ?: 'all',
            'total_all_agents' => $totalAgentsQuery->count(),
            'channels' => $summary
        ]);
    }

    // Clear agent & assessment data (Contextual & Mass Wipe Support)
    public function clearData(Request $request)
    {
        $target = $request->input('target', 'all'); // 'channel', 'all_assessments', 'naker', 'sampling', 'all_system'
        $channel = $request->input('channel'); // e.g. 'Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office', 'NAKER'
        $period = $request->input('period'); // optional period filter (YYYY-MM)

        \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        try {
            if ($target === 'channel' || ($target === 'current_channel' && $channel)) {
                if (strtoupper((string)$channel) === 'NAKER') {
                    // Clear NAKER Master Data
                    \App\Models\EmployeeAssignment::truncate();
                    \App\Models\Employee::truncate();
                    // Clean up non-supervisor/admin accounts created from naker
                    \App\Models\User::whereNotIn('role', ['supervisor', 'admin', 'superadmin'])->delete();
                    $message = 'Seluruh data Master NAKER dan relasi penugasan berhasil dikosongkan.';
                } else {
                    // Resolve service IDs for this channel
                    $serviceQuery = \App\Models\Service::query();
                    if ($channel === 'Email' || $channel === 'Email Inbound') {
                        $serviceQuery->whereIn('name', ['Email', 'Email Inbound', 'Email_Inbound']);
                    } elseif ($channel === 'Email Outbound') {
                        $serviceQuery->whereIn('name', ['Email Outbound', 'Email Outbond', 'Email_Outbound']);
                    } elseif ($channel === 'Outbound Call') {
                        $serviceQuery->whereIn('name', ['Outbound Call', 'Outbond Call', 'Outbound']);
                    } elseif ($channel === 'Back Office') {
                        $serviceQuery->whereIn('name', ['Back Office', 'BackOffice', 'Ketepatan Eskalasi BO']);
                    } else {
                        $serviceQuery->where('name', $channel)->orWhere('code', strtoupper($channel));
                    }
                    $serviceIds = $serviceQuery->pluck('id')->toArray();

                    // Find assessments for this channel
                    $assessmentQuery = \App\Models\CaAssessment::query();
                    if (!empty($serviceIds)) {
                        $assessmentQuery->where(function($q) use ($serviceIds, $channel) {
                            $q->whereIn('service_id', $serviceIds)
                              ->orWhere('source_layanan', $channel)
                              ->orWhere('source_file', 'like', "%{$channel}%");
                        });
                    } else {
                        $assessmentQuery->where('source_layanan', $channel)
                                        ->orWhere('source_file', 'like', "%{$channel}%");
                    }

                    if ($period && $period !== 'all') {
                        $assessmentQuery->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), $period);
                    }

                    $assessmentIds = $assessmentQuery->pluck('id')->toArray();

                    if (!empty($assessmentIds)) {
                        \App\Models\CaAssessmentScore::whereIn('assessment_id', $assessmentIds)->delete();
                        \App\Models\CaAssessment::whereIn('id', $assessmentIds)->delete();
                    }

                    // Delete agents matching channel
                    $agentQuery = \App\Models\Agent::query();
                    if ($channel === 'Email' || $channel === 'Email Inbound') {
                        $agentQuery->whereIn('channel', ['Email', 'Email Inbound']);
                    } elseif ($channel === 'Email Outbound') {
                        $agentQuery->whereIn('channel', ['Email Outbound', 'Email Outbond']);
                    } elseif ($channel === 'Outbound Call') {
                        $agentQuery->whereIn('channel', ['Outbound Call', 'Outbond Call', 'Outbound']);
                    } else {
                        $agentQuery->where('channel', $channel);
                    }
                    if ($period && $period !== 'all') {
                        $agentQuery->where('period_month', $period);
                    }
                    $agentQuery->delete();

                    // Delete SipImport matching channel
                    \App\Models\SipImport::where('channel', $channel)->orWhere('file_name', 'like', "%{$channel}%")->delete();

                    $message = "Seluruh data penilaian untuk saluran [{$channel}] berhasil dikosongkan.";
                }
            } elseif ($target === 'naker') {
                \App\Models\EmployeeAssignment::truncate();
                \App\Models\Employee::truncate();
                \App\Models\User::whereNotIn('role', ['supervisor', 'admin', 'superadmin'])->delete();
                $message = 'Seluruh data Master NAKER dan akun yang diinjeksi berhasil dikosongkan.';
            } elseif ($target === 'sampling') {
                \App\Models\SamplingAssignment::truncate();
                \App\Models\SamplingTargetCso::truncate();
                \App\Models\SamplingTarget::truncate();
                \App\Models\SamplingQaAttendance::truncate();
                \App\Models\SamplingQuotaRequest::truncate();
                \App\Models\SamplingReassignmentLog::truncate();
                $message = 'Seluruh data antrean, target sampling, dan kehadiran QA berhasil dikosongkan.';
            } elseif ($target === 'all_assessments') {
                if (\Illuminate\Support\Facades\Schema::hasTable('assessment_histories')) {
                    \App\Models\AssessmentHistory::truncate();
                }
                if (\Illuminate\Support\Facades\Schema::hasTable('sip_import_rows')) {
                    \App\Models\SipImportRow::truncate();
                }
                \App\Models\SipImport::truncate();
                \App\Models\CaAssessmentScore::truncate();
                \App\Models\CaAssessment::truncate();
                \App\Models\Agent::truncate();
                \App\Models\EvaluatorSampling::truncate();

                \App\Models\MonthlyTrend::query()->update([
                    'ca_score' => 0,
                    'fcr_score' => 0,
                    'total_calls' => 0,
                ]);
                $message = 'Seluruh data asesmen penilaian (7 Saluran) dan rekap agen berhasil dikosongkan.';
            } else {
                // 'all_system' / 'all' - Full Factory Reset
                if (\Illuminate\Support\Facades\Schema::hasTable('assessment_histories')) {
                    \App\Models\AssessmentHistory::truncate();
                }
                if (\Illuminate\Support\Facades\Schema::hasTable('sip_import_rows')) {
                    \App\Models\SipImportRow::truncate();
                }
                \App\Models\SipImport::truncate();
                \App\Models\CaAssessmentScore::truncate();
                \App\Models\CaAssessment::truncate();
                \App\Models\Agent::truncate();
                \App\Models\EmployeeAssignment::truncate();
                \App\Models\Employee::truncate();
                \App\Models\EvaluatorSampling::truncate();
                \App\Models\SamplingAssignment::truncate();
                \App\Models\SamplingTargetCso::truncate();
                \App\Models\SamplingTarget::truncate();
                \App\Models\SamplingQaAttendance::truncate();
                \App\Models\SamplingQuotaRequest::truncate();
                \App\Models\SamplingReassignmentLog::truncate();

                \App\Models\MonthlyTrend::query()->update([
                    'ca_score' => 0,
                    'fcr_score' => 0,
                    'total_calls' => 0,
                ]);

                // Clean non-admin users
                \App\Models\User::whereNotIn('role', ['supervisor', 'admin', 'superadmin'])->delete();

                $message = 'Seluruh data sistem (Asesmen, Master NAKER, Akun Personel, & Sampling) berhasil dikosongkan sepenuhnya.';
            }

            \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            \App\Services\NotificationService::send([
                'title'       => 'Pengosongan Data Berhasil',
                'message'     => $message,
                'type'        => 'system',
                'action_url'  => '/settings',
                'target_role' => 'supervisor',
            ]);

            return response()->json([
                'success' => true,
                'target'  => $target,
                'channel' => $channel,
                'message' => $message,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengosongkan data: ' . $e->getMessage(),
            ], 500);
        }
    }
}

