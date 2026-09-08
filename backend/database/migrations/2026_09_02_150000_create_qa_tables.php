<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add fields to users
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username')->unique()->nullable()->after('name');
            }
            if (!Schema::hasColumn('users', 'role')) {
                $table->string('role')->default('agent')->after('email'); // admin, qa_lead, qa_evaluator, trainer, team_leader, agent
            }
            if (!Schema::hasColumn('users', 'avatar')) {
                $table->string('avatar')->nullable()->after('role');
            }
            if (!Schema::hasColumn('users', 'status')) {
                $table->string('status')->default('active')->after('avatar');
            }
        });

        // Team Leaders
        Schema::create('team_leaders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Trainers
        Schema::create('trainers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('email')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Agents
        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('nik')->unique();
            $table->foreignId('team_leader_id')->nullable()->constrained('team_leaders')->nullOnDelete();
            $table->foreignId('trainer_id')->nullable()->constrained('trainers')->nullOnDelete();
            $table->decimal('ca_score', 5, 2)->default(90.00);
            $table->decimal('fcr_score', 5, 2)->default(85.00);
            $table->integer('evaluation_count')->default(0);
            $table->string('status')->default('Meet Target');
            $table->string('avatar')->nullable();
            $table->timestamps();
        });

        // Evaluator Samplings (View 6 tracking)
        Schema::create('evaluator_samplings', function (Blueprint $table) {
            $table->id();
            $table->string('evaluator_name');
            $table->string('type'); // QA or Trainer
            $table->integer('quota')->default(370);
            $table->integer('actual')->default(0);
            $table->decimal('avg_score', 5, 2)->default(90.00);
            $table->string('status')->default('Aktif');
            $table->string('period_month')->default('2026-08');
            $table->timestamps();
        });

        // Policy Discussions (View 7 Knowledge Base)
        Schema::create('policy_discussions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->date('discussion_date');
            $table->string('category');
            $table->text('summary');
            $table->text('details')->nullable();
            $table->enum('status', ['active', 'expired'])->default('active');
            $table->string('author');
            $table->string('attachment_name')->nullable();
            $table->string('file_size')->nullable();
            $table->timestamps();
        });

        // Monthly Trend Snapshots (View 3 Global)
        Schema::create('monthly_trends', function (Blueprint $table) {
            $table->id();
            $table->string('month_name'); // Jan, Feb, etc.
            $table->integer('month_num');
            $table->integer('year')->default(2026);
            $table->decimal('ca_score', 5, 2);
            $table->decimal('fcr_score', 5, 2);
            $table->decimal('target_ca', 5, 2)->default(90.00);
            $table->decimal('target_fcr', 5, 2)->default(85.00);
            $table->integer('total_calls')->default(4000);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_trends');
        Schema::dropIfExists('policy_discussions');
        Schema::dropIfExists('evaluator_samplings');
        Schema::dropIfExists('agents');
        Schema::dropIfExists('trainers');
        Schema::dropIfExists('team_leaders');
    }
};
