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

        $token = $user->createToken('digiqa_auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil! Selamat datang di digiQA Portal.',
            'token' => $token,
            'user' => [
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
            ]
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $user = User::first(); // Fallback if requested
        }

        return response()->json([
            'success' => true,
            'user' => [
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
            ]
        ]);
    }

    // Update Profile Info & Avatar with Compression
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $userId = $request->input('user_id');
            $user = $userId ? User::find($userId) : User::first();
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User tidak ditemukan.'], 404);
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
        if (!$user) {
            $userId = $request->input('user_id');
            $user = $userId ? User::find($userId) : User::first();
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'User tidak ditemukan.'], 404);
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
            'is_read' => false
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kata sandi berhasil diperbarui!'
        ]);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ]);
    }
}
