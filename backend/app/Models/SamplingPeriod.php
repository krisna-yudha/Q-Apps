<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SamplingPeriod extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'target_ca' => 'float',
        'target_fcr' => 'float',
        'daily_category_composition' => 'array',
    ];

    public function targets()
    {
        return $this->hasMany(SamplingTarget::class);
    }

    public function assignments()
    {
        return $this->hasMany(SamplingAssignment::class);
    }
}
