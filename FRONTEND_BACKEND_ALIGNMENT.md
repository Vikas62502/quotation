# Frontend-Backend Alignment Verification

**Date:** Current  
**Status:** ✅ Fully Aligned

---

## Request Body Structure

### Frontend Sends (lib/quotation-context.tsx:419-434)

```typescript
{
  customerId: string,
  customer: CustomerObject,
  products: ProductSelection,
  discount: number,
  // REQUIRED FIELDS (at root level)
  subtotal: number,              // Set price (complete package price)
  totalAmount: number,            // Amount after discount (Subtotal - Subsidy - Discount)
  finalAmount: number,            // Final amount (Subtotal - Subsidy, discount NOT applied)
  // Optional but recommended
  centralSubsidy: number,
  stateSubsidy: number,
  totalSubsidy: number,
  amountAfterSubsidy: number,
  discountAmount: number
}
```

### Backend Expects (Controller destructuring)

```typescript
const { 
  customerId, 
  customer, 
  products, 
  discount = 0,
  subtotal,           // ← Matches frontend
  centralSubsidy,     // ← Matches frontend
  stateSubsidy,       // ← Matches frontend
  totalSubsidy,       // ← Matches frontend
  amountAfterSubsidy, // ← Matches frontend
  discountAmount,     // ← Matches frontend
  totalAmount,        // ← Matches frontend
  finalAmount,        // ← Matches frontend
  pricing: bodyPricing
} = req.body;
```

✅ **Perfect Match** - All fields are at root level and match exactly

---

## Calculation Logic

### Frontend Calculations (lib/quotation-context.tsx:241-256)

```typescript
const subtotal = Number(subtotalValue) // Set price
const centralSubsidy = Number(currentProducts.centralSubsidy || 0)
const stateSubsidy = Number(currentProducts.stateSubsidy || 0)
const totalSubsidy = centralSubsidy + stateSubsidy
const amountAfterSubsidy = subtotal - totalSubsidy
const discountAmount = amountAfterSubsidy * (discount / 100)
const totalAmount = amountAfterSubsidy - discountAmount  // Subtotal - Subsidy - Discount
const finalAmount = subtotal - totalSubsidy  // Subtotal - Subsidy (no discount)
```

### Backend Calculations (Controller)

```typescript
// Backend uses frontend-provided values as source of truth
// But also has fallback calculation logic:
const pricing = calculatePricing(products, discount);
// Then uses frontend values if provided, otherwise falls back to calculated
```

✅ **Calculations Match** - Frontend sends calculated values, backend uses them

---

## Validation Flow

### Frontend Validation (Before API Call)

1. **quotation-confirmation.tsx** - Validates subtotal > 0
2. **quotation-context.tsx** - Validates all three required fields:
   - `subtotal > 0` ✓
   - `totalAmount` is valid number ✓
   - `finalAmount` is valid number ✓

### Backend Validation (On Receipt)

1. **Controller** - Validates all three required fields:
   - `subtotal > 0` ✓
   - `totalAmount` is valid number ✓
   - `finalAmount` is valid number ✓

✅ **Validation Matches** - Both frontend and backend validate the same way

---

## Field Mapping

| Frontend Variable | Backend Variable | Status |
|-------------------|------------------|--------|
| `validatedSubtotal` → `subtotal` | `req.body.subtotal` | ✅ Match |
| `validatedTotalAmount` → `totalAmount` | `req.body.totalAmount` | ✅ Match |
| `validatedFinalAmount` → `finalAmount` | `req.body.finalAmount` | ✅ Match |
| `validatedCentralSubsidy` → `centralSubsidy` | `req.body.centralSubsidy` | ✅ Match |
| `validatedStateSubsidy` → `stateSubsidy` | `req.body.stateSubsidy` | ✅ Match |
| `validatedTotalSubsidy` → `totalSubsidy` | `req.body.totalSubsidy` | ✅ Match |
| `validatedAmountAfterSubsidy` → `amountAfterSubsidy` | `req.body.amountAfterSubsidy` | ✅ Match |
| `validatedDiscountAmount` → `discountAmount` | `req.body.discountAmount` | ✅ Match |

---

## Example Request (Frontend → Backend)

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
  "subtotal": 240000,           // ← REQUIRED: At root level
  "totalAmount": 162000,        // ← REQUIRED: At root level
  "finalAmount": 162000,        // ← REQUIRED: At root level
  "centralSubsidy": 78000,
  "stateSubsidy": 0,
  "totalSubsidy": 78000,
  "amountAfterSubsidy": 162000,
  "discountAmount": 0
}
```

Backend receives this exact structure and destructures it correctly.

---

## Error Handling

### Frontend Error Messages

- `VAL_001` - Subtotal validation error (user-friendly message)
- `VAL_002` - Total amount validation error
- `VAL_003` - Final amount validation error

### Backend Error Codes

- `VAL_001` - Subtotal is required and must be greater than 0
- `VAL_002` - Total amount is required
- `VAL_003` - Final amount is required

✅ **Error Codes Match** - Frontend handles backend error codes correctly

---

## Logging

### Frontend Logs

- `[saveQuotation]` - All pricing calculations
- `[API]` - Request body structure
- `[QuotationConfirmation]` - Final values before sending

### Backend Logs

- `logInfo('Create quotation request received')` - Request received
- `logInfo('Extracting subtotal value')` - Value extraction
- `logInfo('Quotation pricing validation')` - Validation results

✅ **Logging Comprehensive** - Both sides log extensively for debugging

---

## Verification Checklist

- [x] All required fields sent at root level
- [x] Field names match backend exactly
- [x] Calculations match backend logic
- [x] Validation matches backend expectations
- [x] Error handling matches backend error codes
- [x] Logging comprehensive on both sides
- [x] No duplicate validation code
- [x] All values properly converted to numbers
- [x] All values validated before sending

---

## Summary

✅ **Frontend is fully aligned with backend controller**

The frontend:
1. Sends all required fields at root level
2. Uses exact same variable names as backend
3. Calculates values using same logic
4. Validates before sending
5. Handles all backend error codes
6. Logs extensively for debugging

**The code should work correctly with the backend controller.**

---

**Last Updated:** Current  
**Status:** ✅ Ready for Testing

