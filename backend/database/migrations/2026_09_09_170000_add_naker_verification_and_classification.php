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
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (!Schema::hasColumn('ca_assessments', 'cso_classification')) {
                    $table->string('cso_classification', 50)->default('UNVERIFIED')->after('employee_id')->index();
                }
                if (!Schema::hasColumn('ca_assessments', 'is_naker_verified')) {
                    $table->boolean('is_naker_verified')->default(false)->after('cso_classification')->index();
                }
            });
        }

        if (Schema::hasTable('agents')) {
            Schema::table('agents', function (Blueprint $table) {
                if (!Schema::hasColumn('agents', 'cso_classification')) {
                    $table->string('cso_classification', 50)->default('UNVERIFIED')->after('channel')->index();
                }
                if (!Schema::hasColumn('agents', 'is_naker_verified')) {
                    $table->boolean('is_naker_verified')->default(false)->after('cso_classification')->index();
                }
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_assignments', 'cso_classification')) {
                    $table->string('cso_classification', 50)->default('VERIFIED_NAKER')->after('category_name')->index();
                }
                if (!Schema::hasColumn('sampling_assignments', 'is_naker_verified')) {
                    $table->boolean('is_naker_verified')->default(true)->after('cso_classification')->index();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (Schema::hasColumn('ca_assessments', 'is_naker_verified')) {
                    $table->dropColumn('is_naker_verified');
                }
                if (Schema::hasColumn('ca_assessments', 'cso_classification')) {
                    $table->dropColumn('cso_classification');
                }
            });
        }

        if (Schema::hasTable('agents')) {
            Schema::table('agents', function (Blueprint $table) {
                if (Schema::hasColumn('agents', 'is_naker_verified')) {
                    $table->dropColumn('is_naker_verified');
                }
                if (Schema::hasColumn('agents', 'cso_classification')) {
                    $table->dropColumn('cso_classification');
                }
            });
        }

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (Schema::hasColumn('sampling_assignments', 'is_naker_verified')) {
                    $table->dropColumn('is_naker_verified');
                }
                if (Schema::hasColumn('sampling_assignments', 'cso_classification')) {
                    $table->dropColumn('cso_classification');
                }
            });
        }
    }
};
