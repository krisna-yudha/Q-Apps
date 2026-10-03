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

class RawSamplingTicketsSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return SamplingAssignment::query()
            ->with(['agent', 'qaUser', 'service', 'period'])
            ->latest('id');
    }

    public function map($item): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $item->id,
            $item->ticket_id ?? '-',
            $item->service?->name ?? '-',
            $item->agent?->name ?? $item->agent_name ?? '-',
            $item->qaUser?->name ?? $item->qa_name ?? '-',
            $item->period?->period_key ?? '-',
            strtoupper($item->status ?? 'ASSIGNED'),
            $item->score_ca !== null ? (float) $item->score_ca : '-',
            $item->fcr ?? '-',
            $item->is_extra_quota ? 'Ya' : 'Tidak',
            $item->assigned_at ? $item->assigned_at->format('Y-m-d H:i:s') : '-',
            $item->started_at ? $item->started_at->format('Y-m-d H:i:s') : '-',
            $item->completed_at ? $item->completed_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Assignment ID',
            'Ticket / Interaction ID',
            'Layanan / Kanal',
            'Nama Agent / CSO',
            'Nama QA Penilai',
            'Periode Sampling',
            'Status Tiket',
            'Score CA',
            'FCR',
            'Kuota Ekstra',
            'Waktu Ditugaskan',
            'Waktu Mulai Evaluasi',
            'Waktu Selesai Evaluasi',
        ];
    }

    public function title(): string
    {
        return 'Raw Sampling Assignments';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF4F46E5']], // Indigo
            ],
        ];
    }
}
