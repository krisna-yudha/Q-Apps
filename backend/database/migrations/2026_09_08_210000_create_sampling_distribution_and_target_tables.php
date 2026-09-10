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
        // 1. Sampling Periods (Segment 2-D & 2-C)
        if (!Schema::hasTable('sampling_periods')) {
            Schema::create('sampling_periods', function (Blueprint $table) {
                $table->id();
                $table->unsignedSmallInteger('year')->default(2026);
                $table->unsignedTinyInteger('month'); // 1-12
                $table->string('period_code', 10)->unique(); // e.g. '2026-08'
                $table->string('name', 100); // e.g. 'Agustus 2026'
                $table->decimal('target_ca', 5, 2)->default(85.00);
                $table->decimal('target_fcr', 5, 2)->default(100.00);
                $table->enum('status', ['DRAFT', 'OPEN', 'RUNNING', 'CLOSED'])->default('OPEN');
                $table->timestamps();
            });
        }

        // 2. Sampling Targets per Evaluator (Segment 2-D Hierarchical Targets)
        if (!Schema::hasTable('sampling_targets')) {
            Schema::create('sampling_targets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sampling_period_id')->constrained('sampling_periods')->cascadeOnDelete();
                $table->string('evaluator_name', 150);
                $table->foreignId('evaluator_id')->nullable()->constrained('users')->nullOnDelete();
                $table->enum('type', ['QA', 'Trainer'])->default('QA');
                $table->unsignedInteger('target_total')->default(370);
                $table->unsignedInteger('mandatory_per_cso')->default(2);
                $table->unsignedInteger('cso_count')->default(173);
                $table->unsignedInteger('mandatory_total')->default(346);
                $table->unsignedInteger('additional_target')->default(24);
                $table->unsignedInteger('actual_completed')->default(0);
                $table->decimal('achievement_pct', 5, 2)->default(0.00);
                $table->decimal('avg_score', 5, 2)->default(0.00);
                $table->string('status', 50)->default('In Progress');
                $table->timestamps();

                $table->unique(['sampling_period_id', 'evaluator_name', 'type'], 'uq_period_evaluator_type');
            });
        }

        // 3. Target Sampling Matrix per CSO (Segment 2-D: 173 CSO x 2 Sampling)
        if (!Schema::hasTable('sampling_target_cso')) {
            Schema::create('sampling_target_cso', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sampling_target_id')->constrained('sampling_targets')->cascadeOnDelete();
                $table->foreignId('agent_id')->constrained('agents')->cascadeOnDelete();
                $table->unsignedInteger('target_sampling')->default(2);
                $table->unsignedInteger('actual_sampling')->default(0);
                $table->timestamps();

                $table->unique(['sampling_target_id', 'agent_id'], 'uq_target_agent');
            });
        }

        // 4. Sampling Assignments / QA Bucket (Segment 2-C Auto Distribution Engine)
        if (!Schema::hasTable('sampling_assignments')) {
            Schema::create('sampling_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sampling_period_id')->constrained('sampling_periods')->cascadeOnDelete();
                $table->string('ticket_id', 150);
                $table->foreignId('agent_id')->constrained('agents')->cascadeOnDelete();
                $table->string('evaluator_name', 150);
                $table->foreignId('qa_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->string('channel', 100)->nullable();
                $table->string('category_name', 150)->nullable();
                $table->enum('assignment_type', ['MANDATORY', 'ADDITIONAL'])->default('MANDATORY');
                $table->enum('status', ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'REASSIGNED', 'CANCELLED'])->default('ASSIGNED');
                $table->string('skip_reason', 255)->nullable();
                $table->string('reassigned_from', 150)->nullable();
                $table->foreignId('assessment_id')->nullable()->constrained('ca_assessments')->nullOnDelete();
                $table->decimal('score_ca', 5, 2)->nullable();
                $table->string('fcr', 20)->nullable();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['sampling_period_id', 'evaluator_name'], 'idx_period_evaluator');
                $table->index(['sampling_period_id', 'agent_id'], 'idx_period_agent');
                $table->unique(['sampling_period_id', 'ticket_id'], 'uq_period_ticket');
            });
        }

        // 5. Sampling Reassignment Audit Logs (Segment 2-C)
        if (!Schema::hasTable('sampling_reassignment_logs')) {
            Schema::create('sampling_reassignment_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('assignment_id')->constrained('sampling_assignments')->cascadeOnDelete();
                $table->string('from_evaluator', 150);
                $table->string('to_evaluator', 150);
                $table->string('reassigned_by', 150)->default('Supervisor');
                $table->text('reason');
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sampling_reassignment_logs');
        Schema::dropIfExists('sampling_assignments');
        Schema::dropIfExists('sampling_target_cso');
        Schema::dropIfExists('sampling_targets');
        Schema::dropIfExists('sampling_periods');
    }
};
