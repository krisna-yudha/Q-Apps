<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Ensure each employee only has status = 1 on their latest assignment period,
     * deactivating historical assignments to prevent role collision when an employee changes positions.
     */
    public function up(): void
    {
        try {
            DB::statement("
                UPDATE employee_assignments ea
                JOIN (
                    SELECT employee_id, MAX(period_month) as max_period
                    FROM employee_assignments
                    GROUP BY employee_id
                ) latest ON ea.employee_id = latest.employee_id
                SET ea.status = CASE WHEN ea.period_month = latest.max_period THEN 1 ELSE 0 END
            ");
        } catch (\Throwable $e) {
            // Fallback for database engines where JOIN in UPDATE is structured differently
            try {
                $latestAssignments = DB::table('employee_assignments')
                    ->select('employee_id', DB::raw('MAX(period_month) as max_period'))
                    ->groupBy('employee_id')
                    ->get();

                foreach ($latestAssignments as $item) {
                    if ($item->max_period) {
                        DB::table('employee_assignments')
                            ->where('employee_id', $item->employee_id)
                            ->where('period_month', $item->max_period)
                            ->update(['status' => true]);

                        DB::table('employee_assignments')
                            ->where('employee_id', $item->employee_id)
                            ->where('period_month', '<', $item->max_period)
                            ->update(['status' => false]);
                    }
                }
            } catch (\Throwable $fallbackEx) {}
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reversal needed
    }
};

