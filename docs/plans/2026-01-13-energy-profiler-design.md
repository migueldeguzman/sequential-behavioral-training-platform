# Energy Profiler Design Document

**Date:** 2026-01-13
**Version:** 2.0.0
**Status:** Approved for Implementation

## Overview

A comprehensive energy and power profiling system for transformer inference on Apple Silicon M4 Max. The system provides real-time and post-hoc analysis of power consumption at multiple granularity levels: pipeline phases, layers, components, and individual tensor operations.

## Goals

1. **Understand model energy consumption** - Profile power draw during inference to understand where energy is spent
2. **Per-prompt analysis** - All profiling data clusters under the prompt that generated it
3. **Per-token granularity** - Track energy for each generated token
4. **Lowest-level visibility** - Profile down to individual tensor operations (QK^T, softmax, etc.)
5. **Real-time visualization** - Live dashboard during inference
6. **Historical analysis** - Store and compare past profiling runs

## Hardware Target

- Apple Silicon M4 Max with 128GB unified memory
- Power monitoring via `powermetrics` with passwordless sudo access
- Sampling at 100ms intervals

## Architecture

### Backend (Python/FastAPI)

```
backend/profiling/
├── __init__.py
├── power_monitor.py      # PowerMonitor class - wraps powermetrics
├── model_detector.py     # Auto-detect model architecture
├── layer_profiler.py     # LayerProfiler - PyTorch hooks
├── deep_profiler.py      # DeepAttentionProfiler - operation-level
├── pipeline_profiler.py  # InferencePipelineProfiler - orchestrator
└── database.py           # ProfileDatabase - SQLite storage
```

### Frontend (React/Next.js)

```
src/components/profiling/
├── EnergyProfilerPanel.tsx      # Main container
├── ProfilingContext.tsx         # React context for state
├── ProfilingControls.tsx        # Start/stop controls
├── RealTimeView.tsx             # Live visualization container
├── AnalysisView.tsx             # Post-inference analysis
├── HistoryBrowser.tsx           # Past runs browser
├── charts/
│   ├── PowerTimeSeriesChart.tsx # Real-time power graph
│   ├── LiveLayerHeatmap.tsx     # Live heatmap
│   ├── HeatmapChart.tsx         # Static heatmap
│   ├── PipelineTimeline.tsx     # Phase timeline
│   ├── TreemapChart.tsx         # Hierarchical breakdown
│   ├── SankeyChart.tsx          # Energy flow diagram
│   └── WaterfallChart.tsx       # Per-token waterfall
├── TokenSlider.tsx              # Token navigation
├── TokenGenerationStream.tsx    # Live token display
├── MetricSelector.tsx           # Metric dropdown
├── CurrentOperationIndicator.tsx # Current op display
├── DeepDrilldown.tsx            # Deep metrics modal
├── RunList.tsx                  # Run history list
├── RunDetail.tsx                # Single run detail
└── CompareView.tsx              # Multi-run comparison
```

## Data Model

### Hierarchy

```
ProfilingRun (root)
├── prompt, model, timestamp, tags
├── PowerSamples[] (100ms intervals)
├── PipelineSections[] (pre_inference, prefill, decode, post_inference)
└── Tokens[]
    ├── position, text, duration, energy
    └── LayerMetrics[]
        ├── layer_index, timing, activation stats
        └── ComponentMetrics[]
            ├── component_name (q_proj, k_proj, etc.)
            └── DeepOperationMetrics[] (if enabled)
                └── operation_name (qk_matmul, softmax, etc.)
```

### Database Schema

```sql
profiling_runs (id, prompt, model_path, created_at, total_duration_ms, total_energy_mj, tags, experiment_name)
power_samples (id, run_id, timestamp_ms, cpu_power_mw, gpu_power_mw, ane_power_mw, dram_power_mw, total_power_mw)
pipeline_sections (id, run_id, phase, section_name, start_ms, end_ms, duration_ms, energy_mj)
tokens (id, run_id, position, text, phase, duration_ms, energy_mj, power_snapshot_mw)
layer_metrics (id, token_id, layer_index, total_time_ms, attention_time_ms, mlp_time_ms, activation_mean/std/max/sparsity)
component_metrics (id, layer_metric_id, component_name, time_ms, activation_mean/std/max/sparsity)
deep_operation_metrics (id, component_metric_id, operation_name, time_ms, flops_estimate, tensor_mean/std/max, extra_metrics)
```

## Inference Pipeline Sections

### Pre-Inference
- Tokenization (tokenizer.encode)
- Tensor transfer to device
- KV-cache initialization

### Prefill Phase
- Embedding lookup
- Position embedding
- All transformer layers (hooked)
- Final LayerNorm
- LM Head projection
- KV-cache storage

### Decode Phase (per token)
- Embedding lookup
- Position embedding
- All transformer layers (hooked)
- Final LayerNorm
- LM Head projection
- Sampling (temperature, top_k, top_p)
- KV-cache append

### Post-Inference
- Tensor transfer to CPU
- Detokenization
- Memory cleanup

## Component Hooks

### Module Level (LayerProfiler)
- Attention: q_proj, k_proj, v_proj, o_proj
- MLP: gate_proj, up_proj, down_proj
- LayerNorms: input_layernorm, post_attention_layernorm

### Deep Operation Level (DeepAttentionProfiler)
- Attention: qk_matmul, scale, mask_apply, softmax, attn_dropout, value_matmul
- Extra metrics: attention_entropy, max_attention_weight, attention_sparsity
- MLP: activation_kill_ratio
- LayerNorm: variance_ratio

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/profiling/generate | Run profiled inference |
| GET | /api/profiling/runs | List runs with filters |
| GET | /api/profiling/run/{id} | Get full run data |
| GET | /api/profiling/run/{id}/summary | Get aggregated stats |
| GET | /api/profiling/run/{id}/pipeline | Get pipeline breakdown |
| GET | /api/profiling/export/{id}?format=json\|csv | Export data |
| DELETE | /api/profiling/run/{id} | Delete run |
| WS | /ws/profiling | Real-time streaming |

## WebSocket Message Types

- `power_sample` - Periodic power readings
- `section_start` / `section_end` - Pipeline section events
- `token_complete` - Token generated with metrics
- `layer_metrics` - Per-layer breakdown
- `component_metrics` - Per-component breakdown
- `operation_metrics` - Deep operation metrics
- `inference_complete` - Final summary

## Visualizations

1. **Pipeline Timeline** - Horizontal bars for phases, sized by duration/energy
2. **Power Time Series** - Live/static plot of CPU, GPU, ANE, DRAM, Total power
3. **Layer x Component Heatmap** - Color intensity = selected metric
4. **Hierarchical Treemap** - Phase > Layer > Component > Operation breakdown
5. **Sankey Flow Diagram** - Energy flow through model architecture
6. **Token Waterfall** - Per-token stacked bars with cumulative line

## Implementation Notes

### PowerMonitor
- Command: `sudo powermetrics --samplers cpu_power,gpu_power,ane_power --sample-interval 100 --format plist`
- Sudoers entry: `username ALL=(ALL) NOPASSWD: /usr/bin/powermetrics`
- Background thread for continuous sampling

### LayerProfiler
- Use `torch.mps.synchronize()` before/after timing for Apple Silicon accuracy
- Sparsity threshold configurable (default 0.01)
- Context manager for automatic cleanup

### DeepAttentionProfiler
- Two approaches: monkey-patch or custom wrapper
- Config flag: `profiling_depth = 'module' | 'deep'`
- Both available, selectable per run

## Task Breakdown

See `plans/prd.json` for complete 73-task breakdown:
- CRITICAL: 26 tasks
- HIGH: 30 tasks
- MEDIUM: 13 tasks
- LOW: 4 tasks

## Success Criteria

1. Profiled inference completes without errors
2. Power data correlates with expected patterns (GPU high during compute)
3. Per-token energy varies based on content complexity
4. Visualizations render correctly with real data
5. Historical data persists and queries correctly
6. Profiling overhead < 10% of inference time
