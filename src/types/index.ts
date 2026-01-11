// Dataset types
export interface Dataset {
  name: string;
  jsonFileCount: number;
  textFileExists: boolean;
  textFilePath?: string;
  pairCount?: number;
}

// Training configuration
export interface TrainingConfig {
  datasets: string[];
  epochs: number;
  learningRate: number;
  sampleSize: number;
  batchMultiplier: number;
  gradientAccumulation: number;
  formatStyle: "chat" | "simple" | "instruction" | "plain";
  trainingMode: "sequential" | "single";
}

// Training status
export interface TrainingStatus {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  totalEpochs: number;
  currentDataset: string;
  loss: number;
  progress: number;
  startTime?: string;
  estimatedTimeRemaining?: string;
}

// Log entry
export interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
}

// Model checkpoint
export interface ModelCheckpoint {
  name: string;
  path: string;
  createdAt: string;
  datasetsTrained: string[];
  config: Partial<TrainingConfig>;
  size: string;
}

// Conversion job
export interface ConversionJob {
  datasetName: string;
  pairCount: number | null;
  formatStyle: string;
  status: "pending" | "running" | "completed" | "failed";
  outputPath?: string;
}

// Settings
export interface Settings {
  jsonInputDir: string;
  textOutputDir: string;
  modelOutputDir: string;
  baseModelPath: string;
  pipelineScript: string;
}

// Training history
export interface TrainingHistoryEntry {
  jobId: string;
  startTime: string;
  endTime: string | null;
  status: "completed" | "failed" | "stopped";
  datasets: string[];
  config: Partial<TrainingConfig>;
  finalLoss: number | null;
  logFile: string;
}

export interface TrainingLogDetail extends TrainingHistoryEntry {
  logs: LogEntry[];
}

// Directory browser
export interface DirectoryContents {
  path: string;
  isDir: boolean;
  parent: string;
  contents: { name: string; isDir: boolean; path: string }[];
}

// Inference/Testing types
export interface InferenceConfig {
  modelPath: string;
  temperature: number;
  topK: number;
  topP: number;
  maxLength: number;
  noRepeatNgramSize: number;
  doSample: boolean;
}

export interface InferenceRequest {
  prompt: string;
  config: InferenceConfig;
  repeatCount?: number; // For loop mode
}

export interface InferenceResult {
  id: string;
  prompt: string;
  response: string;
  generationIndex: number;
  timestamp: string;
  config: InferenceConfig;
}

export interface BatchInferenceRequest {
  prompts: string[];
  config: InferenceConfig;
}

export interface ExportableQAPair {
  question: string;
  answer: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Auth types
export interface User {
  username: string;
  isAuthenticated: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}
