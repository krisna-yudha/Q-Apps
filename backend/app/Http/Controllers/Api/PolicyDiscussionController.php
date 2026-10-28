<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PolicyDiscussion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PolicyDiscussionController extends Controller
{
    // Standard Sumber Informasi categories requested by user
    public const SUMBER_INFORMASI_OPTIONS = [
        'Info QOS',
        'Info Studi Kasus',
        'Mom Kalibnas',
        'MoM Studi Kasus',
        'Mom Kalib QA Site',
        'Diskusi Internal Ops',
        'Kalib MM',
    ];

    // View 7: Repository Hasil Diskusi Kebijakan
    public function index(Request $request)
    {
        $search = $request->query('search');
        $status = $request->query('status', 'all');
        $category = $request->query('category', 'all');
        $sumberInformasi = $request->query('sumber_informasi', 'all');

        $query = PolicyDiscussion::query();

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        if ($sumberInformasi && $sumberInformasi !== 'all') {
            $query->where('sumber_informasi', $sumberInformasi);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('summary', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('sumber_informasi', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhere('attachment_name', 'like', "%{$search}%");
            });
        }

        $allDocs = PolicyDiscussion::all();
        $discussions = $query->orderBy('id', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $discussions->map(function ($d) {
                return [
                    'id' => $d->id,
                    'title' => $d->title,
                    'date' => $d->discussion_date ? $d->discussion_date->format('Y-m-d') : null,
                    'category' => $d->category,
                    'sumber_informasi' => $d->sumber_informasi,
                    'target_channel' => $d->target_channel ?: 'UNTUK SEMUA',
                    'summary' => $d->summary,
                    'details' => $d->details,
                    'status' => $d->status,
                    'author' => $d->author,
                    'attachment' => $d->attachment_name,
                    'file_path' => $d->file_path ? asset('storage/' . $d->file_path) : null,
                    'has_file' => !empty($d->file_path) && Storage::disk('public')->exists($d->file_path),
                    'fileSize' => $d->file_size ?: '1.2 MB',
                ];
            }),
            'sources' => self::SUMBER_INFORMASI_OPTIONS,
            'categories' => $allDocs->pluck('category')->filter()->unique()->values(),
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
            'sumber_informasi' => 'nullable|string|max:100',
            'target_channel' => 'nullable|string|max:50',
            'summary' => 'required|string',
            'details' => 'nullable|string',
            'status' => 'required|in:active,expired',
            'author' => 'nullable|string',
            'attachment_name' => 'nullable|string|max:255',
            'pdf_file' => 'nullable|file|mimes:pdf|max:25600', // Non-mandatory upload up to 25MB
        ]);

        $filePath = null;
        $fileSize = null;
        $attachmentName = $validated['attachment_name'] ?? null;

        if ($request->hasFile('pdf_file')) {
            $file = $request->file('pdf_file');
            $origName = $file->getClientOriginalName();
            $fileName = time() . '_' . preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $origName);
            $filePath = $file->storeAs('policies', $fileName, 'public');
            $bytes = $file->getSize();
            $fileSize = $bytes >= 1048576 
                ? round($bytes / 1048576, 1) . ' MB' 
                : round($bytes / 1024, 0) . ' KB';
            if (empty($attachmentName)) {
                $attachmentName = $origName;
            }
        }

        if (empty($attachmentName)) {
            $attachmentName = 'Dokumen_Kebijakan_' . date('Ymd_His') . '.pdf';
        }

        $doc = PolicyDiscussion::create([
            'title' => $validated['title'],
            'discussion_date' => $validated['discussion_date'] ?? now()->format('Y-m-d'),
            'category' => $validated['category'],
            'sumber_informasi' => $validated['sumber_informasi'] ?? null,
            'target_channel' => $validated['target_channel'] ?? 'UNTUK SEMUA',
            'summary' => $validated['summary'],
            'details' => $validated['details'] ?? null,
            'status' => $validated['status'],
            'author' => $validated['author'] ?? 'Admin QA',
            'attachment_name' => $attachmentName,
            'file_path' => $filePath,
            'file_size' => $fileSize ?: '1.5 MB',
        ]);

        \App\Services\NotificationService::send([
            'title'      => 'Kebijakan QA Baru Ditambahkan',
            'message'    => "Dokumen SOP/Kebijakan '{$doc->title}' (" . ($doc->sumber_informasi ?: 'Kebijakan Mutu') . ") berhasil diterbitkan.",
            'type'       => 'policy',
            'action_url' => '/repository-kebijakan',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dokumen hasil diskusi kebijakan berhasil ditambahkan!',
            'data' => $doc
        ], 201);
    }

    public function download($id)
    {
        $doc = PolicyDiscussion::findOrFail($id);
        if ($doc->file_path && Storage::disk('public')->exists($doc->file_path)) {
            return Storage::disk('public')->download($doc->file_path, $doc->attachment_name ?: basename($doc->file_path));
        }

        return response()->json([
            'success' => false,
            'message' => 'File lampiran PDF tidak ditemukan atau belum diunggah untuk dokumen kebijakan ini.'
        ], 404);
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
