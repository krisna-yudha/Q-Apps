<?php

namespace App\Exports\Sheets;

use App\Models\Service;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ServicesSheet implements FromCollection, WithHeadings, ShouldAutoSize, WithTitle, WithStyles
{
    public function collection(): \Illuminate\Support\Collection
    {
        $services = Service::with(['categories.subCategories'])->get();
        $rows = collect();
        $num = 0;

        foreach ($services as $srv) {
            if ($srv->categories->isEmpty()) {
                $num++;
                $rows->push([
                    $num,
                    $srv->name,
                    $srv->code ?? '-',
                    $srv->type ?? '-',
                    '-',
                    '-',
                    $srv->is_active ? 'Active' : 'Inactive',
                ]);
            } else {
                foreach ($srv->categories as $cat) {
                    if ($cat->subCategories->isEmpty()) {
                        $num++;
                        $rows->push([
                            $num,
                            $srv->name,
                            $srv->code ?? '-',
                            $srv->type ?? '-',
                            $cat->name,
                            '-',
                            $srv->is_active ? 'Active' : 'Inactive',
                        ]);
                    } else {
                        foreach ($cat->subCategories as $subCat) {
                            $num++;
                            $rows->push([
                                $num,
                                $srv->name,
                                $srv->code ?? '-',
                                $srv->type ?? '-',
                                $cat->name,
                                $subCat->name,
                                $srv->is_active ? 'Active' : 'Inactive',
                            ]);
                        }
                    }
                }
            }
        }

        return $rows;
    }

    public function headings(): array
    {
        return [
            'No',
            'Nama Layanan / Kanal',
            'Kode Layanan',
            'Tipe',
            'Kategori',
            'Sub Kategori',
            'Status',
        ];
    }

    public function title(): string
    {
        return 'Master Services & Categories';
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
