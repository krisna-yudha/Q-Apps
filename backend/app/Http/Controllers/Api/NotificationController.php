<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NotificationController extends Controller
{
    /**
     * Resolve Authenticated User Helper
     */
    protected function resolveUser(Request $request): ?User
    {
        $user = $request->user();
        if (!$user && $token = $request->bearerToken()) {
            $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($token);
            $user = $tokenModel?->tokenable;
        }
        if (!$user && $request->has('user_id')) {
            $user = User::find($request->query('user_id') ?: $request->input('user_id'));
        }
        return $user;
    }

    /**
     * Build standard user scoping closure
     */
    protected function getUserScope(?User $user)
    {
        $userId = $user?->id;
        $userRole = $user?->role;
        $isSupervisor = in_array($userRole, ['supervisor', 'admin', 'superadmin']);

        return function ($query) use ($userId, $userRole, $isSupervisor) {
            $query->where(function ($q) use ($userId, $userRole, $isSupervisor) {
                // 1. Private personal notifications for this user
                if ($userId) {
                    $q->where('target_user_id', $userId);
                }

                // 2. Notifications targeted to this user's specific role
                if ($userRole) {
                    $q->orWhere(function ($roleQ) use ($userRole) {
                        $roleQ->whereNull('target_user_id')
                              ->where('target_role', $userRole);
                    });
                }

                // 3. Supervisor can see supervisor/admin level management notifications
                if ($isSupervisor) {
                    $q->orWhere(function ($spvQ) {
                        $spvQ->whereNull('target_user_id')
                             ->whereIn('target_role', ['supervisor', 'admin']);
                    });
                }

                // 4. Global broadcast notifications (No target_user_id AND No target_role)
                $q->orWhere(function ($globalQ) {
                    $globalQ->whereNull('target_user_id')
                            ->whereNull('target_role');
                });
            });
        };
    }

    /**
     * GET /api/notifications
     * Retrieve notifications strictly scoped to logged-in user
     */
    public function index(Request $request)
    {
        $type = $request->query('type');
        $isRead = $request->query('is_read');
        $limit = (int)$request->query('limit', 30);

        $user = $this->resolveUser($request);
        $userScope = $this->getUserScope($user);

        $query = Notification::query()->where($userScope);

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

        $unreadCount = Notification::where($userScope)->where('is_read', false)->count();

        // Categorized count badges scoped to this user
        $counts = [
            'all'        => Notification::where($userScope)->count(),
            'unread'     => $unreadCount,
            'sampling'   => Notification::where($userScope)->whereIn('type', ['sampling', 'evaluation'])->count(),
            'import'     => Notification::where($userScope)->where('type', 'import')->count(),
            'policy'     => Notification::where($userScope)->where('type', 'policy')->count(),
            'system'     => Notification::where($userScope)->where('type', 'system')->count(),
        ];

        return response()->json([
            'success'       => true,
            'unread_count'  => $unreadCount,
            'counts'        => $counts,
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
     * Lightweight polling / healthcheck endpoint scoped to user
     */
    public function syncStatus(Request $request)
    {
        $status = NotificationService::getDataVersion();

        // Touch user online presence if authenticated
        $user = $this->resolveUser($request);
        if ($user) {
            $user->update([
                'last_seen_at' => now(),
                'is_online'    => true,
            ]);
        }

        $userScope = $this->getUserScope($user);
        $userUnreadCount = Notification::where($userScope)->where('is_read', false)->count();

        return response()->json([
            'success'      => true,
            'data_version' => $status['version'],
            'unread_count' => $userUnreadCount,
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
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            @ini_set('zlib.output_compression', '0');
            @ini_set('implicit_flush', '1');
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            flush();

            $user = $this->resolveUser($request);
            $userScope = $this->getUserScope($user);
            $userUnreadCount = Notification::where($userScope)->where('is_read', false)->count();

            $currentStatus = NotificationService::getDataVersion();
            echo "event: connected\n";
            echo "data: " . json_encode([
                'status'       => 'connected',
                'version'      => $currentStatus['version'],
                'unread_count' => $userUnreadCount,
                'timestamp'    => time(),
                'server_time'  => now()->toISOString()
            ]) . "\n\n";
            flush();

            echo "event: sync\n";
            echo "data: " . json_encode([
                'version'      => $currentStatus['version'],
                'unread_count' => $userUnreadCount,
                'event'        => $currentStatus['last_event'],
                'timestamp'    => time(),
                'server_time'  => now()->toISOString()
            ]) . "\n\n";
            flush();

        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-transform',
            'Connection'        => 'close',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/notifications/mark-read
     * Mark single or user notifications as read
     */
    public function markRead(Request $request)
    {
        $id = $request->input('id');
        $user = $this->resolveUser($request);
        $userScope = $this->getUserScope($user);

        if ($id) {
            Notification::where('id', $id)->where($userScope)->update(['is_read' => true]);
        } else {
            Notification::where($userScope)->update(['is_read' => true]);
        }

        NotificationService::triggerSync('notification_read');

        $unreadCount = Notification::where($userScope)->where('is_read', false)->count();

        return response()->json([
            'success'      => true,
            'unread_count' => $unreadCount,
            'message'      => 'Notifikasi ditandai sudah dibaca'
        ]);
    }

    /**
     * DELETE /api/notifications/{id}
     * Delete single notification
     */
    public function destroy(Request $request, $id)
    {
        $user = $this->resolveUser($request);
        $userScope = $this->getUserScope($user);

        Notification::where('id', $id)->where($userScope)->delete();
        NotificationService::triggerSync('notification_deleted');

        $unreadCount = Notification::where($userScope)->where('is_read', false)->count();

        return response()->json([
            'success'      => true,
            'unread_count' => $unreadCount,
            'message'      => 'Notifikasi berhasil dihapus'
        ]);
    }

    /**
     * POST /api/notifications/clear-all
     * Clear all notifications for the current user (safe per-user delete)
     */
    public function clearAll(Request $request)
    {
        $user = $this->resolveUser($request);
        $userScope = $this->getUserScope($user);

        Notification::where($userScope)->delete();
        NotificationService::triggerSync('notification_cleared');

        return response()->json([
            'success'      => true,
            'unread_count' => 0,
            'message'      => 'Seluruh notifikasi Anda berhasil dikosongkan'
        ]);
    }
}
