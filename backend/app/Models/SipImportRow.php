<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SipImportRow extends Model
{
    use HasFactory;

    protected $fillable = [
        'import_id',
        'row_number',
        'raw_data',
        'status',
        'error_message'
    ];

    protected $casts = [
        'raw_data' => 'array'
    ];

    public function import()
    {
        return $this->belongsTo(SipImport::class, 'import_id');
    }
}
