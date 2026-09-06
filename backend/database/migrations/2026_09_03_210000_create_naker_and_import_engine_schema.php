<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Employees (Master NAKER)
        if (!Schema::hasTable('employees')) {
            Schema::create('employees', function (Blueprint $table) {
                $table->id();
                $table->string('sip_id', 100)->unique();
                $table->string('name', 150);
                $table->enum('gender', ['PRIA', 'WANITA'])->nullable();
                $table->enum('status', ['active', 'inactive'])->default('active');
                $table->timestamps();
            });
        }

        // Add employee_id to users if not exists
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'employee_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignId('employee_id')->nullable()->after('id')->constrained('employees')->nullOnDelete();
            });
        }

        // 2. Service Mappings (NAKER Source to Canonical Service)
        if (!Schema::hasTable('service_mappings')) {
            Schema::create('service_mappings', function (Blueprint $table) {
                $table->id();
                $table->string('source_system', 50)->default('NAKER');
                $table->string('source_value', 150);
                $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['source_system', 'source_value'], 'uq_service_mapping');
            });
        }

        // 3. Employee Assignments (History Penugasan TL, Trainer, Service, Site)
        if (!Schema::hasTable('employee_assignments')) {
            Schema::create('employee_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->foreignId('site_id')->nullable()->constrained('sites')->nullOnDelete();
                $table->foreignId('team_leader_id')->nullable()->constrained('employees')->nullOnDelete();
                $table->foreignId('trainer_id')->nullable()->constrained('employees')->nullOnDelete();
                $table->date('start_date')->default(now()->toDateString());
                $table->date('end_date')->nullable();
                $table->boolean('status')->default(true);
                $table->timestamps();

                $table->index('employee_id');
                $table->index('team_leader_id');
                $table->index('trainer_id');
            });
        }

        // 4. Import Profiles
        if (!Schema::hasTable('import_profiles')) {
            Schema::create('import_profiles', function (Blueprint $table) {
                $table->id();
                $table->string('code', 100)->unique();
                $table->string('name', 150);
                $table->enum('import_type', ['NAKER', 'QSF']);
                $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
                $table->string('expected_extension', 50)->default('xls,xlsx,csv');
                $table->string('sheet_name', 100)->nullable();
                $table->integer('header_row')->default(1);
                $table->integer('data_start_row')->default(2);
                $table->string('version', 20)->default('1.0');
                $table->boolean('status')->default(true);
                $table->timestamps();
            });
        }

        // 5. Import Profile Mappings
        if (!Schema::hasTable('import_profile_mappings')) {
            Schema::create('import_profile_mappings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('import_profile_id')->constrained('import_profiles')->cascadeOnDelete();
                $table->string('source_column', 150);
                $table->string('target_field', 150)->nullable();
                $table->enum('mapping_type', ['FIELD', 'LOOKUP', 'PARAMETER', 'IGNORE'])->default('FIELD');
                $table->string('data_type', 50)->nullable();
                $table->boolean('required')->default(false);
                $table->string('lookup_table', 100)->nullable();
                $table->string('lookup_column', 100)->nullable();
                $table->string('transform_rule', 255)->nullable();
                $table->timestamps();
            });
        }

        // Add employee_id & source_system to ca_assessments if not exist
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (!Schema::hasColumn('ca_assessments', 'employee_id')) {
                    $table->foreignId('employee_id')->nullable()->after('agent_id')->constrained('employees')->nullOnDelete();
                }
                if (!Schema::hasColumn('ca_assessments', 'qa_user_id')) {
                    $table->foreignId('qa_user_id')->nullable()->after('qa_id')->constrained('users')->nullOnDelete();
                }
                if (!Schema::hasColumn('ca_assessments', 'source_system')) {
                    $table->string('source_system', 50)->default('SIP')->after('source');
                }
            });
        }

        // 6. Import Batches
        if (!Schema::hasTable('import_batches')) {
            Schema::create('import_batches', function (Blueprint $table) {
                $table->id();
                $table->foreignId('import_profile_id')->constrained('import_profiles')->cascadeOnDelete();
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('original_filename', 255);
                $table->string('stored_filename', 255)->nullable();
                $table->integer('total_rows')->default(0);
                $table->integer('success_rows')->default(0);
                $table->integer('warning_rows')->default(0);
                $table->integer('failed_rows')->default(0);
                $table->enum('status', [
                    'uploaded',
                    'validating',
                    'validated',
                    'processing',
                    'completed',
                    'failed',
                    'cancelled'
                ])->default('uploaded');
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        // 7. Import Rows
        if (!Schema::hasTable('import_rows')) {
            Schema::create('import_rows', function (Blueprint $table) {
                $table->id();
                $table->foreignId('import_batch_id')->constrained('import_batches')->cascadeOnDelete();
                $table->integer('row_number');
                $table->json('raw_data');
                $table->enum('status', [
                    'pending',
                    'valid',
                    'warning',
                    'failed',
                    'processed',
                    'duplicate'
                ])->default('pending');
                $table->text('error_message')->nullable();
                $table->text('warning_message')->nullable();
                $table->timestamps();
            });
        }

        // 8. Import Logs
        if (!Schema::hasTable('import_logs')) {
            Schema::create('import_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('import_batch_id')->constrained('import_batches')->cascadeOnDelete();
                $table->string('action', 100);
                $table->text('description')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('import_logs');
        Schema::dropIfExists('import_rows');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('import_profile_mappings');
        Schema::dropIfExists('import_profiles');
        Schema::dropIfExists('employee_assignments');
        Schema::dropIfExists('service_mappings');
        Schema::dropIfExists('employees');
    }
};
