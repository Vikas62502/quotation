# Frontend to Backend Mapping - Quotation Creation

**Date:** Current  
**Status:** ✅ Updated to Match Backend Controller

---

## Request Body Structure

The frontend sends the following structure, which matches the backend controller's destructuring:

```typescript
{
  customerId: string,
  customer: CustomerObject,
  products: ProductSelection,
  discount: number,
  // REQUIRED FIELDS (at root level - matching backend destructuring)
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

---

## Variable Name Mapping

### Frontend → Backend

| Frontend Variable | Backend Variable | Description |
|-------------------|------------------|-------------|
| `validatedSubtotal` | `subtotal` | Set price (complete package price) |
| `validatedTotalAmount` | `totalAmount` | Amount after discount |
| `validatedFinalAmount` | `finalAmount` | Final amount (subtotal - subsidy) |
| `validatedCentralSubsidy` | `centralSubsidy` | Central government subsidy |
| `validatedStateSubsidy` | `stateSubsidy` | State subsidy |
| `validatedTotalSubsidy` | `totalSubsidy` | Total subsidy (central + state) |
| `validatedAmountAfterSubsidy` | `amountAfterSubsidy` | Amount after subsidy |
| `validatedDiscountAmount` | `discountAmount` | Discount amount |

---

## Calculation Logic (Matching Backend)

### 1. Subtotal
```typescript
// Frontend calculation
const subtotal = Number(totalAmount) // Parameter is actually subtotal value

// Backend expects
req.body.subtotal // Must be > 0
```

### 2. Total Amount
```typescript
// Frontend calculation
const amountAfterSubsidy = subtotal - totalSubsidy
const discountAmount = amountAfterSubsidy * (discount / 100)
const totalAmount = amountAfterSubsidy - discountAmount

// Backend expects
req.body.totalAmount // Amount after discount (Subtotal - Subsidy - Discount)
```

### 3. Final Amount
```typescript
// Frontend calculation
const finalAmount = subtotal - totalSubsidy

// Backend expects
req.body.finalAmount // Subtotal - Subsidy (discount NOT applied)
```

---

## Backend Destructuring

The backend controller destructures exactly as:

```typescript
const { 
  customerId, 
  customer, 
  products, 
  discount = 0,
  subtotal,           // ← From req.body.subtotal
  centralSubsidy,      
  stateSubsidy,        
  totalSubsidy,       
  amountAfterSubsidy,  
  discountAmount,      
  totalAmount,         // ← From req.body.totalAmount
  finalAmount,         // ← From req.body.finalAmount
  pricing: bodyPricing
} = req.body;
```

---

## Frontend Payload Creation

**File:** `lib/quotation-context.tsx` (lines 422-437)

```typescript
const quotationData = {
  customerId,
  customer: currentCustomer,
  products: cleanedProducts,
  discount: Number(discount) || 0,
  // REQUIRED FIELDS (at root level - matching backend destructuring)
  subtotal: validatedSubtotal,
  totalAmount: validatedTotalAmount,
  finalAmount: validatedFinalAmount,
  // Optional but recommended fields
  centralSubsidy: validatedCentralSubsidy,
  stateSubsidy: validatedStateSubsidy,
  totalSubsidy: validatedTotalSubsidy,
  amountAfterSubsidy: validatedAmountAfterSubsidy,
  discountAmount: validatedDiscountAmount,
}
```

---

## Validation Flow

### Frontend Validation (Before API Call)

1. **quotation-confirmation.tsx** - Validates subtotal > 0
2. **quotation-context.tsx** - Validates all three required fields
3. **api.ts** - Logs request body structure

### Backend Validation

1. **Controller** - Destructures from `req.body`
2. **Validation** - Checks `subtotal > 0`, `totalAmount` valid, `finalAmount` valid
3. **Fallback** - Uses `products.systemPrice` if subtotal missing/invalid

---

## Example Request

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

---

## Key Points

1. ✅ **Field Names Match:** Frontend uses exact same variable names as backend expects
2. ✅ **Root Level:** All required fields are at root level of request body
3. ✅ **Calculations Match:** Frontend calculations match backend logic exactly
4. ✅ **Validation:** Frontend validates before sending, backend validates on receipt
5. ✅ **Logging:** Comprehensive logging at every step for debugging

---

## Files Modified

1. **`lib/quotation-context.tsx`**
   - Updated variable names to match backend
   - Updated calculations to match backend logic
   - Enhanced logging to match backend format

2. **`components/quotation-confirmation.tsx`**
   - Updated calculations to match backend
   - Enhanced logging

3. **`lib/api.ts`**
   - Added comprehensive console logging at every step

---

**Status:** ✅ Ready - Frontend matches backend controller exactly


