import * as XLSX from 'xlsx';

/**
 * Metadata dan spesifikasi resmi template QSF & NAKER
 * Sesuai format file sampel aktual di c:\Users\yudak\Downloads\sample
 */
export const TEMPLATE_DEFINITIONS = {
    'NAKER': {
        id: 'NAKER',
        name: 'Database NAKER',
        fileName: 'DATABASE ALL NAKER AGUSTUS 2026.xlsx',
        sheetName: 'PLOTTING',
        type: 'NAKER',
        description: 'Template Master Plotting NAKER (CSO, TL, Trainer, QA Evaluator, Supervisor)',
        columns: ['NO', 'NAMA', 'JK', 'LAYANAN', 'SUB LAYANAN', 'TEAM TL', 'TRAINER', 'SITE', 'ID SIP'],
        sampleRows: [
            { 'NO': 1, 'NAMA': 'ACHMAD MAULANA', 'JK': 'L', 'LAYANAN': 'CSO INBOUND CALL', 'SUB LAYANAN': 'INBOUND CALL', 'TEAM TL': 'TL INBOUND', 'TRAINER': 'TRAINER INBOUND', 'SITE': 'SMG', 'ID SIP': 'ACHMAD.MAULANA' },
            { 'NO': 2, 'NAMA': 'SITI NURHALIZA', 'JK': 'P', 'LAYANAN': 'CSO DIGILIVE CHAT', 'SUB LAYANAN': 'MY ICON+', 'TEAM TL': 'TL DIGILIVE', 'TRAINER': 'TRAINER DIGILIVE', 'SITE': 'SMG', 'ID SIP': 'SITI.NURHALIZA' },
            { 'NO': 3, 'NAMA': 'RIZKI RAMADHAN', 'JK': 'L', 'LAYANAN': 'CSO SOCIAL MEDIA', 'SUB LAYANAN': 'DM INSTAGRAM', 'TEAM TL': 'TL SOCMED', 'TRAINER': 'TRAINER SOCMED', 'SITE': 'SMG', 'ID SIP': 'RIZKI.RAMADHAN' },
            { 'NO': 4, 'NAMA': 'DEWI LESTARI', 'JK': 'P', 'LAYANAN': 'CSO EMAIL', 'SUB LAYANAN': 'EMAIL INBOUND', 'TEAM TL': 'TL EMAIL', 'TRAINER': 'TRAINER EMAIL', 'SITE': 'SMG', 'ID SIP': 'DEWI.LESTARI' },
            { 'NO': 5, 'NAMA': 'FAJAR BAYU SETYO', 'JK': 'L', 'LAYANAN': 'CSO EMAIL OUTBOUND', 'SUB LAYANAN': 'EMAIL OUTBOUND', 'TEAM TL': 'TL OUTBOUND', 'TRAINER': 'TRAINER OUTBOUND', 'SITE': 'SMG', 'ID SIP': 'FAJAR.BAYU' },
            { 'NO': 6, 'NAMA': 'ANISA PUTRI', 'JK': 'P', 'LAYANAN': 'CSO OUTBOUND CALL', 'SUB LAYANAN': 'OUTBOUND CALL', 'TEAM TL': 'TL OUTBOUND', 'TRAINER': 'TRAINER OUTBOUND', 'SITE': 'SMG', 'ID SIP': 'ANISA.PUTRI' },
            { 'NO': 7, 'NAMA': 'BUDI PRASETYO', 'JK': 'L', 'LAYANAN': 'CSO BACK OFFICE', 'SUB LAYANAN': 'ESKALASI BO', 'TEAM TL': 'TL BACK OFFICE', 'TRAINER': 'TRAINER BO', 'SITE': 'SMG', 'ID SIP': 'BUDI.PRASETYO' },
            { 'NO': 8, 'NAMA': 'QA EVALUATOR UTAMA', 'JK': 'P', 'LAYANAN': 'NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE', 'SUB LAYANAN': 'QUALITY ASSURANCE', 'TEAM TL': '', 'TRAINER': '', 'SITE': 'SMG', 'ID SIP': 'QA.EVALUATOR' },
            { 'NO': 9, 'NAMA': 'SUPERVISOR QA', 'JK': 'L', 'LAYANAN': 'NON CSO - MIDDLE MANAGEMENT SUPERVISOR', 'SUB LAYANAN': 'SUPERVISOR', 'TEAM TL': '', 'TRAINER': '', 'SITE': 'SMG', 'ID SIP': 'SPV.QA' }
        ]
    },
    'Inbound': {
        id: 'Inbound',
        name: 'Inbound Call',
        fileName: 'QSF - INBOUND.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Inbo',
        type: 'QSF',
        description: 'Template QSF Layanan Voice Inbound (14 Parameter Mutu)',
        ca: 'Inbound',
        layanan: 'Inbound',
        hasPlatform: false,
        params: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
        paramSampleScore: 7.1,
        totalScore: 99.4,
        sampleAgents: [
            { name: 'ACHMAD MAULANA', sip: 'ACHMAD.MAULANA', ticket: 'INB-998810', idca: 'CA_INB-20260901103001' },
            { name: 'BUDI PRASETYO', sip: 'BUDI.PRASETYO', ticket: 'INB-998811', idca: 'CA_INB-20260901111502' },
            { name: 'EKO WAHYUDI', sip: 'EKO.WAHYUDI', ticket: 'INB-998812', idca: 'CA_INB-20260901132003' }
        ]
    },
    'Digilive': {
        id: 'Digilive',
        name: 'Digilive (Live Chat)',
        fileName: 'QSF - DIGILIVE.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Digi',
        type: 'QSF',
        description: 'Template QSF Layanan Chat Digilive (18 Parameter Mutu)',
        ca: 'Digilive',
        layanan: 'Digilive',
        hasPlatform: true,
        platformSample: 'LIVE CHAT MYICON+',
        params: ['1.1', '2.1', '2.2', '2.3', '3.1', '4.1', '5.1', '5.2', '5.3', '6.1', '6.2', '7.1', '8.1', '8.2', '9.1', '9.2', '10.1', '10.2'],
        paramSampleScore: 5.5,
        totalScore: 99.0,
        sampleAgents: [
            { name: 'SITI NURHALIZA', sip: 'SITI.NURHALIZA', ticket: 'DGL-772101', idca: 'CA_DGL-20260901091501' },
            { name: 'NURUL HIDAYAH', sip: 'NURUL.HIDAYAH', ticket: 'DGL-772102', idca: 'CA_DGL-20260901104502' },
            { name: 'INDAH PERMATASARI', sip: 'INDAH.PERMATASARI', ticket: 'DGL-772103', idca: 'CA_DGL-20260901141003' }
        ]
    },
    'Socmed': {
        id: 'Socmed',
        name: 'Social Media',
        fileName: 'QSF - SOSMED.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Socm',
        type: 'QSF',
        description: 'Template QSF Layanan Social Media (8 Parameter Mutu)',
        ca: 'Socmed',
        layanan: 'SOSMED',
        hasPlatform: true,
        platformSample: 'DM INSTAGRAM',
        params: ['A.1', 'A.2', 'B.1', 'B.2', 'B.3', 'B.4', 'C.1', 'C.2'],
        paramSampleScore: 12.5,
        totalScore: 100.0,
        sampleAgents: [
            { name: 'RIZKI RAMADHAN', sip: 'RIZKI.RAMADHAN', ticket: 'SOC-553401', idca: 'CA_SOC-20260901083001', platform: 'DM INSTAGRAM' },
            { name: 'ALYA KHAIRUNNISA', sip: 'ALYA.KHAIRUNNISA', ticket: 'SOC-553402', idca: 'CA_SOC-20260901112002', platform: 'WHATSAPP' },
            { name: 'DIMAS SETIAWAN', sip: 'DIMAS.SETIAWAN', ticket: 'SOC-553403', idca: 'CA_SOC-20260901150003', platform: 'TWITTER' }
        ]
    },
    'Email': {
        id: 'Email',
        name: 'Email Inbound',
        fileName: 'QSF - EMAIL.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Emai',
        type: 'QSF',
        description: 'Template QSF Layanan Email Inbound (15 Parameter Mutu)',
        ca: 'Email_Inbound',
        layanan: 'Email',
        hasPlatform: false,
        params: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        paramSampleScore: 6.6,
        totalScore: 99.0,
        sampleAgents: [
            { name: 'DEWI LESTARI', sip: 'DEWI.LESTARI', ticket: 'EML-332101', idca: 'CA_EML-20260901090001' },
            { name: 'HENDRA WIJAYA', sip: 'HENDRA.WIJAYA', ticket: 'EML-332102', idca: 'CA_EML-20260901103002' },
            { name: 'RATNA SARI', sip: 'RATNA.SARI', ticket: 'EML-332103', idca: 'CA_EML-20260901134503' }
        ]
    },
    'Email Outbound': {
        id: 'Email Outbound',
        name: 'Email Outbound',
        fileName: 'QSF - EMAIL OUTBOND.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Emai',
        type: 'QSF',
        description: 'Template QSF Layanan Email Outbound (15 Parameter Mutu A1-E14)',
        ca: 'Email_Outbound',
        layanan: 'Outbound Reguler',
        hasPlatform: false,
        params: ['A1', 'B1', 'B2', 'C3', 'C4', 'C5', 'D6', 'D7', 'D8', 'D9', 'D10', 'E11', 'E12', 'E13', 'E14'],
        paramSampleScore: 6.6,
        totalScore: 99.0,
        sampleAgents: [
            { name: 'FAJAR BAYU SETYO', sip: 'FAJAR.BAYU', ticket: 'EMO-441201', idca: 'CA_EMO-20260901084501' },
            { name: 'LINA MARLINA', sip: 'LINA.MARLINA', ticket: 'EMO-441202', idca: 'CA_EMO-20260901110002' },
            { name: 'WAHYU PRATAMA', sip: 'WAHYU.PRATAMA', ticket: 'EMO-441203', idca: 'CA_EMO-20260901143003' }
        ]
    },
    'Outbound Call': {
        id: 'Outbound Call',
        name: 'Outbound Call',
        fileName: 'QSF - OUTBOND CALL.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Outb',
        type: 'QSF',
        description: 'Template QSF Layanan Outbound Call (12 Parameter Mutu)',
        ca: 'Outbound Call',
        layanan: 'Outbound Reguler',
        hasPlatform: false,
        params: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        paramSampleScore: 8.3,
        totalScore: 99.6,
        sampleAgents: [
            { name: 'ANISA PUTRI', sip: 'ANISA.PUTRI', ticket: 'OBC-881201', idca: 'CA_OBC-20260901093001' },
            { name: 'BAGUS TRI NUGROHO', sip: 'BAGUS.TRI', ticket: 'OBC-881202', idca: 'CA_OBC-20260901114502' },
            { name: 'CINDY CLAUDIA', sip: 'CINDY.CLAUDIA', ticket: 'OBC-881203', idca: 'CA_OBC-20260901152003' }
        ]
    },
    'Back Office': {
        id: 'Back Office',
        name: 'Back Office (Eskalasi BO)',
        fileName: 'QSF - BACK OFFICE.xlsx',
        sheetName: 'Report CA FCR Detail QSF - Kete',
        type: 'QSF',
        description: 'Template QSF Layanan Back Office (3 Parameter Mutu)',
        ca: 'Ketepatan Eskalasi BO',
        layanan: 'Ketepatan Eskalasi BO',
        hasPlatform: false,
        params: ['1', '2', '3'],
        paramSampleScore: 33.3,
        totalScore: 99.9,
        sampleAgents: [
            { name: 'BUDI PRASETYO', sip: 'BUDI.PRASETYO', ticket: 'BO-119901', idca: 'CA_BO-20260901100001' },
            { name: 'GITA GUTAMA', sip: 'GITA.GUTAMA', ticket: 'BO-119902', idca: 'CA_BO-20260901131502' },
            { name: 'IKHSAN MAULANA', sip: 'IKHSAN.MAULANA', ticket: 'BO-119903', idca: 'CA_BO-20260901160003' }
        ]
    }
};

/**
 * Generate dan unduh template file Excel untuk channel/layanan yang dipilih
 * @param {string} channelKey - 'NAKER' | 'Inbound' | 'Digilive' | 'Socmed' | 'Email' | 'Email Outbound' | 'Outbound Call' | 'Back Office'
 * @param {string} [periodStr='2026-09-01 sd 2026-09-30'] - Periode penarikan data
 */
export function generateQsfTemplate(channelKey, periodStr = '2026-09-01 sd 2026-09-30') {
    const def = TEMPLATE_DEFINITIONS[channelKey];
    if (!def) {
        throw new Error(`Definisi template untuk layanan "${channelKey}" tidak ditemukan.`);
    }

    const wb = XLSX.utils.book_new();

    // =========================================================================
    // 1. TEMPLATE MASTER DATABASE NAKER
    // =========================================================================
    if (def.type === 'NAKER') {
        const ws = XLSX.utils.json_to_sheet(def.sampleRows);

        // Lebar kolom rapi
        ws['!cols'] = [
            { wch: 6 },   // NO
            { wch: 32 },  // NAMA
            { wch: 6 },   // JK
            { wch: 40 },  // LAYANAN
            { wch: 22 },  // SUB LAYANAN
            { wch: 22 },  // TEAM TL
            { wch: 22 },  // TRAINER
            { wch: 10 },  // SITE
            { wch: 25 },  // ID SIP
        ];

        XLSX.utils.book_append_sheet(wb, ws, def.sheetName || 'PLOTTING');
        if (typeof window !== 'undefined') {
            XLSX.writeFile(wb, def.fileName);
        }
        return wb;
    }

    // =========================================================================
    // 2. TEMPLATE QSF (3-ROW HEADER FORMAT SESUAI ROADMAP & SAMPEL RESMI)
    // =========================================================================
    const { hasPlatform, params, ca, layanan, paramSampleScore, totalScore, sampleAgents, platformSample } = def;

    // Header Kolom Standar
    const standardCols = [
        'No', 'Site', 'IDCA', 'ID Tiket', 'CA', 'Layanan',
        'Kategori', 'Sub Kategori', 'Pelanggan', 'Agent',
        'Tgl Transaksi', 'Durasi Transaksi', 'Durasi Sampling', 'QA', 'Tgl Ukur'
    ];

    if (hasPlatform) {
        standardCols.push('Platform');
    }

    standardCols.push('FCR', 'Hashtag', 'Ket FCR', 'Attribute');

    // Kolom kosong untuk sisa parameter di row 2
    for (let i = 1; i < params.length; i++) {
        standardCols.push('');
    }

    standardCols.push('Score CA', 'Ket Summary', 'Rekomendasi', 'Ket Rekomendasi', 'Pernah Diubah');

    // Row 1: Title Banner
    const titleRow = Array(standardCols.length).fill('');
    titleRow[0] = `Report CA FCR Detail QSF - ${layanan} || Periode : ${periodStr}`;

    // Row 2: Header Kolom
    const headerRow = [...standardCols];

    // Row 3: Parameter Codes (di bawah kolom 'Attribute' dst)
    const paramRow = Array(standardCols.length).fill('');
    const attrColIdx = standardCols.indexOf('Attribute');
    params.forEach((code, i) => {
        if (attrColIdx + i < paramRow.length) {
            paramRow[attrColIdx + i] = code;
        }
    });

    // Row 4+: Baris Data Sampel
    const dataRows = (sampleAgents || []).map((ag, idx) => {
        const row = Array(standardCols.length).fill('');
        let cIdx = 0;

        row[cIdx++] = idx + 1;                                  // No
        row[cIdx++] = 'SMG';                                    // Site
        row[cIdx++] = ag.idca;                                  // IDCA
        row[cIdx++] = ag.ticket;                                // ID Tiket
        row[cIdx++] = ca;                                       // CA
        row[cIdx++] = layanan;                                  // Layanan
        row[cIdx++] = idx % 2 === 0 ? 'GANGGUAN' : 'INFORMASI'; // Kategori
        row[cIdx++] = idx % 2 === 0 ? 'Koneksi Lambat' : 'Paket Promo'; // Sub Kategori
        row[cIdx++] = `Pelanggan Contoh ${idx + 1}`;            // Pelanggan
        row[cIdx++] = ag.sip;                                   // Agent
        row[cIdx++] = `2026-09-0${idx + 1} 10:15:00`;           // Tgl Transaksi
        row[cIdx++] = `00:0${idx + 2}:45`;                      // Durasi Transaksi
        row[cIdx++] = `00:0${idx + 4}:30`;                      // Durasi Sampling
        row[cIdx++] = 'QA.EVALUATOR';                           // QA
        row[cIdx++] = `2026-09-0${idx + 1} 14:00:00`;           // Tgl Ukur

        if (hasPlatform) {
            row[cIdx++] = ag.platform || platformSample || 'LIVE CHAT MYICON+'; // Platform
        }

        row[cIdx++] = 'YA';                                     // FCR
        row[cIdx++] = '#GANGGUAN #SOLUTIF';                     // Hashtag
        row[cIdx++] = '';                                       // Ket FCR

        // Parameter values (Row 4 Attribute columns)
        params.forEach((_, pIdx) => {
            row[attrColIdx + pIdx] = paramSampleScore;
        });

        // Trailing summary columns
        const scoreCaColIdx = standardCols.indexOf('Score CA');
        row[scoreCaColIdx] = totalScore;
        row[scoreCaColIdx + 1] = 'Pelayanan ramah, solusi akurat, dan sesuai dengan SOP.';
        row[scoreCaColIdx + 2] = 'Positive Feedback';
        row[scoreCaColIdx + 3] = 'SESUAI';
        row[scoreCaColIdx + 4] = 'TIDAK';

        return row;
    });

    // Gabungkan seluruh baris: [Title, Header, Parameter Codes, ...Data Rows]
    const fullSheetData = [titleRow, headerRow, paramRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(fullSheetData);

    // Hitung lebar kolom otomatis
    ws['!cols'] = standardCols.map((col, idx) => {
        if (col === 'No') return { wch: 6 };
        if (col === 'Site') return { wch: 8 };
        if (col === 'IDCA') return { wch: 28 };
        if (col === 'ID Tiket') return { wch: 16 };
        if (col === 'CA' || col === 'Layanan') return { wch: 22 };
        if (col === 'Pelanggan' || col === 'Agent') return { wch: 22 };
        if (col === 'Tgl Transaksi' || col === 'Tgl Ukur') return { wch: 20 };
        if (col === 'Score CA') return { wch: 12 };
        if (col === 'Ket Summary') return { wch: 40 };
        if (col === 'Rekomendasi' || col === 'Ket Rekomendasi') return { wch: 20 };
        if (idx >= attrColIdx && idx < standardCols.indexOf('Score CA')) return { wch: 8 };
        return { wch: 15 };
    });

    XLSX.utils.book_append_sheet(wb, ws, def.sheetName);
    if (typeof window !== 'undefined') {
        XLSX.writeFile(wb, def.fileName);
    }
    return wb;
}

/**
 * Unduh seluruh template sekaligus (Semua 7 Layanan QSF + 1 NAKER)
 * Melakukan download berurutan agar user mendapatkan seluruh template lengkap
 */
export function downloadAllTemplates() {
    const keys = Object.keys(TEMPLATE_DEFINITIONS);
    let downloaded = 0;

    keys.forEach((k, idx) => {
        setTimeout(() => {
            generateQsfTemplate(k);
        }, idx * 300); // interval 300ms agar browser tidak memblokir multiple downloads
        downloaded++;
    });

    return downloaded;
}
