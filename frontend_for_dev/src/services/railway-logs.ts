/**
 * Railway Logs Service
 * Fetch and manage logs from Railway deployment
 */

export interface RailwayLog {
  id?: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  service?: string;
  metadata?: Record<string, any>;
}

export interface RailwayDeployment {
  id: string;
  status: 'UP' | 'DOWN' | 'DEPLOYING';
  createdAt: string;
  updatedAt: string;
}

export class RailwayLogsService {
  private apiKey: string;
  private projectId: string;
  private baseUrl = 'https://api.railway.app/graphql';
  private logsCache: RailwayLog[] = [];
  private lastFetch = 0;
  private cacheDuration = 5000; // 5 seconds

  constructor() {
    this.apiKey = import.meta.env.VITE_RAILWAY_API_KEY || '';
    this.projectId = import.meta.env.VITE_RAILWAY_PROJECT_ID || '';

    if (!this.apiKey || !this.projectId) {
      console.warn(
        'Railway credentials not configured. Set VITE_RAILWAY_API_KEY and VITE_RAILWAY_PROJECT_ID in .env.local'
      );
    }
  }

  /**
   * Get recent logs from Railway
   */
  async getLogs(limit: number = 100): Promise<RailwayLog[]> {
    if (!this.apiKey || !this.projectId) {
      console.warn('Railway credentials not configured');
      throw new Error('Railway API key and project ID required');
    }

    // Return cached logs if still fresh
    if (Date.now() - this.lastFetch < this.cacheDuration) {
      return this.logsCache.slice(0, limit);
    }

    try {
      const logs = await this.fetchFromRailway(limit);
      this.logsCache = logs;
      this.lastFetch = Date.now();
      return logs;
    } catch (error) {
      console.error('Failed to fetch Railway logs:', error);
      // Don't return mock logs - throw error so frontend can fall back to backend
      throw error;
    }
  }

  /**
   * Stream logs from Railway (websocket)
   */
  async streamLogs(callback: (log: RailwayLog) => void): Promise<void> {
    if (!this.apiKey || !this.projectId) {
      console.warn('Cannot stream logs without Railway credentials');
      return;
    }

    try {
      // Poll for logs every 2 seconds
      const interval = setInterval(async () => {
        const logs = await this.getLogs(10);
        if (logs.length > 0) {
          logs.forEach(callback);
        }
      }, 2000);

      // Return cleanup function
      return () => clearInterval(interval);
    } catch (error) {
      console.error('Stream logs error:', error);
    }
  }

  /**
   * Get deployment info
   */
  async getDeployment(): Promise<RailwayDeployment | null> {
    if (!this.apiKey || !this.projectId) {
      return null;
    }

    try {
      const query = `
        query {
          project(id: "${this.projectId}") {
            deployments(first: 1, sort: DESC) {
              edges {
                node {
                  id
                  status
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Railway API error: ${response.status}`);
      }

      const data = await response.json();
      const deployment = data.data?.project?.deployments?.edges?.[0]?.node;

      return deployment || null;
    } catch (error) {
      console.error('Get deployment error:', error);
      return null;
    }
  }

  /**
   * Private: Fetch logs from Railway API
   */
  private async fetchFromRailway(limit: number): Promise<RailwayLog[]> {
    const query = `
      query {
        project(id: "${this.projectId}") {
          deployments(first: 1, sort: DESC) {
            edges {
              node {
                logs(first: ${Math.min(limit, 100)}) {
                  edges {
                    node {
                      timestamp
                      message
                      level
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Railway API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Railway API error: ${data.errors[0].message}`);
    }

    return this.parseLogs(data.data?.project?.deployments?.edges?.[0]?.node?.logs);
  }

  /**
   * Private: Parse Railway API response
   */
  private parseLogs(logsData: any): RailwayLog[] {
    if (!logsData?.edges) {
      return [];
    }

    return logsData.edges.map((edge: any) => {
      const node = edge.node;
      return {
        timestamp: node.timestamp,
        level: this.parseLevel(node.level),
        message: node.message,
        service: 'backend',
      };
    });
  }

  /**
   * Private: Parse log level
   */
  private parseLevel(
    level: string | number
  ): 'info' | 'error' | 'warn' | 'debug' {
    const levelStr = String(level).toLowerCase();
    if (levelStr.includes('error')) return 'error';
    if (levelStr.includes('warn')) return 'warn';
    if (levelStr.includes('debug')) return 'debug';
    return 'info';
  }

  /**
   * Private: Get mock logs for development
   */
  private getMockLogs(limit: number): RailwayLog[] {
    const now = new Date();
    const logs: RailwayLog[] = [];

    const messages = [
      'API server started on port 8080',
      'Database connection established',
      'Authentication middleware initialized',
      'CORS middleware configured',
      'Request received: GET /api/health',
      'Student data fetched successfully',
      'Payment record created',
      'Authorization check passed',
      'Database query executed',
      'Response sent: 200 OK',
    ];

    for (let i = 0; i < Math.min(limit, messages.length); i++) {
      const timestamp = new Date(now.getTime() - i * 10000);
      logs.push({
        timestamp: timestamp.toISOString(),
        level: ['error', 'warn', 'info', 'debug'][Math.floor(Math.random() * 4)] as any,
        message: messages[i],
        service: 'backend',
      });
    }

    return logs;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.logsCache = [];
    this.lastFetch = 0;
  }

  /**
   * Test connection to Railway
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey || !this.projectId) {
      return false;
    }

    try {
      const deployment = await this.getDeployment();
      return deployment !== null;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const railwayLogsService = new RailwayLogsService();
