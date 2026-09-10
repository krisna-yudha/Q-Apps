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
}
