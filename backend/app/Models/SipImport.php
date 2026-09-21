<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SipImport extends Model
{
    use HasFactory;

    protected $fillable = [
        'file_name',
        'service_id',
        'imported_by',
        'total_rows',
        'success_rows',
        'failed_rows',
        'status',
        'started_at',
        'completed_at'
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'total_rows' => 'integer',
        'success_rows' => 'integer',
        'failed_rows' => 'integer',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function rows()
    {
        return $this->hasMany(SipImportRow::class, 'import_id');
    }
}
