/**
 * InputOutputEnergyComparison Component
 *
 * Displays a comparison of energy consumption between input tokens (prefill phase)
 * and output tokens (decode phase). Based on research showing output tokens consume
 * significantly more energy (~11x) than input tokens.
 *
 * Reference: Caravaca et al. 2025 - "From Prompts to Power"
 */

import React from 'react';

interface TokenEnergyBreakdown {
  input_energy_mj: number;
  output_energy_mj: number;
  input_token_count: number;
  output_token_count: number;
  energy_per_input_token_mj: number;
  energy_per_output_token_mj: number;
  output_to_input_energy_ratio: number;
}

interface InputOutputEnergyComparisonProps {
  breakdown: TokenEnergyBreakdown;
}

export const InputOutputEnergyComparison: React.FC<InputOutputEnergyComparisonProps> = ({
  breakdown
}) => {
  const {
    input_energy_mj,
    output_energy_mj,
    input_token_count,
    output_token_count,
    energy_per_input_token_mj,
    energy_per_output_token_mj,
    output_to_input_energy_ratio
  } = breakdown;

  const total_energy = input_energy_mj + output_energy_mj;
  const input_percentage = total_energy > 0 ? (input_energy_mj / total_energy) * 100 : 0;
  const output_percentage = total_energy > 0 ? (output_energy_mj / total_energy) * 100 : 0;

  return (
    <div className="input-output-energy-comparison">
      <h3>Input vs Output Token Energy</h3>

      <div className="energy-bars">
        <div className="energy-bar-container">
          <div className="energy-bar-label">
            <span>Input Tokens (Prefill)</span>
            <span className="token-count">{input_token_count} tokens</span>
          </div>
          <div className="energy-bar-wrapper">
            <div
              className="energy-bar input-bar"
              style={{ width: `${input_percentage}%` }}
            />
            <span className="energy-value">{input_energy_mj.toFixed(2)} mJ</span>
          </div>
          <div className="per-token-metric">
            {energy_per_input_token_mj.toFixed(3)} mJ/token
          </div>
        </div>

        <div className="energy-bar-container">
          <div className="energy-bar-label">
            <span>Output Tokens (Decode)</span>
            <span className="token-count">{output_token_count} tokens</span>
          </div>
          <div className="energy-bar-wrapper">
            <div
              className="energy-bar output-bar"
              style={{ width: `${output_percentage}%` }}
            />
            <span className="energy-value">{output_energy_mj.toFixed(2)} mJ</span>
          </div>
          <div className="per-token-metric">
            {energy_per_output_token_mj.toFixed(3)} mJ/token
          </div>
        </div>
      </div>

      <div className="ratio-summary">
        <div className="ratio-card">
          <div className="ratio-label">Output/Input Energy Ratio</div>
          <div className="ratio-value">
            {output_to_input_energy_ratio.toFixed(2)}x
          </div>
          <div className="ratio-description">
            Output tokens consume <strong>{output_to_input_energy_ratio.toFixed(1)}x</strong> more energy than input tokens
          </div>
        </div>

        <div className="breakdown-stats">
          <div className="stat">
            <span className="stat-label">Total Energy</span>
            <span className="stat-value">{total_energy.toFixed(2)} mJ</span>
          </div>
          <div className="stat">
            <span className="stat-label">Input Share</span>
            <span className="stat-value">{input_percentage.toFixed(1)}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Output Share</span>
            <span className="stat-value">{output_percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-output-energy-comparison {
          padding: 1.5rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a202c;
        }

        .energy-bars {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .energy-bar-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .energy-bar-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          font-weight: 500;
          color: #4a5568;
        }

        .token-count {
          font-size: 0.75rem;
          color: #718096;
        }

        .energy-bar-wrapper {
          position: relative;
          height: 40px;
          background: #edf2f7;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        .energy-bar {
          height: 100%;
          transition: width 0.3s ease;
        }

        .input-bar {
          background: linear-gradient(90deg, #4299e1, #3182ce);
        }

        .output-bar {
          background: linear-gradient(90deg, #f6ad55, #ed8936);
        }

        .energy-value {
          position: absolute;
          right: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #2d3748;
          z-index: 1;
        }

        .per-token-metric {
          font-size: 0.75rem;
          color: #718096;
          text-align: right;
        }

        .ratio-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e2e8f0;
        }

        .ratio-card {
          padding: 1rem;
          background: #f7fafc;
          border-radius: 6px;
          text-align: center;
        }

        .ratio-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .ratio-value {
          font-size: 2rem;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .ratio-description {
          font-size: 0.75rem;
          color: #4a5568;
          line-height: 1.4;
        }

        .breakdown-stats {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f7fafc;
          border-radius: 6px;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
        }

        .stat-value {
          font-size: 0.875rem;
          font-weight: 600;
          color: #2d3748;
        }

        @media (max-width: 768px) {
          .ratio-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
