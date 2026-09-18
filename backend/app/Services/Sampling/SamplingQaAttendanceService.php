<?php

namespace App\Services\Sampling;

use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingQaAttendance;
use App\Models\SamplingTarget;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SamplingQaAttendanceService
{
    public const STATUS_STANDBY   = 'STANDBY';   // Default / Baru Login (Belum Ready)
    public const STATUS_ON_DUTY   = 'ON_DUTY';   // Ready / On Duty (Siap Bertugas & JIT Auto-Pull)
    public const STATUS_END_SHIFT = 'END_SHIFT'; // End Shift (Mengakhiri Tugas Hari Itu)
    public const STATUS_OFF_DAY   = 'OFF_DAY';   // Libur
    public const STATUS_LEAVE     = 'LEAVE';     // Cuti / Izin
    public const STATUS_SICK      = 'SICK';      // Sakit
    public const STATUS_TRAINING  = 'TRAINING';  // Training

    /**
     * Record QA Evaluator Login (Default Lifecycle: STANDBY & login_at timestamp)
     * Rule: Login does NOT automatically put QA on duty. QA must explicitly click Ready.
     */
    public static function recordQaLogin(User $user): ?SamplingQaAttendance
    {
        $todayStr = now()->format('Y-m-d');
        $periodCode = now()->format('Y-m');
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $cleanName = $user->name;

        $record = SamplingQaAttendance::firstOrNew([
            'evaluator_name' => $cleanName,
            'work_date'      => $todayStr,
        ]);

        $record->sampling_period_id = $period->id;
        $record->evaluator_id = $user->id;
        $record->login_at = $record->login_at ?: now();

        // If the QA has not explicitly clicked Ready today (ready_at is empty)
        // and is not in a supervisor-defined special status (END_SHIFT, LEAVE, SICK, TRAINING),
        // ensure their state is STANDBY (is_ready = false).
        if (empty($record->ready_at)) {
            if (empty($record->status) || $record->status === self::STATUS_ON_DUTY || $record->status === self::STATUS_OFF_DAY) {
                $record->status = self::STATUS_STANDBY;
                $record->is_ready = false;
                $record->notes = $record->notes ?: 'Login sesi (Standby / Belum Ready)';
            }
        }

        $record->save();

        \App\Services\NotificationService::triggerSync('qa_attendance_changed', [
            'evaluator' => $cleanName,
            'status'    => $record->status,
            'is_ready'  => (bool)$record->is_ready,
            'login_at'  => $record->login_at ? $record->login_at->toIso8601String() : null,
            'ready_at'  => $record->ready_at ? $record->ready_at->toIso8601String() : null,
            'date'      => $todayStr,
        ]);

        return $record;
    }

    /**
     * Get or initialize roster for a given period (YYYY-MM).
     */
    public static function getPeriodRoster(string $periodCode, ?string $dateStr = null): array
    {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $parts = explode('-', $periodCode);
        $year = (int)($parts[0] ?? now()->year);
        $month = (int)($parts[1] ?? now()->month);
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);

        $targetDateStr = $dateStr ? Carbon::parse($dateStr)->format('Y-m-d') : now()->format('Y-m-d');

        // Resolve active QA list
        $qaNames = AutoDistributionEngineService::getActiveQaNames($period);
        if (empty($qaNames)) {
            $dailyTargetComposition = $period->daily_category_composition ?: AutoDistributionEngineService::DAILY_CATEGORY_TARGETS;
            $dailyTotalPerQa = array_sum($dailyTargetComposition);
            return [
                'period'                => $periodCode,
                'target_date'           => $targetDateStr,
                'days_in_month'         => $daysInMonth,
                'daily_total_per_qa'    => $dailyTotalPerQa,
                'category_composition'  => $dailyTargetComposition,
                'summary' => [
                    'total_qa_evaluators'           => 0,
                    'active_duty_qas_count'         => 0,
                    'off_duty_qas_count'            => 0,
                    'ready_qa_names'                => [],
                    'off_qa_details'                => [],
                    'potential_daily_tickets'       => 0,
                    'allocation_formula'            => "0 QA On Duty × {$dailyTotalPerQa} Tiket = 0 Tiket Hari Ini",
                ],
                'evaluators'            => [],
            ];
        }

        // Purge any orphan attendance records for QAs that no longer exist
        SamplingQaAttendance::where('sampling_period_id', $period->id)
            ->whereNotIn('evaluator_name', $qaNames)
            ->delete();

        // Fetch existing attendance records for the month
        $existingRecords = SamplingQaAttendance::where('sampling_period_id', $period->id)
            ->get()
            ->groupBy('evaluator_name');

        // Map users
        $usersMap = User::whereIn('name', $qaNames)
            ->orWhere('role', 'quality_assurance')
            ->get()
            ->keyBy('name');

        $now = now();
        $recordsToInsert = [];

        // Check if any QA missing records for the entire month, auto-initialize
        foreach ($qaNames as $qaName) {
            $qaExisting = $existingRecords->get($qaName, collect())->keyBy(function($item) {
                return Carbon::parse($item->work_date)->format('Y-m-d');
            });

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $curDateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
                if (!$qaExisting->has($curDateStr)) {
                    // Default initial state: STANDBY (QA activates Ready when starting work)
                    $defaultStatus = self::STATUS_STANDBY;

                    $recordsToInsert[] = [
                        'sampling_period_id'        => $period->id,
                        'evaluator_name'            => $qaName,
                        'evaluator_id'              => $usersMap->get($qaName)?->id,
                        'work_date'                 => $curDateStr,
                        'status'                    => $defaultStatus,
                        'is_ready'                  => false,
                        'shift'                     => 'Normal',
                        'notes'                     => 'Standby / Belum Ready',
                        'tickets_distributed_count' => 0,
                        'tickets_completed_count'   => 0,
                        'created_at'                => $now,
                        'updated_at'                => $now,
                    ];
                }
            }
        }

        if (!empty($recordsToInsert)) {
            SamplingQaAttendance::insert($recordsToInsert);
        }

        // Re-query all attendances for the period
        $allAttendances = SamplingQaAttendance::where('sampling_period_id', $period->id)
            ->orderBy('work_date')
            ->get()
            ->groupBy('evaluator_name');

        // Query actual completed & distributed assignments for sync
        $allAssignments = SamplingAssignment::where('sampling_period_id', $period->id)->get();
        $assignmentsByQaDate = $allAssignments->groupBy(function($item) {
            $d = $item->assigned_at ? $item->assigned_at->format('Y-m-d') : ($item->created_at ? $item->created_at->format('Y-m-d') : '');
            $eval = strtoupper(trim(str_replace('.', ' ', $item->evaluator_name)));
            return "{$eval}_{$d}";
        });

        $qaRosterCards = [];
        $todayReadyQas = [];
        $todayOffQas = [];

        foreach ($qaNames as $qaName) {
            $normalizedName = strtoupper(trim(str_replace('.', ' ', $qaName)));
            $qaRecords = $allAttendances->get($qaName, collect());

            $totalDutyDays = 0;
            $totalOffDays = 0;
            $totalDistributed = 0;
            $totalCompleted = 0;
            $dailyMatrix = [];

            $todayRecord = null;

            foreach ($qaRecords as $rec) {
                $recDateStr = Carbon::parse($rec->work_date)->format('Y-m-d');
                $isDuty = (bool)$rec->is_ready && ($rec->status === self::STATUS_ON_DUTY) && !empty($rec->ready_at);
                $cleanStatus = ($rec->status === self::STATUS_ON_DUTY && empty($rec->ready_at)) ? self::STATUS_STANDBY : $rec->status;

                if ($isDuty) {
                    $totalDutyDays++;
                } else {
                    $totalOffDays++;
                }

                // Count actual assignments for this day
                $key = "{$normalizedName}_{$recDateStr}";
                $dayAssignments = $assignmentsByQaDate->get($key, collect());
                $dayDist = $dayAssignments->count();
                $dayComp = $dayAssignments->where('status', 'COMPLETED')->count();

                $totalDistributed += $dayDist;
                $totalCompleted += $dayComp;

                $dayInfo = [
                    'id'                => $rec->id,
                    'date'              => $recDateStr,
                    'day_number'        => (int)Carbon::parse($rec->work_date)->format('d'),
                    'day_name'          => Carbon::parse($rec->work_date)->locale('id')->isoFormat('dd'),
                    'status'            => $cleanStatus,
                    'is_ready'          => $isDuty,
                    'shift'             => $rec->shift ?: 'Normal',
                    'notes'             => $rec->notes,
                    'login_at'          => $rec->login_at ? $rec->login_at->toIso8601String() : null,
                    'ready_at'          => $rec->ready_at ? $rec->ready_at->toIso8601String() : null,
                    'end_shift_at'      => $rec->end_shift_at ? $rec->end_shift_at->toIso8601String() : null,
                    'login_time'        => $rec->login_at ? $rec->login_at->format('H:i') : null,
                    'ready_time'        => $rec->ready_at ? $rec->ready_at->format('H:i') : null,
                    'end_shift_time'    => $rec->end_shift_at ? $rec->end_shift_at->format('H:i') : null,
                    'tickets_assigned'  => $dayDist,
                    'tickets_completed' => $dayComp,
                ];

                $dailyMatrix[$recDateStr] = $dayInfo;

                if ($recDateStr === $targetDateStr) {
                    $todayRecord = $dayInfo;
                    if ($isDuty) {
                        $todayReadyQas[] = $qaName;
                    } else {
                        $todayOffQas[] = [
                            'name'           => $qaName,
                            'status'         => $cleanStatus,
                            'notes'          => $rec->notes ?: ($cleanStatus === self::STATUS_STANDBY ? 'Standby / Belum Ready' : ($cleanStatus === self::STATUS_END_SHIFT ? 'Shift Selesai' : 'Off Day / Libur')),
                            'login_time'     => $rec->login_at ? $rec->login_at->format('H:i') : null,
                            'ready_time'     => $rec->ready_at ? $rec->ready_at->format('H:i') : null,
                            'end_shift_time' => $rec->end_shift_at ? $rec->end_shift_at->format('H:i') : null,
                        ];
                    }
                }
            }

            $completionRate = $totalDistributed > 0 ? round(($totalCompleted / $totalDistributed) * 100, 1) : 0.0;

            $qaRosterCards[] = [
                'evaluator_name'            => $qaName,
                'evaluator_id'              => $usersMap->get($qaName)?->id,
                'avatar_letter'             => substr($qaName, 0, 1),
                'total_duty_days'           => $totalDutyDays,
                'total_off_days'            => $totalOffDays,
                'total_work_days_ratio'     => "{$totalDutyDays} Hari Kerja / {$daysInMonth} Hari",
                'total_distributed'         => $totalDistributed,
                'total_completed'           => $totalCompleted,
                'completion_rate_pct'       => $completionRate,
                'today_status'              => $todayRecord['status'] ?? self::STATUS_STANDBY,
                'today_is_ready'            => $todayRecord['is_ready'] ?? false,
                'today_shift'               => $todayRecord['shift'] ?? 'Normal',
                'today_notes'               => $todayRecord['notes'] ?? '',
                'login_at'                  => $todayRecord['login_at'] ?? null,
                'ready_at'                  => $todayRecord['ready_at'] ?? null,
                'end_shift_at'              => $todayRecord['end_shift_at'] ?? null,
                'login_time'                => $todayRecord['login_time'] ?? null,
                'ready_time'                => $todayRecord['ready_time'] ?? null,
                'end_shift_time'            => $todayRecord['end_shift_time'] ?? null,
                'daily_matrix'              => $dailyMatrix,
            ];
        }

        $dailyTargetComposition = $period->daily_category_composition ?: AutoDistributionEngineService::DAILY_CATEGORY_TARGETS;
        $dailyTotalPerQa = array_sum($dailyTargetComposition);
        $totalPotentialDailyTickets = count($todayReadyQas) * $dailyTotalPerQa;

        // Group summary counts
        $standbyCount = collect($qaRosterCards)->filter(fn($c) => $c['today_status'] === self::STATUS_STANDBY)->count();
        $endShiftCount = collect($qaRosterCards)->filter(fn($c) => $c['today_status'] === self::STATUS_END_SHIFT)->count();
        $pureOffCount = collect($qaRosterCards)->filter(fn($c) => in_array($c['today_status'], [self::STATUS_OFF_DAY, self::STATUS_LEAVE, self::STATUS_SICK, self::STATUS_TRAINING]))->count();

        return [
            'period'                => $periodCode,
            'target_date'           => $targetDateStr,
            'days_in_month'         => $daysInMonth,
            'daily_total_per_qa'    => $dailyTotalPerQa,
            'category_composition'  => $dailyTargetComposition,
            'summary' => [
                'total_qa_evaluators'           => count($qaNames),
                'active_duty_qas_count'         => count($todayReadyQas),
                'standby_qas_count'             => $standbyCount,
                'end_shift_qas_count'           => $endShiftCount,
                'off_duty_qas_count'            => $pureOffCount,
                'ready_qa_names'                => $todayReadyQas,
                'off_qa_details'                => $todayOffQas,
                'potential_daily_tickets'       => $totalPotentialDailyTickets,
                'allocation_formula'            => count($todayReadyQas) . " QA On Duty × {$dailyTotalPerQa} Tiket = {$totalPotentialDailyTickets} Tiket Hari Ini",
            ],
            'evaluators'            => $qaRosterCards,
        ];
    }

    /**
     * Get list of QA evaluator names who are ON DUTY / Ready for a target date.
     */
    public static function getReadyQaNamesForDate(string $periodCode, string $dateStr): array
    {
        $roster = self::getPeriodRoster($periodCode, $dateStr);
        $readyNames = $roster['summary']['ready_qa_names'] ?? [];
        // Only return QA evaluators who are explicitly ON_DUTY / Ready
        return $readyNames;
    }

    /**
     * Toggle or set QA attendance status for a specific date.
     * With Just-In-Time (JIT) Auto-Pull Logic for Shift Siang / Ready QAs
     * and Safe Release for Off Day / End Shift / Leave QAs (Rule: No Unworked Backlogs).
     */
    public static function setQaReadiness(
        string $periodCode,
        string $evaluatorName,
        string $dateStr,
        string $status = self::STATUS_ON_DUTY,
        ?bool $isReady = null,
        ?string $shift = 'Normal',
        ?string $notes = null,
        bool $autoPullTickets = true
    ): array {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $targetDate = Carbon::parse($dateStr)->format('Y-m-d');

        // Normalize evaluator name and resolve user
        $normalizedInput = strtoupper(trim(str_replace('.', ' ', $evaluatorName)));
        $user = User::where('role', 'quality_assurance')
            ->get()
            ->first(function($u) use ($normalizedInput, $evaluatorName) {
                $un = strtoupper(trim(str_replace('.', ' ', $u->name)));
                return $un === $normalizedInput || $u->name === $evaluatorName;
            });

        $cleanName = $user ? $user->name : $evaluatorName;
        $computedIsReady = $isReady !== null ? (bool)$isReady : ($status === self::STATUS_ON_DUTY);

        // Fetch existing record to preserve login_at / ready_at
        $existingRecord = SamplingQaAttendance::where('evaluator_name', $cleanName)
            ->whereDate('work_date', $targetDate)
            ->first();

        $loginAt = $existingRecord?->login_at;
        $readyAt = $existingRecord?->ready_at;
        $endShiftAt = $existingRecord?->end_shift_at;

        if ($status === self::STATUS_ON_DUTY || $computedIsReady) {
            $readyAt = $readyAt ?: now();
            $loginAt = $loginAt ?: now();
            $endShiftAt = null; // Clear end_shift_at if resuming/starting duty
            $computedIsReady = true;
        } elseif ($status === self::STATUS_END_SHIFT) {
            $endShiftAt = now();
            $computedIsReady = false;
        } elseif ($status === self::STATUS_STANDBY) {
            $loginAt = $loginAt ?: now();
            $readyAt = null; // Standby clears ready state
            $computedIsReady = false;
        } else {
            $computedIsReady = false;
        }

        // Update or insert with clean evaluator name
        $record = SamplingQaAttendance::updateOrCreate(
            [
                'evaluator_name' => $cleanName,
                'work_date'      => $targetDate,
            ],
            [
                'sampling_period_id' => $period->id,
                'evaluator_id'       => $user?->id,
                'status'             => $status,
                'is_ready'           => $computedIsReady,
                'shift'              => $shift ?: 'Normal',
                'notes'              => $notes,
                'login_at'           => $loginAt,
                'ready_at'           => $readyAt,
                'end_shift_at'       => $endShiftAt,
            ]
        );

        // Also update any legacy row with dot-separated name to keep database consistent
        if ($cleanName !== $evaluatorName) {
            SamplingQaAttendance::where('evaluator_name', $evaluatorName)
                ->where('work_date', $targetDate)
                ->where('id', '!=', $record->id)
                ->delete();
        }

        $jitPulledCount = 0;
        $releasedCount = 0;
        $jitNotice = '';

        // ---------------------------------------------------------------------
        // JIT LOGIC 1: If ON_DUTY, check if QA needs daily tickets (JIT Auto-Pull)
        // ---------------------------------------------------------------------
        if ($computedIsReady && $status === self::STATUS_ON_DUTY && $autoPullTickets) {
            $assignedToday = SamplingAssignment::where('sampling_period_id', $period->id)
                ->whereDate('assigned_at', $targetDate)
                ->where(function($q) use ($cleanName, $evaluatorName) {
                    $q->where('evaluator_name', $cleanName)
                      ->orWhere('evaluator_name', $evaluatorName);
                })
                ->where('status', '!=', 'CANCELLED')
                ->count();

            $dailyComp = $period->daily_category_composition ?: AutoDistributionEngineService::DAILY_CATEGORY_TARGETS;
            $dailyTotalTarget = array_sum($dailyComp) ?: 20;

            if ($assignedToday < $dailyTotalTarget) {
                try {
                    $distResult = AutoDistributionEngineService::runDailyDistribution(
                        $periodCode,
                        $targetDate,
                        [$cleanName],
                        false
                    );
                    $jitPulledCount = $distResult['total_inserted'] ?? ($distResult['qa_allocations'][$cleanName]['TOTAL'] ?? 0);
                    if ($jitPulledCount > 0) {
                        $jitNotice = " ({$jitPulledCount} tiket sampling harian otomatis ditarik JIT ke bucket).";
                    }
                } catch (\Exception $e) {
                    // Pool might be empty, log but don't fail status update
                    $jitNotice = " (Cadangan tiket mentah di pool kosong atau telah habis).";
                }
            }
        }

        // ---------------------------------------------------------------------
        // JIT LOGIC 2: If OFF_DAY / LEAVE / SICK / TRAINING, safely release unworked tickets
        // NOTE: For END_SHIFT and STANDBY, tickets REMAIN IN QA BUCKET as Backlog / Carry-Over
        // so QA can finish them later and SPV can audit daily performance (Target vs Realisasi).
        // ---------------------------------------------------------------------
        if (in_array($status, [self::STATUS_OFF_DAY, self::STATUS_LEAVE, self::STATUS_SICK, self::STATUS_TRAINING])) {
            $unworkedTickets = SamplingAssignment::where('sampling_period_id', $period->id)
                ->whereDate('assigned_at', $targetDate)
                ->where(function($q) use ($cleanName, $evaluatorName) {
                    $q->where('evaluator_name', $cleanName)
                      ->orWhere('evaluator_name', $evaluatorName);
                })
                ->whereIn('status', ['ASSIGNED', 'IN_PROGRESS']);

            $releasedCount = $unworkedTickets->count();
            if ($releasedCount > 0) {
                $unworkedTickets->delete();
                $record->update([
                    'tickets_distributed_count' => max(0, (int)$record->tickets_distributed_count - $releasedCount),
                ]);
                $jitNotice = " (Sebanyak {$releasedCount} tiket antrean yang belum dinilai telah diamankan/dilepas kembali ke pool cadangan).";
            }
        }

        // Trigger live sync broadcast so Supervisor & QA views update immediately
        \App\Services\NotificationService::triggerSync('qa_attendance_changed', [
            'evaluator'      => $cleanName,
            'status'         => $status,
            'is_ready'       => $computedIsReady,
            'shift'          => $shift ?: 'Normal',
            'date'           => $targetDate,
            'pulled_count'   => $jitPulledCount,
            'released_count' => $releasedCount,
        ]);

        return [
            'success'        => true,
            'record'         => $record,
            'status'         => $status,
            'is_ready'       => $computedIsReady,
            'shift'          => $shift ?: 'Normal',
            'pulled_count'   => $jitPulledCount,
            'released_count' => $releasedCount,
            'message'        => "Status kehadiran {$cleanName} pada {$targetDate} diatur ke {$status} (" . ($computedIsReady ? "ON DUTY [{$shift}]" : 'OFF DAY / Standby') . "){$jitNotice}",
        ];
    }

    /**
     * Execute Shift Cutoff Sweep:
     * Sweeps all QAs who are NOT yet ON_DUTY by the designated cutoff time.
     * Sets their status to OFF_DAY / LEAVE, releases any unworked tickets, and protects them from SLA penalties.
     */
    public static function executeCutoffSweep(
        string $periodCode,
        string $dateStr,
        string $cutoffStatus = self::STATUS_OFF_DAY,
        ?string $shiftFilter = null,
        ?string $reason = null
    ): array {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $targetDate = Carbon::parse($dateStr)->format('Y-m-d');

        // Query all attendance records for date
        $query = SamplingQaAttendance::where('sampling_period_id', $period->id)
            ->whereDate('work_date', $targetDate);

        if ($shiftFilter && $shiftFilter !== 'all') {
            $query->where('shift', $shiftFilter);
        }

        $allRecords = $query->get();
        $sweptQas = [];
        $totalReleasedTickets = 0;
        $activeOnDutyCount = 0;

        foreach ($allRecords as $rec) {
            if ($rec->is_ready && $rec->status === self::STATUS_ON_DUTY) {
                $activeOnDutyCount++;
                continue; // QA is already on duty
            }

            // QA is in Standby / Not ready past cutoff
            $qaName = $rec->evaluator_name;
            $prevStatus = $rec->status;

            // Release any unworked assignments
            $unworked = SamplingAssignment::where('sampling_period_id', $period->id)
                ->whereDate('assigned_at', $targetDate)
                ->where('evaluator_name', $qaName)
                ->whereIn('status', ['ASSIGNED', 'IN_PROGRESS']);
            
            $relCount = $unworked->count();
            if ($relCount > 0) {
                $unworked->delete();
                $totalReleasedTickets += $relCount;
            }

            $cutoffNote = $reason ?: "Cutoff Shift: Ditandai {$cutoffStatus} (Tidak Bertugas / Libur)";
            $rec->update([
                'status'                    => $cutoffStatus,
                'is_ready'                  => false,
                'notes'                     => $cutoffNote,
                'tickets_distributed_count' => max(0, (int)$rec->tickets_distributed_count - $relCount),
            ]);

            $sweptQas[] = [
                'evaluator_name'   => $qaName,
                'previous_status'  => $prevStatus,
                'new_status'       => $cutoffStatus,
                'shift'            => $rec->shift ?: 'Normal',
                'released_tickets' => $relCount,
            ];
        }

        // Trigger sync
        \App\Services\NotificationService::triggerSync('qa_cutoff_sweep_executed', [
            'date'                  => $targetDate,
            'swept_count'           => count($sweptQas),
            'active_on_duty_count'  => $activeOnDutyCount,
            'released_tickets'      => $totalReleasedTickets,
        ]);

        \App\Services\NotificationService::send([
            'title'       => "Cutoff Shift [{$targetDate}] Dijalankan",
            'message'     => "Sebanyak " . count($sweptQas) . " QA yang belum On Duty telah ditandai {$cutoffStatus}. {$totalReleasedTickets} tiket antrean diamankan kembali ke pool.",
            'type'        => 'sampling',
            'action_url'  => '/auto-distribution',
            'target_role' => 'supervisor',
        ]);

        return [
            'success'                => true,
            'period'                 => $periodCode,
            'date'                   => $targetDate,
            'cutoff_status'          => $cutoffStatus,
            'shift_filter'           => $shiftFilter ?: 'Semua Shift',
            'swept_qas_count'        => count($sweptQas),
            'swept_qas'              => $sweptQas,
            'active_on_duty_count'   => $activeOnDutyCount,
            'total_released_tickets' => $totalReleasedTickets,
            'message'                => "Berhasil mengeksekusi Cutoff Shift: " . count($sweptQas) . " QA ditandai {$cutoffStatus}, {$totalReleasedTickets} tiket diamankan kembali ke standby pool.",
        ];
    }

    /**
     * Bulk update roster for multiple dates / evaluators.
     */
    public static function bulkUpdateRoster(string $periodCode, array $entries): array
    {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $updatedCount = 0;

        foreach ($entries as $entry) {
            $evaluatorName = $entry['evaluator_name'] ?? null;
            $dateStr = $entry['date'] ?? null;
            $status = $entry['status'] ?? self::STATUS_ON_DUTY;
            $shift = $entry['shift'] ?? 'Normal';
            $notes = $entry['notes'] ?? null;

            if ($evaluatorName && $dateStr) {
                self::setQaReadiness($periodCode, $evaluatorName, $dateStr, $status, null, $shift, $notes);
                $updatedCount++;
            }
        }

        return [
            'success'       => true,
            'updated_count' => $updatedCount,
            'message'       => "Berhasil memperbarui {$updatedCount} jadwal kerja roster QA.",
        ];
    }

    /**
     * Get single QA duty status and ticket metrics for a specific date (Rule: QA Menentukan Kerja Sendiri).
     */
    public static function getQaReadiness(string $periodCode, string $evaluatorName, string $dateStr): array
    {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $targetDate = Carbon::parse($dateStr)->format('Y-m-d');
        $today = Carbon::parse($targetDate)->startOfDay();

        $evalClean = str_replace(' ', '.', strtoupper(trim($evaluatorName)));
        $evalWithSpace = str_replace('.', ' ', strtoupper(trim($evaluatorName)));

        $rec = SamplingQaAttendance::where('sampling_period_id', $period->id)
            ->whereDate('work_date', $targetDate)
            ->where(function($q) use ($evaluatorName, $evalClean, $evalWithSpace) {
                $q->where('evaluator_name', $evaluatorName)
                  ->orWhere('evaluator_name', $evalClean)
                  ->orWhere('evaluator_name', $evalWithSpace);
            })
            ->first();

        $assignedToday = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereDate('assigned_at', $today)
            ->where(function($q) use ($evaluatorName, $evalClean, $evalWithSpace) {
                $q->where('evaluator_name', $evaluatorName)
                  ->orWhere('evaluator_name', $evalClean)
                  ->orWhere('evaluator_name', $evalWithSpace);
            })
            ->where('status', '!=', 'CANCELLED')
            ->count();

        $completedToday = SamplingAssignment::where('sampling_period_id', $period->id)
            ->whereDate('completed_at', $today)
            ->where(function($q) use ($evaluatorName, $evalClean, $evalWithSpace) {
                $q->where('evaluator_name', $evaluatorName)
                  ->orWhere('evaluator_name', $evalClean)
                  ->orWhere('evaluator_name', $evalWithSpace);
            })
            ->where('status', 'COMPLETED')
            ->count();

        $status = $rec ? $rec->status : self::STATUS_STANDBY;
        if ($status === self::STATUS_ON_DUTY && empty($rec?->ready_at)) {
            $status = self::STATUS_STANDBY;
        }
        $isReady = $rec ? ((bool)$rec->is_ready && $rec->status === self::STATUS_ON_DUTY && !empty($rec->ready_at)) : false;

        return [
            'evaluator_name'        => $evaluatorName,
            'period'                => $periodCode,
            'date'                  => $targetDate,
            'status'                => $status,
            'is_ready'              => $isReady,
            'is_on_duty'            => $isReady,
            'shift'                 => $rec ? ($rec->shift ?: 'Normal') : 'Normal',
            'notes'                 => $rec ? $rec->notes : null,
            'login_at'              => $rec?->login_at ? $rec->login_at->toIso8601String() : null,
            'ready_at'              => $rec?->ready_at ? $rec->ready_at->toIso8601String() : null,
            'end_shift_at'          => $rec?->end_shift_at ? $rec->end_shift_at->toIso8601String() : null,
            'login_time'            => $rec?->login_at ? $rec->login_at->format('H:i') : null,
            'ready_time'            => $rec?->ready_at ? $rec->ready_at->format('H:i') : null,
            'end_shift_time'        => $rec?->end_shift_at ? $rec->end_shift_at->format('H:i') : null,
            'today_assigned_count'  => $assignedToday,
            'today_completed_count' => $completedToday,
            'remaining_quota'       => max(0, 20 - $assignedToday),
        ];
    }

    /**
     * Check if a QA Evaluator is ON DUTY for a given date or today.
     */
    public static function isQaOnDutyToday(string $evaluatorName, ?string $periodCode = null, ?string $dateStr = null): bool
    {
        $periodCode = $periodCode ?: now()->format('Y-m');
        $targetDate = $dateStr ?: now()->format('Y-m-d');
        $readiness = self::getQaReadiness($periodCode, $evaluatorName, $targetDate);
        return !empty($readiness['is_on_duty']);
    }

    /**
     * Assert that QA is ON DUTY today, otherwise throw ValidationException.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public static function assertQaOnDuty(string $evaluatorName, ?string $periodCode = null, ?string $dateStr = null): void
    {
        $periodCode = $periodCode ?: now()->format('Y-m');
        $targetDate = $dateStr ?: now()->format('Y-m-d');

        if (!self::isQaOnDutyToday($evaluatorName, $periodCode, $targetDate)) {
            $formattedDate = Carbon::parse($targetDate)->locale('id')->isoFormat('D MMMM Y');
            throw \Illuminate\Validation\ValidationException::withMessages([
                'duty' => [
                    "Evaluator '{$evaluatorName}' saat ini berstatus STANDBY / OFF DAY ({$formattedDate}). Silakan aktifkan status READY (ON DUTY) terlebih dahulu untuk dapat mengerjakan, mengubah status, atau menyimpan penilaian sampling tiket."
                ]
            ]);
        }
    }
}

