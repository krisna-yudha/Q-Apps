<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportProfileMapping extends Model
{
    protected $fillable = [
        'import_profile_id',
        'source_column',
        'target_field',
        'mapping_type',
        'data_type',
        'required',
        'lookup_table',
        'lookup_column',
        'transform_rule',
    ];

    protected $casts = [
        'required' => 'boolean',
    ];

    public function profile()
    {
        return $this->belongsTo(ImportProfile::class, 'import_profile_id');
    }
}
