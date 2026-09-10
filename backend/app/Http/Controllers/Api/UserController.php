<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EvaluatorSampling;
use App\Models\TeamLeader;
use App\Models\Trainer;
use App\Models\User;
use App\Services\NakerImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Get Daftar Seluruh Pengguna Akun Sistem dengan Ringkasan Metrik
     * GET /api/users
     */
    public function index(Request $request)
    {
        $search = $request->query('search');
        $role = $request->query('role');
        $status = $request->query('status');
        $perPage = $request->query('per_page', 50);

        $query = User::query()->with('employee.currentAssignment.service');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($role && $role !== 'all') {
            $query->where('role', $role);
        }

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        // Summary metrics
        $totalUsers = User::count();
        $qaCount = User::where('role', 'quality_assurance')->count();
        $tlCount = User::where('role', 'team_leader')->count();
        $trainerCount = User::where('role', 'trainer')->count();
        $agentCount = User::whereIn('role', ['agent', 'cso'])->count();
        $supervisorCount = User::whereIn('role', ['supervisor', 'admin', 'superadmin'])->count();
        $activeCount = User::where('status', 'active')->count();
        $inactiveCount = User::where('status', 'inactive')->count();

        if ($perPage === 'all' || (int)$perPage >= 500) {
            $users = $query->orderBy('role', 'asc')->orderBy('name', 'asc')->get();
            $paginationData = [
                'data' => $users,
                'total' => $users->count(),
            ];
        } else {
            $paginated = $query->orderBy('role', 'asc')->orderBy('name', 'asc')->paginate((int)$perPage);
            $paginationData = $paginated->toArray();
        }

        return response()->json([
            'success' => true,
            'summary' => [
                'total_users' => $totalUsers,
                'qa_count' => $qaCount,
                'tl_count' => $tlCount,
                'trainer_count' => $trainerCount,
                'agent_count' => $agentCount,
                'supervisor_count' => $supervisorCount,
                'active_count' => $activeCount,
                'inactive_count' => $inactiveCount,
            ],
            'data' => $paginationData,
        ]);
    }

    /**
     * Get Daftar Kandidat Tenaga Kerja NAKER untuk Dipilih & Diinjeksi Akun
     * GET /api/users/naker-candidates
     */
    public function nakerCandidates(Request $request)
    {
        $search = $request->query('search');
        $classification = $request->query('classification'); // 'all', 'QA', 'TL', 'Trainer', 'CSO'
        $hasAccount = $request->query('has_account'); // 'all', 'yes', 'no'

        $employees = Employee::with(['currentAssignment.service', 'currentAssignment.teamLeader', 'currentAssignment.trainer', 'currentAssignment.site'])
            ->where('status', 'active')
            ->orderBy('name', 'asc')
            ->get();

        $existingUserEmployeeIds = User::whereNotNull('employee_id')->pluck('employee_id')->flip()->toArray();
        $existingUserUsernames = User::pluck('username')->flip()->toArray();

        $candidates = [];
        $qaCount = 0;
        $tlCount = 0;
        $trainerCount = 0;
        $csoCount = 0;
        $noAccountCount = 0;
        $hasAccountCount = 0;

        foreach ($employees as $emp) {
            $assignment = $emp->currentAssignment;
            $serviceCode = $assignment?->service?->code;
            $serviceName = $assignment?->service?->name ?? 'Operasional';

            $isQa = $serviceCode === 'QUALITY_ASSURANCE' || NakerImportService::isQaClassification($serviceName);
            $isTl = $serviceCode === 'TEAM_LEADER' || NakerImportService::isTlClassification($serviceName) || Str::startsWith((string)$emp->sip_id, 'TL-');
            $isTrainer = $serviceCode === 'TRAINER' || NakerImportService::isTrainerClassification($serviceName) || Str::startsWith((string)$emp->sip_id, 'TRN-');

            if ($isQa) {
                $classType = 'QA';
                $roleName = 'Quality Assurance';
                $roleCode = 'quality_assurance';
                $department = 'Middle Management Quality Assurance';
                $defaultPrefix = 'qa.';
                $qaCount++;
            } elseif ($isTl) {
                $classType = 'TL';
                $roleName = 'Team Leader';
                $roleCode = 'team_leader';
                $department = 'Team Leader Operasional';
                $defaultPrefix = 'tl.';
                $tlCount++;
            } elseif ($isTrainer) {
                $classType = 'Trainer';
                $roleName = 'Trainer';
                $roleCode = 'trainer';
                $department = 'Trainer Operasional & Coaching';
                $defaultPrefix = 'trn.';
                $trainerCount++;
            } else {
                $classType = 'CSO';
                $roleName = 'CSO Agent';
                $roleCode = 'agent';
                $department = 'CSO Agent - ' . $serviceName;
                $defaultPrefix = 'cso.';
                $csoCount++;
            }

            // Username suggestion
            $cleanUsername = strtolower(trim((string)$emp->sip_id));
            $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanUsername);
            if (empty($cleanUsername)) {
                $cleanUsername = $defaultPrefix . strtolower(str_replace(' ', '.', $emp->name));
            }

            $alreadyHasAccount = isset($existingUserEmployeeIds[$emp->id]) || isset($existingUserUsernames[$cleanUsername]);
            if ($alreadyHasAccount) {
                $hasAccountCount++;
            } else {
                $noAccountCount++;
            }

            // Filter classification
            if ($classification && $classification !== 'all' && $classType !== $classification) {
                continue;
            }

            // Filter has account
            if ($hasAccount === 'no' && $alreadyHasAccount) continue;
            if ($hasAccount === 'yes' && !$alreadyHasAccount) continue;

            // Search filter
            if ($search) {
                $term = strtolower($search);
                $match = str_contains(strtolower($emp->name), $term) ||
                         str_contains(strtolower((string)$emp->sip_id), $term) ||
                         str_contains(strtolower($serviceName), $term) ||
                         str_contains(strtolower($department), $term);
                if (!$match) continue;
            }

            $candidates[] = [
                'employee_id' => $emp->id,
                'name' => $emp->name,
                'sip_id' => $emp->sip_id,
                'gender' => $emp->gender,
                'classification' => $classType,
                'role_name' => $roleName,
                'role_code' => $roleCode,
                'service_name' => $serviceName,
                'department' => $department,
                'proposed_username' => $cleanUsername,
                'proposed_email' => $cleanUsername . '@digiqa.id',
                'has_account' => $alreadyHasAccount,
                'site' => $assignment?->site?->code ?? 'SMG',
            ];
        }

        return response()->json([
            'success' => true,
            'summary' => [
                'total_naker' => $employees->count(),
                'qa_count' => $qaCount,
                'tl_count' => $tlCount,
                'trainer_count' => $trainerCount,
                'cso_count' => $csoCount,
                'no_account_count' => $noAccountCount,
                'has_account_count' => $hasAccountCount,
            ],
            'candidates' => $candidates,
        ]);
    }

    /**
     * Injeksi & Sinkronisasi Akun Terpilih dari Data Master NAKER
     * POST /api/users/sync-from-naker
     */
    public function syncFromNaker(Request $request)
    {
        $selectedEmployeeIds = $request->input('employee_ids', []); // Array of selected employee IDs
        $includeCso = filter_var($request->input('include_cso', false), FILTER_VALIDATE_BOOLEAN);

        $query = Employee::with('currentAssignment.service', 'currentAssignment.teamLeader', 'currentAssignment.trainer')
            ->where('status', 'active');

        if (!empty($selectedEmployeeIds) && is_array($selectedEmployeeIds)) {
            $query->whereIn('id', $selectedEmployeeIds);
        }

        $employees = $query->get();

        if ($employees->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada data Master NAKER yang dipilih untuk disinkronkan.',
            ], 400);
        }

        $created = 0;
        $updated = 0;

        foreach ($employees as $emp) {
            $assignment = $emp->currentAssignment;
            $serviceCode = $assignment?->service?->code;
            $serviceName = $assignment?->service?->name ?? 'Operasional';

            $isQa = $serviceCode === 'QUALITY_ASSURANCE' || NakerImportService::isQaClassification($serviceName);
            $isTl = $serviceCode === 'TEAM_LEADER' || NakerImportService::isTlClassification($serviceName) || Str::startsWith((string)$emp->sip_id, 'TL-');
            $isTrainer = $serviceCode === 'TRAINER' || NakerImportService::isTrainerClassification($serviceName) || Str::startsWith((string)$emp->sip_id, 'TRN-');

            // If selective list is NOT provided and CSO is not included, skip CSO
            if (empty($selectedEmployeeIds) && !$isQa && !$isTl && !$isTrainer && !$includeCso) {
                continue;
            }

            // Determine Target Role & Department
            if ($isQa) {
                $targetRole = 'quality_assurance';
                $department = 'Middle Management Quality Assurance';
                $defaultPrefix = 'qa.';
            } elseif ($isTl) {
                $targetRole = 'team_leader';
                $department = 'Team Leader Operasional';
                $defaultPrefix = 'tl.';
            } elseif ($isTrainer) {
                $targetRole = 'trainer';
                $department = 'Trainer Operasional & Coaching';
                $defaultPrefix = 'trn.';
            } else {
                $targetRole = 'agent';
                $department = 'CSO Agent - ' . $serviceName;
                $defaultPrefix = 'cso.';
            }

            // Username suggestion
            $cleanUsername = strtolower(trim((string)$emp->sip_id));
            $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanUsername);
            if (empty($cleanUsername)) {
                $cleanUsername = $defaultPrefix . strtolower(str_replace(' ', '.', $emp->name));
            }

            $email = $cleanUsername . '@digiqa.id';

            // Find existing user by employee_id, username, or email
            $user = User::where('employee_id', $emp->id)
                ->orWhere('username', $cleanUsername)
                ->orWhere('email', $email)
                ->first();

            if ($user) {
                $user->update([
                    'employee_id' => $emp->id,
                    'name' => $emp->name,
                    'username' => $user->username ?: $cleanUsername,
                    'email' => $user->email ?: $email,
                    'role' => $targetRole,
                    'department' => $department,
                    'status' => 'active',
                ]);
                $updated++;
            } else {
                User::create([
                    'employee_id' => $emp->id,
                    'name' => $emp->name,
                    'username' => $cleanUsername,
                    'email' => $email,
                    'password' => Hash::make('password'),
                    'role' => $targetRole,
                    'department' => $department,
                    'status' => 'active',
                ]);
                $created++;
            }

            // Register QA / Trainer in EvaluatorSampling
            if ($isQa) {
                EvaluatorSampling::firstOrCreate(
                    ['evaluator_name' => $emp->name, 'period_month' => '2026-08'],
                    ['type' => 'QA', 'quota' => 370, 'actual' => 0, 'avg_score' => 90.0, 'status' => 'Aktif']
                );
            } elseif ($isTrainer) {
                EvaluatorSampling::firstOrCreate(
                    ['evaluator_name' => $emp->name, 'period_month' => '2026-08'],
                    ['type' => 'Trainer', 'quota' => 370, 'actual' => 0, 'avg_score' => 90.0, 'status' => 'Aktif']
                );
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Berhasil menginjeksi akun ({$created} akun baru dibuat, {$updated} akun diperbarui).",
            'stats' => [
                'created' => $created,
                'updated' => $updated,
                'total_synced' => $created + $updated,
            ]
        ]);
    }

    /**
     * Tambah Akun Pengguna Baru
     * POST /api/users
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'email' => 'required|email|max:255|unique:users,email',
            'role' => 'required|string|in:supervisor,quality_assurance,team_leader,trainer,agent,admin',
            'department' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'password' => 'nullable|string|min:4',
            'status' => 'nullable|string|in:active,inactive',
            'employee_id' => 'nullable|integer',
        ]);

        $rawPassword = $validated['password'] ?? 'password';

        $user = User::create([
            'employee_id' => $validated['employee_id'] ?? null,
            'name' => $validated['name'],
            'username' => strtolower(trim($validated['username'])),
            'email' => strtolower(trim($validated['email'])),
            'password' => Hash::make($rawPassword),
            'role' => $validated['role'],
            'department' => $validated['department'] ?? 'Divisi QA Contact Center',
            'phone' => $validated['phone'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Akun {$user->name} ({$user->username}) berhasil ditambahkan!",
            'data' => $user,
        ]);
    }

    /**
     * Update Akun Pengguna
     * PUT /api/users/{id}
     */
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'username' => "sometimes|required|string|max:255|unique:users,username,{$id}",
            'email' => "sometimes|required|email|max:255|unique:users,email,{$id}",
            'role' => 'sometimes|required|string|in:supervisor,quality_assurance,team_leader,trainer,agent,admin',
            'department' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'password' => 'nullable|string|min:4',
            'status' => 'nullable|string|in:active,inactive',
        ]);

        $updateData = [
            'name' => $validated['name'] ?? $user->name,
            'username' => isset($validated['username']) ? strtolower(trim($validated['username'])) : $user->username,
            'email' => isset($validated['email']) ? strtolower(trim($validated['email'])) : $user->email,
            'role' => $validated['role'] ?? $user->role,
            'department' => $validated['department'] ?? $user->department,
            'phone' => $validated['phone'] ?? $user->phone,
            'status' => $validated['status'] ?? $user->status,
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);

        return response()->json([
            'success' => true,
            'message' => "Akun {$user->name} berhasil diperbarui!",
            'data' => $user,
        ]);
    }

    /**
     * Reset Password Akun
     * POST /api/users/{id}/reset-password
     */
    public function resetPassword(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $newPass = $request->input('password') ?: 'password';

        $user->update([
            'password' => Hash::make($newPass),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Password untuk {$user->name} ({$user->username}) berhasil direset.",
            'new_password' => $newPass,
        ]);
    }

    /**
     * Toggle Status Aktif / Nonaktif
     * POST /api/users/{id}/toggle-status
     */
    public function toggleStatus($id)
    {
        $user = User::findOrFail($id);
        $newStatus = $user->status === 'active' ? 'inactive' : 'active';
        $user->update(['status' => $newStatus]);

        return response()->json([
            'success' => true,
            'message' => "Status akun {$user->name} berhasil diubah menjadi: {$newStatus}",
            'status' => $newStatus,
        ]);
    }

    /**
     * Hapus Akun
     * DELETE /api/users/{id}
     */
    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $name = $user->name;
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => "Akun {$name} berhasil dihapus dari sistem.",
        ]);
    }
}
