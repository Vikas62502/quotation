# Backend Team - Account Management Individual Login Requirements

## Overview
Account Management now has a **separate login system** with its own authentication. Users with `account-management` role can only access the Account Management dashboard.

---

## 🔴 CRITICAL: New Backend Requirements

### 1. Account Management User Role

**New Role Required**: `account-management` (or `accountManager`)

**User Type**: Account Management users are separate from dealers, admins, and visitors.

### 2. Login Endpoint Support

**Existing Endpoint**: `POST /api/auth/login`

**Change Required**: Support `account-management` role in login response

**Current Request** (no changes):
```json
POST /api/auth/login
{
  "username": "accountmgr",
  "password": "account123"
}
```

**Response Update Required**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "account-mgr-001",
      "username": "accountmgr",
      "firstName": "Arjun",
      "lastName": "Singh",
      "email": "arjun.singh@accountmanagement.com",
      "mobile": "9876543215",
      "role": "account-management",  // ⚠️ NEW ROLE
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-12-17T10:00:00Z"
    }
  }
}
```

**Role Values Supported**:
- `"account-management"` (preferred)
- `"accountManager"` (alternative - frontend handles both)

---

## 📋 Account Management User Fields

### Required Fields
```typescript
interface AccountManager {
  id: string
  username: string
  firstName: string
  lastName: string
  email: string
  mobile: string
  role: "account-management" | "accountManager"
  isActive?: boolean
  emailVerified?: boolean
  createdAt?: string
}
```

### Optional Fields
- `isActive` (defaults to `true`)
- `emailVerified` (defaults to `false`)
- `createdAt` (timestamp)

---

## 🔐 Authentication Flow

### Account Management Login Flow

1. **User visits**: `/account-management-login`
2. **Frontend calls**: `POST /api/auth/login` with account management credentials
3. **Backend validates**: 
   - Username and password
   - User exists and is active
   - User has `role === "account-management"` or `role === "accountManager"`
4. **Backend returns**: Token + user object with `role: "account-management"`
5. **Frontend validates**: Role is `account-management` (blocks if not)
6. **Frontend redirects**: To `/dashboard/account-management`
7. **Access**: Only approved quotations are visible

### Access Control

**Account Management Login Page** (`/account-management-login`):
- ✅ Accepts `account-management` role users
- ❌ Rejects `admin`, `dealer`, or `visitor` role users
- Shows error: "Access denied. This login is only for Account Management users."

**Account Management Dashboard** (`/dashboard/account-management`):
- ✅ Only accessible with `role === "account-management"`
- ❌ All other roles are redirected to their respective dashboards
- Uses `GET /api/admin/quotations` to fetch all quotations (filters approved client-side)

---

## 🎯 API Endpoints Used

### 1. Login (Existing - Needs Role Support)
```
POST /api/auth/login
```

**Request**:
```json
{
  "username": "accountmgr",
  "password": "account123"
}
```

**Response** (must include `role: "account-management"`):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "account-mgr-001",
      "username": "accountmgr",
      "firstName": "Arjun",
      "lastName": "Singh",
      "email": "arjun.singh@accountmanagement.com",
      "mobile": "9876543215",
      "role": "account-management",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-12-17T10:00:00Z"
    }
  }
}
```

**Validation Rules**:
- Username and password must be valid
- User must exist in database
- User must have `role === "account-management"` or `role === "accountManager"`
- User must be active (`isActive === true`)

**Error Response** (if wrong role):
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Access denied. This login is only for Account Management users."
  }
}
```

---

### 2. Get All Quotations (Existing - Used by Account Management)
```
GET /api/admin/quotations
```

**Purpose**: Account Management users use the admin endpoint to see all quotations (they filter for approved on the frontend)

**Authentication**: Requires Bearer token (same as admin)

**Response**:
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-123",
        "status": "approved",
        "customer": { ... },
        "products": { ... },
        "pricing": { ... },
        // ... other fields
      }
    ]
  }
}
```

**Note**: Frontend filters for `status === "approved"` client-side. Backend can optionally add `?status=approved` query parameter support for better performance.

---

## 🔒 Security Considerations

### Role Validation
- ✅ Backend should validate role before allowing login
- ✅ Backend should validate role on protected endpoints
- ✅ Frontend also validates role but backend is the source of truth

### Token Validation
- ✅ Account Management tokens are validated the same way as other tokens
- ✅ Token contains role information
- ✅ Protected endpoints check role from token (not just authentication)

### Access Control
- ✅ Account Management users can only access `/dashboard/account-management`
- ✅ Account Management users cannot access `/dashboard/admin` or `/dashboard`
- ✅ Regular login (`/login`) should not accept account-management role users (optional - frontend handles this)

---

## 📝 Database Schema Considerations

### Account Management Users Table

**Suggested Schema**:
```sql
CREATE TABLE account_managers (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(20),
  role VARCHAR(50) DEFAULT 'account-management',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Indexes**:
- `username` (unique)
- `email` (unique)
- `role` (for role-based queries)

---

## 🧪 Testing Checklist

### Login Endpoint
- [ ] Login with account-management role returns correct role
- [ ] Login with account-management role returns token
- [ ] Login with wrong credentials returns error
- [ ] Login with inactive account-management user returns error
- [ ] Login with non-account-management user at `/account-management-login` is rejected

### Role Validation
- [ ] `role: "account-management"` is accepted
- [ ] `role: "accountManager"` is accepted (alternative)
- [ ] Other roles (`admin`, `dealer`, `visitor`) are rejected at account-management login

### Quotation Access
- [ ] Account Management users can call `GET /api/admin/quotations`
- [ ] Response includes all quotations with `status: "approved"`
- [ ] Filtering by `?status=approved` works (optional)

---

## 📚 Frontend Implementation

### Login Flow
1. **Login Page**: `/account-management-login`
2. **Login Function**: `loginAccountManagement(username, password)`
3. **Validation**: Checks for `role === "account-management"`
4. **Redirect**: To `/dashboard/account-management` on success

### Access Control
- Account Management page requires `role === "account-management"`
- All other roles are redirected to their dashboards
- Navigation is hidden for account-management users (they have custom header)

---

## ❓ Questions for Backend Team

1. **Role Name**: Do you prefer `"account-management"` or `"accountManager"`? Frontend handles both.

2. **Separate Endpoint**: Do you want a separate login endpoint like `POST /api/auth/account-management/login`, or use the existing `/api/auth/login` with role validation?

3. **User Management**: How should account management users be created/managed? Admin panel? Separate registration?

4. **Permissions**: Should account-management users have any special permissions beyond viewing approved quotations?

5. **Token Lifetime**: Should account-management users have different token expiration times?

---

## ✅ Summary

### What's Required
1. ✅ Support `role: "account-management"` in login response
2. ✅ Validate role in login endpoint
3. ✅ Account Management users should use admin endpoint for quotations
4. ✅ Return proper error if wrong role tries to login

### What's Optional
- ⚠️ Separate login endpoint (`/api/auth/account-management/login`)
- ⚠️ `?status=approved` query parameter for quotations endpoint
- ⚠️ Account Management user management endpoints

### What's Already Working
- ✅ Authentication system (tokens, refresh tokens)
- ✅ Quotation endpoints (`GET /api/admin/quotations`)
- ✅ Frontend is ready - just needs backend role support

---

## 📞 Contact

For questions about Account Management login implementation:
- Frontend Login: `app/account-management-login/page.tsx`
- Frontend Auth: `lib/auth-context.tsx` - `loginAccountManagement()` function
- Account Management Page: `app/dashboard/account-management/page.tsx`
- API Client: `lib/api.ts`

---

## Notes

- **Separate Login**: Account Management has its own login page (`/account-management-login`)
- **Role-Based Access**: Only `account-management` role can access Account Management
- **Same Auth System**: Uses same token-based authentication as other users
- **Admin Endpoint**: Uses admin quotations endpoint to get all quotations
- **Frontend Filtering**: Filters for approved quotations client-side (backend filtering optional)
