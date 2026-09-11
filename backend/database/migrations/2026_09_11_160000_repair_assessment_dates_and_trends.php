<?php

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\MonthlyTrend;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('ca_assessments')) {
            return;
        }

        // 1. Repair NULL dates in ca_assessments
        $records = DB::table('ca_assessments')
            ->where(function ($q) {
                $q->whereNull('measurement_at')
                  ->orWhereNull('transaction_at')
                  ->orWhere('measurement_at', '')
                  ->orWhere('transaction_at', '');
            })
            ->get();

        foreach ($records as $rec) {
            $parsedDate = null;

            // Try extract from IDCA
            if (!empty($rec->idca) && preg_match('/(202\d{5})/', $rec->idca, $m)) {
                try {
                    $parsedDate = Carbon::createFromFormat('Ymd', $m[1])->startOfDay()->toDateTimeString();
                } catch (\Exception $e) {}
            }

            // Try existing transaction_at or measurement_at
            if (!$parsedDate && !empty($rec->transaction_at)) {
                $parsedDate = $rec->transaction_at;
            }
            if (!$parsedDate && !empty($rec->measurement_at)) {
                $parsedDate = $rec->measurement_at;
            }

            // Try imported_at or created_at
            if (!$parsedDate && !empty($rec->imported_at)) {
                $parsedDate = $rec->imported_at;
            }
            if (!$parsedDate && !empty($rec->created_at)) {
                $parsedDate = $rec->created_at;
            }

            // Default fallback
            if (!$parsedDate) {
                $parsedDate = '2026-08-01 00:00:00';
            }

            DB::table('ca_assessments')->where('id', $rec->id)->update([
                'transaction_at' => $rec->transaction_at ?: $parsedDate,
                'measurement_at' => $rec->measurement_at ?: $parsedDate,
            ]);
        }

        // 2. Recalculate Agent Rollup Metrics from all valid assessments
        if (Schema::hasTable('agents')) {
            $agentAggregates = DB::table('ca_assessments')
                ->selectRaw("
                    agent_id,
                    AVG(score_ca) as avg_ca,
                    COUNT(*) as total_eval,
                    SUM(CASE WHEN UPPER(TRIM(fcr)) = 'YA' THEN 1 ELSE 0 END) as fcr_yes_count,
                    LEFT(COALESCE(MAX(measurement_at), MAX(transaction_at)), 7) as latest_period
                ")
                ->whereNotNull('agent_id')
                ->groupBy('agent_id')
                ->get();

            foreach ($agentAggregates as $agg) {
                $avgCa = (float)$agg->avg_ca;
                $totalEval = (int)$agg->total_eval;
                $avgFcr = $totalEval > 0 ? (($agg->fcr_yes_count / $totalEval) * 100) : 0;

                $status = 'Meet Target';
                if ($avgCa >= 96) $status = 'Exceed Target';
                elseif ($avgCa < 85) $status = 'Need Coaching';

                DB::table('agents')->where('id', $agg->agent_id)->update([
                    'ca_score'         => round($avgCa, 1),
                    'fcr_score'        => round($avgFcr, 1),
                    'evaluation_count' => $totalEval,
                    'status'           => $status,
                    'period_month'     => $agg->latest_period ?: '2026-08',
                ]);
            }
        }

        // 3. Recalculate Monthly Trends dynamically
        if (Schema::hasTable('monthly_trends')) {
            $distinctPeriods = DB::table('ca_assessments')
                ->selectRaw("
                    LEFT(COALESCE(measurement_at, transaction_at), 7) as period,
                    COUNT(id) as total_calls,
                    ROUND(AVG(score_ca), 1) as avg_ca,
                    ROUND(SUM(CASE WHEN UPPER(fcr) = 'YA' THEN 100 ELSE 0 END) / NULLIF(SUM(CASE WHEN UPPER(fcr) IN ('YA', 'TIDAK') THEN 1 ELSE 0 END), 0), 1) as avg_fcr
                ")
                ->whereNotNull(DB::raw("COALESCE(measurement_at, transaction_at)"))
                ->where(DB::raw("COALESCE(measurement_at, transaction_at)"), '!=', '')
                ->groupBy(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"))
                ->get();

            $monthNamesMap = [
                1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr',
                5 => 'Mei', 6 => 'Jun', 7 => 'Jul', 8 => 'Agu',
                9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des'
            ];

            foreach ($distinctPeriods as $dp) {
                if (!$dp->period) continue;
                $parts = explode('-', $dp->period);
                $y = (int)($parts[0] ?? 2026);
                $m = (int)($parts[1] ?? 8);

                DB::table('monthly_trends')->updateOrInsert(
                    ['year' => $y, 'month_num' => $m],
                    [
                        'month_name'  => $monthNamesMap[$m] ?? "M$m",
                        'ca_score'    => (float)$dp->avg_ca,
                        'fcr_score'   => $dp->avg_fcr !== null ? (float)$dp->avg_fcr : 0.0,
                        'total_calls' => (int)$dp->total_calls,
                    ]
                );
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
