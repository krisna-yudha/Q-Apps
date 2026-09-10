# DigiQA - Architecture & Business Guidelines

## 📌 Core Rule: Separation of Raw Sampling Data vs. Processed Dashboard Data

1. **Auto Distribution (Modul 6)**:
   - Handles **RAW DATA** (raw customer transactions from CRM/CSC).
   - Engine V2 splits raw data into balanced sampling quota buckets for QA Evaluators.

2. **Lembar Sampling QA (Modul 5)**:
   - QA Evaluators observe and score the allocated raw tickets against SOP channel parameters and FCR.
   - Supervisors monitor real-time queues and audit weekly discipline.
   - Finished evaluations become **PROCESSED / MATANG** data.

3. **Input, Import & Setting (Modul 7)**:
   - Handles **PROCESSED / MATANG DATA** (Final QSF Excel files completed by QA) imported **at the beginning of each month (per awal bulan)**.
   - Aggregates and populates official data into **Dashboards 1–4**.
   - Also manages Master NAKER plotting and Master SOP definitions.

4. **Executive Dashboards (Modul 1–4)**:
   - Modul 1: Dashboard Global (Macro CA & FCR metrics)
   - Modul 2: Analisis & Evaluasi / Anev (Agent rankings & Top/Bottom performers)
   - Modul 3: Rekap Nilai Agent (Comprehensive individual agent score sheets)
   - Modul 4: Pencapaian Tim QA (QA evaluator quota progress & history)

5. **Kelola Akun (Modul 8)**:
   - RBAC user management and master NAKER credentials.
