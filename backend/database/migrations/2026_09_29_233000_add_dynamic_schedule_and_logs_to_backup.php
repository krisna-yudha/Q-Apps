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
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->boolean('schedule_enabled')->default(true)->after('is_active');
            $table->string('schedule_frequency', 20)->default('daily')->after('schedule_enabled'); // 'daily', 'weekly', 'monthly'
            $table->string('schedule_time', 10)->default('01:00')->after('schedule_frequency');
            $table->unsignedTinyInteger('schedule_day_of_week')->default(1)->after('schedule_time'); // 1 = Monday
            $table->unsignedTinyInteger('schedule_day_of_month')->default(1)->after('schedule_day_of_week');
            $table->json('backup_items')->nullable()->after('schedule_day_of_month'); // ['database', 'qa_worksheet', 'spv_imports', 'master_data']
            $table->unsignedInteger('retention_days')->default(14)->after('backup_items');
        });

        Schema::create('backup_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('backup_setting_id')->nullable()->constrained('backup_settings')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name', 100)->nullable();
            $table->string('trigger_type', 20)->default('manual'); // 'scheduler', 'manual'
            $table->string('backup_type', 30)->default('daily'); // 'daily', 'weekly', 'monthly', 'custom', 'instant'
            $table->json('items')->nullable(); // list of items backed up
            $table->unsignedInteger('files_count')->default(0);
            $table->unsignedBigInteger('total_size_bytes')->nullable();
            $table->string('status', 20)->default('pending'); // 'pending', 'running', 'success', 'failed'
            $table->text('error_message')->nullable();
            $table->json('details')->nullable(); // detailed list of uploaded files, sizes, paths
            $table->float('duration_seconds', 8, 2)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('trigger_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_logs');

        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropColumn([
                'schedule_enabled',
                'schedule_frequency',
                'schedule_time',
                'schedule_day_of_week',
                'schedule_day_of_month',
                'backup_items',
                'retention_days',
            ]);
        });
    }
};
