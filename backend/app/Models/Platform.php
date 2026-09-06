<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Platform extends Model
{
    use HasFactory;

    protected $fillable = ['service_id', 'code', 'name', 'status'];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function assessments()
    {
        return $this->hasMany(CaAssessment::class);
    }
}
