<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            if (!Schema::hasColumn('agents', 'source_role')) {
                $table->string('source_role')->default('supervisor')->after('status');
            }
            if (!Schema::hasColumn('agents', 'imported_by')) {
                $table->string('imported_by')->default('Supervisor')->after('source_role');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            if (Schema::hasColumn('agents', 'imported_by')) {
                $table->dropColumn('imported_by');
            }
            if (Schema::hasColumn('agents', 'source_role')) {
                $table->dropColumn('source_role');
            }
        });
    }
};
