<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Roles
        if (!Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->id();
                $table->string('name', 50)->unique();
                $table->timestamps();
            });
        }

        // 2. Sites
        if (!Schema::hasTable('sites')) {
            Schema::create('sites', function (Blueprint $table) {
                $table->id();
                $table->string('code', 50)->unique();
                $table->string('name', 100);
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 3. Services
        if (!Schema::hasTable('services')) {
            Schema::create('services', function (Blueprint $table) {
                $table->id();
                $table->string('code', 50)->unique(); // INBOUND, DIGILIVE, SOCMED, EMAIL_OUTBOUND, BACK_OFFICE
                $table->string('name', 100);
                $table->string('source_ca_label', 100)->nullable();
                $table->string('source_layanan_label', 100)->nullable();
                $table->text('description')->nullable();
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 4. Categories
        if (!Schema::hasTable('categories')) {
            Schema::create('categories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->string('code', 50)->nullable();
                $table->string('name', 100);
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 5. Sub Categories
        if (!Schema::hasTable('sub_categories')) {
            Schema::create('sub_categories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
                $table->string('code', 50)->nullable();
                $table->string('name', 150);
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 6. Platforms
        if (!Schema::hasTable('platforms')) {
            Schema::create('platforms', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->string('code', 50)->nullable();
                $table->string('name', 100);
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 7. CA Parameters
        if (!Schema::hasTable('ca_parameters')) {
            Schema::create('ca_parameters', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
                $table->string('code', 50); // e.g. '1', '1.1', 'A.1', 'A1'
                $table->string('name', 255)->nullable();
                $table->text('description')->nullable();
                $table->decimal('weight', 10, 4)->nullable();
                $table->integer('sequence')->default(1);
                $table->boolean('status')->default(true);
                $table->timestamps();

                $table->unique(['service_id', 'code'], 'uq_parameter_service_code');
            });
        }

        // 8. Agent Assignments
        if (!Schema::hasTable('agent_assignments')) {
            Schema::create('agent_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('agent_id')->constrained('agents')->cascadeOnDelete();
                $table->foreignId('team_leader_id')->nullable()->constrained('team_leaders')->nullOnDelete();
                $table->foreignId('trainer_id')->nullable()->constrained('trainers')->nullOnDelete();
                $table->foreignId('site_id')->nullable()->constrained('sites')->nullOnDelete();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 9. Periods
        if (!Schema::hasTable('periods')) {
            Schema::create('periods', function (Blueprint $table) {
                $table->id();
                $table->smallInteger('year');
                $table->tinyInteger('month');
                $table->tinyInteger('week')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('label', 50)->nullable();
                $table->timestamps();
            });
        }

        // 10. CA Assessments (Transaction / Fact)
        if (!Schema::hasTable('ca_assessments')) {
            Schema::create('ca_assessments', function (Blueprint $table) {
                $table->id();
                $table->string('idca', 120)->unique(); // Unique Business Key
                $table->string('ticket_id', 100)->nullable();

                $table->foreignId('site_id')->nullable()->constrained('sites')->nullOnDelete();
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
                $table->foreignId('sub_category_id')->nullable()->constrained('sub_categories')->nullOnDelete();
                $table->foreignId('platform_id')->nullable()->constrained('platforms')->nullOnDelete();
                $table->foreignId('agent_id')->nullable()->constrained('agents')->nullOnDelete();
                $table->foreignId('qa_id')->nullable()->constrained('users')->nullOnDelete();

                $table->string('agent_name')->nullable();
                $table->string('qa_name')->nullable();
                $table->string('customer_name')->nullable();

                $table->dateTime('transaction_at')->nullable();
                $table->dateTime('measurement_at')->nullable();

                $table->integer('transaction_duration_seconds')->nullable();
                $table->integer('sampling_duration_seconds')->nullable();

                $table->enum('fcr', ['YA', 'TIDAK'])->nullable();
                $table->text('fcr_note')->nullable();

                $table->decimal('score_ca', 8, 2)->nullable();
                $table->text('summary')->nullable();
                $table->string('recommendation')->nullable();
                $table->text('recommendation_note')->nullable();

                $table->boolean('ever_changed')->default(false);
                $table->string('source', 50)->default('SIP');
                $table->string('source_file')->nullable();
                $table->timestamp('imported_at')->nullable();
                $table->timestamps();

                $table->index('site_id');
                $table->index('service_id');
                $table->index('agent_id');
                $table->index('measurement_at');
                $table->index('fcr');
            });
        }

        // 11. CA Assessment Scores (Transaction Detail)
        if (!Schema::hasTable('ca_assessment_scores')) {
            Schema::create('ca_assessment_scores', function (Blueprint $table) {
                $table->id();
                $table->foreignId('assessment_id')->constrained('ca_assessments')->cascadeOnDelete();
                $table->foreignId('parameter_id')->constrained('ca_parameters')->cascadeOnDelete();
                $table->decimal('score', 10, 2)->nullable();
                $table->text('note')->nullable();
                $table->timestamps();

                $table->unique(['assessment_id', 'parameter_id'], 'uq_assessment_parameter');
            });
        }

        // 12. SIP Imports (Staging Header)
        if (!Schema::hasTable('sip_imports')) {
            Schema::create('sip_imports', function (Blueprint $table) {
                $table->id();
                $table->string('file_name');
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
                $table->integer('total_rows')->default(0);
                $table->integer('success_rows')->default(0);
                $table->integer('failed_rows')->default(0);
                $table->enum('status', ['processing', 'completed', 'failed'])->default('processing');
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        // 13. SIP Import Rows (Staging Raw Detail)
        if (!Schema::hasTable('sip_import_rows')) {
            Schema::create('sip_import_rows', function (Blueprint $table) {
                $table->id();
                $table->foreignId('import_id')->constrained('sip_imports')->cascadeOnDelete();
                $table->integer('row_number');
                $table->json('raw_data');
                $table->enum('status', ['pending', 'processed', 'failed'])->default('pending');
                $table->text('error_message')->nullable();
                $table->timestamps();
            });
        }

        // 14. Assessment Histories (Audit Log)
        if (!Schema::hasTable('assessment_histories')) {
            Schema::create('assessment_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('assessment_id')->constrained('ca_assessments')->cascadeOnDelete();
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('old_data')->nullable();
                $table->json('new_data')->nullable();
                $table->timestamp('changed_at')->useCurrent();
            });
        }

        // 15. Knowledge Documents & Attachments
        if (!Schema::hasTable('knowledge_documents')) {
            Schema::create('knowledge_documents', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->date('discussion_date');
                $table->text('summary');
                $table->enum('status', ['active', 'expired', 'superseded'])->default('active');
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('knowledge_attachments')) {
            Schema::create('knowledge_attachments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('knowledge_document_id')->constrained('knowledge_documents')->cascadeOnDelete();
                $table->string('file_name');
                $table->string('file_path', 500);
                $table->string('file_type', 100)->nullable();
                $table->bigInteger('file_size')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_attachments');
        Schema::dropIfExists('knowledge_documents');
        Schema::dropIfExists('assessment_histories');
        Schema::dropIfExists('sip_import_rows');
        Schema::dropIfExists('sip_imports');
        Schema::dropIfExists('ca_assessment_scores');
        Schema::dropIfExists('ca_assessments');
        Schema::dropIfExists('periods');
        Schema::dropIfExists('agent_assignments');
        Schema::dropIfExists('ca_parameters');
        Schema::dropIfExists('platforms');
        Schema::dropIfExists('sub_categories');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('services');
        Schema::dropIfExists('sites');
        Schema::dropIfExists('roles');
    }
};
