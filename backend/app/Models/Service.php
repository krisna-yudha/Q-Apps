<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'source_ca_label',
        'source_layanan_label',
        'description',
        'status'
    ];

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function platforms()
    {
        return $this->hasMany(Platform::class);
    }

    public function parameters()
    {
        return $this->hasMany(CaParameter::class)->orderBy('sequence');
    }

    public function assessments()
    {
        return $this->hasMany(CaAssessment::class);
    }

    public function assignments()
    {
        return $this->hasMany(EmployeeAssignment::class);
    }
}
