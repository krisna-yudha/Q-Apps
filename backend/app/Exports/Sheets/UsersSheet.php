<?php

namespace App\Exports\Sheets;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class UsersSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return User::query()->orderBy('name');
    }

    public function map($user): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $user->id,
            $user->name,
            $user->username ?? '-',
            $user->email,
            $user->role,
            $user->status ?? ($user->is_active ? 'active' : 'inactive'),
            $user->last_seen_at ? $user->last_seen_at->format('Y-m-d H:i:s') : '-',
            $user->created_at ? $user->created_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'User ID',
            'Nama Lengkap',
            'Username',
            'Email',
            'Role Akses',
            'Status Akun',
            'Aktivitas Terakhir (Last Seen)',
            'Tanggal Dibuat',
        ];
    }

    public function title(): string
    {
        return 'Master Users';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF374151']], // Slate Gray
            ],
        ];
    }
}
