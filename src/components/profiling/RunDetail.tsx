'use client';

import React, { useState, useEffect } from 'react';
import { ProfilingRun } from '@/types';
import { api } from '@/lib/api';
import AnalysisView from './AnalysisView';

interface RunDetailProps {
  runId: string;
  onClose: () => void;
}

const RunDetail: React.FC<RunDetailProps> = ({ runId, onClose }) => {
  const [run, setRun] = useState<ProfilingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRunDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const fetchRunDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getProfilingRun(runId);

      if (response.success && response.data) {
        const { run: runData, power_samples, pipeline_sections, tokens } = response.data;

        // Combine all data into single ProfilingRun object
        const fullRun: ProfilingRun = {
          ...runData,
          power_samples: power_samples || [],
          pipeline_sections: pipeline_sections || [],
          tokens: tokens || [],
        };

        setRun(fullRun);
      } else {
        setError(response.error || 'Failed to fetch run details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    const url = api.exportProfilingRun(runId, format);
    // Open in new tab to trigger download
    window.open(url, '_blank');
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);

    try {
      const response = await api.deleteProfilingRun(runId);

      if (response.success) {
        // Close the detail view and notify parent
        onClose();
      } else {
        setError(response.error || 'Failed to delete run');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatEnergy = (energyMj: number) => {
    if (energyMj >= 1000) {
      return `${(energyMj / 1000).toFixed(3)} J`;
    }
    return `${energyMj.toFixed(2)} mJ`;
  };

  const formatDuration = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(3)} s`;
    }
    return `${ms.toFixed(0)} ms`;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div className="flex justify-center items-center h-full text-gray-600 dark:text-gray-400">
          Loading run details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Error Loading Run
            </h2>
            <button
              onClick={onClose}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <div className="flex justify-center items-center h-full text-gray-600 dark:text-gray-400">
          Run not found
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header with metadata and actions */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              Profiling Run Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formatDate(run.timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Run Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model</div>
            <div className="text-sm font-medium text-gray-800 dark:text-white font-mono">
              {run.model_name}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</div>
            <div className="text-sm font-medium text-gray-800 dark:text-white">
              {formatDuration(run.total_duration_ms)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Energy</div>
            <div className="text-sm font-medium text-gray-800 dark:text-white">
              {formatEnergy(run.total_energy_mj)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tokens</div>
            <div className="text-sm font-medium text-gray-800 dark:text-white">
              {run.input_tokens} in / {run.output_tokens} out
            </div>
          </div>
        </div>

        {/* Prompt Display */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prompt</div>
          <div className="text-sm text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700 rounded p-3 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
            {run.prompt}
          </div>
        </div>

        {/* Response Display (truncated) */}
        {run.response && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Response Preview</div>
            <div className="text-sm text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700 rounded p-3 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
              {run.response.length > 500 ? run.response.substring(0, 500) + '...' : run.response}
            </div>
          </div>
        )}

        {/* Tags */}
        {run.tags && run.tags.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tags</div>
            <div className="flex flex-wrap gap-2">
              {run.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Delete Run
          </button>
        </div>
      </div>

      {/* Analysis View (embedded) */}
      <div className="flex-1 overflow-hidden">
        <AnalysisView run={run} />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              Confirm Delete
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this profiling run? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunDetail;
