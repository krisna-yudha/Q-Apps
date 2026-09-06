<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\Notification;
use App\Models\PolicyDiscussion;
use App\Models\EvaluatorSampling;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // GET /api/notifications
    public function index()
    {
        $notifications = Notification::orderByDesc('created_at')
            ->take(20)
            ->get();

        $unreadCount = Notification::where('is_read', false)->count();

        return response()->json([
            'success' => true,
            'unread_count' => $unreadCount,
            'notifications' => $notifications->map(function ($n) {
                return [
                    'id' => $n->id,
                    'title' => $n->title,
                    'message' => $n->message,
                    'type' => $n->type,
                    'is_read' => (bool)$n->is_read,
                    'created_at' => $n->created_at ? $n->created_at->toISOString() : null,
                    'time_ago' => $n->created_at ? $n->created_at->diffForHumans() : 'Baru saja'
                ];
            })
        ]);
    }

    // GET /api/system/sync-status
    public function syncStatus()
    {
        $latestAgent = Agent::latest('updated_at')->first();
        $latestPolicy = PolicyDiscussion::latest('updated_at')->first();
        $latestSampling = EvaluatorSampling::latest('updated_at')->first();
        $latestNotification = Notification::latest('created_at')->first();

        $agentUpdate = $latestAgent ? $latestAgent->updated_at->timestamp : 0;
        $policyUpdate = $latestPolicy ? $latestPolicy->updated_at->timestamp : 0;
        $samplingUpdate = $latestSampling ? $latestSampling->updated_at->timestamp : 0;
        $notifUpdate = $latestNotification ? $latestNotification->created_at->timestamp : 0;

        // Composite hash / signature
        $dataVersion = md5("{$agentUpdate}_{$policyUpdate}_{$samplingUpdate}_{$notifUpdate}");

        $unreadCount = Notification::where('is_read', false)->count();

        return response()->json([
            'success' => true,
            'data_version' => $dataVersion,
            'agent_count' => Agent::count(),
            'policy_count' => PolicyDiscussion::count(),
            'unread_count' => $unreadCount,
            'last_agent_update' => $agentUpdate,
            'last_policy_update' => $policyUpdate,
            'last_sampling_update' => $samplingUpdate,
            'server_time' => now()->toISOString()
        ]);
    }

    // POST /api/notifications/mark-read
    public function markRead(Request $request)
    {
        $id = $request->input('id');
        if ($id) {
            Notification::where('id', $id)->update(['is_read' => true]);
        } else {
            Notification::query()->update(['is_read' => true]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi ditandai sudah dibaca'
        ]);
    }
}
