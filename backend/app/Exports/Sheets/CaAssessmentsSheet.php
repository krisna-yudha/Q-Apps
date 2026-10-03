<?php

namespace App\Exports\Sheets;

use App\Models\CaAssessment;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CaAssessmentsSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    protected ?string $startDate;
    protected ?string $endDate;
    protected ?string $periodLabel;
    private int $rowNumber = 0;

    public function __construct($startDate = null, $endDate = null, ?string $periodLabel = null)
    {
        $this->startDate = $startDate ? Carbon::parse($startDate)->startOfDay()->toDateTimeString() : null;
        $this->endDate = $endDate ? Carbon::parse($endDate)->endOfDay()->toDateTimeString() : null;
        $this->periodLabel = $periodLabel ?: ($startDate && $endDate ? "{$startDate} - {$endDate}" : 'Semua Data');
    }

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        $query = CaAssessment::query()
            ->with([
                'service',
                'site',
                'agent',
                'category',
                'subCategory',
                'qaUser',
                'scores.parameter'
            ]);

        if ($this->startDate && $this->endDate) {
            $query->whereBetween('measurement_at', [$this->startDate, $this->endDate]);
        }

        return $query->orderBy('measurement_at', 'desc')->orderBy('id', 'desc');
    }

    public function map($row): array
    {
        $this->rowNumber++;

        return [
            $this->rowNumber,
            $row->idca ?? $row->ticket_id ?? '-',
            $row->ticket_id ?? '-',
            $row->measurement_at ? $row->measurement_at->format('Y-m-d H:i:s') : '-',
            $row->transaction_at ? $row->transaction_at->format('Y-m-d H:i:s') : '-',
            $row->service?->name ?? $row->source_layanan ?? '-',
            $row->site?->name ?? '-',
            $row->agent_name ?? $row->agent?->name ?? '-',
            $row->qa_name ?? $row->qaUser?->name ?? '-',
            $row->customer_name ?? '-',
            $row->customer_phone ?? '-',
            $row->score_ca !== null ? (float) $row->score_ca : 0.0,
            $row->fcr ? 'YES' : 'NO',
            $row->fcr_note ?? '-',
            $row->cso_classification ?? '-',
            $row->category?->name ?? '-',
            $row->subCategory?->name ?? '-',
            $row->summary ?? '-',
            $row->recommendation ?? '-',
            $row->source ?? 'DigiQA-App',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'ID CA',
            'No Tiket CRM / CSC',
            'Waktu Penilaian (Measurement)',
            'Waktu Transaksi (Interaction)',
            'Layanan / Kanal',
            'Site Kerja',
            'Nama Agent',
            'Nama Evaluator (QA)',
            'Nama Pelanggan',
            'Kontak Pelanggan',
            'Score CA (%)',
            'FCR (First Contact Resolution)',
            'Catatan FCR',
            'Klasifikasi CSO',
            'Kategori Interaksi',
            'Sub Kategori',
            'Ringkasan Evaluasi (Summary)',
            'Rekomendasi / Coaching',
            'Sumber Data',
        ];
    }

    public function title(): string
    {
        return 'Rekap Penilaian QA';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF0F2744']], // Navy brand color
            ],
        ];
    }
}
