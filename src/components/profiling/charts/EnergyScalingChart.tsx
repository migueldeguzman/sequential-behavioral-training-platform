'use client';

import React, { useRef, useEffect, useState } from 'react';

interface ScalingDataPoint {
  run_id: string;
  model_name: string;
  total_params: number;
  total_params_millions: number;
  total_energy_mj: number;
  energy_per_million_params: number;
  joules_per_token: number;
}

interface PowerLawFit {
  coefficient_a: number;
  exponent_b: number;
  formula: string;
  r_squared: number | null;
  interpretation: string;
}

interface ScalingEfficiency {
  smallest_model: {
    name: string;
    params_millions: number;
    energy_per_million_params: number;
  };
  largest_model: {
    name: string;
    params_millions: number;
    energy_per_million_params: number;
  };
  efficiency_gain_pct: number;
  conclusion: string;
}

interface EnergyScalingChartProps {
  scalingData: ScalingDataPoint[];
  powerLawFit: PowerLawFit | null;
  scalingEfficiency: ScalingEfficiency | null;
}

const EnergyScalingChart: React.FC<EnergyScalingChartProps> = ({
  scalingData,
  powerLawFit,
  scalingEfficiency,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ScalingDataPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scalingData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 60, right: 40, bottom: 70, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find data ranges
    const params = scalingData.map((d) => d.total_params_millions);
    const energies = scalingData.map((d) => d.total_energy_mj);

    const minParams = Math.min(...params);
    const maxParams = Math.max(...params);
    const minEnergy = Math.min(...energies);
    const maxEnergy = Math.max(...energies);

    // Add 10% padding to ranges
    const paramRange = maxParams - minParams;
    const energyRange = maxEnergy - minEnergy;
    const xMin = Math.max(0, minParams - paramRange * 0.1);
    const xMax = maxParams + paramRange * 0.1;
    const yMin = Math.max(0, minEnergy - energyRange * 0.1);
    const yMax = maxEnergy + energyRange * 0.1;

    // Draw axes
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = height - padding.bottom - (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw axis labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels (millions of parameters)
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      const value = xMin + (xMax - xMin) * (i / 5);
      const label = value >= 1000 ? `${(value / 1000).toFixed(1)}B` : `${value.toFixed(0)}M`;
      ctx.fillText(label, x, height - padding.bottom + 20);
    }

    // Y-axis labels (millijoules)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = height - padding.bottom - (chartHeight / 5) * i;
      const value = yMin + (yMax - yMin) * (i / 5);
      ctx.fillText(value.toFixed(0), padding.left - 10, y + 4);
    }

    // Axis titles
    ctx.fillStyle = '#D1D5DB';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Model Size (parameters)', width / 2, height - 5);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Total Energy (mJ)', 0, 0);
    ctx.restore();

    // Draw title
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('Energy Scaling Analysis', width / 2, 25);

    // Draw subtitle with scaling interpretation
    if (powerLawFit) {
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(powerLawFit.formula, width / 2, 45);
    }

    // Draw power-law curve if available
    if (powerLawFit) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();

      for (let i = 0; i <= 100; i++) {
        const paramValue = xMin + (xMax - xMin) * (i / 100);
        const energyValue = powerLawFit.coefficient_a * Math.pow(paramValue, powerLawFit.exponent_b);

        const x = padding.left + ((paramValue - xMin) / (xMax - xMin)) * chartWidth;
        const y = height - padding.bottom - ((energyValue - yMin) / (yMax - yMin)) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw data points
    scalingData.forEach((point) => {
      const x = padding.left + ((point.total_params_millions - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.total_energy_mj - yMin) / (yMax - yMin)) * chartHeight;

      // Color based on energy per million params (efficiency)
      const energyPerMParam = point.energy_per_million_params;
      const maxEff = Math.max(...scalingData.map((d) => d.energy_per_million_params));
      const minEff = Math.min(...scalingData.map((d) => d.energy_per_million_params));
      const normalizedEff = (energyPerMParam - minEff) / (maxEff - minEff);

      // Color gradient from green (efficient) to red (inefficient)
      const r = Math.floor(50 + 205 * normalizedEff);
      const g = Math.floor(200 - 150 * normalizedEff);
      const b = 50;

      // Draw point
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fill();

      // Draw outline
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw legend for curve
    if (powerLawFit) {
      const legendX = padding.left + 10;
      const legendY = padding.top + 10;

      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 30, legendY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Power-law fit', legendX + 35, legendY + 4);

      // Show R² if available
      if (powerLawFit.r_squared !== null) {
        ctx.fillText(`R² = ${powerLawFit.r_squared.toFixed(3)}`, legendX + 35, legendY + 18);
      }
    }

    // Draw efficiency gradient legend
    const legendX = width - padding.right - 160;
    const legendY = padding.top + 10;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.fillText('Energy/Param:', legendX, legendY);

    // Draw gradient bar
    const gradientWidth = 100;
    const gradientHeight = 15;
    const gradient = ctx.createLinearGradient(legendX, legendY + 5, legendX + gradientWidth, legendY + 5);
    gradient.addColorStop(0, 'rgb(50, 200, 50)');
    gradient.addColorStop(0.5, 'rgb(200, 200, 50)');
    gradient.addColorStop(1, 'rgb(255, 50, 50)');

    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY + 5, gradientWidth, gradientHeight);
    ctx.strokeStyle = '#6B7280';
    ctx.strokeRect(legendX, legendY + 5, gradientWidth, gradientHeight);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Efficient', legendX, legendY + gradientHeight + 18);
    ctx.textAlign = 'right';
    ctx.fillText('Inefficient', legendX + gradientWidth, legendY + gradientHeight + 18);
  }, [scalingData, powerLawFit]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const padding = { top: 60, right: 40, bottom: 70, left: 80 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    const params = scalingData.map((d) => d.total_params_millions);
    const energies = scalingData.map((d) => d.total_energy_mj);

    const minParams = Math.min(...params);
    const maxParams = Math.max(...params);
    const minEnergy = Math.min(...energies);
    const maxEnergy = Math.max(...energies);

    const paramRange = maxParams - minParams;
    const energyRange = maxEnergy - minEnergy;
    const xMin = Math.max(0, minParams - paramRange * 0.1);
    const xMax = maxParams + paramRange * 0.1;
    const yMin = Math.max(0, minEnergy - energyRange * 0.1);
    const yMax = maxEnergy + energyRange * 0.1;

    let foundPoint: ScalingDataPoint | null = null;
    for (const point of scalingData) {
      const x = padding.left + ((point.total_params_millions - xMin) / (xMax - xMin)) * chartWidth;
      const y = rect.height - padding.bottom - ((point.total_energy_mj - yMin) / (yMax - yMin)) * chartHeight;

      const distance = Math.sqrt(
        Math.pow(e.clientX - rect.left - x, 2) + Math.pow(e.clientY - rect.top - y, 2)
      );
      if (distance < 12) {
        foundPoint = point;
        break;
      }
    }
    setHoveredPoint(foundPoint);
  };

  return (
    <div className="w-full h-full">
      <div className="relative w-full" style={{ height: '500px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        />

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg pointer-events-none z-10"
            style={{
              left: mousePos.x + 10,
              top: mousePos.y + 10,
            }}
          >
            <div className="text-xs space-y-1">
              <div className="font-semibold text-white">{hoveredPoint.model_name}</div>
              <div className="text-gray-400">
                Params: {hoveredPoint.total_params_millions.toFixed(0)}M (
                {(hoveredPoint.total_params / 1e9).toFixed(2)}B)
              </div>
              <div className="text-gray-400">
                Total Energy: {hoveredPoint.total_energy_mj.toFixed(0)} mJ
              </div>
              <div className="text-yellow-400">
                Energy/MParam: {hoveredPoint.energy_per_million_params.toFixed(4)} mJ/M
              </div>
              <div className="text-green-400">J/token: {hoveredPoint.joules_per_token.toFixed(6)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Interpretation panel */}
      <div className="mt-6 space-y-4">
        {powerLawFit && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Power-Law Fit Analysis</h3>
            <div className="space-y-2 text-xs text-gray-300">
              <div>
                <span className="text-gray-400">Formula:</span> {powerLawFit.formula}
              </div>
              <div>
                <span className="text-gray-400">Scaling Exponent (b):</span>{' '}
                <span className="font-mono text-blue-400">{powerLawFit.exponent_b.toFixed(4)}</span>
              </div>
              {powerLawFit.r_squared !== null && (
                <div>
                  <span className="text-gray-400">R² (goodness of fit):</span>{' '}
                  <span className="font-mono text-green-400">{powerLawFit.r_squared.toFixed(4)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-700">
                <span className="text-gray-400">Interpretation:</span>
                <p className="mt-1 text-gray-300">{powerLawFit.interpretation}</p>
              </div>
            </div>
          </div>
        )}

        {scalingEfficiency && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Scaling Efficiency Comparison</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-gray-400 mb-1">Smallest Model</div>
                <div className="text-white font-semibold">{scalingEfficiency.smallest_model.name}</div>
                <div className="text-gray-300">
                  {scalingEfficiency.smallest_model.params_millions.toFixed(0)}M params
                </div>
                <div className="text-yellow-400">
                  {scalingEfficiency.smallest_model.energy_per_million_params.toFixed(4)} mJ/MParam
                </div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Largest Model</div>
                <div className="text-white font-semibold">{scalingEfficiency.largest_model.name}</div>
                <div className="text-gray-300">
                  {scalingEfficiency.largest_model.params_millions.toFixed(0)}M params
                </div>
                <div className="text-yellow-400">
                  {scalingEfficiency.largest_model.energy_per_million_params.toFixed(4)} mJ/MParam
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-gray-300">{scalingEfficiency.conclusion}</div>
              <div className="mt-1 text-sm">
                <span
                  className={`font-semibold ${
                    scalingEfficiency.efficiency_gain_pct > 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {scalingEfficiency.efficiency_gain_pct > 0 ? '+' : ''}
                  {scalingEfficiency.efficiency_gain_pct.toFixed(1)}%
                </span>
                <span className="text-gray-400"> efficiency difference</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnergyScalingChart;
