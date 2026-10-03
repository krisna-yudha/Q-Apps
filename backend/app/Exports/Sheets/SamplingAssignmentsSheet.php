<?php

namespace App\Exports\Sheets;

use App\Models\SamplingAssignment;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SamplingAssignmentsSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return SamplingAssignment::query()
            ->with([
                'qaUser',
                'agent',
                'service',
                'period'
            ])
            ->orderBy('id', 'desc');
    }

    public function map($row): array
    {
        $this->rowNumber++;

        return [
            $this->rowNumber,
            $row->id,
            $row->ticket_id ?? '-',
            $row->qaUser?->name ?? "QA ID: {$row->qa_user_id}",
            $row->agent?->name ?? "Agent ID: {$row->agent_id}",
            $row->service?->name ?? '-',
            $row->status ?? '-',
            $row->score_ca !== null ? (float) $row->score_ca : '-',
            $row->is_extra_quota ? 'Ekstra Kuota' : 'Reguler',
            $row->assigned_at ? $row->assigned_at->format('Y-m-d H:i') : '-',
            $row->completed_at ? $row->completed_at->format('Y-m-d H:i') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Assignment ID',
            'No Tiket CRM / CSC',
            'QA Evaluator Ditugaskan',
            'Nama Agent Sasaran',
            'Layanan / Kanal',
            'Status Penugasan',
            'Skor CA Didapat',
            'Tipe Kuota',
            'Waktu Ditugaskan',
            'Waktu Selesai Penilaian',
        ];
    }

    public function title(): string
    {
        return 'Alokasi Sampling QA';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF4338CA']], // Indigo
            ],
        ];
    }
}
