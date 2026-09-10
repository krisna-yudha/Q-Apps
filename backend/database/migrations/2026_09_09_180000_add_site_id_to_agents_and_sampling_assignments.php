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
        if (Schema::hasTable('agents')) {
            Schema::table('agents', function (Blueprint $table) {
                if (!Schema::hasColumn('agents', 'site_id')) {
                    $table->foreignId('site_id')->nullable()->after('trainer_id')->constrained('sites')->nullOnDelete();
                }
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_assignments', 'site_id')) {
                    $table->foreignId('site_id')->nullable()->after('service_id')->constrained('sites')->nullOnDelete();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (Schema::hasColumn('sampling_assignments', 'site_id')) {
                    $table->dropForeign(['site_id']);
                    $table->dropColumn('site_id');
                }
            });
        }

        if (Schema::hasTable('agents')) {
            Schema::table('agents', function (Blueprint $table) {
                if (Schema::hasColumn('agents', 'site_id')) {
                    $table->dropForeign(['site_id']);
                    $table->dropColumn('site_id');
                }
            });
        }
    }
};
