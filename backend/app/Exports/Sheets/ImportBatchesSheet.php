<?php

namespace App\Exports\Sheets;

use App\Models\ImportBatch;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ImportBatchesSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return ImportBatch::query()->with(['profile', 'uploader'])->latest('id');
    }

    public function map($batch): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $batch->id,
            $batch->profile?->name ?? 'Custom Profile',
            $batch->original_filename ?? '-',
            $batch->uploader?->name ?? 'System / SPV',
            $batch->total_rows ?? 0,
            $batch->success_rows ?? 0,
            $batch->warning_rows ?? 0,
            $batch->failed_rows ?? 0,
            strtoupper($batch->status ?? 'COMPLETED'),
            $batch->created_at ? $batch->created_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Batch ID',
            'Profile Import',
            'Nama File Asli',
            'Diupload Oleh',
            'Total Baris',
            'Sukses',
            'Peringatan',
            'Gagal',
            'Status Batch',
            'Tanggal Dibuat',
        ];
    }

    public function title(): string
    {
        return 'Import Engine Batches';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF059669']], // Emerald
            ],
        ];
    }
}
