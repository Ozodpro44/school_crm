/**
 * Log Service for Frontend
 * Sends logs to the backend's ingestion endpoint
 */

import { apiClient } from './api-client';

export interface LogPayload {
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, string>;
}

export class LogService {
  private logsToken: string;
  private batchQueue: LogPayload[] = [];
  private batchInterval: ReturnType<typeof setInterval> | null = null;
  private batchSize: number = 10;
  private batchDelayMs: number = 5000; // 5 seconds

  constructor(logsToken: string) {
    this.logsToken = logsToken;
    this.startBatchProcessor();
  }

  /**
   * Log a message at INFO level
   */
  info(message: string, metadata?: Record<string, string>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a message at WARN level
   */
  warn(message: string, metadata?: Record<string, string>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log a message at ERROR level
   */
  error(message: string, metadata?: Record<string, string>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log a message at DEBUG level
   */
  debug(message: string, metadata?: Record<string, string>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Internal log method
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, string>
  ): void {
    const payload: LogPayload = {
      service: 'frontend',
      level,
      message,
      metadata: {
        ...metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    // Add to batch queue
    this.batchQueue.push(payload);

    // Send immediately if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    if (this.batchInterval) return;

    this.batchInterval = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.flushBatch();
      }
    }, this.batchDelayMs);
  }

  /**
   * Flush pending logs
   */
  private flushBatch(): void {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.batchSize);

    batch.forEach((payload) => {
      this.sendLog(payload);
    });
  }

  /**
   * Send a single log to the backend
   */
  private async sendLog(payload: LogPayload): Promise<void> {
    if (!this.logsToken) {
      console.warn('LogService: LOGS_TOKEN not configured');
      return;
    }

    try {
      await apiClient.ingestLog(this.logsToken, payload);
    } catch (error) {
      // Silently fail - don't disrupt the application
      console.warn('Failed to send log to backend:', error);
    }
  }

  /**
   * Force flush all pending logs
   */
  async flush(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    while (this.batchQueue.length > 0) {
      await this.flushBatch();
    }
  }

  /**
   * Destroy the log service
   */
  destroy(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
}

// Singleton instance
let logService: LogService | null = null;

export function initLogService(logsToken: string): LogService {
  if (!logService) {
    logService = new LogService(logsToken);
  }
  return logService;
}

export function getLogService(): LogService | null {
  return logService;
}
