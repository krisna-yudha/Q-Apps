<?php

namespace App\Exports\Sheets;

use App\Models\CaAssessmentScore;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CaAssessmentScoresSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    protected ?string $startDate;
    protected ?string $endDate;
    private int $rowNumber = 0;

    public function __construct($startDate = null, $endDate = null)
    {
        $this->startDate = $startDate ? Carbon::parse($startDate)->startOfDay()->toDateTimeString() : null;
        $this->endDate = $endDate ? Carbon::parse($endDate)->endOfDay()->toDateTimeString() : null;
    }

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        $query = CaAssessmentScore::query()
            ->with([
                'assessment.service',
                'assessment.agent',
                'assessment.qaUser',
                'parameter'
            ]);

        if ($this->startDate && $this->endDate) {
            $query->whereHas('assessment', function ($q) {
                $q->whereBetween('measurement_at', [$this->startDate, $this->endDate]);
            });
        }

        return $query->orderBy('assessment_id', 'desc')->orderBy('parameter_id', 'asc');
    }

    public function map($row): array
    {
        $this->rowNumber++;
        $assessment = $row->assessment;
        $param = $row->parameter;

        return [
            $this->rowNumber,
            $assessment?->idca ?? $assessment?->ticket_id ?? '-',
            $assessment?->ticket_id ?? '-',
            $assessment?->measurement_at ? $assessment->measurement_at->format('Y-m-d') : '-',
            $assessment?->service?->name ?? '-',
            $assessment?->agent_name ?? $assessment?->agent?->name ?? '-',
            $assessment?->qa_name ?? $assessment?->qaUser?->name ?? '-',
            $param?->code ?? '-',
            $param?->name ?? "Parameter #{$row->parameter_id}",
            $param?->weight !== null ? (float) $param->weight : 0.0,
            $row->score !== null ? (float) $row->score : 0.0,
            $row->note ?? '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'ID CA',
            'No Tiket CRM',
            'Tanggal Penilaian',
            'Layanan / Kanal',
            'Nama Agent',
            'Nama QA Evaluator',
            'Kode Parameter',
            'Butir Parameter SOP',
            'Bobot Parameter (%)',
            'Skor Penilaian (%)',
            'Catatan Temuan / Feedback',
        ];
    }

    public function title(): string
    {
        return 'Breakdown Skor Parameter';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF0369A1']], // Ocean blue
            ],
        ];
    }
}
