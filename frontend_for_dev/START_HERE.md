# 🚀 Developer Dashboard - START HERE

Welcome to the School CRM Developer Dashboard! This guide will get you up and running in minutes.

## ⚡ 60 Second Setup

```bash
# 1. Install dependencies
cd frontend_for_dev && npm install

# 2. Start development server
npm run dev

# 3. Open browser
# http://localhost:3000
```

That's it! The dashboard is now running. 🎉

---

## 📚 Documentation Map

### Quick Start (5 min read)
→ **QUICK_START_DEV_DASHBOARD.md** - Get running immediately

### Full Setup (10 min read)
→ **SETUP_GUIDE.md** - Detailed installation & configuration

### Tools Reference (15 min read)
→ **TOOLS_INDEX.md** - Complete guide to all 8 tools

### Feature Overview (20 min read)
→ **README.md** - Architecture, features, and technical details

### Project Overview (10 min read)
→ **../DEVELOPER_FRONTEND_SUMMARY.md** - What was built and why

---

## 🎯 What You Get

| Tool | What It Does |
|------|--------------|
| 🔌 **API Tester** | Send HTTP requests, test endpoints, view responses |
| 🔐 **Security Tools** | Login, manage JWT tokens, inspect claims |
| 💓 **System Health** | Monitor backend status, check endpoints |
| 📖 **API Docs** | Browse all endpoints, request/response specs |
| 🗄️ **Database Explorer** | View schema, tables, columns, migrations |
| ⚙️ **Settings Manager** | Edit branch settings, payment amounts, currency |
| 👥 **User Management** | Create users, view list, manage permissions |
| 📊 **Test Data Generator** | Generate dummy students, teachers, payments |

---

## 🔄 Your First 5 Minutes

### Minute 1-2: Installation
```bash
cd frontend_for_dev
npm install
```

### Minute 3: Start Server
```bash
npm run dev
```

### Minute 4: Open Browser
```
http://localhost:3000
```

### Minute 5: Try First Tool
1. Click "System Health"
2. See if backend is healthy
3. Click "Security Tools"
4. Try logging in

---

## ✅ Prerequisites

- Backend running on `http://localhost:8080`
- Node.js 18+
- npm or yarn
- Modern web browser

### Check Backend is Running
```bash
curl http://localhost:8080/health
```

Should return:
```json
{"status":"healthy"}
```

---

## 🛠️ Common Tasks

### Task: Test an API Endpoint
1. Go to **API Tester**
2. Select HTTP method
3. Enter endpoint path
4. Click "Send Request"
5. See response!

### Task: Login to Dashboard
1. Go to **Security Tools**
2. Enter email and password
3. Click "Login"
4. Token is saved automatically

### Task: Create a Test User
1. Authenticate first
2. Go to **User Management**
3. Click "New User"
4. Fill form and submit
5. User appears in list

### Task: Check Backend Status
1. Go to **System Health**
2. See service status
3. Check endpoint health
4. Auto-refreshes every 30s

### Task: View Database Schema
1. Go to **Database Explorer**
2. Click on table name
3. View columns and types
4. See migration history

---

## 🔧 Configuration

Backend URL is configured in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_ENVIRONMENT=development
```

To use different backend:
```env
NEXT_PUBLIC_API_URL=https://your-backend.com
```

Then restart: `npm run dev`

---

## 🚨 Troubleshooting

### I see "Cannot connect to backend"
```bash
# Check if backend is running
curl http://localhost:8080/health

# If not, start backend
cd ../backend_school_crm
make dev
```

### Port 3000 is already in use
```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### Login not working
- Verify email/password are correct
- Check backend is running
- Look at backend logs for errors

### API requests are slow
- Check backend logs
- Monitor System Health
- Check database performance

See **SETUP_GUIDE.md** for more troubleshooting.

---

## 📖 Learning Path

1. **Start with**: System Health
   - Verify everything is working
   - Check if backend is responsive

2. **Then try**: API Tester
   - Test basic endpoint
   - View responses

3. **Learn API**: API Documentation
   - Browse all endpoints
   - Understand request/response

4. **Authenticate**: Security Tools
   - Login with test account
   - Understand JWT tokens

5. **Create Data**: User Management
   - Create test users
   - View user list

6. **Generate Data**: Test Data Generator
   - Create bulk test data
   - Use in your testing

7. **Edit Settings**: Settings Manager
   - Change branch settings
   - Save and verify

8. **Explore Schema**: Database Explorer
   - View database tables
   - Understand structure

---

## 💡 Pro Tips

### Use API Logs
- Every API call is logged
- View in API Tester
- Helps with debugging

### Copy Tokens
- Security Tools shows current token
- Copy to clipboard
- Use in other applications

### Quick Endpoints
- API Tester has shortcuts
- Click to select endpoint
- Common ones included

### Monitor Health
- Keep System Health open
- Check before debugging
- Auto-refreshes every 30s

### Clear Logs
- API Tester can get busy
- Clear logs to maintain speed
- Helps with performance

---

## 🎓 Next Steps

### Phase 1: Get Familiar
- [ ] Run dashboard
- [ ] Check backend health
- [ ] Try API Tester
- [ ] View API docs

### Phase 2: Authenticate
- [ ] Go to Security Tools
- [ ] Login with test account
- [ ] Verify token appears
- [ ] Use in other tools

### Phase 3: Explore Data
- [ ] Go to User Management
- [ ] View users
- [ ] Create test user
- [ ] View in list

### Phase 4: Deep Dive
- [ ] View Database schema
- [ ] Check table structure
- [ ] Review migrations
- [ ] Understand relationships

### Phase 5: Test & Debug
- [ ] Use API Tester
- [ ] Test endpoints
- [ ] Monitor health
- [ ] Check logs

---

## 📝 File Organization

```
frontend_for_dev/
├── START_HERE.md ⬅️ You are here
├── QUICK_START_DEV_DASHBOARD.md
├── SETUP_GUIDE.md
├── TOOLS_INDEX.md
├── README.md
├── app/               # Application code
├── components/        # Reusable components
├── lib/              # Utilities (API, stores)
└── Configuration files
```

---

## 🎯 Quick Links

| What You Need | Where to Find It |
|---------------|------------------|
| Get running fast | **QUICK_START_DEV_DASHBOARD.md** |
| Detailed setup | **SETUP_GUIDE.md** |
| Learn each tool | **TOOLS_INDEX.md** |
| Full features | **README.md** |
| Architecture details | **../DEVELOPER_FRONTEND_SUMMARY.md** |
| Troubleshooting | **SETUP_GUIDE.md** → Troubleshooting section |

---

## 🚀 You're Ready!

```bash
cd frontend_for_dev
npm install
npm run dev
# Open http://localhost:3000
```

The dashboard is fully functional and ready to use. 

**Questions?** Check the documentation files above.

**Issues?** See SETUP_GUIDE.md troubleshooting section.

---

## 🎉 Summary

You have a **complete developer dashboard** with:
- ✅ 8 powerful tools
- ✅ Full TypeScript/Next.js setup  
- ✅ API testing capabilities
- ✅ JWT authentication
- ✅ Database exploration
- ✅ Settings management
- ✅ User management
- ✅ Test data generation

**Start here** → QUICK_START_DEV_DASHBOARD.md

Happy coding! 🚀
