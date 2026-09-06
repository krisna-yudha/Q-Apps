<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            if (!Schema::hasColumn('agents', 'channel')) {
                $table->string('channel')->default('Inbound')->after('status'); // Inbound, Back Office, Email Outbound, Socmed, Digilive
            }
            if (!Schema::hasColumn('agents', 'period_month')) {
                $table->string('period_month')->default('2026-08')->after('channel');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            if (Schema::hasColumn('agents', 'period_month')) {
                $table->dropColumn('period_month');
            }
            if (Schema::hasColumn('agents', 'channel')) {
                $table->dropColumn('channel');
            }
        });
    }
};
