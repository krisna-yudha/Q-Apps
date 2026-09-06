<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceMapping extends Model
{
    protected $fillable = [
        'source_system',
        'source_value',
        'service_id',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}
