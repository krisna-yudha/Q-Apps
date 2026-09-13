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
        if (!Schema::hasTable('sampling_qa_attendances')) {
            Schema::create('sampling_qa_attendances', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sampling_period_id')->nullable()->index();
                $table->string('evaluator_name')->index();
                $table->unsignedBigInteger('evaluator_id')->nullable()->index();
                $table->date('work_date')->index();
                $table->string('status', 30)->default('ON_DUTY')->index(); // ON_DUTY, OFF_DAY, LEAVE, SICK, TRAINING
                $table->boolean('is_ready')->default(true)->index();
                $table->string('shift', 30)->nullable();
                $table->string('notes')->nullable();
                $table->unsignedInteger('tickets_distributed_count')->default(0);
                $table->unsignedInteger('tickets_completed_count')->default(0);
                $table->timestamps();

                $table->unique(['evaluator_name', 'work_date'], 'qa_work_date_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sampling_qa_attendances');
    }
};
