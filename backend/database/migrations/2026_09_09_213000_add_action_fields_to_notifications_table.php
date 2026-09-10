<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'action_url')) {
                $table->string('action_url')->nullable()->after('type');
            }
            if (!Schema::hasColumn('notifications', 'target_role')) {
                $table->string('target_role')->nullable()->after('action_url');
            }
            if (!Schema::hasColumn('notifications', 'target_user_id')) {
                $table->unsignedBigInteger('target_user_id')->nullable()->after('target_role');
            }
            if (!Schema::hasColumn('notifications', 'data')) {
                $table->json('data')->nullable()->after('target_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['action_url', 'target_role', 'target_user_id', 'data']);
        });
    }
};
