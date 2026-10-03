<?php

use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    \Spatie\Backup\BackupServiceProvider::class,
    \Maatwebsite\Excel\ExcelServiceProvider::class,
];
