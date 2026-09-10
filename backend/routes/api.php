<?php

use App\Http\Controllers\Api\AgentRecapController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EvaluatorSamplingController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PolicyDiscussionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// System Health Check
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'server_time' => now()->toIso8601String(),
        'app' => 'digiQA Enterprise'
    ]);
});

// Public Auth Routes
Route::post('/login', [AuthController::class, 'login']);

// User Profile & Password Updates
Route::post('/user/profile', [AuthController::class, 'updateProfile']);
Route::post('/user/password', [AuthController::class, 'updatePassword']);

// Protected / Public Data API Endpoints (accessible for QA dashboards)
Route::get('/dashboard/global', [DashboardController::class, 'globalDashboard']);
Route::get('/dashboard/anev', [DashboardController::class, 'anevRanking']);
Route::get('/dashboard/parameters-low', [DashboardController::class, 'parameterFailures']);

// Agent Recap & Excel Import / Clear Endpoints (View 5)
Route::get('/agents/recap', [AgentRecapController::class, 'index']);
Route::post('/agents/preview-excel', [AgentRecapController::class, 'previewExcel']);
Route::post('/agents/import-excel', [AgentRecapController::class, 'importExcel']);
Route::post('/agents/store-manual', [AgentRecapController::class, 'storeManual']);
Route::post('/agents/clear-data', [AgentRecapController::class, 'clearData']);

// Assessment Details & Master Parameters
Route::get('/assessments/{id}/scores', [AgentRecapController::class, 'assessmentScores']);
Route::get('/services/parameters', [AgentRecapController::class, 'getServicesParameters']);

// Supervisor Hub Endpoints
Route::get('/supervisor/channel-summary', [AgentRecapController::class, 'getChannelSummary']);
Route::post('/system/reset-data', [AgentRecapController::class, 'clearData']);

// Evaluator Sampling (View 6)
Route::get('/evaluators/sampling', [EvaluatorSamplingController::class, 'index']);

// Segment 2-D: Penjabaran Target Site, QA & CSO Endpoints
use App\Http\Controllers\Api\SamplingTargetController;
use App\Http\Controllers\Api\SamplingDistributionController;

Route::get('/sampling/periods', [SamplingTargetController::class, 'periods']);
Route::post('/sampling/periods', [SamplingTargetController::class, 'storePeriod']);
Route::post('/sampling/periods/{period}/generate-target', [SamplingTargetController::class, 'generateTarget']);
Route::get('/sampling/targets/site', [SamplingTargetController::class, 'siteSummary']);
Route::get('/sampling/targets/evaluators', [SamplingTargetController::class, 'evaluators']);
Route::get('/sampling/targets/cso', [SamplingTargetController::class, 'csoTargets']);

// Segment 2-C: Auto Distribution Ticket & QA Bucket Endpoints
Route::post('/sampling/periods/{period}/distribute', [SamplingDistributionController::class, 'distribute']);
Route::get('/sampling/monitoring/qa-handling', [SamplingDistributionController::class, 'monitoringQaHandling']);
Route::get('/sampling/monitoring/audit-performance', [SamplingDistributionController::class, 'auditQaPerformance']);
Route::get('/sampling/bucket/tickets', [SamplingDistributionController::class, 'bucketTickets']);
Route::post('/sampling/assignments/{id}/start', [SamplingDistributionController::class, 'start']);
Route::post('/sampling/assignments/{id}/hold', [SamplingDistributionController::class, 'hold']);
Route::post('/sampling/assignments/{id}/complete', [SamplingDistributionController::class, 'complete']);
Route::post('/sampling/assignments/{id}/uncomplete', [SamplingDistributionController::class, 'uncomplete']);
Route::post('/sampling/assignments/{id}/skip', [SamplingDistributionController::class, 'skip']);
Route::post('/sampling/assignments/{id}/reassign', [SamplingDistributionController::class, 'reassign']);
Route::delete('/sampling/assignments/{id}', [SamplingDistributionController::class, 'destroyAssignment']);
Route::post('/sampling/assignments/bulk-delete', [SamplingDistributionController::class, 'bulkDeleteAssignments']);
Route::get('/sampling/reassignment-logs', [SamplingDistributionController::class, 'reassignmentLogs']);
Route::post('/sampling/bucket/clear', [SamplingDistributionController::class, 'clearBucket']);
Route::post('/sampling/bucket/recall', [SamplingDistributionController::class, 'recallTickets']);
Route::get('/sampling/import-batches', [SamplingDistributionController::class, 'importBatches']);
Route::post('/sampling/batches/{batchId}/rollback', [SamplingDistributionController::class, 'rollbackBatch']);
Route::post('/sampling/reset-all', [SamplingDistributionController::class, 'resetAllData']);

// Policy Discussions (View 7)
Route::get('/policy-discussions', [PolicyDiscussionController::class, 'index']);
Route::post('/policy-discussions', [PolicyDiscussionController::class, 'store']);
Route::patch('/policy-discussions/{id}/toggle', [PolicyDiscussionController::class, 'toggleStatus']);
Route::delete('/policy-discussions/{id}', [PolicyDiscussionController::class, 'destroy']);

use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\UserController;

// Master Data Tenaga Kerja (NAKER) Endpoints
Route::get('/employees', [EmployeeController::class, 'index']);
Route::get('/employees/{id}', [EmployeeController::class, 'show']);
Route::get('/naker', [EmployeeController::class, 'index']);

// User Management & NAKER Account Injection Endpoints
Route::get('/users', [UserController::class, 'index']);
Route::get('/users/naker-candidates', [UserController::class, 'nakerCandidates']);
Route::post('/users/sync-from-naker', [UserController::class, 'syncFromNaker']);
Route::post('/users', [UserController::class, 'store']);
Route::put('/users/{id}', [UserController::class, 'update']);
Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);
Route::post('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
Route::delete('/users/{id}', [UserController::class, 'destroy']);

// Import Profile Engine & NAKER / QSF Multi-Upload Endpoints
Route::get('/import-profiles', [ImportController::class, 'getProfiles']);
Route::post('/imports/preview', [ImportController::class, 'preview']);
Route::post('/imports/process', [ImportController::class, 'process']);
Route::get('/imports/history', [ImportController::class, 'getHistory']);
Route::get('/imports/{id}/errors', [ImportController::class, 'getErrors']);

// Export Endpoints — Roadmap V2: export data dari database ke JSON rows (frontend generate XLSX)
// GET /api/exports/naker?search=&service=&gender=
// GET /api/exports/qsf?channel=Inbound&period=2026-08
Route::get('/exports/naker', [ImportController::class, 'exportNaker']);
Route::get('/exports/qsf', [ImportController::class, 'exportQsf']);

// Notifications & Real-Time SSE Live Sync
Route::get('/realtime/stream', [NotificationController::class, 'stream']);
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/mark-read', [NotificationController::class, 'markRead']);
Route::post('/notifications/clear-all', [NotificationController::class, 'clearAll']);
Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
Route::get('/system/sync-status', [NotificationController::class, 'syncStatus']);

// Auth Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
