<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $guarded = [];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'is_online' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function getIsOnlineAttribute(): bool
    {
        if (!$this->last_seen_at) {
            return false;
        }
        // Active within the last 2 minutes and flag is true
        return (bool)($this->attributes['is_online'] ?? false) && $this->last_seen_at->gte(now()->subMinutes(2));
    }

    public function getLastSeenTextAttribute(): string
    {
        if ($this->is_online) {
            return 'Online sekarang';
        }
        if (!$this->last_seen_at) {
            return 'Offline';
        }
        return 'Terakhir aktif ' . $this->last_seen_at->diffForHumans();
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
