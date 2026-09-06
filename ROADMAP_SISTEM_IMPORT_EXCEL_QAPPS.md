# ROADMAP SISTEM IMPORT EXCEL Q-APPS
## Panduan Sistem Import QSF + Upload Database NAKER + Mapping Database

> **Tujuan dokumen:** menjadi blueprint implementasi fitur import Excel pada Q-APPS, termasuk pemilihan jenis Excel yang boleh di-import, upload database NAKER oleh Supervisor, validasi, mapping ke master database, penyimpanan assessment QSF, serta migration Laravel 12.

---

# 1. Konsep Utama Sistem

Sistem dibagi menjadi 2 jenis import utama:

```text
1. IMPORT NAKER
   Database tenaga kerja / agent / QA / TL / trainer

2. IMPORT QSF
   Hasil Quality Assurance / FCR / CA dari SIP
```

Supervisor menjadi role yang mempunyai akses untuk:

```text
Supervisor
   │
   ├── Upload NAKER
   │
   ├── Import QSF
   │     ├── Inbound
   │     ├── Digilive
   │     ├── Socmed
   │     ├── Email Inbound
   │     ├── Email Outbound
   │     ├── Outbound Call
   │     └── Back Office / Ketepatan Eskalasi BO
   │
   └── Melihat hasil import + error
```

**Prinsip penting:** user tidak bebas memilih tabel database tujuan secara manual. User memilih **Import Type** yang sudah ditentukan sistem. Setiap Import Type mempunyai mapping, aturan validasi, dan target tabel sendiri.

---

# 2. Hasil Audit File Contoh

## 2.1 Database NAKER

File:

```text
DATABASED ALL NAKER AGUSTUS 2026.xlsx
```

Sheet:

```text
PLOTTING
```

Kolom:

| No | Kolom |
|---:|---|
| 1 | NO |
| 2 | NAMA |
| 3 | JK |
| 4 | LAYANAN |
| 5 | TEAM TL |
| 6 | TRAINER |
| 7 | SITE |
| 8 | ID SIP |

Hasil audit:

```text
181 data tenaga kerja
181 nama unik
181 ID SIP unik
8 nilai LAYANAN
11 Team TL
6 Trainer
2 JK
```

Untuk 173 data CSO, Site berisi `SMG`.

8 baris `NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE` tidak mempunyai Team TL, Trainer, dan Site pada source.

**Jangan mengisi data kosong tersebut secara otomatis.**

---

# 3. Layanan pada NAKER

Nilai `LAYANAN` yang ditemukan:

```text
CSO DIGILIVE CHAT - MY ICON+
CSO DIGILIVE CHAT - WA
CSO INBOUND
CSO DIGILIVE CHAT - SOCIAL MEDIA
CSO OUTBOUND
CSO BACK OFFICE
CSO EMAIL
NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE
```

Ini adalah **source service label NAKER**.

Jangan langsung menggunakannya sebagai nama service QSF karena QSF mempunyai istilah sendiri.

Contoh:

```text
NAKER:
CSO DIGILIVE CHAT - MY ICON+

QSF:
Digilive
```

Maka diperlukan mapping.

---

# 4. QSF Excel yang Menjadi Target Import

File contoh yang disediakan:

```text
Report CA FCR Detail QSF - Email Inbound.xls
Report CA FCR Detail QSF - Socmed (1).xls
Report CA FCR Detail QSF - Digilive (1).xls
Report CA FCR Detail QSF - Inbound (1).xls
Report CA FCR Detail QSF - Ketepatan Eskalasi BO.xls
Report CA FCR Detail QSF - Email Outbound (1).xls
Report CA FCR Detail QSF - Outbound Call.xls
```

### Catatan file source

File `.xls` yang di-upload pada percakapan ini berbentuk **Excel HTML Frameset** dan worksheet detailnya tidak ikut tersedia sebagai file terpisah pada attachment runtime.

Artinya:

- nama file dapat dijadikan kandidat `Import Type`;
- struktur QSF yang sudah teridentifikasi dari report QSF sebelumnya dapat digunakan sebagai baseline;
- tetapi kolom detail untuk `Email Inbound` dan `Outbound Call` **harus dikonfirmasi dari worksheet aktual sebelum mapping production dikunci**;
- sistem harus memakai `Import Profile` agar mapping tidak hard-coded dan dapat diperbarui ketika format SIP berubah.

---

# 5. Desain UX Import

## 5.1 Halaman

Buat halaman:

```text
Import Data
```

Layout:

```text
┌─────────────────────────────────────────────────────────┐
│ Import Data                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Jenis Import                                            │
│ [ Pilih Jenis Import ▼ ]                                │
│                                                         │
│ File Excel                                              │
│ [ Drag & Drop Excel ] [ Browse ]                       │
│                                                         │
│ Format yang didukung: .xls / .xlsx                     │
│                                                         │
│ [ Download Template ]        [ Validasi File ]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Dropdown:

```text
NAKER
QSF - Inbound
QSF - Digilive
QSF - Socmed
QSF - Email Inbound
QSF - Email Outbound
QSF - Outbound Call
QSF - Back Office
```

Supervisor **tidak perlu memilih tabel database**.

---

# 6. Import NAKER oleh Supervisor

## 6.1 UI

```text
Import Data
     ↓
Jenis Import
     ↓
[ DATABASE NAKER ]
     ↓
Upload Excel
     ↓
Preview
     ↓
Validasi
     ↓
Import
```

Contoh:

```text
┌────────────────────────────────────────────────────────┐
│ Import Database NAKER                                   │
├────────────────────────────────────────────────────────┤
│ File: DATABASED ALL NAKER AGUSTUS 2026.xlsx            │
│                                                        │
│ Sheet: PLOTTING                                        │
│                                                        │
│ Total Row        : 181                                 │
│ Valid            : 179                                 │
│ Warning          : 2                                   │
│ Error            : 0                                   │
│                                                        │
│ [ Lihat Preview ]    [ Import NAKER ]                  │
└────────────────────────────────────────────────────────┘
```

---

# 7. Aturan Import NAKER

## Required

```text
NAMA
JK
LAYANAN
ID SIP
```

## Optional

```text
TEAM TL
TRAINER
SITE
```

`NO` bukan identifier database.

---

# 8. Mapping NAKER ke Database

| Excel NAKER | Database | Field |
|---|---|---|
| NO | - | tidak disimpan sebagai PK |
| NAMA | employees | name |
| JK | employees | gender |
| LAYANAN | services / service_mappings | source_service |
| TEAM TL | employees | melalui assignment |
| TRAINER | employees | melalui assignment |
| SITE | sites | site_id |
| ID SIP | employees | sip_id |

---

# 9. Jangan Simpan TL dan Trainer Langsung pada Agent

Jangan:

```text
employees
------------------
id
name
team_tl
trainer
```

Karena assignment dapat berubah.

Gunakan:

```text
employees
     │
     ▼
employee_assignments
     │
     ├── service
     ├── team leader
     ├── trainer
     ├── site
     ├── start_date
     └── end_date
```

Contoh:

```text
Agent A
2026-08-01 → 2026-08-31 → TL A
2026-09-01 → NULL       → TL B
```

History tetap aman.

---

# 10. Struktur Master NAKER

## 10.1 employees

```sql
CREATE TABLE employees (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    sip_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,

    gender ENUM('PRIA','WANITA') NULL,

    status ENUM(
        'active',
        'inactive'
    ) DEFAULT 'active',

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

`ID SIP` menjadi unique business key untuk NAKER.

---

# 11. Users / Login

NAKER **tidak otomatis berarti account login**.

Pisahkan:

```text
employees
```

dengan:

```text
users
```

Contoh:

```text
Employee:
AFIFUDIN NURCAHYO

Belum tentu mempunyai:
User Account
```

Jika Supervisor ingin memberikan akses login:

```text
employees
     │
     ▼
users
     │
     ▼
roles
```

---

# 12. Roles

```sql
CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

Role aplikasi dapat mencakup:

```text
SUPERADMIN
SUPERVISOR
QA
TRAINER
AGENT
MM
```

Role final mengikuti authorization FRD.

---

# 13. Users

```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employee_id BIGINT UNSIGNED NULL,
    role_id BIGINT UNSIGNED NOT NULL,

    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NULL UNIQUE,
    password VARCHAR(255) NOT NULL,

    status ENUM(
        'active',
        'inactive'
    ) DEFAULT 'active',

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (employee_id)
        REFERENCES employees(id),

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
);
```

---

# 14. Services

```sql
CREATE TABLE services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

Canonical service:

```text
INBOUND
DIGILIVE
SOCMED
EMAIL_INBOUND
EMAIL_OUTBOUND
OUTBOUND_CALL
BACK_OFFICE
```

---

# 15. Mapping NAKER Service ke QSF Service

Karena source menggunakan istilah berbeda, buat:

```sql
CREATE TABLE service_mappings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    source_system VARCHAR(50) NOT NULL,
    source_value VARCHAR(150) NOT NULL,

    service_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    UNIQUE KEY uq_service_mapping(
        source_system,
        source_value
    )
);
```

Contoh:

```text
NAKER:
CSO DIGILIVE CHAT - MY ICON+
        ↓
DIGILIVE

NAKER:
CSO DIGILIVE CHAT - WA
        ↓
DIGILIVE

NAKER:
CSO DIGILIVE CHAT - SOCIAL MEDIA
        ↓
SOCMED

NAKER:
CSO INBOUND
        ↓
INBOUND

NAKER:
CSO EMAIL
        ↓
EMAIL_INBOUND / EMAIL_OUTBOUND
```

**Pemetaan `CSO EMAIL` harus ditentukan dari source QSF**, karena satu label NAKER belum cukup untuk membedakan Email Inbound dan Email Outbound.

---

# 16. Sites

```sql
CREATE TABLE sites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

Sample:

```text
SMG → SEMARANG
```

---

# 17. Employee Assignments

```sql
CREATE TABLE employee_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employee_id BIGINT UNSIGNED NOT NULL,

    service_id BIGINT UNSIGNED NULL,
    site_id BIGINT UNSIGNED NULL,

    team_leader_id BIGINT UNSIGNED NULL,
    trainer_id BIGINT UNSIGNED NULL,

    start_date DATE NOT NULL,
    end_date DATE NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (employee_id)
        REFERENCES employees(id),

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    FOREIGN KEY (site_id)
        REFERENCES sites(id),

    FOREIGN KEY (team_leader_id)
        REFERENCES employees(id),

    FOREIGN KEY (trainer_id)
        REFERENCES employees(id)
);
```

---

# 18. Category

```sql
CREATE TABLE categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    service_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(100) NOT NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    UNIQUE KEY uq_category_service(
        service_id,
        name
    )
);
```

---

# 19. Sub Category

```sql
CREATE TABLE sub_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    category_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (category_id)
        REFERENCES categories(id),

    UNIQUE KEY uq_subcategory_category(
        category_id,
        name
    )
);
```

---

# 20. Platform

```sql
CREATE TABLE platforms (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    service_id BIGINT UNSIGNED NULL,

    name VARCHAR(100) NOT NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
);
```

Contoh source QSF yang sudah diketahui:

```text
LIVE CHAT MYICON+
WHATSAPP
DM INSTAGRAM
RATING MY ICON+
```

---

# 21. CA Parameters

Jangan membuat kolom:

```text
attribute_1
attribute_2
...
attribute_18
```

Gunakan:

```sql
CREATE TABLE ca_parameters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    service_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NULL,

    sequence INT NOT NULL,
    weight DECIMAL(10,4) NULL,

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    UNIQUE KEY uq_parameter_service_code(
        service_id,
        code
    )
);
```

---

# 22. Parameter dari QSF yang Sudah Teridentifikasi

## Inbound

```text
1
2
3
4
5
6
7
8
9
10
11
12
13
14
```

## Digilive

```text
1.1
2.1
2.2
2.3
3.1
4.1
5.1
5.2
5.3
6.1
6.2
7.1
8.1
8.2
9.1
9.2
10.1
10.2
```

## Socmed

```text
A.1
A.2
B.1
B.2
B.3
B.4
C.1
C.2
```

## Email Outbound

```text
A1
B1
B2
C3
C4
C5
D6
D7
D8
D9
D10
E11
E12
E13
E14
```

## Back Office

```text
1
2
3
```

### Email Inbound dan Outbound Call

Parameter **belum dikunci** karena worksheet detail pada file upload saat ini tidak tersedia di attachment runtime.

Sistem harus mendukung penambahan parameter melalui:

```text
Master CA Parameter
```

tanpa migration baru.

---

# 23. Assessment

```sql
CREATE TABLE ca_assessments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    idca VARCHAR(120) NOT NULL UNIQUE,
    ticket_id VARCHAR(100) NULL,

    service_id BIGINT UNSIGNED NOT NULL,
    site_id BIGINT UNSIGNED NULL,

    category_id BIGINT UNSIGNED NULL,
    sub_category_id BIGINT UNSIGNED NULL,
    platform_id BIGINT UNSIGNED NULL,

    employee_id BIGINT UNSIGNED NOT NULL,
    qa_user_id BIGINT UNSIGNED NOT NULL,

    customer_name VARCHAR(255) NULL,

    transaction_at DATETIME NULL,
    measurement_at DATETIME NULL,

    transaction_duration_seconds INT NULL,
    sampling_duration_seconds INT NULL,

    fcr ENUM('YA','TIDAK') NULL,
    fcr_note TEXT NULL,

    score_ca DECIMAL(8,2) NULL,

    summary TEXT NULL,
    recommendation VARCHAR(255) NULL,
    recommendation_note TEXT NULL,

    ever_changed BOOLEAN DEFAULT FALSE,

    source_system VARCHAR(50) DEFAULT 'SIP',
    source_file VARCHAR(255) NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    FOREIGN KEY (site_id)
        REFERENCES sites(id),

    FOREIGN KEY (category_id)
        REFERENCES categories(id),

    FOREIGN KEY (sub_category_id)
        REFERENCES sub_categories(id),

    FOREIGN KEY (platform_id)
        REFERENCES platforms(id),

    FOREIGN KEY (employee_id)
        REFERENCES employees(id),

    FOREIGN KEY (qa_user_id)
        REFERENCES users(id),

    INDEX idx_assessment_service(service_id),
    INDEX idx_assessment_employee(employee_id),
    INDEX idx_assessment_qa(qa_user_id),
    INDEX idx_assessment_measurement(measurement_at)
);
```

---

# 24. Assessment Parameter Scores

```sql
CREATE TABLE ca_assessment_scores (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessment_id BIGINT UNSIGNED NOT NULL,
    parameter_id BIGINT UNSIGNED NOT NULL,

    score DECIMAL(10,2) NULL,
    note TEXT NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (assessment_id)
        REFERENCES ca_assessments(id)
        ON DELETE CASCADE,

    FOREIGN KEY (parameter_id)
        REFERENCES ca_parameters(id),

    UNIQUE KEY uq_assessment_parameter(
        assessment_id,
        parameter_id
    )
);
```

---

# 25. Import Profile

Ini adalah bagian paling penting agar sistem dapat menerima **Excel yang formatnya sudah ditentukan**.

```sql
CREATE TABLE import_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,

    import_type ENUM(
        'NAKER',
        'QSF'
    ) NOT NULL,

    service_id BIGINT UNSIGNED NULL,

    expected_extension VARCHAR(20) DEFAULT 'xls,xlsx',

    sheet_name VARCHAR(100) NULL,
    header_row INT DEFAULT 1,
    data_start_row INT DEFAULT 2,

    version VARCHAR(20) DEFAULT '1.0',

    status BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (service_id)
        REFERENCES services(id)
);
```

---

# 26. Import Profile Mapping

```sql
CREATE TABLE import_profile_mappings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    import_profile_id BIGINT UNSIGNED NOT NULL,

    source_column VARCHAR(150) NOT NULL,
    target_field VARCHAR(150) NULL,

    mapping_type ENUM(
        'FIELD',
        'LOOKUP',
        'PARAMETER',
        'IGNORE'
    ) NOT NULL,

    data_type VARCHAR(50) NULL,

    required BOOLEAN DEFAULT FALSE,

    lookup_table VARCHAR(100) NULL,
    lookup_column VARCHAR(100) NULL,

    transform_rule VARCHAR(255) NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (import_profile_id)
        REFERENCES import_profiles(id)
        ON DELETE CASCADE
);
```

---

# 27. Kenapa Import Profile Dibutuhkan?

Tanpa profile:

```text
Controller
   ↓
if file == inbound
if file == digilive
if file == socmed
...
```

Akan cepat menjadi sulit dipelihara.

Dengan profile:

```text
Import Type
     ↓
Import Profile
     ↓
Mapping
     ↓
Validator
     ↓
Processor
```

Jika SIP mengubah kolom:

```text
Ket FCR
```

menjadi:

```text
Keterangan FCR
```

cukup update mapping/profile.

---

# 28. Contoh Import Profile

## NAKER

```text
Code:
NAKER_AUGUST_2026

Type:
NAKER

Sheet:
PLOTTING

Header:
1

Start Data:
2
```

Mapping:

```text
NAMA       → employees.name
JK         → employees.gender
ID SIP     → employees.sip_id
LAYANAN    → employee_assignments.service_id
SITE       → employee_assignments.site_id
TEAM TL    → employee_assignments.team_leader_id
TRAINER    → employee_assignments.trainer_id
```

`NO`:

```text
IGNORE
```

---

# 29. Contoh Profile QSF Inbound

```text
Code:
QSF_INBOUND_V1

Type:
QSF

Service:
INBOUND
```

Mapping baseline:

```text
No                 → IGNORE
Site               → site_id
IDCA               → idca
ID Tiket           → ticket_id
CA                 → service/source mapping
Layanan            → source label
Kategori           → category_id
Sub Kategori       → sub_category_id
Pelanggan          → customer_name
Agent              → employee_id
Tgl Transaksi      → transaction_at
Durasi Transaksi   → transaction_duration_seconds
Durasi Sampling    → sampling_duration_seconds
QA                 → qa_user_id
Tgl Ukur           → measurement_at
FCR                → fcr
Ket FCR            → fcr_note
1                  → parameter
2                  → parameter
...
14                 → parameter
Score CA           → score_ca
Ket Summary        → summary
Rekomendasi        → recommendation
Ket Rekomendasi    → recommendation_note
Pernah Diubah      → ever_changed
```

---

# 30. Dynamic Parameter Import

Untuk kolom:

```text
1
2
3
...
14
```

jangan langsung:

```text
ca_assessments.parameter_1
```

Processor melakukan:

```text
Excel Column
     ↓
Cari ca_parameter
     ↓
Ambil parameter_id
     ↓
Insert ca_assessment_scores
```

Contoh:

```text
Excel:
Parameter 1 = 2.00

Database:
assessment_id = 100
parameter_id = 1
score = 2.00
```

---

# 31. Import Batch

```sql
CREATE TABLE import_batches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    import_profile_id BIGINT UNSIGNED NOT NULL,

    uploaded_by BIGINT UNSIGNED NOT NULL,

    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NULL,

    total_rows INT DEFAULT 0,
    success_rows INT DEFAULT 0,
    warning_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,

    status ENUM(
        'uploaded',
        'validating',
        'validated',
        'processing',
        'completed',
        'failed',
        'cancelled'
    ) DEFAULT 'uploaded',

    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (import_profile_id)
        REFERENCES import_profiles(id),

    FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
);
```

---

# 32. Import Rows

```sql
CREATE TABLE import_rows (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    import_batch_id BIGINT UNSIGNED NOT NULL,

    row_number INT NOT NULL,

    raw_data JSON NOT NULL,

    status ENUM(
        'pending',
        'valid',
        'warning',
        'failed',
        'processed',
        'duplicate'
    ) DEFAULT 'pending',

    error_message TEXT NULL,
    warning_message TEXT NULL,

    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    FOREIGN KEY (import_batch_id)
        REFERENCES import_batches(id)
        ON DELETE CASCADE
);
```

---

# 33. Workflow Import Lengkap

```text
                    SUPERVISOR
                        │
                        ▼
                  IMPORT DATA
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
         NAKER                     QSF
            │                       │
            │              Pilih Service/Profile
            │                       │
            └───────────┬───────────┘
                        ▼
                   UPLOAD FILE
                        │
                        ▼
                 FILE VALIDATION
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
            VALID                ERROR
              │                   │
              ▼                   ▼
          PREVIEW             ERROR REPORT
              │
              ▼
        DATA VALIDATION
              │
      ┌───────┼──────────┐
      ▼       ▼          ▼
    Master  Duplicate  Format
      │       │          │
      └───────┼──────────┘
              ▼
             PASS
              │
              ▼
           IMPORT JOB
              │
              ▼
          TRANSACTION
              │
       ┌──────┴──────┐
       ▼             ▼
   Assessment      Score
       │             │
       └──────┬──────┘
              ▼
          COMPLETED
```

---

# 34. Validation NAKER

## Duplicate ID SIP

```sql
SELECT id
FROM employees
WHERE sip_id = ?;
```

Jika sudah ada:

```text
WARNING:
Employee sudah terdaftar.
```

Kemudian sistem menawarkan:

```text
[ Skip ]
[ Update ]
```

Untuk production, default lebih aman:

```text
UPDATE jika user memilih update
```

bukan overwrite otomatis.

---

# 35. Validation QSF

Setiap row minimal dicek:

```text
IDCA tidak kosong
IDCA belum duplicate
Agent ditemukan
QA ditemukan
Service ditemukan
Category valid
Sub Category valid
Platform valid jika diperlukan
FCR valid
Tanggal valid
Durasi valid
Score CA numeric
Parameter valid
```

---

# 36. Status Validation

Gunakan 4 kondisi:

```text
VALID
WARNING
ERROR
DUPLICATE
```

Contoh:

```text
VALID
Agent ditemukan.

WARNING
Ket Rekomendasi memiliki capitalization berbeda.

ERROR
IDCA kosong.

DUPLICATE
IDCA sudah terdapat di database.
```

---

# 37. Preview Sebelum Import

Setelah upload:

```text
┌────────────────────────────────────────────────────────────┐
│ Preview Import                                             │
├────────────────────────────────────────────────────────────┤
│ Profile : QSF - Digilive V1                               │
│ File    : Report CA FCR Detail QSF - Digilive.xls         │
│ Rows    : 189                                              │
├────────┬───────────────────┬────────────┬─────────────────┤
│ Row    │ IDCA              │ Agent      │ Status          │
├────────┼───────────────────┼────────────┼─────────────────┤
│ 2      │ CA_DIGL-xxxx      │ AGENT A    │ VALID           │
│ 3      │ CA_DIGL-yyyy      │ AGENT B    │ VALID           │
│ 4      │ CA_DIGL-zzzz      │ AGENT C    │ WARNING         │
└────────┴───────────────────┴────────────┴─────────────────┘

[ Batalkan ]                       [ Import Data ]
```

---

# 38. Error Report

Setelah validasi:

```text
Import Summary

Total Row     : 189
Valid         : 185
Warning       : 2
Duplicate     : 1
Error         : 1
```

User dapat:

```text
[ Download Error Excel ]
```

Error Excel:

```text
ROW
IDCA
ERROR
FIELD
VALUE
```

---

# 39. Transaction Safety

Import harus menggunakan database transaction.

```text
BEGIN TRANSACTION

Import batch
   ↓
Validate
   ↓
Master lookup
   ↓
Insert assessment
   ↓
Insert scores

COMMIT
```

Jika terjadi error fatal:

```text
ROLLBACK
```

Jangan sampai:

```text
100 row masuk
50 row gagal
database setengah terisi
```

tanpa status yang jelas.

---

# 40. Large File Processing

Jangan proses Excel besar langsung pada HTTP request.

Gunakan Laravel Job:

```text
Upload
   ↓
Save file
   ↓
Create import_batch
   ↓
Queue Job
   ↓
Process Excel
   ↓
Update progress
```

Job:

```text
ProcessImportBatchJob
```

Jika file besar:

```text
chunk 500 row
```

atau sesuai benchmark server.

---

# 41. Progress UI

Supervisor melihat:

```text
Import sedang diproses...

[██████████████░░░░░░] 70%

Processed : 700 / 1000
Success   : 680
Warning   : 15
Error     : 5
```

Status:

```text
UPLOADED
VALIDATING
PROCESSING
COMPLETED
FAILED
```

---

# 42. Permission Supervisor

Supervisor boleh:

```text
Upload NAKER
Import QSF
Melihat preview
Melihat error
Download error report
Melihat history import
Melihat hasil assessment
```

Supervisor tidak boleh secara default:

```text
Mengubah migration
Mengubah struktur database
Menghapus assessment secara permanen
Mengubah role SUPERADMIN
```

---

# 43. Import History

Buat halaman:

```text
Import History
```

Kolom:

```text
Tanggal
User
Import Type
File
Total
Success
Warning
Error
Status
Action
```

Contoh:

```text
03 Sep 2026
SUPERVISOR
QSF - Digilive
Report...xls
189
185
2
2
COMPLETED
```

---

# 44. Audit Import

Tambahkan:

```sql
CREATE TABLE import_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    import_batch_id BIGINT UNSIGNED NOT NULL,

    action VARCHAR(100) NOT NULL,
    description TEXT NULL,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (import_batch_id)
        REFERENCES import_batches(id)
        ON DELETE CASCADE,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
);
```

Contoh action:

```text
UPLOAD
VALIDATE
IMPORT_STARTED
IMPORT_COMPLETED
IMPORT_FAILED
CANCELLED
```

---

# 45. Mapping Database Final

```text
AUTH
├── roles
└── users

NAKER MASTER
├── employees
├── sites
├── services
├── service_mappings
└── employee_assignments

QSF MASTER
├── categories
├── sub_categories
├── platforms
└── ca_parameters

QSF TRANSACTION
├── ca_assessments
└── ca_assessment_scores

IMPORT ENGINE
├── import_profiles
├── import_profile_mappings
├── import_batches
├── import_rows
└── import_logs
```

---

# 46. Tabel yang WAJIB di-Migrate

Urutan migration:

```text
1. roles
2. employees
3. sites
4. services
5. users
6. service_mappings
7. employee_assignments
8. categories
9. sub_categories
10. platforms
11. ca_parameters
12. import_profiles
13. import_profile_mappings
14. ca_assessments
15. ca_assessment_scores
16. import_batches
17. import_rows
18. import_logs
```

---

# 47. Urutan Laravel Migration

```text
database/migrations/

01_create_roles_table.php
02_create_employees_table.php
03_create_sites_table.php
04_create_services_table.php
05_create_users_table.php

06_create_service_mappings_table.php
07_create_employee_assignments_table.php

08_create_categories_table.php
09_create_sub_categories_table.php
10_create_platforms_table.php
11_create_ca_parameters_table.php

12_create_import_profiles_table.php
13_create_import_profile_mappings_table.php

14_create_ca_assessments_table.php
15_create_ca_assessment_scores_table.php

16_create_import_batches_table.php
17_create_import_rows_table.php
18_create_import_logs_table.php
```

---

# 48. Seed Data Awal

## Roles

```text
SUPERADMIN
SUPERVISOR
QA
TRAINER
AGENT
MM
```

## Site

```text
SMG
SEMARANG
```

## Service

```text
INBOUND
DIGILIVE
SOCMED
EMAIL_INBOUND
EMAIL_OUTBOUND
OUTBOUND_CALL
BACK_OFFICE
```

---

# 49. Import NAKER Pertama

Urutan implementasi:

```text
1. Supervisor login
2. Buka Import Data
3. Pilih DATABASE NAKER
4. Upload DATABASED ALL NAKER AGUSTUS 2026.xlsx
5. Sistem membaca PLOTTING
6. Validasi 181 row
7. Cari ID SIP
8. Insert/update employees
9. Mapping LAYANAN
10. Mapping SITE
11. Mapping TEAM TL
12. Mapping TRAINER
13. Simpan employee_assignments
14. Tampilkan summary
```

Target:

```text
181 employees
```

Namun proses production tetap harus mengikuti hasil validasi aktual.

---

# 50. Import QSF Setelah NAKER

Urutan wajib:

```text
NAKER
  ↓
employees tersedia
  ↓
QSF Import
  ↓
Cari Agent berdasarkan ID SIP
  ↓
Cari QA berdasarkan user/employee
  ↓
Cari service
  ↓
Cari category
  ↓
Cari sub category
  ↓
Cari platform
  ↓
Cari parameter
  ↓
Insert assessment
```

**NAKER sebaiknya di-import terlebih dahulu sebelum QSF**, karena QSF membutuhkan Agent dan QA sebagai referensi master.

---

# 51. Matching Agent

Gunakan prioritas:

```text
1. ID SIP
2. Exact normalized ID
3. Manual mapping jika diperlukan
```

Jangan mengandalkan nama saja.

Contoh:

```text
Excel QSF:
LUTFIANA.LISHABIBAH

NAKER:
LUTFIANA.LISHABIBAH
```

langsung match melalui:

```text
employees.sip_id
```

---

# 52. Matching QA

QA pada source QSF dapat berupa:

```text
ALMIRA.PARAMITHA
DHITA.KHARISMA
IIN.SUGIARTI
FINA.ANDRIYANI
DIAN.WIBOWO
DEWI.IRAWATI
TIARA.RAMADHANI
HANI.SURYO
```

Pada NAKER, beberapa QA berada pada:

```text
NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE
```

Karena data NAKER menggunakan `ID SIP`, gunakan `ID SIP` sebagai key.

Jika QA belum mempunyai user account:

```text
employees ada
users belum ada
```

Supervisor/Superadmin dapat membuat account kemudian.

---

# 53. Normalisasi Data

Sebelum lookup:

```text
TRIM
```

Contoh:

```text
" AFIFUDIN.NURCAHYO "
       ↓
"AFIFUDIN.NURCAHYO"
```

Untuk data tertentu:

```text
lowercase / uppercase
```

boleh digunakan hanya pada proses matching.

**Raw value tetap disimpan pada `import_rows.raw_data`.**

---

# 54. Data yang Tidak Boleh Hilang

Raw Excel harus tetap dapat ditelusuri.

Simpan:

```text
original_filename
import_batch_id
row_number
raw_data
```

Sehingga:

```text
Assessment ID
     ↓
Import Batch
     ↓
File Excel
     ↓
Row
     ↓
Raw Data
```

---

# 55. Dashboard Setelah Import

Setelah transaction masuk, dashboard dapat menghitung:

```text
Total Assessment
Average CA
FCR Rate
CA per Service
CA per Agent
FCR per Service
FCR per Agent
Top Agent
Bottom Agent
Parameter terendah
Produktivitas QA
```

Tidak perlu membuat tabel dashboard khusus.

Gunakan query/view/materialized summary hanya jika performa sudah membutuhkan.

---

# 56. Roadmap Development

## PHASE 1 — Foundation

```text
Laravel 12
MySQL
Authentication
Role & Permission
```

Migration:

```text
roles
employees
users
sites
```

---

## PHASE 2 — NAKER Master

```text
services
service_mappings
employee_assignments
```

Buat:

```text
Supervisor → Import NAKER
```

Target:

```text
181 row sample
```

---

## PHASE 3 — QSF Master

```text
categories
sub_categories
platforms
ca_parameters
```

---

## PHASE 4 — Import Profile

```text
import_profiles
import_profile_mappings
```

Buat profile:

```text
NAKER
QSF_INBOUND
QSF_DIGILIVE
QSF_SOCMED
QSF_EMAIL_INBOUND
QSF_EMAIL_OUTBOUND
QSF_OUTBOUND_CALL
QSF_BACK_OFFICE
```

Untuk profile yang worksheet aktualnya belum tersedia, status:

```text
DRAFT
```

sampai sample detail dikonfirmasi.

---

## PHASE 5 — QSF Transaction

```text
ca_assessments
ca_assessment_scores
```

---

## PHASE 6 — Import Engine

```text
upload
preview
validation
queue
transaction
error report
history
```

---

## PHASE 7 — Dashboard

```text
Global
Service
Agent
QA
FCR
CA
Trend
```

---

## PHASE 8 — ANEV

```text
Top 5
Bottom 5
Parameter issue
Feedback
Recommendation
```

---

# 57. Struktur Backend Laravel

```text
app/
├── Models/
│   ├── Employee.php
│   ├── User.php
│   ├── Role.php
│   ├── Service.php
│   ├── ServiceMapping.php
│   ├── EmployeeAssignment.php
│   ├── Category.php
│   ├── SubCategory.php
│   ├── Platform.php
│   ├── CaParameter.php
│   ├── CaAssessment.php
│   ├── CaAssessmentScore.php
│   ├── ImportProfile.php
│   ├── ImportProfileMapping.php
│   ├── ImportBatch.php
│   ├── ImportRow.php
│   └── ImportLog.php
│
├── Services/
│   ├── Import/
│   │   ├── ExcelImportService.php
│   │   ├── NakerImportService.php
│   │   ├── QsfImportService.php
│   │   ├── ImportValidationService.php
│   │   └── ImportMappingService.php
│   │
│   └── Assessment/
│       └── AssessmentService.php
│
├── Jobs/
│   └── ProcessImportBatchJob.php
│
└── Http/
    └── Controllers/
        ├── ImportController.php
        ├── ImportHistoryController.php
        └── DashboardController.php
```

---

# 58. Struktur Frontend Vue

```text
src/
├── pages/
│   ├── ImportPage.vue
│   ├── ImportPreviewPage.vue
│   ├── ImportHistoryPage.vue
│   └── ImportDetailPage.vue
│
├── components/
│   ├── import/
│   │   ├── ImportTypeSelect.vue
│   │   ├── ExcelUploader.vue
│   │   ├── ImportPreviewTable.vue
│   │   ├── ImportSummary.vue
│   │   └── ImportProgress.vue
│   │
│   └── naker/
│       └── NakerPreviewTable.vue
│
└── services/
    └── importService.js
```

---

# 59. API Endpoint

## Import Profile

```http
GET /api/import-profiles
```

## Upload

```http
POST /api/imports
```

Payload:

```text
import_profile_id
file
```

## Preview

```http
GET /api/imports/{id}/preview
```

## Validate

```http
POST /api/imports/{id}/validate
```

## Process

```http
POST /api/imports/{id}/process
```

## Status

```http
GET /api/imports/{id}/status
```

## Error

```http
GET /api/imports/{id}/errors
```

## History

```http
GET /api/imports
```

---

# 60. Acceptance Criteria

## NAKER

```text
[ ] Supervisor dapat upload NAKER
[ ] Sistem membaca sheet PLOTTING
[ ] Sistem validasi required field
[ ] ID SIP unique
[ ] Employee dibuat/update
[ ] Service dimapping
[ ] TL dimapping
[ ] Trainer dimapping
[ ] Site dimapping
[ ] Assignment tersimpan
[ ] Error dapat dilihat
[ ] History tersimpan
```

## QSF

```text
[ ] Supervisor memilih Import Type
[ ] Upload Excel
[ ] Sistem menggunakan profile
[ ] Header divalidasi
[ ] Agent dimatch
[ ] QA dimatch
[ ] Service dimatch
[ ] Category dimatch
[ ] Sub Category dimatch
[ ] Platform dimatch
[ ] Parameter dimatch
[ ] Assessment tersimpan
[ ] Score parameter tersimpan
[ ] Duplicate IDCA dicegah
[ ] Error report tersedia
[ ] Import history tersedia
```

---

# 61. Keputusan Arsitektur Final

```text
                    ┌─────────────────┐
                    │   SUPERVISOR    │
                    └────────┬────────┘
                             │
                       IMPORT DATA
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
          IMPORT NAKER                  IMPORT QSF
               │                           │
               ▼                           ▼
        Import Profile              Import Profile
               │                           │
               ▼                           ▼
          employees                 ca_assessments
               │                           │
               ▼                           ▼
    employee_assignments         ca_assessment_scores
               │                           │
               └─────────────┬─────────────┘
                             ▼
                          REPORT
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          Dashboard         ANEV          Export
```

---

# 62. Prinsip yang Harus Dipertahankan

### 1. Excel bukan database

Excel adalah:

```text
SOURCE / INPUT
```

Database adalah:

```text
SYSTEM OF RECORD
```

### 2. NAKER adalah master employee

Gunakan:

```text
employees.sip_id
```

sebagai business key.

### 3. Assessment adalah transaksi

Gunakan:

```text
ca_assessments
```

### 4. Parameter bersifat dinamis

Gunakan:

```text
ca_parameters
ca_assessment_scores
```

### 5. Import harus configurable

Gunakan:

```text
import_profiles
import_profile_mappings
```

### 6. Supervisor tidak memilih tabel database

Supervisor hanya memilih:

```text
Import Type
```

Sistem menentukan mapping.

### 7. Semua import harus bisa diaudit

Gunakan:

```text
import_batches
import_rows
import_logs
```

### 8. Jangan overwrite master secara diam-diam

Jika data NAKER sudah ada:

```text
UPDATE / SKIP
```

harus menjadi keputusan yang jelas.

### 9. Jangan menghapus raw data

Raw row harus dapat ditelusuri kembali ke Excel source.

---

# 63. Ringkasan Tabel

| Tabel | Fungsi | Jenis |
|---|---|---|
| `roles` | Role aplikasi | Master |
| `users` | Account login | Master |
| `employees` | Database NAKER | **Master utama** |
| `sites` | Site | Master |
| `services` | Service canonical | Master |
| `service_mappings` | Mapping label source | Master |
| `employee_assignments` | TL/Trainer/Service/Site | Relation |
| `categories` | Kategori QSF | Master |
| `sub_categories` | Sub kategori QSF | Master |
| `platforms` | Platform | Master |
| `ca_parameters` | Parameter CA | Master |
| `ca_assessments` | Hasil assessment | Transaction |
| `ca_assessment_scores` | Nilai parameter | Transaction |
| `import_profiles` | Definisi jenis Excel | Configuration |
| `import_profile_mappings` | Mapping kolom Excel | Configuration |
| `import_batches` | Satu sesi import | Import |
| `import_rows` | Detail row import | Import |
| `import_logs` | Audit import | Audit |

---

# 64. Roadmap Prioritas Implementasi

Urutan yang paling aman:

```text
STEP 01
Migration + Authentication

STEP 02
Master Employee / NAKER

STEP 03
Service + Site + TL + Trainer

STEP 04
Import NAKER oleh Supervisor

STEP 05
Master Category + Sub Category + Platform

STEP 06
Master CA Parameter

STEP 07
Import Profile Engine

STEP 08
QSF Inbound

STEP 09
QSF Digilive

STEP 10
QSF Socmed

STEP 11
QSF Email Inbound

STEP 12
QSF Email Outbound

STEP 13
QSF Outbound Call

STEP 14
QSF Back Office

STEP 15
Dashboard

STEP 16
ANEV

STEP 17
Export / Reporting

STEP 18
Audit + Hardening
```

---

# 65. Kesimpulan

Desain yang direkomendasikan bukan sekadar:

```text
Upload Excel → INSERT database
```

tetapi:

```text
EXCEL
  ↓
IMPORT PROFILE
  ↓
READ
  ↓
VALIDATE
  ↓
NORMALIZE
  ↓
LOOKUP MASTER
  ↓
PREVIEW
  ↓
QUEUE
  ↓
TRANSACTION
  ↓
ASSESSMENT
  ↓
PARAMETER SCORE
  ↓
DASHBOARD
```

Untuk NAKER:

```text
NAKER Excel
    ↓
employees
    ↓
service mapping
    ↓
employee assignment
```

Untuk QSF:

```text
QSF Excel
    ↓
employee lookup
    ↓
service lookup
    ↓
category lookup
    ↓
parameter lookup
    ↓
ca_assessments
    ↓
ca_assessment_scores
```

Dengan arsitektur ini, ketika format Excel berubah, sistem tidak perlu selalu melakukan migration database. Yang berubah cukup:

```text
Import Profile
+
Import Profile Mapping
```

selama perubahan tersebut masih berada dalam domain data yang sama.

**Catatan production:** struktur detail `Email Inbound` dan `Outbound Call` perlu dikunci setelah worksheet aktual tersedia. Jangan membuat asumsi kolom/parameter baru dari nama file saja.
