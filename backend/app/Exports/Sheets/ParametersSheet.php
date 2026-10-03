<?php

namespace App\Exports\Sheets;

use App\Models\CaParameter;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ParametersSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return CaParameter::query()->with('service')->orderBy('service_id')->orderBy('sequence')->orderBy('id');
    }

    public function map($param): array
    {
        $this->rowNumber++;
        $isActive = ($param->status == 1 || $param->status === true || $param->is_active);

        return [
            $this->rowNumber,
            $param->id,
            $param->service?->name ?? 'Global / Semua Layanan',
            $param->code ?? '-',
            $param->sequence ?? $this->rowNumber,
            $param->name ?? '-',
            $param->description ?? '-',
            $param->weight !== null ? (float) $param->weight : 0.0,
            $isActive ? 'Active' : 'Inactive',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Parameter ID',
            'Layanan / Kanal',
            'Kode Parameter',
            'No Urut SOP',
            'Nama Butir Parameter QA',
            'Deskripsi / Panduan SOP',
            'Bobot / Weight (%)',
            'Status Parameter',
        ];
    }

    public function title(): string
    {
        return 'Master QA Parameters';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFB45309']], // Amber
            ],
        ];
    }
}

