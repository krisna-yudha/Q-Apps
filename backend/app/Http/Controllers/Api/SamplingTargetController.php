<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\SamplingPeriod;
use App\Models\SamplingTarget;
use App\Models\SamplingTargetCso;
use App\Services\Sampling\SamplingTargetEngineService;
use Illuminate\Http\Request;

class SamplingTargetController extends Controller
{
    /**
     * List all sampling periods.
     * GET /api/sampling/periods
     */
    public function periods()
    {
        $periods = SamplingPeriod::orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get();

        if ($periods->isEmpty()) {
            SamplingTargetEngineService::getOrCreatePeriod('2026-08');
            $periods = SamplingPeriod::orderBy('year', 'desc')
                ->orderBy('month', 'desc')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $periods,
        ]);
    }

    /**
     * Create a new sampling period.
     * POST /api/sampling/periods
     */
    public function storePeriod(Request $request)
    {
        $request->validate([
            'period_code' => 'required|string|regex:/^\d{4}-\d{2}$/',
            'name' => 'nullable|string',
            'target_ca' => 'nullable|numeric|min:0|max:100',
            'target_fcr' => 'nullable|numeric|min:0|max:100',
        ]);

        $periodCode = $request->period_code;
        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        if ($request->has('target_ca')) {
            $period->target_ca = (float)$request->target_ca;
        }
        if ($request->has('target_fcr')) {
            $period->target_fcr = (float)$request->target_fcr;
        }
        if ($request->has('name')) {
            $period->name = $request->name;
        }
        $period->save();

        return response()->json([
            'success' => true,
            'message' => "Periode sampling {$period->period_code} berhasil dibuat/diperbarui.",
            'data' => $period,
        ]);
    }

    /**
     * Generate snapshot targets for a period.
     * POST /api/sampling/periods/{period}/generate-target
     */
    public function generateTarget(string $period)
    {
        $result = SamplingTargetEngineService::generatePeriodTargets($period);

        return response()->json([
            'success' => true,
            'message' => "Target sampling untuk periode {$period} berhasil di-generate.",
            'data' => $result,
        ]);
    }

    /**
     * Get macro site target overview (Segment 2-D).
     * GET /api/sampling/targets/site?period=2026-08
     */
    public function siteSummary(Request $request)
    {
        $period = $request->query('period', now()->format('Y-m'));
        $summary = SamplingTargetEngineService::getSiteSummary($period);

        return response()->json([
            'success' => true,
            'data' => $summary,
        ]);
    }

    /**
     * Get evaluator target breakdown.
     * GET /api/sampling/targets/evaluators?period=2026-08&type=all
     */
    public function evaluators(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $type = $request->query('type', 'all');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);
        SamplingTargetEngineService::syncActuals($periodCode);

        $query = SamplingTarget::where('sampling_period_id', $period->id);
        if ($type !== 'all') {
            $query->where('type', strtoupper($type) === 'QA' ? 'QA' : 'Trainer');
        }

        $targets = $query->get();
        if ($targets->isEmpty()) {
            SamplingTargetEngineService::generatePeriodTargets($periodCode);
            $targets = $query->get();
        }

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'data' => $targets,
        ]);
    }

    /**
     * Get CSO sampling matrix (173 CSO target breakdown).
     * GET /api/sampling/targets/cso?period=2026-08&qa=QA.INBOUND
     */
    public function csoTargets(Request $request)
    {
        $periodCode = $request->query('period', now()->format('Y-m'));
        $qaName = $request->query('qa');

        $period = SamplingTargetEngineService::getOrCreatePeriod($periodCode);

        $targetQuery = SamplingTarget::where('sampling_period_id', $period->id);
        if ($qaName) {
            $targetQuery->where('evaluator_name', $qaName);
        }
        $targetIds = $targetQuery->pluck('id');

        $csoMatrix = SamplingTargetCso::with('agent')
            ->whereIn('sampling_target_id', $targetIds)
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->id,
                    'agent_id' => $row->agent_id,
                    'agent_name' => $row->agent ? $row->agent->name : '-',
                    'nik' => $row->agent ? $row->agent->nik : '-',
                    'channel' => $row->agent ? $row->agent->channel : '-',
                    'target_sampling' => $row->target_sampling,
                    'actual_sampling' => $row->actual_sampling,
                    'gap' => max(0, $row->target_sampling - $row->actual_sampling),
                    'achievement_pct' => $row->target_sampling > 0 ? round(($row->actual_sampling / $row->target_sampling) * 100, 1) : 0.0,
                ];
            });

        return response()->json([
            'success' => true,
            'period' => $periodCode,
            'total_cso' => $csoMatrix->count(),
            'data' => $csoMatrix,
        ]);
    }
}
