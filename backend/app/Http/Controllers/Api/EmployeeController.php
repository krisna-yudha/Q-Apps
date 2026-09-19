<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\Service;
use App\Models\Site;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    /**
     * Get Daftar Master Tenaga Kerja (NAKER) dengan Relasi Penugasan
     */
    public function index(Request $request)
    {
        @set_time_limit(180);
        @ini_set('memory_limit', '512M');

        try {
            $search = $request->query('search');
            $serviceId = $request->query('service_id');
            $serviceCode = $request->query('service');
            $siteCode = $request->query('site');
            $subService = $request->query('sub_service');
            $gender = $request->query('gender');
            $perPage = $request->query('per_page', 50);

            $query = Employee::where('status', 'active');

            // Search Filter
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('sip_id', 'like', "%{$search}%");
                });
            }

            // Gender Filter
            if ($gender && $gender !== 'all') {
                $query->where('gender', strtoupper($gender));
            }

            // Sub Service Filter
            if ($subService && $subService !== 'all') {
                $query->where(function ($q) use ($subService) {
                    $q->where('sub_service', $subService)
                      ->orWhereHas('assignments', fn($asQ) => $asQ->where('status', true)->where('sub_service', $subService));
                });
            }

            // Service Filter
            if ($serviceId && $serviceId !== 'all') {
                $query->whereHas('assignments', fn($q) => $q->where('status', true)->where('service_id', $serviceId));
            } elseif ($serviceCode && $serviceCode !== 'all') {
                $query->whereHas('assignments', function ($q) use ($serviceCode) {
                    $q->where('status', true)->whereHas('service', fn($sq) => $sq->where('code', strtoupper($serviceCode))->orWhere('name', 'like', "%{$serviceCode}%"));
                });
            }

            // Site Filter
            if ($siteCode && $siteCode !== 'all') {
                $query->whereHas('assignments', function ($q) use ($siteCode) {
                    $q->where('status', true)->whereHas('site', fn($sq) => $sq->where('code', strtoupper($siteCode)));
                });
            }

            // Team Leader Filter
            $tlId = $request->query('team_leader_id');
            if ($tlId && $tlId !== 'all') {
                $query->whereHas('assignments', fn($q) => $q->where('status', true)->where('team_leader_id', $tlId));
            }

            // Trainer Filter
            $trainerId = $request->query('trainer_id');
            if ($trainerId && $trainerId !== 'all') {
                $query->whereHas('assignments', fn($q) => $q->where('status', true)->where('trainer_id', $trainerId));
            }

            // Summary Counts (Ultra Safe)
            $totalAll = Employee::where('status', 'active')->count();
            $totalPria = Employee::where('status', 'active')->where('gender', 'PRIA')->count();
            $totalWanita = Employee::where('status', 'active')->where('gender', 'WANITA')->count();

            $qaCount = 0; $tlCount = 0; $trainerCount = 0; $csoCount = 0;
            try {
                $qaCount = Employee::where('status', 'active')->whereHas('assignments', fn($q) => $q->where('status', true)->whereHas('service', fn($sq) => $sq->where('code', 'QUALITY_ASSURANCE')))->count();
                $tlCount = Employee::where('status', 'active')->whereHas('assignments', fn($q) => $q->where('status', true)->whereHas('service', fn($sq) => $sq->where('code', 'TEAM_LEADER')))->count();
                $trainerCount = Employee::where('status', 'active')->whereHas('assignments', fn($q) => $q->where('status', true)->whereHas('service', fn($sq) => $sq->where('code', 'TRAINER')))->count();
                $csoCount = max(0, $totalAll - ($qaCount + $tlCount + $trainerCount));
            } catch (\Throwable $countEx) {}

            $serviceDistribution = [];
            try {
                $serviceDistribution = Service::all()->map(function ($s) {
                    $count = EmployeeAssignment::where('service_id', $s->id)->where('status', true)->count();
                    return [
                        'id' => $s->id,
                        'code' => $s->code,
                        'name' => $s->name,
                        'total_agents' => $count,
                    ];
                });
            } catch (\Throwable $svcEx) {}

            $subServices = [];
            try {
                $subServices = EmployeeAssignment::where('status', true)
                    ->whereNotNull('sub_service')
                    ->where('sub_service', '!=', '')
                    ->distinct()
                    ->pluck('sub_service')
                    ->sort()
                    ->values();
            } catch (\Throwable $subEx) {}

            $tlList = [];
            try {
                $tlEmployees = Employee::where('status', 'active')
                    ->where(function ($q) {
                        $q->whereHas('assignments', fn($sq) => $sq->where('status', true)->whereHas('service', fn($ssq) => $ssq->where('code', 'TEAM_LEADER')))
                          ->orWhere('sip_id', 'like', 'TL-%');
                    })
                    ->orderBy('name')
                    ->get(['id', 'name', 'sip_id']);

                $tlList = $tlEmployees->map(function ($tl) {
                    $memberCount = EmployeeAssignment::where('team_leader_id', $tl->id)->where('status', true)->count();
                    return [
                        'id' => $tl->id,
                        'name' => $tl->name,
                        'sip_id' => $tl->sip_id,
                        'member_count' => $memberCount,
                    ];
                });
            } catch (\Throwable $tlEx) {}

            $trainerList = [];
            try {
                $trnEmployees = Employee::where('status', 'active')
                    ->where(function ($q) {
                        $q->whereHas('assignments', fn($sq) => $sq->where('status', true)->whereHas('service', fn($ssq) => $ssq->where('code', 'TRAINER')))
                          ->orWhere('sip_id', 'like', 'TRN-%');
                    })
                    ->orderBy('name')
                    ->get(['id', 'name', 'sip_id']);

                $trainerList = $trnEmployees->map(function ($trn) {
                    $memberCount = EmployeeAssignment::where('trainer_id', $trn->id)->where('status', true)->count();
                    return [
                        'id' => $trn->id,
                        'name' => $trn->name,
                        'sip_id' => $trn->sip_id,
                        'member_count' => $memberCount,
                    ];
                });
            } catch (\Throwable $trnEx) {}

            // Preload active assignments for instant memory hydration
            $assignments = EmployeeAssignment::where('status', true)
                ->with(['service', 'site', 'teamLeader', 'trainer'])
                ->get()
                ->groupBy('employee_id');

            if ($perPage === 'all' || (int)$perPage >= 500) {
                $employees = $query->orderBy('name', 'asc')->get();
                $formatted = $employees->map(function ($emp) use ($assignments) {
                    $activeAsn = $assignments->get($emp->id)?->first();
                    $emp->setRelation('currentAssignment', $activeAsn);
                    return $emp;
                });
                $paginationData = [
                    'data' => $formatted,
                    'total' => $employees->count(),
                ];
            } else {
                $paginated = $query->orderBy('name', 'asc')->paginate((int)$perPage);
                $paginated->getCollection()->transform(function ($emp) use ($assignments) {
                    $activeAsn = $assignments->get($emp->id)?->first();
                    $emp->setRelation('currentAssignment', $activeAsn);
                    return $emp;
                });
                $paginationData = $paginated->toArray();
            }

            return response()->json([
                'success' => true,
                'summary' => [
                    'total_naker' => $totalAll,
                    'pria' => $totalPria,
                    'wanita' => $totalWanita,
                    'qa_count' => $qaCount,
                    'tl_count' => $tlCount,
                    'trainer_count' => $trainerCount,
                    'cso_count' => $csoCount,
                    'service_distribution' => $serviceDistribution,
                    'sub_services' => $subServices,
                    'team_leaders' => $tlList,
                    'trainers' => $trainerList,
                ],
                'data' => $paginationData,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('EmployeeController index failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal memuat data master NAKER: ' . $e->getMessage(),
                'error_detail' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500);
        }
    }

    /**
     * Get Detail NAKER berdasarkan ID
     */
    public function show($id)
    {
        $employee = Employee::with([
            'assignments.service',
            'assignments.site',
            'assignments.teamLeader',
            'assignments.trainer',
            'assessments' => function ($q) {
                $q->latest('transaction_at')->limit(10);
            }
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $employee,
        ]);
    }

    /**
     * Hapus Data Tenaga Kerja (NAKER) Satuan
     */
    public function destroy($id)
    {
        $employee = Employee::findOrFail($id);
        $empName = $employee->name;
        $empSip = $employee->sip_id;

        // 1. Hapus atau lepas relasi penugasan
        EmployeeAssignment::where('employee_id', $employee->id)->delete();
        EmployeeAssignment::where('team_leader_id', $employee->id)->update(['team_leader_id' => null]);
        EmployeeAssignment::where('trainer_id', $employee->id)->update(['trainer_id' => null]);

        // 3. Clean up TeamLeader / Trainer model if created for this employee and has 0 agents
        \App\Models\TeamLeader::where('name', $empName)->whereDoesntHave('agents')->delete();
        \App\Models\Trainer::where('name', $empName)->whereDoesntHave('agents')->delete();

        // 4. Hapus Employee
        $employee->delete();

        return response()->json([
            'success' => true,
            'message' => "Data NAKER '{$empName}' ({$empSip}) berhasil dihapus."
        ]);
    }
}
