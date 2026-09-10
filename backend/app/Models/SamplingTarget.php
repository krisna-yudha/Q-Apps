<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingTarget extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'target_total' => 'integer',
        'mandatory_per_cso' => 'integer',
        'cso_count' => 'integer',
        'mandatory_total' => 'integer',
        'additional_target' => 'integer',
        'actual_completed' => 'integer',
        'achievement_pct' => 'float',
        'avg_score' => 'float',
    ];

    public function period()
    {
        return $this->belongsTo(SamplingPeriod::class, 'sampling_period_id');
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    public function csoTargets()
    {
        return $this->hasMany(SamplingTargetCso::class);
    }
}
