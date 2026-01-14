'use client';

import React, { useRef, useEffect, useState } from 'react';

interface BatchSizeDataPoint {
  batch_size: number;
  avg_energy_per_token: number;
  tokens_per_second: number;
  sample_count?: number;
}

interface BatchSizeAnalysisProps {
  data: BatchSizeDataPoint[];
  chartType: 'energy' | 'throughput' | 'tradeoff';
  width?: number;
  height?: number;
}

const BatchSizeAnalysis: React.FC<BatchSizeAnalysisProps> = ({
  data,
  chartType,
  width = 800,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BatchSizeDataPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const padding = { top: 40, right: 40, bottom: 60, left: 70 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (chartType === 'energy') {
      drawEnergyVsBatchSize(ctx, data, canvasWidth, canvasHeight, padding, chartWidth, chartHeight);
    } else if (chartType === 'throughput') {
      drawThroughputVsBatchSize(ctx, data, canvasWidth, canvasHeight, padding, chartWidth, chartHeight);
    } else {
      drawTradeoffChart(ctx, data, canvasWidth, canvasHeight, padding, chartWidth, chartHeight);
    }
  }, [data, chartType]);

  const drawEnergyVsBatchSize = (
    ctx: CanvasRenderingContext2D,
    data: BatchSizeDataPoint[],
    width: number,
    height: number,
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number
  ) => {
    // Find data ranges
    const batchSizes = data.map(d => d.batch_size);
    const energies = data.map(d => d.avg_energy_per_token);

    const minBatch = Math.min(...batchSizes);
    const maxBatch = Math.max(...batchSizes);
    const minEnergy = Math.min(...energies);
    const maxEnergy = Math.max(...energies);

    // Add 10% padding to ranges
    const batchRange = maxBatch - minBatch;
    const energyRange = maxEnergy - minEnergy;
    const xMin = minBatch - batchRange * 0.1;
    const xMax = maxBatch + batchRange * 0.1;
    const yMin = minEnergy - energyRange * 0.1;
    const yMax = maxEnergy + energyRange * 0.1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw grid lines and labels
    const numYTicks = 5;
    const numXTicks = Math.min(data.length, 10);

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis labels and grid
    for (let i = 0; i <= numYTicks; i++) {
      const y = padding.top + (chartHeight / numYTicks) * i;
      const value = yMax - ((yMax - yMin) / numYTicks) * i;

      ctx.fillText(value.toFixed(2) + ' mJ', padding.left - 10, y);

      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xStep = Math.ceil(data.length / numXTicks);
    data.forEach((point, index) => {
      if (index % xStep === 0) {
        const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
        ctx.fillText(point.batch_size.toString(), x, height - padding.bottom + 10);
      }
    });

    // Draw line chart
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.avg_energy_per_token - yMin) / (yMax - yMin)) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw data points
    data.forEach((point) => {
      const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.avg_energy_per_token - yMin) / (yMax - yMin)) * chartHeight;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Batch Size', width / 2, height - 10);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Energy per Token (mJ)', 0, 0);
    ctx.restore();

    // Title
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Energy per Token vs Batch Size', width / 2, 20);
  };

  const drawThroughputVsBatchSize = (
    ctx: CanvasRenderingContext2D,
    data: BatchSizeDataPoint[],
    width: number,
    height: number,
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number
  ) => {
    // Find data ranges
    const batchSizes = data.map(d => d.batch_size);
    const throughputs = data.map(d => d.tokens_per_second);

    const minBatch = Math.min(...batchSizes);
    const maxBatch = Math.max(...batchSizes);
    const minThroughput = Math.min(...throughputs);
    const maxThroughput = Math.max(...throughputs);

    // Add 10% padding to ranges
    const batchRange = maxBatch - minBatch;
    const throughputRange = maxThroughput - minThroughput;
    const xMin = minBatch - batchRange * 0.1;
    const xMax = maxBatch + batchRange * 0.1;
    const yMin = minThroughput - throughputRange * 0.1;
    const yMax = maxThroughput + throughputRange * 0.1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw grid lines and labels
    const numYTicks = 5;
    const numXTicks = Math.min(data.length, 10);

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis labels and grid
    for (let i = 0; i <= numYTicks; i++) {
      const y = padding.top + (chartHeight / numYTicks) * i;
      const value = yMax - ((yMax - yMin) / numYTicks) * i;

      ctx.fillText(value.toFixed(1) + ' t/s', padding.left - 10, y);

      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xStep = Math.ceil(data.length / numXTicks);
    data.forEach((point, index) => {
      if (index % xStep === 0) {
        const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
        ctx.fillText(point.batch_size.toString(), x, height - padding.bottom + 10);
      }
    });

    // Draw line chart
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.tokens_per_second - yMin) / (yMax - yMin)) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw data points
    data.forEach((point) => {
      const x = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.tokens_per_second - yMin) / (yMax - yMin)) * chartHeight;

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Batch Size', width / 2, height - 10);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Throughput (tokens/s)', 0, 0);
    ctx.restore();

    // Title
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Throughput vs Batch Size', width / 2, 20);
  };

  const drawTradeoffChart = (
    ctx: CanvasRenderingContext2D,
    data: BatchSizeDataPoint[],
    width: number,
    height: number,
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number
  ) => {
    // Scatter plot: Throughput (x) vs Energy per Token (y)
    const throughputs = data.map(d => d.tokens_per_second);
    const energies = data.map(d => d.avg_energy_per_token);

    const minThroughput = Math.min(...throughputs);
    const maxThroughput = Math.max(...throughputs);
    const minEnergy = Math.min(...energies);
    const maxEnergy = Math.max(...energies);

    // Add 10% padding to ranges
    const throughputRange = maxThroughput - minThroughput;
    const energyRange = maxEnergy - minEnergy;
    const xMin = minThroughput - throughputRange * 0.1;
    const xMax = maxThroughput + throughputRange * 0.1;
    const yMin = minEnergy - energyRange * 0.1;
    const yMax = maxEnergy + energyRange * 0.1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw grid lines and labels
    const numYTicks = 5;
    const numXTicks = 5;

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis labels and grid
    for (let i = 0; i <= numYTicks; i++) {
      const y = padding.top + (chartHeight / numYTicks) * i;
      const value = yMax - ((yMax - yMin) / numYTicks) * i;

      ctx.fillText(value.toFixed(2) + ' mJ', padding.left - 10, y);

      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // X-axis labels and grid
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= numXTicks; i++) {
      const x = padding.left + (chartWidth / numXTicks) * i;
      const value = xMin + ((xMax - xMin) / numXTicks) * i;

      ctx.fillText(value.toFixed(1), x, height - padding.bottom + 10);

      ctx.strokeStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw scatter points
    data.forEach((point) => {
      const x = padding.left + ((point.tokens_per_second - xMin) / (xMax - xMin)) * chartWidth;
      const y = height - padding.bottom - ((point.avg_energy_per_token - yMin) / (yMax - yMin)) * chartHeight;

      // Color by batch size (gradient from blue to red)
      const batchSizes = data.map(d => d.batch_size);
      const minBatch = Math.min(...batchSizes);
      const maxBatch = Math.max(...batchSizes);
      const ratio = (point.batch_size - minBatch) / (maxBatch - minBatch);
      const r = Math.round(59 + ratio * (239 - 59));
      const g = Math.round(130 + ratio * (68 - 130));
      const b = Math.round(246 + ratio * (68 - 246));

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw batch size label
      ctx.fillStyle = '#111827';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(point.batch_size.toString(), x, y - 8);
    });

    // Labels
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Throughput (tokens/s)', width / 2, height - 10);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Energy per Token (mJ)', 0, 0);
    ctx.restore();

    // Title
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Throughput vs Energy Tradeoff', width / 2, 20);

    // Legend
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Numbers show batch size', width - padding.right - 150, padding.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Find closest data point (simple proximity check)
    const padding = { top: 40, right: 40, bottom: 60, left: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    let closestPoint: BatchSizeDataPoint | null = null;
    let minDistance = Infinity;

    const batchSizes = data.map(d => d.batch_size);
    const minBatch = Math.min(...batchSizes);
    const maxBatch = Math.max(...batchSizes);
    const batchRange = maxBatch - minBatch;
    const xMin = minBatch - batchRange * 0.1;
    const xMax = maxBatch + batchRange * 0.1;

    if (chartType === 'energy') {
      const energies = data.map(d => d.avg_energy_per_token);
      const minEnergy = Math.min(...energies);
      const maxEnergy = Math.max(...energies);
      const energyRange = maxEnergy - minEnergy;
      const yMin = minEnergy - energyRange * 0.1;
      const yMax = maxEnergy + energyRange * 0.1;

      data.forEach((point) => {
        const px = padding.left + ((point.batch_size - xMin) / (xMax - xMin)) * chartWidth;
        const py = rect.height - padding.bottom - ((point.avg_energy_per_token - yMin) / (yMax - yMin)) * chartHeight;

        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (distance < minDistance && distance < 20) {
          minDistance = distance;
          closestPoint = point;
        }
      });
    }

    setHoveredPoint(closestPoint);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: 'auto' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
        className="cursor-crosshair"
      />
      {hoveredPoint && (
        <div
          className="absolute bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-10"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10
          }}
        >
          <div>Batch Size: {hoveredPoint.batch_size}</div>
          <div>Energy/Token: {hoveredPoint.avg_energy_per_token.toFixed(3)} mJ</div>
          <div>Throughput: {hoveredPoint.tokens_per_second.toFixed(2)} t/s</div>
          {hoveredPoint.sample_count && (
            <div>Samples: {hoveredPoint.sample_count}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchSizeAnalysis;
