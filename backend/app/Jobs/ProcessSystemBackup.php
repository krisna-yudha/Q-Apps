<?php

namespace App\Jobs;

use App\Exports\MasterDataExport;
use App\Exports\QaWorkExport;
use App\Exports\SpvImportsExport;
use App\Models\BackupLog;
use App\Models\BackupSetting;
use App\Services\GoogleDriveConfigService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Throwable;

class ProcessSystemBackup implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 900; // 15 mins for large data exports

    public string $period;
    public array $selectedItems;
    public string $triggerType;
    public ?int $userId;
    public ?string $userName;
    public ?string $customStartDate;
    public ?string $customEndDate;

    /**
     * Create a new job instance.
     *
     * @param string $period 'daily', 'weekly', 'monthly', 'custom', 'instant', etc.
     * @param array|null $selectedItems ['database', 'qa_worksheet', 'spv_imports', 'master_data']
     * @param string $triggerType 'scheduler' or 'manual'
     * @param int|null $userId
     * @param string|null $userName
     * @param string|null $customStartDate
     * @param string|null $customEndDate
     */
    public function __construct(
        string $period = 'daily',
        ?array $selectedItems = null,
        string $triggerType = 'scheduler',
        ?int $userId = null,
        ?string $userName = null,
        ?string $customStartDate = null,
        ?string $customEndDate = null
    ) {
        $this->period = strtolower(trim($period));
        $this->selectedItems = $selectedItems ?: [];
        $this->triggerType = $triggerType;
        $this->userId = $userId;
        $this->userName = $userName ?: ($triggerType === 'scheduler' ? 'Automated Scheduler' : 'Supervisor');
        $this->customStartDate = $customStartDate;
        $this->customEndDate = $customEndDate;

        $this->onQueue('backups');
    }

    /**
     * Execute the backup job.
     */
    public function handle(GoogleDriveConfigService $configService): void
    {
        $startTime = microtime(true);
        $startedAt = Carbon::now();
        $todayStr = $startedAt->format('Y-m-d');
        $timeStr = $startedAt->format('His');

        Log::info("[ProcessSystemBackup] Starting backup (Period: {$this->period}, Trigger: {$this->triggerType})");

        $setting = $configService->getActiveSetting();

        // Determine active items to backup
        $itemsToBackup = $this->selectedItems;
        if (empty($itemsToBackup)) {
            // Fallback to setting config or defaults
            if ($setting && !empty($setting->backup_items)) {
                $itemsToBackup = $setting->backup_items;
            } else {
                $itemsToBackup = ['database', 'qa_worksheet', 'spv_imports', 'master_data'];
            }
        }

        // Create log record with running status
        $log = BackupLog::create([
            'backup_setting_id' => $setting?->id,
            'user_id'           => $this->userId,
            'user_name'         => $this->userName,
            'trigger_type'      => $this->triggerType,
            'backup_type'       => $this->period,
            'items'             => $itemsToBackup,
            'status'            => 'running',
            'started_at'        => $startedAt,
            'details'           => [],
        ]);

        $uploadedFiles = [];
        $totalBytes = 0;

        try {
            // Step 1: Register Dynamic Google Drive Storage Disk
            $configService->registerDisk($setting);
            $disk = Storage::disk(GoogleDriveConfigService::DISK_NAME);

            // Step 2: Database Backup Dump (SQL Native Gzip)
            if (in_array('database', $itemsToBackup) || in_array('db', $itemsToBackup)) {
                Log::info("[ProcessSystemBackup] Generating Database SQL Dump for Google Drive...");
                $dbFileName = "Database/digiqa_db_dump_{$todayStr}_{$timeStr}.sql.gz";
                
                $sqlContent = $this->generateDatabaseSqlDump();
                $gzData = gzencode($sqlContent, 9);
                $fileSizeBytes = strlen($gzData);
                $totalBytes += $fileSizeBytes;

                $uploaded = $disk->put($dbFileName, $gzData);

                $uploadedFiles[] = [
                    'item'        => 'database',
                    'name'        => basename($dbFileName),
                    'path'        => $dbFileName,
                    'size_bytes'  => $fileSizeBytes,
                    'size_formatted' => $this->formatBytes($fileSizeBytes),
                    'destination' => 'Google Drive/Database',
                    'status'      => $uploaded ? 'success' : 'failed',
                ];
                Log::info("[ProcessSystemBackup] Database SQL Dump ({$dbFileName}) uploaded: " . ($uploaded ? 'SUCCESS' : 'FAILED'));
            }

            // Step 3: QA Worksheet Evaluations Export
            if (in_array('qa_worksheet', $itemsToBackup) || in_array('qa', $itemsToBackup)) {
                $qaStartDate = null;
                $qaEndDate = null;
                $qaFolder = 'QA/Daily';

                if ($this->customStartDate && $this->customEndDate) {
                    $qaStartDate = Carbon::parse($this->customStartDate)->startOfDay();
                    $qaEndDate = Carbon::parse($this->customEndDate)->endOfDay();
                    $qaFolder = 'QA/Custom';
                    $qaFilePath = "{$qaFolder}/QA-Report-{$qaStartDate->format('Ymd')}-to-{$qaEndDate->format('Ymd')}.xlsx";
                } elseif (in_array($this->period, ['weekly', 'qa_weekly'])) {
                    $qaStartDate = Carbon::now()->subWeek()->startOfWeek();
                    $qaEndDate = Carbon::now()->subWeek()->endOfWeek();
                    $qaFolder = 'QA/Weekly';
                    $qaFilePath = "{$qaFolder}/QA-Report-weekly-{$qaStartDate->format('Y-m-d')}_to_{$qaEndDate->format('Y-m-d')}.xlsx";
                } elseif (in_array($this->period, ['monthly', 'qa_monthly'])) {
                    $qaStartDate = Carbon::now()->subMonth()->startOfMonth();
                    $qaEndDate = Carbon::now()->subMonth()->endOfMonth();
                    $qaFolder = 'QA/Monthly';
                    $qaFilePath = "{$qaFolder}/QA-Report-monthly-{$qaStartDate->format('Y-m')}.xlsx";
                } else {
                    // Default Daily
                    $qaStartDate = Carbon::now()->subDay()->startOfDay();
                    $qaEndDate = Carbon::now()->subDay()->endOfDay();
                    $qaFolder = 'QA/Daily';
                    $qaFilePath = "{$qaFolder}/QA-Report-daily-{$qaStartDate->format('Y-m-d')}.xlsx";
                }

                Log::info("[ProcessSystemBackup] Exporting QA Worksheet to {$qaFilePath}...");
                Excel::store(
                    new QaWorkExport($qaStartDate, $qaEndDate, $qaFilePath),
                    $qaFilePath,
                    GoogleDriveConfigService::DISK_NAME,
                    \Maatwebsite\Excel\Excel::XLSX,
                    ['mimetype' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                );

                $uploadedFiles[] = [
                    'item'        => 'qa_worksheet',
                    'name'        => basename($qaFilePath),
                    'path'        => $qaFilePath,
                    'destination' => "Google Drive/{$qaFolder}",
                    'period'      => $qaStartDate ? "{$qaStartDate->format('Y-m-d')} s/d {$qaEndDate->format('Y-m-d')}" : 'Semua Data',
                    'status'      => 'success',
                ];
                Log::info("[ProcessSystemBackup] QA Worksheet successfully exported to {$qaFilePath}");
            }

            // Step 4: SPV Raw Data Upload Export (CSC / CRM Raw Transactions)
            if (in_array('spv_imports', $itemsToBackup) || in_array('raw_imports', $itemsToBackup)) {
                $spvFilePath = "SPV_Raw_Uploads/SPV-Raw-Data-{$todayStr}_{$timeStr}.xlsx";
                Log::info("[ProcessSystemBackup] Exporting SPV Raw Data to {$spvFilePath}...");
                Excel::store(
                    new SpvImportsExport(),
                    $spvFilePath,
                    GoogleDriveConfigService::DISK_NAME,
                    \Maatwebsite\Excel\Excel::XLSX,
                    ['mimetype' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                );

                $uploadedFiles[] = [
                    'item'        => 'spv_imports',
                    'name'        => basename($spvFilePath),
                    'path'        => $spvFilePath,
                    'destination' => 'Google Drive/SPV_Raw_Uploads',
                    'status'      => 'success',
                ];
                Log::info("[ProcessSystemBackup] SPV Raw Data successfully exported to {$spvFilePath}");
            }

            // Step 5: Master Data Export (Employees, Agents, Services, Parameters, Users)
            if (in_array('master_data', $itemsToBackup) || in_array('master', $itemsToBackup)) {
                $masterFilePath = "MasterData/Master-Data-{$todayStr}.xlsx";
                Log::info("[ProcessSystemBackup] Exporting Master Data to {$masterFilePath}...");
                Excel::store(
                    new MasterDataExport(),
                    $masterFilePath,
                    GoogleDriveConfigService::DISK_NAME,
                    \Maatwebsite\Excel\Excel::XLSX,
                    ['mimetype' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                );

                $uploadedFiles[] = [
                    'item'        => 'master_data',
                    'name'        => basename($masterFilePath),
                    'path'        => $masterFilePath,
                    'destination' => 'Google Drive/MasterData',
                    'status'      => 'success',
                ];
                Log::info("[ProcessSystemBackup] Master Data successfully exported to {$masterFilePath}");
            }

            $duration = round(microtime(true) - $startTime, 2);

            // Step 6: Update Log & BackupSetting status
            $log->update([
                'status'           => 'success',
                'files_count'      => count($uploadedFiles),
                'total_size_bytes' => $totalBytes,
                'details'          => $uploadedFiles,
                'duration_seconds' => $duration,
                'completed_at'     => Carbon::now(),
            ]);

            if ($setting) {
                $setting->update([
                    'last_backup_at' => Carbon::now(),
                    'last_status'    => 'success',
                    'last_error'     => null,
                ]);
            }

            Log::info("[ProcessSystemBackup] Backup completed in {$duration} seconds. ({$log->files_count} items generated)");
        } catch (Throwable $e) {
            $duration = round(microtime(true) - $startTime, 2);
            Log::error("[ProcessSystemBackup] Backup failed: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            $log->update([
                'status'           => 'failed',
                'error_message'    => $e->getMessage(),
                'duration_seconds' => $duration,
                'details'          => $uploadedFiles,
                'completed_at'     => Carbon::now(),
            ]);

            if ($setting) {
                $setting->update([
                    'last_status' => 'failed',
                    'last_error'  => $e->getMessage(),
                ]);
            }

            throw $e;
        }
    }

    /**
     * Generate complete MySQL Database SQL Dump string.
     */
    protected function generateDatabaseSqlDump(): string
    {
        $dbName = config('database.connections.mysql.database', 'qa_db');
        $tables = \Illuminate\Support\Facades\DB::select('SHOW TABLES');
        $tableKey = "Tables_in_" . $dbName;

        $sql = "-- =========================================================\n";
        $sql .= "-- DigiQA Enterprise Database Backup Dump\n";
        $sql .= "-- Database: {$dbName}\n";
        $sql .= "-- Generated At: " . Carbon::now()->toIso8601String() . " WIB\n";
        $sql .= "-- =========================================================\n\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n";
        $sql .= "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n";
        $sql .= "SET AUTOCOMMIT = 0;\n";
        $sql .= "START TRANSACTION;\n\n";

        foreach ($tables as $t) {
            $tableName = $t->$tableKey ?? current((array)$t);
            $createTable = \Illuminate\Support\Facades\DB::select("SHOW CREATE TABLE `{$tableName}`");
            if (!empty($createTable)) {
                $sql .= "-- ---------------------------------------------------------\n";
                $sql .= "-- Table structure for table `{$tableName}`\n";
                $sql .= "-- ---------------------------------------------------------\n";
                $sql .= "DROP TABLE IF EXISTS `{$tableName}`;\n";
                $sql .= $createTable[0]->{'Create Table'} . ";\n\n";
            }

            $rows = \Illuminate\Support\Facades\DB::table($tableName)->get();
            if ($rows->count() > 0) {
                $sql .= "-- Dumping data for table `{$tableName}` ({$rows->count()} records)\n";
                $chunks = $rows->chunk(500);
                foreach ($chunks as $chunk) {
                    $sql .= "INSERT INTO `{$tableName}` VALUES \n";
                    $rowInserts = [];
                    foreach ($chunk as $row) {
                        $values = array_map(function ($val) {
                            if ($val === null) return 'NULL';
                            return "'" . addslashes((string)$val) . "'";
                        }, (array)$row);
                        $rowInserts[] = "(" . implode(", ", $values) . ")";
                    }
                    $sql .= implode(",\n", $rowInserts) . ";\n\n";
                }
            }
        }

        $sql .= "COMMIT;\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

        return $sql;
    }

    /**
     * Format byte size to readable string.
     */
    protected function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
