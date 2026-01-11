"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrainingHistoryEntry, TrainingLogDetail, LogEntry } from "@/types";
import { trainingApi } from "@/lib/api";

export default function TrainingHistory() {
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<TrainingLogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const response = await trainingApi.history();
    if (response.success && response.data) {
      setHistory(response.data.history);
    } else {
      setError(response.error || "Failed to load training history");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleViewDetail = async (jobId: string) => {
    setLoadingDetail(true);
    const response = await trainingApi.historyDetail(jobId);
    if (response.success && response.data) {
      setSelectedJob(response.data);
    } else {
      setError(response.error || "Failed to load training details");
    }
    setLoadingDetail(false);
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm(`Delete training log ${jobId}?`)) return;

    const response = await trainingApi.deleteHistory(jobId);
    if (response.success) {
      await fetchHistory();
    } else {
      setError(response.error || "Failed to delete training log");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "In progress";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diffMs = endTime - startTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}m ${diffSecs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-900/30";
      case "failed":
        return "text-red-400 bg-red-900/30";
      case "stopped":
        return "text-yellow-400 bg-yellow-900/30";
      default:
        return "text-gray-400 bg-gray-900/30";
    }
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "success":
        return "text-green-400";
      default:
        return "text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Training History</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Training History</h2>
        <button
          onClick={fetchHistory}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {history.length === 0 ? (
        <div className="p-8 bg-gray-800 rounded-lg text-center text-gray-400">
          No training history available yet
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.jobId}
              className="p-4 bg-gray-800 rounded-lg border border-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-mono text-sm">{entry.jobId}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        entry.status
                      )}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Started: {formatDate(entry.startTime)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Duration: {formatDuration(entry.startTime, entry.endTime)}
                  </p>
                  {entry.datasets.length > 0 && (
                    <p className="text-gray-400 text-sm">
                      Datasets: {entry.datasets.join(", ")}
                    </p>
                  )}
                  {entry.finalLoss !== null && (
                    <p className="text-gray-400 text-sm">
                      Final Loss:{" "}
                      <span className="text-yellow-400 font-mono">
                        {entry.finalLoss.toFixed(4)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetail(entry.jobId)}
                    disabled={loadingDetail}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    View Logs
                  </button>
                  <button
                    onClick={() => handleDelete(entry.jobId)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedJob.jobId}</h3>
                <p className="text-sm text-gray-400">
                  {formatDate(selectedJob.startTime)} -{" "}
                  {selectedJob.endTime
                    ? formatDate(selectedJob.endTime)
                    : "In progress"}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Config Summary */}
            <div className="mb-4 p-3 bg-gray-900 rounded">
              <h4 className="font-medium mb-2">Training Configuration</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Datasets:</span>{" "}
                  {selectedJob.datasets.join(", ") || "N/A"}
                </div>
                <div>
                  <span className="text-gray-400">Epochs:</span>{" "}
                  {selectedJob.config.epochs || "N/A"}
                </div>
                <div>
                  <span className="text-gray-400">Learning Rate:</span>{" "}
                  {selectedJob.config.learningRate || "N/A"}
                </div>
                <div>
                  <span className="text-gray-400">Final Loss:</span>{" "}
                  <span className="text-yellow-400">
                    {selectedJob.finalLoss?.toFixed(4) || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <h4 className="font-medium mb-2">
                Training Logs ({selectedJob.logs?.length || 0} entries)
              </h4>
              <div className="flex-1 overflow-y-auto bg-gray-950 rounded-lg p-4 font-mono text-sm">
                {!selectedJob.logs || selectedJob.logs.length === 0 ? (
                  <p className="text-gray-500">No logs available</p>
                ) : (
                  selectedJob.logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                      <span className={getLogColor(log.level)}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
