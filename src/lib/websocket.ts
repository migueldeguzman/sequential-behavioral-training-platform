import type { TrainingStatus, LogEntry } from "@/types";
import { getWebSocketUrl } from "./config";

type MessageHandler = (data: TrainingStatus | LogEntry) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private url: string;

  constructor() {
    this.url = getWebSocketUrl("/ws/training");
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const wsUrl = token ? `${this.url}?token=${token}` : this.url;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.emit("connection", { connected: true } as unknown as TrainingStatus);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status") {
            this.emit("status", data.payload as TrainingStatus);
          } else if (data.type === "log") {
            this.emit("log", data.payload as LogEntry);
          }
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      this.socket.onclose = () => {
        console.log("WebSocket disconnected");
        this.emit("connection", { connected: false } as unknown as TrainingStatus);
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  on(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: TrainingStatus | LogEntry): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  send(message: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

export const wsManager = new WebSocketManager();
