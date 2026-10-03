<?php

namespace App\Exports\Sheets;

use App\Models\SipImport;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SipImportsSummarySheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return SipImport::query()->with(['service', 'user'])->latest('id');
    }

    public function map($import): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $import->id,
            $import->file_name ?? '-',
            $import->service?->name ?? '-',
            $import->user?->name ?? 'Supervisor',
            $import->total_rows ?? 0,
            $import->success_rows ?? 0,
            $import->failed_rows ?? 0,
            strtoupper($import->status ?? 'COMPLETED'),
            $import->started_at ? $import->started_at->format('Y-m-d H:i:s') : '-',
            $import->completed_at ? $import->completed_at->format('Y-m-d H:i:s') : '-',
            $import->created_at ? $import->created_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Import ID',
            'Nama File Upload SPV',
            'Layanan / Kanal',
            'Diupload Oleh',
            'Total Baris',
            'Baris Sukses',
            'Baris Gagal',
            'Status Import',
            'Waktu Mulai',
            'Waktu Selesai',
            'Tanggal Upload',
        ];
    }

    public function title(): string
    {
        return 'SPV Raw Imports';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFC2410C']], // Orange / Rust
            ],
        ];
    }
}
