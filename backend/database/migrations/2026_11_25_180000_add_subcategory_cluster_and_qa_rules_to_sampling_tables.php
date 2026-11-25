<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('sampling_periods')) {
            Schema::table('sampling_periods', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_periods', 'selected_sub_categories')) {
                    $table->json('selected_sub_categories')->nullable()->after('daily_service_composition');
                }
                if (!Schema::hasColumn('sampling_periods', 'required_sub_category_targets')) {
                    $table->json('required_sub_category_targets')->nullable()->after('selected_sub_categories');
                }
                if (!Schema::hasColumn('sampling_periods', 'qa_custom_category_rules')) {
                    $table->json('qa_custom_category_rules')->nullable()->after('required_sub_category_targets');
                }
                if (!Schema::hasColumn('sampling_periods', 'cso_clusters')) {
                    $table->json('cso_clusters')->nullable()->after('qa_custom_category_rules');
                }
                if (!Schema::hasColumn('sampling_periods', 'cso_sampling_policy')) {
                    $table->json('cso_sampling_policy')->nullable()->after('cso_clusters');
                }
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_assignments', 'sub_category_name')) {
                    $table->string('sub_category_name', 150)->nullable()->after('category_name');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sampling_periods')) {
            Schema::table('sampling_periods', function (Blueprint $table) {
                $cols = [
                    'selected_sub_categories',
                    'required_sub_category_targets',
                    'qa_custom_category_rules',
                    'cso_clusters',
                    'cso_sampling_policy',
                ];
                foreach ($cols as $col) {
                    if (Schema::hasColumn('sampling_periods', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (Schema::hasColumn('sampling_assignments', 'sub_category_name')) {
                    $table->dropColumn('sub_category_name');
                }
            });
        }
    }
};
