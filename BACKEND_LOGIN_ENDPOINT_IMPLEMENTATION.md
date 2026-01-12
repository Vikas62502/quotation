# Backend Login Endpoint - Account Manager Support

## Overview
The frontend is ready for account management login, but the backend login endpoint needs to be modified to support authenticating account managers from the `account_managers` table.

---

## ⚠️ CRITICAL ISSUE - BLOCKING ACCOUNT MANAGEMENT LOGIN

**Status**: ❌ **Login endpoint does not support account managers**

**Error Users See**: "Error: User not authenticated" or "User not authenticated"

**Current Behavior**: 
- `/api/auth/login` only checks the `users` table
- Account managers cannot login because they're in a separate `account_managers` table
- When account management users try to login, they get authentication errors
- Frontend cannot get a valid JWT token for account management users

**Required Behavior**:
- `/api/auth/login` should check both `users` and `account_managers` tables
- If user is found in `account_managers` table, return `role: "account-management"`
- Return a valid JWT token that includes the account-management role
- Update `loginCount` and `lastLogin` fields
- Log login history automatically

**Priority**: 🔴 **HIGHEST - This is blocking all account management functionality when API is enabled**

---

## 🔧 Required Backend Changes

### Option 1: Modify Existing Login Endpoint (Recommended)

**File to Modify**: `controllers/authController.ts` (or wherever login logic is)

**Current Code** (likely):
```typescript
async login(req, res) {
  const { username, password } = req.body
  
  // Check users table
  const user = await User.findOne({ where: { username } })
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      success: false,
      error: { code: "AUTH_001", message: "Invalid credentials" }
    })
  }
  
  // Check if user is active
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      error: { code: "AUTH_002", message: "Account is deactivated" }
    })
  }
  
  // Generate token
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  )
  
  return res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    }
  })
}
```

**Updated Code** (with account manager support):
```typescript
async login(req, res) {
  const { username, password } = req.body
  
  // First, try users table
  let user = await User.findOne({ where: { username } })
  let accountManager = null
  let isAccountManager = false
  
  if (user) {
    // Validate password for regular user
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_001", message: "Invalid credentials" }
      })
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: { code: "AUTH_002", message: "Account is deactivated" }
      })
    }
  } else {
    // If not found in users table, try account_managers table
    accountManager = await AccountManager.findOne({ where: { username } })
    
    if (accountManager) {
      // Validate password for account manager
      if (!bcrypt.compareSync(password, accountManager.password)) {
        return res.status(401).json({
          success: false,
          error: { code: "AUTH_001", message: "Invalid credentials" }
        })
      }
      
      // Check if account manager is active
      if (!accountManager.isActive) {
        return res.status(403).json({
          success: false,
          error: { code: "AUTH_002", message: "Account is deactivated" }
        })
      }
      
      isAccountManager = true
      
      // Update login count and last login
      await AccountManager.update(
        {
          loginCount: accountManager.loginCount + 1,
          lastLogin: new Date()
        },
        { where: { id: accountManager.id } }
      )
      
      // Log login history
      await AccountManagerHistory.create({
        accountManagerId: accountManager.id,
        action: "login",
        details: "User logged in successfully",
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      })
      
      // Refresh account manager data
      accountManager = await AccountManager.findByPk(accountManager.id)
    } else {
      // Not found in either table
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_001", message: "Invalid credentials" }
      })
    }
  }
  
  // Generate token and prepare response
  let token, userData, role
  
  if (isAccountManager && accountManager) {
    // Account manager login
    token = jwt.sign(
      { id: accountManager.id, role: "account-management" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )
    
    role = "account-management"
    
    userData = {
      id: accountManager.id,
      username: accountManager.username,
      firstName: accountManager.firstName,
      lastName: accountManager.lastName,
      email: accountManager.email,
      mobile: accountManager.mobile || "",
      role: "account-management",
      isActive: accountManager.isActive,
      emailVerified: accountManager.emailVerified || false,
      createdAt: accountManager.createdAt
    }
  } else {
    // Regular user login (existing logic)
    token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )
    
    role = user.role
    
    userData = {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      // ... other user fields
    }
  }
  
  return res.json({
    success: true,
    data: {
      token,
      refreshToken: null, // Add if refresh tokens are used
      user: userData
    }
  })
}
```

---

## 📋 Required Imports

Make sure to import the Account Manager models:

```typescript
import { AccountManager } from '../models/AccountManager'
import { AccountManagerHistory } from '../models/AccountManagerHistory'
```

---

## ✅ Expected Response Format

**For Account Manager Login**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": null,
    "user": {
      "id": "account-mgr-001",
      "username": "accountmgr",
      "firstName": "Arjun",
      "lastName": "Singh",
      "email": "arjun.singh@accountmanagement.com",
      "mobile": "9876543215",
      "role": "account-management",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-12-17T10:00:00Z"
    }
  }
}
```

**For Regular User Login** (existing behavior):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-001",
      "username": "admin",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

---

## 🔐 Frontend Behavior

The frontend is already set up to handle this:

**Account Management Login** (`/account-management-login`):
```typescript
// Frontend calls: api.auth.login(username, password)
const response = await api.auth.login(username, password)
const user = response.user
const userRole = user.role === "account-management" || user.role === "accountManager" ? "account-management" : user.role

// Only allow account-management role users
if (userRole !== "account-management") {
  return false // Reject login
}

// Set account manager state
setAccountManager({ ... })
setRole("account-management")
```

**Regular Login** (`/login`):
```typescript
// Frontend calls: api.auth.login(username, password)
const response = await api.auth.login(username, password)
const user = response.user
const userRole = user.role // "admin", "dealer", or "visitor"

// Set appropriate state based on role
if (userRole === "visitor") {
  setVisitor({ ... })
} else {
  setDealer({ ... })
}
setRole(userRole)
```

---

## ✅ Testing Checklist

### Account Manager Login
- [ ] Test login with valid account manager credentials
- [ ] Test login with invalid password (should fail)
- [ ] Test login with non-existent username (should fail)
- [ ] Test login with deactivated account manager (should fail)
- [ ] Verify `role: "account-management"` in response
- [ ] Verify `loginCount` is incremented
- [ ] Verify `lastLogin` is updated
- [ ] Verify login history is logged

### Regular User Login (Regression Testing)
- [ ] Test admin login (should still work)
- [ ] Test dealer login (should still work)
- [ ] Test visitor login (should still work)
- [ ] Verify roles are correct for each user type

### Security Testing
- [ ] Test with SQL injection attempts in username/password
- [ ] Test with very long username/password
- [ ] Test with special characters in username
- [ ] Verify password is not returned in response
- [ ] Verify token is properly signed

---

## 🐛 Potential Issues & Solutions

### Issue 1: Password Field Name Mismatch
**Problem**: Backend might use `password_hash` but code expects `password`
**Solution**: Make sure to use the correct field name from your AccountManager model

### Issue 2: BCrypt Compare
**Problem**: `bcrypt.compareSync` might not match your password hashing method
**Solution**: Use the same method used when creating account managers
```typescript
// If using bcrypt with async/await
const isValid = await bcrypt.compare(password, accountManager.password)

// If using bcrypt.compareSync (synchronous)
const isValid = bcrypt.compareSync(password, accountManager.password)
```

### Issue 3: IP Address Extraction
**Problem**: `req.ip` might not work correctly with proxies/load balancers
**Solution**: Use a more robust IP extraction:
```typescript
const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] 
  || req.headers['x-real-ip'] 
  || req.connection.remoteAddress 
  || req.socket.remoteAddress
  || 'unknown'
```

### Issue 4: AccountManager Model Import
**Problem**: AccountManager model might not be imported correctly
**Solution**: Verify import path matches your file structure:
```typescript
import { AccountManager } from '../models/AccountManager'
// or
const { AccountManager } = require('../models')
```

---

## 📝 Additional Recommendations

### 1. Add Rate Limiting
```typescript
// Add rate limiting to prevent brute force attacks
import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later'
})

router.post('/login', loginLimiter, authController.login)
```

### 2. Add Refresh Token Support
```typescript
// Generate refresh token
const refreshToken = jwt.sign(
  { id: accountManager.id, type: 'refresh' },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
)

// Store refresh token (in database or Redis)
// Return both tokens
return res.json({
  success: true,
  data: {
    token,
    refreshToken,
    user: userData
  }
})
```

### 3. Add Logout Endpoint (for History Logging)
```typescript
async logout(req, res) {
  const userId = req.user.id
  const userRole = req.user.role
  
  if (userRole === "account-management") {
    // Log logout history for account manager
    await AccountManagerHistory.create({
      accountManagerId: userId,
      action: "logout",
      details: "User logged out",
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    })
  }
  
  // Invalidate token (if using token blacklist)
  // Or rely on client-side token removal
  
  return res.json({
    success: true,
    message: "Logged out successfully"
  })
}
```

---

## ✅ Summary

### What Backend Needs to Do:
1. ✅ Modify `/api/auth/login` endpoint to check `account_managers` table
2. ✅ Return `role: "account-management"` for account managers
3. ✅ Update `loginCount` and `lastLogin` on successful login
4. ✅ Log login history automatically
5. ✅ Maintain backward compatibility with regular users

### What Frontend Already Does:
- ✅ Calls `api.auth.login(username, password)`
- ✅ Checks for `role === "account-management"`
- ✅ Sets account manager state correctly
- ✅ Redirects to account management dashboard
- ✅ Handles errors appropriately

### Integration Status:
- **Frontend**: ✅ Ready
- **Backend**: ⚠️ Needs login endpoint modification
- **After Implementation**: ✅ Fully functional

---

## 📞 Support

For questions about login implementation:
- **Frontend Login**: `lib/auth-context.tsx` - `loginAccountManagement()` function
- **Account Management Login Page**: `app/account-management-login/page.tsx`
- **Regular Login Page**: `app/login/page.tsx`
- **API Client**: `lib/api.ts` - `api.auth.login()`

---

## Notes

- **Backward Compatibility**: Make sure regular user login still works
- **Error Messages**: Keep error messages generic (don't reveal which table was checked)
- **Security**: Always use parameterized queries (Sequelize handles this)
- **Performance**: Consider caching frequently accessed account managers
- **Logging**: Log all login attempts (successful and failed) for security auditing
