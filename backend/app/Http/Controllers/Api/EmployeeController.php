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
        $search = $request->query('search');
        $serviceId = $request->query('service_id');
        $serviceCode = $request->query('service');
        $siteCode = $request->query('site');
        $subService = $request->query('sub_service');
        $gender = $request->query('gender');
        $perPage = $request->query('per_page', 50);

        $query = Employee::query()
            ->with([
                'currentAssignment.service',
                'currentAssignment.site',
                'currentAssignment.teamLeader',
                'currentAssignment.trainer',
            ])
            ->where('status', 'active');

        // Search Filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sip_id', 'like', "%{$search}%")
                  ->orWhereHas('currentAssignment.teamLeader', function ($tlQ) use ($search) {
                      $tlQ->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('currentAssignment.trainer', function ($trnQ) use ($search) {
                      $trnQ->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Service Filter
        if ($serviceId && $serviceId !== 'all') {
            $query->whereHas('currentAssignment', function ($q) use ($serviceId) {
                $q->where('service_id', $serviceId);
            });
        } elseif ($serviceCode && $serviceCode !== 'all') {
            $query->whereHas('currentAssignment.service', function ($q) use ($serviceCode) {
                $q->where('code', strtoupper($serviceCode))
                  ->orWhere('name', 'like', "%{$serviceCode}%");
            });
        }

        // Sub Service Filter
        if ($subService && $subService !== 'all') {
            $query->whereHas('currentAssignment', function ($q) use ($subService) {
                $q->where('sub_service', $subService);
            });
        }

        // Site Filter
        if ($siteCode && $siteCode !== 'all') {
            $query->whereHas('currentAssignment.site', function ($q) use ($siteCode) {
                $q->where('code', strtoupper($siteCode));
            });
        }

        // Gender Filter
        if ($gender && $gender !== 'all') {
            $query->where('gender', strtoupper($gender));
        }

        // Team Leader Filter (ID or Name)
        $tlId = $request->query('team_leader_id');
        $tlName = $request->query('team_leader_name');
        if ($tlId && $tlId !== 'all') {
            $query->whereHas('currentAssignment', function ($q) use ($tlId) {
                $q->where('team_leader_id', $tlId);
            });
        } elseif ($tlName && $tlName !== 'all') {
            $query->whereHas('currentAssignment.teamLeader', function ($q) use ($tlName) {
                $q->where('name', 'like', "%{$tlName}%")
                  ->orWhere('sip_id', 'like', "%{$tlName}%");
            });
        }

        // Trainer Filter (ID or Name)
        $trainerId = $request->query('trainer_id');
        $trainerName = $request->query('trainer_name');
        if ($trainerId && $trainerId !== 'all') {
            $query->whereHas('currentAssignment', function ($q) use ($trainerId) {
                $q->where('trainer_id', $trainerId);
            });
        } elseif ($trainerName && $trainerName !== 'all') {
            $query->whereHas('currentAssignment.trainer', function ($q) use ($trainerName) {
                $q->where('name', 'like', "%{$trainerName}%")
                  ->orWhere('sip_id', 'like', "%{$trainerName}%");
            });
        }

        // Summary Counts
        $totalAll = Employee::where('status', 'active')->count();
        $totalPria = Employee::where('status', 'active')->where('gender', 'PRIA')->count();
        $totalWanita = Employee::where('status', 'active')->where('gender', 'WANITA')->count();

        $qaCount = Employee::where('status', 'active')->whereHas('currentAssignment.service', function ($q) {
            $q->where('code', 'QUALITY_ASSURANCE');
        })->count();

        $tlCount = Employee::where('status', 'active')->whereHas('currentAssignment.service', function ($q) {
            $q->where('code', 'TEAM_LEADER');
        })->count();

        $trainerCount = Employee::where('status', 'active')->whereHas('currentAssignment.service', function ($q) {
            $q->where('code', 'TRAINER');
        })->count();

        $csoCount = Employee::where('status', 'active')->whereHas('currentAssignment.service', function ($q) {
            $q->whereNotIn('code', ['QUALITY_ASSURANCE', 'TEAM_LEADER', 'TRAINER']);
        })->count();

        $serviceDistribution = Service::withCount(['assignments' => function ($q) {
            $q->where('status', true);
        }])->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'total_agents' => $s->assignments_count,
            ];
        });

        $subServices = EmployeeAssignment::where('status', true)
            ->whereNotNull('sub_service')
            ->where('sub_service', '!=', '')
            ->distinct()
            ->pluck('sub_service')
            ->sort()
            ->values();

        $tlList = Employee::where('status', 'active')
            ->where(function ($q) {
                $q->whereHas('currentAssignment.service', function ($sq) {
                    $sq->where('code', 'TEAM_LEADER');
                })->orWhere('sip_id', 'like', 'TL-%');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'sip_id'])
            ->map(function ($tl) {
                $memberCount = EmployeeAssignment::where('team_leader_id', $tl->id)->where('status', true)->count();
                return [
                    'id' => $tl->id,
                    'name' => $tl->name,
                    'sip_id' => $tl->sip_id,
                    'member_count' => $memberCount,
                ];
            });

        $trainerList = Employee::where('status', 'active')
            ->where(function ($q) {
                $q->whereHas('currentAssignment.service', function ($sq) {
                    $sq->where('code', 'TRAINER');
                })->orWhere('sip_id', 'like', 'TRN-%');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'sip_id'])
            ->map(function ($trn) {
                $memberCount = EmployeeAssignment::where('trainer_id', $trn->id)->where('status', true)->count();
                return [
                    'id' => $trn->id,
                    'name' => $trn->name,
                    'sip_id' => $trn->sip_id,
                    'member_count' => $memberCount,
                ];
            });

        if ($perPage === 'all' || (int)$perPage >= 500) {
            $employees = $query->orderBy('name', 'asc')->get();
            $paginationData = [
                'data' => $employees,
                'total' => $employees->count(),
            ];
        } else {
            $paginated = $query->orderBy('name', 'asc')->paginate((int)$perPage);
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
