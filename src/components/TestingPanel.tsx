"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ModelCheckpoint, InferenceResult } from "@/types";
import { modelApi, inferenceApi } from "@/lib/api";
import { saveInferenceConfig, loadInferenceConfig } from "@/lib/storage";

type TestMode = "single" | "loop" | "batch";

interface GenerationConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxLength: number;
  noRepeatNgramSize: number;
  doSample: boolean;
}

const defaultConfig: GenerationConfig = {
  temperature: 1.0,
  topK: 50,
  topP: 0.95,
  maxLength: 1000,
  noRepeatNgramSize: 2,
  doSample: true,
};

export default function TestingPanel() {
  // Model state
  const [models, setModels] = useState<ModelCheckpoint[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>("");
  const [statusLoading, setStatusLoading] = useState(true);

  // Generation config
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);

  // Mode and input state
  const [mode, setMode] = useState<TestMode>("single");
  const [prompt, setPrompt] = useState("");
  const [repeatCount, setRepeatCount] = useState(3);
  const [batchPrompts, setBatchPrompts] = useState<string[]>([""]);

  // Results state
  const [results, setResults] = useState<InferenceResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Abort controller for canceling generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Results viewer ref
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load saved config from localStorage on mount
  useEffect(() => {
    const savedConfig = loadInferenceConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, []);

  // Save config to localStorage when it changes
  useEffect(() => {
    saveInferenceConfig(config);
  }, [config]);

  // Fetch available models
  const fetchModels = useCallback(async () => {
    const response = await modelApi.list();
    if (response.success && response.data) {
      setModels(response.data);
    }
  }, []);

  // Check model status
  const checkModelStatus = useCallback(async () => {
    setStatusLoading(true);
    const response = await inferenceApi.status();
    if (response.success && response.data) {
      setModelLoaded(response.data.loaded);
      if (response.data.loaded && response.data.modelPath) {
        setSelectedModel(response.data.modelPath);
        setModelStatus(`Loaded on ${response.data.deviceInfo}`);
      } else {
        setModelStatus("No model loaded");
      }
    }
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    fetchModels();
    checkModelStatus();
  }, [fetchModels, checkModelStatus]);

  // Load model
  const handleLoadModel = async () => {
    if (!selectedModel) {
      setError("Please select a model");
      return;
    }

    setModelLoading(true);
    setError(null);
    setModelStatus("Loading model...");

    const response = await inferenceApi.loadModel(selectedModel);
    if (response.success) {
      setModelLoaded(true);
      setModelStatus("Model loaded successfully");
      await checkModelStatus();
    } else {
      setError(response.error || "Failed to load model");
      setModelStatus("Failed to load");
    }
    setModelLoading(false);
  };

  // Unload model
  const handleUnloadModel = async () => {
    const response = await inferenceApi.unloadModel();
    if (response.success) {
      setModelLoaded(false);
      setModelStatus("Model unloaded");
    } else {
      setError(response.error || "Failed to unload model");
    }
  };

  // Generate based on mode
  const handleGenerate = async () => {
    if (!modelLoaded) {
      setError("Please load a model first");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      if (mode === "single") {
        if (!prompt.trim()) {
          setError("Please enter a prompt");
          setGenerating(false);
          return;
        }
        const response = await inferenceApi.generate(prompt, config);
        if (response.success && response.data) {
          const newResult = response.data;
          setResults((prev) => [...prev, newResult]);
        } else {
          setError(response.error || "Generation failed");
        }
      } else if (mode === "loop") {
        if (!prompt.trim()) {
          setError("Please enter a prompt");
          setGenerating(false);
          return;
        }
        const response = await inferenceApi.generateLoop(prompt, repeatCount, config);
        if (response.success && response.data) {
          const newResults = response.data.results;
          setResults((prev) => [...prev, ...newResults]);
        } else {
          setError(response.error || "Generation failed");
        }
      } else if (mode === "batch") {
        const validPrompts = batchPrompts.filter((p) => p.trim());
        if (validPrompts.length === 0) {
          setError("Please enter at least one prompt");
          setGenerating(false);
          return;
        }
        const response = await inferenceApi.generateBatch(validPrompts, config);
        if (response.success && response.data) {
          const newResults = response.data.results;
          setResults((prev) => [...prev, ...newResults]);
        } else {
          setError(response.error || "Generation failed");
        }
      }
    } catch {
      setError("An error occurred during generation");
    }

    setGenerating(false);

    // Auto-scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollTo({
        top: resultsRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  // Clear results with confirmation
  const handleClearResults = () => {
    if (results.length > 0) {
      setShowClearConfirm(true);
    }
  };

  const confirmClearResults = () => {
    setResults([]);
    setShowClearConfirm(false);
  };

  // Cancel ongoing generation
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
    setError("Generation cancelled");
  };

  // Export results
  const handleExport = async (format: "json" | "text") => {
    if (results.length === 0) {
      setError("No results to export");
      return;
    }

    const response = await inferenceApi.exportAsTrainingData(results, format);
    if (response.success && response.data) {
      // Create download
      const content = format === "json"
        ? JSON.stringify(response.data.data, null, 2)
        : response.data.data as string;

      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/plain"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setError(response.error || "Export failed");
    }
  };

  // Add batch prompt
  const addBatchPrompt = () => {
    setBatchPrompts((prev) => [...prev, ""]);
  };

  // Remove batch prompt
  const removeBatchPrompt = (index: number) => {
    setBatchPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  // Update batch prompt
  const updateBatchPrompt = (index: number, value: string) => {
    setBatchPrompts((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  return (
    <div className="space-y-6">
      {/* Model Selection Panel */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Model Selection</h2>

        {statusLoading ? (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-400">Checking model status...</span>
          </div>
        ) : (
          <>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Select Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={modelLoading || modelLoaded}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Choose a model...</option>
                  {models.map((model) => (
                    <option key={model.path} value={model.path}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {!modelLoaded ? (
                <button
                  onClick={handleLoadModel}
                  disabled={modelLoading || !selectedModel}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded font-medium"
                >
                  {modelLoading ? "Loading..." : "Load Model"}
                </button>
              ) : (
                <button
                  onClick={handleUnloadModel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium"
                >
                  Unload Model
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${modelLoaded ? "bg-green-400" : "bg-gray-500"}`}
              ></span>
              <span className="text-sm text-gray-400">{modelStatus}</span>
            </div>
          </>
        )}
      </div>

      {/* Generation Config Panel */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Generation Settings</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="2"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 1 })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Top-K</label>
            <input
              type="number"
              min="1"
              max="100"
              value={config.topK}
              onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value) || 50 })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Top-P</label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="1"
              value={config.topP}
              onChange={(e) => setConfig({ ...config, topP: parseFloat(e.target.value) || 0.95 })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Length</label>
            <input
              type="number"
              min="50"
              max="4096"
              value={config.maxLength}
              onChange={(e) => setConfig({ ...config, maxLength: parseInt(e.target.value) || 1000 })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">No Repeat N-gram</label>
            <input
              type="number"
              min="0"
              max="10"
              value={config.noRepeatNgramSize}
              onChange={(e) => setConfig({ ...config, noRepeatNgramSize: parseInt(e.target.value) || 2 })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Sampling</label>
            <select
              value={config.doSample ? "true" : "false"}
              onChange={(e) => setConfig({ ...config, doSample: e.target.value === "true" })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mode Selection and Input Panel */}
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold">Test Mode</h2>
          <div className="flex gap-2">
            {(["single", "loop", "batch"] as TestMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded font-medium capitalize ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {m === "single" ? "Single Chat" : m === "loop" ? "Loop Query" : "Batch Query"}
              </button>
            ))}
          </div>
        </div>

        {/* Single/Loop Mode Input */}
        {(mode === "single" || mode === "loop") && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {mode === "loop" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Repeat Count (generate this prompt multiple times)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                  className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Batch Mode Input */}
        {mode === "batch" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">
                Prompts ({batchPrompts.length} total)
              </label>
              <button
                onClick={addBatchPrompt}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                + Add Prompt
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {batchPrompts.map((p, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-gray-500 w-6 text-right">{index + 1}.</span>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => updateBatchPrompt(index, e.target.value)}
                    placeholder={`Prompt ${index + 1}...`}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                  />
                  {batchPrompts.length > 1 && (
                    <button
                      onClick={() => removeBatchPrompt(index)}
                      className="px-3 py-2 bg-red-900/50 hover:bg-red-800 rounded text-red-400"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Generate Button */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !modelLoaded}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg font-medium"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
          {generating && (
            <button
              onClick={handleCancelGeneration}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Results Panel */}
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Results ({results.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("json")}
              disabled={results.length === 0}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleExport("text")}
              disabled={results.length === 0}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm"
            >
              Export Text
            </button>
            <button
              onClick={handleClearResults}
              disabled={results.length === 0}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded text-sm"
            >
              Clear All
            </button>
          </div>
        </div>

        <div
          ref={resultsRef}
          className="space-y-4 max-h-[32rem] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No results yet. Generate some responses above.
            </div>
          ) : (
            results.map((result, index) => (
              <div key={result.id || index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">
                    #{index + 1} | {result.timestamp}
                    {result.generationIndex > 0 && ` | Loop ${result.generationIndex}`}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.response);
                    }}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                  >
                    Copy
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">PROMPT:</p>
                  <p className="text-gray-300 bg-gray-900 p-2 rounded text-sm">{result.prompt}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">RESPONSE:</p>
                  <p className="text-white bg-gray-900 p-2 rounded text-sm whitespace-pre-wrap">
                    {result.response}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Clear All Results?</h3>
            <p className="text-gray-400 mb-6">
              This will permanently delete {results.length} result(s). This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearResults}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
