<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AssessmentHistory extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'assessment_id',
        'changed_by',
        'old_data',
        'new_data',
        'changed_at'
    ];

    protected $casts = [
        'old_data' => 'array',
        'new_data' => 'array',
        'changed_at' => 'datetime'
    ];

    public function assessment()
    {
        return $this->belongsTo(CaAssessment::class, 'assessment_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
