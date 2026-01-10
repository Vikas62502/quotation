# Backend Team - Account Management CRUD API Requirements

## Overview
The Admin Panel now allows creating, editing, viewing, and managing Account Management users. The admin can also view the history/activity of each account management user. The following API endpoints are required to support this functionality.

---

## 🔴 CRITICAL: New API Endpoints Required

### 1. Get All Account Managers

**Endpoint**: `GET /api/admin/account-managers`

**Purpose**: Retrieve all account management users with optional filtering and pagination

**Query Parameters**:
- `page` (number, optional): Page number for pagination
- `limit` (number, optional): Number of items per page
- `search` (string, optional): Search term (searches in firstName, lastName, email, mobile, username)
- `isActive` (boolean, optional): Filter by active status
- `sortBy` (string, optional): Field to sort by (e.g., "createdAt", "lastName")
- `sortOrder` (string, optional): Sort order - "asc" or "desc"

**Request Example**:
```
GET /api/admin/account-managers?page=1&limit=20&isActive=true
GET /api/admin/account-managers?search=john
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "accountManagers": [
      {
        "id": "account-mgr-001",
        "username": "accountmgr",
        "firstName": "Arjun",
        "lastName": "Singh",
        "email": "arjun.singh@accountmanagement.com",
        "mobile": "9876543215",
        "isActive": true,
        "emailVerified": true,
        "createdAt": "2025-12-17T10:00:00Z",
        "loginCount": 15,
        "lastLogin": "2025-12-17T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Response Fields**:
- `id` (string, required): Unique identifier
- `username` (string, required): Username for login
- `firstName` (string, required): First name
- `lastName` (string, required): Last name
- `email` (string, required): Email address
- `mobile` (string, required): Mobile number (10 digits)
- `isActive` (boolean, required): Whether account is active
- `emailVerified` (boolean, optional): Email verification status
- `createdAt` (string, required): ISO 8601 timestamp
- `loginCount` (number, optional): Total number of logins
- `lastLogin` (string, optional): ISO 8601 timestamp of last login

---

### 2. Get Account Manager by ID

**Endpoint**: `GET /api/admin/account-managers/{accountManagerId}`

**Purpose**: Retrieve detailed information about a specific account manager

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "account-mgr-001",
    "username": "accountmgr",
    "firstName": "Arjun",
    "lastName": "Singh",
    "email": "arjun.singh@accountmanagement.com",
    "mobile": "9876543215",
    "isActive": true,
    "emailVerified": true,
    "createdAt": "2025-12-17T10:00:00Z",
    "updatedAt": "2025-12-17T15:00:00Z",
    "loginCount": 15,
    "lastLogin": "2025-12-17T14:30:00Z"
  }
}
```

**Error Response (404)**:
```json
{
  "success": false,
  "error": {
    "code": "RES_001",
    "message": "Account manager not found"
  }
}
```

---

### 3. Create Account Manager

**Endpoint**: `POST /api/admin/account-managers`

**Purpose**: Create a new account management user

**Request Body**:
```json
{
  "username": "accountmgr",
  "password": "securePassword123",
  "firstName": "Arjun",
  "lastName": "Singh",
  "email": "arjun.singh@accountmanagement.com",
  "mobile": "9876543215"
}
```

**Validation Rules**:
- `username` (required, string, unique): 3-50 characters, alphanumeric and underscore only
- `password` (required, string): Minimum 8 characters
- `firstName` (required, string): 1-100 characters
- `lastName` (required, string): 1-100 characters
- `email` (required, string, unique): Valid email format
- `mobile` (required, string): Exactly 10 digits

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "account-mgr-001",
    "username": "accountmgr",
    "firstName": "Arjun",
    "lastName": "Singh",
    "email": "arjun.singh@accountmanagement.com",
    "mobile": "9876543215",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2025-12-17T10:00:00Z",
    "loginCount": 0,
    "lastLogin": null
  },
  "message": "Account manager created successfully"
}
```

**Error Responses**:

**400 Validation Error**:
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Validation error",
    "details": [
      {
        "field": "email",
        "message": "Email already exists"
      },
      {
        "field": "username",
        "message": "Username already exists"
      }
    ]
  }
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "Unauthorized. Admin access required."
  }
}
```

---

### 4. Update Account Manager

**Endpoint**: `PUT /api/admin/account-managers/{accountManagerId}`

**Purpose**: Update account manager information (excluding password - use separate endpoint)

**Request Body** (all fields optional except those being updated):
```json
{
  "firstName": "Arjun",
  "lastName": "Singh",
  "email": "arjun.singh@accountmanagement.com",
  "mobile": "9876543215",
  "isActive": true,
  "emailVerified": true
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "account-mgr-001",
    "username": "accountmgr",
    "firstName": "Arjun",
    "lastName": "Singh",
    "email": "arjun.singh@accountmanagement.com",
    "mobile": "9876543215",
    "isActive": true,
    "emailVerified": true,
    "createdAt": "2025-12-17T10:00:00Z",
    "updatedAt": "2025-12-17T15:00:00Z"
  },
  "message": "Account manager updated successfully"
}
```

**Notes**:
- Username cannot be changed
- Password cannot be updated via this endpoint (use password endpoint)
- Email must be unique if changed

---

### 5. Update Account Manager Password

**Endpoint**: `PUT /api/admin/account-managers/{accountManagerId}/password`

**Purpose**: Update account manager password

**Request Body**:
```json
{
  "newPassword": "newSecurePassword123"
}
```

**Validation**:
- `newPassword` (required, string): Minimum 8 characters

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Error Response (400)**:
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Password must be at least 8 characters"
  }
}
```

---

### 6. Activate Account Manager

**Endpoint**: `PATCH /api/admin/account-managers/{accountManagerId}/activate`

**Purpose**: Activate a deactivated account manager

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "account-mgr-001",
    "isActive": true
  },
  "message": "Account manager activated successfully"
}
```

---

### 7. Deactivate Account Manager

**Endpoint**: `PATCH /api/admin/account-managers/{accountManagerId}/deactivate`

**Purpose**: Deactivate an account manager (soft delete - sets isActive to false)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "account-mgr-001",
    "isActive": false
  },
  "message": "Account manager deactivated successfully"
}
```

**Notes**:
- This is a soft delete - the account manager record is preserved
- Deactivated account managers cannot login
- Can be reactivated using the activate endpoint

---

### 8. Delete Account Manager (Hard Delete)

**Endpoint**: `DELETE /api/admin/account-managers/{accountManagerId}`

**Purpose**: Permanently delete an account manager (hard delete)

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Account manager deleted successfully"
}
```

**Notes**:
- This is a permanent deletion
- Consider using deactivate instead for audit purposes
- Should be used with caution

---

### 9. Get Account Manager History

**Endpoint**: `GET /api/admin/account-managers/{accountManagerId}/history`

**Purpose**: Retrieve activity and login history for an account manager

**Query Parameters**:
- `page` (number, optional): Page number for pagination
- `limit` (number, optional): Number of items per page (default: 50)
- `startDate` (string, optional): ISO 8601 date - filter history from this date
- `endDate` (string, optional): ISO 8601 date - filter history until this date

**Request Example**:
```
GET /api/admin/account-managers/account-mgr-001/history?page=1&limit=50
GET /api/admin/account-managers/account-mgr-001/history?startDate=2025-12-01T00:00:00Z&endDate=2025-12-17T23:59:59Z
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "hist-001",
        "action": "login",
        "timestamp": "2025-12-17T14:30:00Z",
        "details": "User logged in successfully",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0..."
      },
      {
        "id": "hist-002",
        "action": "view_quotations",
        "timestamp": "2025-12-17T14:35:00Z",
        "details": "Viewed approved quotations",
        "ipAddress": "192.168.1.100"
      },
      {
        "id": "hist-003",
        "action": "logout",
        "timestamp": "2025-12-17T16:00:00Z",
        "details": "User logged out",
        "ipAddress": "192.168.1.100"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**History Item Fields**:
- `id` (string, required): Unique identifier for history entry
- `action` (string, required): Action type (e.g., "login", "logout", "view_quotations", "password_change")
- `timestamp` (string, required): ISO 8601 timestamp
- `details` (string, optional): Human-readable description
- `description` (string, optional): Alternative to details
- `ipAddress` (string, optional): IP address from which action was performed
- `userAgent` (string, optional): User agent string

**Action Types** (Recommended):
- `login`: User logged in
- `logout`: User logged out
- `view_quotations`: Viewed quotations list
- `view_quotation_details`: Viewed specific quotation details
- `password_change`: Changed password
- `profile_update`: Updated profile information

**Notes**:
- History should be logged automatically for login/logout events
- Consider logging all significant user actions
- History should be stored for audit purposes
- Older history entries can be archived

---

## 🔐 Authentication & Authorization

### All Endpoints
- **Authentication**: Required (Bearer token in Authorization header)
- **Authorization**: Admin role only
- **Error Code**: `AUTH_004` - Insufficient permissions (403)

### Token Validation
```http
Authorization: Bearer <jwt_token>
```

**Error Response (401)**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "Invalid or expired token"
  }
}
```

**Error Response (403)**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Insufficient permissions. Admin access required."
  }
}
```

---

## 📋 Database Schema Considerations

### Account Managers Table
```sql
CREATE TABLE account_managers (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  role VARCHAR(50) DEFAULT 'account-management',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  login_count INT DEFAULT 0,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
);
```

### Account Manager History Table
```sql
CREATE TABLE account_manager_history (
  id VARCHAR(255) PRIMARY KEY,
  account_manager_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_manager_id) REFERENCES account_managers(id) ON DELETE CASCADE,
  INDEX idx_account_manager_id (account_manager_id),
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp)
);
```

**Notes**:
- Use password hashing (bcrypt, argon2, etc.) - never store plain passwords
- `login_count` should be incremented on each successful login
- `last_login` should be updated on each successful login
- History table should use CASCADE delete to maintain referential integrity
- Consider partitioning history table by date for better performance

---

## 🔄 Activity Logging Requirements

### Automatic History Logging

The backend should automatically log the following events:

1. **Login Events**:
   - Log every successful login
   - Include IP address and user agent
   - Increment `login_count` and update `last_login`

2. **Logout Events**:
   - Log every logout
   - Include IP address and timestamp

3. **View Quotations**:
   - Log when account manager views quotations list
   - Optional: Include search terms if applicable

4. **View Quotation Details**:
   - Log when account manager views specific quotation details
   - Include quotation ID

5. **Password Changes**:
   - Log when password is changed (via admin or self-service)

6. **Profile Updates**:
   - Log when profile information is updated

### History Logging Implementation

**Example: Logging Login Event**
```javascript
// After successful login
await db.accountManagerHistory.create({
  accountManagerId: accountManager.id,
  action: 'login',
  details: 'User logged in successfully',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date()
})

// Update login count and last login
await db.accountManagers.update(accountManager.id, {
  loginCount: accountManager.loginCount + 1,
  lastLogin: new Date()
})
```

---

## ✅ Testing Checklist

### Create Account Manager
- [ ] Create with valid data
- [ ] Create with duplicate username (should fail)
- [ ] Create with duplicate email (should fail)
- [ ] Create with invalid email format (should fail)
- [ ] Create with invalid mobile (should fail)
- [ ] Create with short password (should fail)
- [ ] Create without required fields (should fail)

### Get Account Managers
- [ ] Get all account managers
- [ ] Get with pagination
- [ ] Get with search filter
- [ ] Get with isActive filter
- [ ] Get with sorting

### Update Account Manager
- [ ] Update all fields
- [ ] Update partial fields
- [ ] Update with duplicate email (should fail)
- [ ] Update with invalid mobile (should fail)
- [ ] Update non-existent account manager (should fail)

### Password Management
- [ ] Update password with valid password
- [ ] Update password with short password (should fail)
- [ ] Verify password hash is stored (not plain text)

### Activate/Deactivate
- [ ] Activate deactivated account manager
- [ ] Deactivate active account manager
- [ ] Verify deactivated account manager cannot login

### History
- [ ] Get history for account manager
- [ ] Get history with pagination
- [ ] Get history with date range filter
- [ ] Verify login events are logged
- [ ] Verify logout events are logged
- [ ] Verify view quotations events are logged

### Authorization
- [ ] Verify admin can access all endpoints
- [ ] Verify non-admin cannot access endpoints (403)
- [ ] Verify unauthenticated requests fail (401)

---

## 📝 Response Structure

All endpoints should follow this standard response structure:

**Success Response**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Field-specific error message"
      }
    ]
  }
}
```

**Note**: The frontend `apiRequest` function automatically unwraps `data.data` from the response, so backend should return:
```json
{
  "success": true,
  "data": {
    "accountManagers": [ /* ... */ ]
  }
}
```

Frontend receives (after unwrapping):
```javascript
{
  "accountManagers": [ /* ... */ ]
}
```

---

## 🎯 Priority Implementation Order

1. **HIGH PRIORITY**: `POST /api/admin/account-managers` - Create account managers
2. **HIGH PRIORITY**: `GET /api/admin/account-managers` - List account managers
3. **HIGH PRIORITY**: `GET /api/admin/account-managers/{id}/history` - View history
4. **MEDIUM PRIORITY**: `PUT /api/admin/account-managers/{id}` - Update account managers
5. **MEDIUM PRIORITY**: `PUT /api/admin/account-managers/{id}/password` - Update password
6. **MEDIUM PRIORITY**: `PATCH /api/admin/account-managers/{id}/activate` - Activate
7. **MEDIUM PRIORITY**: `PATCH /api/admin/account-managers/{id}/deactivate` - Deactivate
8. **LOW PRIORITY**: `DELETE /api/admin/account-managers/{id}` - Hard delete
9. **LOW PRIORITY**: `GET /api/admin/account-managers/{id}` - Get by ID (if needed)

---

## 📞 Contact

For questions about Account Management CRUD implementation:
- Frontend Implementation: `app/dashboard/admin/page.tsx` - Account Management tab
- API Client: `lib/api.ts` - `api.admin.accountManagers` methods
- Account Management Login: `app/account-management-login/page.tsx`

---

## Notes

- All endpoints require admin authentication
- Account managers should be created with `role: "account-management"`
- History logging should be automatic for login/logout events
- Consider implementing rate limiting for create/update endpoints
- Email verification can be implemented separately if needed
- Password reset functionality can be added later if required
