import axios from 'axios';

/**
 * =======================================================================
 * digiQA / Qapps - Centralized & Deployable API Service Bridge
 * =======================================================================
 * Mendukung seluruh skenario deployment:
 * 1. Runtime Override: window.__DIGIQA_API_URL__ (tanpa perlu re-build Vite)
 * 2. Storage Override: localStorage ('digiqa_api_url')
 * 3. Environment Variable: import.meta.env.VITE_API_URL (.env / .env.production)
 * 4. Production Same-Domain / Reverse Proxy: /api
 * 5. Dynamic Wi-Fi / LAN IP (Pengujian langsung via HP di jaringan lokal)
 * 6. Local Development Fallback: http://127.0.0.1:8000/api
 */

// Helper untuk memastikan format URL valid dan memiliki suffix '/api'
export const normalizeApiUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (url.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location) {
      url = `${window.location.origin}${url}`;
    }
  }
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
};

// 1. Dynamic Base URL Resolution
export const getBaseUrl = () => {
  // Skenario 1: Runtime Global Injection (misal diatur di index.html server produksi)
  if (typeof window !== 'undefined' && window.__DIGIQA_API_URL__) {
    return normalizeApiUrl(window.__DIGIQA_API_URL__);
  }

  // Skenario 2: Runtime Override via LocalStorage (fleksibel untuk debug / ganti server on-the-fly)
  if (typeof window !== 'undefined' && localStorage.getItem('digiqa_api_url')) {
    return normalizeApiUrl(localStorage.getItem('digiqa_api_url'));
  }

  const isBrowser = typeof window !== 'undefined' && Boolean(window.location);
  const host = isBrowser ? (window.location.hostname || '').toLowerCase() : '';
  const isLocalHost = !host || host === 'localhost' || host === '127.0.0.1';

  // Skenario 3: Vite Environment Variable (.env, .env.local, .env.production)
  if (import.meta.env.VITE_API_URL) {
    const envUrl = import.meta.env.VITE_API_URL;
    const isEnvLocal = envUrl.includes('127.0.0.1') || envUrl.includes('localhost');
    if (!isEnvLocal || isLocalHost) {
      return normalizeApiUrl(envUrl);
    }
  }

  // Skenario 4: Smart Production Domain Auto-Detection (Zero-Config)
  if (isBrowser) {
    const protocol = window.location.protocol || 'https:';

    // 4a. Production Domain Spesifik: qapps.gentz.me -> https://api-qapps.gentz.me/api
    if (host === 'qapps.gentz.me') {
      return 'https://api-qapps.gentz.me/api';
    }

    // 4b. Subdomain / Domain gentz.me lainnya
    if (host.includes('gentz.me')) {
      if (host.startsWith('api-') || host.startsWith('api.')) {
        return normalizeApiUrl(`${protocol}//${host}`);
      }
      return normalizeApiUrl(`${protocol}//api-${host}`);
    }

    // 4c. Pola Standar Subdomain (misal: qapps.domain.com -> api-qapps.domain.com/api)
    if (host.startsWith('qapps.')) {
      return normalizeApiUrl(`${protocol}//api-${host}`);
    }
    if (host.startsWith('app.')) {
      const parentDomain = host.replace(/^app\./, '');
      return normalizeApiUrl(`${protocol}//api.${parentDomain}`);
    }

    // 4d. Dynamic LAN IP / Wi-Fi Mobile Testing (192.168.x.x:5173 -> 192.168.x.x:8000/api)
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIpAddress && host !== '127.0.0.1') {
      return `${protocol}//${host}:8000/api`;
    }

    // 4e. Mode Produksi Generic (Reverse Proxy / Same Origin fallback)
    if (import.meta.env.PROD && !isLocalHost) {
      return normalizeApiUrl(`${window.location.origin}/api`);
    }
  }

  // Skenario 5: Default Local Development
  return 'http://127.0.0.1:8000/api';
};

export const API_BASE_URL = getBaseUrl();

// 2. Axios Client Instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000, // 10 detik default timeout
});

// 3. Request Interceptor: Auto-Attach Auth Token
apiClient.interceptors.request.use(
  (config) => {
    const token =
      sessionStorage.getItem('digiqa_token') || localStorage.getItem('digiqa_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 4. Response Interceptor: Global Error & Session Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Penanganan session kedaluwarsa (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/splash') {
        sessionStorage.removeItem('digiqa_token');
        sessionStorage.removeItem('digiqa_user');
        localStorage.removeItem('digiqa_token');
        localStorage.removeItem('digiqa_user');
        window.dispatchEvent(new CustomEvent('digiqa:auth_expired'));
      }
    }
    return Promise.reject(error);
  }
);

/**
 * =======================================================================
 * API Object - Generic & Named Modules Interface
 * =======================================================================
 */
export const api = {
  // ---------------------------------------------------------------------
  // A. Deployment & Runtime URL Configuration
  // ---------------------------------------------------------------------

  /**
   * Mengubah API Base URL secara dinamis saat runtime (disimpan di browser)
   * @param {string} newUrl - URL Backend Baru (contoh: 'https://api.qapps.co.id/api')
   */
  setBaseUrl(newUrl) {
    if (newUrl && typeof newUrl === 'string') {
      const formattedUrl = normalizeApiUrl(newUrl);
      apiClient.defaults.baseURL = formattedUrl;
      if (typeof window !== 'undefined') {
        localStorage.setItem('digiqa_api_url', formattedUrl);
      }
      return formattedUrl;
    }
    return apiClient.defaults.baseURL;
  },

  /**
   * Mendapatkan Base URL yang saat ini sedang aktif digunakan
   */
  getBaseUrl() {
    return apiClient.defaults.baseURL || getBaseUrl();
  },

  /**
   * Reset Base URL ke konfigurasi default sistem
   */
  resetBaseUrl() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('digiqa_api_url');
    }
    const defaultUrl = getBaseUrl();
    apiClient.defaults.baseURL = defaultUrl;
    return defaultUrl;
  },

  // ---------------------------------------------------------------------
  // B. Generic HTTP Methods (Satu untuk Semua Endpoint Baru / Kustom)
  // ---------------------------------------------------------------------

  /**
   * Generic GET Request
   * @param {string} endpoint - Path endpoint (contoh: '/users', '/custom-report')
   * @param {object} params - Query parameters
   * @param {object} config - Axios config tambahan
   */
  async get(endpoint, params = {}, config = {}) {
    try {
      const res = await apiClient.get(endpoint, { params, ...config });
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  /**
   * Generic POST Request
   * @param {string} endpoint - Path endpoint
   * @param {object|FormData} data - Payload data
   * @param {object} config - Axios config tambahan
   */
  async post(endpoint, data = {}, config = {}) {
    try {
      const res = await apiClient.post(endpoint, data, config);
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  /**
   * Generic PUT Request
   */
  async put(endpoint, data = {}, config = {}) {
    try {
      const res = await apiClient.put(endpoint, data, config);
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  /**
   * Generic PATCH Request
   */
  async patch(endpoint, data = {}, config = {}) {
    try {
      const res = await apiClient.patch(endpoint, data, config);
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  /**
   * Generic DELETE Request
   */
  async delete(endpoint, config = {}) {
    try {
      const res = await apiClient.delete(endpoint, config);
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  /**
   * Generic Multipart/Upload Request (File Upload)
   */
  async upload(endpoint, formData, onUploadProgress = null) {
    try {
      const res = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
        timeout: 60000,
      });
      return res.data;
    } catch (err) {
      throw this._formatError(err);
    }
  },

  // Helper Internal untuk Normalisasi Error Message
  _formatError(err) {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Terjadi kesalahan saat memproses permintaan ke server.';
    const formattedError = new Error(message);
    formattedError.response = err.response;
    formattedError.status = err.response?.status;
    return formattedError;
  },

  // ---------------------------------------------------------------------
  // C. System & Health Check (Modul 0)
  // ---------------------------------------------------------------------
  async checkHealth() {
    try {
      const res = await apiClient.get('/health', { timeout: 3500 });
      return { ok: true, data: res.data };
    } catch (err) {
      return { ok: false, error: err.message || 'Server tidak merespons' };
    }
  },

  // ---------------------------------------------------------------------
  // D. Authentication & Profile
  // ---------------------------------------------------------------------
  async login(username, password) {
    try {
      const res = await apiClient.post('/login', { username, password });
      return res.data;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.username?.[0] ||
        'Gagal login. Pastikan backend aktif.';
      throw new Error(msg);
    }
  },

  async logout() {
    try {
      await apiClient.post('/logout');
    } catch (e) {
      // ignore network errors on logout
    }
  },

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

  // ---------------------------------------------------------------------
  // E. Modul 1: Dashboard Pencapaian Global CA & FCR
  // ---------------------------------------------------------------------
  async getGlobalDashboard(period = '2026-08', channel = 'all', teamLeaderId = undefined) {
    try {
      const res = await apiClient.get('/dashboard/global', {
        params: {
          period,
          channel,
          team_leader_id: teamLeaderId || undefined
        }
      });
      return res.data;
    } catch (err) {
      return {
        success: false,
        period,
        hasData: false,
        kpi: { avgCA: 0, avgFCR: 0, targetCA: 85, targetFCR: 100, totalEvaluations: 0, totalAgents: 0 },
        trends: [],
        channels: []
      };
    }
  },

  // ---------------------------------------------------------------------
  // F. Modul 2: Analisis & Evaluasi (Anev - Ranking)
  // ---------------------------------------------------------------------
  async getAnevData(period = '2026-08', teamLeaderId = undefined) {
    try {
      const res = await apiClient.get('/dashboard/anev', {
        params: {
          period,
          team_leader_id: teamLeaderId || undefined
        }
      });
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

  // ---------------------------------------------------------------------
  // G. Modul 3: Rekap Rata-Rata Nilai Per Agent
  // ---------------------------------------------------------------------
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

  async previewAgentsExcel(rows, channel = 'Inbound', fileName = 'Report.xlsx') {
    const res = await apiClient.post('/agents/preview-excel', {
      data: rows,
      channel: channel,
      file_name: fileName
    });
    return res.data;
  },

  async importAgentsExcel(rows, channel = 'Inbound', fileName = 'Report.xlsx', importMode = 'upsert') {
    const res = await apiClient.post('/agents/import-excel', {
      data: rows,
      channel: channel,
      file_name: fileName,
      import_mode: importMode
    });
    return res.data;
  },

  async getAssessmentScores(assessmentId) {
    const res = await apiClient.get(`/assessments/${assessmentId}/scores`);
    return res.data;
  },

  async getServicesParameters(serviceCode = 'all') {
    const res = await apiClient.get('/services/parameters', { params: { service: serviceCode } });
    return res.data;
  },

  async getParameterFailures(serviceCode = 'all') {
    const res = await apiClient.get('/dashboard/parameters-low', { params: { service: serviceCode } });
    return res.data;
  },

  async storeManualAgent(payload) {
    const res = await apiClient.post('/agents/store-manual', payload);
    return res.data;
  },

  async getSupervisorChannelSummary() {
    try {
      const res = await apiClient.get('/supervisor/channel-summary');
      return res.data;
    } catch (e) {
      return { success: false, channels: [] };
    }
  },

  async clearAgentsData() {
    const res = await apiClient.post('/agents/clear-data');
    return res.data;
  },

  async resetSystemData() {
    const res = await apiClient.post('/system/reset-data');
    return res.data;
  },

  // ---------------------------------------------------------------------
  // H. Modul 4: Pencapaian Tim QA & Trainer
  // ---------------------------------------------------------------------
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

  // Segment 2-D: Penjabaran Target Site, QA & CSO
  async getSamplingPeriods() {
    try {
      const res = await apiClient.get('/sampling/periods');
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async createSamplingPeriod(data) {
    const res = await apiClient.post('/sampling/periods', data);
    return res.data;
  },

  async generateSamplingTargets(period = '2026-08') {
    const res = await apiClient.post(`/sampling/periods/${period}/generate-target`, {}, { timeout: 60000 });
    return res.data;
  },

  async getSamplingSiteSummary(period = '2026-08') {
    try {
      const res = await apiClient.get('/sampling/targets/site', { params: { period } });
      return res.data;
    } catch (e) {
      return { success: false, data: null };
    }
  },

  async getSamplingEvaluators(period = '2026-08', type = 'all') {
    try {
      const res = await apiClient.get('/sampling/targets/evaluators', { params: { period, type } });
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async getSamplingCsoTargets(period = '2026-08', qa = '') {
    try {
      const res = await apiClient.get('/sampling/targets/cso', { params: { period, qa } });
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  // Segment 2-C: Auto Distribution Ticket & QA Bucket
  async distributeSamplingTickets(period = '2026-08') {
    const res = await apiClient.post(`/sampling/periods/${period}/distribute`, {}, { timeout: 60000 });
    return res.data;
  },

  async getSamplingBucketTickets(params = {}) {
    try {
      const res = await apiClient.get('/sampling/bucket/tickets', { params });
      return res.data;
    } catch (e) {
      return { success: false, data: [], stats: {}, pagination: {} };
    }
  },

  async getMySamplingTickets(params = {}) {
    return this.getSamplingBucketTickets(params);
  },

  async getSamplingQaMonitoring(period = '2026-08') {
    try {
      const res = await apiClient.get('/sampling/monitoring/qa-handling', { params: { period } });
      return res.data;
    } catch (e) {
      return { success: false, summary: {}, evaluators: [] };
    }
  },

  async getSamplingQaAuditPerformance(period = '2026-08') {
    try {
      const res = await apiClient.get('/sampling/monitoring/audit-performance', { params: { period } });
      return res.data;
    } catch (e) {
      return { success: false, summary: {}, evaluators: [], weekly_matrix: [], dates_list: [] };
    }
  },

  async startSamplingAssignment(id) {
    const res = await apiClient.post(`/sampling/assignments/${id}/start`);
    return res.data;
  },

  async holdSamplingAssignment(id, reason = 'Penilaian Ditunda Sementara') {
    const res = await apiClient.post(`/sampling/assignments/${id}/hold`, { reason });
    return res.data;
  },

  async completeSamplingAssignment(id, data) {
    const res = await apiClient.post(`/sampling/assignments/${id}/complete`, data);
    return res.data;
  },

  async skipSamplingAssignment(id, reason) {
    const res = await apiClient.post(`/sampling/assignments/${id}/skip`, { reason });
    return res.data;
  },

  async reassignSamplingAssignment(id, data) {
    const res = await apiClient.post(`/sampling/assignments/${id}/reassign`, data);
    return res.data;
  },

  async getSamplingReassignmentLogs(period = '2026-08') {
    try {
      const res = await apiClient.get('/sampling/reassignment-logs', { params: { period } });
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async clearSamplingBucket(period = '2026-08') {
    const res = await apiClient.post('/sampling/bucket/clear', { period });
    return res.data;
  },

  async deleteSamplingAssignment(id) {
    const res = await apiClient.delete(`/sampling/assignments/${id}`);
    return res.data;
  },

  async bulkDeleteSamplingAssignments(ids = []) {
    const res = await apiClient.post('/sampling/assignments/bulk-delete', { ids });
    return res.data;
  },

  async recallSamplingBucket(data = {}) {
    const res = await apiClient.post('/sampling/bucket/recall', data);
    return res.data;
  },

  async getSamplingImportBatches(period = null) {
    try {
      const res = await apiClient.get('/sampling/import-batches', { params: { period } });
      return res.data;
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async rollbackSamplingBatch(batchId, period = null) {
    const res = await apiClient.post(`/sampling/batches/${batchId}/rollback`, { period });
    return res.data;
  },

  async resetAllSamplingData(wipeAssessments = false) {
    const res = await apiClient.post('/sampling/reset-all', { wipe_assessments: wipeAssessments });
    return res.data;
  },

  // ---------------------------------------------------------------------
  // I. Modul 5: Repository Hasil Diskusi Kebijakan (Knowledge Base & SOP)
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // J. Modul 6: Import Engine & Profiles (NAKER & 7 Saluran QSF)
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // K. Master Data NAKER (Tenaga Kerja & Plotting)
  // ---------------------------------------------------------------------
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

  async exportNaker(params = {}) {
    try {
      const res = await apiClient.get('/exports/naker', { params });
      return res.data;
    } catch (e) {
      return { success: false, rows: [], columns: [] };
    }
  },

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

  // ---------------------------------------------------------------------
  // L. User Management & Master NAKER Account Injection
  // ---------------------------------------------------------------------
  async getUsers(params = {}) {
    try {
      const res = await apiClient.get('/users', { params });
      return res.data;
    } catch (e) {
      return {
        success: false,
        summary: {
          total_users: 0,
          qa_count: 0,
          tl_count: 0,
          trainer_count: 0,
          agent_count: 0,
          supervisor_count: 0,
          active_count: 0,
          inactive_count: 0
        },
        data: { data: [], total: 0 }
      };
    }
  },

  async getNakerCandidates(params = {}) {
    try {
      const res = await apiClient.get('/users/naker-candidates', { params });
      return res.data;
    } catch (e) {
      return {
        success: false,
        summary: {
          total_naker: 0,
          qa_count: 0,
          tl_count: 0,
          trainer_count: 0,
          cso_count: 0,
          no_account_count: 0,
          has_account_count: 0
        },
        candidates: []
      };
    }
  },

  async syncUsersFromNaker(data = { employee_ids: [], include_cso: false }) {
    const res = await apiClient.post('/users/sync-from-naker', data);
    return res.data;
  },

  async createUser(userData) {
    const res = await apiClient.post('/users', userData);
    return res.data;
  },

  async updateUser(id, userData) {
    const res = await apiClient.put(`/users/${id}`, userData);
    return res.data;
  },

  async resetUserPassword(id, password = null) {
    const res = await apiClient.post(`/users/${id}/reset-password`, { password });
    return res.data;
  },

  async toggleUserStatus(id) {
    const res = await apiClient.post(`/users/${id}/toggle-status`);
    return res.data;
  },

  async deleteUser(id) {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },

  // ---------------------------------------------------------------------
  // M. Live Auto-Sync & Real-Time Notifications
  // ---------------------------------------------------------------------
  async getNotifications(params = {}) {
    try {
      const res = await apiClient.get('/notifications', { params });
      return res.data;
    } catch (e) {
      return { success: false, unread_count: 0, counts: {}, notifications: [] };
    }
  },

  async markNotificationsRead(id = null) {
    const res = await apiClient.post('/notifications/mark-read', { id });
    return res.data;
  },

  async clearAllNotifications() {
    const res = await apiClient.post('/notifications/clear-all');
    return res.data;
  },

  async deleteNotification(id) {
    const res = await apiClient.delete(`/notifications/${id}`);
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

export default api;
