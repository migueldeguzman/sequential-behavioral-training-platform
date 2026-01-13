"""
Energy Profiler for ML Dashboard

Comprehensive energy and power profiling system for transformer inference
on Apple Silicon M4 Max.

Components:
- PowerMonitor: Wraps powermetrics for CPU/GPU/ANE/DRAM power sampling
- LayerProfiler: PyTorch hooks on transformer components
- DeepAttentionProfiler: Lowest-level tensor operation profiling
- InferencePipelineProfiler: Full start-to-finish section accounting
- ProfileDatabase: SQLite storage with prompt-centric schema
"""

__version__ = "2.0.0"
