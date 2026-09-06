<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EvaluatorSampling extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'quota' => 'integer',
        'actual' => 'integer',
        'avg_score' => 'float',
    ];
}
