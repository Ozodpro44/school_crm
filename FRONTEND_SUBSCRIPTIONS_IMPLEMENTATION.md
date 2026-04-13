# Frontend Subscriptions Implementation

## Overview

Complete subscription management interface for users to browse plans, manage subscriptions, and view billing history.

## Files Created

### Type Definitions
**`src/types/index.ts`** - Added types:
- `SubscriptionStatus` - active, paused, cancelled, expired
- `SubscriptionPaymentStatus` - pending, completed, failed, refunded
- `BillingPeriod` - monthly, yearly
- `SubscriptionPlan` - Plan definition
- `Subscription` - User subscription
- `SubscriptionUsage` - Usage metrics
- `SubscriptionPayment` - Payment history
- `SubscriptionResponse` - API response wrapper

### API Client
**`src/lib/subscription-api.ts`** - Services:
- `getSubscriptionPlans()` - Fetch all plans
- `getSubscriptionPlan(id)` - Fetch single plan
- `getCurrentSubscription()` - Get user's active subscription
- `createSubscription(data)` - Create new subscription
- `updateSubscriptionStatus(id, status)` - Pause/resume
- `cancelSubscription(id)` - Cancel subscription
- `getSubscriptionUsage(id)` - Get usage metrics
- `checkUsageLimits(id)` - Check if limits exceeded
- `getSubscriptionPayments(id)` - Get payment history
- `getLatestPayment(id)` - Get most recent payment
- `getTotalSpent(id)` - Calculate total spending
- **Utilities:**
  - `isSubscriptionActive(sub)` - Check if active
  - `isExpiringsoon(sub)` - Check if expires within 7 days
  - `getDaysUntilRenewal(sub)` - Days until renewal
  - `formatPrice(price, currency)` - Format price display
  - `getPlanBadgeColor(branches)` - Get plan tier color

### Pages

1. **`src/pages/subscriptions.tsx`** - Plan Selection
   - Display all available plans
   - Show current subscription info
   - Subscribe to new plan
   - FAQ section
   - Error handling
   - Loading states

2. **`src/pages/subscription-details.tsx`** - Subscription Management
   - Current subscription status
   - Usage metrics with progress bars
   - Payment history
   - Pause/Resume options
   - Cancel with confirmation modal
   - Error handling

### Components

1. **`src/components/SubscriptionStatus.tsx`** - Sidebar Widget
   - Display subscription status
   - Link to subscription details
   - Color-coded by status
   - Days until renewal
   - Shows if no subscription active

2. **`src/components/PricingTable.tsx`** - Comparison Table
   - All plans in table format
   - Show limits (branches, students, classes)
   - Select plan callback
   - Highlight current plan
   - Loading state

## Integration Steps

### 1. Add to Navigation/Sidebar
Add subscription status widget to the main layout:

```tsx
import SubscriptionStatus from "@/components/SubscriptionStatus";

// In your layout/sidebar:
<SubscriptionStatus />
```

### 2. Update Main Layout Routes
In `src/pages/_app.tsx`, add subscription pages to your routing:

```tsx
const publicPages = [
  "/subscriptions",
  "/subscription-details",
];
```

### 3. Add Navigation Links
Update your navigation menu:

```tsx
<Link href="/subscriptions">Subscriptions</Link>
<Link href="/subscription-details">My Subscription</Link>
```

### 4. Protect Pages with Subscription
Wrap pages that require subscription:

```tsx
import { useEffect, useState } from "react";
import { getCurrentSubscription, isSubscriptionActive } from "@/lib/subscription-api";
import { useRouter } from "next/router";

export default function PremiumPage() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    const sub = await getCurrentSubscription();
    if (!isSubscriptionActive(sub)) {
      router.push("/subscriptions");
    } else {
      setHasAccess(true);
    }
  };

  if (!hasAccess) return null;
  // Your premium content
}
```

## API Integration Details

### Authentication
All API calls automatically include the JWT token from localStorage:
```ts
const token = localStorage.getItem("token");
headers.Authorization = `Bearer ${token}`;
```

### Error Handling
Graceful error handling with user-friendly messages:
```ts
try {
  const plans = await getSubscriptionPlans();
} catch (error) {
  // Display error message to user
}
```

### Usage Example: Subscribe to Plan

```tsx
import { createSubscription } from "@/lib/subscription-api";

const handleSubscribe = async (planId: string) => {
  try {
    const subscription = await createSubscription({
      planId,
      branchId: "optional-branch-id",
      paymentMethod: "card",
      notes: "Optional notes"
    });
    
    // Show success message and redirect
    router.push("/subscription-details");
  } catch (error) {
    console.error("Subscription failed:", error);
  }
};
```

## UI Features

### Plans Page (`/subscriptions`)
- Grid layout for plan display
- Large pricing cards with features
- Current subscription indicator
- Subscribe button with loading state
- FAQ section
- Responsive design

### Details Page (`/subscription-details`)
- Status overview with key dates
- Usage metrics with progress bars
- Pause/Resume functionality
- Cancel with confirmation modal
- Payment history timeline
- Error alerts

### Sidebar Widget
- Color-coded by status (green=active, orange=expiring, red=inactive)
- Quick link to details page
- Days until renewal
- Upgrade prompt if no subscription

### Pricing Table Component
- Comprehensive plan comparison
- All limits visible at a glance
- Select button with callback
- Current plan highlighting
- Sortable/filterable (can extend)

## Styling

- **Framework**: Tailwind CSS
- **Colors**:
  - Blue: Primary actions
  - Green: Active/success
  - Orange: Warning/expiring
  - Red: Critical/cancelled
- **Responsive**: Mobile-first design
- **Animations**: Smooth transitions and loading spinners

## Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## Future Enhancements

- [ ] Stripe payment integration
- [ ] Invoice PDF download
- [ ] Billing address management
- [ ] Payment method management
- [ ] Usage alerts and notifications
- [ ] Plan upgrade/downgrade with proration
- [ ] Coupon/discount code input
- [ ] Email billing notifications
- [ ] Usage analytics dashboard
- [ ] Team member seat management
