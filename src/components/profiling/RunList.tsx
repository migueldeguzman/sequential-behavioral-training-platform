'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProfilingRun, ProfilingRunsFilter } from '@/types';
import { api } from '@/lib/api';

interface RunListProps {
  onSelectRun: (run: ProfilingRun) => void;
  selectedRunId?: string;
}

export default function RunList({ onSelectRun, selectedRunId }: RunListProps) {
  const [runs, setRuns] = useState<ProfilingRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);

  // Sort state
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'energy' | 'efficiency'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filter: ProfilingRunsFilter = {
      limit: pageSize,
      offset: currentPage * pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    if (modelFilter) filter.model = modelFilter;
    if (tagFilter) filter.tags = tagFilter.split(',').map(t => t.trim());
    if (dateFromFilter) filter.date_from = dateFromFilter;
    if (dateToFilter) filter.date_to = dateToFilter;

    try {
      const response = await api.getProfilingRuns(filter);

      if (response.success && response.data) {
        let filteredRuns = response.data.runs;

        // Client-side search filter for prompt text
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredRuns = filteredRuns.filter(run =>
            run.prompt.toLowerCase().includes(query)
          );
        }

        setRuns(filteredRuns);
        setTotal(response.data.total);
      } else {
        setError(response.error || 'Failed to fetch profiling runs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, modelFilter, tagFilter, dateFromFilter, dateToFilter, currentPage, pageSize, sortBy, sortOrder]);

  // Fetch runs when filters change
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setModelFilter('');
    setTagFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(0);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEnergy = (energyMj: number) => {
    if (energyMj >= 1000) {
      return `${(energyMj / 1000).toFixed(2)} J`;
    }
    return `${energyMj.toFixed(1)} mJ`;
  };

  const formatDuration = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)} s`;
    }
    return `${ms.toFixed(0)} ms`;
  };

  const truncatePrompt = (prompt: string, maxLength: number = 60) => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + '...';
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full">
      {/* Header and Filters */}
      <div className="border-b border-gray-700 pb-4 mb-4">
        <h2 className="text-lg font-semibold text-white mb-4">Profiling History</h2>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search by prompt text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="text"
            placeholder="Filter by model..."
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Filter by tags (comma-separated)..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="date"
            placeholder="From date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="date"
            placeholder="To date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sort Options */}
        <div className="flex gap-2 items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'duration' | 'energy' | 'efficiency')}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="duration">Sort by Duration</option>
            <option value="energy">Sort by Energy</option>
            <option value="efficiency">Sort by Efficiency</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white hover:bg-gray-700"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <button
            onClick={handleClearFilters}
            className="ml-auto px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-8 text-gray-400">
          Loading runs...
        </div>
      )}

      {/* Runs List */}
      {!loading && runs.length === 0 && (
        <div className="flex justify-center items-center py-8 text-gray-400">
          No profiling runs found
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              onClick={() => onSelectRun(run)}
              className={`p-3 rounded border cursor-pointer transition-colors ${
                selectedRunId === run.id
                  ? 'bg-blue-900/20 border-blue-600'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750'
              }`}
            >
              {/* Date and Model */}
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-400">
                  {formatDate(run.timestamp)}
                </span>
                <span className="text-xs text-blue-400 font-mono">
                  {run.model_name || 'unknown'}
                </span>
              </div>

              {/* Prompt Preview */}
              <p className="text-sm text-white mb-2 font-medium">
                {truncatePrompt(run.prompt)}
              </p>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div>
                  <span className="text-gray-400">Duration: </span>
                  <span className="text-white">{formatDuration(run.total_duration_ms)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Energy: </span>
                  <span className="text-white">{formatEnergy(run.total_energy_mj)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Tokens: </span>
                  <span className="text-white">
                    {run.input_tokens + run.output_tokens}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {run.tags && run.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {run.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-400">
              Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, total)} of {total}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                Previous
              </button>

              <span className="px-3 py-1 text-gray-400">
                Page {currentPage + 1} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
