<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('policy_discussions')) {
            Schema::table('policy_discussions', function (Blueprint $table) {
                if (!Schema::hasColumn('policy_discussions', 'sumber_informasi')) {
                    $table->string('sumber_informasi', 100)->nullable()->after('category');
                }
                if (!Schema::hasColumn('policy_discussions', 'target_channel')) {
                    $table->string('target_channel', 50)->default('UNTUK SEMUA')->nullable()->after('sumber_informasi');
                }
                if (!Schema::hasColumn('policy_discussions', 'file_path')) {
                    $table->string('file_path')->nullable()->after('attachment_name');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('policy_discussions')) {
            Schema::table('policy_discussions', function (Blueprint $table) {
                if (Schema::hasColumn('policy_discussions', 'sumber_informasi')) {
                    $table->dropColumn('sumber_informasi');
                }
                if (Schema::hasColumn('policy_discussions', 'target_channel')) {
                    $table->dropColumn('target_channel');
                }
                if (Schema::hasColumn('policy_discussions', 'file_path')) {
                    $table->dropColumn('file_path');
                }
            });
        }
    }
};
