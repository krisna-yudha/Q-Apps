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
        $period = $request->query('period', '2026-08');
        $search = $request->query('search');
        $channel = $request->query('channel');
        $tlId = $request->query('team_leader_id');
        $trainerId = $request->query('trainer_id');
        $sortBy = $request->query('sort_by', 'ca_score');
        $sortOrder = $request->query('sort_order', 'desc');

        $query = Agent::with(['teamLeader', 'trainer']);

        if ($period && $period !== 'all') {
            $query->where('period_month', $period);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nik', 'like', "%{$search}%")
                    ->orWhereHas('teamLeader', function ($tlQ) use ($search) {
                        $tlQ->where('name', 'like', "%{$search}%");
                    });
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

        $formatted = $agents->map(function ($agent) {
            $tlName = ($agent->teamLeader && $agent->teamLeader->name !== 'TL Umum')
                ? $agent->teamLeader->name
                : null;

            $trnName = ($agent->trainer && $agent->trainer->name !== 'TRN Umum')
                ? $agent->trainer->name
                : null;

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

        // Collect all distinct Team Leaders & Trainers
        $teamLeaders = TeamLeader::where('is_active', true)
            ->where('name', '!=', 'TL Umum')
            ->orderBy('name')
            ->get(['id', 'name']);

        $trainers = Trainer::where('is_active', true)
            ->where('name', '!=', 'TRN Umum')
            ->orderBy('name')
            ->get(['id', 'name']);

        // Distinct periods available in agents
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

        return response()->json([
            'success' => true,
            'period' => $period,
            'periods' => $periods,
            'data' => $formatted,
            'total' => $formatted->count(),
            'teamLeaders' => $teamLeaders,
            'trainers' => $trainers,
            'channels' => ['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office']
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
            'fcr_score' => 'required|numeric|min:0|max:100',
            'channel' => 'required|string',
            'team_leader_name' => 'nullable|string',
            'trainer_name' => 'nullable|string',
            'evaluation_count' => 'nullable|integer|min:1',
        ]);

        $tlName = $request->input('team_leader_name') ?: 'TL Umum';
        $trnName = $request->input('trainer_name') ?: 'TRN Umum';

        $tl = TeamLeader::firstOrCreate(
            ['name' => trim((string)$tlName)],
            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
        );

        $trn = Trainer::firstOrCreate(
            ['name' => trim((string)$trnName)],
            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
        );

        $ca = floatval($request->ca_score);
        $fcr = floatval($request->fcr_score);
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
                'period_month' => $request->input('period_month', '2026-08'),
                'team_leader_id' => $tl->id,
                'trainer_id' => $trn->id,
                'status' => $status,
                'evaluation_count' => intval($request->evaluation_count) ?: 40,
                'source_role' => 'supervisor',
                'imported_by' => $request->input('imported_by', 'Supervisor'),
            ]
        );

        // Recalculate Monthly Trend
        $avgCA = Agent::avg('ca_score') ?: 0;
        $avgFCR = Agent::avg('fcr_score') ?: 0;
        $totalCalls = Agent::sum('evaluation_count') ?: 0;

        MonthlyTrend::where('month_num', 8)->update([
            'ca_score' => round($avgCA, 1),
            'fcr_score' => round($avgFCR, 1),
            'total_calls' => $totalCalls,
        ]);

        \App\Services\NotificationService::send([
            'title'      => 'Input Manual Supervisor Disimpan',
            'message'    => "Data evaluasi agen {$agent->name} ({$agent->channel}) berhasil disimpan oleh Supervisor.",
            'type'       => 'system',
            'action_url' => '/rekap-agent',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Data agen {$agent->name} berhasil disimpan ke database!",
            'data' => $agent
        ]);
    }

    /**
     * Get 7 Channel QSF Summary Cards
     */
    public function getChannelSummary(Request $request)
    {
        $period = $request->query('period', '2026-08');
        $channels = ['Inbound', 'Digilive', 'Socmed', 'Email', 'Email Outbound', 'Outbound Call', 'Back Office'];
        $summary = [];

        $baseAgent = Agent::query();
        if ($period && $period !== 'all') {
            $baseAgent->where('period_month', $period);
        }

        foreach ($channels as $ch) {
            $agentsQ = (clone $baseAgent)->where(function ($q) use ($ch) {
                $q->where('channel', $ch);
                if ($ch === 'Email') {
                    $q->orWhere('channel', 'Email Inbound');
                } elseif ($ch === 'Outbound Call') {
                    $q->orWhere('channel', 'Outbond Call');
                }
            });

            $agents = $agentsQ->get();
            $count = $agents->count();
            $ca = $count > 0 ? round((float)$agents->avg('ca_score'), 1) : 0.0;
            $fcr = $count > 0 ? round((float)$agents->avg('fcr_score'), 1) : 0.0;
            $evals = $count > 0 ? (int)$agents->sum('evaluation_count') : 0;

            $summary[] = [
                'channel' => $ch,
                'agent_count' => $count,
                'avg_ca' => $ca,
                'avg_fcr' => $fcr,
                'total_evaluations' => $evals,
                'has_data' => $count > 0,
                'status' => $count > 0 ? 'Tersedia' : 'Belum Ada Data'
            ];
        }

        return response()->json([
            'success' => true,
            'period' => $period,
            'total_all_agents' => (clone $baseAgent)->count(),
            'channels' => $summary
        ]);
    }

    // Clear all agent & assessment data
    public function clearData()
    {
        \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        \App\Models\AssessmentHistory::truncate();
        \App\Models\SipImportRow::truncate();
        \App\Models\SipImport::truncate();
        \App\Models\CaAssessmentScore::truncate();
        \App\Models\CaAssessment::truncate();
        Agent::truncate();
        \Illuminate\Support\Facades\DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        
        MonthlyTrend::where('month_num', 8)->update([
            'ca_score' => 0,
            'fcr_score' => 0,
            'total_calls' => 0,
        ]);

        \App\Services\NotificationService::send([
            'title'      => 'Reset Data Agen Selesai',
            'message'    => 'Seluruh data rekapitulasi nilai agen dan transaksi assessment telah dikosongkan.',
            'type'       => 'system',
            'action_url' => '/rekap-agent',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Seluruh data agent dan transaksi assessment berhasil dikosongkan.'
        ]);
    }
}

