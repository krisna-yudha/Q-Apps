<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add Bad Rating fields to ca_assessments
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (!Schema::hasColumn('ca_assessments', 'is_bad_rating')) {
                    $table->boolean('is_bad_rating')->default(false)->after('fcr_note');
                }
                if (!Schema::hasColumn('ca_assessments', 'csat_rating')) {
                    $table->tinyInteger('csat_rating')->nullable()->after('is_bad_rating'); // 1-5 scale
                }
                if (!Schema::hasColumn('ca_assessments', 'bad_rating_reason')) {
                    $table->string('bad_rating_reason', 255)->nullable()->after('csat_rating');
                }
            });
        }

        // 2. Add Bad Rating fields & customer info to sampling_assignments (queue)
        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_assignments', 'customer_name')) {
                    $table->string('customer_name', 150)->nullable()->after('category_name');
                }
                if (!Schema::hasColumn('sampling_assignments', 'customer_phone')) {
                    $table->string('customer_phone', 50)->nullable()->after('customer_name');
                }
                if (!Schema::hasColumn('sampling_assignments', 'is_bad_rating')) {
                    $table->boolean('is_bad_rating')->default(false)->after('status');
                }
                if (!Schema::hasColumn('sampling_assignments', 'csat_rating')) {
                    $table->tinyInteger('csat_rating')->nullable()->after('is_bad_rating');
                }
                if (!Schema::hasColumn('sampling_assignments', 'bad_rating_reason')) {
                    $table->string('bad_rating_reason', 255)->nullable()->after('csat_rating');
                }
            });
        }

        // 3. Add weekly_quota_targets to sampling_periods and sampling_targets
        if (Schema::hasTable('sampling_periods')) {
            Schema::table('sampling_periods', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_periods', 'weekly_quota_targets')) {
                    $table->json('weekly_quota_targets')->nullable()->after('daily_category_composition');
                }
            });
        }

        if (Schema::hasTable('sampling_targets')) {
            Schema::table('sampling_targets', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_targets', 'weekly_quota_targets')) {
                    $table->json('weekly_quota_targets')->nullable()->after('additional_target');
                }
            });
        }

        // 4. Add period_month to employee_assignments for monthly plotting preservation
        if (Schema::hasTable('employee_assignments')) {
            Schema::table('employee_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('employee_assignments', 'period_month')) {
                    $table->string('period_month', 20)->nullable()->default('2026-08')->after('trainer_id');
                    $table->index('period_month');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                $table->dropColumn(['is_bad_rating', 'csat_rating', 'bad_rating_reason']);
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                $table->dropColumn(['customer_name', 'customer_phone', 'is_bad_rating', 'csat_rating', 'bad_rating_reason']);
            });
        }

        if (Schema::hasTable('sampling_periods')) {
            Schema::table('sampling_periods', function (Blueprint $table) {
                $table->dropColumn('weekly_quota_targets');
            });
        }

        if (Schema::hasTable('sampling_targets')) {
            Schema::table('sampling_targets', function (Blueprint $table) {
                $table->dropColumn('weekly_quota_targets');
            });
        }

        if (Schema::hasTable('employee_assignments')) {
            Schema::table('employee_assignments', function (Blueprint $table) {
                $table->dropColumn('period_month');
            });
        }
    }
};
