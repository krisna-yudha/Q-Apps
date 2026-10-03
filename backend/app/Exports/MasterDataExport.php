<?php

namespace App\Exports;

use App\Exports\Sheets\AgentsSheet;
use App\Exports\Sheets\EmployeesSheet;
use App\Exports\Sheets\ParametersSheet;
use App\Exports\Sheets\ServicesSheet;
use App\Exports\Sheets\UsersSheet;
use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class MasterDataExport implements Export, WithMultipleSheets
{
    use Exportable;

    /**
     * Return array of sheets to be exported.
     */
    public function sheets(): array
    {
        return [
            new EmployeesSheet(),
            new AgentsSheet(),
            new ServicesSheet(),
            new ParametersSheet(),
            new UsersSheet(),
        ];
    }
}
