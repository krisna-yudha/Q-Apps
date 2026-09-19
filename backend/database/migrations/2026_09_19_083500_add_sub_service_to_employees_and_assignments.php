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
        if (Schema::hasTable('employees') && !Schema::hasColumn('employees', 'sub_service')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->string('sub_service', 150)->nullable()->after('gender')->index();
            });
        }

        if (Schema::hasTable('employee_assignments') && !Schema::hasColumn('employee_assignments', 'sub_service')) {
            Schema::table('employee_assignments', function (Blueprint $table) {
                $table->string('sub_service', 150)->nullable()->after('service_id')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('employees') && Schema::hasColumn('employees', 'sub_service')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->dropColumn('sub_service');
            });
        }

        if (Schema::hasTable('employee_assignments') && Schema::hasColumn('employee_assignments', 'sub_service')) {
            Schema::table('employee_assignments', function (Blueprint $table) {
                $table->dropColumn('sub_service');
            });
        }
    }
};
