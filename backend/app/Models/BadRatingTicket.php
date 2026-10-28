<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BadRatingTicket extends Model
{
    use HasFactory;

    protected $table = 'bad_rating_tickets';

    protected $guarded = ['id'];

    protected $casts = [
        'transaction_date' => 'datetime',
        'is_matched_sampling' => 'boolean',
        'csat_rating' => 'integer',
    ];

    public function samplingAssignment()
    {
        return $this->belongsTo(SamplingAssignment::class, 'sampling_assignment_id');
    }
}
