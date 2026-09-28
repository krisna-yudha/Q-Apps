<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('sip_imports') && !Schema::hasColumn('sip_imports', 'import_type')) {
            Schema::table('sip_imports', function (Blueprint $table) {
                $table->string('import_type', 50)->default('QSF')->after('file_name');
                $table->index(['import_type', 'status'], 'idx_sip_imports_type_status');
            });
        }

        // Set existing QSF imports in ca_assessments to source = 'QSF'
        if (Schema::hasTable('ca_assessments')) {
            DB::table('ca_assessments')
                ->where('source', 'SIP')
                ->orWhereNull('source')
                ->update([
                    'source' => 'QSF',
                    'source_system' => 'QSF',
                ]);
        }

        // Set existing sip_imports to import_type = 'QSF'
        if (Schema::hasTable('sip_imports')) {
            DB::table('sip_imports')
                ->whereNull('import_type')
                ->orWhere('import_type', '')
                ->update([
                    'import_type' => 'QSF',
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sip_imports') && Schema::hasColumn('sip_imports', 'import_type')) {
            Schema::table('sip_imports', function (Blueprint $table) {
                $table->dropIndex('idx_sip_imports_type_status');
                $table->dropColumn('import_type');
            });
        }
    }
};
