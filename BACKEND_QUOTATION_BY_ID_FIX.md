# Backend Fix Required: GET /quotations/{quotationId} - Full Customer Data

**Date:** December 23, 2025  
**Issue:** The `getQuotationById` endpoint is currently using the same limited customer field selection as `getQuotations`, causing missing email and address data in the Admin Panel's Quotation Details dialog.

---

## Problem Summary

The backend `getQuotationById` function (used in route `GET /quotations/:quotationId`) is currently returning incomplete customer data, similar to `getQuotations`:

**Current Implementation (INCORRECT):**
```typescript
// This is what getQuotations does (for list view)
attributes: ['firstName', 'lastName', 'mobile']  // ❌ Missing email and address
```

**The same limited logic is being used in `getQuotationById`, but it SHOULD return complete customer data.**

---

## Required Backend Implementation

### GET /quotations/{quotationId} MUST Return Full Customer Data

The `getQuotationById` endpoint **must** include complete customer information, including:
- `id` (customer ID)
- `firstName`
- `lastName`
- `mobile`
- **`email`** ✅ (currently missing)
- **`address`** ✅ (currently missing)
  - `street`
  - `city`
  - `state`
  - `pincode`

### Correct Backend Implementation

**The `getQuotationById` function should:**

1. **Include ALL customer attributes** (not just firstName, lastName, mobile):
   ```typescript
   include: [{
     model: Customer,
     as: 'customer',
     // ✅ Include ALL customer fields (email, address, etc.)
     // Do NOT use attributes: ['firstName', 'lastName', 'mobile'] like in getQuotations
   }]
   ```

2. **Return complete address object:**
   ```typescript
   customer: {
     id: customer.id,
     firstName: customer.firstName,
     lastName: customer.lastName,
     mobile: customer.mobile,
     email: customer.email,  // ✅ Include email
     address: {               // ✅ Include complete address
       street: customer.streetAddress || customer.address?.street || "",
       city: customer.city || "",
       state: customer.state || "",
       pincode: customer.pincode || ""
     }
   }
   ```

---

## Expected API Response

**GET /quotations/{quotationId}** should return:

```json
{
  "success": true,
  "data": {
    "id": "QT-MX6P43",
    "dealerId": "dealer_8",
    "customer": {
      "id": "cust_789",
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
    "products": {
      "systemType": "on-grid",
      // ... all product details
    },
    "pricing": {
      // ... pricing details
    },
    "status": "pending",
    "discount": 0,
    "createdAt": "2025-12-25T10:30:00Z",
    "validUntil": "2025-12-30T10:30:00Z"
  }
}
```

**Critical:** The `customer` object MUST include:
- ✅ `email` field
- ✅ `address` object with `street`, `city`, `state`, `pincode`

---

## Difference Between `getQuotations` and `getQuotationById`

| Endpoint | Purpose | Customer Data Returned |
|----------|---------|----------------------|
| `GET /quotations` | List view (table) | Limited: `firstName`, `lastName`, `mobile` only (for performance) |
| `GET /quotations/{quotationId}` | Details view (dialog) | **Complete: All fields including `email` and `address`** |

**Important:** These endpoints serve different purposes:
- `getQuotations` returns a list of quotations for table display (limited fields for performance)
- `getQuotationById` returns a single quotation for detailed view (must include all fields)

**The `getQuotationById` function should NOT reuse the limited field selection logic from `getQuotations`.**

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

- [ ] **Review `getQuotationById` implementation**
  - [ ] Remove any `attributes: ['firstName', 'lastName', 'mobile']` limitation
  - [ ] Ensure ALL customer fields are included in the query
  - [ ] Verify email is included in the response
  - [ ] Verify address object is included with all fields (street, city, state, pincode)

- [ ] **Verify Customer Include Statement**
  ```typescript
  include: [{
    model: Customer,
    as: 'customer',
    // ✅ DO NOT specify attributes array (or include ALL fields if you do)
  }]
  ```

- [ ] **Verify Response Formatting**
  - [ ] Map `streetAddress` (DB) to `address.street` (API response)
  - [ ] Include complete `address` object structure
  - [ ] Include `email` field
  - [ ] Include `customer.id` field

- [ ] **Testing**
  - [ ] Test GET /quotations/{quotationId} returns complete customer data
  - [ ] Verify email is present in response
  - [ ] Verify address object contains all fields (street, city, state, pincode)
  - [ ] Test with quotations that have customers with email and address data
  - [ ] Test with quotations that have customers with missing/null email or address (should handle gracefully)

---

## Frontend Impact

**Current Issue:**
- Admin Panel's Quotation Details dialog shows empty fields for:
  - Email Address ❌
  - Complete Address ❌
  - PIN ❌

**After Fix:**
- All customer fields will be populated correctly
- Admin can view complete customer information
- Admin can edit customer details (email, address) if needed

---

## API Specification Reference

The API specification already documents this correctly:

**File:** `API_SPECIFICATION.txt`  
**Section:** `C. GET QUOTATION BY ID` (Line 612-655)

The specification shows:
```json
"customer": {
  "id": "cust_789",
  "firstName": "Amit",
  "lastName": "Sharma",
  "mobile": "9876543210",
  "email": "amit@example.com",  // ✅ Specified
  "address": {                   // ✅ Specified
    "street": "123 MG Road",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pincode": "302012"
  }
}
```

**The backend implementation must match this specification.**

---

## Priority

**HIGH** - This is blocking the Admin Panel's Quotation Details functionality. The admin cannot see:
- Customer email addresses
- Complete customer addresses
- This prevents proper customer data management

---

## Notes

- The frontend `QuotationDetailsDialog` component already calls `api.quotations.getById(quotationId)` correctly
- The frontend expects complete customer data including email and address
- Once the backend returns complete data, the frontend will display it correctly
- This fix is separate from `getQuotations` - that endpoint can continue to return limited fields for performance

---

**End of Document**



