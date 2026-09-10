<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\TeamLeader;
use App\Models\Trainer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NakerVerificationService
{
    public const CLASSIFICATION_VERIFIED_NAKER = 'VERIFIED_NAKER';
    public const CLASSIFICATION_SELF_SERVICE_BOT = 'SELF_SERVICE_BOT';
    public const CLASSIFICATION_UNMAPPED_CSO = 'UNMAPPED_CSO';

    /**
     * Daftar kata kunci otomasi bot / self-service pelanggan
     */
    protected static array $botKeywords = [
        'VIA MY ICONNET MOBILE',
        'VIA BOTIKA',
        'VIA PLN MOBILE',
        'VIA NGAOSS',
        'BOTIKA',
        'PLN MOBILE',
        'MY ICONNET MOBILE',
        'SYSTEM',
        'BOT',
        'AUTOMATION'
    ];

    /**
     * Normalisasi dan bersihkan prefix operasional dari nama CSO
     * (Misal: KOOPS.02AHMADZAENALARIFIN -> AHMAD ZAENAL ARIFIN, OB.01 MILA ROSANTIA -> MILA ROSANTIA)
     */
    public static function cleanCsoName(?string $rawName): string
    {
        if ($rawName === null || trim($rawName) === '') {
            return 'Unknown CSO';
        }

        $name = trim($rawName);

        // 1. Strip unit path prefix (e.g., RSBS-INT-NOC_MILA, PLMPLG-INT-MBL03/...)
        $name = preg_replace('/^[A-Z0-9._-]+\//i', '', $name);
        $name = preg_replace('/^[A-Z0-9._-]+_/i', '', $name);

        // 2. Strip standard operational role codes (OB.01, IB.02, CSO.01, CSO.O2, KOOPS.02, BO.01, QA.01, TL.01, etc.)
        $name = preg_replace('/^(OB|IB|CSO|AS|BO|KOOPS|QA|TL)[\s._0-9O]+\s*/i', '', $name);

        // 3. Strip regional/departmental unit codes (FL-, OPHAR-, RSBS-, PLM-)
        $name = preg_replace('/^(FL|OPHAR|RSBS|PLM)[\s._0-9A-Za-z-]*-\s*/i', '', $name);

        // 4. Strip leading punctuation or symbols
        $name = preg_replace('/^[-._\s:]+/', '', $name);

        // 5. Replace dot separators with spaces (e.g. AHMAD.ZAENAL.ARIFIN -> AHMAD ZAENAL ARIFIN)
        $name = str_replace('.', ' ', $name);

        // 6. Normalize multiple spaces
        $name = preg_replace('/\s+/', ' ', $name);

        return trim($name) ?: trim($rawName);
    }

    /**
     * Memuat cache Master Data NAKER ke dalam memori untuk verifikasi O(1)
     */
    public static function loadNakerCaches(): array
    {
        $employees = Employee::all();
        $assignments = EmployeeAssignment::where('status', true)
            ->with(['teamLeader', 'trainer'])
            ->get()
            ->keyBy('employee_id');

        $byName = [];
        $byNormName = [];
        $bySip = [];
        $byId = [];

        foreach ($employees as $emp) {
            $byId[$emp->id] = $emp;
            
            if ($emp->name) {
                $upperName = strtoupper(trim($emp->name));
                $byName[$upperName] = $emp;

                $norm = strtoupper(preg_replace('/[^A-Z0-9]/', '', $emp->name));
                if ($norm) $byNormName[$norm] = $emp;
            }

            if ($emp->sip_id) {
                $upperSip = strtoupper(trim($emp->sip_id));
                $bySip[$upperSip] = $emp;

                $normSip = strtoupper(preg_replace('/[^A-Z0-9]/', '', $emp->sip_id));
                if ($normSip) $byNormName[$normSip] = $emp;
            }
        }

        return [
            'by_name'      => $byName,
            'by_norm_name' => $byNormName,
            'by_sip'       => $bySip,
            'by_id'        => $byId,
            'assignments'  => $assignments,
        ];
    }

    /**
     * Deteksi Site berdasarkan prefix kode CSO (contoh: .02 = Semarang, .01 = Jakarta)
     */
    public static function detectSite(string $rawName, ?Employee $employee = null, ?array $nakerCaches = null): array
    {
        $raw = strtoupper(trim((string)$rawName));

        // 1. Cek kode prefix eksplisit: .02, CSO.02, OB.02, KOOPS.02, AS.02, IB.02, BO.02 -> SEMARANG
        if (preg_match('/(\.0?2\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?2\b)/i', $raw) || str_contains($raw, '.02')) {
            return [
                'site_id'     => 1,
                'site_code'   => 'SMG',
                'site_name'   => 'SEMARANG',
                'is_semarang' => true,
            ];
        }

        // 2. Cek kode prefix eksplisit: .01, CSO.01, OB.01, KOOPS.01, AS.01, IB.01, BO.01 -> JAKARTA
        if (preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b)/i', $raw) || str_contains($raw, '.01')) {
            return [
                'site_id'     => 11,
                'site_code'   => 'JKT',
                'site_name'   => 'JAKARTA & BANTEN',
                'is_semarang' => false,
            ];
        }

        // 3. Fallback ke penugasan Employee di Data NAKER
        if ($employee) {
            $caches = $nakerCaches ?? self::loadNakerCaches();
            $asn = $caches['assignments']->get($employee->id);
            if ($asn && $asn->site_id) {
                $isSmg = ($asn->site_id == 1);
                return [
                    'site_id'     => $asn->site_id,
                    'site_code'   => $isSmg ? 'SMG' : 'OTHER',
                    'site_name'   => $isSmg ? 'SEMARANG' : ($asn->site?->name ?? 'OTHER'),
                    'is_semarang' => $isSmg,
                ];
            }
        }

        // 4. Default: Human CSO dalam data retail saat ini di-assign ke Site Semarang
        return [
            'site_id'     => 1,
            'site_code'   => 'SMG',
            'site_name'   => 'SEMARANG',
            'is_semarang' => true,
        ];
    }

    /**
     * Verifikasi dan klasifikasi CSO secara real-time
     */
    public static function classifyCso(string $rawName, ?string $nik = null, ?array $nakerCaches = null): array
    {
        $caches = $nakerCaches ?? self::loadNakerCaches();
        $cleanName = self::cleanCsoName($rawName);
        $upperRaw = strtoupper(trim($rawName));

        // 1. Cek apakah termasuk Bot / Self-Service
        foreach (self::$botKeywords as $bot) {
            if (str_contains($upperRaw, $bot)) {
                return [
                    'classification'    => self::CLASSIFICATION_SELF_SERVICE_BOT,
                    'is_naker_verified' => false,
                    'clean_name'        => $cleanName,
                    'employee'          => null,
                    'employee_id'       => null,
                    'site_id'           => null,
                    'site_code'         => 'BOT',
                    'site_name'         => 'SELF SERVICE BOT',
                    'is_semarang'       => false,
                    'label'             => 'Self-Service (Bot/Otomasi)',
                ];
            }
        }

        // 2. Verifikasi terhadap Master Data NAKER
        $normClean = strtoupper(preg_replace('/[^A-Z0-9]/', '', $cleanName));
        $normNik = $nik ? strtoupper(preg_replace('/[^A-Z0-9]/', '', $nik)) : null;

        $matchedEmp = $caches['by_name'][strtoupper($cleanName)]
            ?? ($caches['by_norm_name'][$normClean]
            ?? ($normNik && isset($caches['by_sip'][$normNik]) ? $caches['by_sip'][$normNik] : null));

        $siteInfo = self::detectSite($rawName, $matchedEmp, $caches);

        if ($matchedEmp) {
            return [
                'classification'    => self::CLASSIFICATION_VERIFIED_NAKER,
                'is_naker_verified' => true,
                'clean_name'        => $matchedEmp->name,
                'employee'          => $matchedEmp,
                'employee_id'       => $matchedEmp->id,
                'site_id'           => $siteInfo['site_id'],
                'site_code'         => $siteInfo['site_code'],
                'site_name'         => $siteInfo['site_name'],
                'is_semarang'       => $siteInfo['is_semarang'],
                'label'             => 'Terverifikasi NAKER (Human CSO)',
            ];
        }

        // 3. Klasifikasi Non-NAKER / Unmapped CSO (Akun Operasional / Non-Terdaftar)
        return [
            'classification'    => self::CLASSIFICATION_UNMAPPED_CSO,
            'is_naker_verified' => false,
            'clean_name'        => $cleanName,
            'employee'          => null,
            'employee_id'       => null,
            'site_id'           => $siteInfo['site_id'],
            'site_code'         => $siteInfo['site_code'],
            'site_name'         => $siteInfo['site_name'],
            'is_semarang'       => $siteInfo['is_semarang'],
            'label'             => 'Non-NAKER / Akun Operasional',
        ];
    }

    /**
     * Sinkronisasi massal klasifikasi, site_id & relasi employee pada tabel ca_assessments
     */
    public static function syncAllAssessmentsClassification(): array
    {
        ini_set('memory_limit', '512M');
        $caches = self::loadNakerCaches();

        // Ambil kombinasi unik agent_id & agent_name yang ada di ca_assessments
        $distinctAgents = CaAssessment::select('agent_id', 'agent_name')
            ->groupBy('agent_id', 'agent_name')
            ->get();

        $totalGroups = 0;
        $verifiedCount = 0;
        $botCount = 0;
        $unmappedCount = 0;
        $semarangCount = 0;
        $jakartaCount = 0;

        $agentsMap = Agent::all()->keyBy('id');

        DB::beginTransaction();
        try {
            foreach ($distinctAgents as $row) {
                $totalGroups++;
                $agentModel = $row->agent_id ? $agentsMap->get($row->agent_id) : null;
                $rawName = $row->agent_name ?: ($agentModel ? $agentModel->name : '');
                $nik = $agentModel ? $agentModel->nik : null;

                $res = self::classifyCso($rawName, $nik, $caches);

                // Update semua baris ca_assessments yang cocok dengan kriteria grup ini
                $affected = CaAssessment::where(function($q) use ($row) {
                    if ($row->agent_id) {
                        $q->where('agent_id', $row->agent_id);
                    } else {
                        $q->where('agent_name', $row->agent_name);
                    }
                })->update([
                    'cso_classification' => $res['classification'],
                    'is_naker_verified'  => $res['is_naker_verified'],
                    'employee_id'        => $res['employee_id'],
                    'site_id'            => $res['site_id'],
                ]);

                if ($res['classification'] === self::CLASSIFICATION_VERIFIED_NAKER) {
                    $verifiedCount += $affected;
                } elseif ($res['classification'] === self::CLASSIFICATION_SELF_SERVICE_BOT) {
                    $botCount += $affected;
                } else {
                    $unmappedCount += $affected;
                }

                if ($res['is_semarang']) {
                    $semarangCount += $affected;
                } elseif ($res['site_id'] == 11) {
                    $jakartaCount += $affected;
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        $totalAsms = CaAssessment::count();

        return [
            'total_assessments' => $totalAsms,
            'verified_naker'    => $verifiedCount,
            'self_service_bot'  => $botCount,
            'unmapped_cso'      => $unmappedCount,
            'site_semarang'     => $semarangCount,
            'site_jakarta'      => $jakartaCount,
        ];
    }

    /**
     * Sinkronisasi massal seluruh Agen di tabel agents dengan Data NAKER
     */
    public static function syncAllAgentsClassification(): array
    {
        $caches = self::loadNakerCaches();
        $agents = Agent::all();
        $synced = 0;

        $tlCache = [];
        $trnCache = [];

        foreach ($agents as $agent) {
            $rawName = $agent->name;
            $res = self::classifyCso($rawName, $agent->nik, $caches);

            $updateData = [
                'cso_classification' => $res['classification'],
                'is_naker_verified'  => $res['is_naker_verified'],
                'site_id'            => $res['site_id'],
            ];

            if ($res['employee']) {
                $emp = $res['employee'];
                $asn = $caches['assignments']->get($emp->id);

                if ($asn?->teamLeader?->name) {
                    $tlName = trim($asn->teamLeader->name);
                    if (!isset($tlCache[$tlName])) {
                        $tlCache[$tlName] = TeamLeader::firstOrCreate(
                            ['name' => $tlName],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $updateData['team_leader_id'] = $tlCache[$tlName]->id;
                }

                if ($asn?->trainer?->name) {
                    $trnName = trim($asn->trainer->name);
                    if (!isset($trnCache[$trnName])) {
                        $trnCache[$trnName] = Trainer::firstOrCreate(
                            ['name' => $trnName],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $updateData['trainer_id'] = $trnCache[$trnName]->id;
                }

                if ($emp->sip_id && (str_starts_with($agent->nik, 'AGT-') || empty($agent->nik))) {
                    if (!Agent::where('nik', $emp->sip_id)->where('id', '!=', $agent->id)->exists()) {
                        $updateData['nik'] = $emp->sip_id;
                    }
                }
            }

            $agent->update($updateData);
            $synced++;
        }

        return [
            'total_agents_synced' => $synced,
        ];
    }
}
