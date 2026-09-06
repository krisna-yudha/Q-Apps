<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubCategory extends Model
{
    use HasFactory;

    protected $fillable = ['category_id', 'code', 'name', 'status'];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function assessments()
    {
        return $this->hasMany(CaAssessment::class);
    }
}
