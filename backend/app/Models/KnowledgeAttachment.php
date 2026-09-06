<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KnowledgeAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'knowledge_document_id',
        'file_name',
        'file_path',
        'file_type',
        'file_size'
    ];

    public function document()
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }
}
