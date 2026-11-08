<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingReassignmentLog extends Model
{
    use HasFactory;

    public $timestamps = false;
    protected $guarded = ['id'];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    /**
     * Mutator & Accessor for backwards-compatibility:
     * DB column is 'from_evaluator', but legacy callers may use 'previous_evaluator'.
     */
    public function setPreviousEvaluatorAttribute($value)
    {
        $this->attributes['from_evaluator'] = $value ?: 'QA Evaluator';
    }

    public function getPreviousEvaluatorAttribute()
    {
        return $this->attributes['from_evaluator'] ?? 'QA Evaluator';
    }

    public function setFromEvaluatorAttribute($value)
    {
        $this->attributes['from_evaluator'] = $value ?: 'QA Evaluator';
    }

    /**
     * Mutator & Accessor for backwards-compatibility:
     * DB column is 'to_evaluator' (NOT NULL in schema), but recalls/cancellations pass null or 'new_evaluator'.
     */
    public function setNewEvaluatorAttribute($value)
    {
        $this->attributes['to_evaluator'] = $value ?: '-';
    }

    public function getNewEvaluatorAttribute()
    {
        return $this->attributes['to_evaluator'] ?? '-';
    }

    public function setToEvaluatorAttribute($value)
    {
        $this->attributes['to_evaluator'] = $value ?: '-';
    }

    public function assignment()
    {
        return $this->belongsTo(SamplingAssignment::class, 'assignment_id');
    }
}
