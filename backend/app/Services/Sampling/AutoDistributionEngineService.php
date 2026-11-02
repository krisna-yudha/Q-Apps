<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\SamplingAssignment;
use App\Models\SamplingPeriod;
use App\Models\SamplingQaAttendance;
use App\Models\SamplingQuotaRequest;
use App\Models\SamplingTarget;
use App\Models\SamplingTargetCso;
use App\Models\Site;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AutoDistributionEngineService
{
    /**
     * Daily Category Allocation Target per QA Evaluator
     * Informasi = 6, Gangguan = 7, Keluhan = 6, Permohonan = 1 (Total = 20 Tiket/QA/Hari)
     */
    public const DAILY_CATEGORY_TARGETS = [
        'INFORMASI'  => 6,
        'GANGGUAN'   => 7,
        'KELUHAN'    => 6,
        'PERMOHONAN' => 1,
    ];

    public const DAILY_TOTAL_PER_QA = 20;
    public const MAX_PER_AGENT_PER_QA_MONTHLY = 2; // Mandatory: max 2 tickets per agent per QA in 30 days

    /**
     * Helper to resolve standardized category name from raw assessment
     */
    public static function resolveCategoryName($asm): string
    {
        $catName = strtoupper(trim((string)($asm->category?->name ?? '')));
        $subCatName = strtoupper(trim((string)($asm->subCategory?->name ?? '')));
        $source = strtoupper(trim((string)($asm->source ?? '')));
        $sourceCa = strtoupper(trim((string)($asm->source_ca ?? '')));
        $sourceFile = strtoupper(trim((string)($asm->source_file ?? '')));
        $combined = "{$catName} {$subCatName} {$source} {$sourceCa} {$sourceFile}";

        if (str_contains($combined, 'PERMOHONAN') || str_contains($combined, 'PASANG BARU') || str_contains($combined, 'MUTASI') || str_contains($combined, 'REQUEST') || str_contains($combined, 'REGISTRASI')) {
            return 'PERMOHONAN';
        }
        if (str_contains($combined, 'KELUHAN') || str_contains($combined, 'KOMPLAIN') || str_contains($combined, 'COMPLAINT') || str_contains($combined, 'KLH')) {
            return 'KELUHAN';
        }
        if (str_contains($combined, 'GANGGUAN') || str_contains($combined, 'GGN') || str_contains($combined, 'TROUBLE') || str_contains($combined, 'INCIDENT') || str_contains($combined, 'RUSAK') || str_contains($combined, 'DOWN') || str_contains($combined, 'LOS')) {
            return 'GANGGUAN';
        }

        return 'INFORMASI';
    }

    /**
     * Helper to classify Digilive sub-sources (ICHAT Pelanggan vs OMNI Non-Pelanggan vs OMNI Pelanggan)
     */
    public static function classifyDigiliveSubSource($asm): string
    {
        $hashtag = strtoupper((string)($asm->hashtag ?: ''));
        $srcFile = strtolower((string)($asm->source_file ?: ''));
        $custName = strtoupper(trim((string)($asm->customer_name ?: '')));

        if (str_contains($hashtag, '#ICHAT') || str_contains($srcFile, 'conversation') || str_contains($srcFile, 'ichat')) {
            return 'ICHAT_PELANGGAN';
        }
        if (str_contains($hashtag, '#OMNI') || str_contains($srcFile, 'summary') || str_contains($srcFile, 'omni')) {
            if (str_contains($hashtag, '#NON_PELANGGAN') || $custName === 'NON PELANGGAN') {
                return 'OMNI_NON_PELANGGAN';
            }
            return 'OMNI_PELANGGAN';
        }
        return 'DIGILIVE_GENERAL';
    }

    /**
     * Evaluasi kelayakan tanggal transaksi tiket untuk skema sampling harian.
     * Sesuai aturan: Skema sampling adalah per hari (transaksi tanggal 1 didistribusikan tanggal 2, dst).
     * Tiket yang terpaut lampau (> toleransi hari atau beda periode lampau) otomatis ditolak (invalid).
     *
     * @param \App\Models\CaAssessment|object $asm
     * @param string $targetDateString Format 'Y-m-d'
     * @param string $periodCode Format 'Y-m'
     * @param int $maxPastDays Default 3 hari (toleransi akhir pekan)
     * @return array [bool $isValid, int $daysGap, int|null $dateTier, string $reason]
     */
    public static function evaluateTransactionDateForSampling($asm, string $targetDateString, string $periodCode, int $maxPastDays = 3): array
    {
        $txTimestamp = $asm->transaction_at ?: $asm->measurement_at ?: $asm->created_at;
        if (!$txTimestamp) {
            return [false, null, null, 'Tanggal transaksi tidak ditemukan'];
        }

        try {
            $targetDate = Carbon::parse($targetDateString)->startOfDay();
            $txCarbon = Carbon::parse($txTimestamp)->startOfDay();
            $txPeriod = Carbon::parse($txTimestamp)->format('Y-m');

            // Selisih hari kalender: targetDate - txDate
            // Misal: targetDate 2026-11-02 vs tx 2026-11-01 => $daysGap = 1 (H-1)
            // Misal: targetDate 2026-11-02 vs tx 2026-11-02 => $daysGap = 0 (Intraday / Same-day)
            // Misal: targetDate 2026-11-02 vs tx 2026-11-03 => $daysGap = -1 (Future)
            // Misal: targetDate 2026-11-02 vs tx 2026-10-17 => $daysGap = 16 (Terpaut 16 hari lampau)
            $daysGap = (int)$txCarbon->diffInDays($targetDate, false);

            // 1. Tanggal transaksi sama dengan hari distribusi (intraday) atau di masa depan
            // Rule: Jika tiket bertanggal sama dengan hari sampling atau lebih, otomatis dieliminasi (Wajib H-1 atau sebelumnya).
            if ($daysGap <= 0) {
                if ($daysGap === 0) {
                    return [false, $daysGap, null, "Tanggal transaksi ({$txCarbon->format('Y-m-d')}) bertanggal sama dengan hari sampling ({$targetDateString}) - Wajib H-1 atau sebelumnya (Dieliminasi)"];
                }
                return [false, $daysGap, null, "Tanggal transaksi ({$txCarbon->format('Y-m-d')}) melebihi hari sampling ({$targetDateString}) (Dieliminasi)"];
            }

            // Jika hari target adalah Senin, berikan toleransi hingga 4 hari (mencakup Jumat, Sabtu, Minggu)
            $allowedMaxDays = ($targetDate->dayOfWeek === Carbon::MONDAY) ? max(4, $maxPastDays) : $maxPastDays;

            // 2. Cek apakah terpaut lampau
            if ($daysGap > $allowedMaxDays) {
                return [false, $daysGap, null, "Terpaut lampau {$daysGap} hari (maksimal {$allowedMaxDays} hari untuk skema harian)"];
            }

            // 3. Validasi periode bulan: jika beda bulan dan bukan transisi tgl 1 (H-1)
            if ($txPeriod !== $periodCode && $daysGap > $allowedMaxDays) {
                return [false, $daysGap, null, "Periode transaksi ({$txPeriod}) tidak sesuai dengan periode aktif ({$periodCode})"];
            }

            // 4. Klasifikasi Tier Prioritas (Wajib H-1 atau sebelumnya)
            $dateTier = match (true) {
                $daysGap === 1 => 1, // Prioritas Utama: H-1 (Baku harian: misal transaksi tgl 1 didistribusi tgl 2)
                $daysGap === 2 => 2, // H-2 (Sabtu)
                $daysGap === 3 => 3, // H-3 (Jumat)
                default        => 4, // H-4 (Khusus Senin toleransi Jumat)
            };

            return [true, $daysGap, $dateTier, 'Valid'];
        } catch (\Exception $e) {
            return [false, null, null, 'Format tanggal transaksi tidak valid: ' . $e->getMessage()];
        }
    }

    /**
     * Helper to resolve channel string
     */
    public static function resolveChannel($raw): string
    {
        $u = strtoupper(trim((string)$raw));
        if (empty($u)) return 'Inbound';

        // 1. Email Outbound (Specific before generic Email)
        if (str_contains($u, 'EMAIL OUTBOUND') || str_contains($u, 'EMAIL OUTBOND') || str_contains($u, 'EMAIL_OUTBOUND') || str_contains($u, 'EMAIL_OUTBOND') || str_contains($u, 'OUTBOUND REGULER') || str_contains($u, 'OUTBOND REGULER')) {
            return 'Email Outbound';
        }

        // 2. Outbound Call (Specific before generic Inbound / Call)
        if (str_contains($u, 'OUTBOUND CALL') || str_contains($u, 'OUTBOND CALL') || str_contains($u, 'OUTBOUND_CALL') || str_contains($u, 'OUTBOND_CALL') || $u === 'OUTBOUND' || $u === 'OUTBOND' || $u === 'OBC') {
            return 'Outbound Call';
        }

        // 3. Socmed (Specific before generic Chat - handles WhatsApp, Instagram, Google Play, Social Media, Twitter, Facebook, Coster)
        if (str_contains($u, 'SOCMED') || str_contains($u, 'SOSMED') || str_contains($u, 'SOCIAL') || str_contains($u, 'INSTAGRAM') || str_contains($u, 'WHATSAPP') || str_contains($u, 'WA') || str_contains($u, 'COSTER') || str_contains($u, 'GOOGLE PLAY') || str_contains($u, 'PLAYSTORE') || str_contains($u, 'PLAY STORE') || str_contains($u, 'TWITTER') || str_contains($u, 'FACEBOOK') || str_contains($u, 'FB') || str_contains($u, 'TIKTOK')) {
            return 'Socmed';
        }

        // 4. Back Office (Specific before generic)
        if (str_contains($u, 'BACK OFFICE') || str_contains($u, 'BACKOFFICE') || str_contains($u, 'ESKALASI') || str_contains($u, 'KETEPATAN ESKALASI BO') || str_contains($u, 'INTERNAL') || str_contains($u, 'SALES') || $u === 'BO' || str_ends_with($u, ' BO') || str_starts_with($u, 'BO ') || str_contains($u, 'SBU')) {
            return 'Back Office';
        }

        // 5. Digilive (Live Chat, Digilive, Webhook, Portal, Botika, My Icon+, PLN Mobile, Ngaoss, ichat, Chatbot)
        if (str_contains($u, 'DIGILIVE') || str_contains($u, 'LIVE CHAT') || str_contains($u, 'LIVECHAT') || str_contains($u, 'CHATBOT') || str_contains($u, 'BOTIKA') || str_contains($u, 'WEBHOOK') || str_contains($u, 'PORTAL') || str_contains($u, 'MY ICON') || str_contains($u, 'MYICON') || str_contains($u, 'PLN') || str_contains($u, 'NGAOSS') || str_contains($u, 'ICHAT') || str_contains($u, 'CHAT')) {
            return 'Digilive';
        }

        // 6. Email (Email Inbound)
        if (str_contains($u, 'EMAIL') || str_contains($u, 'MAIL')) {
            return 'Email';
        }

        // 7. Inbound Call (Voice, Phone, Retail)
        if ($u === 'PHONE' || str_contains($u, 'INBOUND') || str_contains($u, 'INBOND') || str_contains($u, 'VOICE') || str_contains($u, 'CALL') || str_contains($u, 'RETAIL')) {
            return 'Inbound';
        }

        return 'Inbound';
    }

    /**
     * Validasi kesesuaian data tiket terhadap Data Master NAKER (datamasternaker)
     * Aturan:
     * 1. Agen pada tiket harus terverifikasi sebagai Human CSO di Data Master NAKER.
     * 2. Agen bukan merupakan peran non-operasional (TL, Trainer, QA, Supervisor, Pendukung Operasional, dsb).
     * 3. Layanan tiket (source_layanan / source_ca) HARUS SESUAI dan SELARAS dengan Layanan Penugasan
     *    agen di Master NAKER (e.g., Agen Digilive hanya boleh mendapat tiket Digilive, Agen Back Office hanya tiket Back Office).
     * 
     * @return array [bool $isValid, int|null $serviceId, string|null $channelName, int|null $employeeId, string $reason]
     */
    public static function validateCandidateAgainstMasterNaker($cand, ?array $nakerCaches = null): array
    {
        $caches = $nakerCaches ?? NakerVerificationService::loadNakerCaches();

        $rawName = (string)($cand->agent_name ?? ($cand->agent?->name ?? ''));
        $nik = (string)($cand->employee_id ?? ($cand->agent?->nik ?? ''));

        $cso = NakerVerificationService::classifyCso($rawName, $nik, $caches);
        if ($cso['classification'] !== NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER || !$cso['is_naker_verified']) {
            return [false, null, null, null, "Agen '{$rawName}' tidak terverifikasi di Master NAKER (Non-Human CSO / Bot)"];
        }

        $emp = $cso['employee'] ?? null;
        if (!$emp) {
            return [false, null, null, null, "Data employee '{$rawName}' tidak ditemukan di Master NAKER"];
        }

        $asn = $caches['assignments']->get($emp->id) ?? null;
        if (!$asn || !$asn->service_id) {
            return [false, null, null, null, "Employee '{$emp->name}' belum memiliki penugasan layanan aktif di Master NAKER"];
        }

        // Batasi hanya untuk CSO operasional (service_id 1-7). Role TL, Trainer, QA, SPV, dll. TIDAK boleh disampling.
        if ((int)$asn->service_id > 7) {
            $srvName = $asn->service?->name ?? "ID {$asn->service_id}";
            return [false, null, null, null, "Employee '{$emp->name}' bukan CSO operasional ({$srvName})"];
        }

        $subServiceUpper = strtoupper(trim((string)$asn->sub_service));
        if (str_contains($subServiceUpper, 'NON CSO') || str_contains($subServiceUpper, 'TRAINER') || str_contains($subServiceUpper, 'LEADER')) {
            return [false, null, null, null, "Employee '{$emp->name}' berstatus non-CSO ({$asn->sub_service})"];
        }

        // Resolusi kanal resmi Master NAKER
        $agentMasterChannel = self::resolveChannel($asn->service?->name ?: $asn->sub_service);
        $agentServiceId = (int)$asn->service_id;

        // Resolusi kanal pada tiket transaksi mentah
        $ticketRaw = $cand->source_layanan ?: ($cand->source_ca ?: '');
        $ticketChannel = self::resolveChannel($ticketRaw);

        // Validasi ketat: Layanan Tiket HARUS sama dengan Layanan Master NAKER
        if (strtolower($ticketChannel) !== strtolower($agentMasterChannel)) {
            return [
                false,
                null,
                null,
                null,
                "Layanan tiket ('{$ticketChannel}') tidak sesuai dengan layanan Master NAKER ('{$agentMasterChannel}') untuk agen '{$emp->name}'"
            ];
        }

        return [true, $agentServiceId, $agentMasterChannel, $emp->id, 'OK'];
    }

    /**
     * Get active QA evaluator names
     */
    public static function getActiveQaNames(SamplingPeriod $period): array
    {
        return \App\Models\User::where('role', 'quality_assurance')
            ->whereNotIn('name', ['QA Lead 1', 'QA.INBOUND'])
            ->pluck('name')
            ->toArray();
    }

    /**
     * Run Daily Auto Distribution (20 Tickets per QA: 6 Informasi, 7 Gangguan, 6 Keluhan, 1 Permohonan)
     * Enforces:
     * 1. 20 tickets / QA / day: Informasi = 6, Gangguan = 7, Keluhan = 6, Permohonan = 1.
     * 2. Mandatory Max 2 tickets per agent per QA in a 30-day period.
     * 3. Cap on CSOs that already completed their monthly sampling target.
     * 4. Anti-duplicate ticket per period.
     */
    public static function runDailyDistribution(
        string $periodCode = '2026-08',
        ?string $dateStr = null,
        array $customQaList = [],
        bool $clearExistingForDay = false,
        array $customCategoryTargets = []
    ): array {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);

        // Resolve category composition targets (priority: passed custom targets -> saved period composition -> default static)
        $categoryTargets = self::DAILY_CATEGORY_TARGETS;
        if (!empty($customCategoryTargets)) {
            $cleaned = [];
            foreach ($customCategoryTargets as $k => $v) {
                $cleaned[strtoupper(trim((string)$k))] = max(0, (int)$v);
            }
            $categoryTargets = array_merge($categoryTargets, $cleaned);
            // Save as persistent period preference
            $period->update(['daily_category_composition' => $categoryTargets]);
        } elseif (!empty($period->daily_category_composition) && is_array($period->daily_category_composition)) {
            $categoryTargets = array_merge($categoryTargets, $period->daily_category_composition);
        }

        $dailyTotalPerQa = array_sum($categoryTargets);
        if ($dailyTotalPerQa <= 0) {
            $categoryTargets = self::DAILY_CATEGORY_TARGETS;
            $dailyTotalPerQa = self::DAILY_TOTAL_PER_QA;
        }

        $targetDate = $dateStr ? Carbon::parse($dateStr) : now();
        $targetDateString = $targetDate->format('Y-m-d');

        // Resolve active QA evaluators who are ON DUTY / Ready for this day (Rule 2: Daily Readiness Roster)
        $readyNames = SamplingQaAttendanceService::getReadyQaNamesForDate($periodCode, $targetDateString);
        if (!empty($customQaList)) {
            $activeInCustom = array_values(array_filter($customQaList, function($q) use ($readyNames) {
                return in_array($q, $readyNames);
            }));
            $qaNames = $activeInCustom;
        } else {
            $qaNames = $readyNames;
        }

        if (empty($qaNames)) {
            throw new \Exception("Belum ada QA yang ON DUTY / Ready pada tanggal {$targetDateString}. Pastikan QA telah login dan mengaktifkan status ON DUTY.");
        }

        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        // 1. Fetch Verified Human CSO Agents
        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) {
                $q->where('name', 'not like', '%.01%')
                  ->where('name', 'not like', '%CSO.01%')
                  ->where('name', 'not like', '%OB.01%')
                  ->where('name', 'not like', '%AS.01%');
            })
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::whereNotIn('name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])->get();
        }

        $agentsByName = $activeAgents->keyBy(fn($a) => strtoupper(trim((string)$a->name)));
        $agentsByNik = $activeAgents->keyBy(fn($a) => strtoupper(trim((string)$a->nik)));
        $firstAgentId = $activeAgents->first()?->id ?? 1;

        $resolveAgentId = function($cand) use ($agentsByName, $agentsByNik, $firstAgentId) {
            if (!empty($cand->agent_id)) return $cand->agent_id;
            if (!empty($cand->agent_name)) {
                $nameUpper = strtoupper(trim((string)$cand->agent_name));
                if ($agentsByName->has($nameUpper)) return $agentsByName->get($nameUpper)->id;
            }
            if (!empty($cand->employee_id)) {
                $nikUpper = strtoupper(trim((string)$cand->employee_id));
                if ($agentsByNik->has($nikUpper)) return $agentsByNik->get($nikUpper)->id;
            }
            return $cand->id ?: $firstAgentId;
        };

        $targetDateCarbon = Carbon::parse($targetDateString);
        // Toleransi selisih hari lampau (skema harian):
        // Jika target hari Senin, toleransi sampai Jumat (4 hari). Hari biasa toleransi 3 hari.
        $allowedMaxPastDays = ($targetDateCarbon->dayOfWeek === Carbon::MONDAY) ? 4 : 3;
        $earliestAllowedDate = $targetDateCarbon->copy()->subDays($allowedMaxPastDays)->startOfDay()->format('Y-m-d H:i:s');
        $latestAllowedDate = $targetDateCarbon->copy()->subDay()->endOfDay()->format('Y-m-d H:i:s'); // Maksimal H-1 23:59:59 (Hari sama / masa depan dieliminasi)

        // Muat cache Data Master NAKER untuk verifikasi O(1)
        $nakerCaches = NakerVerificationService::loadNakerCaches();

        // Pembersihan otomatis:
        // 1. Jika terdapat tiket ASSIGNED (belum dikerjakan) yang tanggal transaksinya terbukti terpaut lampau
        //    (> batas toleransi hari dari target distribusi atau beda bulan lampau), hapus dari antrean QA.
        // 2. Jika terdapat tiket ASSIGNED yang layanan penugasan agennya TIDAK SESUAI dengan Master NAKER,
        //    hapus dari antrean QA agar digantikan dengan tiket yang valid, segar, dan selaras dengan SOP NAKER.
        SamplingAssignment::where('sampling_period_id', $period->id)
            ->where('status', 'ASSIGNED')
            ->whereNotNull('assessment_id')
            ->whereHas('assessment', function($q) use ($earliestAllowedDate, $latestAllowedDate) {
                $q->where(function($sq) use ($earliestAllowedDate, $latestAllowedDate) {
                    $sq->where('transaction_at', '<', $earliestAllowedDate)
                       ->orWhere('transaction_at', '>', $latestAllowedDate);
                });
            })
            ->delete();

        $activeAssignedRows = SamplingAssignment::where('sampling_period_id', $period->id)
            ->where('status', 'ASSIGNED')
            ->with(['agent', 'assessment'])
            ->get();

        $mismatchedAssignedIds = [];
        foreach ($activeAssignedRows as $saRow) {
            $candCheck = $saRow->assessment ?: $saRow;
            $saTid = (string)($saRow->ticket_id ?? ($candCheck->ticket_id ?? ''));
            $saSourceCa = (string)($candCheck->source_ca ?? '');
            if (self::isNonCsoAlarmTicket($saTid, $saSourceCa, $candCheck)) {
                $mismatchedAssignedIds[] = $saRow->id;
                continue;
            }
            [$isValidNaker] = self::validateCandidateAgainstMasterNaker($candCheck, $nakerCaches);
            if (!$isValidNaker) {
                $mismatchedAssignedIds[] = $saRow->id;
            }
        }
        if (!empty($mismatchedAssignedIds)) {
            SamplingAssignment::whereIn('id', $mismatchedAssignedIds)->delete();
        }

        // If clearExistingForDay is requested, delete unworked ASSIGNED tickets first so they return to pool
        if ($clearExistingForDay) {
            SamplingAssignment::where('sampling_period_id', $period->id)
                ->whereDate('assigned_at', $targetDateString)
                ->where('status', 'ASSIGNED')
                ->delete();
        }

        // 2. Fetch already assigned tickets in this period to enforce anti-duplicate & count per agent per QA
        $existingAssignments = SamplingAssignment::where('sampling_period_id', $period->id)->get();
        $assignedTicketIds = $existingAssignments->pluck('ticket_id')->flip()->toArray();
        $assignedAssessmentIds = $existingAssignments->whereNotNull('assessment_id')->pluck('assessment_id')->flip()->toArray();

        // Agent assignment count per QA in this period: [ qaName => [ agentId => count ] ]
        $agentCountPerQa = [];
        // CSO overall completed count in this period
        $csoOverallCount = [];

        foreach ($existingAssignments as $ea) {
            $qa = $ea->evaluator_name;
            $agId = $ea->agent_id;
            if (!isset($agentCountPerQa[$qa])) {
                $agentCountPerQa[$qa] = [];
            }
            $agentCountPerQa[$qa][$agId] = ($agentCountPerQa[$qa][$agId] ?? 0) + 1;

            if ($ea->status === 'COMPLETED') {
                $csoOverallCount[$agId] = ($csoOverallCount[$agId] ?? 0) + 1;
            }
        }

        // 3. Query all eligible raw CRM assessments from DB across verified sites (excluding TIDAK ADA RESPON)
        // Strictly filter candidates within the allowed transaction date window [earliestAllowedDate .. latestAllowedDate]
        $allAssessments = CaAssessment::where('source', 'CRM_RAW')
            ->with(['category', 'subCategory'])
            ->select(
                'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
                'source_layanan', 'source', 'source_ca', 'source_file', 'service_id', 'category_id', 'sub_category_id', 'transaction_at',
                'measurement_at', 'created_at', 'cso_classification', 'is_naker_verified', 'is_bad_rating', 'hashtag'
            )
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($earliestAllowedDate, $latestAllowedDate) {
                $q->whereBetween('transaction_at', [$earliestAllowedDate, $latestAllowedDate])
                  ->orWhere(function($sub) use ($earliestAllowedDate, $latestAllowedDate) {
                      $sub->whereNull('transaction_at')
                          ->whereBetween('measurement_at', [$earliestAllowedDate, $latestAllowedDate]);
                  });
            })
            ->where(function($q) {
                $q->where('agent_name', 'not like', '%.01%')
                  ->where('agent_name', 'not like', '%CSO.01%')
                  ->where('agent_name', 'not like', '%OB.01%')
                  ->where('agent_name', 'not like', '%AS.01%')
                  ->where('agent_name', 'not like', '%NOC%')
                  ->where('agent_name', 'not like', '%NGAOSS%')
                  ->where('agent_name', 'not like', '%RSBS-INT%');
            })
            ->where(function($q) {
                $q->where('ticket_id', 'not like', 'A14%')
                  ->where('ticket_id', 'not like', 'A1480306%');
            })
            ->where(function($q) {
                $q->whereNull('summary')
                  ->orWhere(function($sq) {
                      $sq->where('summary', 'not like', '%TIDAK ADA RESPON%')
                         ->where('summary', 'not like', '%NO RESPONSE%')
                         ->where('summary', 'not like', '%NO RESPON%')
                         ->where('summary', 'not like', '%TIDAK RESPON%');
                  });
            })
            ->whereDoesntHave('subCategory', function($sq) {
                $sq->where('name', 'like', '%TIDAK ADA RESPON%')
                   ->orWhere('name', 'like', '%NO RESPONSE%')
                   ->orWhere('name', 'like', '%NO RESPON%')
                   ->orWhere('name', 'like', '%TIDAK RESPON%');
            })
            ->get();

        if ($allAssessments->isEmpty()) {
            throw new \Exception("Tiket transaksi mentah CRM untuk tanggal distribusi {$targetDateString} (skema transaksi H-1) belum tersedia di pool cadangan. Pastikan file tarikan CRM harian terbaru telah diunggah di Modul 7.");
        }

        // Categorize available pools
        $categorizedPool = [
            'INFORMASI'  => collect(),
            'GANGGUAN'   => collect(),
            'KELUHAN'    => collect(),
            'PERMOHONAN' => collect(),
        ];

        $seenCandidateTicketIds = [];
        $eliminationLookup = self::getEliminationLookup();

        foreach ($allAssessments as $asm) {
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$asm->id]) || isset($seenCandidateTicketIds[$tid])) {
                continue; // Skip already assigned in this period or duplicate in raw pool
            }
            if (self::isEliminatedTicket($asm, $eliminationLookup)) {
                continue; // Skip ticket matching Real Monitoring or Bad Rating
            }

            // Validasi ketat kesesuaian data tiket terhadap data layanan penugasan Master NAKER agen
            [$isValidNaker, $valSvcId, $valChan, $valEmpId, $nakerMsg] = self::validateCandidateAgainstMasterNaker($asm, $nakerCaches);
            if (!$isValidNaker) {
                continue; // Lewati tiket yang layanannya tidak sesuai data layanan Master NAKER agen
            }
            $asm->validated_service_id = $valSvcId;
            $asm->validated_channel = $valChan;
            $asm->validated_employee_id = $valEmpId;

            // Validasi ketat tanggal transaksi (Skema Harian: cegah tiket terpaut lampau)
            [$isValidDate, $daysGap, $dateTier, $dateMsg] = self::evaluateTransactionDateForSampling(
                $asm,
                $targetDateString,
                $periodCode,
                $allowedMaxPastDays
            );

            if (!$isValidDate) {
                continue; // Lewati tiket yang terpaut lampau atau tidak sesuai aturan harian
            }

            $asm->sampling_date_tier = $dateTier;
            $asm->sampling_days_gap = $daysGap;

            $seenCandidateTicketIds[$tid] = true;
            $cat = self::resolveCategoryName($asm);
            $categorizedPool[$cat]->push($asm);
        }

        $totalValidCandidates = array_sum(array_map(fn($c) => count($c), $categorizedPool));
        if ($totalValidCandidates === 0) {
            throw new \Exception("Tiket transaksi mentah CRM yang memenuhi aturan tanggal harian (transaksi H-1 / maksimal {$allowedMaxPastDays} hari terakhir) belum tersedia di pool cadangan. Pastikan file tarikan CRM harian terbaru telah diunggah di Modul 7.");
        }

        // Shuffle each category pool for fairness
        foreach ($categorizedPool as $k => $c) {
            $categorizedPool[$k] = $c->shuffle();
        }

        $now = now();
        $recordsToInsert = [];
        $allocatedPerQa = [];

        $channelCountPerQa = [];
        $digiliveSubCountPerQa = [];
        foreach ($qaNames as $qaName) {
            $allocatedPerQa[$qaName] = [
                'TOTAL'      => 0,
            ];
            $channelCountPerQa[$qaName] = [];
            $digiliveSubCountPerQa[$qaName] = [
                'ICHAT_PELANGGAN'    => 0,
                'OMNI_NON_PELANGGAN' => 0,
                'OMNI_PELANGGAN'     => 0,
                'DIGILIVE_GENERAL'   => 0,
            ];
            foreach ($categoryTargets as $catKey => $count) {
                $allocatedPerQa[$qaName][$catKey] = 0;
            }

            if (!isset($agentCountPerQa[$qaName])) {
                $agentCountPerQa[$qaName] = [];
            }

            // Check how many tickets are ALREADY assigned to this QA on the target date
            $todayQaAssignments = $existingAssignments->filter(function($ea) use ($qaName, $targetDate, $clearExistingForDay) {
                if ($ea->evaluator_name !== $qaName || !$ea->assigned_at || !$ea->assigned_at->isSameDay($targetDate)) {
                    return false;
                }
                if ($clearExistingForDay && $ea->status === 'ASSIGNED') {
                    return false; // will be deleted and replaced with fresh SOP-compliant tickets
                }
                return true;
            });

            foreach ($todayQaAssignments as $tqa) {
                $c = $tqa->category_name ?: ($tqa->assessment ? self::resolveCategoryName($tqa->assessment) : 'INFORMASI');
                $allocatedPerQa[$qaName][$c] = ($allocatedPerQa[$qaName][$c] ?? 0) + 1;
                $allocatedPerQa[$qaName]['TOTAL']++;

                $chan = self::resolveChannel($tqa->channel ?: ($tqa->assessment?->source_layanan ?: $tqa->assessment?->source_ca));
                $channelCountPerQa[$qaName][$chan] = ($channelCountPerQa[$qaName][$chan] ?? 0) + 1;
                if ($chan === 'Digilive' && $tqa->assessment) {
                    $st = self::classifyDigiliveSubSource($tqa->assessment);
                    $digiliveSubCountPerQa[$qaName][$st] = ($digiliveSubCountPerQa[$qaName][$st] ?? 0) + 1;
                }
            }
        }

        // Helper to find the best channel-balanced candidate from a pool for a given QA
        $findBestCandidate = function($pool, $qaName, $maxAllowance) use (
            &$assignedTicketIds, &$assignedAssessmentIds, $resolveAgentId,
            &$agentCountPerQa, &$channelCountPerQa, &$digiliveSubCountPerQa, &$csoOverallCount, $qaNames
        ) {
            $eligible = [];
            foreach ($pool as $idx => $cand) {
                $tid = trim((string)$cand->ticket_id) ?: (trim((string)$cand->idca) ?: "TCK-{$cand->id}");
                if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$cand->id])) {
                    continue;
                }
                $agId = $resolveAgentId($cand);
                $currentQaAgentCount = $agentCountPerQa[$qaName][$agId] ?? 0;
                if ($currentQaAgentCount >= $maxAllowance) {
                    continue;
                }
                $csoDone = $csoOverallCount[$agId] ?? 0;
                if ($csoDone >= (count($qaNames) * self::MAX_PER_AGENT_PER_QA_MONTHLY)) {
                    continue;
                }

                $chan = self::resolveChannel($cand->source_layanan ?: $cand->source_ca);
                $chanCount = $channelCountPerQa[$qaName][$chan] ?? 0;

                // SOP Digilive MyIcon Rule: 50% Pelanggan (ICHAT) vs 50% Non-Pelanggan (OMNI), fallback OMNI Pelanggan
                $subPriority = 0;
                if ($chan === 'Digilive') {
                    $subType = self::classifyDigiliveSubSource($cand);
                    $ichatCount = $digiliveSubCountPerQa[$qaName]['ICHAT_PELANGGAN'] ?? 0;
                    $omniNonCount = $digiliveSubCountPerQa[$qaName]['OMNI_NON_PELANGGAN'] ?? 0;

                    if ($ichatCount <= $omniNonCount) {
                        // Priority: ICHAT Pelanggan -> OMNI Non-Pelanggan -> OMNI Pelanggan (fallback)
                        if ($subType === 'ICHAT_PELANGGAN') $subPriority = 0;
                        elseif ($subType === 'OMNI_NON_PELANGGAN') $subPriority = 1;
                        elseif ($subType === 'OMNI_PELANGGAN') $subPriority = 2;
                        else $subPriority = 3;
                    } else {
                        // Priority: OMNI Non-Pelanggan -> OMNI Pelanggan (fallback) -> ICHAT Pelanggan
                        if ($subType === 'OMNI_NON_PELANGGAN') $subPriority = 0;
                        elseif ($subType === 'OMNI_PELANGGAN') $subPriority = 1;
                        elseif ($subType === 'ICHAT_PELANGGAN') $subPriority = 2;
                        else $subPriority = 3;
                    }
                }

                $eligible[] = [
                    'idx'          => $idx,
                    'cand'         => $cand,
                    'chan'         => $chan,
                    'chan_count'   => $chanCount,
                    'sub_priority' => $subPriority,
                    'date_tier'    => $cand->sampling_date_tier ?? 1,
                    'random'       => mt_rand(1, 10000),
                ];
            }

            if (empty($eligible)) {
                return [null, null, null];
            }

            // Sort by:
            // 1. Date Tier: Prioritas Tier 1 (H-1 / Transaksi kemarin) paling utama
            // 2. Channel balancing count for this QA
            // 3. Digilive 50/50 sub-priority
            // 4. Random for tie-breaking
            usort($eligible, function($a, $b) {
                if ($a['date_tier'] !== $b['date_tier']) {
                    return $a['date_tier'] <=> $b['date_tier'];
                }
                if ($a['chan_count'] !== $b['chan_count']) {
                    return $a['chan_count'] <=> $b['chan_count'];
                }
                if ($a['chan'] === 'Digilive' && $b['chan'] === 'Digilive' && $a['sub_priority'] !== $b['sub_priority']) {
                    return $a['sub_priority'] <=> $b['sub_priority'];
                }
                return $a['random'] <=> $b['random'];
            });

            $best = $eligible[0];
            return [$best['idx'], $best['cand'], $best['chan']];
        };

        // PHASE 1: Fair Round-Robin Distribution for Category Targets with Channel Balancing
        foreach ($categoryTargets as $catName => $targetCount) {
            $catPool = $categorizedPool[$catName] ?? collect();

            for ($slot = 1; $slot <= $targetCount; $slot++) {
                foreach ($qaNames as $qaName) {
                    $currentCatCount = $allocatedPerQa[$qaName][$catName] ?? 0;
                    if ($currentCatCount >= $targetCount) continue;
                    if ($allocatedPerQa[$qaName]['TOTAL'] >= $dailyTotalPerQa) continue;

                    [$foundIdx, $candidate, $channel] = $findBestCandidate($catPool, $qaName, self::MAX_PER_AGENT_PER_QA_MONTHLY);

                    if ($candidate !== null && $foundIdx !== null) {
                        $catPool->forget($foundIdx);
                        $tid = trim((string)$candidate->ticket_id) ?: (trim((string)$candidate->idca) ?: "TCK-{$candidate->id}");
                        $agId = $resolveAgentId($candidate);

                        $assignedTicketIds[$tid] = true;
                        $assignedAssessmentIds[$candidate->id] = true;
                        $agentCountPerQa[$qaName][$agId] = ($agentCountPerQa[$qaName][$agId] ?? 0) + 1;
                        $channelCountPerQa[$qaName][$channel] = ($channelCountPerQa[$qaName][$channel] ?? 0) + 1;
                        if ($channel === 'Digilive') {
                            $subType = self::classifyDigiliveSubSource($candidate);
                            $digiliveSubCountPerQa[$qaName][$subType] = ($digiliveSubCountPerQa[$qaName][$subType] ?? 0) + 1;
                        }

                        $assignedAt = $targetDate->copy()->setTime(now()->hour, now()->minute, now()->second);
                        $validUntil = $assignedAt->copy()->addDays(7)->endOfDay();

                        $recordsToInsert[] = [
                            'sampling_period_id' => $period->id,
                            'ticket_id'          => $tid,
                            'agent_id'           => $agId,
                            'evaluator_name'     => $qaName,
                            'service_id'         => $candidate->validated_service_id ?: $candidate->service_id,
                            'site_id'            => $candidate->site_id ?: $smgSiteId,
                            'channel'            => $candidate->validated_channel ?: $channel,
                            'category_name'      => $catName,
                            'cso_classification' => 'VERIFIED_NAKER',
                            'is_naker_verified'  => true,
                            'assignment_type'    => 'MANDATORY',
                            'is_extra_quota'     => false,
                            'valid_until'        => $validUntil,
                            'status'             => 'ASSIGNED',
                            'assessment_id'      => $candidate->id,
                            'score_ca'           => null,
                            'fcr'                => null,
                            'notes'              => null,
                            'assigned_at'        => $assignedAt,
                            'started_at'         => null,
                            'completed_at'       => null,
                            'hold_at'            => null,
                            'abandoned_at'       => null,
                            'quota_request_id'   => null,
                            'created_at'         => $now,
                            'updated_at'         => $now,
                        ];

                        $allocatedPerQa[$qaName][$catName]++;
                        $allocatedPerQa[$qaName]['TOTAL']++;
                    }
                }
            }
            $categorizedPool[$catName] = $catPool->values();
        }

        // PHASE 2: Fair Fallback Round-Robin across remaining pools with Channel Balancing for any QA with deficit
        $anyDeficit = true;
        $fallbackOrder = ['GANGGUAN', 'KELUHAN', 'INFORMASI', 'PERMOHONAN'];
        $maxAgentAllowance = self::MAX_PER_AGENT_PER_QA_MONTHLY; // starts at 2

        while ($anyDeficit) {
            $anyAssignedInPass = false;

            foreach ($qaNames as $qaName) {
                if ($allocatedPerQa[$qaName]['TOTAL'] >= $dailyTotalPerQa) continue;

                $candidate = null;
                $chosenCat = null;
                $chosenIdx = null;
                $chosenChan = null;

                foreach ($fallbackOrder as $fCat) {
                    $pool = $categorizedPool[$fCat] ?? collect();
                    [$idx, $cand, $chan] = $findBestCandidate($pool, $qaName, $maxAgentAllowance);
                    if ($cand !== null && $idx !== null) {
                        $candidate = $cand;
                        $chosenCat = $fCat;
                        $chosenIdx = $idx;
                        $chosenChan = $chan;
                        break;
                    }
                }

                if ($candidate !== null && $chosenCat !== null && $chosenIdx !== null) {
                    $categorizedPool[$chosenCat]->forget($chosenIdx);
                    $categorizedPool[$chosenCat] = $categorizedPool[$chosenCat]->values();

                    $tid = trim((string)$candidate->ticket_id) ?: (trim((string)$candidate->idca) ?: "TCK-{$candidate->id}");
                    $agId = $resolveAgentId($candidate);

                    $assignedTicketIds[$tid] = true;
                    $assignedAssessmentIds[$candidate->id] = true;
                    $agentCountPerQa[$qaName][$agId] = ($agentCountPerQa[$qaName][$agId] ?? 0) + 1;
                    $channelCountPerQa[$qaName][$chosenChan] = ($channelCountPerQa[$qaName][$chosenChan] ?? 0) + 1;
                    if ($chosenChan === 'Digilive') {
                        $subType = self::classifyDigiliveSubSource($candidate);
                        $digiliveSubCountPerQa[$qaName][$subType] = ($digiliveSubCountPerQa[$qaName][$subType] ?? 0) + 1;
                    }

                    $assignedAt = $targetDate->copy()->setTime(now()->hour, now()->minute, now()->second);
                    $validUntil = $assignedAt->copy()->addDays(7)->endOfDay();

                    $recordsToInsert[] = [
                        'sampling_period_id' => $period->id,
                        'ticket_id'          => $tid,
                        'agent_id'           => $agId,
                        'evaluator_name'     => $qaName,
                        'service_id'         => $candidate->validated_service_id ?: $candidate->service_id,
                        'site_id'            => $candidate->site_id ?: $smgSiteId,
                        'channel'            => $candidate->validated_channel ?: $chosenChan,
                        'category_name'      => $chosenCat,
                        'cso_classification' => 'VERIFIED_NAKER',
                        'is_naker_verified'  => true,
                        'assignment_type'    => 'MANDATORY',
                        'is_extra_quota'     => false,
                        'valid_until'        => $validUntil,
                        'status'             => 'ASSIGNED',
                        'assessment_id'      => $candidate->id,
                        'score_ca'           => null,
                        'fcr'                => null,
                        'notes'              => null,
                        'assigned_at'        => $assignedAt,
                        'started_at'         => null,
                        'completed_at'       => null,
                        'hold_at'            => null,
                        'abandoned_at'       => null,
                        'quota_request_id'   => null,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ];

                    if (!isset($allocatedPerQa[$qaName][$chosenCat])) {
                        $allocatedPerQa[$qaName][$chosenCat] = 0;
                    }
                    $allocatedPerQa[$qaName][$chosenCat]++;
                    $allocatedPerQa[$qaName]['TOTAL']++;
                    $anyAssignedInPass = true;
                }
            }

            $stillDeficitCount = collect($allocatedPerQa)->filter(fn($a) => ($a['TOTAL'] ?? 0) < $dailyTotalPerQa)->count();
            $totalRemainingInPools = collect($categorizedPool)->sum(fn($p) => $p->count());

            if ($stillDeficitCount === 0 || $totalRemainingInPools === 0) {
                $anyDeficit = false;
            } elseif (!$anyAssignedInPass) {
                $maxAgentAllowance++;
                if ($maxAgentAllowance > 15) {
                    $anyDeficit = false;
                }
            }
        }

        DB::beginTransaction();
        try {
            if ($clearExistingForDay) {
                SamplingAssignment::where('sampling_period_id', $period->id)
                    ->whereDate('assigned_at', $targetDateString)
                    ->where('status', 'ASSIGNED')
                    ->delete();
            }

            // Deduplicate records on [sampling_period_id, ticket_id]
            $uniqueRecords = [];
            foreach ($recordsToInsert as $rec) {
                $uniqueKey = $rec['sampling_period_id'] . '_' . $rec['ticket_id'];
                if (!isset($uniqueRecords[$uniqueKey])) {
                    $uniqueRecords[$uniqueKey] = $rec;
                }
            }
            $recordsToInsert = array_values($uniqueRecords);

            foreach (array_chunk($recordsToInsert, 500) as $chunk) {
                SamplingAssignment::insertOrIgnore($chunk);
            }

            SamplingTargetEngineService::syncActuals($periodCode);

            // Update tickets_distributed_count on SamplingQaAttendance
            foreach ($qaNames as $allocatedQaName) {
                $actualAssignedToday = SamplingAssignment::where('sampling_period_id', $period->id)
                    ->whereDate('assigned_at', $targetDateString)
                    ->where(function($q) use ($allocatedQaName) {
                        $clean = str_replace(' ', '.', strtoupper(trim($allocatedQaName)));
                        $withSpace = str_replace('.', ' ', strtoupper(trim($allocatedQaName)));
                        $q->where('evaluator_name', $allocatedQaName)
                          ->orWhere('evaluator_name', $clean)
                          ->orWhere('evaluator_name', $withSpace);
                    })
                    ->where('status', '!=', 'CANCELLED')
                    ->count();

                SamplingQaAttendance::where('sampling_period_id', $period->id)
                    ->where(function($q) use ($allocatedQaName) {
                        $clean = str_replace(' ', '.', strtoupper(trim($allocatedQaName)));
                        $withSpace = str_replace('.', ' ', strtoupper(trim($allocatedQaName)));
                        $q->where('evaluator_name', $allocatedQaName)
                          ->orWhere('evaluator_name', $clean)
                          ->orWhere('evaluator_name', $withSpace);
                    })
                    ->whereDate('work_date', $targetDateString)
                    ->update(['tickets_distributed_count' => $actualAssignedToday]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'period'                => $periodCode,
            'distribution_mode'     => 'CUSTOM_DAILY_CATEGORY_QUOTA',
            'target_date'           => $targetDateString,
            'rules' => [
                'composition'       => $categoryTargets,
                'total_per_qa'      => $dailyTotalPerQa,
                'max_agent_per_qa'  => self::MAX_PER_AGENT_PER_QA_MONTHLY,
            ],
            'total_inserted'        => count($recordsToInsert),
            'qa_allocations'        => $allocatedPerQa,
        ];
    }

    /**
     * SPV Extra Quota Grant (Rule 1):
     * Grants $extraCount additional tickets to $evaluatorName with 1-day (24-hour) expiration.
     */
    public static function grantExtraQuota(
        string $periodCode,
        string $evaluatorName,
        int $extraCount = 5,
        ?string $reason = null,
        ?int $requestId = null,
        ?string $targetCategory = null
    ): array {
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        $validUntil = now()->addHours(24);
        $now = now();
        $targetCatUpper = $targetCategory ? strtoupper(trim($targetCategory)) : null;

        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->get();
        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::all();
        }

        // Fetch already assigned tickets in this period
        $assignedTicketIds = SamplingAssignment::where('sampling_period_id', $period->id)->pluck('ticket_id')->flip()->toArray();
        $assignedAssessmentIds = SamplingAssignment::where('sampling_period_id', $period->id)->whereNotNull('assessment_id')->pluck('assessment_id')->flip()->toArray();

        $todayCarbon = now();
        $allowedMaxPastDays = ($todayCarbon->dayOfWeek === Carbon::MONDAY) ? 4 : 3;
        $earliestAllowedDate = $todayCarbon->copy()->subDays($allowedMaxPastDays)->startOfDay()->format('Y-m-d H:i:s');
        $latestAllowedDate = $todayCarbon->copy()->subDay()->endOfDay()->format('Y-m-d H:i:s'); // Maksimal H-1 (Hari sama / masa depan dieliminasi)

        // Get unassigned raw CRM assessments (strictly excluding TIDAK ADA RESPON, DUMMY/TEST, and lampau tickets)
        $candidateQuery = CaAssessment::where('source', 'CRM_RAW')
            ->with(['category', 'subCategory'])
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($earliestAllowedDate, $latestAllowedDate) {
                $q->whereBetween('transaction_at', [$earliestAllowedDate, $latestAllowedDate])
                  ->orWhere(function($sub) use ($earliestAllowedDate, $latestAllowedDate) {
                      $sub->whereNull('transaction_at')
                          ->whereBetween('measurement_at', [$earliestAllowedDate, $latestAllowedDate]);
                  });
            })
            ->where(function($q) {
                $q->whereNull('summary')
                  ->orWhere(function($sq) {
                      $sq->where('summary', 'not like', '%TIDAK ADA RESPON%')
                         ->where('summary', 'not like', '%NO RESPONSE%')
                         ->where('summary', 'not like', '%NO RESPON%')
                         ->where('summary', 'not like', '%TIDAK RESPON%')
                         ->where('summary', 'not like', '%DUMMY%')
                         ->where('summary', 'not like', '%TEST%');
                  });
            })
            ->whereDoesntHave('subCategory', function($sq) {
                $sq->where('name', 'like', '%TIDAK ADA RESPON%')
                   ->orWhere('name', 'like', '%NO RESPONSE%')
                   ->orWhere('name', 'like', '%NO RESPON%')
                   ->orWhere('name', 'like', '%TIDAK RESPON%');
            });

        $candidates = $candidateQuery->get()->shuffle();
        if ($candidates->isEmpty()) {
            $candidates = CaAssessment::where('source', 'CRM_RAW')
                ->with(['category', 'subCategory'])
                ->whereNotIn('agent_name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])
                ->where(function($q) {
                    $q->whereNull('summary')
                      ->orWhere(function($sq) {
                          $sq->where('summary', 'not like', '%DUMMY%')
                             ->where('summary', 'not like', '%TEST%');
                      });
                })
                ->get()->shuffle();
        }
        if ($candidates->isEmpty()) {
            $candidates = CaAssessment::where('source', 'CRM_RAW')
                ->with(['category', 'subCategory'])->get()->shuffle();
        }

        $seenCandidates = [];
        $eliminationLookup = self::getEliminationLookup();
        $nakerCachesExtra = NakerVerificationService::loadNakerCaches();

        $availableCandidates = $candidates->filter(function($asm) use ($assignedTicketIds, $assignedAssessmentIds, &$seenCandidates, $eliminationLookup, $targetCatUpper, $nakerCachesExtra, $todayCarbon, $periodCode, $allowedMaxPastDays) {
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$asm->id]) || isset($seenCandidates[$tid])) {
                return false;
            }
            if (self::isEliminatedTicket($asm, $eliminationLookup)) {
                return false;
            }

            // Validasi ketat kesesuaian data tiket dan layanan Master NAKER agen
            [$isValidNaker, $valSvcId, $valChan, $valEmpId] = self::validateCandidateAgainstMasterNaker($asm, $nakerCachesExtra);
            if (!$isValidNaker) {
                return false;
            }
            $asm->validated_service_id = $valSvcId;
            $asm->validated_channel = $valChan;
            $asm->validated_employee_id = $valEmpId;

            // Exclude dummy or test tickets
            $tidUpper = strtoupper($tid);
            $summaryUpper = strtoupper((string)($asm->summary ?? ''));
            $agentUpper = strtoupper((string)($asm->agent_name ?? ''));
            if (
                str_contains($tidUpper, 'DUMMY') ||
                str_contains($tidUpper, 'TEST') ||
                str_contains($summaryUpper, 'DUMMY') ||
                str_contains($summaryUpper, 'TEST TIKET') ||
                str_contains($summaryUpper, 'TIKET DUMMY') ||
                str_contains($summaryUpper, 'UJI COBA') ||
                str_contains($agentUpper, 'DUMMY') ||
                str_contains($agentUpper, 'TEST')
            ) {
                return false;
            }

            // Validasi kelayakan tanggal transaksi untuk mitigasi kuota harian (cegah tiket terpaut lampau)
            [$isValidDate, $daysGap, $dateTier] = self::evaluateTransactionDateForSampling(
                $asm,
                $todayCarbon->format('Y-m-d'),
                $periodCode,
                $allowedMaxPastDays
            );
            if (!$isValidDate) {
                return false;
            }
            $asm->sampling_date_tier = $dateTier;

            // Target Category Filter
            if ($targetCatUpper && $targetCatUpper !== 'ALL') {
                $cat = self::resolveCategoryName($asm);
                if (strtoupper($cat) !== $targetCatUpper) {
                    return false;
                }
            }

            $seenCandidates[$tid] = true;
            return true;
        });

        if ($availableCandidates->isEmpty()) {
            if ($targetCatUpper && $targetCatUpper !== 'ALL') {
                throw new \Exception("Tiket transaksi mentah CRM di pool cadangan untuk kategori '{$targetCatUpper}' yang memenuhi aturan tanggal harian (H-1 / maksimal {$allowedMaxPastDays} hari) tidak tersedia atau sudah habis. Silakan gunakan kategori lain atau unggah berkas raw CRM baru.");
            }
            throw new \Exception("Tiket transaksi mentah CRM di pool cadangan yang memenuhi aturan tanggal harian (H-1 / maksimal {$allowedMaxPastDays} hari) tidak mencukupi untuk tambahan kuota. Silakan setor berkas raw CRM baru.");
        }

        // Track current channel count for this evaluator
        $currentEvaluatorChannels = SamplingAssignment::where('sampling_period_id', $period->id)
            ->where('evaluator_name', $evaluatorName)
            ->selectRaw('channel, count(*) as cnt')
            ->groupBy('channel')
            ->pluck('cnt', 'channel')
            ->toArray();

        // Sort available candidates by: 1. Date Tier (H-1 first), 2. evaluator lowest channel count, 3. random
        $sortedCandidates = $availableCandidates->map(function($asm) use ($currentEvaluatorChannels) {
            $chan = self::resolveChannel($asm->source_layanan ?: $asm->source_ca);
            $cnt = $currentEvaluatorChannels[$chan] ?? 0;
            return [
                'asm'        => $asm,
                'chan'       => $chan,
                'chan_count' => $cnt,
                'date_tier'  => $asm->sampling_date_tier ?? 1,
                'rand'       => mt_rand(1, 10000),
            ];
        })->sort(function($a, $b) {
            if ($a['date_tier'] !== $b['date_tier']) {
                return $a['date_tier'] <=> $b['date_tier'];
            }
            if ($a['chan_count'] !== $b['chan_count']) {
                return $a['chan_count'] <=> $b['chan_count'];
            }
            return $a['rand'] <=> $b['rand'];
        });

        $recordsToInsert = [];
        $granted = 0;

        foreach ($sortedCandidates as $candObj) {
            if ($granted >= $extraCount) break;

            $asm = $candObj['asm'];
            $channel = $candObj['chan'];
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            $catName = self::resolveCategoryName($asm);

            $catTag = $targetCatUpper && $targetCatUpper !== 'ALL' ? " [Kategori: {$targetCatUpper}]" : "";
            $recordsToInsert[] = [
                'sampling_period_id' => $period->id,
                'ticket_id'          => $tid,
                'agent_id'           => $asm->agent_id ?: ($activeAgents->first()->id ?? 1),
                'evaluator_name'     => $evaluatorName,
                'service_id'         => $asm->validated_service_id ?: $asm->service_id,
                'site_id'            => $smgSiteId,
                'channel'            => $asm->validated_channel ?: $channel,
                'category_name'      => $catName,
                'cso_classification' => 'VERIFIED_NAKER',
                'is_naker_verified'  => true,
                'assignment_type'    => 'ADDITIONAL',
                'is_extra_quota'     => true,
                'valid_until'        => $validUntil,
                'status'             => 'ASSIGNED',
                'assessment_id'      => $asm->id,
                'score_ca'           => null,
                'fcr'                => null,
                'notes'              => $reason ? "Kuota Tambahan SPV (1 Hari){$catTag}: {$reason}" : "Kuota Tambahan SPV (1 Hari){$catTag}",
                'assigned_at'        => $now,
                'started_at'         => null,
                'completed_at'       => null,
                'hold_at'            => null,
                'abandoned_at'       => null,
                'quota_request_id'   => $requestId,
                'created_at'         => $now,
                'updated_at'         => $now,
            ];

            $assignedTicketIds[$tid] = true;
            $assignedAssessmentIds[$asm->id] = true;
            $currentEvaluatorChannels[$channel] = ($currentEvaluatorChannels[$channel] ?? 0) + 1;
            $granted++;
        }

        DB::beginTransaction();
        try {
            $uniqueRecords = [];
            foreach ($recordsToInsert as $rec) {
                $uniqueKey = $rec['sampling_period_id'] . '_' . $rec['ticket_id'];
                if (!isset($uniqueRecords[$uniqueKey])) {
                    $uniqueRecords[$uniqueKey] = $rec;
                }
            }
            SamplingAssignment::insertOrIgnore(array_values($uniqueRecords));

            // Update Quota Request record if provided
            if ($requestId) {
                $req = SamplingQuotaRequest::find($requestId);
                if ($req) {
                    $req->update([
                        'status'         => 'APPROVED',
                        'approved_by'    => auth()->user()?->name ?? 'Supervisor QA',
                        'approved_count' => $granted,
                        'valid_until'    => $validUntil,
                    ]);
                }
            }

            // Sync targets
            $target = SamplingTarget::where('sampling_period_id', $period->id)
                ->where('evaluator_name', $evaluatorName)
                ->first();
            if ($target) {
                $target->increment('target_total', $granted);
                $target->increment('additional_target', $granted);
            }

            SamplingTargetEngineService::syncActuals($periodCode);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'success'          => true,
            'evaluator_name'   => $evaluatorName,
            'granted_count'    => $granted,
            'category'         => $targetCatUpper ?: 'ALL',
            'valid_until'      => $validUntil->toIso8601String(),
            'valid_hours'      => 24,
            'message'          => $targetCatUpper && $targetCatUpper !== 'ALL'
                ? "+{$granted} tiket ekstra kategori {$targetCatUpper} untuk {$evaluatorName} berhasil ditambahkan."
                : "+{$granted} tiket ekstra untuk {$evaluatorName} berhasil ditambahkan.",
        ];
    }

    /**
     * Run Full Monthly Auto Distribution Engine (Mandatory 2/CSO/QA + Additional with Channel Balancing)
     */
    public static function runDistribution(string $periodCode = '2026-08', string $siteFilter = 'SMG'): array
    {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);
        $now = now();

        $qaNames = self::getActiveQaNames($period);
        if (empty($qaNames)) {
            throw new \Exception("Belum ada akun QA Evaluator terdaftar.");
        }
        $smgSite = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $smgSiteId = $smgSite?->id;

        $activeAgents = Agent::where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('name', 'not like', '%.01%')
                  ->where('name', 'not like', '%CSO.01%')
                  ->where('name', 'not like', '%OB.01%')
                  ->where('name', 'not like', '%AS.01%');
            })
            ->get();

        if ($activeAgents->isEmpty()) {
            $activeAgents = Agent::whereNotIn('name', ['VIA MY ICONNET MOBILE', 'VIA BOTIKA', 'VIA PLN MOBILE', 'VIA NGAOSS', 'SYSTEM', 'BOT'])->get();
        }

        $allAssessments = CaAssessment::where('source', 'CRM_RAW')
            ->with(['category', 'subCategory'])
            ->select(
                'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
                'source_layanan', 'source', 'source_ca', 'source_file', 'service_id', 'category_id', 'sub_category_id', 'transaction_at',
                'measurement_at', 'created_at', 'cso_classification', 'is_naker_verified'
            )
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($periodCode) {
                $q->where(\Illuminate\Support\Facades\DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"), '=', $periodCode)
                  ->orWhere('source_file', 'LIKE', "%{$periodCode}%");
            })
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->whereNull('site_id');
                }
            })
            ->where(function($q) {
                $q->where('agent_name', 'not like', '%.01%')
                  ->where('agent_name', 'not like', '%CSO.01%')
                  ->where('agent_name', 'not like', '%OB.01%')
                  ->where('agent_name', 'not like', '%AS.01%')
                  ->where('agent_name', 'not like', '%NOC%')
                  ->where('agent_name', 'not like', '%NGAOSS%')
                  ->where('agent_name', 'not like', '%RSBS-INT%');
            })
            ->where(function($q) {
                $q->where('ticket_id', 'not like', 'A14%')
                  ->where('ticket_id', 'not like', 'A1480306%');
            })
            ->get();

        $nakerCachesFull = NakerVerificationService::loadNakerCaches();
        $allAssessments = $allAssessments->filter(function($asm) use ($nakerCachesFull) {
            [$isValidNaker, $valSvcId, $valChan] = self::validateCandidateAgainstMasterNaker($asm, $nakerCachesFull);
            if (!$isValidNaker) return false;
            $asm->validated_service_id = $valSvcId;
            $asm->validated_channel = $valChan;
            return true;
        });

        if ($allAssessments->isEmpty()) {
            throw new \Exception('Tiket transaksi mentah CRM di pool cadangan yang sesuai dengan data penugasan Master NAKER belum tersedia. Silakan lakukan Setor Berkas transaksi CRM (Excel 62 kolom) di Modul 7 terlebih dahulu.');
        }

        $assessmentsByAgent = $allAssessments->groupBy('agent_id');
        $numQas = count($qaNames);
        $totalPoolTarget = 370;
        $baseQuota = intdiv($totalPoolTarget, $numQas);
        $remainder = $totalPoolTarget % $numQas;

        $qaTargetQuotas = [];
        $qaBuckets = [];
        $qaAgentCounts = []; // Enforce max 2 per agent per QA
        $qaChannelCounts = []; // Enforce channel balancing across all 7 channels

        foreach ($qaNames as $index => $qa) {
            $qaTargetQuotas[$qa] = $baseQuota + ($index < $remainder ? 1 : 0);
            $qaBuckets[$qa] = [];
            $qaAgentCounts[$qa] = [];
            $qaChannelCounts[$qa] = [];
        }

        $usedAssessmentIds = [];
        $usedTicketIds = [];

        // ---------------------------------------------------------------------
        // Phase 1: Mandatory Sampling (2 tickets per CSO, strict <= 2 per QA)
        // ---------------------------------------------------------------------
        $shuffledAgents = $activeAgents->shuffle();
        $agentPicks = [];
        $eliminationLookup = self::getEliminationLookup();

        foreach ($shuffledAgents as $agent) {
            $agentAsms = $assessmentsByAgent->get($agent->id, collect());
            $availableAsms = $agentAsms->whereNotIn('id', array_keys($usedAssessmentIds))
                ->reject(fn($a) => self::isEliminatedTicket($a, $eliminationLookup));
            if ($availableAsms->isEmpty()) continue;

            $gAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'GANGGUAN')->shuffle();
            $kAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'KELUHAN')->shuffle();
            $iAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'INFORMASI')->shuffle();
            $pAsms = $availableAsms->filter(fn($a) => self::resolveCategoryName($a) === 'PERMOHONAN')->shuffle();

            $picks = collect();
            if ($pAsms->isNotEmpty()) {
                $picks->push($pAsms->first());
            } elseif ($kAsms->isNotEmpty()) {
                $picks->push($kAsms->first());
            } elseif ($gAsms->isNotEmpty()) {
                $picks->push($gAsms->first());
            } elseif ($iAsms->isNotEmpty()) {
                $picks->push($iAsms->first());
            }

            $rem = $availableAsms->whereNotIn('id', $picks->pluck('id')->toArray());
            if ($rem->isNotEmpty()) {
                $p1Cat = self::resolveCategoryName($picks->first());
                $diffCat = $rem->filter(fn($a) => self::resolveCategoryName($a) !== $p1Cat)->shuffle();
                if ($diffCat->isNotEmpty()) {
                    $picks->push($diffCat->first());
                } else {
                    $picks->push($rem->first());
                }
            }

            foreach ($picks as $asm) {
                if (!$asm) continue;
                $ticketId = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
                if (isset($usedTicketIds[$ticketId])) continue;

                $usedAssessmentIds[$asm->id] = true;
                $usedTicketIds[$ticketId] = true;

                $agentPicks[] = [
                    'assessment_id'   => $asm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $agent->id,
                    'channel'         => $asm->validated_channel ?: self::resolveChannel($asm->source_layanan ?: $asm->source_ca),
                    'category_name'   => self::resolveCategoryName($asm),
                    'service_id'      => $asm->validated_service_id ?: $asm->service_id,
                    'assignment_type' => 'MANDATORY',
                    'assigned_at'     => $now,
                ];
            }
        }

        // Equitable distribution of mandatory picks across QAs with channel balancing
        $shuffledPicks = collect($agentPicks)->shuffle();
        foreach ($shuffledPicks as $item) {
            $agId = $item['agent_id'];
            $itemChan = $item['channel'];

            $availQas = collect($qaNames)->filter(function($q) use ($qaBuckets, $qaTargetQuotas, $qaAgentCounts, $agId) {
                $quotaOk = count($qaBuckets[$q]) < $qaTargetQuotas[$q];
                $agentOk = ($qaAgentCounts[$q][$agId] ?? 0) < self::MAX_PER_AGENT_PER_QA_MONTHLY;
                return $quotaOk && $agentOk;
            });

            if ($availQas->isEmpty()) {
                $availQas = collect($qaNames)->filter(function($q) use ($qaAgentCounts, $agId) {
                    return ($qaAgentCounts[$q][$agId] ?? 0) < self::MAX_PER_AGENT_PER_QA_MONTHLY;
                });
            }

            if ($availQas->isNotEmpty()) {
                // Pick QA that has lowest channel count for this item, then lowest total bucket
                $sortedAvail = $availQas->sortBy(function($q) use ($qaBuckets, $qaChannelCounts, $itemChan) {
                    $chanCnt = $qaChannelCounts[$q][$itemChan] ?? 0;
                    $totCnt = count($qaBuckets[$q]);
                    return ($chanCnt * 1000) + $totCnt;
                });

                $targetQa = $sortedAvail->first();
                $qaBuckets[$targetQa][] = $item;
                $qaAgentCounts[$targetQa][$agId] = ($qaAgentCounts[$targetQa][$agId] ?? 0) + 1;
                $qaChannelCounts[$targetQa][$itemChan] = ($qaChannelCounts[$targetQa][$itemChan] ?? 0) + 1;
            }
        }

        // ---------------------------------------------------------------------
        // Phase 2: Additional Sampling to fill remaining quota up to 370 with Channel Balancing
        // ---------------------------------------------------------------------
        $remainingPool = $allAssessments->whereNotIn('id', array_keys($usedAssessmentIds))->shuffle()->values();
        $remIdx = 0;

        foreach ($qaNames as $qa) {
            $quota = $qaTargetQuotas[$qa];
            while (count($qaBuckets[$qa]) < $quota && $remIdx < $remainingPool->count()) {
                // Find candidate from remaining pool that balances channel for this QA
                $bestCandIdx = null;
                $lowestChanScore = 999999;

                for ($scan = $remIdx; $scan < min($remainingPool->count(), $remIdx + 100); $scan++) {
                    $cand = $remainingPool[$scan];
                    if (!$cand) continue;
                    $tid = trim((string)$cand->ticket_id) ?: (trim((string)$cand->idca) ?: "TCK-{$cand->id}");
                    if (isset($usedTicketIds[$tid]) || isset($usedAssessmentIds[$cand->id])) continue;

                    $candAgId = $cand->agent_id ?: ($activeAgents->first()->id ?? 1);
                    if (($qaAgentCounts[$qa][$candAgId] ?? 0) >= self::MAX_PER_AGENT_PER_QA_MONTHLY) continue;

                    $candChan = self::resolveChannel($cand->source_layanan ?: $cand->source_ca);
                    $chanCnt = $qaChannelCounts[$qa][$candChan] ?? 0;

                    if ($chanCnt < $lowestChanScore) {
                        $lowestChanScore = $chanCnt;
                        $bestCandIdx = $scan;
                        if ($chanCnt === 0) break; // optimal found
                    }
                }

                if ($bestCandIdx === null) {
                    $bestCandIdx = $remIdx;
                }

                $candidateAsm = $remainingPool[$bestCandIdx];
                if ($bestCandIdx === $remIdx) {
                    $remIdx++;
                }

                if (!$candidateAsm) continue;
                $ticketId = trim((string)$candidateAsm->ticket_id) ?: (trim((string)$candidateAsm->idca) ?: "TCK-{$candidateAsm->id}");
                if (isset($usedTicketIds[$ticketId]) || isset($usedAssessmentIds[$candidateAsm->id])) continue;

                $agId = $candidateAsm->agent_id ?: ($activeAgents->first()->id ?? 1);
                if (($qaAgentCounts[$qa][$agId] ?? 0) >= self::MAX_PER_AGENT_PER_QA_MONTHLY) {
                    continue;
                }

                $usedAssessmentIds[$candidateAsm->id] = true;
                $usedTicketIds[$ticketId] = true;
                $qaAgentCounts[$qa][$agId] = ($qaAgentCounts[$qa][$agId] ?? 0) + 1;

                $catName = self::resolveCategoryName($candidateAsm);
                $channel = self::resolveChannel($candidateAsm->source_layanan ?: $candidateAsm->source_ca);
                $qaChannelCounts[$qa][$channel] = ($qaChannelCounts[$qa][$channel] ?? 0) + 1;

                $qaBuckets[$qa][] = [
                    'assessment_id'   => $candidateAsm->id,
                    'ticket_id'       => $ticketId,
                    'agent_id'        => $agId,
                    'channel'         => $candidateAsm->validated_channel ?: $channel,
                    'category_name'   => $catName,
                    'service_id'      => $candidateAsm->validated_service_id ?: $candidateAsm->service_id,
                    'assignment_type' => 'ADDITIONAL',
                    'assigned_at'     => $now,
                ];
            }
        }

        $records = [];
        $totalAssigned = 0;

        foreach ($qaNames as $qa) {
            $queue = collect($qaBuckets[$qa])->shuffle();
            foreach ($queue as $item) {
                $records[] = [
                    'sampling_period_id' => $period->id,
                    'ticket_id'          => $item['ticket_id'],
                    'agent_id'           => $item['agent_id'],
                    'evaluator_name'     => $qa,
                    'service_id'         => $item['service_id'],
                    'site_id'            => $smgSiteId,
                    'channel'            => $item['channel'],
                    'category_name'      => $item['category_name'],
                    'cso_classification' => 'VERIFIED_NAKER',
                    'is_naker_verified'  => true,
                    'assignment_type'    => $item['assignment_type'],
                    'is_extra_quota'     => false,
                    'valid_until'        => $now->copy()->addDays(7)->endOfDay(),
                    'status'             => 'ASSIGNED',
                    'assessment_id'      => $item['assessment_id'],
                    'score_ca'           => null,
                    'fcr'                => null,
                    'notes'              => null,
                    'assigned_at'        => $now,
                    'started_at'         => null,
                    'completed_at'       => null,
                    'hold_at'            => null,
                    'abandoned_at'       => null,
                    'quota_request_id'   => null,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ];
                $totalAssigned++;
            }
        }

        DB::beginTransaction();
        try {
            SamplingAssignment::where('sampling_period_id', $period->id)->delete();

            $uniqueRecords = [];
            foreach ($records as $rec) {
                $uniqueKey = $rec['sampling_period_id'] . '_' . $rec['ticket_id'];
                if (!isset($uniqueRecords[$uniqueKey])) {
                    $uniqueRecords[$uniqueKey] = $rec;
                }
            }
            $records = array_values($uniqueRecords);

            foreach (array_chunk($records, 500) as $chunk) {
                SamplingAssignment::insertOrIgnore($chunk);
            }

            SamplingTargetEngineService::syncActuals($periodCode);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return [
            'period'                 => $periodCode,
            'source'                 => 'REAL_IMPORTED_DATA',
            'distribution_mode'      => 'FAIR_RANDOMIZED_EVEN_WITH_MANDATORY_2_LIMIT',
            'total_assigned_tickets' => $totalAssigned,
            'total_completed_tickets' => 0,
        ];
    }

    /**
     * Automatically mark tickets older than 7 days (1 week) that are still uncompleted as ABANDONED.
     * Enforces SLA lifecycle:
     * - Day 1 to Day 7: Valid & can be reopened / worked on.
     * - After Day 7 (> 7 days): Automatically becomes ABANDONED, logged to QA history, and counted towards supervisor audit/penalties.
     */
    public static function autoExpireStaleAssignments(?int $periodId = null): int
    {
        $cutoff = now()->subDays(7);

        $query = SamplingAssignment::whereNotIn('status', ['COMPLETED', 'CANCELLED', 'ABANDONED', 'SKIPPED'])
            ->where(function ($q) use ($cutoff) {
                $q->where(function ($sub) {
                    $sub->whereNotNull('valid_until')
                        ->where('valid_until', '<', now());
                })->orWhere(function ($sub) use ($cutoff) {
                    $sub->whereNull('valid_until')
                        ->whereNotNull('assigned_at')
                        ->where('assigned_at', '<', $cutoff);
                });
            });

        if ($periodId) {
            $query->where('sampling_period_id', $periodId);
        }

        $staleAssignments = $query->get();
        $expiredCount = 0;

        foreach ($staleAssignments as $asm) {
            $asm->update([
                'status'       => 'ABANDONED',
                'abandoned_at' => now(),
                'skip_reason'  => 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari (1 minggu)',
                'notes'        => $asm->notes ? ($asm->notes . ' | Otomatis Abandoned: Melewati batas waktu 7 hari') : 'Otomatis Abandoned: Melewati batas waktu pengerjaan 7 hari (1 minggu)',
            ]);
            $expiredCount++;
        }

        return $expiredCount;
    }

    /**
     * Get lookup maps of tickets to eliminate (Real Monitoring & Bad Rating)
     */
    public static function getEliminationLookup(): array
    {
        $realMonitKeys = [];
        $badRatingKeys = [];

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('real_monitorings')) {
                $rmRecords = \App\Models\RealMonitoring::select('no_icrm', 'no_transaksi', 'no_omni', 'no_ichat')->get();
                foreach ($rmRecords as $r) {
                    if ($r->no_transaksi) {
                        $tx = strtoupper(trim($r->no_transaksi));
                        $realMonitKeys[$tx] = true;
                        $clean = preg_replace('/[^A-Z0-9]/', '', $tx);
                        if ($clean) $realMonitKeys[$clean] = true;
                    }
                    if ($r->no_icrm) {
                        $icrm = strtoupper(trim($r->no_icrm));
                        $realMonitKeys[$icrm] = true;
                        $clean = preg_replace('/[^A-Z0-9]/', '', $icrm);
                        if ($clean) $realMonitKeys[$clean] = true;
                    }
                    if ($r->no_omni) {
                        $omni = strtoupper(trim($r->no_omni));
                        if ($omni && $omni !== '-' && strlen($omni) >= 3) {
                            $realMonitKeys[$omni] = true;
                            $clean = preg_replace('/[^A-Z0-9]/', '', $omni);
                            if ($clean && strlen($clean) >= 3) $realMonitKeys[$clean] = true;
                        }
                    }
                    if ($r->no_ichat) {
                        $ichat = strtoupper(trim($r->no_ichat));
                        if ($ichat && $ichat !== '-' && strlen($ichat) >= 3) {
                            $realMonitKeys[$ichat] = true;
                            $clean = preg_replace('/[^A-Z0-9]/', '', $ichat);
                            if ($clean && strlen($clean) >= 3) $realMonitKeys[$clean] = true;
                        }
                    }
                }
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('bad_rating_tickets')) {
                $brRecords = \App\Models\BadRatingTicket::select('ticket_id', 'no_transaksi')->get();
                foreach ($brRecords as $b) {
                    if ($b->ticket_id) {
                        $tid = strtoupper(trim($b->ticket_id));
                        if ($tid && $tid !== '-' && strlen($tid) >= 3) {
                            $badRatingKeys[$tid] = true;
                            $clean = preg_replace('/[^A-Z0-9]/', '', $tid);
                            if ($clean && strlen($clean) >= 3) $badRatingKeys[$clean] = true;
                        }
                    }
                    if ($b->no_transaksi) {
                        $tx = strtoupper(trim($b->no_transaksi));
                        if ($tx && $tx !== '-' && strlen($tx) >= 3) {
                            $badRatingKeys[$tx] = true;
                            $clean = preg_replace('/[^A-Z0-9]/', '', $tx);
                            if ($clean && strlen($clean) >= 3) $badRatingKeys[$clean] = true;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Elimination lookup build warning: ' . $e->getMessage());
        }

        return [
            'real_monitoring' => $realMonitKeys,
            'bad_rating' => $badRatingKeys,
        ];
    }

    /**
     * Cek apakah tiket merupakan tiket iCRM alarm / non-CSO (awalan A1480306, A14..., atau alarm perangkat/NOC/NGAOSS).
     * Rule: Tiket berawalan "A1480306" atau "A14" (contoh: A1466627, A1480306) adalah alarm perangkat
     * atau tiket otomatis (PROAKTIF/NGAOSS/NOC) yang tidak di-handle oleh CSO sehingga wajib dieliminasi dari sampling.
     */
    public static function isNonCsoAlarmTicket(?string $tid, ?string $sourceCa = '', $asm = null): bool
    {
        $checkList = array_filter([(string)$tid, (string)$sourceCa]);
        foreach ($checkList as $raw) {
            $u = strtoupper(trim((string)$raw));
            $clean = preg_replace('/[^A-Z0-9]/', '', $u);
            if (!$clean) continue;

            // Eliminasi utama: Awalan A1480306 atau awalan A14 (seperti A1480306, A1466627, dll)
            if (str_starts_with($clean, 'A1480306') || str_starts_with($clean, 'A14')) {
                return true;
            }
        }

        // Jika objek assessment disertakan, lakukan audit tambahan dari agent/penerima/sumber
        if ($asm) {
            $agentName = strtoupper((string)($asm->agent_name ?? ($asm->agent?->name ?? '')));
            $sourceFile = strtoupper((string)($asm->source_file ?? ''));
            $sourceLay = strtoupper((string)($asm->source_layanan ?? ($asm->source_ca ?? '')));

            // Indikasi sistem NOC / NGAOSS non-CSO
            if (str_contains($agentName, 'NOC') || str_contains($agentName, 'NGAOSS') || str_contains($agentName, 'RSBS-INT')) {
                return true;
            }

            // Jika dari tarikan CRM/Retail (bukan Digilive chat) dan nomor tiket berawalan A diikuti digit (contoh format A\d{6,8})
            $isNotDigilive = !str_contains($sourceLay, 'DIGILIVE') && !str_contains($sourceFile, 'CONVERSATION');
            if ($isNotDigilive) {
                foreach ($checkList as $raw) {
                    $clean = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim((string)$raw)));
                    if (preg_match('/^A\d{6,8}$/', $clean)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Check if a candidate assessment is eliminated due to Real Monitoring, Bad Rating, or Non-CSO iCRM Alarm Tickets
     */
    public static function isEliminatedTicket($asm, array $lookup): bool
    {
        if (!empty($asm->is_bad_rating)) {
            return true;
        }

        $tid = strtoupper(trim((string)($asm->ticket_id ?: $asm->idca ?: '')));
        $cleanTid = preg_replace('/[^A-Z0-9]/', '', $tid);
        $sourceCa = strtoupper(trim((string)($asm->source_ca ?: '')));
        $cleanSourceCa = preg_replace('/[^A-Z0-9]/', '', $sourceCa);

        // Rule Eliminasi: Tiket iCRM Non-CSO / Alarm (Awalan A1480306 / A14... atau sistem NOC/NGAOSS)
        if (self::isNonCsoAlarmTicket($tid, $sourceCa, $asm)) {
            return true;
        }

        // Check Bad Rating
        if ($tid && (isset($lookup['bad_rating'][$tid]) || ($cleanTid && isset($lookup['bad_rating'][$cleanTid])))) {
            return true;
        }
        if ($sourceCa && (isset($lookup['bad_rating'][$sourceCa]) || ($cleanSourceCa && isset($lookup['bad_rating'][$cleanSourceCa])))) {
            return true;
        }

        // Check Real Monitoring
        if ($tid && (isset($lookup['real_monitoring'][$tid]) || ($cleanTid && isset($lookup['real_monitoring'][$cleanTid])))) {
            return true;
        }
        if ($sourceCa && (isset($lookup['real_monitoring'][$sourceCa]) || ($cleanSourceCa && isset($lookup['real_monitoring'][$cleanSourceCa])))) {
            return true;
        }

        // Check tokens inside hashtag (e.g. #ICRM:XYZ #ICHAT:123 #OMNI:ABC)
        if (!empty($asm->hashtag)) {
            preg_match_all('/#([A-Z]+):([A-Z0-9_\-]+)/i', $asm->hashtag, $matches);
            if (!empty($matches[2])) {
                foreach ($matches[2] as $token) {
                    $uToken = strtoupper(trim($token));
                    $cleanToken = preg_replace('/[^A-Z0-9]/', '', $uToken);
                    if ($uToken && (isset($lookup['real_monitoring'][$uToken]) || ($cleanToken && isset($lookup['real_monitoring'][$cleanToken])))) {
                        return true;
                    }
                    if ($uToken && (isset($lookup['bad_rating'][$uToken]) || ($cleanToken && isset($lookup['bad_rating'][$cleanToken])))) {
                        return true;
                    }
                    if (self::isNonCsoAlarmTicket($uToken)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}

