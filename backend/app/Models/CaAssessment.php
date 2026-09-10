<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'idca',
        'ticket_id',
        'site_id',
        'service_id',
        'category_id',
        'sub_category_id',
        'platform_id',
        'agent_id',
        'employee_id',
        'qa_id',
        'qa_user_id',
        'agent_name',
        'qa_name',
        'customer_name',
        'customer_phone',
        'transaction_at',
        'measurement_at',
        'transaction_duration_seconds',
        'sampling_duration_seconds',
        'fcr',
        'fcr_note',
        // Roadmap V2 §23 — nilai asli dari kolom Excel QSF untuk traceability
        'source_ca',
        'source_layanan',
        'hashtag',
        'score_ca',
        'cso_classification',
        'is_naker_verified',
        'summary',
        'recommendation',
        'recommendation_note',
        'ever_changed',
        'source',
        'source_file',
        'imported_at'
    ];

    protected $casts = [
        'transaction_at' => 'datetime',
        'measurement_at' => 'datetime',
        'score_ca' => 'float',
        'ever_changed' => 'boolean',
        'imported_at' => 'datetime'
    ];

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function subCategory()
    {
        return $this->belongsTo(SubCategory::class);
    }

    public function platform()
    {
        return $this->belongsTo(Platform::class);
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    // Roadmap V2 — relasi ke employees table (canonical NAKER master)
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function qa()
    {
        return $this->belongsTo(User::class, 'qa_id');
    }

    // Roadmap V2 — relasi qa_user_id ke users table
    public function qaUser()
    {
        return $this->belongsTo(User::class, 'qa_user_id');
    }

    public function scores()
    {
        return $this->hasMany(CaAssessmentScore::class, 'assessment_id');
    }

    public function histories()
    {
        return $this->hasMany(AssessmentHistory::class, 'assessment_id');
    }
}
