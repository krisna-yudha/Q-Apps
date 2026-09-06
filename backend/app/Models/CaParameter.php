<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaParameter extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_id',
        'code',
        'name',
        'description',
        'weight',
        'sequence',
        'status'
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function scores()
    {
        return $this->hasMany(CaAssessmentScore::class, 'parameter_id');
    }
}
