<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingAssignment extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'score_ca' => 'float',
        'assigned_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function period()
    {
        return $this->belongsTo(SamplingPeriod::class, 'sampling_period_id');
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class, 'agent_id');
    }

    public function qaUser()
    {
        return $this->belongsTo(User::class, 'qa_user_id');
    }

    public function service()
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function assessment()
    {
        return $this->belongsTo(CaAssessment::class, 'assessment_id');
    }

    public function reassignmentLogs()
    {
        return $this->hasMany(SamplingReassignmentLog::class, 'assignment_id');
    }
}
