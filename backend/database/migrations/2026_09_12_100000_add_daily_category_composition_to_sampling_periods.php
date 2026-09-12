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
                if (!Schema::hasColumn('sampling_periods', 'daily_category_composition')) {
                    $table->json('daily_category_composition')->nullable()->after('status');
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
                if (Schema::hasColumn('sampling_periods', 'daily_category_composition')) {
                    $table->dropColumn('daily_category_composition');
                }
            });
        }
    }
};
