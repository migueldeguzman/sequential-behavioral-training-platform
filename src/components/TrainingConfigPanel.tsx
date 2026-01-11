"use client";

import { useState, useEffect, useMemo } from "react";
import type { TrainingConfig, Dataset } from "@/types";
import { saveTrainingConfig, loadTrainingConfig, getDefaultTrainingConfig } from "@/lib/storage";

interface TrainingConfigPanelProps {
  datasets: Dataset[];
  onStartTraining: (config: TrainingConfig) => void;
  disabled?: boolean;
}

export default function TrainingConfigPanel({
  datasets,
  onStartTraining,
  disabled = false,
}: TrainingConfigPanelProps) {
  const [config, setConfig] = useState<TrainingConfig>(getDefaultTrainingConfig());

  useEffect(() => {
    const saved = loadTrainingConfig();
    if (saved) {
      setConfig(saved);
    }
  }, []);

  useEffect(() => {
    saveTrainingConfig(config);
  }, [config]);

  const effectiveBatchSize = useMemo(() => {
    return config.sampleSize * config.batchMultiplier * config.gradientAccumulation;
  }, [config.sampleSize, config.batchMultiplier, config.gradientAccumulation]);

  const perDeviceBatchSize = useMemo(() => {
    return config.sampleSize * config.batchMultiplier;
  }, [config.sampleSize, config.batchMultiplier]);

  const handleDatasetClick = (datasetName: string) => {
    setConfig((prev) => {
      const currentIndex = prev.datasets.indexOf(datasetName);
      if (currentIndex !== -1) {
        // Remove from sequence
        return {
          ...prev,
          datasets: prev.datasets.filter((d) => d !== datasetName),
        };
      } else {
        // Add to sequence (at the end)
        return {
          ...prev,
          datasets: [...prev.datasets, datasetName],
        };
      }
    });
  };

  const getSequenceNumber = (datasetName: string): number | null => {
    const index = config.datasets.indexOf(datasetName);
    return index !== -1 ? index + 1 : null;
  };

  const isConfigValid =
    config.datasets.length > 0 &&
    config.sampleSize > 0 &&
    config.batchMultiplier > 0 &&
    config.gradientAccumulation > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.datasets.length === 0) {
      alert("Please select at least one dataset");
      return;
    }
    if (config.sampleSize <= 0 || config.batchMultiplier <= 0 || config.gradientAccumulation <= 0) {
      alert("Please enter valid batch size values (must be > 0)");
      return;
    }
    onStartTraining(config);
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Training Configuration</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dataset Sequence Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Training Sequence <span className="text-gray-500 text-xs">(click to add/remove)</span>
          </label>
          <div className="space-y-2">
            {datasets.map((dataset) => {
              const seqNum = getSequenceNumber(dataset.name);
              const isSelected = seqNum !== null;
              return (
                <div
                  key={dataset.name}
                  onClick={() => handleDatasetClick(dataset.name)}
                  className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-900/50 border-2 border-blue-500"
                      : "bg-gray-800 border-2 border-transparent hover:border-gray-600"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-500"
                    }`}
                  >
                    {seqNum || "-"}
                  </div>
                  <div className="flex-1">
                    <span className={isSelected ? "text-white" : "text-gray-400"}>
                      {dataset.name}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({dataset.jsonFileCount} files)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Training Sequence Stack */}
          {config.datasets.length > 0 && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400 mb-3">Training Order:</p>
              <div className="flex flex-col gap-1">
                {config.datasets.map((datasetName, index) => (
                  <div
                    key={datasetName}
                    className="flex items-center gap-2 p-2 bg-gray-900 rounded"
                    style={{ marginLeft: `${index * 8}px` }}
                  >
                    <span className="text-blue-400 font-mono text-sm w-6">
                      {index + 1}.
                    </span>
                    <span className="text-white text-sm">{datasetName}</span>
                    {index < config.datasets.length - 1 && (
                      <span className="text-gray-600 ml-auto">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                BASE → {config.datasets.join(" → ")} → OUTPUT
              </p>
            </div>
          )}
        </div>

        {/* Training Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Training Mode
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="trainingMode"
                value="sequential"
                checked={config.trainingMode === "sequential"}
                onChange={() => setConfig({ ...config, trainingMode: "sequential" })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Sequential (recommended)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="trainingMode"
                value="single"
                checked={config.trainingMode === "single"}
                onChange={() => setConfig({ ...config, trainingMode: "single" })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Single file</span>
            </label>
          </div>
        </div>

        {/* Format Style */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Format Style
          </label>
          <select
            value={config.formatStyle}
            onChange={(e) =>
              setConfig({
                ...config,
                formatStyle: e.target.value as TrainingConfig["formatStyle"],
              })
            }
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="chat">Chat</option>
            <option value="simple">Simple</option>
            <option value="instruction">Instruction</option>
            <option value="plain">Plain</option>
          </select>
        </div>

        {/* Hyperparameters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Epochs
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={config.epochs}
              onChange={(e) =>
                setConfig({ ...config, epochs: parseFloat(e.target.value) || 1 })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Learning Rate
            </label>
            <input
              type="text"
              value={config.learningRate}
              onChange={(e) =>
                setConfig({
                  ...config,
                  learningRate: parseFloat(e.target.value) || 0.000042,
                })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Batch Size Calculator */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-medium mb-3">Batch Size Calculator</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Sample Size
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.sampleSize === 0 ? "" : config.sampleSize}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setConfig({
                      ...config,
                      sampleSize: val === "" ? 0 : parseInt(val, 10),
                    });
                  }
                }}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Batch Multiplier
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.batchMultiplier === 0 ? "" : config.batchMultiplier}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setConfig({
                      ...config,
                      batchMultiplier: val === "" ? 0 : parseInt(val, 10),
                    });
                  }
                }}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Gradient Accumulation
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.gradientAccumulation === 0 ? "" : config.gradientAccumulation}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setConfig({
                      ...config,
                      gradientAccumulation: val === "" ? 0 : parseInt(val, 10),
                    });
                  }
                }}
                placeholder="e.g. 16"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-900 rounded text-sm">
            <p>
              <span className="text-gray-400">Per-device batch size:</span>{" "}
              <span className={`font-mono ${perDeviceBatchSize > 16 ? "text-orange-400" : "text-blue-400"}`}>
                {perDeviceBatchSize}
              </span>
              <span className="text-gray-500">
                {" "}
                ({config.sampleSize} × {config.batchMultiplier})
              </span>
            </p>
            <p className="mt-1">
              <span className="text-gray-400">Effective batch size:</span>{" "}
              <span className="text-green-400 font-mono">{effectiveBatchSize}</span>
              <span className="text-gray-500">
                {" "}
                ({perDeviceBatchSize} × {config.gradientAccumulation})
              </span>
            </p>
            {perDeviceBatchSize > 16 && (
              <p className="mt-2 text-orange-400 text-xs">
                Warning: Per-device batch size &gt;16 may cause out-of-memory on MPS/CPU.
                For Apple Silicon, try sample=2-4 and multiplier=1-2.
              </p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={disabled || !isConfigValid}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {disabled ? "Training in Progress..." : "Start Training"}
        </button>
      </form>
    </div>
  );
}
