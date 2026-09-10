<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Agent extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'ca_score' => 'float',
        'fcr_score' => 'float',
        'evaluation_count' => 'integer',
    ];

    public function teamLeader()
    {
        return $this->belongsTo(TeamLeader::class, 'team_leader_id');
    }

    public function trainer()
    {
        return $this->belongsTo(Trainer::class, 'trainer_id');
    }

    public function assessments()
    {
        return $this->hasMany(CaAssessment::class, 'agent_id');
    }

    public function assignments()
    {
        return $this->hasMany(AgentAssignment::class, 'agent_id');
    }

    public function site()
    {
        return $this->belongsTo(Site::class, 'site_id');
    }

    public function currentAssignment()
    {
        return $this->hasOne(AgentAssignment::class, 'agent_id')->where('status', true)->latestOfMany();
    }
}
