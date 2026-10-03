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
            $table->string('auth_type', 30)->default('service_account')->after('id'); // 'service_account' or 'oauth2'
            $table->text('oauth_client_id')->nullable()->after('service_account_json');
            $table->text('oauth_client_secret')->nullable()->after('oauth_client_id');
            $table->text('oauth_refresh_token')->nullable()->after('oauth_client_secret');
            $table->string('oauth_user_email', 191)->nullable()->after('oauth_refresh_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropColumn([
                'auth_type',
                'oauth_client_id',
                'oauth_client_secret',
                'oauth_refresh_token',
                'oauth_user_email',
            ]);
        });
    }
};
