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
        if (Schema::hasTable('agents') && !Schema::hasColumn('agents', 'sub_channel')) {
            Schema::table('agents', function (Blueprint $table) {
                $table->string('sub_channel', 150)->nullable()->after('channel')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('agents') && Schema::hasColumn('agents', 'sub_channel')) {
            Schema::table('agents', function (Blueprint $table) {
                $table->dropColumn('sub_channel');
            });
        }
    }
};
