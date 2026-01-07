# Admin Profile Edit Implementation

## Summary
Added functionality to allow admins to edit their profile information and change their password from the admin profile page.

## Frontend Changes

### File: `frontend_school_crm/src/pages/admin-profile.tsx`

#### New State Variables
- `isEditModalOpen` - Controls visibility of the edit profile modal
- `isPasswordModalOpen` - Controls visibility of the change password modal
- `editFormData` - Form data for profile edits (fullName, email, phone)
- `passwordFormData` - Form data for password changes (currentPassword, newPassword, confirmPassword)
- `formErrors` - Validation errors for form fields

#### New Components
1. **Edit Profile Modal** - Dialog that allows editing:
   - Full Name (required)
   - Email Address (required, with email validation)
   - Phone Number (optional, with phone format validation)

2. **Change Password Modal** - Dialog that allows:
   - Current Password (required, for verification)
   - New Password (required, min 6 characters)
   - Confirm Password (required, must match new password)

#### New Functions
1. **`openEditModal()`** - Initializes edit form with current user data and opens modal

2. **`openPasswordModal()`** - Initializes password form and opens modal

3. **`validateEditForm()`** - Validates profile edit fields:
   - Required: fullName, email
   - Email format validation
   - Phone format validation (if provided)

4. **`validatePasswordForm()`** - Validates password change fields:
   - All fields required
   - Password minimum 6 characters
   - Passwords must match

5. **`handleUpdateProfile()`** - Sends PUT request to backend:
   - Endpoint: `PUT /api/users/{id}`
   - Fields: `full_name`, `email`, `phone`
   - Updates local state and localStorage on success
   - Shows error messages if validation or API fails

6. **`handleChangePassword()`** - Sends PUT request for password change:
   - Endpoint: `PUT /api/users/{id}`
   - Fields: `current_password`, `password`
   - Requires current password for security
   - Shows error messages if validation or API fails

#### UI Changes
- Added "Edit Profile" button in action buttons row
- Added "Change Password" button in action buttons row
- Both buttons open respective modals
- Added form validation with error display
- Added loading states during API calls

## Backend Changes

### File: `backend_school_crm/internal/service/permission_service.go`

#### Changes to `GetByUserID()`
- **Before**: Returned error when no permissions found
- **After**: Returns `nil` gracefully when no permissions found
- This allows admins without permission records to still update their profile

**Rationale**: Admin users don't necessarily have permission records (they have all permissions by role), so the absence of a permission record shouldn't prevent profile updates.

### File: `backend_school_crm/internal/service/user_service.go`

#### Enhanced `Update()` Function
Added comprehensive input validation and password handling:

1. **Field Validation**
   - Only allows updating specific fields: `full_name`, `email`, `phone`, `password`, `current_password`
   - Prevents SQL injection and unauthorized field updates

2. **Password Hashing**
   - Automatically hashes new passwords using bcrypt
   - Uses bcrypt.DefaultCost for security

3. **Current Password Verification**
   - When `current_password` is provided, verifies it against stored password
   - Uses bcrypt.CompareHashAndPassword for secure comparison
   - Returns error if current password is incorrect

4. **Error Handling**
   - Validates password hashing
   - Returns meaningful error messages:
     - "current password is incorrect"
     - "failed to verify current password"
     - "failed to update password"

5. **Database Safety**
   - Only executes UPDATE if there are valid fields to update
   - Uses parameterized queries to prevent SQL injection

## API Contract

### Update Profile Endpoint
```
PUT /api/users/{id}

Request Body:
{
  "full_name": "string",
  "email": "string",
  "phone": "string"
}

Response:
HTTP 200
{
  "id": "uuid",
  "email": "string",
  "role": "string",
  "full_name": "string",
  "phone": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Change Password Endpoint
```
PUT /api/users/{id}

Request Body:
{
  "current_password": "string",
  "password": "string"
}

Response:
HTTP 200
{
  "id": "uuid",
  "email": "string",
  "role": "string",
  "full_name": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Validation Rules

### Profile Edit
| Field | Type | Rules |
|-------|------|-------|
| fullName | string | Required, non-empty |
| email | string | Required, valid email format |
| phone | string | Optional, valid phone format (digits, spaces, +, -, parentheses) |

### Password Change
| Field | Type | Rules |
|-------|------|-------|
| currentPassword | string | Required, must match stored password |
| newPassword | string | Required, minimum 6 characters |
| confirmPassword | string | Required, must match newPassword |

## Security Features

1. **Password Verification** - Current password is verified before allowing new password
2. **Password Hashing** - New passwords are hashed with bcrypt before storage
3. **Field Validation** - Only allowed fields can be updated via the API
4. **Error Messages** - Clear but secure error messages for debugging
5. **Token-based Auth** - All requests require valid auth token

## Testing Checklist

- [ ] Edit profile modal opens when "Edit Profile" button clicked
- [ ] Can edit full name, email, and phone number
- [ ] Form validation displays errors for invalid inputs
- [ ] Profile updates successfully and updates show in UI
- [ ] localStorage is updated with new user data
- [ ] Change password modal opens when "Change Password" button clicked
- [ ] Password change requires current password
- [ ] New passwords must match
- [ ] Password is hashed correctly on backend
- [ ] Error messages display for failed updates
- [ ] Loading state shows while saving

## Known Limitations

1. Toast notifications use `alert()` - can be replaced with toast component
2. Console logs for debugging - should be removed in production
3. Password change doesn't require email verification (optional enhancement)
4. No password strength indicator in UI
