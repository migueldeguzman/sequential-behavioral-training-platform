'use client';

import React, { useEffect, useRef, useState } from 'react';

interface HeatmapChartProps {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
  colorScale?: {
    min: string;
    max: string;
  };
  onCellClick?: (x: number, y: number, value: number) => void;
  width?: number;
  height?: number;
}

export default function HeatmapChart({
  data,
  xLabels,
  yLabels,
  colorScale = { min: '#f0f9ff', max: '#1e40af' },
  onCellClick,
  width = 800,
  height = 600,
}: HeatmapChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    value: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Layout constants (defined outside useEffect to avoid re-render issues)
  const MARGIN = React.useMemo(() => ({ top: 40, right: 120, bottom: 80, left: 100 }), []);
  const LEGEND_WIDTH = 20;
  const LEGEND_HEIGHT = 200;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length || !xLabels.length || !yLabels.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate dimensions
    const chartWidth = width - MARGIN.left - MARGIN.right;
    const chartHeight = height - MARGIN.top - MARGIN.bottom;
    const cellWidth = chartWidth / xLabels.length;
    const cellHeight = chartHeight / yLabels.length;

    // Find min and max values for color scaling
    let minValue = Infinity;
    let maxValue = -Infinity;
    data.forEach((row) => {
      row.forEach((value) => {
        if (value < minValue) minValue = value;
        if (value > maxValue) maxValue = value;
      });
    });

    // Helper function to interpolate between colors
    const interpolateColor = (value: number): string => {
      const normalized = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);

      // Parse min color (hex to RGB)
      const minR = parseInt(colorScale.min.slice(1, 3), 16);
      const minG = parseInt(colorScale.min.slice(3, 5), 16);
      const minB = parseInt(colorScale.min.slice(5, 7), 16);

      // Parse max color (hex to RGB)
      const maxR = parseInt(colorScale.max.slice(1, 3), 16);
      const maxG = parseInt(colorScale.max.slice(3, 5), 16);
      const maxB = parseInt(colorScale.max.slice(5, 7), 16);

      // Interpolate
      const r = Math.round(minR + (maxR - minR) * normalized);
      const g = Math.round(minG + (maxG - minG) * normalized);
      const b = Math.round(minB + (maxB - minB) * normalized);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Draw heatmap cells
    data.forEach((row, yIndex) => {
      row.forEach((value, xIndex) => {
        const x = MARGIN.left + xIndex * cellWidth;
        const y = MARGIN.top + yIndex * cellHeight;

        ctx.fillStyle = interpolateColor(value);
        ctx.fillRect(x, y, cellWidth, cellHeight);

        // Draw cell border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
      });
    });

    // Draw X-axis labels
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    xLabels.forEach((label, i) => {
      const x = MARGIN.left + (i + 0.5) * cellWidth;
      const y = MARGIN.top + chartHeight + 15;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // Draw Y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yLabels.forEach((label, i) => {
      const x = MARGIN.left - 10;
      const y = MARGIN.top + (i + 0.5) * cellHeight;
      ctx.fillText(label, x, y);
    });

    // Draw color scale legend
    const legendX = width - MARGIN.right + 40;
    const legendY = MARGIN.top + (chartHeight - LEGEND_HEIGHT) / 2;

    // Draw gradient
    const gradient = ctx.createLinearGradient(0, legendY + LEGEND_HEIGHT, 0, legendY);
    gradient.addColorStop(0, colorScale.min);
    gradient.addColorStop(1, colorScale.max);
    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, LEGEND_WIDTH, LEGEND_HEIGHT);

    // Draw legend border
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, LEGEND_WIDTH, LEGEND_HEIGHT);

    // Draw legend labels
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(maxValue.toFixed(2), legendX + LEGEND_WIDTH + 5, legendY);
    ctx.fillText(minValue.toFixed(2), legendX + LEGEND_WIDTH + 5, legendY + LEGEND_HEIGHT);

    // Draw axis titles
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Components', MARGIN.left + chartWidth / 2, height - 20);

    ctx.save();
    ctx.translate(15, MARGIN.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Layers', 0, 0);
    ctx.restore();
  }, [data, xLabels, yLabels, colorScale, width, height, MARGIN]);

  // Handle mouse move for hover effect
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = width - MARGIN.left - MARGIN.right;
    const chartHeight = height - MARGIN.top - MARGIN.bottom;
    const cellWidth = chartWidth / xLabels.length;
    const cellHeight = chartHeight / yLabels.length;

    // Check if mouse is within chart area
    if (
      x >= MARGIN.left &&
      x <= MARGIN.left + chartWidth &&
      y >= MARGIN.top &&
      y <= MARGIN.top + chartHeight
    ) {
      const xIndex = Math.floor((x - MARGIN.left) / cellWidth);
      const yIndex = Math.floor((y - MARGIN.top) / cellHeight);

      if (
        xIndex >= 0 &&
        xIndex < xLabels.length &&
        yIndex >= 0 &&
        yIndex < yLabels.length &&
        data[yIndex] &&
        data[yIndex][xIndex] !== undefined
      ) {
        setHoveredCell({
          x: xIndex,
          y: yIndex,
          value: data[yIndex][xIndex],
          screenX: e.clientX,
          screenY: e.clientY,
        });
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    setHoveredCell(null);
    canvas.style.cursor = 'default';
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  // Handle click
  const handleClick = () => {
    if (!hoveredCell || !onCellClick) return;
    onCellClick(hoveredCell.x, hoveredCell.y, hoveredCell.value);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="border border-gray-200 rounded"
      />

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none"
          style={{
            left: hoveredCell.screenX + 10,
            top: hoveredCell.screenY + 10,
          }}
        >
          <div className="font-semibold">{yLabels[hoveredCell.y]}</div>
          <div className="text-gray-300">{xLabels[hoveredCell.x]}</div>
          <div className="mt-1 font-mono">{hoveredCell.value.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}
