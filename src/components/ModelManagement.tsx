"use client";

import { useState, useEffect, useCallback } from "react";
import type { ModelCheckpoint } from "@/types";
import { modelApi } from "@/lib/api";

export default function ModelManagement() {
  const [models, setModels] = useState<ModelCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelCheckpoint | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const response = await modelApi.list();
    if (response.success && response.data) {
      setModels(response.data);
    } else {
      setError(response.error || "Failed to load models");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleDelete = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) {
      return;
    }

    setDeleting(modelName);
    const response = await modelApi.delete(modelName);
    if (response.success) {
      await fetchModels();
    } else {
      setError(response.error || "Failed to delete model");
    }
    setDeleting(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Model Checkpoints</h2>
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
        <h2 className="text-xl font-bold">Model Checkpoints</h2>
        <button
          onClick={fetchModels}
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

      {models.length === 0 ? (
        <div className="p-8 bg-gray-800 rounded-lg text-center text-gray-400">
          No model checkpoints available yet
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((model) => (
            <div
              key={model.name}
              className="p-4 bg-gray-800 rounded-lg border border-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{model.name}</h3>
                  <p className="text-gray-400 text-sm">
                    Created: {formatDate(model.createdAt)}
                  </p>
                  <p className="text-gray-400 text-sm">Size: {model.size}</p>
                  {model.datasetsTrained.length > 0 && (
                    <p className="text-gray-400 text-sm">
                      Datasets: {model.datasetsTrained.join(" → ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedModel(model)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    Details
                  </button>
                  <a
                    href={modelApi.download(model.name)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handleDelete(model.name)}
                    disabled={deleting === model.name}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded text-sm"
                  >
                    {deleting === model.name ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model Details Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{selectedModel.name}</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Path</p>
                <p className="font-mono text-sm break-all">{selectedModel.path}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Created</p>
                <p>{formatDate(selectedModel.createdAt)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Size</p>
                <p>{selectedModel.size}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Datasets Trained</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedModel.datasetsTrained.map((dataset, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-700 rounded text-sm"
                    >
                      {dataset}
                    </span>
                  ))}
                </div>
              </div>

              {selectedModel.config && (
                <div>
                  <p className="text-sm text-gray-400">Training Config</p>
                  <pre className="mt-1 p-3 bg-gray-900 rounded text-sm overflow-x-auto">
                    {JSON.stringify(selectedModel.config, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedModel(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Close
              </button>
              <a
                href={modelApi.download(selectedModel.name)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
