<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'current_login_ip')) {
                $table->string('current_login_ip', 45)->nullable()->after('is_online');
            }
            if (!Schema::hasColumn('users', 'current_login_device')) {
                $table->string('current_login_device', 255)->nullable()->after('current_login_ip');
            }
            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('current_login_device');
            }
            if (!Schema::hasColumn('users', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('last_login_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['current_login_ip', 'current_login_device', 'last_login_at', 'last_activity_at']);
        });
    }
};
