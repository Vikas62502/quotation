# Backend API Requirements: Payment Mode for Account Management

## Overview
Account Management users need to be able to select and save payment modes for approved quotations. This document outlines the backend API changes required to support this functionality.

---

## 1. Database Schema Changes

### 1.1 Quotations Table
Add the following fields to the `quotations` table:

```sql
ALTER TABLE quotations
ADD COLUMN payment_mode VARCHAR(50) NULL,
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'partial'));
```

**Field Descriptions:**
- `payment_mode`: Stores the selected payment method (e.g., "cash", "bank_transfer", "upi", "cheque", "neft", "rtgs", "credit_card", "debit_card")
- `payment_status`: Tracks payment status (pending, completed, partial)

**Index:**
```sql
CREATE INDEX idx_quotations_payment_mode ON quotations(payment_mode);
CREATE INDEX idx_quotations_payment_status ON quotations(payment_status);
```

---

## 2. API Endpoints

### 2.1 Update Payment Mode
**Endpoint:** `PATCH /api/quotations/{quotationId}/payment-mode`

**Description:** Allows account management users to set/update the payment mode for an approved quotation.

**Request:**
```http
PATCH /api/quotations/{quotationId}/payment-mode
Authorization: Bearer {token}
Content-Type: application/json

{
  "paymentMode": "cash" | "bank_transfer" | "upi" | "cheque" | "neft" | "rtgs" | "credit_card" | "debit_card",
  "paymentStatus": "pending" | "completed" | "partial" (optional, defaults to "pending")
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

**Response (200 OK):**
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

**Error Responses:**

**400 Bad Request** - Invalid payment mode:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payment mode. Must be one of: cash, bank_transfer, upi, cheque, neft, rtgs, credit_card, debit_card"
  }
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "Unauthorized. Please login again."
  }
}
```

**403 Forbidden** - Not an approved quotation or insufficient permissions:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Insufficient permissions. Only account-management users can update payment mode for approved quotations."
  }
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Quotation not found"
  }
}
```

---

## 3. Authorization & Access Control

### 3.1 Payment Mode Update Permissions

**Allowed Roles:**
- ✅ `account-management` - Can update payment mode for approved quotations only
- ❌ `admin` - Should NOT update payment mode (this is account management's responsibility)
- ❌ `dealer` - Should NOT update payment mode
- ❌ `visitor` - Should NOT update payment mode

### 3.2 Business Rules

1. **Only Approved Quotations:**
   - Payment mode can only be set/updated for quotations with `status = "approved"`
   - If quotation status is not "approved", return 403 error

2. **Account Management Only:**
   - Only users with role `account-management` can update payment mode
   - Other roles should receive 403 error

3. **Validation:**
   - Payment mode must be one of the valid values listed above
   - Payment status is optional, defaults to "pending" if not provided

---

## 4. Get Quotation Response Update

### 4.1 Include Payment Fields
When returning quotation data, include `paymentMode` and `paymentStatus` fields:

**Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "QT-123456",
    "customer": { ... },
    "products": { ... },
    "status": "approved",
    "paymentMode": "cash",
    "paymentStatus": "pending",
    "totalAmount": 230000,
    "finalAmount": 152000,
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 5. Quotations List Endpoint for Account Management

### 5.1 Regular Quotations Endpoint Access
**Endpoint:** `GET /api/quotations?status=approved`

**Description:** Account management users should be able to access the regular quotations endpoint (not admin endpoint) with `status=approved` filter.

**Authorization:**
- ✅ `account-management` role should be allowed
- ✅ Should only return quotations with `status = "approved"`
- ❌ Should NOT return pending or rejected quotations

**Request:**
```http
GET /api/quotations?status=approved&page=1&limit=1000
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-123456",
        "customer": { ... },
        "products": { ... },
        "status": "approved",
        "paymentMode": "cash",
        "paymentStatus": "pending",
        "finalAmount": 152000,
        "createdAt": "2024-01-10T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 1000,
      "total": 25,
      "totalPages": 1
    }
  }
}
```

**Important:** 
- Account management users should NOT use `/api/admin/quotations` endpoint (that's admin-only)
- They should use `/api/quotations?status=approved` instead
- Backend should enforce that account-management users can ONLY see approved quotations

---

## 6. Implementation Checklist

### Database
- [ ] Add `payment_mode` column to `quotations` table
- [ ] Add `payment_status` column to `quotations` table
- [ ] Create indexes on payment fields
- [ ] Add database constraints/validations

### API Endpoints
- [ ] Implement `PATCH /api/quotations/{quotationId}/payment-mode` endpoint
- [ ] Add validation for payment mode values
- [ ] Add authorization checks (account-management role only)
- [ ] Add business rule: only approved quotations can have payment mode set
- [ ] Update `GET /api/quotations/{quotationId}` to include payment fields
- [ ] Update `GET /api/quotations` to allow account-management role access
- [ ] Ensure `GET /api/quotations` filters by status=approved for account-management users

### Authorization
- [ ] Verify account-management role can access `/api/quotations?status=approved`
- [ ] Verify account-management role CANNOT access `/api/admin/quotations`
- [ ] Verify only account-management role can update payment mode
- [ ] Verify payment mode can only be set for approved quotations

### Error Handling
- [ ] Return 403 if non-account-management user tries to update payment mode
- [ ] Return 403 if quotation status is not "approved"
- [ ] Return 400 for invalid payment mode values
- [ ] Return 404 if quotation not found
- [ ] Return 401 if not authenticated

### Testing
- [ ] Test payment mode update by account-management user
- [ ] Test payment mode update fails for non-approved quotations
- [ ] Test payment mode update fails for non-account-management users
- [ ] Test quotations list returns only approved quotations for account-management users
- [ ] Test payment fields are included in quotation responses

---

## 7. Example Implementation (Node.js/Express)

```javascript
// PATCH /api/quotations/:quotationId/payment-mode
router.patch('/quotations/:quotationId/payment-mode', authenticate, async (req, res) => {
  try {
    const { quotationId } = req.params
    const { paymentMode, paymentStatus = 'pending' } = req.body
    const user = req.user // From authentication middleware

    // Check if user is account-management role
    if (user.role !== 'account-management') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Insufficient permissions. Only account-management users can update payment mode.'
        }
      })
    }

    // Validate payment mode
    const validPaymentModes = ['cash', 'bank_transfer', 'upi', 'cheque', 'neft', 'rtgs', 'credit_card', 'debit_card']
    if (!validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid payment mode. Must be one of: ${validPaymentModes.join(', ')}`
        }
      })
    }

    // Validate payment status
    const validPaymentStatuses = ['pending', 'completed', 'partial']
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`
        }
      })
    }

    // Get quotation
    const quotation = await Quotation.findById(quotationId)
    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Quotation not found'
        }
      })
    }

    // Check if quotation is approved
    if (quotation.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Payment mode can only be set for approved quotations.'
        }
      })
    }

    // Update payment mode
    quotation.paymentMode = paymentMode
    quotation.paymentStatus = paymentStatus
    quotation.updatedAt = new Date()
    await quotation.save()

    res.json({
      success: true,
      data: {
        id: quotation.id,
        paymentMode: quotation.paymentMode,
        paymentStatus: quotation.paymentStatus,
        updatedAt: quotation.updatedAt
      }
    })
  } catch (error) {
    console.error('Error updating payment mode:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update payment mode'
      }
    })
  }
})
```

---

## 8. Migration Script (if using migrations)

```sql
-- Migration: Add payment mode fields to quotations table
-- Date: 2024-01-15

BEGIN;

-- Add payment_mode column
ALTER TABLE quotations
ADD COLUMN payment_mode VARCHAR(50) NULL;

-- Add payment_status column
ALTER TABLE quotations
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';

-- Add constraint for payment_status
ALTER TABLE quotations
ADD CONSTRAINT chk_payment_status 
CHECK (payment_status IN ('pending', 'completed', 'partial'));

-- Create indexes
CREATE INDEX idx_quotations_payment_mode ON quotations(payment_mode);
CREATE INDEX idx_quotations_payment_status ON quotations(payment_status);

-- Add comment
COMMENT ON COLUMN quotations.payment_mode IS 'Payment method selected by account management (cash, bank_transfer, upi, cheque, neft, rtgs, credit_card, debit_card)';
COMMENT ON COLUMN quotations.payment_status IS 'Payment status: pending, completed, or partial';

COMMIT;
```

---

## 9. Frontend Integration Notes

The frontend is already implemented and expects:
1. `PATCH /api/quotations/{quotationId}/payment-mode` endpoint to exist
2. Payment mode and payment status fields in quotation responses
3. `/api/quotations?status=approved` endpoint to be accessible by account-management role

---

## 10. Priority

**High Priority:**
- ✅ Allow account-management role to access `/api/quotations?status=approved` (fixes "Insufficient permissions" error)
- ✅ Implement `PATCH /api/quotations/{quotationId}/payment-mode` endpoint
- ✅ Add payment_mode and payment_status fields to database

**Medium Priority:**
- Include payment fields in all quotation responses
- Add payment mode filtering/searching capabilities

---

## 11. Testing Scenarios

1. **Account Management User Updates Payment Mode:**
   - Login as account-management user
   - View approved quotation
   - Select payment mode (e.g., "cash")
   - Save payment mode
   - ✅ Should succeed with 200 response

2. **Non-Account Management User Tries to Update:**
   - Login as dealer/admin
   - Try to update payment mode
   - ✅ Should fail with 403 error

3. **Update Payment Mode for Non-Approved Quotation:**
   - Login as account-management user
   - Try to update payment mode for pending quotation
   - ✅ Should fail with 403 error

4. **Invalid Payment Mode:**
   - Login as account-management user
   - Try to set payment mode to "invalid_mode"
   - ✅ Should fail with 400 error

5. **Account Management User Views Quotations:**
   - Login as account-management user
   - Call `GET /api/quotations?status=approved`
   - ✅ Should return only approved quotations
   - ✅ Should NOT return pending or rejected quotations

---

## Contact

For questions or clarifications, please refer to the frontend implementation in:
- `app/dashboard/account-management/page.tsx`
- `components/quotation-details-dialog.tsx`
