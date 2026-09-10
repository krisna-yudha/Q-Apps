<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     * Retrieve notifications with rich filtering and category stats
     */
    public function index(Request $request)
    {
        $type = $request->query('type');
        $isRead = $request->query('is_read');
        $limit = (int)$request->query('limit', 30);
        $userRole = auth()->user()?->role ?? null;
        $userId = auth()->id();

        $query = Notification::query();

        // Optional role scoping
        if ($userRole) {
            $query->where(function ($q) use ($userRole, $userId) {
                $q->whereNull('target_role')
                  ->orWhere('target_role', $userRole)
                  ->orWhere('target_user_id', $userId);
            });
        }

        if ($type && $type !== 'all') {
            if ($type === 'sampling') {
                $query->whereIn('type', ['sampling', 'evaluation']);
            } else {
                $query->where('type', $type);
            }
        }

        if ($isRead !== null && $isRead !== '') {
            $query->where('is_read', filter_var($isRead, FILTER_VALIDATE_BOOLEAN));
        }

        $notifications = $query->orderByDesc('created_at')
            ->take($limit)
            ->get();

        $unreadCount = Notification::where('is_read', false)->count();

        // Categorized count badges
        $counts = [
            'all'        => Notification::count(),
            'unread'     => $unreadCount,
            'sampling'   => Notification::whereIn('type', ['sampling', 'evaluation'])->count(),
            'import'     => Notification::where('type', 'import')->count(),
            'policy'     => Notification::where('type', 'policy')->count(),
            'system'     => Notification::where('type', 'system')->count(),
        ];

        return response()->json([
            'success'      => true,
            'unread_count' => $unreadCount,
            'counts'       => $counts,
            'notifications' => $notifications->map(function ($n) {
                return [
                    'id'          => $n->id,
                    'title'       => $n->title,
                    'message'     => $n->message,
                    'type'        => $n->type,
                    'action_url'  => $n->action_url,
                    'is_read'     => (bool)$n->is_read,
                    'data'        => $n->data,
                    'created_at'  => $n->created_at ? $n->created_at->toISOString() : null,
                    'time_ago'    => $n->created_at ? $n->created_at->diffForHumans() : 'Baru saja'
                ];
            })
        ]);
    }

    /**
     * GET /api/system/sync-status
     * Lightweight polling / healthcheck endpoint
     */
    public function syncStatus()
    {
        $status = NotificationService::getDataVersion();

        return response()->json([
            'success'      => true,
            'data_version' => $status['version'],
            'unread_count' => $status['unread_count'],
            'last_sync'    => $status['last_sync'],
            'last_event'   => $status['last_event'],
            'server_time'  => now()->toISOString()
        ]);
    }

    /**
     * GET /api/realtime/stream
     * Server-Sent Events (SSE) push stream for live notification & data sync
     */
    public function stream(Request $request): StreamedResponse
    {
        return new StreamedResponse(function () use ($request) {
            // Disable output buffering & execution time limits for stream session
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            @ini_set('zlib.output_compression', '0');
            @ini_set('implicit_flush', '1');
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            flush();

            $startTime = time();
            $maxDuration = 25; // Stream for 25s, then client cleanly reconnects
            $lastKnownVersion = $request->query('last_version', '');
            $lastPing = time();

            // 1. Initial Handshake Event
            $currentStatus = NotificationService::getDataVersion();
            echo "event: connected\n";
            echo "data: " . json_encode([
                'status'       => 'connected',
                'version'      => $currentStatus['version'],
                'unread_count' => $currentStatus['unread_count'],
                'timestamp'    => time(),
                'server_time'  => now()->toISOString()
            ]) . "\n\n";
            flush();

            $lastKnownVersion = $currentStatus['version'];

            // 2. Event Loop
            while ((time() - $startTime) < $maxDuration) {
                if (connection_aborted()) {
                    break;
                }

                $status = NotificationService::getDataVersion();

                // Check for version bump / new data event
                if ($status['version'] !== $lastKnownVersion) {
                    $lastKnownVersion = $status['version'];
                    
                    echo "event: sync\n";
                    echo "data: " . json_encode([
                        'version'      => $status['version'],
                        'unread_count' => $status['unread_count'],
                        'event'        => $status['last_event'],
                        'timestamp'    => time(),
                        'server_time'  => now()->toISOString()
                    ]) . "\n\n";
                    flush();
                }

                // Heartbeat ping every 10s
                if ((time() - $lastPing) >= 10) {
                    echo "event: ping\n";
                    echo "data: " . json_encode(['ping' => time()]) . "\n\n";
                    flush();
                    $lastPing = time();
                }

                // Sleep 1 second before next cycle
                sleep(1);
            }

            // Stream window expired cleanly - client EventSource will reconnect automatically
            echo "event: reconnect\n";
            echo "data: " . json_encode(['message' => 'stream_window_completed']) . "\n\n";
            flush();

        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-transform',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/notifications/mark-read
     * Mark single or all notifications as read
     */
    public function markRead(Request $request)
    {
        $id = $request->input('id');
        if ($id) {
            Notification::where('id', $id)->update(['is_read' => true]);
        } else {
            Notification::query()->update(['is_read' => true]);
        }

        NotificationService::triggerSync('notification_read');

        return response()->json([
            'success'      => true,
            'unread_count' => Notification::where('is_read', false)->count(),
            'message'      => 'Notifikasi ditandai sudah dibaca'
        ]);
    }

    /**
     * DELETE /api/notifications/{id}
     * Delete single notification
     */
    public function destroy($id)
    {
        Notification::destroy($id);
        NotificationService::triggerSync('notification_deleted');

        return response()->json([
            'success'      => true,
            'unread_count' => Notification::where('is_read', false)->count(),
            'message'      => 'Notifikasi berhasil dihapus'
        ]);
    }

    /**
     * POST /api/notifications/clear-all
     * Clear all notifications
     */
    public function clearAll()
    {
        Notification::truncate();
        NotificationService::triggerSync('notification_cleared');

        return response()->json([
            'success'      => true,
            'unread_count' => 0,
            'message'      => 'Seluruh notifikasi berhasil dikosongkan'
        ]);
    }
}
