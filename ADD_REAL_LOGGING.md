# Add Real Application Logging

## Current Status

✅ Logs endpoint working and returning data
✅ Frontend displaying logs correctly
⚠️ Currently showing sample logs only

## To Get Real Logs

Add `handlers.AddLog()` calls in your backend handlers when events happen.

## Quick Integration Guide

### 1. Auth Handler (Login/Register)

**File:** `backend_school_crm/internal/handlers/auth.go`

Add logging in the Login function (around line 37):

```go
// After successful login
handlers.AddLog("info", "auth", fmt.Sprintf("User %s logged in successfully", user.Email))

// On login failure
handlers.AddLog("warn", "auth", fmt.Sprintf("Failed login attempt for %s from %s", req.Email, c.ClientIP()))
```

### 2. Student Handler

**File:** `backend_school_crm/internal/handlers/student.go`

Add logging when creating/updating students:

```go
// After creating student
handlers.AddLog("info", "students", fmt.Sprintf("Student %s created (ID: %s)", student.FullName, student.ID))

// On student deletion
handlers.AddLog("info", "students", fmt.Sprintf("Student %s deleted (ID: %s)", student.FullName, student.ID))

// On enrollment
handlers.AddLog("info", "students", fmt.Sprintf("Student %s enrolled in class", student.FullName))
```

### 3. Payment Handler

**File:** `backend_school_crm/internal/handlers/payment.go`

Add logging for payments:

```go
// After creating payment
handlers.AddLog("info", "payments", fmt.Sprintf("Payment of %d created for student %s (Status: %s)", payment.Amount, student.FullName, payment.Status))

// On payment update
handlers.AddLog("info", "payments", fmt.Sprintf("Payment status changed to %s", payment.Status))

// On payment error
handlers.AddLog("error", "payments", fmt.Sprintf("Payment processing failed: %v", err))
```

### 4. Database Handler

**File:** `backend_school_crm/internal/handlers/developer.go`

Add logging for schema/migration operations:

```go
// After successful schema fetch
handlers.AddLog("info", "database", "Database schema retrieved")

// On migration
handlers.AddLog("info", "database", "Database migrations executed")
```

### 5. Class Handler

**File:** `backend_school_crm/internal/handlers/class.go`

```go
handlers.AddLog("info", "classes", fmt.Sprintf("Class %s created", class.Name))
handlers.AddLog("info", "classes", fmt.Sprintf("Class %s updated", class.Name))
handlers.AddLog("info", "classes", fmt.Sprintf("Class %s deleted", class.Name))
```

### 6. Expense Handler

**File:** `backend_school_crm/internal/handlers/expense.go`

```go
handlers.AddLog("info", "expenses", fmt.Sprintf("Expense %s recorded: %d (Category: %s)", expense.Title, expense.Amount, expense.Category))
```

## Complete Example

Here's a complete example for the Login handler:

```go
func Login(userService *service.UserService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.LoginRequest
		
		if err := c.ShouldBindJSON(&req); err != nil {
			handlers.AddLog("warn", "auth", fmt.Sprintf("Invalid login request: %v", err))
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := userService.Login(c.Request.Context(), req.Email, req.Password)
		if err != nil {
			handlers.AddLog("warn", "auth", fmt.Sprintf("Failed login for %s from %s", req.Email, c.ClientIP()))
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Log successful login
		handlers.AddLog("info", "auth", fmt.Sprintf("User %s logged in successfully", user.Email))

		// ... rest of login logic ...

		c.JSON(http.StatusOK, gin.H{
			"token": tokenString,
			"user":  user,
		})
	}
}
```

## Available Log Levels

```go
handlers.AddLog("info", "module", "message")    // General information
handlers.AddLog("warn", "module", "message")    // Warnings/unusual situations
handlers.AddLog("error", "module", "message")   // Errors
handlers.AddLog("debug", "module", "message")   // Debug information
```

## Available Modules

Use these module names for consistency:

- `auth` - Authentication events
- `payments` - Payment processing
- `students` - Student enrollment/management
- `classes` - Class management
- `teachers` - Teacher management
- `salaries` - Salary processing
- `expenses` - Expense tracking
- `api` - API operations
- `database` - Database operations
- `cache` - Cache operations
- `email` - Email sending

## Add to Error Handlers

Add logging for all error cases:

```go
if err := someOperation(); err != nil {
    handlers.AddLog("error", "payments", fmt.Sprintf("Payment operation failed: %v", err))
    c.JSON(http.StatusInternalServerError, gin.H{"error": "operation failed"})
    return
}
```

## Deployment

After adding logging calls:

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add application logging"
   git push
   ```

2. **Railway auto-deploys** - Logs will appear as events happen

3. **Test by:**
   - Creating a student
   - Processing a payment
   - Attempting login
   - Making API calls

## Real Logs Will Show

Once you add logging, the Logs page will display:
- User login attempts
- Student enrollment events
- Payment processing
- Errors and warnings
- Database operations
- API calls

## No Changes Needed to Frontend

The frontend already shows logs automatically - just add logging to backend!

## Performance Note

In-memory logs are kept to 10,000 entries. For production, consider:
- Saving to database
- Archiving old logs
- Structured logging with JSON
- Centralized log service

For now, in-memory is perfect for development and monitoring!
