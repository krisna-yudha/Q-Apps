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
        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (!Schema::hasColumn('sampling_assignments', 'is_extra_quota')) {
                    $table->boolean('is_extra_quota')->default(false)->after('assignment_type');
                }
                if (!Schema::hasColumn('sampling_assignments', 'valid_until')) {
                    $table->timestamp('valid_until')->nullable()->after('is_extra_quota');
                }
                if (!Schema::hasColumn('sampling_assignments', 'hold_at')) {
                    $table->timestamp('hold_at')->nullable()->after('completed_at');
                }
                if (!Schema::hasColumn('sampling_assignments', 'abandoned_at')) {
                    $table->timestamp('abandoned_at')->nullable()->after('hold_at');
                }
                if (!Schema::hasColumn('sampling_assignments', 'quota_request_id')) {
                    $table->unsignedBigInteger('quota_request_id')->nullable()->after('abandoned_at');
                }
            });

            // Modify status column to varchar so any new lifecycle status (ON_CEK, PENDING, ABANDONED) is fully supported
            \Illuminate\Support\Facades\DB::statement("
                ALTER TABLE sampling_assignments MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED'
            ");
        }

        if (!Schema::hasTable('sampling_quota_requests')) {
            Schema::create('sampling_quota_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sampling_period_id')->constrained('sampling_periods')->cascadeOnDelete();
                $table->string('evaluator_name', 150);
                $table->unsignedInteger('requested_count')->default(10);
                $table->text('reason')->nullable();
                $table->enum('status', ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'])->default('PENDING');
                $table->string('approved_by', 150)->nullable();
                $table->unsignedInteger('approved_count')->nullable();
                $table->timestamp('valid_until')->nullable();
                $table->timestamps();

                $table->index(['sampling_period_id', 'evaluator_name'], 'idx_period_req_evaluator');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sampling_quota_requests');

        if (Schema::hasTable('sampling_assignments')) {
            Schema::table('sampling_assignments', function (Blueprint $table) {
                if (Schema::hasColumn('sampling_assignments', 'is_extra_quota')) {
                    $table->dropColumn(['is_extra_quota', 'valid_until', 'hold_at', 'abandoned_at', 'quota_request_id']);
                }
            });
        }
    }
};
