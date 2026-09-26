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
            $periodMonth = $request->query('period_month') ?: $request->query('period');
            $perPage = $request->query('per_page', 50);

            // 1. Available Periods for Historical Navigation
            $availablePeriods = EmployeeAssignment::distinct()
                ->whereNotNull('period_month')
                ->where('period_month', '!=', '')
                ->pluck('period_month')
                ->sortDesc()
                ->values()
                ->toArray();

            if (empty($availablePeriods)) {
                $availablePeriods = ['2026-08'];
            }

            $query = Employee::where('status', 'active');

            // Period Month Filter (if specified and not 'all')
            if ($periodMonth && $periodMonth !== 'all') {
                $query->whereHas('assignments', fn($q) => $q->where('period_month', $periodMonth));
            }

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
                $query->whereHas('assignments', function($asQ) use ($subService, $periodMonth) {
                    $asQ->where('sub_service', $subService);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $asQ->where('period_month', $periodMonth);
                    } else {
                        $asQ->where('status', true);
                    }
                });
            }

            // Service Filter
            if ($serviceId && $serviceId !== 'all') {
                $query->whereHas('assignments', function($q) use ($serviceId, $periodMonth) {
                    $q->where('service_id', $serviceId);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                });
            } elseif ($serviceCode && $serviceCode !== 'all') {
                $query->whereHas('assignments', function ($q) use ($serviceCode, $periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('service', fn($sq) => $sq->where('code', strtoupper($serviceCode))->orWhere('name', 'like', "%{$serviceCode}%"));
                });
            }

            // Site Filter
            if ($siteCode && $siteCode !== 'all') {
                $query->whereHas('assignments', function ($q) use ($siteCode, $periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('site', fn($sq) => $sq->where('code', strtoupper($siteCode)));
                });
            }

            // Team Leader Filter
            $tlId = $request->query('team_leader_id');
            if ($tlId && $tlId !== 'all') {
                $query->whereHas('assignments', function($q) use ($tlId, $periodMonth) {
                    $q->where('team_leader_id', $tlId);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                });
            }

            // Trainer Filter
            $trainerId = $request->query('trainer_id');
            if ($trainerId && $trainerId !== 'all') {
                $query->whereHas('assignments', function($q) use ($trainerId, $periodMonth) {
                    $q->where('trainer_id', $trainerId);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                });
            }

            // Summary Counts (Scoped to Period)
            $empCountQuery = Employee::where('status', 'active');
            if ($periodMonth && $periodMonth !== 'all') {
                $empCountQuery->whereHas('assignments', fn($q) => $q->where('period_month', $periodMonth));
            }
            $totalAll = (clone $empCountQuery)->count();
            $totalPria = (clone $empCountQuery)->where('gender', 'PRIA')->count();
            $totalWanita = (clone $empCountQuery)->where('gender', 'WANITA')->count();

            $supervisorCount = 0; $qaCount = 0; $tlCount = 0; $trainerCount = 0; $csoCount = 0;
            try {
                $supervisorCount = (clone $empCountQuery)->whereHas('assignments', function($q) use ($periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('service', fn($sq) => $sq->where('code', 'SUPERVISOR'));
                })->count();

                $qaCount = (clone $empCountQuery)->whereHas('assignments', function($q) use ($periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('service', fn($sq) => $sq->where('code', 'QUALITY_ASSURANCE'));
                })->count();

                $tlCount = (clone $empCountQuery)->whereHas('assignments', function($q) use ($periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('service', fn($sq) => $sq->where('code', 'TEAM_LEADER'));
                })->count();

                $trainerCount = (clone $empCountQuery)->whereHas('assignments', function($q) use ($periodMonth) {
                    if ($periodMonth && $periodMonth !== 'all') {
                        $q->where('period_month', $periodMonth);
                    } else {
                        $q->where('status', true);
                    }
                    $q->whereHas('service', fn($sq) => $sq->where('code', 'TRAINER'));
                })->count();

                $csoCount = max(0, $totalAll - ($supervisorCount + $qaCount + $tlCount + $trainerCount));
            } catch (\Throwable $countEx) {}

            $serviceDistribution = [];
            try {
                $serviceDistribution = Service::all()->map(function ($s) use ($periodMonth) {
                    $asnQ = EmployeeAssignment::where('service_id', $s->id);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $asnQ->where('period_month', $periodMonth);
                    } else {
                        $asnQ->where('status', true);
                    }
                    return [
                        'id' => $s->id,
                        'code' => $s->code,
                        'name' => $s->name,
                        'total_agents' => $asnQ->count(),
                    ];
                });
            } catch (\Throwable $svcEx) {}

            $subServices = [];
            try {
                $subQ = EmployeeAssignment::query();
                if ($periodMonth && $periodMonth !== 'all') {
                    $subQ->where('period_month', $periodMonth);
                } else {
                    $subQ->where('status', true);
                }
                $subServices = $subQ->whereNotNull('sub_service')
                    ->where('sub_service', '!=', '')
                    ->distinct()
                    ->pluck('sub_service')
                    ->sort()
                    ->values();
            } catch (\Throwable $subEx) {}

            $tlList = [];
            try {
                $tlEmployees = Employee::where('status', 'active')
                    ->where(function ($q) use ($periodMonth) {
                        $q->whereHas('assignments', function($sq) use ($periodMonth) {
                            if ($periodMonth && $periodMonth !== 'all') {
                                $sq->where('period_month', $periodMonth);
                            } else {
                                $sq->where('status', true);
                            }
                            $sq->whereHas('service', fn($ssq) => $ssq->where('code', 'TEAM_LEADER'));
                        })
                        ->orWhere('sip_id', 'like', 'TL-%');
                    })
                    ->orderBy('name')
                    ->get(['id', 'name', 'sip_id']);

                $tlList = $tlEmployees->map(function ($tl) use ($periodMonth) {
                    $tlMemberQ = EmployeeAssignment::where('team_leader_id', $tl->id);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $tlMemberQ->where('period_month', $periodMonth);
                    } else {
                        $tlMemberQ->where('status', true);
                    }
                    return [
                        'id' => $tl->id,
                        'name' => $tl->name,
                        'sip_id' => $tl->sip_id,
                        'member_count' => $tlMemberQ->count(),
                    ];
                });
            } catch (\Throwable $tlEx) {}

            $trainerList = [];
            try {
                $trnEmployees = Employee::where('status', 'active')
                    ->where(function ($q) use ($periodMonth) {
                        $q->whereHas('assignments', function($sq) use ($periodMonth) {
                            if ($periodMonth && $periodMonth !== 'all') {
                                $sq->where('period_month', $periodMonth);
                            } else {
                                $sq->where('status', true);
                            }
                            $sq->whereHas('service', fn($ssq) => $ssq->where('code', 'TRAINER'));
                        })
                        ->orWhere('sip_id', 'like', 'TRN-%');
                    })
                    ->orderBy('name')
                    ->get(['id', 'name', 'sip_id']);

                $trainerList = $trnEmployees->map(function ($trn) use ($periodMonth) {
                    $trnMemberQ = EmployeeAssignment::where('trainer_id', $trn->id);
                    if ($periodMonth && $periodMonth !== 'all') {
                        $trnMemberQ->where('period_month', $periodMonth);
                    } else {
                        $trnMemberQ->where('status', true);
                    }
                    return [
                        'id' => $trn->id,
                        'name' => $trn->name,
                        'sip_id' => $trn->sip_id,
                        'member_count' => $trnMemberQ->count(),
                    ];
                });
            } catch (\Throwable $trnEx) {}

            // Preload assignments for the requested period (or active)
            $assignmentsQuery = EmployeeAssignment::with(['service', 'site', 'teamLeader', 'trainer']);
            if ($periodMonth && $periodMonth !== 'all') {
                $assignmentsQuery->where('period_month', $periodMonth);
            } else {
                $assignmentsQuery->where('status', true);
            }
            $assignments = $assignmentsQuery->get()->groupBy('employee_id');

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
                'available_periods' => $availablePeriods,
                'selected_period' => $periodMonth ?: ($availablePeriods[0] ?? '2026-08'),
                'summary' => [
                    'total_naker' => $totalAll,
                    'pria' => $totalPria,
                    'wanita' => $totalWanita,
                    'supervisor_count' => $supervisorCount,
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
     * Tambah Tenaga Kerja (NAKER) Manual
     * POST /api/employees
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'sip_id' => 'nullable|string|max:100',
            'gender' => 'nullable|string',
            'service_id' => 'nullable',
            'service_name' => 'nullable|string',
            'sub_service' => 'nullable|string|max:100',
            'team_leader_id' => 'nullable',
            'team_leader_name' => 'nullable|string',
            'trainer_id' => 'nullable',
            'trainer_name' => 'nullable|string',
            'site_id' => 'nullable',
            'period_month' => 'nullable|string',
        ]);

        try {
            $cleanName = strtoupper(trim((string)$request->input('name')));
            $rawSip = $request->input('sip_id');
            $cleanSip = $rawSip ? strtoupper(trim((string)$rawSip)) : ('SIP-' . strtoupper(substr(md5($cleanName . microtime()), 0, 8)));

            $rawGender = strtoupper(trim((string)$request->input('gender', 'PRIA')));
            $gender = ($rawGender === 'P' || $rawGender === 'WANITA' || $rawGender === 'PEREMPUAN') ? 'WANITA' : 'PRIA';

            $subService = $request->input('sub_service') ? strtoupper(trim((string)$request->input('sub_service'))) : null;
            $periodMonth = $request->input('period_month') ?: now()->format('Y-m');

            // 1. Resolve Service
            $serviceId = $request->input('service_id');
            $serviceName = $request->input('service_name');
            if (strtoupper((string)$serviceName) === 'SUPERVISOR' || $serviceId === 'SUPERVISOR') {
                $svc = Service::firstOrCreate(
                    ['code' => 'SUPERVISOR'],
                    [
                        'name' => 'Supervisor',
                        'source_ca_label' => 'Supervisor',
                        'source_layanan_label' => 'NON CSO - SUPERVISOR',
                        'status' => true,
                        'description' => 'Supervisor Operasional & Quality Management'
                    ]
                );
                $serviceId = $svc->id;
            } elseif (!$serviceId && $serviceName) {
                $svc = Service::where('name', 'like', "%{$serviceName}%")->orWhere('code', strtoupper($serviceName))->first();
                $serviceId = $svc?->id;
            }
            if (!$serviceId) {
                $serviceId = Service::where('code', 'DIGILIVE')->first()?->id ?? (Service::first()->id ?? 1);
            }

            // 2. Resolve Site
            $siteId = $request->input('site_id');
            if (!$siteId) {
                $siteId = Site::where('code', 'SMG')->first()?->id ?? 1;
            }

            // 3. Resolve TL
            $tlId = $request->input('team_leader_id') && $request->input('team_leader_id') !== 'none' ? $request->input('team_leader_id') : null;
            if (!$tlId && $request->input('team_leader_name')) {
                $tlEmp = Employee::where('name', $request->input('team_leader_name'))->first();
                $tlId = $tlEmp?->id;
            }

            // 4. Resolve Trainer
            $trainerId = $request->input('trainer_id') && $request->input('trainer_id') !== 'none' ? $request->input('trainer_id') : null;
            if (!$trainerId && $request->input('trainer_name')) {
                $trnEmp = Employee::where('name', $request->input('trainer_name'))->first();
                $trainerId = $trnEmp?->id;
            }

            // 5. Create or Update Employee
            $employee = Employee::updateOrCreate(
                ['sip_id' => $cleanSip],
                [
                    'name' => $cleanName,
                    'gender' => $gender,
                    'status' => 'active',
                    'sub_service' => $subService,
                ]
            );

            // 6. Create or Update EmployeeAssignment for the period
            $assignment = EmployeeAssignment::updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'period_month' => $periodMonth,
                ],
                [
                    'service_id' => $serviceId,
                    'sub_service' => $subService,
                    'site_id' => $siteId,
                    'team_leader_id' => $tlId,
                    'trainer_id' => $trainerId,
                    'status' => true,
                ]
            );

            // 7. Sync TL / Trainer lookup models & Agent model
            $tlModelId = null;
            if ($tlId) {
                $tlEmp = Employee::find($tlId);
                if ($tlEmp) {
                    $tlModel = \App\Models\TeamLeader::firstOrCreate(['name' => $tlEmp->name], ['sip_id' => $tlEmp->sip_id]);
                    $tlModelId = $tlModel->id;
                }
            }
            $trnModelId = null;
            if ($trainerId) {
                $trnEmp = Employee::find($trainerId);
                if ($trnEmp) {
                    $trnModel = \App\Models\Trainer::firstOrCreate(['name' => $trnEmp->name], ['sip_id' => $trnEmp->sip_id]);
                    $trnModelId = $trnModel->id;
                }
            }

            $serviceObj = Service::find($serviceId);
            $serviceNameResolved = $serviceObj ? $serviceObj->name : 'Digilive';
            $isSupervisor = ($serviceObj && $serviceObj->code === 'SUPERVISOR') || strtoupper((string)$serviceName) === 'SUPERVISOR';
            $isQa = ($serviceObj && $serviceObj->code === 'QUALITY_ASSURANCE') || strtoupper((string)$serviceName) === 'QUALITY ASSURANCE';
            $isTl = ($serviceObj && $serviceObj->code === 'TEAM_LEADER') || strtoupper((string)$serviceName) === 'TEAM LEADER';
            $isTrainer = ($serviceObj && $serviceObj->code === 'TRAINER') || strtoupper((string)$serviceName) === 'TRAINER';

            \App\Models\Agent::updateOrCreate(
                ['nik' => $cleanSip],
                [
                    'name' => $cleanName,
                    'channel' => $serviceNameResolved,
                    'site_id' => $siteId,
                    'team_leader_id' => $tlModelId,
                    'trainer_id' => $trnModelId,
                    'cso_classification' => ($isSupervisor || $isQa || $isTl || $isTrainer) ? 'MANAGEMENT_NAKER' : 'VERIFIED_NAKER',
                ]
            );

            return response()->json([
                'success' => true,
                'message' => "Data NAKER '{$cleanName}' ({$cleanSip}) berhasil disimpan ke Master NAKER. Akun login dapat diaktifkan melalui menu User Setting (Kelola Akun).",
                'data' => $employee->load('currentAssignment'),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan data NAKER: ' . $e->getMessage(),
            ], 500);
        }
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
