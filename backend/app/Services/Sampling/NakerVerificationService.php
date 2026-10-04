<?php

namespace App\Services\Sampling;

use App\Models\Agent;
use App\Models\CaAssessment;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\Site;
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

        // 2. Strip standard operational role & site codes (SMG, JKT, BDG, SBY, DPS, MDN, OB.01, IB.02, CSO.01, CSO.O2, KOOPS.02, BO.01, QA.01, TL.01, etc.)
        $name = preg_replace('/^(SMG|JKT|BDG|SBY|DPS|MDN|OB|IB|CSO|AS|BO|KOOPS|QA|TL)[\s._0-9O]+\s*/i', '', $name);
        $name = preg_replace('/^(SMG|JKT|BDG|SBY|DPS|MDN)\s+/i', '', $name);

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
            ->with(['teamLeader', 'trainer', 'service', 'site'])
            ->get()
            ->keyBy('employee_id');

        $byName = [];
        $byNormName = [];
        $bySip = [];
        $bySipNorm = [];
        $byFirstLast = [];
        $byFirstSecond = [];
        $byId = [];

        foreach ($employees as $emp) {
            $byId[$emp->id] = $emp;
            
            if ($emp->name) {
                $upperName = strtoupper(trim((string)$emp->name));
                $byName[$upperName] = $emp;

                $norm = preg_replace('/[^A-Z0-9]/', '', $upperName);
                if ($norm) $byNormName[$norm] = $emp;

                // Index First + Last name tokens (e.g. AYU YUDHA PRATIWI -> AYU PRATIWI)
                $parts = preg_split('/\s+/', $upperName);
                if (count($parts) >= 2) {
                    $fl = $parts[0] . ' ' . end($parts);
                    $flNorm = preg_replace('/[^A-Z0-9]/', '', $fl);
                    $byFirstLast[$fl] = $emp;
                    $byNormName[$flNorm] = $emp;

                    $fs = $parts[0] . ' ' . $parts[1];
                    $fsNorm = preg_replace('/[^A-Z0-9]/', '', $fs);
                    $byFirstSecond[$fs] = $emp;
                    $byNormName[$fsNorm] = $emp;
                }
                if (count($parts) === 1) {
                    // Single word name like "MUSRIPAH" or "PRASETIYO" -> also match double tokens like "MUSRIPAH.MUSRIPAH"
                    $double = $parts[0] . ' ' . $parts[0];
                    $doubleNorm = $parts[0] . $parts[0];
                    $byName[$double] = $emp;
                    $byNormName[$doubleNorm] = $emp;
                }
            }

            if ($emp->sip_id) {
                $upperSip = strtoupper(trim((string)$emp->sip_id));
                $bySip[$upperSip] = $emp;

                $normSip = preg_replace('/[^A-Z0-9]/', '', $upperSip);
                if ($normSip) {
                    $bySipNorm[$normSip] = $emp;
                    $byNormName[$normSip] = $emp;
                }

                $sipSpaced = str_replace('.', ' ', $upperSip);
                $byName[$sipSpaced] = $emp;
                $normSipSpaced = preg_replace('/[^A-Z0-9]/', '', $sipSpaced);
                if ($normSipSpaced) {
                    $byNormName[$normSipSpaced] = $emp;
                }
            }
        }

        return [
            'by_name'         => $byName,
            'by_norm_name'    => $byNormName,
            'by_sip'          => $bySip,
            'by_sip_norm'     => $bySipNorm,
            'by_first_last'   => $byFirstLast,
            'by_first_second' => $byFirstSecond,
            'by_id'           => $byId,
            'assignments'     => $assignments,
        ];
    }

    /**
     * Cache & resolve Site model ke DB secara aman (Zero FK Constraint Violation)
     */
    public static function getSiteByCode(string $code, ?string $name = null): ?Site
    {
        static $sites = [];
        $code = strtoupper(trim($code));

        if (!isset($sites[$code])) {
            try {
                $sites[$code] = Site::firstOrCreate(
                    ['code' => $code],
                    ['name' => $name ?? $code, 'status' => true]
                );
            } catch (\Throwable $e) {
                return null;
            }
        }

        return $sites[$code];
    }

    /**
     * Deteksi Site berdasarkan prefix kode CSO (contoh: .02 = Semarang, .01 = Jakarta)
     */
    public static function detectSite(string $rawName, ?Employee $employee = null, ?array $nakerCaches = null): array
    {
        $raw = strtoupper(trim((string)$rawName));
        $smgSite = self::getSiteByCode('SMG', 'SEMARANG');

        // 1. Cek kode prefix eksplisit: .02, CSO.02, OB.02, KOOPS.02, AS.02, IB.02, BO.02 -> SEMARANG
        if (preg_match('/(\.0?2\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?2\b)/i', $raw) || str_contains($raw, '.02')) {
            return [
                'site_id'     => $smgSite?->id,
                'site_code'   => 'SMG',
                'site_name'   => 'SEMARANG',
                'is_semarang' => true,
            ];
        }

        // 2. Cek kode prefix eksplisit: .01, CSO.01, OB.01, KOOPS.01, AS.01, IB.01, BO.01 -> JAKARTA
        if (preg_match('/(\.0?1\b|\b(CSO|OB|AS|BO|IB|KOOPS|QA|TL)[\s._]*0?1\b)/i', $raw) || str_contains($raw, '.01')) {
            $jktSite = self::getSiteByCode('JKT', 'JAKARTA & BANTEN');
            return [
                'site_id'     => $jktSite?->id,
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
                $isSmg = ($asn->site?->code === 'SMG' || $asn->site_id === $smgSite?->id);
                return [
                    'site_id'     => $asn->site_id,
                    'site_code'   => $isSmg ? 'SMG' : ($asn->site?->code ?? 'OTHER'),
                    'site_name'   => $isSmg ? 'SEMARANG' : ($asn->site?->name ?? 'OTHER'),
                    'is_semarang' => $isSmg,
                ];
            }
        }

        // 4. Default: Human CSO dalam data retail saat ini di-assign ke Site Semarang
        return [
            'site_id'     => $smgSite?->id,
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
        $upperRaw = strtoupper(trim((string)$rawName));
        $normRaw = preg_replace('/[^A-Z0-9]/', '', $upperRaw);

        // 1. Cek apakah termasuk Bot / Self-Service
        foreach (self::$botKeywords as $bot) {
            if (str_contains($upperRaw, $bot)) {
                return [
                    'classification'    => self::CLASSIFICATION_SELF_SERVICE_BOT,
                    'is_naker_verified' => false,
                    'clean_name'        => $cleanName,
                    'nik'               => null,
                    'employee'          => null,
                    'employee_id'       => null,
                    'site_id'           => null,
                    'site_code'         => 'BOT',
                    'site_name'         => 'SELF SERVICE BOT',
                    'team_leader_id'    => null,
                    'team_leader_name'  => null,
                    'trainer_id'        => null,
                    'trainer_name'      => null,
                    'channel'           => 'Botika',
                    'is_semarang'       => false,
                    'label'             => 'Self-Service (Bot/Otomasi)',
                ];
            }
        }

        // 2. Multi-tier Matching terhadap Master Data NAKER
        $upperClean = strtoupper($cleanName);
        $normClean = preg_replace('/[^A-Z0-9]/', '', $upperClean);
        $normNik = $nik ? strtoupper(preg_replace('/[^A-Z0-9]/', '', (string)$nik)) : null;

        // Tier A: Check directly against SIP ID (both dotted, raw, and normalized)
        $matchedEmp = $caches['by_sip'][$upperRaw]
            ?? ($caches['by_sip_norm'][$normRaw]
            ?? ($caches['by_sip'][$upperClean]
            ?? ($caches['by_sip_norm'][$normClean] ?? null)));

        // Tier B: Check directly against employee full name and normalized name
        if (!$matchedEmp) {
            $matchedEmp = $caches['by_name'][$upperClean]
                ?? ($caches['by_norm_name'][$normClean]
                ?? ($caches['by_name'][$upperRaw]
                ?? ($caches['by_norm_name'][$normRaw] ?? null)));
        }

        // Tier C: Check by NIK if provided
        if (!$matchedEmp && $normNik) {
            $matchedEmp = $caches['by_sip'][$normNik]
                ?? ($caches['by_sip_norm'][$normNik]
                ?? ($caches['by_name'][$normNik]
                ?? ($caches['by_norm_name'][$normNik] ?? null)));
        }

        // Tier D: Check by First+Last and First+Second name tokens
        if (!$matchedEmp) {
            $matchedEmp = $caches['by_first_last'][$upperClean]
                ?? ($caches['by_first_second'][$upperClean]
                ?? ($caches['by_first_last'][$upperRaw]
                ?? ($caches['by_first_second'][$upperRaw] ?? null)));
        }

        // Tier E: Fuzzy / Levenshtein matching on normalized string (for 1-2 char typos like lisharibah vs lishabibah)
        if (!$matchedEmp && strlen($normClean) >= 6) {
            foreach ($caches['by_sip_norm'] as $kSip => $empCandidate) {
                if (levenshtein($normClean, $kSip) <= 2) {
                    $matchedEmp = $empCandidate;
                    break;
                }
            }
            if (!$matchedEmp) {
                foreach ($caches['by_norm_name'] as $kNorm => $empCandidate) {
                    if (levenshtein($normClean, $kNorm) <= 2) {
                        $matchedEmp = $empCandidate;
                        break;
                    }
                }
            }
        }

        $siteInfo = self::detectSite($rawName, $matchedEmp, $caches);

        if ($matchedEmp) {
            $asn = $caches['assignments']->get($matchedEmp->id);

            return [
                'classification'    => self::CLASSIFICATION_VERIFIED_NAKER,
                'is_naker_verified' => true,
                'clean_name'        => $matchedEmp->name,
                'nik'               => $matchedEmp->sip_id,
                'employee'          => $matchedEmp,
                'employee_id'       => $matchedEmp->id,
                'site_id'           => $siteInfo['site_id'],
                'site_code'         => $siteInfo['site_code'],
                'site_name'         => $siteInfo['site_name'],
                'team_leader_id'    => $asn?->team_leader_id,
                'team_leader_name'  => $asn?->teamLeader?->name,
                'trainer_id'        => $asn?->trainer_id,
                'trainer_name'      => $asn?->trainer?->name,
                'service_id'        => $asn?->service_id,
                'channel'           => $asn?->service?->name ?: 'Inbound',
                'is_semarang'       => $siteInfo['is_semarang'],
                'label'             => 'Terverifikasi NAKER (Human CSO)',
            ];
        }

        // 3. Klasifikasi Non-NAKER / Unmapped CSO (Akun Operasional / Non-Terdaftar)
        return [
            'classification'    => self::CLASSIFICATION_UNMAPPED_CSO,
            'is_naker_verified' => false,
            'clean_name'        => $cleanName,
            'nik'               => $nik,
            'employee'          => null,
            'employee_id'       => null,
            'site_id'           => $siteInfo['site_id'],
            'site_code'         => $siteInfo['site_code'],
            'site_name'         => $siteInfo['site_name'],
            'team_leader_id'    => null,
            'team_leader_name'  => null,
            'trainer_id'        => null,
            'trainer_name'      => null,
            'channel'           => 'Inbound',
            'is_semarang'       => $siteInfo['is_semarang'],
            'label'             => 'Non-NAKER / Akun Operasional',
        ];
    }

    /**
     * Sinkronisasi massal seluruh Agen dari Master Data NAKER ke tabel agents
     * Menjamin tabel agents 100% akurat dan sesuai dengan NAKER yang di-import
     */
    public static function syncAllAgentsFromNaker(): int
    {
        $caches = self::loadNakerCaches();
        
        // Ambil semua employee aktif yang berstatus CSO (Bukan TL, Trainer, QA, Supervisor)
        $csoAssignments = EmployeeAssignment::where('status', true)
            ->whereHas('service', function($q) {
                $q->whereNotIn('name', [
                    'Team Leader',
                    'Trainer',
                    'Quality Assurance',
                    'Supervisor',
                    'Middle Management QA',
                    'Middle Management Quality Assurance',
                    'Management'
                ]);
            })
            ->with(['employee', 'service', 'teamLeader', 'trainer', 'site'])
            ->get();

        $tlCache = [];
        $trnCache = [];
        $syncedCount = 0;
        $activeEmpIds = [];

        DB::beginTransaction();
        try {
            foreach ($csoAssignments as $asn) {
                $emp = $asn->employee;
                if (!$emp) continue;
                $activeEmpIds[] = $emp->id;

                // Resolve Team Leader Model ID
                $tlId = null;
                if ($asn->teamLeader?->name) {
                    $tlName = trim($asn->teamLeader->name);
                    if (!isset($tlCache[$tlName])) {
                        $tlCache[$tlName] = TeamLeader::firstOrCreate(
                            ['name' => $tlName],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $tlId = $tlCache[$tlName]->id;
                }

                // Resolve Trainer Model ID
                $trnId = null;
                if ($asn->trainer?->name) {
                    $trnName = trim($asn->trainer->name);
                    if (!isset($trnCache[$trnName])) {
                        $trnCache[$trnName] = Trainer::firstOrCreate(
                            ['name' => $trnName],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $trnId = $trnCache[$trnName]->id;
                }

                $channelName = $asn->service?->name ?: 'Inbound';
                if ($channelName === 'Email Inbound') $channelName = 'Email';

                // Cari Agent berdasarkan SIP ID (NIK) atau Nama
                $agent = null;
                if ($emp->sip_id) {
                    $agent = Agent::where('nik', $emp->sip_id)->first();
                }
                if (!$agent) {
                    $agent = Agent::whereRaw('UPPER(TRIM(name)) = ?', [strtoupper(trim($emp->name))])->first();
                }

                $agentPayload = [
                    'name'               => $emp->name,
                    'nik'                => $emp->sip_id ?: ('AGT-' . str_pad($emp->id, 4, '0', STR_PAD_LEFT)),
                    'channel'            => $channelName,
                    'site_id'            => $asn->site_id ?: 1,
                    'team_leader_id'     => $tlId,
                    'trainer_id'         => $trnId,
                    'status'             => 'Aktif',
                    'is_naker_verified'  => true,
                    'cso_classification' => self::CLASSIFICATION_VERIFIED_NAKER,
                ];

                if ($agent) {
                    $agent->update($agentPayload);
                } else {
                    $agent = Agent::create(array_merge($agentPayload, [
                        'ca_score'  => 85.00,
                        'fcr_score' => 100.00,
                        'evaluation_count' => 0,
                    ]));
                }

                $syncedCount++;
            }

            // Tandai agen non-NAKER sebagai UNMAPPED_CSO
            Agent::whereNotIn('name', $csoAssignments->pluck('employee.name')->filter()->toArray())
                ->whereNotIn('nik', $csoAssignments->pluck('employee.sip_id')->filter()->toArray())
                ->update([
                    'is_naker_verified'  => false,
                    'cso_classification' => self::CLASSIFICATION_UNMAPPED_CSO,
                ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return $syncedCount;
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
                $updateData = [
                    'cso_classification' => $res['classification'],
                    'is_naker_verified'  => $res['is_naker_verified'],
                    'employee_id'        => $res['employee_id'],
                    'site_id'            => $res['site_id'],
                ];

                // Jika terverifikasi NAKER, standarisasi nama agent ke nama resmi NAKER
                if ($res['is_naker_verified'] && !empty($res['clean_name'])) {
                    $updateData['agent_name'] = $res['clean_name'];
                }

                $affected = CaAssessment::where(function($q) use ($row) {
                    if ($row->agent_id) {
                        $q->where('agent_id', $row->agent_id);
                    } else {
                        $q->where('agent_name', $row->agent_name);
                    }
                })->update($updateData);

                if ($res['classification'] === self::CLASSIFICATION_VERIFIED_NAKER) {
                    $verifiedCount += $affected;
                } elseif ($res['classification'] === self::CLASSIFICATION_SELF_SERVICE_BOT) {
                    $botCount += $affected;
                } else {
                    $unmappedCount += $affected;
                }

                if ($res['is_semarang']) {
                    $semarangCount += $affected;
                } elseif (($res['site_code'] ?? '') === 'JKT') {
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
        return [
            'total_agents_synced' => self::syncAllAgentsFromNaker(),
        ];
    }
}

