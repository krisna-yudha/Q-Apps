<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $fillable = [
        'sip_id',
        'name',
        'gender',
        'status',
    ];

    public function user()
    {
        return $this->hasOne(User::class);
    }

    public function assignments()
    {
        return $this->hasMany(EmployeeAssignment::class);
    }

    public function currentAssignment()
    {
        return $this->hasOne(EmployeeAssignment::class)->where('status', true)->latestOfMany();
    }

    public function leadTeams()
    {
        return $this->hasMany(EmployeeAssignment::class, 'team_leader_id');
    }

    public function trainedAgents()
    {
        return $this->hasMany(EmployeeAssignment::class, 'trainer_id');
    }

    public function assessments()
    {
        return $this->hasMany(CaAssessment::class, 'employee_id');
    }
}
