# Quick Start - Developer Dashboard

## 🚀 Get Running in 2 Minutes

### Step 1: Install (30 seconds)
```bash
cd frontend_for_dev
npm install
```

### Step 2: Start (10 seconds)
```bash
npm run dev
```

### Step 3: Open Browser (20 seconds)
```
http://localhost:3000
```

Done! 🎉

---

## 📱 What You See

A dark dashboard with 8 tools:
- **API Tester** - Test endpoints
- **Security Tools** - Login & manage tokens
- **System Health** - Check backend status
- **API Docs** - View endpoint specs
- **Database Explorer** - See database schema
- **Settings Manager** - Edit settings
- **User Management** - Create/manage users
- **Test Data Generator** - Generate dummy data

---

## 🔐 Authenticate (Optional)

1. Click **"Security Tools"**
2. Enter email and password
3. Click **"Login"**
4. Token auto-saves and is used in all requests

Test credentials (if available):
- Email: `admin@example.com`
- Password: `password`

---

## 🧪 Try This First

### Test the API
1. Click **"API Tester"**
2. Default shows `/api/students`
3. Click **"Send Request"**
4. See the response!

### Check Backend Status
1. Click **"System Health"**
2. Shows "Healthy" or "Offline"
3. Auto-refreshes every 30s

### View API Reference
1. Click **"API Documentation"**
2. Expand categories
3. See endpoint details

---

## 🔧 Configuration

Backend URL is set in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Change if your backend runs elsewhere.

---

## ⚙️ Backend Prerequisites

Ensure backend is running:
```bash
# In backend_school_crm directory
make dev
# or
docker-compose up
```

Check health:
```bash
curl http://localhost:8080/health
```

Should return: `{"status":"healthy"}`

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Dashboard home |
| `lib/api.ts` | HTTP client setup |
| `lib/store.ts` | State management |
| `app/tools/*/page.tsx` | Each tool |

---

## 🐛 Troubleshooting

### Port 3000 already in use?
```bash
npx kill-port 3000
npm run dev
```

### Backend not responding?
```bash
# Check backend health
curl http://localhost:8080/health

# If not running, start it
cd ../backend_school_crm
make dev
```

### Can't login?
- Verify user credentials are correct
- Check backend is running
- Try creating a new user via User Management tool

---

## 📖 Learn More

- **Full guide**: `README.md`
- **Setup details**: `SETUP_GUIDE.md`
- **Tools reference**: `TOOLS_INDEX.md`
- **Complete overview**: `DEVELOPER_FRONTEND_SUMMARY.md`

---

## ✨ What's Included

✅ 8 developer tools  
✅ Full TypeScript setup  
✅ Tailwind CSS styling  
✅ JWT authentication  
✅ API logging  
✅ Real-time monitoring  
✅ Complete documentation  

---

## 🎯 Next Steps

1. ✅ Install and run
2. ✅ Try API Tester
3. ✅ Check System Health
4. ✅ Authenticate
5. ✅ Create test users
6. ✅ Generate test data
7. ✅ Explore other tools

---

That's it! You're ready to develop. 🚀
