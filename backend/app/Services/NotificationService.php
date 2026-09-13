<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\EvaluatorSampling;
use App\Models\Notification;
use App\Models\PolicyDiscussion;
use Illuminate\Support\Facades\Cache;

class NotificationService
{
    /**
     * Send & Persist Notification
     */
    public static function send(array $payload): Notification
    {
        $notif = Notification::create([
            'title'          => $payload['title'] ?? 'Notifikasi Sistem',
            'message'        => $payload['message'] ?? '',
            'type'           => $payload['type'] ?? 'system',
            'action_url'     => $payload['action_url'] ?? null,
            'target_role'    => $payload['target_role'] ?? null,
            'target_user_id' => $payload['target_user_id'] ?? null,
            'data'           => $payload['data'] ?? null,
            'is_read'        => false,
        ]);

        // Bump system sync version immediately
        self::triggerSync($payload['type'] ?? 'notification', [
            'notification_id' => $notif->id,
            'title'           => $notif->title,
            'type'            => $notif->type,
            'action_url'      => $notif->action_url,
        ]);

        return $notif;
    }

    /**
     * Trigger a system-wide sync version bump
     */
    public static function triggerSync(string $source = 'system', array $extra = []): string
    {
        $version = microtime(true) . '_' . bin2hex(random_bytes(4));
        Cache::put('digiqa_sync_version', $version, 86400);
        Cache::put('digiqa_sync_last_event', [
            'version'   => $version,
            'source'    => $source,
            'extra'     => $extra,
            'timestamp' => time(),
            'datetime'  => now()->toISOString()
        ], 86400);

        return $version;
    }

    /**
     * Get the current composite data signature
     */
    public static function getDataVersion(): array
    {
        $cachedEvent = Cache::get('digiqa_sync_last_event');
        $cachedVersion = Cache::get('digiqa_sync_version');

        $latestAssessment = CaAssessment::latest('updated_at')->first();
        $latestAgent = Agent::latest('updated_at')->first();
        $latestPolicy = PolicyDiscussion::latest('updated_at')->first();
        $latestSampling = EvaluatorSampling::latest('updated_at')->first();
        $latestNotif = Notification::latest('created_at')->first();
        $latestAttendance = \App\Models\SamplingQaAttendance::latest('updated_at')->first();
        $latestAssignment = \App\Models\SamplingAssignment::latest('updated_at')->first();

        $tsAssessment = $latestAssessment?->updated_at?->timestamp ?? 0;
        $tsAgent = $latestAgent?->updated_at?->timestamp ?? 0;
        $tsPolicy = $latestPolicy?->updated_at?->timestamp ?? 0;
        $tsSampling = $latestSampling?->updated_at?->timestamp ?? 0;
        $tsNotif = $latestNotif?->created_at?->timestamp ?? 0;
        $tsAttendance = $latestAttendance?->updated_at?->timestamp ?? 0;
        $tsAssignment = $latestAssignment?->updated_at?->timestamp ?? 0;

        $compositeHash = md5("{$tsAssessment}_{$tsAgent}_{$tsPolicy}_{$tsSampling}_{$tsNotif}_{$tsAttendance}_{$tsAssignment}_{$cachedVersion}");

        return [
            'version'       => $compositeHash,
            'last_sync'     => now()->toISOString(),
            'unread_count'  => Notification::where('is_read', false)->count(),
            'last_event'    => $cachedEvent ?? [
                'version'   => $compositeHash,
                'source'    => 'heartbeat',
                'timestamp' => time()
            ]
        ];
    }
}
