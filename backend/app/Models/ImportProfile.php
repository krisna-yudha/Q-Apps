<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportProfile extends Model
{
    protected $fillable = [
        'code',
        'name',
        'import_type',
        'service_id',
        'expected_extension',
        'sheet_name',
        'header_row',
        'data_start_row',
        'version',
        'status',
    ];

    protected $casts = [
        'header_row' => 'integer',
        'data_start_row' => 'integer',
        'status' => 'boolean',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function mappings()
    {
        return $this->hasMany(ImportProfileMapping::class);
    }

    public function batches()
    {
        return $this->hasMany(ImportBatch::class);
    }
}
