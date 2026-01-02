# Backend Fix Required: GET /admin/quotations - Full Customer Data

**Date:** December 23, 2025  
**Issue:** The `GET /admin/quotations` endpoint returns limited customer data (only firstName, lastName, mobile), causing missing email and address in the Admin Panel's quotation list view.

---

## Problem Summary

The backend `GET /admin/quotations` endpoint currently returns incomplete customer data:

**Current Response (Incomplete):**
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-ABC123",
        "customer": {
          "firstName": "Amit",
          "lastName": "Sharma",
          "mobile": "9876543210"
          // ❌ Missing: email, address
        }
      }
    ]
  }
}
```

**The Admin Panel expects and displays customer email and address in the quotation table, but these fields are missing.**

---

## Required Backend Implementation

### GET /admin/quotations MUST Return Full Customer Data

The `GET /admin/quotations` endpoint **should** include complete customer information for admin views, including:
- `firstName`
- `lastName`
- `mobile`
- **`email`** ✅ (currently missing)
- **`address`** ✅ (currently missing)
  - `street`
  - `city`
  - `state`
  - `pincode`

**Note:** While the dealer's `GET /quotations` endpoint can use limited fields for performance, the admin endpoint should return full customer data since admins need complete information for management purposes.

---

## Expected API Response

**GET /admin/quotations** should return:

```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "id": "QT-MX6P43",
        "dealer": {
          "id": "dealer_8",
          "firstName": "Aman",
          "lastName": "Raj"
        },
        "customer": {
          "firstName": "Prashant",
          "lastName": "Kumar",
          "mobile": "9249929903",
          "email": "prashant@example.com",
          "address": {
            "street": "123 Main Street",
            "city": "Jaipur",
            "state": "Rajasthan",
            "pincode": "302001"
          }
        },
        "systemType": "on-grid",
        "finalAmount": 285950,
        "status": "pending",
        "createdAt": "2025-12-25T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Critical:** The `customer` object MUST include:
- ✅ `email` field
- ✅ `address` object with `street`, `city`, `state`, `pincode`

---

## Difference Between Dealer and Admin Endpoints

| Endpoint | Purpose | Customer Data Returned |
|----------|---------|----------------------|
| `GET /quotations` (Dealer) | Dealer's own quotations list | Limited: `firstName`, `lastName`, `mobile` (for performance) |
| `GET /admin/quotations` (Admin) | All quotations list | **Complete: All fields including `email` and `address`** (for management) |

**Rationale:**
- **Dealer endpoint:** Optimized for performance, dealer only needs basic customer info in list view
- **Admin endpoint:** Should provide complete data for administrative oversight and management

**Both endpoints still use `GET /quotations/{quotationId}` for detailed views** which returns full customer data.

---

## Database Field Mapping

When retrieving customer data, ensure proper field mapping:

**Database → API Response:**
- `streetAddress` (DB) → `address.street` (API)
- `city` (DB) → `address.city` (API)
- `state` (DB) → `address.state` (API)
- `pincode` (DB) → `address.pincode` (API)
- `email` (DB) → `email` (API)

---

## Implementation Checklist

### Backend Tasks

- [ ] **Update `GET /admin/quotations` implementation**
  - [ ] Include ALL customer fields in the query (not just firstName, lastName, mobile)
  - [ ] Include `email` field in customer response
  - [ ] Include complete `address` object with all fields (street, city, state, pincode)
  - [ ] Ensure proper field mapping (streetAddress → address.street)

- [ ] **Verify Customer Include Statement**
  ```typescript
  include: [{
    model: Customer,
    as: 'customer',
    // ✅ Include ALL customer fields (email, address, etc.)
    // Do NOT use attributes: ['firstName', 'lastName', 'mobile'] like in dealer endpoint
  }]
  ```

- [ ] **Verify Response Formatting**
  - [ ] Map `streetAddress` (DB) to `address.street` (API response)
  - [ ] Include complete `address` object structure
  - [ ] Include `email` field
  - [ ] Ensure consistent structure with `GET /quotations/{quotationId}`

- [ ] **Testing**
  - [ ] Test GET /admin/quotations returns complete customer data
  - [ ] Verify email is present in response
  - [ ] Verify address object contains all fields (street, city, state, pincode)
  - [ ] Test with quotations that have customers with email and address data
  - [ ] Test with quotations that have customers with missing/null email or address (should handle gracefully)

---

## Frontend Impact

**Current Issue:**
- Admin Panel's quotation table shows:
  - Customer name ✅
  - Customer mobile ✅
  - Customer email ❌ (empty/undefined)
  - Customer address ❌ (not displayed in table, but needed in details)

**After Fix:**
- All customer fields will be populated correctly in the list view
- Admin can see customer email in the quotation table
- Admin has complete customer data available for display and management

---

## API Specification Update Needed

**File:** `API_SPECIFICATION.txt`  
**Section:** `A. GET ALL QUOTATIONS (ADMIN)` (Line 1011-1042)

**Current:**
```json
"customer": {
  "firstName": "Amit",
  "lastName": "Sharma",
  "mobile": "9876543210"
}
```

**Should be:**
```json
"customer": {
  "firstName": "Amit",
  "lastName": "Sharma",
  "mobile": "9876543210",
  "email": "amit@example.com",
  "address": {
    "street": "123 MG Road",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302012"
  }
}
```

---

## Priority

**HIGH** - This is blocking the Admin Panel's quotation list view from displaying complete customer information. The admin cannot see:
- Customer email addresses in the quotation table
- Complete customer data for management purposes

---

## Notes

- The frontend Admin Panel already expects and displays customer email in the quotation table (line 689 in `app/dashboard/admin/page.tsx`)
- The frontend has been updated to properly map customer data including email and address
- Once the backend returns complete data, the frontend will display it correctly
- This is separate from the `getQuotationById` fix - that endpoint is used for detailed views, this is for list views

---

## Related Issues

**See also:**
- `BACKEND_QUOTATION_BY_ID_FIX.md` - Fix for `GET /quotations/{quotationId}` endpoint

---

**End of Document**


