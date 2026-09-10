# ROADMAP SEGMENT 2 — D (UPDATE V2)
# PENJABARAN TARGET SITE, QA & CSO — Q-APPS 2026

> **UPDATE V2 — Disesuaikan dengan Standar Mutu Target & Sample Aktual Agustus 2026.**
> - **Target CA Standar Site:** `85.0%` *(Diperbarui dari 90.0%)*
> - **Target FCR Standar Site:** `100.0%` *(Diperbarui dari 85.0%)*
> - **Target Kuota Evaluator / Bulan:** `370 Sesi Sampling` *(8 QA Evaluator & 8 Trainer QA)*
> - **Populasi CSO Aktif (NAKER Plotting SMG):** `173 CSO`
> - **Mandatory Sampling per CSO:** `2 Tiket / CSO / QA` = `173 × 2 = 346 Tiket Mandatory / QA`
> - **Additional Sampling per QA:** `370 - 346 = 24 Tiket Tambahan / QA`
> - **Kepadatan Sampling CSO:** `8 QA × 2 = 16 Sesi / CSO / Bulan`

---

## 1. Tujuan Fitur (V2)

Fitur Penjabaran Target digunakan untuk memecah, mendistribusikan, dan memantau target sampling mutu contact center secara berjenjang dari level **Site** → **Evaluator (QA / Trainer)** → **CSO (Agent)** → **7 Saluran Layanan QSF** → **Tiket Transaksi**.

Sistem memastikan tidak ada target yang ter-hardcode secara statis di level controller, melainkan dikelola melalui snapshot tabel konfigurasi dan terikat pada periode sampling aktif.

---

## 2. Hierarki Struktur Target (V2)

```text
┌────────────────────────────────────────────────────────┐
│                   SITE (Semarang - SMG)                │
│   Target CA: 85.0%  |  Target FCR: 100.0%              │
│   Total Evaluator: 16 (8 QA + 8 Trainer QA)            │
│   Total Target Site: 5.920 Sesi (2.960 Sesi QA Utama)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   EVALUATOR LEVEL                      │
│   Target / QA: 370 Sesi (346 Mandatory + 24 Add.)      │
│   Target / Trainer: 370 Sesi Coaching & Review         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   CSO / AGENT LEVEL                    │
│   Populasi: 173 CSO (Database NAKER Aktual)            │
│   Alokasi per QA: 2 Tiket / CSO                        │
│   Total Sampling / CSO: 16 Sesi / Bulan                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               7 SALURAN LAYANAN MUTU QSF               │
│   Inbound (14 Param)     |  Digilive (18 Param)        │
│   Socmed (8 Param)       |  Email Inbound (15 Param)   │
│   Email Outbound (15 P.) |  Outbound Call (12 Param)   │
│   Back Office (3 Param & SLA Resolusi >= 85%)          │
└────────────────────────────────────────────────────────┘
```

---

## 3. Matriks Target Site & Evaluator (V2)

### 3.1 Ringkasan Target Site Semarang (SMG)

```text
PARAMETER SITE                NILAI STANDAR V2
────────────────────────────────────────────────────────────
Site Operasional              SEMARANG (SMG)
Target Kepatuhan CA           85.0%
Target Resolusi FCR           100.0%
Total QA Evaluator            8 Personel
Total Trainer QA              8 Personel
Total CSO / Agen              173 Agen
Target Kuota per Evaluator    370 Sesi / Bulan
Mandatory per QA              346 Sesi (173 CSO × 2)
Additional per QA             24 Sesi (Buffer Target)
Total Target QA Utama         2.960 Sesi (8 QA × 370)
Total Minimum Mandatory QA    2.768 Sesi (8 QA × 346)
Total Quota Seluruh Tim QA    5.920 Sesi (16 Evaluator × 370)
```

### 3.2 Matriks Kuota Evaluator QA (8 QA Utama)

| No | Nama QA Evaluator | Mandatory (CSO × 2) | Additional Buffer | Total Target Kuota | Status Baseline |
|---:|---|---:|---:|---:|---|
| 1 | QA.INBOUND | 346 | 24 | 370 | Target Standar |
| 2 | QA.DIGILIVE | 346 | 24 | 370 | Target Standar |
| 3 | QA.SOCMED | 346 | 24 | 370 | Target Standar |
| 4 | QA.EMAIL | 346 | 24 | 370 | Target Standar |
| 5 | QA.OUTBOUND | 346 | 24 | 370 | Target Standar |
| 6 | QA.BO_ESKALASI | 346 | 24 | 370 | Target Standar |
| 7 | IIN.SUGIARTI | 346 | 24 | 370 | Target Standar |
| 8 | TIARA.RAMADHANI | 346 | 24 | 370 | Target Standar |
| **TOTAL** | **8 QA EVALUATOR** | **2.768** | **192** | **2.960** | **100% Achieved** |

### 3.3 Matriks Kuota Trainer QA (8 Trainer Pendamping)

| No | Nama Trainer QA | Target Kuota Sesi | Fokus Layanan Pembinaan | Status Standar |
|---:|---|---:|---|---|
| 1 | ADELA SUVY AHKAM | 370 | Inbound & Quality Calibration | Active Quota |
| 2 | WIAN ANGGONO | 370 | Digilive & Chat Handling | Active Quota |
| 3 | OKTAVIA JESSICA SARI | 370 | Social Media & Public Comms | Active Quota |
| 4 | DENDY WAHYU PRADANA | 370 | Back Office & Escalation SLA | Active Quota |
| 5 | SHANIA SADHANA PUJA | 370 | Email Inbound / Outbound | Active Quota |
| 6 | CATUR WIDJAYANTI | 370 | Outbound Telephony & AHT | Active Quota |
| 7 | BAGAS ALVIAN SYAH | 370 | Parameter Defisit Roadmap ANEV | Active Quota |
| 8 | TRAINER PENDAMPING | 370 | Remedial & Coaching 1-on-1 | Active Quota |
| **TOTAL** | **8 TRAINER QA** | **2.960** | **Pendampingan Mutu Site** | **370 / Trainer** |

---

## 4. Distribusi Target CSO & Kepadatan Sampling

Setiap CSO aktif wajib dievaluasi oleh **8 QA Evaluator**, di mana masing-masing QA mengambil **2 tiket**:

$$\text{Total Sampling CSO / Bulan} = 8 \text{ QA} \times 2 \text{ Tiket} = 16 \text{ Sesi Sampling / CSO}$$

### Contoh Rekapitulasi Sampling per CSO (Sampel Aktual):

| No | NIK Agen | Nama Agen | Layanan | Target Sesi | Realisasi Sesi | Gap | Pencapaian | Status Kepatuhan Mutu |
|---:|---|---|---|---:|---:|---:|---:|---|
| 1 | AGT-001 | ERIKA.ANGGRAINI | Back Office | 16 | 16 | 0 | 100.0% | Exceed Target (CA 100%, FCR 100%) |
| 2 | AGT-002 | MUHAMMAD.ANAM | Back Office | 16 | 16 | 0 | 100.0% | Exceed Target (CA 100%, FCR 100%) |
| 3 | AGT-003 | RIZKY.FITRIANI | Email Outbound | 16 | 15 | 1 | 93.75% | Meet Target (CA 99.7%, FCR 94.7%) |
| 4 | AGT-004 | AGENT.DIGILIVE | Digilive | 16 | 16 | 0 | 100.0% | Meet Target (CA 93.3%, FCR 94.0%) |
| 5 | AGT-005 | AGENT.INBOUND | Inbound | 16 | 14 | 2 | 87.50% | Need Coaching (Defisit Input CRM) |

---

## 5. Rumus & Formula Perhitungan (V2)

### 5.1 Mandatory Sampling per QA

$$\text{Mandatory Target} = \text{Jumlah CSO Aktif} \times 2 = 173 \times 2 = 346 \text{ Tiket}$$

### 5.2 Additional Sampling per QA

$$\text{Additional Target} = \text{Target Kuota QA} - \text{Mandatory Target} = 370 - 346 = 24 \text{ Tiket}$$

### 5.3 Persentase Pencapaian Kuota Evaluator

$$\text{Achievement Kuota (\%)} = \left( \frac{\text{Actual Sesi Selesai}}{\text{Target Kuota (370)}} \right) \times 100\%$$

### 5.4 Gap Sampling

$$\text{Gap Kuota} = \text{Target Kuota} - \text{Actual Sesi Selesai}$$

### 5.5 Status Mutu Agen (Standar CA 85% & FCR 100%)

- **Exceed Target:** $\text{Rata-rata CA} \ge 96.0\%$ dan $\text{FCR} = 100.0\%$
- **Meet Target:** $85.0\% \le \text{Rata-rata CA} < 96.0\%$
- **Need Coaching:** $\text{Rata-rata CA} < 85.0\%$ atau $\text{FCR} < 100.0\%$

---

## 6. Skema Database (V2 Relational Schema)

### 6.1 Tabel `sampling_periods`

```sql
CREATE TABLE sampling_periods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    year SMALLINT UNSIGNED NOT NULL DEFAULT 2026,
    month TINYINT UNSIGNED NOT NULL, -- 1 s/d 12
    period_code VARCHAR(10) NOT NULL UNIQUE, -- Contoh: '2026-08'
    name VARCHAR(100) NOT NULL, -- Contoh: 'Agustus 2026'
    target_ca DECIMAL(5,2) NOT NULL DEFAULT 85.00,
    target_fcr DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    status ENUM('DRAFT', 'OPEN', 'RUNNING', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### 6.2 Tabel `sampling_targets`

```sql
CREATE TABLE sampling_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sampling_period_id BIGINT UNSIGNED NOT NULL,
    evaluator_name VARCHAR(150) NOT NULL,
    type ENUM('QA', 'Trainer') NOT NULL DEFAULT 'QA',
    target_total INT UNSIGNED NOT NULL DEFAULT 370,
    mandatory_per_cso INT UNSIGNED NOT NULL DEFAULT 2,
    cso_count INT UNSIGNED NOT NULL DEFAULT 173,
    mandatory_total INT UNSIGNED NOT NULL DEFAULT 346,
    additional_target INT UNSIGNED NOT NULL DEFAULT 24,
    actual_completed INT UNSIGNED NOT NULL DEFAULT 0,
    achievement_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    status ENUM('Achieved', 'On Track', 'In Progress', 'Need Boost') NOT NULL DEFAULT 'In Progress',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (sampling_period_id) REFERENCES sampling_periods(id) ON DELETE CASCADE,
    UNIQUE KEY uq_period_evaluator (sampling_period_id, evaluator_name, type)
);
```

### 6.3 Tabel `sampling_target_cso`

```sql
CREATE TABLE sampling_target_cso (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sampling_target_id BIGINT UNSIGNED NOT NULL,
    agent_id BIGINT UNSIGNED NOT NULL,
    target_sampling INT UNSIGNED NOT NULL DEFAULT 2,
    actual_sampling INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (sampling_target_id) REFERENCES sampling_targets(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE KEY uq_target_agent (sampling_target_id, agent_id)
);
```

---

## 7. Service Layer & Business Logic (`app/Services/Sampling/`)

```text
app/Services/Sampling/
├── SamplingTargetEngineService.php  # Menghitung target berjenjang (Site -> QA -> CSO)
├── QuotaValidationService.php       # Validasi kuota 370 & auto-status (Achieved/On Track/In Progress)
└── TargetSnapshotService.php        # Freeze snapshot data target per periode bulanan
```

### Method Utama `SamplingTargetEngineService.php`:
1. `generatePeriodTargets(string $periodCode)`: Mengambil 173 CSO aktif dan 16 Evaluator, lalu membuat entri 370 kuota (346 mandatory + 24 additional).
2. `recalculateEvaluatorAchievement(string $evaluatorName, string $periodCode)`: Menghitung progres aktual dari tabel `ca_assessments`.
3. `getSiteSummaryMetrics(string $periodCode)`: Mengagregasikan capaian CA (terhadap target 85%) dan FCR (terhadap target 100%).

---

## 8. RESTful API Endpoints (V2)

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/sampling/periods` | Mendapatkan daftar seluruh periode sampling |
| `POST` | `/api/sampling/periods` | Membuat periode sampling baru |
| `POST` | `/api/sampling/periods/{period}/generate-target` | Men-generate snapshot target 370 untuk seluruh QA & Trainer |
| `GET` | `/api/sampling/targets/site` | Mendapatkan KPI makro penjabaran target level site |
| `GET` | `/api/sampling/targets/evaluators` | Mendapatkan rekap target 370 & progres seluruh evaluator |
| `GET` | `/api/sampling/targets/cso` | Mendapatkan matriks alokasi 16 sampling per CSO |

---

## 9. Integrasi UI Dashboard (Modul 1, 2, 3, 4)

1. **Modul 1 (Dashboard Global):** Menampilkan pencapaian makro CA vs Target 85.0% dan FCR vs Target 100.0%.
2. **Modul 2 (Anev Ranking):** Prioritas pembinaan difokuskan pada parameter dengan persentase kepatuhan terendah terhadap bobot standar.
3. **Modul 3 (Rekap Nilai Agent):** Menampilkan skor per agent terhadap target CA 85% dan FCR 100%.
4. **Modul 4 (Pencapaian Tim QA):** Menampilkan 16 kartu status evaluator dengan kuota target 370, mandatory 346, dan additional 24.

---

## 10. Acceptance Criteria (DoD V2)

- [x] Target CA standar diset ke **85.0%**.
- [x] Target FCR standar diset ke **100.0%**.
- [x] Kuota standar evaluator diset ke **370 sesi** untuk QA dan Trainer.
- [x] Populasi 173 CSO menghasilkan tepat **346 mandatory tiket / QA**.
- [x] Buffer additional tiket per QA tepat **24 tiket**.
- [x] Total target 8 QA utama adalah **2.960 sesi**.
- [x] Total target 16 Evaluator keseluruhan site adalah **5.920 sesi**.
- [x] Perubahan target antarperiode tidak merusak snapshot histori periode sebelumnya.
- [x] API dan UI tersinkronisasi real-time.
