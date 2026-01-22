# Frontend Dev Dashboard - Login Integration Guide

## Quick Start

### Login Credentials (Default)

```
Email: dev@school.ru
Password: dev123456
```

### API Endpoints

#### 1. Developer Login
- **Endpoint**: `POST /api/dev/auth/login`
- **No auth required**

**Request:**
```json
{
  "email": "dev@school.ru",
  "password": "dev123456"
}
```

**Response:**
```json
{
  "id": "8c922d52-4d25-4a55-bca9-b392b4a29deb",
  "email": "dev@school.ru",
  "fullName": "Developer",
  "role": "developer",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. Developer Register
- **Endpoint**: `POST /api/dev/auth/register`
- **No auth required**

**Request:**
```json
{
  "email": "newdev@example.com",
  "password": "securepassword123",
  "fullName": "Developer Name"
}
```

### Frontend Implementation Example

```typescript
// Login service
export async function developerLogin(email: string, password: string) {
  const response = await fetch('http://localhost:8080/api/dev/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  const data = await response.json();
  
  // Store token
  localStorage.setItem('dev_token', data.token);
  localStorage.setItem('dev_user', JSON.stringify({
    id: data.id,
    email: data.email,
    fullName: data.fullName
  }));
  
  return data;
}

// API client with auth
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('dev_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`http://localhost:8080/api${endpoint}`, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('dev_token');
    window.location.href = '/login';
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

// Usage in components
async function handleLogin(email: string, password: string) {
  try {
    const result = await developerLogin(email, password);
    navigate('/dashboard');
  } catch (error) {
    showError('Invalid credentials');
  }
}

// Use authenticated endpoint
async function createSubscriptionPlan(plan) {
  return apiRequest('/dev/subscription-plans', {
    method: 'POST',
    body: JSON.stringify(plan)
  });
}
```

## Available Dev Endpoints (After Login)

### Subscription Plans
- `POST /api/dev/subscription-plans` - Create plan
- `PUT /api/dev/subscription-plans/:id` - Update plan
- `DELETE /api/dev/subscription-plans/:id` - Delete plan
- `GET /api/subscriptions/plans` - Get all plans (public)

### Database
- `GET /api/dev/schema` - Get database schema
- `GET /api/dev/migrations` - Get migration history
- `GET /api/dev/api-docs` - Get API documentation

### Test Data
- `POST /api/dev/generate-test-data` - Generate test students/teachers/classes/payments
- `POST /api/dev/seed-subscription-plans` - Seed default subscription plans

## Token Management

### Store Token After Login
```typescript
const data = await developerLogin(email, password);
localStorage.setItem('dev_token', data.token);
```

### Use Token in Requests
```typescript
const headers = {
  'Authorization': `Bearer ${localStorage.getItem('dev_token')}`
};
```

### Clear Token on Logout
```typescript
function logout() {
  localStorage.removeItem('dev_token');
  localStorage.removeItem('dev_user');
  navigate('/login');
}
```

## Error Handling

```typescript
// Handle 401 Unauthorized
if (response.status === 401) {
  // Token expired or invalid
  localStorage.removeItem('dev_token');
  redirectToLogin();
}

// Handle validation errors
if (response.status === 400) {
  const error = await response.json();
  showError(error.error);
}

// Handle server errors
if (response.status >= 500) {
  showError('Server error. Please try again later.');
}
```

## Integration Checklist

- [ ] Create Login page/component
- [ ] Implement developer login function
- [ ] Store token in localStorage
- [ ] Add Authorization header to API calls
- [ ] Handle 401 responses with redirect to login
- [ ] Create logout functionality
- [ ] Display logged-in user info
- [ ] Add token to subscription plans API calls
- [ ] Test login with dev@school.ru / dev123456
- [ ] Test subscription plan creation
- [ ] Test token expiration handling

## Testing the Endpoints

### Using cURL

```bash
# Login
curl -X POST http://localhost:8080/api/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@school.ru","password":"dev123456"}'

# Create subscription plan (with token)
curl -X POST http://localhost:8080/api/dev/subscription-plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test","description":"Test plan","price":99.99,"billingPeriod":"monthly","maxBranches":1,"maxStudents":100,"maxClasses":5,"features":{}}'
```

### Using Postman

1. Create a new collection
2. Add POST request to `http://localhost:8080/api/dev/auth/login`
3. Body (raw JSON):
   ```json
   {"email":"dev@school.ru","password":"dev123456"}
   ```
4. Copy the token from response
5. In next request, add header: `Authorization: Bearer <token>`

## Security Notes

- Tokens are valid only for developer operations
- Separate from user authentication
- Tokens contain: developer_id, email, role, type
- Use HTTPS in production
- Never expose tokens in logs or version control
- Implement token refresh if needed
- Clear token on logout
