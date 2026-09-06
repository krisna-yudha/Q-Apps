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

// Policy Discussions (View 7)
Route::get('/policy-discussions', [PolicyDiscussionController::class, 'index']);
Route::post('/policy-discussions', [PolicyDiscussionController::class, 'store']);
Route::patch('/policy-discussions/{id}/toggle', [PolicyDiscussionController::class, 'toggleStatus']);
Route::delete('/policy-discussions/{id}', [PolicyDiscussionController::class, 'destroy']);

use App\Http\Controllers\Api\EmployeeController;

// Master Data Tenaga Kerja (NAKER) Endpoints
Route::get('/employees', [EmployeeController::class, 'index']);
Route::get('/employees/{id}', [EmployeeController::class, 'show']);
Route::get('/naker', [EmployeeController::class, 'index']);

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

// Notifications & Live Sync
Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/mark-read', [NotificationController::class, 'markRead']);
Route::get('/system/sync-status', [NotificationController::class, 'syncStatus']);

// Auth Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
