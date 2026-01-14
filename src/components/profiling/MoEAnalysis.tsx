/**
 * MoE (Mixture of Experts) Energy Analysis Component
 *
 * Displays energy efficiency analysis for MoE models, including:
 * - Parameter efficiency (effective vs total params)
 * - Expert utilization and load balance
 * - Energy savings vs dense models
 *
 * Based on TokenPowerBench research: MoE models use 2-3× less energy than
 * dense models with similar quality by activating only a subset of experts per token.
 */

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface MoEAnalysisProps {
  runId: string;
}

interface ExpertActivation {
  token_index: number;
  token_text: string;
  layer_index: number;
  active_expert_ids: string;
  num_active_experts: number;
  expert_weights: string | null;
  routing_entropy: number | null;
  load_balance_loss: number | null;
}

interface ExpertUtilization {
  activation_count: number;
  utilization_percent: number;
}

interface LoadBalance {
  expert_utilization: { [expertId: string]: ExpertUtilization };
  load_balance_score: number;
  total_activations: number;
  num_experts_used: number;
  notes: string[];
}

interface MoEAnalysisData {
  run_id: string;
  model_name: string;
  is_moe: boolean;
  architecture_type?: string;
  num_experts?: number;
  num_active_experts?: number;
  total_params?: number;
  effective_params_per_token?: number;
  param_efficiency?: number;
  expert_activations?: ExpertActivation[];
  load_balance?: LoadBalance;
  notes: string[];
}

const MoEAnalysis: React.FC<MoEAnalysisProps> = ({ runId }) => {
  const [analysisData, setAnalysisData] = useState<MoEAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMoEAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getMoEAnalysis(runId);
        if (response.data) {
          setAnalysisData(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch MoE analysis:', err);
        setError(err instanceof Error ? err.message : 'Failed to load MoE analysis');
      } finally {
        setLoading(false);
      }
    };

    if (runId) {
      fetchMoEAnalysis();
    }
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading MoE analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!analysisData) {
    return null;
  }

  if (!analysisData.is_moe) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">MoE Analysis</h3>
        <div className="text-gray-400">
          <p className="mb-2">Model: {analysisData.model_name}</p>
          <p>This model is not a Mixture of Experts (MoE) model.</p>
          <p className="mt-2 text-sm">MoE analysis is only applicable to models with expert routing mechanisms.</p>
        </div>
      </div>
    );
  }

  const { load_balance } = analysisData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">MoE Energy Analysis</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400">Model</div>
            <div className="text-lg font-medium">{analysisData.model_name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Architecture</div>
            <div className="text-lg font-medium">{analysisData.architecture_type || 'Unknown'}</div>
          </div>
        </div>
      </div>

      {/* Parameter Efficiency */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold mb-4">Parameter Efficiency</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400">Total Experts</div>
            <div className="text-2xl font-bold text-blue-400">{analysisData.num_experts || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Active per Token</div>
            <div className="text-2xl font-bold text-green-400">{analysisData.num_active_experts || 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Parameters</div>
            <div className="text-2xl font-bold text-purple-400">
              {analysisData.total_params ? (analysisData.total_params / 1e9).toFixed(2) + 'B' : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Effective Parameters</div>
            <div className="text-2xl font-bold text-orange-400">
              {analysisData.effective_params_per_token
                ? (analysisData.effective_params_per_token / 1e9).toFixed(2) + 'B'
                : 'N/A'}
            </div>
          </div>
        </div>

        {analysisData.param_efficiency && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Parameter Utilization</span>
              <span className="text-sm font-medium">{(analysisData.param_efficiency * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full"
                style={{ width: `${analysisData.param_efficiency * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Load Balance */}
      {load_balance && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">Expert Load Balance</h4>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-400">Load Balance Score</div>
              <div className="text-2xl font-bold text-green-400">
                {load_balance.load_balance_score.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">1.0 = perfect balance</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Total Activations</div>
              <div className="text-2xl font-bold text-blue-400">
                {load_balance.total_activations.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Experts Used</div>
              <div className="text-2xl font-bold text-purple-400">
                {load_balance.num_experts_used} / {analysisData.num_experts || 'N/A'}
              </div>
            </div>
          </div>

          {/* Expert Utilization Chart */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-300 mb-2">Expert Utilization</div>
            {Object.entries(load_balance.expert_utilization)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([expertId, utilization]) => (
                <div key={expertId} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-gray-400">Expert {expertId}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                        style={{ width: `${utilization.utilization_percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm text-gray-400">
                    {utilization.utilization_percent.toFixed(1)}%
                  </div>
                  <div className="w-16 text-right text-xs text-gray-500">
                    ({utilization.activation_count})
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {analysisData.notes && analysisData.notes.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 text-blue-400">Research Notes</h4>
          <ul className="space-y-1 text-sm text-gray-300">
            {analysisData.notes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MoEAnalysis;
