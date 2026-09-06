<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaAssessmentScore extends Model
{
    use HasFactory;

    protected $fillable = [
        'assessment_id',
        'parameter_id',
        'score',
        'note'
    ];

    protected $casts = [
        'score' => 'float'
    ];

    public function assessment()
    {
        return $this->belongsTo(CaAssessment::class, 'assessment_id');
    }

    public function parameter()
    {
        return $this->belongsTo(CaParameter::class, 'parameter_id');
    }
}
