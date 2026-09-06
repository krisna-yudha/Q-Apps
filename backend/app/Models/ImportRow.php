<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportRow extends Model
{
    protected $fillable = [
        'import_batch_id',
        'row_number',
        'raw_data',
        'status',
        'error_message',
        'warning_message',
    ];

    protected $casts = [
        'raw_data' => 'array',
        'row_number' => 'integer',
    ];

    public function batch()
    {
        return $this->belongsTo(ImportBatch::class, 'import_batch_id');
    }
}
