<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1 Default Clean Root Supervisor Account for Initial System Access
        $users = [
            [
                'name' => 'Supervisor',
                'username' => 'supervisor',
                'email' => 'supervisor@digiqa.id',
                'password' => Hash::make('password'),
                'role' => 'supervisor',
                'avatar' => null,
                'status' => 'active'
            ],
        ];

        foreach ($users as $u) {
            User::updateOrCreate(['username' => $u['username']], $u);
        }

        // Jalankan Master Seeder untuk Services, Parameters, Sites, dan Import Profiles
        $this->call(QappsMasterSeeder::class);
    }
}
