<?php

namespace App\Exports\Sheets;

use App\Models\KnowledgeDocument;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class KnowledgePoliciesSheet implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithTitle, WithStyles
{
    private int $rowNumber = 0;

    public function query(): \Illuminate\Database\Eloquent\Builder
    {
        return KnowledgeDocument::query()
            ->with(['user', 'attachments'])
            ->orderBy('discussion_date', 'desc')
            ->orderBy('id', 'desc');
    }

    public function map($row): array
    {
        $this->rowNumber++;
        $attachNames = $row->attachments ? $row->attachments->pluck('file_name')->implode(', ') : '-';

        return [
            $this->rowNumber,
            $row->id,
            $row->title,
            $row->discussion_date ? $row->discussion_date->format('Y-m-d') : '-',
            $row->status ?? 'Active',
            $row->user?->name ?? 'Supervisor',
            $row->summary ?? '-',
            $attachNames ?: '-',
            $row->created_at ? $row->created_at->format('Y-m-d H:i:s') : '-',
        ];
    }

    public function headings(): array
    {
        return [
            'No',
            'Doc ID',
            'Judul Kebijakan / Topik Kalibrasi',
            'Tanggal Pembahasan / Kalibrasi',
            'Status Kebijakan',
            'Dibuat Oleh (SPV/QA)',
            'Ringkasan Keputusan / SOP',
            'Lampiran Dokumen',
            'Waktu Dibuat',
        ];
    }

    public function title(): string
    {
        return 'Kebijakan SOP & Kalibrasi';
    }

    public function styles(Worksheet $sheet): ?array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF047857']], // Emerald green
            ],
        ];
    }
}
