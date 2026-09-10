<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'message',
        'type',
        'action_url',
        'target_role',
        'target_user_id',
        'data',
        'is_read'
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'data' => 'array'
    ];
}
