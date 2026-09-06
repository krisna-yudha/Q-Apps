<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportBatch extends Model
{
    protected $fillable = [
        'import_profile_id',
        'uploaded_by',
        'original_filename',
        'stored_filename',
        'total_rows',
        'success_rows',
        'warning_rows',
        'failed_rows',
        'status',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'total_rows' => 'integer',
        'success_rows' => 'integer',
        'warning_rows' => 'integer',
        'failed_rows' => 'integer',
    ];

    public function profile()
    {
        return $this->belongsTo(ImportProfile::class, 'import_profile_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function rows()
    {
        return $this->hasMany(ImportRow::class);
    }

    public function logs()
    {
        return $this->hasMany(ImportLog::class);
    }
}
