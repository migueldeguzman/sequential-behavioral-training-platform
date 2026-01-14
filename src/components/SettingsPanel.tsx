"use client";

import { useState, useEffect, useCallback } from "react";
import type { Settings, DirectoryContents } from "@/types";
import { settingsApi } from "@/lib/api";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    jsonInputDir: "",
    textOutputDir: "",
    textDatasetsDir: "",
    modelOutputDir: "",
    baseModelPath: "",
    pipelineScript: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState<{
    field: keyof Settings;
    contents: DirectoryContents | null;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const response = await settingsApi.get();
    if (response.success && response.data) {
      setSettings(response.data);
    } else {
      setError(response.error || "Failed to load settings");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await settingsApi.update(settings);
    if (response.success) {
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(response.error || "Failed to save settings");
    }
    setSaving(false);
  };

  const handleBrowse = async (field: keyof Settings) => {
    const currentPath = settings[field] || "/";
    const response = await settingsApi.browse(currentPath);
    if (response.success && response.data) {
      setBrowsing({ field, contents: response.data });
    } else {
      // Try parent directory
      const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
      const parentResponse = await settingsApi.browse(parentPath);
      if (parentResponse.success && parentResponse.data) {
        setBrowsing({ field, contents: parentResponse.data });
      }
    }
  };

  const handleNavigate = async (path: string) => {
    if (!browsing) return;
    const response = await settingsApi.browse(path);
    if (response.success && response.data) {
      setBrowsing({ ...browsing, contents: response.data });
    }
  };

  const handleSelectPath = (path: string) => {
    if (!browsing) return;
    setSettings({ ...settings, [browsing.field]: path });
    setBrowsing(null);
  };

  const fieldLabels: Record<keyof Settings, string> = {
    jsonInputDir: "JSON Datasets Directory",
    textOutputDir: "Text Output Directory",
    textDatasetsDir: "Text Datasets Directory",
    modelOutputDir: "Model Output Directory",
    baseModelPath: "Base Model Path",
    pipelineScript: "Pipeline Script Path",
  };

  const fieldDescriptions: Record<keyof Settings, string> = {
    jsonInputDir: "Directory containing JSON Q&A pair folders",
    textOutputDir: "Directory where converted .text files are saved",
    textDatasetsDir: "Directory containing standalone .text files for training",
    modelOutputDir: "Directory where trained models are saved",
    baseModelPath: "Path to the base model (e.g., zephyr)",
    pipelineScript: "Path to instruction_tuning_pipeline.py",
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Settings</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-200">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {(Object.keys(settings) as Array<keyof Settings>).map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {fieldLabels[field]}
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {fieldDescriptions[field]}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings[field]}
                onChange={(e) =>
                  setSettings({ ...settings, [field]: e.target.value })
                }
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <button
                onClick={() => handleBrowse(field)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Browse
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded font-medium"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Directory Browser Modal */}
      {browsing && browsing.contents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                Select {fieldLabels[browsing.field]}
              </h3>
              <button
                onClick={() => setBrowsing(null)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-900 rounded">
              <span className="text-gray-400">Path:</span>
              <code className="text-sm flex-1 truncate">
                {browsing.contents.path}
              </code>
              <button
                onClick={() => handleSelectPath(browsing.contents!.path)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
              >
                Select This
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-900 rounded p-2">
              {browsing.contents.parent !== browsing.contents.path && (
                <button
                  onClick={() => handleNavigate(browsing.contents!.parent)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded flex items-center gap-2"
                >
                  <span className="text-yellow-400">../</span>
                  <span className="text-gray-400">Parent Directory</span>
                </button>
              )}
              {browsing.contents.contents.map((item) => (
                <button
                  key={item.path}
                  onClick={() =>
                    item.isDir
                      ? handleNavigate(item.path)
                      : handleSelectPath(item.path)
                  }
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded flex items-center gap-2"
                >
                  <span className={item.isDir ? "text-blue-400" : "text-gray-400"}>
                    {item.isDir ? "[DIR]" : "[FILE]"}
                  </span>
                  <span>{item.name}</span>
                </button>
              ))}
              {browsing.contents.contents.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  Empty directory
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
