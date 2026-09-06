<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeAssignment extends Model
{
    protected $fillable = [
        'employee_id',
        'service_id',
        'site_id',
        'team_leader_id',
        'trainer_id',
        'start_date',
        'end_date',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'status' => 'boolean',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function teamLeader()
    {
        return $this->belongsTo(Employee::class, 'team_leader_id');
    }

    public function trainer()
    {
        return $this->belongsTo(Employee::class, 'trainer_id');
    }
}
