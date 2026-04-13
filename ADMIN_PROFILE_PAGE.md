# Admin Profile Page Implementation

## Overview
Added a dedicated admin profile page that opens when an admin user clicks on their profile section in the sidebar.

## Files Created
- `frontend_school_crm/src/pages/admin-profile.tsx` - New admin profile page

## Files Modified
- `frontend_school_crm/src/components/Layout.tsx` - Made user profile section clickable

## Features

### Admin Profile Page (`/admin-profile`)
The admin profile page displays comprehensive admin account information:

**Sections:**
1. **Profile Picture & Basic Info**
   - Large profile avatar with user's initial
   - Full name and role badge
   - Role designation as "System Administrator"

2. **Contact Information**
   - Email address
   - Phone number
   - Account status (Active)

3. **Account Details**
   - User ID
   - Full Name
   - Account creation date
   - Last updated date

4. **Permissions**
   - Displays all admin permissions:
     - canManageUsers
     - canManageBranches
     - canManageClasses
     - canManageStudents
     - canManageTeachers
     - canViewReports
     - canManagePayments
     - canManageSalaries
     - canManageExpenses
     - canManageSettings

5. **Action Buttons**
   - Edit Profile button (links to settings)
   - Logout button

### Sidebar Integration
**Desktop Sidebar:**
- Admin profile section is clickable
- Hover effect shows lighter background
- Navigates to `/admin-profile` on click
- Shows tooltip: "Click to view admin profile"

**Mobile Sidebar:**
- Profile card is clickable
- Hover border effect on admin accounts
- Closes mobile menu after navigation
- Shows tooltip for clarity

## Access Control
- Page is only accessible to users with `role === "admin"`
- Non-admin users attempting to access are redirected to home page
- Session validation on page load

## Styling Features
- Responsive design (works on mobile and desktop)
- Dark mode support throughout
- Gradient backgrounds for visual appeal
- Color-coded permissions with green badges
- Loading skeleton for initial page load

## Translation Support
All text labels support multi-language translation:
- English
- Uzbek (Cyrillic)
- Uzbek (Latin)

## Navigation
- Back button to return to previous page
- All internal links to relevant pages
- Proper Next.js routing

## Security
- Checks user role before displaying page
- Redirects unauthorized users
- No sensitive data exposure beyond necessary fields
