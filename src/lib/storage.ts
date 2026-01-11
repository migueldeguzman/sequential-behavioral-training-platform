import type { TrainingConfig, AuthState } from "@/types";

const STORAGE_KEYS = {
  AUTH: "ml_dashboard_auth",
  TRAINING_CONFIG: "ml_dashboard_training_config",
  THEME: "ml_dashboard_theme",
} as const;

// Auth storage
export function saveAuth(auth: AuthState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
    if (auth.token) {
      localStorage.setItem("auth_token", auth.token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }
}

export function loadAuth(): AuthState | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem("auth_token");
  }
}

// Training config storage
export function saveTrainingConfig(config: TrainingConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.TRAINING_CONFIG, JSON.stringify(config));
  }
}

export function loadTrainingConfig(): TrainingConfig | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEYS.TRAINING_CONFIG);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Default training config
export function getDefaultTrainingConfig(): TrainingConfig {
  return {
    datasets: [],
    epochs: 1.0,
    learningRate: 0.000042,
    sampleSize: 2,
    batchMultiplier: 1,
    gradientAccumulation: 16,
    formatStyle: "chat",
    trainingMode: "sequential",
  };
}

// Inference config storage
export interface InferenceConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxLength: number;
  noRepeatNgramSize: number;
  doSample: boolean;
}

const INFERENCE_CONFIG_KEY = "ml_dashboard_inference_config";

export function saveInferenceConfig(config: InferenceConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(INFERENCE_CONFIG_KEY, JSON.stringify(config));
  }
}

export function loadInferenceConfig(): InferenceConfig | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(INFERENCE_CONFIG_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}
