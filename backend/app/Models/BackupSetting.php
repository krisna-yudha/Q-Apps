<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BackupSetting extends Model
{
    use HasFactory;

    protected $table = 'backup_settings';

    protected $fillable = [
        'auth_type',
        'service_account_json',
        'oauth_client_id',
        'oauth_client_secret',
        'oauth_refresh_token',
        'oauth_user_email',
        'google_drive_folder_id',
        'is_active',
        'schedule_enabled',
        'schedule_frequency',
        'schedule_time',
        'schedule_day_of_week',
        'schedule_day_of_month',
        'backup_items',
        'retention_days',
        'last_backup_at',
        'last_status',
        'last_error',
    ];

    protected $casts = [
        'service_account_json' => 'encrypted',
        'oauth_client_secret'  => 'encrypted',
        'oauth_refresh_token'  => 'encrypted',
        'is_active'            => 'boolean',
        'schedule_enabled'     => 'boolean',
        'schedule_day_of_week' => 'integer',
        'schedule_day_of_month'=> 'integer',
        'backup_items'         => 'array',
        'retention_days'       => 'integer',
        'last_backup_at'       => 'datetime',
    ];

    public function logs()
    {
        return $this->hasMany(BackupLog::class, 'backup_setting_id');
    }
}
