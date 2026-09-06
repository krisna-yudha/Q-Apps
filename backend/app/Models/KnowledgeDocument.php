<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KnowledgeDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'discussion_date',
        'summary',
        'status',
        'created_by'
    ];

    protected $casts = [
        'discussion_date' => 'date'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attachments()
    {
        return $this->hasMany(KnowledgeAttachment::class);
    }
}
