<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SamplingQuotaRequest extends Model
{
    use HasFactory;

    protected $table = 'sampling_quota_requests';

    protected $fillable = [
        'sampling_period_id',
        'evaluator_name',
        'requested_count',
        'reason',
        'status',
        'approved_by',
        'approved_count',
        'valid_until',
    ];

    protected $casts = [
        'requested_count' => 'integer',
        'approved_count'  => 'integer',
        'valid_until'     => 'datetime',
    ];

    public function period(): BelongsTo
    {
        return $this->belongsTo(SamplingPeriod::class, 'sampling_period_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(SamplingAssignment::class, 'quota_request_id');
    }
}
