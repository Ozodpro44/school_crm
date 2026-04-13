# School CRM Developer Dashboard - Complete Setup

A complete Next.js developer dashboard has been created with 8 powerful tools for development and testing.

## 📁 Location
`/frontend_for_dev/` - Ready to use, with all dependencies and configuration included

## 🛠️ Tools Included

### 1. **API Tester** (`/tools/api-tester`)
- Test any API endpoint with custom methods (GET, POST, PUT, DELETE, PATCH)
- View responses, status codes, response times
- Quick shortcuts for common endpoints
- Request/response logging and history
- Headers and body customization

### 2. **Security Tools** (`/tools/security`)
- JWT token management and validation
- Token decoding with claims inspection
- Quick login interface
- Token expiry status monitoring
- Import/export JWT tokens

### 3. **System Health** (`/tools/health`)
- Real-time backend service status
- Auto-refresh every 30 seconds
- Individual endpoint health checks
- Connection verification

### 4. **API Documentation** (`/tools/api-docs`)
- Complete API endpoint reference
- Request/response schemas
- Public vs. protected endpoints
- Quick endpoint lookup by category

### 5. **Database Explorer** (`/tools/db-explorer`)
- Database schema visualization
- Table structures and columns
- Data types and nullable information
- Migration history

### 6. **Settings Manager** (`/tools/settings-manager`)
- View and edit branch settings
- Monthly payment configuration
- Currency management
- Real-time API integration

### 7. **User Management** (`/tools/user-management`)
- Create new users
- View all users with details
- Display roles and permissions
- User creation timestamps

### 8. **Test Data Generator** (`/tools/test-data`)
- Generate dummy student records
- Create test teachers and classes
- Generate payment records
- Bulk data creation for development

## 🚀 Quick Start

### Installation
```bash
cd frontend_for_dev
npm install
```

### Configuration
Environment variables already set in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_ENVIRONMENT=development
```

### Run Development Server
```bash
npm run dev
```

Open browser to `http://localhost:3000`

## 📋 File Structure

```
frontend_for_dev/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Dashboard home with tools grid
│   ├── globals.css             # Global styles
│   └── tools/
│       ├── api-tester/         # API testing tool
│       ├── security/           # JWT token management
│       ├── health/             # Backend health checks
│       ├── api-docs/           # API documentation
│       ├── db-explorer/        # Database schema viewer
│       ├── settings-manager/   # Settings editor
│       ├── user-management/    # User CRUD operations
│       └── test-data/          # Test data generator
├── components/
│   └── Layout.tsx              # Dashboard layout wrapper
├── lib/
│   ├── api.ts                  # Axios configuration with interceptors
│   └── store.ts                # Zustand stores (auth, API logs)
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── tailwind.config.ts          # Tailwind CSS config
├── next.config.ts              # Next.js config
├── .env.local                  # Environment variables
├── .env.example                # Environment template
├── .eslintrc.json              # ESLint config
├── .gitignore                  # Git ignore rules
├── README.md                   # Complete documentation
└── SETUP_GUIDE.md              # Setup instructions
```

## 🔧 Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **UI Icons**: Lucide React
- **Date Handling**: date-fns

## 📦 Features

### Authentication
- JWT token storage in Zustand store (memory only, no localStorage)
- Automatic token attachment to all API requests
- Token validation and expiry checking
- Claims inspection and decoding

### API Integration
- Axios interceptors for request/response logging
- Automatic request/response body capture
- Response time measurement
- Error handling with meaningful messages

### State Management
- `useAuthStore`: Authentication and token management
- `useAPIStore`: API request logging and history
- No external backend dependencies for state

### UI/UX
- Dark theme optimized for developer productivity
- Responsive grid layout for tools
- Smooth transitions and animations
- Loading states and error handling
- Success/error notifications

### Developer Experience
- TypeScript strict mode enabled
- ESLint with Next.js preset
- Hot module reloading
- Organized component structure
- Clear separation of concerns

## 🔐 Security

- Tokens stored in memory only (not persistent)
- JWT validation happens on backend
- CORS handled by backend
- No sensitive data in localStorage
- Environment variables for configuration

## 📚 Documentation Files

1. **README.md** - Complete feature documentation
2. **SETUP_GUIDE.md** - Step-by-step setup instructions
3. **DEVELOPER_DASHBOARD_SETUP.md** - This file

## 🎯 Common Workflows

### Testing an Endpoint
1. Navigate to "API Tester"
2. Select HTTP method
3. Enter endpoint path
4. Add headers/body if needed
5. Click "Send Request"
6. View response and metrics

### Authenticating
1. Go to "Security Tools"
2. Enter email and password
3. Click "Login"
4. Token automatically stored and used in all requests

### Viewing Database Schema
1. Navigate to "Database Explorer"
2. Click on table name to expand
3. View columns, types, and constraints
4. Check migration history

### Creating Test Data
1. Go to "Test Data Generator"
2. Click "Generate Test Data"
3. View results with record counts
4. Use for development/testing

## 🔄 Integration with Backend

The dashboard integrates seamlessly with the School CRM backend:
- Reads from all public endpoints
- Writes to protected endpoints (with authentication)
- Respects role-based access control
- Handles backend errors gracefully

## 🚢 Production Build

```bash
npm run build
npm start
```

This creates an optimized production build for deployment.

## 📝 Environment Configuration

Current `.env.local` settings:
```env
# Backend API endpoint
NEXT_PUBLIC_API_URL=http://localhost:8080

# Environment mode
NEXT_PUBLIC_ENVIRONMENT=development
```

Modify `NEXT_PUBLIC_API_URL` to point to different backend instances (dev/staging/production).

## ✅ Prerequisites

- Node.js 18 or higher
- npm or yarn
- Backend server running on port 8080
- Modern web browser

## 🐛 Troubleshooting

### Port 3000 in use
```bash
npx kill-port 3000
npm run dev
```

### Backend not responding
```bash
# Check backend health
curl http://localhost:8080/health

# Start backend if not running
cd ../backend_school_crm
make dev
```

### Authentication issues
- Verify user credentials in backend database
- Check JWT_SECRET environment variable
- Clear browser cache and restart

### API requests failing
- Check NEXT_PUBLIC_API_URL in .env.local
- Verify backend CORS settings
- Check browser Network tab for details

## 🔗 Related Documentation

- **API Endpoints**: `../API_ENDPOINTS_SUMMARY.md`
- **Backend Setup**: `../BACKEND_SETUP.md`
- **Settings Guide**: `../SETTINGS_QUICK_REFERENCE.md`
- **Password Reset**: `../COMPLETE_PASSWORD_RESET_SYSTEM.md`

## 📞 Support

For issues:
1. Check the comprehensive README.md
2. Review SETUP_GUIDE.md for your use case
3. Check backend logs for API errors
4. Inspect browser DevTools Network tab
5. Review API Documentation in the dashboard

## ✨ Next Steps

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`
3. Open http://localhost:3000
4. Explore each tool
5. Authenticate and test APIs
6. Create test users and data
7. Monitor system health

---

**Status**: ✅ Complete and ready to use

**Version**: 1.0.0

**Last Updated**: January 9, 2026
