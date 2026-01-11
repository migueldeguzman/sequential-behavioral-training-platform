import type {
  Dataset,
  TrainingConfig,
  TrainingStatus,
  ModelCheckpoint,
  ConversionJob,
  ApiResponse,
  Settings,
  TrainingHistoryEntry,
  TrainingLogDetail,
  DirectoryContents,
  InferenceConfig,
  InferenceResult,
  ExportableQAPair,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.detail || "Request failed" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// Dataset API
export const datasetApi = {
  list: () => fetchApi<Dataset[]>("/api/datasets"),

  getDetails: (name: string) => fetchApi<Dataset>(`/api/datasets/${name}`),

  convert: (job: ConversionJob) =>
    fetchApi<{ outputPath: string }>("/api/datasets/convert", {
      method: "POST",
      body: JSON.stringify(job),
    }),

  batchConvert: (jobs: ConversionJob[]) =>
    fetchApi<{ outputPaths: string[] }>("/api/datasets/batch-convert", {
      method: "POST",
      body: JSON.stringify({ jobs }),
    }),

  preview: (name: string, limit = 5) =>
    fetchApi<{
      fileName: string;
      filePath: string;
      fileSize: string;
      totalPairs: number;
      previewPairs: string[];
      format: string;
    }>(`/api/datasets/${name}/preview?limit=${limit}`),

  getFormat: (name: string) =>
    fetchApi<{
      datasetName: string;
      jsonFileCount: number;
      formatTemplate: string;
      sampleJson: { question: string; answer: string } | null;
      sampleConverted: string | null;
      formats: Record<string, string>;
    }>(`/api/datasets/${name}/format`),
};

// Files API
export const filesApi = {
  listConverted: () =>
    fetchApi<{
      files: {
        name: string;
        path: string;
        size: string;
        pairCount: number;
        modifiedAt: string;
      }[];
    }>("/api/files/converted"),

  getContent: (path: string, offset = 0, limit = 10) =>
    fetchApi<{
      totalPairs: number;
      offset: number;
      limit: number;
      pairs: string[];
      hasMore: boolean;
    }>(`/api/files/content?path=${encodeURIComponent(path)}&offset=${offset}&limit=${limit}`),
};

// Training API
export const trainingApi = {
  start: (config: TrainingConfig) =>
    fetchApi<{ jobId: string }>("/api/training/start", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  stop: () =>
    fetchApi<{ message: string }>("/api/training/stop", {
      method: "POST",
    }),

  status: () => fetchApi<TrainingStatus>("/api/training/status"),

  logs: (limit = 100) =>
    fetchApi<{ logs: string[] }>(`/api/training/logs?limit=${limit}`),

  // Training history
  history: () =>
    fetchApi<{ history: TrainingHistoryEntry[] }>("/api/training/history"),

  historyDetail: (jobId: string) =>
    fetchApi<TrainingLogDetail>(`/api/training/history/${jobId}`),

  deleteHistory: (jobId: string) =>
    fetchApi<{ message: string }>(`/api/training/history/${jobId}`, {
      method: "DELETE",
    }),
};

// Model API
export const modelApi = {
  list: () => fetchApi<ModelCheckpoint[]>("/api/models"),

  getDetails: (name: string) => fetchApi<ModelCheckpoint>(`/api/models/${name}`),

  delete: (name: string) =>
    fetchApi<{ message: string }>(`/api/models/${name}`, {
      method: "DELETE",
    }),

  download: (name: string) => `${API_BASE}/api/models/${name}/download`,
};

// Settings API
export const settingsApi = {
  get: () => fetchApi<Settings>("/api/settings"),

  update: (settings: Settings) =>
    fetchApi<Settings>("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),

  browse: (path: string) =>
    fetchApi<DirectoryContents>(`/api/settings/browse?path=${encodeURIComponent(path)}`, {
      method: "POST",
    }),
};

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<{ token: string; username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    fetchApi<{ message: string }>("/api/auth/logout", {
      method: "POST",
    }),

  verify: () => fetchApi<{ valid: boolean; username: string }>("/api/auth/verify"),
};

// Inference API
export const inferenceApi = {
  // Load a model for inference
  loadModel: (modelPath: string) =>
    fetchApi<{ message: string; modelPath: string }>("/api/inference/load", {
      method: "POST",
      body: JSON.stringify({ modelPath }),
    }),

  // Unload current model
  unloadModel: () =>
    fetchApi<{ message: string }>("/api/inference/unload", {
      method: "POST",
    }),

  // Get current model status
  status: () =>
    fetchApi<{ loaded: boolean; modelPath: string | null; deviceInfo: string }>("/api/inference/status"),

  // Single generation
  generate: (prompt: string, config: Partial<InferenceConfig>) =>
    fetchApi<InferenceResult>("/api/inference/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, config }),
    }),

  // Loop generation (same prompt multiple times)
  generateLoop: (prompt: string, repeatCount: number, config: Partial<InferenceConfig>) =>
    fetchApi<{ results: InferenceResult[] }>("/api/inference/generate-loop", {
      method: "POST",
      body: JSON.stringify({ prompt, repeatCount, config }),
    }),

  // Batch generation (multiple different prompts)
  generateBatch: (prompts: string[], config: Partial<InferenceConfig>) =>
    fetchApi<{ results: InferenceResult[] }>("/api/inference/generate-batch", {
      method: "POST",
      body: JSON.stringify({ prompts, config }),
    }),

  // Export results as training data
  exportAsTrainingData: (results: InferenceResult[], format: "json" | "text") =>
    fetchApi<{ data: ExportableQAPair[] | string; filename: string }>("/api/inference/export", {
      method: "POST",
      body: JSON.stringify({ results, format }),
    }),
};
