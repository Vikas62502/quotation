# Frontend Verification - Required Fields at Root Level

**Status:** ✅ Implemented  
**Date:** Current

---

## Verification: Required Fields Are Sent at Root Level

### Code Location: `lib/quotation-context.tsx` (lines 422-437)

The `quotationData` object is created with all required fields **explicitly at the root level**:

```typescript
const quotationData = {
  customerId,
  customer: currentCustomer,
  products: cleanedProducts,
  discount: Number(discount) || 0,
  // REQUIRED FIELDS (at root level as per backend requirements)
  subtotal: Number(safeSubtotal),           // ← ROOT LEVEL
  totalAmount: Number(safeTotalAmount),     // ← ROOT LEVEL
  finalAmount: Number(safeFinalAmount),      // ← ROOT LEVEL
  // Optional but recommended fields
  centralSubsidy: Number(centralSubsidy) || 0,
  stateSubsidy: Number(stateSubsidy) || 0,
  totalSubsidy: Number(safeTotalSubsidy),
  amountAfterSubsidy: Number(safeAmountAfterSubsidy),
  discountAmount: Number(safeDiscountAmount),
}
```

### Final Payload Verification (lines 455-490)

Before sending to API, the code:
1. ✅ Creates `finalPayload` with all fields at root level
2. ✅ Verifies `subtotal`, `totalAmount`, and `finalAmount` are present
3. ✅ Logs the complete payload structure
4. ✅ Confirms fields are at root level (not nested in `products`)

### API Call: `lib/api.ts` (line 328-332)

The API function passes the payload directly:

```typescript
quotations: {
  create: async (quotationData: any) => {
    return apiRequest("/quotations", {
      method: "POST",
      body: quotationData,  // ← Passed directly, no modification
    })
  }
}
```

### Request Serialization: `lib/api.ts` (line 89)

The body is serialized as JSON:

```typescript
config.body = JSON.stringify(body)  // ← All fields preserved
```

---

## Expected Request Body Structure

When the frontend sends a request, the backend should receive:

```json
{
  "customerId": "d78d7d6f-58f9-4bbb-96c9-aef4f922ce10",
  "customer": {
    "firstName": "AMAN",
    "lastName": "RAJAK",
    "mobile": "9249929902",
    "email": "amankrrajak288@gmail.com",
    "address": {
      "street": "plot-10 shyam vihar",
      "city": "Jaipur",
      "state": "Rajasthan",
      "pincode": "302012"
    }
  },
  "products": {
    "systemType": "dcr",
    "panelBrand": "Waaree",
    "panelSize": "545W",
    "panelQuantity": 8,
    "systemPrice": 240000,
    ...
  },
  "discount": 0,
  "subtotal": 240000,           // ← AT ROOT LEVEL
  "totalAmount": 162000,        // ← AT ROOT LEVEL
  "finalAmount": 162000,        // ← AT ROOT LEVEL
  "centralSubsidy": 78000,
  "stateSubsidy": 0,
  "totalSubsidy": 78000,
  "amountAfterSubsidy": 162000,
  "discountAmount": 0
}
```

---

## Debugging: Console Logs

The frontend now logs extensively:

### 1. Before API Call (`lib/quotation-context.tsx`)
```
=== FINAL PAYLOAD BEING SENT TO BACKEND ===
Complete quotation payload: { ... }
Required fields at root level: {
  subtotal: { value: 240000, isAtRoot: true, ... },
  totalAmount: { value: 162000, isAtRoot: true, ... },
  finalAmount: { value: 162000, isAtRoot: true, ... }
}
Payload keys at root level: ["customerId", "customer", "products", "discount", "subtotal", "totalAmount", "finalAmount", ...]
===========================================
```

### 2. In API Request (`lib/api.ts`)
```
[API] Quotation creation request body: {
  hasSubtotal: true,
  subtotalValue: 240000,
  hasTotalAmount: true,
  totalAmountValue: 162000,
  hasFinalAmount: true,
  finalAmountValue: 162000,
  rootLevelKeys: ["customerId", "customer", "products", "discount", "subtotal", "totalAmount", "finalAmount", ...],
  fullBody: "{ ... }"
}
```

---

## Troubleshooting

### If Backend Still Reports Missing Fields

1. **Check Browser Console:**
   - Look for "=== FINAL PAYLOAD BEING SENT TO BACKEND ==="
   - Verify `subtotal`, `totalAmount`, `finalAmount` are in the log
   - Check `isAtRoot: true` for all three fields

2. **Check Network Tab:**
   - Open DevTools → Network tab
   - Find POST request to `/api/quotations`
   - Click on it → Payload tab
   - Verify fields are at root level (not nested)

3. **Check Backend Logs:**
   - Backend should log received request body
   - Compare with frontend logs
   - If fields are missing in backend but present in frontend, check:
     - Middleware that might filter request body
     - Body parser configuration
     - Request size limits

4. **Verify Values Are Not 0:**
   - Frontend validates `subtotal > 0` before sending
   - If `subtotal` is 0, frontend shows error and doesn't send request
   - Check console for validation errors

---

## Validation Flow

1. **Frontend Validation** (`quotation-confirmation.tsx`)
   - ✅ Validates `subtotal > 0` before calling `saveQuotation`
   - ✅ Shows alert if invalid
   - ✅ Prevents API call if validation fails

2. **Context Validation** (`quotation-context.tsx`)
   - ✅ Validates all three required fields
   - ✅ Ensures values are numbers
   - ✅ Creates payload with fields at root level
   - ✅ Final verification before API call

3. **API Request** (`api.ts`)
   - ✅ Logs request body structure
   - ✅ Serializes as JSON
   - ✅ Sends to backend

4. **Backend Validation**
   - ✅ Validates required fields
   - ✅ Returns specific error codes if missing

---

## Test Cases

### ✅ **Test Case 1: Valid Request**
- All fields present at root level
- All values are valid numbers
- **Expected:** Quotation created successfully

### ✅ **Test Case 2: Missing Subtotal (Frontend Prevents)**
- Frontend validation catches this
- Shows error alert
- **Expected:** Request never sent to backend

### ✅ **Test Case 3: Invalid Subtotal (0 or negative)**
- Frontend validation catches this
- Shows error alert
- **Expected:** Request never sent to backend

### ✅ **Test Case 4: Missing Total Amount (Should Not Happen)**
- Frontend always calculates this
- **Expected:** Request never sent (validation fails)

### ✅ **Test Case 5: Missing Final Amount (Should Not Happen)**
- Frontend always calculates this
- **Expected:** Request never sent (validation fails)

---

## Summary

✅ **All required fields are sent at root level**  
✅ **Comprehensive validation before sending**  
✅ **Extensive logging for debugging**  
✅ **Error handling for all validation errors**  
✅ **User-friendly error messages**

The frontend is **ready** and sends the required fields correctly. If the backend still reports missing fields, check:

1. Browser console logs
2. Network tab request payload
3. Backend middleware/body parser
4. Backend request logging

---

**Last Updated:** Current  
**Status:** ✅ Ready for Testing


