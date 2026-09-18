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
        if (Schema::hasTable('sampling_qa_attendances')) {
            Schema::table('sampling_qa_attendances', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_qa_attendances', 'login_at')) {
                    $table->timestamp('login_at')->nullable()->after('notes');
                }
                if (!Schema::hasColumn('sampling_qa_attendances', 'ready_at')) {
                    $table->timestamp('ready_at')->nullable()->after('login_at');
                }
                if (!Schema::hasColumn('sampling_qa_attendances', 'end_shift_at')) {
                    $table->timestamp('end_shift_at')->nullable()->after('ready_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sampling_qa_attendances')) {
            Schema::table('sampling_qa_attendances', function (Blueprint $table) {
                if (Schema::hasColumn('sampling_qa_attendances', 'login_at')) {
                    $table->dropColumn('login_at');
                }
                if (Schema::hasColumn('sampling_qa_attendances', 'ready_at')) {
                    $table->dropColumn('ready_at');
                }
                if (Schema::hasColumn('sampling_qa_attendances', 'end_shift_at')) {
                    $table->dropColumn('end_shift_at');
                }
            });
        }
    }
};
