<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 3 Default Clean Roles for Development
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
            [
                'name' => 'Quality Assurance',
                'username' => 'qa',
                'email' => 'qa@digiqa.id',
                'password' => Hash::make('password'),
                'role' => 'quality_assurance',
                'avatar' => null,
                'status' => 'active'
            ],
            [
                'name' => 'Team Leader',
                'username' => 'team_leader',
                'email' => 'teamleader@digiqa.id',
                'password' => Hash::make('password'),
                'role' => 'team_leader',
                'avatar' => null,
                'status' => 'active'
            ],
        ];

        foreach ($users as $u) {
            User::updateOrCreate(['email' => $u['email']], $u);
        }
    }
}
