# Subscriptions Feature Implementation

## Overview

Complete subscription management system for user-based SaaS model with plan tiers, usage tracking, and payment history.

## Database Schema

### Tables Added

1. **subscription_plans**
   - Plan tiers with pricing and features
   - Configurable limits (branches, students, classes)
   - JSONB features field for extensibility

2. **subscriptions**
   - User subscription tracking
   - Status management (active, paused, cancelled, expired)
   - Auto-renewal settings
   - Stripe integration support
   - Cancellation tracking

3. **subscription_usage**
   - Track usage against plan limits
   - Per-metric tracking (branches, students, classes, etc.)
   - Reset dates for quota management

4. **subscription_payments**
   - Billing history
   - Invoice tracking
   - Stripe payment integration
   - Payment status management (pending, completed, failed, refunded)

## Files Created

### Database
- `migrations/000001_init_all_tables.up.sql` - Updated with subscription tables
- `migrations/000001_init_all_tables.down.sql` - Updated with subscription drop statements

### Go Code

1. **Models** (`internal/models/subscription.go`)
   - `SubscriptionPlan` - Plan definition
   - `Subscription` - User subscription
   - `SubscriptionUsage` - Usage tracking
   - `SubscriptionPayment` - Payment history
   - `JSONMap` - JSONB support for features
   - Request/Response DTOs

2. **Service** (`internal/service/subscription_service.go`)
   - `GetSubscriptionPlans()` - List available plans
   - `GetUserSubscription()` - Get user's active subscription
   - `CreateSubscription()` - Create new subscription
   - `UpdateSubscriptionStatus()` - Change subscription status
   - `CancelSubscription()` - Cancel subscription
   - `GetSubscriptionUsage()` - Get usage metrics
   - `UpdateSubscriptionUsage()` - Increment usage counters
   - `RecordPayment()` - Record subscription payment
   - `GetSubscriptionPayments()` - Get payment history
   - `CheckSubscriptionExpiry()` - Handle expired subscriptions

3. **Handler** (`internal/handlers/subscription.go`)
   - `GetSubscriptionPlans()` - GET /subscriptions/plans
   - `GetUserSubscription()` - GET /subscriptions/current
   - `CreateSubscription()` - POST /subscriptions
   - `CancelSubscription()` - POST /subscriptions/{id}/cancel
   - `GetSubscriptionUsage()` - GET /subscriptions/{id}/usage
   - `GetSubscriptionPayments()` - GET /subscriptions/{id}/payments

## API Endpoints

### Public
- `GET /subscriptions/plans` - List all subscription plans

### Protected (Authenticated)
- `GET /subscriptions/current` - Get current user's subscription
- `POST /subscriptions` - Create new subscription
- `POST /subscriptions/{id}/cancel` - Cancel subscription
- `GET /subscriptions/{id}/usage` - Get usage metrics
- `GET /subscriptions/{id}/payments` - Get payment history

## Integration Steps

### 1. Add Service to Main
In `cmd/main.go`:
```go
subscriptionService := service.NewSubscriptionService(database)
```

### 2. Register Routes
In `cmd/main.go` (after protecting routes):
```go
handlers.RegisterSubscriptionRoutes(protected, subscriptionService, userService)
```

### 3. Run Migrations
```bash
make migrate-up
```

## Example Usage

### Create Subscription Plan (Admin)
```sql
INSERT INTO subscription_plans (id, name, price, billing_period, max_branches, max_students, max_classes, features)
VALUES (
  gen_random_uuid(),
  'Professional',
  99.99,
  'monthly',
  5,
  500,
  20,
  '{"sso": true, "api": true, "support": "priority"}'::jsonb
);
```

### Subscribe User
```bash
curl -X POST http://localhost:8080/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "...",
    "branch_id": "...",
    "payment_method": "card"
  }'
```

### Get Subscription Status
```bash
curl http://localhost:8080/api/subscriptions/current \
  -H "Authorization: Bearer $TOKEN"
```

## Features

### Tier Management
- Multiple subscription plans with different feature sets
- Configurable limits per plan
- JSONB features field for custom capabilities

### Subscription Lifecycle
- Creation with automatic renewal date calculation
- Status management (active, paused, cancelled, expired)
- Auto-renewal tracking
- Cancellation with audit trail (who cancelled, when)

### Usage Tracking
- Per-subscription metric tracking
- Limits enforcement support
- Reset date management for quota periods

### Billing
- Payment history tracking
- Invoice generation support
- Stripe integration ready (payment IDs stored)
- Multiple payment method support
- Payment status tracking (pending → completed)

### Expiry Management
- Automatic expiry detection
- Status updates on expiration
- Renewal date tracking

## Future Enhancements

- [ ] Stripe webhook integration
- [ ] Automatic renewal processing
- [ ] Usage limit enforcement in application logic
- [ ] Plan upgrade/downgrade flows
- [ ] Proration calculations
- [ ] Free trial support
- [ ] Coupon/discount codes
- [ ] Usage alerts and notifications
- [ ] Admin dashboard for subscription management
