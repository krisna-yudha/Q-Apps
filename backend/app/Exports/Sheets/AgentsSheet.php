<?php

namespace App\Exports\Sheets;

use App\Models\Agent;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class AgentsSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return Agent::query()->with('site')->orderBy('name');
    }

    public function map($agent): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $agent->nik ?? '-',
            $agent->name ?? '-',
            $agent->channel ?? '-',
            $agent->sub_channel ?? '-',
            $agent->site?->name ?? $agent->site_name ?? '-',
            $agent->ca_score !== null ? (float) $agent->ca_score : 0.0,
            $agent->fcr_score !== null ? (float) $agent->fcr_score : 0.0,
            $agent->evaluation_count ?? 0,
            $agent->status ?? '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'NIK Agent',
            'Nama Agent',
            'Kanal',
            'Sub Kanal',
            'Site',
            'Rata-rata Score CA (%)',
            'Rata-rata FCR (%)',
            'Jumlah Evaluasi',
            'Status Performance',
        ];
    }

    public function title(): string
    {
        return 'Master Agents';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1D4ED8']], // Blue
            ],
        ];
    }
}
