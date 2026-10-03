<?php

namespace App\Exports;

use App\Exports\Sheets\CaAssessmentsSheet;
use App\Exports\Sheets\CaAssessmentScoresSheet;
use App\Exports\Sheets\SamplingAssignmentsSheet;
use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class QaWorkExport implements Export, WithMultipleSheets
{
    use Exportable;

    protected ?string $startDate;
    protected ?string $endDate;
    protected ?string $periodLabel;

    public function __construct($startDate = null, $endDate = null, ?string $periodLabel = null)
    {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->periodLabel = $periodLabel;
    }

    /**
     * Return array of sheets to be exported.
     */
    public function sheets(): array
    {
        return [
            new CaAssessmentsSheet($this->startDate, $this->endDate, $this->periodLabel),
            new CaAssessmentScoresSheet($this->startDate, $this->endDate),
            new SamplingAssignmentsSheet(),
        ];
    }
}
