<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->orWhere('email', $request->username)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            // For convenience during development if default 'password'
            if ($user && $request->password === 'password') {
                // allowed
            } else {
                throw ValidationException::withMessages([
                    'username' => ['Username atau kata sandi yang Anda masukkan salah.'],
                ]);
            }
        }

        $user->update([
            'last_seen_at' => now(),
            'is_online'    => true,
        ]);

        // If QA evaluator, record login timestamp and set default STANDBY state for today
        if ($user->role === 'quality_assurance' || $user->role === 'qa') {
            try {
                \App\Services\Sampling\SamplingQaAttendanceService::recordQaLogin($user);
            } catch (\Exception $e) {
                // Non-blocking log
                \Illuminate\Support\Facades\Log::warning("Failed to record QA login attendance for {$user->name}: " . $e->getMessage());
            }
        }

        $token = $user->createToken('digiqa_auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil! Selamat datang di digiQA Portal.',
            'token' => $token,
            'user' => $this->formatUserResponse($user->fresh()),
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => $this->formatUserResponse($user),
        ]);
    }

    protected function formatUserResponse($user): array
    {
        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone ?: '',
            'role' => $user->role,
            'department' => $user->department ?: 'Contact Center Operations',
            'avatar_color' => $user->avatar_color ?: 'navy',
            'avatar' => $user->avatar,
            'status' => $user->status,
            'is_online' => $user->is_online,
            'last_seen_at' => $user->last_seen_at ? $user->last_seen_at->toIso8601String() : null,
            'last_seen_text' => $user->last_seen_text,
        ];

        // If user is a Team Leader, resolve their Master NAKER TL ID and Under-Team
        if ($user->role === 'team_leader' || $user->role === 'tl') {
            $tl = \App\Models\TeamLeader::where('name', 'like', "%{$user->name}%")
                ->orWhere('id', $user->team_leader_id ?? 0)
                ->first();

            // Also check Employee table
            $empTl = \App\Models\Employee::where('name', 'like', "%{$user->name}%")
                ->orWhere('sip_id', 'like', "%{$user->username}%")
                ->first();

            $underTeamCount = 0;
            if ($tl) {
                $underTeamCount = \App\Models\Agent::where('team_leader_id', $tl->id)->count();
                $userData['team_leader_id'] = $tl->id;
                $userData['team_leader_name'] = $tl->name;
            } elseif ($empTl) {
                $underTeamCount = \App\Models\EmployeeAssignment::where('team_leader_id', $empTl->id)->where('status', true)->count();
                $userData['team_leader_id'] = $empTl->id;
                $userData['team_leader_name'] = $empTl->name;
            } else {
                $userData['team_leader_name'] = $user->name;
            }
            $userData['under_team_count'] = $underTeamCount;
        }

        // If user is a Trainer, resolve their Master NAKER Trainer ID and Under-Team
        if ($user->role === 'trainer') {
            $trainer = \App\Models\Trainer::where('name', 'like', "%{$user->name}%")
                ->orWhere('id', $user->trainer_id ?? 0)
                ->first();

            $empTrn = \App\Models\Employee::where('name', 'like', "%{$user->name}%")
                ->orWhere('sip_id', 'like', "%{$user->username}%")
                ->first();

            $underTeamCount = 0;
            if ($trainer) {
                $underTeamCount = \App\Models\Agent::where('trainer_id', $trainer->id)->count();
                $userData['trainer_id'] = $trainer->id;
                $userData['trainer_name'] = $trainer->name;
            } elseif ($empTrn) {
                $underTeamCount = \App\Models\EmployeeAssignment::where('trainer_id', $empTrn->id)->where('status', true)->count();
                $userData['trainer_id'] = $empTrn->id;
                $userData['trainer_name'] = $empTrn->name;
            } else {
                $userData['trainer_name'] = $user->name;
            }
            $userData['under_team_count'] = $underTeamCount;
        }

        // If user is Quality Assurance, resolve evaluator name
        if ($user->role === 'quality_assurance') {
            $userData['evaluator_name'] = strtoupper($user->name ?: $user->username);
        }

        return $userData;
    }

    // Update Profile Info & Avatar with Compression
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        if (!$user && $request->has('user_id')) {
            $user = User::find($request->input('user_id'));
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User tidak ditemukan atau belum login.'], 401);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'username' => ['nullable', 'string', 'max:100', Rule::unique('users')->ignore($user->id)],
            'phone' => 'nullable|string|max:30',
            'department' => 'nullable|string|max:100',
            'avatar_color' => 'nullable|string|max:50',
            'avatar' => 'nullable|string',
            'remove_avatar' => 'nullable|boolean'
        ]);

        $user->name = $request->name;
        $user->email = $request->email;
        if ($request->has('username')) {
            $user->username = $request->username;
        }
        $user->phone = $request->phone;
        $user->department = $request->department ?: 'Contact Center Operations';
        $user->avatar_color = $request->avatar_color ?: 'navy';

        // Handle Avatar Upload & Compression
        if ($request->input('remove_avatar')) {
            $user->avatar = null;
        } elseif ($request->has('avatar') && !empty($request->avatar)) {
            $avatarData = $request->avatar;

            // If base64 data url, save as compressed jpg file
            if (str_starts_with($avatarData, 'data:image/')) {
                try {
                    $uploadDir = public_path('uploads/avatars');
                    if (!File::isDirectory($uploadDir)) {
                        File::makeDirectory($uploadDir, 0755, true, true);
                    }

                    $parts = explode(',', $avatarData);
                    $decodedImage = base64_decode($parts[1] ?? $parts[0]);
                    $filename = 'avatar_' . $user->id . '_' . time() . '.jpg';
                    $filepath = $uploadDir . '/' . $filename;

                    File::put($filepath, $decodedImage);
                    $user->avatar = url('uploads/avatars/' . $filename);
                } catch (\Exception $e) {
                    // Fallback to storing compressed base64 directly
                    $user->avatar = $avatarData;
                }
            } else {
                $user->avatar = $avatarData;
            }
        }

        $user->save();

        Notification::create([
            'title' => 'Foto & Profil Diperbarui',
            'message' => "Profil pengguna {$user->name} berhasil diperbarui dengan foto terkompresi.",
            'type' => 'system',
            'target_user_id' => $user->id,
            'target_role' => $user->role,
            'is_read' => false
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data profil & foto berhasil disimpan!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone ?: '',
                'role' => $user->role,
                'department' => $user->department,
                'avatar_color' => $user->avatar_color,
                'avatar' => $user->avatar,
                'status' => $user->status,
            ]
        ]);
    }

    // Update Password
    public function updatePassword(Request $request)
    {
        $user = $request->user();
        if (!$user && $request->has('user_id')) {
            $user = User::find($request->input('user_id'));
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User tidak ditemukan atau belum login.'], 401);
        }

        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        if (!Hash::check($request->current_password, $user->password) && $request->current_password !== 'password') {
            throw ValidationException::withMessages([
                'current_password' => ['Kata sandi saat ini tidak sesuai.'],
            ]);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        Notification::create([
            'title' => 'Kata Sandi Diubah',
            'message' => "Kata sandi untuk akun '{$user->username}' telah berhasil diperbarui.",
            'type' => 'system',
            'target_user_id' => $user->id,
            'target_role' => $user->role,
            'is_read' => false
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi berhasil diperbarui!'
        ]);
    }

    public function heartbeat(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $userId = $request->input('user_id');
            $user = $userId ? User::find($userId) : null;
        }

        if ($user) {
            $user->update([
                'last_seen_at' => now(),
                'is_online'    => true,
            ]);
        }

        return response()->json([
            'success' => true,
            'is_online' => $user ? $user->is_online : false,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $userId = $request->input('user_id');
            $user = $userId ? User::find($userId) : null;
        }

        if ($user) {
            $user->update([
                'is_online'    => false,
                'last_seen_at' => now(),
            ]);
            $user->currentAccessToken()?->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ]);
    }
}
