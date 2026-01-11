"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TrainingStatus, LogEntry } from "@/types";
import { wsManager } from "@/lib/websocket";
import { trainingApi } from "@/lib/api";

interface TrainingMonitorProps {
  isTraining: boolean;
  onTrainingStop: () => void;
}

export default function TrainingMonitor({
  isTraining,
  onTrainingStop,
}: TrainingMonitorProps) {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logViewerRef = useRef<HTMLDivElement>(null);
  const seenLogHashes = useRef<Set<string>>(new Set());

  useEffect(() => {
    wsManager.connect();

    const unsubStatus = wsManager.on("status", (data) => {
      setStatus(data as TrainingStatus);
    });

    const unsubLog = wsManager.on("log", (data) => {
      const logEntry = data as LogEntry;
      // Deduplicate logs using timestamp + message hash
      const logHash = `${logEntry.timestamp}-${logEntry.message}`;
      if (seenLogHashes.current.has(logHash)) {
        return; // Skip duplicate
      }
      seenLogHashes.current.add(logHash);
      // Keep set from growing too large
      if (seenLogHashes.current.size > 1000) {
        const entries = Array.from(seenLogHashes.current);
        seenLogHashes.current = new Set(entries.slice(-500));
      }
      setLogs((prev) => [...prev.slice(-499), logEntry]);
    });

    const unsubConnection = wsManager.on("connection", (data) => {
      const connectionData = data as unknown as { connected: boolean };
      setConnected(connectionData.connected);
    });

    return () => {
      unsubStatus();
      unsubLog();
      unsubConnection();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logViewerRef.current) {
      logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleStop = useCallback(async () => {
    const response = await trainingApi.stop();
    if (response.success) {
      onTrainingStop();
    }
  }, [onTrainingStop]);

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

  const progressPercent = status
    ? Math.round((status.currentStep / status.totalSteps) * 100)
    : 0;

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Training Monitor</h2>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-2 text-sm ${
              connected ? "text-green-400" : "text-red-400"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            ></span>
            {connected ? "Connected" : "Disconnected"}
          </span>
          {isTraining && (
            <button
              onClick={handleStop}
              className="px-4 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
            >
              Stop Training
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      {status && isTraining ? (
        <div className="space-y-4 mb-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Overall Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-gray-400 text-sm">Current Dataset</p>
              <p className="font-mono text-lg truncate">{status.currentDataset}</p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-gray-400 text-sm">Epoch</p>
              <p className="font-mono text-lg">
                {status.currentEpoch} / {status.totalEpochs}
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-gray-400 text-sm">Step</p>
              <p className="font-mono text-lg">
                {status.currentStep} / {status.totalSteps}
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded">
              <p className="text-gray-400 text-sm">Loss</p>
              <p className="font-mono text-lg text-yellow-400">
                {status.loss?.toFixed(4) || "N/A"}
              </p>
            </div>
          </div>

          {status.estimatedTimeRemaining && (
            <p className="text-sm text-gray-400">
              Estimated time remaining: {status.estimatedTimeRemaining}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6 p-8 bg-gray-800 rounded-lg text-center text-gray-400">
          {isTraining ? "Waiting for training data..." : "No training in progress"}
        </div>
      )}

      {/* Logs Viewer */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Training Logs</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-scroll
          </label>
        </div>
        <div
          ref={logViewerRef}
          className="log-viewer h-[32rem] overflow-y-auto bg-gray-950 rounded-lg p-4 font-mono text-sm"
        >
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                <span className={getLogColor(log.level)}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
