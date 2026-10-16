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
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (!Schema::hasColumn('ca_assessments', 'sip_import_id')) {
                    $table->foreignId('sip_import_id')
                        ->nullable()
                        ->after('service_id')
                        ->constrained('sip_imports')
                        ->nullOnDelete();
                    
                    $table->index('sip_import_id');
                }
            });

            // Backfill sip_import_id for existing records based on source_file
            try {
                if (Schema::hasTable('sip_imports')) {
                    $imports = DB::table('sip_imports')->select('id', 'file_name', 'service_id')->get();
                    foreach ($imports as $imp) {
                        DB::table('ca_assessments')
                            ->whereNull('sip_import_id')
                            ->where('source_file', $imp->file_name)
                            ->update(['sip_import_id' => $imp->id]);
                    }
                }
            } catch (\Throwable $e) {
                // Ignore backfill errors on migration
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ca_assessments')) {
            Schema::table('ca_assessments', function (Blueprint $table) {
                if (Schema::hasColumn('ca_assessments', 'sip_import_id')) {
                    $table->dropForeign(['sip_import_id']);
                    $table->dropColumn('sip_import_id');
                }
            });
        }
    }
};
