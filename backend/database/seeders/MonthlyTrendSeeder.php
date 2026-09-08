<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MonthlyTrendSeeder extends Seeder
{
    public function run()
    {
        DB::table('monthly_trends')->truncate();

        // 2026 Monthly Trends
        $months2026 = [
            ['month_name' => 'Jan', 'month_num' => 1, 'year' => 2026, 'ca_score' => 88.4, 'fcr_score' => 82.1, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1850],
            ['month_name' => 'Feb', 'month_num' => 2, 'year' => 2026, 'ca_score' => 89.2, 'fcr_score' => 83.5, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2020],
            ['month_name' => 'Mar', 'month_num' => 3, 'year' => 2026, 'ca_score' => 90.1, 'fcr_score' => 84.8, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2180],
            ['month_name' => 'Apr', 'month_num' => 4, 'year' => 2026, 'ca_score' => 91.0, 'fcr_score' => 86.2, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2340],
            ['month_name' => 'Mei', 'month_num' => 5, 'year' => 2026, 'ca_score' => 91.8, 'fcr_score' => 87.0, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2490],
            ['month_name' => 'Jun', 'month_num' => 6, 'year' => 2026, 'ca_score' => 92.4, 'fcr_score' => 88.1, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2610],
            ['month_name' => 'Jul', 'month_num' => 7, 'year' => 2026, 'ca_score' => 92.8, 'fcr_score' => 88.5, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2750],
            ['month_name' => 'Agu', 'month_num' => 8, 'year' => 2026, 'ca_score' => 93.3, 'fcr_score' => 89.4, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2884],
            ['month_name' => 'Sep', 'month_num' => 9, 'year' => 2026, 'ca_score' => 93.6, 'fcr_score' => 89.6, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2950],
            ['month_name' => 'Okt', 'month_num' => 10, 'year' => 2026, 'ca_score' => 94.0, 'fcr_score' => 89.8, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 3050],
            ['month_name' => 'Nov', 'month_num' => 11, 'year' => 2026, 'ca_score' => 94.5, 'fcr_score' => 90.2, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 3120],
            ['month_name' => 'Des', 'month_num' => 12, 'year' => 2026, 'ca_score' => 95.0, 'fcr_score' => 90.8, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 3200],
        ];

        // 2025 Monthly Trends Baseline
        $months2025 = [
            ['month_name' => 'Jan', 'month_num' => 1, 'year' => 2025, 'ca_score' => 85.2, 'fcr_score' => 78.5, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1420],
            ['month_name' => 'Feb', 'month_num' => 2, 'year' => 2025, 'ca_score' => 86.0, 'fcr_score' => 79.2, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1510],
            ['month_name' => 'Mar', 'month_num' => 3, 'year' => 2025, 'ca_score' => 86.8, 'fcr_score' => 80.1, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1630],
            ['month_name' => 'Apr', 'month_num' => 4, 'year' => 2025, 'ca_score' => 87.5, 'fcr_score' => 81.0, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1700],
            ['month_name' => 'Mei', 'month_num' => 5, 'year' => 2025, 'ca_score' => 88.0, 'fcr_score' => 81.8, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1750],
            ['month_name' => 'Jun', 'month_num' => 6, 'year' => 2025, 'ca_score' => 88.4, 'fcr_score' => 82.3, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1800],
            ['month_name' => 'Jul', 'month_num' => 7, 'year' => 2025, 'ca_score' => 88.9, 'fcr_score' => 82.8, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1860],
            ['month_name' => 'Agu', 'month_num' => 8, 'year' => 2025, 'ca_score' => 89.2, 'fcr_score' => 83.2, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1920],
            ['month_name' => 'Sep', 'month_num' => 9, 'year' => 2025, 'ca_score' => 89.6, 'fcr_score' => 83.7, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 1980],
            ['month_name' => 'Okt', 'month_num' => 10, 'year' => 2025, 'ca_score' => 90.0, 'fcr_score' => 84.1, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2050],
            ['month_name' => 'Nov', 'month_num' => 11, 'year' => 2025, 'ca_score' => 90.3, 'fcr_score' => 84.5, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2100],
            ['month_name' => 'Des', 'month_num' => 12, 'year' => 2025, 'ca_score' => 90.8, 'fcr_score' => 85.0, 'target_ca' => 85.0, 'target_fcr' => 100.0, 'total_calls' => 2200],
        ];

        $now = now();
        foreach (array_merge($months2026, $months2025) as $row) {
            $row['created_at'] = $now;
            $row['updated_at'] = $now;
            DB::table('monthly_trends')->insert($row);
        }
    }
}
