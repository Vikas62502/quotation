# Backend Changes Summary - Latest Requirements

## Overview
This document summarizes all recent backend changes required to support:
1. Payment Mode selection for Account Management users
2. Account Management access to quotations endpoint (fixing "Insufficient permissions" error)
3. Payment mode and payment status tracking

---

## 🔴 CRITICAL: Fix Authentication and Permission Errors

### Issue 1: "User not authenticated" Error
Account Management users are getting "User not authenticated" or "Error: User not authenticated" when trying to access quotations.

### Root Cause
The backend login endpoint (`/api/auth/login`) does not support account managers yet. Account managers are in a separate `account_managers` table, but the login endpoint only checks the `users` table.

### Solution Required - HIGHEST PRIORITY
**Modify `/api/auth/login` endpoint to support account managers:**

See `BACKEND_LOGIN_ENDPOINT_IMPLEMENTATION.md` for complete details. The login endpoint must:
1. Check both `users` and `account_managers` tables
2. Return `role: "account-management"` for account managers
3. Return a valid JWT token that includes the role
4. Update `loginCount` and `lastLogin` in `account_managers` table
5. Log login history

**Without this fix, account management users cannot login when API mode is enabled.**

---

### Issue 2: "Insufficient Permissions" Error
Account Management users are getting "Insufficient permissions" error when trying to view approved quotations.

### Root Cause
Frontend was calling `GET /api/admin/quotations` which requires admin permissions. Account management users don't have admin permissions.

### Solution Required
**Allow account-management role to access regular quotations endpoint:**

**Endpoint:** `GET /api/quotations?status=approved`

**Authorization Rules:**
- ✅ `account-management` role should be allowed to access `/api/quotations?status=approved`
- ✅ When `status=approved` is passed, backend MUST return ONLY approved quotations
- ✅ Account management users should NEVER see pending, rejected, or any other status
- ❌ Account management users should NOT be able to access `/api/admin/quotations` (admin-only)

**Implementation:**
```javascript
// GET /api/quotations
router.get('/quotations', authenticate, async (req, res) => {
  const user = req.user
  const { status } = req.query
  
  // For account-management role, enforce approved-only filter
  if (user.role === 'account-management') {
    // Force status to approved for account management users
    req.query.status = 'approved'
    
    // Also ensure they can't see other statuses
    if (status && status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Account management users can only view approved quotations'
        }
      })
    }
  }
  
  // Continue with normal filtering logic
  // ...
})
```

**Priority:** 🔴 **HIGH - This is blocking account management users**

---

## 1. Payment Mode API Implementation

### 1.1 Database Schema
Add to `quotations` table:
```sql
ALTER TABLE quotations
ADD COLUMN payment_mode VARCHAR(50) NULL,
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (payment_status IN ('pending', 'completed', 'partial'));
```

### 1.2 New Endpoint Required
**Endpoint:** `PATCH /api/quotations/{quotationId}/payment-mode`

**Authorization:**
- ✅ Only `account-management` role can update payment mode
- ✅ Only approved quotations can have payment mode set
- ❌ Other roles should receive 403 error

**Request:**
```json
{
  "paymentMode": "cash" | "bank_transfer" | "upi" | "cheque" | "neft" | "rtgs" | "credit_card" | "debit_card",
  "paymentStatus": "pending" | "completed" | "partial" (optional)
}
```

**Valid Payment Modes:**
- `cash`
- `bank_transfer`
- `upi`
- `cheque`
- `neft`
- `rtgs`
- `credit_card`
- `debit_card`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "QT-123456",
    "paymentMode": "cash",
    "paymentStatus": "pending",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Cases:**
- 403: Non-account-management user or quotation not approved
- 400: Invalid payment mode value
- 404: Quotation not found

**Full Documentation:** See `BACKEND_PAYMENT_MODE_API.md`

---

## 2. Quotation Response Updates

### 2.1 Include Payment Fields
All quotation responses should include `paymentMode` and `paymentStatus`:

```json
{
  "id": "QT-123456",
  "customer": { ... },
  "products": { ... },
  "status": "approved",
  "paymentMode": "cash",
  "paymentStatus": "pending",
  "totalAmount": 230000,
  "finalAmount": 152000,
  ...
}
```

**Endpoints to Update:**
- `GET /api/quotations/{quotationId}`
- `GET /api/quotations` (list endpoint)
- `GET /api/admin/quotations` (if applicable)

---

## 3. Authorization Matrix

| Endpoint | Admin | Dealer | Visitor | Account Management |
|----------|-------|--------|---------|-------------------|
| `GET /api/quotations?status=approved` | ✅ | ✅ | ❌ | ✅ (approved only) |
| `GET /api/quotations?status=pending` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/admin/quotations` | ✅ | ❌ | ❌ | ❌ |
| `PATCH /api/quotations/{id}/payment-mode` | ❌ | ❌ | ❌ | ✅ (approved only) |
| `GET /api/quotations/{id}` | ✅ | ✅ (own only) | ❌ | ✅ (approved only) |

---

## 4. Implementation Checklist

### Database
- [ ] Add `payment_mode` column to `quotations` table
- [ ] Add `payment_status` column to `quotations` table
- [ ] Create indexes on payment fields
- [ ] Add constraints for payment_status enum

### API Endpoints - Critical
- [ ] **Fix:** Allow `account-management` role to access `GET /api/quotations?status=approved`
- [ ] **Fix:** Enforce that account-management users can ONLY see approved quotations
- [ ] **Fix:** Return 403 if account-management user requests non-approved status

### API Endpoints - Payment Mode
- [ ] Implement `PATCH /api/quotations/{quotationId}/payment-mode`
- [ ] Add validation for payment mode values
- [ ] Add authorization: account-management role only
- [ ] Add business rule: only approved quotations
- [ ] Update `GET /api/quotations/{quotationId}` to include payment fields
- [ ] Update `GET /api/quotations` to include payment fields

### Testing
- [ ] Test account-management user can access `/api/quotations?status=approved`
- [ ] Test account-management user gets 403 for non-approved status
- [ ] Test payment mode update by account-management user
- [ ] Test payment mode update fails for non-approved quotations
- [ ] Test payment mode update fails for non-account-management users

---

## 5. Priority Order

### 🔴 HIGHEST PRIORITY (Blocking Login)
1. **Fix "User not authenticated" error - CRITICAL:**
   - Modify `/api/auth/login` to support account managers from `account_managers` table
   - Return proper JWT token with `role: "account-management"`
   - Without this, account management users cannot login when API is enabled
   - **See:** `BACKEND_LOGIN_ENDPOINT_IMPLEMENTATION.md`

### 🔴 HIGH PRIORITY (Blocking Data Access)
2. **Fix "Insufficient permissions" error:**
   - Allow `account-management` role to access `GET /api/quotations?status=approved`
   - Enforce approved-only filtering for account-management users

### 🟡 MEDIUM PRIORITY (Feature Implementation)
2. **Payment Mode API:**
   - Add database fields
   - Implement `PATCH /api/quotations/{quotationId}/payment-mode` endpoint
   - Include payment fields in quotation responses

### 🟢 LOW PRIORITY (Enhancements)
3. Payment status tracking and reporting
4. Payment mode filtering/searching

---

## 6. Related Documents

- **Payment Mode API Details:** `BACKEND_PAYMENT_MODE_API.md`
- **Account Management Filtering:** `BACKEND_ACCOUNT_MANAGEMENT_APPROVED_FILTER.md`
- **Login Endpoint:** `BACKEND_LOGIN_ENDPOINT_IMPLEMENTATION.md`
- **Account Management CRUD:** `BACKEND_ACCOUNT_MANAGEMENT_CRUD_API.md`

---

## 7. Quick Reference: Payment Mode Endpoint

```javascript
// PATCH /api/quotations/:quotationId/payment-mode
// Authorization: account-management role only
// Business Rule: Only approved quotations

const validPaymentModes = [
  'cash', 'bank_transfer', 'upi', 'cheque', 
  'neft', 'rtgs', 'credit_card', 'debit_card'
]

// Validation:
// 1. User role === 'account-management'
// 2. Quotation status === 'approved'
// 3. paymentMode in validPaymentModes
```

---

## 8. Testing Commands

### Test Account Management Access
```bash
# Should succeed - account management viewing approved quotations
curl -X GET "http://localhost:3050/api/quotations?status=approved" \
  -H "Authorization: Bearer {account-management-token}"

# Should fail - account management trying to view pending
curl -X GET "http://localhost:3050/api/quotations?status=pending" \
  -H "Authorization: Bearer {account-management-token}"
# Expected: 403 Forbidden
```

### Test Payment Mode Update
```bash
# Should succeed - account management updating payment mode
curl -X PATCH "http://localhost:3050/api/quotations/QT-123/payment-mode" \
  -H "Authorization: Bearer {account-management-token}" \
  -H "Content-Type: application/json" \
  -d '{"paymentMode": "cash"}'

# Should fail - dealer trying to update payment mode
curl -X PATCH "http://localhost:3050/api/quotations/QT-123/payment-mode" \
  -H "Authorization: Bearer {dealer-token}" \
  -H "Content-Type: application/json" \
  -d '{"paymentMode": "cash"}'
# Expected: 403 Forbidden
```

---

## Contact

For detailed implementation guides, see:
- `BACKEND_PAYMENT_MODE_API.md` - Complete payment mode API specification
- `BACKEND_ACCOUNT_MANAGEMENT_APPROVED_FILTER.md` - Approved quotations filtering
- `BACKEND_LOGIN_ENDPOINT_IMPLEMENTATION.md` - Account manager login support
