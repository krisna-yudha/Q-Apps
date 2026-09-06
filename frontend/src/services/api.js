import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 8000,
});

// Interceptor to add auth token
// Baca dari sessionStorage dulu (session sementara), lalu localStorage (ingat saya)
apiClient.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem('digiqa_token') || localStorage.getItem('digiqa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // System Health & Connection Check
  async checkHealth() {
    try {
      const res = await apiClient.get('/health', { timeout: 3500 });
      return { ok: true, data: res.data };
    } catch (err) {
      return { ok: false, error: err.message || 'Server tidak merespons' };
    }
  },

  // Authentication
  // rememberMe ditangani oleh AuthContext (saveToStorage), bukan di sini
  async login(username, password) {
    try {
      const res = await apiClient.post('/login', { username, password });
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.username?.[0] || 'Gagal login. Pastikan backend aktif.';
      throw new Error(msg);
    }
  },

  async logout() {
    try {
      await apiClient.post('/logout');
    } catch (e) {
      // ignore
    }
    // Pembersihan storage ditangani oleh AuthContext.clearStorage()
  },

  // User Profile Updates
  async updateProfile(payload) {
    const res = await apiClient.post('/user/profile', payload);
    if (res.data?.user) {
      localStorage.setItem('digiqa_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  async updatePassword(payload) {
    const res = await apiClient.post('/user/password', payload);
    return res.data;
  },

  // View 3: Dashboard Pencapaian Global CA & FCR
  async getGlobalDashboard(period = '2026-08', channel = 'all') {
    try {
      const res = await apiClient.get('/dashboard/global', { params: { period, channel } });
      return res.data;
    } catch (err) {
      return {
        success: false,
        period,
        hasData: false,
        kpi: { avgCA: 0, avgFCR: 0, targetCA: 90, targetFCR: 85, totalEvaluations: 0, totalAgents: 0 },
        trends: [],
        channels: []
      };
    }
  },

  // View 4: Anev (Top 5 & Bottom 5 Ranking)
  async getAnevData(period = '2026-08') {
    try {
      const res = await apiClient.get('/dashboard/anev', { params: { period } });
      return res.data;
    } catch (err) {
      return {
        success: false,
        hasData: false,
        top5: [],
        bottom5: [],
        evaluatorsStatus: []
      };
    }
  },

  // View 5: Rekap Rata-Rata Nilai Per Agent
  async getAgentRecap(params = {}) {
    try {
      const res = await apiClient.get('/agents/recap', { params });
      return res.data;
    } catch (err) {
      return {
        success: false,
        data: [],
        total: 0,
        teamLeaders: [],
        trainers: []
      };
    }
  },

  // Preview & Redundancy Audit Excel Data
  async previewAgentsExcel(rows, channel = 'Inbound', fileName = 'Report.xlsx') {
    const res = await apiClient.post('/agents/preview-excel', {
      data: rows,
      channel: channel,
      file_name: fileName
    });
    return res.data;
  },

  // Import / Inject Excel to Backend
  async importAgentsExcel(rows, channel = 'Inbound', fileName = 'Report.xlsx', importMode = 'upsert') {
    const res = await apiClient.post('/agents/import-excel', {
      data: rows,
      channel: channel,
      file_name: fileName,
      import_mode: importMode
    });
    return res.data;
  },

  // Get Assessment Dynamic Parameter Scores
  async getAssessmentScores(assessmentId) {
    const res = await apiClient.get(`/assessments/${assessmentId}/scores`);
    return res.data;
  },

  // Get Service Parameters
  async getServicesParameters(serviceCode = 'all') {
    const res = await apiClient.get('/services/parameters', { params: { service: serviceCode } });
    return res.data;
  },

  // Get Lowest Performing Parameters (Roadmap Section 35)
  async getParameterFailures(serviceCode = 'all') {
    const res = await apiClient.get('/dashboard/parameters-low', { params: { service: serviceCode } });
    return res.data;
  },

  // Manual Input Single Agent Evaluation from Supervisor
  async storeManualAgent(payload) {
    const res = await apiClient.post('/agents/store-manual', payload);
    return res.data;
  },

  // Get 5 Channel QSF Summary Cards
  async getSupervisorChannelSummary() {
    try {
      const res = await apiClient.get('/supervisor/channel-summary');
      return res.data;
    } catch (e) {
      return { success: false, channels: [] };
    }
  },

  // Reset / Clear Data in Backend
  async clearAgentsData() {
    const res = await apiClient.post('/agents/clear-data');
    return res.data;
  },

  async resetSystemData() {
    const res = await apiClient.post('/system/reset-data');
    return res.data;
  },

  // View 6: Pencapaian Tim QA & Trainer
  async getEvaluatorsSampling(params = {}) {
    try {
      const res = await apiClient.get('/evaluators/sampling', { params });
      return res.data;
    } catch (err) {
      return {
        success: false,
        summary: { totalQuota: 0, totalActual: 0, overallCompletion: 0, avgTeamScore: 0 },
        evaluators: []
      };
    }
  },

  // View 7: Repository Hasil Diskusi Kebijakan
  async getPolicyDiscussions(params = {}) {
    try {
      const res = await apiClient.get('/policy-discussions', { params });
      return res.data;
    } catch (err) {
      return {
        success: false,
        data: [],
        categories: [],
        counts: { all: 0, active: 0, expired: 0 }
      };
    }
  },

  async addPolicyDiscussion(payload) {
    const res = await apiClient.post('/policy-discussions', payload);
    return res.data;
  },

  async togglePolicyStatus(id) {
    const res = await apiClient.patch(`/policy-discussions/${id}/toggle`);
    return res.data;
  },

  async deletePolicyDiscussion(id) {
    const res = await apiClient.delete(`/policy-discussions/${id}`);
    return res.data;
  },

  // Import Engine & Profiles (NAKER & QSF)
  async getImportProfiles() {
    try {
      const res = await apiClient.get('/import-profiles');
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async previewImport(payload) {
    const res = await apiClient.post('/imports/preview', payload, { timeout: 35000 });
    return res.data;
  },

  async processImport(payload) {
    const res = await apiClient.post('/imports/process', payload, { timeout: 45000 });
    return res.data;
  },

  async getImportHistory(page = 1) {
    try {
      const res = await apiClient.get('/imports/history', { params: { page } });
      return res.data;
    } catch (e) {
      return { success: false, data: { data: [] } };
    }
  },

  // Master Data NAKER (Tenaga Kerja)
  async getEmployees(params = {}) {
    try {
      const res = await apiClient.get('/employees', { params });
      return res.data;
    } catch (e) {
      return {
        success: false,
        summary: { total_naker: 0, pria: 0, wanita: 0, service_distribution: [] },
        data: { data: [] }
      };
    }
  },

  async getEmployeeDetail(id) {
    const res = await apiClient.get(`/employees/${id}`);
    return res.data;
  },

  // Export Master Data NAKER ke JSON rows (Roadmap V2 §8 + §28)
  // Kolom: NO, NAMA, JK, LAYANAN, TEAM TL, TRAINER, SITE, ID SIP
  async exportNaker(params = {}) {
    try {
      const res = await apiClient.get('/exports/naker', { params });
      return res.data;
    } catch (e) {
      return { success: false, rows: [], columns: [] };
    }
  },

  // Export Assessment QSF per channel ke JSON rows (Roadmap V2 §29.1)
  // Kolom: No, Site, IDCA, ID Tiket, CA, Layanan, Kategori, Sub Kategori, Pelanggan, Agent,
  //        Tgl Transaksi, Durasi Transaksi, Durasi Sampling, QA, Tgl Ukur, [Platform], Hashtag,
  //        FCR, Ket FCR, [Parameter dinamis], Score CA, Ket Summary, Rekomendasi, Ket Rekomendasi, Pernah Diubah
  async exportQsf(channel = 'Inbound', period = null) {
    try {
      const params = { channel };
      if (period) params.period = period;
      const res = await apiClient.get('/exports/qsf', { params });
      return res.data;
    } catch (e) {
      return { success: false, rows: [], columns: [] };
    }
  },

  // Live Auto-Sync & Notifications
  async getNotifications() {
    try {
      const res = await apiClient.get('/notifications');
      return res.data;
    } catch (e) {
      return { success: false, unread_count: 0, notifications: [] };
    }
  },

  async markNotificationsRead(id = null) {
    const res = await apiClient.post('/notifications/mark-read', { id });
    return res.data;
  },

  async getSyncStatus() {
    try {
      const res = await apiClient.get('/system/sync-status');
      return res.data;
    } catch (e) {
      return { success: false, data_version: null, unread_count: 0 };
    }
  }
};
