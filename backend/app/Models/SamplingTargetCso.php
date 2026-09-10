<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingTargetCso extends Model
{
    use HasFactory;

    protected $table = 'sampling_target_cso';
    protected $guarded = ['id'];

    protected $casts = [
        'target_sampling' => 'integer',
        'actual_sampling' => 'integer',
    ];

    public function samplingTarget()
    {
        return $this->belongsTo(SamplingTarget::class, 'sampling_target_id');
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class, 'agent_id');
    }
}
