/**
 * EP-076: Energy Efficiency Metrics Dashboard Component
 *
 * Displays comprehensive energy efficiency metrics for a profiling run.
 * Metrics are based on TokenPowerBench paper and industry best practices.
 *
 * Key metrics:
 * - Joules per token (J/t): Primary energy efficiency metric
 * - Tokens per joule: Throughput efficiency (higher is better)
 * - Power utilization: Percentage of hardware TDP utilized
 * - Input vs Output token energy: Prefill vs decode comparison
 */

import React from 'react';
import { ProfilingRunSummary } from '@/types';

interface EfficiencyMetricsCardProps {
  summary: ProfilingRunSummary | null;
  className?: string;
}

export const EfficiencyMetricsCard: React.FC<EfficiencyMetricsCardProps> = ({
  summary,
  className = '',
}) => {
  if (!summary || !summary.efficiency_metrics) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Energy Efficiency Metrics</h3>
        <p className="text-gray-500">No efficiency data available</p>
      </div>
    );
  }

  const metrics = summary.efficiency_metrics;

  // Helper to format numbers with proper precision
  const formatNumber = (value: number | null, decimals: number = 2): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  // Helper to format percentages
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate efficiency rating based on tokens per joule
  const getEfficiencyRating = (tokensPerJoule: number): { label: string; color: string } => {
    // These thresholds are rough estimates and should be calibrated with real data
    if (tokensPerJoule > 1000) return { label: 'Excellent', color: 'text-green-600' };
    if (tokensPerJoule > 500) return { label: 'Good', color: 'text-blue-600' };
    if (tokensPerJoule > 200) return { label: 'Fair', color: 'text-yellow-600' };
    return { label: 'Poor', color: 'text-red-600' };
  };

  const efficiencyRating = getEfficiencyRating(metrics.tokens_per_joule);

  return (
    <div className={`p-6 bg-white rounded-lg shadow ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Energy Efficiency Metrics</h3>

      {/* Primary Metric: Joules per Token */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600 mb-1">Primary Efficiency Metric</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(metrics.joules_per_token, 4)} J/token
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Efficiency Rating</p>
            <p className={`text-xl font-semibold ${efficiencyRating.color}`}>
              {efficiencyRating.label}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Lower is better. TokenPowerBench standardized metric.
        </p>
      </div>

      {/* Grid of metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Tokens per Joule */}
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-1">Tokens per Joule</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatNumber(metrics.tokens_per_joule, 1)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Higher is better</p>
        </div>

        {/* Power Utilization */}
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-1">Power Utilization</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatPercent(metrics.power_utilization_percentage)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Of M4 Max TDP (~90W)</p>
        </div>

        {/* Average Power */}
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-1">Average Power</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatNumber(metrics.avg_power_mw / 1000, 2)} W
          </p>
          <p className="text-xs text-gray-500 mt-1">During active inference</p>
        </div>

        {/* Total Energy per Token */}
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-1">Energy per Token</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatNumber(metrics.total_energy_per_token_mj, 2)} mJ
          </p>
          <p className="text-xs text-gray-500 mt-1">Average across all tokens</p>
        </div>
      </div>

      {/* Input vs Output Token Energy Comparison */}
      <div className="mb-4 p-4 bg-gray-50 rounded">
        <p className="text-sm font-medium text-gray-700 mb-3">Input vs Output Token Energy</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Input (Prefill)</p>
            <p className="text-lg font-semibold text-green-600">
              {formatNumber(metrics.joules_per_input_token, 4)} J/token
            </p>
            <p className="text-xs text-gray-500">
              {formatNumber(metrics.prefill_energy_per_token_mj, 2)} mJ
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Output (Decode)</p>
            <p className="text-lg font-semibold text-orange-600">
              {formatNumber(metrics.joules_per_output_token, 4)} J/token
            </p>
            <p className="text-xs text-gray-500">
              {formatNumber(metrics.decode_energy_per_token_mj, 2)} mJ
            </p>
          </div>
        </div>
        {metrics.joules_per_input_token > 0 && metrics.joules_per_output_token > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs text-gray-600">
              Output tokens consume{' '}
              <span className="font-semibold text-orange-600">
                {formatNumber(
                  metrics.joules_per_output_token / metrics.joules_per_input_token,
                  1
                )}x
              </span>{' '}
              more energy than input tokens
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Paper finding: ~11x for transformer models
            </p>
          </div>
        )}
      </div>

      {/* Energy per Million Parameters */}
      {metrics.energy_per_million_params_mj !== null && (
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-1">Energy per Million Parameters</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatNumber(metrics.energy_per_million_params_mj, 2)} mJ/M params
          </p>
          <p className="text-xs text-gray-500 mt-1">Model size normalized efficiency</p>
        </div>
      )}

      {/* Info footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Metrics based on TokenPowerBench and &ldquo;From Prompts to Power&rdquo; (Caravaca et al. 2025).
          Measured on Apple Silicon M4 Max with unified memory architecture.
        </p>
      </div>
    </div>
  );
};

export default EfficiencyMetricsCard;
