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
     * Daily Category Allocation Target per QA Evaluator (Default 13 Tiket / QA / Hari)
     */
    public const DAILY_CATEGORY_TARGETS_BAKU = [
        'INFORMASI'  => 4,
        'GANGGUAN'   => 3,
        'KELUHAN'    => 5,
        'PERMOHONAN' => 1,
    ];

    /**
     * Daily Service (Layanan) Allocation Target per QA Evaluator (Default 7 Layanan = 13 Tiket / QA / Hari)
     * 1. INBOUND : 2
     * 2. EMAIL : 1
     * 3. DIGI DM : 2
     * 4. SOSMED : 2
     * 5. MYICON : 2
     * 6. OUTBOND : 2
     * 7. BACK OFFICE : 2
     * Total = 13 Tiket
     */
    public const DAILY_SERVICE_TARGETS = [
        'INBOUND'     => 2,
        'EMAIL'       => 1,
        'DIGI DM'     => 2,
        'SOSMED'      => 2,
        'MYICON'      => 2,
        'OUTBOND'     => 2,
        'BACK OFFICE' => 2,
    ];

    public const DAILY_TOTAL_PER_QA = 13;
    public const DAILY_CATEGORY_TARGETS = self::DAILY_CATEGORY_TARGETS_BAKU;
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
     * Helper to classify Digilive sub-sources (ICHAT vs OMNI)
     */
    public static function classifyDigiliveSubSource($asm): string
    {
        $baku = self::resolveBakuTicketInfo($asm);
        if ($baku['baku_type'] === 'OMNI') {
            return 'OMNI';
        }
        return 'ICHAT';
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
     * Helper to resolve standardized Layanan from raw assessment (7 Layanan Baku)
     * 1. INBOUND : Inbound Call / Voice / Phone
     * 2. EMAIL : Email (Inbound Email)
     * 3. DIGI DM : Digilive DM (Omni / Live Chat non-iChat)
     * 4. SOSMED : Social Media (Instagram, FB, Twitter, TikTok, Coster, Google Play)
     * 5. MYICON : MyIcon+ (Digilive iChat)
     * 6. OUTBOND : Outbound Call / Email Outbound
     * 7. BACK OFFICE : Back Office / Eskalasi BO
     */
    public static function resolveLayanan($asm, ?array $nakerCaches = null): string
    {
        if (!empty($asm->validated_layanan)) {
            return $asm->validated_layanan;
        }

        $valChan = $asm->validated_channel ?? null;
        if ($valChan === 'Email Outbound' || $valChan === 'Outbound Call') {
            return 'OUTBOND';
        }
        if ($valChan === 'Email') {
            return 'EMAIL';
        }
        if ($valChan === 'Inbound') {
            return 'INBOUND';
        }
        if ($valChan === 'Socmed') {
            return 'SOSMED';
        }
        if ($valChan === 'Back Office') {
            return 'BACK OFFICE';
        }

        $rawChannel = self::resolveChannel($asm->validated_channel ?? ($asm->source_layanan ?? ($asm->channel ?? '')));
        $u = strtoupper(trim((string)(($asm->source_layanan ?? '') . ' ' . ($asm->source_ca ?? '') . ' ' . ($asm->source_file ?? '') . ' ' . ($asm->hashtag ?? ''))));

        // 1. Back Office (Eskalasi BO / Kategori Internal iCRM / Penugasan Master NAKER)
        $catName = strtoupper(trim((string)($asm->category?->name ?? ($asm->category_name ?? ''))));
        if ($rawChannel === 'Back Office' 
            || str_contains($catName, 'INTERNAL')
            || str_contains($u, 'BACK OFFICE') 
            || str_contains($u, 'BACKOFFICE') 
            || str_contains($u, 'ESKALASI') 
            || str_contains($u, 'KETEPATAN ESKALASI BO')
            || str_contains($u, 'INTERNAL')) {
            return 'BACK OFFICE';
        }

        if ($nakerCaches) {
            $rawName = (string)($asm->agent_name ?? ($asm->agent?->name ?? ''));
            $nik = (string)($asm->employee_id ?? ($asm->agent?->nik ?? ''));
            $cso = NakerVerificationService::classifyCso($rawName, $nik, $nakerCaches);
            if (!empty($cso['employee'])) {
                $asn = $nakerCaches['assignments']->get($cso['employee']->id) ?? null;
                if ($asn && ($asn->service_id == 7 
                    || str_contains(strtoupper($asn->service?->code ?? ''), 'BACK_OFFICE') 
                    || str_contains(strtoupper($asn->service?->name ?? ''), 'BACK OFFICE') 
                    || str_contains(strtoupper($asn->sub_service ?? ''), 'BACK OFFICE'))) {
                    return 'BACK OFFICE';
                }
            }
        }

        // 2. Outbound eksplisit pada tiket (Call or Email Outbound)
        if ($rawChannel === 'Outbound Call' || $rawChannel === 'Email Outbound' || str_contains($u, 'OUTBOUND CALL') || str_contains($u, 'OUTBOND CALL') || str_contains($u, 'EMAIL OUTBOUND') || str_contains($u, 'EMAIL OUTBOND') || str_contains($u, 'OBC')) {
            return 'OUTBOND';
        }

        // 3. Email incoming (Presisi Validasi Master NAKER: Email Outbound vs Email Inbound)
        if ($rawChannel === 'Email' || str_contains($u, 'EMAIL') || str_contains($u, 'MAIL')) {
            if ($nakerCaches) {
                $rawName = (string)($asm->agent_name ?? ($asm->agent?->name ?? ''));
                $nik = (string)($asm->employee_id ?? ($asm->agent?->nik ?? ''));
                $cso = NakerVerificationService::classifyCso($rawName, $nik, $nakerCaches);
                if (!empty($cso['employee'])) {
                    $asn = $nakerCaches['assignments']->get($cso['employee']->id) ?? null;
                    if ($asn && ($asn->service_id == 5 || str_contains(strtoupper($asn->service?->code ?? ''), 'OUTBOUND') || str_contains(strtoupper($asn->service?->name ?? ''), 'OUTBOUND'))) {
                        return 'OUTBOND';
                    }
                }
            }
            return 'EMAIL';
        }

        // 4. Inbound / Phone incoming (Presisi Validasi Master NAKER: Outbound Call vs Inbound Call)
        if ($rawChannel === 'Inbound' || str_contains($u, 'INBOUND') || str_contains($u, 'INBOND') || str_contains($u, 'VOICE') || str_contains($u, 'PHONE') || str_contains($u, 'CALL')) {
            if ($nakerCaches) {
                $rawName = (string)($asm->agent_name ?? ($asm->agent?->name ?? ''));
                $nik = (string)($asm->employee_id ?? ($asm->agent?->nik ?? ''));
                $cso = NakerVerificationService::classifyCso($rawName, $nik, $nakerCaches);
                if (!empty($cso['employee'])) {
                    $asn = $nakerCaches['assignments']->get($cso['employee']->id) ?? null;
                    if ($asn && ($asn->service_id == 6 || str_contains(strtoupper($asn->service?->code ?? ''), 'OUTBOUND') || str_contains(strtoupper($asn->service?->name ?? ''), 'OUTBOUND') || str_contains(strtoupper($asn->sub_service ?? ''), 'OUTBOUND'))) {
                        return 'OUTBOND';
                    }
                }
            }
            return 'INBOUND';
        }

        // 5. Socmed (Social Media Comments & DM)
        if ($rawChannel === 'Socmed' || str_contains($u, 'SOCMED') || str_contains($u, 'SOSMED') || str_contains($u, 'SOCIAL') || str_contains($u, 'INSTAGRAM')) {
            return 'SOSMED';
        }

        // 6. Digilive: MyIcon vs Digi DM (Omni)
        if ($rawChannel === 'Digilive' || str_contains($u, 'DIGILIVE') || str_contains($u, 'MYICON') || str_contains($u, 'ICHAT') || str_contains($u, 'OMNI')) {
            $baku = self::resolveBakuTicketInfo($asm);
            if ($baku['baku_type'] === 'ICHAT' || str_contains($u, 'MYICON') || str_contains($u, 'ICHAT')) {
                return 'MYICON';
            }
            return 'DIGI DM';
        }

        return 'INBOUND';
    }

    /**
     * Validasi kesesuaian data tiket terhadap Data Master NAKER (datamasternaker)
     * Aturan:
     * 1. Agen pada tiket harus terverifikasi sebagai Human CSO di Data Master NAKER.
     * 2. Agen bukan merupakan peran non-operasional (TL, Trainer, QA, Supervisor, Pendukung Operasional, dsb).
     * 3. Layanan tiket (source_layanan / source_ca) HARUS SESUAI dan SELARAS dengan Layanan Penugasan
     *    agen di Master NAKER secara presisi:
     *    - Email Inbound vs Email Outbound: Di iCRM incoming berlabel 'Email'. Jika agen di Master NAKER
     *      bertugas di EMAIL_OUTBOUND -> diakui sebagai Email Outbound (OUTBOND). Jika EMAIL_INBOUND/Email -> Email Inbound (EMAIL).
     *    - Inbound Call vs Outbound Call: Di iCRM incoming berlabel 'Phone'/'Inbound'. Jika agen di Master NAKER
     *      bertugas di OUTBOUND_CALL -> diakui sebagai Outbound Call (OUTBOND). Jika INBOUND -> Inbound Call (INBOUND).
     * 
     * @return array [bool $isValid, int|null $serviceId, string|null $channelName, int|null $employeeId, string $reason, string|null $validatedLayanan]
     */
    public static function validateCandidateAgainstMasterNaker($cand, ?array $nakerCaches = null): array
    {
        $caches = $nakerCaches ?? NakerVerificationService::loadNakerCaches();

        $rawName = (string)($cand->agent_name ?? ($cand->agent?->name ?? ''));
        $nik = (string)($cand->employee_id ?? ($cand->agent?->nik ?? ''));
        $rawUpper = strtoupper(trim((string)$rawName));

        // 1. Eliminasi Mutlak Agen Jakarta / Non-Semarang (CSO.01, OB.01, BO.01, .01, JKT, dsb.)
        // DigiQA adalah sistem kendali mutu khusus Site Semarang (CSO.02). Agen Jakarta TIDAK BOLEH disampling.
        $isExplicitJakarta = preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b|\bJKT\b|JAKARTA)/i', $rawUpper);
        if ($isExplicitJakarta) {
            return [false, null, null, null, "Agen '{$rawName}' terdeteksi berkode Jakarta (CSO.01 / .01). DigiQA khusus untuk agen Semarang (CSO.02).", null];
        }

        if ((int)($cand->site_id ?? 0) === 2) {
            return [false, null, null, null, "Tiket tercatat berasal dari Site Jakarta & Banten (site_id: 2). DigiQA khusus Site Semarang (CSO.02).", null];
        }

        $cso = NakerVerificationService::classifyCso($rawName, $nik, $caches);
        if ($cso['classification'] !== NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER || !$cso['is_naker_verified']) {
            return [false, null, null, null, "Agen '{$rawName}' tidak terverifikasi di Master NAKER (Non-Human CSO / Bot)", null];
        }

        $emp = $cso['employee'] ?? null;
        if (!$emp) {
            return [false, null, null, null, "Data employee '{$rawName}' tidak ditemukan di Master NAKER", null];
        }

        $asn = $caches['assignments']->get($emp->id) ?? null;
        if (!$asn || !$asn->service_id) {
            return [false, null, null, null, "Employee '{$emp->name}' belum memiliki penugasan layanan aktif di Master NAKER", null];
        }

        // VALIDASI SITE SEMARANG (CSO.02 / Site 1) UNTUK SEMUA LAYANAN:
        // Agen wajib berasal dari Site Semarang (site_id: 1, kode CSO.02 / OB.02 / BO.02 / SMG).
        $siteInfo = NakerVerificationService::detectSite($rawUpper, $emp, $caches);
        $empSiteId = (int)($asn->site_id ?? 0);
        if (!$siteInfo['is_semarang'] || $empSiteId === 2 || ($empSiteId !== 0 && $empSiteId !== 1)) {
            return [
                false,
                null,
                null,
                null,
                "Agen '{$emp->name}' bukan agen SMG Semarang (Terdeteksi Site: " . ($siteInfo['site_name'] ?? 'Non-SMG') . " / CSO.01). Wajib CSO.02 Semarang.",
                null
            ];
        }

        // Batasi hanya untuk CSO operasional (service_id 1-7). Role TL, Trainer, QA, SPV, dll. TIDAK boleh disampling.
        if ((int)$asn->service_id > 7) {
            $srvName = $asn->service?->name ?? "ID {$asn->service_id}";
            return [false, null, null, null, "Employee '{$emp->name}' bukan CSO operasional ({$srvName})", null];
        }

        $subServiceUpper = strtoupper(trim((string)$asn->sub_service));
        if (str_contains($subServiceUpper, 'NON CSO') || str_contains($subServiceUpper, 'TRAINER') || str_contains($subServiceUpper, 'LEADER')) {
            return [false, null, null, null, "Employee '{$emp->name}' berstatus non-CSO ({$asn->sub_service})", null];
        }

        // Resolusi kanal resmi Master NAKER
        $agentMasterServiceCode = strtoupper(trim((string)($asn->service?->code ?? '')));
        $agentMasterServiceName = strtoupper(trim((string)($asn->service?->name ?? '')));
        $agentMasterChannel = self::resolveChannel($asn->service?->name ?: $asn->sub_service);
        $agentServiceId = (int)$asn->service_id;

        // Resolusi kanal pada tiket transaksi mentah
        $ticketRaw = (string)($cand->source_layanan ?: ($cand->source_ca ?: ''));
        $ticketUpper = strtoupper(trim($ticketRaw));
        $ticketChannel = self::resolveChannel($ticketRaw);
        $validatedLayanan = null;

        // ---------------------------------------------------------------------
        // 1. ATURAN BAKU EMAIL: Inbound Email vs Email Outbound
        // Di iCRM, seluruh transaksi email masuk melalui satu incoming: 'Email'.
        // Sistem membedakan secara presisi berdasarkan Master Data NAKER:
        // - Jika CSO penugasannya CSO EMAIL (service_id 4 atau 5) -> Layanan: EMAIL.
        // ---------------------------------------------------------------------
        $isEmailTicket = ($ticketChannel === 'Email' || str_contains($ticketUpper, 'EMAIL') || str_contains($ticketUpper, 'MAIL'));
        $isAgentEmail = ($agentServiceId === 4 
            || $agentServiceId === 5 
            || $agentMasterServiceCode === 'EMAIL_INBOUND' 
            || $agentMasterServiceCode === 'EMAIL_OUTBOUND' 
            || $agentMasterServiceCode === 'EMAIL' 
            || str_contains($agentMasterServiceName, 'EMAIL') 
            || str_contains($subServiceUpper, 'EMAIL')
            || str_contains($agentMasterChannel, 'Email'));

        if ($isEmailTicket) {
            if ($isAgentEmail) {
                $ticketChannel = 'Email';
                $agentMasterChannel = 'Email';
                $agentServiceId = 4;
                $validatedLayanan = 'EMAIL';
            } else {
                return [
                    false,
                    null,
                    null,
                    null,
                    "Tiket Email di-handling oleh agen '{$emp->name}' yang di Master NAKER bertugas pada '{$agentMasterChannel}' (Bukan CSO Email)",
                    null
                ];
            }
        }

        // ---------------------------------------------------------------------
        // 2. ATURAN BAKU BACK OFFICE: Kategori Internal iCRM & CSO Back Office
        // Di iCRM, tiket penanganan Back Office masuk dengan kategori tiket 'INTERNAL'
        // atau di-handling oleh agen yang terdaftar sebagai CSO Back Office di Master NAKER.
        // Aturan Khusus: Wajib agen SMG Semarang (BO 02). Selain BO 02 / SMG Semarang TIDAK BOLEH.
        // ---------------------------------------------------------------------
        $ticketCategory = strtoupper(trim((string)($cand->category?->name ?? ($cand->category_name ?? ''))));
        $isAgentBackOffice = ($agentServiceId === 7 
            || $agentMasterServiceCode === 'BACK_OFFICE' 
            || str_contains($agentMasterServiceName, 'BACK OFFICE') 
            || str_contains($agentMasterServiceName, 'BACKOFFICE') 
            || str_contains($subServiceUpper, 'BACK OFFICE') 
            || str_contains($subServiceUpper, 'BACKOFFICE') 
            || ($agentMasterChannel === 'Back Office'));

        $isInternalTicket = ($ticketChannel === 'Back Office' 
            || str_contains($ticketCategory, 'INTERNAL') 
            || str_contains($ticketUpper, 'INTERNAL') 
            || str_contains($ticketUpper, 'BACK OFFICE') 
            || str_contains($ticketUpper, 'BACKOFFICE') 
            || str_contains($ticketUpper, 'ESKALASI') 
            || str_contains($ticketUpper, 'KETEPATAN ESKALASI BO'));

        if ($isAgentBackOffice) {
            // Validasi Ketat BO 02: Wajib Agent SMG Semarang (BO 02). Selain itu TIDAK BOLEH!
            $siteInfo = NakerVerificationService::detectSite($rawName, $emp, $caches);
            $empSiteId = (int)($asn->site_id ?? 0);
            $rawUpper = strtoupper((string)($cand->agent_name ?? $rawName));

            // Jika agent eksplisit berkode Jakarta / BO 01 / .01 atau bertugas di luar Site 1 (SMG)
            $isExplicitNonSmg = preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b|\bJKT\b|JAKARTA)/i', $rawUpper);
            $hasBo02 = preg_match('/(\bBO[\s._\-]*0?2\b|\bSMG\b)/i', $rawUpper) || preg_match('/(\bBO[\s._\-]*0?2\b|\bSMG\b)/i', $emp->name);
            $isSmgSite = ($siteInfo['is_semarang'] && ($empSiteId === 0 || $empSiteId === 1));

            if ($isExplicitNonSmg || !$hasBo02 || !$isSmgSite || $empSiteId === 2) {
                return [
                    false,
                    null,
                    null,
                    null,
                    "Tiket Back Office di-handling oleh agen '{$emp->name}' bukan dari agent SMG Semarang (Wajib BO 02)",
                    null
                ];
            }

            $ticketChannel = 'Back Office';
            $agentMasterChannel = 'Back Office';
            $agentServiceId = 7;
            $validatedLayanan = 'BACK OFFICE';
        } elseif ($isInternalTicket && !$isEmailTicket) {
            return [
                false,
                null,
                null,
                null,
                "Tiket Kategori Internal/Back Office di-handling oleh agen '{$emp->name}' yang di Master NAKER bertugas pada '{$agentMasterChannel}' (Bukan CSO Back Office)",
                null
            ];
        }

        // ---------------------------------------------------------------------
        // 3. ATURAN BAKU PHONE / TELEPON: Inbound Call vs Outbound Call
        // Di iCRM, panggilan suara masuk melalui kategori phone/inbound.
        // Sistem membedakan secara presisi berdasarkan Master Data NAKER:
        // - Jika CSO penugasannya OUTBOUND_CALL -> Tiket diakui sebagai Outbound Call (Layanan: OUTBOND).
        // - Jika CSO penugasannya INBOUND -> Tiket diakui sebagai Inbound Call (Layanan: INBOUND).
        // ---------------------------------------------------------------------
        $isPhoneTicket = ($ticketChannel === 'Inbound' || str_contains($ticketUpper, 'INBOUND') || str_contains($ticketUpper, 'PHONE') || str_contains($ticketUpper, 'VOICE') || str_contains($ticketUpper, 'CALL'));
        $isAgentOutboundCall = ($agentServiceId === 6 
            || $agentMasterServiceCode === 'OUTBOUND_CALL' 
            || str_contains($agentMasterServiceName, 'OUTBOUND CALL') 
            || str_contains($agentMasterServiceName, 'OUTBOND CALL') 
            || str_contains($subServiceUpper, 'OUTBOUND CALL') 
            || str_contains($subServiceUpper, 'OUTBOND CALL') 
            || ($agentMasterChannel === 'Outbound Call'));

        $isAgentInboundCall = ($agentServiceId === 1 
            || $agentMasterServiceCode === 'INBOUND' 
            || (str_contains($agentMasterServiceName, 'INBOUND') && !str_contains($agentMasterServiceName, 'EMAIL')) 
            || ($agentMasterChannel === 'Inbound'));

        if ($isPhoneTicket && !$isEmailTicket && !$isAgentBackOffice) {
            if ($isAgentOutboundCall) {
                $ticketChannel = 'Outbound Call';
                $agentMasterChannel = 'Outbound Call';
                $agentServiceId = 6;
                $validatedLayanan = 'OUTBOND';
            } elseif ($isAgentInboundCall) {
                $ticketChannel = 'Inbound';
                $agentMasterChannel = 'Inbound';
                $agentServiceId = 1;
                $validatedLayanan = 'INBOUND';
            } else {
                return [
                    false,
                    null,
                    null,
                    null,
                    "Tiket Telepon/Inbound di-handling oleh agen '{$emp->name}' yang di Master NAKER bertugas pada '{$agentMasterChannel}' (Bukan CSO Telepon/Voice)",
                    null
                ];
            }
        }

        // ---------------------------------------------------------------------
        // 4. ATURAN DIGILIVE & SOCMED: iChat (MyIcon+) vs Omni (Livechat / DM / Socmed)
        // ---------------------------------------------------------------------
        $isIchat = str_contains(strtolower((string)($cand->source_file ?? '')), 'conversation') 
                || str_contains(strtolower((string)($cand->source_file ?? '')), 'ichat') 
                || str_contains(strtoupper((string)($cand->hashtag ?? '')), '#ICHAT');
        if ($isIchat && !$validatedLayanan) {
            $ticketChannel = 'Digilive';
            $agentMasterChannel = 'Digilive';
            $agentServiceId = 2;
            $validatedLayanan = 'MYICON';
        }

        // Rule Eliminasi: Tiket Omni dengan sub layanan WhatsApp / Whats Up tidak disampling karena diarahkan ke iChat
        if (self::isOmniWhatsAppTicket($cand, $caches)) {
            return [
                false,
                null,
                null,
                null,
                "Tiket Omni sub-layanan WhatsApp/Whats Up dieliminasi (layanan WhatsApp telah dialihkan ke iChat MyIcon+)",
                null
            ];
        }

        $isOmniOrSocmed = str_contains(strtolower((string)($cand->source_file ?? '')), 'summary') 
                       || str_contains(strtolower((string)($cand->source_file ?? '')), 'omni') 
                       || str_contains(strtoupper((string)($cand->hashtag ?? '')), '#OMNI')
                       || $ticketChannel === 'Socmed' || $ticketChannel === 'Digilive';

        if ($isOmniOrSocmed && !$validatedLayanan) {
            if ($agentMasterChannel === 'Digilive') {
                $ticketChannel = 'Digilive';
                $agentServiceId = 2;
                $validatedLayanan = 'DIGI DM';
            } elseif ($agentMasterChannel === 'Socmed' || $agentMasterChannel === 'Sosmed') {
                $ticketChannel = 'Socmed';
                $agentServiceId = 3;
                $validatedLayanan = 'SOSMED';
            }
        }

        // ---------------------------------------------------------------------
        // 5. ATURAN SOCMED & BACK OFFICE
        // ---------------------------------------------------------------------
        if ($ticketChannel === 'Socmed' && ($agentMasterChannel === 'Socmed' || $agentMasterChannel === 'Sosmed')) {
            $validatedLayanan = 'SOSMED';
        }
        if ($ticketChannel === 'Back Office' && $agentMasterChannel === 'Back Office') {
            $validatedLayanan = 'BACK OFFICE';
        }

        // Fallback Layanan resolution if not yet resolved
        if (!$validatedLayanan) {
            if ($ticketChannel === 'Email Outbound' || $ticketChannel === 'Outbound Call') {
                $validatedLayanan = 'OUTBOND';
            } elseif ($ticketChannel === 'Email') {
                $validatedLayanan = 'EMAIL';
            } elseif ($ticketChannel === 'Digilive') {
                $validatedLayanan = $isIchat ? 'MYICON' : 'DIGI DM';
            } elseif ($ticketChannel === 'Socmed') {
                $validatedLayanan = 'SOSMED';
            } elseif ($ticketChannel === 'Back Office') {
                $validatedLayanan = 'BACK OFFICE';
            } else {
                $validatedLayanan = 'INBOUND';
            }
        }

        // Validasi ketat: Layanan Tiket HARUS sama dengan Layanan Master NAKER
        if (strtolower($ticketChannel) !== strtolower($agentMasterChannel)) {
            return [
                false,
                null,
                null,
                null,
                "Layanan tiket ('{$ticketChannel}') tidak sesuai dengan layanan Master NAKER ('{$agentMasterChannel}') untuk agen '{$emp->name}'",
                null
            ];
        }

        return [true, $agentServiceId, $ticketChannel, $emp->id, 'OK', $validatedLayanan];
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
     * Run Daily Auto Distribution (Default 13 Tiket di 7 Layanan berbeda per QA)
     * Enforces:
     * 1. 13 tiket / QA / day di 7 Layanan Baku:
     *    - INBOUND : 2
     *    - EMAIL : 1
     *    - DIGI DM : 2
     *    - SOSMED : 2
     *    - MYICON : 2
     *    - OUTBOND : 2
     *    - BACK OFFICE : 2
     *    Total: 13 Tiket.
     * 2. Komposisi Kategori Berimbang: Informasi = 4, Gangguan = 3, Keluhan = 5, Permohonan = 1 (Total = 13).
     * 3. Mandatory Max 2 tickets per agent per QA in a 30-day period.
     * 4. Cap on CSOs that already completed their monthly sampling target.
     * 5. Anti-duplicate ticket per period.
     */
    public static function runDailyDistribution(
        string $periodCode = '2026-08',
        ?string $dateStr = null,
        array $customQaList = [],
        bool $clearExistingForDay = false,
        array $customCategoryTargets = [],
        array $customServiceTargets = []
    ): array {
        ini_set('memory_limit', '512M');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::generatePeriodTargets($periodCode);

        // 1. Resolve service (layanan) composition targets (priority: passed custom -> saved period -> default 7 Layanan Baku)
        $serviceTargets = self::DAILY_SERVICE_TARGETS;
        if (!empty($customServiceTargets)) {
            $cleanedSvc = [];
            foreach ($customServiceTargets as $k => $v) {
                $cleanedSvc[strtoupper(trim((string)$k))] = max(0, (int)$v);
            }
            $serviceTargets = [
                'INBOUND'     => isset($cleanedSvc['INBOUND']) ? $cleanedSvc['INBOUND'] : 2,
                'EMAIL'       => isset($cleanedSvc['EMAIL']) ? $cleanedSvc['EMAIL'] : 1,
                'DIGI DM'     => isset($cleanedSvc['DIGI DM']) ? $cleanedSvc['DIGI DM'] : (isset($cleanedSvc['DIGI_DM']) ? $cleanedSvc['DIGI_DM'] : 2),
                'SOSMED'      => isset($cleanedSvc['SOSMED']) ? $cleanedSvc['SOSMED'] : (isset($cleanedSvc['SOCMED']) ? $cleanedSvc['SOCMED'] : 2),
                'MYICON'      => isset($cleanedSvc['MYICON']) ? $cleanedSvc['MYICON'] : (isset($cleanedSvc['MY ICON']) ? $cleanedSvc['MY ICON'] : 2),
                'OUTBOND'     => isset($cleanedSvc['OUTBOND']) ? $cleanedSvc['OUTBOND'] : (isset($cleanedSvc['OUTBOUND']) ? $cleanedSvc['OUTBOUND'] : 2),
                'BACK OFFICE' => isset($cleanedSvc['BACK OFFICE']) ? $cleanedSvc['BACK OFFICE'] : (isset($cleanedSvc['BACK_OFFICE']) ? $cleanedSvc['BACK_OFFICE'] : 2),
            ];
            $period->update(['daily_service_composition' => $serviceTargets]);
        } elseif (!empty($period->daily_service_composition) && is_array($period->daily_service_composition)) {
            $serviceTargets = [
                'INBOUND'     => max(0, (int)($period->daily_service_composition['INBOUND'] ?? 2)),
                'EMAIL'       => max(0, (int)($period->daily_service_composition['EMAIL'] ?? 1)),
                'DIGI DM'     => max(0, (int)($period->daily_service_composition['DIGI DM'] ?? ($period->daily_service_composition['DIGI_DM'] ?? 2))),
                'SOSMED'      => max(0, (int)($period->daily_service_composition['SOSMED'] ?? ($period->daily_service_composition['SOCMED'] ?? 2))),
                'MYICON'      => max(0, (int)($period->daily_service_composition['MYICON'] ?? ($period->daily_service_composition['MY ICON'] ?? 2))),
                'OUTBOND'     => max(0, (int)($period->daily_service_composition['OUTBOND'] ?? ($period->daily_service_composition['OUTBOUND'] ?? 2))),
                'BACK OFFICE' => max(0, (int)($period->daily_service_composition['BACK OFFICE'] ?? ($period->daily_service_composition['BACK_OFFICE'] ?? 2))),
            ];
        }

        // 2. Resolve category composition targets (priority: passed custom targets -> saved period composition -> default static)
        $categoryTargets = self::DAILY_CATEGORY_TARGETS;
        if (!empty($customCategoryTargets)) {
            $cleaned = [];
            foreach ($customCategoryTargets as $k => $v) {
                $cleaned[strtoupper(trim((string)$k))] = max(0, (int)$v);
            }
            $categoryTargets = [
                'INFORMASI'  => isset($cleaned['INFORMASI']) ? $cleaned['INFORMASI'] : 4,
                'GANGGUAN'   => isset($cleaned['GANGGUAN']) ? $cleaned['GANGGUAN'] : 3,
                'KELUHAN'    => isset($cleaned['KELUHAN']) ? $cleaned['KELUHAN'] : 5,
                'PERMOHONAN' => isset($cleaned['PERMOHONAN']) ? $cleaned['PERMOHONAN'] : 1,
            ];
            $period->update(['daily_category_composition' => $categoryTargets]);
        } elseif (!empty($period->daily_category_composition) && is_array($period->daily_category_composition)) {
            $categoryTargets = [
                'INFORMASI'  => max(0, (int)($period->daily_category_composition['INFORMASI'] ?? 4)),
                'GANGGUAN'   => max(0, (int)($period->daily_category_composition['GANGGUAN'] ?? 3)),
                'KELUHAN'    => max(0, (int)($period->daily_category_composition['KELUHAN'] ?? 5)),
                'PERMOHONAN' => max(0, (int)($period->daily_category_composition['PERMOHONAN'] ?? 1)),
            ];
        }

        $dailyTotalPerQa = array_sum($serviceTargets);
        if ($dailyTotalPerQa <= 0) {
            $dailyTotalPerQa = array_sum($categoryTargets);
        }
        if ($dailyTotalPerQa <= 0) {
            $dailyTotalPerQa = self::DAILY_TOTAL_PER_QA_BAKU;
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
            if (!$saRow->assessment) {
                $candCheck->source_layanan = $saRow->channel;
                $candCheck->agent_name = $saRow->agent?->name;
                $candCheck->employee_id = $saRow->agent?->nik;
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

        // Auto-verifikasi instan pada assessment CRM_RAW yang belum ter-link ke NAKER
        $unmappedRaw = CaAssessment::where('source', 'CRM_RAW')
            ->where('is_naker_verified', false)
            ->where(function($q) use ($earliestAllowedDate, $latestAllowedDate) {
                $q->whereBetween('transaction_at', [$earliestAllowedDate, $latestAllowedDate])
                  ->orWhere(function($sub) use ($earliestAllowedDate, $latestAllowedDate) {
                      $sub->whereNull('transaction_at')
                          ->whereBetween('measurement_at', [$earliestAllowedDate, $latestAllowedDate]);
                  });
            })
            ->get();

        if ($unmappedRaw->isNotEmpty()) {
            foreach ($unmappedRaw as $uRaw) {
                // Jangan verifikasi tiket dari Site 2 (Jakarta) atau ber-prefix Jakarta .01
                if ((int)$uRaw->site_id === 2 || preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b|\bJKT\b|JAKARTA)/i', (string)$uRaw->agent_name)) {
                    continue;
                }
                $cso = NakerVerificationService::classifyCso($uRaw->agent_name, $uRaw->employee_id, $nakerCaches);
                if ($cso['is_naker_verified'] && $cso['is_semarang'] && (int)($cso['site_id'] ?? 0) !== 2) {
                    $agId = $resolveAgentId($uRaw);
                    $uRaw->update([
                        'cso_classification' => NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER,
                        'is_naker_verified'  => true,
                        'agent_id'           => $agId ?: $uRaw->agent_id,
                        'site_id'            => $smgSiteId ?: 1,
                    ]);
                }
            }
        }

        // 3. Query all eligible raw CRM assessments from DB across verified sites (excluding TIDAK ADA RESPON)
        // Strictly filter candidates within the allowed transaction date window [earliestAllowedDate .. latestAllowedDate]
        // Strictly enforce Site Semarang (site_id: 1, excluding site_id: 2 and Jakarta codes)
        $allAssessments = CaAssessment::where('source', 'CRM_RAW')
            ->with(['category', 'subCategory'])
            ->select(
                'id', 'ticket_id', 'idca', 'agent_id', 'employee_id', 'site_id', 'agent_name',
                'source_layanan', 'source', 'source_ca', 'source_file', 'service_id', 'category_id', 'sub_category_id', 'transaction_at',
                'measurement_at', 'created_at', 'cso_classification', 'is_naker_verified', 'is_bad_rating', 'hashtag'
            )
            ->where('cso_classification', NakerVerificationService::CLASSIFICATION_VERIFIED_NAKER)
            ->where('is_naker_verified', true)
            ->where(function($q) use ($smgSiteId) {
                if ($smgSiteId) {
                    $q->where('site_id', $smgSiteId)
                      ->orWhereNull('site_id');
                } else {
                    $q->where('site_id', 1)
                      ->orWhereNull('site_id');
                }
            })
            ->where('site_id', '!=', 2)
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
                  ->where('agent_name', 'not like', '%CSO 01%')
                  ->where('agent_name', 'not like', '%OB.01%')
                  ->where('agent_name', 'not like', '%OB 01%')
                  ->where('agent_name', 'not like', '%BO.01%')
                  ->where('agent_name', 'not like', '%BO 01%')
                  ->where('agent_name', 'not like', '%AS.01%')
                  ->where('agent_name', 'not like', '%JKT%')
                  ->where('agent_name', 'not like', '%JAKARTA%')
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

        // Categorize available pools by 7 Layanan and 4 Categories
        $servicePools = [
            'INBOUND'     => collect(),
            'EMAIL'       => collect(),
            'DIGI DM'     => collect(),
            'SOSMED'      => collect(),
            'MYICON'      => collect(),
            'OUTBOND'     => collect(),
            'BACK OFFICE' => collect(),
        ];
        $categorizedPool = [
            'INFORMASI'  => collect(),
            'GANGGUAN'   => collect(),
            'KELUHAN'    => collect(),
            'PERMOHONAN' => collect(),
        ];
        // Fine-grained pools: [Category][Layanan] = collect()
        $categorizedServicePools = [
            'PERMOHONAN' => ['MYICON' => collect(), 'INBOUND' => collect()],
            'KELUHAN'    => ['BACK OFFICE' => collect(), 'DIGI DM' => collect(), 'EMAIL' => collect(), 'SOSMED' => collect(), 'INBOUND' => collect(), 'MYICON' => collect()],
            'GANGGUAN'   => ['BACK OFFICE' => collect(), 'DIGI DM' => collect(), 'EMAIL' => collect(), 'OUTBOND' => collect(), 'SOSMED' => collect(), 'INBOUND' => collect(), 'MYICON' => collect()],
            'INFORMASI'  => ['BACK OFFICE' => collect(), 'EMAIL' => collect(), 'DIGI DM' => collect(), 'OUTBOND' => collect(), 'SOSMED' => collect(), 'INBOUND' => collect(), 'MYICON' => collect()],
        ];

        $seenCandidateTicketIds = [];
        $eliminationLookup = self::getEliminationLookup();

        foreach ($allAssessments as $asm) {
            // Validasi interaksi Human Agent vs Bot/NOC/Otomasi & Ambigu (SOP Rule)
            if (!self::isValidHumanAgentTicket($asm)) {
                continue;
            }

            if (self::isEliminatedTicket($asm, $eliminationLookup)) {
                continue; // Skip ticket matching Real Monitoring or Bad Rating
            }

            // Validasi ketat kesesuaian data tiket terhadap data layanan penugasan Master NAKER agen
            [$isValidNaker, $valSvcId, $valChan, $valEmpId, $nakerMsg, $valLayanan] = self::validateCandidateAgainstMasterNaker($asm, $nakerCaches);
            if (!$isValidNaker) {
                continue; // Lewati tiket yang layanannya tidak sesuai data layanan Master NAKER agen
            }
            $asm->validated_service_id = $valSvcId;
            $asm->validated_channel = $valChan;
            $asm->validated_employee_id = $valEmpId;
            $asm->validated_layanan = $valLayanan ?? self::resolveLayanan($asm, $nakerCaches);

            // Resolusi Identitas Tiket Baku (iChat / Omni untuk Digilive, iCRM untuk lainnya)
            $bakuInfo = self::resolveBakuTicketInfo($asm);
            $bakuTid = $bakuInfo['canonical_id'];
            $asm->baku_ticket_info = $bakuInfo;

            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            if (isset($assignedTicketIds[$bakuTid]) || isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$asm->id]) || isset($seenCandidateTicketIds[$bakuTid]) || isset($seenCandidateTicketIds[$tid])) {
                continue; // Skip already assigned in this period or duplicate in raw pool
            }

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

            $seenCandidateTicketIds[$bakuTid] = true;
            $seenCandidateTicketIds[$tid] = true;
            if (!empty($bakuInfo['icrm_id'])) {
                $seenCandidateTicketIds[$bakuInfo['icrm_id']] = true;
            }

            $cat = self::resolveCategoryName($asm);
            $layanan = $asm->validated_layanan ?: self::resolveLayanan($asm, $nakerCaches);
            $asm->resolved_category = $cat;
            $asm->resolved_layanan = $layanan;

            $categorizedPool[$cat]->push($asm);
            if (isset($servicePools[$layanan])) {
                $servicePools[$layanan]->push($asm);
            } else {
                $servicePools['INBOUND']->push($asm);
            }

            if (!isset($categorizedServicePools[$cat])) {
                $categorizedServicePools[$cat] = [];
            }
            if (!isset($categorizedServicePools[$cat][$layanan])) {
                $categorizedServicePools[$cat][$layanan] = collect();
            }
            $categorizedServicePools[$cat][$layanan]->push($asm);
        }

        $totalValidCandidates = array_sum(array_map(fn($c) => count($c), $categorizedPool));
        if ($totalValidCandidates === 0) {
            throw new \Exception("Tiket transaksi mentah CRM yang memenuhi aturan tanggal harian (transaksi H-1 / maksimal {$allowedMaxPastDays} hari terakhir) belum tersedia di pool cadangan. Pastikan file tarikan CRM harian terbaru telah diunggah di Modul 7.");
        }

        // Shuffle each fine-grained pool for fairness
        foreach ($categorizedServicePools as $cKey => $svcs) {
            foreach ($svcs as $sKey => $col) {
                $categorizedServicePools[$cKey][$sKey] = $col->shuffle();
            }
        }

        $now = now();
        $recordsToInsert = [];
        $allocatedPerQa = [];
        $serviceCountPerQa = [];

        foreach ($qaNames as $qaName) {
            $allocatedPerQa[$qaName] = [
                'TOTAL' => 0,
            ];
            $serviceCountPerQa[$qaName] = [
                'INBOUND'     => 0,
                'EMAIL'       => 0,
                'DIGI DM'     => 0,
                'SOSMED'      => 0,
                'MYICON'      => 0,
                'OUTBOND'     => 0,
                'BACK OFFICE' => 0,
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
                if (!isset($allocatedPerQa[$qaName][$c])) {
                    $allocatedPerQa[$qaName][$c] = 0;
                }
                $allocatedPerQa[$qaName][$c]++;
                $allocatedPerQa[$qaName]['TOTAL']++;

                $lay = self::resolveLayanan($tqa->assessment ?: $tqa);
                if (!isset($serviceCountPerQa[$qaName][$lay])) {
                    $serviceCountPerQa[$qaName][$lay] = 0;
                }
                $serviceCountPerQa[$qaName][$lay]++;
            }
        }

        // Urutan pemenuhan kategori (dari yang paling spesifik & langka ke yang umum):
        // PERMOHONAN -> KELUHAN -> GANGGUAN -> INFORMASI
        $categoryOrder = ['PERMOHONAN', 'KELUHAN', 'GANGGUAN', 'INFORMASI'];
        // Urutan preferensi layanan per kategori agar layanan beragam masuk ke setiap QA
        $serviceDiversityPref = [
            'PERMOHONAN' => ['MYICON', 'INBOUND'],
            'KELUHAN'    => ['BACK OFFICE', 'DIGI DM', 'EMAIL', 'SOSMED', 'INBOUND', 'MYICON'],
            'GANGGUAN'   => ['BACK OFFICE', 'DIGI DM', 'EMAIL', 'OUTBOND', 'SOSMED', 'INBOUND', 'MYICON'],
            'INFORMASI'  => ['BACK OFFICE', 'EMAIL', 'DIGI DM', 'OUTBOND', 'SOSMED', 'INBOUND', 'MYICON'],
        ];

        // Resolusi canonical channel & service_id standar
        $resolveCanonicalChannelInfo = function($layanan, $candidate) {
            switch ($layanan) {
                case 'EMAIL':
                    return ['Email', 4];
                case 'DIGI DM':
                    return ['Digilive', 2];
                case 'SOSMED':
                    return ['Socmed', 3];
                case 'MYICON':
                    return ['Digilive', 2];
                case 'OUTBOND':
                    return ['Outbound Call', 6];
                case 'BACK OFFICE':
                    return ['Back Office', 7];
                case 'INBOUND':
                default:
                    return ['Inbound', 1];
            }
        };

        // FASE 1: Distribusi Berimbang 4 Kategori dengan Keragaman Minimal 7 Layanan per QA
        foreach ($categoryOrder as $cat) {
            $catTarget = $categoryTargets[$cat] ?? 0;
            if ($catTarget <= 0) continue;

            $prefServices = $serviceDiversityPref[$cat] ?? ['INBOUND', 'MYICON', 'SOSMED', 'EMAIL', 'DIGI DM', 'OUTBOND', 'BACK OFFICE'];

            for ($slot = 1; $slot <= $catTarget; $slot++) {
                foreach ($qaNames as $qaName) {
                    if (($allocatedPerQa[$qaName][$cat] ?? 0) >= $catTarget) continue;
                    if ($allocatedPerQa[$qaName]['TOTAL'] >= $dailyTotalPerQa) continue;

                    // Urutkan layanan yang tersedia:
                    // 1. Layanan yang jumlah tiketnya paling sedikit dimiliki QA ini saat ini (agar layanan baru masuk)
                    // 2. Preferensi urutan layanan untuk kategori ini
                    $orderedServices = $prefServices;
                    usort($orderedServices, function($s1, $s2) use ($serviceCountPerQa, $qaName) {
                        $c1 = $serviceCountPerQa[$qaName][$s1] ?? 0;
                        $c2 = $serviceCountPerQa[$qaName][$s2] ?? 0;
                        return $c1 <=> $c2;
                    });

                    $foundCandidate = null;
                    $foundLayanan = null;
                    $foundKey = null;

                    foreach ($orderedServices as $svc) {
                        $col = $categorizedServicePools[$cat][$svc] ?? null;
                        if (!$col || $col->isEmpty()) continue;

                        foreach ($col as $idx => $cand) {
                            $bakuInfo = $cand->baku_ticket_info ?? self::resolveBakuTicketInfo($cand);
                            $tid = $bakuInfo['canonical_id'];
                            if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$cand->id])) {
                                continue;
                            }
                            if (!empty($bakuInfo['icrm_id']) && isset($assignedTicketIds[$bakuInfo['icrm_id']])) {
                                continue;
                            }
                            $agId = $resolveAgentId($cand);
                            $currentQaAgentCount = $agentCountPerQa[$qaName][$agId] ?? 0;
                            if ($currentQaAgentCount >= self::MAX_PER_AGENT_PER_QA_MONTHLY) {
                                continue;
                            }
                            $csoDone = $csoOverallCount[$agId] ?? 0;
                            if ($csoDone >= (count($qaNames) * self::MAX_PER_AGENT_PER_QA_MONTHLY)) {
                                continue;
                            }

                            $foundCandidate = $cand;
                            $foundLayanan = $svc;
                            $foundKey = $idx;
                            break 2;
                        }
                    }

                    if ($foundCandidate !== null && $foundLayanan !== null && $foundKey !== null) {
                        $categorizedServicePools[$cat][$foundLayanan]->forget($foundKey);
                        $bakuInfo = $foundCandidate->baku_ticket_info ?? self::resolveBakuTicketInfo($foundCandidate);
                        $tid = $bakuInfo['canonical_id'];
                        $agId = $resolveAgentId($foundCandidate);

                        $assignedTicketIds[$tid] = true;
                        if (!empty($bakuInfo['icrm_id'])) $assignedTicketIds[$bakuInfo['icrm_id']] = true;
                        if (!empty($bakuInfo['ichat_id'])) $assignedTicketIds[$bakuInfo['ichat_id']] = true;
                        if (!empty($bakuInfo['omni_id'])) $assignedTicketIds[$bakuInfo['omni_id']] = true;
                        $assignedAssessmentIds[$foundCandidate->id] = true;

                        $agentCountPerQa[$qaName][$agId] = ($agentCountPerQa[$qaName][$agId] ?? 0) + 1;
                        $serviceCountPerQa[$qaName][$foundLayanan] = ($serviceCountPerQa[$qaName][$foundLayanan] ?? 0) + 1;
                        $allocatedPerQa[$qaName][$cat] = ($allocatedPerQa[$qaName][$cat] ?? 0) + 1;
                        $allocatedPerQa[$qaName]['TOTAL']++;

                        [$canonicalChannel, $canonicalSvcId] = $resolveCanonicalChannelInfo($foundLayanan, $foundCandidate);

                        $assignedAt = $targetDate->copy()->setTime(now()->hour, now()->minute, now()->second);
                        $validUntil = $assignedAt->copy()->addDays(7)->endOfDay();

                        $refNotes = ["Layanan: {$foundLayanan}"];
                        if (!empty($bakuInfo['icrm_id']) && $bakuInfo['baku_type'] !== 'ICRM') {
                            $refNotes[] = "Ref iCRM: {$bakuInfo['icrm_id']}";
                        }

                        $recordsToInsert[] = [
                            'sampling_period_id' => $period->id,
                            'ticket_id'          => $tid,
                            'agent_id'           => $agId,
                            'evaluator_name'     => $qaName,
                            'service_id'         => $canonicalSvcId,
                            'site_id'            => $smgSiteId ?: 1,
                            'channel'            => $canonicalChannel, // Canonical channel: Email, Inbound, Digilive, Socmed, Outbound Call, Back Office
                            'category_name'      => $cat,
                            'cso_classification' => 'VERIFIED_NAKER',
                            'is_naker_verified'  => true,
                            'assignment_type'    => 'MANDATORY',
                            'is_extra_quota'     => false,
                            'valid_until'        => $validUntil,
                            'status'             => 'ASSIGNED',
                            'assessment_id'      => $foundCandidate->id,
                            'score_ca'           => null,
                            'fcr'                => null,
                            'notes'              => implode(' • ', $refNotes),
                            'assigned_at'        => $assignedAt,
                            'started_at'         => null,
                            'completed_at'       => null,
                            'hold_at'            => null,
                            'abandoned_at'       => null,
                            'quota_request_id'   => null,
                            'created_at'         => $now,
                            'updated_at'         => $now,
                        ];
                    }
                }
            }
        }

        // FASE 2: Safety Backfill (Jika ada QA yang belum mencapai 13 tiket karena keterbatasan kandidat di kategori tertentu)
        $maxAgentAllowance = self::MAX_PER_AGENT_PER_QA_MONTHLY;
        $safetyPass = 0;
        while ($safetyPass < 5) {
            $safetyPass++;
            $anyAssigned = false;

            foreach ($qaNames as $qaName) {
                if ($allocatedPerQa[$qaName]['TOTAL'] >= $dailyTotalPerQa) continue;

                $foundCand = null;
                $foundCat = null;
                $foundLay = null;
                $foundKey = null;

                foreach ($categoryOrder as $cat) {
                    $svcs = $categorizedServicePools[$cat] ?? [];
                    foreach ($svcs as $svcName => $pool) {
                        if ($pool->isEmpty()) continue;
                        foreach ($pool as $idx => $cand) {
                            $bakuInfo = $cand->baku_ticket_info ?? self::resolveBakuTicketInfo($cand);
                            $tid = $bakuInfo['canonical_id'];
                            if (isset($assignedTicketIds[$tid]) || isset($assignedAssessmentIds[$cand->id])) continue;
                            if (!empty($bakuInfo['icrm_id']) && isset($assignedTicketIds[$bakuInfo['icrm_id']])) continue;

                            $agId = $resolveAgentId($cand);
                            if (($agentCountPerQa[$qaName][$agId] ?? 0) >= $maxAgentAllowance) continue;

                            $foundCand = $cand;
                            $foundCat = $cat;
                            $foundLay = $svcName;
                            $foundKey = $idx;
                            break 3;
                        }
                    }
                }

                if ($foundCand !== null) {
                    $categorizedServicePools[$foundCat][$foundLay]->forget($foundKey);
                    $bakuInfo = $foundCand->baku_ticket_info ?? self::resolveBakuTicketInfo($foundCand);
                    $tid = $bakuInfo['canonical_id'];
                    $agId = $resolveAgentId($foundCand);

                    $assignedTicketIds[$tid] = true;
                    if (!empty($bakuInfo['icrm_id'])) $assignedTicketIds[$bakuInfo['icrm_id']] = true;
                    if (!empty($bakuInfo['ichat_id'])) $assignedTicketIds[$bakuInfo['ichat_id']] = true;
                    if (!empty($bakuInfo['omni_id'])) $assignedTicketIds[$bakuInfo['omni_id']] = true;
                    $assignedAssessmentIds[$foundCand->id] = true;

                    $agentCountPerQa[$qaName][$agId] = ($agentCountPerQa[$qaName][$agId] ?? 0) + 1;
                    $serviceCountPerQa[$qaName][$foundLay] = ($serviceCountPerQa[$qaName][$foundLay] ?? 0) + 1;
                    $allocatedPerQa[$qaName][$foundCat] = ($allocatedPerQa[$qaName][$foundCat] ?? 0) + 1;
                    $allocatedPerQa[$qaName]['TOTAL']++;

                    [$canonicalChannel, $canonicalSvcId] = $resolveCanonicalChannelInfo($foundLay, $foundCand);

                    $assignedAt = $targetDate->copy()->setTime(now()->hour, now()->minute, now()->second);
                    $validUntil = $assignedAt->copy()->addDays(7)->endOfDay();

                    $refNotes = ["Layanan: {$foundLay}"];
                    if (!empty($bakuInfo['icrm_id']) && $bakuInfo['baku_type'] !== 'ICRM') {
                        $refNotes[] = "Ref iCRM: {$bakuInfo['icrm_id']}";
                    }

                    $recordsToInsert[] = [
                        'sampling_period_id' => $period->id,
                        'ticket_id'          => $tid,
                        'agent_id'           => $agId,
                        'evaluator_name'     => $qaName,
                        'service_id'         => $canonicalSvcId,
                        'site_id'            => $smgSiteId ?: 1,
                        'channel'            => $canonicalChannel,
                        'category_name'      => $foundCat,
                        'cso_classification' => 'VERIFIED_NAKER',
                        'is_naker_verified'  => true,
                        'assignment_type'    => 'MANDATORY',
                        'is_extra_quota'     => false,
                        'valid_until'        => $validUntil,
                        'status'             => 'ASSIGNED',
                        'assessment_id'      => $foundCand->id,
                        'score_ca'           => null,
                        'fcr'                => null,
                        'notes'              => implode(' • ', $refNotes),
                        'assigned_at'        => $assignedAt,
                        'started_at'         => null,
                        'completed_at'       => null,
                        'hold_at'            => null,
                        'abandoned_at'       => null,
                        'quota_request_id'   => null,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ];

                    $anyAssigned = true;
                }
            }

            if (!$anyAssigned) {
                $maxAgentAllowance++;
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
            'distribution_mode'     => 'CUSTOM_DAILY_SERVICE_AND_CATEGORY_QUOTA',
            'target_date'           => $targetDateString,
            'service_targets'       => $serviceTargets,
            'category_targets'      => $categoryTargets,
            'rules' => [
                'service_targets'   => $serviceTargets,
                'composition'       => $categoryTargets,
                'total_per_qa'      => $dailyTotalPerQa,
                'max_agent_per_qa'  => self::MAX_PER_AGENT_PER_QA_MONTHLY,
            ],
            'total_inserted'        => count($recordsToInsert),
            'qa_allocations'        => $allocatedPerQa,
            'qa_service_allocations'=> $serviceCountPerQa,
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
            $bakuInfo = self::resolveBakuTicketInfo($asm);
            $canonicalTid = $bakuInfo['canonical_id'];
            $tid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            if (
                isset($assignedTicketIds[$canonicalTid]) ||
                isset($assignedTicketIds[$tid]) ||
                isset($assignedAssessmentIds[$asm->id]) ||
                isset($seenCandidates[$canonicalTid]) ||
                isset($seenCandidates[$tid])
            ) {
                return false;
            }
            if (self::isEliminatedTicket($asm, $eliminationLookup)) {
                return false;
            }
            if (!self::isValidHumanAgentTicket($asm)) {
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

            $seenCandidates[$canonicalTid] = true;
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
            $bakuInfo = self::resolveBakuTicketInfo($asm);
            $canonicalTid = $bakuInfo['canonical_id'];
            $rawTid = trim((string)$asm->ticket_id) ?: (trim((string)$asm->idca) ?: "TCK-{$asm->id}");
            $tid = $canonicalTid;
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

            $assignedTicketIds[$canonicalTid] = true;
            $assignedTicketIds[$rawTid] = true;
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

        // Rule Validasi: Wajib di-handling oleh Human CSO Agent (Bukan Bot/NGAOSS/NOC/Alarm/Ambigu)
        if (!self::isValidHumanAgentTicket($asm)) {
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

    /**
     * Resolves canonical / standard (tiket baku) ticket information based on service/channel.
     * Rule:
     * - Untuk DIGILIVE (Live Chat / MyIcon+ / Omni): Tiket bakunya adalah ICHAT atau OMNI
     *   (iChat diprioritaskan karena agen MyIcon+ didominasi iChat, Omni sebagai saluran utama lainnya).
     *   iCRM tetap disimpan sebagai referensi sekunder (#ICRM:...) karena 1 iCRM bisa disundul banyak sesi chat iChat/Omni.
     * - Untuk LAYANAN LAIN (Inbound, Email, Back Office, Socmed non-Digilive, dll):
     *   Tiket bakunya adalah TIKET iCRM (karena kanal ini tidak menggunakan iChat/Omni).
     */
    public static function resolveBakuTicketInfo($asm): array
    {
        $hashtag = (string)($asm->hashtag ?? '');
        $sourceCa = (string)($asm->source_ca ?? '');
        $ticketId = trim((string)($asm->ticket_id ?? ''));
        $idca = trim((string)($asm->idca ?? ''));
        $srcFile = strtolower((string)($asm->source_file ?? ''));

        $isSummaryFile = str_contains($srcFile, 'summary') || str_contains($srcFile, 'omni');
        $isConversationFile = str_contains($srcFile, 'conversation') || str_contains($srcFile, 'ichat');
        $isOmni = $isSummaryFile || str_contains(strtoupper($hashtag), '#OMNI');
        $isIchat = $isConversationFile || str_contains(strtoupper($hashtag), '#ICHAT');

        $rawChannel = self::resolveChannel($asm->validated_channel ?? ($asm->source_layanan ?? ($asm->channel ?? '')));
        $isNonDigiliveChannel = in_array(strtoupper($rawChannel), ['INBOUND', 'BILLING', 'EMAIL', 'BACK OFFICE', 'WALK IN', 'OUTBOUND']);

        $isDigilive = (strtoupper($rawChannel) === 'DIGILIVE') || (!$isNonDigiliveChannel && ($isOmni || $isIchat));
        $channel = $isDigilive ? 'Digilive' : $rawChannel;

        $ichatId = null;
        $omniId = null;
        $icrmId = null;

        // 1. Ekstrak dari hashtag (#ICHAT:xxx #OMNI:xxx #ICRM:xxx)
        if (preg_match('/#ICHAT:([^\s#]+)/i', $hashtag, $m)) {
            $ichatId = trim($m[1]);
        }
        if (preg_match('/#OMNI:([^\s#]+)/i', $hashtag, $m)) {
            $omniId = trim($m[1]);
        }
        if (preg_match('/#ICRM:([^\s#]+)/i', $hashtag, $m)) {
            $icrmId = trim($m[1]);
        }

        // 2. Ekstrak dari source_ca / source_file jika belum ketemu
        $isSummaryFile = str_contains($srcFile, 'summary') || str_contains($srcFile, 'omni');
        $isConversationFile = str_contains($srcFile, 'conversation') || str_contains($srcFile, 'ichat');

        if (!$ichatId && !$isSummaryFile) {
            if (str_starts_with($sourceCa, 'ICHAT_')) {
                $ichatId = substr($sourceCa, 6);
            } elseif ($isConversationFile && is_numeric($sourceCa)) {
                $ichatId = $sourceCa;
            }
        }

        if (!$omniId && $isSummaryFile) {
            // Pada berkas Summary Omni: source_ca menyimpan ID sesi/interaksi Omni (misal 8334074)
            if ($sourceCa && is_numeric($sourceCa) && !str_starts_with($sourceCa, 'CA-')) {
                $omniId = $sourceCa;
            } elseif ($ticketId && is_numeric($ticketId)) {
                $omniId = $ticketId;
            } elseif ($sourceCa && !str_starts_with($sourceCa, 'CA-') && $sourceCa !== $ichatId) {
                $omniId = $sourceCa;
            }
        }

        if (!$icrmId) {
            // Pada berkas Summary Omni: ticket_id menyimpan nomor tiket iCRM (misal R2JX95TL)
            if ($isSummaryFile && $ticketId && !is_numeric($ticketId) && !str_starts_with($ticketId, 'CA-') && !str_starts_with($ticketId, 'A14')) {
                $icrmId = $ticketId;
            } elseif ($ticketId && !str_starts_with($ticketId, 'CA-') && !str_starts_with($ticketId, 'TCK-') && $ticketId !== $ichatId && $ticketId !== $omniId) {
                $icrmId = $ticketId;
            } elseif ($sourceCa && !str_starts_with($sourceCa, 'CA-') && $sourceCa !== $ichatId && $sourceCa !== $omniId) {
                $icrmId = $sourceCa;
            }
        }

        // 3. Tentukan Tiket Baku & Aturan Eksklusif (Mutual Exclusivity)
        // Rule: Jika tiket adalah iChat, maka TIDAK BOLEH ada Omni (dan sebaliknya).
        // Kanal non-Digilive (Inbound, dll) bakunya adalah iCRM, tanpa iChat atau Omni.
        if ($isDigilive) {
            if ($ichatId) {
                $bakuId = $ichatId;
                $bakuType = 'ICHAT';
                $omniId = null; // Eksklusif: Hapus Omni jika tiket adalah iChat
            } elseif ($omniId) {
                $bakuId = $omniId;
                $bakuType = 'OMNI';
                $ichatId = null; // Eksklusif: Hapus iChat jika tiket adalah Omni
            } else {
                $bakuId = $ticketId ?: ($idca ?: "DIG-{$asm->id}");
                $bakuType = 'DIGILIVE_GENERAL';
                $ichatId = null;
                $omniId = null;
            }
        } else {
            $bakuId = $icrmId ?: ($ticketId ?: ($idca ?: "TCK-{$asm->id}"));
            $bakuType = 'ICRM';
            $ichatId = null;
            $omniId = null;
        }

        // Jika nomor referensi CRM sama persis dengan bakuId, kosongkan agar tidak redundan
        if ($icrmId === $bakuId) {
            $icrmId = null;
        }

        // Point 3: Kemunculan ID Pelanggan pada lembar sampling tiket mengacu pada Point 1 dan 2
        $idpel = null;
        $isPelanggan = false;
        if (preg_match('/#PELANGGAN:([^\s#]+)/i', $hashtag, $m)) {
            $idpel = trim($m[1]);
            $isPelanggan = true;
        }
        if (str_contains(strtoupper($hashtag), '#NON_PELANGGAN')) {
            $isPelanggan = false;
            $idpel = null;
        }
        if (!$idpel && !empty($asm->customer_idpel)) {
            $idpel = trim((string)$asm->customer_idpel);
            $isPelanggan = !empty($idpel) && !str_contains(strtoupper($idpel), 'NON') && $idpel !== '-';
        }
        if ($idpel && (str_contains(strtoupper($idpel), 'NON') || $idpel === '-')) {
            $idpel = null;
            $isPelanggan = false;
        }

        return [
            'canonical_id'   => $bakuId,
            'baku_type'      => $bakuType,
            'baku_label'     => match($bakuType) {
                'ICHAT' => 'iChat',
                'OMNI'  => 'Omni',
                default => 'iCRM',
            },
            'ichat_id'       => $ichatId,
            'omni_id'        => $omniId,
            'icrm_id'        => $icrmId,
            'channel'        => $channel,
            'is_digilive'    => $isDigilive,
            'is_pelanggan'   => $isPelanggan,
            'customer_type'  => $isPelanggan ? 'PELANGGAN' : 'NON_PELANGGAN',
            'customer_idpel' => $idpel,
        ];
    }

    /**
     * Memvalidasi bahwa tiket benar-benar di-handling oleh HUMAN CSO Agent,
     * dan bukan berasal dari aplikasi otomasi/sistem lain seperti NGAOSS, BOTIKA, PLN MOBILE, SYSTEM, NOC, dll.
     * Serta memastikan tiket tidak ambigu untuk kanal Digilive (wajib punya ID iChat atau Omni).
     */
    public static function isValidHumanAgentTicket($asm): bool
    {
        if (!$asm) return false;

        $agentName = strtoupper(trim((string)($asm->agent_name ?? ($asm->agent?->name ?? ''))));
        $sourceLay = strtoupper(trim((string)($asm->source_layanan ?? ($asm->source_ca ?? ''))));
        $sourceFile = strtoupper(trim((string)($asm->source_file ?? '')));
        $summary = strtoupper(trim((string)($asm->summary ?? '')));
        $tid = strtoupper(trim((string)($asm->ticket_id ?? ($asm->idca ?? ''))));

        // 0. Eliminasi Tiket Berasal dari Site Jakarta & Banten (site_id: 2)
        if ((int)($asm->site_id ?? 0) === 2) {
            return false;
        }

        // 1. Cek Kata Kunci Sistem / Otomasi / NOC / Kode Jakarta pada Nama Agent
        $invalidAgentKeywords = [
            'NGAOSS', 'VIA NGAOSS', 'NOC', 'NOC SBU', 'RSBS-INT', 'BOTIKA', 'VIA BOTIKA',
            'SYSTEM', 'BOT', 'AUTOBOT', 'VIA PLN MOBILE', 'VIA MY ICONNET MOBILE',
            'CSO.01', 'CSO 01', 'OB.01', 'OB 01', 'BO.01', 'BO 01', 'AS.01', 'AS 01',
            'IB.01', 'IB 01', 'KOOPS.01', 'KOOPS 01', 'QA.01', 'TL.01', 'PROAKTIF', 'INTEGRASI', 'ALARM'
        ];
        foreach ($invalidAgentKeywords as $kw) {
            if (str_contains($agentName, $kw)) {
                return false;
            }
        }
        if (preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b|\bJKT\b|JAKARTA)/i', $agentName)) {
            return false;
        }

        // 1b. Validasi Khusus Agen BO 02 Semarang untuk Back Office
        $resolvedChannel = self::resolveChannel($asm->validated_channel ?? ($asm->source_layanan ?? ($asm->channel ?? '')));
        $isBackOffice = ($resolvedChannel === 'Back Office' || str_contains($sourceLay, 'BACK OFFICE') || str_contains($sourceLay, 'INTERNAL'));
        if ($isBackOffice) {
            $hasBo02 = preg_match('/(\bBO[\s._\-]*0?2\b|\bSMG\b)/i', $agentName) || (!empty($asm->employee?->name) && preg_match('/(\bBO[\s._\-]*0?2\b|\bSMG\b)/i', $asm->employee->name));
            if (!$hasBo02) {
                return false;
            }
        }

        // 2. Cek Kata Kunci Otomasi pada Saluran / Sumber Layanan
        $invalidSourceKeywords = ['NGAOSS', 'BOTIKA', 'PLN MOBILE', 'NOC SBU', 'RSBS-INT'];
        foreach ($invalidSourceKeywords as $skw) {
            if (str_contains($sourceLay, $skw)) {
                return false;
            }
        }

        // 3. Cek Summary Alarm Perangkat / Sistem Unmonitor (Non-Interaksi Pelanggan)
        $alarmKeywords = [
            '[OLT]', 'UNMONITOR', '[ALARM]', 'ONT TERDETEKSI OFFLINE', 'PERANGKAT OLT',
            'FO CUT', 'KABEL PUTUS', 'DEVICE DOWN'
        ];
        foreach ($alarmKeywords as $akw) {
            if (str_contains($summary, $akw)) {
                return false;
            }
        }

        // 4. Cek Tiket Non-CSO / Alarm format A1480306 / A14
        if (self::isNonCsoAlarmTicket($tid, (string)($asm->source_ca ?? ''), $asm)) {
            return false;
        }

        // 5. Cek Tiket Tanpa Respon (No Response)
        $noRespKeywords = ['TIDAK ADA RESPON', 'NO RESPONSE', 'NO RESPON', 'TIDAK RESPON'];
        foreach ($noRespKeywords as $nr) {
            if (str_contains($summary, $nr)) {
                return false;
            }
        }
        $subCatName = strtoupper(trim((string)($asm->subCategory?->name ?? '')));
        foreach ($noRespKeywords as $nr) {
            if (str_contains($subCatName, $nr)) {
                return false;
            }
        }

        // 6. Validasi Khusus Kanal DIGILIVE & Omni WhatsApp:
        // Rule Eliminasi: Tiket Omni dengan sub layanan WhatsApp / Whats Up tidak disampling karena diarahkan ke iChat
        if (self::isOmniWhatsAppTicket($asm)) {
            return false;
        }

        // Patokan baku adalah iChat / Omni. Tiket Digilive yang tidak punya ID iChat dan tidak punya ID Omni adalah AMBIGU / tidak dapat dicari di aplikasi kerja agent
        $channel = self::resolveChannel($asm->validated_channel ?? ($asm->source_layanan ?? ($asm->channel ?? '')));
        if (strtoupper($channel) === 'DIGILIVE') {
            $hashtag = (string)($asm->hashtag ?? '');
            $sourceCa = (string)($asm->source_ca ?? '');
            $hasIchat = preg_match('/#ICHAT:([^\s#]+)/i', $hashtag) || str_starts_with($sourceCa, 'ICHAT_') || ((str_contains($sourceFile, 'CONVERSATION') || str_contains($sourceFile, 'ICHAT')) && is_numeric($sourceCa));
            $hasOmni = preg_match('/#OMNI:([^\s#]+)/i', $hashtag) || (str_contains($sourceFile, 'SUMMARY') || str_contains($sourceFile, 'OMNI'));
            if (!$hasIchat && !$hasOmni) {
                return false;
            }
        }

        return true;
    }

    /**
     * Memeriksa apakah tiket Omni merupakan sub layanan WhatsApp / Whats Up / WA.
     * Rule: Tiket Omni sub-layanan WhatsApp sudah tidak disampling karena traffic WhatsApp dialihkan ke iChat MyIcon+.
     */
    public static function isOmniWhatsAppTicket($asm, ?array $nakerCaches = null): bool
    {
        if (!$asm) return false;

        $sourceFile = strtolower((string)($asm->source_file ?? ''));
        $hashtag = strtoupper((string)($asm->hashtag ?? ''));
        $isOmni = str_contains($sourceFile, 'summary') 
               || str_contains($sourceFile, 'omni') 
               || str_contains($hashtag, '#OMNI');

        if (!$isOmni) {
            return false;
        }

        // 1. Cek dari platform atau saluran / hashtag resmi sub-layanan (bukan dari isi catatan pelanggan)
        $sourceLayanan = strtoupper((string)($asm->source_layanan ?? ''));
        $platformName = strtoupper((string)($asm->platform?->name ?? ''));
        $subChannel = strtoupper((string)($asm->agent?->sub_channel ?? ''));

        if (str_contains($platformName, 'WHATSAPP') 
            || str_contains($platformName, 'WHATS UP') 
            || str_contains($platformName, 'WHATSUP')
            || str_contains($platformName, 'CHAT - WA')
            || str_contains($platformName, 'CHAT-WA')
            || str_contains($hashtag, '#WA')
            || str_contains($hashtag, '#WHATSAPP')
            || str_contains($sourceLayanan, 'WHATSAPP')
            || str_contains($sourceLayanan, 'CHAT - WA')
            || str_contains($sourceLayanan, 'CHAT-WA')) {
            return true;
        }

        // 2. Cek Sub-Channel / Sub-Service Agen di Master Data (misal: "CSO DIGILIVE CHAT - WA")
        if (str_contains($subChannel, 'WA') || str_contains($subChannel, 'WHATSAPP')) {
            return true;
        }
        $agentName = trim((string)($asm->agent_name ?? ''));
        if ($agentName) {
            static $waAgentNames = null;
            if ($waAgentNames === null) {
                $waAgentNames = Agent::where(function($q) {
                    $q->where('sub_channel', 'like', '%WA%')
                      ->orWhere('sub_channel', 'like', '%WHATSAPP%');
                })->pluck('name')->map(fn($n) => strtoupper(trim($n)))->flip()->toArray();
            }
            if (isset($waAgentNames[strtoupper($agentName)])) {
                return true;
            }

            if ($nakerCaches && isset($nakerCaches['employees'])) {
                $emp = $nakerCaches['employees']->get(strtoupper($agentName));
                if ($emp) {
                    $asn = $nakerCaches['assignments']->get($emp->id) ?? null;
                    if ($asn) {
                        $subService = strtoupper((string)($asn->sub_service ?? ''));
                        if (str_contains($subService, 'WA') || str_contains($subService, 'WHATSAPP')) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * Helper to synchronize existing sampling_assignments with their canonical baku ticket IDs
     */
    public static function syncBakuTicketIds(?string $periodCode = null): int
    {
        $q = SamplingAssignment::with('assessment');
        if ($periodCode) {
            $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
            $q->where('sampling_period_id', $period->id);
        }
        $assignments = $q->whereNotNull('assessment_id')->get();
        $updated = 0;
        foreach ($assignments as $a) {
            if (!$a->assessment) continue;
            $baku = self::resolveBakuTicketInfo($a->assessment);
            if ($a->ticket_id !== $baku['canonical_id']) {
                $notes = $a->notes;
                if (!empty($baku['icrm_id']) && $baku['baku_type'] !== 'ICRM' && (!str_contains((string)$notes, 'Ref iCRM:'))) {
                    $notes = trim($notes . " Ref iCRM: {$baku['icrm_id']}");
                }
                $a->update([
                    'ticket_id' => $baku['canonical_id'],
                    'notes'     => $notes,
                ]);
                $updated++;
            }
        }
        return $updated;
    }
}

