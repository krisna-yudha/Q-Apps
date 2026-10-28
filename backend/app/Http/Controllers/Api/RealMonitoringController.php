<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\Employee;
use App\Models\RealMonitoring;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RealMonitoringController extends Controller
{
    /**
     * Resolve authenticated user from Sanctum token, session, or request header
     */
    protected function getAuthUser(Request $request)
    {
        $user = auth('sanctum')->user() ?: Auth::user();
        if (!$user && $request->filled('current_user_id')) {
            $user = User::find($request->input('current_user_id'));
        }
        if (!$user && $request->header('X-User-Id')) {
            $user = User::find($request->header('X-User-Id'));
        }
        return $user;
    }

    /**
     * List Real Monitoring records with filtering & search
     * RBAC: Supervisor/Admin can view all records globally. QA can ONLY view their own inputs.
     * GET /api/real-monitoring
     */
    public function index(Request $request)
    {
        $user = $this->getAuthUser($request);
        $role = strtolower($user?->role ?? '');
        $isSupervisor = in_array($role, ['supervisor', 'admin', 'superadmin']);
        $isQA = in_array($role, ['quality_assurance', 'qa']);

        $query = RealMonitoring::with(['agent', 'qaUser'])
            ->orderBy('monitoring_date', 'desc')
            ->orderBy('id', 'desc');

        // RBAC Access Control:
        // QA Evaluator HANYA dapat melihat riwayat observasi yang diinputnya sendiri.
        // Supervisor / Admin dapat memonitoring global seluruh QA.
        if ($isQA && $user) {
            $query->where(function ($q) use ($user) {
                if ($user->id) {
                    $q->where('qa_user_id', $user->id);
                }
                if ($user->name) {
                    $q->orWhere('qa_name', $user->name);
                }
            });
        } elseif (!$isSupervisor && $user) {
            $query->where(function ($q) use ($user) {
                if ($user->id) {
                    $q->where('qa_user_id', $user->id);
                }
                if ($user->name) {
                    $q->orWhere('qa_name', $user->name);
                }
            });
        }

        // Date filters
        if ($request->filled('date')) {
            $query->whereDate('monitoring_date', $request->input('date'));
        } elseif ($request->filled('date_from') && $request->filled('date_to')) {
            $query->whereBetween('monitoring_date', [
                $request->input('date_from'),
                $request->input('date_to')
            ]);
        }

        // Channel / Layanan filter
        if ($request->filled('layanan') && $request->input('layanan') !== 'ALL') {
            $query->where('layanan', $request->input('layanan'));
        }

        // QA Evaluator filter
        if ($request->filled('qa_name') && $request->input('qa_name') !== 'ALL') {
            $query->where('qa_name', $request->input('qa_name'));
        }

        // Agent Name filter
        if ($request->filled('agent_name')) {
            $query->where('nama_agent', 'like', '%' . $request->input('agent_name') . '%');
        }

        // General search (no_icrm, no_transaksi, no_omni, no_ichat, nama_agent, notes)
        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('no_icrm', 'like', "%{$s}%")
                  ->orWhere('no_transaksi', 'like', "%{$s}%")
                  ->orWhere('no_omni', 'like', "%{$s}%")
                  ->orWhere('no_ichat', 'like', "%{$s}%")
                  ->orWhere('nama_agent', 'like', "%{$s}%")
                  ->orWhere('qa_name', 'like', "%{$s}%")
                  ->orWhere('notes', 'like', "%{$s}%");
            });
        }

        $perPage = (int)$request->input('per_page', 25);
        $records = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $records->items(),
            'current_page' => $records->currentPage(),
            'last_page' => $records->lastPage(),
            'per_page' => $records->perPage(),
            'total' => $records->total(),
        ]);
    }

    /**
     * Store a new Real Monitoring observation (QA on-duty direct observation)
     * POST /api/real-monitoring
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'no_icrm' => 'required|string|max:100',
            'nama_agent' => 'required|string|max:150',
            'layanan' => 'required|string|max:50',
            'no_transaksi' => 'nullable|string|max:100',
            'no_omni' => 'nullable|string|max:100',
            'no_ichat' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'monitoring_date' => 'nullable|date',
            'monitoring_time' => 'nullable|string',
        ]);

        $noIcrm = trim($validated['no_icrm']);
        $namaAgent = trim($validated['nama_agent']);
        $layanan = trim($validated['layanan']);
        $noTransaksi = !empty($validated['no_transaksi']) ? trim($validated['no_transaksi']) : null;
        $noOmni = !empty($validated['no_omni']) ? trim($validated['no_omni']) : null;
        $noIchat = !empty($validated['no_ichat']) ? trim($validated['no_ichat']) : null;
        $notes = !empty($validated['notes']) ? trim($validated['notes']) : null;
        $monitoringDate = $validated['monitoring_date'] ?? now()->format('Y-m-d');
        $monitoringTime = $validated['monitoring_time'] ?? now()->format('H:i:s');

        // Resolve QA user
        $user = $this->getAuthUser($request);
        $qaUserId = $user?->id;
        $qaName = $user?->name ?: ($request->input('qa_name') ?: 'QA Evaluator');

        // Resolve Agent ID from Employee or Agent tables
        $cleanSearchName = trim(preg_replace('/^SMG\s+/i', '', $namaAgent));
        $agent = Agent::where('name', $namaAgent)
            ->orWhere('name', $cleanSearchName)
            ->orWhere('name', 'like', "%{$cleanSearchName}%")
            ->first();

        // Check duplicate on same date and no_icrm / no_transaksi
        $existing = RealMonitoring::where('no_icrm', $noIcrm)
            ->whereDate('monitoring_date', $monitoringDate)
            ->first();

        if ($existing) {
            $existing->update([
                'nama_agent' => $namaAgent,
                'agent_id' => $agent?->id ?: $existing->agent_id,
                'layanan' => $layanan,
                'no_transaksi' => $noTransaksi ?: $existing->no_transaksi,
                'no_omni' => $noOmni ?: $existing->no_omni,
                'no_ichat' => $noIchat ?: $existing->no_ichat,
                'notes' => $notes ?: $existing->notes,
                'qa_user_id' => $qaUserId ?: $existing->qa_user_id,
                'qa_name' => $qaName ?: $existing->qa_name,
                'monitoring_time' => $monitoringTime,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pencatatan Real Monitoring berhasil diperbarui.',
                'data' => $existing,
                'is_update' => true,
            ]);
        }

        $record = RealMonitoring::create([
            'no_icrm' => $noIcrm,
            'no_transaksi' => $noTransaksi,
            'no_omni' => $noOmni,
            'no_ichat' => $noIchat,
            'nama_agent' => $namaAgent,
            'agent_id' => $agent?->id,
            'layanan' => $layanan,
            'qa_user_id' => $qaUserId,
            'qa_name' => $qaName,
            'monitoring_date' => $monitoringDate,
            'monitoring_time' => $monitoringTime,
            'notes' => $notes,
            'status' => 'RECORDED',
            'is_eliminated' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pencatatan Real Monitoring berhasil disimpan.',
            'data' => $record,
            'is_update' => false,
        ], 201);
    }

    /**
     * Show single record
     * GET /api/real-monitoring/{id}
     */
    public function show($id)
    {
        $record = RealMonitoring::with(['agent', 'qaUser'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $record,
        ]);
    }

    /**
     * Update record
     * PUT /api/real-monitoring/{id}
     */
    public function update(Request $request, $id)
    {
        $record = RealMonitoring::findOrFail($id);

        $validated = $request->validate([
            'no_icrm' => 'required|string|max:100',
            'nama_agent' => 'required|string|max:150',
            'layanan' => 'required|string|max:50',
            'no_transaksi' => 'nullable|string|max:100',
            'no_omni' => 'nullable|string|max:100',
            'no_ichat' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'monitoring_date' => 'nullable|date',
            'monitoring_time' => 'nullable|string',
        ]);

        $record->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Pencatatan Real Monitoring berhasil diperbarui.',
            'data' => $record,
        ]);
    }

    /**
     * Delete record (Supervisor or Admin only)
     * DELETE /api/real-monitoring/{id}
     */
    public function destroy(Request $request, $id)
    {
        $user = $this->getAuthUser($request);
        $role = strtolower($user?->role ?? '');
        $isSupervisor = in_array($role, ['supervisor', 'admin', 'superadmin']);

        if (!$isSupervisor) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Supervisor yang berwenang menghapus rekaman Real Monitoring.',
            ], 403);
        }

        $record = RealMonitoring::findOrFail($id);
        $record->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pencatatan Real Monitoring berhasil dihapus.',
        ]);
    }

    /**
     * KPI Statistics for Real Monitoring
     * RBAC: SPV gets global team stats. QA gets their own observation stats.
     * GET /api/real-monitoring/stats
     */
    public function stats(Request $request)
    {
        $user = $this->getAuthUser($request);
        $role = strtolower($user?->role ?? '');
        $isSupervisor = in_array($role, ['supervisor', 'admin', 'superadmin']);
        $isQA = in_array($role, ['quality_assurance', 'qa']);

        $baseQuery = RealMonitoring::query();
        if ($isQA && $user) {
            $baseQuery->where(function ($q) use ($user) {
                if ($user->id) {
                    $q->where('qa_user_id', $user->id);
                }
                if ($user->name) {
                    $q->orWhere('qa_name', $user->name);
                }
            });
        } elseif (!$isSupervisor && $user) {
            $baseQuery->where('qa_user_id', $user->id);
        }

        $today = now()->format('Y-m-d');
        $yesterday = now()->subDay()->format('Y-m-d');
        $currentMonth = now()->format('Y-m');

        $totalToday = (clone $baseQuery)->whereDate('monitoring_date', $today)->count();
        $totalYesterday = (clone $baseQuery)->whereDate('monitoring_date', $yesterday)->count();
        $totalMonth = (clone $baseQuery)->where('monitoring_date', 'like', "{$currentMonth}%")->count();
        $totalEliminated = (clone $baseQuery)->where('is_eliminated', true)->count();

        // Breakdown by channel this month
        $byChannel = (clone $baseQuery)->where('monitoring_date', 'like', "{$currentMonth}%")
            ->select('layanan', DB::raw('count(*) as total'))
            ->groupBy('layanan')
            ->pluck('total', 'layanan')
            ->toArray();

        // Breakdown by QA this month & today (Global only for supervisor, individual for QA)
        $byQaQuery = RealMonitoring::query();
        if ($isQA && $user) {
            $byQaQuery->where(function ($q) use ($user) {
                if ($user->id) $q->where('qa_user_id', $user->id);
                if ($user->name) $q->orWhere('qa_name', $user->name);
            });
        }
        $byQa = (clone $byQaQuery)->where('monitoring_date', 'like', "{$currentMonth}%")
            ->select('qa_name', DB::raw('count(*) as total'))
            ->groupBy('qa_name')
            ->pluck('total', 'qa_name')
            ->toArray();

        $byQaToday = (clone $byQaQuery)->whereDate('monitoring_date', $today)
            ->select('qa_name', DB::raw('count(*) as total'))
            ->groupBy('qa_name')
            ->pluck('total', 'qa_name')
            ->toArray();

        return response()->json([
            'success' => true,
            'stats' => [
                'total_today' => $totalToday,
                'total_yesterday' => $totalYesterday,
                'total_month' => $totalMonth,
                'total_eliminated' => $totalEliminated,
                'by_channel' => $byChannel,
                'by_qa' => $byQa,
                'by_qa_today' => $byQaToday,
            ]
        ]);
    }

    /**
     * Active Agents for Autocomplete / Select Dropdown
     * GET /api/real-monitoring/active-agents
     */
    public function activeAgents(Request $request)
    {
        $agents = Agent::select('id', 'name', 'nik', 'channel')
            ->whereNotIn('name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])
            ->orderBy('name', 'asc')
            ->get();

        if ($agents->isEmpty()) {
            $agents = Employee::select('id', 'name', 'sip_id as nik', 'role as channel')
                ->where('is_active', true)
                ->orderBy('name', 'asc')
                ->get();
        }

        return response()->json([
            'success' => true,
            'agents' => $agents,
        ]);
    }

    /**
     * Keys for Ticket Elimination Engine in Auto Distribution
     * Returns arrays of no_transaksi, no_icrm, no_omni, no_ichat
     * GET /api/real-monitoring/elimination-keys
     */
    public function eliminationKeys(Request $request)
    {
        $scope = $request->input('scope', 'all'); // 'yesterday', 'recent', 'all'
        $query = RealMonitoring::query();

        if ($scope === 'yesterday') {
            $yesterday = now()->subDay()->format('Y-m-d');
            $query->whereDate('monitoring_date', $yesterday);
        } elseif ($scope === 'recent') {
            // Last 7 days
            $query->where('monitoring_date', '>=', now()->subDays(7)->format('Y-m-d'));
        }

        $records = $query->select('no_icrm', 'no_transaksi', 'no_omni', 'no_ichat', 'nama_agent', 'layanan', 'monitoring_date')
            ->get();

        $transaksiKeys = [];
        $icrmKeys = [];
        $omniKeys = [];
        $ichatKeys = [];

        foreach ($records as $r) {
            if (!empty($r->no_transaksi)) {
                $tx = strtoupper(trim($r->no_transaksi));
                $transaksiKeys[$tx] = true;
                $cleanTx = preg_replace('/[^A-Z0-9]/', '', $tx);
                if ($cleanTx) $transaksiKeys[$cleanTx] = true;
            }

            if (!empty($r->no_icrm)) {
                $icrm = strtoupper(trim($r->no_icrm));
                $icrmKeys[$icrm] = true;
                $cleanIcrm = preg_replace('/[^A-Z0-9]/', '', $icrm);
                if ($cleanIcrm) $icrmKeys[$cleanIcrm] = true;
            }

            if (!empty($r->no_omni)) {
                $omni = strtoupper(trim($r->no_omni));
                $omniKeys[$omni] = true;
            }

            if (!empty($r->no_ichat)) {
                $ichat = strtoupper(trim($r->no_ichat));
                $ichatKeys[$ichat] = true;
            }
        }

        return response()->json([
            'success' => true,
            'total_real_monit' => $records->count(),
            'keys' => [
                'transaksi' => array_keys($transaksiKeys),
                'icrm' => array_keys($icrmKeys),
                'omni' => array_keys($omniKeys),
                'ichat' => array_keys($ichatKeys),
                'transaction_numbers' => array_keys($transaksiKeys),
                'icrm_ticket_ids' => array_keys($icrmKeys),
                'omni_ticket_ids' => array_keys($omniKeys),
                'ichat_ticket_ids' => array_keys($ichatKeys),
            ],
            'records' => $records,
        ]);
    }
}
