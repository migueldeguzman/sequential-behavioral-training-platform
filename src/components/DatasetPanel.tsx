"use client";

import { useState, useEffect, useCallback } from "react";
import type { Dataset, TextDataset, ConversionJob } from "@/types";
import { datasetApi, filesApi, textDatasetsApi } from "@/lib/api";

interface DatasetPanelProps {
  onDatasetsChange?: (datasets: Dataset[]) => void;
  onRefresh?: () => void;
}

interface PreviewData {
  fileName: string;
  filePath: string;
  fileSize: string;
  totalPairs: number;
  previewPairs: string[];
  format: string;
}

interface FormatInfo {
  datasetName: string;
  jsonFileCount: number;
  formatTemplate: string;
  sampleJson: { question: string; answer: string } | null;
  sampleConverted: string | null;
  formats: Record<string, string>;
}

interface ConvertedFile {
  name: string;
  path: string;
  size: string;
  pairCount: number;
  modifiedAt: string;
}

export default function DatasetPanel({ onDatasetsChange, onRefresh }: DatasetPanelProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [conversionConfig, setConversionConfig] = useState<{
    datasetName: string;
    pairCount: string;
    formatStyle: "chat" | "simple" | "instruction" | "plain";
  } | null>(null);

  // New state for preview and format display
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [formatInfo, setFormatInfo] = useState<FormatInfo | null>(null);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browsingFile, setBrowsingFile] = useState<{
    path: string;
    name: string;
    pairs: string[];
    offset: number;
    totalPairs: number;
    hasMore: boolean;
  } | null>(null);

  // Batch conversion state
  const [batchConvertMode, setBatchConvertMode] = useState(false);
  const [batchSelections, setBatchSelections] = useState<Set<string>>(new Set());
  const [batchConverting, setBatchConverting] = useState(false);
  const [batchFormatStyle, setBatchFormatStyle] = useState<"chat" | "simple" | "instruction" | "plain">("chat");

  // Text datasets state
  const [textDatasets, setTextDatasets] = useState<TextDataset[]>([]);
  const [textPreviewData, setTextPreviewData] = useState<{
    fileName: string;
    filePath: string;
    fileSize: string;
    totalSamples: number;
    previewSamples: string[];
    format: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"json" | "text">("json");

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    const response = await datasetApi.list();
    if (response.success && response.data) {
      setDatasets(response.data);
      onDatasetsChange?.(response.data);
    } else {
      setError(response.error || "Failed to load datasets");
    }
    setLoading(false);
  }, [onDatasetsChange]);

  const fetchConvertedFiles = useCallback(async () => {
    const response = await filesApi.listConverted();
    if (response.success && response.data) {
      setConvertedFiles(response.data.files);
    }
  }, []);

  const fetchTextDatasets = useCallback(async () => {
    const response = await textDatasetsApi.list();
    if (response.success && response.data) {
      setTextDatasets(response.data);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
    fetchConvertedFiles();
    fetchTextDatasets();
  }, [fetchDatasets, fetchConvertedFiles, fetchTextDatasets]);

  const handleConvert = async () => {
    if (!conversionConfig) return;

    setConverting(conversionConfig.datasetName);
    const job: ConversionJob = {
      datasetName: conversionConfig.datasetName,
      pairCount: conversionConfig.pairCount
        ? parseInt(conversionConfig.pairCount)
        : null,
      formatStyle: conversionConfig.formatStyle,
      status: "pending",
    };

    const response = await datasetApi.convert(job);
    if (response.success) {
      await fetchDatasets();
      await fetchConvertedFiles();
      onRefresh?.();
    } else {
      setError(response.error || "Conversion failed");
    }
    setConverting(null);
    setConversionConfig(null);
  };

  const handlePreview = async (datasetName: string) => {
    const response = await datasetApi.preview(datasetName);
    if (response.success && response.data) {
      setPreviewData(response.data);
    } else {
      setError(response.error || "Failed to load preview");
    }
  };

  const handleShowFormat = async (datasetName: string) => {
    const response = await datasetApi.getFormat(datasetName);
    if (response.success && response.data) {
      setFormatInfo(response.data);
    } else {
      setError(response.error || "Failed to load format info");
    }
  };

  const handleTextPreview = async (datasetName: string) => {
    const response = await textDatasetsApi.preview(datasetName);
    if (response.success && response.data) {
      setTextPreviewData(response.data);
    } else {
      setError(response.error || "Failed to load text preview");
    }
  };

  const handleBrowseFile = async (file: ConvertedFile) => {
    const response = await filesApi.getContent(file.path, 0, 10);
    if (response.success && response.data) {
      setBrowsingFile({
        path: file.path,
        name: file.name,
        pairs: response.data.pairs,
        offset: 0,
        totalPairs: response.data.totalPairs,
        hasMore: response.data.hasMore,
      });
    }
  };

  const handleLoadMore = async () => {
    if (!browsingFile) return;
    const newOffset = browsingFile.offset + 10;
    const response = await filesApi.getContent(browsingFile.path, newOffset, 10);
    if (response.success && response.data) {
      setBrowsingFile({
        ...browsingFile,
        pairs: [...browsingFile.pairs, ...response.data.pairs],
        offset: newOffset,
        hasMore: response.data.hasMore,
      });
    }
  };

  // Batch conversion handlers
  const toggleBatchSelection = (datasetName: string) => {
    setBatchSelections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(datasetName)) {
        newSet.delete(datasetName);
      } else {
        newSet.add(datasetName);
      }
      return newSet;
    });
  };

  const handleBatchConvert = async () => {
    if (batchSelections.size === 0) return;

    setBatchConverting(true);
    const jobs: ConversionJob[] = Array.from(batchSelections).map((name) => ({
      datasetName: name,
      pairCount: null,
      formatStyle: batchFormatStyle,
      status: "pending" as const,
    }));

    const response = await datasetApi.batchConvert(jobs);
    if (response.success) {
      await fetchDatasets();
      await fetchConvertedFiles();
      onRefresh?.();
      setBatchSelections(new Set());
      setBatchConvertMode(false);
    } else {
      setError(response.error || "Batch conversion failed");
    }
    setBatchConverting(false);
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Dataset Management</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Dataset Management</h2>
          <div className="flex gap-2">
            {activeTab === "json" && (
              <button
                onClick={() => {
                  setBatchConvertMode(!batchConvertMode);
                  if (batchConvertMode) {
                    setBatchSelections(new Set());
                  }
                }}
                className={`px-3 py-1 text-sm rounded ${
                  batchConvertMode
                    ? "bg-orange-600 hover:bg-orange-500"
                    : "bg-orange-700 hover:bg-orange-600"
                }`}
              >
                {batchConvertMode ? "Cancel Batch" : "Batch Convert"}
              </button>
            )}
            <button
              onClick={() => setShowFileBrowser(!showFileBrowser)}
              className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 rounded"
            >
              {showFileBrowser ? "Hide" : "Browse"} Files
            </button>
            <button
              onClick={() => {
                fetchDatasets();
                fetchTextDatasets();
              }}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab("json")}
            className={`px-4 py-2 rounded-t text-sm font-medium ${
              activeTab === "json"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            JSON Datasets ({datasets.length})
          </button>
          <button
            onClick={() => setActiveTab("text")}
            className={`px-4 py-2 rounded-t text-sm font-medium ${
              activeTab === "text"
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Text Datasets ({textDatasets.length})
          </button>
        </div>

        {/* Batch Conversion Controls */}
        {batchConvertMode && (
          <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-orange-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-300">
                  Selected: {batchSelections.size} dataset(s)
                </span>
                <select
                  value={batchFormatStyle}
                  onChange={(e) =>
                    setBatchFormatStyle(e.target.value as typeof batchFormatStyle)
                  }
                  className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  <option value="chat">Chat Format</option>
                  <option value="simple">Simple Format</option>
                  <option value="instruction">Instruction Format</option>
                  <option value="plain">Plain Format</option>
                </select>
              </div>
              <button
                onClick={handleBatchConvert}
                disabled={batchSelections.size === 0 || batchConverting}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-sm font-medium"
              >
                {batchConverting ? "Converting..." : `Convert ${batchSelections.size} Selected`}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click on datasets below to select/deselect them for batch conversion.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* JSON Datasets Tab */}
        {activeTab === "json" && (
          <div className="space-y-3">
            {datasets.map((dataset) => (
              <div
                key={dataset.name}
                onClick={() => batchConvertMode && toggleBatchSelection(dataset.name)}
                className={`p-4 bg-gray-800 rounded-lg border transition-colors ${
                  batchConvertMode
                    ? batchSelections.has(dataset.name)
                      ? "border-orange-500 bg-orange-900/20 cursor-pointer"
                      : "border-gray-700 cursor-pointer hover:border-gray-500"
                    : "border-gray-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    {batchConvertMode && (
                      <div
                        className={`w-5 h-5 mt-1 rounded border-2 flex items-center justify-center ${
                          batchSelections.has(dataset.name)
                            ? "border-orange-500 bg-orange-500"
                            : "border-gray-500"
                        }`}
                      >
                        {batchSelections.has(dataset.name) && (
                          <span className="text-white text-xs">v</span>
                        )}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{dataset.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {dataset.jsonFileCount} JSON files
                        {dataset.pairCount && ` | ${dataset.pairCount} pairs`}
                      </p>
                      {dataset.textFileExists && (
                        <p className="text-green-400 text-sm mt-1">
                          Text file available
                        </p>
                      )}
                    </div>
                  </div>
                  {!batchConvertMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShowFormat(dataset.name)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        Format
                      </button>
                      {dataset.textFileExists && (
                        <button
                          onClick={() => handlePreview(dataset.name)}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                        >
                          Preview
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setConversionConfig({
                            datasetName: dataset.name,
                            pairCount: "",
                            formatStyle: "chat",
                          })
                        }
                        disabled={converting === dataset.name}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-sm"
                      >
                        {converting === dataset.name ? "Converting..." : "Convert"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {datasets.length === 0 && (
              <p className="text-gray-400 text-center py-4">No JSON datasets found</p>
            )}
          </div>
        )}

        {/* Text Datasets Tab */}
        {activeTab === "text" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-3">
              Standalone text files that can be used directly for training. Use prefix &quot;text:&quot; when adding to training sequence.
            </p>
            {textDatasets.map((dataset) => (
              <div
                key={dataset.name}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {dataset.name}
                      <span className="text-xs bg-green-600 px-2 py-0.5 rounded">TEXT</span>
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {dataset.fileSize} | {dataset.sampleCount} samples
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Modified: {new Date(dataset.modifiedAt).toLocaleString()}
                    </p>
                    <p className="text-blue-400 text-xs mt-1 font-mono">
                      Training ID: text:{dataset.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTextPreview(dataset.name)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {textDatasets.length === 0 && (
              <p className="text-gray-400 text-center py-4">No text datasets found</p>
            )}
          </div>
        )}
      </div>

      {/* Converted Files Browser */}
      {showFileBrowser && (
        <div className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Converted Files</h3>
          {convertedFiles.length === 0 ? (
            <p className="text-gray-400">No converted files yet</p>
          ) : (
            <div className="space-y-2">
              {convertedFiles.map((file) => (
                <div
                  key={file.path}
                  className="p-3 bg-gray-800 rounded flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400">
                      {file.size} | {file.pairCount} pairs | {new Date(file.modifiedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleBrowseFile(file)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Format Info Modal */}
      {formatInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              Conversion Format: {formatInfo.datasetName}
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Available Formats:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(formatInfo.formats).map(([name, template]) => (
                    <div key={name} className="p-2 bg-gray-900 rounded">
                      <p className="font-medium text-blue-400">{name}</p>
                      <code className="text-xs text-gray-400">{template}</code>
                    </div>
                  ))}
                </div>
              </div>

              {formatInfo.sampleJson && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Sample JSON:</p>
                  <pre className="p-3 bg-gray-900 rounded text-sm overflow-x-auto">
                    {JSON.stringify(formatInfo.sampleJson, null, 2)}
                  </pre>
                </div>
              )}

              {formatInfo.sampleConverted && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Converted Output:</p>
                  <pre className="p-3 bg-gray-900 rounded text-sm whitespace-pre-wrap">
                    {formatInfo.sampleConverted}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setFormatInfo(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">{previewData.fileName}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {previewData.fileSize} | {previewData.totalPairs} total pairs | Format: {previewData.format}
            </p>

            <div className="space-y-3">
              {previewData.previewPairs.map((pair, index) => (
                <div key={index} className="p-3 bg-gray-900 rounded">
                  <p className="text-sm text-gray-400 mb-1">Pair {index + 1}:</p>
                  <pre className="text-sm whitespace-pre-wrap">{pair}</pre>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Dataset Preview Modal */}
      {textPreviewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              {textPreviewData.fileName}
              <span className="text-xs bg-green-600 px-2 py-0.5 rounded">TEXT</span>
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {textPreviewData.fileSize} | {textPreviewData.totalSamples} total samples | Format: {textPreviewData.format}
            </p>

            <div className="space-y-3">
              {textPreviewData.previewSamples.map((sample, index) => (
                <div key={index} className="p-3 bg-gray-900 rounded">
                  <p className="text-sm text-gray-400 mb-1">Sample {index + 1}:</p>
                  <pre className="text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">{sample.substring(0, 500)}{sample.length > 500 ? "..." : ""}</pre>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setTextPreviewData(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Content Browser Modal */}
      {browsingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">{browsingFile.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Showing {browsingFile.pairs.length} of {browsingFile.totalPairs} pairs
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {browsingFile.pairs.map((pair, index) => (
                <div key={index} className="p-3 bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">#{browsingFile.offset + index + 1}</p>
                  <pre className="text-sm whitespace-pre-wrap">{pair}</pre>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              {browsingFile.hasMore && (
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                >
                  Load More
                </button>
              )}
              <button
                onClick={() => setBrowsingFile(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Modal */}
      {conversionConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              Convert {conversionConfig.datasetName}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Number of pairs (leave empty for all)
                </label>
                <input
                  type="number"
                  value={conversionConfig.pairCount}
                  onChange={(e) =>
                    setConversionConfig({
                      ...conversionConfig,
                      pairCount: e.target.value,
                    })
                  }
                  placeholder="All pairs"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Format Style
                </label>
                <select
                  value={conversionConfig.formatStyle}
                  onChange={(e) =>
                    setConversionConfig({
                      ...conversionConfig,
                      formatStyle: e.target.value as "chat" | "simple" | "instruction" | "plain",
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="chat">Chat</option>
                  <option value="simple">Simple</option>
                  <option value="instruction">Instruction</option>
                  <option value="plain">Plain</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConversionConfig(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
