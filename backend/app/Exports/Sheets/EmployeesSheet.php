<?php

namespace App\Exports\Sheets;

use App\Models\Employee;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class EmployeesSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return Employee::query()->with(['currentAssignment.service', 'currentAssignment.site'])->orderBy('name');
    }

    public function map($emp): array
    {
        $this->rowNumber++;
        $curr = $emp->currentAssignment;

        return [
            $this->rowNumber,
            $emp->sip_id ?? $emp->nik ?? '-',
            $emp->name ?? '-',
            $curr?->service?->name ?? $emp->service_name ?? '-',
            $emp->sub_service ?? '-',
            $curr?->site?->name ?? $emp->site_name ?? '-',
            $curr?->role ?? $emp->role ?? '-',
            $emp->gender ?? '-',
            $emp->status ? 'Active' : 'Inactive',
            $curr?->join_date ? (is_string($curr->join_date) ? $curr->join_date : $curr->join_date->format('Y-m-d')) : '-',
            $emp->user?->email ?? $emp->email ?? '-',
            $emp->phone ?? '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'SIP ID / NIK',
            'Nama Lengkap',
            'Layanan / Kanal',
            'Sub Layanan',
            'Site Kerja',
            'Role / Posisi',
            'Jenis Kelamin',
            'Status Kepegawaian',
            'Tanggal Bergabung',
            'Email',
            'No Telepon',
        ];
    }

    public function title(): string
    {
        return 'Master NAKER Pegawai';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E3A8A']], // Blue
            ],
        ];
    }
}
