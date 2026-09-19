<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Alter status columns to VARCHAR(50) so they can store 'rolled_back', 'cancelled', 'completed', etc. without truncation
        try {
            if (Schema::hasTable('sip_imports')) {
                DB::statement("ALTER TABLE `sip_imports` MODIFY `status` VARCHAR(50) NOT NULL DEFAULT 'processing'");
            }
        } catch (\Throwable $e) {
            // fallback for sqlite / other drivers
        }

        try {
            if (Schema::hasTable('import_batches')) {
                DB::statement("ALTER TABLE `import_batches` MODIFY `status` VARCHAR(50) NOT NULL DEFAULT 'uploaded'");
            }
        } catch (\Throwable $e) {
            // fallback
        }

        try {
            if (Schema::hasTable('sip_import_rows')) {
                DB::statement("ALTER TABLE `sip_import_rows` MODIFY `status` VARCHAR(50) NOT NULL DEFAULT 'pending'");
            }
        } catch (\Throwable $e) {
            // fallback
        }

        try {
            if (Schema::hasTable('import_rows')) {
                DB::statement("ALTER TABLE `import_rows` MODIFY `status` VARCHAR(50) NOT NULL DEFAULT 'pending'");
            }
        } catch (\Throwable $e) {
            // fallback
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert columns if needed
    }
};
