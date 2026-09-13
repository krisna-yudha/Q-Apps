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
    public const STATUS_ON_DUTY  = 'ON_DUTY';
    public const STATUS_OFF_DAY  = 'OFF_DAY';
    public const STATUS_LEAVE    = 'LEAVE';
    public const STATUS_SICK     = 'SICK';
    public const STATUS_TRAINING = 'TRAINING';

    public const STANDARD_QA_EVALUATORS = [
        'ALMIRA PARAMITHA',
        'DEWI RIKA IRAWATI',
        'DHITA KHARISMA',
        'DIAN WAHYU WIBOWO',
        'FINA ANDRIYANI',
        'HANI DWI SURYO',
        'IIN SUGIARTI',
        'TIARA RAMADHANI'
    ];

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
            $qaNames = self::STANDARD_QA_EVALUATORS;
        }

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
                    // Default initial state: OFF_DAY / Standby (QA activates Ready when starting work)
                    $defaultStatus = self::STATUS_OFF_DAY;

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
                $isDuty = $rec->is_ready && ($rec->status === self::STATUS_ON_DUTY);

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
                    'status'            => $rec->status,
                    'is_ready'          => (bool)$rec->is_ready,
                    'shift'             => $rec->shift ?: 'Normal',
                    'notes'             => $rec->notes,
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
                            'name'   => $qaName,
                            'status' => $rec->status,
                            'notes'  => $rec->notes ?: 'Off Day / Libur',
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
                'today_status'              => $todayRecord['status'] ?? self::STATUS_ON_DUTY,
                'today_is_ready'            => $todayRecord['is_ready'] ?? true,
                'today_shift'               => $todayRecord['shift'] ?? 'Normal',
                'today_notes'               => $todayRecord['notes'] ?? '',
                'daily_matrix'              => $dailyMatrix,
            ];
        }

        $dailyTargetComposition = $period->daily_category_composition ?: AutoDistributionEngineService::DAILY_CATEGORY_TARGETS;
        $dailyTotalPerQa = array_sum($dailyTargetComposition);
        $totalPotentialDailyTickets = count($todayReadyQas) * $dailyTotalPerQa;

        return [
            'period'                => $periodCode,
            'target_date'           => $targetDateStr,
            'days_in_month'         => $daysInMonth,
            'daily_total_per_qa'    => $dailyTotalPerQa,
            'category_composition'  => $dailyTargetComposition,
            'summary' => [
                'total_qa_evaluators'           => count($qaNames),
                'active_duty_qas_count'         => count($todayReadyQas),
                'off_duty_qas_count'            => count($todayOffQas),
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
     */
    public static function setQaReadiness(
        string $periodCode,
        string $evaluatorName,
        string $dateStr,
        string $status = self::STATUS_ON_DUTY,
        ?bool $isReady = null,
        ?string $shift = 'Normal',
        ?string $notes = null
    ): array {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $targetDate = Carbon::parse($dateStr)->format('Y-m-d');

        // Normalize evaluator name to standard format (uppercase, space-separated)
        $cleanName = strtoupper(trim(str_replace('.', ' ', $evaluatorName)));
        // Match against standard QA evaluators if exact match found
        foreach (self::STANDARD_QA_EVALUATORS as $std) {
            if (strtoupper(trim(str_replace('.', ' ', $std))) === $cleanName) {
                $cleanName = $std;
                break;
            }
        }

        $computedIsReady = $isReady !== null ? (bool)$isReady : ($status === self::STATUS_ON_DUTY);

        $user = User::where('name', $cleanName)
            ->orWhere('name', $evaluatorName)
            ->first();

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
            ]
        );

        // Also update any legacy row with dot-separated name to keep database consistent
        if ($cleanName !== $evaluatorName) {
            SamplingQaAttendance::where('evaluator_name', $evaluatorName)
                ->where('work_date', $targetDate)
                ->where('id', '!=', $record->id)
                ->delete();
        }

        // Trigger live sync broadcast so Supervisor & QA views update immediately
        \App\Services\NotificationService::triggerSync('qa_attendance_changed', [
            'evaluator' => $cleanName,
            'status'    => $status,
            'is_ready'  => $computedIsReady,
            'date'      => $targetDate,
        ]);

        return [
            'success'   => true,
            'record'    => $record,
            'message'   => "Status kehadiran {$cleanName} pada {$targetDate} diubah menjadi {$status} (" . ($computedIsReady ? 'ON DUTY / Ready' : 'OFF DAY / Tidak Siap') . ").",
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

        $status = $rec ? $rec->status : self::STATUS_OFF_DAY;
        $isReady = $rec ? ((bool)$rec->is_ready && $rec->status === self::STATUS_ON_DUTY) : false;

        return [
            'evaluator_name'        => $evaluatorName,
            'period'                => $periodCode,
            'date'                  => $targetDate,
            'status'                => $status,
            'is_ready'              => $isReady,
            'is_on_duty'            => $isReady,
            'shift'                 => $rec ? ($rec->shift ?: 'Normal') : 'Normal',
            'notes'                 => $rec ? $rec->notes : null,
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

