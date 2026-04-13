# Railway Deployment Guide

## Prerequisites

- Railway account: https://railway.app
- GitHub repository connected to Railway
- Backend and Frontend code pushed to GitHub

## Part 1: Backend Deployment (Go)

### 1. Connect Repository

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Authorize Railway to access GitHub

### 2. Configure Backend Service

1. In Railway dashboard, click "Add Service"
2. Select "GitHub Repo"
3. Choose your repo
4. Name it: `backend`
5. Select root: `backend_school_crm/`

### 3. Set Environment Variables

Go to Settings → Variables:

```
DATABASE_URL=postgresql://user:password@localhost/school_crm
JWT_SECRET=your-secret-key-here
CORS_ORIGINS=https://your-frontend-on-railway.up.railway.app
PORT=8080
ENVIRONMENT=production
```

### 4. Configure Build & Deploy

1. Go to Deploy Settings
2. Build command: `cd backend_school_crm && go build -o main`
3. Start command: `./main`
4. Port: `8080`

### 5. Add PostgreSQL Database

1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway will auto-generate `DATABASE_URL`
3. Update migrations:
   ```bash
   cd backend_school_crm
   ./school_crm migrate up
   ```

### 6. Deploy

Click "Deploy" → Wait for success (2-5 minutes)

Your backend URL will be: `https://<project>-production.up.railway.app`

## Part 2: Frontend Deployment (React/Vite)

### 1. Add Service

1. Click "Add Service" → "GitHub Repo"
2. Select your repo
3. Name it: `frontend-dev`
4. Select root: `frontend_for_dev/`

### 2. Set Environment Variables

Go to Settings → Variables:

```
VITE_API_BASE_URL=https://your-backend.up.railway.app/api
VITE_RAILWAY_API_KEY=<your-railway-api-token>
VITE_RAILWAY_PROJECT_ID=<your-railway-project-id>
```

### 3. Configure Build & Deploy

1. Go to Deploy Settings
2. Build command: `npm install && npm run build`
3. Start command: `npm run preview`
4. Port: `3000`

### 4. Deploy

Click "Deploy" → Wait for success

Your frontend URL will be: `https://<project>-frontend.up.railway.app`

## Part 3: Get Railway API Access

### 1. Create API Token

1. Go to Account Settings → Tokens
2. Click "Create Token"
3. Copy the token

### 2. Get Project ID

1. Go to Project Settings
2. Find "Project ID" in the header
3. Copy it

### 3. Add to Frontend Env

Update `frontend_for_dev/.env.local`:

```env
VITE_RAILWAY_API_KEY=<your-token>
VITE_RAILWAY_PROJECT_ID=<your-project-id>
```

## Part 4: Connect Frontend to Backend

### Update Frontend Environment

In Railway dashboard:

1. Select frontend service
2. Go to Settings → Variables
3. Update:
   ```
   VITE_API_BASE_URL=https://<backend-service-url>/api
   ```

### Test Connection

After deployment:

```bash
curl https://your-frontend.up.railway.app
# Should load the frontend
```

## Part 5: View Logs in Railway

### Option 1: Railway Dashboard

1. Go to your project dashboard
2. Click on a service (backend/frontend)
3. Go to "Logs" tab
4. View real-time logs

### Option 2: Frontend Log Panel

With `ServerLogsPanel.tsx` component:

```typescript
import { ServerLogsPanel } from '@/components/dev/ServerLogsPanel'

export function Dashboard() {
  return (
    <div>
      <ServerLogsPanel />
    </div>
  )
}
```

## Part 6: Database Connection

### Local Database
```
DATABASE_URL=postgresql://localhost/school_crm
```

### Railway PostgreSQL
```
DATABASE_URL=postgresql://user:password@host:port/dbname
```

Railway auto-generates this in environment variables.

## Part 7: Monitor & Troubleshoot

### Check Deployment Status

1. Go to Deployments tab
2. View current and previous deployments
3. Check build logs for errors

### Real-time Logs

1. Go to "Logs" tab
2. Filter by service or level
3. Search for errors

### Metrics

1. Go to "Metrics" tab
2. Monitor CPU, Memory, Network usage
3. Check for performance issues

## Environment Variables Reference

### Backend
```
DATABASE_URL         # PostgreSQL connection
JWT_SECRET          # Token signing key
CORS_ORIGINS        # Allowed frontend URL
PORT                # Server port (default 8080)
ENVIRONMENT         # production/development
```

### Frontend
```
VITE_API_BASE_URL   # Backend API URL
VITE_API_TIMEOUT    # Request timeout in ms
VITE_RAILWAY_API_KEY    # Railway authentication
VITE_RAILWAY_PROJECT_ID # Railway project ID
```

## Deployment Checklist

### Backend
- [ ] Repository connected
- [ ] Environment variables set
- [ ] Database configured
- [ ] Build command verified
- [ ] Start command verified
- [ ] Health check endpoint working
- [ ] Logs accessible

### Frontend
- [ ] Repository connected
- [ ] API URL pointing to backend
- [ ] Build command verified
- [ ] Environment variables set
- [ ] Assets loading
- [ ] Can make API calls
- [ ] Authentication working

### Integration
- [ ] Frontend can reach backend API
- [ ] JWT tokens working
- [ ] Database queries successful
- [ ] Logs visible in both services
- [ ] Error handling working

## Rollback

If deployment fails:

1. Go to Deployments tab
2. Find previous successful deployment
3. Click the three dots → "Rollback"
4. Confirm rollback

## Custom Domain

To use your own domain:

1. Go to Settings → Domains
2. Add custom domain
3. Update DNS records
4. Configure SSL (auto-enabled)

## Performance Optimization

### Backend
- Enable caching
- Optimize database queries
- Use connection pooling

### Frontend
- Enable CDN caching
- Minimize bundle size
- Use lazy loading

## Security

### Environment Secrets
- Never commit `.env` files
- Use Railway's secret manager
- Rotate API tokens regularly

### HTTPS
- All Railway apps use HTTPS by default
- Update CORS to use https:// URLs

### Database
- Use PostgreSQL with strong passwords
- Enable SSL connections
- Regular backups

## Support Links

- Railway Docs: https://docs.railway.app
- GitHub Integration: https://docs.railway.app/guides/github
- Environment Variables: https://docs.railway.app/reference/environment-variables
