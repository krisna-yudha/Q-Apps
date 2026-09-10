<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PolicyDiscussion;
use Illuminate\Http\Request;

class PolicyDiscussionController extends Controller
{
    // View 7: Repository Hasil Diskusi Kebijakan
    public function index(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'all');
        $category = $request->query('category', 'all');

        $query = PolicyDiscussion::query();

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('summary', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%");
            });
        }

        $allDocs = PolicyDiscussion::all();
        $discussions = $query->orderByDesc('discussion_date')->get();

        return response()->json([
            'success' => true,
            'data' => $discussions->map(function ($d) {
                return [
                    'id' => $d->id,
                    'title' => $d->title,
                    'date' => $d->discussion_date->format('Y-m-d'),
                    'category' => $d->category,
                    'summary' => $d->summary,
                    'details' => $d->details,
                    'status' => $d->status,
                    'author' => $d->author,
                    'attachment' => $d->attachment_name,
                    'fileSize' => $d->file_size ?: '1.2 MB',
                ];
            }),
            'categories' => $allDocs->pluck('category')->unique()->values(),
            'counts' => [
                'all' => $allDocs->count(),
                'active' => $allDocs->where('status', 'active')->count(),
                'expired' => $allDocs->where('status', 'expired')->count(),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'discussion_date' => 'nullable|date',
            'category' => 'required|string|max:255',
            'summary' => 'required|string',
            'details' => 'nullable|string',
            'status' => 'required|in:active,expired',
            'author' => 'nullable|string',
            'attachment_name' => 'nullable|string',
        ]);

        $doc = PolicyDiscussion::create([
            'title' => $validated['title'],
            'discussion_date' => $validated['discussion_date'] ?? now()->format('Y-m-d'),
            'category' => $validated['category'],
            'summary' => $validated['summary'],
            'details' => $validated['details'] ?? null,
            'status' => $validated['status'],
            'author' => $validated['author'] ?? 'Admin QA',
            'attachment_name' => $validated['attachment_name'] ?? 'Dokumen_Kebijakan_Baru.pdf',
            'file_size' => '1.5 MB',
        ]);

        \App\Services\NotificationService::send([
            'title'      => 'Kebijakan QA Baru Ditambahkan',
            'message'    => "Dokumen SOP/Kebijakan '{$doc->title}' berhasil diterbitkan.",
            'type'       => 'policy',
            'action_url' => '/repository-kebijakan',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dokumen hasil diskusi kebijakan berhasil ditambahkan!',
            'data' => $doc
        ], 201);
    }

    public function toggleStatus($id)
    {
        $doc = PolicyDiscussion::findOrFail($id);
        $doc->status = $doc->status === 'active' ? 'expired' : 'active';
        $doc->save();

        \App\Services\NotificationService::send([
            'title'      => 'Status Kebijakan Diperbarui',
            'message'    => "Status kebijakan '{$doc->title}' diubah menjadi " . ($doc->status === 'active' ? 'Aktif' : 'Expired') . ".",
            'type'       => 'policy',
            'action_url' => '/repository-kebijakan',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Status kebijakan berhasil diperbarui.',
            'data' => $doc
        ]);
    }

    public function destroy($id)
    {
        $doc = PolicyDiscussion::findOrFail($id);
        $title = $doc->title;
        $doc->delete();

        \App\Services\NotificationService::send([
            'title'      => 'Kebijakan Dihapus',
            'message'    => "Dokumen kebijakan '{$title}' telah dihapus dari repositori.",
            'type'       => 'system',
            'action_url' => '/repository-kebijakan',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dokumen kebijakan berhasil dihapus.'
        ]);
    }
}
