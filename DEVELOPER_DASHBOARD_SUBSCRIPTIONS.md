# Developer Dashboard - Subscription Management

## Overview

The Developer Dashboard now includes comprehensive subscription management features allowing developers to:

1. **Manage Subscription Plans** - Create, edit, and delete subscription plans
2. **Manage User Subscriptions** - Assign subscriptions to users and manage their subscriptions

This replaces the need for API calls to manage subscriptions in the developer dashboard.

---

## Features

### 1. Subscription Plans Management

#### View Plans
- Grid view of all subscription plans
- Display plan details: name, description, price, billing period
- Show plan limits: max branches, max students, max classes
- Display feature flags (analytics, API access, priority support)
- Filter plans by status

#### Add New Plan
- Create new subscription plans with:
  - Plan name and description
  - Price (USD)
  - Billing period (monthly/yearly)
  - Resource limits (branches, students, classes)
  - Feature flags
- Real-time validation

#### Edit Plan
- Modify existing plan details
- Update pricing and limits
- Change feature availability
- Auto-update timestamp

#### Delete Plan
- Remove plans from the system
- Confirmation dialog before deletion
- Cannot delete if users are subscribed to the plan

**Location**: Developer Dashboard → Subscription Plans → Plans Tab

---

### 2. User Subscriptions Management

#### View User Subscriptions
- Table of all user subscriptions
- Display: user name, email, plan name, status, dates
- Filter by subscription status: Active, Paused, Cancelled, Expired
- Search by user name or email
- Show auto-renew status
- Display renewal dates

#### Add User Subscription
- Create subscription for any user
- Select from available subscription plans
- Choose payment method: credit card, bank transfer, PayPal
- Set auto-renew option
- System automatically calculates renewal dates based on billing period

#### Edit Subscription
- Change user's current plan
- Update payment method
- Modify auto-renew settings
- Update subscription dates

#### Delete Subscription
- Remove user subscription
- Confirmation dialog
- User loses access to premium features

**Location**: Developer Dashboard → Subscription Plans → User Subscriptions Tab

---

## Default Subscription Plans

Three default plans are included:

### 1. Starter
- **Price**: $29.99/month
- **Max Branches**: 1
- **Max Students**: 100
- **Max Classes**: 5
- **Features**: Basic

### 2. Professional
- **Price**: $79.99/month
- **Max Branches**: 3
- **Max Students**: 500
- **Max Classes**: 20
- **Features**: Analytics, Priority Support

### 3. Enterprise
- **Price**: $199.99/month (or $199.99/year)
- **Max Branches**: 10
- **Max Students**: 5000
- **Max Classes**: 100
- **Features**: Full Analytics, API Access, Priority Support

---

## Usage Workflows

### Creating a New Subscription Plan

1. Navigate to: **Subscription Plans** → **Plans Tab**
2. Click **Add Plan** button
3. Fill in plan details:
   - Name: e.g., "Growth"
   - Description: e.g., "For expanding schools"
   - Price: 49.99
   - Billing Period: Monthly
   - Max Branches: 2
   - Max Students: 250
   - Max Classes: 10
4. Click **Create**
5. Plan is immediately available for new subscriptions

### Assigning Subscription to User

1. Navigate to: **Subscription Plans** → **User Subscriptions Tab**
2. Click **Add Subscription** button
3. Select user from dropdown
4. Select subscription plan
5. Choose payment method
6. Enable/disable auto-renew
7. Click **Create**
8. Subscription is active immediately

### Changing User's Subscription Plan

1. Find user in **User Subscriptions** table
2. Click **More** (⋮) menu → **Edit**
3. Select new plan from dropdown
4. Update payment method if needed
5. Click **Update**
6. Changes take effect immediately

### Cancelling User Subscription

1. Find user in **User Subscriptions** table
2. Click **More** (⋮) menu → **Delete**
3. Confirm deletion
4. Subscription is removed, user loses access to premium features

---

## Data Structure

### Subscription Plan
```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  maxBranches: number;
  maxStudents: number;
  maxClasses: number;
  features: Record<string, boolean>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
```

### User Subscription
```typescript
interface UserSubscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  status: "active" | "paused" | "cancelled" | "expired";
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  createdAt: string;
}
```

---

## Key Differences

### Branch Subscriptions vs User Subscriptions

| Feature | Branch Subscriptions | User Subscriptions |
|---------|---------------------|-------------------|
| **Purpose** | Track billing per branch | Track user access to features |
| **Location** | Dashboard → Branch Subscriptions | Dashboard → Subscription Plans |
| **Scope** | School branches | Individual users |
| **Billing** | Charged to branch | Charged to user account |
| **Management** | By branch owner | By admin/developer |

---

## Integration with Main Application

The subscription system integrates with:

1. **User Profile** - Shows current subscription plan
2. **Feature Access Control** - Restricts features based on plan
3. **API Endpoints** - Validates requests against subscription limits
4. **Billing System** - Tracks payments and renewals

---

## Best Practices

1. **Plan Pricing**: Set prices competitively based on market research
2. **Feature Mapping**: Clearly define which features are available in each plan
3. **Limits**: Set realistic limits that encourage plan upgrades
4. **Trial Offers**: Consider offering trial subscriptions at no cost
5. **Communication**: Notify users before subscription expiration
6. **Auto-renew**: Enable by default but allow users to disable

---

## Future Enhancements

Potential additions to subscription management:

1. **Bulk User Import** - Assign subscriptions to multiple users at once
2. **Subscription Analytics** - View subscription adoption metrics
3. **Discount Codes** - Create promotional codes for plan upgrades
4. **Subscription Templates** - Save common subscription configs
5. **API Integration** - Call backend subscription APIs directly
6. **Payment Integration** - Process payments through Stripe/PayPal
7. **Usage Tracking** - Monitor user resource usage against limits
8. **Automated Notifications** - Email alerts for expiring subscriptions

---

## Troubleshooting

### Subscription Not Showing
- Verify user is correctly selected
- Check that plan is marked as "active"
- Ensure user record exists in system

### Cannot Delete Plan
- Verify no users have active subscriptions to this plan
- Check for plan dependencies

### Changes Not Saving
- Verify all required fields are filled
- Check browser console for errors
- Ensure form validation passes

---

## Files Modified

- `frontend_for_dev/src/pages/SubscriptionPlans.tsx` - New subscription management page
- `frontend_for_dev/src/components/layout/Sidebar.tsx` - Added menu item
- `frontend_for_dev/src/App.tsx` - Added route

## Navigation Path

**Developer Dashboard** → **Subscription Plans** (in sidebar)

Then toggle between:
- **Subscription Plans Tab** - Manage plans
- **User Subscriptions Tab** - Manage user subscriptions
