<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RealMonitoring extends Model
{
    use HasFactory;

    protected $table = 'real_monitorings';

    protected $guarded = ['id'];

    protected $casts = [
        'monitoring_date' => 'date',
        'is_eliminated' => 'boolean',
        'eliminated_at' => 'datetime',
    ];

    public function agent()
    {
        return $this->belongsTo(Agent::class, 'agent_id');
    }

    public function qaUser()
    {
        return $this->belongsTo(User::class, 'qa_user_id');
    }
}
