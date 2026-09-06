<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MonthlyTrend extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'ca_score' => 'float',
        'fcr_score' => 'float',
        'target_ca' => 'float',
        'target_fcr' => 'float',
        'total_calls' => 'integer',
    ];
}
