<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    use HasFactory;

    protected $table = 'backup_logs';

    protected $fillable = [
        'backup_setting_id',
        'user_id',
        'user_name',
        'trigger_type',
        'backup_type',
        'items',
        'files_count',
        'total_size_bytes',
        'status',
        'error_message',
        'details',
        'duration_seconds',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'items'            => 'array',
        'details'          => 'array',
        'files_count'      => 'integer',
        'total_size_bytes' => 'integer',
        'duration_seconds' => 'float',
        'started_at'       => 'datetime',
        'completed_at'     => 'datetime',
    ];

    public function setting()
    {
        return $this->belongsTo(BackupSetting::class, 'backup_setting_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
