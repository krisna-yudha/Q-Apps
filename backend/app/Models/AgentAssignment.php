<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgentAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'agent_id',
        'team_leader_id',
        'trainer_id',
        'site_id',
        'start_date',
        'end_date',
        'status'
    ];

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    public function teamLeader()
    {
        return $this->belongsTo(TeamLeader::class);
    }

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }
}
