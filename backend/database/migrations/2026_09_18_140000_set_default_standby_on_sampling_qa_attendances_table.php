<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('sampling_qa_attendances')) {
            // Update table column defaults: default status to 'STANDBY' and is_ready to 0 (false)
            Schema::table('sampling_qa_attendances', function (Blueprint $table) {
                $table->string('status', 30)->default('STANDBY')->change();
                $table->boolean('is_ready')->default(false)->change();
            });

            // Normalize existing attendance rows where QA never explicitly set ready_at
            // If ready_at is NULL and status is 'ON_DUTY', revert to 'STANDBY' and is_ready = 0
            DB::table('sampling_qa_attendances')
                ->where('status', 'ON_DUTY')
                ->whereNull('ready_at')
                ->update([
                    'status'   => 'STANDBY',
                    'is_ready' => 0,
                    'notes'    => 'Standby (Belum Mulai On Duty)',
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sampling_qa_attendances')) {
            Schema::table('sampling_qa_attendances', function (Blueprint $table) {
                $table->string('status', 30)->default('ON_DUTY')->change();
                $table->boolean('is_ready')->default(true)->change();
            });
        }
    }
};
