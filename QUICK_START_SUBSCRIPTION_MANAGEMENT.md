# Quick Start: Subscription Management in Developer Dashboard

## Access the Feature

1. Open Developer Dashboard
2. Click **"Subscription Plans"** in the left sidebar
3. You'll see two tabs: **Plans** and **User Subscriptions**

---

## Managing Subscription Plans

### Add a New Plan
```
Plans Tab → [Add Plan] Button
├─ Name: "Growth"
├─ Description: "For mid-size schools"
├─ Price: 49.99
├─ Period: Monthly
├─ Max Branches: 2
├─ Max Students: 250
├─ Max Classes: 10
└─ [Create] Button
```

### Edit a Plan
```
Plans Tab → Find Plan Card
└─ Click ⋮ Menu → Edit
   ├─ Modify details
   └─ [Update] Button
```

### Delete a Plan
```
Plans Tab → Find Plan Card
└─ Click ⋮ Menu → Delete
   └─ Confirm deletion
```

---

## Managing User Subscriptions

### Assign Subscription to User
```
User Subscriptions Tab → [Add Subscription] Button
├─ User: Select from dropdown
├─ Plan: Select subscription plan
├─ Payment Method: Credit Card / Bank Transfer / PayPal
├─ Auto Renew: Enable/Disable
└─ [Create] Button
```

### Update User Subscription
```
User Subscriptions Tab → Find User Row
└─ Click ⋮ Menu → Edit
   ├─ Change Plan
   ├─ Update Payment Method
   ├─ Toggle Auto-Renew
   └─ [Update] Button
```

### Cancel User Subscription
```
User Subscriptions Tab → Find User Row
└─ Click ⋮ Menu → Delete
   └─ Confirm deletion
```

---

## Quick Actions

| Task | Steps |
|------|-------|
| Create Plan | Plans → [+] → Fill Form → Create |
| Edit Plan | Plans → Card → ⋮ → Edit → Update |
| Delete Plan | Plans → Card → ⋮ → Delete |
| Add User Sub | Users → [+] → Select User & Plan → Create |
| Change User Plan | Users → ⋮ → Edit → Change Plan → Update |
| Cancel Sub | Users → ⋮ → Delete |
| Filter Users | Users → Status Dropdown |
| Search Users | Users → Search Box |

---

## Default Plans Available

- **Starter**: $29.99/mo, 1 branch, 100 students
- **Professional**: $79.99/mo, 3 branches, 500 students
- **Enterprise**: $199.99/mo, 10 branches, 5000 students

---

## Key Features

✅ Add unlimited subscription plans  
✅ Assign plans to any user  
✅ Edit subscription details anytime  
✅ Track subscription status (Active/Paused/Cancelled/Expired)  
✅ Manage auto-renewal settings  
✅ Choose payment methods  
✅ Search and filter subscriptions  
✅ Bulk management ready  

---

## Tips

1. **Plan Names**: Use clear, descriptive names (avoid generic terms)
2. **Pricing**: Set prices that reflect included features and limits
3. **Auto-Renew**: Enable by default for better retention
4. **Limits**: Set limits that encourage upgrades
5. **Features**: Clearly define what each plan includes

---

## Common Tasks in 10 Seconds

### Create a Growth Plan
1. Plans → Add Plan
2. Name: "Growth", Price: 49.99, Period: Monthly
3. Max: 2 branches, 250 students, 10 classes
4. Create ✓

### Upgrade User to Pro
1. Users → Find user → ⋮ → Edit
2. Plan: Professional
3. Update ✓

### Add New Subscriber
1. Users → Add Subscription
2. User: Select, Plan: Select, Method: Card
3. Create ✓

---

## Need Help?

See full documentation: `DEVELOPER_DASHBOARD_SUBSCRIPTIONS.md`

For API integration: `NEW_ENDPOINTS_DOCUMENTATION.md`

For database issues: `SUBSCRIPTION_PLANS_FIX.md`
