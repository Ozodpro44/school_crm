# Frontend Dev Integration Setup

## Overview
This guide integrates `frontend_for_dev` with the backend and enables Railway logging access.

## 1. API Configuration

### Update frontend_for_dev/.env.local
```env
# Backend API
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_TIMEOUT=30000

# Railway (Optional - for production)
VITE_RAILWAY_API_KEY=your_railway_api_key
VITE_RAILWAY_PROJECT_ID=your_railway_project_id
```

### For Production (Railway)
```env
VITE_API_BASE_URL=https://your-backend-on-railway.up.railway.app/api
VITE_RAILWAY_API_KEY=your_railway_api_key
VITE_RAILWAY_PROJECT_ID=your_railway_project_id
```

## 2. Create API Client

Create `frontend_for_dev/src/lib/api-client.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000');

export class APIClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        throw new Error(`API Error: ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Students
  async getStudents(branchId: string) {
    return this.request(`/students?branchId=${branchId}`);
  }

  async getStudent(id: string) {
    return this.request(`/students/${id}`);
  }

  async createStudent(data: any) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, data: any) {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Payments
  async getPayments(branchId: string) {
    return this.request(`/payments?branchId=${branchId}`);
  }

  async createPayment(data: any) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Add more methods as needed
}

export const apiClient = new APIClient();
```

## 3. Railway Access Setup

### Get Railway Credentials
1. Go to https://railway.app
2. Login to your project
3. Navigate to Settings → API Tokens
4. Create a new API token
5. Add it to your `.env.local`

### Create Railway Logger Service

Create `frontend_for_dev/src/services/railway-logs.ts`:
```typescript
interface RailwayLog {
  timestamp: string;
  level: string;
  message: string;
  service: string;
}

export class RailwayLogsService {
  private apiKey: string;
  private projectId: string;
  private baseUrl = 'https://api.railway.app/graphql';

  constructor() {
    this.apiKey = import.meta.env.VITE_RAILWAY_API_KEY || '';
    this.projectId = import.meta.env.VITE_RAILWAY_PROJECT_ID || '';
  }

  async getLogs(limit: number = 100): Promise<RailwayLog[]> {
    if (!this.apiKey || !this.projectId) {
      console.warn('Railway credentials not configured');
      return [];
    }

    const query = `
      query {
        project(id: "${this.projectId}") {
          deployments(first: 1) {
            edges {
              node {
                logs(first: ${limit}) {
                  edges {
                    node {
                      message
                      timestamp
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

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Railway logs');
      }

      const data = await response.json();
      return this.parseLogs(data);
    } catch (error) {
      console.error('Railway logs error:', error);
      return [];
    }
  }

  private parseLogs(data: any): RailwayLog[] {
    // Parse response based on Railway API format
    return [];
  }
}

export const railwayLogs = new RailwayLogsService();
```

## 4. Server Data Hook

Create `frontend_for_dev/src/hooks/useServerData.ts`:
```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export function useServerData(endpoint: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.request(endpoint);
        setData(response);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint]);

  return { data, loading, error };
}
```

## 5. Environment Setup

### Local Development
```bash
cd frontend_for_dev
cp .env.example .env.local
# Edit .env.local with local backend URL
npm install
npm run dev
```

### Production (Railway)
```bash
cd frontend_for_dev
npm run build
npm start
```

## 6. Integration Checklist

- [ ] Update `.env.local` with API URLs
- [ ] Create API client in `src/lib/api-client.ts`
- [ ] Create Railway service in `src/services/railway-logs.ts`
- [ ] Create custom hook in `src/hooks/useServerData.ts`
- [ ] Test login endpoint
- [ ] Test data fetching
- [ ] Configure Railway API key
- [ ] Deploy to Railway
- [ ] Verify logs access

## 7. Backend URLs

**Local Development:**
- Base: `http://localhost:8080/api`
- Health: `http://localhost:8080/api/health`

**Production (Railway):**
- Set via environment variable `VITE_API_BASE_URL`
- Example: `https://your-backend.up.railway.app/api`

## 8. Testing API Connection

```typescript
// Test in browser console
import { apiClient } from './lib/api-client';

// Test health check
fetch('http://localhost:8080/api/health').then(r => r.json()).then(console.log);

// Test login
apiClient.login('test@example.com', 'password').then(console.log);
```

## 9. Railway Logs Access

Once configured, access logs via:
1. Dashboard: https://railway.app/dashboard
2. Logs page: View real-time backend logs
3. Deployments: Check deployment history
4. Metrics: Monitor server performance

## 10. Troubleshooting

**CORS Issues:**
- Backend must have CORS enabled for frontend URL
- Check backend `internal/middleware/cors.go`

**API Not Found:**
- Verify backend is running on correct port (8080)
- Check `VITE_API_BASE_URL` environment variable

**Railway Connection:**
- Verify API key is valid
- Check project ID is correct
- Ensure Railway account has access to project
