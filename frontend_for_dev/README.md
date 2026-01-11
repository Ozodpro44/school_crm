# Wonderkids' CRM Developer Dashboard

A comprehensive Next.js frontend dashboard for developers working on the Wonderkids' CRM project. Includes tools for testing APIs, managing data, debugging, and development utilities.

## Features

### 1. **API Tester**
- Send HTTP requests to any endpoint
- Support for GET, POST, PUT, DELETE, PATCH methods
- View responses, status codes, and response times
- Quick endpoint shortcuts for common API calls
- API request logging and history
- Headers and body customization

### 2. **Security Tools**
- JWT token management
- Token decoding and validation
- Quick login interface
- Token expiry status
- Token import/export
- Claims inspection

### 3. **System Health**
- Backend service status monitoring
- Auto-refresh every 30 seconds
- Endpoint health checks
- Connection status verification

### 4. **API Documentation**
- Complete API endpoint reference
- Request/response schemas
- Public vs. protected endpoint indicators
- Method and parameter information
- Quick endpoint lookup

### 5. **Database Explorer**
- Database schema visualization
- Table structure and columns
- Data type information
- Migration history
- Constraints and relationships

### 6. **Settings Manager**
- View and edit branch settings
- Monthly payment configuration
- Currency management
- Track creation and update dates
- Real-time API integration

### 7. **User Management**
- Create new users
- List all users with details
- User roles and permissions
- User creation timestamps
- Edit and delete functionality

### 8. **Test Data Generator**
- Generate dummy student records
- Create test teachers and classes
- Generate payment records
- Bulk data creation for testing
- Data export capabilities

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Running Wonderkids' CRM backend on port 8080

### Setup

```bash
# Navigate to dashboard directory
cd frontend_for_dev

# Install dependencies
npm install

# Environment variables are already configured in .env.local
# (or copy from .env.example if needed)

# Run development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`

**Note**: If you get dependency resolution errors, they are normal warnings. The installation uses compatible versions of React 18 and Lucide React 0.366+.

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Environment
NEXT_PUBLIC_ENVIRONMENT=development
```

## Usage

### 1. **Getting Started**
1. Navigate to the dashboard home page
2. Choose a tool from the available options
3. Authenticate using the Security Tools if needed

### 2. **Testing APIs**
1. Go to "API Tester"
2. Select HTTP method (GET, POST, etc.)
3. Enter endpoint URL
4. Add headers and body if needed
5. Click "Send Request"
6. View response and metrics

### 3. **Managing Settings**
1. Authenticate in "Security Tools"
2. Go to "Settings Manager"
3. Update branch settings
4. Click "Save Settings"

### 4. **User Management**
1. Authenticate first
2. Go to "User Management"
3. Click "New User" to create accounts
4. View user list with roles and creation dates

## Architecture

### Technology Stack
- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: Lucide React

### Project Structure

```
frontend_for_dev/
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home/dashboard
│   ├── globals.css              # Global styles
│   └── tools/
│       ├── api-tester/
│       ├── security/
│       ├── health/
│       ├── api-docs/
│       ├── db-explorer/
│       ├── settings-manager/
│       ├── user-management/
│       └── test-data/
├── components/
│   └── Layout.tsx               # Dashboard layout wrapper
├── lib/
│   ├── api.ts                   # Axios configuration & interceptors
│   └── store.ts                 # Zustand stores
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## API Integration

### Authentication Flow
1. User logs in via Security Tools
2. JWT token is received from `/api/auth/login`
3. Token is stored in Zustand store
4. Token automatically added to all requests via axios interceptor
5. API calls include authentication header

### API Logging
All API calls are automatically logged including:
- HTTP method
- Endpoint path
- Status code
- Response time
- Request/response bodies
- Timestamps

Access logs in the API Tester tool.

## Stored Data

### Zustand Stores

**AuthStore** - Authentication state
- `token`: Current JWT token with expiry
- `setToken()`: Save token
- `clearToken()`: Remove token
- `isAuthenticated()`: Check if valid token exists

**APIStore** - API request logging
- `logs`: Array of API request logs
- `addLog()`: Log a request
- `clearLogs()`: Clear all logs
- `removeLogs()`: Remove oldest logs

## Development

### Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

### Adding New Tools

1. Create new directory under `app/tools/[tool-name]`
2. Create `page.tsx` with the tool component
3. Wrap with `<DashboardLayout>` component
4. Add to tools list in `app/page.tsx`
5. Style using Tailwind CSS

### Code Style

- TypeScript strict mode enabled
- ESLint with Next.js preset
- Tailwind CSS for styling
- Functional components with hooks
- Zustand for state management

## Security Considerations

- Tokens stored in browser memory (not persistent)
- JWT validation on client-side for display only
- All API calls require backend authentication
- CORS handled by backend
- No sensitive data stored in localStorage

## Performance

- Auto-refresh for health checks (30s intervals)
- API request caching where applicable
- Responsive design for mobile/tablet
- Optimized images and icons
- Code splitting by route

## Troubleshooting

### "Not authenticated" errors
- Go to Security Tools
- Login or paste a valid JWT token
- Ensure token hasn't expired

### API connection errors
- Verify backend is running on `http://localhost:8080`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Review CORS settings on backend

### Settings not loading
- Ensure you have a valid authentication token
- Check that your user has the correct branch assigned
- Review backend logs for errors

## Support

For issues or questions:
1. Check API Documentation tool
2. Review backend API_ENDPOINTS.txt
3. Check backend logs
4. Verify network requests in browser DevTools

## License

Part of Wonderkids' CRM Project

## Related Documentation

- Backend: `/backend_school_crm/README.md`
- API Endpoints: `/API_ENDPOINTS_SUMMARY.md`
- Backend Setup: `/BACKEND_SETUP.md`
