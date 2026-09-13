<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingQaAttendance extends Model
{
    use HasFactory;

    protected $table = 'sampling_qa_attendances';

    protected $guarded = ['id'];

    protected $casts = [
        'work_date' => 'date:Y-m-d',
        'is_ready' => 'boolean',
        'tickets_distributed_count' => 'integer',
        'tickets_completed_count' => 'integer',
    ];

    public function period()
    {
        return $this->belongsTo(SamplingPeriod::class, 'sampling_period_id');
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }
}
