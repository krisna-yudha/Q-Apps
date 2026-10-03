<?php

namespace App\Exports;

use App\Exports\Sheets\ImportBatchesSheet;
use App\Exports\Sheets\KnowledgePoliciesSheet;
use App\Exports\Sheets\RawSamplingTicketsSheet;
use App\Exports\Sheets\SipImportsSummarySheet;
use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class SpvImportsExport implements Export, WithMultipleSheets
{
    use Exportable;

    /**
     * Return array of sheets to be exported.
     */
    public function sheets(): array
    {
        return [
            new SipImportsSummarySheet(),
            new RawSamplingTicketsSheet(),
            new ImportBatchesSheet(),
            new KnowledgePoliciesSheet(),
        ];
    }
}
