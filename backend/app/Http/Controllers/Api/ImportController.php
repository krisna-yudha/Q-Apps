<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CaAssessment;
use App\Models\CaParameter;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\ImportBatch;
use App\Models\ImportProfile;
use App\Models\ImportRow;
use App\Models\Service;
use App\Services\NakerImportService;
use App\Services\QsfImportService;
use Illuminate\Http\Request;

class ImportController extends Controller
{
    protected NakerImportService $nakerService;
    protected QsfImportService $qsfService;

    public function __construct(NakerImportService $nakerService, QsfImportService $qsfService)
    {
        $this->nakerService = $nakerService;
        $this->qsfService = $qsfService;
    }

    /**
     * Daftar Import Profiles yang didukung sistem
     */
    public function getProfiles()
    {
        $profiles = ImportProfile::with('service')
            ->where('status', true)
            ->orderByRaw("FIELD(import_type, 'NAKER', 'QSF')")
            ->orderBy('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $profiles
        ]);
    }

    /**
     * Preview dan Validasi Excel sebelum injeksi
     */
    public function preview(Request $request)
    {
        $request->validate([
            'profile_code' => 'nullable|string',
            'import_type' => 'nullable|string',
            'rows' => 'required|array',
            'file_name' => 'nullable|string',
            'channel' => 'nullable|string',
        ]);

        $profileCode = $request->input('profile_code');
        $importType = $request->input('import_type');
        $rows = $request->input('rows', []);
        $fileName = $request->input('file_name', 'Import.xlsx');
        $channel = $request->input('channel', 'Inbound');

        if ($importType === 'NAKER' || $profileCode === 'NAKER_AUGUST_2026' || str_contains(strtolower($fileName), 'naker')) {
            $result = $this->nakerService->preview($rows, $fileName);
            return response()->json($result);
        }

        // QSF Import Preview
        $result = $this->qsfService->preview($rows, $channel, $fileName);
        return response()->json($result);
    }

    /**
     * Eksekusi Injeksi Data ke Database
     */
    public function process(Request $request)
    {
        $request->validate([
            'profile_code' => 'nullable|string',
            'import_type' => 'nullable|string',
            'rows' => 'required|array',
            'file_name' => 'nullable|string',
            'channel' => 'nullable|string',
            'import_mode' => 'nullable|string',
        ]);

        $profileCode = $request->input('profile_code');
        $importType = $request->input('import_type');
        $rows = $request->input('rows', []);
        $fileName = $request->input('file_name', 'Import.xlsx');
        $channel = $request->input('channel', 'Inbound');
        $importMode = $request->input('import_mode', 'upsert');
        $userId = $request->user()?->id;

        $batchOptions = [
            'is_first_batch' => $request->boolean('is_first_batch', true),
            'is_last_batch' => $request->boolean('is_last_batch', true),
            'batch_index' => (int)$request->input('batch_index', 1),
            'total_batches' => (int)$request->input('total_batches', 1),
            'import_id' => $request->input('import_id') ?: $request->input('batch_id'),
            'batch_id' => $request->input('batch_id') ?: $request->input('import_id'),
            'total_expected_rows' => $request->input('total_expected_rows') ? (int)$request->input('total_expected_rows') : null,
        ];

        if ($importType === 'NAKER' || $profileCode === 'NAKER_AUGUST_2026' || str_contains(strtolower($fileName), 'naker')) {
            $result = $this->nakerService->import($rows, $fileName, $importMode, $userId, $batchOptions);
            return response()->json($result);
        }

        // QSF Import
        $result = $this->qsfService->import($rows, $channel, $fileName, $importMode, $userId, $batchOptions);
        return response()->json($result);
    }

    /**
     * Riwayat Sesi Import (Import History)
     */
    public function getHistory(Request $request)
    {
        $batches = ImportBatch::with(['profile', 'uploader'])
            ->orderBy('id', 'desc')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $batches
        ]);
    }

    /**
     * Detail Error Baris untuk Batch Tertentu
     */
    public function getErrors($batchId)
    {
        $batch = ImportBatch::with('profile')->findOrFail($batchId);
        $errorRows = ImportRow::where('import_batch_id', $batchId)
            ->whereIn('status', ['failed', 'warning', 'duplicate'])
            ->get();

        return response()->json([
            'success' => true,
            'batch' => $batch,
            'errors' => $errorRows
        ]);
    }

    /**
     * Export Master Data NAKER ke format rows JSON (frontend generate XLSX)
     * Sesuai Roadmap §8 Mapping NAKER ke Database + §28 Contoh Import Profile
     * Kolom: NO, NAMA, JK, LAYANAN, TEAM TL, TRAINER, SITE, ID SIP
     */
    public function exportNaker(Request $request)
    {
        $search = $request->input('search');
        $service = $request->input('service');
        $gender = $request->input('gender');

        $query = Employee::with([
            'currentAssignment.service',
            'currentAssignment.site',
            'currentAssignment.teamLeader',
            'currentAssignment.trainer',
        ])->where('status', 'active');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sip_id', 'like', "%{$search}%");
            });
        }

        if ($gender) {
            $query->where('gender', strtoupper($gender));
        }

        $employees = $query->orderBy('name')->get();

        // Filter by service if needed
        if ($service && $service !== 'all') {
            $employees = $employees->filter(function ($emp) use ($service) {
                $svc = $emp->currentAssignment?->service;
                return $svc && (
                    stripos($svc->name, $service) !== false ||
                    stripos($svc->code, $service) !== false
                );
            })->values();
        }

        $rows = $employees->map(function ($emp, $idx) {
            $assignment = $emp->currentAssignment;
            return [
                'NO'       => $idx + 1,
                'NAMA'     => $emp->name,
                'JK'       => $emp->gender === 'PRIA' ? 'L' : ($emp->gender === 'WANITA' ? 'P' : ''),
                'LAYANAN'  => $assignment?->service?->name ?? '',
                'TEAM TL'  => $assignment?->teamLeader?->name ?? '',
                'TRAINER'  => $assignment?->trainer?->name ?? '',
                'SITE'     => $assignment?->site?->code ?? 'SMG',
                'ID SIP'   => $emp->sip_id,
            ];
        });

        return response()->json([
            'success' => true,
            'total'   => $rows->count(),
            'rows'    => $rows->values(),
            'columns' => ['NO', 'NAMA', 'JK', 'LAYANAN', 'TEAM TL', 'TRAINER', 'SITE', 'ID SIP'],
        ]);
    }

    /**
     * Export Data Assessment QSF per channel ke format rows JSON (frontend generate XLSX)
     * Sesuai Roadmap §29.1 Mapping Kolom Umum + §22 Parameter per Service
     *
     * Kolom output:
     * No, Site, IDCA, ID Tiket, CA, Layanan, Kategori, Sub Kategori, Pelanggan, Agent, Tgl Transaksi,
     * Durasi Transaksi, Durasi Sampling, QA, Tgl Ukur, [Platform jika ada], Hashtag, FCR, Ket FCR,
     * [Parameter dinamis per service], Score CA, Ket Summary, Rekomendasi, Ket Rekomendasi, Pernah Diubah
     */
    public function exportQsf(Request $request)
    {
        $channel = $request->input('channel', 'Inbound');
        $period  = $request->input('period'); // optional: '2026-08'

        // Detect canonical service code from channel name
        $service = QsfImportService::detectService($channel);

        // Get parameters for this service
        $parameters = CaParameter::where('service_id', $service->id)
            ->where('status', true)
            ->orderBy('sequence')
            ->get();

        // Build assessment query with all relations
        $query = CaAssessment::with([
            'site',
            'service',
            'category',
            'subCategory',
            'platform',
            'agent',
            'employee',
            'qa',
            'scores.parameter',
        ])->where('service_id', $service->id);

        if ($period) {
            // Filter by period (month format: 2026-08)
            try {
                [$year, $month] = explode('-', $period);
                $query->whereYear('measurement_at', $year)
                      ->whereMonth('measurement_at', $month);
            } catch (\Throwable $e) {
                // ignore invalid period, return all
            }
        }

        $assessments = $query->orderBy('measurement_at')->get();

        // Determine if this service has platform field
        $hasPlatform = in_array($service->code, ['DIGILIVE', 'SOCMED']);

        // Build score lookup: assessment_id → [param_code => score]
        $scoresByAssessment = [];
        foreach ($assessments as $assessment) {
            $scoresByAssessment[$assessment->id] = [];
            foreach ($assessment->scores as $score) {
                if ($score->parameter) {
                    $scoresByAssessment[$assessment->id][$score->parameter->code] = $score->score;
                }
            }
        }

        $rows = $assessments->map(function ($a, $idx) use ($parameters, $scoresByAssessment, $hasPlatform) {
            // Resolve agent name: prefer employee, fallback to agent_name
            $agentName = $a->employee?->sip_id
                ?? $a->agent?->name
                ?? $a->agent_name
                ?? '';

            // Resolve QA name: prefer qa user, fallback to qa_name
            $qaName = $a->qa?->name ?? $a->qa_name ?? '';

            // Format duration seconds to HH:MM:SS
            $formatDuration = function ($seconds) {
                if ($seconds === null) return '';
                $h = intdiv($seconds, 3600);
                $m = intdiv($seconds % 3600, 60);
                $s = $seconds % 60;
                return sprintf('%02d:%02d:%02d', $h, $m, $s);
            };

            $row = [
                'No'               => $idx + 1,
                'Site'             => $a->site?->code ?? 'SMG',
                'IDCA'             => $a->idca,
                'ID Tiket'         => $a->ticket_id ?? '',
                'CA'               => $a->source_ca ?? $a->service?->name ?? '',
                'Layanan'          => $a->source_layanan ?? $a->service?->name ?? '',
                'Kategori'         => $a->category?->name ?? '',
                'Sub Kategori'     => $a->subCategory?->name ?? '',
                'Pelanggan'        => $a->customer_name ?? '',
                'Agent'            => $agentName,
                'Tgl Transaksi'    => $a->transaction_at ? $a->transaction_at->format('Y-m-d H:i:s') : '',
                'Durasi Transaksi' => $formatDuration($a->transaction_duration_seconds),
                'Durasi Sampling'  => $formatDuration($a->sampling_duration_seconds),
                'QA'               => $qaName,
                'Tgl Ukur'         => $a->measurement_at ? $a->measurement_at->format('Y-m-d H:i:s') : '',
            ];

            // Platform (hanya untuk Digilive dan Socmed)
            if ($hasPlatform) {
                $row['Platform'] = $a->platform?->name ?? '';
            }

            $row['Hashtag'] = $a->hashtag ?? '';
            $row['FCR']     = $a->fcr ?? '';
            $row['Ket FCR'] = $a->fcr_note ?? '';

            // Dynamic parameters
            $scores = $scoresByAssessment[$a->id] ?? [];
            foreach ($parameters as $param) {
                $row[$param->code] = $scores[$param->code] ?? '';
            }

            $row['Score CA']         = $a->score_ca ?? '';
            $row['Ket Summary']      = $a->summary ?? '';
            $row['Rekomendasi']      = $a->recommendation ?? '';
            $row['Ket Rekomendasi']  = $a->recommendation_note ?? '';
            $row['Pernah Diubah']    = $a->ever_changed ? 'YA' : 'TIDAK';

            return $row;
        });

        // Build column list for frontend reference
        $columns = [
            'No', 'Site', 'IDCA', 'ID Tiket', 'CA', 'Layanan', 'Kategori', 'Sub Kategori',
            'Pelanggan', 'Agent', 'Tgl Transaksi', 'Durasi Transaksi', 'Durasi Sampling',
            'QA', 'Tgl Ukur',
        ];
        if ($hasPlatform) $columns[] = 'Platform';
        $columns[] = 'Hashtag';
        $columns[] = 'FCR';
        $columns[] = 'Ket FCR';
        foreach ($parameters as $param) {
            $columns[] = $param->code;
        }
        $columns = array_merge($columns, ['Score CA', 'Ket Summary', 'Rekomendasi', 'Ket Rekomendasi', 'Pernah Diubah']);

        return response()->json([
            'success'         => true,
            'service'         => ['code' => $service->code, 'name' => $service->name],
            'total'           => $rows->count(),
            'parameters'      => $parameters->map(fn ($p) => ['code' => $p->code, 'name' => $p->name]),
            'columns'         => $columns,
            'rows'            => $rows->values(),
        ]);
    }
}
