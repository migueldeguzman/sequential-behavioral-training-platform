'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useProfilingContext } from './ProfilingContext';
import type { TokenMetrics } from '@/types';

export function TokenGenerationStream() {
  const { tokens, isRunning, isProfiling } = useProfilingContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<TokenMetrics | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null);

  // Auto-scroll to latest token
  useEffect(() => {
    if (containerRef.current && tokens.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [tokens.length]);

  // Calculate energy statistics for color mapping
  const energyStats = React.useMemo(() => {
    if (tokens.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const energies = tokens.map((t) => t.energy_mj);
    const min = Math.min(...energies);
    const max = Math.max(...energies);
    const avg = energies.reduce((sum, e) => sum + e, 0) / energies.length;

    return { min, max, avg };
  }, [tokens]);

  // Calculate tokens per second
  const tokensPerSecond = React.useMemo(() => {
    if (tokens.length === 0) return 0;

    // Find first and last token timestamps
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];

    if (!firstToken || !lastToken) return 0;

    const timeRangeMs = lastToken.end_time - firstToken.start_time;
    if (timeRangeMs <= 0) return 0;

    return (tokens.length / timeRangeMs) * 1000;
  }, [tokens]);

  // Get color based on energy consumption
  const getEnergyColor = (energy_mj: number): string => {
    if (energyStats.max === energyStats.min) {
      return 'bg-blue-500';
    }

    // Normalize energy to 0-1 range
    const normalized = (energy_mj - energyStats.min) / (energyStats.max - energyStats.min);

    // Map to color scale: blue (low) -> green (medium) -> yellow (high) -> red (very high)
    if (normalized < 0.25) {
      return 'bg-blue-500';
    } else if (normalized < 0.5) {
      return 'bg-green-500';
    } else if (normalized < 0.75) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  // Get text color based on energy consumption
  const getEnergyTextColor = (energy_mj: number): string => {
    if (energyStats.max === energyStats.min) {
      return 'text-blue-100';
    }

    const normalized = (energy_mj - energyStats.min) / (energyStats.max - energyStats.min);

    if (normalized < 0.25) {
      return 'text-blue-100';
    } else if (normalized < 0.5) {
      return 'text-green-100';
    } else if (normalized < 0.75) {
      return 'text-yellow-100';
    } else {
      return 'text-red-100';
    }
  };

  // Handle token hover
  const handleTokenMouseEnter = (token: TokenMetrics, event: React.MouseEvent<HTMLSpanElement>) => {
    setHoveredToken(token);
    setHoveredPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleTokenMouseLeave = () => {
    setHoveredToken(null);
    setHoveredPosition(null);
  };

  const handleTokenMouseMove = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (hoveredToken) {
      setHoveredPosition({
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Token Generation Stream
        </h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{tokens.length}</span> tokens
          </div>
          {tokensPerSecond > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{tokensPerSecond.toFixed(2)}</span> tokens/sec
            </div>
          )}
        </div>
      </div>

      {/* Color Legend */}
      {tokens.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Energy consumption:</div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Low</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Very High</span>
            </div>
          </div>
        </div>
      )}

      {/* Token Stream Container */}
      <div
        ref={containerRef}
        className="min-h-[200px] max-h-[400px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-900/50"
      >
        {tokens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
            {isProfiling || isRunning ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Waiting for tokens...</span>
              </div>
            ) : (
              <span>Start profiling to see token generation</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 items-center">
            {tokens.map((token, index) => {
              const bgColor = getEnergyColor(token.energy_mj);
              const textColor = getEnergyTextColor(token.energy_mj);

              return (
                <span
                  key={`${token.id}-${index}`}
                  onMouseEnter={(e) => handleTokenMouseEnter(token, e)}
                  onMouseLeave={handleTokenMouseLeave}
                  onMouseMove={handleTokenMouseMove}
                  className={`inline-block px-2 py-1 rounded text-sm font-mono cursor-pointer transition-all duration-150 hover:scale-110 hover:shadow-md ${bgColor} ${textColor}`}
                >
                  {token.token_text}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredToken && hoveredPosition && (
        <div
          className="fixed z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none border border-gray-700"
          style={{
            left: `${hoveredPosition.x + 10}px`,
            top: `${hoveredPosition.y + 10}px`,
          }}
        >
          <div className="space-y-1">
            <div className="font-semibold border-b border-gray-700 pb-1 mb-1">
              Token #{hoveredToken.token_position}
            </div>
            <div>
              <span className="text-gray-400">Text:</span>{' '}
              <span className="font-mono">{hoveredToken.token_text}</span>
            </div>
            <div>
              <span className="text-gray-400">Phase:</span>{' '}
              <span className="capitalize">{hoveredToken.phase}</span>
            </div>
            <div>
              <span className="text-gray-400">Duration:</span>{' '}
              <span>{hoveredToken.duration_ms.toFixed(2)} ms</span>
            </div>
            <div>
              <span className="text-gray-400">Energy:</span>{' '}
              <span>{hoveredToken.energy_mj.toFixed(2)} mJ</span>
            </div>
            <div>
              <span className="text-gray-400">Power:</span>{' '}
              <span>{hoveredToken.power_snapshot_mw.toFixed(0)} mW</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {tokens.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Total Tokens</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {tokens.length}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Avg Energy/Token</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {energyStats.avg.toFixed(2)} mJ
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Generation Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {tokensPerSecond.toFixed(2)} tok/s
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
