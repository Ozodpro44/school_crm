# Frontend Subscriptions - File Locations

## All Subscription Files Created

### 📄 Pages (Accessible via Routes)
```
frontend_school_crm/src/pages/
├── subscriptions.tsx                    ← Browse & subscribe to plans
└── subscription-details.tsx             ← Manage your subscription
```

**Access URLs:**
- `http://localhost:3000/subscriptions` - View and subscribe to plans
- `http://localhost:3000/subscription-details` - Manage your subscription

### 🧩 Components (Reusable UI Components)
```
frontend_school_crm/src/components/
├── SubscriptionStatus.tsx               ← Sidebar widget (green/orange/red status)
└── PricingTable.tsx                     ← Plans comparison table
```

**Use in your app:**
```tsx
import SubscriptionStatus from "@/components/SubscriptionStatus";
import PricingTable from "@/components/PricingTable";

// Add to your layout/sidebar
<SubscriptionStatus />

// Add to admin panel
<PricingTable />
```

### 🔌 API Client (Services)
```
frontend_school_crm/src/lib/
├── subscription-api.ts                  ← All API calls & utilities
└── api.ts                               ← (existing, don't modify)
```

**Use in pages:**
```tsx
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  createSubscription
} from "@/lib/subscription-api";
```

### 📝 Type Definitions
```
frontend_school_crm/src/types/
└── index.ts                             ← Updated with subscription types
```

**Types available:**
```tsx
SubscriptionPlan
Subscription
SubscriptionUsage
SubscriptionPayment
SubscriptionResponse
SubscriptionStatus
SubscriptionPaymentStatus
BillingPeriod
```

---

## Quick Start

### 1. Access Subscription Pages

Open browser and navigate to:

**Browse Plans:**
```
http://localhost:3000/subscriptions
```

**Manage Subscription:**
```
http://localhost:3000/subscription-details
```

### 2. Add to Navigation Menu

In your main layout/sidebar file:

```tsx
// src/pages/_app.tsx or your layout component

import Link from "next/link";

export default function Layout() {
  return (
    <nav>
      {/* ... other navigation items ... */}
      
      <Link href="/subscriptions">
        <a>Subscriptions</a>
      </Link>
      
      <Link href="/subscription-details">
        <a>My Subscription</a>
      </Link>
    </nav>
  );
}
```

### 3. Add Sidebar Widget

```tsx
// src/pages/_app.tsx or your main layout

import SubscriptionStatus from "@/components/SubscriptionStatus";

export default function Layout({ children }) {
  return (
    <div className="flex">
      <aside className="sidebar">
        {/* ... other sidebar content ... */}
        
        <SubscriptionStatus />
      </aside>
      
      <main>{children}</main>
    </div>
  );
}
```

### 4. Use Pricing Table Component

```tsx
import PricingTable from "@/components/PricingTable";

export default function AdminPanel() {
  const handleSelectPlan = (plan) => {
    console.log("Selected plan:", plan.name);
    // Handle plan selection
  };

  return (
    <PricingTable 
      onSelectPlan={handleSelectPlan}
      highlightPlanId="current-plan-id"
    />
  );
}
```

---

## File Structure Overview

```
frontend_school_crm/
src/
├── pages/
│   ├── subscriptions.tsx              ✨ NEW
│   ├── subscription-details.tsx       ✨ NEW
│   ├── _app.tsx
│   └── ... (other pages)
│
├── components/
│   ├── SubscriptionStatus.tsx         ✨ NEW
│   ├── PricingTable.tsx              ✨ NEW
│   └── ... (other components)
│
├── lib/
│   ├── subscription-api.ts           ✨ NEW
│   ├── api.ts
│   └── ... (other utils)
│
├── types/
│   └── index.ts                      ✏️ UPDATED
│
└── ... (other directories)
```

---

## What Each File Does

### subscriptions.tsx
- Displays all available subscription plans
- Shows current user subscription (if any)
- "Choose Plan" button to subscribe
- FAQ section

### subscription-details.tsx
- Shows current subscription status
- Usage metrics with progress bars
- Payment history
- Pause/Resume/Cancel buttons
- Confirmation modal for cancellation

### SubscriptionStatus.tsx
- Small widget for sidebar
- Green = active, Orange = expiring, Red = inactive
- Links to subscription details
- Shows days until renewal

### PricingTable.tsx
- Table showing all plans side-by-side
- Shows limits (branches, students, classes)
- Select button for each plan
- Current plan highlighting

### subscription-api.ts
- `getSubscriptionPlans()` - Get all plans
- `getCurrentSubscription()` - Get user's subscription
- `createSubscription()` - Subscribe to plan
- `cancelSubscription()` - Cancel subscription
- `getSubscriptionPayments()` - Get payment history
- `getSubscriptionUsage()` - Get usage metrics
- Utility functions for formatting and checking status

---

## Testing Subscriptions Locally

### Step 1: Start Backend
```bash
cd backend_school_crm
make run
```

### Step 2: Start Frontend
```bash
cd frontend_school_crm
npm run dev
```

### Step 3: Access Pages
Open browser:
```
http://localhost:3000/subscriptions
```

### Step 4: Test Workflow
1. Log in with admin account
2. Go to `/subscriptions` page
3. See list of subscription plans
4. Click "Choose Plan" to subscribe
5. Go to `/subscription-details` to manage
6. View payment history and usage

---

## Customization

### Change Plan Display
Edit `src/pages/subscriptions.tsx`:
```tsx
// Customize plan card styling, colors, layout
```

### Add to Existing Layout
In your main `_app.tsx`:
```tsx
import SubscriptionStatus from "@/components/SubscriptionStatus";

// Add to your sidebar/layout
<SubscriptionStatus />
```

### Modify API URL
In `src/lib/subscription-api.ts`:
```tsx
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "your-api-url/api";
```

Make sure `.env.local` has:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## Environment Variables Needed

In `frontend_school_crm/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## Common Issues

### Files not found?
```bash
# Check files exist
ls -la frontend_school_crm/src/pages/subscriptions.tsx
ls -la frontend_school_crm/src/components/SubscriptionStatus.tsx
ls -la frontend_school_crm/src/lib/subscription-api.ts
```

### Pages not accessible?
1. Make sure Next.js dev server is running: `npm run dev`
2. Clear cache: Delete `.next` folder and restart
3. Hard refresh browser: `Ctrl+Shift+R` or `Cmd+Shift+R`

### API errors?
1. Check backend is running: `http://localhost:8080/health`
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check browser console for error details
4. Make sure you're logged in (JWT token in localStorage)

### Permission errors?
1. Run: `psql -f grant_subscription_permissions.sql`
2. Log out and log back in (refresh JWT token)
3. Verify in database: `SELECT can_view_subscriptions FROM permissions;`

---

## Next Steps

1. **Navigate to pages** (they're ready to use)
2. **Add to navigation menu** (link from main nav)
3. **Add sidebar widget** (show subscription status)
4. **Customize styling** (match your theme)
5. **Test with backend** (create subscriptions, view details)

All code is ready - just need to integrate into your existing UI!
