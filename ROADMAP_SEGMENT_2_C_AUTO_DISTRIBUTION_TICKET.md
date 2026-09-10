# ROADMAP SEGMENT 2 — C (UPDATE V2)
# AUTO DISTRIBUTION TICKET & CONTINUOUS SAMPLING ENGINE — Q-APPS 2026

> **UPDATE V2 — Disesuaikan dengan Standar Mutu Target & Sample Aktual Agustus 2026.**
> - **Target Kuota per QA:** `370 Tiket Sampling / Bulan`
> - **Populasi CSO Aktif (NAKER Plotting SMG):** `173 CSO`
> - **Mandatory Sampling:** `2 Tiket / CSO / QA` = `173 × 2 = 346 Tiket Mandatory / QA`
> - **Additional Sampling:** `370 - 346 = 24 Tiket Tambahan / QA`
> - **Kepadatan Sampling per CSO:** `8 QA × 2 = 16 Sesi Sampling / CSO / Bulan`
> - **Standar Mutu Target:** `CA 85.0%` | `FCR 100.0%`
> - **Cakupan Layanan:** 7 Saluran Resmi QSF (*Inbound, Digilive, Socmed, Email Inbound, Email Outbound, Outbound Call, Back Office*)

---

## 1. Tujuan Fitur (V2)

Fitur **Auto Distribution Ticket Engine** bertindak sebagai mesin otomatisasi pembagian tiket transaksi/sampling dari data mentah SIP/ICRM ke dalam antrean (*QA Bucket*) masing-masing dari 8 QA Evaluator.

Fitur ini menjamin:
1. **Pemerataan Proporsional:** Setiap dari 173 CSO mendapatkan tepat 2 tiket mandatory dari setiap QA ($173 \times 2 = 346$ tiket/QA).
2. **Pemenuhan Kuota Site 370:** Menyediakan 24 tiket additional buffer per QA untuk mencapai target 370.
3. **Pencegahan Tiket Ganda (*Anti-Collision*):** Memastikan 1 tiket transaksi hanya dievaluasi oleh 1 QA pada periode berjalan.
4. **Validasi Kepatuhan Mutu:** Mendukung input penilaian parameter relasional di 7 saluran layanan QSF secara real-time.

---

## 2. Alur Proses Distribusi Otomatis (V2 Flowchart)

```text
┌────────────────────────────────────────────────────────┐
│               DATABASE NAKER (PLOTTING SMG)            │
│                 173 CSO Aktif Terdaftar                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             POOL TRANSAKSI MASUK (SIP / ICRM)          │
│       Inbound, Digilive, Socmed, Email, Outbound, BO   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            ENGINE VALIDASI & ELIGIBILITY TIKET         │
│  ✓ ID Tiket Unik      ✓ NIK/Nama CSO Valid             │
│  ✓ Rentang Periode    ✓ Saluran Layanan Valid (7 QSF)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             ANTI-COLLISION & ANTI-DUPLICATE            │
│    Cek apakah tiket sudah di-assign pada periode ini   │
└───────────────────────────┬────────────────────────────┘
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     TAHAP 1: MANDATORY    │ │     TAHAP 2: ADDITIONAL   │
│  Distribusikan 2 Tiket /  │ │  Alokasikan 24 Tiket      │
│  CSO ke setiap QA         │ │  Tambahan per QA          │
│  (Total: 346 Tiket / QA)  │ │  (Total Kuota: 370)       │
└─────────────┬─────────────┘ └───────────┬───────────────┘
              └─────────────┬─────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   QA PERSONAL BUCKET                   │
│          370 Tiket Tersedia di Antrean Kerja QA        │
│   (Status: ASSIGNED -> IN_PROGRESS -> COMPLETED)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             INPUT PENILAIAN PARAMETER CA & FCR         │
│  ✓ Simpan ke ca_assessments & ca_assessment_scores     │
│  ✓ Real-time Rollup ke agents & monthly_trends         │
│  ✓ Auto-Update Pencapaian Kuota 370 Tim QA             │
└────────────────────────────────────────────────────────┘
```

---

## 3. Aturan Bisnis Distribusi Tiket (V2)

### 3.1 Alokasi Mandatory (Wajib)
- **Formula:** $\text{Jumlah CSO Aktif} \times 2 = 173 \times 2 = 346 \text{ Tiket / QA}$.
- Engine mendistribusikan tepat 2 transaksi untuk masing-masing 173 CSO ke 8 QA.
- Total mandatory sampling seluruh site: $8 \text{ QA} \times 346 = 2.768 \text{ Tiket}$.

### 3.2 Alokasi Additional (Buffer Kuota)
- **Formula:** $\text{Target Site (370)} - \text{Mandatory (346)} = 24 \text{ Tiket / QA}$.
- 24 tiket tambahan dialokasikan dari transaksi kategori khusus/layanan berbobot defisit (misal: Back Office SLA, Inbound CRM, Digilive Holding).
- Total additional sampling seluruh site: $8 \text{ QA} \times 24 = 192 \text{ Tiket}$.

### 3.3 Total Output Distribusi per QA
$$\text{Total Tiket Bucket per QA} = 346 \text{ (Mandatory)} + 24 \text{ (Additional)} = 370 \text{ Tiket}$$

$$\text{Total Tiket Terdistribusi Site} = 8 \text{ QA} \times 370 = 2.960 \text{ Tiket}$$

---

## 4. Mekanisme Anti-Collision & Validasi Tiket

### 4.1 Kriteria Kelayakan Tiket (*Eligibility Criteria*)
Tiket transaksi wajib lolos 5 kriteria sebelum dimasukkan ke pool distribusi:
1. **ID Transaksi Unik:** Memiliki Nomor Tiket / ID CA yang tidak kosong.
2. **Pemilik Tiket Valid:** NIK / Nama Agen terdaftar aktif pada Plotting NAKER.
3. **Periode Valid:** Tanggal transaksi berada dalam rentang bulan berjalan (`YYYY-MM`).
4. **Layanan Teridentifikasi:** Tergolong dalam salah satu dari 7 layanan QSF.
5. **Durasi/Kategori Transaksi:** Memenuhi batas durasi observasi wajar ($> 0$ detik).

### 4.2 Aturan Anti-Duplicate (*Anti-Collision Lock*)
- Sistem menerapkan unique constraint pada `(sampling_period_id, ticket_id)` untuk seluruh assignment aktif.
- Jika Tiket `TCK-100234` sudah diberikan ke `QA.INBOUND`, maka tiket tersebut **terkunci** dan tidak dapat diberikan ke `QA.DIGILIVE` pada periode yang sama.
- **Pengecualian Reassignment:** Tiket hanya dapat berpindah evaluator melalui proses *Reassignment Resmi Supervisor* dengan pencatatan audit log.

---

## 5. Siklus Hidup Assignment (*Lifecycle Status*)

```text
[PENDING] ──> [ASSIGNED] ──> [IN_PROGRESS] ──> [COMPLETED]
                  │               │
                  ├──> [SKIPPED]  └──> [REASSIGNED]
                  │
                  └──> [CANCELLED]
```

| Status | Keterangan Operasional |
|---|---|
| **PENDING** | Tiket berada di antrean pool dan siap dialokasikan oleh engine |
| **ASSIGNED** | Tiket sudah terdistribusi ke Bucket QA tertentu dan menunggu evaluasi |
| **IN_PROGRESS** | QA sedang membuka form assessment dan menilai parameter mutu |
| **COMPLETED** | Penilaian parameter CA & status FCR telah tersimpan secara permanen |
| **SKIPPED** | QA melewati tiket dengan alasan valid (misal: rekaman audio rusak/kosong) |
| **REASSIGNED** | Supervisor memindahkan tiket ke QA lain (kuota otomatis disesuaikan) |
| **CANCELLED** | Transaksi dibatalkan dari daftar evaluasi karena anomali data |

---

## 6. Skema Database (V2 Relational Schema)

### 6.1 Tabel `sampling_assignments`

```sql
CREATE TABLE sampling_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sampling_period_id BIGINT UNSIGNED NOT NULL,
    ticket_id VARCHAR(150) NOT NULL,
    agent_id BIGINT UNSIGNED NOT NULL,
    qa_user_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NULL,
    assignment_type ENUM('MANDATORY', 'ADDITIONAL') NOT NULL DEFAULT 'MANDATORY',
    status ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'REASSIGNED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    skip_reason VARCHAR(255) NULL,
    reassigned_from BIGINT UNSIGNED NULL,
    assessment_id BIGINT UNSIGNED NULL,
    assigned_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (sampling_period_id) REFERENCES sampling_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (qa_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES ca_assessments(id) ON DELETE SET NULL,
    INDEX idx_period_qa (sampling_period_id, qa_user_id),
    INDEX idx_period_agent (sampling_period_id, agent_id),
    UNIQUE KEY uq_period_ticket (sampling_period_id, ticket_id)
);
```

### 6.2 Tabel `sampling_reassignment_logs`

```sql
CREATE TABLE sampling_reassignment_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assignment_id BIGINT UNSIGNED NOT NULL,
    from_qa_id BIGINT UNSIGNED NOT NULL,
    to_qa_id BIGINT UNSIGNED NOT NULL,
    supervisor_id BIGINT UNSIGNED NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES sampling_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (from_qa_id) REFERENCES users(id),
    FOREIGN KEY (to_qa_id) REFERENCES users(id),
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
);
```

---

## 7. Arsitektur Service & Antrean Job (`app/Services/Sampling/`)

```text
app/Services/Sampling/
├── AutoDistributionEngineService.php  # Eksekusi distribusi 346 mandatory + 24 additional
├── TicketEligibilityFilter.php         # Validasi 5 kriteria kelayakan transaksi
├── AntiCollisionValidator.php         # Pengecekan duplikasi tiket aktif
└── SamplingWorkflowService.php        # Transisi status (Start, Complete, Skip, Reassign)
```

### Laravel Queue Jobs & CLI Command:
- **`app/Jobs/DistributeMandatorySamplingJob.php`**: Memproses pembagian $173 \times 2$ secara batch asinkron agar tidak membebani memori server.
- **`app/Jobs/DistributeAdditionalSamplingJob.php`**: Mengisi sisa 24 tiket buffer ke setiap bucket QA.
- **`app/Jobs/SyncSamplingProgressJob.php`**: Mengupdate tabel `evaluator_samplings` secara real-time.

```bash
# Perintah CLI untuk mengeksekusi auto distribution
php artisan sampling:distribute 2026-08
```

---

## 8. RESTful API Endpoints (V2)

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/sampling/periods/{period}/distribute` | Menjalankan auto distribution untuk seluruh 8 QA |
| `GET` | `/api/sampling/bucket/my-tickets` | Mengambil daftar 370 tiket kerja di bucket QA yang login |
| `POST` | `/api/sampling/assignments/{id}/start` | Mengubah status tiket menjadi `IN_PROGRESS` |
| `POST` | `/api/sampling/assignments/{id}/complete` | Menyimpan penilaian dan mengubah status menjadi `COMPLETED` |
| `POST` | `/api/sampling/assignments/{id}/skip` | Melewati tiket dengan alasan skip (*Skip Reason*) |
| `POST` | `/api/sampling/assignments/{id}/reassign` | Memindahkan tiket ke QA lain (Akses Supervisor) |

---

## 9. Antarmuka QA Bucket & Monitoring (UI V2)

### 9.1 Hero Metric Antrean QA
```text
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  TARGET KUOTA   │ MANDATORY (CSO) │   ADDITIONAL    │    REALISASI    │
│    370 Sesi     │    346 Sesi     │     24 Sesi     │    350 Selesai  │
│  (Target Site)  │  (173 Agen × 2) │ (Buffer Kuota)  │ (94.6% Capaian) │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### 9.2 Tabel Kerja Antrean Sampling (*QA Workspace Table*)
| No | ID Tiket / CA | Nama Agen CSO | Saluran Layanan | Tipe Alokasi | Status Pengerjaan | Aksi Form |
|---:|---|---|---|---|---|---|
| 1 | `CA_INB-20260801` | AGENT.INBOUND | Inbound Call | Mandatory (1/2) | `ASSIGNED` | [Mulai Nilai] |
| 2 | `CA_DIG-20260802` | AGENT.DIGILIVE | Digilive Chat | Mandatory (2/2) | `COMPLETED` | [Lihat Hasil] |
| 3 | `CA_BOC-20260803` | ERIKA.ANGGRAINI | Back Office | Additional | `IN_PROGRESS` | [Lanjutkan] |

---

## 10. Acceptance Criteria (DoD V2)

- [x] Engine berhasil memproses 173 CSO aktif dari plotting NAKER.
- [x] Setiap QA menerima tepat **346 tiket mandatory** ($173 \times 2$).
- [x] Setiap QA menerima tepat **24 tiket additional** untuk melengkapi target 370.
- [x] Total tiket yang terdistribusi ke 8 QA tepat **2.960 tiket**.
- [x] Mekanisme anti-collision menolak tiket ganda pada periode yang sama.
- [x] Form penilaian menyimpan skor parameter secara relasional sesuai bobot layanan.
- [x] FCR Back Office otomatis tervalidasi berbasis resolusi SLA $\ge 85\%$.
- [x] Status kuota di Modul 4 (*Pencapaian Tim QA*) tersinkronisasi otomatis saat tiket diselesaikan.
