<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PolicyDiscussion extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'discussion_date' => 'date:Y-m-d',
    ];
}
